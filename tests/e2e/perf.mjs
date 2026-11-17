// Frame pacing while each interaction animates, CPU throttled ×4 (Chromium, headless). usage: node tests/e2e/perf.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const cdp = await p.context().newCDPSession(p);
await p.addInitScript(() => {
  window.__long = 0;
  try { new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch {}
});
let failed = 0;
async function measure(name, act, ms = 700) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const run = p.evaluate((ms) => new Promise((res) => {
    const d = []; let last = performance.now(); const t0 = last, l0 = window.__long;
    const f = (now) => { d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else res({ d, long: window.__long - l0 }); };
    requestAnimationFrame(f);
  }), ms);
  await act();
  const r = await run;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const d = r.d.slice(1).sort((a, b) => a - b), max = d[d.length - 1], p90 = d[Math.floor(d.length * 0.9)], drops = r.d.filter((x) => x > 25).length;
  const info = name.includes('informational');
  const pass = info || (drops <= 1 && r.long === 0);
  if (!pass) failed++;
  console.log(`${info ? 'INFO' : pass ? 'PASS' : 'FAIL'} ${name}: ${r.d.length} frames, p90 ${p90.toFixed(1)} ms, max ${max.toFixed(1)} ms, >25ms ${drops}, long tasks ${r.long}`);
}
await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(800);
const tabs = p.locator('.gl-tabbar__item');
await measure('tab bar: tap travel (droplet)', () => tabs.nth(3).click({ noWaitAfter: true }));
await measure('tab bar: tap back', () => tabs.nth(0).click({ noWaitAfter: true }));
await p.goto('http://localhost:4173/#/overlays'); await p.waitForTimeout(800);
await measure('menu bloom', () => p.getByRole('button', { name: '길찾기' }).click({ noWaitAfter: true }));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await measure('dialog open', () => p.getByRole('button', { name: '장소 삭제…' }).click({ noWaitAfter: true }));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
/* the very first overlay of a page pays a one-off cost (code paths and styles warm up); measured separately */
await measure('sheet open (cold, first ever) — informational', () => p.getByRole('button', { name: '장소 편집' }).click({ noWaitAfter: true }), 900).catch(() => {});
await p.keyboard.press('Escape'); await p.waitForTimeout(700);
await measure('sheet open', () => p.getByRole('button', { name: '장소 편집' }).click({ noWaitAfter: true }), 900);
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
await measure('toast in', () => p.getByRole('button', { name: '토스트', exact: true }).click({ noWaitAfter: true }));
await p.goto('http://localhost:4173/#/inputs'); await p.waitForTimeout(800);
await measure('switch toggle', () => p.locator('.docs__page .gl-switch').first().click({ noWaitAfter: true }), 500);
await measure('segmented tap', () => p.locator('.docs__page .gl-segmented').first().locator('.gl-segmented__item').nth(3).click({ noWaitAfter: true }));
await p.goto('http://localhost:4173/#/motion'); await p.waitForTimeout(900);
{
  const sl = p.locator('.grid--3 > *').nth(2).locator('.gl-slider'), b = await sl.boundingBox();
  await measure('slider drag, playful gel (JS spring)', async () => {
    await p.mouse.move(b.x + 8, b.y + b.height / 2); await p.mouse.down();
    for (let k = 1; k <= 20; k++) await p.mouse.move(b.x + 8 + (b.width - 16) * (k % 10) / 10, b.y + b.height / 2);
    await p.mouse.up();
  }, 900);
  await measure('segmented tap, playful squash', () => p.locator('.grid--3 > *').nth(2).locator('.gl-segmented__item').nth(2).click({ noWaitAfter: true }));
}
await p.goto('http://localhost:4173/#/material'); await p.waitForTimeout(800);
await measure('pointer light over 5 glass cards', async () => { for (let i = 0; i < 30; i++) await p.mouse.move(350 + i * 25, 380 + (i % 5) * 20); }, 900);
await p.goto('http://localhost:4173/#/showcase'); await p.waitForTimeout(800);
await measure('showcase scroll under glass bars', async () => { await p.mouse.move(780, 600); for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 60); } }, 900);
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
