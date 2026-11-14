// Builds a single self-contained HTML file of the prototype (both views in one document)
// for sharing as a preview. Usage: npm run build && node scripts/build-preview.mjs [outDir]
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'preview-dist';
mkdirSync(out, { recursive: true });

const html = readFileSync('dist/preview.html', 'utf8');
const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
let body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
body = body.slice(body.indexOf('>') + 1).replace(/<script[\s\S]*?<\/script>/g, '');

const css = readdirSync('dist/assets').filter((f) => f.endsWith('.css')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');

const js = await build({
  entryPoints: ['src/scripts/app.ts'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  define: { __STANDALONE__: 'true' },
  plugins: [{
    name: 'no-router',
    setup(b) {
      b.onResolve({ filter: /^astro:transitions\/client$/ }, () => ({ path: 'router-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const navigate = (href) => { location.href = href; };' }));
    },
  }],
});

const page = [
  `<title>${title}</title>`,
  fonts,
  `<style>${css}</style>`,
  body.replaceAll('"/media/', '"media/'),
  `<script>${js.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`,
].join('\n');

writeFileSync(join(out, 'index.html'), page);
cpSync('public/media', join(out, 'media'), { recursive: true });
console.log(`Wrote ${out}/index.html (${(page.length / 1024).toFixed(0)} KB) and ${out}/media`);
