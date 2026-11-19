// Large-title app bar, breadcrumbs, skeleton and media viewer in a real browser.
// usage: node tests/e2e/display.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173; Q for settings)
// covers: layout, navigation   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const reduced = /rm=1/.test(Q);
const b = await pw[engine].launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost')) errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`http://localhost:4173/${Q}#/${id}`); await p.waitForTimeout(700); };
const page = p.locator('.docs__page');
/* record `read` every frame while `act` runs */
const frames = (act, read, ms = 500) => p.evaluate(({ act, read, ms }) => new Promise((res) => {
  const a = new Function(`return (${act})`)(), r = new Function(`return (${read})`)();
  const out = []; const t0 = performance.now(); a();
  const f = () => { out.push(r()); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), { act, read, ms });

await go('display');

/* ---------------------------------------------------------------- large title */
{
  const sc = p.locator('[data-scroll=largetitle]');
  await sc.scrollIntoViewIfNeeded();
  const read = () => sc.evaluate((e) => {
    const h = e.querySelector('.sg-appbar'), small = h.querySelector('.sg-appbar__title'), large = e.querySelector('.sg-appbar__large');
    return { small: +getComputedStyle(small).opacity, rise: new DOMMatrix(getComputedStyle(small).transform).f, large: +getComputedStyle(large).opacity, top: h.hasAttribute('data-at-top'), collapsed: h.hasAttribute('data-collapsed') };
  });
  const steps = [];
  for (const y of [0, 10, 20, 28, 36, 44, 52, 70, 140]) { await sc.evaluate((e, y) => { e.scrollTop = y; }, y); await p.waitForTimeout(60); steps.push(await read()); }
  const s0 = steps[0], sN = steps[steps.length - 1];
  const smallUp = steps.every((s, i) => i === 0 || s.small >= steps[i - 1].small - 0.001), largeDown = steps.every((s, i) => i === 0 || s.large <= steps[i - 1].large + 0.001);
  const between = steps.filter((s) => s.small > 0.02 && s.small < 0.98).length;
  ok('large title: at the top the bar shows no title and is see-through', s0.small === 0 && s0.large === 1 && s0.top, JSON.stringify(s0));
  ok('large title: the hand-over follows the scroll — small title rises in step by step, large one fades', smallUp && largeDown && between >= 2, steps.map((s) => s.small.toFixed(2)).join(' '));
  ok('large title: scrolled past, the bar holds the title and the glass', sN.small === 1 && sN.large < 0.05 && !sN.top && sN.collapsed, JSON.stringify(sN));
  const mid = steps.find((s) => s.small > 0.1 && s.small < 0.9);
  ok(reduced ? 'large title (reduced motion): the small title only fades (no rising)' : 'large title: the small title rises into place while it fades in', mid && (reduced ? Math.abs(mid.rise) < 0.01 : mid.rise > 0.3), JSON.stringify(mid));
  await sc.evaluate((e) => { e.scrollTop = 0; }); await p.waitForTimeout(80);
  ok('large title: back at the top, it is the large title again', (await read()).small === 0);
  const h1 = await sc.evaluate((e) => [...e.querySelectorAll('h1, h2')].filter((x) => x.getAttribute('aria-hidden') !== 'true').map((x) => x.tagName + ':' + x.textContent));
  ok('large title: screen readers hear the title once (the large copy is hidden)', h1.length === 1, h1.join(', '));
}

/* ---------------------------------------------------------------- breadcrumbs */
{
  const nav = p.getByRole('navigation', { name: '긴 경로' });
  await nav.scrollIntoViewIfNeeded();
  ok('breadcrumbs: the current page ends the trail and is not a link', (await nav.locator('[aria-current=page]').textContent()) === '가을 산책 코스 최종본' && (await nav.locator('[aria-current=page]').evaluate((e) => e.tagName)) === 'SPAN');
  const more = nav.getByRole('button', { name: '숨은 단계 보기' });
  await more.click(); await p.waitForTimeout(400);
  const items = await p.getByRole('menu').getByRole('menuitem').allTextContents();
  ok('breadcrumbs: "…" opens a menu of the folded levels', items.join('|') === '문서|2026|여행 계획', items.join('|'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
  const toasted = await p.locator('.sg-toast').filter({ hasText: '2026' }).count();
  ok('breadcrumbs: choosing a folded level from the keyboard goes there; focus comes back to "…"', toasted === 1 && await more.evaluate((e) => e === document.activeElement), `toast ${toasted}`);
  const narrow = p.getByRole('navigation', { name: '좁은 경로' });
  const fit = await narrow.evaluate((n) => { const box = n.parentElement.getBoundingClientRect(); return [...n.querySelectorAll('.sg-crumb__item')].every((i) => { const r = i.getBoundingClientRect(); return r.right <= box.right + 0.5 && r.left >= box.left - 0.5; }) && [...n.querySelectorAll('.sg-crumb__label')].some((l) => l.scrollWidth > l.clientWidth); });
  ok('breadcrumbs (narrow): every level stays inside, truncated with an ellipsis', fit);
  await p.keyboard.press('Tab');
}

/* ---------------------------------------------------------------- skeleton */
{
  const btn = page.getByRole('button', { name: '다시 불러오기' });
  await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(100);
  const busy = await page.locator('[aria-busy=true]').count();
  /* the light band: position (relative to each element's width) of two skeletons of different widths */
  const sweep = await frames('() => {}', `() => [...document.querySelectorAll('[data-demo=skeleton] .sg-skeleton')].slice(0, 2).map((e) => { const m = new DOMMatrix(getComputedStyle(e, '::after').transform); return m.e / e.offsetWidth; })`, 1700);   /* a whole 1.6 s cycle: the band rests at the end of each pass */
  const xs = sweep.map((v) => v[0]), moving = new Set(xs.map((x) => x.toFixed(2))).size;
  const inStep = sweep.every(([a, c]) => Math.abs(a - c) < 0.02);
  const anim = await page.locator('.sg-skeleton').first().evaluate((e) => getComputedStyle(e).animationName);
  if (reduced) ok('skeleton (reduced motion): no moving band; the placeholders breathe instead', moving <= 1 && anim.includes('breathe'), `band positions ${moving}, animation ${anim}`);
  else ok('skeleton: one band of light sweeps every placeholder in step', moving > 10 && inStep, `positions ${moving}, in step ${inStep}`);
  const hidden = await page.locator('.sg-skeleton, .sg-skeleton-lines').evaluateAll((xs) => xs.every((x) => x.closest('[aria-hidden=true]')));
  ok('skeleton: placeholders are hidden from screen readers; the region is aria-busy', hidden && busy === 1);
  await p.waitForTimeout(2000);
  ok('skeleton: content replaces it when loaded', (await page.locator('[data-demo=skeleton] .sg-avatar').count()) === 3 && (await page.locator('[aria-busy=true]').count()) === 0);
}

/* ---------------------------------------------------------------- media viewer */
{
  const thumb = p.locator('[data-demo=media] button').nth(1);   /* (by role it is hidden while the modal is open, as it should be) */
  await thumb.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  const tr = await thumb.boundingBox();
  const open = await frames(`() => document.querySelectorAll('[data-demo=media] button')[1].click()`,
    `() => { const l = document.querySelector('.sg-media [data-sg-slide="1"] .sg-media__dismiss'); if (!l) return null; const m = new DOMMatrix(getComputedStyle(l).transform), o = +getComputedStyle(l).opacity; return [m.a, m.e, m.f, o]; }`, 700);
  const got = open.filter(Boolean);
  const dlg = p.getByRole('dialog', { name: '사진 보기' });
  if (reduced) ok('viewer (reduced motion): opens with a fade, in place (no zoom from the thumbnail)', got.every(([a, e, f]) => Math.abs(a - 1) < 0.001 && Math.abs(e) < 0.5 && Math.abs(f) < 0.5), JSON.stringify(got.slice(0, 2)));
  else {
    const first = got[0];
    const grows = got.some(([a]) => a < 0.5) && Math.abs(got[got.length - 1][0] - 1) < 0.01;
    ok('viewer: opens out of its thumbnail (starts small, near the thumbnail, grows to full size)', grows && first[0] < 0.6 && Math.abs(first[1] - (tr.x + tr.width / 2 - 640)) < 80, `first ${first.map((x) => x.toFixed(2))}`);
  }
  await p.waitForTimeout(300);
  ok('viewer: a modal dialog; focus on Close; the page behind cannot scroll; the thumbnail is hidden (the photo has left it)',
    (await dlg.count()) === 1 && (await p.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === '닫기'
    && (await p.evaluate(() => getComputedStyle(document.body).overflow)) === 'hidden' && (await thumb.evaluate((e) => getComputedStyle(e).visibility)) === 'hidden');
  ok('viewer: counter and caption', (await dlg.locator('.sg-media__count').textContent()) === '2 / 6' && (await dlg.locator('.sg-media__caption').textContent()).includes('세로'));
  /* paging */
  const trackX = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sg-media__track')).transform).e);
  const x0 = await trackX();
  const slide = await frames(`() => document.querySelector('.sg-media').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`, `() => new DOMMatrix(getComputedStyle(document.querySelector('.sg-media__track')).transform).e`, 700);
  const target = x0 - (1280 + 24);
  const mids = slide.filter((x) => Math.abs(x - x0) > 2 && Math.abs(x - target) > 2).length;
  ok(reduced ? 'viewer (reduced motion): → shows the next photo without sliding' : 'viewer: → slides to the next photo', (await dlg.locator('.sg-media__count').textContent()) === '3 / 6' && Math.abs(slide[slide.length - 1] - target) < 1 && (reduced ? mids === 0 : mids >= 3), `in-between frames ${mids}`);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(600);
  /* swipe with the mouse */
  await p.mouse.move(900, 450); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(900 - i * 50, 452); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(700);
  ok('viewer: a swipe left goes to the next photo', (await dlg.locator('.sg-media__count').textContent()) === '3 / 6');
  await p.mouse.move(500, 450); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(500 + i * 25, 450); await p.waitForTimeout(40); }
  await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(700);
  ok('viewer: a short drag, held and let go, springs back to the same photo', (await dlg.locator('.sg-media__count').textContent()) === '3 / 6' && Math.abs((await trackX()) + 2 * 1304) < 1);
  await p.keyboard.press('End'); await p.waitForTimeout(600);
  await p.mouse.move(800, 450); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(800 - i * 50, 450); await p.waitForTimeout(16); }
  const pulled = await trackX();
  await p.mouse.up(); await p.waitForTimeout(800);
  ok('viewer: past the last photo the strip resists (rubber band) and settles back', (await dlg.locator('.sg-media__count').textContent()) === '6 / 6' && pulled > -5 * 1304 - 400 * 0.5 && pulled < -5 * 1304 && Math.abs((await trackX()) + 5 * 1304) < 1, `pulled ${(pulled + 5 * 1304).toFixed(0)} px`);
  ok('viewer: Next is disabled on the last photo', await dlg.getByRole('button', { name: '다음 사진' }).isDisabled());
  await p.keyboard.press('Home'); await p.waitForTimeout(600);
  /* zoom */
  const zoom = () => p.evaluate(() => { const f = document.querySelector('.sg-media [data-sg-slide="0"] .sg-media__frame'); const m = new DOMMatrix(getComputedStyle(f).transform); return { s: m.a, x: m.e, y: m.f }; });
  await p.mouse.dblclick(800, 400); await p.waitForTimeout(700);
  const z1 = await zoom();
  ok('viewer: double-click zooms in at that point', Math.abs(z1.s - 2.5) < 0.02 && z1.x < -50, JSON.stringify(z1));
  await p.mouse.move(800, 400); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(800 + i * 30, 400 + i * 10); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(700);
  const z2 = await zoom();
  ok('viewer: zoomed in, a drag pans the photo (and does not page)', z2.x > z1.x + 60 && (await dlg.locator('.sg-media__count').textContent()) === '1 / 6', `x ${z1.x.toFixed(0)} → ${z2.x.toFixed(0)}`);
  const bounds = await p.evaluate(() => { const f = document.querySelector('.sg-media [data-sg-slide="0"] .sg-media__frame').getBoundingClientRect(); return { l: f.left, r: f.right, t: f.top, b: f.bottom }; });
  ok('viewer: panning stops at the photo\'s edges (no empty space pulled in)', bounds.l <= 0.5 && bounds.r >= 1279.5, JSON.stringify(bounds));
  await p.keyboard.press('0'); await p.waitForTimeout(700);
  ok('viewer: 0 resets the zoom', Math.abs((await zoom()).s - 1) < 0.01);
  await p.keyboard.press('+'); await p.waitForTimeout(700);
  ok('viewer: + zooms in', Math.abs((await zoom()).s - 1.6) < 0.02);
  await p.keyboard.press('0'); await p.waitForTimeout(600);
  await p.mouse.move(640, 450);
  for (let i = 0; i < 6; i++) { await p.keyboard.down('Control'); await p.mouse.wheel(0, -40); await p.keyboard.up('Control'); await p.waitForTimeout(30); }
  await p.waitForTimeout(200);
  ok('viewer: ctrl + wheel (trackpad pinch) zooms', (await zoom()).s > 1.5, (await zoom()).s.toFixed(2));
  await p.keyboard.press('0'); await p.waitForTimeout(600);
  /* Tab stays inside */
  for (let i = 0; i < 6; i++) await p.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
  ok('viewer: Tab stays inside the viewer', await dlg.evaluate((d) => d.contains(document.activeElement)));
  /* swipe down to dismiss */
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
  await p.mouse.move(640, 300); await p.mouse.down();
  const bd = [];
  for (let i = 1; i <= 10; i++) { await p.mouse.move(645, 300 + i * 30); await p.waitForTimeout(16); if (i === 5) bd.push(await p.evaluate(() => +getComputedStyle(document.querySelector('.sg-media__backdrop')).opacity)); }
  await p.mouse.up(); await p.waitForTimeout(700);
  const t2 = p.locator('[data-demo=media] button').nth(1);   /* Home → 1, then → 2: the second photo */
  ok('viewer: swiping down fades the backdrop with the distance and dismisses it', bd[0] < 0.9 && bd[0] > 0.2 && (await dlg.count()) === 0, `backdrop at 150 px: ${bd[0]?.toFixed(2)}`);
  ok('viewer: after closing — every thumbnail visible again, the page scrolls, focus on the thumbnail of the photo you were on',
    (await p.locator('[data-demo=media] button').evaluateAll((bs) => bs.every((x) => getComputedStyle(x).visibility === 'visible'))) && (await p.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden' && await t2.evaluate((e) => e === document.activeElement),
    await p.evaluate(() => document.activeElement?.getAttribute('aria-label')));
  /* Escape */
  await page.getByRole('button', { name: /숲길의 아침/ }).click(); await p.waitForTimeout(700);
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  ok('viewer: Escape closes; focus returns to the thumbnail', (await dlg.count()) === 0 && (await p.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).includes('숲길'));
  /* rapid open/close */
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: /보랏빛/ }).click(); await p.waitForTimeout(40); await p.keyboard.press('Escape'); await p.waitForTimeout(40); }
  await p.waitForTimeout(900);
  const hiddenLeft = await page.locator('[data-demo=media] button').evaluateAll((bs) => bs.filter((x) => getComputedStyle(x).visibility === 'hidden').length);
  ok('viewer: 6 rapid open/close → nothing left open, no thumbnail left hidden, no scroll lock', (await dlg.count()) === 0 && hiddenLeft === 0 && (await p.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden', `hidden thumbs ${hiddenLeft}`);
}

/* ---------------------------------------------------------------- touch: tap toggles the bars, double tap zooms, pinch (Chromium) */
{
  const t = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine !== 'firefox' });
  const q = await t.newPage();
  await q.goto(`http://localhost:4173/${Q}#/display`); await q.waitForTimeout(700);
  const th = q.locator('.docs__page').getByRole('button', { name: /한강 위로/ });
  await th.scrollIntoViewIfNeeded(); await th.tap(); await q.waitForTimeout(800);
  ok('touch: tap a thumbnail opens the viewer', (await q.getByRole('dialog').count()) === 1);
  await q.touchscreen.tap(195, 420); await q.waitForTimeout(500);
  const hidden = await q.locator('.sg-media').getAttribute('data-chrome');
  await q.touchscreen.tap(195, 420); await q.waitForTimeout(500);
  const shown = await q.locator('.sg-media').getAttribute('data-chrome');
  ok('touch: a single tap hides the bars, another shows them', hidden === 'hidden' && shown === 'shown', `${hidden} → ${shown}`);
  await q.touchscreen.tap(195, 420); await q.waitForTimeout(80); await q.touchscreen.tap(195, 420); await q.waitForTimeout(700);
  const zs = await q.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sg-media [data-sg-slide="0"] .sg-media__frame')).transform).a);
  ok('touch: a double tap zooms', Math.abs(zs - 2.5) < 0.05, zs.toFixed(2));
  await q.keyboard.press('0'); await q.waitForTimeout(600);
  if (engine === 'chromium') {
    const cdp = await t.newCDPSession(q);
    const pt = (id, x, y) => ({ x, y, id, radiusX: 1, radiusY: 1, force: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(0, 160, 420), pt(1, 230, 420)] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(0, 160 - i * 8, 420), pt(1, 230 + i * 8, 420)] }); await q.waitForTimeout(16); }
    const during = await q.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sg-media [data-sg-slide="0"] .sg-media__frame')).transform).a);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await q.waitForTimeout(600);
    ok('touch (Chromium): pinching apart zooms with the fingers', during > 1.8 && during < 3.4, `scale ${during.toFixed(2)} (fingers 70 → 230 px)`);
  }
  await q.keyboard.press('0'); await q.waitForTimeout(500);
  const sw = q.locator('.sg-media__stage');
  await sw.evaluate(() => {});
  await q.touchscreen.tap(10, 10).catch(() => {});
  await t.close();
}

/* ---------------------------------------------------------------- axe on the open viewer */
{
  const { readFileSync } = await import('node:fs');
  const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  await page.getByRole('button', { name: /한강 위로/ }).click(); await p.waitForTimeout(700);
  await p.addScriptTag({ content: axe });
  const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('.sg-media'), { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes[0]?.target}`));
  ok('axe: the open viewer has no serious or critical violations', v.length === 0, v.join(' | '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
}

console.log('page errors:', errs.length ? errs : 'none');
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
