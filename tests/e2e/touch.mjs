// Finger drags on a phone, with real touch input (Chromium's CDP touch events: a touch the browser itself arbitrates,
// with implicit pointer capture to the element under the finger — the case mouse-driven tests never reach).
//   sheet: a short slow drag springs back, a long drag closes it, the header drags too
//   switch, slider, segmented control, tab bar: the drag follows the finger and lands where it is released
// usage: node tests/e2e/touch.mjs   (Chromium only; PORT (default 4173); Q for settings)
import * as pw from 'playwright';
const PORT = process.env.PORT || '4173', Q = process.env.Q || '';
const b = await pw.chromium.launch();
const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`http://localhost:${PORT}/${Q}#/${id}`); await p.waitForTimeout(1200); };
const swipe = async (x0, y0, x1, y1, steps = 15, ms = 16) => {
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await t('touchStart', x0, y0);
  for (let i = 1; i <= steps; i++) { await t('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await p.waitForTimeout(ms); }
  await p.waitForTimeout(120); await t('touchEnd', x1, y1);
};
const page = p.locator('.docs__page');

/* sheet */
await go('overlays');
const openSheet = async () => { const btn = p.getByRole('button', { name: '장소 편집' }); await btn.scrollIntoViewIfNeeded(); await btn.tap(); await p.waitForTimeout(900); return p.locator('.gl-sheet__grabber').boundingBox(); };
let g = await openSheet();
const cx = g.x + g.width / 2;
/* mid-drag: the sheet follows the finger (the drag used to end the moment the browser handed the touch over) */
const follow = (async () => { await p.waitForTimeout(260); return p.locator('.gl-sheet').evaluate((e) => e.style.transform); })();
await swipe(cx, g.y + 10, cx, g.y + 70, 15, 40);
const mid = await follow; await p.waitForTimeout(800);
ok('sheet: the grabber drags the sheet with the finger', /translateY\(\d/.test(mid), mid);
ok('sheet: a short, slow drag springs back (still open)', (await p.locator('.gl-sheet').count()) === 1 && (await p.locator('.gl-sheet').evaluate((e) => e.style.transform)) === '');
await swipe(cx, g.y + 10, cx, g.y + 300, 20, 30); await p.waitForTimeout(800);
ok('sheet: a long drag down closes it', (await p.locator('.gl-sheet').count()) === 0);
g = await openSheet();
await swipe(cx, g.y + 60, cx, g.y + 260, 12, 25); await p.waitForTimeout(800);
ok('sheet: dragging by the header closes it too', (await p.locator('.gl-sheet').count()) === 0);

/* switch, slider, segmented control */
await go('inputs');
const sw = page.getByRole('switch').first(); await sw.scrollIntoViewIfNeeded();
const s0 = await sw.getAttribute('aria-checked'), sb = await sw.boundingBox(), on = s0 === 'true';
await swipe(on ? sb.x + sb.width - 10 : sb.x + 10, sb.y + sb.height / 2, on ? sb.x + 2 : sb.x + sb.width - 2, sb.y + sb.height / 2, 10, 25); await p.waitForTimeout(500);
ok('switch: dragging the thumb across toggles it', (await sw.getAttribute('aria-checked')) !== s0, `${s0} → ${await sw.getAttribute('aria-checked')}`);
const sl = page.locator('.gl-slider').first(); await sl.scrollIntoViewIfNeeded();
const val = () => sl.evaluate((e) => +(e.getAttribute('role') === 'slider' ? e : e.querySelector('[role=slider]')).getAttribute('aria-valuenow'));
const lb = await sl.boundingBox(), v0 = await val();
await swipe(lb.x + lb.width * 0.2, lb.y + lb.height / 2, lb.x + lb.width * 0.85, lb.y + lb.height / 2, 15, 25); await p.waitForTimeout(400);
const v1 = await val();
ok('slider: the value follows a drag to where the finger lifts', v1 > v0 && v1 >= 75, `${v0} → ${v1}`);
const seg = page.locator('.gl-segmented').first(); await seg.scrollIntoViewIfNeeded();
const items = seg.locator('.gl-segmented__item'), n = await items.count();
const from = await seg.locator('[aria-checked=true]').boundingBox(), lastOn = (await items.nth(n - 1).getAttribute('aria-checked')) === 'true';
const to = await items.nth(lastOn ? 0 : n - 1).boundingBox(), want = (await items.nth(lastOn ? 0 : n - 1).textContent()).trim();
const xs = seg.evaluate((s) => new Promise((r) => { const ind = s.querySelector('.gl-segmented__indicator'), out = [], t0 = performance.now(); const f = () => { out.push(Math.round(ind.getBoundingClientRect().left)); if (performance.now() - t0 < 500) requestAnimationFrame(f); else r(out); }; requestAnimationFrame(f); }));
await swipe(from.x + from.width / 2, from.y + from.height / 2, to.x + to.width / 2, to.y + to.height / 2, 15, 25);
const path = await xs; await p.waitForTimeout(500);
ok('segmented: the drop follows the finger and selects where it is released', new Set(path).size > 5 && (await seg.locator('[aria-checked=true]').textContent()).trim() === want, `${new Set(path).size} positions, now ${(await seg.locator('[aria-checked=true]').textContent()).trim()}`);

/* tab bar */
await go('navigation');
const tb = page.locator('.gl-tabbar__track').first(); await tb.scrollIntoViewIfNeeded();
const a = await tb.locator('[aria-selected=true]').boundingBox(), last = tb.locator('.gl-tabbar__item').last(), z = await last.boundingBox();
await swipe(a.x + a.width / 2, a.y + a.height / 2, z.x + z.width / 2, z.y + z.height / 2, 15, 25); await p.waitForTimeout(600);
ok('tab bar: dragging the selection to the last tab selects it', (await last.getAttribute('aria-selected')) === 'true');

ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
