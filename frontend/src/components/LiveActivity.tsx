import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Users, Zap, Radio } from 'lucide-react';

function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [dv, setDv] = useState(value);
  useEffect(() => { const dur = 500, sv = dv, st = Date.now(); const go = () => { const p = Math.min((Date.now()-st)/dur,1); setDv(Math.round(sv+(value-sv)*(1-Math.pow(1-p,3)))); if(p<1)requestAnimationFrame(go); }; requestAnimationFrame(go); }, [value]);
  return <motion.span key={value} initial={{opacity:0.6,y:-4}} animate={{opacity:1,y:0}} className={className}>{dv.toLocaleString()}</motion.span>;
}

const pairs = ['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','ADA/USDT','DOGE/USDT','DOT/USDT'];
const types = ['Scalp Trade Opened','Position Closed','Arbitrage Found','Profit Secured','Signal Detected','Trade Executed'];
interface Sig { id: string; pair: string; type: string; profit?: number; }
const genSig = (): Sig => { const p=pairs[Math.floor(Math.random()*pairs.length)], t=types[Math.floor(Math.random()*types.length)]; return { id: Math.random().toString(36).substr(2,9), pair: p, type: t, profit: (t.includes('Closed')||t.includes('Secured')||t.includes('Executed'))?(Math.random()-0.2)*0.5:undefined }; };

export default function LiveActivity() {
  const [traders, setTraders] = useState(2847);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [vol, setVol] = useState(12.4);
  useEffect(() => { const i=setInterval(()=>setTraders(p=>Math.max(2500,Math.min(3200,p+Math.floor((Math.random()-0.5)*20)))),3000); return ()=>clearInterval(i); },[]);
  useEffect(() => { const i=setInterval(()=>setVol(p=>Math.max(10,Math.min(20,p+(Math.random()-0.4)*0.3))),5000); return ()=>clearInterval(i); },[]);
  useEffect(() => { setSigs(Array.from({length:3},genSig)); const i=setInterval(()=>setSigs(p=>[genSig(),...p.slice(0,4)]),2500); return ()=>clearInterval(i); },[]);

  return (
    <div className="glass p-4 space-y-4 neon-border-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative"><Radio className="w-4 h-4 text-[#00ff88]" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00ff88] rounded-full animate-ping" /></div>
          <span className="text-sm font-semibold text-white">Live Activity</span>
        </div>
        <div className="live-feed-badge !px-2 !py-1 !text-[9px]"><span className="dot !w-[5px] !h-[5px]" /><span>LIVE</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-white/[0.02]"><div className="flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-1"><Users className="w-3 h-3" /><span>Traders</span></div><AnimatedNumber value={traders} className="text-lg font-bold text-white font-mono" /></div>
        <div className="text-center p-2 rounded-lg bg-white/[0.02]"><div className="flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-1"><Activity className="w-3 h-3" /><span>Volume</span></div><span className="text-lg font-bold text-[#00ff88] font-mono">${vol.toFixed(1)}M</span></div>
        <div className="text-center p-2 rounded-lg bg-white/[0.02]"><div className="flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-1"><Zap className="w-3 h-3" /><span>Latency</span></div><span className="text-lg font-bold text-white font-mono">12ms</span></div>
      </div>
      <div className="space-y-1.5 max-h-36 overflow-hidden">
        <AnimatePresence initial={false}>
          {sigs.map(s => (
            <motion.div key={s.id} initial={{opacity:0,x:-20,height:0}} animate={{opacity:1,x:0,height:'auto'}} exit={{opacity:0,x:10,height:0}} transition={{duration:0.35}} className={`flex items-center justify-between text-xs p-2.5 rounded-lg ${s.profit!==undefined&&s.profit>=0?'bg-[#00ff88]/5 border border-[#00ff88]/15':'bg-white/[0.03] border border-white/8'}`}>
              <div className="flex items-center gap-2"><TrendingUp className={`w-3 h-3 flex-shrink-0 ${s.profit!==undefined&&s.profit>=0?'text-[#00ff88]':'text-gray-500'}`} /><span className="text-gray-400"><span className="text-white font-medium">[{s.pair}]</span> <span className="text-gray-500">{s.type}</span></span></div>
              {s.profit!==undefined && <motion.span initial={{scale:0.8}} animate={{scale:1}} className={`font-mono font-semibold ${s.profit>=0?'text-[#00ff88]':'text-[#ff3366]'}`}>{s.profit>=0?'+':''}{(s.profit*100).toFixed(2)}%</motion.span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
