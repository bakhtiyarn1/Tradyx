import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Wallet, ArrowDownLeft, ArrowUpRight, DollarSign, X, CheckCircle2, TrendingUp, TrendingDown, Clock, Zap, Target, Receipt, AlertTriangle, Timer, Bolt, Users, Lock, ShieldCheck } from 'lucide-react';
import { userApi } from '../lib/api';
import type { Dashboard, Transaction, WithdrawalInfo, ReferralQualification, WithdrawalLimits } from '../lib/api';
import SlotMachineCounter from '../components/SlotMachineCounter';
import { useSounds } from '../hooks/useSounds';
import { useToast } from '../lib/toast';

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    Pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    Completed: 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/20',
    Approved: 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/20',
    Rejected: 'bg-[#ff3366]/15 text-[#ff3366] border-[#ff3366]/20',
  };
  const icons: Record<string, string> = { Pending: '⏳', Completed: '✅', Approved: '✅', Rejected: '❌' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg[status] || cfg.Completed}`}>
      {icons[status] || '•'} {status}
    </span>
  );
}

/* ─── Deposit Modal ─── */
function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { playCashRegister } = useSounds();
  const toast = useToast();
  const presets = [50, 100, 250, 500, 1000];

  const handleDeposit = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      await userApi.deposit(num);
      playCashRegister();
      setDone(true);
      toast.success(`Deposited $${num.toFixed(2)} successfully`);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Deposit failed';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md glass p-6" onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00ff88]/20"><ArrowDownLeft className="w-5 h-5 text-[#00ff88]" /></div>
            <h2 className="text-lg font-bold text-white">Deposit Funds</h2>
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
            <p className="text-xl font-bold text-white">Deposit Successful!</p>
            <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} added to your balance</p>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((p, idx) => (
                <motion.button
                  key={p}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAmount(String(p))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${amount === String(p) ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_15px_rgba(0,255,136,0.1)]' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                >
                  ${p}
                </motion.button>
              ))}
            </div>
            <div className="relative mb-4">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" className="input-premium pl-12 text-lg" min="1" step="any" />
            </div>
            <AnimatePresence>
              {error && <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[#ff3366] text-sm mb-4"><AlertTriangle className="w-4 h-4" />{error}</motion.div>}
            </AnimatePresence>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDeposit} disabled={loading || !amount} className="w-full btn-premium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowDownLeft className="w-5 h-5" />Deposit</>}
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-3">Funds are credited instantly</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Withdraw Modal ─── */
function WithdrawModal({ onClose, onSuccess, balance, refQual }: { onClose: () => void; onSuccess: () => void; balance: number; refQual: ReferralQualification | null }) {
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [isInstant, setIsInstant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resultStatus, setResultStatus] = useState('');
  const [error, setError] = useState('');
  const [wdInfo, setWdInfo] = useState<WithdrawalInfo | null>(null);
  const [wdLimits, setWdLimits] = useState<WithdrawalLimits | null>(null);
  const { playSuccess } = useSounds();
  const toast = useToast();

  const isBlocked = refQual !== null && !refQual.qualified;
  const isCooling = wdLimits !== null && !wdLimits.coolingPeriod.allowed;

  useEffect(() => {
    userApi.getWithdrawalInfo().then(setWdInfo).catch(() => {});
    userApi.getWithdrawalLimits().then(setWdLimits).catch(() => {});
  }, []);

  const num = parseFloat(amount) || 0;
  const feeRate = wdInfo ? wdInfo.feeRate * (1 - wdInfo.feeDiscount) : 0.07;
  const fee = isInstant ? Math.round(num * feeRate * 100) / 100 : 0;
  const totalDeducted = num + fee;
  const netReceive = num;

  const handleWithdraw = async () => {
    if (isNaN(num) || num < (wdInfo?.minAmount || 10)) { setError(`Minimum withdrawal is $${wdInfo?.minAmount || 10}`); return; }
    if (isInstant && num > (wdInfo?.maxInstant || 500)) { setError(`Instant limit: $${wdInfo?.maxInstant || 500}`); return; }
    if (totalDeducted > balance) { setError(`Insufficient balance ($${balance.toFixed(2)})`); return; }
    setLoading(true); setError('');
    try {
      const res = await userApi.withdraw(num, isInstant, wallet || undefined);
      playSuccess();
      setResultStatus(res.status || (isInstant ? 'Completed' : 'Pending'));
      setDone(true);
      toast.success(isInstant ? `Instant withdrawal $${num.toFixed(2)} completed` : `Withdrawal $${num.toFixed(2)} submitted for approval`);
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Withdrawal failed';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md glass p-6" onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#ff3366]/20"><ArrowUpRight className="w-5 h-5 text-[#ff3366]" /></div>
            <h2 className="text-lg font-bold text-white">Withdraw Funds</h2>
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
            <p className="text-xl font-bold text-white">{resultStatus === 'Completed' ? 'Withdrawal Processed!' : 'Withdrawal Submitted!'}</p>
            <p className="text-gray-400 mt-2">${num.toFixed(2)} {resultStatus === 'Pending' ? '— awaiting admin approval' : 'withdrawn'}</p>
            {resultStatus === 'Pending' && <div className="mt-3"><StatusBadge status="Pending" /></div>}
          </motion.div>
        ) : (
          <>
            {/* Referral Qualification Blocker */}
            {isBlocked && refQual && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 rounded-xl bg-[#ff3366]/5 border border-[#ff3366]/15"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-[#ff3366]" />
                  <span className="text-sm font-semibold text-[#ff3366]">Withdrawal Locked</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  You need at least {refQual.required} active referrals (with investments) to withdraw funds.
                </p>
                {/* Progress dots */}
                <div className="flex items-center gap-2 mb-2">
                  {Array.from({ length: refQual.required }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                        idx < refQual.activeReferrals
                          ? 'bg-[#00ff88]/15 border-[#00ff88]/30 text-[#00ff88]'
                          : 'bg-white/5 border-white/10 text-gray-600'
                      }`}
                    >
                      {idx < refQual.activeReferrals ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {refQual.activeReferrals}/{refQual.required} active
                  </span>
                </div>
                <Link to="/referrals" className="text-xs text-primary-400 hover:text-[#00ff88] transition-colors">
                  Invite referrals to unlock withdrawals →
                </Link>
              </motion.div>
            )}

            {/* Cooling Period Warning */}
            {isCooling && wdLimits && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Cooling Period</span>
                </div>
                <p className="text-xs text-gray-400">
                  {wdLimits.coolingPeriod.hoursRemaining}h remaining. Withdrawals unlock at{' '}
                  {wdLimits.coolingPeriod.unlocksAt ? new Date(wdLimits.coolingPeriod.unlocksAt).toLocaleString() : 'soon'}.
                </p>
              </motion.div>
            )}

            {/* Daily Limits Info */}
            {wdLimits && !isBlocked && !isCooling && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Your daily limit</span>
                  <span className="text-gray-300 font-mono">${wdLimits.dailyLimits.personalRemaining.toFixed(0)} / ${wdLimits.dailyLimits.personalLimit.toFixed(0)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (wdLimits.dailyLimits.personalUsedToday / wdLimits.dailyLimits.personalLimit) * 100)}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-primary-500"
                  />
                </div>
              </motion.div>
            )}

            {/* Mode Toggle */}
            <div className={`grid grid-cols-2 gap-2 mb-5 ${isBlocked || isCooling ? 'opacity-50 pointer-events-none' : ''}`}>
              {[
                { instant: false, icon: Timer, label: 'Regular', sub: '0% fee · 1-3 days', activeColor: 'border-[#00ff88]/40 bg-[#00ff88]/8', textColor: 'text-[#00ff88]' },
                { instant: true, icon: Bolt, label: 'Instant', sub: `${(feeRate * 100).toFixed(0)}% fee · Immediate`, activeColor: 'border-amber-400/40 bg-amber-400/8', textColor: 'text-amber-400' },
              ].map((opt) => (
                <motion.button
                  key={opt.label}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsInstant(opt.instant)}
                  className={`p-3 rounded-xl border text-center transition-all duration-300 ${isInstant === opt.instant ? opt.activeColor : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <opt.icon className={`w-5 h-5 mx-auto mb-1 transition-colors duration-300 ${isInstant === opt.instant ? opt.textColor : 'text-gray-500'}`} />
                  <p className={`text-sm font-semibold transition-colors duration-300 ${isInstant === opt.instant ? opt.textColor : 'text-gray-400'}`}>{opt.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{opt.sub}</p>
                </motion.button>
              ))}
            </div>

            <div className="glass p-3 mb-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">Available balance</span>
              <span className="text-sm font-bold text-[#00ff88] font-mono">${balance.toFixed(2)}</span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Amount (min $${wdInfo?.minAmount || 10})`} className="input-premium pl-12 text-lg" min="10" step="any" />
              </div>
              <input type="text" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="Wallet address (optional)" className="input-premium text-sm" />
            </div>

            {/* Fee Breakdown */}
            <AnimatePresence>
              {num > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass p-3 mb-4 space-y-1.5 overflow-hidden"
                >
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Withdrawal amount</span><span className="text-white font-mono">${num.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">
                      Fee {isInstant ? `(${(feeRate * 100).toFixed(0)}%)` : ''}
                      {wdInfo && wdInfo.feeDiscount > 0 && isInstant ? ` · ${(wdInfo.feeDiscount * 100).toFixed(0)}% rank discount` : ''}
                    </span>
                    <span className={`font-mono ${fee > 0 ? 'text-[#ff3366]' : 'text-[#00ff88]'}`}>
                      {fee > 0 ? `-$${fee.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/8 pt-1.5 mt-1">
                    <span className="text-gray-300 font-medium">You receive</span>
                    <span className="text-white font-bold font-mono">${netReceive.toFixed(2)}</span>
                  </div>
                  {!isInstant && <p className="text-[10px] text-yellow-400/80 flex items-center gap-1"><Timer className="w-3 h-3" />Processing time: 1-3 business days</p>}
                  {isInstant && wdInfo && num > wdInfo.maxInstant && <p className="text-[10px] text-[#ff3366] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Max instant: ${wdInfo.maxInstant}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[#ff3366] text-sm mb-4"><AlertTriangle className="w-4 h-4" />{error}</motion.div>}
            </AnimatePresence>

            <motion.button
              whileHover={!(isBlocked || isCooling) ? { scale: 1.02, y: -1 } : {}}
              whileTap={!(isBlocked || isCooling) ? { scale: 0.98 } : {}}
              onClick={handleWithdraw}
              disabled={loading || !amount || isBlocked || isCooling}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 ${
                isBlocked || isCooling
                  ? 'bg-gray-600 cursor-not-allowed'
                  : isInstant
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                    : 'bg-gradient-to-r from-[#ff3366] to-pink-600 hover:shadow-[0_0_30px_rgba(255,51,102,0.3)]'
              }`}
            >
              {isBlocked ? <><Lock className="w-5 h-5" />Locked — Need Referrals</> : isCooling ? <><Timer className="w-5 h-5" />Cooling — {wdLimits?.coolingPeriod.hoursRemaining}h left</> : loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isInstant ? <><Bolt className="w-5 h-5" />Instant Withdraw</> : <><ArrowUpRight className="w-5 h-5" />Submit Withdrawal</>}
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-3">{isBlocked ? 'Invite active referrals to unlock withdrawals' : isCooling ? 'Wait for the cooling period to end after your last deposit' : isInstant ? 'Instant processing with fee' : 'Queued for admin approval · No fees'}</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Wallet Skeleton ─── */
function WalletSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div><div className="skeleton w-40 h-8 mb-2" /><div className="skeleton w-64 h-4" /></div>
      <div className="skeleton h-64 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      <div className="skeleton h-80 rounded-xl" />
    </div>
  );
}

/* ─── Wallet Page ─── */
export default function WalletPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [refQual, setRefQual] = useState<ReferralQualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = async () => {
    try {
      const [d, t, rq] = await Promise.all([
        userApi.getDashboard(),
        userApi.getTransactions(0, 10),
        userApi.getReferralQualification().catch(() => null),
      ]);
      setDashboard(d); setTxs(t); if (rq) setRefQual(rq);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // SignalR balance refresh
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('signalr:balance', handler);
    window.addEventListener('signalr:transaction', handler);
    return () => {
      window.removeEventListener('signalr:balance', handler);
      window.removeEventListener('signalr:transaction', handler);
    };
  }, []);

  const totalDeposited = txs.filter(t => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = txs.filter(t => t.type === 'Withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalProfit = txs.filter(t => t.type === 'Profit' || t.type === 'ReferralBonus').reduce((s, t) => s + t.amount, 0);
  const pendingCount = txs.filter(t => t.type === 'Withdrawal' && t.status === 'Pending').length;

  const txIcon = (type: string) => {
    if (type === 'Deposit') return <ArrowDownLeft className="w-4 h-4" />;
    if (type === 'Withdrawal') return <ArrowUpRight className="w-4 h-4" />;
    if (type === 'Profit' || type === 'ReferralBonus') return <TrendingUp className="w-4 h-4" />;
    if (type === 'Investment') return <Target className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };
  const txColor = (type: string) => {
    if (type === 'Deposit') return 'bg-[#00ff88]/10 text-[#00ff88]';
    if (type === 'Withdrawal') return 'bg-[#ff3366]/10 text-[#ff3366]';
    if (type === 'Profit' || type === 'ReferralBonus') return 'bg-[#00d4ff]/10 text-[#00d4ff]';
    if (type === 'Investment') return 'bg-purple-500/10 text-purple-400';
    return 'bg-amber-500/10 text-amber-400';
  };

  if (loading) return <WalletSkeleton />;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Wallet className="w-6 h-6 text-primary-400" />My Wallet</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your deposits and withdrawals</p>
      </motion.div>

      {/* Pending alert */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="glass p-4 border border-yellow-500/15 bg-yellow-500/[0.03] flex items-center gap-3"
          >
            <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">You have {pendingCount} pending withdrawal{pendingCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-500">Awaiting admin approval (1-3 business days)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Referral Qualification Widget */}
      {refQual && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={`glass p-4 border ${refQual.qualified ? 'border-[#00ff88]/15 bg-[#00ff88]/[0.02]' : 'border-amber-500/15 bg-amber-500/[0.02]'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {refQual.qualified ? (
                <div className="w-10 h-10 rounded-xl bg-[#00ff88]/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#00ff88]" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
              )}
              <div>
                <p className={`text-sm font-semibold ${refQual.qualified ? 'text-[#00ff88]' : 'text-amber-400'}`}>
                  {refQual.qualified ? 'Withdrawal Unlocked' : 'Referral Qualification'}
                </p>
                <p className="text-xs text-gray-500">
                  {refQual.qualified
                    ? 'You can withdraw funds at any time'
                    : `Invite ${refQual.required - refQual.activeReferrals} more active referral${refQual.required - refQual.activeReferrals > 1 ? 's' : ''} to unlock withdrawals`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: refQual.required }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                    idx < refQual.activeReferrals
                      ? 'bg-[#00ff88]/15 border-[#00ff88]/30 text-[#00ff88]'
                      : 'bg-white/5 border-white/10 text-gray-600'
                  }`}
                >
                  {idx < refQual.activeReferrals ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                </div>
              ))}
              <span className="text-xs font-mono font-bold ml-1" style={{ color: refQual.qualified ? '#00ff88' : '#f59e0b' }}>
                {refQual.activeReferrals}/{refQual.required}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <div className="glow-card p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-primary-500/30 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-breathe" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <motion.div
                animate={{ rotate: [0, -3, 3, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"
              >
                <Wallet className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <p className="text-gray-400 text-sm">Available Balance</p>
                <p className="text-xs text-gray-500">Ready to invest or withdraw</p>
              </div>
            </div>
            <SlotMachineCounter value={dashboard?.balance || 0} className="text-5xl md:text-6xl font-bold text-white" decimals={2} />
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDeposit(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-semibold hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all duration-300"
              >
                <ArrowDownLeft className="w-5 h-5" />Deposit
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowWithdraw(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/8 hover:border-white/15 transition-all duration-300"
              >
                <ArrowUpRight className="w-5 h-5" />Withdraw
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Deposited', value: totalDeposited, icon: TrendingDown, color: '#00ff88', gradient: 'from-[#00ff88]/10 to-transparent', delay: 0.2 },
          { label: 'Total Withdrawn', value: totalWithdrawn, icon: TrendingUp, color: '#ff3366', gradient: 'from-[#ff3366]/10 to-transparent', delay: 0.3 },
          { label: 'Net Profit', value: totalProfit, icon: Zap, color: '#00d4ff', gradient: 'from-[#00d4ff]/10 to-transparent', delay: 0.4 },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: stat.delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3, scale: 1.02 }}
            className={`glow-card p-5 bg-gradient-to-br ${stat.gradient} transition-all duration-400`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}12` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <p className="text-gray-400 text-xs">{stat.label}</p>
            </div>
            <p className="text-xl font-bold font-mono" style={{ color: stat.color }}>
              {stat.label === 'Net Profit' ? '+' : ''}${stat.value.toFixed(2)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="glass rounded-xl overflow-hidden"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-gray-400" />Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-primary-400 hover:text-[#00ff88] transition-colors">View all</Link>
        </div>
        {txs.length === 0 ? (
          <div className="p-14 text-center">
            <Wallet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No transactions yet</p>
            <p className="text-gray-600 text-sm mt-1">Deposit funds to get started</p>
          </div>
        ) : txs.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.03 }}
            className="flex items-center justify-between p-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${txColor(tx.type)}`}>
                {txIcon(tx.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium">{tx.type}</p>
                  {tx.type === 'Withdrawal' && tx.status !== 'Completed' && <StatusBadge status={tx.status} />}
                  {tx.isInstant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">Instant</span>}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(tx.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-mono font-semibold ${tx.amount >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
              </p>
              {tx.feeAmount > 0 && <p className="text-[10px] text-gray-500">fee: ${tx.feeAmount.toFixed(2)}</p>}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onSuccess={load} />}
        {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onSuccess={load} balance={dashboard?.balance || 0} refQual={refQual} />}
      </AnimatePresence>
    </div>
  );
}
