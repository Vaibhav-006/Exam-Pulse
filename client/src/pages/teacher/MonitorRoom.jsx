import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createSocket } from '../../lib/socket';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft, AlertTriangle, CheckCircle2, Wifi, WifiOff, Users, Shield,
  Maximize2, Volume2, VolumeX, Send, Bell, Clock, Radio, Ban, XCircle, AlertCircle
} from 'lucide-react';

export default function MonitorRoom() {
  const { testId } = useParams();
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [test, setTest] = useState(null);
  const [students, setStudents] = useState({});
  const [connected, setConnected] = useState(false);
  const [violations, setViolations] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [warningMsg, setWarningMsg] = useState('');
  const [abortReasonInput, setAbortReasonInput] = useState('');
  const [showAbortPrompt, setShowAbortPrompt] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play subtle alert tone on violation if enabled
  const playAlertTone = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // AudioContext not permitted without user gesture or unsupported
    }
  };

  useEffect(() => {
    // Load test info
    api.get(`/tests/${testId}`).then(r => setTest(r.data)).catch(console.error);

    // Connect socket
    const socket = createSocket({ auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('teacher:join', { testId: parseInt(testId) });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:students', (studentsArr) => {
      const map = {};
      studentsArr.forEach(s => {
        map[s.socketId] = { ...s, frame: null, violations: 0, lastSeen: Date.now() };
      });
      setStudents(map);
    });

    socket.on('student:joined', (student) => {
      setStudents(prev => ({
        ...prev,
        [student.socketId]: { ...student, frame: null, violations: 0, lastSeen: Date.now() }
      }));
    });

    socket.on('student:disconnected', ({ socketId }) => {
      setStudents(prev => {
        const updated = { ...prev };
        if (updated[socketId]) updated[socketId] = { ...updated[socketId], status: 'disconnected' };
        return updated;
      });
    });

    socket.on('student:frame', ({ socketId, sessionId, studentName, frame }) => {
      setStudents(prev => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: { ...prev[socketId], frame, socketId, sessionId, studentName, lastSeen: Date.now() }
        };
      });
    });

    socket.on('student:violation', ({ socketId, studentName, violationType, timestamp }) => {
      playAlertTone();
      setStudents(prev => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            violations: (prev[socketId].violations || 0) + 1,
            lastViolation: violationType
          }
        };
      });
      setViolations(prev => [{ socketId, studentName, violationType, timestamp }, ...prev.slice(0, 49)]);
    });

    socket.on('student:submitted', ({ socketId }) => {
      setStudents(prev => {
        if (!prev[socketId]) return prev;
        return { ...prev, [socketId]: { ...prev[socketId], status: 'submitted' } };
      });
    });

    // Handle student aborted
    socket.on('student:aborted', ({ socketId, sessionId, studentName, reason }) => {
      setStudents(prev => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            status: 'aborted',
            abortReason: reason
          }
        };
      });

      setViolations(prev => [
        {
          studentName,
          violationType: `⛔ EXAM ABORTED: ${reason}`,
          timestamp: Date.now()
        },
        ...prev.slice(0, 49)
      ]);
    });

    return () => { socket.disconnect(); };
  }, [testId, soundEnabled]); // eslint-disable-line

  const sendCustomWarning = (socketId) => {
    const msg = warningMsg.trim() || 'Warning: Suspicious activity detected. Return focus to your exam immediately.';
    socketRef.current?.emit('teacher:warn', { targetSocketId: socketId, message: msg });
    setWarningMsg('');
    setSelectedStudent(null);
  };

  // Live Abort Student
  const handleAbortStudent = async (student, reason) => {
    const finalReason = reason || abortReasonInput.trim() || 'Terminated live by instructor for academic integrity violation.';

    // 1. Instantly update teacher's local view so card turns red with "EXAM ABORTED"
    setStudents(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (updated[k].sessionId === student.sessionId || k === student.socketId) {
          updated[k] = { ...updated[k], status: 'aborted', abortReason: finalReason };
        }
      });
      return updated;
    });

    setViolations(prev => [
      {
        studentName: student.studentName,
        violationType: `⛔ EXAM ABORTED: ${finalReason}`,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 49),
    ]);

    // 2. Emit via socket to immediately lock out student
    socketRef.current?.emit('teacher:abort_student', {
      targetSocketId: student.socketId,
      sessionId: Number(student.sessionId) || student.sessionId,
      studentName: student.studentName,
      reason: finalReason,
    });

    // 3. Persist in database
    try {
      await api.post(`/sessions/${student.sessionId}/abort`, { reason: finalReason });
    } catch (err) {
      console.error('Failed to log abort in db:', err);
    }

    setAbortReasonInput('');
    setShowAbortPrompt(false);
    setSelectedStudent(null);
  };

  const studentList = Object.values(students);
  const activeCount = studentList.filter(s => s.status !== 'disconnected' && s.status !== 'submitted' && s.status !== 'aborted').length;
  const submittedCount = studentList.filter(s => s.status === 'submitted').length;
  const abortedCount = studentList.filter(s => s.status === 'aborted').length;
  const violationCount = studentList.reduce((acc, s) => acc + (s.violations || 0), 0);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col h-screen overflow-hidden">
      {/* Top Mission Control Header */}
      <header className="bg-[#12141C] border-b border-white/[0.06] px-6 py-3.5 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/teacher/dashboard" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-sm">{test?.title || 'Live Proctor Room'}</h1>
              <span className="badge-blue text-[10px] font-mono">CODE: {test?.joinCode}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Real-Time Neural Proctoring Grid</span>
            </div>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 bg-[#1A1D26] border border-white/[0.06] px-3.5 py-1.5 rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-gray-400">Live:</span>
              <span className="font-mono font-bold text-white">{activeCount}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-gray-400">Submitted:</span>
              <span className="font-mono font-bold text-white">{submittedCount}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-red-500" />
              <span className="text-gray-400">Aborted:</span>
              <span className="font-mono font-bold text-red-400">{abortedCount}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-gray-400">Flags:</span>
              <span className="font-mono font-bold text-amber-400">{violationCount}</span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                : 'bg-white/5 border-white/5 text-gray-500'
            }`}
            title={soundEnabled ? 'Alert chime enabled' : 'Alert chime muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Connection Pill */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border ${
            connected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="font-medium">{connected ? 'Relay Active' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace: Grid + Right Live Telemetry */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Camera Feed Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {studentList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Awaiting Students to Connect</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-6">
                Students will stream their webcam and lock their browser into fullscreen once they join.
              </p>
              <div className="inline-flex items-center gap-3 bg-[#1A1D26] border border-white/[0.08] px-4 py-2.5 rounded-2xl">
                <span className="text-xs text-gray-400">Share Join Code:</span>
                <span className="font-mono font-bold text-lg text-indigo-400 tracking-wider">{test?.joinCode}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
              {studentList.map(s => {
                const hasViolations = s.violations > 0;
                const isSubmitted = s.status === 'submitted';
                const isAborted = s.status === 'aborted';
                const isOffline = s.status === 'disconnected';

                return (
                  <div
                    key={s.socketId}
                    className={`group relative bg-[#12141C] rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isAborted
                        ? 'border-red-600/90 shadow-xl shadow-red-950/60 ring-2 ring-red-600'
                        : hasViolations
                        ? 'border-red-500/60 shadow-lg shadow-red-950/40 ring-1 ring-red-500/40'
                        : isSubmitted
                        ? 'border-emerald-500/30'
                        : 'border-white/[0.08] hover:border-indigo-500/40'
                    }`}
                  >
                    {/* Video Screen Area */}
                    <div className="relative aspect-video bg-[#090b11] flex items-center justify-center overflow-hidden">
                      {isAborted ? (
                        <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-3 text-center z-10">
                          <Ban className="w-8 h-8 text-red-500 mb-1" />
                          <span className="text-xs font-black text-red-200 tracking-wider">EXAM ABORTED</span>
                          <span className="text-[10px] text-red-400 line-clamp-2 mt-1">{s.abortReason || 'Terminated by proctor'}</span>
                        </div>
                      ) : s.frame ? (
                        <img
                          src={s.frame}
                          alt={s.studentName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300 mb-2">
                            {s.studentName?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-[11px] text-gray-500 font-mono">Standby Stream</span>
                        </div>
                      )}

                      {/* Face Target HUD Overlay */}
                      {!isAborted && (
                        <div className="absolute inset-2 border border-white/5 rounded-lg pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold backdrop-blur-md ${
                          isAborted
                            ? 'bg-red-600 text-white'
                            : isSubmitted
                            ? 'bg-emerald-500/80 text-white'
                            : isOffline
                            ? 'bg-gray-700/80 text-gray-300'
                            : 'bg-black/60 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isAborted ? 'TERMINATED' : isSubmitted ? 'SUBMITTED' : isOffline ? 'OFFLINE' : 'LIVE'}
                        </span>

                        {hasViolations && !isAborted && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-black flex items-center gap-1 shadow-md animate-bounce">
                            <AlertTriangle className="w-3 h-3" />
                            {s.violations} {s.violations === 1 ? 'Strike' : 'Strikes'}
                          </span>
                        )}
                      </div>

                      {/* Fullscreen Inspect button on hover */}
                      {!isAborted && (
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-10"
                          title="Focus stream & management actions"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom Student Info Bar */}
                    <div className="p-3 bg-[#151822] border-t border-white/[0.04] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{s.studentName}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {isAborted ? 'Disqualified' : s.lastViolation ? `⚠️ ${s.lastViolation}` : 'Camera feed normal'}
                        </p>
                      </div>

                      {!isAborted && !isSubmitted && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="text-[11px] bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded-lg transition-colors font-medium"
                            title="Send warning message"
                          >
                            Warn
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setShowAbortPrompt(true);
                            }}
                            className="text-[11px] bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 px-2 py-1 rounded-lg transition-colors font-bold"
                            title="Abort student's exam live"
                          >
                            Abort
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Live Event Telemetry Stream */}
        <aside className="w-80 bg-[#12141C] border-l border-white/[0.06] flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Live Proctor Feed</h2>
            </div>
            <span className="badge-red text-[10px]">{violations.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {violations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="text-xs font-medium text-gray-400">Integrity Intact</p>
                <p className="text-[11px] text-gray-500 mt-0.5">No student tab switching or fullscreen violations detected.</p>
              </div>
            ) : (
              violations.map((v, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#1A1D26] border border-red-500/20 hover:border-red-500/40 transition-colors animate-fadeIn"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white truncate">{v.studentName}</span>
                    <span className="text-[10px] font-mono text-gray-500">
                      {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{v.violationType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Modal: Student Detail / Send Warning / Abort Live */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
                  {selectedStudent.studentName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedStudent.studentName}</h3>
                  <p className="text-xs text-gray-400">Live proctor camera inspector & intervention</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setShowAbortPrompt(false);
                }}
                className="text-gray-400 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            {/* Video preview in modal */}
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-5 border border-white/10 flex items-center justify-center">
              {selectedStudent.frame ? (
                <img src={selectedStudent.frame} alt={selectedStudent.studentName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-500">Stream preview standby</span>
              )}
            </div>

            {/* If Teacher clicked "Abort Exam" */}
            {showAbortPrompt ? (
              <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <Ban className="w-4 h-4" />
                  <span>Terminate & Abort Exam Session</span>
                </div>
                <p className="text-xs text-red-200/80 leading-relaxed">
                  This will immediately lock out {selectedStudent.studentName}, disqualify their test session, and record this action to the audit ledger.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Disqualification Reason
                  </label>
                  <input
                    className="input text-xs"
                    placeholder="e.g. Unauthorized display switching or secondary device detected"
                    value={abortReasonInput}
                    onChange={e => setAbortReasonInput(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAbortPrompt(false)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAbortStudent(selectedStudent)}
                    className="btn-danger text-xs py-1.5 px-4 font-bold flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Live Termination</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Warning Action Box */
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Send Direct Alert to Student Screen
                </label>
                <textarea
                  className="input text-xs resize-none"
                  rows={2}
                  placeholder="e.g. Please look directly at the screen and stop talking."
                  value={warningMsg}
                  onChange={e => setWarningMsg(e.target.value)}
                />

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setShowAbortPrompt(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Abort Student's Exam</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="btn-secondary text-xs py-2 px-3"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => sendCustomWarning(selectedStudent.socketId)}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Warning</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
