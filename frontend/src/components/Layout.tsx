import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, TrendingUp, Receipt, Bell, LogOut, Menu, X, ChevronDown, Check, Bot, Shield, Wallet, UserCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { userApi } from '../lib/api';
import type { Notification } from '../lib/api';
import { useSignalR } from '../hooks/useSignalR';
import { useToast } from '../lib/toast';
import LiveActivity from './LiveActivity';

const baseNav = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
  { path: '/investments', icon: TrendingUp, label: 'Investments' },
  { path: '/transactions', icon: Receipt, label: 'Transactions' },
  { path: '/profile', icon: UserCircle, label: 'Profile' },
];
const adminNav = { path: '/admin', icon: Shield, label: 'God Mode', isAdmin: true };

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await userApi.getNotifications();
      setNotifs(d.notifications || []);
      setUnread(d.unreadCount || 0);
    } catch {}
  }, []);

  // Initial load + every 60s as fallback (SignalR is primary)
  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [load]);

  // Listen for SignalR-triggered refreshes via custom event
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('signalr:notification', handler);
    return () => window.removeEventListener('signalr:notification', handler);
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await userApi.markNotificationRead(id);
      setNotifs(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(p => Math.max(0, p - 1));
    } catch {}
  };

  const fmt = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h` : m > 0 ? `${m}m` : 'Now';
  };

  return (
    <div className="relative">
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setOpen(!open)} className="relative p-2.5 glass rounded-xl hover:border-primary-500/30">
        <Bell className="w-5 h-5 text-gray-400" />
        {unread > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 w-5 h-5 bg-[#00ff88] text-dark-900 text-xs rounded-full flex items-center justify-center font-bold">{unread > 9 ? '9+' : unread}</motion.span>}
      </motion.button>
      <AnimatePresence>
        {open && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-3 w-80 glass p-0 overflow-hidden z-50">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unread > 0 && (
                <button onClick={async () => { try { await userApi.markAllNotificationsRead(); setNotifs(p => p.map(n => ({ ...n, isRead: true }))); setUnread(0); } catch {} }} className="text-xs text-primary-400 hover:text-[#00ff88] flex items-center gap-1">
                  <Check className="w-3 h-3" />Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="p-8 text-center"><Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-sm">No notifications</p></div>
              ) : notifs.slice(0, 10).map(n => (
                <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} onClick={() => !n.isRead && markRead(n.id)} className={`p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer ${!n.isRead ? 'bg-primary-500/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    {!n.isRead && <span className="w-2 h-2 bg-[#00ff88] rounded-full mt-2 flex-shrink-0 animate-pulse" />}
                    <div className={!n.isRead ? '' : 'ml-5'}><p className="text-sm text-gray-300">{n.message}</p><p className="text-xs text-gray-500 mt-1">{fmt(n.createdAt)}</p></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>}
      </AnimatePresence>
    </div>
  );
}

function UserDropdown() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="relative">
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setOpen(!open)} className="flex items-center gap-3 p-2 glass rounded-xl hover:border-primary-500/30">
        <div className="w-9 h-9 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-lg flex items-center justify-center shadow-lg"><span className="text-white text-sm font-bold">{user?.username?.charAt(0).toUpperCase()}</span></div>
        <span className="hidden md:block text-gray-300 text-sm font-medium">{user?.username}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </motion.button>
      <AnimatePresence>
        {open && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-3 w-56 glass p-2 z-50">
            <div className="p-3 border-b border-white/5 mb-2"><p className="font-medium text-white">{user?.username}</p><p className="text-sm text-gray-500 truncate">{user?.email}</p></div>
            <motion.button whileHover={{ x: 4 }} onClick={() => { logout(); nav('/login'); }} className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl"><LogOut className="w-4 h-4" />Sign Out</motion.button>
          </motion.div>
        </>}
      </AnimatePresence>
    </div>
  );
}

/**
 * Centralized SignalR listener — manages connection for the whole app,
 * dispatches custom DOM events so any component can react.
 */
