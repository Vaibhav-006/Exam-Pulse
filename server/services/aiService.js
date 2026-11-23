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

// Clean, repair, and parse JSON returned from Gemini (handles markdown fences, trailing commas, and truncated responses)
function parseGeminiJSON(text) {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  // Find start of JSON array or object
  const arrayStart = cleaned.indexOf('[');
  const objStart = cleaned.indexOf('{');

  if (arrayStart !== -1 && (objStart === -1 || arrayStart < objStart)) {
    cleaned = cleaned.substring(arrayStart);
  } else if (objStart !== -1) {
    cleaned = cleaned.substring(objStart);
  }

  // 1. First attempt: standard JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Continue to repair
  }

  // 2. Second attempt: Remove trailing commas
  let repaired = cleaned.replace(/,\s*([\]}])/g, '$1');
  try {
    return JSON.parse(repaired);
  } catch (e2) {
    // Continue to repair
  }

  // 3. Third attempt: Handle truncated JSON array (e.g. output token limit reached)
  if (repaired.startsWith('[')) {
    const lastClosingBrace = repaired.lastIndexOf('}');
    if (lastClosingBrace !== -1) {
      const truncatedCandidate = repaired.substring(0, lastClosingBrace + 1) + ']';
      const fixedCandidate = truncatedCandidate.replace(/,\s*([\]}])/g, '$1');
      try {
        const parsed = JSON.parse(fixedCandidate);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.warn(`[AI] Recovered ${parsed.length} questions from truncated JSON response.`);
          return parsed;
        }
      } catch (e3) {
        // Continue to regex recovery
      }
    }
  }

  // 4. Fourth attempt: Object-by-object regex extraction
  const recoveredList = [];
  const objectRegex = /\{[\s\S]*?"stem"[\s\S]*?"options"[\s\S]*?"correct"[\s\S]*?\}/g;
  let match;
  while ((match = objectRegex.exec(cleaned)) !== null) {
    try {
      const objClean = match[0].replace(/,\s*([\]}])/g, '$1');
      const item = JSON.parse(objClean);
      if (item && item.stem && item.options && item.correct) {
        recoveredList.push(item);
      }
    } catch (ignore) {
      // Ignore individual malformed blocks
    }
  }

  if (recoveredList.length > 0) {
    console.warn(`[AI] Regex fallback recovered ${recoveredList.length} questions.`);
    return recoveredList;
  }

  throw new Error('AI returned an invalid JSON response. Please try again. Raw snippet: ' + text.substring(0, 150));
}

const DIFFICULTY_GUIDELINES = {
  easy: 'Focus on core definitions, direct facts, and fundamental concepts. Distractors should be distinct.',
  medium: 'Require conceptual understanding, application of principles, and multi-step deduction. Distractors should address common misconceptions.',
  hard: 'Involve complex problem-solving, edge cases, nuanced analysis, or analytical problem-solving. Distractors must be highly plausible.',
  olympiad: 'Challenging, advanced Olympiad/competitive exam standard requiring synthesis of multiple advanced principles, deep critical thinking, and tricky problem traps.',
  mixed: 'A balanced distribution of 30% easy, 50% medium, and 20% hard conceptual questions.'
};

/**
 * Candidate models supported by Google for this key, ordered by speed and availability.
 */
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

/**
 * Executes a prompt with cascading fallback through CANDIDATE_MODELS.
 */
async function callWithModelFallback(prompt) {
  const ai = getAI();
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    // Attempt 1: With JSON response mode & 8192 maxOutputTokens
    try {
      const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        }
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim()) {
        return text;
      }
    } catch (err) {
      console.warn(`[AI] Model ${modelName} with json config attempt: ${err.message}. Retrying plain...`);
      // Attempt 2: Fallback without responseMimeType in case model doesn't support it
      try {
        const plainModel = ai.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 8192,
          }
        });
        const result = await plainModel.generateContent(prompt);
        const text = result.response.text();
        if (text && text.trim()) {
          return text;
        }
      } catch (err2) {
        console.warn(`[AI] Model ${modelName} fallback attempt failed: ${err2.message}. Trying next candidate...`);
        lastError = err2;
      }
    }
  }

  throw new Error(`AI generation failed across all candidate models. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * 1. Generate MCQs from raw document content with explanations and difficulty.
 */
export async function generateMCQs(rawText, numQuestions = null, topic = '', difficulty = 'medium') {
  const diffGuide = DIFFICULTY_GUIDELINES[difficulty] || DIFFICULTY_GUIDELINES.medium;
  const topicClause = topic ? `Focus heavily on concepts and topics related to: "${topic}".` : '';

  const quantityInstruction = (numQuestions && numQuestions > 0)
    ? `author or extract exactly ${numQuestions} high-caliber multiple choice questions (MCQs).`
    : `carefully extract and structure ALL multiple choice questions (MCQs) found in the document into standard format. If the document is an exam paper, test, or question bank, extract every single question present in the text with its options and correct answer.`;

  const prompt = `You are a world-class academic test architect and exam designer. Analyze the following document text and ${quantityInstruction}

Target Difficulty: ${difficulty.toUpperCase()}
Difficulty Guidelines: ${diffGuide}
${topicClause}

Core Requirements:
1. Each question must have exactly 4 plausible options labeled A, B, C, D. If the original question has fewer or more options, standardize them into 4 distinct plausible options (A, B, C, D).
2. Only ONE option must be scientifically / factually correct.
3. Every question MUST include a concise, clear "explanation" (1-2 sentences) explaining why the correct option is true.
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
    "explanation": "Brief reasoning explaining why option A is correct.",
    "difficulty": "${difficulty}"
  }
]

