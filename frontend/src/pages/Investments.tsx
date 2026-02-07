import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, Clock, CheckCircle2, X, DollarSign, AlertTriangle } from 'lucide-react';
import { investmentApi, userApi, type Investment } from '../lib/api';
import { useSounds } from '../hooks/useSounds';

const plans = [
  { min: 20, max: 49, rate: 0.8, color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400' },
  { min: 50, max: 99, rate: 1.1, color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400' },
  { min: 100, max: 149, rate: 1.4, color: 'from-[#00d4ff]/20 to-[#00d4ff]/5', border: 'border-[#00d4ff]/30', text: 'text-[#00d4ff]' },
  { min: 150, max: 999999, rate: 1.7, color: 'from-[#00ff88]/20 to-[#00ff88]/5', border: 'border-[#00ff88]/30', text: 'text-[#00ff88]' },
];

function PurchaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const { playSuccess, playError: errSound } = useSounds();

  useEffect(() => { userApi.getDashboard().then(d => setBalance(d.balance)).catch(() => {}); }, []);

  const rate = (() => { const a = parseFloat(amount); if (isNaN(a)) return 0; const p = plans.find(p => a >= p.min && a <= p.max); return p?.rate || 0; })();

  const handlePurchase = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 20) { setError('Minimum investment is $20'); return; }
    if (num > balance) { setError(`Insufficient balance ($${balance.toFixed(2)})`); return; }
    setLoading(true); setError('');
    try {
      const res = await investmentApi.purchase(num);
      if (res.success) { playSuccess(); setDone(true); setTimeout(() => { onSuccess(); onClose(); }, 1500); }
      else { setError(res.message || 'Failed'); errSound(); }
    } catch (e: any) { setError(e.response?.data?.message || 'Failed'); errSound(); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{scale:0.9,y:30}} animate={{scale:1,y:0}} exit={{scale:0.9}} className="w-full max-w-lg glass p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-[#00ff88]/20"><Zap className="w-5 h-5 text-[#00ff88]"/></div><div><h2 className="text-lg font-bold text-white">New Investment</h2><p className="text-xs text-gray-400">Balance: ${balance.toFixed(2)}</p></div></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        {done ? (
          <motion.div initial={{scale:0.8}} animate={{scale:1}} className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-[#00ff88] mx-auto mb-4"/><p className="text-xl font-bold text-white">Investment Activated!</p>
            <p className="text-gray-400 mt-2">${parseFloat(amount).toFixed(2)} at {rate}% daily</p>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {plans.map(p => (
                <button key={p.min} onClick={() => setAmount(String(p.min))} className={`p-4 rounded-xl bg-gradient-to-br ${p.color} border ${p.border} text-left hover:scale-[1.02] transition-all`}>
                  <p className={`text-lg font-bold ${p.text}`}>{p.rate}% daily</p>
                  <p className="text-xs text-gray-400">${p.min} — {p.max < 999999 ? `$${p.max}` : '$150+'}</p>
                </button>
              ))}
            </div>
            <div className="relative mb-2"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"/><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Investment amount" className="input-premium pl-12 text-lg" min="20"/></div>
            {rate > 0 && <p className="text-sm text-[#00ff88] mb-3">Rate: {rate}% daily = ${(parseFloat(amount)*rate/100).toFixed(2)}/day</p>}
            {error && <div className="flex items-center gap-2 text-[#ff3366] text-sm mb-3"><AlertTriangle className="w-4 h-4"/>{error}</div>}
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={handlePurchase} disabled={loading||!amount} className="w-full btn-premium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Zap className="w-5 h-5"/>Invest Now</>}
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);

  const load = async () => { try { const d = await investmentApi.getMyInvestments(); setInvestments(Array.isArray(d) ? d : []); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-3"><TrendingUp className="w-6 h-6 text-primary-400"/>My Investments</h1><p className="text-gray-400 text-sm mt-1">{investments.length} investments</p></div>
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>setShowPurchase(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-primary-600 text-black font-semibold hover:shadow-[0_0_25px_rgba(0,255,136,0.3)]">
          <Zap className="w-4 h-4"/>New Investment
        </motion.button>
      </motion.div>

      {/* Plans */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(p => (
          <motion.div key={p.min} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className={`p-5 rounded-xl bg-gradient-to-br ${p.color} border ${p.border}`}>
            <p className={`text-2xl font-bold ${p.text} mb-1`}>{p.rate}%</p>
            <p className="text-xs text-gray-400">Daily return</p>
            <p className="text-xs text-gray-500 mt-2">${p.min} — {p.max < 999999 ? `$${p.max}` : '$150+'}</p>
          </motion.div>
        ))}
      </div>

      {/* Active investments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.map((inv, i) => (
          <motion.div key={inv.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className={`glow-card p-5 ${inv.isActive ? '' : 'opacity-60'}`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`text-2xl font-bold font-mono ${inv.isActive ? 'text-[#00ff88]' : 'text-gray-400'}`}>${inv.amount.toFixed(2)}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${inv.isActive ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-gray-500/20 text-gray-400'}`}>{inv.isActive ? 'ACTIVE' : 'CLOSED'}</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Rate: <span className="text-white font-medium">{(inv.dailyRate * 100).toFixed(1)}%</span> daily</p>
            <p className="text-sm text-gray-400 mb-1">Daily: <span className="text-[#00ff88] font-medium">${(inv.amount * inv.dailyRate).toFixed(2)}</span></p>
            {inv.isActive && <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500"><Clock className="w-3 h-3"/>Next: {new Date(inv.nextPayoutAt).toLocaleString()}</div>}
          </motion.div>
        ))}
        {investments.length === 0 && <div className="col-span-3 text-center py-12 text-gray-500"><p className="text-lg mb-2">No investments yet</p><p className="text-sm">Create your first investment to start earning</p></div>}
      </div>

      <AnimatePresence>{showPurchase && <PurchaseModal onClose={() => setShowPurchase(false)} onSuccess={load} />}</AnimatePresence>
    </div>
  );
}
