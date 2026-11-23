import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Utility: Fisher-Yates array shuffling
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /api/sessions/join - student joins a test
router.post('/join', async (req, res) => {
  const { joinCode, studentName, rollNo } = req.body;
  if (!joinCode || !studentName || !rollNo || !rollNo.trim())
    return res.status(400).json({ error: 'Join code, full name, and Roll Number are required' });

  const cleanRollNo = rollNo.trim().toUpperCase();
  const cleanName = studentName.trim();

  try {
    const test = await prisma.test.findUnique({
      where: { joinCode: joinCode.trim().toUpperCase() },
      include: { questions: { orderBy: { orderNum: 'asc' } } },
    });

    if (!test) return res.status(404).json({ error: 'Invalid test code' });

    // Status checks
    if (test.status === 'paused') {
      return res.status(403).json({ error: 'This exam is currently paused by the instructor. Access is suspended.' });
    }
    if (test.status === 'closed') {
      return res.status(403).json({ error: 'This exam has ended and is now closed.' });
    }
    if (test.status !== 'active') {
      return res.status(403).json({ error: 'This exam is not currently accepting attempts.' });
    }

    // Schedule window checks
    const now = new Date();
    if (test.startsAt && now < new Date(test.startsAt)) {
      return res.status(403).json({
        error: `This exam is scheduled to open on ${new Date(test.startsAt).toLocaleString()}. You cannot attempt it yet.`
      });
    }
    if (test.endsAt && now > new Date(test.endsAt)) {
      return res.status(403).json({
        error: `This exam has expired. The scheduled window closed on ${new Date(test.endsAt).toLocaleString()}.`
      });
    }

    // Check previous attempts with this Roll Number on this test
    const existingSession = await prisma.session.findFirst({
      where: { testId: test.id, rollNo: cleanRollNo },
      orderBy: { joinedAt: 'desc' },
    });

    if (existingSession) {
      if (existingSession.status === 'aborted') {
        if (!existingSession.allowRetest) {
          return res.status(403).json({
            error: `Candidate with Roll No. "${cleanRollNo}" was disqualified/aborted by the instructor (${existingSession.abortReason || 'Integrity violation'}). Retest is not permitted unless authorized by your teacher.`,
            isAborted: true,
          });
        }
      } else if (existingSession.status === 'submitted') {
        return res.status(403).json({
          error: `An exam has already been submitted under Roll No. "${cleanRollNo}". Multiple attempts are not permitted.`,
        });
      } else if (existingSession.status === 'active' && existingSession.assignedQuestions) {
        // Resume existing active attempt with exact same assigned questions & options
        try {
          const assigned = JSON.parse(existingSession.assignedQuestions);
          const qMap = new Map(test.questions.map(q => [q.id, q]));
          const sanitizedQuestions = [];

          assigned.questionIds.forEach((qid, idx) => {
            const q = qMap.get(qid);
            if (!q) return;
            const qOptMap = assigned.optionsMap?.[qid];
            if (qOptMap) {
              sanitizedQuestions.push({
                id: q.id,
                stem: q.stem,
                options: {
                  A: q['option' + qOptMap.A],
                  B: q['option' + qOptMap.B],
                  C: q['option' + qOptMap.C],
                  D: q['option' + qOptMap.D],
                },
                orderNum: idx,
              });
            } else {
              sanitizedQuestions.push({
                id: q.id,
                stem: q.stem,
                options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
                orderNum: idx,
              });
            }
          });

          return res.json({
            sessionId: existingSession.id,
            studentToken: existingSession.studentToken,
            studentName: cleanName,
            rollNo: cleanRollNo,
            test: {
              id: test.id,
              title: test.title,
              description: test.description,
              durationMins: test.durationMins,
              totalQuestions: sanitizedQuestions.length,
              passingScore: test.passingScore,
              showResultsNow: test.showResultsNow,
              startsAt: test.startsAt,
              endsAt: test.endsAt,
              isPool: !!(test.questionsPerStudent && test.questionsPerStudent < test.questions.length),
            },
            questions: sanitizedQuestions,
          });
        } catch (e) {
          // Fall through to re-generate if parse fails
        }
      }
    }

    // 1. Dynamic Question Pool / Subset Selection
    let selectedQuestions = [...test.questions];
    if (test.questionsPerStudent && test.questionsPerStudent > 0 && test.questionsPerStudent < test.questions.length) {
      // Pick random subset from pool
      selectedQuestions = shuffleArray(test.questions).slice(0, test.questionsPerStudent);
    } else if (test.shuffleQuestions) {
      // Full test with question order shuffling
      selectedQuestions = shuffleArray(selectedQuestions);
    }

    // 2. Option Shuffling
    const optionsMap = {};
    const sanitizedQuestions = [];

    selectedQuestions.forEach((q, idx) => {
      if (test.shuffleOptions) {
        const orig = [
          { key: 'A', text: q.optionA },
          { key: 'B', text: q.optionB },
          { key: 'C', text: q.optionC },
          { key: 'D', text: q.optionD },
        ];
        const shuffled = shuffleArray(orig);
        optionsMap[q.id] = {
          A: shuffled[0].key,
          B: shuffled[1].key,
          C: shuffled[2].key,
          D: shuffled[3].key,
        };
        sanitizedQuestions.push({
          id: q.id,
          stem: q.stem,
          options: {
            A: shuffled[0].text,
            B: shuffled[1].text,
            C: shuffled[2].text,
            D: shuffled[3].text,
          },
          orderNum: idx,
        });
      } else {
        optionsMap[q.id] = { A: 'A', B: 'B', C: 'C', D: 'D' };
        sanitizedQuestions.push({
          id: q.id,
          stem: q.stem,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          orderNum: idx,
        });
      }
    });

    const assignedQuestionsPayload = JSON.stringify({
      questionIds: selectedQuestions.map(q => q.id),
      optionsMap,
    });

    const studentToken = uuidv4();
    const session = await prisma.session.create({
      data: {
        testId: test.id,
        studentName: cleanName,
        rollNo: cleanRollNo,
        studentToken,
        status: 'active',
        assignedQuestions: assignedQuestionsPayload,
      },
    });

    res.json({
      sessionId: session.id,
      studentToken,
      studentName: cleanName,
      rollNo: cleanRollNo,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        durationMins: test.durationMins,
        totalQuestions: sanitizedQuestions.length,
        passingScore: test.passingScore,
        showResultsNow: test.showResultsNow,
        startsAt: test.startsAt,
        endsAt: test.endsAt,
        isPool: !!(test.questionsPerStudent && test.questionsPerStudent < test.questions.length),
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

// POST /api/sessions/:id/abort - teacher aborts student session live
router.post('/:id/abort', authMiddleware, async (req, res) => {
  const { reason } = req.body;
  try {
    const session = await prisma.session.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { test: true },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.test.teacherId !== req.teacher.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'aborted',
        abortReason: reason || 'Terminated live by instructor for academic integrity violation',
        allowRetest: false,
        submittedAt: new Date(),
      },
    });

    res.json({ success: true, session: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sessions/:id/allow-retest - teacher allows aborted candidate to retest
router.patch('/:id/allow-retest', authMiddleware, async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { test: true },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.test.teacherId !== req.teacher.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { allowRetest: true },
    });

    res.json({
      success: true,
      message: `Retest permission granted for ${session.studentName} (Roll No: ${session.rollNo || 'N/A'})`,
      session: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/status - student checks their current session status (for abort / pause detection)
router.get('/:id/status', async (req, res) => {
  const { studentToken } = req.query;
  try {
    const session = await prisma.session.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        status: true,
        abortReason: true,
        studentToken: true,
        test: {
          select: {
            status: true,
            endsAt: true,
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (studentToken && session.studentToken !== studentToken) {
      return res.status(403).json({ error: 'Unauthorized session' });
    }
    res.json({
      status: session.status,
      abortReason: session.abortReason,
      testStatus: session.test?.status,
      endsAt: session.test?.endsAt,
    });
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
