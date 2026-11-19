// More items than fit on one line: segmented controls and tab bars on the docs lab page ("항목이 너무 많을 때").
// At 1280 / 390 / 320 px: the page never scrolls sideways, every item keeps a usable size and its accessible name,
// is reachable and selectable by tap and by keyboard, the droplet indicator lands exactly on the selection after
// taps, keys and drags (also from a scrolled track), and the selected item is scrolled into view. Disabled items
// are skipped, a refused (controlled) value stays put, and reduced motion (?rm=1) lands just the same.
// usage: node tests/e2e/overflow.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173, PORT=… to change;
//        DIST=1 serves apps/docs/dist through request interception instead — no server needed)
import * as pw from 'playwright';
import { readFile } from 'node:fs/promises';
const engine = process.env.BROWSER || 'chromium';
const PORT = process.env.PORT || 4173;
/* Firefox refuses a few "bad" ports (4190 is one); the override is harmless for any other port */
const b = await pw[engine].launch(engine === 'firefox' ? { firefoxUserPrefs: { 'network.security.ports.banned.override': String(PORT) } } : {});
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const ORIGIN = process.env.DIST ? 'http://satin-glass.test' : `http://localhost:${PORT}`;
const U = (id, q = '') => `${ORIGIN}/${q}#/${id}`;
const DIST = new URL('../../apps/docs/dist/', import.meta.url);
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', json: 'application/json', woff2: 'font/woff2' };
const errors = [];
const newPage = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  if (process.env.DIST) await ctx.route(`${ORIGIN}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname.slice(1) || 'index.html';
    try { await r.fulfill({ body: await readFile(new URL(path, DIST)), contentType: TYPES[path.split('.').pop()] ?? 'application/octet-stream' }); } catch { await r.fulfill({ status: 404, body: '' }); }
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/https?:\/\/(?!localhost|satin-glass\.test)/.test(m.text())) errors.push(m.text()); });
  return p;
};
const settle = (p, ms = 650) => p.waitForTimeout(ms);
/* waits until the drop has come to rest on the selected item (within 1 px of it, and under 0.2 px of movement for
   3 frames in a row — a spring's overshoot also pauses for a frame or two at its turning points) instead of a fixed
   pause: it adapts to a loaded machine (suites run side by side), where a fixed pause would sometimes check mid-move.
   A drop that never lands is caught by `max`: the check that follows then fails as before. */
const still = (box, k, max = 2000) => box.evaluate((el, { k, max }) => new Promise((res) => {
  const t = el.querySelector(k.track), ind = t.querySelector(k.ind), t0 = performance.now();
  let last = null, calm = 0;
  const tick = () => {
    const r = ind.getBoundingClientRect(), now = [r.left, r.right, r.top, r.bottom, t.scrollLeft];
    const sel = t.querySelector(`${k.item}[${k.on}="true"]`)?.getBoundingClientRect();
    const on = !sel || (Math.abs(r.left - sel.left) <= 1 && Math.abs(r.right - sel.right) <= 1);
    calm = on && last && now.every((v, i) => Math.abs(v - last[i]) < 0.2) ? calm + 1 : 0; last = now;
    if (calm >= 3 || performance.now() - t0 > max) res(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { k, max });
const lab = (p, sel) => p.locator(`[data-lab="${sel}"]`);

const SEG = { track: '.sg-segmented', item: '.sg-segmented__item', ind: '.sg-segmented__indicator', role: 'radio', on: 'aria-checked' };
const TAB = { track: '.sg-tabbar__track', item: '.sg-tabbar__item', ind: '.sg-tabbar__indicator', role: 'tab', on: 'aria-selected' };
const CASES = [
  ['many-seg-full', SEG], ['many-seg-360', SEG], ['many-seg-240', SEG], ['many-seg-disabled', SEG], ['many-seg-refused', SEG, { refused: 'doc' }],
  ['many-tabs-360-action', TAB], ['many-tabs-360', TAB], ['many-tabs-300-action', TAB], ['many-tabs-300-compact', TAB, { compact: true }],
];

/* geometry of one case, all in viewport pixels */
const state = (box, k) => box.evaluate((el, k) => {
  const t = el.querySelector(k.track), tr = t.getBoundingClientRect(), items = [...t.querySelectorAll(k.item)];
  const si = items.findIndex((x) => x.getAttribute(k.on) === 'true'), s = items[si]?.getBoundingClientRect(), i = t.querySelector(k.ind).getBoundingClientRect();
  return {
    selected: si, count: items.filter((x) => x.getAttribute(k.on) === 'true').length,
    dl: s ? +(i.left - s.left).toFixed(2) : NaN, dr: s ? +(i.right - s.right).toFixed(2) : NaN,
    visible: !!s && s.left >= tr.left - 1 && s.right <= tr.right + 1,
    scroll: Math.round(t.scrollLeft), scrollable: t.scrollWidth > t.clientWidth + 1,
    moreStart: t.hasAttribute('data-sg-more-start'), moreEnd: t.hasAttribute('data-sg-more-end'),
  };
}, k);
const lands = (s) => s.count === 1 && Math.abs(s.dl) <= 1.5 && Math.abs(s.dr) <= 1.5 && s.visible;
const fmt = (s) => `sel ${s.selected}, ind Δ ${s.dl}/${s.dr}, visible ${s.visible}, scroll ${s.scroll}`;

async function checkCase(p, id, k, opt = {}, vw, quick = false) {
  const box = lab(p, id), tag = `${id} @${vw}${quick ? ' rm' : ''}`;
  await box.scrollIntoViewIfNeeded();
  const items = box.locator(k.item), n = await items.count();
  const enabled = []; for (let i = 0; i < n; i++) if (!(await items.nth(i).isDisabled())) enabled.push(i);

  if (!quick) {
    /* size, containment, labels and names */
    const g = await box.evaluate((el, { k, compact }) => {
      const t = el.querySelector(k.track), tr = t.getBoundingClientRect(), br = el.getBoundingClientRect();
      const items = [...t.querySelectorAll(k.item)].map((it) => {
        const r = it.getBoundingClientRect(), lab = it.querySelector('[class$="__label"]'), icon = it.querySelector('svg')?.getBoundingClientRect();
        const text = lab?.textContent ?? '';
        const shown = lab && getComputedStyle(lab).display !== 'none' && lab.getBoundingClientRect().width > 1;   /* compact: visually hidden */
        return { w: r.width, h: r.height, text, cut: shown && lab.scrollWidth > lab.clientWidth + 1, iconW: icon?.width ?? null,
          iconHit: !!(icon && shown && lab.getBoundingClientRect().width > 0 && it.classList.contains('sg-segmented__item') && icon.right > lab.getBoundingClientRect().left + 0.5) };
      });
      return { trackIn: tr.left >= br.left - 0.5 && tr.right <= br.right + 0.5, trackH: tr.height, items, compact };
    }, { k, compact: !!opt.compact });
    const minW = Math.min(...g.items.map((x) => x.w)), minH = Math.min(...g.items.map((x) => x.h));
    const isTab = k === TAB;
    ok(`${tag}: stays inside its box (track ${g.trackIn ? 'contained' : 'spills out'})`, g.trackIn);
    ok(`${tag}: tap targets — items ≥ ${isTab ? 44 : 36} px wide${isTab ? ', ≥ 42 px tall' : ', control ≥ 30 px tall'}`,
      minW >= (isTab ? 44 : 36) - 0.5 && (isTab ? minH >= 41.5 : g.trackH >= 29.5), `min ${minW.toFixed(1)}×${minH.toFixed(1)}, track h ${g.trackH}`);
    /* short labels (what most segments and tabs have) are never cut; long ones may truncate with an ellipsis */
    const shortCut = g.items.filter((x) => x.cut && x.text.length <= (isTab ? 3 : 8)).map((x) => x.text);
    ok(`${tag}: short labels read in full`, shortCut.length === 0, shortCut.join(', '));
    const squashed = g.items.filter((x) => x.iconW !== null && x.iconW < 15.5).length + g.items.filter((x) => x.iconHit).length;
    ok(`${tag}: icons keep their size and do not overlap labels`, squashed === 0, `${squashed} squashed/overlapping`);
    let named = 0;
    /* (a tab's badge is part of its name, e.g. "3 저장한 장소 목록") */
    for (const it of g.items) named += (await box.getByRole(k.role, { name: new RegExp(`(^|\\s|\\d|\\+)${it.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).count()) === 1 ? 1 : 0;
    ok(`${tag}: every item keeps its accessible name`, named === g.items.length, `${named}/${g.items.length}`);
    const s0 = await state(box, k);
    ok(`${tag}: initial selection is in view, indicator on it; ends fade only where items are hidden`,
      lands(s0) && (!s0.scrollable || s0.moreStart === s0.scroll > 2) && (s0.scrollable || (!s0.moreStart && !s0.moreEnd)), `${fmt(s0)} fade ${s0.moreStart}/${s0.moreEnd}`);
  }

  /* taps: every enabled item, left to right; disabled ones are ignored */
  const bad = [];
  const order = quick ? [enabled[enabled.length - 1], enabled[0], enabled[Math.floor(enabled.length / 2)]] : enabled;
  for (const i of order) {
    await items.nth(i).click(); await still(box, k);
    const s = await state(box, k), want = opt.refused ? -2 : i;
    if (want !== -2 && (s.selected !== i || !lands(s))) bad.push(`#${i}: ${fmt(s)}`);
    /* refused: the tapped item is in view, the kept selection may be scrolled away — but the drop sits on it */
    if (want === -2 && !(s.count === 1 && Math.abs(s.dl) <= 1.5 && Math.abs(s.dr) <= 1.5 && (await items.nth(s.selected).textContent()) === '문서')) bad.push(`#${i}: ${fmt(s)}`);
  }
  ok(`${tag}: ${opt.refused ? 'taps on a refused value keep the selection (and the indicator) on it' : 'tap selects each item, indicator lands, item scrolled into view'}`, bad.length === 0, bad.slice(0, 3).join(' | '));
  if (!quick && enabled.length < n) {
    const d = n - enabled.length, dis = []; for (let i = 0; i < n; i++) if (!enabled.includes(i)) dis.push(i);
    await items.nth(dis[0]).click({ force: true }); await still(box, k);
    ok(`${tag}: a disabled item ignores taps (${d} disabled)`, (await items.nth(dis[0]).getAttribute(k.on)) === 'false');
  }

  /* keyboard: Home, then → through every item (disabled ones skipped), End, ← */
  if (!opt.refused) {
    await box.locator(`${k.item}[${k.on}="true"]`).focus();
    await p.keyboard.press('Home'); await still(box, k);
    const sh = await state(box, k);
    const seen = [], landsEach = [];
    for (let j = 1; j < enabled.length; j++) {
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(quick ? 40 : 90);
      const s = await state(box, k); seen.push(s.selected);
      if (j % 4 === 0 || j === enabled.length - 1) { await still(box, k); const t = await state(box, k); if (!lands(t)) landsEach.push(`#${t.selected}: ${fmt(t)}`); }
    }
    ok(`${tag}: keys — Home selects the first enabled item, → visits every enabled item in order, indicator lands`,
      sh.selected === enabled[0] && lands(sh) && seen.join() === enabled.slice(1).join() && landsEach.length === 0, `home ${fmt(sh)}; seen ${seen.join(',')}; ${landsEach.join(' | ')}`);
    await p.keyboard.press('Home'); await still(box, k); await p.keyboard.press('End'); await still(box, k);
    const se = await state(box, k);
    await p.keyboard.press('ArrowLeft'); await still(box, k);
    const sl = await state(box, k);
    const focusedOk = await p.evaluate((on) => document.activeElement?.getAttribute(on) === 'true', k.on);
    ok(`${tag}: keys — End selects the last enabled item (scrolled into view), ← the one before, focus follows`,
      se.selected === enabled[enabled.length - 1] && lands(se) && sl.selected === enabled[enabled.length - 2] && lands(sl) && focusedOk, `end ${fmt(se)}; left ${fmt(sl)}`);
  }

  /* drag: from the selected item toward the far visible edge; then (scrolled to the end) back toward the start */
  const drag = async (fromSel, toFrac) => {
    const tb = await box.locator(k.track).boundingBox(), sb = await box.locator(`${k.item}[${k.on}="true"]`).boundingBox();
    const y = sb.y + sb.height / 2, x0 = sb.x + sb.width / 2, x1 = tb.x + tb.width * toFrac;
    await p.mouse.move(x0, y); await p.mouse.down();
    for (let s = 1; s <= 14; s++) { await p.mouse.move(x0 + ((x1 - x0) * s) / 14, y); await p.waitForTimeout(12); }
    /* which item is under the finger at release */
    const under = await box.evaluate((el, { k, x, y }) => { const h = document.elementFromPoint(x, y)?.closest(k.item); return [...el.querySelectorAll(k.item)].indexOf(h); }, { k, x: x1, y });
    await p.mouse.up(); await still(box, k);
    return { under, s: await state(box, k) };
  };
  if (!opt.refused) {
    await box.locator(`${k.item}[${k.on}="true"]`).focus(); await p.keyboard.press('Home'); await still(box, k);
    const a = await drag(true, 0.82);
    const aOk = lands(a.s) && (a.s.selected === a.under || (a.under >= 0 && (await items.nth(a.under).isDisabled())));
    await box.locator(`${k.item}[${k.on}="true"]`).focus(); await p.keyboard.press('End'); await still(box, k);
    const startScroll = (await state(box, k)).scroll;
    const c = await drag(true, 0.18);
    const cOk = lands(c.s) && (c.s.selected === c.under || (c.under >= 0 && (await items.nth(c.under).isDisabled())));
    ok(`${tag}: drag across the items — the drop lands on the item under the finger (also from a track scrolled by ${startScroll} px)`, aOk && cOk,
      `→ under #${a.under}: ${fmt(a.s)}; ← under #${c.under}: ${fmt(c.s)}`);
  } else {
    /* bring the kept selection into view (tapping other items may have scrolled it away), then drag it off */
    await box.locator(`${k.item}[${k.on}="true"]`).evaluate((e) => { const t = e.parentElement; t.scrollLeft = e.offsetLeft - 8; });
    await still(box, k);
    const a = await drag(true, 0.85);
    ok(`${tag}: dragging a refused value — the drop returns to the kept selection`, a.s.count === 1 && Math.abs(a.s.dl) <= 1.5 && Math.abs(a.s.dr) <= 1.5 && (await box.locator(`${k.item}[${k.on}="true"]`).textContent()) === '문서', fmt(a.s));
  }
}

