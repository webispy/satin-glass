// Reduced motion (the in-app toggle, e.g. for VDI / remote desktop, and the system setting).
// The rule is NOT "everything instant" — a control stepping through several states in a few frames reads as
// stutter. Small state changes slide briefly in one direction with no overshoot and no stretch; anything that
// travels, grows or bounces becomes a fade; the pointer light is off; progress indicators keep moving gently.
// usage: node tests/e2e/reduce-motion.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
import * as pw from 'playwright';
const b = await pw[process.env.BROWSER || 'chromium'].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

/* trace a reading every frame for `ms` after `act` runs in the page → [[t, value], …] */
const trace = (p, act, read, ms = 450) => p.evaluate(({ act, read, ms }) => new Promise((res) => {
  const a = new Function(`return (${act})`)(), r = new Function(`return (${read})`)();
  const out = []; const t0 = performance.now(); a();
  const f = () => { out.push([performance.now() - t0, r()]); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), { act, read, ms });
/* a calm move: one direction only, never past the end, done within `limit` ms */
function calm(tr, limit = 300) {
  const v = tr.map(([, x]) => x), end = v[v.length - 1], start = v[0], dir = Math.sign(end - start);
  let back = 0, past = 0;
  for (let i = 1; i < v.length; i++) { if ((v[i] - v[i - 1]) * dir < -0.3) back++; if ((v[i] - end) * dir > 0.5) past++; }
  const tol = Math.max(0.5, Math.abs(end - start) * 0.01);   /* "arrived" = within 1 % of the distance */
  const done = tr.find(([, x]) => Math.abs(x - end) < tol)?.[0] ?? Infinity;
  const moved = v.filter((x) => Math.abs(x - start) > 0.5 && Math.abs(x - end) > 0.5).length;
  return { ok: back === 0 && past === 0 && done <= limit, back, past, done: Math.round(done), moved };
}

async function check(label, setup) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const go = await setup(p);

  await go('navigation');
  const tab = await trace(p, `() => document.querySelectorAll('.gl-tabbar__bar .gl-tabbar__item')[3].click()`,
    `() => { const i = document.querySelector('.gl-tabbar__indicator'), r = i.getBoundingClientRect(); return [r.left, r.width, new DOMMatrix(getComputedStyle(i).transform).d]; }`);
  const tl = tab.map(([t, v]) => [t, v[0]]), tw = tab.map(([, v]) => v[1]), tsq = tab.map(([, v]) => 1 - v[2]);
  const ct = calm(tl);
  ok(`${label}: tab selection slides briefly, rigid (no stretch, no squash, no overshoot)`, ct.ok && ct.moved >= 2 && Math.max(...tw) - Math.min(...tw) <= 1 && Math.max(...tsq) < 0.001, JSON.stringify({ ...ct, widthRange: +(Math.max(...tw) - Math.min(...tw)).toFixed(2) }));

  await go('inputs');
  /* a real tap: press, release */
  const sw = p.locator('.docs__page .gl-switch').first(), r = await sw.boundingBox();
  await sw.evaluate((s) => { window.__t = []; const th = s.querySelector('.gl-switch__thumb'), t0 = performance.now(); window.__rec = true;
    const f = () => { const q = th.getBoundingClientRect(); window.__t.push([performance.now() - t0, q.left, q.width]); if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const t0 = await p.evaluate(() => performance.now());
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(70); await p.mouse.up(); await p.waitForTimeout(500);
  const swt = await p.evaluate(() => { window.__rec = false; return window.__t; });
  void t0;
  const widths = swt.map((f) => f[2]), cs = calm(swt.map(([t, x]) => [t, x]), 600);
  ok(`${label}: switch tap slides once — no widening on press, no back-and-forth`, cs.back === 0 && cs.past === 0 && cs.moved >= 2 && Math.max(...widths) - Math.min(...widths) <= 0.6, JSON.stringify({ ...cs, widthRange: +(Math.max(...widths) - Math.min(...widths)).toFixed(2) }));

  const sl = await trace(p, `() => { const s = document.querySelector('.docs__page .gl-slider'); s.focus(); s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); }`, `() => document.querySelector('.docs__page .gl-slider__thumb').getBoundingClientRect().left`);
  const csl = calm(sl);
  ok(`${label}: slider glides briefly without overshoot`, csl.ok && csl.moved >= 2, JSON.stringify(csl));

  const st = await trace(p, `() => document.querySelector('.docs__page [aria-label^="Increase"]').click()`, `() => { const s = document.querySelector('.docs__page .gl-stepper__value [data-roll]'); return s ? new DOMMatrix(getComputedStyle(s).transform).f : 0; }`, 250);
  ok(`${label}: stepper number fades (no rolling)`, st.every(([, y]) => Math.abs(y) < 0.5), `max offset ${Math.max(...st.map(([, y]) => Math.abs(y))).toFixed(1)}`);

  await go('overlays');
  const menu = await trace(p, `() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '길찾기').click()`, `() => { const m = document.querySelector('.gl-menu'); return m ? new DOMMatrix(getComputedStyle(m).transform).a * 1000 + Math.round(+getComputedStyle(m).opacity * 100) / 100 : -1; }`, 250);
  const scales = menu.filter(([, v]) => v >= 0).map(([, v]) => Math.floor(v) / 1000), ops = menu.filter(([, v]) => v >= 0).map(([, v]) => v % 1);
  ok(`${label}: menu fades in place (no growing)`, scales.every((s) => Math.abs(s - 1) < 0.005) && ops.some((o) => o > 0.05 && o < 0.95), `scales ${[...new Set(scales)].join(',')}, fading frames ${ops.filter((o) => o > 0.05 && o < 0.95).length}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const sheet = await trace(p, `() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '장소 편집').click()`, `() => { const s = document.querySelector('.gl-sheet'); return s ? Math.abs(new DOMMatrix(getComputedStyle(s).transform).f) : -1; }`, 300);
  ok(`${label}: sheet appears in place (no sliding up)`, sheet.filter(([, v]) => v >= 0).every(([, v]) => v < 0.5), `max offset ${Math.max(...sheet.map(([, v]) => v)).toFixed(1)}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await go('material');
  for (let i = 0; i < 8; i++) { await p.mouse.move(400 + i * 30, 400); await p.waitForTimeout(16); }
  const hk = await p.locator('.docs__page .gl-glass').first().evaluate((e) => ({ k: getComputedStyle(e).getPropertyValue('--gl-hk') || '0', shown: getComputedStyle(e, '::after').display }));
  ok(`${label}: no pointer light`, +hk.k === 0 || hk.shown === 'none', JSON.stringify(hk));

  await go('lists');
  const sp = await p.locator('.gl-spinner').first().evaluate((e) => ({ dur: getComputedStyle(e).animationDuration, iter: getComputedStyle(e).animationIterationCount }));
  ok(`${label}: spinner keeps turning, slowly`, parseFloat(sp.dur) >= 1 && sp.iter === 'infinite', JSON.stringify(sp));
  await p.close();
}

await check('in-app toggle', async (p) => {
  await p.goto('http://localhost:4173/#/overview'); await p.waitForTimeout(500);
  await p.locator('.docs__settings--bar').getByRole('switch', { name: '동작 줄이기' }).click();
  /* the docs keep this in React state: navigate inside the app */
  return async (id) => { await p.evaluate((h) => { location.hash = h; }, `#/${id}`); await p.waitForTimeout(600); };
});
await check('system setting', async (p) => {
  await p.emulateMedia({ reducedMotion: 'reduce' });
  return async (id) => { await p.goto(`http://localhost:4173/#/${id}`); await p.waitForTimeout(600); };
});

/* control: without reduced motion the same tab tap stretches (so the rigidity check above means something) */
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(700);
  const w = await trace(p, `() => document.querySelectorAll('.gl-tabbar__bar .gl-tabbar__item')[3].click()`, `() => document.querySelector('.gl-tabbar__indicator').getBoundingClientRect().width`);
  ok('control: without reduced motion the tab drop stretches', Math.max(...w.map(([, x]) => x)) - w[0][1] > 15, `stretch ${(Math.max(...w.map(([, x]) => x)) - w[0][1]).toFixed(0)} px`);
  await p.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
