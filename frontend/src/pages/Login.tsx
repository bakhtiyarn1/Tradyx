import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Mail, Lock, User, ArrowRight, Users, Eye, EyeOff, MessageCircle, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';

/* ── Floating Orb ──── */
function FloatingOrb({ delay, size, color, x, y }: { delay: number; size: number; color: string; x: string; y: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 6, delay, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute rounded-full blur-3xl pointer-events-none"
      style={{ width: size, height: size, background: color, left: x, top: y }}
    />
  );
}

/* ── Telegram Icon ──── */
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

type LoginMode = 'telegram' | 'email';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('telegram');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [referrerCode, setReferrerCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [tgBotUrl, setTgBotUrl] = useState('');
  const [tgToken, setTgToken] = useState('');
  const { login, register, loginWithTelegram, pollTelegramAuth, cancelTelegramPoll, telegramAuthStatus } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) { setReferrerCode(ref); setIsRegister(true); }
  }, [searchParams]);

  // Cleanup Telegram poll on unmount
  useEffect(() => {
    return () => cancelTelegramPoll();
  }, [cancelTelegramPoll]);

  const handleTelegramLogin = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithTelegram(referrerCode || undefined);
      setTgBotUrl(result.botUrl);
      setTgToken(result.token);
      // Open Telegram in new window
      window.open(result.botUrl, '_blank');
      // Start polling
      pollTelegramAuth(result.token);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to initialize Telegram login');
    } finally {
      setLoading(false);
    }
  }, [loginWithTelegram, pollTelegramAuth, referrerCode]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = isRegister
        ? await register(username, email, password, referrerCode || undefined)
        : await login(email, password);
      if (!result.success) setError(result.message || 'Error');
    } finally { setLoading(false); }
  };

  const inputClass = 'input-premium pl-12 pr-4';

  // Determine if we're in the "waiting for Telegram" state
  const isWaitingTelegram = telegramAuthStatus === 'waiting' && tgToken;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="bg-animated" />

      {/* Decorative floating orbs */}
      <FloatingOrb delay={0} size={300} color="rgba(0,255,136,0.08)" x="10%" y="20%" />
      <FloatingOrb delay={1} size={250} color="rgba(0,212,255,0.06)" x="70%" y="60%" />
      <FloatingOrb delay={2} size={200} color="rgba(168,85,247,0.05)" x="50%" y="10%" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass p-8 relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-[#00ff88]/50 to-transparent" />

          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-14 h-14 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green"
            >
              <TrendingUp className="w-8 h-8 text-white" />
            </motion.div>
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white"
            >
              Tradyx
            </motion.span>
          </div>

          {/* Title */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isWaitingTelegram ? 'waiting' : mode + (isRegister ? '-reg' : '-login')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="text-center mb-6"
            >
              {isWaitingTelegram ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">Waiting for Telegram</h2>
                  <p className="text-gray-400 text-sm">Confirm login in the Telegram app</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">
                    {mode === 'telegram' ? 'Login via Telegram' : isRegister ? 'Create Account' : 'Welcome Back'}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {mode === 'telegram' ? 'One click, no passwords' : isRegister ? 'Start your investment journey' : 'Sign in with email'}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-3 rounded-xl bg-[#ff3366]/10 border border-[#ff3366]/20 text-[#ff3366] text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Referral badge */}
          <AnimatePresence>
            {referrerCode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm flex items-center gap-2"
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                Referred by <span className="font-bold text-white">{referrerCode}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ── Waiting for Telegram Confirmation ── */}
            {isWaitingTelegram ? (
              <motion.div
                key="tg-waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-5"
              >
                {/* Animated waiting indicator */}
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="w-16 h-16 rounded-full border-2 border-[#0088cc]/20 border-t-[#0088cc]"
                    />
                    <TelegramIcon className="w-7 h-7 text-[#0088cc] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-gray-300 text-sm">
                      Click <span className="text-[#0088cc] font-medium">Start</span> in the Telegram bot
                    </p>
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>Link expires in 5 minutes</span>
                    </div>
                  </div>
                </div>

                {/* Re-open Telegram button */}
                <a
                  href={tgBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/20 text-[#0088cc] hover:bg-[#0088cc]/20 transition-colors text-sm"
                >
                  <TelegramIcon className="w-4 h-4" />
                  Open Telegram again
                </a>

                {/* Cancel */}
                <button
                  onClick={() => { cancelTelegramPoll(); setTgToken(''); setTgBotUrl(''); }}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                >
                  Cancel
                </button>
              </motion.div>
            ) : telegramAuthStatus === 'expired' ? (
              <motion.div
                key="tg-expired"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-5"
              >
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-500" />
                  </div>
                  <p className="text-gray-300 text-sm text-center">Login link expired. Please try again.</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTelegramLogin}
                  className="w-full btn-premium flex items-center justify-center gap-2 text-base"
                >
                  <TelegramIcon className="w-5 h-5" />
                  Try again
                </motion.button>
              </motion.div>
            ) : mode === 'telegram' ? (
              /* ── Telegram Login Mode ── */
              <motion.div
                key="tg-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <motion.button
                  onClick={handleTelegramLogin}
                  disabled={loading}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-xl font-semibold text-white text-base transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #0088cc 0%, #0077b5 100%)',
                    boxShadow: '0 4px 20px rgba(0,136,204,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <TelegramIcon className="w-6 h-6" />
                      <span>Login with Telegram</span>
                    </>
                  )}
                </motion.button>

                {/* Benefits */}
                <div className="space-y-2 pt-2">
                  {[
                    { icon: <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />, text: 'No passwords — instant login' },
                    { icon: <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />, text: 'Auto-registration for new users' },
                    { icon: <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />, text: 'Manage via bot + web dashboard' },
                  ].map((b, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-center gap-2 text-sm text-gray-400"
                    >
                      {b.icon}
                      <span>{b.text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#0d1117] text-gray-500">or</span>
                  </div>
                </div>

                {/* Email fallback */}
                <button
                  onClick={() => setMode('email')}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm text-gray-400 hover:text-white border border-white/5 hover:border-white/10 transition-all duration-300"
                >
                  <Mail className="w-4 h-4" />
                  <span>Login with Email</span>
                </button>
              </motion.div>
            ) : (
              /* ── Email Login Mode ── */
              <motion.div
                key="email-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <AnimatePresence>
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="relative mb-4">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="text" value={username} onChange={e => setUsername(e.target.value)}
                            placeholder="Username" required minLength={3}
                            className={inputClass}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Email" required
                      className={inputClass}
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Password" required minLength={8}
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isRegister && !referrerCode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="relative">
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="text" value={referrerCode} onChange={e => setReferrerCode(e.target.value)}
                            placeholder="Referral code (optional)"
                            className={inputClass}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full btn-premium flex items-center justify-center gap-2 text-base mt-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setIsRegister(!isRegister); setError(''); }}
                    className="text-sm text-gray-400 hover:text-[#00ff88] transition-colors duration-300"
                  >
                    {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative py-3 mt-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#0d1117] text-gray-500">or</span>
                  </div>
                </div>

                {/* Back to Telegram */}
                <button
                  onClick={() => { setMode('telegram'); setError(''); }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300"
                  style={{ color: '#0088cc', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.15)' }}
                >
                  <TelegramIcon className="w-4 h-4" />
                  <span>Login with Telegram</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom subtle glow */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 h-16 bg-[#00ff88]/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>
    </div>
  );
}
