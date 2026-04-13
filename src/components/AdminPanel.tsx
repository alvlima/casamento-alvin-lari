import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, CheckCircle2, XCircle, Gift, TrendingUp,
  Search, MessageSquare, Calendar, ChevronDown, ChevronUp,
  RefreshCw, LogOut, Ticket, Plus, Pencil, Trash2, Save, Ban,
  Settings, Eye, EyeOff,
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

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

const StatCard = memo(({ label, value, icon, accent, sub }: StatCardProps) => (
  <div className={`bg-white rounded-2xl p-5 border-l-4 ${accent} shadow-sm`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className="text-slate-300">{icon}</div>
    </div>
  </div>
));
StatCard.displayName = 'StatCard';

// ── Overview tab ─────────────────────────────────────────────────────────────

const OverviewTab = memo(({ stats }: { stats: DashboardStats }) => (
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

    {/* Progress bar confirmações */}
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
        Confirmações vs. Total de Respostas
      </p>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(stats.confirmed / Math.max(stats.total_rsvp, 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-[#94A684] rounded-full"
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>{stats.confirmed} confirmados</span>
        <span>{stats.declined} declinaram</span>
      </div>
    </div>
  </div>
));
OverviewTab.displayName = 'OverviewTab';

// ── RSVP tab ──────────────────────────────────────────────────────────────────

const RsvpTab = memo(({ responses }: { responses: RsvpResponse[] }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'declined'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return responses.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'confirmed' && r.attendance) ||
        (filter === 'declined' && !r.attendance);
      return matchSearch && matchFilter;
    });
  }, [responses, search, filter]);

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar convidado..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#94A684] transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'confirmed', 'declined'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'confirmed' ? 'Confirmados' : 'Declinaram'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm italic py-8">Nenhum resultado.</p>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.attendance ? 'bg-[#94A684]' : 'bg-red-400'}`} />
                <div>
                  <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />
                    {fmtDate(r.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  r.attendance ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {r.attendance ? 'Confirmado' : 'Declinado'}
                </span>
                {r.message && (
                  <MessageSquare size={14} className="text-slate-400 flex-shrink-0" />
                )}
                {expanded === r.id ? (
                  <ChevronUp size={14} className="text-slate-400" />
                ) : (
                  <ChevronDown size={14} className="text-slate-400" />
                )}
              </div>
            </button>
            <AnimatePresence>
              {expanded === r.id && r.message && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 text-sm text-slate-600 italic border-t border-slate-100 pt-3">
                    "{r.message}"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
});
RsvpTab.displayName = 'RsvpTab';

// ── Gifts tab ─────────────────────────────────────────────────────────────────

interface GiftsTabProps {
  summaries: GiftSummary[];
  contributions: GiftContribution[];
}

const GiftsTab = memo(({ summaries, contributions }: GiftsTabProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalAll = useMemo(
    () => summaries.reduce((s, g) => s + g.total_amount, 0),
    [summaries]
  );

  const byGift = useMemo(() => {
    const map = new Map<string, GiftContribution[]>();
    for (const c of contributions) {
      const key = c.gift_item_id ?? '__free__';
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, c]);
    }
    return map;
  }, [contributions]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 border-l-4 border-[#94A684] shadow-sm mb-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total arrecadado</p>
        <p className="text-4xl font-black text-slate-900 mt-1">R$ {fmt(totalAll)}</p>
      </div>

      {summaries.map((g) => {
        const rowKey = g.gift_item_id ?? '__free__';
        const items = byGift.get(rowKey) ?? [];
        const isOpen = expanded === rowKey;
        return (
          <div key={rowKey} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : rowKey)}
            >
              <div>
                <p className="font-bold text-slate-900 text-sm">{g.gift_title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {g.contribution_count} {g.contribution_count === 1 ? 'contribuição' : 'contribuições'} · média R$ {fmt(g.avg_amount)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-slate-900">R$ {fmt(g.total_amount)}</span>
                {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
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
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {c.contributor ?? <span className="italic text-slate-400">Anônimo</span>}
                          </p>
                          <p className="text-xs text-slate-400">{fmtDate(c.created_at)}</p>
                        </div>
                        <span className="text-sm font-black text-[#94A684]">R$ {fmt(c.amount)}</span>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-[#94A684] focus:bg-white transition-colors';
const textareaCls = `${inputCls} resize-none`;

function SaveBar({ saving, msg, onSave }: { saving: boolean; msg: string; onSave: () => void }) {
  const ok = msg.toLowerCase().includes('salvo') || msg.toLowerCase().includes('salva');
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
      {msg && <p className={`text-xs font-bold ${ok ? 'text-[#94A684]' : 'text-red-500'}`}>{msg}</p>}
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">{title}</p>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Site tab ───────────────────────────────────────────────────────────────────

const ROOM_LABELS: Record<string, string> = {
  entrada:    'Entrada',
  sala:       'Sala',
  escritorio: 'Escritório',
  varanda:    'Varanda',
};

const EMPTY_GIFT: Omit<AdminGiftItem, 'id'> = {
  slug: '', title: '', subtitle: '', description: '',
  suggested_amount: null, tag: '', tag_color: '', emoji_name: 'gift',
  display_order: 0, active: true,
};

const SiteTab = memo(({ data, onRefresh }: { data: AdminSiteData; onRefresh: () => Promise<void> }) => {
  // ── Casal ──
  const [couple, setCouple]       = useState<SiteEditorCouple>({ ...data.couple });
  const [coupleSaving, setCS]     = useState(false);
  const [coupleMsg,    setCMsg]   = useState('');

  // ── Conteúdo ──
  const [content, setContent]     = useState<SiteEditorContent>({ ...data.content });
  const [contentSaving, setContS] = useState(false);
  const [contentMsg, setContMsg]  = useState('');

  // ── Cômodos ──
  const [rooms, setRooms]         = useState({ ...data.rooms });
  const [roomsSaving, setRS]      = useState(false);
  const [roomsMsg, setRMsg]       = useState('');

  // ── Presentes ──
  const gifts = data.gifts;
  const [giftEdit, setGiftEdit]   = useState<string | 'new' | null>(null);
  const [giftForm, setGiftForm]   = useState<Omit<AdminGiftItem, 'id'>>(EMPTY_GIFT);
  const [giftSaving, setGS]       = useState(false);
  const [giftMsg, setGiftMsg]     = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const save = useCallback(async (
    fn: () => Promise<void>,
    setSaving: (v: boolean) => void,
    setMsg: (v: string) => void,
    successMsg = 'Salvo com sucesso!'
  ) => {
    setSaving(true); setMsg('');
    try {
      await fn();
      await onRefresh();
      setMsg(successMsg);
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [onRefresh]);

  const updateRoom = useCallback((key: string, field: string, value: string) => {
    setRooms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }, []);

  const openNewGift  = useCallback(() => {
    setGiftForm({ ...EMPTY_GIFT, display_order: gifts.length + 1 });
    setGiftEdit('new'); setGiftMsg('');
  }, [gifts.length]);

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
    if (!confirm('Desativar este presente?')) return;
    try { await deleteAdminGift(id); await onRefresh(); }
    catch (e) { alert((e as Error).message); }
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
          <Field label="Nome de exibição (ex: Larissa & Alvaro)">
            <input className={inputCls} value={couple.display_name}
              onChange={(e) => setCouple((c) => ({ ...c, display_name: e.target.value }))} />
          </Field>
          <Field label="Nome do apartamento / lar">
            <input className={inputCls} value={couple.home_name}
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
          <Field label="Data do casamento (YYYY-MM-DD)">
            <input className={inputCls} type="date" value={couple.wedding_date}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_date: e.target.value }))} />
          </Field>
          <Field label="Horário (HH:MM)">
            <input className={inputCls} type="time" value={couple.wedding_time}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_time: e.target.value }))} />
          </Field>
          <Field label="Local do casamento">
            <input className={inputCls} value={couple.wedding_location}
              onChange={(e) => setCouple((c) => ({ ...c, wedding_location: e.target.value }))} />
          </Field>
          <Field label="Chave Pix">
            <input className={inputCls} value={couple.pix_key}
              onChange={(e) => setCouple((c) => ({ ...c, pix_key: e.target.value }))} />
          </Field>
        </div>
        <SaveBar saving={coupleSaving} msg={coupleMsg}
          onSave={() => save(() => saveAdminCouple(couple), setCS, setCMsg)} />
      </Section>

      {/* ── Conteúdo / Intro ── */}
      <Section title="Tela inicial — título e subtítulo">
        <p className="text-xs text-slate-400 -mt-2">Use <code className="bg-slate-100 px-1 rounded">|</code> no título para quebrar em itálico (ex: <code className="bg-slate-100 px-1 rounded">Um Convite | fora dos Dados.</code>)</p>
        <Field label="Título da intro">
          <input className={inputCls} value={content.intro_title}
            onChange={(e) => setContent((c) => ({ ...c, intro_title: e.target.value }))} />
        </Field>
        <Field label="Subtítulo / parágrafo de boas-vindas">
          <textarea className={textareaCls} rows={3} value={content.intro_subtitle}
            onChange={(e) => setContent((c) => ({ ...c, intro_subtitle: e.target.value }))} />
        </Field>
        <SaveBar saving={contentSaving} msg={contentMsg}
          onSave={() => save(() => saveAdminContent(content), setContS, setContMsg)} />
      </Section>

      {/* ── Cômodos ── */}
      <Section title="Cômodos — títulos e descrições">
        <div className="space-y-5">
          {Object.entries(ROOM_LABELS).map(([key, label]) => {
            const r = rooms[key] ?? { title: '', desc: '', nextText: '' };
            return (
              <div key={key} className="p-4 rounded-xl border border-slate-100 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Título">
                    <input className={inputCls} value={r.title}
                      onChange={(e) => updateRoom(key, 'title', e.target.value)} />
                  </Field>
                  {key !== 'varanda' && (
                    <Field label="Texto do botão de avançar">
                      <input className={inputCls} value={r.nextText ?? ''}
                        onChange={(e) => updateRoom(key, 'nextText', e.target.value)} />
                    </Field>
                  )}
                </div>
                <Field label="Descrição">
                  <textarea className={textareaCls} rows={2} value={r.desc}
                    onChange={(e) => updateRoom(key, 'desc', e.target.value)} />
                </Field>
              </div>
            );
          })}
        </div>
        <SaveBar saving={roomsSaving} msg={roomsMsg}
          onSave={() => save(() => saveAdminRooms(rooms), setRS, setRMsg)} />
      </Section>

      {/* ── Presentes ── */}
      <Section title="Lista de presentes">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
          {giftEdit === null && (
            <button onClick={openNewGift}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all">
              <Plus size={13} /> Novo presente
            </button>
          )}
        </div>

        {/* Inline form */}
        <AnimatePresence>
          {giftEdit !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-2">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {giftEdit === 'new' ? 'Novo presente' : 'Editar presente'}
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Slug (único, sem espaços)">
                    <input className={inputCls} value={giftForm.slug}
                      onChange={(e) => setGiftForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))} />
                  </Field>
                  <Field label="Ícone Lucide (emoji_name)">
                    <input className={inputCls} value={giftForm.emoji_name}
                      onChange={(e) => setGiftForm((f) => ({ ...f, emoji_name: e.target.value }))} />
                  </Field>
                  <Field label="Ordem">
                    <input className={inputCls} type="number" min="1" value={giftForm.display_order}
                      onChange={(e) => setGiftForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Título *">
                    <input className={inputCls} value={giftForm.title}
                      onChange={(e) => setGiftForm((f) => ({ ...f, title: e.target.value }))} />
                  </Field>
                  <Field label="Subtítulo">
                    <input className={inputCls} value={giftForm.subtitle}
                      onChange={(e) => setGiftForm((f) => ({ ...f, subtitle: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Descrição">
                  <textarea className={textareaCls} rows={2} value={giftForm.description}
                    onChange={(e) => setGiftForm((f) => ({ ...f, description: e.target.value }))} />
                </Field>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Valor sugerido (R$)">
                    <input className={inputCls} type="number" min="0" step="0.01"
                      value={giftForm.suggested_amount ?? ''}
                      onChange={(e) => setGiftForm((f) => ({ ...f, suggested_amount: e.target.value === '' ? null : parseFloat(e.target.value) }))} />
                  </Field>
                  <Field label="Tag (ex: Missão Urgente)">
                    <input className={inputCls} value={giftForm.tag}
                      onChange={(e) => setGiftForm((f) => ({ ...f, tag: e.target.value }))} />
                  </Field>
                  <Field label="Cor da tag (classes Tailwind)">
                    <input className={inputCls} value={giftForm.tag_color} placeholder="bg-orange-100 text-orange-600"
                      onChange={(e) => setGiftForm((f) => ({ ...f, tag_color: e.target.value }))} />
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <input id="gift-active" type="checkbox" className="rounded" checked={giftForm.active}
                    onChange={(e) => setGiftForm((f) => ({ ...f, active: e.target.checked }))} />
                  <label htmlFor="gift-active" className="text-xs font-bold text-slate-500">Ativo (visível no site)</label>
                </div>
                {giftMsg && <p className="text-xs font-bold text-red-500">{giftMsg}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSaveGift} disabled={giftSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all disabled:opacity-50">
                    <Save size={13} />{giftSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => { setGiftEdit(null); setGiftMsg(''); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                    <Ban size={13} />Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        {visibleGifts.length === 0 && giftEdit === null && (
          <p className="text-sm text-slate-400 italic text-center py-4">Nenhum presente cadastrado.</p>
        )}
        <div className="space-y-2">
          {visibleGifts.map((g) => (
            <div key={g.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${g.active ? 'border-slate-100 hover:border-slate-200' : 'border-dashed border-slate-200 opacity-50'}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-[10px] font-black text-slate-300 w-5 text-center">{g.display_order}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{g.title}</p>
                  <p className="text-xs text-slate-400">{g.slug} · {g.suggested_amount != null ? `R$ ${fmt(g.suggested_amount)}` : 'Livre'}{!g.active && ' · inativo'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEditGift(g)} disabled={giftEdit !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDeleteGift(g.id)} disabled={giftEdit !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
});
SiteTab.displayName = 'SiteTab';

// ── Rifa tab ──────────────────────────────────────────────────────────────────

const EMPTY_PRIZE: Omit<RifaPrize, 'id'> = { title: '', description: '', display_order: 1 };

const RifaTab = memo(({ data, onRefresh }: { data: AdminRifaData; onRefresh: () => Promise<void> }) => {
  // ── Config ──
  const [cfg, setCfg]         = useState<RifaConfig>({ ...data.config });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg]   = useState('');

  // ── Prizes ──
  const prizes = data.prizes;
  const [editId, setEditId]   = useState<string | 'new' | null>(null);
  const [form, setForm]       = useState<Omit<RifaPrize, 'id'>>(EMPTY_PRIZE);
  const [prizeLoading, setPrizeLoading] = useState(false);
  const [prizeMsg, setPrizeMsg] = useState('');

  // ── Tickets ──
  const [ticketsOpen, setTicketsOpen] = useState(false);

  const handleSaveConfig = useCallback(async () => {
    setCfgSaving(true);
    setCfgMsg('');
    try {
      await saveRifaConfig(cfg);
      await onRefresh();
      setCfgMsg('Configuração salva!');
      setTimeout(() => setCfgMsg(''), 2500);
    } catch (e) {
      setCfgMsg((e as Error).message);
    } finally {
      setCfgSaving(false);
    }
  }, [cfg, onRefresh]);

  const openNew = useCallback(() => {
    setForm({ ...EMPTY_PRIZE, display_order: prizes.length + 1 });
    setEditId('new');
    setPrizeMsg('');
  }, [prizes.length]);

  const openEdit = useCallback((prize: RifaPrize) => {
    setForm({ title: prize.title, description: prize.description, display_order: prize.display_order });
    setEditId(prize.id);
    setPrizeMsg('');
  }, []);

  const cancelEdit = useCallback(() => { setEditId(null); setPrizeMsg(''); }, []);

  const handleSavePrize = useCallback(async () => {
    if (!form.title.trim()) { setPrizeMsg('O título é obrigatório.'); return; }
    setPrizeLoading(true);
    setPrizeMsg('');
    try {
      if (editId === 'new') {
        await addRifaPrize(form);
      } else {
        await updateRifaPrize(editId!, form);
      }
      setEditId(null);
      await onRefresh();
    } catch (e) {
      setPrizeMsg((e as Error).message);
    } finally {
      setPrizeLoading(false);
    }
  }, [editId, form, onRefresh]);

  const handleDeletePrize = useCallback(async (id: string) => {
    if (!confirm('Excluir este prêmio?')) return;
    try {
      await deleteRifaPrize(id);
      await onRefresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [onRefresh]);

  const { sold, pending, stats } = data.tickets;
  const drawPct = Math.round(cfg.draw_threshold_pct * 100);

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Vendidos"     value={stats.sold}      icon={<CheckCircle2 size={28} />} accent="border-[#94A684]" sub={`R$ ${fmt(stats.sold * cfg.ticket_price)}`} />
        <StatCard label="Reservados"   value={stats.pending}   icon={<Ticket size={28} />}        accent="border-[#D6BC9D]" />
        <StatCard label="Disponíveis"  value={stats.available} icon={<Gift size={28} />}           accent="border-[#8FA9B8]" sub={`de ${cfg.total_tickets} total`} />
      </div>

      {/* ── Barra de progresso ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progresso da venda</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{drawPct}% para sorteio</p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (stats.sold / Math.max(cfg.total_tickets, 1)) * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-[#94A684] rounded-full"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{stats.sold} vendidos · {stats.pending} pendentes</span>
          <span>Meta: {Math.ceil(cfg.total_tickets * cfg.draw_threshold_pct)} bilhetes</span>
        </div>
      </div>

      {/* ── Configuração ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Configuração da Rifa</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 block mb-1">Valor por bilhete (R$)</span>
            <input
              type="number" min="1" step="0.01"
              value={cfg.ticket_price}
              onChange={(e) => setCfg((c) => ({ ...c, ticket_price: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500 block mb-1">Total de bilhetes</span>
            <input
              type="number" min="1" step="1"
              value={cfg.total_tickets}
              onChange={(e) => setCfg((c) => ({ ...c, total_tickets: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500 block mb-1">% mínimo para sortear</span>
            <input
              type="number" min="1" max="100" step="1"
              value={Math.round(cfg.draw_threshold_pct * 100)}
              onChange={(e) => setCfg((c) => ({ ...c, draw_threshold_pct: (parseInt(e.target.value) || 0) / 100 }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSaveConfig}
            disabled={cfgSaving}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all disabled:opacity-50"
          >
            {cfgSaving ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {cfgMsg && (
            <p className={`text-xs font-bold ${cfgMsg.includes('salva') ? 'text-[#94A684]' : 'text-red-500'}`}>{cfgMsg}</p>
          )}
        </div>
      </div>

      {/* ── Prêmios ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prêmios</p>
          {editId === null && (
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all"
            >
              <Plus size={13} /> Adicionar
            </button>
          )}
        </div>

        {/* Form (inline) */}
        <AnimatePresence>
          {editId !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {editId === 'new' ? 'Novo prêmio' : 'Editar prêmio'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Título *</span>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Ex: 🎁 Kit Churrasco"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">Ordem</span>
                    <input
                      type="number" min="1"
                      value={form.display_order}
                      onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 1 }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">Descrição</span>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Detalhes do prêmio..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#94A684] transition-colors resize-none"
                  />
                </div>
                {prizeMsg && <p className="text-xs font-bold text-red-500">{prizeMsg}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePrize}
                    disabled={prizeLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all disabled:opacity-50"
                  >
                    <Save size={13} /> {prizeLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    <Ban size={13} /> Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {prizes.length === 0 && editId === null && (
          <p className="text-sm text-slate-400 italic text-center py-4">Nenhum prêmio cadastrado.</p>
        )}
        <div className="space-y-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-300 w-4">{prize.display_order}°</span>
                  <p className="font-bold text-slate-900 text-sm">{prize.title}</p>
                </div>
                {prize.description && (
                  <p className="text-xs text-slate-400 mt-0.5 ml-6">{prize.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(prize)}
                  disabled={editId !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDeletePrize(prize.id)}
                  disabled={editId !== null}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bilhetes ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <button
          onClick={() => setTicketsOpen((o) => !o)}
          className="w-full flex items-center justify-between"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Bilhetes vendidos e reservados ({sold.length + pending.length})
          </p>
          {ticketsOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>
        <AnimatePresence>
          {ticketsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2">
                {[...sold, ...pending]
                  .sort((a, b) => a.ticket_number - b.ticket_number)
                  .map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-900 w-10 text-center bg-slate-100 rounded-lg py-0.5">
                          #{t.ticket_number}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t.buyer_name ?? <span className="italic font-normal text-slate-400">—</span>}</p>
                          <p className="text-xs text-slate-400">{t.buyer_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs font-black text-slate-500">R$ {fmt(t.amount)}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          t.payment_status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t.payment_status === 'approved' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                {sold.length === 0 && pending.length === 0 && (
                  <p className="text-sm text-slate-400 italic text-center py-4">Nenhum bilhete vendido ainda.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end">
        <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
          Recarregar dados da rifa
        </button>
      </div>
    </div>
  );
});
RifaTab.displayName = 'RifaTab';

// ── AdminPanel (main export) ──────────────────────────────────────────────────

interface AdminPanelProps {
  onClose: () => void;
  onLogout?: () => void;
}

export const AdminPanel = memo(({ onClose, onLogout }: AdminPanelProps) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rsvp, setRsvp] = useState<RsvpResponse[]>([]);
  const [summaries, setSummaries] = useState<GiftSummary[]>([]);
  const [contributions, setContributions] = useState<GiftContribution[]>([]);
  const [rifaData, setRifaData] = useState<AdminRifaData | null>(null);
  const [siteData, setSiteData] = useState<AdminSiteData | null>(null);

  const refreshRifa = useCallback(async () => {
    const rifa = await fetchAdminRifa();
    setRifaData(rifa);
  }, []);

  const refreshSite = useCallback(async () => {
    const site = await fetchAdminSite();
    setSiteData(site);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [s, r, gs, gc, rifa, site] = await Promise.all([
        fetchDashboardStats(),
        fetchRsvpResponses(),
        fetchGiftSummary(),
        fetchGiftContributions(),
        fetchAdminRifa(),
        fetchAdminSite(),
      ]);
      setStats(s);
      setRsvp(r);
      setSummaries(gs);
      setContributions(gc);
      setRifaData(rifa);
      setSiteData(site);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral',  icon: <TrendingUp size={16} /> },
    { id: 'rsvp',     label: 'Presenças',    icon: <Users size={16} /> },
    { id: 'gifts',    label: 'Presentes',    icon: <Gift size={16} /> },
    { id: 'rifa',     label: 'Rifa',         icon: <Ticket size={16} /> },
    { id: 'site',     label: 'Editar Site',  icon: <Settings size={16} /> },
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
      <div className="sticky top-0 z-10 bg-[#F2F1EC]/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#94A684]">Painel Privado</p>
            <h1 className="text-xl font-serif text-slate-900">Larissa &amp; Alvaro</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 border border-slate-100 transition-colors shadow-sm disabled:opacity-40"
              title="Recarregar"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 border border-slate-100 transition-colors shadow-sm"
                title="Sair"
              >
                <LogOut size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 border border-slate-100 transition-colors shadow-sm"
              title="Voltar ao site"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-5 flex gap-1 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                tab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-5 py-8 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-slate-300" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm font-bold text-red-500 text-center max-w-sm">{loadError}</p>
            <button
              onClick={load}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#94A684] transition-all"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'overview' && stats && <OverviewTab stats={stats} />}
              {tab === 'rsvp' && <RsvpTab responses={rsvp} />}
              {tab === 'gifts' && <GiftsTab summaries={summaries} contributions={contributions} />}
              {tab === 'rifa' && rifaData && <RifaTab data={rifaData} onRefresh={refreshRifa} />}
              {tab === 'site' && siteData && <SiteTab data={siteData} onRefresh={refreshSite} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
});

AdminPanel.displayName = 'AdminPanel';
