// The blur budget (design-language.md 3. 성능 규칙), measured on every docs page and in compositions:
//   · one layer at a time: no glass that blurs inside glass that blurs (a glass control in a glass bar draws flat)
//   · at most three blurred surfaces over any point of the screen (bars, one panel, one sheet)
//   · at most six large blurred surfaces visible at once (a side over 120 px: bars, panels, sheets — the cost is the
//     blurred area; perf.mjs holds 60 fps at CPU x4 with five glass cards and the sidebar). Small glass (buttons,
//     chips, page dots) is free to repeat as long as it does not stack
// Checked at a desktop and a phone width, on the pages as they open, with the showcase scrolled and with a menu and
// a dialog open; the flattening itself is checked on a fixture (glass button in a glass panel, and in a clear bar). A surface counts as blurred when
// its computed backdrop-filter has a blur above 0.
// usage: node tests/e2e/blur-budget.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: css, foundation   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
import { PAGES } from './pages.mjs';

const measure = (p) => p.evaluate(() => {
  const blurs = (el) => { const cs = getComputedStyle(el); const f = cs.backdropFilter || cs.webkitBackdropFilter || 'none'; const m = /blur\(([\d.]+)px\)/.exec(f); return Boolean(m && parseFloat(m[1]) > 0); };
  const shown = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01; };
  const glass = [...document.querySelectorAll('*')].filter((el) => blurs(el) && shown(el));
  const nested = glass.filter((el) => glass.some((o) => o !== el && o.contains(el))).map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().split(' ').slice(0, 2).join('.')}`);
  let deep = 0;
  const rects = glass.map((el) => el.getBoundingClientRect());
  for (let x = 2; x < innerWidth; x += 16) for (let y = 2; y < innerHeight; y += 16) {
    let n = 0; for (const r of rects) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) n++;
    deep = Math.max(deep, n);
  }
  const large = glass.filter((el) => { const r = el.getBoundingClientRect(); return Math.max(r.width, r.height) > 120; }).length;
  return { count: glass.length, large, deep, nested: [...new Set(nested)] };
});
const judge = (where, r) => {
  ok(`${where}: no blurring glass inside blurring glass`, r.nested.length === 0, r.nested.slice(0, 3).join(', '));
  ok(`${where}: at most 3 blurred surfaces over any point`, r.deep <= 3, `${r.deep}`);
  ok(`${where}: at most 6 large blurred surfaces visible`, r.large <= 6, `${r.large} large of ${r.count}`);
};

for (const [w, h] of [[1280, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  for (const pg of PAGES) { await p.goto(`http://localhost:4173/?mode=light#/${pg}`); await p.waitForTimeout(500); judge(`${pg} @${w}`, await measure(p)); }
  await p.close();
}

const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
/* glass inside glass draws flat (a fixture: no docs page needs it any more) — and an app bar still clear at the
   top of the page lets its glass buttons keep their own glass */
await p.goto('http://localhost:4173/?mode=light#/overview'); await p.waitForTimeout(500);
{
  const r = await p.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = `<div class="sg-glass" id="outer" style="width:200px;height:80px"><button class="sg-button sg-button--glass sg-glass" id="inner">x</button></div>
      <header class="sg-appbar" data-transparent-top="" data-at-top=""><div class="sg-appbar__bar sg-glass"><button class="sg-button sg-button--glass sg-glass" id="clear">x</button></div></header>`;
    document.querySelector('.sg-root').appendChild(host);
    const f = (id) => { const cs = getComputedStyle(document.getElementById(id)); return cs.backdropFilter || cs.webkitBackdropFilter || 'none'; };
    const out = { outer: f('outer'), inner: f('inner'), clear: f('clear') };
    host.remove(); return out;
  });
  ok('glass inside glass draws flat (no blur of its own)', /blur\([1-9]/.test(r.outer) && r.inner === 'none', JSON.stringify(r));
  ok('glass in an app bar still clear at the top keeps its own glass', /blur\([1-9]/.test(r.clear), JSON.stringify(r));
}
/* the showcase scrolled */
await p.goto('http://localhost:4173/?mode=light#/showcase'); await p.waitForTimeout(600);
await p.locator('.phone__screen').evaluate((el) => { el.scrollTop = 400; }); await p.waitForTimeout(700);
judge('showcase scrolled', await measure(p));
/* a menu and a dialog open over a page */
await p.goto('http://localhost:4173/?mode=light#/overlays'); await p.waitForTimeout(600);
await p.getByRole('button', { name: /길찾기/ }).first().click(); await p.waitForTimeout(500);
judge('overlays with a menu open', await measure(p));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
const opener = p.locator('.sg-button').filter({ hasText: /삭제|대화상자|알림/ }).first();
if (await opener.count()) { await opener.click(); await p.waitForTimeout(600); judge('overlays with a dialog open', await measure(p)); }

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
