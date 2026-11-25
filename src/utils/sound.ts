// Lightweight Web Audio API sound effects (no external audio assets required)
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('sfx_muted') === '1') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gainVal = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export const sfx = {
  isMuted: () => typeof window !== 'undefined' && localStorage.getItem('sfx_muted') === '1',
  toggleMute: () => {
    const next = !sfx.isMuted();
    localStorage.setItem('sfx_muted', next ? '1' : '0');
    return next;
  },
  dice: () => {
    [220, 280, 340, 420].forEach((f, i) => tone(f, 0.06, 'triangle', i * 0.05, 0.07));
  },
  ladder: () => {
    [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(f, 0.12, 'triangle', i * 0.08, 0.09));
  },
  snake: () => {
    [440, 349.23, 293.66, 220].forEach((f, i) => tone(f, 0.14, 'sawtooth', i * 0.08, 0.05));
  },
  correct: () => {
    tone(523.25, 0.12, 'triangle', 0, 0.09);
    tone(659.25, 0.12, 'triangle', 0.1, 0.09);
    tone(783.99, 0.25, 'triangle', 0.2, 0.1);
  },
  wrong: () => {
    tone(240, 0.18, 'sawtooth', 0, 0.06);
    tone(190, 0.28, 'sawtooth', 0.16, 0.06);
  },
  victory: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.11, 0.1));
  },
};
