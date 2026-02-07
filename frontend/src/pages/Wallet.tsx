import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Wallet, ArrowDownLeft, ArrowUpRight, DollarSign, X, CheckCircle2, TrendingUp, TrendingDown, Clock, Zap, Target, Receipt, AlertTriangle } from 'lucide-react';
import { userApi } from '../lib/api';
import type { Dashboard, Transaction } from '../lib/api';
import SlotMachineCounter from '../components/SlotMachineCounter';
import { useSounds } from '../hooks/useSounds';
import { useToast } from '../lib/toast';

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
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{scale:0.9,y:30}} animate={{scale:1,y:0}} exit={{scale:0.9}} transition={{type:'spring',damping:25}} className="w-full max-w-md glass p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-[#00ff88]/20"><ArrowDownLeft className="w-5 h-5 text-[#00ff88]"/></div><h2 className="text-lg font-bold text-white">Deposit Funds</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        {done ? (
          <motion.div initial={{scale:0.8}} animate={{scale:1}} className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4"/><p className="text-xl font-bold text-white">Deposit Successful!</p>
            <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} added to your balance</p>
          </motion.div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">{presets.map(p=>(
              <button key={p} onClick={()=>setAmount(String(p))} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${amount===String(p)?'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30':'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>${p}</button>
            ))}</div>
            <div className="relative mb-4"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"/><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount" className="input-premium pl-12 text-lg" min="1" step="any"/></div>
            {error && <div className="flex items-center gap-2 text-[#ff3366] text-sm mb-4"><AlertTriangle className="w-4 h-4"/>{error}</div>}
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={handleDeposit} disabled={loading||!amount} className="w-full btn-premium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><ArrowDownLeft className="w-5 h-5"/>Deposit</>}
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-3">Funds are credited instantly</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Withdraw Modal ─── */
function WithdrawModal({ onClose, onSuccess, balance }: { onClose: () => void; onSuccess: () => void; balance: number }) {
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { playSuccess } = useSounds();
  const toast = useToast();

  const handleWithdraw = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 10) { setError('Minimum withdrawal is $10'); return; }
    if (num > balance) { setError(`Insufficient balance ($${balance.toFixed(2)})`); return; }
    setLoading(true); setError('');
    try {
      await userApi.withdraw(num, wallet || undefined);
      playSuccess();
      setDone(true);
      toast.success(`Withdrew $${num.toFixed(2)} successfully`);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Withdrawal failed';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{scale:0.9,y:30}} animate={{scale:1,y:0}} exit={{scale:0.9}} transition={{type:'spring',damping:25}} className="w-full max-w-md glass p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-[#ff3366]/20"><ArrowUpRight className="w-5 h-5 text-[#ff3366]"/></div><h2 className="text-lg font-bold text-white">Withdraw Funds</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        {done ? (
          <motion.div initial={{scale:0.8}} animate={{scale:1}} className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4"/><p className="text-xl font-bold text-white">Withdrawal Processed!</p>
            <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} withdrawn</p>
          </motion.div>
        ) : (
          <>
            <div className="glass p-3 mb-4 flex items-center justify-between"><span className="text-xs text-gray-400">Available balance</span><span className="text-sm font-bold text-[#00ff88] font-mono">${balance.toFixed(2)}</span></div>
            <div className="space-y-3 mb-4">
              <div className="relative"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"/><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (min $10)" className="input-premium pl-12 text-lg" min="10" step="any"/></div>
              <input type="text" value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="Wallet address (optional)" className="input-premium text-sm"/>
            </div>
            {amount && parseFloat(amount)>0 && <div className="glass p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Amount</span><span className="text-white font-mono">${parseFloat(amount).toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Fee</span><span className="text-[#00ff88] font-mono">$0.00</span></div>
              <div className="flex justify-between text-sm border-t border-white/10 pt-1 mt-1"><span className="text-gray-300 font-medium">You receive</span><span className="text-white font-bold font-mono">${parseFloat(amount).toFixed(2)}</span></div>
            </div>}
            {error && <div className="flex items-center gap-2 text-[#ff3366] text-sm mb-4"><AlertTriangle className="w-4 h-4"/>{error}</div>}
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={handleWithdraw} disabled={loading||!amount}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#ff3366] to-pink-600 hover:shadow-[0_0_25px_rgba(255,51,102,0.4)] transition-all disabled:opacity-50">
              {loading?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><ArrowUpRight className="w-5 h-5"/>Withdraw</>}
            </motion.button>
            <p className="text-xs text-gray-600 text-center mt-3">Processed instantly &middot; No fees</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Wallet Page ─── */
export default function WalletPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = async () => {
    try {
      const [d, t] = await Promise.all([userApi.getDashboard(), userApi.getTransactions(0, 10)]);
      setDashboard(d);
      setTxs(t);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalDeposited = txs.filter(t => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = txs.filter(t => t.type === 'Withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalProfit = txs.filter(t => t.type === 'Profit' || t.type === 'ReferralBonus').reduce((s, t) => s + t.amount, 0);

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

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Wallet className="w-6 h-6 text-primary-400"/>My Wallet</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your deposits and withdrawals</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:0.1}}>
        <div className="glow-card p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20"><div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-primary-500/30 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"><Wallet className="w-7 h-7 text-white"/></div>
              <div><p className="text-gray-400 text-sm">Available Balance</p><p className="text-xs text-gray-500">Ready to invest or withdraw</p></div>
            </div>
            <SlotMachineCounter value={dashboard?.balance || 0} className="text-5xl md:text-6xl font-bold text-white" decimals={2} />
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>setShowDeposit(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-semibold hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] transition-all">
                <ArrowDownLeft className="w-5 h-5"/>Deposit
              </motion.button>
              <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>setShowWithdraw(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all">
                <ArrowUpRight className="w-5 h-5"/>Withdraw
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="glow-card p-5 bg-gradient-to-br from-[#00ff88]/10 to-transparent">
          <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-xl bg-[#00ff88]/15 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-[#00ff88]"/></div><p className="text-gray-400 text-xs">Total Deposited</p></div>
          <p className="text-xl font-bold text-[#00ff88] font-mono">${totalDeposited.toFixed(2)}</p>
        </motion.div>
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="glow-card p-5 bg-gradient-to-br from-[#ff3366]/10 to-transparent">
          <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-xl bg-[#ff3366]/15 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-[#ff3366]"/></div><p className="text-gray-400 text-xs">Total Withdrawn</p></div>
          <p className="text-xl font-bold text-[#ff3366] font-mono">${totalWithdrawn.toFixed(2)}</p>
        </motion.div>
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="glow-card p-5 bg-gradient-to-br from-[#00d4ff]/10 to-transparent">
          <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-xl bg-[#00d4ff]/15 flex items-center justify-center"><Zap className="w-4 h-4 text-[#00d4ff]"/></div><p className="text-gray-400 text-xs">Net Profit</p></div>
          <p className="text-xl font-bold text-[#00d4ff] font-mono">+${totalProfit.toFixed(2)}</p>
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}} className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-gray-400"/>Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-primary-400 hover:text-[#00ff88]">View all</Link>
        </div>
        {txs.length === 0 ? (
          <div className="p-12 text-center"><Wallet className="w-12 h-12 text-gray-700 mx-auto mb-3"/><p className="text-gray-500 font-medium">No transactions yet</p><p className="text-gray-600 text-sm mt-1">Deposit funds to get started</p></div>
        ) : txs.map((tx, i) => (
          <motion.div key={tx.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5+i*0.03}}
            className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txColor(tx.type)}`}>{txIcon(tx.type)}</div>
              <div><p className="text-sm text-white font-medium">{tx.type}</p><p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/>{new Date(tx.createdAt).toLocaleDateString()}</p></div>
            </div>
            <p className={`text-sm font-mono font-semibold ${tx.amount>=0?'text-[#00ff88]':'text-[#ff3366]'}`}>{tx.amount>=0?'+':''}{tx.amount.toFixed(2)}</p>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {showDeposit && <DepositModal onClose={()=>setShowDeposit(false)} onSuccess={load}/>}
        {showWithdraw && <WithdrawModal onClose={()=>setShowWithdraw(false)} onSuccess={load} balance={dashboard?.balance||0}/>}
      </AnimatePresence>
    </div>
  );
}
