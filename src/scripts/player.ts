// Sound: a persistent audio element that also drives the clock and the hero field.
import { clock } from './clock';

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let bins: Uint8Array<ArrayBuffer> | null = null;

/** 0..1 low-end energy of the playing track, 0 when silent. */
export function level(): number {
  if (!analyser || !bins) return 0;
  analyser.getByteFrequencyData(bins);
  let sum = 0;
  const n = 24;
  for (let i = 1; i <= n; i++) sum += bins[i];
  return sum / (n * 255);
}

export function initPlayer() {
  const audio = document.querySelector<HTMLAudioElement>('#track');
  const btn = document.querySelector<HTMLButtonElement>('#sound');
  if (!audio || !btn || btn.dataset.ready) return;
  btn.dataset.ready = '1';
  const label = btn.querySelector<HTMLElement>('[data-sound-label]')!;
  const bpm = Number(audio.dataset.bpm) || clock.defaultBpm;

  const sync = () => {
    const on = !audio.paused;
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Sound on' : 'Sound off';
    document.documentElement.classList.toggle('is-playing', on);
    on ? clock.set(bpm) : clock.reset();
    document.querySelectorAll<HTMLElement>('[data-now]').forEach((el) => {
      el.textContent = on ? `Now playing: ${audio.dataset.title}` : el.dataset.now!;
    });
  };

  btn.addEventListener('click', async () => {
    if (!audio.src) audio.src = audio.dataset.src!;
    if (!ctx) {
      try {
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        bins = new Uint8Array(analyser.frequencyBinCount);
        ctx.createMediaElementSource(audio).connect(analyser).connect(ctx.destination);
      } catch {
        ctx = null; // plain playback still works
      }
    }
    if (audio.paused) {
      await ctx?.resume();
      audio.play().catch(() => sync());
    } else audio.pause();
  });
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', sync);
}
