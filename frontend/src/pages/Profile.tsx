import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, Mail, Copy, Check, Link2, Volume2, VolumeX, LogOut, Shield, Gift, Clipboard } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { userApi } from '../lib/api';
import type { Dashboard } from '../lib/api';
import { useToast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import SlotMachineCounter from '../components/SlotMachineCounter';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { userApi.getDashboard().then(setDashboard).catch(() => {}).finally(() => setLoading(false)); }, []);

  const referralLink = `${window.location.origin}/login?ref=${user?.username}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><UserCircle className="w-6 h-6 text-primary-400"/>Profile & Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:0.1}} className="glow-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"><div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/30 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/></div>
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green">
              <span className="text-3xl font-bold text-white">{user?.username?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user?.username}</h2>
              <p className="text-gray-400 flex items-center gap-2 mt-1"><Mail className="w-4 h-4"/>{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="glass p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Balance</p>
              <SlotMachineCounter value={dashboard?.balance || 0} className="text-lg font-bold text-[#00ff88]" decimals={2} />
            </div>
            <div className="glass p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Earned</p>
              <p className="text-lg font-bold text-[#00d4ff] font-mono">${dashboard?.totalEarned?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="glass p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Referrals</p>
              <p className="text-lg font-bold text-purple-400 font-mono">{dashboard?.referralsCount || 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Referral Section */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="glow-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><Gift className="w-5 h-5 text-purple-400"/></div>
          <div><h3 className="font-semibold text-white">Referral Program</h3><p className="text-xs text-gray-500">Earn 10% from your referrals' profits</p></div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Your referral code</label>
            <div className="glass p-3 flex items-center justify-between rounded-xl">
              <span className="text-lg font-bold text-[#00ff88] font-mono">{user?.username}</span>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={async ()=>{await navigator.clipboard.writeText(user?.username||'');toast.success('Code copied!');}}
                className="p-2 rounded-lg hover:bg-white/10"><Clipboard className="w-4 h-4 text-gray-400"/></motion.button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Shareable link</label>
            <div className="glass p-3 flex items-center gap-3 rounded-xl">
              <Link2 className="w-4 h-4 text-gray-500 flex-shrink-0"/>
              <span className="text-sm text-gray-300 truncate flex-1 font-mono">{referralLink}</span>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied?'bg-[#00ff88]/20 text-[#00ff88]':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {copied?<><Check className="w-3 h-3"/>Copied</>:<><Copy className="w-3 h-3"/>Copy</>}
              </motion.button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="glass p-4 text-center"><p className="text-xs text-gray-500 mb-1">Referrals joined</p><p className="text-2xl font-bold text-purple-400">{dashboard?.referralsCount || 0}</p></div>
            <div className="glass p-4 text-center"><p className="text-xs text-gray-500 mb-1">Today's bonus</p><p className="text-2xl font-bold text-[#00ff88]">${dashboard?.todayReferralBonus?.toFixed(2) || '0.00'}</p></div>
          </div>
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="glow-card p-6">
        <h3 className="font-semibold text-white mb-4">Settings</h3>
        <div className="space-y-3">
          {/* Sound toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-3">
              {soundsOn ? <Volume2 className="w-5 h-5 text-[#00ff88]"/> : <VolumeX className="w-5 h-5 text-gray-500"/>}
              <div><p className="text-sm text-white font-medium">Sound Effects</p><p className="text-xs text-gray-500">Cash register, cyber sounds, etc.</p></div>
            </div>
            <button onClick={()=>setSoundsOn(!soundsOn)}
              className={`relative w-12 h-7 rounded-full transition-all ${soundsOn?'bg-[#00ff88]/30':'bg-white/10'}`}>
              <motion.div layout className={`absolute top-1 w-5 h-5 rounded-full ${soundsOn?'bg-[#00ff88] left-6':'bg-gray-500 left-1'}`}/>
            </button>
          </div>

          {/* Admin badge */}
          {user?.email?.toLowerCase() === 'superadmin@tradyx.com' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff3366]/5 border border-[#ff3366]/20">
              <Shield className="w-5 h-5 text-[#ff3366]"/>
              <div><p className="text-sm text-white font-medium">Admin Access</p><p className="text-xs text-gray-500">God Mode enabled for this account</p></div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}}>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/15 transition-all">
          <LogOut className="w-5 h-5"/>Sign Out
        </motion.button>
      </motion.div>
    </div>
  );
}
