import { useState, useMemo } from 'react';
import { Map, List, X, Clock, MapPin } from 'lucide-react';
import MapView from './MapView';
import StatusBadge from './StatusBadge';
import { CATEGORY_LABELS, CATEGORY_ICONS, type Complaint } from '@/lib/supabase';
import { isReporter } from '@/lib/reporter';
import { useAuth } from '@/lib/auth';

interface PublicMapProps {
  complaints: Complaint[];
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

export default function PublicMap({ complaints }: PublicMapProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [showList, setShowList] = useState(false);

  const sortedComplaints = useMemo(
    () => [...complaints].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [complaints]
  );

  return (
    <div className="relative w-full h-full">
      <MapView complaints={complaints} onPinClick={(c) => setSelected(c)} />

      {/* Toggle button */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-2">
        <button
          onClick={() => setShowList(false)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold shadow-md transition flex items-center gap-1.5 ${
            !showList ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Map size={16} /> Hartë
        </button>
        <button
          onClick={() => setShowList(true)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold shadow-md transition flex items-center gap-1.5 ${
            showList ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <List size={16} /> Lista
        </button>
      </div>

      {/* List view overlay */}
      {showList && (
        <div className="absolute inset-0 z-[999] bg-slate-50 overflow-y-auto pt-16 px-4 pb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Të gjitha ankesat ({complaints.length})
          </h2>
          <div className="space-y-3 max-w-2xl mx-auto">
            {sortedComplaints.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelected(c); setShowList(false); }}
                className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition flex gap-3"
              >
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
                  <p className="text-sm text-slate-500 truncate">{c.description}</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock size={12} /> {timeAgo(c.created_at)}
                  </p>
                </div>
              </button>
            ))}
            {complaints.length === 0 && (
              <div className="text-center text-slate-400 py-12">
                <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                <p>Nuk ka ankesa ende.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail popup */}
      {selected && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {selected.image_url ? (
                <img src={selected.image_url} alt="" className="w-full h-56 object-cover rounded-t-3xl sm:rounded-t-2xl" />
              ) : (
                <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-5xl rounded-t-3xl sm:rounded-t-2xl">
                  {CATEGORY_ICONS[selected.category]}
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{CATEGORY_LABELS[selected.category]}</h3>
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-sm text-slate-600">{selected.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin size={14} /> {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={14} /> {timeAgo(selected.created_at)}
              </div>
              {selected.confirmed_by_reporter && (
                <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-medium">
                  ✓ Qytetari ka konfirmuar zgjidhjen
                </div>
              )}
              {(isReporter(selected.id) || (user && selected.user_id === user.id)) && (
                <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 font-medium">
                  Kjo ankesë është e juaja
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
