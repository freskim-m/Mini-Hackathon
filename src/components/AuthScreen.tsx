import { useState } from 'react';
import { MapPin, Loader2, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface AuthScreenProps {
  onBack: () => void;
}

export default function AuthScreen({ onBack }: AuthScreenProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ju lutemi plotësoni email dhe fjalëkalim.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const { error: errMsg } = await signIn(email.trim(), password);
        if (errMsg) setError(errMsg.includes('Invalid login') ? 'Email ose fjalëkalim i gabuar.' : errMsg);
      } else {
        const { error: errMsg } = await signUp(email.trim(), password);
        if (errMsg) setError(errMsg);
        else setSuccess('Llogaria u krijua. Kontrolloni emailin nëse kërkohet konfirmim.');
      }
    } finally {
      setLoading(false);
    };

  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto mb-3">
            <MapPin size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Prishtina Raporton</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Kyçuni për të parë historikun tuaj' : 'Krijoni llogari për të ruajtur historikun'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <LogIn size={16} /> Kyçja
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <UserPlus size={16} /> Regjistrohu
            </button>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="emri@shembull.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fjalëkalimi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? 'Kyçu' : 'Krijo llogarinë'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Demo: superadmin@demo.local / Demo123! · admin@demo.local / Admin123! · user@demo.local / User123!
          </p>
        </div>

        <button
          onClick={onBack}
          className="w-full text-center text-sm text-slate-500 mt-4 hover:text-slate-700 transition"
        >
          Kthehu në hartë
        </button>
      </div>
    </div>
  );
}
