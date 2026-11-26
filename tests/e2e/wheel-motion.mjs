// The wheel's lens motion (design-language.md, 8. 휠 렌즈의 모션), measured frame by frame:
//   · a hand turning the wheel squeezes the lens the way the rows go (down → the bottom edge comes in, up → the top),
//     each row that crosses knocks it further in, and when the rows stop it pops out past its size and home
//   · a short turn (one notch, one key, a click) gets the whole gesture; turning back squeezes the other edge
//   · it answers the rows, not the input: pushing on at an end leaves the lens still, and it pops as the wheel lands
//     and is home within about half a second (the pop's own length) — no wobble while a trackpad's momentum keeps
//     sending wheel events
//   · calm and reduced motion: no squeeze (reduced motion also lands on the row at once)
//   · the row in the lens is magnified, the others recede; the columns of a group share one lens
//   · a click or a key pops as soon as its row arrives (as quick as a turn); a two-row column (AM/PM) squeezes too
//   · a disabled wheel (an alarm that is off) does not turn and leaves the tab order
// usage: node tests/e2e/wheel-motion.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173 or E2E_PORT)
// covers: selection   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
p.on('pageerror', (e) => { failed++; console.log('FAIL page error —', e.message); });
await p.goto(`${pw.ORIGIN}/?mode=light#/selection`); await p.waitForTimeout(900);
const tw = p.locator('[data-demo="alarm"] .sg-timewheel');
await tw.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
const cols = tw.locator('.sg-wheel__scroller');
const MIN = 2, HOUR = 1;   /* ko: period · hour · minute */

const set = (attrs) => tw.evaluate((e, a) => { for (const [k, v] of Object.entries(a)) v == null ? e.removeAttribute(k) : e.setAttribute(k, v); }, attrs);
const place = (c, row) => cols.nth(c).evaluate((sc, row) => { sc.scrollTop = row * sc.firstElementChild.offsetHeight; }, row);
const hover = async (c) => { const bx = await cols.nth(c).boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); };
/* frames: [t, column scrollTop, top edge offset, bottom edge offset (px, + = down), transform set?] */
const record = (c, ms) => tw.evaluate((grp, [c, ms]) => new Promise((res) => {
  const lens = grp.querySelector('.sg-wheels__lens'), sc = grp.querySelectorAll('.sg-wheel__scroller')[c];
  const prev = lens.style.transform; lens.style.transform = '';
  const r0 = lens.getBoundingClientRect(); lens.style.transform = prev;
  const out = [], t0 = performance.now();
  const f = () => { const r = lens.getBoundingClientRect(), t = performance.now() - t0; out.push([t, sc.scrollTop, r.top - r0.top, r.bottom - r0.bottom, !!lens.style.transform]); if (t < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), [c, ms]);
const span = (fr, i) => [Math.min(...fr.map((x) => x[i])), Math.max(...fr.map((x) => x[i]))];
const rest = (fr) => !fr.at(-1)[4] && Math.abs(fr.at(-1)[2]) < 0.05 && Math.abs(fr.at(-1)[3]) < 0.05;
const stopAt = (fr) => { let t = 0; fr.forEach((x, i) => { if (i && Math.abs(x[1] - fr[i - 1][1]) > 0.1) t = x[0]; }); return t; };
const lastMove = (fr) => { let t = 0; fr.forEach((x) => { if (Math.abs(x[2]) > 0.5 || Math.abs(x[3]) > 0.5) t = x[0]; }); return t; };
const settle = () => p.waitForTimeout(700);

await set({ 'data-sg-motion': 'lively' });
ok('a group has one lens for its columns', (await tw.locator('.sg-wheels__lens').count()) === 1);

/* ---------------------------------------------------------------- one notch each way */
await place(MIN, 20); await settle(); await hover(MIN);
let r = record(MIN, 900); await p.mouse.wheel(0, 36); let fr = await r;
let top = span(fr, 2), bot = span(fr, 3);
/* the squeeze of one notch, in this engine: the knocks of a long turn are compared with it (Firefox smooths wheel
   scrolling, so in a long turn its rows cross slower and its knocks are shallower than Chromium's: 8.0 against 9.8,
   with the same 7.5 squeeze) */
const squeeze = bot[0];
/* deeper than 7 px (7.5 in Chromium and Firefox alike): with the knocks compared with it below, a squeeze and knocks
   that weaken together fail here */
ok('one notch down: the bottom edge comes in (the lens squeezes up), the top edge stays', bot[0] < -7 && Math.abs(top[0]) < 0.6 && Math.abs(top[1]) < 0.6, `bottom ${bot.map((x) => x.toFixed(1))}, top ${top.map((x) => x.toFixed(1))}`);
ok('one notch down: it pops out past its size, then is home', bot[1] > 0.8 && rest(fr), `bottom max ${bot[1].toFixed(1)}`);
ok('one notch: the value moved one row', Math.round(fr.at(-1)[1] / 36) === 21, `row ${fr.at(-1)[1] / 36}`);
await settle();
r = record(MIN, 900); await p.mouse.wheel(0, -36); fr = await r;
top = span(fr, 2); bot = span(fr, 3);
ok('one notch up: the top edge comes in, the bottom edge stays, then a pop', top[1] > 5 && Math.abs(bot[0]) < 0.6 && top[0] < -0.8 && rest(fr), `top ${top.map((x) => x.toFixed(1))}, bottom ${bot.map((x) => x.toFixed(1))}`);
await settle();

/* ---------------------------------------------------------------- a long turn: knocks, then one pop */
r = record(MIN, 1600); for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(30); } fr = await r;
bot = span(fr, 3);
ok('a long turn: each row crossing knocks the edge further in than the squeeze', bot[0] < squeeze - 0.25, `deepest ${bot[0].toFixed(1)} (squeeze ${(-squeeze).toFixed(1)})`);
/* until the row reaches the lens (within a fifth of a row for good): from there the pop may start with the spring's last swing */
const fin = fr.at(-1)[1]; let arriveT = 0; fr.forEach((x) => { if (Math.abs(x[1] - fin) >= 7.2) arriveT = x[0]; });
const during = fr.filter((x) => x[0] > 120 && x[0] < arriveT - 20);
ok('a long turn: the lens stays squeezed while the rows move (no pop mid-turn)', during.length > 3 && during.every((x) => x[3] < -2), `${during.filter((x) => x[3] >= -2).length} frames let go`);
ok('a long turn: home soon after the rows stop', rest(fr) && lastMove(fr) - stopAt(fr) < 380, `rows stop ${Math.round(stopAt(fr))} ms, lens still ${Math.round(lastMove(fr))} ms`);
await settle();

/* ---------------------------------------------------------------- turning back */
r = record(MIN, 1400);
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 50); await p.waitForTimeout(30); }
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -50); await p.waitForTimeout(30); }
fr = await r;
ok('turning back: the other edge squeezes', span(fr, 3)[0] < -5 && span(fr, 2)[1] > 5 && rest(fr), `bottom ${span(fr, 3)[0].toFixed(1)}, top ${span(fr, 2)[1].toFixed(1)}`);
await settle();

