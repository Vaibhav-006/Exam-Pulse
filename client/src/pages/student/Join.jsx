import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { BookOpen, ArrowRight, AlertCircle, Shield, Clock, Hash } from 'lucide-react';

export default function StudentJoin() {
  const [form, setForm] = useState({ studentName: '', joinCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/sessions/join', {
        studentName: form.studentName.trim(),
        joinCode: form.joinCode.trim().toUpperCase(),
      });
      sessionStorage.setItem('ep_session', JSON.stringify(data));
      navigate('/exam/setup');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600/20 rounded-2xl mb-4 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors">
            <BookOpen className="text-emerald-400 w-7 h-7" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Join Your Exam</h1>
          <p className="text-gray-400 text-sm mt-1">Enter the code your teacher shared</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 mb-5 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Full Name</label>
              <input className="input" placeholder="e.g., Riya Sharma" value={form.studentName}
                onChange={e => setForm({ ...form, studentName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Exam Code</label>
              <input
                className="input text-2xl font-mono tracking-[0.3em] text-center uppercase font-bold text-emerald-400 placeholder-gray-600"
                placeholder="ABC123" maxLength={6} value={form.joinCode}
                onChange={e => setForm({ ...form, joinCode: e.target.value.toUpperCase() })} required />
              <p className="text-xs text-gray-600 mt-2 text-center">6-character code from your teacher</p>
            </div>
            <button type="submit" disabled={loading} className="btn-green w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Joining...</>
                : <>Join Exam <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        {/* Info pills */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Shield, label: 'Proctored', color: 'text-indigo-400' },
            { icon: Clock, label: 'Timed', color: 'text-amber-400' },
            { icon: Hash, label: 'No Account', color: 'text-emerald-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className="text-[10px] text-gray-500 font-medium">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-5">Use Chrome or Edge on a desktop computer</p>
      </div>
    </div>
  );
}
