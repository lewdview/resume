// Transcribe: re-key a string into another, glyph by glyph, in time with the clock.
import gsap from 'gsap';
import { clock, reducedMotion } from './clock';

const GLYPHS = '0123456789/\\<>[]{}#*+=';
const running = new WeakMap<HTMLElement, gsap.core.Tween>();

export function transcribe(el: HTMLElement, to: string, opts: { stagger?: number; flicker?: number } = {}) {
  const from = el.textContent ?? '';
  if (from === to) return;
  running.get(el)?.kill();
  if (reducedMotion()) {
    el.textContent = to;
    return;
  }
  const stagger = opts.stagger ?? clock.beat / 8;
  const flicker = opts.flicker ?? clock.beat / 2;
  const len = Math.max(from.length, to.length);
  const total = stagger * (len - 1) + flicker;
  const state = { t: 0 };
  const tween = gsap.to(state, {
    t: total,
    duration: total,
    ease: 'none',
    onUpdate() {
      let out = '';
      for (let i = 0; i < len; i++) {
        const start = i * stagger;
        if (state.t < start) out += from[i] ?? '';
        else if (state.t < start + flicker) {
          const step = Math.floor((state.t - start) / 0.055);
          out += GLYPHS[(i * 7 + step * 13) % GLYPHS.length];
        } else out += to[i] ?? '';
      }
      el.textContent = out;
    },
    onComplete() {
      el.textContent = to;
    },
  });
  running.set(el, tween);
}

/** Elements with data-a / data-b flip between the two on hover or focus. */
export function initTranscribeHover(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-tx]').forEach((el) => {
    if (el.dataset.txReady) return;
    el.dataset.txReady = '1';
    const a = el.textContent ?? '';
    const b = el.dataset.tx!;
    const host = el.closest('a, button') ?? el;
    host.addEventListener('pointerenter', () => transcribe(el, b));
    host.addEventListener('pointerleave', () => transcribe(el, a));
    host.addEventListener('focus', () => transcribe(el, b));
    host.addEventListener('blur', () => transcribe(el, a));
  });
}
