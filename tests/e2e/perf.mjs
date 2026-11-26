// Frame pacing while each interaction animates, CPU throttled ×4 (Chromium, headless). usage: node tests/e2e/perf.mjs
import os from 'node:os';
import { chromium, ORIGIN } from './pw.mjs';
/* Rendered on the GPU, as in every user's browser: software rendering (SwiftShader, Playwright's default headless) pays
   a large backdrop blur on the CPU compositor, and its frames say more about the test machine than about the library.
   PERF_RENDER=software measures that way (where no GPU is available). The limits are set on an M1 MacBook Air: CPU
   throttling is relative to the host, so a faster machine passes what that one fails. */
const gpu = process.env.PERF_RENDER !== 'software';
const angle = process.platform === 'darwin' ? 'metal' : process.platform === 'win32' ? 'd3d11' : 'vulkan';
const b = await chromium.launch(gpu ? { args: [`--use-angle=${angle}`, '--enable-gpu'] } : {});
/* what the browser actually renders with, not what was asked for: a GPU run that fell back to software would be
   judged against the GPU limits */
const { gpu: info } = await (await b.newBrowserCDPSession()).send('SystemInfo.getInfo');
const compositing = info.featureStatus?.gpu_compositing ?? '?', renderer = info.auxAttributes?.glRenderer ?? info.devices?.[0]?.deviceString ?? '?';
console.log(`host: ${os.cpus()[0]?.model.trim()}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 2 ** 30)} GB; renderer: ${renderer}; GPU compositing ${compositing}`);
if (gpu && !compositing.startsWith('enabled')) {
  console.log(`no GPU rendering here (asked for ANGLE ${angle}): run with PERF_RENDER=software to measure in software`);
  await b.close();
  process.exit(1);
}
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const cdp = await p.context().newCDPSession(p);
/* the docs font comes from a CDN in unicode-range pieces: a piece that some page's text asks for arrives whenever it arrives, and the
   relayout it causes (every Pretendard run reshaped, ~100 ms at ×4) lands in whatever is being measured then — a docs-copy change
   was enough to move it into the dashboard tab switch. System fonts keep the frames about the library. */
