const STORAGE_KEY = 'infopanel-sound-enabled';

let audioCtx: AudioContext | null = null;

export function isInfopanelSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setInfopanelSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // ignore
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Browsers block audio until a user gesture — call on click/tap on the infopanel. */
export function unlockInfopanelAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    void ctx.resume();
  }
}

function playTone(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.12) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Short two-tone chime for a new task on the infopanel. */
export function playInfopanelNewTaskSound() {
  if (!isInfopanelSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') return;

  const t = ctx.currentTime;
  playTone(ctx, 659.25, t, 0.14);
  playTone(ctx, 880, t + 0.13, 0.18);
  playTone(ctx, 1046.5, t + 0.28, 0.22, 0.1);
}
