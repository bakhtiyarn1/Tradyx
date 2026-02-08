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

/* ── Notification Panel ──────────────────────────── */
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

  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, [load]);
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
    const day = Math.floor(h / 24);
    if (day > 0) return `${day}d`;
    return h > 0 ? `${h}h` : m > 0 ? `${m}m` : 'Now';
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(!open)}
        className="relative p-2.5 glass rounded-xl hover:border-primary-500/20 transition-all duration-300"
      >
        <Bell className="w-5 h-5 text-gray-400 transition-colors group-hover:text-white" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-[#00ff88] text-dark-900 text-[10px] rounded-full flex items-center justify-center font-bold px-1 shadow-[0_0_8px_rgba(0,255,136,0.5)]"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute right-0 mt-3 w-80 glass p-0 overflow-hidden z-50 shadow-2xl"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
                <h3 className="font-semibold text-white text-sm">Notifications</h3>
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      try { await userApi.markAllNotificationsRead(); setNotifs(p => p.map(n => ({ ...n, isRead: true }))); setUnread(0); } catch {}
                    }}
                    className="text-xs text-primary-400 hover:text-[#00ff88] flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3 h-3" />Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No notifications yet</p>
                  </div>
                ) : notifs.slice(0, 10).map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => !n.isRead && markRead(n.id)}
                    className={`p-4 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-all duration-300 ${!n.isRead ? 'bg-primary-500/[0.04]' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {!n.isRead && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 bg-[#00ff88] rounded-full mt-2 flex-shrink-0 shadow-[0_0_6px_rgba(0,255,136,0.5)]"
                        />
                      )}
                      <div className={!n.isRead ? '' : 'ml-5'}>
                        <p className="text-sm text-gray-300 leading-relaxed">{n.message}</p>
                        <p className="text-[11px] text-gray-600 mt-1.5">{fmt(n.createdAt)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── User Dropdown ────────────────────────────────── */
function UserDropdown() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-2 glass rounded-xl hover:border-primary-500/20 transition-all duration-300"
      >
        <div className="w-9 h-9 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-bold">{user?.username?.charAt(0).toUpperCase()}</span>
        </div>
        <span className="hidden md:block text-gray-300 text-sm font-medium">{user?.username}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute right-0 mt-3 w-56 glass p-2 z-50 shadow-2xl"
            >
              <div className="p-3 border-b border-white/5 mb-2">
                <p className="font-medium text-white">{user?.username}</p>
                <p className="text-sm text-gray-500 truncate">{user?.email}</p>
              </div>
              <motion.button
                whileHover={{ x: 4, backgroundColor: 'rgba(239,68,68,0.1)' }}
                onClick={() => { logout(); nav('/login'); }}
                className="w-full flex items-center gap-3 p-3 text-red-400 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />Sign Out
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── SignalR Provider ─────────────────────────────── */
function SignalRProvider() {
  const toast = useToast();

  useSignalR({
    onBalanceUpdated: (newBalance) => {
      window.dispatchEvent(new CustomEvent('signalr:balance', { detail: newBalance }));
    },
    onPayoutReceived: (amount, description) => {
      toast.success(`+$${amount.toFixed(2)} — ${description}`);
      window.dispatchEvent(new CustomEvent('signalr:payout', { detail: { amount, description } }));
      window.dispatchEvent(new Event('signalr:dashboard-refresh'));
      window.dispatchEvent(new Event('signalr:notification'));
    },
    onNotificationReceived: () => {
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
    onStatusUpgraded: (_oldRank, _newRank, newRankName) => {
      window.dispatchEvent(new CustomEvent('signalr:rank-upgraded', { detail: { newRankName } }));
      window.dispatchEvent(new Event('signalr:dashboard-refresh'));
    },
  });

  return null;
}

/* ── Main Layout ──────────────────────────────────── */
export default function Layout() {
  const [sidebar, setSidebar] = useState(false);
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === 'superadmin@tradyx.com';
  const nav = useMemo(() => isAdmin ? [...baseNav, adminNav] : baseNav, [isAdmin]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebar(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen relative">
      <SignalRProvider />
      <div className="bg-animated" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* ─── Mobile Header ─── */}
      <header className="lg:hidden sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebar(true)}
            className="p-2.5 glass rounded-xl"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </motion.button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">Tradyx</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <UserDropdown />
          </div>
        </div>
      </header>

      {/* ─── Mobile Overlay ─── */}
      <AnimatePresence>
        {sidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─── */}
      <aside className={`fixed top-0 left-0 h-full w-72 glass border-r border-white/5 z-50 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] lg:translate-x-0 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5 }}
                className="w-12 h-12 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"
              >
                <TrendingUp className="w-7 h-7 text-white" />
              </motion.div>
              <span className="text-2xl font-bold text-white group-hover:text-[#00ff88] transition-colors duration-300">Tradyx</span>
            </Link>
            <button
              onClick={() => setSidebar(false)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* AI Engine Badge */}
        <div className="px-6 mb-6">
          <div className="glass p-4 bg-gradient-to-r from-primary-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center animate-float-slow">
                <Bot className="w-5 h-5 text-[#00ff88]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">AI Engine</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#00ff88] rounded-full shadow-[0_0_6px_rgba(0,255,136,0.6)]" style={{ animation: 'statusPulse 2.5s ease-in-out infinite' }} />
                  <span className="text-xs text-[#00ff88]">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 space-y-1">
          {nav.map((item) => {
            const active = loc.pathname === item.path;
            const adm = 'isAdmin' in item && item.isAdmin;

            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileHover={{ x: 6 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                    active
                      ? adm
                        ? 'bg-gradient-to-r from-[#ff3366]/15 to-transparent text-white'
                        : 'bg-gradient-to-r from-primary-500/15 to-transparent text-white'
                      : adm
                        ? 'text-[#ff3366]/70 hover:bg-[#ff3366]/5 hover:text-[#ff3366]'
                        : 'text-gray-400 hover:bg-white/[0.03] hover:text-white'
                  }`}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${adm ? 'bg-[#ff3366]' : 'bg-[#00ff88]'}`}
                      style={{ boxShadow: adm ? '0 0 10px rgba(255,51,102,0.5)' : '0 0 10px rgba(0,255,136,0.5)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <item.icon className={`w-5 h-5 transition-colors duration-300 ${
                    active ? (adm ? 'text-[#ff3366]' : 'text-[#00ff88]') : (adm ? 'text-[#ff3366]/50' : '')
                  }`} />
                  <span className="font-medium">{item.label}</span>

                  {active && (
                    <motion.div
                      layoutId="activeNavDot"
                      className={`ml-auto w-1.5 h-1.5 rounded-full ${adm ? 'bg-[#ff3366]' : 'bg-[#00ff88]'}`}
                      style={{ boxShadow: adm ? '0 0 6px rgba(255,51,102,0.6)' : '0 0 6px rgba(0,255,136,0.6)' }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-6">
          <LiveActivity />
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="lg:pl-72 relative z-10">
        <header className="hidden lg:block sticky top-0 z-50 glass border-b border-white/5">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="live-feed-badge">
              <span className="dot" />
              <span>System Online &mdash; Real-time</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationsDropdown />
              <UserDropdown />
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
