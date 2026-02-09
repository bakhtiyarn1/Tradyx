import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, DollarSign, TrendingUp, Zap, Activity, X, ChevronRight, Search,
  BarChart3, Eye, Wallet, Package, Plus, Edit3, Trash2, Save, ToggleLeft, ToggleRight,
  PieChart, ArrowUpRight, ArrowDownRight, Clock, UserPlus, Layers
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts';
import {
  adminApi, type AdminStats, type AdminUser, type UserFullDetails,
  type AdminInvestmentPlan, type AdminAnalytics, type TreasuryHealth
} from '../lib/api';
import { useSounds } from '../hooks/useSounds';
import SlotMachineCounter from '../components/SlotMachineCounter';

type Tab = 'overview' | 'analytics' | 'plans' | 'users' | 'withdrawals';

/* ═══════════════════════════════════════ */
/*  Shared Components                      */
/* ═══════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, delta, prefix = '$', suffix }: {
  icon: any; label: string; value: number; delta?: number; prefix?: string; suffix?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} className="glass-admin p-5 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#00ff88]" />
        </div>
        {delta !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${delta >= 0 ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#ff3366]/10 text-[#ff3366]'}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <SlotMachineCounter value={value} className="text-2xl font-bold text-white" prefix={suffix === 'users' ? '' : prefix} decimals={suffix === 'users' ? 0 : 2} />
        {suffix === 'users' && <span className="text-gray-500 text-sm">users</span>}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════ */
/*  User Detail Modal                      */
/* ═══════════════════════════════════════ */

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [details, setDetails] = useState<UserFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [tab, setTab] = useState<'transactions' | 'investments' | 'referrals'>('transactions');
  const { playCashRegister, playError } = useSounds();

  useEffect(() => { adminApi.getUserDetails(userId).then(d => setDetails(d)).catch(() => { }).finally(() => setLoading(false)); }, [userId]);

  const handleAdjust = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || !adjustReason) return;
    setAdjusting(true);
    try {
      await adminApi.adjustBalance(userId, amt, adjustReason); playCashRegister();
      const d = await adminApi.getUserDetails(userId); setDetails(d); setAdjustAmount(''); setAdjustReason('');
    } catch { playError(); } finally { setAdjusting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="w-full max-w-3xl max-h-[90vh] glass-admin overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <div className="godmode-header p-6 flex items-center justify-between">
          <div className="flex items-center gap-3"><Eye className="w-5 h-5 text-[#ff3366]" /><h2 className="text-lg font-bold text-white">User Details</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {loading ? <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div> : details && (<>
            <div className="grid grid-cols-3 gap-4">
              <div className="glass p-4"><p className="text-xs text-gray-400">Username</p><p className="text-white font-bold">{details.profile.username}</p></div>
              <div className="glass p-4"><p className="text-xs text-gray-400">Email</p><p className="text-white font-medium truncate">{details.profile.email}</p></div>
              <div className="glass p-4"><p className="text-xs text-gray-400">Balance</p><SlotMachineCounter value={details.profile.balance} className="text-xl font-bold text-[#00ff88]" decimals={2} /></div>
            </div>
            <div className="glass p-4 border-l-2 border-[#ff3366]"><h4 className="text-sm font-semibold text-[#ff3366] mb-3 flex items-center gap-2"><Zap className="w-4 h-4" />Adjust Balance</h4>
              <div className="flex gap-2">
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="Amount (neg to deduct)" className="input-premium flex-1 !py-2 text-sm" />
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Reason" className="input-premium flex-1 !py-2 text-sm" />
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAdjust} disabled={adjusting} className="px-4 py-2 rounded-xl bg-[#ff3366] text-white font-semibold text-sm disabled:opacity-50">
                  {adjusting ? '...' : 'Apply'}
                </motion.button>
              </div>
            </div>
            <div className="flex gap-2 border-b border-white/10 pb-1">{(['transactions', 'investments', 'referrals'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm rounded-t-lg transition-all ${tab === t ? 'bg-white/10 text-white font-semibold' : 'text-gray-500 hover:text-gray-300'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}</div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2 max-h-60 overflow-y-auto">
                {tab === 'transactions' && (details.transactions.length === 0 ? <p className="text-gray-500 text-sm p-4">No transactions</p> : details.transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div><p className="text-sm text-white">{t.type}</p><p className="text-xs text-gray-500 truncate max-w-xs">{t.description}</p></div>
                    <div className="text-right"><p className={`text-sm font-mono font-semibold ${t.amount >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>{t.amount >= 0 ? '+' : ''}{t.amount.toFixed(2)}</p><p className="text-[10px] text-gray-600">{new Date(t.createdAt).toLocaleString()}</p></div>
                  </div>
                )))}
                {tab === 'investments' && (details.investments.length === 0 ? <p className="text-gray-500 text-sm p-4">No investments</p> : details.investments.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div><p className="text-sm text-white">${inv.amount.toFixed(2)} @ {(inv.dailyRate * 100).toFixed(1)}%</p><p className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleString()}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded ${inv.isActive ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-gray-500/20 text-gray-400'}`}>{inv.isActive ? 'Active' : 'Closed'}</span>
                  </div>
                )))}
                {tab === 'referrals' && (details.referrals.totalReferrals === 0 ? <p className="text-gray-500 text-sm p-4">No referrals</p> : details.referrals.referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-sm text-white">{r.username}</p><p className="text-xs text-gray-500">{new Date(r.joinedAt).toLocaleString()}</p>
                  </div>
                )))}
              </motion.div>
            </AnimatePresence>
          </>)}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════ */
