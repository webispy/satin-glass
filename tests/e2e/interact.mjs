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
const grab = await p.locator('.gl-sheet__grabber').boundingBox();
await p.mouse.move(grab.x + grab.width / 2, grab.y + 8); await p.mouse.down();
await p.mouse.move(grab.x + grab.width / 2, grab.y + 60, { steps: 6 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(700);
ok('sheet: a short, slow drag springs back', (await sheet.count()) === 1 && Math.abs((await sheet.boundingBox()).y - grab.y + 0) < 30);
const g2 = await p.locator('.gl-sheet__grabber').boundingBox();
await p.mouse.move(g2.x + g2.width / 2, g2.y + 8); await p.mouse.down();
await p.mouse.move(g2.x + g2.width / 2, g2.y + 420, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(700);
ok('sheet: a long drag (or a quick flick) dismisses', (await sheet.count()) === 0);

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
ok('toast: appears as a status message', (await p.locator('.gl-toast[role=status]').count()) === 1);

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

console.log('page errors:', errs.length ? errs : 'none');
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
