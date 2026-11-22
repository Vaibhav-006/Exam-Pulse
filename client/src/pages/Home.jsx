import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Shield, Sparkles, Camera, Clock, Zap, BarChart3, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="text-center mb-14 relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600/20 rounded-3xl mb-6 border border-indigo-500/30 glow-indigo">
          <BookOpen className="text-indigo-400 w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
          <Zap className="w-3.5 h-3.5" /> AI-Powered · Proctored · Instant
        </div>
        <h1 className="text-5xl font-bold text-white tracking-tight">ExamPulse</h1>
        <p className="text-gray-400 mt-3 text-lg max-w-md mx-auto leading-relaxed">
          Upload a document. AI creates the exam. Students take it live — fully monitored.
        </p>
      </div>

      {/* Two portal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl relative z-10">
        {/* Teacher Card */}
        <Link to="/teacher/login" className="group relative card-glass hover:bg-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="relative">
            <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/20 group-hover:bg-indigo-600/30 transition-colors">
              <GraduationCap className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">I'm a Teacher</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Create AI-powered tests, monitor students live, and get instant analytics.</p>
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </div>
                AI generates MCQs from your documents
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-3 h-3 text-blue-400" />
                </div>
                Live camera grid of all students
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-3 h-3 text-emerald-400" />
                </div>
                Results & violation analytics
              </div>
            </div>
            <div className="w-full bg-indigo-600 group-hover:bg-indigo-500 text-white text-center font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-900/40">
              Teacher Login →
            </div>
          </div>
        </Link>

        {/* Student Card */}
        <Link to="/join" className="group relative card-glass hover:bg-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="relative">
            <div className="w-14 h-14 bg-emerald-600/20 rounded-2xl flex items-center justify-center mb-5 border border-emerald-500/20 group-hover:bg-emerald-600/30 transition-colors">
              <BookOpen className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">I'm a Student</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Enter your 6-character code to join your exam — no account needed.</p>
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-emerald-400" />
                </div>
                Just your name + 6-char code
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-blue-400" />
                </div>
                Secure fullscreen lockdown exam
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3 h-3 text-amber-400" />
                </div>
                Instant score after submission
              </div>
            </div>
            <div className="w-full bg-emerald-600 group-hover:bg-emerald-500 text-white text-center font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-emerald-900/40">
              Join Exam →
            </div>
          </div>
        </Link>
      </div>

      <p className="text-gray-600 text-xs mt-10 relative z-10">Best on Chrome or Edge · Desktop only for exam mode</p>
    </div>
  );
}
