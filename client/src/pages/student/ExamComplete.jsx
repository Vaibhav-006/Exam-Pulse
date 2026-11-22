import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle, XCircle, Trophy, ArrowLeft, Award, ShieldCheck,
  CheckCircle2, Sparkles, AlertTriangle, Lightbulb, ChevronDown,
  ChevronUp, BookOpen, Layers
} from 'lucide-react';

export default function ExamComplete() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'incorrect' | 'correct'

  useEffect(() => {
    const stored = sessionStorage.getItem('ep_result');
    if (stored) {
      setResult(JSON.parse(stored));
    }
    // Clean up temporary session tokens
    sessionStorage.removeItem('ep_session');
    sessionStorage.removeItem('ep_result');
    sessionStorage.removeItem('ep_stream_ready');
  }, []);

  const reviewList = result?.review || [];
  const filteredReview = reviewList.filter(q => {
    if (activeTab === 'incorrect') return !q.isCorrect;
    if (activeTab === 'correct') return q.isCorrect;
    return true;
  });

  return (
    <div className="min-h-screen mesh-bg text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-x-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full transition-all duration-300 relative z-10 ${showReview ? 'max-w-4xl' : 'max-w-lg'}`}>
        {/* Score & Completion Card */}
        <div className="card-glass p-8 md:p-10 text-center border border-white/10 shadow-2xl">
          {result?.submitted ? (
            <>
              {/* Header Icon */}
              <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center border shadow-xl ${
                result.passed
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {result.passed ? (
                  <Trophy className="w-10 h-10 animate-bounce" />
                ) : (
                  <Award className="w-10 h-10 text-red-400" />
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-white">
                {result.passed ? 'Exam Completed Successfully!' : 'Exam Submitted'}
              </h1>
              <p className="text-xs text-gray-400 mt-1">Your proctored test session has concluded.</p>

              {/* Score Display */}
              {result.score != null ? (
                <div className="my-6 p-6 rounded-2xl bg-[#12141C] border border-white/[0.06]">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Overall Score
                  </div>
                  <div
                    className="text-6xl font-black tracking-tight"
                    style={{ color: result.passed ? '#34d399' : '#f87171' }}
                  >
                    {result.score}%
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    <span className="font-semibold text-white">{result.correct}</span> out of{' '}
                    <span className="font-semibold text-white">{result.total}</span> questions correct
                  </p>

                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-3">
                    <span className={result.passed ? 'badge-green text-xs' : 'badge-red text-xs'}>
                      {result.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {result.passed ? 'Passing Grade Achieved' : 'Below Passing Threshold'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="my-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-gray-300">
                  {result.message || 'Answers received. Results will be released by your instructor.'}
                </div>
              )}

              {/* Toggle Review Button (if review data exists) */}
              {reviewList.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowReview(!showReview)}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>{showReview ? 'Hide Answer Key & Explanations' : 'Review Answers & AI Step-by-Step Explanations'}</span>
                    {showReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-6">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Session encrypted and recorded to teacher ledger</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Exam Submitted</h1>
              <p className="text-xs text-gray-400 mb-6">
                Your answers have been stored and transmitted to your teacher's dashboard.
              </p>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="btn-secondary text-xs flex-1 py-3 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Join Another Exam</span>
            </Link>
            <Link
              to="/"
              className="btn-primary text-xs flex-1 py-3 flex items-center justify-center gap-2"
            >
              <span>Home Portal</span>
            </Link>
          </div>
        </div>

        {/* Interactive Answer Key & AI Explanation Review Accordion */}
        {showReview && reviewList.length > 0 && (
          <div className="mt-8 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between bg-[#12141C] p-4 rounded-2xl border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Detailed Question Breakdown</h3>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 bg-[#1A1D26] p-1 rounded-xl text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
                >
                  All ({reviewList.length})
                </button>
                <button
                  onClick={() => setActiveTab('incorrect')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'incorrect' ? 'bg-red-600 text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
                >
                  Mistakes ({reviewList.filter(q => !q.isCorrect).length})
                </button>
                <button
                  onClick={() => setActiveTab('correct')}
                  className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'correct' ? 'bg-emerald-600 text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
                >
                  Correct ({reviewList.filter(q => q.isCorrect).length})
                </button>
              </div>
            </div>

            {/* Questions List */}
            {filteredReview.map((q, idx) => {
              const isCorrect = q.isCorrect;

              return (
                <div
                  key={q.id || idx}
                  className={`card border-l-4 transition-all duration-200 ${
                    isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-white/5 text-gray-300 font-mono font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className={isCorrect ? 'badge-green text-[10px]' : 'badge-red text-[10px]'}>
                        {isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                    </div>

                    <span className="text-[10px] text-gray-500 uppercase font-mono">
                      Your Choice: <b className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>{q.chosenOption || 'Unattempted'}</b>
                    </span>
                  </div>

                  <p className="text-sm font-medium text-white mb-4 leading-relaxed">{q.stem}</p>

                  {/* Options List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const isOptionCorrect = q.correctOption === opt;
                      const isOptionChosen = q.chosenOption === opt;

                      let style = 'bg-[#12141C]/80 border-white/[0.04] text-gray-400';
                      if (isOptionCorrect) {
                        style = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 font-semibold';
                      } else if (isOptionChosen && !isOptionCorrect) {
                        style = 'bg-red-500/15 border-red-500/30 text-red-300';
                      }

                      return (
                        <div key={opt} className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${style}`}>
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold flex-shrink-0 ${
                            isOptionCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'
                          }`}>
                            {opt}
                          </span>
                          <span className="flex-1 mt-0.5">{q.options[opt]}</span>
                          {isOptionCorrect && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />}
                          {isOptionChosen && !isOptionCorrect && <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Explanation Box */}
                  {q.explanation && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
                      <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-amber-300">AI Detailed Explanation: </span>
                        {q.explanation}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
