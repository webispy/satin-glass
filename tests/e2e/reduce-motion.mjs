// Reduce motion: the in-app toggle (e.g. for VDI / remote desktop) and the system setting both make every
// state change instant, switch off the pointer light, and keep progress indicators gently alive.
// usage: node tests/e2e/reduce-motion.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
import * as pw from 'playwright';
const b = await pw[process.env.BROWSER || 'chromium'].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

/* sample a reading every frame for `ms` after `act` runs in the page */
const sample = (p, act, read, ms = 400) => p.evaluate(({ act, read, ms }) => new Promise((res) => {
  const a = new Function(`return (${act})`)(), r = new Function(`return (${read})`)();
  const out = []; const t0 = performance.now(); a();
  const f = () => { out.push(r()); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), { act, read, ms });
/* readings that are neither the first nor the last value = frames in between = motion */
const between = (xs) => { const a = xs[0], z = xs[xs.length - 1]; return xs.filter((x) => Math.abs(x - a) > 0.5 && Math.abs(x - z) > 0.5).length; };

async function check(label, setup) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await setup(p);

  await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(700);
  const tab = await sample(p, `() => document.querySelectorAll('.gl-tabbar__bar .gl-tabbar__item')[3].click()`, `() => document.querySelector('.gl-tabbar__indicator').getBoundingClientRect().left`);
  ok(`${label}: tab selection jumps (no travel)`, between(tab) === 0, `frames in between ${between(tab)}`);

  await p.goto('http://localhost:4173/#/inputs'); await p.waitForTimeout(700);
  const sw = await sample(p, `() => document.querySelector('.docs__page .gl-switch').click()`, `() => document.querySelector('.docs__page .gl-switch__thumb').getBoundingClientRect().left`);
  ok(`${label}: switch jumps`, between(sw) === 0, `frames in between ${between(sw)}`);
  const sl = await sample(p, `() => { const s = document.querySelector('.docs__page .gl-slider'); s.focus(); s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); }`, `() => document.querySelector('.docs__page .gl-slider__thumb').getBoundingClientRect().left`);
  ok(`${label}: slider jumps`, between(sl) === 0, `frames in between ${between(sl)}`);

  await p.goto('http://localhost:4173/#/overlays'); await p.waitForTimeout(700);
  await p.getByRole('button', { name: '길찾기' }).click(); await p.waitForTimeout(40);
  const menuScale = await p.locator('.gl-menu').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  ok(`${label}: menu appears without blooming`, Math.abs(menuScale - 1) < 0.01, `scale at 40 ms ${menuScale.toFixed(3)}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await p.goto('http://localhost:4173/#/material'); await p.waitForTimeout(700);
  for (let i = 0; i < 8; i++) { await p.mouse.move(400 + i * 30, 400); await p.waitForTimeout(16); }
  const hk = await p.locator('.docs__page .gl-glass').first().evaluate((e) => ({ k: getComputedStyle(e).getPropertyValue('--gl-hk') || '0', shown: getComputedStyle(e, '::after').display }));
  ok(`${label}: no pointer light`, +hk.k === 0 || hk.shown === 'none', JSON.stringify(hk));

  await p.goto('http://localhost:4173/#/lists'); await p.waitForTimeout(700);
  const sp = await p.locator('.gl-spinner').first().evaluate((e) => ({ dur: getComputedStyle(e).animationDuration, iter: getComputedStyle(e).animationIterationCount }));
  ok(`${label}: spinner keeps turning, slowly`, parseFloat(sp.dur) >= 1 && sp.iter === 'infinite', JSON.stringify(sp));
  await p.close();
}

await check('in-app toggle', async (p) => {
  await p.goto('http://localhost:4173/#/overview'); await p.waitForTimeout(500);
  await p.getByRole('switch', { name: '동작 줄이기' }).click();
  /* the docs keep this in React state; navigate inside the SPA from here on */
  p.goto = ((orig) => async (url) => { await p.evaluate((u) => { location.hash = new URL(u).hash; }, url); })(p.goto.bind(p));
});
await check('system setting', async (p) => { await p.emulateMedia({ reducedMotion: 'reduce' }); });

/* and with nothing reduced, the same interactions do move (the checks above are meaningful) */
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(700);
  const tab = await sample(p, `() => document.querySelectorAll('.gl-tabbar__bar .gl-tabbar__item')[3].click()`, `() => document.querySelector('.gl-tabbar__indicator').getBoundingClientRect().left`);
  ok('control: without reduce motion the tab selection travels', between(tab) >= 4, `frames in between ${between(tab)}`);
  await p.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
