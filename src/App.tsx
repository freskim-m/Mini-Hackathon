import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, FileText, Shield, Loader2, AlertCircle, LogIn, LogOut, User } from 'lucide-react';
import { supabase, type Complaint } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import ComplaintForm from '@/components/ComplaintForm';
import PublicMap from '@/components/PublicMap';
import MyComplaints from '@/components/MyComplaints';
import AdminPanel from '@/components/AdminPanel';
import AuthScreen from '@/components/AuthScreen';

type Tab = 'map' | 'report' | 'mine' | 'admin';

export default function App() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('map');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const fetchComplaints = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError('Nuk mund të ngarkohen ankesat.');
    } else {
      setComplaints(data || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComplaints();

    const channel = supabase
      .channel('complaints_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        fetchComplaints();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComplaints]);

  const tabs: { id: Tab; label: string; icon: typeof MapPin }[] = [
    { id: 'map', label: 'Hartë', icon: MapPin },
    { id: 'report', label: 'Raporto', icon: Plus },
    { id: 'mine', label: 'Ankesat e mia', icon: FileText },
    { id: 'admin', label: 'Admin', icon: Shield },
  ];

  const handleSignOut = async () => {
    await signOut();
    setTab('map');
  };

  useEffect(() => {
    // A successful sign-in should return straight to the app; previously the
    // login screen stayed open until a manual refresh/back action.
    if (user && showAuth) setShowAuth(false);
  }, [user, showAuth]);

  if (showAuth) {
    return (
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 flex-shrink-0 z-[1001]">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Prishtina Raporton</h1>
              <p className="text-xs text-slate-400 leading-tight">Platforma e ankesave qytetare</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <AuthScreen onBack={() => setShowAuth(false)} />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex-shrink-0 z-[1001]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Prishtina Raporton</h1>
              <p className="text-xs text-slate-400 leading-tight">Platforma e ankesave qytetare</p>
            </div>
          </div>
          {/* Auth button */}
          {authLoading ? (
            <Loader2 size={18} className="text-slate-300 animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <User size={14} />
                {isAdmin ? 'Admin' : user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
              >
                <LogOut size={16} /> Dilni
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
            >
              <LogIn size={16} /> Kyçu
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
              <p className="text-sm text-slate-500">{error}</p>
              <button onClick={fetchComplaints} className="mt-3 text-sm text-blue-600 font-semibold">Provo përsëri</button>
            </div>
          </div>
        ) : (
          <>
            {tab === 'map' && (
              <div className="flex-1 relative">
                <PublicMap complaints={complaints} />
              </div>
            )}
            {tab === 'report' && (
              <div className="flex-1 overflow-y-auto pt-4">
                <ComplaintForm onSubmitted={fetchComplaints} />
              </div>
            )}
            {tab === 'mine' && (
              <div className="flex-1 overflow-y-auto pt-4">
                <MyComplaints
                  complaints={complaints}
                  onUpdate={fetchComplaints}
                  onLoginClick={() => setShowAuth(true)}
                />
              </div>
            )}
            {tab === 'admin' && (
              <div className="flex-1 overflow-y-auto pt-4">
                <AdminPanel
                  complaints={complaints}
                  onUpdate={fetchComplaints}
                  onLoginClick={() => setShowAuth(true)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-white border-t border-slate-200 flex-shrink-0 z-[1001]">
        <div className="max-w-4xl mx-auto flex items-center justify-around px-2 py-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition ${
                  active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
