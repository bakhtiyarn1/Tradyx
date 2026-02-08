import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

export default function SlotMachineCounter({ value, prefix = '$', decimals = 2, className = '', duration = 0.6 }: Props) {
  const [display, setDisplay] = useState(value);
  const [anim, setAnim] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setAnim(true);
      const s = prev.current;
      const e = value;
      const st = Date.now();
      const d = duration * 1000;

      const go = () => {
        const p = Math.min((Date.now() - st) / d, 1);
        // Smooth ease-out-quint
        const eased = 1 - Math.pow(1 - p, 4);
        setDisplay(s + (e - s) * eased);
        if (p < 1) requestAnimationFrame(go);
        else { setAnim(false); prev.current = value; }
      };
      requestAnimationFrame(go);
    }
  }, [value, duration]);

  const f = display.toFixed(decimals);
  const [w, d2] = f.split('.');
  const fw = parseInt(w).toLocaleString();

  return (
    <div className={`inline-flex items-baseline font-mono tracking-tight ${className}`}>
      <span className="text-gray-400 mr-1 text-[0.6em]">{prefix}</span>
      <div className="relative">
        <AnimatePresence mode="popLayout">
          {fw.split('').map((c, i) => (
            <motion.span
              key={`${i}-${c}`}
              initial={{ y: anim ? -24 : 0, opacity: anim ? 0 : 1, filter: anim ? 'blur(3px)' : 'blur(0)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0)' }}
              exit={{ y: 20, opacity: 0, filter: 'blur(2px)' }}
              transition={{ duration: 0.2, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block"
            >
              {c}
            </motion.span>
          ))}
        </AnimatePresence>
        {decimals > 0 && (
          <>
            <span className="text-gray-500 opacity-60">.</span>
            <AnimatePresence mode="popLayout">
              {d2?.split('').map((c, i) => (
                <motion.span
                  key={`d-${i}-${c}`}
                  initial={{ y: anim ? -24 : 0, opacity: anim ? 0 : 1 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.2, delay: (fw.length + i) * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block text-gray-400 text-[0.85em]"
                >
                  {c}
                </motion.span>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
