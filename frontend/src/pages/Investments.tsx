import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, Clock, CheckCircle2, X, DollarSign, AlertTriangle, BarChart3, Pause } from 'lucide-react';
import { investmentApi, userApi, type Investment, type InvestmentPlanPublic } from '../lib/api';
import { useSounds } from '../hooks/useSounds';

const colorMap: Record<string, { color: string; border: string; text: string; glow: string }> = {
  blue: { color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]' },
  purple: { color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]' },
  cyan: { color: 'from-[#00d4ff]/20 to-[#00d4ff]/5', border: 'border-[#00d4ff]/20', text: 'text-[#00d4ff]', glow: 'hover:shadow-[0_0_30px_rgba(0,212,255,0.15)]' },
  green: { color: 'from-[#00ff88]/20 to-[#00ff88]/5', border: 'border-[#00ff88]/20', text: 'text-[#00ff88]', glow: 'hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]' },
  orange: { color: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-400', glow: 'hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]' },
  pink: { color: 'from-pink-500/20 to-pink-500/5', border: 'border-pink-500/20', text: 'text-pink-400', glow: 'hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]' },
  red: { color: 'from-[#ff3366]/20 to-[#ff3366]/5', border: 'border-[#ff3366]/20', text: 'text-[#ff3366]', glow: 'hover:shadow-[0_0_30px_rgba(255,51,102,0.15)]' },
  yellow: { color: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/20', text: 'text-yellow-400', glow: 'hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]' },
};

const defaultStyle = colorMap['blue'];

