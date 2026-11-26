// A progress bar fed twice, 110 ms apart: when the second value arrives mid-flight, the fill should keep its
// speed (JS spring) rather than drop to rest and ease out again (a restarted CSS transition).
import * as pw from './pw.mjs';
const b = await pw[process.env.BROWSER || 'chromium'].launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(`${pw.ORIGIN}/#/motion`); await p.waitForTimeout(900);
const r = await p.locator('.grid--3 > *').nth(1).evaluate((col) => new Promise((res) => {
  const btn = [...col.querySelectorAll('button')].find((x) => x.textContent === '+30'); const bar = col.querySelector('.sg-progress__bar');
  const xs = []; let second = 0; const t0 = performance.now();
  btn.click(); setTimeout(() => { second = performance.now(); btn.click(); }, 110);
  const f = () => { xs.push([performance.now(), new DOMMatrix(getComputedStyle(bar).transform).a]); if (performance.now() - t0 < 600) requestAnimationFrame(f); else res({ xs, second }); };
  requestAnimationFrame(f);
}));
const v = r.xs.slice(1).map((x, i) => [x[0], (x[1] - r.xs[i][1]) / ((x[0] - r.xs[i][0]) / 1000)]);
const before = Math.max(...v.filter(([t]) => t < r.second && t > r.second - 40).map(([, s]) => s));
const dip = Math.min(...v.filter(([t]) => t > r.second + 5 && t < r.second + 60).map(([, s]) => s));
console.log(`speed just before the 2nd value ${before.toFixed(2)}/s, lowest right after ${dip.toFixed(2)}/s → keeps ${(dip / before * 100).toFixed(0)} %`);
await b.close();
process.exitCode = dip / before < 0.5 ? 1 : 0;
