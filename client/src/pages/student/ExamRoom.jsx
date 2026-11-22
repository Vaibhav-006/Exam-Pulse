import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../lib/api';
import {
  Clock, AlertTriangle, ChevronLeft, ChevronRight, Send,
  Shield, Check, Video, AlertCircle, HelpCircle, Eye
} from 'lucide-react';

const MAX_VIOLATIONS = 3;

export default function ExamRoom() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const violationRef = useRef(0);
  const submitCalledRef = useRef(false);
  const frameIntervalRef = useRef(null);

  const [session, setSession] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [violationMsg, setViolationMsg] = useState('');
  const [teacherWarning, setTeacherWarning] = useState('');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitExam = useCallback(async (sessionData, currentAnswers) => {
    if (submitCalledRef.current) return;
    submitCalledRef.current = true;
    setIsSubmitting(true);

    clearInterval(frameIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    document.exitFullscreen?.().catch(() => {});

    const answersArr = Object.entries(currentAnswers).map(([questionId, chosenOption]) => ({
      questionId: parseInt(questionId),
      chosenOption,
    }));

    try {
      const { data } = await api.post('/results/submit', {
        sessionId: sessionData.sessionId,
        studentToken: sessionData.studentToken,
        answers: answersArr,
      });
      socketRef.current?.emit('student:submitted');
      sessionStorage.setItem('ep_result', JSON.stringify(data));
      navigate('/exam/complete');
    } catch (err) {
      console.error('Submit error:', err);
      navigate('/exam/complete');
    }
  }, [navigate]);

  useEffect(() => {
    const stored = sessionStorage.getItem('ep_session');
    if (!stored) {
      navigate('/join');
      return;
    }
    const sessionData = JSON.parse(stored);
    setSession(sessionData);
    setTimeLeft(sessionData.test.durationMins * 60);
    setAnswers({});
    violationRef.current = 0;

    // Trigger fullscreen mode
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }

    // Connect WebSocket proctor relay
    const socket = io('/');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('student:join', {
        testId: sessionData.test.id,
        sessionId: sessionData.sessionId,
        studentName: sessionData.studentName,
      });
    });

    socket.on('teacher:warning', ({ message }) => {
      setTeacherWarning(message);
      setTimeout(() => setTeacherWarning(''), 9000);
    });

    // Acquire webcam and transmit frame packets
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Emit snapshot frame every 2 seconds
        frameIntervalRef.current = setInterval(() => {
          if (!canvasRef.current || !videoRef.current) return;
          const ctx = canvasRef.current.getContext('2d');
          canvasRef.current.width = 320;
          canvasRef.current.height = 240;
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.45);
          socket.emit('student:frame', { frame });
        }, 2000);
      })
      .catch((err) => console.warn('Camera access unavailable:', err));

    return () => {
      clearInterval(frameIntervalRef.current);
      socket.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [navigate]);

  // Countdown clock tick
  useEffect(() => {
    if (!session || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitExam(session, answers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session, submitExam]); // eslint-disable-line

  // Browser Lockdown & Security Event Handlers
  useEffect(() => {
    const handleViolation = (type) => {
      if (submitCalledRef.current) return;
      violationRef.current += 1;
      const count = violationRef.current;
      setViolationCount(count);

      const msg = count >= MAX_VIOLATIONS
        ? `❌ Maximum strikes reached! Your exam is being automatically submitted.`
        : `⚠️ Violation ${count}/${MAX_VIOLATIONS}: ${type}. ${MAX_VIOLATIONS - count} strike(s) remaining before auto-submission.`;

      setViolationMsg(msg);
      socketRef.current?.emit('student:violation', { violationType: type });

      // Record violation to server database
      const stored = sessionStorage.getItem('ep_session');
      if (stored) {
        const s = JSON.parse(stored);
        api.post(`/sessions/${s.sessionId}/violation`, {
          studentToken: s.studentToken,
          violationType: type
        }).catch(() => {});
      }

      if (count >= MAX_VIOLATIONS) {
        setTimeout(() => {
          const storedSession = sessionStorage.getItem('ep_session');
          if (storedSession) {
            setAnswers(prevAnswers => {
              submitExam(JSON.parse(storedSession), prevAnswers);
              return prevAnswers;
            });
          }
        }, 2000);
      } else {
        setTimeout(() => setViolationMsg(''), 6000);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation('Tab switch / Window minimized');
    };
    const onBlur = () => handleViolation('Window focus lost');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !submitCalledRef.current) {
        handleViolation('Exited fullscreen lockdown');
      }
    };
    const onContextMenu = (e) => e.preventDefault();
    const onKeyDown = (e) => {
      // Prevent developer tools, copy, paste, select all
      if (
        e.key === 'F12' ||
        (e.ctrlKey && ['c', 'v', 'i', 'u', 'a', 'p', 's'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey)
      ) {
        e.preventDefault();
        return;
      }

      // Hotkey option selection: A, B, C, D
      if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const char = e.key.toUpperCase();
        const curQuestion = session?.questions?.[currentQ];
        if (curQuestion) {
          setAnswers(prev => ({ ...prev, [curQuestion.id]: char }));
        }
      }

      // Hotkey question navigation: Left / Right arrows
      if (e.key === 'ArrowRight' && session?.questions) {
        setCurrentQ(prev => Math.min(session.questions.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentQ(prev => Math.max(0, prev - 1));
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [session, currentQ]); // eslint-disable-line

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!session) return null;
  const questions = session.questions || [];
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-[#07090E] text-gray-100 flex flex-col select-none h-screen overflow-hidden">
      {/* Hidden WebRTC Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Urgent Violation Toast */}
      {violationMsg && (
        <div className={`fixed top-0 left-0 right-0 z-50 p-3.5 text-center font-bold text-white shadow-2xl flex items-center justify-center gap-2 animate-bounce ${
          violationRef.current >= MAX_VIOLATIONS ? 'bg-red-700' : 'bg-red-600'
        }`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{violationMsg}</span>
        </div>
      )}

      {/* Teacher Direct Intervention Banner */}
      {teacherWarning && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-400 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn">
          <Eye className="w-5 h-5 text-indigo-200" />
          <div className="text-xs">
            <span className="font-bold">Proctor Message: </span>
            <span>{teacherWarning}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-[#0F121A] border-b border-white/[0.06] px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="font-bold text-sm text-white truncate max-w-xs">{session.test?.title}</h1>
          </div>
          <span className="text-xs text-gray-500 font-medium hidden sm:inline">| {session.studentName}</span>
        </div>

        {/* Center: Timer */}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-mono text-base font-bold border transition-colors ${
          timeLeft < 300
            ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
            : 'bg-[#181B24] border-white/10 text-white'
        }`}>
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        {/* Right: Progress & Submit */}
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400 hidden sm:block">
            <span className="font-bold text-white">{answeredCount}</span> of {questions.length} Answered
          </div>

          <button
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isSubmitting}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-md shadow-indigo-900/50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish Test</span>
          </button>
        </div>
      </header>

      {/* Main Examination Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Palette Sidebar */}
        <aside className="w-20 bg-[#0C0E14] border-r border-white/[0.06] flex flex-col items-center py-4 gap-2 overflow-y-auto flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Q-MAP</span>
          {questions.map((_, i) => {
            const isAnswered = answers[questions[i]?.id];
            const isCurrent = i === currentQ;

            return (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-10 h-10 rounded-xl text-xs font-mono font-bold transition-all duration-150 relative ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/60 ring-2 ring-indigo-400'
                    : isAnswered
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {i + 1}
                {isAnswered && !isCurrent && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Center: Question Display Pane */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto bg-[#07090E] p-8 lg:p-12">
          {q && (
            <div className="max-w-3xl w-full mx-auto space-y-8">
              {/* Question Header & Stem */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest">
                    QUESTION {currentQ + 1} OF {questions.length}
                  </span>
                  <span className="text-xs text-gray-500">1 Point</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-semibold text-white leading-relaxed">
                  {q.stem}
                </h2>
              </div>

              {/* 4 Options */}
              <div className="space-y-3 pt-2">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const isSelected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                      className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 group ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600/15 text-white shadow-xl shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                          : 'border-white/[0.06] bg-[#12141C] text-gray-300 hover:border-white/20 hover:bg-[#161924]'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'
                      }`}>
                        {opt}
                      </span>
                      <span className="text-sm font-medium pt-1 leading-normal flex-1">
                        {q.options[opt]}
                      </span>
                      {isSelected && (
                        <Check className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Tip: You can press keys <b>A, B, C, D</b> on your keyboard to pick an option.</span>
              </div>
            </div>
          )}

          {/* Bottom Bar: Prev / Next Controls */}
          <div className="max-w-3xl w-full mx-auto flex items-center justify-between pt-8 border-t border-white/[0.06] mt-8">
            <button
              onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
              disabled={currentQ === 0}
              className="btn-secondary text-xs flex items-center gap-2 py-2.5 px-4 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous (←)</span>
            </button>

            <div className="text-xs text-gray-400 font-mono">
              {currentQ + 1} / {questions.length}
            </div>

            <button
              onClick={() => setCurrentQ(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQ === questions.length - 1}
              className="btn-primary text-xs flex items-center gap-2 py-2.5 px-5 disabled:opacity-30 disabled:pointer-events-none"
            >
              <span>Next (→)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Mini Webcam Feed (Student PiP) */}
        <div className="fixed bottom-4 right-4 z-20 bg-[#12141C] border border-white/10 rounded-2xl p-2 shadow-2xl hidden md:block">
          <div className="relative w-36 aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute top-1 left-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              REC
            </div>
          </div>
          <div className="text-center text-[9px] text-gray-400 mt-1 font-medium">
            Proctor Monitoring Active
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Submission */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400">
              <Send className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-white text-lg">Submit Final Exam?</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              You have answered <span className="font-bold text-white">{answeredCount}</span> of <span className="font-bold text-white">{questions.length}</span> questions. Once submitted, your score will be logged and your proctored session will end.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="btn-secondary text-xs flex-1 py-2.5"
              >
                Continue Exam
              </button>
              <button
                onClick={() => {
                  setShowConfirmSubmit(false);
                  submitExam(session, answers);
                }}
                disabled={isSubmitting}
                className="btn-green text-xs flex-1 py-2.5 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
