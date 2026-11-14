// Liner Notes motion system: Transcribe, Write, Scrub, Flood, Needle. All on one clock.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { navigate } from 'astro:transitions/client';
import { clock, reducedMotion } from './clock';
import { transcribe, initTranscribeHover } from './transcribe';
import { initPlayer, play, pause, state, houseTrack, splitBands, setBand, level } from './player';

gsap.registerPlugin(ScrollTrigger, SplitText);

let lenis: Lenis | null = null;
let cleanups: Array<() => void> = [];
// Listeners on a view's own elements die with the view: in the single-document preview the
// same elements are mounted again on every visit, so they must not stack.
let life = new AbortController();
const scoped = () => ({ signal: life.signal });
let scope: ParentNode = document;
const qa = <T extends Element = HTMLElement>(sel: string) => scope.querySelectorAll<T>(sel);
const q = <T extends Element = HTMLElement>(sel: string) => scope.querySelector<T>(sel);

/* ---------- Views: the single-document preview switches <main data-view> in place ---------- */
const views = () => [...document.querySelectorAll<HTMLElement>('main[data-view]')];
const viewFor = (url: URL) => {
  const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return views().find((v) => v.dataset.path !== '/' && path.endsWith(v.dataset.path!))?.dataset.view ?? 'home';
};
const currentView = () => views().find((v) => !v.hidden)?.dataset.view;
function go(href: string) {
  if (!views().length) return void navigate(href);
  const url = new URL(href, location.href);
  const id = viewFor(url);
  unmount();
  views().forEach((v) => (v.hidden = v.dataset.view !== id));
  try {
    history.replaceState(null, '', id === 'home' ? location.pathname + location.search : '#' + id);
  } catch {}
  mount(url.hash);
}

const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Scroll ---------- */
function initScroll() {
  if (lenis || reducedMotion()) return;
  lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Write ---------- */
function initWrite() {
  if (reducedMotion()) return;
  const beat = clock.beat;
  qa('[data-write]').forEach((el) => {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'w-line' });
    gsap.from(split.lines, {
      yPercent: 110,
      duration: beat,
      stagger: beat / 4,
      ease: 'power3.out',
      delay: Number(el.dataset.write || 0) * beat,
      scrollTrigger: { trigger: el, start: 'top 96%', once: true },
    });
    cleanups.push(() => split.revert());
  });
  qa('[data-tick]').forEach((el) => {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    const state = { n: 0 };
    el.textContent = '';
    gsap.to(state, {
      n: text.length,
      duration: Math.min(text.length * (beat / 16), beat * 2),
      ease: 'none',
      delay: Number(el.dataset.tick || 0) * beat,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate: () => (el.textContent = text.slice(0, Math.round(state.n))),
    });
    cleanups.push(() => (el.textContent = text));
  });
  qa('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const state = { n: 0 };
    gsap.to(state, {
      n: end,
      duration: beat * 2,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => (el.textContent = String(Math.round(state.n))),
    });
  });
  qa('[data-rise]').forEach((el) => {
    gsap.from(el.children, {
      y: 28,
      opacity: 0,
      duration: beat,
      stagger: beat / 4,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ---------- Transcribe: the name ---------- */
function initName() {
  const name = q('.name');
  if (!name) return;
  const lines = [...name.querySelectorAll<HTMLElement>('.name-line')];
  const aka = q('[data-aka]');
  let alias = false;
  const flip = (to?: boolean) => {
    alias = to ?? !alias;
    lines.forEach((l, i) => gsap.delayedCall((i * clock.beat) / 4, () => transcribe(l, alias ? l.dataset.b! : l.dataset.a!)));
    if (aka) transcribe(aka, alias ? aka.dataset.b! : aka.dataset.a!, { stagger: clock.beat / 24, flicker: clock.beat / 4 });
  };
  let timer: gsap.core.Tween | undefined;
  // Keep time: every 16 beats the alias surfaces for 4, unless the visitor has set it by hand.
  const loop = () => {
    timer?.kill();
    if (reducedMotion()) return;
    timer = gsap.delayedCall(clock.beat * 16, () => {
      const inView = name.getBoundingClientRect().bottom > 0;
      if (inView && !document.hidden && !alias) {
        flip(true);
        timer = gsap.delayedCall(clock.beat * 4, () => {
          flip(false);
          loop();
        });
      } else loop();
    });
  };
  const manual = () => {
    flip();
    loop();
  };
  name.addEventListener('click', manual, scoped());
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      manual();
    }
  }, scoped());
  if (reducedMotion()) return;
  // Intro: arrive as the alias, resolve into the name.
  lines.forEach((l) => (l.textContent = l.dataset.b!));
  alias = true;
  gsap.delayedCall(clock.beat * 2, () => flip(false));
  loop();
  cleanups.push(() => timer?.kill());
}

/* ---------- Hero field ---------- */
function initHeroField() {
  const canvas = q<HTMLCanvasElement>('.hero-canvas');
  if (!canvas) return;
  let dispose: (() => void) | undefined;
  let dead = false;
  import('./hero').then(({ initHero }) => initHero(canvas)).then((d) => (dead ? d() : (dispose = d)));
  cleanups.push(() => {
    dead = true;
    dispose?.();
  });
}

/* ---------- Scrub: the crate ---------- */
function initCrate() {
  const crate = q('.crate');
  if (!crate || reducedMotion()) return;
  const track = crate.querySelector<HTMLElement>('.crate-track')!;
  const bar = crate.querySelector<HTMLElement>('.crate-bar i');
  crate.classList.add('is-pinned');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: crate,
      pin: true,
      scrub: 0.6,
      end: () => `+=${dist()}`,
      invalidateOnRefresh: true,
      onUpdate: (self) => bar && gsap.set(bar, { scaleX: self.progress }),
    },
  });
  crate.querySelectorAll<HTMLElement>('.sleeve').forEach((s, i) => {
    gsap.fromTo(s, { rotate: i % 2 ? 2.5 : -2.5 }, { rotate: i % 2 ? -1.5 : 1.5, ease: 'none',
      scrollTrigger: { trigger: crate, scrub: 0.6, start: 'top top', end: () => `+=${dist()}` } });
  });
  cleanups.push(() => crate.classList.remove('is-pinned'));
}

