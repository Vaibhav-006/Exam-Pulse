import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import {
  Plus, BookOpen, Users, Eye, BarChart2, Trash2, LogOut,
  Copy, CheckCircle, XCircle, Clock, Zap, TrendingUp, Shield
} from 'lucide-react';

export default function TeacherDashboard() {
  const { teacher, logout } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    try {
      const { data } = await api.get('/tests');
      setTests(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleStatus = async (test) => {
    const newStatus = test.status === 'active' ? 'closed' : 'active';
    await api.patch(`/tests/${test.id}/status`, { status: newStatus });
    setTests(prev => prev.map(t => t.id === test.id ? { ...t, status: newStatus } : t));
  };

  const deleteTest = async (testId) => {
    if (!confirm('Delete this test? This cannot be undone.')) return;
    await api.delete(`/tests/${testId}`);
    setTests(prev => prev.filter(t => t.id !== testId));
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalStudents = tests.reduce((a, t) => a + (t._count?.sessions || 0), 0);
  const activeTests = tests.filter(t => t.status === 'active').length;

  return (
    <div className="min-h-screen bg-[#0B0F19] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#12141C] border-r border-white/[0.06] flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <BookOpen className="text-indigo-400 w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">ExamPulse</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[10px] text-gray-500">Teacher Portal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <div className="sidebar-item active">
            <BarChart2 className="w-4 h-4" /> Dashboard
          </div>
          <div onClick={() => navigate('/teacher/tests/new')} className="sidebar-item">
            <Plus className="w-4 h-4" /> New Test
          </div>
          <Link to="/join" target="_blank" className="sidebar-item">
            <Users className="w-4 h-4" /> Student Portal
          </Link>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
              {teacher?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{teacher?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{teacher?.email}</p>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Dashboard</h1>
            <p className="text-xs text-gray-500">Manage your exams and monitor students</p>
          </div>
          <button onClick={() => navigate('/teacher/tests/new')} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> New Test
          </button>
        </div>

        <div className="p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="stat-card flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600/15 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="text-indigo-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{tests.length}</p>
                <p className="text-xs text-gray-500 font-medium">Total Tests</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600/15 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                <Zap className="text-emerald-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeTests}</p>
                <p className="text-xs text-gray-500 font-medium">Active Now</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/15 rounded-2xl flex items-center justify-center border border-purple-500/20">
                <TrendingUp className="text-purple-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalStudents}</p>
                <p className="text-xs text-gray-500 font-medium">Total Students</p>
              </div>
            </div>
          </div>

          {/* Tests list */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">Your Tests</h2>
            <span className="text-xs text-gray-500">{tests.length} total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : tests.length === 0 ? (
            <div className="card text-center py-20 border-dashed border-white/[0.06]">
              <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-indigo-500/10">
                <BookOpen className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">No tests yet</h3>
              <p className="text-sm text-gray-500 mb-6">Upload a document and let AI create your first exam</p>
              <button onClick={() => navigate('/teacher/tests/new')} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Create First Test</button>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map(test => (
                <div key={test.id} className="card hover:border-white/[0.1] transition-all duration-200 group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white truncate">{test.title}</h3>
                        {test.status === 'active' && <span className="badge-green flex-shrink-0"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>Live</span>}
                        {test.status === 'closed' && <span className="badge-red flex-shrink-0"><XCircle className="w-3 h-3" />Closed</span>}
                        {test.status === 'draft' && <span className="badge-yellow flex-shrink-0"><Clock className="w-3 h-3" />Draft</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{test.totalQuestions} questions</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{test.durationMins} min</span>
                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{test._count?.sessions || 0} students</span>
                        <button onClick={() => copyCode(test.joinCode)}
                          className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-mono font-bold text-indigo-400 transition-colors">
                          {copiedCode === test.joinCode ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {test.joinCode}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => navigate(`/teacher/tests/${test.id}/monitor`)}
                        className="flex items-center gap-1.5 btn-secondary text-xs py-1.5 px-3"><Eye className="w-3.5 h-3.5" />Monitor</button>
                      <button onClick={() => navigate(`/teacher/tests/${test.id}/results`)}
                        className="flex items-center gap-1.5 btn-secondary text-xs py-1.5 px-3"><BarChart2 className="w-3.5 h-3.5" />Results</button>
                      <button onClick={() => toggleStatus(test)}
                        className={`text-xs py-1.5 px-3 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${test.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'}`}>
                        {test.status === 'active' ? 'Close' : 'Open'}
                      </button>
                      <button onClick={() => deleteTest(test.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
