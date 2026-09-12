import { useMemo } from 'react';
import { CheckCircle2, Clock, MapPin, Inbox, LogIn } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS, supabase, type Complaint } from '@/lib/supabase';
import { getReporterEntries } from '@/lib/reporter';
import { useAuth } from '@/lib/auth';

interface MyComplaintsProps {
  complaints: Complaint[];
  onUpdate: () => void;
  onLoginClick: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ditë më parë`;
  if (hours > 0) return `${hours} orë më parë`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins} minuta më parë`;
  return 'Tani';
}

export default function MyComplaints({ complaints, onUpdate, onLoginClick }: MyComplaintsProps) {
  const { user } = useAuth();

  const myComplaints = useMemo(() => {
    if (user) {
      return complaints
        .filter((c) => c.user_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const myEntries = getReporterEntries();
    const myIds = new Set(myEntries.map((e) => e.complaintId));
    return complaints
      .filter((c) => myIds.has(c.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [complaints, user]);

  const handleConfirmResolved = async (complaintId: string) => {
    const { error } = await supabase
      .from('complaints')
      .update({ confirmed_by_reporter: true })
      .eq('id', complaintId);

    if (!error) onUpdate();
  };

  if (!user && myComplaints.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-12">
        <div className="text-center mb-6">
          <Inbox size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Nuk keni ankesa të ruajtura</h3>
          <p className="text-sm text-slate-400 mt-1">Kyçuni për të parë historikun e ankesave tuaja.</p>
        </div>
        <button
          onClick={onLoginClick}
          className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          <LogIn size={18} /> Kyçu për historik
        </button>
      </div>
    );
  }

  if (myComplaints.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-20 text-center">
        <Inbox size={48} className="mx-auto text-slate-300 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">Nuk keni raportuar asnjë ankesë</h3>
        <p className="text-sm text-slate-400 mt-1">Ankesat që ju dërgoni do të shfaqen këtu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8 space-y-3">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Ankesat e mia</h2>
      <p className="text-sm text-slate-500 mb-4">
        {user ? `Të kyçur si ${user.email}` : 'Po shfaqen ankesat e raportuara në këtë pajisje.'}
      </p>

      {myComplaints.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex gap-3">
            {c.image_url ? (
              <img src={c.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                {CATEGORY_ICONS[c.category]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-slate-900">{CATEGORY_LABELS[c.category]}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{c.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(c.created_at)}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {c.status === 'zgjidhur' && !c.confirmed_by_reporter && (
            <button
              onClick={() => handleConfirmResolved(c.id)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition text-sm font-semibold"
            >
              <CheckCircle2 size={18} /> Konfirmo zgjidhjen
            </button>
          )}
          {c.status === 'zgjidhur' && c.confirmed_by_reporter && (
            <div className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-100 text-green-700 text-sm font-semibold">
              <CheckCircle2 size={18} /> Zgjidhja e konfirmuar
            </div>
          )}
          {c.status !== 'zgjidhur' && (
            <div className="mt-3 text-center text-xs text-slate-400">
              Statusi: {STATUS_LABELS[c.status]} — Presni që komuna ta zgjidhë.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
