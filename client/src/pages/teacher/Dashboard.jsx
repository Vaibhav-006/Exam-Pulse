import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import {
  Plus, BookOpen, Users, Eye, BarChart2, Trash2, LogOut,
  Copy, CheckCircle, XCircle, Clock, Zap, TrendingUp, Shield,
  Pause, Play, Calendar, AlertCircle, Check
} from 'lucide-react';

export default function TeacherDashboard() {
  const { teacher, logout } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  // Scheduling Modal State
  const [schedulingTest, setSchedulingTest] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ startsAt: '', endsAt: '' });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    try {
      const { data } = await api.get('/tests');
      setTests(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateTestStatus = async (testId, newStatus) => {
    try {
      await api.patch(`/tests/${testId}/status`, { status: newStatus });
      setTests(prev => prev.map(t => t.id === testId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update test status');
    }
  };

  const deleteTest = async (testId) => {
    if (!confirm('Are you sure you want to delete this test? All questions and student records will be removed.')) return;
    try {
      await api.delete(`/tests/${testId}`);
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (err) {
      alert('Failed to delete test');
    }
  };

  const openScheduleModal = (test) => {
    setSchedulingTest(test);
    // Format to datetime-local string (YYYY-MM-DDTHH:mm)
    const formatForInput = (d) => {
      if (!d) return '';
      const date = new Date(d);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    setScheduleForm({
      startsAt: formatForInput(test.startsAt),
      endsAt: formatForInput(test.endsAt),
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!schedulingTest) return;
    setScheduleSaving(true);
    try {
      await api.patch(`/tests/${schedulingTest.id}/schedule`, {
        startsAt: scheduleForm.startsAt || null,
        endsAt: scheduleForm.endsAt || null,
      });

      setTests(prev => prev.map(t => {
        if (t.id === schedulingTest.id) {
          return {
            ...t,
            startsAt: scheduleForm.startsAt ? new Date(scheduleForm.startsAt).toISOString() : null,
            endsAt: scheduleForm.endsAt ? new Date(scheduleForm.endsAt).toISOString() : null,
          };
        }
        return t;
      }));
      setSchedulingTest(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update schedule');
    } finally {
      setScheduleSaving(false);
    }
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
            <h1 className="text-lg font-bold text-white">Dashboard & Exam Controls</h1>
            <p className="text-xs text-gray-500">Manage test access, live schedules, and monitoring</p>
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
                <p className="text-xs text-gray-500 font-medium">Active Exams</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/15 rounded-2xl flex items-center justify-center border border-purple-500/20">
                <TrendingUp className="text-purple-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalStudents}</p>
                <p className="text-xs text-gray-500 font-medium">Candidate Sessions</p>
              </div>
            </div>
          </div>

          {/* Tests list */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">Your Tests & Access Controls</h2>
            <span className="text-xs text-gray-500">{tests.length} tests</span>
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
              <h3 className="text-base font-semibold text-white mb-2">No tests created yet</h3>
              <p className="text-sm text-gray-500 mb-6">Create an AI-powered test and configure student access rules</p>
              <button onClick={() => navigate('/teacher/tests/new')} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Create Test</button>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map(test => {
                const now = new Date();
                const isScheduledFuture = test.startsAt && now < new Date(test.startsAt);
                const isExpired = test.endsAt && now > new Date(test.endsAt);

                return (
                  <div key={test.id} className="card hover:border-white/[0.1] transition-all duration-200">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Test Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-white text-base truncate">{test.title}</h3>

                          {/* Status Badge */}
                          {test.status === 'active' && !isScheduledFuture && !isExpired && (
                            <span className="badge-green flex-shrink-0">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                              Active & Open
                            </span>
                          )}
                          {test.status === 'paused' && (
                            <span className="badge-yellow flex-shrink-0">
                              <Pause className="w-3 h-3" /> Paused (Access Frozen)
                            </span>
                          )}
                          {test.status === 'closed' && (
                            <span className="badge-red flex-shrink-0">
                              <XCircle className="w-3 h-3" /> Closed
                            </span>
                          )}
                          {isScheduledFuture && test.status === 'active' && (
                            <span className="badge-blue flex-shrink-0">
                              <Clock className="w-3 h-3" /> Scheduled to Open
                            </span>
                          )}
                          {isExpired && (
                            <span className="badge-red flex-shrink-0">
                              <Clock className="w-3 h-3" /> Window Expired
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{test.totalQuestions} questions</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{test.durationMins} min</span>
                          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{test._count?.sessions || 0} students</span>

                          {/* Code Pill */}
                          <button
                            onClick={() => copyCode(test.joinCode)}
                            className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-mono font-bold text-indigo-400 transition-colors"
                            title="Click to copy join code"
                          >
                            {copiedCode === test.joinCode ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {test.joinCode}
                          </button>

                          {/* Schedule Timing Display */}
                          {(test.startsAt || test.endsAt) && (
                            <span className="text-[11px] text-indigo-300/80 bg-indigo-900/30 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {test.startsAt && `Starts: ${new Date(test.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                              {test.startsAt && test.endsAt && ' · '}
                              {test.endsAt && `Closes: ${new Date(test.endsAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Management Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1. Stop / Pause / Resume Button */}
                        {test.status === 'active' ? (
                          <button
                            onClick={() => updateTestStatus(test.id, 'paused')}
                            className="text-xs py-1.5 px-3 rounded-xl font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                            title="Freeze student access immediately"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause Access</span>
                          </button>
                        ) : test.status === 'paused' ? (
                          <button
                            onClick={() => updateTestStatus(test.id, 'active')}
                            className="text-xs py-1.5 px-3 rounded-xl font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                            title="Resume exam access"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume Test</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => updateTestStatus(test.id, 'active')}
                            className="text-xs py-1.5 px-3 rounded-xl font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Re-Open Test</span>
                          </button>
                        )}

                        {/* 2. Schedule Timing Button */}
                        <button
                          onClick={() => openScheduleModal(test)}
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                          title="Configure automated open & close time windows"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Schedule Timing</span>
                        </button>

                        {/* 3. Live Monitor */}
                        <button
                          onClick={() => navigate(`/teacher/tests/${test.id}/monitor`)}
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Monitor Live</span>
                        </button>

                        {/* 4. Results */}
                        <button
                          onClick={() => navigate(`/teacher/tests/${test.id}/results`)}
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>Results</span>
                        </button>

                        {/* 5. Delete */}
                        <button
                          onClick={() => deleteTest(test.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                          title="Delete test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Schedule Timing Modal */}
      {schedulingTest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Schedule Exam Timing</h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{schedulingTest.title}</p>
                </div>
              </div>
              <button onClick={() => setSchedulingTest(null)} className="text-gray-400 hover:text-white font-mono p-1">✕</button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Start Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="input text-xs"
                  value={scheduleForm.startsAt}
                  onChange={e => setScheduleForm({ ...scheduleForm, startsAt: e.target.value })}
                />
                <p className="text-[11px] text-gray-500 mt-1">Students cannot start before this time.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  End / Auto-Close Deadline (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="input text-xs"
                  value={scheduleForm.endsAt}
                  onChange={e => setScheduleForm({ ...scheduleForm, endsAt: e.target.value })}
                />
                <p className="text-[11px] text-gray-500 mt-1">Exam automatically closes after this time.</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setScheduleForm({ startsAt: '', endsAt: '' })}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  Clear Timers
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSchedulingTest(null)}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scheduleSaving}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{scheduleSaving ? 'Saving...' : 'Save Schedule'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
