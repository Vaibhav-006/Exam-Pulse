import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { BookOpen, Mail, Lock, ArrowRight, Zap } from 'lucide-react';

export default function TeacherLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.teacher);
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600/20 rounded-2xl mb-4 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors">
            <BookOpen className="text-indigo-400 w-7 h-7" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your teacher account</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 mb-5 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"></span>{error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input className="input pl-10" type="email" placeholder="you@school.edu" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input className="input pl-10" type="password" placeholder="••••••••" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2" disabled={loading}>
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Signing in...</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-5">
            No account?{' '}
            <Link to="/teacher/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Register</Link>
          </p>
        </div>

        <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center gap-2 text-xs text-gray-500">
          <Zap className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          AI-powered MCQ generation from any document
        </div>
      </div>
    </div>
  );
}
