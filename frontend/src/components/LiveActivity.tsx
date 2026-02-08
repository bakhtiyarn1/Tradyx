import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Users, Zap, Radio } from 'lucide-react';

function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const dur = 600, sv = dv, st = Date.now();
    const go = () => {
      const p = Math.min((Date.now() - st) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDv(Math.round(sv + (value - sv) * eased));
      if (p < 1) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }, [value]);
  return (
    <motion.span key={value} initial={{ opacity: 0.6, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={className}>
      {dv.toLocaleString()}
    </motion.span>
  );
}

const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'DOT/USDT'];
const types = ['Scalp Trade Opened', 'Position Closed', 'Arbitrage Found', 'Profit Secured', 'Signal Detected', 'Trade Executed'];

interface Sig { id: string; pair: string; type: string; profit?: number; }

const genSig = (): Sig => {
  const p = pairs[Math.floor(Math.random() * pairs.length)];
  const t = types[Math.floor(Math.random() * types.length)];
  return {
    id: Math.random().toString(36).substr(2, 9),
    pair: p,
    type: t,
    profit: (t.includes('Closed') || t.includes('Secured') || t.includes('Executed'))
      ? (Math.random() - 0.2) * 0.5
      : undefined,
  };
};

export default function LiveActivity() {
  const [traders, setTraders] = useState(2847);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [vol, setVol] = useState(12.4);

  useEffect(() => {
    const i = setInterval(() => setTraders(p => Math.max(2500, Math.min(3200, p + Math.floor((Math.random() - 0.5) * 20)))), 3000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    const i = setInterval(() => setVol(p => Math.max(10, Math.min(20, p + (Math.random() - 0.4) * 0.3))), 5000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    setSigs(Array.from({ length: 3 }, genSig));
    const i = setInterval(() => setSigs(p => [genSig(), ...p.slice(0, 4)]), 2500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="glass p-4 space-y-4 neon-border-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="w-4 h-4 text-[#00ff88]" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00ff88] rounded-full" style={{ animation: 'livePulseDot 2s ease-in-out infinite' }} />
          </div>
          <span className="text-sm font-semibold text-white">Live Activity</span>
        </div>
        <div className="live-feed-badge !px-2 !py-1 !text-[9px]"><span className="dot !w-[5px] !h-[5px]" /><span>LIVE</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, label: 'Traders', value: <AnimatedNumber value={traders} className="text-base font-bold text-white font-mono" />, color: 'text-gray-500' },
          { icon: Activity, label: 'Volume', value: <span className="text-base font-bold text-[#00ff88] font-mono">${vol.toFixed(1)}M</span>, color: 'text-gray-500' },
          { icon: Zap, label: 'Latency', value: <span className="text-base font-bold text-white font-mono">12ms</span>, color: 'text-gray-500' },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-2 rounded-lg bg-white/[0.02]">
            <div className={`flex items-center justify-center gap-1 ${stat.color} text-[10px] mb-1`}>
              <stat.icon className="w-3 h-3" /><span>{stat.label}</span>
            </div>
            {stat.value}
          </div>
        ))}
      </div>

      <div className="space-y-1.5 max-h-36 overflow-hidden relative">
        <AnimatePresence initial={false}>
          {sigs.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -15, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center justify-between text-xs p-2.5 rounded-lg ${
                s.profit !== undefined && s.profit >= 0
                  ? 'bg-[#00ff88]/[0.04] border border-[#00ff88]/10'
                  : 'bg-white/[0.02] border border-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-3 h-3 flex-shrink-0 ${s.profit !== undefined && s.profit >= 0 ? 'text-[#00ff88]' : 'text-gray-500'}`} />
                <span className="text-gray-400">
                  <span className="text-white font-medium">[{s.pair}]</span>{' '}
                  <span className="text-gray-500">{s.type}</span>
                </span>
              </div>
              {s.profit !== undefined && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`font-mono font-semibold ${s.profit >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}
                >
                  {s.profit >= 0 ? '+' : ''}{(s.profit * 100).toFixed(2)}%
                </motion.span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-dark-900/60 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
