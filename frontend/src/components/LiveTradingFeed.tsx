import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Bot } from 'lucide-react';

interface Trade { id: string; pair: string; type: 'BUY' | 'SELL'; amount: number; price: number; profit: number; }

const ps = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT'];

function gen(): Trade {
  const p = ps[Math.floor(Math.random() * ps.length)];
  const t = Math.random() > 0.4 ? 'BUY' : 'SELL' as const;
  const bp = p.includes('BTC') ? 67000 : p.includes('ETH') ? 3500 : p.includes('SOL') ? 145 : p.includes('BNB') ? 600 : 0.5;
  return {
    id: Math.random().toString(36).substr(2, 9),
    pair: p, type: t,
    amount: Math.random() * 0.5 + 0.01,
    price: bp + (Math.random() - 0.5) * bp * 0.01,
    profit: (Math.random() - 0.2) * 2,
  };
}

export default function LiveTradingFeed() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const init = Array.from({ length: 5 }, gen);
    setTrades(init);
    setTotal(init.reduce((s, t) => s + t.profit, 0));
    const i = setInterval(() => {
      const nt = gen();
      setTrades(p => [nt, ...p.slice(0, 9)]);
      setTotal(p => p + nt.profit);
    }, 2500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="glass p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-blue-500/20 flex items-center justify-center"
          >
            <Bot className="w-5 h-5 text-primary-400" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-white">AI Trading Engine</h3>
            <div className="status-online mt-1"><span>Online</span></div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Session Profit</p>
          <p className={`text-lg font-bold font-mono ${total >= 0 ? 'text-[#00ff88] text-glow-green' : 'text-[#ff3366]'}`}>
            {total >= 0 ? '+' : ''}{total.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-hidden relative">
        <AnimatePresence initial={false}>
          {trades.map((tr, i) => (
            <motion.div
              key={tr.id}
              initial={{ opacity: 0, y: -20, scale: 0.96, filter: 'blur(4px)' }}
              animate={{ opacity: 1 - i * 0.08, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center justify-between p-3 rounded-xl ${
                tr.profit >= 0
                  ? 'bg-[#00ff88]/[0.04] border border-[#00ff88]/15'
                  : 'bg-[#ff3366]/[0.04] border border-[#ff3366]/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  tr.type === 'BUY' ? 'bg-[#00ff88]/10' : 'bg-[#ff3366]/10'
                }`}>
                  {tr.type === 'BUY'
                    ? <ArrowUpRight className="w-4 h-4 text-[#00ff88]" />
                    : <ArrowDownRight className="w-4 h-4 text-[#ff3366]" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{tr.pair}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      tr.type === 'BUY' ? 'bg-[#00ff88]/15 text-[#00ff88]' : 'bg-[#ff3366]/15 text-[#ff3366]'
                    }`}>
                      {tr.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    {tr.amount.toFixed(4)} @ ${tr.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`text-sm font-bold font-mono ${tr.profit >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}
              >
                {tr.profit >= 0 ? '+' : ''}{tr.profit.toFixed(2)}%
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-dark-900/80 to-transparent pointer-events-none" />
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
        {[
          { label: 'Trades/hr', value: '~45', color: 'text-white' },
          { label: 'Win Rate', value: '78.3%', color: 'text-[#00ff88]' },
          { label: 'Latency', value: '12ms', color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
