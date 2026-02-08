import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Mail, Copy, Check, Link2, Volume2, VolumeX, LogOut, Shield, Gift, Clipboard, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { userApi } from '../lib/api';
import type { Dashboard, ReferralTeam } from '../lib/api';
import { useToast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import SlotMachineCounter from '../components/SlotMachineCounter';

function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-pulse">
      <div><div className="skeleton w-48 h-8 mb-2" /><div className="skeleton w-40 h-4" /></div>
      <div className="skeleton h-56 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [team, setTeam] = useState<ReferralTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    Promise.all([
      userApi.getDashboard().then(setDashboard).catch(() => {}),
      userApi.getMyTeam().then(setTeam).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const inviteCode = dashboard?.inviteCode || '';
  const referralLink = `${window.location.origin}/login?ref=${inviteCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) return <ProfileSkeleton />;

  const levelConfig = [
    { label: 'Level 1 — Direct', color: 'text-[#00ff88]', bg: 'bg-[#00ff88]/10', members: team?.level1 || [], pct: '10%' },
    { label: 'Level 2', color: 'text-[#00d4ff]', bg: 'bg-[#00d4ff]/10', members: team?.level2 || [], pct: '5%' },
    { label: 'Level 3', color: 'text-purple-400', bg: 'bg-purple-500/10', members: team?.level3 || [], pct: '2%' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><UserCircle className="w-6 h-6 text-primary-400" />Profile & Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glow-card p-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/30 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-breathe" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-6">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 3 }}
              className="w-20 h-20 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"
            >
              <span className="text-3xl font-bold text-white">{user?.username?.charAt(0).toUpperCase()}</span>
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user?.username}</h2>
              <p className="text-gray-400 flex items-center gap-2 mt-1"><Mail className="w-4 h-4" />{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Balance', value: dashboard?.balance || 0, isCounter: true, color: 'text-[#00ff88]' },
              { label: 'Total Earned', value: dashboard?.totalEarned || 0, color: 'text-[#00d4ff]' },
              { label: 'Referral Earned', value: dashboard?.totalReferralEarned || 0, color: 'text-purple-400' },
              { label: 'Team Size', value: team?.stats?.totalMembers || 0, isInt: true, color: 'text-amber-400' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.06 }}
                className="glass p-4 text-center"
              >
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                {stat.isCounter ? (
                  <SlotMachineCounter value={stat.value as number} className={`text-lg font-bold ${stat.color}`} decimals={2} />
                ) : (
                  <p className={`text-lg font-bold ${stat.color} font-mono`}>
                    {stat.isInt ? stat.value : `$${(stat.value as number).toFixed(2)}`}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Referral Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glow-card p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">3-Level Referral Program</h3>
            <p className="text-xs text-gray-500">L1: 10% &bull; L2: 5% &bull; L3: 2% from referrals' profits</p>
          </div>
        </div>
        <div className="space-y-4">
          {/* Invite Code */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Your invite code</label>
            <div className="glass p-3 flex items-center justify-between rounded-xl">
              <span className="text-lg font-bold text-[#00ff88] font-mono tracking-wider">{inviteCode || '...'}</span>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={copyCode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${copiedCode ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {copiedCode ? <><Check className="w-3 h-3" />Copied</> : <Clipboard className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>

          {/* Shareable Link */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Shareable link</label>
            <div className="glass p-3 flex items-center gap-3 rounded-xl">
              <Link2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-300 truncate flex-1 font-mono">{referralLink}</span>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${copied ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </motion.button>
            </div>
          </div>

          {/* Level Counters */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {levelConfig.map((lvl, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.06 }}
                whileHover={{ y: -2, scale: 1.02 }}
                className="glass p-4 text-center transition-all duration-300"
              >
                <p className="text-xs text-gray-500 mb-1">L{idx + 1} Referrals</p>
                <p className={`text-2xl font-bold ${lvl.color}`}>{lvl.members.length}</p>
                <p className="text-xs text-gray-600 mt-0.5">{lvl.pct} bonus</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* My Team */}
      {team && (team.level1.length > 0 || team.level2.length > 0 || team.level3.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glow-card p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/20 flex items-center justify-center"><Users className="w-5 h-5 text-[#00d4ff]" /></div>
            <div><h3 className="font-semibold text-white">My Team</h3><p className="text-xs text-gray-500">{team.stats.totalMembers} members across 3 levels</p></div>
          </div>

          {levelConfig.map((lvl, idx) => lvl.members.length > 0 && (
            <div key={idx} className="mb-5 last:mb-0">
              <p className={`text-xs font-medium ${lvl.color} mb-2`}>{lvl.label} ({lvl.members.length})</p>
              <div className="space-y-2">
                {lvl.members.slice(0, 10).map((m, mi) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: mi * 0.03 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${lvl.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                        <span className={`text-sm font-bold ${lvl.color}`}>{m.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{m.username}</p>
                        <p className="text-xs text-gray-500">{new Date(m.joinedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-[#00ff88]">${m.totalEarned.toFixed(2)}</p>
                      <p className="text-xs text-gray-600">earned</p>
                    </div>
                  </motion.div>
                ))}
                {lvl.members.length > 10 && <p className="text-xs text-gray-500 text-center py-1">+{lvl.members.length - 10} more</p>}
              </div>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#00ff88]" /><span className="text-sm text-gray-400">Total referral earnings</span></div>
            <span className="text-lg font-bold text-[#00ff88] font-mono">${team.stats.totalEarned.toFixed(2)}</span>
          </div>
        </motion.div>
      )}

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glow-card p-6"
      >
        <h3 className="font-semibold text-white mb-4">Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200">
            <div className="flex items-center gap-3">
              {soundsOn ? <Volume2 className="w-5 h-5 text-[#00ff88]" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
              <div><p className="text-sm text-white font-medium">Sound Effects</p><p className="text-xs text-gray-500">Cash register, cyber sounds, etc.</p></div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSoundsOn(!soundsOn)}
              className={`relative w-12 h-7 rounded-full transition-all duration-300 ${soundsOn ? 'bg-[#00ff88]/25' : 'bg-white/8'}`}
            >
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`absolute top-1 w-5 h-5 rounded-full shadow-md ${soundsOn ? 'bg-[#00ff88] left-6' : 'bg-gray-500 left-1'}`}
              />
            </motion.button>
          </div>
          {user?.email?.toLowerCase() === 'superadmin@tradyx.com' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-3 rounded-xl bg-[#ff3366]/5 border border-[#ff3366]/15">
              <Shield className="w-5 h-5 text-[#ff3366]" />
              <div><p className="text-sm text-white font-medium">Admin Access</p><p className="text-xs text-gray-500">God Mode enabled</p></div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 font-medium hover:bg-red-500/12 transition-all duration-300"
        >
          <LogOut className="w-5 h-5" />Sign Out
        </motion.button>
      </motion.div>
    </div>
  );
}
