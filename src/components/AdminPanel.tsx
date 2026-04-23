import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, CheckCircle2, XCircle, Gift, TrendingUp,
  Search, MessageSquare, Calendar, ChevronDown,
  RefreshCw, LogOut, Ticket, Plus, Pencil, Trash2, Save, Ban,
  Settings, Eye, EyeOff, Check, AlertCircle,
  Coffee, Plane, Cat, Wine, Heart, Pizza, BookOpen, Gamepad2,
  Sparkles, Home, Star, Music, Camera, ShoppingBag, Leaf, Trophy,
  Mail, Phone, Link,
} from 'lucide-react';
import {
  fetchDashboardStats,
  fetchRsvpResponses,
  fetchGiftSummary,
  fetchGiftContributions,
  fetchAdminRifa,
  saveRifaConfig,
  addRifaPrize,
  updateRifaPrize,
  deleteRifaPrize,
  fetchAdminSite,
  saveAdminCouple,
  saveAdminContent,
  saveAdminRooms,
  addAdminGift,
  updateAdminGift,
  deleteAdminGift,
  fetchInviteTokens,
  createInviteToken,
  sendInviteEmail,
  markInviteSent,
  deleteInviteToken,
  updateInviteToken,
  updateAdminRsvp,
  deleteAdminRsvp,
} from '../services/adminData';
import type {
  DashboardStats,
  RsvpResponse,
  GiftSummary,
  GiftContribution,
  AdminRifaData,
  RifaConfig,
  RifaPrize,
  AdminSiteData,
  SiteEditorCouple,
  SiteEditorContent,
  AdminGiftItem,
  InviteToken,
  GuestItem,
} from '../types/admin';

type Tab = 'overview' | 'rsvp' | 'gifts' | 'rifa' | 'site';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Taxas MP conforme tabela de tarifas vigente
const MP_FEE: Record<string, number> = { pix: 0.01, credit_card: 0.0398 };
function netValue(amount: number, method: string | null) {
  const fee = MP_FEE[method ?? ''] ?? 0.0398;
  return amount * (1 - fee);
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#8FA9B8]/40 focus:border-[#8FA9B8] transition-all';
const textareaCls = `${inputCls} resize-none`;
const labelCls = 'block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5';

// ── Tag color presets ─────────────────────────────────────────────────────────

const TAG_PRESETS = [
  { label: 'Âmbar',   classes: 'bg-amber-100 text-amber-700' },
  { label: 'Laranja', classes: 'bg-orange-100 text-orange-700' },
  { label: 'Verde',   classes: 'bg-emerald-100 text-emerald-700' },
  { label: 'Musgo',   classes: 'bg-green-100 text-green-700' },
  { label: 'Teal',    classes: 'bg-teal-100 text-teal-700' },
  { label: 'Azul',    classes: 'bg-sky-100 text-sky-700' },
  { label: 'Índigo',  classes: 'bg-indigo-100 text-indigo-700' },
  { label: 'Roxo',    classes: 'bg-violet-100 text-violet-700' },
  { label: 'Rosa',    classes: 'bg-pink-100 text-pink-700' },
  { label: 'Rubi',    classes: 'bg-rose-100 text-rose-700' },
  { label: 'Cinza',   classes: 'bg-slate-100 text-slate-600' },
];

// ── Icon presets ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  coffee:       <Coffee size={16} />,
  plane:        <Plane size={16} />,
  cat:          <Cat size={16} />,
  wine:         <Wine size={16} />,
  plant:        <Leaf size={16} />,
  heart:        <Heart size={16} />,
  pizza:        <Pizza size={16} />,
  book:         <BookOpen size={16} />,
  gamepad:      <Gamepad2 size={16} />,
  sparkles:     <Sparkles size={16} />,
  gift:         <Gift size={16} />,
  home:         <Home size={16} />,
  star:         <Star size={16} />,
  music:        <Music size={16} />,
  camera:       <Camera size={16} />,
  'shopping-bag': <ShoppingBag size={16} />,
  trophy:         <Trophy size={16} />,
};
const ICON_KEYS = Object.keys(ICON_MAP);

// ── UI Primitives ─────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </label>
  );
}

