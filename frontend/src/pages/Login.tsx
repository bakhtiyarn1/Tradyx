import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Mail, Lock, User, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [referrerCode, setReferrerCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();

  // Auto-fill referrer from URL ?ref=username
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferrerCode(ref);
      setIsRegister(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = isRegister
        ? await register(username, email, password, referrerCode || undefined)
        : await login(email, password);
      if (!result.success) setError(result.message || 'Error');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="bg-animated" />
      <motion.div initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} className="w-full max-w-md">
        <div className="glass p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-[#00ff88] to-primary-600 rounded-2xl flex items-center justify-center shadow-lg glow-green">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-bold text-white">Tradyx</span>
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-2">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="text-gray-400 text-center text-sm mb-6">{isRegister ? 'Start your investment journey' : 'Sign in to your account'}</p>
          
          {error && <div className="mb-4 p-3 rounded-xl bg-[#ff3366]/10 border border-[#ff3366]/30 text-[#ff3366] text-sm">{error}</div>}
          
          {referrerCode && isRegister && (
            <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 flex-shrink-0"/>Referred by <span className="font-bold text-white">{referrerCode}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" required minLength={3}
                    className="input-premium pl-12" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required className="input-premium pl-12" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required minLength={8} className="input-premium pl-12" />
            </div>
            {isRegister && !referrerCode && (
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="text" value={referrerCode} onChange={e=>setReferrerCode(e.target.value)} placeholder="Referral code (optional)"
                  className="input-premium pl-12" />
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full btn-premium flex items-center justify-center gap-2 text-base">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><span>{isRegister ? 'Create Account' : 'Sign In'}</span><ArrowRight className="w-5 h-5"/></>}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={()=>{setIsRegister(!isRegister);setError('');}} className="text-sm text-gray-400 hover:text-[#00ff88] transition-colors">
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
