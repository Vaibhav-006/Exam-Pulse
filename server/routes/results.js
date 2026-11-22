import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/results/submit - student submits answers
router.post('/submit', async (req, res) => {
  const { sessionId, studentToken, answers } = req.body;
  // answers: [{ questionId, chosenOption }]

  if (!sessionId || !studentToken || !answers)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const session = await prisma.session.findFirst({
      where: { id: parseInt(sessionId), studentToken },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'submitted') return res.status(409).json({ error: 'Already submitted' });

    // Get correct answers
    const questions = await prisma.question.findMany({
      where: { id: { in: answers.map(a => a.questionId) } },
    });

    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q.correctOption; });

    let score = 0;
    const answerRecords = answers.map(a => {
      const isCorrect = questionMap[a.questionId] === a.chosenOption;
      if (isCorrect) score++;
      return {
        sessionId: session.id,
        questionId: a.questionId,
        chosenOption: a.chosenOption || null,
        isCorrect,
      };
    });

    // Upsert answers
    for (const ans of answerRecords) {
      await prisma.answer.upsert({
        where: { sessionId_questionId: { sessionId: ans.sessionId, questionId: ans.questionId } },
        update: { chosenOption: ans.chosenOption, isCorrect: ans.isCorrect },
        create: ans,
      });
    }

    const scorePercent = Math.round((score / questions.length) * 100);

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: { status: 'submitted', submittedAt: new Date(), score: scorePercent },
      include: { test: { select: { showResultsNow: true, passingScore: true, title: true } } },
    });

    if (updatedSession.test.showResultsNow) {
      const review = questions.map(q => {
        const userAns = answerRecords.find(a => a.questionId === q.id);
        return {
          id: q.id,
          stem: q.stem,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          chosenOption: userAns?.chosenOption || null,
          correctOption: q.correctOption,
          isCorrect: userAns ? userAns.isCorrect : false,
          explanation: q.explanation || `Option ${q.correctOption} is correct.`,
          difficulty: q.difficulty || 'medium'
        };
      });

      res.json({
        submitted: true,
        score: scorePercent,
        correct: score,
        total: questions.length,
        passed: scorePercent >= updatedSession.test.passingScore,
        review,
      });
    } else {
      res.json({ submitted: true, message: 'Results will be shared by your teacher.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/results/test/:testId - teacher gets all results
router.get('/test/:testId', authMiddleware, async (req, res) => {
  try {
    const test = await prisma.test.findFirst({
      where: { id: parseInt(req.params.testId), teacherId: req.teacher.id },
    });
    if (!test) return res.status(403).json({ error: 'Access denied' });

    const sessions = await prisma.session.findMany({
      where: { testId: parseInt(req.params.testId) },
      include: {
        answers: { include: { question: { select: { stem: true, correctOption: true } } } },
      },
      orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
    });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
