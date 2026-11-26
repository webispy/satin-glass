// The stylesheets are shipped whole (styles.css) and per category (css/<category>.css). This checks, on every docs
// page, that every element computes to exactly the same styles:
//   1. foundation first, then the other categories in reverse order  vs  styles.css   (categories do not depend
//      on each other's load order; foundation always comes first)
//   2. for each category: foundation + its declared dependencies + the category  vs  styles.css, comparing only
//      the elements that category styles (the dependencies listed in the README are enough)
//   3. styles.layer.css  vs  styles.css (the layered build draws the same)
// The docs app bundles the library CSS into its own asset, so the asset is replaced here by the variant under
// test followed by the docs app's own stylesheet (the same for every variant).
// usage: node tests/e2e/css-split.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173; E2E_PART=i/n for a slice of the pages)
// covers: css   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { readFileSync } from 'node:fs';
const engine = process.env.BROWSER || 'chromium';
const dist = (p) => readFileSync(new URL(`../../packages/react/dist/${p}`, import.meta.url), 'utf8');
const docsCss = readFileSync(new URL('../../apps/docs/src/docs.css', import.meta.url), 'utf8');
const CATS = ['foundation', 'controls', 'layout', 'navigation', 'selection', 'overlays', 'feedback', 'data'];
/* what each category needs besides foundation — keep in step with the README's table */
export const DEPS = { controls: [], layout: [], navigation: [], selection: ['controls', 'overlays'], overlays: [], feedback: [], data: ['controls', 'selection', 'overlays', 'layout'] };
const cat = Object.fromEntries(CATS.map((c) => [c, dist(`css/${c}.css`)]));
const full = dist('styles.css'), layered = dist('styles.layer.css');
import { PAGES as ALL_PAGES } from './pages.mjs';
/* E2E_PART=i/n: every n-th page from the i-th (the runner splits this, the longest suite, into parts) */
const [PART, PARTS] = (process.env.E2E_PART || '1/1').split('/').map(Number);
const PAGES = ALL_PAGES.filter((_, i) => i % PARTS === PART - 1);
const QS = ['?mode=light&rm=1', '?mode=dark&hc=1&rm=1'];

const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

