import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  BookOpen, Upload, Sparkles, ChevronLeft, Pencil, Trash2, Check,
  AlertCircle, Loader2, ArrowRight, Settings, FileText, CheckCircle2,
  RefreshCw, Lightbulb, Zap, HelpCircle, Layers, Sliders, Shuffle,
  Plus, Lock
} from 'lucide-react';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', desc: 'Foundational & Direct', color: 'emerald' },
  { id: 'medium', label: 'Medium', desc: 'Conceptual & Deductive', color: 'indigo' },
  { id: 'hard', label: 'Hard', desc: 'Complex & Analytical', color: 'amber' },
  { id: 'olympiad', label: 'Olympiad', desc: 'Advanced Competitive', color: 'purple' },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced 30/50/20%', color: 'blue' }
];

export default function CreateTest() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [step, setStep] = useState('configure'); // 'configure' | 'review'
  const [sourceMode, setSourceMode] = useState('topic'); // 'topic' | 'document'
  const [topicPrompt, setTopicPrompt] = useState('');
  const [file, setFile] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(10);
  const [focusTopic, setFocusTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  // Single Question AI Regenerate State
  const [regeneratingIdx, setRegeneratingIdx] = useState(null);
  const [aiCustomInstruction, setAiCustomInstruction] = useState('');

  const [testConfig, setTestConfig] = useState({
    title: '',
    description: '',
    durationMins: 30,
    passingScore: 50,
    showResultsNow: true,
    shuffleQuestions: true,
    shuffleOptions: true,
    enableQuestionPool: false,
    questionsPerStudent: 10,
  });

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setError('');
    }
  };

  const handleGenerate = async () => {
    if (!testConfig.title.trim()) {
      setError('Please provide an exam title.');
      return;
    }

    if (sourceMode === 'document' && !file) {
      setError('Please select a PDF, DOCX, or TXT file to process.');
      return;
    }

    if (sourceMode === 'topic' && !topicPrompt.trim()) {
      setError('Please enter a topic or curriculum description.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let data;
      if (sourceMode === 'document') {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('topic', focusTopic);
        formData.append('difficulty', difficulty);

        const res = await api.post('/upload/document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        data = res.data;
      } else {
        const res = await api.post('/upload/topic', {
          topicPrompt,
          numQuestions,
          difficulty,
        });
        data = res.data;
      }

      if (!data.extractedQuestions || data.extractedQuestions.length === 0) {
        setError('No valid questions could be extracted from this file. Please verify the document text.');
        return;
      }

      setQuestions(data.extractedQuestions);
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'AI question generation failed. Check your AI configuration in server/.env');
    } finally {
      setLoading(false);
    }
  };

  // Regenerate single question using AI
  const handleRegenerateQuestion = async (idx, instruction, targetDiff) => {
    const targetQ = questions[idx];
    if (!targetQ) return;

    setRegeneratingIdx(idx);
    try {
      const { data } = await api.post('/upload/regenerate-question', {
        currentQuestion: targetQ,
        instruction: instruction || 'Generate a fresh alternative question',
        difficulty: targetDiff || difficulty,
        topic: testConfig.title + ' ' + (focusTopic || topicPrompt)
      });

      if (data.success && data.question) {
        setQuestions(prev => prev.map((q, i) => (i === idx ? data.question : q)));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to regenerate question with AI');
    } finally {
      setRegeneratingIdx(null);
      setAiCustomInstruction('');
    }
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      if (field.startsWith('option.')) {
        const opt = field.split('.')[1];
        return { ...q, options: { ...q.options, [opt]: value } };
      }
      return { ...q, [field]: value };
    }));
  };

  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddNewBlankQuestion = () => {
    const blank = {
      stem: 'New custom question...',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      correct: 'A',
      explanation: '',
      difficulty: difficulty || 'medium'
    };
    setQuestions(prev => [...prev, blank]);
    setEditingIdx(questions.length);
  };

  const handlePublish = async () => {
    if (questions.length === 0) {
      setError('You need at least one question to publish.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const isDocument = sourceMode === 'document';
      await api.post('/tests', {
        ...testConfig,
        difficulty,
        shuffleQuestions: testConfig.shuffleQuestions,
        shuffleOptions: testConfig.shuffleOptions,
        questionsPerStudent: (isDocument && testConfig.enableQuestionPool)
          ? Math.min(questions.length, Math.max(1, parseInt(testConfig.questionsPerStudent) || 10))
          : null,
        questions,
      });
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#12141C]/90 backdrop-blur-md border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/teacher/dashboard" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base">AI Exam Studio</h1>
                <span className="badge-blue text-[10px] font-mono">ExamPulse AI Engine</span>
              </div>
              <p className="text-xs text-gray-400">Step {step === 'configure' ? '1 of 2: Authoring Mode & Parameters' : '2 of 2: AI Review & Refine'}</p>
            </div>
          </div>

          {/* Stepper Pill */}
          <div className="flex items-center gap-2 bg-[#1A1D26] border border-white/[0.06] p-1.5 rounded-xl text-xs">
            <span className={`px-3 py-1 rounded-lg font-medium transition-all ${step === 'configure' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400'}`}>
              1. Setup & AI Prompt
            </span>
            <span className="text-gray-600">→</span>
            <span className={`px-3 py-1 rounded-lg font-medium transition-all ${step === 'review' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400'}`}>
              2. Review & Refine ({questions.length})
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 mb-6 flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {step === 'configure' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Test Details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="card">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2 className="font-semibold text-white text-sm">Exam Parameters</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Exam Title *</label>
                    <input
                      className="input text-sm"
                      placeholder="e.g. Data Structures & Algorithms Midterm"
                      value={testConfig.title}
                      onChange={e => setTestConfig({ ...testConfig, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Instructions / Syllabus</label>
                    <textarea
                      className="input text-xs resize-none"
                      rows={2}
                      placeholder="Important guidelines or syllabus coverage..."
                      value={testConfig.description}
                      onChange={e => setTestConfig({ ...testConfig, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Duration (mins)</label>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        className="input text-sm"
                        value={testConfig.durationMins}
                        onChange={e => setTestConfig({ ...testConfig, durationMins: parseInt(e.target.value) || 30 })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pass Mark (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        className="input text-sm"
                        value={testConfig.passingScore}
                        onChange={e => setTestConfig({ ...testConfig, passingScore: parseInt(e.target.value) || 50 })}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors">
                      <input
                        type="checkbox"
                        checked={testConfig.showResultsNow}
                        onChange={e => setTestConfig({ ...testConfig, showResultsNow: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 bg-[#12141C] border-white/20 focus:ring-0"
                      />
                      <span className="text-xs text-gray-300">Show instant score & AI answer review to student</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Anti-Cheating & Randomization Suite */}
              <div className="card space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                    <Shuffle className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">Anti-Cheating & Shuffling</h3>
                    <p className="text-[10px] text-gray-500">Prevent peer collusion with per-candidate randomization</p>
                  </div>
                </div>

                {/* Question Shuffling Toggle */}
                <label className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors">
                  <input
                    type="checkbox"
                    checked={testConfig.shuffleQuestions}
                    onChange={e => setTestConfig({ ...testConfig, shuffleQuestions: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 bg-[#12141C] border-white/20 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-200 block">Shuffle Question Sequence</span>
                    <span className="text-[10px] text-gray-500">Each candidate gets questions in a unique randomized order.</span>
                  </div>
                </label>

                {/* Option Shuffling Toggle */}
                <label className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors">
                  <input
                    type="checkbox"
                    checked={testConfig.shuffleOptions}
                    onChange={e => setTestConfig({ ...testConfig, shuffleOptions: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 bg-[#12141C] border-white/20 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-200 block">Shuffle Option Sequence (A / B / C / D)</span>
                    <span className="text-[10px] text-gray-500">Scramble options so answer letters cannot be copied.</span>
                  </div>
                </label>

                {/* Question Pool / Dynamic Subset Toggle */}
                <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
                  <label className={`flex items-start gap-3 ${sourceMode === 'document' ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                    <input
                      type="checkbox"
                      disabled={sourceMode !== 'document'}
                      checked={sourceMode === 'document' && testConfig.enableQuestionPool}
                      onChange={e => setTestConfig({ ...testConfig, enableQuestionPool: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 bg-[#12141C] border-white/20 focus:ring-0 mt-0.5 disabled:opacity-40"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-200 block">Dynamic Question Pool / Subset</span>
                        {sourceMode === 'document' ? (
                          <span className="badge-green text-[9px] font-semibold py-0.5 px-1.5 flex items-center gap-1">
                            📄 PDF Question Bank
                          </span>
                        ) : (
                          <span className="badge-yellow text-[9px] font-semibold py-0.5 px-1.5 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> PDF / Document Only
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-1 leading-relaxed">
                        {sourceMode === 'document'
                          ? 'Extract questions from your uploaded PDF/DOCX and deliver a unique random subset to each student without calling AI again.'
                          : 'Disabled for Topic Prompt generation to avoid burning excessive AI tokens. Upload a PDF/Document question bank to use dynamic question pools.'}
                      </span>
                    </div>
                  </label>

                  {sourceMode === 'document' && testConfig.enableQuestionPool && (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3 animate-fadeIn">
                      <div>
                        <span className="text-xs font-semibold text-indigo-300 block">Questions Per Candidate</span>
                        <span className="text-[10px] text-gray-400">Randomly selected from total pool in document</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="input text-xs font-mono font-bold text-center w-24 py-1.5"
                        value={testConfig.questionsPerStudent}
                        onChange={e => setTestConfig({ ...testConfig, questionsPerStudent: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Difficulty Level Selector */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">AI Difficulty Level</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 capitalize">{difficulty}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        difficulty === d.id
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-white shadow-md'
                          : 'bg-[#12141C] border-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs">{d.label}</span>
                        <span className="text-[10px] text-gray-500 ml-2 font-normal">{d.desc}</span>
                      </div>
                      {difficulty === d.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Dual Mode AI Generation Engine */}
            <div className="lg:col-span-7 space-y-6">
              <div className="card relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* Source Mode Tabs */}
                <div className="flex items-center gap-2 p-1 bg-[#12141C] border border-white/[0.06] rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode('topic');
                      setTestConfig(prev => ({ ...prev, enableQuestionPool: false }));
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      sourceMode === 'topic'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span>Generate by Topic Prompt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceMode('document')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      sourceMode === 'document'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-300" />
                    <span>Upload Document File (PDF / DOCX)</span>
                  </button>
                </div>

                {/* Mode 1: Topic Prompt (No file needed) */}
                {sourceMode === 'topic' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                          <span>Describe Subject / Concepts / Syllabus *</span>
                        </label>
                      </div>
                      <textarea
                        className="input text-sm resize-none"
                        rows={4}
                        placeholder="e.g. Class 11 Physics: Newton's Laws of Motion, Friction, Centripetal Force, and conservation of momentum. Include conceptual numericals."
                        value={topicPrompt}
                        onChange={e => setTopicPrompt(e.target.value)}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>ExamPulse AI will synthesize questions, distractors, and step-by-step educational explanations automatically.</span>
                    </div>
                  </div>
                )}

                {/* Mode 2: Document Upload */}
                {sourceMode === 'document' && (
                  <div className="space-y-4">
                    <div
                      onClick={() => fileRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 ${
                        file
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 bg-[#12141C]'
                      }`}
                    >
                      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} className="hidden" />

                      {file ? (
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 border border-emerald-500/30">
                            <FileText className="w-6 h-6" />
                          </div>
                          <p className="font-semibold text-white text-sm">{file.name}</p>
                          <p className="text-xs text-emerald-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Ready to parse</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 text-gray-400 flex items-center justify-center mb-2 border border-white/5">
                            <Upload className="w-6 h-6" />
                          </div>
                          <p className="font-medium text-white text-sm">Upload Question Bank PDF, DOCX, or TXT</p>
                          <p className="text-xs text-gray-500 mt-1">Upload question papers, past exams, or question sheets</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Focus Topic Filter (Optional)</label>
                      <input
                        className="input text-xs"
                        placeholder="e.g. Focus on Section 3.2 only"
                        value={focusTopic}
                        onChange={e => setFocusTopic(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Auto Full Extraction Info for Document / PDF */}
                {sourceMode === 'document' && (
                  <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-white block mb-0.5">Comprehensive Question Bank Extraction</span>
                      <span className="text-[11px] text-gray-300 leading-relaxed block">
                        ExamPulse will automatically detect and extract <strong>all available MCQs</strong> from your uploaded PDF/DOCX file.
                      </span>
                      <span className="text-[10px] text-indigo-300 block mt-1.5 font-medium">
                        💡 You can select how many questions each student will get in the <strong>Dynamic Question Pool</strong> panel on the left.
                      </span>
                    </div>
                  </div>
                )}

                {/* Number of MCQs Range Slider (Only for Topic Generation) */}
                {sourceMode === 'topic' && (
                  <div className="mt-6 pt-5 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Number of MCQs to Generate</label>
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-600/15 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg">
                        {numQuestions} Questions
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={50}
                      step={1}
                      value={numQuestions}
                      onChange={e => setNumQuestions(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 bg-white/10 rounded-lg cursor-pointer h-2"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>3 Quick</span>
                      <span>15 Standard</span>
                      <span>50 Comprehensive</span>
                    </div>
                  </div>
                )}

                <div className="mt-8">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !testConfig.title.trim()}
                    className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>
                          {sourceMode === 'document'
                            ? 'Extracting all available questions from document...'
                            : `AI Generating ${numQuestions} ${difficulty.toUpperCase()} MCQs with Explanations...`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
                        <span>{sourceMode === 'document' ? 'Extract All Questions & Build Exam' : 'Generate Exam with AI'}</span>
                        <ArrowRight className="w-4 h-4 text-indigo-200 ml-1" />
                      </>
                    )}
                  </button>
                  {loading && (
                    <p className="text-center text-xs text-indigo-300/80 mt-2.5 animate-pulse">
                      {sourceMode === 'document'
                        ? 'Parsing document text, identifying all questions, and structuring educational explanations...'
                        : 'Synthesizing questions, calculating distractors, and authoring educational explanations...'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review Generated Questions + Single Question AI Refine */}
        {step === 'review' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#12141C] border border-white/[0.06] p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Generated Exam Questions</h2>
                  <span className="badge-green">{questions.length} Questions</span>
                  {sourceMode === 'document' && testConfig.enableQuestionPool && (
                    <span className="badge-purple text-[10px] font-mono font-semibold">
                      Pool: {testConfig.questionsPerStudent} of {questions.length} served
                    </span>
                  )}
                  <span className="badge-blue capitalize text-[10px] font-mono">{difficulty}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Each question has an AI-generated explanation. You can edit answers, tweak text, or regenerate individual questions with AI.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddNewBlankQuestion}
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 hover:border-indigo-500/50"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add Question</span>
                </button>
                <button
                  onClick={() => setStep('configure')}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  Adjust Parameters
                </button>
                <button
                  onClick={handlePublish}
                  disabled={loading || questions.length === 0}
                  className="btn-green text-sm py-2 px-5 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Publish Test</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className={`card border-l-4 transition-all duration-200 ${
                    editingIdx === idx ? 'border-l-indigo-500 bg-[#1e2330]' : 'border-l-indigo-600/50 hover:border-l-indigo-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-mono font-bold border border-indigo-500/20">
                        {idx + 1}
                      </span>
                      <span className="badge-yellow text-[10px] uppercase font-mono">{q.difficulty || difficulty}</span>
                    </div>

                    {/* Action buttons: AI Regenerate, Edit, Delete */}
                    <div className="flex items-center gap-1.5">
                      {/* AI Quick Regenerate Actions */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/5 p-1 rounded-xl">
                        <button
                          onClick={() => handleRegenerateQuestion(idx, 'Generate a fresh alternative question', q.difficulty)}
                          disabled={regeneratingIdx === idx}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-300 hover:bg-purple-600/30 flex items-center gap-1 transition-colors disabled:opacity-40"
                          title="Generate a completely new variant of this question"
                        >
                          <RefreshCw className={`w-3 h-3 ${regeneratingIdx === idx ? 'animate-spin' : ''}`} />
                          <span>AI Variant</span>
                        </button>

                        <button
                          onClick={() => handleRegenerateQuestion(idx, 'Make this question more challenging with tricky distractors', 'hard')}
                          disabled={regeneratingIdx === idx}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-amber-300 hover:bg-amber-600/30 flex items-center gap-1 transition-colors disabled:opacity-40"
                          title="Make this question harder"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Harder</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${editingIdx === idx ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        title="Manual edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeQuestion(idx)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingIdx === idx ? (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Question Stem</label>
                        <textarea
                          className="input text-sm resize-none"
                          rows={2}
                          value={q.stem}
                          onChange={e => updateQuestion(idx, 'stem', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['A', 'B', 'C', 'D'].map(opt => (
                          <div key={opt} className="flex items-center gap-2 bg-[#12141C] p-2.5 rounded-xl border border-white/[0.06]">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`correct-${idx}`}
                                checked={q.correct === opt}
                                onChange={() => updateQuestion(idx, 'correct', opt)}
                                className="w-4 h-4 text-emerald-500 accent-emerald-500 cursor-pointer"
                              />
                            </label>
                            <span className={`text-xs font-mono font-bold w-4 ${q.correct === opt ? 'text-emerald-400' : 'text-gray-400'}`}>{opt}</span>
                            <input
                              className="input text-xs py-1.5 px-2 bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 flex-1"
                              value={q.options[opt]}
                              onChange={e => updateQuestion(idx, `option.${opt}`, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">AI Explanation & Solution</label>
                        <textarea
                          className="input text-xs resize-none"
                          rows={2}
                          value={q.explanation || ''}
                          onChange={e => updateQuestion(idx, 'explanation', e.target.value)}
                        />
                      </div>

                      <div className="text-right">
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Done Editing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-white mb-4 leading-relaxed">{q.stem}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const isCorrect = q.correct === opt;
                          return (
                            <div
                              key={opt}
                              className={`flex items-start gap-3 p-3 rounded-xl text-xs transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                                  : 'bg-[#12141C]/80 border border-white/[0.04] text-gray-300'
                              }`}
                            >
                              <span className={`font-mono font-bold w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
                              }`}>
                                {opt}
                              </span>
                              <span className="flex-1 mt-0.5">{q.options[opt]}</span>
                              {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Educational Explanation Pill */}
                      {q.explanation && (
                        <div className="mt-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs text-gray-400 flex items-start gap-2.5">
                          <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <span className="font-semibold text-gray-300">AI Explanation: </span>
                            {q.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 pb-12">
              <button
                onClick={handlePublish}
                disabled={loading || questions.length === 0}
                className="btn-green text-sm py-3 px-8 flex items-center gap-2 shadow-xl shadow-emerald-900/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Exam...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publish {questions.length} Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
