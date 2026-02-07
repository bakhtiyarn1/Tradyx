import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, Users, Clock, ArrowUpRight, Zap, Target, Sparkles, Shield, Activity, X, DollarSign, CheckCircle2, Crown, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { userApi } from '../lib/api';
import type { Dashboard as DashboardData, RankProgress } from '../lib/api';
import { useAuth } from '../lib/auth';
import SlotMachineCounter from '../components/SlotMachineCounter';
import Sparkline from '../components/Sparkline';
import LiveTradingFeed from '../components/LiveTradingFeed';
import { useSounds } from '../hooks/useSounds';
import { useToast } from '../lib/toast';

const genSparkline = (trend: 'up' | 'down' | 'neutral' = 'up') => { let v = 50; return Array.from({ length: 20 }, () => { v = Math.max(10, Math.min(90, v + (Math.random() - (trend === 'up' ? 0.4 : trend === 'down' ? 0.6 : 0.5)) * 10)); return v; }); };

// === RANK CONFIG ===
const RANK_CONFIG: Record<string, { color: string; gradient: string; icon: string; glow: string }> = {
  Bronze:   { color: 'text-amber-600',    gradient: 'from-amber-700 to-amber-900',    icon: '🥉', glow: 'shadow-amber-700/20' },
  Silver:   { color: 'text-gray-300',      gradient: 'from-gray-300 to-gray-500',      icon: '🥈', glow: 'shadow-gray-400/20' },
  Gold:     { color: 'text-yellow-400',    gradient: 'from-yellow-400 to-amber-500',    icon: '🏆', glow: 'shadow-yellow-400/30' },
  Platinum: { color: 'text-cyan-300',      gradient: 'from-cyan-300 to-blue-500',       icon: '💎', glow: 'shadow-cyan-400/40' },
};

function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = RANK_CONFIG[rank] || RANK_CONFIG.Bronze;
  const sizeClasses = { sm: 'text-xs px-2 py-0.5 gap-1', md: 'text-sm px-3 py-1 gap-1.5', lg: 'text-base px-4 py-1.5 gap-2' };
  return (
    <span className={`inline-flex items-center font-bold rounded-full bg-gradient-to-r ${cfg.gradient} bg-opacity-20 ${cfg.color} ${sizeClasses[size]} shadow-lg ${cfg.glow}`}>
      <span>{cfg.icon}</span>
      <span>{rank}</span>
    </span>
  );
}