/* computed style of every element, keyed by its path; `only` limits it to elements a category draws */
async function snapshot(css, page, qs, only, foreign) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route(/\/assets\/.*\.css$/, (r) => r.fulfill({ contentType: 'text/css', body: css + '\n' + docsCss }));
  /* the web font arrives at a different moment on each load and moves every line; all variants use the fallback */
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(`http://localhost:4173/${qs}#/${page}`);
  await p.evaluate(() => document.fonts.ready);
  /* wait until the page has stopped building itself: charts measure their box and draw a frame later, which took
     longer than a fixed second under load, and a snapshot taken before a chart drew compared a missing element
     with a drawn one (issue #2). A chart draws in a React transition once its width is known, which a busy machine
     can hold back while nothing else changes, so: every chart box on screen has its drawing, and then the same
     elements for 3 checks 150 ms apart (10 s at most). A part still loading (aria-busy: the dashboard's stat cards
     show a skeleton for 700 ms) stays the same for those checks and then swaps in charts that have not drawn yet,
     so nothing may be busy either. The page itself loads lazily into an empty placeholder, which would look settled
     too. Not settled in 10 s, or no longer settled when the styles are read, is a failure with the reason */
  const timedOut = await p.evaluate(async () => {
    /* why the page is not settled yet ('' once it is); kept on the page for the check made with the style read */
    window.__sgUnsettled = () => {
      if (!document.querySelector('main .docs__page')?.childElementCount) return 'page not mounted';
      const bare = [...document.querySelectorAll('.sg-chart__plot, .sg-sparkline')].filter((e) => e.getClientRects().length && !e.querySelector('svg')).length;
      const busy = document.querySelectorAll('[aria-busy="true"]').length;
      return bare || busy ? `${bare} charts not drawn, ${busy} parts busy` : '';
    };
    const sig = () => { const all = document.body.querySelectorAll('*'); let h = all.length; for (const e of all) h = (h * 31 + e.tagName.length + e.childElementCount) | 0; return h; };
    let last = sig(), same = 0;
    for (const t0 = performance.now(); same < 3 || window.__sgUnsettled();) {
      if (performance.now() - t0 > 10000) return window.__sgUnsettled() || 'elements still changing';
      await new Promise((r) => setTimeout(r, 150));
      const now = sig(); same = now === last ? same + 1 : 0; last = now;
    }
    return '';
  });
  if (timedOut) ok(`settled within 10 s · ${page} ${qs}`, false, timedOut);
  /* parts drawn only once they come near the screen ([data-lazy]: the A2UI gallery's cards) are each brought into
     view, then the page goes back to its top: otherwise which of them are drawn follows the layout, which differs
     between the variants. A drawn part stays drawn */
  await p.evaluate(async () => {
    const lazy = [...document.querySelectorAll('[data-lazy]')];
    if (!lazy.length) return;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const e of lazy) { e.scrollIntoView({ block: 'center', behavior: 'instant' }); await frame(); }
    scrollTo({ top: 0, behavior: 'instant' });
    await frame();
  });
  await p.waitForTimeout(300);
  const { why, snap } = await p.evaluate(({ only, foreign }) => {
    /* in the same task as the style read, so nothing can commit between the two */
    const why = window.__sgUnsettled();
    /* in the per-category check an element's size follows its contents, which may belong to a category that is
       not loaded; what a missing dependency would show is a declared value (colour, padding, radius, display…) */
    const GEOMETRY = ['width', 'height', 'inline-size', 'block-size', 'perspective-origin', 'transform-origin', 'transform', 'top', 'left', 'right', 'bottom',
      'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end', 'mask-image', '-webkit-mask-image', 'touch-action',
      /* resolved from the layout around it: grid tracks in px, and min sizes that read auto only in a flex parent */
      'grid-template-columns', 'grid-template-rows', 'min-height', 'min-block-size', 'min-width', 'min-inline-size'];
    const animated = new Set();
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch {} if (a.effect?.target) animated.add(a.effect.target); }
    const rx = (l) => new RegExp(`(^|\\s)sg-(${l.join('|')})(__|--|$|\\s)`);
    const re = only ? rx(only) : null, fre = foreign?.length ? rx(foreign) : null;
    const out = {};
    const path = (e) => { const s = []; for (; e && e !== document.body; e = e.parentElement) s.unshift(`${e.tagName}${[...e.parentElement?.children ?? []].indexOf(e)}`); return s.join('>'); };
    for (const e of document.body.querySelectorAll('*')) {
      /* a category's own elements, outside any component of a category that is not loaded (whose contextual rules
         would be missing for a reason that is not a dependency of this one) */
      if (re) {
        if (!re.test(e.getAttribute('class') ?? '')) continue;
        let x = e, inForeign = false; for (; x && !inForeign; x = x.parentElement) inForeign = fre?.test(x.getAttribute('class') ?? '') ?? false;
        if (inForeign) continue;
      }
      const cs = getComputedStyle(e), v = [];
      /* animation-delay is set from a shared clock (skeleton sweep); an animated element's opacity and transform
         depend on when it started */
      const skip = new Set(['animation-delay', ...(only ? GEOMETRY : []),
        /* the docs column is centred with auto margins: they follow whether the page scrollbar is showing yet */
        ...(e.classList.contains('docs__page') ? ['margin-left', 'margin-right', 'margin-inline-start', 'margin-inline-end'] : [])]);
      for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (k.startsWith('--') || skip.has(k)) continue; v.push(k + ':' + cs.getPropertyValue(k)); }
      if (animated.has(e)) v.push('@animated');
      for (const pe of ['::before', '::after']) { const ps = getComputedStyle(e, pe); if (ps.content && ps.content !== 'none' && ps.content !== 'normal') v.push(pe + ps.background + ps.borderRadius + ps.boxShadow + (only ? '' : ps.transform + ps.inset + ps.width + ps.height)); }
      out[path(e)] = v.join(';');
    }
    return { why, snap: out };
  }, { only: only ?? null, foreign: foreign ?? null });
  if (why) ok(`still settled when the styles are read · ${page} ${qs}`, false, why);
  await ctx.close();
  return snap;
}
const diff = (a, bb) => {
  const keys = Object.keys(a), bad = [];
  /* an element animating in either snapshot (an entrance still running on one side, finished on the other) has its
     opacity and transform from the clock, not from the styles: leave them out of both sides */
  const loose = (l) => l.filter((s) => s !== '@animated' && !s.startsWith('opacity:') && !s.startsWith('transform:'));
  for (const k of keys) if (a[k] !== bb[k]) {
    let x = (a[k] ?? '').split(';'), y = (bb[k] ?? '').split(';');
    if (x.includes('@animated') || y.includes('@animated')) { x = loose(x); y = loose(y); if (x.join(';') === y.join(';')) continue; }
    const xs = new Set(x), ys = new Set(y);
    /* both sides of the difference: what the reference has that the variant lacks, and the other way round */
    const only = (l, other) => l.filter((s) => !other.has(s)).slice(0, 3).join(' | ') || '–';
    bad.push(`${k.split('>').slice(-3).join('>')}: ${only(x, ys)} ⇄ ${only(y, xs)}`);
  }
  return { n: keys.length, bad };
};
/* the blocks a category owns: those whose rules first start a line in it (foundation first) */
const owner = new Map();
for (const c of CATS) for (const m of cat[c].matchAll(/^\.sg-([a-z][a-z0-9-]*?)(?=__|--|[\s.:,{\[>)])/gm)) if (!owner.has(m[1])) owner.set(m[1], c);
const owned = (c) => [...owner].filter(([, o]) => o === c).map(([k]) => k);

const reversed = [cat.foundation, ...CATS.slice(1).reverse().map((c) => cat[c])].join('\n');
for (const qs of QS) for (const page of PAGES) {
  const base = await snapshot(full, page, qs);
  const r = diff(base, await snapshot(reversed, page, qs));
  ok(`reverse category order · ${page} ${qs}`, r.bad.length === 0, r.bad.length ? `${r.bad.length}/${r.n}: ${r.bad.slice(0, 4).join(' ;; ')}` : `${r.n} elements`);
  if (qs === QS[0]) {
    const l = diff(base, await snapshot(layered, page, qs));
    ok(`layered build · ${page}`, l.bad.length === 0, l.bad.length ? `${l.bad.length}/${l.n}: ${l.bad.slice(0, 4).join(' ;; ')}` : '');
  }
}
for (const c of CATS.slice(1)) {
  const loaded = ['foundation', ...DEPS[c], c], css = loaded.map((x) => cat[x]).join('\n'), only = owned(c);
  const foreign = CATS.filter((x) => !loaded.includes(x)).flatMap(owned);
  for (const page of PAGES) {
    const a = await snapshot(full, page, QS[0], only, foreign);
    if (!Object.keys(a).length) continue;
    const r = diff(a, await snapshot(css, page, QS[0], only, foreign));
    ok(`${c} with foundation${DEPS[c].length ? ' + ' + DEPS[c].join(' + ') : ''} · ${page}`, r.bad.length === 0, r.bad.length ? `${r.bad.length}/${r.n}: ${r.bad.slice(0, 4).join(' ;; ')}` : `${r.n} elements`);
  }
}
if (process.env.BASELINE) {
  /* one-off: the regrouped bundle against the bundle from before the regrouping */
  const old = readFileSync(process.env.BASELINE, 'utf8');
  for (const qs of QS) for (const page of PAGES) {
    const r = diff(await snapshot(old, page, qs), await snapshot(full, page, qs));
    ok(`same as before regrouping · ${page} ${qs}`, r.bad.length === 0, r.bad.length ? `${r.bad.length}/${r.n}: ${r.bad.slice(0, 4).join(' ;; ')}` : '');
  }
}
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