function SignalRProvider() {
  const toast = useToast();

  useSignalR({
    onBalanceUpdated: (newBalance) => {
      window.dispatchEvent(new CustomEvent('signalr:balance', { detail: newBalance }));
    },
    onPayoutReceived: (amount, description) => {
      toast.success(`+$${amount.toFixed(2)} — ${description}`);
      window.dispatchEvent(new CustomEvent('signalr:payout', { detail: { amount, description } }));
      // also trigger dashboard + notification refresh
      window.dispatchEvent(new Event('signalr:dashboard-refresh'));
      window.dispatchEvent(new Event('signalr:notification'));
    },
    onNotificationReceived: (message) => {
      window.dispatchEvent(new Event('signalr:notification'));
    },
    onInvestmentUpdated: () => {
      window.dispatchEvent(new Event('signalr:investment'));
      window.dispatchEvent(new Event('signalr:dashboard-refresh'));
    },
    onTransactionCreated: (type, amount) => {
      window.dispatchEvent(new CustomEvent('signalr:transaction', { detail: { type, amount } }));
      window.dispatchEvent(new Event('signalr:dashboard-refresh'));
    },
  });

  return null; // no UI
}

export default function Layout() {
  const [sidebar, setSidebar] = useState(false);
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === 'superadmin@tradyx.com';
  const nav = useMemo(() => isAdmin ? [...baseNav, adminNav] : baseNav, [isAdmin]);

  return (
    <div className="min-h-screen relative">
      {/* Centralized SignalR connection */}
      <SignalRProvider />
      <div className="bg-animated" /><div className="absolute inset-0 grid-pattern opacity-30" />
      <header className="lg:hidden sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setSidebar(true)} className="p-2.5 glass rounded-xl"><Menu className="w-5 h-5 text-gray-400" /></button>
          <Link to="/dashboard" className="flex items-center gap-2"><div className="w-9 h-9 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-white" /></div><span className="font-bold text-white text-lg">Tradyx</span></Link>
          <div className="flex items-center gap-2"><NotificationsDropdown /><UserDropdown /></div>
        </div>
      </header>
      <AnimatePresence>{sidebar && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebar(false)} />}</AnimatePresence>
      <aside className={`fixed top-0 left-0 h-full w-72 glass border-r border-white/5 z-50 transform transition-transform duration-300 lg:translate-x-0 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6"><div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3"><div className="w-12 h-12 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"><TrendingUp className="w-7 h-7 text-white" /></div><span className="text-2xl font-bold text-white">Tradyx</span></Link>
          <button onClick={() => setSidebar(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div></div>
        <div className="px-6 mb-6"><div className="glass p-4 bg-gradient-to-r from-primary-500/10 to-transparent"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-[#00ff88]" /></div><div><p className="text-sm font-medium text-white">AI Engine</p><div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" /><span className="text-xs text-[#00ff88]">Online</span></div></div></div></div></div>
        <nav className="px-4 space-y-2">
          {nav.map(item => { const active = loc.pathname === item.path, adm = 'isAdmin' in item && item.isAdmin; return (
            <Link key={item.path} to={item.path} onClick={() => setSidebar(false)}>
              <motion.div whileHover={{ x: 4 }} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${active ? (adm ? 'bg-gradient-to-r from-[#ff3366]/20 to-transparent text-white border-l-2 border-[#ff3366]' : 'bg-gradient-to-r from-primary-500/20 to-transparent text-white border-l-2 border-[#00ff88]') : (adm ? 'text-[#ff3366] hover:bg-[#ff3366]/10' : 'text-gray-400 hover:bg-white/5 hover:text-white')}`}>
                <item.icon className={`w-5 h-5 ${active ? (adm ? 'text-[#ff3366]' : 'text-[#00ff88]') : (adm ? 'text-[#ff3366]' : '')}`} /><span className="font-medium">{item.label}</span>
                {active && <motion.div layoutId="activeNav" className={`ml-auto w-1.5 h-1.5 rounded-full ${adm ? 'bg-[#ff3366]' : 'bg-[#00ff88]'}`} />}
              </motion.div>
            </Link>
          ); })}
        </nav>
        <div className="px-4 mt-6"><LiveActivity /></div>
      </aside>
      <div className="lg:pl-72 relative z-10">
        <header className="hidden lg:block sticky top-0 z-50 glass border-b border-white/5">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="live-feed-badge"><span className="dot" /><span>System Online &mdash; Real-time</span></div>
            <div className="flex items-center gap-3"><NotificationsDropdown /><UserDropdown /></div>
          </div>
        </header>
        <main className="p-4 lg:p-8 relative"><Outlet /></main>
      </div>
    </div>
  );
}
