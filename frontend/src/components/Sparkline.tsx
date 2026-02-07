import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Props { data: number[]; width?: number; height?: number; color?: string; showGradient?: boolean; }

export default function Sparkline({ data, width = 80, height = 30, color = '#10b981', showGradient = true }: Props) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height * 0.8 - height * 0.1}`);
    return `M ${pts.join(' L ')}`;
  }, [data, width, height]);
  const area = useMemo(() => data.length < 2 ? '' : `${path} L ${width},${height} L 0,${height} Z`, [path, width, height, data.length]);
  const isPos = data.length >= 2 && data[data.length - 1] >= data[0];
  const c = isPos ? color : '#ff3366';
  const gId = useMemo(() => `sp-${Math.random().toString(36).substr(2, 6)}`, []);
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs><linearGradient id={gId} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={c} stopOpacity="0.3" /><stop offset="100%" stopColor={c} stopOpacity="0" /></linearGradient></defs>
      {showGradient && <motion.path d={area} fill={`url(#${gId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />}
      <motion.path d={path} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
    </svg>
  );
}
