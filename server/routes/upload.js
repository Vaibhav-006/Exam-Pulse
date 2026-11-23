import express from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';
import { parseDocument, extractDirectMCQs } from '../services/documentParser.js';
import { generateMCQs, generateMCQsByTopic, regenerateSingleQuestion } from '../services/aiService.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
  },
});

// 1. POST /api/upload/document - generate MCQs from an uploaded document
router.post('/document', authMiddleware, upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { numQuestions, topic = '', difficulty = 'medium' } = req.body;

  try {
    const rawText = await parseDocument(
      req.file.path,
      req.file.mimetype,
      path.extname(req.file.originalname).toLowerCase()
    );

    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract sufficient text from the document. Please verify the file.' });
    }

    // Fast Path: Check if document already has structured MCQs (e.g. Question Bank PDF)
    const directQuestions = extractDirectMCQs(rawText, difficulty);
    const potentialQuestionMatches = (rawText.match(/(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*\d+[\.:\)\-–]|\b\d+[\.:\)\-–]\s+[A-Za-z])/gi) || []).length;

    const isSolidDirectExtraction = directQuestions && directQuestions.length >= 3 &&
      (potentialQuestionMatches <= 5 || directQuestions.length >= potentialQuestionMatches * 0.4);

    if (isSolidDirectExtraction) {
      const finalQuestions = (numQuestions && parseInt(numQuestions) > 0)
        ? directQuestions.slice(0, parseInt(numQuestions))
        : directQuestions;
      return res.json({
        success: true,
        extractedQuestions: finalQuestions,
        totalGenerated: finalQuestions.length,
        method: 'direct_question_bank',
        difficulty,
      });
    }

    // AI Path: Synthesize from raw unstructured content using Gemini
    const count = numQuestions ? parseInt(numQuestions) : null;
    const mcqs = await generateMCQs(rawText, count, topic, difficulty);

    res.json({
      success: true,
      extractedQuestions: mcqs,
      totalGenerated: mcqs.length,
      method: 'ai_synthesis',
      requestedCount: count || 'all',
      difficulty,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/upload/topic - generate MCQs directly from topic prompt (no file required)
router.post('/topic', authMiddleware, async (req, res) => {
  const { topicPrompt, numQuestions = 10, difficulty = 'medium' } = req.body;

  if (!topicPrompt || topicPrompt.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide a descriptive topic or syllabus prompt.' });
  }

  try {
    const mcqs = await generateMCQsByTopic(topicPrompt.trim(), parseInt(numQuestions), difficulty);

    res.json({
      success: true,
      extractedQuestions: mcqs,
      totalGenerated: mcqs.length,
      requestedCount: parseInt(numQuestions),
      difficulty,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/upload/regenerate-question - refine or replace a single question with AI
router.post('/regenerate-question', authMiddleware, async (req, res) => {
  const { currentQuestion, instruction, difficulty = 'medium', topic = '' } = req.body;

  if (!currentQuestion || !currentQuestion.stem) {
    return res.status(400).json({ error: 'Valid current question is required.' });
  }

  try {
    const refined = await regenerateSingleQuestion(currentQuestion, instruction, difficulty, topic);
    res.json({ success: true, question: refined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
