import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, DollarSign, TrendingUp, Zap, Activity, X, AlertTriangle, ChevronRight, CheckCircle2, Search, BarChart3, Clock, Eye, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { adminApi, type AdminStats, type AdminUser, type UserFullDetails } from '../lib/api';
import { useSounds } from '../hooks/useSounds';
import SlotMachineCounter from '../components/SlotMachineCounter';

// Hooks
function useRealtimeChartData(initial: {name:string;value:number}[], jitter=0.5) {
  const [d, setD] = useState(initial);
  useEffect(() => { const i=setInterval(()=>setD(p=>p.map(pt=>({...pt,value:Math.max(0,pt.value+(Math.random()-0.4)*jitter*pt.value)}))),4000); return ()=>clearInterval(i); },[jitter]);
  return d;
}

function StatCard({ icon: Icon, label, value, delta, suffix = '' }: { icon: any; label: string; value: number; delta?: number; suffix?: string }) {
  return (
    <div className="stat-card-neon glass-admin p-5">
      <div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/10 flex items-center justify-center"><Icon className="w-5 h-5 text-[#00ff88]"/></div>
        {delta!==undefined&&<span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${delta>=0?'bg-[#00ff88]/10 text-[#00ff88]':'bg-[#ff3366]/10 text-[#ff3366]'}`}>{delta>=0?'+':''}{delta.toFixed(1)}%</span>}
      </div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <div className="flex items-baseline gap-1"><SlotMachineCounter value={value} className="text-2xl font-bold text-white" prefix={suffix==='users'?'':'$'} decimals={suffix==='users'?0:2} />{suffix==='users'&&<span className="text-gray-500 text-sm">users</span>}</div>
    </div>
  );
}

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [details, setDetails] = useState<UserFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [tab, setTab] = useState<'transactions'|'investments'|'referrals'>('transactions');
  const { playCashRegister, playError } = useSounds();

  useEffect(() => { adminApi.getUserDetails(userId).then(d=>setDetails(d)).catch(()=>{}).finally(()=>setLoading(false)); }, [userId]);

  const handleAdjust = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || !adjustReason) return;
    setAdjusting(true);
    try { await adminApi.adjustBalance(userId, amt, adjustReason); playCashRegister();
      const d = await adminApi.getUserDetails(userId); setDetails(d); setAdjustAmount(''); setAdjustReason('');
    } catch { playError(); } finally { setAdjusting(false); }
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{scale:0.9,y:30}} animate={{scale:1,y:0}} exit={{scale:0.9}} className="w-full max-w-3xl max-h-[90vh] glass-admin overflow-hidden relative" onClick={e=>e.stopPropagation()}>
        <div className="scanline-effect" />
        <div className="godmode-header p-6 flex items-center justify-between">
          <div className="flex items-center gap-3"><Eye className="w-5 h-5 text-[#ff3366]"/><h2 className="text-lg font-bold text-white">User Details</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {loading ? <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin"/></div> : details && (<>
            <div className="grid grid-cols-3 gap-4">
              <div className="glass p-4"><p className="text-xs text-gray-400">Username</p><p className="text-white font-bold">{details.profile.username}</p></div>
              <div className="glass p-4"><p className="text-xs text-gray-400">Email</p><p className="text-white font-medium truncate">{details.profile.email}</p></div>
              <div className="glass p-4"><p className="text-xs text-gray-400">Balance</p><SlotMachineCounter value={details.profile.balance} className="text-xl font-bold text-[#00ff88]" decimals={2}/></div>
            </div>
            {/* Adjust */}
            <div className="glass p-4 border-l-2 border-[#ff3366]"><h4 className="text-sm font-semibold text-[#ff3366] mb-3 flex items-center gap-2"><Zap className="w-4 h-4"/>Adjust Balance</h4>
              <div className="flex gap-2"><input type="number" value={adjustAmount} onChange={e=>setAdjustAmount(e.target.value)} placeholder="Amount (neg to deduct)" className="input-premium flex-1 !py-2 text-sm"/><input type="text" value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} placeholder="Reason" className="input-premium flex-1 !py-2 text-sm"/>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={handleAdjust} disabled={adjusting} className="px-4 py-2 rounded-xl bg-[#ff3366] text-white font-semibold text-sm disabled:opacity-50">
                  {adjusting?'...':'Apply'}
                </motion.button>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-1">{(['transactions','investments','referrals'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm rounded-t-lg transition-all ${tab===t?'bg-white/10 text-white font-semibold':'text-gray-500 hover:text-gray-300'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}</div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-2 max-h-60 overflow-y-auto">
                {tab==='transactions' && (details.transactions.length===0?<p className="text-gray-500 text-sm p-4">No transactions</p>:details.transactions.map(t=>(
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div><p className="text-sm text-white">{t.type}</p><p className="text-xs text-gray-500 truncate max-w-xs">{t.description}</p></div>
                    <div className="text-right"><p className={`text-sm font-mono font-semibold ${t.amount>=0?'text-[#00ff88]':'text-[#ff3366]'}`}>{t.amount>=0?'+':''}{t.amount.toFixed(2)}</p><p className="text-[10px] text-gray-600">{new Date(t.createdAt).toLocaleString()}</p></div>
                  </div>
                )))}
                {tab==='investments' && (details.investments.length===0?<p className="text-gray-500 text-sm p-4">No investments</p>:details.investments.map(inv=>(
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div><p className="text-sm text-white">${inv.amount.toFixed(2)} @ {(inv.dailyRate*100).toFixed(1)}%</p><p className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleString()}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded ${inv.isActive?'bg-[#00ff88]/20 text-[#00ff88]':'bg-gray-500/20 text-gray-400'}`}>{inv.isActive?'Active':'Closed'}</span>
                  </div>
                )))}
                {tab==='referrals' && (details.referrals.totalReferrals===0?<p className="text-gray-500 text-sm p-4">No referrals</p>:details.referrals.referrals.map(r=>(
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-sm text-white">{r.username}</p><p className="text-xs text-gray-500">{new Date(r.joinedAt).toLocaleString()}</p>
                  </div>
                )))}
              </motion.div>
            </AnimatePresence>
          </>)}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionResult, setActionResult] = useState<{type:'success'|'error';msg:string}|null>(null);
  const { playCyber, playSuccess, playError } = useSounds();

  const profitChartData = useRealtimeChartData(
    Array.from({length:7},(_,i)=>({name:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],value:Math.random()*5000+2000})), 0.08
  );
  const volumeChartData = useRealtimeChartData(
    Array.from({length:12},(_,i)=>({name:`${i+1}h`,value:Math.random()*8000+3000})), 0.06
  );

  const load = useCallback(async () => {
    try { const [s, u] = await Promise.all([adminApi.getStats(), adminApi.getUsers()]); setStats(s); setUsers(u); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { playCyber(); load(); const i=setInterval(load,30000); return ()=>clearInterval(i); }, [load]);

  const triggerPayouts = async () => {
    try { const r = await adminApi.triggerPayouts(); playSuccess(); setActionResult({type:'success', msg:`Processed ${r.processedCount ?? 0} payouts`}); load(); }
    catch { playError(); setActionResult({type:'error', msg:'Payout trigger failed'}); }
    setTimeout(()=>setActionResult(null), 3000);
  };

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-[#ff3366]/20 border-t-[#ff3366] rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      <AnimatePresence>{actionResult&&(
        <motion.div initial={{opacity:0,y:-20,x:'-50%'}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className={`fixed top-6 left-1/2 z-[9999] px-6 py-3 rounded-xl flex items-center gap-3 ${actionResult.type==='success'?'bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88]':'bg-[#ff3366]/20 border border-[#ff3366]/40 text-[#ff3366]'}`}>
          {actionResult.type==='success'?<CheckCircle2 className="w-5 h-5"/>:<AlertTriangle className="w-5 h-5"/>}
          <span className="font-medium">{actionResult.msg}</span>
        </motion.div>
      )}</AnimatePresence>

      {/* Header */}
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} className="flex items-center justify-between">
        <div className="flex items-center gap-3"><motion.div animate={{boxShadow:['0 0 10px rgba(255,51,102,0.3)','0 0 25px rgba(255,51,102,0.6)','0 0 10px rgba(255,51,102,0.3)']}} transition={{duration:2,repeat:Infinity}} className="p-2 rounded-xl bg-[#ff3366]/20"><Shield className="w-6 h-6 text-[#ff3366]"/></motion.div>
          <div><h1 className="text-2xl font-bold text-white">God Mode <span className="text-gray-500 text-base font-normal">// Command Center</span></h1><p className="text-xs text-gray-500">Admin Control Panel</p></div>
        </div>
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={triggerPayouts} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff3366] to-pink-600 text-white font-semibold text-sm hover:shadow-[0_0_25px_rgba(255,51,102,0.4)]">
          <Zap className="w-4 h-4"/>Trigger Payouts
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers||0} suffix="users" />
        <StatCard icon={DollarSign} label="Total Invested" value={stats?.totalInvested||0} delta={4.2} />
        <StatCard icon={TrendingUp} label="Profit Paid" value={stats?.totalProfitPaid||0} delta={8.5} />
        <StatCard icon={Wallet} label="System Reserve" value={stats?.systemReserve||0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#00ff88]"/>Profit Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={profitChartData}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" stroke="#475569" fontSize={11}/><YAxis stroke="#475569" fontSize={11}/><Tooltip contentStyle={{background:'rgba(15,23,42,0.9)',border:'1px solid rgba(0,255,136,0.2)',borderRadius:'12px',color:'#e2e8f0'}}/><Area type="monotone" dataKey="value" stroke="#00ff88" fill="url(#ag)" strokeWidth={2}/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-admin p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-[#00d4ff]"/>Trading Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={volumeChartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="name" stroke="#475569" fontSize={11}/><YAxis stroke="#475569" fontSize={11}/><Tooltip contentStyle={{background:'rgba(15,23,42,0.9)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:'12px',color:'#e2e8f0'}}/><Line type="monotone" dataKey="value" stroke="#00d4ff" strokeWidth={2} dot={false}/></LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-admin p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-[#00d4ff]"/>Users ({users.length})</h3>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="input-premium !py-2 !pl-9 !pr-4 w-52 text-sm"/></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs border-b border-white/5"><th className="pb-3 text-left font-medium">User</th><th className="pb-3 text-right font-medium">Balance</th><th className="pb-3 text-right font-medium">Invested</th><th className="pb-3 text-right font-medium">Earned</th><th className="pb-3 text-right font-medium">Refs</th><th className="pb-3 text-right font-medium"></th></tr></thead>
            <tbody>{filtered.map((u,i)=>(
              <motion.tr key={u.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-primary-600 flex items-center justify-center text-white font-bold text-xs">{u.username[0].toUpperCase()}</div><div><p className="text-white font-medium">{u.username}</p><p className="text-xs text-gray-500">{u.email}</p></div></div></td>
                <td className="py-3 text-right font-mono text-white">${u.balance.toFixed(2)}</td>
                <td className="py-3 text-right font-mono text-[#00d4ff]">${u.totalInvested.toFixed(2)}</td>
                <td className="py-3 text-right font-mono text-[#00ff88]">${u.totalEarned.toFixed(2)}</td>
                <td className="py-3 text-right text-gray-400">{u.referralsCount}</td>
                <td className="py-3 text-right"><motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={()=>setSelectedUser(u.id)} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronRight className="w-4 h-4 text-gray-500"/></motion.button></td>
              </motion.tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>{selectedUser && <UserDetailModal userId={selectedUser} onClose={()=>setSelectedUser(null)} />}</AnimatePresence>
    </div>
  );
}