/* ---------- Track list preview ---------- */
function initPreview() {
  const fig = q('.preview');
  if (!fig || !fine()) return;
  const img = fig.querySelector('img')!;
  const x = gsap.quickTo(fig, 'x', { duration: clock.beat / 2, ease: 'power3' });
  const y = gsap.quickTo(fig, 'y', { duration: clock.beat / 2, ease: 'power3' });
  const move = (e: PointerEvent) => {
    x(e.clientX);
    y(e.clientY);
  };
  window.addEventListener('pointermove', move, { passive: true });
  qa('[data-preview]').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      img.src = row.dataset.preview!;
      gsap.to(fig, { opacity: 1, scale: 1, rotate: -3, duration: clock.beat / 2, ease: 'power3.out' });
    }, scoped());
    row.addEventListener('pointerleave', () => gsap.to(fig, { opacity: 0, scale: 0.92, rotate: 0, duration: clock.beat / 4 }), scoped());
  });
  cleanups.push(() => window.removeEventListener('pointermove', move));
}

/* ---------- Flood: page transitions ---------- */
let flooding = false;
function initFlood() {
  const flood = document.querySelector<HTMLElement>('#flood')!;
  document.querySelectorAll<HTMLAnchorElement>('a[data-flood]').forEach((a) => {
    if (a.dataset.floodReady) return;
    a.dataset.floodReady = '1';
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const href = a.getAttribute('href')!;
      const url = new URL(a.href);
      const same = views().length ? viewFor(url) === currentView() : url.pathname === location.pathname;
      if (same) {
        if (!views().length) return; // let the browser handle the in-page anchor
        e.preventDefault();
        if (url.hash) lenis ? lenis.scrollTo(url.hash) : document.querySelector(url.hash)?.scrollIntoView();
        return;
      }
      e.preventDefault();
      if (flooding) return;
      if (reducedMotion()) return go(href);
      flooding = true;
      const cx = e.clientX || window.innerWidth / 2;
      const cy = e.clientY || window.innerHeight / 2;
      const r = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 40;
      flood.style.background = a.dataset.flood!;
      gsap.fromTo(flood, { clipPath: `circle(0px at ${cx}px ${cy}px)`, opacity: 1 }, {
        clipPath: `circle(${r}px at ${cx}px ${cy}px)`,
        duration: clock.beat,
        ease: 'power3.inOut',
        onComplete: () => go(href),
      });
    });
  });
}
function drainFlood() {
  if (!flooding) return;
  const flood = document.querySelector<HTMLElement>('#flood')!;
  gsap.to(flood, {
    opacity: 0,
    duration: clock.beat / 2,
    ease: 'power1.out',
    onComplete: () => {
      gsap.set(flood, { clipPath: 'circle(0px at 50% 50%)', opacity: 1 });
      flooding = false;
    },
  });
}

