import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        // Force full reload so AuthProvider picks up token from localStorage
        window.location.href = '/admin';
        return;
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="bg-animated" />

      {/* Dark theme admin orbs */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.15, 1], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 350, height: 350, background: 'rgba(239,68,68,0.06)', left: '15%', top: '25%' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0.08, 0.15, 0.08], scale: [1, 1.2, 1], y: [0, -20, 0] }}
        transition={{ duration: 7, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 280, height: 280, background: 'rgba(168,85,247,0.06)', right: '10%', bottom: '20%' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass p-8 relative overflow-hidden">
          {/* Red/purple admin glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />

          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-14 h-14 bg-gradient-to-br from-red-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 0 30px rgba(239,68,68,0.3)' }}
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white block"
              >
                Tradyx
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xs font-medium text-red-400 tracking-widest uppercase"
              >
                Admin Panel
              </motion.span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Administrator Access</h2>
            <p className="text-gray-500 text-sm">Restricted area. Authorized personnel only.</p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Admin Email"
                required
                className="input-premium pl-12 pr-4"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="input-premium pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-white text-base transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #9333ea 100%)',
                boxShadow: '0 4px 20px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Security notice */}
          <p className="text-center text-[11px] text-gray-600 mt-6">
            All login attempts are logged and monitored
          </p>
        </div>

        {/* Bottom glow */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 h-16 bg-red-500/8 rounded-full blur-3xl pointer-events-none" />
      </motion.div>
    </div>
  );
}
