// Render audit over the display-setting matrix: theme × contrast × reduce transparency (× reduce motion), every
// docs page, desktop and phone widths. Checks: page errors, horizontal overflow, clipped text, text contrast
// (against the real composited background; skipped over glass/photos where it cannot be known), and that reduce
// transparency really removes blur.
// usage: node tests/e2e/matrix.mjs [shotDir]   (BROWSER=webkit|firefox, FULL=1 for all 16 combos in other engines,
//        SHARD=2/4 to run only every 4th combo starting at the 2nd — the runner splits the matrix this way)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
const out = process.argv[2];
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
import { PAGES } from './pages.mjs';
const WIDTHS = [1280, 390];
const all = [];
for (const mode of ['light', 'dark']) for (const hc of [0, 1]) for (const rt of [0, 1]) for (const rm of [0, 1]) all.push({ mode, hc, rt, rm });
/* reduce motion does not change static rendering: chromium covers all 16, other engines the 8 visual ones unless FULL */
const every = engine === 'chromium' || process.env.FULL ? all : all.filter((c) => c.rm === 0);
const [shard, shards] = (process.env.SHARD || '1/1').split('/').map(Number);
const combos = every.filter((_, i) => i % shards === shard - 1);

let failed = 0;
const problems = {};
const note = (key, msg) => { (problems[key] ??= []).push(msg); };

for (const c of combos) {
  const q = `?mode=${c.mode}&hc=${c.hc}&rt=${c.rt}&rm=${c.rm}`;
  const tag = `${c.mode}${c.hc ? '+hc' : ''}${c.rt ? '+rt' : ''}${c.rm ? '+rm' : ''}`;
  for (const width of WIDTHS) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    /* our own errors only (a third-party CDN failing — the docs' web font — is not a defect of the library) */
    p.on('console', (m) => { if (m.type() !== 'error') return; const t = m.text(); if (!(m.location()?.url ?? '').includes('localhost') || /https?:\/\/(?!localhost)/.test(t)) return; errs.push(t); });
    for (const id of PAGES) {
      errs.length = 0;
      await p.goto(`http://localhost:4173/${q}#/${id}`);
      await p.waitForTimeout(450);
      const r = await p.evaluate(({ hc, rt }) => {
        /* rgb()/rgba() (0–255), and color(srgb r g b / a) (0–1) — what color-mix() computes to */
        const parse = (s) => {
          const m = s.match(/[\d.]+/g); if (!m) return null;
          const n = m.map(Number);
          if (/^color\(srgb/.test(s)) { const [r, g, b, a] = n; return { r: r * 255, g: g * 255, b: b * 255, a: a ?? 1 }; }
          const [r, g, b, a] = n; return { r, g, b, a: a ?? 1 };
        };
        const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); return a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
        /* the colour behind an element: composite ancestors' backgrounds down to the first opaque one; unknown over glass, images, gradients */
        const bgOf = (el) => {
          const layers = [];
          for (let e = el; e; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none') || e.classList.contains('photo') || e.tagName === 'svg') return null;
            const bg = parse(cs.backgroundColor);
            if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 0.999) break; }
          }
          if (!layers.length) return null;
          let acc = layers[layers.length - 1];
          if (acc.a < 0.999) return null;
          for (let i = layers.length - 2; i >= 0; i--) acc = over(layers[i], acc);
          return acc;
        };
        const res = { overflowX: document.documentElement.scrollWidth - innerWidth, clipped: [], contrast: [], blur: 0, checked: 0 };
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          if (el.closest('.sg-visually-hidden')) continue;   /* screen-reader-only text is meant to be clipped */
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          /* disabled text and decorative copies are exempt (WCAG 1.4.3) */
          let dim = false;
          for (let e = el; e; e = e.parentElement) { const s2 = getComputedStyle(e); if (+s2.opacity < 0.99 || e.matches?.('[disabled],[aria-disabled="true"],[aria-hidden="true"],.sg-lift')) { dim = true; break; } }
          let invisible = false;
          for (let e = el; e; e = e.parentElement) if (+getComputedStyle(e).opacity === 0) { invisible = true; break; }
          if (invisible) continue;
          /* clipped = the text itself runs past the element's box (not just any overflowing layer), without an ellipsis */
          const range = document.createRange(); range.selectNodeContents(el); const tr = range.getBoundingClientRect();
          if (/hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && (tr.right > rect.right + 1 || tr.left < rect.left - 1)) res.clipped.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} "${el.textContent.trim().slice(0, 24)}"`);
          if (dim) continue;
          const bg = bgOf(el); if (!bg) continue;
          const fg0 = parse(cs.color); if (!fg0) continue;
          const fg = over(fg0, bg);
          const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
          const large = size >= 24 || (size >= 18.66 && bold);
          const need = hc ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
          const rr = ratio(fg, bg);
          res.checked++;
          if (rr < need - 0.05) res.contrast.push(`${rr.toFixed(2)}<${need} ${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${el.textContent.trim().slice(0, 20)}" ${size}px`);
        }
        if (rt) res.blur = [...document.querySelectorAll('.sg-glass')].filter((e) => { const f = getComputedStyle(e).backdropFilter; return f && f !== 'none'; }).length;
        return res;
      }, { hc: c.hc, rt: c.rt });
      const key = `${tag} @${width}`;
      if (errs.length) note('errors', `${key} ${id}: ${errs[0]}`);
      if (r.overflowX > 1) note('overflow', `${key} ${id}: +${r.overflowX}px`);
      for (const x of r.clipped) note('clipped', `${key} ${id}: ${x}`);
      for (const x of r.contrast) note('contrast', `${key} ${id}: ${x}`);
      if (r.blur) note('reduce-transparency', `${key} ${id}: ${r.blur} glass surfaces still blur`);
      if (out && width === 1280 && ['showcase', 'overlays', 'inputs'].includes(id)) await p.screenshot({ path: `${out}/m-${tag}-${id}.png` });
    }
    await p.close();
  }
  process.stdout.write(`${tag} `);
}
console.log('\n');
for (const k of ['errors', 'overflow', 'clipped', 'contrast', 'reduce-transparency']) {
  const list = problems[k] ?? [];
  if (list.length) failed++;
  /* group identical messages across combos */
  const uniq = [...new Set(list.map((m) => m.replace(/^\S+ @\d+ /, '')))];
  console.log(`${list.length ? 'FAIL' : 'PASS'} ${k}: ${list.length} (${uniq.length} distinct)`);
  for (const m of uniq.slice(0, 12)) console.log('   ', m);
}
if (out) (await import('node:fs')).writeFileSync(`${out}/matrix-${engine}${shards > 1 ? `-${shard}of${shards}` : ''}.json`, JSON.stringify(problems, null, 1));
console.log(`${engine}${shards > 1 ? ` shard ${shard}/${shards}` : ''}: ${combos.length} combos × ${PAGES.length} pages × ${WIDTHS.length} widths`);
console.log(failed ? `${failed} CHECKS FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
