// Interaction checks on the docs app (vite preview on :4173). usage: node tests/e2e/interact.mjs [shotDir]
import * as pw from 'playwright';
const chromium = pw[process.env.BROWSER || 'chromium'];
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const shot = async (n) => out && p.screenshot({ path: `${out}/i-${n}.png` });
const center = async (loc) => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };

/* ---------- tab bar: tap travels as a stretching drop, drag follows the finger, release selects ---------- */
await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(600);
const bar = p.locator('.gl-tabbar__bar').first(), tabs = bar.locator('.gl-tabbar__item');
const ind = bar.locator('.gl-tabbar__indicator');
const w0 = (await ind.boundingBox()).width;
await tabs.nth(2).click();
const widths = [];
for (let i = 0; i < 12; i++) { widths.push((await ind.boundingBox()).width); await p.waitForTimeout(16); }
await p.waitForTimeout(500);
const end = await ind.boundingBox(), t2 = await tabs.nth(2).boundingBox();
ok('tab tap: the drop stretches while travelling', Math.max(...widths) > w0 * 1.25, `rest ${w0.toFixed(0)}px, peak ${Math.max(...widths).toFixed(0)}px`);
ok('tab tap: settles on the tapped tab', Math.abs(end.x - t2.x) < 1.5 && Math.abs(end.width - t2.width) < 1.5 && (await tabs.nth(2).getAttribute('aria-selected')) === 'true');
const [x0, y0] = await center(tabs.nth(2)), [x1] = await center(tabs.nth(0));
await p.mouse.move(x0, y0); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(x0 + ((x1 - x0) * i) / 20, y0); await p.waitForTimeout(16); }
await shot('tab-drag');
const mid = await ind.boundingBox();
ok('tab drag: indicator follows the finger (inside the bar)', mid.x < t2.x - 20 && mid.y >= (await bar.boundingBox()).y, `x ${mid.x.toFixed(0)}`);
for (let i = 11; i <= 20; i++) { await p.mouse.move(x0 + ((x1 - x0) * i) / 20, y0); await p.waitForTimeout(16); }
await p.mouse.up(); await p.waitForTimeout(600);
ok('tab drag: release selects the tab under it', (await tabs.nth(0).getAttribute('aria-selected')) === 'true');
await tabs.nth(1).focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
ok('tab keyboard: arrow keys move the selection', (await tabs.nth(1).getAttribute('aria-selected')) === 'true' || (await tabs.nth(2).getAttribute('aria-selected')) === 'true');

const rad = async (sel) => parseFloat(await p.locator(sel).first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius));
ok('tab bar: the search button has the same corner radius as the bar', (await rad('.gl-tabbar__action')) === (await rad('.gl-tabbar__bar')), `${await rad('.gl-tabbar__action')} / ${await rad('.gl-tabbar__bar')}`);

await p.goto('http://localhost:4173/#/buttons'); await p.waitForTimeout(500);
const gh = (await p.locator('.gl-button-group').first().boundingBox()).height, ih = (await p.locator('.demo--media .gl-button--glass.gl-button--icon').first().boundingBox()).height;
const gr = await p.locator('.gl-button-group').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius), ir = await p.locator('.demo--media .gl-button--glass.gl-button--icon').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
ok('button group: same height and corner as the buttons beside it', gh === ih && gr === ir, `group ${gh}px/${gr}, button ${ih}px/${ir}`);

await p.goto('http://localhost:4173/#/navigation'); await p.waitForTimeout(1000); /* badges pop in on mount */
{
  const geo = await p.locator('.gl-tabbar__icon:has(.gl-badge)').first().evaluate((ic) => {
    const g = ic.querySelector('svg').getBoundingClientRect(), b = ic.querySelector('.gl-badge').getBoundingClientRect(), bar = ic.closest('.gl-tabbar__bar').getBoundingClientRect();
    return { overlapX: g.right - b.left, overlapY: b.bottom - g.top, insideBar: b.top >= bar.top && b.right <= bar.right, h: b.height };
  });
  ok('tab badge: on the glyph corner (small overlap), inside the bar, 16 px', geo.overlapX > 0 && geo.overlapX <= 8 && geo.overlapY > 0 && geo.overlapY <= 12 && geo.insideBar && Math.abs(geo.h - 16) < 0.5, JSON.stringify(geo));
}

