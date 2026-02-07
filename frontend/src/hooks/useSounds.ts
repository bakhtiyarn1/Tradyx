import { useCallback, useRef } from 'react';

let audioContext: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioContext) audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioContext;
}

function playCashRegisterRaw() {
  try {
    const ctx = getCtx(); const now = ctx.currentTime;
    const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
    o1.type = 'sine'; o1.frequency.setValueAtTime(1200, now); o1.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    g1.gain.setValueAtTime(0.3, now); g1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o1.connect(g1); g1.connect(ctx.destination); o1.start(now); o1.stop(now + 0.3);
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(1400, now + 0.1); o2.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    g2.gain.setValueAtTime(0.25, now + 0.1); g2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    o2.connect(g2); g2.connect(ctx.destination); o2.start(now + 0.1); o2.stop(now + 0.4);
  } catch {}
}

function playCyberRaw() {
  try {
    const ctx = getCtx(); const now = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(800, now + 0.15); o.frequency.exponentialRampToValueAtTime(400, now + 0.3);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2000, now); f.frequency.exponentialRampToValueAtTime(500, now + 0.3);
    g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.35);
  } catch {}
}

function playSuccessRaw() {
  try {
    const ctx = getCtx(); const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.08); g.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.02); g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
      o.connect(g); g.connect(ctx.destination); o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.35);
    });
  } catch {}
}

function playErrorRaw() {
  try {
    const ctx = getCtx(); const now = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(200, now); o.frequency.linearRampToValueAtTime(100, now + 0.2);
    g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.3);
  } catch {}
}

export function useSounds() {
  const enabled = useRef(true);
  return {
    playCashRegister: useCallback(() => { if (enabled.current) playCashRegisterRaw(); }, []),
    playCyber: useCallback(() => { if (enabled.current) playCyberRaw(); }, []),
    playSuccess: useCallback(() => { if (enabled.current) playSuccessRaw(); }, []),
    playError: useCallback(() => { if (enabled.current) playErrorRaw(); }, []),
    playClick: useCallback(() => {}, []),
    toggleSounds: useCallback((e: boolean) => { enabled.current = e; }, []),
  };
}