/* ---------------------------------------------------------------- the end: momentum past it */
const n = await cols.nth(MIN).evaluate((sc) => sc.children.length);
await place(MIN, n - 7); await settle();
r = record(MIN, 2000);
for (let i = 0; i < 60; i++) { await p.mouse.wheel(0, Math.max(2, 40 * Math.exp(-i / 16))); await p.waitForTimeout(16); }
fr = await r;
ok('a fling into the end: the value is on the last row', Math.round(fr.at(-1)[1] / 36) === n - 1, `row ${(fr.at(-1)[1] / 36).toFixed(2)} of ${n - 1}`);
ok('a fling into the end: the lens is home soon after the rows stop, though wheel events keep coming', rest(fr) && lastMove(fr) - stopAt(fr) < 380, `rows stop ${Math.round(stopAt(fr))} ms, lens still ${Math.round(lastMove(fr))} ms`);
await settle();
r = record(MIN, 700); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(30); } fr = await r;
ok('pushing on at the end: the rows do not move, nor does the lens', fr.every((x) => !x[4]), `${fr.filter((x) => x[4]).length} frames moved`);
await settle();

/* ---------------------------------------------------------------- keys and clicks */
await place(MIN, 30); await settle();
await cols.nth(MIN).focus();
r = record(MIN, 900); await p.keyboard.press('ArrowDown'); fr = await r;
ok('ArrowDown: the same gesture (bottom squeeze, pop, home) and one row on', span(fr, 3)[0] < -5 && span(fr, 3)[1] > 0.8 && rest(fr) && Math.round(fr.at(-1)[1] / 36) === 31, `bottom ${span(fr, 3).map((x) => x.toFixed(1))}, rest ${rest(fr)}, row ${(fr.at(-1)[1] / 36).toFixed(2)}`);
await settle();
r = record(MIN, 900); await p.keyboard.press('ArrowUp'); fr = await r;
ok('ArrowUp: the top edge squeezes', span(fr, 2)[1] > 5 && rest(fr));
await settle();
const rowBox = await cols.nth(MIN).locator('.sg-wheel__item').nth(28).boundingBox();
r = record(MIN, 1000); await p.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2); fr = await r;
ok('a click on a row above: the top edge squeezes, the row comes to the lens', span(fr, 2)[1] > 5 && rest(fr) && Math.round(fr.at(-1)[1] / 36) === 28, `row ${(fr.at(-1)[1] / 36).toFixed(2)}`);
await settle();