/* ---------- Needle: cursor ---------- */
function initNeedle() {
  const needle = document.querySelector<HTMLElement>('#needle');
  if (!needle || needle.dataset.ready || !fine() || reducedMotion()) return;
  needle.dataset.ready = '1';
  document.documentElement.classList.add('has-needle');
  const ring = needle.querySelector('b')!;
  const x = gsap.quickTo(needle, 'x', { duration: 0.18, ease: 'power3' });
  const y = gsap.quickTo(needle, 'y', { duration: 0.18, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    gsap.set(needle, { opacity: 1 });
    x(e.clientX);
    y(e.clientY);
    const hot = (e.target as Element | null)?.closest?.('a:not([aria-disabled]), button, .name');
    gsap.to(ring, { scale: hot ? 1 : 0.4, opacity: hot ? 1 : 0, duration: clock.beat / 4, overwrite: true });
  }, { passive: true });
  document.addEventListener('pointerleave', () => gsap.set(needle, { opacity: 0 }));
}
function initMagnets() {
  if (!fine() || reducedMotion()) return;
  document.querySelectorAll<HTMLElement>('[data-magnet]').forEach((el) => {
    if (el.dataset.magnetReady) return;
    el.dataset.magnetReady = '1';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.3 });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: clock.beat, ease: 'elastic.out(1, 0.5)' }));
  });
}

/* ---------- Sound page: the catalogue ---------- */
function initCatalogue() {
  const root = q('[data-catalogue]');
  if (!root) return;
  const rows = [...root.querySelectorAll<HTMLButtonElement>('.song')];
  const cells = [...root.querySelectorAll<HTMLButtonElement>('.year button')];
  const byDay = new Map(rows.map((r) => [r.dataset.day!, r]));
  const start = (row: HTMLButtonElement) => {
    const s = state();
    if (s.track?.day === Number(row.dataset.day) && s.playing) return pause();
    play({ src: row.dataset.src!, title: row.dataset.title!, bpm: Number(row.dataset.bpm), cover: row.dataset.cover, day: Number(row.dataset.day), remote: row.dataset.remote !== undefined });
  };
  rows.forEach((r) => r.addEventListener('click', () => start(r), scoped()));
  cells.forEach((c) => c.addEventListener('click', () => {
    const row = byDay.get(c.dataset.day!)!;
    if (row.hidden) setFilter('all');
    start(row);
    lenis ? lenis.scrollTo(row, { offset: -innerHeight / 2 }) : row.scrollIntoView({ block: 'center' });
  }, scoped()));
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const setFilter = (f: string) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
    rows.forEach((r) => (r.hidden = f !== 'all' && r.dataset.m !== f));
    ScrollTrigger.refresh();
  };
  chips.forEach((c) => c.addEventListener('click', () => setFilter(c.dataset.filter!), scoped()));
  const mark = () => {
    const s = state();
    const day = s.track?.day && !s.failed ? String(s.track.day) : '';
    rows.forEach((r) => r.classList.toggle('is-current', r.dataset.day === day));
    cells.forEach((c) => c.classList.toggle('is-current', c.dataset.day === day));
  };
  document.addEventListener('player:change', mark);
  mark();
  cleanups.push(() => document.removeEventListener('player:change', mark));
}

