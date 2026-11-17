// How long until things arrive, per motion personality (motion page columns). usage: node tests/e2e/timing.mjs
import * as pw from 'playwright';
const b = await pw[process.env.BROWSER || 'chromium'].launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://localhost:4173/#/motion'); await p.waitForTimeout(900);
const names = ['calm', 'lively', 'playful'];
for (let i = 0; i < 3; i++) {
  const col = p.locator('.grid--3 > *').nth(i);
  /* switch: a real tap (press → release → click), time until the knob's far edge is within 1 px of the end, and until the whole thumb is in place */
  const sw = col.locator('.gl-switch'), r = await sw.boundingBox();
  await sw.evaluate((s) => { window.__t = []; const th = s.querySelector('.gl-switch__thumb'), tr = s.getBoundingClientRect(); window.__rec = true; const t0 = performance.now(); window.__t0 = t0;
    const f = () => { const q = th.getBoundingClientRect(); window.__t.push([performance.now() - t0, tr.right - q.right, q.left - tr.left, q.width]); if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.mouse.move(r.x + 12, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(900);
  const swT = await p.evaluate(() => { window.__rec = false; return window.__t; });
  const W = r.width, restW = swT[swT.length - 1][3];
  const lead = swT.find((f) => f[1] < 3)?.[0], whole = swT.find((f) => f[2] > W - restW - 2 - 1 && Math.abs(f[3] - restW) < 1)?.[0];
  /* segmented: one segment over */
  const seg = await col.locator('.gl-segmented').evaluate((sg) => new Promise((res) => {
    const ind = sg.querySelector('.gl-segmented__indicator'), it = sg.querySelectorAll('.gl-segmented__item')[1], tgt = it.getBoundingClientRect(), from = ind.getBoundingClientRect().left;
    const t0 = performance.now(); let t90 = null; it.click();
    const f = () => { const q = ind.getBoundingClientRect(); const k = (q.left - from) / (tgt.left - from); if (t90 === null && k >= 0.9) t90 = performance.now() - t0; if (performance.now() - t0 < 900) requestAnimationFrame(f); else res(t90); };
    requestAnimationFrame(f);
  }));
  console.log(`${names[i]}: switch leading edge arrives ${lead?.toFixed(0)} ms after press, whole thumb settled ${whole?.toFixed(0)} ms · segmented 90 % ${seg?.toFixed(0)} ms`);
}
await b.close();
