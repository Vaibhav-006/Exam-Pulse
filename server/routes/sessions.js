import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/sessions/join - student joins a test
router.post('/join', async (req, res) => {
  const { joinCode, studentName } = req.body;
  if (!joinCode || !studentName)
    return res.status(400).json({ error: 'Join code and name are required' });

  try {
    const test = await prisma.test.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: { questions: { orderBy: { orderNum: 'asc' } } },
    });

    if (!test) return res.status(404).json({ error: 'Invalid test code' });
    if (test.status !== 'active') return res.status(403).json({ error: 'This test is not currently active' });

    const studentToken = uuidv4();
    const session = await prisma.session.create({
      data: { testId: test.id, studentName, studentToken },
    });

    // Return test questions WITHOUT correct answers
    const sanitizedQuestions = test.questions.map(q => ({
      id: q.id,
      stem: q.stem,
      options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
      orderNum: q.orderNum,
    }));

    res.json({
      sessionId: session.id,
      studentToken,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        durationMins: test.durationMins,
        totalQuestions: test.totalQuestions,
        passingScore: test.passingScore,
        showResultsNow: test.showResultsNow,
      },
      questions: sanitizedQuestions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/violation - report violation
router.post('/:id/violation', async (req, res) => {
  const { studentToken, violationType } = req.body;
  try {
    const session = await prisma.session.findFirst({
      where: { id: parseInt(req.params.id), studentToken },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { violationCount: { increment: 1 } },
    });

    res.json({ violationCount: updated.violationCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/teacher/:testId - teacher gets all sessions for a test
router.get('/teacher/:testId', authMiddleware, async (req, res) => {
  try {
    const test = await prisma.test.findFirst({
      where: { id: parseInt(req.params.testId), teacherId: req.teacher.id },
    });
    if (!test) return res.status(403).json({ error: 'Access denied' });

    const sessions = await prisma.session.findMany({
      where: { testId: parseInt(req.params.testId) },
      include: { _count: { select: { answers: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
