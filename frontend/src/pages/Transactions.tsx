import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, TrendingUp, Target, Wallet, Zap, ArrowDownRight, ArrowUpRight, ChevronDown, Inbox } from 'lucide-react';
import { userApi, type Transaction } from '../lib/api';

const FILTERS = [
  { key: 'All', label: 'All', color: 'bg-white/10 text-white' },
  { key: 'Deposit', label: 'Deposits', color: 'bg-[#00ff88]/10 text-[#00ff88]' },
  { key: 'Withdrawal', label: 'Withdrawals', color: 'bg-[#ff3366]/10 text-[#ff3366]' },
  { key: 'Profit', label: 'Profits', color: 'bg-[#00d4ff]/10 text-[#00d4ff]' },
  { key: 'Investment', label: 'Investments', color: 'bg-purple-500/10 text-purple-400' },
  { key: 'ReferralBonus', label: 'Referrals', color: 'bg-amber-500/10 text-amber-400' },
] as const;

const PAGE_SIZE = 20;

export default function Transactions() {
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      try { const d = await userApi.getTransactions(0, 200); setAllTxs(d); }
      catch {} finally { setLoading(false); }
    })();
  }, []);

  const filtered = filter === 'All' ? allTxs : allTxs.filter(t => t.type === filter);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const icon = (t: string) => {
    if (t === 'Profit' || t === 'ReferralBonus') return <TrendingUp className="w-4 h-4" />;
    if (t === 'Investment') return <Target className="w-4 h-4" />;
    if (t === 'Deposit') return <Wallet className="w-4 h-4" />;
    if (t === 'Withdrawal') return <ArrowUpRight className="w-4 h-4" />;
    if (t === 'ManualAdjustment') return <Zap className="w-4 h-4" />;
    return <ArrowDownRight className="w-4 h-4" />;
  };
  const color = (t: string) => {
    if (t === 'Deposit') return 'bg-[#00ff88]/10 text-[#00ff88]';
    if (t === 'Withdrawal') return 'bg-[#ff3366]/10 text-[#ff3366]';
    if (t === 'Profit' || t === 'ReferralBonus') return 'bg-[#00d4ff]/10 text-[#00d4ff]';
    if (t === 'Investment') return 'bg-purple-500/10 text-purple-400';
    if (t === 'ManualAdjustment') return 'bg-amber-500/10 text-amber-400';
    return 'bg-white/10 text-gray-400';
  };

  // Summary
  const totalIn = allTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = allTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Receipt className="w-6 h-6 text-primary-400" />Transaction History</h1>
          <p className="text-gray-400 text-sm mt-1">{allTxs.length} total &middot; {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="glass px-3 py-1.5 rounded-lg"><span className="text-gray-500">In:</span> <span className="text-[#00ff88] font-mono font-medium">+${totalIn.toFixed(2)}</span></div>
          <div className="glass px-3 py-1.5 rounded-lg"><span className="text-gray-500">Out:</span> <span className="text-[#ff3366] font-mono font-medium">-${totalOut.toFixed(2)}</span></div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${filter === f.key ? `${f.color} border-white/20` : 'bg-white/[0.03] text-gray-500 border-white/5 hover:bg-white/5 hover:text-gray-300'}`}>
            {f.label}
            {f.key !== 'All' && <span className="ml-1.5 text-[10px] opacity-60">({allTxs.filter(t => t.type === f.key).length})</span>}
          </button>
        ))}
      </motion.div>

      {/* List */}
      <div className="glass rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No transactions found</p>
            <p className="text-gray-600 text-sm mt-1">{filter !== 'All' ? 'Try a different filter' : 'Make a deposit to get started'}</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map((tx, i) => (
              <motion.div key={tx.id} layout initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} transition={{delay:i*0.02}}
                className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color(tx.type)}`}>{icon(tx.type)}</div>
                  <div><p className="text-sm text-white font-medium">{tx.type}{tx.type === 'ReferralBonus' ? ' (Referral)' : ''}</p><p className="text-xs text-gray-500 truncate max-w-[300px]">{tx.description}</p></div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${tx.amount >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>{tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-600">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {hasMore && (
          <motion.button whileHover={{backgroundColor:'rgba(255,255,255,0.03)'}} onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            className="w-full p-4 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-colors border-t border-white/5">
            <ChevronDown className="w-4 h-4" />Load more ({filtered.length - visibleCount} remaining)
          </motion.button>
        )}
      </div>
    </div>
  );
}