/*  Plan Editor Modal                      */
/* ═══════════════════════════════════════ */

const PLAN_COLORS = ['blue', 'purple', 'cyan', 'green', 'orange', 'pink', 'red', 'yellow'];
const colorMap: Record<string, string> = {
  blue: '#3b82f6', purple: '#a855f7', cyan: '#00d4ff', green: '#00ff88',
  orange: '#f59e0b', pink: '#ec4899', red: '#ff3366', yellow: '#eab308'
};

function PlanModal({ plan, onClose, onSaved }: { plan?: AdminInvestmentPlan | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !plan;
  const [name, setName] = useState(plan?.name ?? '');
  const [minAmount, setMinAmount] = useState(plan?.minAmount?.toString() ?? '');
  const [maxAmount, setMaxAmount] = useState(plan?.maxAmount?.toString() ?? '');
  const [dailyRate, setDailyRate] = useState(plan ? (plan.dailyRate * 100).toFixed(2) : '');
  const [durationDays, setDurationDays] = useState(plan?.durationDays?.toString() ?? '30');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [color, setColor] = useState(plan?.color ?? 'blue');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { playSuccess, playError: errSound } = useSounds();

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    const min = parseFloat(minAmount), max = parseFloat(maxAmount), rate = parseFloat(dailyRate) / 100, dur = parseInt(durationDays);
    if (isNaN(min) || isNaN(max) || min <= 0 || max <= min) { setError('Invalid amount range'); return; }
    if (isNaN(rate) || rate <= 0 || rate > 0.1) { setError('Rate must be 0.01-10%'); return; }
    if (isNaN(dur) || dur < 1 || dur > 365) { setError('Duration must be 1-365 days'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        await adminApi.createPlan({ name: name.trim(), minAmount: min, maxAmount: max, dailyRate: rate, durationDays: dur, description: description.trim(), color });
      } else {
        await adminApi.updatePlan(plan!.id, { name: name.trim(), minAmount: min, maxAmount: max, dailyRate: rate, durationDays: dur, description: description.trim(), color });
      }
      playSuccess(); onSaved(); onClose();
    } catch { setError('Failed to save'); errSound(); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="w-full max-w-lg glass-admin p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package className="w-5 h-5 text-[#00d4ff]" />{isNew ? 'Create Plan' : 'Edit Plan'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Plan Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium" className="input-premium text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Min Amount ($)</label><input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="20" className="input-premium text-sm" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Max Amount ($)</label><input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="999" className="input-premium text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Daily Rate (%)</label><input type="number" step="0.01" value={dailyRate} onChange={e => setDailyRate(e.target.value)} placeholder="1.4" className="input-premium text-sm" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Duration (days)</label><input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="30" className="input-premium text-sm" /></div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className="input-premium text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">{PLAN_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: colorMap[c] }} />
            ))}</div>
          </div>
          <AnimatePresence>
            {error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="text-[#ff3366] text-sm">{error}</motion.p>}
          </AnimatePresence>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : isNew ? 'Create Plan' : 'Save Changes'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════ */
/*  Analytics Tab                          */
/* ═══════════════════════════════════════ */

function AnalyticsTab({ analytics }: { analytics: AdminAnalytics | null }) {
  if (!analytics) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>;

  const { financial, userGrowth, dailyStats, planDistribution } = analytics;
  const pieData = Object.entries(userGrowth.rankDistribution).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#00ff88'];

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ArrowUpRight} label="Total Deposits" value={financial.totalDeposits} />
        <StatCard icon={ArrowDownRight} label="Total Withdrawals" value={financial.totalWithdrawals} prefix="-$" />
        <StatCard icon={DollarSign} label="Platform Revenue" value={financial.platformRevenue} delta={financial.platformRevenue > 0 ? 5.2 : -2.1} />
        <StatCard icon={Clock} label="Pending Withdrawals" value={financial.pendingWithdrawals} />
      </div>

      {/* User Growth Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={userGrowth.totalUsers} suffix="users" />
        <StatCard icon={Activity} label="Active (7d)" value={userGrowth.activeUsers7d} suffix="users" />
        <StatCard icon={UserPlus} label="New Today" value={userGrowth.newUsersToday} suffix="users" />
        <StatCard icon={UserPlus} label="New This Week" value={userGrowth.newUsersWeek} suffix="users" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#00ff88]" />Daily Deposits vs Withdrawals</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '12px', color: '#e2e8f0' }} />
              <Bar dataKey="deposits" fill="#00ff88" radius={[4, 4, 0, 0]} name="Deposits" />
              <Bar dataKey="withdrawals" fill="#ff3366" radius={[4, 4, 0, 0]} name="Withdrawals" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit + Referral */}
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-[#00d4ff]" />Daily Payouts (Profit + Referral)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyStats}>
              <defs>
                <linearGradient id="profitG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#00d4ff" stopOpacity={0} /></linearGradient>
                <linearGradient id="refG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '12px', color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="profitPaid" stroke="#00d4ff" fill="url(#profitG)" strokeWidth={2} name="Profit" />
              <Area type="monotone" dataKey="referralPaid" stroke="#a855f7" fill="url(#refG)" strokeWidth={2} name="Referral" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* New Users + Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New users line */}
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#f59e0b]" />New User Registrations</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="newUsers" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="New Users" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rank pie */}
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-[#a855f7]" />User Rank Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPie>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px', color: '#e2e8f0' }} />
              </RechartsPie>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm">No data</p>}
        </div>
      </div>

      {/* Plan Distribution */}
      {planDistribution.length > 0 && (
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-[#00ff88]" />Investment Plan Distribution</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {planDistribution.map(p => (
              <div key={p.name} className="glass p-4 border-l-2" style={{ borderColor: colorMap[p.color] || '#3b82f6' }}>
                <p className="text-white font-semibold">{p.name}</p>
                <p className="text-2xl font-bold font-mono mt-1" style={{ color: colorMap[p.color] || '#3b82f6' }}>{p.count}</p>
                <p className="text-xs text-gray-400">active · ${p.totalAmount.toFixed(0)} total</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════ */
/*  Plans Tab                              */
/* ═══════════════════════════════════════ */

function PlansTab({ plans, onReload }: { plans: AdminInvestmentPlan[]; onReload: () => void }) {
  const [editPlan, setEditPlan] = useState<AdminInvestmentPlan | null | undefined>(undefined); // undefined = closed, null = create
  const [deleting, setDeleting] = useState<string | null>(null);
  const { playSuccess, playError } = useSounds();

  const handleToggle = async (plan: AdminInvestmentPlan) => {
    try {
      await adminApi.updatePlan(plan.id, { isActive: !plan.isActive });
      playSuccess(); onReload();
    } catch { playError(); }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Delete this plan? Active investments under it will continue, but new purchases will not match.')) return;
    setDeleting(planId);
    try { await adminApi.deletePlan(planId); playSuccess(); onReload(); }
    catch { playError(); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-[#00d4ff]" />Investment Plans ({plans.length})</h3>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setEditPlan(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00ff88]/20 text-[#00ff88] font-semibold text-sm hover:bg-[#00ff88]/30 transition-colors">
          <Plus className="w-4 h-4" />New Plan
        </motion.button>
      </div>

      <div className="grid gap-4">
        {plans.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`glass-admin p-5 border-l-4 transition-all ${!p.isActive ? 'opacity-50' : ''}`}
            style={{ borderLeftColor: colorMap[p.color] || '#3b82f6' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-white font-bold text-lg">{p.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-[#00ff88]/15 text-[#00ff88]' : 'bg-gray-500/15 text-gray-400'}`}>
                    {p.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-gray-400">Range: <span className="text-white font-mono">${p.minAmount.toFixed(0)} — ${p.maxAmount >= 999999 ? '∞' : '$' + p.maxAmount.toFixed(0)}</span></span>
                  <span className="text-gray-400">Rate: <span className="font-bold font-mono" style={{ color: colorMap[p.color] || '#3b82f6' }}>{(p.dailyRate * 100).toFixed(2)}%</span>/day</span>
                  <span className="text-gray-400">Duration: <span className="text-white font-mono">{p.durationDays}d</span></span>
                  <span className="text-gray-400">Active Investments: <span className="text-[#00d4ff] font-mono">{p.activeInvestments}</span></span>
                  <span className="text-gray-400">Volume: <span className="text-[#00ff88] font-mono">${p.totalInvested.toFixed(0)}</span></span>
                </div>
                {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleToggle(p)} className="p-2 rounded-lg hover:bg-white/10" title={p.isActive ? 'Disable' : 'Enable'}>
                  {p.isActive ? <ToggleRight className="w-5 h-5 text-[#00ff88]" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setEditPlan(p)} className="p-2 rounded-lg hover:bg-white/10">
                  <Edit3 className="w-4 h-4 text-[#00d4ff]" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(p.id)} disabled={deleting === p.id} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30">
                  <Trash2 className="w-4 h-4 text-[#ff3366]" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
        {plans.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No investment plans yet. Create one to get started.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editPlan !== undefined && <PlanModal plan={editPlan} onClose={() => setEditPlan(undefined)} onSaved={onReload} />}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════ */
/*  Main Admin Panel                       */
/* ═══════════════════════════════════════ */

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<AdminInvestmentPlan[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [treasury, setTreasury] = useState<TreasuryHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const { playCyber, playSuccess, playError } = useSounds();

  const loadCore = useCallback(async () => {
    try {
      const [s, u, t] = await Promise.all([adminApi.getStats(), adminApi.getUsers(), adminApi.getTreasury()]);
      setStats(s); setUsers(u); setTreasury(t);
    } catch { } finally { setLoading(false); }
  }, []);

  const loadPlans = useCallback(async () => {
    try { setPlans(await adminApi.getPlans()); } catch { }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics(await adminApi.getAnalytics(14)); } catch { }
  }, []);

  useEffect(() => {
    playCyber(); loadCore(); loadPlans();
    const i = setInterval(loadCore, 30000); return () => clearInterval(i);
  }, [loadCore, loadPlans]);

  useEffect(() => {
    if (tab === 'analytics' && !analytics) loadAnalytics();
  }, [tab, analytics, loadAnalytics]);

  const triggerPayouts = async () => {
    if (payoutLoading) return;
    setPayoutLoading(true);
    try { await adminApi.triggerPayouts(); playSuccess(); loadCore(); }
    catch { playError(); }
    finally { setPayoutLoading(false); }
  };

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-[#ff3366]/20 border-t-[#ff3366] rounded-full animate-spin" /></div>;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'plans', label: 'Plans', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
  ];

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div animate={{ boxShadow: ['0 0 10px rgba(255,51,102,0.3)', '0 0 25px rgba(255,51,102,0.6)', '0 0 10px rgba(255,51,102,0.3)'] }} transition={{ duration: 2, repeat: Infinity }} className="p-2 rounded-xl bg-[#ff3366]/20">
            <Shield className="w-6 h-6 text-[#ff3366]" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-white">God Mode <span className="text-gray-500 text-base font-normal">// Command Center</span></h1>
            <p className="text-xs text-gray-500">Admin Control Panel</p>
          </div>
        </div>
        <motion.button whileHover={{ scale: payoutLoading ? 1 : 1.05 }} whileTap={{ scale: payoutLoading ? 1 : 0.95 }} onClick={triggerPayouts} disabled={payoutLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff3366] to-pink-600 text-white font-semibold text-sm hover:shadow-[0_0_25px_rgba(255,51,102,0.4)] disabled:opacity-50 disabled:cursor-not-allowed">
          {payoutLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
          {payoutLoading ? 'Processing...' : 'Trigger Payouts'}
        </motion.button>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 glass-admin rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          {/* ===== OVERVIEW TAB ===== */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total Users" value={stats?.totalUsers || 0} suffix="users" />
                <StatCard icon={DollarSign} label="Total Invested" value={stats?.totalInvested || 0} delta={4.2} />
                <StatCard icon={TrendingUp} label="Profit Paid" value={stats?.totalProfitPaid || 0} delta={8.5} />
                <StatCard icon={Wallet} label="System Reserve" value={stats?.systemReserve || 0} />
              </div>

              {/* Treasury Health Panel */}
              {treasury && (
                <div className={`glass-admin p-6 border-l-4 ${
                  treasury.zone === 'green' ? 'border-l-[#00ff88]'
                  : treasury.zone === 'yellow' ? 'border-l-amber-400'
                  : 'border-l-[#ff3366]'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-[#00d4ff]" />Treasury Health
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      treasury.zone === 'green' ? 'bg-[#00ff88]/15 text-[#00ff88]'
                      : treasury.zone === 'yellow' ? 'bg-amber-400/15 text-amber-400'
                      : 'bg-[#ff3366]/15 text-[#ff3366]'
                    }`}>
                      {treasury.zone} zone
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="glass p-3">
                      <p className="text-xs text-gray-500 mb-1">Health Ratio</p>
                      <p className={`text-lg font-bold font-mono ${
                        treasury.healthRatio >= 0.5 ? 'text-[#00ff88]' : treasury.healthRatio >= 0.25 ? 'text-amber-400' : 'text-[#ff3366]'
                      }`}>
                        {(treasury.healthRatio * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="glass p-3">
                      <p className="text-xs text-gray-500 mb-1">Insurance Fund</p>
                      <p className="text-lg font-bold font-mono text-[#00d4ff]">${treasury.insuranceFund.toFixed(2)}</p>
                    </div>
                    <div className="glass p-3">
                      <p className="text-xs text-gray-500 mb-1">Rate Multiplier</p>
                      <p className={`text-lg font-bold font-mono ${treasury.rateMultiplier < 1 ? 'text-amber-400' : 'text-white'}`}>
                        ×{treasury.rateMultiplier.toFixed(2)}
                      </p>
                    </div>
                    <div className="glass p-3">
                      <p className="text-xs text-gray-500 mb-1">Runway</p>
                      <p className={`text-lg font-bold font-mono ${
                        treasury.estimatedRunwayDays > 90 ? 'text-[#00ff88]' : treasury.estimatedRunwayDays > 30 ? 'text-amber-400' : 'text-[#ff3366]'
                      }`}>
                        {treasury.estimatedRunwayDays > 365 ? '365+' : treasury.estimatedRunwayDays}d
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">Withdrawn today: <span className="text-white font-mono">${treasury.withdrawnToday.toFixed(2)}</span></span>
                      <span className="text-gray-500">Daily limit: <span className="text-white font-mono">${treasury.dailyWithdrawalLimit.toFixed(2)}</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">Total deposits: <span className="text-[#00ff88] font-mono">${treasury.totalDeposits.toFixed(2)}</span></span>
                      <span className="text-gray-500">Total payouts: <span className="text-[#ff3366] font-mono">${treasury.totalPayouts.toFixed(2)}</span></span>
                    </div>
                  </div>

                  {/* Health bar */}
                  <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, treasury.healthRatio * 100)}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${
                        treasury.zone === 'green' ? 'bg-gradient-to-r from-[#00ff88] to-primary-500'
                        : treasury.zone === 'yellow' ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                        : 'bg-gradient-to-r from-[#ff3366] to-red-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Quick Plan Summary */}
              {plans.length > 0 && (
                <div className="glass-admin p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-[#00d4ff]" />Investment Plans</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.filter(p => p.isActive).map(p => (
                      <div key={p.id} className="glass p-4 border-l-2 cursor-pointer hover:bg-white/[0.03] transition-colors" style={{ borderLeftColor: colorMap[p.color] || '#3b82f6' }} onClick={() => setTab('plans')}>
                        <p className="text-white font-semibold">{p.name}</p>
                        <p className="text-lg font-bold font-mono mt-1" style={{ color: colorMap[p.color] || '#3b82f6' }}>{(p.dailyRate * 100).toFixed(1)}%<span className="text-xs text-gray-500 font-normal">/day</span></p>
                        <p className="text-xs text-gray-500">${p.minAmount.toFixed(0)} — {p.maxAmount >= 999999 ? '∞' : '$' + p.maxAmount.toFixed(0)} · {p.durationDays}d</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== ANALYTICS TAB ===== */}
          {tab === 'analytics' && <AnalyticsTab analytics={analytics} />}

          {/* ===== PLANS TAB ===== */}
          {tab === 'plans' && <PlansTab plans={plans} onReload={loadPlans} />}

          {/* ===== USERS TAB ===== */}
          {tab === 'users' && (
            <div className="glass-admin p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-[#00d4ff]" />Users ({users.length})</h3>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-premium !py-2 !pl-9 !pr-4 w-52 text-sm" /></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs border-b border-white/5"><th className="pb-3 text-left font-medium">User</th><th className="pb-3 text-right font-medium">Balance</th><th className="pb-3 text-right font-medium">Invested</th><th className="pb-3 text-right font-medium">Earned</th><th className="pb-3 text-right font-medium">Refs</th><th className="pb-3 text-right font-medium"></th></tr></thead>
                  <tbody>{filtered.map((u, i) => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-primary-600 flex items-center justify-center text-white font-bold text-xs">{u.username[0].toUpperCase()}</div><div><p className="text-white font-medium">{u.username}</p><p className="text-xs text-gray-500">{u.email}</p></div></div></td>
                      <td className="py-3 text-right font-mono text-white">${u.balance.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-[#00d4ff]">${u.totalInvested.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-[#00ff88]">${u.totalEarned.toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-400">{u.referralsCount}</td>
                      <td className="py-3 text-right"><motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSelectedUser(u.id)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4 text-gray-500" /></motion.button></td>
                    </motion.tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== WITHDRAWALS TAB ===== */}
          {tab === 'withdrawals' && <WithdrawalsTab />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>{selectedUser && <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />}</AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════ */
/*  Withdrawals Tab                        */
/* ═══════════════════════════════════════ */

function WithdrawalsTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { playSuccess, playError } = useSounds();

  const load = useCallback(async () => {
    try { setPending(await adminApi.getPendingWithdrawals()); } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setProcessing(id);
    try { await adminApi.approveWithdrawal(id); playSuccess(); load(); }
    catch { playError(); }
    finally { setProcessing(null); }
  };

  const reject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    setProcessing(id);
    try { await adminApi.rejectWithdrawal(id, reason ?? undefined); playSuccess(); load(); }
    catch { playError(); }
    finally { setProcessing(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-[#ff3366]/30 border-t-[#ff3366] rounded-full animate-spin" /></div>;

  return (
    <div className="glass-admin p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Wallet className="w-5 h-5 text-[#f59e0b]" />Pending Withdrawals ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No pending withdrawals</p>
      ) : (
        <div className="space-y-3">
          {pending.map(w => (
            <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div>
                <p className="text-white font-medium">{w.username} <span className="text-gray-500 text-xs">{w.email}</span></p>
                <div className="flex gap-3 text-xs text-gray-400 mt-1">
                  <span className="text-[#ff3366] font-mono font-bold text-sm">${w.amount.toFixed(2)}</span>
                  {w.feeAmount > 0 && <span>Fee: ${w.feeAmount.toFixed(2)}</span>}
                  {w.isInstant && <span className="text-amber-400">⚡ Instant</span>}
                  <span>{new Date(w.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => approve(w.id)} disabled={processing === w.id} className="px-3 py-1.5 rounded-lg bg-[#00ff88]/20 text-[#00ff88] text-sm font-semibold disabled:opacity-50">Approve</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => reject(w.id)} disabled={processing === w.id} className="px-3 py-1.5 rounded-lg bg-[#ff3366]/20 text-[#ff3366] text-sm font-semibold disabled:opacity-50">Reject</motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