function RankProgressBar({ rankProgress }: { rankProgress: RankProgress }) {
  const progress = rankProgress.progress ?? 1;
  const pct = Math.round(progress * 100);
  const cfg = RANK_CONFIG[rankProgress.currentRankName] || RANK_CONFIG.Bronze;
  const nextCfg = rankProgress.nextRankName ? (RANK_CONFIG[rankProgress.nextRankName] || RANK_CONFIG.Silver) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className={`w-5 h-5 ${cfg.color}`} />
          <span className="font-semibold text-white text-sm">Rank Progress</span>
        </div>
        <RankBadge rank={rankProgress.currentRankName} size="sm" />
      </div>

      {rankProgress.nextRankName ? (
        <>
          <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${nextCfg?.gradient || cfg.gradient}`}
            />
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)', animation: 'shimmer 2s infinite' }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{pct}% to {rankProgress.nextRankName}</span>
            <span className="flex items-center gap-1">
              {rankProgress.nextRankName && <span className="text-gray-500">{RANK_CONFIG[rankProgress.nextRankName]?.icon}</span>}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/5">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Personal invest</p>
              <p className="text-sm font-bold text-white">${rankProgress.personalTurnover.toFixed(0)}</p>
              {rankProgress.personalNeeded != null && rankProgress.personalNeeded > 0 && (
                <p className="text-[10px] text-gray-500">${rankProgress.personalNeeded.toFixed(0)} needed</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Team turnover</p>
              <p className="text-sm font-bold text-white">${rankProgress.teamTurnover.toFixed(0)}</p>
              {rankProgress.teamNeeded != null && rankProgress.teamNeeded > 0 && (
                <p className="text-[10px] text-gray-500">${rankProgress.teamNeeded.toFixed(0)} needed</p>
              )}
            </div>
          </div>
          {rankProgress.cashbackRate > 0 && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400 font-medium">💎 Cashback: {(rankProgress.cashbackRate * 100).toFixed(0)}% on investments</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-3">
          <p className="text-sm text-gray-400">Maximum rank achieved!</p>
          {rankProgress.cashbackRate > 0 && (
            <p className="text-xs text-yellow-400 mt-1">💎 Cashback: {(rankProgress.cashbackRate * 100).toFixed(0)}% on investments</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Rank-up celebration modal
function RankUpModal({ rankName, onClose }: { rankName: string; onClose: () => void }) {
  const cfg = RANK_CONFIG[rankName] || RANK_CONFIG.Bronze;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="relative w-full max-w-sm glass p-8 text-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Celebration particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: '100%', x: `${Math.random() * 100}%`, opacity: 1 }}
              animate={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, repeat: Infinity }}
              className="absolute w-2 h-2 rounded-full"
              style={{ background: `hsl(${Math.random() * 360}, 80%, 60%)` }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 10 }}
          className="text-7xl mb-4"
        >
          {cfg.icon}
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="text-2xl font-bold text-white mb-2">Congratulations!</h2>
          <p className="text-gray-400 mb-4">Your rank has been upgraded to</p>
          <div className="inline-block mb-6">
            <RankBadge rank={rankName} size="lg" />
          </div>
          <p className="text-sm text-gray-500 mb-6">Your referral bonuses are now higher!</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`px-8 py-3 rounded-xl font-bold text-black bg-gradient-to-r ${cfg.gradient} shadow-xl ${cfg.glow}`}
          >
            Awesome!
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function MarketPairs() {
  const [pairs, setPairs] = useState([
    { symbol: 'BTC', name: 'Bitcoin', price: 67432.50, change: 2.45, data: genSparkline('up') },
    { symbol: 'ETH', name: 'Ethereum', price: 3521.80, change: 1.82, data: genSparkline('up') },
    { symbol: 'SOL', name: 'Solana', price: 142.65, change: -0.54, data: genSparkline('down') },
    { symbol: 'BNB', name: 'Binance', price: 612.30, change: 0.93, data: genSparkline('neutral') },
  ]);
  useEffect(() => { const i = setInterval(() => setPairs(p => p.map(pr => ({ ...pr, price: pr.price + (Math.random() - 0.5) * pr.price * 0.002, change: Math.max(-5, Math.min(5, pr.change + (Math.random() - 0.5) * 0.3)), data: [...pr.data.slice(1), pr.data[pr.data.length - 1] + (Math.random() - 0.5) * 5] }))), 3000); return () => clearInterval(i); }, []);

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-primary-400" />Market Overview</h3><span className="status-online"><span>Live</span></span></div>
      <div className="space-y-4">{pairs.map((p, i) => (
        <motion.div key={p.symbol} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group">
          <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${p.change >= 0 ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#ff3366]/10 text-[#ff3366]'}`}>{p.symbol.slice(0, 2)}</div><div><p className="font-medium text-white group-hover:text-primary-400 transition-colors">{p.symbol}/USDT</p><p className="text-xs text-gray-500">{p.name}</p></div></div>
          <div className="flex items-center gap-4"><Sparkline data={p.data} width={60} height={24} color={p.change >= 0 ? '#00ff88' : '#ff3366'} showGradient={false} /><div className="text-right min-w-[100px]"><p className="font-mono font-medium text-white">${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className={`text-xs font-medium flex items-center justify-end gap-1 ${p.change >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>{Math.abs(p.change).toFixed(2)}%</p></div></div>
        </motion.div>
      ))}</div>
    </div>
  );
}

function GlowStatCard({ icon: Icon, label, value, subValue, color = 'emerald', delay = 0 }: { icon: any; label: string; value: string; subValue?: string; color?: 'emerald' | 'blue' | 'purple' | 'amber'; delay?: number }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    emerald: { bg: 'from-[#00ff88]/20 to-[#00ff88]/5', border: 'border-[#00ff88]/20', text: 'text-[#00ff88]' },
    blue: { bg: 'from-[#00d4ff]/20 to-[#00d4ff]/5', border: 'border-[#00d4ff]/20', text: 'text-[#00d4ff]' },
    purple: { bg: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400' },
    amber: { bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400' },
  };
  const c = colors[color];
  return (
    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.5 }} whileHover={{ scale: 1.02, y: -2 }} className={`glow-card p-5 bg-gradient-to-br ${c.bg} ${c.border} transition-all duration-300`}>
      <div className="relative z-10"><div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.bg} flex items-center justify-center mb-4`}><Icon className={`w-5 h-5 ${c.text}`} /></div><p className="text-gray-400 text-sm mb-1">{label}</p><p className="text-2xl font-bold text-white">{value}</p>{subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}</div>
    </motion.div>
  );
}

function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { playCashRegister } = useSounds();
  const presets = [50, 100, 250, 500, 1000];

  const handleDeposit = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      await userApi.deposit(num);
      playCashRegister();
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Deposit failed');
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25 }} className="relative w-full max-w-md glass p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-[#00ff88]/20"><DollarSign className="w-5 h-5 text-[#00ff88]" /></div><h2 className="text-lg font-bold text-white">Deposit Funds</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {done ? (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4" />
            <p className="text-xl font-bold text-white">Deposit Successful!</p>
            <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} added to your balance</p>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map(p => (
                <button key={p} onClick={() => setAmount(String(p))} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${amount === String(p) ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
                  ${p}
                </button>
              ))}
            </div>
            <div className="relative mb-4">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
                className="input-premium pl-12 text-lg" min="1" step="any" />
            </div>
            {error && <p className="text-[#ff3366] text-sm mb-4">{error}</p>}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDeposit} disabled={loading || !amount}
              className="w-full btn-premium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><DollarSign className="w-5 h-5" />Deposit</>}
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-4">Funds are credited instantly</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [animBalance, setAnimBalance] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [rankUpName, setRankUpName] = useState<string | null>(null);
  const { playCashRegister } = useSounds();
  const prevBal = useRef<number>(0);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await userApi.getDashboard();
      setDashboard(d);
    } catch {} finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const i = setInterval(loadDashboard, 60000);
    return () => clearInterval(i);
  }, [loadDashboard]);

  // SignalR: instant balance + dashboard refresh + rank upgrade
  useEffect(() => {
    const handleBalance = (e: Event) => {
      const newBalance = (e as CustomEvent).detail as number;
      setDashboard(prev => prev ? { ...prev, balance: newBalance } : prev);
    };
    const handleDashboardRefresh = () => loadDashboard();
    const handleRankUp = (e: Event) => {
      const { newRankName } = (e as CustomEvent).detail;
      setRankUpName(newRankName);
      toast.success(`🏆 Rank upgraded to ${newRankName}!`);
      loadDashboard();
    };

    window.addEventListener('signalr:balance', handleBalance);
    window.addEventListener('signalr:dashboard-refresh', handleDashboardRefresh);
    window.addEventListener('signalr:rank-upgraded', handleRankUp);
    return () => {
      window.removeEventListener('signalr:balance', handleBalance);
      window.removeEventListener('signalr:dashboard-refresh', handleDashboardRefresh);
      window.removeEventListener('signalr:rank-upgraded', handleRankUp);
    };
  }, [loadDashboard, toast]);

  useEffect(() => {
    if (dashboard?.balance && prevBal.current > 0 && dashboard.balance > prevBal.current) playCashRegister();
    if (dashboard?.balance) prevBal.current = dashboard.balance;
  }, [dashboard?.balance]);

  useEffect(() => {
    if (!dashboard?.balance) return;
    setAnimBalance(dashboard.balance);
    const rate = dashboard.activeInvestmentsAmount ? 0.012 : 0;
    const inc = (dashboard.balance * rate) / 86400 / 5;
    if (inc > 0) { const i = setInterval(() => setAnimBalance(p => p + inc), 200); return () => clearInterval(i); }
  }, [dashboard?.balance, dashboard?.activeInvestmentsAmount]);

  const fmtPayout = (d: string | null) => { if (!d) return '--:--'; const diff = new Date(d).getTime() - Date.now(); if (diff <= 0) return 'Now'; return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`; };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" /></div>;

  const rp = dashboard?.rankProgress;

  return (
    <div className="space-y-6 relative">
      <div className="bg-animated" />
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 flex-wrap">
            Welcome, <span className="gradient-text">{user?.username}</span>
            {rp && <RankBadge rank={rp.currentRankName} size="sm" />}
          </h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2"><Shield className="w-4 h-4 text-primary-400" />Your portfolio is protected by AI</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowDeposit(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-semibold hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] transition-all">
            <DollarSign className="w-4 h-4" /> Deposit
          </motion.button>
          <div className="status-online"><span>AI Engine Online</span></div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
          <div className="glow-card p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30"><div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }} /></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8"><div className="w-14 h-14 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"><Wallet className="w-7 h-7 text-white" /></div><div><p className="text-gray-400">Total Portfolio Value</p><span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] font-medium">+{(dashboard?.balance && dashboard.balance > 0 ? ((dashboard?.todayProfit || 0) / dashboard.balance * 100) : 0).toFixed(2)}% today</span></div></div>
              <div className="mb-8"><SlotMachineCounter value={animBalance} className="text-5xl md:text-6xl font-bold text-white" decimals={2} /></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/10">
                <div><p className="text-gray-500 text-xs mb-1">Active Investments</p><p className="text-xl font-bold text-white font-mono">${dashboard?.activeInvestmentsAmount?.toFixed(2) || '0.00'}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Total Earned</p><p className="text-xl font-bold text-[#00ff88] font-mono">+${dashboard?.totalEarned?.toFixed(2) || '0.00'}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Today's Profit</p><p className="text-xl font-bold text-[#00ff88] font-mono">+${dashboard?.todayProfit?.toFixed(2) || '0.00'}</p></div>
                <div><p className="text-gray-500 text-xs mb-1">Next Payout</p><p className="text-xl font-bold text-white font-mono flex items-center gap-2"><Clock className="w-4 h-4 text-primary-400" />{fmtPayout(dashboard?.nextPayoutAt || null)}</p></div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right column: Rank Progress + Live Trading */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
          {rp && <RankProgressBar rankProgress={rp} />}
          <LiveTradingFeed />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlowStatCard icon={Target} label="Active Deposits" value={`$${dashboard?.activeInvestmentsAmount?.toFixed(2) || '0.00'}`} subValue="Working 24/7" color="emerald" delay={0.3} />
        <GlowStatCard icon={TrendingUp} label="Today's Earnings" value={`+$${((dashboard?.todayProfit || 0) + (dashboard?.todayReferralBonus || 0)).toFixed(2)}`} subValue="Profit + Referral" color="blue" delay={0.4} />
        <GlowStatCard icon={Users} label="Your Referrals" value={dashboard?.referralsCount?.toString() || '0'} subValue={rp ? `${rp.currentRankName} bonuses active` : '10% passive income'} color="purple" delay={0.5} />
        <GlowStatCard icon={Sparkles} label="Referral Bonus" value={`+$${dashboard?.todayReferralBonus?.toFixed(2) || '0.00'}`} subValue="Today's bonus" color="amber" delay={0.6} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}><MarketPairs /></motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-4">
          <Link to="/investments" className="glow-card p-6 flex items-center gap-5 group cursor-pointer block">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green group-hover:scale-110 transition-transform"><Zap className="w-8 h-8 text-white" /></div>
            <div className="flex-1"><h3 className="text-xl font-bold text-white group-hover:text-[#00ff88] transition-colors">New Investment</h3><p className="text-gray-400">Earn up to 1.7% daily returns</p></div>
            <ArrowUpRight className="w-6 h-6 text-gray-500 group-hover:text-[#00ff88] transition-all" />
          </Link>
          <Link to="/transactions" className="glow-card p-6 flex items-center gap-5 group cursor-pointer block">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00d4ff] to-blue-600 rounded-2xl flex items-center justify-center shadow-lg glow-blue group-hover:scale-110 transition-transform"><Activity className="w-8 h-8 text-white" /></div>
            <div className="flex-1"><h3 className="text-xl font-bold text-white group-hover:text-[#00d4ff] transition-colors">Transaction History</h3><p className="text-gray-400">View all your earnings</p></div>
            <ArrowUpRight className="w-6 h-6 text-gray-500 group-hover:text-[#00d4ff] transition-all" />
          </Link>
        </motion.div>
      </div>

      <AnimatePresence>
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onSuccess={loadDashboard} />}
        {rankUpName && <RankUpModal rankName={rankUpName} onClose={() => setRankUpName(null)} />}
      </AnimatePresence>
    </div>
  );
}
