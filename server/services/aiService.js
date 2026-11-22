import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

let genAI = null;

function getAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please add it to server/.env');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Clean and parse JSON returned from Gemini (handles markdown fences, extra text)
function parseGeminiJSON(text) {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    cleaned = cleaned.substring(arrayStart, arrayEnd + 1);
  } else {
    // Check if it's a single object
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1) {
      cleaned = cleaned.substring(objStart, objEnd + 1);
    }
  }

  return JSON.parse(cleaned);
}

const DIFFICULTY_GUIDELINES = {
  easy: 'Focus on core definitions, direct facts, and fundamental concepts. Distractors should be distinct.',
  medium: 'Require conceptual understanding, application of principles, and multi-step deduction. Distractors should address common misconceptions.',
  hard: 'Involve complex problem-solving, edge cases, nuanced analysis, or analytical problem-solving. Distractors must be highly plausible.',
  olympiad: 'Challenging, advanced Olympiad/competitive exam standard requiring synthesis of multiple advanced principles, deep critical thinking, and tricky problem traps.',
  mixed: 'A balanced distribution of 30% easy, 50% medium, and 20% hard conceptual questions.'
};

/**
 * 1. Generate MCQs from raw document content with explanations and difficulty.
 */
export async function generateMCQs(rawText, numQuestions = 10, topic = '', difficulty = 'medium') {
  const ai = getAI();
  const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

  const diffGuide = DIFFICULTY_GUIDELINES[difficulty] || DIFFICULTY_GUIDELINES.medium;
  const topicClause = topic ? `Focus heavily on concepts and topics related to: "${topic}".` : '';

  const prompt = `You are a world-class academic test architect and exam designer. Analyze the following document text and author exactly ${numQuestions} high-caliber multiple choice questions (MCQs).

Target Difficulty: ${difficulty.toUpperCase()}
Difficulty Guidelines: ${diffGuide}
${topicClause}

Core Requirements:
1. Each question must have exactly 4 plausible options labeled A, B, C, D.
2. Only ONE option must be scientifically / factually correct.
3. Every question MUST include a detailed, educational "explanation" that clarifies why the correct option is true and briefly why other choices are distractors.
4. "difficulty" must be set to "${difficulty}".
5. Return ONLY a valid JSON array of objects. Do not write introductory or concluding prose.

Exact JSON Schema:
[
  {
    "stem": "Precise question prompt here?",
    "options": {
      "A": "Option text",
      "B": "Option text",
      "C": "Option text",
      "D": "Option text"
    },
    "correct": "A",
    "explanation": "Clear step-by-step reasoning explaining why option A is correct and why B, C, D are misconceptions.",
    "difficulty": "${difficulty}"
  }
]

DOCUMENT CONTENT:
${rawText.substring(0, 20000)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let mcqs;
  try {
    mcqs = parseGeminiJSON(text);
  } catch (err) {
    throw new Error('AI returned an invalid JSON response. Please try again. Raw snippet: ' + text.substring(0, 150));
  }

  if (!Array.isArray(mcqs) || mcqs.length === 0) {
    throw new Error('AI failed to generate question array from the document.');
  }

  const valid = mcqs.filter(q =>
    q.stem &&
    q.options && q.options.A && q.options.B && q.options.C && q.options.D &&
    ['A', 'B', 'C', 'D'].includes(q.correct)
  ).map(q => ({
    ...q,
    explanation: q.explanation || `Option ${q.correct} is correct based on the syllabus.`,
    difficulty: q.difficulty || difficulty
  }));

  if (valid.length === 0) {
    throw new Error('Questions generated were missing required fields.');
  }

  return valid.slice(0, numQuestions);
}

/**
 * 2. Generate MCQs purely from a Topic/Prompt without requiring a document file.
 */
export async function generateMCQsByTopic(topicPrompt, numQuestions = 10, difficulty = 'medium') {
  const ai = getAI();
  const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

  const diffGuide = DIFFICULTY_GUIDELINES[difficulty] || DIFFICULTY_GUIDELINES.medium;

  const prompt = `You are an elite exam author and pedagogical curriculum expert. Create a complete, professional ${numQuestions}-question multiple choice exam based on the following subject/topic prompt:

EXAM SUBJECT / PROMPT: "${topicPrompt}"
DIFFICULTY LEVEL: ${difficulty.toUpperCase()} (${diffGuide})

Rules:
1. Generate exactly ${numQuestions} distinct, well-crafted MCQs testing core and advanced aspects of this subject.
2. 4 options (A, B, C, D) per question with only ONE undeniably correct answer.
3. Include an insightful, step-by-step "explanation" for every question so students learn from their test.
4. Set "difficulty" to "${difficulty}".
5. Return ONLY a valid JSON array.

Exact JSON Output:
[
  {
    "stem": "Question prompt text?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correct": "A",
    "explanation": "Detailed step-by-step reasoning explaining why A is correct.",
    "difficulty": "${difficulty}"
  }
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let mcqs;
  try {
    mcqs = parseGeminiJSON(text);
  } catch (err) {
    throw new Error('AI returned an invalid JSON response. Please try again. Raw snippet: ' + text.substring(0, 150));
  }

  if (!Array.isArray(mcqs) || mcqs.length === 0) {
    throw new Error('AI failed to generate question array for the topic.');
  }

  const valid = mcqs.filter(q =>
    q.stem &&
    q.options && q.options.A && q.options.B && q.options.C && q.options.D &&
    ['A', 'B', 'C', 'D'].includes(q.correct)
  ).map(q => ({
    ...q,
    explanation: q.explanation || `Option ${q.correct} is correct based on the syllabus.`,
    difficulty: q.difficulty || difficulty
  }));

  if (valid.length === 0) {
    throw new Error('Questions generated were missing required fields.');
  }

  return valid.slice(0, numQuestions);
}

/**
 * 3. Regenerate or Refine an individual question with custom instruction / difficulty adjustment.
 */
export async function regenerateSingleQuestion(currentQuestion, instruction = 'Generate an alternative variant', difficulty = 'medium', topic = '') {
  const ai = getAI();
  const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

  const diffGuide = DIFFICULTY_GUIDELINES[difficulty] || DIFFICULTY_GUIDELINES.medium;

  const prompt = `You are an expert exam question creator. You are refining or replacing an existing exam question according to the teacher's instructions.

CURRENT QUESTION:
Stem: "${currentQuestion.stem}"
Options: A: "${currentQuestion.options?.A}", B: "${currentQuestion.options?.B}", C: "${currentQuestion.options?.C}", D: "${currentQuestion.options?.D}"
Current Correct: "${currentQuestion.correct}"

TEACHER'S INSTRUCTION: "${instruction}"
TARGET DIFFICULTY: ${difficulty.toUpperCase()} (${diffGuide})
${topic ? `TOPIC CONTEXT: ${topic}` : ''}

Generate ONE high-quality replacement MCQ matching these instructions.
Return ONLY a valid JSON object matching this schema:
{
  "stem": "Refined or new question prompt?",
  "options": {
    "A": "Option A text",
    "B": "Option B text",
    "C": "Option C text",
    "D": "Option D text"
  },
  "correct": "A",
  "explanation": "Detailed explanation of the answer and reasoning.",
  "difficulty": "${difficulty}"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let question;
  try {
    question = parseGeminiJSON(text);
  } catch (err) {
    throw new Error('AI returned invalid format while regenerating question.');
  }

  if (
    !question.stem ||
    !question.options ||
    !question.options.A ||
    !question.options.B ||
    !question.options.C ||
    !question.options.D ||
    !['A', 'B', 'C', 'D'].includes(question.correct)
  ) {
    throw new Error('Regenerated question was missing required fields.');
  }

  return {
    ...question,
    explanation: question.explanation || `Option ${question.correct} is correct.`,
    difficulty: question.difficulty || difficulty
  };
}
