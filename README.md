# work.th3scr1b3.art

Portfolio for Bryan Meason (th3scr1b3). Concept: Liner Notes. Prototype 0.1 covers the home page and the 365 Days of Light and Dark case study.

## Run

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # static site in dist/
npm run build:preview  # also writes preview-dist/, a single-file build of both views
```

## Layout

- `src/layouts/Base.astro`: shell, nav, persistent audio, flood and needle overlays
- `src/components/Home.astro`, `Case365.astro`: page content
- `src/pages/`: `/`, `/work/365`, and `/preview` (both views in one document, noindex)
- `src/styles/global.css`: tokens (paper, ink, signal) and all styles. `data-skin` on `<html>` switches palette
- `src/scripts/`
  - `clock.ts`: the one tempo. Durations everywhere are multiples of `clock.beat`
  - `transcribe.ts`: glyph-by-glyph re-keying (the name, nav labels)
  - `player.ts`: sound toggle, analyser, sets the clock to the track's BPM
  - `hero.ts`: raw WebGL ink-line field, reacts to pointer and audio
  - `app.ts`: Write, Scrub, Flood, Needle, and page lifecycle
- `public/media/`: one track and six sleeves from the 365 project

## Notes

- Sound never starts without a click. Reduced-motion users get static states.
- The hero uses raw WebGL instead of Three.js. One full-screen shader did not justify a 740 KB library.
- Styling is plain CSS with tokens. Tailwind can be added when the remaining pages are built.
- Sound, Resume and Contact are placeholders in the nav until step 4.
