// An axe accessibility scan of every docs page but the foundation specimens, in light and in dark high contrast:
// no serious or critical violations. Reads the docs in Korean unless E2E_LANG=en (pw.mjs); the full run does both.
// usage: node tests/e2e/axe.mjs   (BROWSER=webkit|firefox, E2E_LANG=en; vite preview on :4173 or E2E_PORT)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { readFileSync } from 'node:fs';
import { PAGES } from './pages.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id, q = '') => `${pw.ORIGIN}/${q}#/${id}`;
/* the page in main (it loads lazily into an empty placeholder) and in the language asked for: an audit of the frame
   alone, or of the other language, would pass without reading the page */
const mounted = (p) => p.waitForFunction((lang) => document.querySelector('main .docs__page')?.childElementCount > 0 && document.documentElement.lang === lang, pw.LANG, { timeout: 10000 }).then(() => true, () => false);
const errors = [];
/* a page that throws, or logs an error of its own, fails the scan as it failed edge cases before (where it ran) */
const newPage = async () => {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost') && !/https?:\/\/(?!localhost)/.test(m.text())) errors.push(m.text()); });
  return p;
};
const settle = (p, ms = 900) => p.waitForTimeout(ms);

{
  const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const found = new Map();
  for (const q of ['', '?mode=dark&hc=1']) {
    const p = await newPage();
    /* every page but the foundation specimens (colour swatches and type samples are shown, not read) */
    for (const id of PAGES.filter((x) => !['material', 'colors', 'type', 'motion'].includes(x))) {
      await p.goto(U(id, q));
      if (!(await mounted(p))) { found.set(`not mounted in ${pw.LANG} within 10 s (${id}${q ? ' ' + q : ''})`, 'not audited'); continue; }
      await settle(p, 500);
      /* let entrance animations (fades) finish first — half-faded text would read as low contrast; endless ones
         (spinners, shimmer) are left running */
      await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]));
      await p.addScriptTag({ content: axe });
      const v = await p.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: true } } });
        return r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => ({ id: x.id, n: x.nodes.length, ex: x.nodes[0]?.target?.join(' ') }));
      });
      for (const x of v) found.set(`${x.id} (${id}${q ? ' ' + q : ''})`, `${x.n}× e.g. ${x.ex}`);
    }
    await p.context().close();
  }
  ok('axe: no serious or critical accessibility violations', found.size === 0, [...found].slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(' | '));
}

ok('no page errors during the scan', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
