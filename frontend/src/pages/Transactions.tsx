import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, TrendingUp, Target, Wallet, Zap, ArrowDownRight, ArrowUpRight, ChevronDown, Inbox, Bolt, Clock } from 'lucide-react';
import { userApi, type Transaction } from '../lib/api';

const FILTERS = [
  { key: 'All', label: 'All', color: 'bg-white/10 text-white' },
  { key: 'Deposit', label: 'Deposits', color: 'bg-[#00ff88]/10 text-[#00ff88]' },
  { key: 'Withdrawal', label: 'Withdrawals', color: 'bg-[#ff3366]/10 text-[#ff3366]' },
  { key: 'Profit', label: 'Profits', color: 'bg-[#00d4ff]/10 text-[#00d4ff]' },
  { key: 'Investment', label: 'Investments', color: 'bg-purple-500/10 text-purple-400' },
  { key: 'ReferralBonus', label: 'Referrals', color: 'bg-amber-500/10 text-amber-400' },
  { key: 'Cashback', label: 'Cashback', color: 'bg-yellow-500/10 text-yellow-400' },
] as const;

const PAGE_SIZE = 20;

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

function TransactionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div><div className="skeleton w-56 h-8 mb-2" /><div className="skeleton w-36 h-4" /></div>
        <div className="flex gap-3"><div className="skeleton w-24 h-8 rounded-lg" /><div className="skeleton w-24 h-8 rounded-lg" /></div>
      </div>
      <div className="flex gap-2"><div className="skeleton w-16 h-9 rounded-xl" /><div className="skeleton w-20 h-9 rounded-xl" /><div className="skeleton w-24 h-9 rounded-xl" /><div className="skeleton w-20 h-9 rounded-xl" /></div>
      <div className="skeleton rounded-xl"><div className="space-y-0">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-16 rounded-none border-b border-white/[0.02]" />)}</div></div>
    </div>
  );
}

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

  // SignalR refresh
  useEffect(() => {
    const handler = () => {
      userApi.getTransactions(0, 200).then(setAllTxs).catch(() => {});
    };
    window.addEventListener('signalr:transaction', handler);
    return () => window.removeEventListener('signalr:transaction', handler);
  }, []);

  const filtered = filter === 'All' ? allTxs : allTxs.filter(t => t.type === filter);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const icon = (t: string) => {
    if (t === 'Profit' || t === 'ReferralBonus') return <TrendingUp className="w-4 h-4" />;
    if (t === 'Investment') return <Target className="w-4 h-4" />;
    if (t === 'Deposit') return <Wallet className="w-4 h-4" />;
    if (t === 'Withdrawal') return <ArrowUpRight className="w-4 h-4" />;
    if (t === 'Cashback') return <Bolt className="w-4 h-4" />;
    if (t === 'ManualAdjustment') return <Zap className="w-4 h-4" />;
    return <ArrowDownRight className="w-4 h-4" />;
  };
  const color = (t: string) => {
    if (t === 'Deposit') return 'bg-[#00ff88]/10 text-[#00ff88]';
    if (t === 'Withdrawal') return 'bg-[#ff3366]/10 text-[#ff3366]';
    if (t === 'Profit' || t === 'ReferralBonus') return 'bg-[#00d4ff]/10 text-[#00d4ff]';
    if (t === 'Investment') return 'bg-purple-500/10 text-purple-400';
    if (t === 'Cashback') return 'bg-yellow-500/10 text-yellow-400';
    if (t === 'ManualAdjustment') return 'bg-amber-500/10 text-amber-400';
    return 'bg-white/10 text-gray-400';
  };

  const totalIn = allTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = allTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (loading) return <TransactionSkeleton />;

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
            <Receipt className="w-6 h-6 text-primary-400" />Transaction History
          </h1>
          <p className="text-gray-400 text-sm mt-1">{allTxs.length} total &middot; {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="text-gray-500 text-xs">In:</span>
            <span className="text-[#00ff88] font-mono font-medium">+${totalIn.toFixed(2)}</span>
          </div>
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="text-gray-500 text-xs">Out:</span>
            <span className="text-[#ff3366] font-mono font-medium">-${totalOut.toFixed(2)}</span>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f, idx) => (
          <motion.button
            key={f.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + idx * 0.03 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-300 ${
              filter === f.key
                ? `${f.color} border-white/15 shadow-lg`
                : 'bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/[0.04] hover:text-gray-300'
            }`}
          >
            {f.label}
            {f.key !== 'All' && (
              <span className="ml-1.5 text-[10px] opacity-60">
                ({allTxs.filter(t => t.type === f.key).length})
              </span>
            )}
          </motion.button>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="glass rounded-xl overflow-hidden"
      >
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No transactions found</p>
            <p className="text-gray-600 text-sm mt-1">{filter !== 'All' ? 'Try a different filter' : 'Make a deposit to get started'}</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map((tx, i) => (
              <motion.div
                key={tx.id}
                layout
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ delay: i * 0.015, duration: 0.3 }}
                className="flex items-center justify-between p-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${color(tx.type)}`}>
                    {icon(tx.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium">{tx.type}{tx.type === 'ReferralBonus' ? ' (Referral)' : ''}</p>
                      {tx.type === 'Withdrawal' && tx.status !== 'Completed' && <StatusBadge status={tx.status} />}
                      {tx.isInstant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">Instant</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate max-w-[300px]">{tx.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${tx.amount >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    {tx.feeAmount > 0 && <span className="text-[10px] text-gray-500">fee ${tx.feeAmount.toFixed(2)}</span>}
                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {hasMore && (
          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            className="w-full p-4 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-all duration-300 border-t border-white/5"
          >
            <ChevronDown className="w-4 h-4" />Load more ({filtered.length - visibleCount} remaining)
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
