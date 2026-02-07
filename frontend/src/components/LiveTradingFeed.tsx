import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Bot } from 'lucide-react';

interface Trade { id: string; pair: string; type: 'BUY'|'SELL'; amount: number; price: number; profit: number; }
const ps = ['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','ADA/USDT'];
function gen(): Trade {
  const p=ps[Math.floor(Math.random()*ps.length)], t=Math.random()>0.4?'BUY':'SELL' as const;
  const bp=p.includes('BTC')?67000:p.includes('ETH')?3500:p.includes('SOL')?145:p.includes('BNB')?600:0.5;
  return { id:Math.random().toString(36).substr(2,9), pair:p, type:t, amount:Math.random()*0.5+0.01, price:bp+(Math.random()-0.5)*bp*0.01, profit:(Math.random()-0.2)*2 };
}

export default function LiveTradingFeed() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const init = Array.from({length:5},gen); setTrades(init); setTotal(init.reduce((s,t)=>s+t.profit,0));
    const i=setInterval(()=>{ const nt=gen(); setTrades(p=>[nt,...p.slice(0,9)]); setTotal(p=>p+nt.profit); },2500);
    return ()=>clearInterval(i);
  },[]);

  return (
    <div className="glass p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-blue-500/20 flex items-center justify-center"><Bot className="w-5 h-5 text-primary-400" /></div>
          <div><h3 className="font-semibold text-white">AI Trading Engine</h3><div className="status-online mt-1"><span>Online</span></div></div>
        </div>
        <div className="text-right"><p className="text-xs text-gray-500">Session Profit</p><p className={`text-lg font-bold font-mono ${total>=0?'text-[#00ff88] text-glow-green':'text-[#ff3366]'}`}>{total>=0?'+':''}{total.toFixed(2)}%</p></div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-hidden relative">
        <AnimatePresence initial={false}>
          {trades.map((tr,i) => (
            <motion.div key={tr.id} initial={{opacity:0,y:-20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,height:0}} transition={{duration:0.3}} style={{opacity:1-i*0.1}}
              className={`flex items-center justify-between p-3 rounded-xl ${tr.profit>=0?'bg-[#00ff88]/5 border border-[#00ff88]/20':'bg-[#ff3366]/5 border border-[#ff3366]/20'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tr.type==='BUY'?'bg-[#00ff88]/10':'bg-[#ff3366]/10'}`}>
                  {tr.type==='BUY'?<ArrowUpRight className="w-4 h-4 text-[#00ff88]" />:<ArrowDownRight className="w-4 h-4 text-[#ff3366]" />}
                </div>
                <div>
                  <div className="flex items-center gap-2"><span className="font-medium text-white text-sm">{tr.pair}</span><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tr.type==='BUY'?'bg-[#00ff88]/20 text-[#00ff88]':'bg-[#ff3366]/20 text-[#ff3366]'}`}>{tr.type}</span></div>
                  <p className="text-xs text-gray-500 font-mono">{tr.amount.toFixed(4)} @ ${tr.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                </div>
              </div>
              <div className={`text-sm font-bold font-mono ${tr.profit>=0?'text-[#00ff88]':'text-[#ff3366]'}`}>{tr.profit>=0?'+':''}{tr.profit.toFixed(2)}%</div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-dark-900/80 to-transparent pointer-events-none" />
      </div>
      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
        <div className="text-center"><p className="text-xs text-gray-500">Trades/hr</p><p className="text-sm font-semibold text-white">~45</p></div>
        <div className="text-center"><p className="text-xs text-gray-500">Win Rate</p><p className="text-sm font-semibold text-[#00ff88]">78.3%</p></div>
        <div className="text-center"><p className="text-xs text-gray-500">Latency</p><p className="text-sm font-semibold text-white">12ms</p></div>
      </div>
    </div>
  );
}
