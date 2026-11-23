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

    let assigned = null;
    try {
      if (session.assignedQuestions) assigned = JSON.parse(session.assignedQuestions);
    } catch {}

    const optionsMap = assigned?.optionsMap || {};
    const totalQuestionsCount = assigned?.questionIds?.length || questions.length;

    let score = 0;
    const answerRecords = answers.map(a => {
      // Map candidate's displayed option back to original option letter (if options were shuffled)
      const qOptMap = optionsMap[a.questionId] || optionsMap[String(a.questionId)];
      const originalOption = (qOptMap && a.chosenOption) ? (qOptMap[a.chosenOption] || a.chosenOption) : a.chosenOption;
      const isCorrect = questionMap[a.questionId] === originalOption;
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

    const scorePercent = totalQuestionsCount > 0 ? Math.round((score / totalQuestionsCount) * 100) : 0;

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: { status: 'submitted', submittedAt: new Date(), score: scorePercent },
      include: { test: { select: { showResultsNow: true, passingScore: true, title: true } } },
    });

    if (updatedSession.test.showResultsNow) {
      const review = questions.map(q => {
        const userAns = answerRecords.find(a => a.questionId === q.id);
        const qOptMap = optionsMap[q.id] || optionsMap[String(q.id)];

        // Reconstruct exact shuffled options displayed to this candidate
        const displayedOptions = qOptMap ? {
          A: q['option' + qOptMap.A],
          B: q['option' + qOptMap.B],
          C: q['option' + qOptMap.C],
          D: q['option' + qOptMap.D],
        } : { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };

        // Identify which displayed option slot corresponded to the original correct answer
        const displayedCorrectOption = qOptMap
          ? Object.keys(qOptMap).find(k => qOptMap[k] === q.correctOption) || q.correctOption
          : q.correctOption;

        return {
          id: q.id,
          stem: q.stem,
          options: displayedOptions,
          chosenOption: userAns?.chosenOption || null,
          correctOption: displayedCorrectOption,
          isCorrect: userAns ? userAns.isCorrect : false,
          explanation: q.explanation || `Option ${displayedCorrectOption} is correct.`,
          difficulty: q.difficulty || 'medium'
        };
      });

      res.json({
        submitted: true,
        score: scorePercent,
        correct: score,
        total: totalQuestionsCount,
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
