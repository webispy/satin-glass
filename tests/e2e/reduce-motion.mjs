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
  /* sheet: slides up on narrow screens and blooms on wide ones — either way, reduced motion means neither */
  const sheet = await p.evaluate(() => new Promise((res) => {
    let scale = 0, move = 0; const t0 = performance.now();
    [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '장소 편집').click();
    const f = () => { const s = document.querySelector('.gl-sheet'); if (s) { const m = new DOMMatrix(getComputedStyle(s).transform); scale = Math.max(scale, Math.abs(m.a - 1)); move = Math.max(move, Math.abs(m.f)); } if (performance.now() - t0 < 300) requestAnimationFrame(f); else res({ scale: +scale.toFixed(3), move: +move.toFixed(1) }); };
    requestAnimationFrame(f);
  }));
  ok(`${label}: sheet appears in place (no sliding up, no zoom)`, sheet.scale < 0.005 && sheet.move < 0.5, JSON.stringify(sheet));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  /* ---- sweep: while each interaction plays, no element grows, shrinks or travels (except the brief slides above) ---- */
  /* watches the transforms of everything matching `sel` every frame; returns the largest scale deviation and travel */
  const watch = (act, sel, ms = 350) => p.evaluate(({ act, sel, ms }) => new Promise((res) => {
    const a = new Function(`return (${act})`)();
    let scale = 0, move = 0, both = 0; const t0 = performance.now(); a();
    const f = () => {
      for (const e of document.querySelectorAll(sel)) {
        const m = new DOMMatrix(getComputedStyle(e).transform);
        const sc = getComputedStyle(e).scale; const extra = sc && sc !== 'none' ? Math.max(...sc.split(' ').map((x) => Math.abs(+x - 1))) : 0;
        scale = Math.max(scale, Math.abs(m.a - 1), Math.abs(m.d - 1), extra); move = Math.max(move, Math.abs(m.e), Math.abs(m.f));
      }
      both = Math.max(both, document.querySelectorAll('.gl-stepper__value > span:not([style*="display: none"])').length);
      if (performance.now() - t0 < ms) requestAnimationFrame(f); else res({ scale: +scale.toFixed(3), move: +move.toFixed(1), both });
    };
    requestAnimationFrame(f);
  }), { act, sel, ms });
  const still = (r) => r.scale < 0.005 && r.move < 0.5;

  await go('inputs');
  const stp = await watch(`() => document.querySelector('.docs__page [aria-label^="Increase"]').click()`, '.docs__page .gl-stepper__value > span');
  const visibleNums = await p.locator('.docs__page .gl-stepper__value').first().evaluate((v) => [...v.children].filter((c) => getComputedStyle(c).display !== 'none').length);
  ok(`${label}: stepper — the number just changes (one number, no roll, no cross-fade)`, still(stp) && visibleNums === 1, JSON.stringify({ ...stp, visibleNums }));
  const field = p.locator('.docs__page input.gl-field__input').first();
  await field.fill('');
  const clr = await watch(`() => { const i = document.querySelector('.docs__page input.gl-field__input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '헤론'); i.dispatchEvent(new Event('input', { bubbles: true })); }`, '.docs__page .gl-field__clear');
  ok(`${label}: text field — the clear button appears without popping`, still(clr), JSON.stringify(clr));
  const can = await watch(`() => document.querySelector('.docs__page .gl-search input').focus()`, '.docs__page .gl-search__cancel');
  ok(`${label}: search field — Cancel appears without sliding`, can.move < 0.5, JSON.stringify(can));
  await p.locator('.docs__page .gl-search input').blur();
  await p.locator('.docs__page .gl-chip').first().scrollIntoViewIfNeeded();
  const chipBox = await p.locator('.docs__page .gl-chip').first().boundingBox();
  await p.mouse.move(chipBox.x + 10, chipBox.y + 10); await p.mouse.down(); await p.waitForTimeout(120);
  const chipS = await p.locator('.docs__page .gl-chip').first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  await p.mouse.up();
  ok(`${label}: chip — no press-in`, Math.abs(chipS - 1) < 0.005, `scale ${chipS}`);
  const thumb = p.locator('.docs__page .gl-slider').first(); await thumb.scrollIntoViewIfNeeded(); const tb2 = await thumb.boundingBox();
  await p.mouse.move(tb2.x + tb2.width / 2, tb2.y + tb2.height / 2); await p.mouse.down(); await p.waitForTimeout(250);
  const held = await thumb.evaluate((s) => ({ scale: getComputedStyle(s.querySelector('.gl-slider__thumb')).scale, bubble: new DOMMatrix(getComputedStyle(s.querySelector('.gl-slider__bubble')).transform).f }));
  await p.mouse.up();
  ok(`${label}: slider — held thumb does not swell, bubble does not rise`, (held.scale === 'none' || Math.abs(parseFloat(held.scale) - 1) < 0.005) && Math.abs(held.bubble) < 0.5, JSON.stringify(held));

  await go('buttons');
  const btn = p.locator('.docs__page .gl-button--filled').first(); await btn.scrollIntoViewIfNeeded(); const bb = await btn.boundingBox();
  await p.mouse.move(bb.x + 10, bb.y + 10); await p.mouse.down(); await p.waitForTimeout(150);
  const bs = await btn.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  await p.mouse.up();
  ok(`${label}: button — no press-in`, Math.abs(bs - 1) < 0.005, `scale ${bs}`);
  const ld = await watch(`() => [...document.querySelectorAll('.docs__page button')].find((x) => x.textContent.includes('다운로드')).click()`, '.docs__page .gl-button__spinner');
  ok(`${label}: button loading — the spinner fades in (no zoom)`, still(ld), JSON.stringify(ld));

  await go('lists');
  const card = p.locator('.docs__page .gl-card--interactive').first(); await card.scrollIntoViewIfNeeded(); const cb = await card.boundingBox();
  await p.mouse.move(cb.x + 20, cb.y + 20); await p.mouse.down(); await p.waitForTimeout(150);
  const cs2 = await card.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  await p.mouse.up();
  ok(`${label}: card — no press-in`, Math.abs(cs2 - 1) < 0.005, `scale ${cs2}`);

  await go('navigation');
  const dots = await trace(p, `() => document.querySelectorAll('.docs__page .gl-pagecontrol__dot')[4].click()`, `() => document.querySelectorAll('.docs__page .gl-pagecontrol__dot')[4].getBoundingClientRect().width`);
  const cd = calm(dots);
  ok(`${label}: page control — the dot widens briefly, no overshoot`, cd.ok, JSON.stringify(cd));
  const tabIcon = p.locator('.gl-tabbar__item').nth(1); await tabIcon.scrollIntoViewIfNeeded(); const ti = await tabIcon.boundingBox();
  await p.mouse.move(ti.x + ti.width / 2, ti.y + ti.height / 2); await p.mouse.down(); await p.waitForTimeout(150);
  const tis = await tabIcon.locator('.gl-tabbar__icon').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  await p.mouse.up();
  ok(`${label}: tab bar — the icon does not press in`, Math.abs(tis - 1) < 0.005, `scale ${tis}`);

  await go('motion');
  const bdg = await watch(`() => document.querySelector('.grid--3 > *:nth-child(2) [aria-label$="개수"] [aria-label^="Increase"]').click()`, '.grid--3 > *:nth-child(2) .gl-badge');
  ok(`${label}: badge — the count changes without a bump`, still(bdg), JSON.stringify(bdg));

  await go('overlays');
  const dlg = await watch(`() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '장소 삭제…').click()`, '.gl-dialog', 300);
  ok(`${label}: dialog — fades in place (no zoom)`, still(dlg), JSON.stringify(dlg));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const as = await watch(`() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '공유 옵션…').click()`, '.gl-actionsheet', 300);
  ok(`${label}: action sheet — fades in place (no rising)`, still(as), JSON.stringify(as));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const ts = await watch(`() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '토스트').click()`, '.gl-toast', 300);
  ok(`${label}: toast — fades in place (no drop, no zoom)`, still(ts), JSON.stringify(ts));
  const ph = p.getByRole('button', { name: '노을 사진' }); await ph.scrollIntoViewIfNeeded(); const pb = await ph.boundingBox();
  await p.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await p.mouse.down(); await p.waitForTimeout(470);
  const lift = await watch(`() => {}`, '.gl-lift', 250);
  await p.mouse.up(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(`${label}: context menu — the item does not lift (no zoom)`, still(lift), JSON.stringify(lift));

  await go('selection');
  const sel = await watch(`() => document.querySelectorAll('[role=combobox]')[0].click()`, '.gl-listbox', 300);
  ok(`${label}: select — the list fades in place (no blooming)`, still(sel), JSON.stringify(sel));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const tickDraw = await trace(p, `() => document.querySelectorAll('.gl-check__input')[6].click()`, `() => parseFloat(getComputedStyle(document.querySelectorAll('.gl-check__tick')[6]).strokeDashoffset)`, 300);
  ok(`${label}: checkbox — the tick appears without drawing`, tickDraw.every(([, x]) => x === 0), `dashoffsets ${[...new Set(tickDraw.map(([, x]) => x))].slice(0, 4)}`);
  const dot = await watch(`() => document.querySelectorAll('.gl-check--radio .gl-check__input')[1].click()`, '.gl-check--radio .gl-check__dot', 300);
  ok(`${label}: radio — the dot appears without growing`, dot.scale < 0.005, JSON.stringify(dot));
  await p.getByRole('button', { name: /방문 날짜/ }).click(); await p.waitForTimeout(400);
  const cal = await watch(`() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))`, '.gl-datepicker-panel .gl-calendar__body', 350);
  ok(`${label}: calendar — the next month fades in (no sliding)`, still(cal), JSON.stringify(cal));
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

/* SANITY=1: run the same checks with motion NOT reduced — most should fail, proving the checks see motion */
if (process.env.SANITY) {
  await check('not reduced (sanity: expect FAILs)', async (p) => async (id) => { await p.goto(`http://localhost:4173/#/${id}`); await p.waitForTimeout(600); });
  await b.close(); process.exit(0);
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