function SaveBtn({ saving, saved, onSave, label = 'Salvar' }: { saving: boolean; saved: boolean; onSave: () => void; label?: string }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
        saved
          ? 'bg-[#94A684] text-white'
          : 'bg-stone-900 text-white hover:bg-[#94A684]'
      }`}
    >
      {saving ? (
        <RefreshCw size={13} className="animate-spin" />
      ) : saved ? (
        <Check size={13} />
      ) : (
        <Save size={13} />
      )}
      {saving ? 'Salvando…' : saved ? 'Salvo!' : label}
    </button>
  );
}

function InlineMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  const isError = !msg.toLowerCase().includes('salvo') && !msg.toLowerCase().includes('salva') && !msg.toLowerCase().includes('sucesso');
  return (
    <p className={`flex items-center gap-1.5 text-xs font-semibold ${isError ? 'text-red-500' : 'text-[#94A684]'}`}>
      {isError ? <AlertCircle size={12} /> : <Check size={12} />}
      {msg}
    </p>
  );
}

// ── Delete button com confirmação inline ─────────────────────────────────────

function DeleteButton({ onConfirm, disabled = false, size = 'sm' }: {
  onConfirm: () => void;
  disabled?: boolean;
  size?: 'sm' | 'xs';
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 rounded-xl px-2 py-1.5">
        <span className="text-[11px] text-red-600 font-semibold whitespace-nowrap">Tem certeza?</span>
        <button
          onClick={() => { setConfirming(false); onConfirm(); }}
          className="text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition-colors"
        >
          Sim
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[11px] font-bold text-stone-500 hover:text-stone-800 px-1 py-0.5 transition-colors"
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={disabled}
      className={`flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 ${size === 'sm' ? 'w-8 h-8' : 'w-7 h-7'}`}
      aria-label="Excluir"
    >
      <Trash2 size={size === 'sm' ? 13 : 12} />
    </button>
  );
}

// ── Tag color picker ──────────────────────────────────────────────────────────

function TagColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={labelCls}>Cor da tag</span>
      <div className="flex flex-wrap gap-1.5">
        {TAG_PRESETS.map((p) => (
          <button
            key={p.classes}
            type="button"
            onClick={() => onChange(p.classes)}
            title={p.label}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ring-offset-1 transition-all ${p.classes} ${
              value === p.classes ? 'ring-2 ring-stone-700 scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Icon picker ───────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={labelCls}>Ícone</span>
      <div className="flex flex-wrap gap-1.5">
        {ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={key}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
              value === key
                ? 'bg-stone-900 text-white border-stone-900 scale-105'
                : 'bg-white border-stone-200 text-stone-400 hover:border-stone-400 hover:text-stone-700'
            }`}
            aria-label={key}
          >
            {ICON_MAP[key]}
          </button>
        ))}
        {/* fallback: campo manual se o ícone não está nos presets */}
        {!ICON_KEYS.includes(value) && value && (
          <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-900 text-white border border-stone-900">
            <Gift size={16} />
          </div>
        )}
      </div>
      {!ICON_KEYS.includes(value) && value && (
        <p className="mt-1.5 text-[11px] text-stone-400">Ícone personalizado: <code className="bg-stone-100 px-1 rounded">{value}</code></p>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

const StatCard = memo(({ label, value, icon, accent, sub }: StatCardProps) => (
  <div className={`bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border-l-4 ${accent} shadow-sm`}>
    <div className="flex items-start justify-between gap-1">
      <div className="min-w-0">
        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400 leading-tight">{label}</p>
        <p className="text-xl md:text-3xl font-black text-stone-900 mt-0.5 md:mt-1 leading-none">{value}</p>
        {sub && <p className="text-[10px] md:text-xs text-stone-400 mt-0.5 md:mt-1 leading-tight">{sub}</p>}
      </div>
      <div className="text-stone-300 flex-shrink-0 hidden sm:block">{icon}</div>
    </div>
  </div>
));
StatCard.displayName = 'StatCard';

// ── Section accordion ─────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false, count }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-stone-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-stone-600">{title}</p>
          {count !== undefined && (
            <span className="text-[10px] font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={15} className="text-stone-400" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-stone-100 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

const OverviewTab = memo(({ stats, onNavigate }: { stats: DashboardStats; onNavigate: (tab: Tab) => void }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Confirmados"
        value={stats.confirmed}
        icon={<CheckCircle2 size={28} />}
        accent="border-[#94A684]"
        sub={`de ${stats.total_rsvp} respostas`}
      />
      <StatCard
        label="Declinaram"
        value={stats.declined}
        icon={<XCircle size={28} />}
        accent="border-red-300"
      />
      <StatCard
        label="Total Presentes"
        value={`R$ ${fmt(stats.total_gift_amount)}`}
        icon={<Gift size={28} />}
        accent="border-[#8FA9B8]"
        sub={`${stats.total_contributions} contribuições`}
      />
      <StatCard
        label="Taxa Confirmação"
        value={`${Math.round((stats.confirmed / Math.max(stats.total_rsvp, 1)) * 100)}%`}
        icon={<TrendingUp size={28} />}
        accent="border-[#D6BC9D]"
      />
    </div>

    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
      <p className={`${labelCls} mb-3`}>Confirmações vs. Total de Respostas</p>
      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(stats.confirmed / Math.max(stats.total_rsvp, 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-[#94A684] rounded-full"
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-stone-400">
        <span>{stats.confirmed} confirmados</span>
        <span>{stats.declined} declinaram</span>
      </div>
    </div>

    {/* Acesso rápido */}
    <div>
      <p className={`${labelCls} mb-3`}>Acesso rápido</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { tab: 'rsvp'  as Tab, icon: <Users size={20} />,    label: 'Presenças',   stat: `${stats.confirmed} confirmados`,            color: 'text-[#94A684]', bg: 'bg-[#94A684]/8 hover:bg-[#94A684]/15 border-[#94A684]/20' },
          { tab: 'gifts' as Tab, icon: <Gift size={20} />,     label: 'Presentes',   stat: `R$ ${fmt(stats.total_gift_amount)}`,         color: 'text-[#8FA9B8]', bg: 'bg-[#8FA9B8]/8 hover:bg-[#8FA9B8]/15 border-[#8FA9B8]/20' },
          { tab: 'rifa'  as Tab, icon: <Ticket size={20} />,   label: 'Rifa',        stat: 'Bilhetes e sorteio',                        color: 'text-[#D6BC9D]', bg: 'bg-[#D6BC9D]/8 hover:bg-[#D6BC9D]/15 border-[#D6BC9D]/20' },
          { tab: 'site'  as Tab, icon: <Settings size={20} />, label: 'Editar Site', stat: 'Textos e conteúdo',                          color: 'text-stone-500',  bg: 'bg-stone-50 hover:bg-stone-100 border-stone-200' },
        ] as const).map(({ tab, icon, label, stat, color, bg }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className={`flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all text-left ${bg}`}
          >
            <span className={color}>{icon}</span>
            <div>
              <p className="text-sm font-bold text-stone-800">{label}</p>
              <p className="text-xs text-stone-400 mt-0.5">{stat}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
));
OverviewTab.displayName = 'OverviewTab';

// ── Invites section ───────────────────────────────────────────────────────────

function useInvites() {
  const [invites,      setInvites]      = useState<InviteToken[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState('');
  const [copied,       setCopied]       = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tokens = await fetchInviteTokens();
      // Normaliza guests: banco antigo retorna string[], novo retorna GuestItem[]
      const normalized = tokens.map((inv) => ({
        ...inv,
        guests: (inv.guests ?? []).map((g: unknown) =>
          typeof g === 'string' ? { name: g, is_child: false } : (g as GuestItem)
        ),
      }));
      setInvites(normalized);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = useCallback((url: string, token: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleWhatsApp = useCallback(async (inv: InviteToken) => {
    const num = inv.whatsapp?.replace(/\D/g, '');
    if (!num) return;
    const text = encodeURIComponent(
      `Olá, ${inv.guest_name}!\n\nVocê está convidado(a) para o casamento de Álvaro & Larissa.\n\nEnvie sua resposta pelo link exclusivo abaixo:\n${inv.invite_url}\n\nEste link é pessoal e intransferível.`
    );
    window.open(`https://wa.me/55${num}?text=${text}`, '_blank');
    try {
      await markInviteSent(inv.token);
      setInvites((prev) => prev.map((i) => i.token === inv.token ? { ...i, sent: true, sent_at: new Date().toISOString() } : i));
    } catch { /* silent */ }
  }, []);

  const handleEmail = useCallback(async (inv: InviteToken) => {
    setEmailSending(inv.token);
    try {
      await sendInviteEmail(inv.token);
      setInvites((prev) => prev.map((i) => i.token === inv.token ? { ...i, sent: true, sent_at: new Date().toISOString() } : i));
    } catch (e) { setMsg((e as Error).message); }
    finally { setEmailSending(null); }
  }, []);

  const handleDelete = useCallback(async (token: string) => {
    try {
      await deleteInviteToken(token);
      setInvites((prev) => prev.filter((i) => i.token !== token));
    } catch (e) { setMsg((e as Error).message); }
  }, []);

  const handleUpdate = useCallback(async (token: string, data: { guest_name: string; guests?: GuestItem[]; whatsapp?: string; email?: string }) => {
    try {
      await updateInviteToken(token, data);
      setInvites((prev) => prev.map((i) => i.token === token
        ? { ...i, guest_name: data.guest_name, guests: data.guests ?? [], whatsapp: data.whatsapp ?? null, email: data.email ?? null }
        : i));
    } catch (e) { setMsg((e as Error).message); }
  }, []);

  const addInvite = useCallback((inv: InviteToken) => {
    setInvites((prev) => [inv, ...prev]);
  }, []);

  const getStatus = (inv: InviteToken) => {
    if (inv.used) return { label: 'Confirmou', color: 'bg-emerald-100 text-emerald-700' };
    if (inv.sent) return { label: `Enviado ${inv.sent_at ? fmtDate(inv.sent_at) : ''}`, color: 'bg-sky-100 text-sky-700' };
    return { label: 'Aguardando', color: 'bg-stone-100 text-stone-500' };
  };

  return { invites, loading, msg, setMsg, copied, emailSending, handleCopy, handleWhatsApp, handleEmail, handleDelete, handleUpdate, addInvite, getStatus };
}

// Formulário de cadastro — só o form, sem lista
const InviteForm = memo(({ addInvite, msg, setMsg }: {
  addInvite: (inv: InviteToken) => void;
  msg: string;
  setMsg: (m: string) => void;
}) => {
  const [guestName,    setGuestName]    = useState('');
  const [guestsList,   setGuestsList]   = useState<GuestItem[]>([]);
  const [newGuest,     setNewGuest]     = useState('');
  const [newIsChild,   setNewIsChild]   = useState(false);
  const [whatsapp,     setWhatsapp]     = useState('');
  const [email,        setEmail]        = useState('');
  const [creating,     setCreating]     = useState(false);

  const addGuestToList = useCallback((name = newGuest, isChild = newIsChild) => {
    if (!name.trim()) return;
    setGuestsList((prev) => [...prev, { name: name.trim(), is_child: isChild }]);
    setNewGuest(''); setNewIsChild(false);
  }, [newGuest, newIsChild]);

  const removeGuest = useCallback((i: number) => {
    setGuestsList((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const toggleChild = useCallback((i: number) => {
    setGuestsList((prev) => prev.map((g, idx) => idx === i ? { ...g, is_child: !g.is_child } : g));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!guestName.trim()) return;
    // Inclui o campo de texto pendente (placeholder) se houver
    const finalGuests = newGuest.trim()
      ? [...guestsList, { name: newGuest.trim(), is_child: newIsChild }]
      : guestsList;
    setCreating(true); setMsg('');
    try {
      const inv = await createInviteToken({
        guest_name: guestName.trim(),
        guests:     finalGuests.length > 0 ? finalGuests : undefined,
        whatsapp:   whatsapp.trim() || undefined,
        email:      email.trim() || undefined,
      });
      addInvite(inv);
      setGuestName(''); setGuestsList([]); setNewGuest(''); setNewIsChild(false); setWhatsapp(''); setEmail('');
    } catch (e) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }, [guestName, guestsList, newGuest, newIsChild, whatsapp, email, addInvite, setMsg]);

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2">
      <p className={labelCls}>Gerenciar Convites</p>
      <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
        placeholder="Nome da família / grupo (ex: Família Silva) *" className={inputCls} />

      {/* Convidados individuais */}
      <div className="space-y-1.5">
        <span className={labelCls}>Convidados individuais</span>
        {guestsList.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`flex-1 text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2 ${g.is_child ? 'text-stone-400 italic' : ''}`}>
              {g.name}{g.is_child && ' (criança)'}
            </span>
            <button onClick={() => toggleChild(i)} title={g.is_child ? 'Marcar como adulto' : 'Marcar como criança'}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${g.is_child ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500 hover:bg-amber-50'}`}>
              {g.is_child ? 'Criança' : 'Adulto'}
            </button>
            <button onClick={() => removeGuest(i)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={newGuest} onChange={(e) => setNewGuest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGuestToList())}
            placeholder="Nome do convidado..." className={`${inputCls} flex-1`} />
          <button onClick={() => setNewIsChild((v) => !v)} title="Criança?"
            className={`px-2 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-colors ${newIsChild ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500 hover:bg-amber-50'}`}>
            {newIsChild ? 'Criança' : 'Adulto'}
          </button>
          <button onClick={() => addGuestToList()} disabled={!newGuest.trim()}
            className="px-3 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-[#94A684] hover:text-white disabled:opacity-40 transition-all">
            <Plus size={13} />
          </button>
        </div>
        {guestsList.length === 0 && (
          <p className="text-[10px] text-stone-400 italic">Sem convidados: o nome da família será usado como convidado único.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="WhatsApp (ex: 11 99999-9999)" className={inputCls} />
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail" type="email" className={inputCls} />
      </div>
      {msg && <p className="text-xs text-red-500 font-medium">{msg}</p>}
      <button onClick={handleCreate} disabled={creating || !guestName.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#94A684] disabled:opacity-40 transition-all">
        {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
        Adicionar Convite
      </button>
    </div>
  );
});
InviteForm.displayName = 'InviteForm';

// ── RSVP tab ──────────────────────────────────────────────────────────────────

const RsvpTab = memo(({ responses }: { responses: RsvpResponse[] }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'declined' | 'pending'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { invites, msg, setMsg, copied, emailSending, handleCopy, handleWhatsApp, handleEmail, handleDelete, handleUpdate, addInvite } = useInvites();
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editName,     setEditName]     = useState('');
  const [editGuests,   setEditGuests]   = useState<GuestItem[]>([]);
  const [editNewGuest, setEditNewGuest] = useState('');
  const [editWa,       setEditWa]       = useState('');
  const [editEmail,    setEditEmail]    = useState('');
  const [editSaving,   setEditSaving]   = useState(false);

  const startEdit = useCallback((inv: InviteToken) => {
    setEditingToken(inv.token);
    setEditName(inv.guest_name);
    setEditGuests(inv.guests ?? []);
    setEditNewGuest('');
    setEditWa(inv.whatsapp ?? '');
    setEditEmail(inv.email ?? '');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingToken || !editName.trim()) return;
    // Inclui o campo de texto pendente (placeholder) se houver
    const finalGuests = editNewGuest.trim()
      ? [...editGuests, { name: editNewGuest.trim(), is_child: false }]
      : editGuests;
    setEditSaving(true);
    await handleUpdate(editingToken, {
      guest_name: editName.trim(),
      guests:     finalGuests.length > 0 ? finalGuests : undefined,
      whatsapp:   editWa.trim() || undefined,
      email:      editEmail.trim() || undefined,
    });
    setEditSaving(false);
    setEditingToken(null);
  }, [editingToken, editName, editGuests, editNewGuest, editWa, editEmail, handleUpdate]);

  // Edição/exclusão por membro (RSVP individual)
  const [editingRsvpId,   setEditingRsvpId]   = useState<string | null>(null);
  const [editRsvpName,    setEditRsvpName]    = useState('');
  const [editRsvpAtt,     setEditRsvpAtt]     = useState<1 | 0>(1);
  const [editRsvpMsg,     setEditRsvpMsg]     = useState('');
  const [rsvpSaving,      setRsvpSaving]      = useState(false);
  const [localResponses,  setLocalResponses]  = useState<RsvpResponse[]>([]);

  // Sincroniza respostas locais com as vindas do pai
  useEffect(() => { setLocalResponses(responses); }, [responses]);

  const startEditRsvp = useCallback((r: RsvpResponse) => {
    setEditingRsvpId(r.id);
    setEditRsvpName(r.name);
    setEditRsvpAtt(r.attendance ? 1 : 0);
    setEditRsvpMsg(r.message ?? '');
  }, []);

  const saveRsvp = useCallback(async () => {
    if (!editingRsvpId || !editRsvpName.trim()) return;
    setRsvpSaving(true);
    try {
      await updateAdminRsvp(editingRsvpId, { name: editRsvpName.trim(), attendance: editRsvpAtt, message: editRsvpMsg.trim() });
      setLocalResponses((prev) => prev.map((r) =>
        r.id === editingRsvpId ? { ...r, name: editRsvpName.trim(), attendance: !!editRsvpAtt, message: editRsvpMsg.trim() } : r
      ));
      setEditingRsvpId(null);
    } catch { /* silent */ } finally { setRsvpSaving(false); }
  }, [editingRsvpId, editRsvpName, editRsvpAtt, editRsvpMsg]);

  const deleteRsvp = useCallback(async (id: string) => {
    try {
      await deleteAdminRsvp(id);
      setLocalResponses((prev) => prev.filter((r) => r.id !== id));
    } catch { /* silent */ }
  }, []);

  // Agrupa respostas por convite (família ou individual) — usa localResponses para refletir edições
  const groupedByInvite = useMemo(() => {
    const groups: { inv: typeof invites[0]; members: RsvpResponse[] }[] = [];
    const matchedIds = new Set<string>();

    for (const inv of invites) {
      const names = inv.guests && inv.guests.length > 0 ? inv.guests.map((g) => (typeof g === 'string' ? g : g.name)).filter(Boolean) as string[] : [inv.guest_name];
      const members = localResponses.filter((r) =>
        names.some((n) => n.toLowerCase() === r.name.toLowerCase())
      );
      if (members.length > 0) {
        groups.push({ inv, members });
        members.forEach((m) => matchedIds.add(m.id));
      }
    }

    const unmatched = localResponses.filter((r) => !matchedIds.has(r.id));
    return { groups, unmatched };
  }, [invites, localResponses]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    return groupedByInvite.groups
      .map(({ inv, members }) => {
        // Filtra membros pelo filtro de status
        const filteredMembers = filter === 'all' ? members
          : filter === 'confirmed' ? members.filter((m) => m.attendance)
          : filter === 'declined'  ? members.filter((m) => !m.attendance)
          : members; // 'pending' shows all members of pending invites (handled below)

        // Filtra pelo texto de busca: nome da família, nomes dos membros ou mensagem
        const names = inv.guests && inv.guests.length > 0
          ? inv.guests.map((g) => (typeof g === 'string' ? g : g.name)).filter(Boolean) as string[]
          : [inv.guest_name];
        const matchSearch = !q
          || inv.guest_name.toLowerCase().includes(q)
          || names.some((n) => n.toLowerCase().includes(q))
          || members.some((m) => m.name.toLowerCase().includes(q) || (m.message ?? '').toLowerCase().includes(q));

        // Filtro 'pending' não mostra respondidos
        if (filter === 'pending') return null;
        if (!matchSearch || filteredMembers.length === 0) return null;
        return { inv, members: filteredMembers };
      })
      .filter(Boolean) as { inv: InviteToken; members: RsvpResponse[] }[];
  }, [groupedByInvite, search, filter]);

  // Totais — crianças não contam como convidados
  const totalCadastrados = useMemo(() =>
    invites.reduce((sum, i) => {
      if (i.guests && i.guests.length > 0) {
        return sum + i.guests.filter((g) => !g.is_child).length;
      }
      return sum + 1;
    }, 0),
  [invites]);
  const totalConfirmados = useMemo(() => localResponses.filter((r) => r.attendance).length, [localResponses]);
  const totalDeclinados  = useMemo(() => localResponses.filter((r) => !r.attendance).length, [localResponses]);
  const totalPendentes   = useMemo(() =>
    invites.filter((i) => !i.used).reduce((sum, i) => {
      if (i.guests && i.guests.length > 0) return sum + i.guests.filter((g) => !g.is_child).length;
      return sum + 1;
    }, 0),
  [invites]);

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border-l-4 border-[#8FA9B8] shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400">Cadastrados</p>
          <p className="text-xl md:text-3xl font-black text-stone-900 mt-0.5 leading-none">{totalCadastrados}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">{invites.length} convite{invites.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border-l-4 border-[#94A684] shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400">Confirmados</p>
          <p className="text-xl md:text-3xl font-black text-stone-900 mt-0.5 leading-none">{totalConfirmados}</p>
          <p className="text-[10px] text-[#94A684] mt-0.5 font-semibold">
            {totalCadastrados > 0 ? Math.round((totalConfirmados / totalCadastrados) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border-l-4 border-red-300 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400">Declinaram</p>
          <p className="text-xl md:text-3xl font-black text-stone-900 mt-0.5 leading-none">{totalDeclinados}</p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border-l-4 border-amber-300 shadow-sm">
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400">Pendentes</p>
          <p className="text-xl md:text-3xl font-black text-stone-900 mt-0.5 leading-none">{totalPendentes}</p>
          <p className="text-[10px] text-amber-500 mt-0.5 font-semibold">aguardando</p>
        </div>
      </div>

      <InviteForm addInvite={addInvite} msg={msg} setMsg={setMsg} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar convidado…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8FA9B8]/40 focus:border-[#8FA9B8] transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { id: 'all',       label: 'Todos'        },
            { id: 'confirmed', label: '✓ Confirmados' },
            { id: 'declined',  label: '✗ Declinaram'  },
            { id: 'pending',   label: '⏳ Pendentes'   },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                filter === id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Convites aguardando resposta — oculto quando filtro ativo é Confirmados/Declinados */}
      {invites.some((i) => !i.used) && filter !== 'confirmed' && filter !== 'declined' && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-stone-400">Aguardando resposta</p>
          <div className="divide-y divide-stone-50">
            {invites.filter((i) => !i.used && (!search || i.guest_name.toLowerCase().includes(search.toLowerCase()) || (i.guests ?? []).some((g) => (typeof g === 'string' ? g : g.name).toLowerCase().includes(search.toLowerCase())))).map((inv) => (
              <div key={inv.token}>
                {editingToken === inv.token ? (
                  /* Form de edição inline */
                  <div className="px-4 py-3 space-y-2 bg-stone-50">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome da família / grupo *" className={inputCls} />
                    {/* Convidados individuais no edit */}
                    <div className="space-y-1.5">
                      {editGuests.map((g, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`flex-1 text-sm bg-white rounded-lg px-3 py-1.5 ${g.is_child ? 'text-stone-400 italic' : 'text-stone-700'}`}>
                            {g.name}{g.is_child && ' (criança)'}
                          </span>
                          <button type="button" onClick={() => setEditGuests((prev) => prev.map((x, idx) => idx === i ? { ...x, is_child: !x.is_child } : x))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${g.is_child ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500 hover:bg-amber-50'}`}>
                            {g.is_child ? 'Criança' : 'Adulto'}
                          </button>
                          <button type="button" onClick={() => setEditGuests((prev) => prev.filter((_, idx) => idx !== i))}
                            className="w-6 h-6 flex items-center justify-center rounded text-stone-400 hover:text-red-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input value={editNewGuest} onChange={(e) => setEditNewGuest(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && editNewGuest.trim()) { e.preventDefault(); setEditGuests((p) => [...p, { name: editNewGuest.trim(), is_child: false }]); setEditNewGuest(''); } }}
                          placeholder="Adicionar convidado..." className={`${inputCls} flex-1 text-xs`} />
                        <button type="button" onClick={() => { if (editNewGuest.trim()) { setEditGuests((p) => [...p, { name: editNewGuest.trim(), is_child: false }]); setEditNewGuest(''); } }}
                          disabled={!editNewGuest.trim()}
                          className="px-2 py-1.5 bg-stone-200 text-stone-600 rounded-lg text-xs hover:bg-[#94A684] hover:text-white disabled:opacity-40 transition-all">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editWa} onChange={(e) => setEditWa(e.target.value)}
                        placeholder="WhatsApp" className={inputCls} />
                      <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="E-mail" type="email" className={inputCls} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={editSaving || !editName.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#94A684] disabled:opacity-40 transition-all">
                        {editSaving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                        Salvar
                      </button>
                      <button onClick={() => setEditingToken(null)}
                        className="px-3 py-1.5 bg-white text-stone-500 rounded-lg text-xs font-bold border border-stone-200 hover:bg-stone-100 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{inv.guest_name}</p>
                      {inv.guests && inv.guests.length > 0 && (
                        <p className="text-[10px] text-stone-400 mt-0.5">{inv.guests.map((g) => g.name + (g.is_child ? ' ©' : '')).join(' · ')}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {inv.whatsapp && <span className="flex items-center gap-1 text-[10px] text-stone-400"><Phone size={9} />{inv.whatsapp}</span>}
                        {inv.email    && <span className="flex items-center gap-1 text-[10px] text-stone-400"><Mail size={9} />{inv.email}</span>}
                        {inv.sent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">Enviado</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(inv)} title="Editar"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleCopy(inv.invite_url, inv.token)} title="Copiar link"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
                        {copied === inv.token ? <Check size={13} className="text-[#94A684]" /> : <Link size={13} />}
                      </button>
                      {inv.whatsapp && (
                        <button onClick={() => handleWhatsApp(inv)} title="Enviar via WhatsApp"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <Phone size={13} />
                        </button>
                      )}
                      {inv.email && (
                        <button onClick={() => handleEmail(inv)} disabled={emailSending === inv.token} title="Enviar e-mail"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-40">
                          {emailSending === inv.token ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                        </button>
                      )}
                      <DeleteButton onConfirm={() => handleDelete(inv.token)} size="xs" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filter !== 'pending' && <p className={labelCls}>Respostas recebidas</p>}

      {filter !== 'pending' && <div className="space-y-2">
        {filteredGroups.length === 0 && groupedByInvite.unmatched.filter((r) => {
          const q = search.toLowerCase();
          return (!q || r.name.toLowerCase().includes(q) || (r.message ?? '').toLowerCase().includes(q)) &&
            (filter === 'all' || (filter === 'confirmed' && r.attendance) || (filter === 'declined' && !r.attendance));
        }).length === 0 && (
          <p className="text-center text-stone-400 text-sm italic py-8">
            {search || filter !== 'all' ? 'Nenhum resultado para esta busca.' : 'Nenhuma resposta ainda.'}
          </p>
        )}

        {/* Grupos por convite (família ou individual) */}
        {filteredGroups.map(({ inv, members }) => {
          const isFamily   = inv.guests && inv.guests.length > 1;
          const confirmed  = members.filter((m) => m.attendance).length;
          const key        = inv.token;
          const hasMessage = members.some((m) => m.message);

          return (
            <div key={key} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm">
              {/* Header do card */}
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setExpanded(expanded === key ? null : key)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    {isFamily
                      ? members.map((m) => (
                          <div key={m.id} className={`w-2 h-2 rounded-full ${m.attendance ? 'bg-[#94A684]' : 'bg-red-400'}`} />
                        ))
                      : <div className={`w-2.5 h-2.5 rounded-full ${members[0]?.attendance ? 'bg-[#94A684]' : 'bg-red-400'}`} />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">{inv.guest_name}</p>
                    <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      {fmtDate(members[0]?.created_at ?? '')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isFamily ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                      {confirmed}/{members.length} confirmados
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      members[0]?.attendance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {members[0]?.attendance ? 'Confirmado' : 'Declinado'}
                    </span>
                  )}
                  {hasMessage && <MessageSquare size={13} className="text-stone-400 flex-shrink-0" />}
                  <ChevronDown size={13} className={`text-stone-400 transition-transform ${expanded === key ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Detalhes expandidos */}
              <AnimatePresence>
                {expanded === key && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-stone-100"
                  >
                    {/* Membros da família — edit/delete por pessoa */}
                    {members.map((m) => (
                      <div key={m.id} className="border-b border-stone-50 last:border-0">
                        {editingRsvpId === m.id ? (
                          <div className="px-5 py-3 space-y-2 bg-stone-50">
                            <input value={editRsvpName} onChange={(e) => setEditRsvpName(e.target.value)}
                              className={inputCls} placeholder="Nome" />
                            <select value={editRsvpAtt} onChange={(e) => setEditRsvpAtt(Number(e.target.value) as 1 | 0)}
                              className={inputCls}>
                              <option value={1}>Confirmado</option>
                              <option value={0}>Declinado</option>
                            </select>
                            <textarea value={editRsvpMsg} onChange={(e) => setEditRsvpMsg(e.target.value)}
                              rows={2} placeholder="Mensagem (opcional)" className={`${inputCls} resize-none`} />
                            <div className="flex gap-2">
                              <button onClick={saveRsvp} disabled={rsvpSaving || !editRsvpName.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#94A684] disabled:opacity-40 transition-all">
                                {rsvpSaving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                                Salvar
                              </button>
                              <button onClick={() => setEditingRsvpId(null)}
                                className="px-3 py-1.5 bg-white text-stone-500 rounded-lg text-xs font-bold border border-stone-200 hover:bg-stone-100 transition-all">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-5 py-3 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.attendance ? 'bg-[#94A684]' : 'bg-red-400'}`} />
                                <p className="text-sm font-medium text-stone-800">{m.name}</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  m.attendance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                }`}>
                                  {m.attendance ? 'Confirmado' : 'Declinado'}
                                </span>
                              </div>
                              {m.message && (
                                <p className="text-xs text-stone-500 italic mt-1.5 ml-4">"{m.message}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => startEditRsvp(m)} title="Editar"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
                                <Pencil size={12} />
                              </button>
                              <DeleteButton onConfirm={() => deleteRsvp(m.id)} size="xs" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Contato e ações */}
                    <div className="flex items-center gap-3 px-5 py-3 bg-stone-50">
                      <div className="flex-1 flex items-center gap-3 flex-wrap">
                        {inv.whatsapp && <span className="flex items-center gap-1 text-xs text-stone-500"><Phone size={11} />{inv.whatsapp}</span>}
                        {inv.email    && <span className="flex items-center gap-1 text-xs text-stone-500"><Mail size={11} />{inv.email}</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(inv)} title="Editar"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleCopy(inv.invite_url, inv.token)} title="Copiar link"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-colors">
                          {copied === inv.token ? <Check size={12} className="text-[#94A684]" /> : <Link size={12} />}
                        </button>
                        {inv.whatsapp && (
                          <button onClick={() => handleWhatsApp(inv)} title="Reenviar via WhatsApp"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-100 transition-colors">
                            <Phone size={12} />
                          </button>
                        )}
                        {inv.email && (
                          <button onClick={() => handleEmail(inv)} disabled={emailSending === inv.token} title="Reenviar e-mail"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-sky-600 hover:bg-sky-100 transition-colors disabled:opacity-40">
                            {emailSending === inv.token ? <RefreshCw size={12} className="animate-spin" /> : <Mail size={12} />}
                          </button>
                        )}
                        <DeleteButton onConfirm={() => handleDelete(inv.token)} size="xs" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Respostas sem convite vinculado */}
        {groupedByInvite.unmatched.filter((r) => {
          const q = search.toLowerCase();
          return (!q || r.name.toLowerCase().includes(q)) &&
            (filter === 'all' || (filter === 'confirmed' && r.attendance) || (filter === 'declined' && !r.attendance));
        }).map((r) => (
          <div key={r.id} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
              onClick={() => r.message && setExpanded(expanded === r.id ? null : r.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.attendance ? 'bg-[#94A684]' : 'bg-red-400'}`} />
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{r.name}</p>
                  <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />{fmtDate(r.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  r.attendance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {r.attendance ? 'Confirmado' : 'Declinado'}
                </span>
                {r.message && <ChevronDown size={13} className={`text-stone-400 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} />}
              </div>
            </button>
            <AnimatePresence>
              {expanded === r.id && r.message && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-stone-100">
                  <p className="px-5 py-3 text-sm text-stone-600 italic">"{r.message}"</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>}

    </div>
  );
});
RsvpTab.displayName = 'RsvpTab';

// ── Gifts tab ─────────────────────────────────────────────────────────────────

const GiftsTab = memo(({ summaries, contributions }: { summaries: GiftSummary[]; contributions: GiftContribution[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalAll = useMemo(
    () => summaries.reduce((s, g) => s + g.total_amount, 0),
    [summaries]
  );

  const totalNet = useMemo(
    () => contributions.reduce((s, c) => s + netValue(c.amount, c.payment_method), 0),
    [contributions]
  );

  const byGift = useMemo(() => {
    const map = new Map<string, GiftContribution[]>();
    for (const c of contributions) {
      const key = c.gift_item_id ?? '__free__';
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [contributions]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-5 border-l-4 border-[#94A684] shadow-sm">
        <p className={labelCls}>Total arrecadado</p>
        <p className="text-4xl font-black text-stone-900 mt-1">R$ {fmt(totalAll)}</p>
        <p className="text-xs text-[#94A684] font-semibold mt-0.5">R$ {fmt(totalNet)} líquido</p>
        <p className="text-xs text-stone-400 mt-1">{summaries.length} presente{summaries.length !== 1 ? 's' : ''} com contribuições · Pix 1% · Cartão 3,98%</p>
      </div>

      {summaries.map((g) => {
        const rowKey = g.gift_item_id ?? '__free__';
        const items = byGift.get(rowKey) ?? [];
        const isOpen = expanded === rowKey;
        return (
          <div key={rowKey} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : rowKey)}
            >
              <div>
                <p className="font-semibold text-stone-900 text-sm">{g.gift_title}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {g.contribution_count} {g.contribution_count === 1 ? 'contribuição' : 'contribuições'} · média R$ {fmt(g.avg_amount)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-stone-900">R$ {fmt(g.total_amount)}</span>
                <ChevronDown size={13} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-stone-100 divide-y divide-stone-50">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-stone-700">
                            {c.contributor ?? <span className="italic text-stone-400">Anônimo</span>}
                          </p>
                          <p className="text-xs text-stone-400">{fmtDate(c.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#94A684]">R$ {fmt(c.amount)}</p>
                          <p className="text-[10px] text-stone-400" title={c.payment_method === 'pix' ? 'Pix: 1% de taxa' : 'Cartão: 3,98% de taxa'}>
                            liq. R$ {fmt(netValue(c.amount, c.payment_method))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
});
GiftsTab.displayName = 'GiftsTab';

// ── Rifa tab ──────────────────────────────────────────────────────────────────

const EMPTY_PRIZE: Omit<RifaPrize, 'id'> = { title: '', description: '', display_order: 1 };

const RifaTab = memo(({ data, onRefresh }: { data: AdminRifaData; onRefresh: () => Promise<void> }) => {
  const [cfg, setCfg]             = useState<RifaConfig>({ ...data.config });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved]   = useState(false);
  const [cfgMsg, setCfgMsg]       = useState('');

  const prizes = data.prizes;
  const [editId, setEditId]           = useState<string | 'new' | null>(null);
  const [form, setForm]               = useState<Omit<RifaPrize, 'id'>>(EMPTY_PRIZE);
  const [prizeLoading, setPrizeLoading] = useState(false);
  const [prizeMsg, setPrizeMsg]       = useState('');

  const [ticketsOpen, setTicketsOpen] = useState(false);

  const handleSaveConfig = useCallback(async () => {
    setCfgSaving(true); setCfgMsg(''); setCfgSaved(false);
    try {
      await saveRifaConfig(cfg);
      await onRefresh();
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    } catch (e) {
      setCfgMsg((e as Error).message);
    } finally {
      setCfgSaving(false);
    }
  }, [cfg, onRefresh]);

  const openNew = useCallback(() => {
    setForm({ ...EMPTY_PRIZE, display_order: prizes.length + 1 });
    setEditId('new'); setPrizeMsg('');
  }, [prizes.length]);

  const openEdit = useCallback((prize: RifaPrize) => {
    setForm({ title: prize.title, description: prize.description, display_order: prize.display_order });
    setEditId(prize.id); setPrizeMsg('');
  }, []);

  const cancelEdit = useCallback(() => { setEditId(null); setPrizeMsg(''); }, []);

  const handleSavePrize = useCallback(async () => {
    if (!form.title.trim()) { setPrizeMsg('O título é obrigatório.'); return; }
    setPrizeLoading(true); setPrizeMsg('');
    try {
      if (editId === 'new') await addRifaPrize(form);
      else await updateRifaPrize(editId!, form);
      setEditId(null);
      await onRefresh();
    } catch (e) {
      setPrizeMsg((e as Error).message);
    } finally {
      setPrizeLoading(false);
    }
  }, [editId, form, onRefresh]);

  const handleDeletePrize = useCallback(async (id: string) => {
    try { await deleteRifaPrize(id); await onRefresh(); }
    catch (e) { setPrizeMsg((e as Error).message); }
  }, [onRefresh]);

  const { sold, pending, stats } = data.tickets;
  const soldPct = Math.min(100, (stats.sold / Math.max(cfg.total_tickets, 1)) * 100);
  const drawTarget = Math.ceil(cfg.total_tickets * cfg.draw_threshold_pct);
  const totalNet = useMemo(
    () => sold.reduce((acc, t) => acc + netValue(t.amount, t.payment_method), 0),
    [sold],
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Vendidos"    value={stats.sold}      icon={<CheckCircle2 size={26} />} accent="border-[#94A684]" sub={`R$ ${fmt(totalNet)} líquido`} />
        <StatCard label="Reservados"  value={stats.pending}   icon={<Ticket size={26} />}        accent="border-[#D6BC9D]" />
        <StatCard label="Disponíveis" value={stats.available} icon={<Gift size={26} />}           accent="border-[#8FA9B8]" sub={`de ${cfg.total_tickets} total`} />
      </div>

      {/* Progresso */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
        <div className="flex items-center justify-between mb-3">
          <p className={labelCls}>Progresso da venda</p>
          <span className="text-xs font-semibold text-stone-500">
            Meta: {drawTarget} bilhetes ({Math.round(cfg.draw_threshold_pct * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${soldPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-[#94A684] rounded-full"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-stone-400">
          <span>{stats.sold} vendidos · {stats.pending} pendentes</span>
          <span className={soldPct >= cfg.draw_threshold_pct * 100 ? 'text-[#94A684] font-bold' : ''}>
            {soldPct >= cfg.draw_threshold_pct * 100 ? '✓ Meta atingida!' : `${stats.available} restantes`}
          </span>
        </div>
      </div>

      {/* Config */}
      <Section title="Configuração da Rifa" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Valor por bilhete (R$)">
            <input type="number" min="1" step="0.01" value={cfg.ticket_price} className={inputCls}
              onChange={(e) => setCfg((c) => ({ ...c, ticket_price: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="Total de bilhetes">
            <input type="number" min="1" step="1" value={cfg.total_tickets} className={inputCls}
              onChange={(e) => setCfg((c) => ({ ...c, total_tickets: parseInt(e.target.value) || 0 }))} />
          </Field>
          <Field label="% mínimo para sortear" hint="Ex: 95 = sortear quando 95% vendido">
            <input type="number" min="1" max="100" step="1"
              value={Math.round(cfg.draw_threshold_pct * 100)} className={inputCls}
              onChange={(e) => setCfg((c) => ({ ...c, draw_threshold_pct: (parseInt(e.target.value) || 0) / 100 }))} />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SaveBtn saving={cfgSaving} saved={cfgSaved} onSave={handleSaveConfig} label="Salvar configuração" />
          <InlineMsg msg={cfgMsg} />
        </div>
      </Section>

      {/* Prêmios */}
      <Section title="Prêmios" count={prizes.length} defaultOpen>
        {editId === null && (
          <button onClick={openNew}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-stone-200 rounded-xl text-xs font-semibold text-stone-400 hover:border-[#94A684] hover:text-[#94A684] transition-colors">
            <Plus size={14} /> Adicionar prêmio
          </button>
        )}

        <AnimatePresence>
          {editId !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-3">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                  {editId === 'new' ? '+ Novo prêmio' : 'Editar prêmio'}
                </p>
                <div className="grid sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <Field label="Título *">
                      <input value={form.title} className={inputCls} placeholder="Ex: 🥇 Jantar para dois"
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Posição">
                    <input type="number" min="1" value={form.display_order} className={inputCls}
                      onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 1 }))} />
                  </Field>
                </div>
                <Field label="Descrição">
                  <textarea rows={2} value={form.description} className={textareaCls} placeholder="Detalhes do prêmio…"
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </Field>
                {prizeMsg && <InlineMsg msg={prizeMsg} />}
                <div className="flex gap-2">
                  <button onClick={handleSavePrize} disabled={prizeLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#94A684] transition-all disabled:opacity-50">
                    <Save size={12} /> {prizeLoading ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button onClick={cancelEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-stone-200 transition-all">
                    <Ban size={12} /> Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {prizes.length === 0 && editId === null && (
          <p className="text-sm text-stone-400 italic text-center py-3">Nenhum prêmio cadastrado ainda.</p>
        )}
        <div className="space-y-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-stone-100 hover:border-stone-200 bg-white transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-stone-300">{prize.display_order}°</span>
                  <p className="font-semibold text-stone-900 text-sm">{prize.title}</p>
                </div>
                {prize.description && (
                  <p className="text-xs text-stone-400 mt-0.5 ml-5 leading-relaxed">{prize.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(prize)} disabled={editId !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-30"
                  aria-label="Editar">
                  <Pencil size={13} />
                </button>
                <DeleteButton onConfirm={() => handleDeletePrize(prize.id)} disabled={editId !== null} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Bilhetes */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <button onClick={() => setTicketsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors">
          <p className={labelCls}>Bilhetes vendidos e reservados ({sold.length + pending.length})</p>
          <ChevronDown size={14} className={`text-stone-400 transition-transform ${ticketsOpen ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {ticketsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-stone-100 divide-y divide-stone-50">
                {[...sold, ...pending].sort((a, b) => a.ticket_number - b.ticket_number).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-stone-900 w-10 text-center bg-stone-100 rounded-lg py-1 flex-shrink-0">
                        #{t.ticket_number}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{t.buyer_name ?? '—'}</p>
                        <p className="text-xs text-stone-400">{t.buyer_email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.payment_method && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              t.payment_method === 'pix'
                                ? 'bg-[#94A684]/15 text-[#5a7a4e]'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {t.payment_method === 'pix' ? 'Pix' : 'Cartão'}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400">{fmtDate(t.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-stone-700">R$ {fmt(t.amount)}</p>
                        {t.payment_status === 'approved' && (
                          <p className="text-[10px] text-stone-400" title={t.payment_method === 'pix' ? 'Pix: 1% de taxa' : 'Cartão: 3,98% de taxa'}>
                            liq. R$ {fmt(netValue(t.amount, t.payment_method))}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        t.payment_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.payment_status === 'approved' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
                {sold.length === 0 && pending.length === 0 && (
                  <p className="text-sm text-stone-400 italic text-center py-6 px-5">Nenhum bilhete vendido ainda.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
RifaTab.displayName = 'RifaTab';

// ── Site tab ──────────────────────────────────────────────────────────────────

const ROOM_LABELS: Record<string, string> = {
  entrada:    '🚪 Entrada',
  sala:       '🛋️ Sala',
  escritorio: '💻 Escritório',
  varanda:    '🌿 Varanda',
};

const EMPTY_GIFT: Omit<AdminGiftItem, 'id'> = {
  slug: '', title: '', subtitle: '', description: '',
  suggested_amount: null, tag: '', tag_color: 'bg-amber-100 text-amber-700',
  emoji_name: 'gift', display_order: 0, active: true,
};

function useSaveState() {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [msg,    setMsg]    = useState('');

  const run = useCallback(async (fn: () => Promise<void>, successMsg = '') => {
    setSaving(true); setMsg(''); setSaved(false);
    try {
      await fn();
      setSaved(true);
      if (successMsg) setMsg(successMsg);
      setTimeout(() => { setSaved(false); setMsg(''); }, 2500);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, saved, msg, run };
}

const SiteTab = memo(({ data, onRefresh }: { data: AdminSiteData; onRefresh: () => Promise<void> }) => {
  const [couple,  setCouple]  = useState<SiteEditorCouple>({ ...data.couple });
  const [content, setContent] = useState<SiteEditorContent>({ ...data.content });
  const [rooms,   setRooms]   = useState({ ...data.rooms });

  const coupleState  = useSaveState();
  const contentState = useSaveState();
  const roomsState   = useSaveState();

  const gifts = data.gifts;
  const [giftEdit, setGiftEdit] = useState<string | 'new' | null>(null);
  const [giftForm, setGiftForm] = useState<Omit<AdminGiftItem, 'id'>>(EMPTY_GIFT);
  const [giftSaving, setGS]     = useState(false);
  const [giftMsg, setGiftMsg]   = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteError, setDeleteError]   = useState('');

  const updateRoom = useCallback((key: string, field: string, value: string) => {
    setRooms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }, []);

  const openNewGift = useCallback(() => {
    setGiftForm({ ...EMPTY_GIFT, display_order: gifts.filter(g => g.active).length + 1 });
    setGiftEdit('new'); setGiftMsg('');
  }, [gifts]);

  const openEditGift = useCallback((g: AdminGiftItem) => {
    setGiftForm({ slug: g.slug, title: g.title, subtitle: g.subtitle, description: g.description,
                  suggested_amount: g.suggested_amount, tag: g.tag, tag_color: g.tag_color,
                  emoji_name: g.emoji_name, display_order: g.display_order, active: g.active });
    setGiftEdit(g.id); setGiftMsg('');
  }, []);

  const handleSaveGift = useCallback(async () => {
    if (!giftForm.slug || !giftForm.title) { setGiftMsg('Slug e título são obrigatórios.'); return; }
    setGS(true); setGiftMsg('');
    try {
      if (giftEdit === 'new') await addAdminGift(giftForm);
      else await updateAdminGift(giftEdit!, giftForm);
      setGiftEdit(null);
      await onRefresh();
    } catch (e) { setGiftMsg((e as Error).message); }
    finally { setGS(false); }
  }, [giftEdit, giftForm, onRefresh]);

  const handleDeleteGift = useCallback(async (id: string) => {
    setDeleteError('');
    try { await deleteAdminGift(id); await onRefresh(); }
    catch (e) { setDeleteError((e as Error).message); }
  }, [onRefresh]);

  const visibleGifts = useMemo(
    () => showInactive ? gifts : gifts.filter((g) => g.active),
    [gifts, showInactive]
  );

  return (
    <div className="space-y-4">

      {/* ── Casal ── */}
      <Section title="Casal — nomes, data e local" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome de exibição" hint="Aparece no cabeçalho do site">
            <input className={inputCls} placeholder="Álvaro & Larissa" value={couple.display_name}
              onChange={(e) => setCouple((c) => ({ ...c, display_name: e.target.value }))} />
          </Field>
          <Field label="Nome do apartamento" hint="Usado no jogo de exploração">
            <input className={inputCls} placeholder="Álvaro & Larissa" value={couple.home_name}
              onChange={(e) => setCouple((c) => ({ ...c, home_name: e.target.value }))} />
          </Field>
          <Field label="Nome — Parceiro 1">
            <input className={inputCls} value={couple.partner1}
              onChange={(e) => setCouple((c) => ({ ...c, partner1: e.target.value }))} />
          </Field>
          <Field label="Nome — Parceiro 2">
            <input className={inputCls} value={couple.partner2}
              onChange={(e) => setCouple((c) => ({ ...c, partner2: e.target.value }))} />
          </Field>
          <Field label="Data do casamento">
            <input className={inputCls} type="date" value={couple.wedding_date}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_date: e.target.value }))} />
          </Field>
          <Field label="Horário">
            <input className={inputCls} type="time" value={couple.wedding_time}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_time: e.target.value }))} />
          </Field>
          <Field label="Local do casamento">
            <input className={inputCls} value={couple.wedding_location}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_location: e.target.value }))} />
          </Field>
          <Field label="Chave Pix" hint="Email, CPF, telefone ou chave aleatória">
            <input className={inputCls} value={couple.pix_key}
              onChange={(e) => setCouple((c) => ({ ...c, pix_key: e.target.value }))} />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SaveBtn saving={coupleState.saving} saved={coupleState.saved}
            onSave={() => coupleState.run(() => saveAdminCouple(couple).then(() => onRefresh()))} />
          <InlineMsg msg={coupleState.msg} />
        </div>
      </Section>

      {/* ── Conteúdo ── */}
      <Section title="Tela inicial — título e subtítulo">
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          Use <code className="bg-white/60 px-1.5 py-0.5 rounded font-mono">|</code> no título para separar em itálico.
          Exemplo: <em>Um Convite | fora dos Dados.</em>
        </div>
        <Field label="Título da intro">
          <input className={inputCls} value={content.intro_title}
            onChange={(e) => setContent((c) => ({ ...c, intro_title: e.target.value }))} />
        </Field>
        <Field label="Parágrafo de boas-vindas">
          <textarea className={textareaCls} rows={3} value={content.intro_subtitle}
            onChange={(e) => setContent((c) => ({ ...c, intro_subtitle: e.target.value }))} />
        </Field>
        <div className="flex items-center gap-3 pt-1">
          <SaveBtn saving={contentState.saving} saved={contentState.saved}
            onSave={() => contentState.run(() => saveAdminContent(content).then(() => onRefresh()))} />
          <InlineMsg msg={contentState.msg} />
        </div>
      </Section>

      {/* ── Cômodos ── */}
      <Section title="Cômodos — títulos e descrições">
        <div className="space-y-4">
          {Object.entries(ROOM_LABELS).map(([key, label]) => {
            const r = rooms[key] ?? { title: '', desc: '', nextText: '' };
            return (
              <div key={key} className="p-4 rounded-xl border border-stone-100 bg-stone-50 space-y-3">
                <p className="text-xs font-bold text-stone-500">{label}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Título do cômodo">
                    <input className={inputCls} value={r.title}
                      onChange={(e) => updateRoom(key, 'title', e.target.value)} />
                  </Field>
                  {key !== 'varanda' && (
                    <Field label="Botão de avançar">
                      <input className={inputCls} value={r.nextText ?? ''}
                        onChange={(e) => updateRoom(key, 'nextText', e.target.value)} />
                    </Field>
                  )}
                </div>
                <Field label="Descrição / história do cômodo">
                  <textarea className={textareaCls} rows={2} value={r.desc}
                    onChange={(e) => updateRoom(key, 'desc', e.target.value)} />
                </Field>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SaveBtn saving={roomsState.saving} saved={roomsState.saved}
            onSave={() => roomsState.run(() => saveAdminRooms(rooms).then(() => onRefresh()))} />
          <InlineMsg msg={roomsState.msg} />
        </div>
      </Section>

      {/* ── Presentes ── */}
      <Section title="Lista de presentes" count={gifts.filter(g => g.active).length}>
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors">
            {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
          {giftEdit === null && (
            <button onClick={openNewGift}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#94A684] transition-all">
              <Plus size={13} /> Novo presente
            </button>
          )}
        </div>

        {deleteError && <InlineMsg msg={deleteError} />}

        {/* Formulário inline */}
        <AnimatePresence>
          {giftEdit !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="border border-stone-200 rounded-2xl p-5 bg-stone-50 space-y-5">
                <p className="text-xs font-black uppercase tracking-widest text-stone-500">
                  {giftEdit === 'new' ? '+ Novo presente' : '✎ Editar presente'}
                </p>

                {/* Linha 1: Título + Subtítulo */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Título *">
                    <input className={inputCls} value={giftForm.title} placeholder="A Cafeteira Sagrada"
                      onChange={(e) => setGiftForm((f) => ({ ...f, title: e.target.value }))} />
                  </Field>
                  <Field label="Subtítulo">
                    <input className={inputCls} value={giftForm.subtitle} placeholder="O Ritual da Manhã"
                      onChange={(e) => setGiftForm((f) => ({ ...f, subtitle: e.target.value }))} />
                  </Field>
                </div>

                {/* Linha 2: Descrição */}
                <Field label="Descrição">
                  <textarea className={textareaCls} rows={2} value={giftForm.description}
                    placeholder="Nosso dia começa com um café…"
                    onChange={(e) => setGiftForm((f) => ({ ...f, description: e.target.value }))} />
                </Field>

                {/* Linha 3: Valor + Tag */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Valor sugerido (R$)" hint="Deixe vazio para contribuição livre">
                    <input className={inputCls} type="number" min="0" step="1"
                      value={giftForm.suggested_amount ?? ''}
                      placeholder="300"
                      onChange={(e) => setGiftForm((f) => ({ ...f, suggested_amount: e.target.value === '' ? null : parseFloat(e.target.value) }))} />
                  </Field>
                  <Field label="Rótulo da tag">
                    <input className={inputCls} value={giftForm.tag} placeholder="Essencial"
                      onChange={(e) => setGiftForm((f) => ({ ...f, tag: e.target.value }))} />
                  </Field>
                  <Field label="Slug (ID único)" hint="Sem espaços, letras minúsculas">
                    <input className={inputCls} value={giftForm.slug} placeholder="cafeteira"
                      onChange={(e) => setGiftForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))} />
                  </Field>
                </div>

                {/* Seletor de cor */}
                <TagColorPicker value={giftForm.tag_color}
                  onChange={(v) => setGiftForm((f) => ({ ...f, tag_color: v }))} />

                {/* Preview da tag */}
                {giftForm.tag && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-400">Preview:</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${giftForm.tag_color}`}>
                      {giftForm.tag}
                    </span>
                  </div>
                )}

                {/* Seletor de ícone */}
                <IconPicker value={giftForm.emoji_name}
                  onChange={(v) => setGiftForm((f) => ({ ...f, emoji_name: v }))} />

                {/* Metadados */}
                <div className="flex items-center gap-6">
                  <Field label="Ordem de exibição">
                    <input className={`${inputCls} w-24`} type="number" min="1"
                      value={giftForm.display_order}
                      onChange={(e) => setGiftForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                  </Field>
                  <div className="flex items-center gap-2 mt-5">
                    <input id="gift-active" type="checkbox" className="w-4 h-4 rounded accent-stone-900" checked={giftForm.active}
                      onChange={(e) => setGiftForm((f) => ({ ...f, active: e.target.checked }))} />
                    <label htmlFor="gift-active" className="text-sm font-medium text-stone-700">Visível no site</label>
                  </div>
                </div>

                {giftMsg && <InlineMsg msg={giftMsg} />}

                <div className="flex gap-2">
                  <button onClick={handleSaveGift} disabled={giftSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#94A684] transition-all disabled:opacity-50">
                    <Save size={13} /> {giftSaving ? 'Salvando…' : 'Salvar presente'}
                  </button>
                  <button onClick={() => { setGiftEdit(null); setGiftMsg(''); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-stone-200 transition-all">
                    <Ban size={13} /> Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        {visibleGifts.length === 0 && giftEdit === null && (
          <p className="text-sm text-stone-400 italic text-center py-6">Nenhum presente cadastrado.</p>
        )}
        <div className="space-y-2">
          {visibleGifts.map((g) => (
            <div key={g.id} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
              g.active ? 'border-stone-100 bg-white hover:border-stone-200' : 'border-dashed border-stone-200 bg-stone-50 opacity-50'
            }`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-[10px] font-black text-stone-300 w-5 text-center tabular-nums">{g.display_order}</span>
                <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 flex-shrink-0">
                  {ICON_MAP[g.emoji_name] ?? <Gift size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-stone-900 truncate">{g.title}</p>
                    {g.tag && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${g.tag_color}`}>
                        {g.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {g.slug} · {g.suggested_amount != null ? `R$ ${fmt(g.suggested_amount)}` : 'Livre'}
                    {!g.active && ' · inativo'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEditGift(g)} disabled={giftEdit !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-30"
                  aria-label="Editar">
                  <Pencil size={13} />
                </button>
                <DeleteButton onConfirm={() => handleDeleteGift(g.id)} disabled={giftEdit !== null} />
              </div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
});
SiteTab.displayName = 'SiteTab';

// ── AdminPanel (main export) ──────────────────────────────────────────────────

interface AdminPanelProps {
  onClose: () => void;
  onLogout?: () => void;
}

export const AdminPanel = memo(({ onClose, onLogout }: AdminPanelProps) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [rsvp, setRsvp]               = useState<RsvpResponse[]>([]);
  const [summaries, setSummaries]     = useState<GiftSummary[]>([]);
  const [contributions, setContributions] = useState<GiftContribution[]>([]);
  const [rifaData, setRifaData]       = useState<AdminRifaData | null>(null);
  const [siteData, setSiteData]       = useState<AdminSiteData | null>(null);

  const refreshRifa = useCallback(async () => {
    const rifa = await fetchAdminRifa();
    setRifaData(rifa);
  }, []);

  const refreshSite = useCallback(async () => {
    const site = await fetchAdminSite();
    setSiteData(site);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [s, r, gs, gc, rifa, site] = await Promise.all([
        fetchDashboardStats(), fetchRsvpResponses(), fetchGiftSummary(),
        fetchGiftContributions(), fetchAdminRifa(), fetchAdminSite(),
      ]);
      setStats(s); setRsvp(r); setSummaries(gs); setContributions(gc);
      setRifaData(rifa); setSiteData(site);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <TrendingUp size={15} /> },
    { id: 'rsvp',     label: 'Presenças',   icon: <Users size={15} /> },
    { id: 'gifts',    label: 'Presentes',   icon: <Gift size={15} /> },
    { id: 'rifa',     label: 'Rifa',        icon: <Ticket size={15} /> },
    { id: 'site',     label: 'Editar Site', icon: <Settings size={15} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ backgroundColor: '#F2F1EC' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#F2F1EC]/95 backdrop-blur-xl border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#94A684]">Painel Privado</p>
            <h1 className="text-[10px] font-black uppercase tracking-[0.5em] text-stone-900 mt-0.5">Álvaro & Larissa</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} disabled={loading} aria-label="Recarregar"
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-stone-400 hover:text-stone-900 border border-stone-200 shadow-sm transition-colors disabled:opacity-40">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {onLogout && (
              <button onClick={onLogout} aria-label="Sair"
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-stone-400 hover:text-red-500 border border-stone-200 shadow-sm transition-colors">
                <LogOut size={14} />
              </button>
            )}
            <button onClick={onClose} aria-label="Voltar ao site"
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-stone-400 hover:text-stone-900 border border-stone-200 shadow-sm transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs — scroll horizontal em mobile */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <div className="flex gap-1 pb-3 min-w-max sm:min-w-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {t.icon}
                <span className={tab === t.id ? '' : 'hidden sm:inline'}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw size={22} className="animate-spin text-stone-300" />
            <p className="text-sm text-stone-400">Carregando painel…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={22} className="text-red-400" />
            </div>
            <p className="text-sm font-semibold text-red-500 text-center max-w-sm">{loadError}</p>
            <button onClick={load}
              className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#94A684] transition-all">
              Tentar novamente
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'overview' && stats && <OverviewTab stats={stats} onNavigate={setTab} />}
              {tab === 'rsvp'     && <RsvpTab responses={rsvp} />}
              {tab === 'gifts'    && <GiftsTab summaries={summaries} contributions={contributions} />}
              {tab === 'rifa'     && rifaData && <RifaTab data={rifaData} onRefresh={refreshRifa} />}
              {tab === 'site'     && siteData && <SiteTab data={siteData} onRefresh={refreshSite} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
});

AdminPanel.displayName = 'AdminPanel';
