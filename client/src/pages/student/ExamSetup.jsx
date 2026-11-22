import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, CheckCircle, AlertCircle, Monitor, Shield, Clock,
  CheckCircle2, ArrowRight, VideoOff, Lock, Eye
} from 'lucide-react';

export default function ExamSetup() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [session, setSession] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | requesting | allowed | denied
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('ep_session');
    if (!stored) {
      navigate('/join');
      return;
    }
    setSession(JSON.parse(stored));

    return () => {
      // Don't kill tracks if stream ready flag is set
      if (streamRef.current && !sessionStorage.getItem('ep_stream_ready')) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [navigate]);

  const requestCamera = async () => {
    setCameraStatus('requesting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('allowed');
    } catch (err) {
      console.error(err);
      setCameraStatus('denied');
      setError('Camera access denied. Please click the lock/camera icon in your browser URL bar and allow camera access.');
    }
  };

  const startExam = () => {
    if (cameraStatus !== 'allowed') {
      setError('Camera stream must be active before entering the proctored exam.');
      return;
    }
    sessionStorage.setItem('ep_stream_ready', '1');
    navigate('/exam/room');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen mesh-bg text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full relative z-10">
        {/* Header Title */}
        <div className="text-center mb-8">
          <span className="badge-blue text-xs uppercase tracking-wider mb-2 font-mono">Pre-Exam Integrity Verification</span>
          <h1 className="text-3xl font-extrabold text-white mt-2">{session.test?.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Candidate: <span className="text-white font-semibold">{session.studentName}</span> {session.rollNo && <span className="text-indigo-300 font-mono font-bold">({session.rollNo})</span>} · Exam Code: <span className="font-mono text-indigo-400">{session.test?.joinCode}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 mb-6 flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* 2-Column Pre-Flight Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Left: Camera Feed Calibrator */}
          <div className="md:col-span-7 card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-white text-sm">Webcam Calibration</h2>
                </div>
                {cameraStatus === 'allowed' ? (
                  <span className="badge-green text-[10px]">FEED ACTIVE</span>
                ) : (
                  <span className="badge-yellow text-[10px]">CAMERA REQUIRED</span>
                )}
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-video bg-[#090b11] rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
                {cameraStatus === 'allowed' ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    {/* Face alignment overlay box */}
                    <div className="absolute inset-8 border border-emerald-500/30 rounded-2xl pointer-events-none flex items-center justify-center">
                      <span className="text-[10px] font-mono text-emerald-400/60 bg-black/40 px-2 py-0.5 rounded">
                        Face in Frame
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <VideoOff className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Webcam feed is currently inactive</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              {cameraStatus === 'allowed' ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Optical sensor calibrated. Keep your face centered during exam.</span>
                </div>
              ) : (
                <button
                  onClick={requestCamera}
                  disabled={cameraStatus === 'requesting'}
                  className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{cameraStatus === 'requesting' ? 'Requesting Device Access...' : 'Enable & Verify Camera'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Lockdown Protocol Overview */}
          <div className="md:col-span-5 space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">Lockdown Protocols</h3>
              </div>

              <div className="space-y-3 text-xs text-gray-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[10px]">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white">Full Screen Lock:</span> Exiting fullscreen registers an immediate strike.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[10px]">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white">Tab & Focus Guard:</span> Switching tabs, Alt-Tabbing, or opening tools alerts your teacher.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[10px]">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-white">3 Strikes Rule:</span> 3 total infractions trigger an instant auto-submit.
                  </div>
                </div>
              </div>
            </div>

            {/* Exam Quick Specs */}
            <div className="card p-4 bg-[#12141C]/80 border-white/[0.04]">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Duration</p>
                  <p className="font-bold text-white text-sm">{session.test?.durationMins} Mins</p>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Questions</p>
                  <p className="font-bold text-white text-sm">{session.questions?.length} MCQs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Big Launch Button */}
        <div>
          <button
            onClick={startExam}
            disabled={cameraStatus !== 'allowed'}
            className="btn-green w-full py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/40 tracking-wide uppercase disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <Lock className="w-4 h-4" />
            <span>Launch Lockdown Exam (Fullscreen)</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-center text-[11px] text-gray-500 mt-3">
            Pressing this button activates fullscreen lockdown mode and starts the official exam timer.
          </p>
        </div>
      </div>
    </div>
  );
}
