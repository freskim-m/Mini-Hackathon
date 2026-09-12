import { useState, useMemo, useEffect, useCallback } from 'react';
import { Shield, Clock, MapPin, CheckCircle2, Search, Filter, LogIn, Lock, ClipboardCheck, History, Users, UserRoundCheck, UserRoundX } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { supabase, CATEGORY_LABELS, CATEGORY_ICONS, STATUS_LABELS, type Complaint, type ComplaintStatus } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface AdminPanelProps {
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

export default function AdminPanel({ complaints, onUpdate, onLoginClick }: AdminPanelProps) {
  const { user, isAdmin, isSuperadmin, accountActive } = useAuth();
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<{ id: string; complaint_id: string | null; action: string; created_at: string; details: { status?: string } }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; email: string; active: boolean; created_at: string }[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const [assignmentResult, activityResult, profileResult, adminsResult] = await Promise.all([
      supabase.from('complaint_assignments').select('complaint_id, admin_id'),
      supabase.from('admin_activity_log').select('id, complaint_id, action, created_at, details').order('created_at', { ascending: false }).limit(20),
      isSuperadmin ? supabase.from('user_profiles').select('id, email, active, created_at').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      isSuperadmin ? supabase.from('admin_users').select('id') : Promise.resolve({ data: [] }),
    ]);
    setAssignments(Object.fromEntries((assignmentResult.data ?? []).map((row) => [row.complaint_id, row.admin_id])));
    setActivity(activityResult.data ?? []);
    if (isSuperadmin) setAccounts(profileResult.data ?? []);
    if (isSuperadmin) setAdminIds(new Set((adminsResult.data ?? []).map((admin) => admin.id)));
  }, [isAdmin, isSuperadmin]);

  useEffect(() => { void loadAdminData(); }, [loadAdminData]);

  const filtered = useMemo(() => {
    let result = [...complaints].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.description.toLowerCase().includes(q) || CATEGORY_LABELS[c.category].toLowerCase().includes(q));
    }
    return result;
  }, [complaints, filterStatus, search]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const pranuar = complaints.filter((c) => c.status === 'pranuar').length;
    const nePunim = complaints.filter((c) => c.status === 'ne_punim').length;
    const zgjidhur = complaints.filter((c) => c.status === 'zgjidhur').length;
    return { total, pranuar, nePunim, zgjidhur };
  }, [complaints]);

  const handleStatusChange = async (complaintId: string, newStatus: ComplaintStatus) => {
    setUpdating(complaintId);
    const { error } = await supabase.rpc('update_complaint_status', { p_complaint_id: complaintId, p_status: newStatus });

    setUpdating(null);
    if (!error) { onUpdate(); void loadAdminData(); }
  };

  const handleTakeCase = async (complaintId: string) => {
    setUpdating(complaintId);
    const { error } = await supabase.rpc('take_complaint', { p_complaint_id: complaintId });
    setUpdating(null);
    if (!error) void loadAdminData();
  };

  const handleAccountActive = async (accountId: string, active: boolean) => {
    const { error } = await supabase.rpc('set_account_active', { p_user_id: accountId, p_active: active });
    if (!error) void loadAdminData();
  };

  const handleAdminAccess = async (accountId: string, enabled: boolean) => {
    const { error } = await supabase.rpc('set_admin_access', { p_user_id: accountId, p_enabled: enabled });
    if (!error) void loadAdminData();
  };

  const handleDeleteAccount = async (accountId: string, email: string) => {
    if (!window.confirm(`A jeni të sigurt që doni ta fshini përgjithmonë llogarinë ${email}?`)) return;
    const { error } = await supabase.rpc('delete_account', { p_user_id: accountId });
    if (!error) void loadAdminData();
  };

  if (!user || !isAdmin || !accountActive) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Akses i kufizuar</h2>
          <p className="text-sm text-slate-500 mb-6">Ky panel është vetëm për stafin e komunës. Përdorni kyçjen e zakonshme; qasja jepet nga roli juaj në databazë.</p>
          <button
            onClick={onLoginClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            <LogIn size={18} /> Kyçu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">{isSuperadmin ? 'Paneli i superadminit' : 'Paneli i administratorit'}</h2>
        </div>
        <span className="text-xs text-slate-400 hidden sm:block">{user.email}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.pranuar}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pranuar</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.nePunim}</p>
          <p className="text-xs text-slate-500 mt-0.5">Në punim</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.zgjidhur}</p>
          <p className="text-xs text-slate-500 mt-0.5">Zgjidhur</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-3"><ClipboardCheck size={17} className="text-blue-600" /> Rastet e mia</h3>
          <p className="text-2xl font-bold text-blue-600">{Object.values(assignments).filter((adminId) => adminId === user.id).length}</p>
          <p className="text-xs text-slate-500">Merrni një rast para ndryshimit të statusit.</p>
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-3"><History size={17} className="text-blue-600" /> Historia ime</h3>
          <div className="space-y-1.5 max-h-20 overflow-auto text-xs text-slate-500">
            {activity.slice(0, 4).map((item) => <p key={item.id}>{item.action === 'assigned' ? 'Mori rast për detyrë' : item.action === 'completed' ? 'E shënoi rastin të zgjidhur' : `Ndryshoi statusin: ${item.details?.status ?? ''}`} · {timeAgo(item.created_at)}</p>)}
            {activity.length === 0 && <p>Nuk ka veprime të regjistruara ende.</p>}
          </div>
        </section>
      </div>

      {isSuperadmin && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-3"><Users size={17} className="text-blue-600" /> Llogaritë e përdoruesve</h3>
          <div className="space-y-2 max-h-52 overflow-auto">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700 truncate">{account.email}</span>
                {account.id === user.id ? <span className="text-xs text-slate-400">Llogaria juaj</span> : <button onClick={() => handleAccountActive(account.id, !account.active)} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${account.active ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                  {account.active ? <span className="flex gap-1 items-center"><UserRoundX size={14} /> Çaktivizo</span> : <span className="flex gap-1 items-center"><UserRoundCheck size={14} /> Aktivizo</span>}
                </button>}
                {account.id !== user.id && <button onClick={() => handleAdminAccess(account.id, !adminIds.has(account.id))} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50">
                  {adminIds.has(account.id) ? 'Hiq adminin' : 'Bëje admin'}
                </button>}
                {account.id !== user.id && <button onClick={() => handleDeleteAccount(account.id, account.email)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-700 bg-red-50">Fshije</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kërko ankesa..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ComplaintStatus | 'all')}
            className="pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="all">Të gjitha</option>
            <option value="pranuar">Pranuar</option>
            <option value="ne_punim">Në punim</option>
            <option value="zgjidhur">Zgjidhur</option>
          </select>
        </div>
      </div>

      {/* Complaint list */}
      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4">
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
                  {c.confirmed_by_reporter && (
                    <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={12} /> Konfirmuar</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status changer */}
            <div className="mt-3 flex items-center gap-2">
              {assignments[c.id] !== user.id && !isSuperadmin ? (
                <button onClick={() => handleTakeCase(c.id)} disabled={updating === c.id} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {assignments[c.id] ? 'Merre përsipër' : 'Merre rastin'}
                </button>
              ) : (
                <span className="text-xs font-semibold text-blue-600">{assignments[c.id] === user.id ? 'Rasti im' : 'Superadmin'}</span>
              )}
              <span className="text-xs font-semibold text-slate-500">Ndrysho statusin:</span>
              <div className="flex gap-1.5">
                {(['pranuar', 'ne_punim', 'zgjidhur'] as ComplaintStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(c.id, s)}
                    disabled={updating === c.id || c.status === s || (!isSuperadmin && assignments[c.id] !== user.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      c.status === s
                        ? s === 'pranuar' ? 'bg-red-500 text-white border-red-500'
                          : s === 'ne_punim' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    } ${updating === c.id ? 'opacity-50' : ''}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            <p>Nuk ka ankesa që përputhen me kriteret.</p>
          </div>
        )}
      </div>
    </div>
  );
}
