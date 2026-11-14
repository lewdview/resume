# work.th3scr1b3.art

Portfolio for Bryan Meason (th3scr1b3). Concept: Liner Notes. Pages: home, two case studies (365 Days of Light and Dark, PIM : th3v4ult), Sound (the full catalogue), Resume and Contact.

## Run

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # static site in dist/
npm run build:preview  # also writes preview-dist/, a single-file build of both views
```

## Layout

- `src/layouts/Base.astro`: shell, nav, persistent audio, flood and needle overlays
- `src/components/`: page content (`Home`, `Case365`, `CasePim`, `Sound`, `Resume`, `Contact`)
- `src/pages/`: one route per page, plus `/preview` (every view in one document, noindex)
- `src/data/catalogue.json`: the 365 releases (day, title, mood, tempo, audio and cover URLs)
- `src/styles/global.css`: tokens (paper, ink, signal) and all styles. `data-skin` on `<html>` switches palette
- `src/scripts/`
  - `clock.ts`: the one tempo. Durations everywhere are multiples of `clock.beat`
  - `transcribe.ts`: glyph-by-glyph re-keying (the name, nav labels)
  - `player.ts`: the deck. Plays the bundled track through Web Audio (analyser, PIM lane bands) and streams catalogue tracks from files.th3scr1b3.art
  - `hero.ts`: raw WebGL ink-line field, reacts to pointer and audio
  - `app.ts`: Write, Scrub, Flood, Needle, and page lifecycle
- `public/media/`: one track and six sleeves from the 365 project

## Notes

- Sound never starts without a click. Reduced-motion users get static states.
- The hero uses raw WebGL instead of Three.js. One full-screen shader did not justify a 740 KB library.
- Styling is plain CSS with tokens. Tailwind can be added when the remaining pages are built.
- Catalogue audio and covers load from files.th3scr1b3.art. Only day 008 is bundled.
- The Resume page has no scroll effects, works without JavaScript and prints to two pages.
