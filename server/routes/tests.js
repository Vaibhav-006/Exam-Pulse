import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { nanoid } from '../utils/helpers.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tests - list teacher's tests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      where: { teacherId: req.teacher.id },
      include: { _count: { select: { sessions: true, questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tests/:id - get single test with questions
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const test = await prisma.test.findFirst({
      where: { id: parseInt(req.params.id), teacherId: req.teacher.id },
      include: { questions: { orderBy: { orderNum: 'asc' } }, sessions: true },
    });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tests - create new test
router.post('/', authMiddleware, async (req, res) => {
  const {
    title,
    description,
    durationMins,
    totalQuestions,
    passingScore,
    difficulty = 'medium',
    showResultsNow,
    startsAt,
    endsAt,
    questions,
  } = req.body;

  if (!title || !questions || questions.length === 0)
    return res.status(400).json({ error: 'Title and questions are required' });

  try {
    const joinCode = nanoid(6).toUpperCase();
    const test = await prisma.test.create({
      data: {
        teacherId: req.teacher.id,
        title,
        description: description || '',
        joinCode,
        durationMins: durationMins || 30,
        totalQuestions: questions.length,
        passingScore: passingScore || 50,
        difficulty: difficulty || 'medium',
        showResultsNow: showResultsNow !== false,
        status: 'active',
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        questions: {
          create: questions.map((q, i) => ({
            stem: q.stem,
            optionA: q.options.A,
            optionB: q.options.B,
            optionC: q.options.C,
            optionD: q.options.D,
            correctOption: q.correct,
            explanation: q.explanation || null,
            difficulty: q.difficulty || difficulty || 'medium',
            orderNum: i,
          })),
        },
      },
      include: { questions: true },
    });
    res.status(201).json(test);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tests/:id/status - pause / open / close test
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'closed', 'draft'].includes(status))
    return res.status(400).json({ error: 'Invalid status. Allowed: active, paused, closed, draft' });

  try {
    const test = await prisma.test.updateMany({
      where: { id: parseInt(req.params.id), teacherId: req.teacher.id },
      data: { status },
    });
    if (test.count === 0) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tests/:id/schedule - update scheduled time window
router.patch('/:id/schedule', authMiddleware, async (req, res) => {
  const { startsAt, endsAt } = req.body;
  try {
    const test = await prisma.test.updateMany({
      where: { id: parseInt(req.params.id), teacherId: req.teacher.id },
      data: {
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });
    if (test.count === 0) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tests/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.test.deleteMany({
      where: { id: parseInt(req.params.id), teacherId: req.teacher.id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tests/join/:code - student checks test validity (no auth needed)
router.get('/join/:code', async (req, res) => {
  try {
    const test = await prisma.test.findUnique({
      where: { joinCode: req.params.code.toUpperCase() },
      select: {
        id: true,
        title: true,
        description: true,
        durationMins: true,
        totalQuestions: true,
        status: true,
        passingScore: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!test) return res.status(404).json({ error: 'Invalid test code. Please check with your teacher.' });

    if (test.status === 'paused') {
      return res.status(403).json({ error: 'This exam is currently paused by the instructor. Access is suspended.' });
    }
    if (test.status === 'closed') {
      return res.status(403).json({ error: 'This exam has ended and is now closed.' });
    }
    if (test.status !== 'active') {
      return res.status(403).json({ error: 'This exam is currently in draft mode and not accepting attempts.' });
    }

    const now = new Date();
    if (test.startsAt && now < new Date(test.startsAt)) {
      return res.status(403).json({
        error: `This exam is scheduled to open on ${new Date(test.startsAt).toLocaleString()}. You cannot attempt it yet.`,
      });
    }
    if (test.endsAt && now > new Date(test.endsAt)) {
      return res.status(403).json({
        error: `This exam has expired. The scheduled window closed on ${new Date(test.endsAt).toLocaleString()}.`,
      });
    }

    res.json(test);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