/* each width (and the reduced-motion pass) in its own page, side by side: the pages share nothing, and every
   wait is "until it rests", so running them together only saves time (lines are tagged with their width) */
const atWidth = async (vw) => {
  const p = await newPage({ viewport: { width: vw, height: vw > 800 ? 900 : 760 } });
  await p.goto(U('lab')); await settle(p, 900);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(`lab @${vw}: the page does not scroll sideways`, o <= 0, `overflow ${o}px`);
  for (const [id, k, opt] of CASES) await checkCase(p, id, k, opt, vw);
  const o2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(`lab @${vw}: still no sideways page scroll after all the interaction`, o2 <= 0, `overflow ${o2}px`);
  if (vw === 1280) {
    /* the regular few-item controls still share the width equally (unchanged look) */
    await p.goto(U('navigation')); await settle(p, 700);
    const eq = await p.evaluate(() => { const ws = [...document.querySelector('.docs__page .sg-tabbar__track').querySelectorAll('.sg-tabbar__item')].map((t) => t.getBoundingClientRect().width); return { spread: Math.max(...ws) - Math.min(...ws), scroll: (() => { const t = document.querySelector('.docs__page .sg-tabbar__track'); return t.scrollWidth - t.clientWidth; })() }; });
    ok('navigation page: a regular tab bar still has equal tabs and nothing to scroll', eq.spread < 1 && eq.scroll <= 1, JSON.stringify(eq));
  }
  await p.context().close();
};

/* reduced motion: no animation, same landing */
const reduced = async () => {
  const p = await newPage({ viewport: { width: 390, height: 760 } });
  await p.goto(U('lab', '?rm=1')); await settle(p, 900);
  for (const [id, k, opt] of CASES.filter(([id]) => ['many-seg-360', 'many-seg-disabled', 'many-tabs-360-action', 'many-tabs-300-compact'].includes(id))) await checkCase(p, id, k, opt, 390, true);
  await p.context().close();
};

await Promise.all([...[1280, 390, 320].map(atWidth), reduced()]);

ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