DOCUMENT CONTENT:
${rawText.substring(0, 60000)}`;

  const text = await callWithModelFallback(prompt);

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

  return (numQuestions && numQuestions > 0) ? valid.slice(0, numQuestions) : valid;
}

/**
 * Helper: generates a single targeted batch of MCQs by topic (up to 15-20 questions)
 */
async function generateMCQTopicBatch(topicPrompt, count, difficulty, subFocus = '') {
  const diffGuide = DIFFICULTY_GUIDELINES[difficulty] || DIFFICULTY_GUIDELINES.medium;
  const focusClause = subFocus ? `Focus especially on: "${subFocus}".` : '';

  const prompt = `You are an elite exam author and pedagogical curriculum expert. Create a complete, professional ${count}-question multiple choice exam based on the following subject/topic prompt:

EXAM SUBJECT / PROMPT: "${topicPrompt}"
DIFFICULTY LEVEL: ${difficulty.toUpperCase()} (${diffGuide})
${focusClause}

Rules:
1. Generate exactly ${count} distinct, well-crafted MCQs testing this subject.
2. Exactly 4 options (A, B, C, D) per question with only ONE undeniably correct answer.
3. Keep the "explanation" concise and crisp (1-2 sentences maximum, under 25 words).
4. Set "difficulty" to "${difficulty}".
5. Return ONLY a valid JSON array of objects. Do not write introductory or concluding prose.

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
    "explanation": "Clear 1-sentence reasoning explaining why A is correct.",
    "difficulty": "${difficulty}"
  }
]`;

  const text = await callWithModelFallback(prompt);
  const mcqs = parseGeminiJSON(text);

  if (!Array.isArray(mcqs) || mcqs.length === 0) {
    return [];
  }

  return mcqs.filter(q =>
    q.stem &&
    q.options && q.options.A && q.options.B && q.options.C && q.options.D &&
    ['A', 'B', 'C', 'D'].includes(q.correct)
  ).map(q => ({
    ...q,
    explanation: q.explanation || `Option ${q.correct} is correct based on the syllabus.`,
    difficulty: q.difficulty || difficulty
  }));
}

/**
 * 2. Generate MCQs purely from a Topic/Prompt without requiring a document file.
 * Uses parallel batching for large question counts (>15) to prevent token truncation.
 */
export async function generateMCQsByTopic(topicPrompt, numQuestions = 10, difficulty = 'medium') {
  const totalNeeded = parseInt(numQuestions) || 10;

  // For small tests (<= 15), run in a single clean batch
  if (totalNeeded <= 15) {
    const list = await generateMCQTopicBatch(topicPrompt, totalNeeded, difficulty);
    if (list.length === 0) throw new Error('AI failed to generate question array for the topic.');
    return list.slice(0, totalNeeded);
  }

  // For larger tests (> 15, e.g. 20, 30, 40, 50), run parallel batches to guarantee full question counts
  const half1 = Math.ceil(totalNeeded / 2);
  const half2 = Math.floor(totalNeeded / 2);

  const [batch1, batch2] = await Promise.all([
    generateMCQTopicBatch(topicPrompt, half1, difficulty, 'Core concepts, definitions, and foundational principles'),
    generateMCQTopicBatch(topicPrompt, half2, difficulty, 'Practical application, problem-solving, and advanced scenarios')
  ]);

  const combined = [...batch1, ...batch2];
  if (combined.length === 0) {
    throw new Error('AI failed to generate question array for the topic.');
  }

  return combined.slice(0, totalNeeded);
}

/**
 * 3. Regenerate or Refine an individual question with custom instruction / difficulty adjustment.
 */
export async function regenerateSingleQuestion(currentQuestion, instruction = 'Generate an alternative variant', difficulty = 'medium', topic = '') {
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

  const text = await callWithModelFallback(prompt);

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