/* ── Purchase Modal ── */
function PurchaseModal({ plans, onClose, onSuccess }: { plans: InvestmentPlanPublic[]; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const { playSuccess, playError: errSound } = useSounds();

  useEffect(() => { userApi.getDashboard().then(d => setBalance(d.balance)).catch(() => {}); }, []);

  const matchedPlan = (() => {
    const a = parseFloat(amount);
    if (isNaN(a)) return null;
    return plans.find(p => a >= p.minAmount && a <= p.maxAmount) ?? null;
  })();

  const handlePurchase = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num < (plans[0]?.minAmount ?? 20)) { setError(`Minimum investment is $${plans[0]?.minAmount ?? 20}`); return; }
    if (num > balance) { setError(`Insufficient balance ($${balance.toFixed(2)})`); return; }
    if (!matchedPlan) { setError('No plan matches this amount'); return; }
    setLoading(true); setError('');
    try {
      const res = await investmentApi.purchase(num);
      if (res.success) { playSuccess(); setDone(true); setTimeout(() => { onSuccess(); onClose(); }, 1500); }
      else { setError(res.message || 'Failed'); errSound(); }
    } catch (e: any) { setError(e.response?.data?.message || 'Failed'); errSound(); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg glass p-6" onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00ff88]/20"><Zap className="w-5 h-5 text-[#00ff88]" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">New Investment</h2>
              <p className="text-xs text-gray-400">Balance: ${balance.toFixed(2)}</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </motion.button>
        </div>
        {done ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10, delay: 0.1 }}>
              <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4" />
            </motion.div>
            <p className="text-xl font-bold text-white">Investment Activated!</p>
            {matchedPlan && <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} — {matchedPlan.name} ({(matchedPlan.dailyRate * 100).toFixed(1)}%/day, {matchedPlan.durationDays}d)</p>}
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {plans.map((p, idx) => {
                const style = colorMap[p.color] || defaultStyle;
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAmount(String(p.minAmount))}
                    className={`p-4 rounded-xl bg-gradient-to-br ${style.color} border ${style.border} text-left transition-all duration-300 ${style.glow}`}
                  >
                    <p className={`text-lg font-bold ${style.text}`}>{(p.dailyRate * 100).toFixed(1)}% daily</p>
                    <p className="text-xs text-gray-400">${p.minAmount.toFixed(0)} — {p.maxAmount >= 999999 ? `$${p.minAmount.toFixed(0)}+` : `$${p.maxAmount.toFixed(0)}`}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{p.name} · {p.durationDays}d</p>
                  </motion.button>
                );
              })}
            </div>
            <div className="relative mb-2">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Investment amount" className="input-premium pl-12 text-lg" min="1" />
            </div>
            <AnimatePresence>
              {matchedPlan && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-sm text-[#00ff88] mb-3">
                  {matchedPlan.name}: {(matchedPlan.dailyRate * 100).toFixed(1)}% daily = ${(parseFloat(amount) * matchedPlan.dailyRate).toFixed(2)}/day · {matchedPlan.durationDays} days
                </motion.p>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[#ff3366] text-sm mb-3">
                  <AlertTriangle className="w-4 h-4" />{error}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handlePurchase} disabled={loading || !amount} className="w-full btn-premium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Zap className="w-5 h-5" />Invest Now</>}
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Investment Progress Ring ── */
function PayoutRing({ remaining, total = 30 }: { remaining: number; total?: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = remaining > total * 0.5 ? '#00ff88' : remaining > total * 0.15 ? '#f59e0b' : remaining > 0 ? '#ff3366' : '#475569';

  return (
    <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <motion.circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{remaining}</span>
    </div>
  );
}

/* ── Skeleton ── */
function InvestmentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div><div className="skeleton w-48 h-8 mb-2" /><div className="skeleton w-32 h-4" /></div>
        <div className="skeleton w-36 h-10 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-44 rounded-2xl" />)}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [plans, setPlans] = useState<InvestmentPlanPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);

  const load = async () => {
    try {
      const [inv, p] = await Promise.all([
        investmentApi.getMyInvestments(),
        investmentApi.getPlans()
      ]);
      setInvestments(Array.isArray(inv) ? inv : []);
      setPlans(Array.isArray(p) ? p : []);
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Listen for SignalR investment updates
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('signalr:investment', handler);
    return () => window.removeEventListener('signalr:investment', handler);
  }, []);

  if (loading) return <InvestmentSkeleton />;

  const activeCount = investments.filter(inv => inv.isActive).length;
  const totalInvested = investments.reduce((s, inv) => s + inv.amount, 0);

  // Determine total payout count per investment by matching to a plan
  const getPlanDuration = (inv: Investment): number => {
    const p = plans.find(pl => inv.dailyRate === pl.dailyRate);
    return p?.durationDays ?? 30;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary-400" />My Investments
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {investments.length} total · {activeCount} active · ${totalInvested.toFixed(0)} invested
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowPurchase(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-semibold hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all duration-300"
        >
          <Zap className="w-4 h-4" />New Investment
        </motion.button>
      </motion.div>

      {/* Plans from DB */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p, idx) => {
            const style = colorMap[p.color] || defaultStyle;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`p-5 rounded-xl bg-gradient-to-br ${style.color} border ${style.border} ${style.glow} transition-all duration-400 cursor-pointer`}
                onClick={() => setShowPurchase(true)}
              >
                <p className={`text-2xl font-bold ${style.text} mb-1`}>{(p.dailyRate * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400">Daily return · {p.durationDays} days</p>
                <p className="text-xs text-gray-500 mt-2">${p.minAmount.toFixed(0)} — {p.maxAmount >= 999999 ? `$${p.minAmount.toFixed(0)}+` : `$${p.maxAmount.toFixed(0)}`}</p>
                <p className="text-[10px] text-gray-600 mt-1">{p.name}{p.description ? ` — ${p.description}` : ''}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Investments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.map((inv, i) => {
          const duration = getPlanDuration(inv);
          return (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              whileHover={inv.isActive ? { y: -3, scale: 1.01 } : {}}
              className={`glow-card p-5 transition-all duration-400 ${inv.isActive ? '' : 'opacity-50'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`text-2xl font-bold font-mono ${inv.isActive ? 'text-[#00ff88]' : 'text-gray-400'}`}>
                    ${inv.amount.toFixed(2)}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">{(inv.dailyRate * 100).toFixed(1)}% daily</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${
                  inv.isActive
                    ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/20'
                    : 'bg-gray-500/15 text-gray-400 border border-gray-500/20'
                }`}>
                  {inv.isActive ? <BarChart3 className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  {inv.isActive ? 'ACTIVE' : 'CLOSED'}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <PayoutRing remaining={inv.remainingPayouts} total={duration} />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-400">Payouts left</span>
                    <span className={`font-medium font-mono ${inv.remainingPayouts > 5 ? 'text-white' : inv.remainingPayouts > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                      {inv.remainingPayouts}/{duration}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(inv.remainingPayouts / duration) * 100}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${inv.remainingPayouts > duration * 0.5 ? 'bg-[#00ff88]' : inv.remainingPayouts > duration * 0.15 ? 'bg-amber-400' : 'bg-[#ff3366]'}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Daily income</span>
                <span className="text-[#00ff88] font-medium font-mono">${(inv.amount * inv.dailyRate).toFixed(2)}</span>
              </div>

              {inv.isActive && (
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  Next payout: {new Date(inv.nextPayoutAt).toLocaleString()}
                </div>
              )}
            </motion.div>
          );
        })}
        {investments.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full text-center py-16"
          >
            <TrendingUp className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-lg text-gray-500 mb-2">No investments yet</p>
            <p className="text-sm text-gray-600">Create your first investment to start earning</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>{showPurchase && <PurchaseModal plans={plans} onClose={() => setShowPurchase(false)} onSuccess={load} />}</AnimatePresence>
    </div>
  );
}
