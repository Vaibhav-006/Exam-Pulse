import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  ChevronLeft, Download, Users, TrendingUp, CheckCircle, XCircle,
  AlertTriangle, Search, ShieldCheck, Award, ArrowUpRight
} from 'lucide-react';

export default function TestResults() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/tests/${testId}`),
      api.get(`/results/test/${testId}`),
    ])
      .then(([testRes, resultsRes]) => {
        setTest(testRes.data);
        setResults(resultsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  const submitted = results.filter(r => r.status === 'submitted');
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((a, r) => a + (r.score || 0), 0) / submitted.length)
    : 0;
  const passedStudents = submitted.filter(r => (r.score ?? 0) >= (test?.passingScore || 50));
  const passRate = submitted.length > 0
    ? Math.round((passedStudents.length / submitted.length) * 100)
    : 0;
  const zeroViolations = results.filter(r => (r.violationCount || 0) === 0).length;

  const filteredResults = results.filter(r =>
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportCSV = () => {
    const rows = [['Student Name', 'Score (%)', 'Status', 'Violation Count', 'Submitted Timestamp']];
    results.forEach(r => {
      rows.push([
        r.studentName,
        r.score != null ? `${r.score}%` : 'N/A',
        r.status,
        r.violationCount || 0,
        r.submittedAt ? new Date(r.submittedAt).toLocaleString() : 'In Progress'
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(test?.title || 'Exam').replace(/\s+/g, '_')}_Results.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#12141C]/90 backdrop-blur-md border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/teacher/dashboard" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base">{test?.title}</h1>
                <span className="badge-blue text-[10px] font-mono">CODE: {test?.joinCode}</span>
              </div>
              <p className="text-xs text-gray-400">Comprehensive Performance & Integrity Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="btn-secondary text-xs flex items-center gap-2 py-2 px-3.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <Link
              to={`/teacher/tests/${testId}/monitor`}
              className="btn-primary text-xs flex items-center gap-2 py-2 px-3.5"
            >
              <span>Live Monitor</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* Bento Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Candidates</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{results.length}</p>
            <p className="text-[11px] text-gray-500 mt-1">{submitted.length} submitted exam</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Average Score</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{avgScore}%</p>
            <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${avgScore}%` }} />
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pass Rate</span>
              <div className="w-8 h-8 rounded-lg bg-purple-600/15 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{passRate}%</p>
            <p className="text-[11px] text-gray-500 mt-1">{passedStudents.length} of {submitted.length} reached {test?.passingScore || 50}%</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clean Integrity</span>
              <div className="w-8 h-8 rounded-lg bg-teal-600/15 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {results.length > 0 ? Math.round((zeroViolations / results.length) * 100) : 100}%
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{zeroViolations} candidates had 0 flags</p>
          </div>
        </div>

        {/* Results Data Table */}
        <div className="card overflow-hidden p-0 border border-white/[0.06]">
          {/* Table Header Action Bar */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12141C]">
            <div>
              <h2 className="font-semibold text-white text-sm">Student Performance Ledger</h2>
              <p className="text-xs text-gray-400">Scores, integrity violations, and submission timestamps</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input py-1.5 pl-9 text-xs"
                placeholder="Search candidate name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#151822] text-gray-400 uppercase tracking-wider font-semibold border-b border-white/[0.04]">
                <tr>
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5">Score</th>
                  <th className="px-6 py-3.5">Verdict</th>
                  <th className="px-6 py-3.5">Integrity Flags</th>
                  <th className="px-6 py-3.5">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredResults.map(r => {
                  const isSubmitted = r.status === 'submitted';
                  const passed = (r.score ?? 0) >= (test?.passingScore || 50);

                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center border border-indigo-500/20">
                          {r.studentName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">{r.studentName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">ID: #{r.id}</div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {r.score != null ? (
                          <div className="flex items-center gap-3">
                            <span className={`font-mono font-bold text-sm ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                              {r.score}%
                            </span>
                            <div className="w-20 bg-white/5 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${r.score}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 font-mono">--</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isSubmitted ? (
                          passed ? (
                            <span className="badge-green">
                              <CheckCircle className="w-3 h-3" />
                              Passed
                            </span>
                          ) : (
                            <span className="badge-red">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          )
                        ) : (
                          <span className="badge-yellow">In Progress</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {(r.violationCount || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {r.violationCount} strike{r.violationCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-500 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
                            0 flags
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-400 font-mono">
                        {r.submittedAt
                          ? new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : 'Pending'}
                      </td>
                    </tr>
                  );
                })}

                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500 text-xs">
                      {searchQuery ? 'No candidates matching search query.' : 'No students have participated in this exam yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