/* ---------- PIM: miss a lane, lose that band ---------- */
function initLanes() {
  const root = q('[data-lanes]');
  if (!root) return;
  const lanes = [...root.querySelectorAll<HTMLButtonElement>('.lane')];
  const startBtn = root.querySelector<HTMLButtonElement>('[data-lanes-start]')!;
  const status = root.querySelector<HTMLElement>('[data-lanes-status]')!;
  const timers: number[] = [];
  let live = false;
  const restore = (i: number) => {
    setBand(i, true);
    lanes[i].classList.remove('is-missed');
    lanes[i].setAttribute('aria-pressed', 'false');
  };
  startBtn.addEventListener('click', async () => {
    if (live) {
      pause();
      return;
    }
    await play(houseTrack());
    live = splitBands(true);
    status.textContent = live ? 'Playing. Tap a lane to miss it.' : 'Your browser blocked the audio graph, so the lanes are visual only.';
  }, scoped());
  lanes.forEach((lane, i) => lane.addEventListener('click', () => {
    if (!state().playing) return void (status.textContent = 'Start the track first.');
    clearTimeout(timers[i]);
    if (lane.classList.contains('is-missed')) return restore(i);
    setBand(i, false);
    lane.classList.add('is-missed');
    lane.setAttribute('aria-pressed', 'true');
    status.textContent = `Missed. ${lane.querySelector('b')!.textContent} drops out for 3.5 seconds.`;
    timers[i] = window.setTimeout(() => restore(i), 3500);
  }, scoped()));
  const onChange = () => {
    const playing = state().playing;
    startBtn.textContent = playing && live ? 'Stop the track' : 'Start the track';
    if (!playing) live = false;
  };
  document.addEventListener('player:change', onChange);
  let raf = 0;
  const tick = () => {
    const l = level();
    lanes.forEach((lane, i) => lane.style.setProperty('--lvl', String(0.25 + Math.min(1, l * (1.6 - i * 0.3)) * 0.75)));
    raf = requestAnimationFrame(tick);
  };
  if (!reducedMotion()) tick();
  cleanups.push(() => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    document.removeEventListener('player:change', onChange);
    lanes.forEach((_, i) => restore(i));
    splitBands(false);
  });
}

/* ---------- Small things ---------- */
function initUtilities() {
  qa<HTMLButtonElement>('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy!);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = btn.dataset.copy!;
    }
    setTimeout(() => (btn.textContent = label), 1800);
  }, scoped()));
  qa<HTMLButtonElement>('[data-print]').forEach((btn) => btn.addEventListener('click', () => window.print(), scoped()));
}
function initMeter() {
  const side = document.querySelector<HTMLElement>('[data-side]');
  const code = document.querySelector<HTMLElement>('[data-timecode]');
  if (!side || !code) return;
  side.textContent = document.documentElement.dataset.skin === 'ink' ? 'Side B' : 'Side A';
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const secs = Math.round((max > 0 ? scrollY / max : 0) * 180); // a three-minute side
    code.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', update));
}

/* ---------- Lifecycle ---------- */
let mounted = false;
function mount(hash: string = location.hash) {
  const all = views();
  if (all.length && !mounted) {
    const wanted = location.hash.slice(1);
    if (all.some((v) => v.dataset.view === wanted)) all.forEach((v) => (v.hidden = v.dataset.view !== wanted));
    if (all.some((v) => v.dataset.view === hash.slice(1))) hash = '';
  }
  mounted = true;
  scope = all.find((v) => !v.hidden) ?? document;
  document.documentElement.dataset.skin = (all.length ? (scope as HTMLElement) : document.querySelector<HTMLElement>('main'))?.dataset.skin ?? 'paper';
  initScroll();
  const anchor = hash && document.querySelector(hash) ? hash : 0;
  if (lenis) lenis.scrollTo(anchor, { immediate: true, force: true });
  else if (anchor) document.querySelector(anchor)?.scrollIntoView();
  else window.scrollTo(0, 0);
  initPlayer();
  initNeedle();
  initMagnets();
  initTranscribeHover();
  initFlood();
  initPreview();
  initHeroField();
  initCatalogue();
  initLanes();
  initUtilities();
  initMeter();
  document.fonts.ready.then(() => {
    initWrite();
    initName();
    initCrate();
    ScrollTrigger.refresh();
    drainFlood();
  });
}
function unmount() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  cleanups.forEach((fn) => fn());
  cleanups = [];
  life.abort();
  life = new AbortController();
}

// With Astro's router, page-load fires on first load and after every swap.
// The single-document preview has no router, so it mounts once on its own.
declare const __STANDALONE__: boolean | undefined;
if (typeof __STANDALONE__ !== 'undefined' && __STANDALONE__) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount());
  else mount();
} else {
  document.addEventListener('astro:page-load', () => mount());
  document.addEventListener('astro:before-swap', unmount);
  document.addEventListener('astro:after-swap', () => {
    document.documentElement.dataset.skin = document.querySelector<HTMLElement>('main')?.dataset.skin ?? 'paper';
  });
}