/* ---------- inputs ---------- */
await p.goto('http://localhost:4173/#/inputs'); await p.waitForTimeout(600);
const sw = p.locator('.docs__page .gl-switch').first();
const before = await sw.getAttribute('aria-checked');
await sw.click(); await p.waitForTimeout(350);
ok('switch: click toggles', (await sw.getAttribute('aria-checked')) !== before);
const sb = await sw.boundingBox();
await p.mouse.move(sb.x + 10, sb.y + sb.height / 2); await p.mouse.down();
await p.mouse.move(sb.x + sb.width - 6, sb.y + sb.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(350);
ok('switch: drag to the on side turns it on', (await sw.getAttribute('aria-checked')) === 'true');
/* both directions: the thumb stretches toward travel and never leaves the rail */
const sw2 = p.locator('.docs__page .gl-switch').nth(1);
const travel = async () => {
  const frames = await sw2.evaluate((e) => new Promise((res) => {
    const out = [], t0 = performance.now(), tr = e.getBoundingClientRect(), th = e.querySelector('.gl-switch__thumb');
    e.click();
    const f = () => { const r = th.getBoundingClientRect(); out.push([r.left - tr.left, tr.right - r.right, r.width]); if (performance.now() - t0 < 700) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  return { minL: Math.min(...frames.map((f) => f[0])), minR: Math.min(...frames.map((f) => f[1])), maxW: Math.max(...frames.map((f) => f[2])), endW: frames[frames.length - 1][2] };
};
const tOn = await travel(), tOff = await travel();
ok('switch: on and off travel alike — stretch toward travel, stay inside the rail (a lively bounce may use some of the 2 px gap)', tOn.minL >= 0.5 && tOn.minR >= 0.5 && tOff.minL >= 0.5 && tOff.minR >= 0.5 && Math.abs(tOn.minR - tOff.minL) < 0.3 && tOn.maxW > tOn.endW + 3 && tOff.maxW > tOff.endW + 3 && Math.abs((tOn.maxW - tOn.endW) - (tOff.maxW - tOff.endW)) < 1,
  `on: gap L ${tOn.minL.toFixed(1)} R ${tOn.minR.toFixed(1)} stretch ${(tOn.maxW - tOn.endW).toFixed(1)} · off: gap L ${tOff.minL.toFixed(1)} R ${tOff.minR.toFixed(1)} stretch ${(tOff.maxW - tOff.endW).toFixed(1)}`);

const sl = p.locator('.gl-slider').first(), slb = await sl.boundingBox();
await p.mouse.move(slb.x + slb.width * 0.2, slb.y + slb.height / 2); await p.mouse.down();
await p.mouse.move(slb.x + slb.width * 0.8, slb.y + slb.height / 2, { steps: 8 });
await p.waitForTimeout(220); /* the bubble fades in over 140 ms */
await shot('slider-drag');
const bubbleOp = await p.locator('.gl-slider__bubble').first().evaluate((e) => getComputedStyle(e).opacity);
await p.mouse.up();
const sv = +(await sl.getAttribute('aria-valuenow'));
ok('slider: drag sets the value, bubble shows while held', sv >= 75 && sv <= 85 && +bubbleOp > 0.5, `value ${sv}, bubble ${bubbleOp}`);
await sl.focus(); await p.keyboard.press('End');
ok('slider: End key → max', (await sl.getAttribute('aria-valuenow')) === '100');
const seg = p.locator('.docs__page .gl-segmented').first();
await seg.locator('.gl-segmented__item').nth(3).click(); await p.waitForTimeout(900);
const si = await seg.locator('.gl-segmented__indicator').boundingBox(), s3 = await seg.locator('.gl-segmented__item').nth(3).boundingBox();
ok('segmented: indicator lands on the chosen segment', Math.abs(si.x - s3.x) < 1.5 && Math.abs(si.width - s3.width) < 1.5);
const field = p.locator('input.gl-field__input').first();
await field.fill('헤론'); await p.locator('.gl-field__clear').first().click();
ok('text field: clear button empties the field and keeps focus', (await field.inputValue()) === '' && (await field.evaluate((e) => e === document.activeElement)));

/* ---------- overlays ---------- */
await p.goto('http://localhost:4173/#/overlays'); await p.waitForTimeout(600);
const dirBtn = p.getByRole('button', { name: '길찾기' });
await dirBtn.click(); await p.waitForTimeout(80);
const early = await p.locator('.gl-menu').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
await p.waitForTimeout(600); await shot('menu');
const menuBox = await p.locator('.gl-menu').boundingBox(), btnBox = await dirBtn.boundingBox();
ok('menu: blooms from the anchor (scaled < 1 early, placed below it)', early < 0.98 && menuBox.y >= btnBox.y + btnBox.height, `early scale ${early.toFixed(2)}`);
/* snappy enough: sampled every frame, how long until the menu is ≥ 90 % of its size */
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
const t90 = await p.evaluate(() => new Promise((res) => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '길찾기');
  const t0 = performance.now(); btn.click();
  const f = () => { const m = document.querySelector('.gl-menu'); const k = m ? new DOMMatrix(getComputedStyle(m).transform).d : 0;
    if (m && k >= 0.9 && +getComputedStyle(m).opacity > 0.95) res(performance.now() - t0); else if (performance.now() - t0 > 1000) res(9999); else requestAnimationFrame(f); };
  requestAnimationFrame(f);
}));
ok('menu: reaches 90 % size (and full opacity) within ~150 ms', t90 <= 170, `${t90.toFixed(0)} ms`);
ok('menu: focus moves into the menu', await p.evaluate(() => document.activeElement?.classList.contains('gl-menu__item')));
await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
ok('menu: Enter selects and closes; focus returns to the button', (await p.locator('.gl-menu').count()) === 0 && (await dirBtn.evaluate((e) => e === document.activeElement)));
await dirBtn.click(); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('menu: Esc closes', (await p.locator('.gl-menu').count()) === 0);

await p.getByRole('button', { name: '장소 삭제…' }).click(); await p.waitForTimeout(600); await shot('dialog');
ok('dialog: opens modal with focus inside', (await p.locator('[role=alertdialog]').count()) === 1 && await p.evaluate(() => !!document.activeElement?.closest('[role=alertdialog]')));
await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
ok('dialog: Tab stays inside', await p.evaluate(() => !!document.activeElement?.closest('[role=alertdialog]')));
ok('dialog: page scroll locked', await p.evaluate(() => document.body.style.overflow === 'hidden'));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('dialog: Esc closes and unlocks scroll', (await p.locator('[role=alertdialog]').count()) === 0 && await p.evaluate(() => document.body.style.overflow !== 'hidden'));

await p.getByRole('button', { name: '장소 편집' }).click(); await p.waitForTimeout(800); await shot('sheet');
const sheet = p.locator('.gl-sheet');
ok('sheet: opens', (await sheet.count()) === 1);
/* a switch dragged inside the sheet, out to the right, then down past the sheet: it lets go and nothing sticks */
{
  const s1 = p.getByRole('switch', { name: '지도에 고정' }), before1 = await s1.getAttribute('aria-checked');
  const r = await s1.boundingBox(), sb = await sheet.boundingBox();
  await p.mouse.move(r.x + r.width - 8, r.y + r.height / 2); await p.mouse.down();
  await p.mouse.move(sb.x + sb.width + 80, r.y + r.height / 2, { steps: 8 });
  await p.mouse.move(sb.x + sb.width + 80, sb.y + sb.height + 50, { steps: 8 });
  await p.mouse.move(r.x + 6, sb.y + sb.height + 50, { steps: 10 });
  const midDrag = await s1.evaluate((e) => ({ dragging: e.classList.contains('is-dragging'), inline: e.querySelector('.gl-switch__thumb').style.getPropertyValue('--gl-sw-l') }));
  await p.mouse.up(); await p.waitForTimeout(700);
  const after1 = await s1.evaluate((e) => ({ checked: e.getAttribute('aria-checked'), cls: e.className, inline: e.querySelector('.gl-switch__thumb').getAttribute('style') || '', drag: e.dataset.drag }));
  ok('switch in a sheet: far from the switch it lets go (no thumb tracking) and release changes nothing', !midDrag.dragging && !midDrag.inline && after1.checked === before1 && after1.cls === 'gl-switch' && !after1.inline && !after1.drag, JSON.stringify({ midDrag, after1 }));
  await p.mouse.move(r.x + r.width - 8, r.y + r.height / 2); await p.mouse.down();
  await p.mouse.move(r.x + 4, r.y + r.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(600);
  ok('switch in a sheet: still works after that', (await s1.getAttribute('aria-checked')) !== before1);
}
const grab = await p.locator('.gl-sheet__grabber').boundingBox();
await p.mouse.move(grab.x + grab.width / 2, grab.y + 8); await p.mouse.down();
await p.mouse.move(grab.x + grab.width / 2, grab.y + 60, { steps: 6 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(700);
ok('sheet: a short, slow drag springs back', (await sheet.count()) === 1 && Math.abs((await sheet.boundingBox()).y - grab.y + 0) < 30);
const g2 = await p.locator('.gl-sheet__grabber').boundingBox();
await p.mouse.move(g2.x + g2.width / 2, g2.y + 8); await p.mouse.down();
await p.mouse.move(g2.x + g2.width / 2, g2.y + 420, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(700);
ok('sheet: a long drag (or a quick flick) dismisses', (await sheet.count()) === 0);
await p.getByRole('button', { name: '장소 편집' }).click(); await p.waitForTimeout(700);
await p.locator('.gl-sheet__header').getByRole('button', { name: '취소' }).click(); await p.waitForTimeout(600);
ok('sheet: header Cancel closes it', (await sheet.count()) === 0);
await p.getByRole('button', { name: '장소 편집' }).click(); await p.waitForTimeout(700);
await p.locator('.gl-sheet__header').getByRole('button', { name: '완료' }).click(); await p.waitForTimeout(600);
ok('sheet: header Done closes it (and toasts)', (await sheet.count()) === 0 && (await p.locator('.gl-toast').count()) >= 1);

await p.getByRole('button', { name: '공유 옵션…' }).click(); await p.waitForTimeout(600); await shot('actionsheet');
ok('action sheet: opens with focus on Cancel', await p.evaluate(() => document.activeElement?.hasAttribute('data-cancel')));
await p.keyboard.press('Enter'); await p.waitForTimeout(500);
ok('action sheet: Cancel closes', (await p.locator('.gl-actionsheet').count()) === 0);

const photo = p.getByRole('button', { name: '노을 사진' });
const [px, py] = await center(photo);
await p.mouse.move(px, py); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(500); await shot('context');
ok('context menu: long press lifts the item and opens the menu', (await p.locator('.gl-lift').count()) === 1 && (await p.locator('.gl-menu').count()) === 1);
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
ok('context menu: Esc closes and the lift goes away', (await p.locator('.gl-menu').count()) === 0 && (await p.locator('.gl-lift').count()) === 0);

await p.getByRole('button', { name: '토스트', exact: true }).click(); await p.waitForTimeout(500); await shot('toast');
ok('toast: appears as a status message', (await p.locator('.gl-toast[role=status]').count()) >= 1);
await p.getByRole('button', { name: '오류 토스트' }).click(); await p.waitForTimeout(500);
const n0 = await p.locator('.gl-toast').count();
await p.locator('.gl-toast').getByRole('button', { name: '다시 시도' }).click(); await p.waitForTimeout(500);
ok('toast: its action button works (and dismisses it)', (await p.locator('.gl-toast').count()) < n0);

/* ---------- showcase: an open popover, then another ⓘ — the new one must open (it used to get stuck) ---------- */
await p.goto('http://localhost:4173/#/showcase'); await p.waitForTimeout(700);
const infos = p.locator('.phone .gl-list-item .gl-button--icon');
await infos.nth(0).scrollIntoViewIfNeeded(); await infos.nth(0).click(); await p.waitForTimeout(500);
const first = await p.locator('.gl-popover').textContent();
await infos.nth(2).click(); await p.waitForTimeout(600);
const second = (await p.locator('.gl-popover').count()) === 1 ? await p.locator('.gl-popover').textContent() : '';
const vis = (await p.locator('.gl-popover').count()) === 1 ? await p.locator('.gl-popover').evaluate((e) => +getComputedStyle(e).opacity) : 0;
await shot('popover-switch');
ok('popover: tapping another ⓘ while one is open opens the new one', second && second !== first && vis > 0.95, `${first?.slice(0, 6)} → ${second?.slice(0, 6)}, opacity ${vis}`);
await infos.nth(3).click(); await p.waitForTimeout(600);
ok('popover: …and again', (await p.locator('.gl-popover').count()) === 1 && (await p.locator('.gl-popover').textContent()).includes('별빛'));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
ok('popover: Esc still closes after switching', (await p.locator('.gl-popover').count()) === 0);

/* ---------- motion audit: every state change moves, nothing jumps ---------- */
/* sample a numeric reading every frame for `ms` after running `act` in the page; returns distinct rounded values */
const sampleAfter = (fnSrc, ms = 450) => p.evaluate(({ fnSrc, ms }) => new Promise((res) => {
  const { act, read } = new Function(`return (${fnSrc})`)();
  const out = []; const t0 = performance.now(); act();
  const f = () => { out.push(read()); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), { fnSrc, ms });
const distinct = (a) => new Set(a.map((v) => Math.round(v))).size;

await p.goto('http://localhost:4173/#/inputs'); await p.waitForTimeout(600);
{
  const sl2 = p.locator('.docs__page .gl-slider').first(), b2 = await sl2.boundingBox();
  const thumbX = () => p.locator('.docs__page .gl-slider__thumb').first().evaluate((e) => e.getBoundingClientRect().left);
  const before = await thumbX();
  await p.mouse.move(b2.x + b2.width * 0.1, b2.y + b2.height / 2);
  const xs = [];
  await p.mouse.down();
  for (let i = 0; i < 14; i++) { xs.push(await thumbX()); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(400);
  const after = await thumbX();
  const mids = xs.filter((x) => Math.abs(x - before) > 2 && Math.abs(x - after) > 2).length;
  ok('slider: a press on the track travels there with motion (not a jump)', mids >= 2 && Math.abs(after - before) > 40, `in-between frames ${mids}, ${before.toFixed(0)} → ${after.toFixed(0)}`);
}
{
  const plus = p.getByRole('button', { name: 'Increase 인원' });
  await plus.click();
  const roll = await p.locator('.gl-stepper__value > span').first().evaluate((e) => ({ dir: e.dataset.roll, anims: e.getAnimations().length }));
  ok('stepper: the value rolls in from the direction it changed', roll.dir === 'up' && roll.anims > 0, JSON.stringify(roll));
}
{
  const ws = await sampleAfter(`({ act: () => document.querySelector('.docs__page .gl-search input').focus(), read: () => document.querySelector('.docs__page .gl-search__cancel').getBoundingClientRect().width })`);
  const end = ws[ws.length - 1];
  ok('search field: Cancel slides in (width grows over several frames)', ws.filter((w) => w > 1 && w < end - 1).length >= 3 && end > 40, `frames between ${ws.filter((w) => w > 1 && w < end - 1).length}, end ${end.toFixed(0)}`);
  await p.locator('.docs__page .gl-search input').blur();
}
await p.goto('http://localhost:4173/#/overlays'); await p.waitForTimeout(600);
{
  /* error toast (with an action) on top, a plain one below; dismissing the top one makes the other glide up */
  await p.getByRole('button', { name: '오류 토스트' }).click(); await p.waitForTimeout(120);
  await p.getByRole('button', { name: '토스트', exact: true }).click(); await p.waitForTimeout(600);
  const flip = await p.evaluate(() => new Promise((res) => {
    const list = [...document.querySelectorAll('.gl-toast')], lower = list[list.length - 1], y0 = lower.getBoundingClientRect().top;
    list[0].querySelector('button').click();
    const ys = []; const t0 = performance.now();
    const f = () => { ys.push(lower.getBoundingClientRect().top); if (performance.now() - t0 < 700) requestAnimationFrame(f); else res({ y0, end: ys[ys.length - 1], between: ys.filter((y) => y < y0 - 2 && y > ys[ys.length - 1] + 2).length }); };
    requestAnimationFrame(f);
  }));
  ok('toasts: when one leaves, the rest glide into place', flip.end < flip.y0 - 20 && flip.between >= 3, JSON.stringify(flip));
}
await p.goto('http://localhost:4173/#/showcase'); await p.waitForTimeout(700);
{
  const bgs = await sampleAfter(`({ act: () => document.querySelector('.phone__screen').scrollTo(0, 400), read: () => parseFloat(getComputedStyle(document.querySelector('.phone .gl-appbar__bar')).backgroundColor.split(',')[3] || '1') })`, 500);
  const mid = bgs.filter((a) => a > 0.02 && a < 0.55).length;
  ok('app bar: the glass fades in when content scrolls under it', mid >= 3, `frames in between ${mid}`);
}

/* ---------- motion personalities: calm / lively / playful really differ ---------- */
await p.goto('http://localhost:4173/#/motion'); await p.waitForTimeout(900);
{
  const cols = p.locator('.grid--3 > *');
  const squash = async (i) => cols.nth(i).locator('.gl-segmented').evaluate((seg) => new Promise((res) => {
    const ind = seg.querySelector('.gl-segmented__indicator'); const items = seg.querySelectorAll('.gl-segmented__item');
    let minSy = 1; const t0 = performance.now(); items[items.length - 1].click();
    const f = () => { const m = new DOMMatrix(getComputedStyle(ind).transform); minSy = Math.min(minSy, m.d); if (performance.now() - t0 < 600) requestAnimationFrame(f); else { items[0].click(); res(minSy); } };
    requestAnimationFrame(f);
  }));
  const sq = [await squash(0), await squash(1), await squash(2)];
  ok('personalities: the segmented drop squashes — none when calm, more when playful', sq[0] > 0.999 && sq[1] < 0.97 && sq[2] < sq[1] - 0.02, sq.map((v) => v.toFixed(3)).join(' / '));

  const gel = async (i) => {
    const sl = cols.nth(i).locator('.gl-slider'), b = await sl.boundingBox();
    /* record the stretch every frame in the page while the drag happens (sampling from the test misses peaks) */
    await sl.locator('.gl-slider__thumb').evaluate((t) => { window.__peak = 1; window.__rec = true; const f = () => { window.__peak = Math.max(window.__peak, new DOMMatrix(getComputedStyle(t).transform).a); if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await p.mouse.move(b.x + 8, b.y + b.height / 2); await p.mouse.down();
    for (let k = 1; k <= 8; k++) { await p.mouse.move(b.x + 8 + (b.width - 16) * k / 8, b.y + b.height / 2); await p.waitForTimeout(8); }
    await p.mouse.up(); await p.waitForTimeout(700);
    const peak = await p.evaluate(() => { window.__rec = false; return window.__peak; });
    const rest = await sl.locator('.gl-slider__thumb').evaluate((t) => new DOMMatrix(getComputedStyle(t).transform).a);
    return [peak, rest];
  };
  const g = [await gel(0), await gel(1), await gel(2)];
  ok('personalities: a fast-dragged slider thumb stretches — not when calm, more when playful, and relaxes after', g[0][0] < 1.005 && g[1][0] > 1.03 && g[2][0] > g[1][0] && g.every(([, r]) => Math.abs(r - 1) < 0.01), g.map(([a, r]) => `${a.toFixed(3)}→${r.toFixed(3)}`).join(' / '));

  await cols.nth(2).getByRole('button', { name: '메뉴' }).click(); await p.waitForTimeout(100);
  const pm = await p.evaluate(() => document.querySelector('.gl-menu')?.closest('.gl-portal')?.getAttribute('data-gl-motion'));
  ok('personalities: a menu opened inside a playful scope blooms with the playful springs (portal carries it)', pm === 'playful', String(pm));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
}

console.log('page errors:', errs.length ? errs : 'none');
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