/* ---------------------------------------------------------------- another column, same lens */
await hover(HOUR);
r = record(HOUR, 900); await p.mouse.wheel(0, 36); fr = await r;
ok('the hour column squeezes the same lens', span(fr, 3)[0] < -5 && rest(fr));
await settle();

/* ---------------------------------------------------------------- the row in the lens */
const scales = await cols.nth(MIN).evaluate((sc) => {
  const i = Math.round(sc.scrollTop / sc.firstElementChild.offsetHeight);
  const sx = (k) => new DOMMatrix(getComputedStyle(sc.children[k].firstElementChild).transform).a;
  return [sx(i), sx(i + 1), sx(i + 2)];
});
ok('the row in the lens is magnified, its neighbours recede', Math.abs(scales[0] - 1.14) < 0.01 && scales[1] < 1 && scales[2] < scales[1], scales.map((x) => x.toFixed(3)).join(' / '));

/* ---------------------------------------------------------------- a click is as quick as a turn */
const homeAfter = (fr) => { let t = 0; fr.forEach((x) => { if (x[4]) t = x[0]; }); return t; };
await place(MIN, 30); await settle(); await hover(MIN);
r = record(MIN, 1100); await p.mouse.wheel(0, 36); const byWheel = homeAfter(await r); await settle();
const two = await cols.nth(MIN).locator('.sg-wheel__item').nth(33).boundingBox();
r = record(MIN, 1100); await p.mouse.click(two.x + two.width / 2, two.y + two.height / 2); const byClick = homeAfter(await r); await settle();
ok('a click two rows away pops as soon as the row reaches the lens (home about as soon as after a notch)', byClick > 0 && byClick - byWheel < 120, `notch ${Math.round(byWheel)} ms, click ${Math.round(byClick)} ms`);

/* ---------------------------------------------------------------- a two-row column (AM/PM) */
const PER = 0;
await hover(PER);
const perTop = await cols.nth(PER).evaluate((sc) => sc.scrollTop);
r = record(PER, 900); await p.mouse.wheel(0, perTop > 0 ? -36 : 36); fr = await r;
ok('AM/PM: one notch reaches the end and still squeezes and pops (it is a turn, not a push on the end)', fr.some((x) => x[4]) && rest(fr), `${fr.filter((x) => x[4]).length} frames`);
await settle();

/* ---------------------------------------------------------------- an alarm that is off */
const sw = p.locator('[data-demo="alarm"]').getByRole('switch', { name: '알람 켜기' });
if (await sw.isChecked()) await sw.click();
await p.waitForTimeout(300);
const offTop = await cols.nth(MIN).evaluate((sc) => sc.scrollTop);
await hover(MIN); await p.mouse.wheel(0, 100); await p.waitForTimeout(400);
const mb = await cols.nth(MIN).boundingBox();
await p.mouse.down(); await p.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2 - 80, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(400);
const offState = await p.locator('[data-demo="alarm"]').evaluate((d) => ({
  tabbable: [...d.querySelectorAll('.sg-wheel__scroller')].some((x) => x.tabIndex >= 0),
  ariaDisabled: d.querySelector('.sg-wheel__scroller').getAttribute('aria-disabled'),
  weekdays: [...d.querySelectorAll('.sg-weekday')].every((x) => x.disabled),
}));
ok('alarm off: the wheel does not turn (wheel, drag), leaves the tab order, and the weekdays are disabled', (await cols.nth(MIN).evaluate((sc) => sc.scrollTop)) === offTop && !offState.tabbable && offState.ariaDisabled === 'true' && offState.weekdays, JSON.stringify(offState));
await sw.click(); await p.waitForTimeout(300);
await hover(MIN); await p.mouse.wheel(0, 36); await settle();
ok('alarm on again: the wheel turns', (await cols.nth(MIN).evaluate((sc) => sc.scrollTop)) !== offTop);

/* ---------------------------------------------------------------- calm, reduced motion */
await set({ 'data-sg-motion': 'calm' }); await hover(MIN);
r = record(MIN, 900); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 50); await p.waitForTimeout(30); } fr = await r;
ok('calm: the lens does not squeeze', fr.every((x) => !x[4]));
await settle();
await set({ 'data-sg-motion': 'lively', 'data-sg-reduce-motion': 'true' });
r = record(MIN, 900); await p.mouse.wheel(0, 50); fr = await r;
const after = fr.filter((x) => x[0] > stopAt(fr));
ok('reduced motion: the lens does not squeeze', fr.every((x) => !x[4]));
ok('reduced motion: the wheel lands on its row with no spring (one jump)', Math.abs(fr.at(-1)[1] / 36 - Math.round(fr.at(-1)[1] / 36)) < 0.01 && new Set(after.map((x) => x[1])).size <= 1, `${new Set(fr.map((x) => Math.round(x[1]))).size} positions`);
await set({ 'data-sg-reduce-motion': null });

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
