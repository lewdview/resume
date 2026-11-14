// Sound: one deck for the whole site. It drives the clock and the hero field.
// The bundled track runs through Web Audio (analyser + the PIM split-band demo).
// Catalogue tracks stream from another origin, so they play on a plain element
// and the field follows a beat pulse from the clock instead of the analyser.
import { clock } from './clock';

export interface Track {
  src: string;
  title: string;
  bpm: number;
  cover?: string;
  day?: number;
  remote?: boolean;
}

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let bins: Uint8Array<ArrayBuffer> | null = null;
let direct: GainNode | null = null;
let bands: GainNode[] = [];
let bandBus: GainNode | null = null;

let local: HTMLAudioElement | null = null;
let remote: HTMLAudioElement | null = null;
let active: HTMLAudioElement | null = null;
let current: Track | null = null;
let failed = false;

const emit = () => document.dispatchEvent(new CustomEvent('player:change'));
export const state = () => ({ track: current, playing: !!active && !active.paused, failed, time: active?.currentTime ?? 0, duration: active?.duration || 0 });

/** 0..1 energy for visuals: the analyser when we have it, otherwise a pulse on the beat. */
export function level(): number {
  if (!active || active.paused) return 0;
  if (active === local && analyser && bins) {
    analyser.getByteFrequencyData(bins);
    let sum = 0;
    for (let i = 1; i <= 24; i++) sum += bins[i];
    return sum / (24 * 255);
  }
  const phase = (active.currentTime % clock.beat) / clock.beat;
  return 0.5 * Math.exp(-phase * 4);
}

function graph(audio: HTMLAudioElement) {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    bins = new Uint8Array(analyser.frequencyBinCount);
    direct = ctx.createGain();
    bandBus = ctx.createGain();
    bandBus.gain.value = 0;
    src.connect(direct).connect(analyser);
    // Same three bands PIM uses for its lanes: bass, mids, treble.
    const specs: Array<[BiquadFilterType, number, number]> = [['lowpass', 300, 0.8], ['bandpass', 1200, 0.7], ['highpass', 3200, 0.8]];
    bands = specs.map(([type, freq, q]) => {
      const f = ctx!.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx!.createGain();
      src.connect(f).connect(g).connect(bandBus!);
      return g;
    });
    bandBus.connect(analyser);
    analyser.connect(ctx.destination);
  } catch {
    ctx = null; // plain playback still works
  }
}

/** Route the bundled track through the three lane bands (PIM demo) or straight through. */
export function splitBands(on: boolean) {
  if (!ctx || !direct || !bandBus) return false;
  const t = ctx.currentTime;
  direct.gain.linearRampToValueAtTime(on ? 0 : 1, t + 0.15);
  bandBus.gain.linearRampToValueAtTime(on ? 1.35 : 0, t + 0.15);
  if (!on) bands.forEach((g) => g.gain.setValueAtTime(1, t));
  return true;
}
/** Drop a lane the way a miss does in the game, or bring it back. */
export function setBand(i: number, on: boolean) {
  if (!ctx || !bands[i]) return;
  const g = bands[i].gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(g.value, ctx.currentTime);
  g.linearRampToValueAtTime(on ? 1 : 0.04, ctx.currentTime + (on ? 0.25 : 0.12));
}

function sync() {
  const on = !!active && !active.paused;
  document.documentElement.classList.toggle('is-playing', on);
  on && current ? clock.set(current.bpm > 140 ? Math.round(current.bpm / 2) : current.bpm) : clock.reset();
  emit();
}

let request = 0;
export async function play(track: Track) {
  if (!local) return;
  // A newer play() interrupts this one's promise; only the latest request may report failure.
  const mine = ++request;
  failed = false;
  const el = track.remote ? (remote ??= wire(new Audio())) : local;
  if (active && active !== el) active.pause();
  if (current?.src !== track.src || !el.src) {
    el.src = track.src;
    el.loop = !track.remote;
  }
  active = el;
  current = track;
  if (!track.remote) {
    graph(local);
    await ctx?.resume();
  }
  try {
    await el.play();
  } catch {
    if (mine !== request) return;
    failed = true;
    sync();
  }
}
export function pause() {
  active?.pause();
}
export function toggle(fallback: Track) {
  if (active && !active.paused) pause();
  else play(current && !failed ? current : fallback);
}

function wire(el: HTMLAudioElement) {
  el.preload = 'none';
  el.addEventListener('play', sync);
  el.addEventListener('pause', sync);
  el.addEventListener('ended', sync);
  el.addEventListener('error', () => {
    if (el !== active) return;
    failed = true;
    sync();
  });
  el.addEventListener('timeupdate', emit);
  return el;
}

export function houseTrack(): Track {
  const a = document.querySelector<HTMLAudioElement>('#track')!;
  return { src: a.dataset.src!, title: a.dataset.title!, bpm: Number(a.dataset.bpm), cover: a.dataset.cover, day: Number(a.dataset.day) };
}

export function initPlayer() {
  const audio = document.querySelector<HTMLAudioElement>('#track');
  const btn = document.querySelector<HTMLButtonElement>('#sound');
  if (!audio || !btn || btn.dataset.ready) return;
  btn.dataset.ready = '1';
  local = wire(audio);
  const label = btn.querySelector<HTMLElement>('[data-sound-label]')!;
  const deck = document.querySelector<HTMLElement>('#deck');
  btn.addEventListener('click', () => toggle(houseTrack()));
  deck?.querySelector('button')?.addEventListener('click', () => toggle(houseTrack()));

  document.addEventListener('player:change', () => {
    const s = state();
    btn.setAttribute('aria-pressed', String(s.playing));
    label.textContent = s.playing ? 'Sound on' : 'Sound off';
    if (!deck || !s.track) return;
    deck.hidden = false;
    deck.classList.toggle('is-spinning', s.playing);
    deck.querySelector<HTMLElement>('[data-deck-title]')!.textContent = s.failed ? 'This one streams on the live site' : s.track.title;
    deck.querySelector<HTMLElement>('[data-deck-meta]')!.textContent = s.failed ? 'Not available in this preview' : `${s.track.day ? `Day ${String(s.track.day).padStart(3, '0')} / ` : ''}${s.track.bpm} BPM`;
    deck.querySelector<HTMLElement>('[data-deck-bar]')!.style.transform = `scaleX(${s.duration ? s.time / s.duration : 0})`;
    deck.querySelector('button')!.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    const label2 = deck.querySelector<HTMLElement>('.deck-label');
    if (label2) label2.style.backgroundImage = s.track.cover && !s.failed ? `url("${s.track.cover}")` : '';
  });
}
