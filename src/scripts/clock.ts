// One clock for the whole site. Every duration is a multiple of a beat.
const DEFAULT_BPM = 90;

export const clock = {
  bpm: DEFAULT_BPM,
  defaultBpm: DEFAULT_BPM,
  /** Seconds per beat. */
  get beat() {
    return 60 / this.bpm;
  },
  set(bpm: number) {
    this.bpm = bpm;
    document.documentElement.style.setProperty('--beat', `${this.beat}s`);
    document.querySelectorAll<HTMLElement>('[data-bpm]').forEach((el) => (el.textContent = `${bpm} BPM`));
    document.dispatchEvent(new CustomEvent('clock:change', { detail: { bpm } }));
  },
  reset() {
    this.set(DEFAULT_BPM);
  },
};

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