await p.route(/pretendard/i, (r) => r.abort());
await p.addInitScript(() => {
  window.__long = 0;
  try { new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch {}
});
let failed = 0;
/* a press at the control's centre, the point found before measuring. Playwright's locator.click() scrolls, checks the
   target and marks it with events inside the page first: work that ran in the measured window at CPU ×4 and counted
   as the library's (a first tab bar tap dropped 1–3 frames that way, and none when pressed at its point) */
async function tap(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return () => p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
/* checked after a sample, outside its window: a press that missed would otherwise measure an idle page and pass */
async function expect(what, ok) {
  if (await ok()) return;
  failed++;
  console.log(`FAIL ${what}: the press did not take effect, so the sample before it measured nothing`);
}
const on = (loc, attr = 'aria-selected') => async () => (await loc.getAttribute(attr)) === 'true';
const shown = (loc) => async () => (await loc.count()) > 0;
async function measure(name, act, ms = 700) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  /* the sampler's first frame is the baseline; the input goes in after it, and every interval from there counts, the
     input's own handling included (sent before the first frame, it fell in an interval that was left out) */
  await p.evaluate((ms) => new Promise((ready) => {
    const s = window.__sample = { d: [] }, l0 = window.__long;
    s.result = new Promise((done) => {
      requestAnimationFrame((t0) => {
        let last = t0;
        const f = (now) => { s.d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else done({ d: s.d, long: window.__long - l0 }); };
        requestAnimationFrame(f);
        ready();
      });
    });
  }), ms);
  await act();
  const r = await p.evaluate(() => window.__sample.result);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const d = [...r.d].sort((a, b) => a - b), max = d[d.length - 1], p90 = d[Math.floor(d.length * 0.9)], drops = d.filter((x) => x > 25).length;
  const info = name.includes('informational');
  const pass = info || (drops <= 1 && r.long === 0);
  if (!pass) failed++;
  console.log(`${info ? 'INFO' : pass ? 'PASS' : 'FAIL'} ${name}: ${r.d.length} frames, p90 ${p90.toFixed(1)} ms, max ${max.toFixed(1)} ms, >25ms ${drops}, long tasks ${r.long}`);
}
await p.goto(`${ORIGIN}/#/navigation`); await p.waitForTimeout(800);
const tabs = p.locator('.sg-tabbar__item');
/* the first tap after load rasterizes something for the first time (#87): 1-2 frames of 33-50 ms right after it, and
   none on any later tap. A one-time first cost (design language 3.7, exceptions): recorded, not judged, and the travel
   is judged from the second tap on */
await measure('tab bar: first tap after load (informational, #87)', await tap(tabs.nth(2)));
await expect('tab bar: first tap', on(tabs.nth(2)));
await p.waitForTimeout(600);
await measure('tab bar: tap travel (droplet)', await tap(tabs.nth(3)));
await expect('tab bar: tap travel', on(tabs.nth(3)));
await measure('tab bar: tap back', await tap(tabs.nth(0)));
await expect('tab bar: tap back', on(tabs.nth(0)));
await p.goto(`${ORIGIN}/#/overlays`); await p.waitForTimeout(800);
await measure('menu bloom', await tap(p.getByRole('button', { name: '길찾기' })));
await expect('menu bloom', shown(p.getByRole('menu')));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await measure('dialog open', await tap(p.getByRole('button', { name: '장소 삭제…' })));
await expect('dialog open', shown(p.getByRole('alertdialog').or(p.getByRole('dialog'))));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
/* the very first overlay of a page pays a one-off cost (code paths and styles warm up); measured separately */
await measure('sheet open (cold, first ever) — informational', await tap(p.getByRole('button', { name: '장소 편집' })), 900).catch(() => {});
await expect('sheet open (cold)', shown(p.getByRole('dialog')));
await p.keyboard.press('Escape'); await p.waitForTimeout(700);
await measure('sheet open', await tap(p.getByRole('button', { name: '장소 편집' })), 900);
await expect('sheet open', shown(p.getByRole('dialog')));
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
await measure('toast in', await tap(p.getByRole('button', { name: '토스트', exact: true })));
await expect('toast in', shown(p.locator('.sg-toast')));
await p.goto(`${ORIGIN}/#/inputs`); await p.waitForTimeout(800);
{ const sw = p.locator('.docs__page .sg-switch').first(), was = await sw.getAttribute('aria-checked');
  await measure('switch toggle', await tap(sw), 500);
  await expect('switch toggle', async () => (await sw.getAttribute('aria-checked')) !== was); }
await measure('segmented tap', await tap(p.locator('.docs__page .sg-segmented').first().locator('.sg-segmented__item').nth(3)));
await expect('segmented tap', on(p.locator('.docs__page .sg-segmented').first().locator('.sg-segmented__item').nth(3), 'aria-checked'));
await p.goto(`${ORIGIN}/#/motion`); await p.waitForTimeout(900);
{
  const sl = p.locator('.grid--3 > *').nth(2).locator('.sg-slider'), b = await sl.boundingBox();
  await measure('slider drag, playful gel (JS spring)', async () => {
    await p.mouse.move(b.x + 8, b.y + b.height / 2); await p.mouse.down();
    for (let k = 1; k <= 20; k++) await p.mouse.move(b.x + 8 + (b.width - 16) * (k % 10) / 10, b.y + b.height / 2);
    await p.mouse.up();
  }, 900);
  await measure('segmented tap, playful squash', await tap(p.locator('.grid--3 > *').nth(2).locator('.sg-segmented__item').nth(2)));
  await expect('segmented tap, playful squash', on(p.locator('.grid--3 > *').nth(2).locator('.sg-segmented__item').nth(2), 'aria-checked'));
}
await p.goto(`${ORIGIN}/#/material`); await p.waitForTimeout(800);
await measure('pointer light over 5 glass cards', async () => { for (let i = 0; i < 30; i++) await p.mouse.move(350 + i * 25, 380 + (i % 5) * 20); }, 900);
await p.goto(`${ORIGIN}/#/showcase`); await p.waitForTimeout(800);
await measure('showcase scroll under glass bars', async () => { await p.mouse.move(780, 600); for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 60); } }, 900);
await p.goto(`${ORIGIN}/#/display`); await p.waitForTimeout(900);
{
  const sc = p.locator('[data-scroll=largetitle]'), r = await sc.boundingBox();
  await measure('large title hand-over while scrolling', async () => { await p.mouse.move(r.x + r.width / 2, r.y + 300); for (let i = 0; i < 10; i++) await p.mouse.wheel(0, 15); }, 700);
  await sc.evaluate((e) => { e.scrollTop = 0; });
  await p.getByRole('button', { name: '다시 불러오기' }).click(); await p.waitForTimeout(100);
  await measure('skeleton light sweep (11 placeholders)', async () => {}, 900);
  /* the reload above ends after 1.8 s and replaces the placeholders above the thumbnail: wait for it (its button is
     disabled while it loads), so the layout does not move under the press or into the viewer's sample */
  await p.waitForFunction(() => [...document.querySelectorAll('[data-demo=skeleton] button')].some((b) => !b.disabled), null, { timeout: 5000 });
  const th = p.locator('[data-demo=media] button').nth(1); await th.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await measure('media viewer opens out of its thumbnail', await tap(th), 800);
  await expect('media viewer opens', shown(p.locator('.sg-media')));
  await p.waitForTimeout(300);
  await measure('media viewer: page to the next photo', () => p.keyboard.press('ArrowRight'), 800);
  await measure('media viewer: swipe with the finger (mouse)', async () => { await p.mouse.move(900, 450); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(900 - i * 40, 452); await p.mouse.up(); }, 900);
  await measure('media viewer: double-click zoom', () => p.mouse.dblclick(700, 420), 700);
  await measure('media viewer: pan while zoomed', async () => { await p.mouse.move(700, 420); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(700 + i * 15, 420 + i * 5); await p.mouse.up(); }, 900);
  await p.keyboard.press('0'); await p.waitForTimeout(500);
  await measure('media viewer: swipe down to close (back into the thumbnail)', async () => { await p.mouse.move(640, 300); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(640, 300 + i * 30); await p.mouse.up(); }, 900);
}
await p.goto(`${ORIGIN}/#/dashboard`); await p.waitForTimeout(1500);
{
  /* the overview: 4 stats, line, bars, donut, sparklines, a table — then the products table and its tab switch */
  const plot = p.locator('.sg-chart__plot').first(), pr = await plot.boundingBox();
  await measure('line chart: crosshair following the pointer', async () => { for (let i = 0; i < 30; i++) await p.mouse.move(pr.x + 40 + i * (pr.width - 80) / 30, pr.y + pr.height / 2); }, 900);
  /* the first time a page lays out this content it pays a one-off cost (text shaping, styles); measured apart */
  await measure('tabs: first switch to products (cold, first ever) — informational', await tap(p.getByRole('tab', { name: '상품' })), 1000);
  await expect('tabs: first switch to products', on(p.getByRole('tab', { name: '상품' })));
  await p.waitForTimeout(1200);
  const t = p.locator('[data-demo=dashboard] .sg-table').first(); await t.scrollIntoViewIfNeeded(); const r = await t.boundingBox();
  await measure('data table (24 rows × 8 columns, groups, pinned, sticky): scroll both ways', async () => { await p.mouse.move(r.x + r.width / 2, r.y + 200); for (let i = 0; i < 10; i++) { await p.mouse.wheel(i % 2 ? 60 : 0, 50); } }, 800);
  await p.getByRole('tab', { name: '개요' }).click(); await p.waitForTimeout(1200);
  await measure('tabs: switch to products (warm)', await tap(p.getByRole('tab', { name: '상품' })), 1000);
  await expect('tabs: switch to products', on(p.getByRole('tab', { name: '상품' })));
  await measure('tabs: back to the overview (4 stats, 3 charts, sparklines, a table mount)', await tap(p.getByRole('tab', { name: '개요' })), 1000);
  await expect('tabs: back to the overview', on(p.getByRole('tab', { name: '개요' })));
}
await p.goto(`${ORIGIN}/#/table`); await p.waitForTimeout(1200);
{
  const v = p.locator('[data-demo=table-virtual] .sg-table'); await v.scrollIntoViewIfNeeded(); const vr = await v.boundingBox();
  await measure('virtual table, 5,000 rows: fast wheel scrolling', async () => { await p.mouse.move(vr.x + vr.width / 2, vr.y + 200); for (let i = 0; i < 16; i++) await p.mouse.wheel(0, 400); }, 900);
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
