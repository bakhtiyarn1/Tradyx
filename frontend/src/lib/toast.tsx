import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; type: ToastType; message: string; }

const MAX_TOASTS = 5;

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(p => {
      const next = [...p, { id, type, message }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  const remove = useCallback((id: string) => setToasts(p => p.filter(t => t.id !== id)), []);

  const errorFn = useCallback((msg: string) => add('error', msg), [add]);
  const successFn = useCallback((msg: string) => add('success', msg), [add]);
  const infoFn = useCallback((msg: string) => add('info', msg), [add]);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg) errorFn(msg);
    };
    window.addEventListener('api-error', handler);
    return () => window.removeEventListener('api-error', handler);
  }, [errorFn]);

  const ctx: ToastContextType = { success: successFn, error: errorFn, info: infoFn };

  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const colors = {
    success: 'border-[#00ff88]/30 text-[#00ff88]',
    error: 'border-[#ff3366]/30 text-[#ff3366]',
    info: 'border-[#00d4ff]/30 text-[#00d4ff]',
  };
  const bgColors = {
    success: 'rgba(0,255,136,0.08)',
    error: 'rgba(255,51,102,0.08)',
    info: 'rgba(0,212,255,0.08)',
  };
  const glows = {
    success: '0 0 20px rgba(0,255,136,0.1)',
    error: '0 0 20px rgba(255,51,102,0.1)',
    info: '0 0 20px rgba(0,212,255,0.1)',
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t, idx) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 80, scale: 0.85, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: 60, scale: 0.9, filter: 'blur(4px)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ background: bgColors[t.type], boxShadow: glows[t.type] }}
                className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-2xl max-w-sm ${colors[t.type]}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium text-white flex-1 leading-snug">{t.message}</span>
                <motion.button
                  whileHover={{ scale: 1.2, rotate: 90 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => remove(t.id)}
                  className="p-1 rounded-lg hover:bg-white/10 flex-shrink-0 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </motion.button>

                {/* Progress bar */}
                <motion.div
                  className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl"
                  style={{ background: t.type === 'success' ? '#00ff88' : t.type === 'error' ? '#ff3366' : '#00d4ff', opacity: 0.4 }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 4.5, ease: 'linear' }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
