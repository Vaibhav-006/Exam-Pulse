import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createSocket } from '../../lib/socket';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft, AlertTriangle, CheckCircle2, Wifi, WifiOff, Users, Shield,
  Maximize2, Volume2, VolumeX, Send, Bell, Clock, Radio, Sparkles
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
      studentsArr.forEach(s => { map[s.socketId] = { ...s, frame: null, violations: 0, lastSeen: Date.now() }; });
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

    return () => { socket.disconnect(); };
  }, [testId, soundEnabled]); // eslint-disable-line

  const sendCustomWarning = (socketId) => {
    const msg = warningMsg.trim() || 'Warning: Suspicious activity detected. Return focus to your exam immediately.';
    socketRef.current?.emit('teacher:warn', { targetSocketId: socketId, message: msg });
    setWarningMsg('');
    setSelectedStudent(null);
  };

  const studentList = Object.values(students);
  const activeCount = studentList.filter(s => s.status !== 'disconnected' && s.status !== 'submitted').length;
  const submittedCount = studentList.filter(s => s.status === 'submitted').length;
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
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-gray-400">Flags:</span>
              <span className="font-mono font-bold text-red-400">{violationCount}</span>
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
                const isOffline = s.status === 'disconnected';

                return (
                  <div
                    key={s.socketId}
                    className={`group relative bg-[#12141C] rounded-2xl border transition-all duration-200 overflow-hidden ${
                      hasViolations
                        ? 'border-red-500/60 shadow-lg shadow-red-950/40 ring-1 ring-red-500/40'
                        : isSubmitted
                        ? 'border-emerald-500/30'
                        : 'border-white/[0.08] hover:border-indigo-500/40'
                    }`}
                  >
                    {/* Video Screen Area */}
                    <div className="relative aspect-video bg-[#090b11] flex items-center justify-center overflow-hidden">
                      {s.frame ? (
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
                      <div className="absolute inset-2 border border-white/5 rounded-lg pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold backdrop-blur-md ${
                          isSubmitted
                            ? 'bg-emerald-500/80 text-white'
                            : isOffline
                            ? 'bg-gray-700/80 text-gray-300'
                            : 'bg-black/60 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isSubmitted ? 'SUBMITTED' : isOffline ? 'OFFLINE' : 'LIVE'}
                        </span>

                        {hasViolations && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-600 text-white flex items-center gap-1 shadow-md shadow-red-950 animate-bounce">
                            <AlertTriangle className="w-3 h-3" />
                            {s.violations} {s.violations === 1 ? 'Strike' : 'Strikes'}
                          </span>
                        )}
                      </div>

                      {/* Fullscreen Inspect button on hover */}
                      <button
                        onClick={() => setSelectedStudent(s)}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                        title="Focus student view / Send warning"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Student Info Bar */}
                    <div className="p-3 bg-[#151822] border-t border-white/[0.04] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{s.studentName}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {s.lastViolation ? `⚠️ ${s.lastViolation}` : 'Camera feed normal'}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedStudent(s)}
                        disabled={isSubmitted}
                        className="text-[11px] bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-lg transition-colors font-medium flex-shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        Warn
                      </button>
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
                    <span>{v.violationType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Modal: Student Detail / Send Warning */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
                  {selectedStudent.studentName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedStudent.studentName}</h3>
                  <p className="text-xs text-gray-400">Proctor intervention and warning</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
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
                <span className="text-xs text-gray-500">Stream preview unavailable</span>
              )}
            </div>

            {/* Warning Message Input */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Send Direct Message to Student's Screen
              </label>
              <textarea
                className="input text-xs resize-none"
                rows={2}
                placeholder="e.g. Please look directly at the screen and stop talking."
                value={warningMsg}
                onChange={e => setWarningMsg(e.target.value)}
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-red-400 font-medium">
                  {selectedStudent.violations} strike(s) registered
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Cancel
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
          </div>
        </div>
      )}
    </div>
  );
}
