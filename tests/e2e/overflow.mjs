// More items than fit on one line: segmented controls and tab bars on the docs lab page ("항목이 너무 많을 때").
// At 1280 / 390 / 320 px: the page never scrolls sideways, every item keeps a usable size and its accessible name,
// is reachable and selectable by tap and by keyboard, the droplet indicator lands exactly on the selection after
// taps, keys and drags (also from a scrolled track), and the selected item is scrolled into view. Disabled items
// are skipped, a refused (controlled) value stays put, and reduced motion (?rm=1) lands just the same. What is hidden
// can be browsed without choosing: the wheel scrolls the strip sideways, a mouse drag off the selection pans it.
// usage: node tests/e2e/overflow.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173, PORT=… to change;
//        DIST=1 serves apps/docs/dist through request interception instead — no server needed)
// covers: controls, navigation   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
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
    /* the finger must go down on the selection: measured, then confirmed at that point (on a busy machine the page
       can still be settling a scroll between the measuring and the press) */
    let tb, sb, y, x0, x1;
    for (let n = 0; n < 3; n++) {
      tb = await box.locator(k.track).boundingBox(); sb = await box.locator(`${k.item}[${k.on}="true"]`).boundingBox();
      y = sb.y + sb.height / 2; x0 = sb.x + sb.width / 2; x1 = tb.x + tb.width * toFrac;
      if (await box.evaluate((el, { k, x, y }) => document.elementFromPoint(x, y)?.closest(k.item)?.getAttribute(k.on) === 'true', { k, x: x0, y })) break;
      await p.waitForTimeout(150); await still(box, k);
    }
    /* what the pointer did, for the failure message: where it went down (item index or class), whether the drop was
       pressed (P) and dragging (D) at each step — a rare WebKit failure under load is not yet explained */
    await box.evaluate((el, k) => {
      const t = el.querySelector(k.track);
      window.__ev = [];
      if (window.__evOn) { window.__evTrack = t; return; }
      window.__evOn = true; window.__evTrack = t;
      for (const ty of ['pointerdown', 'pointerup', 'pointercancel']) addEventListener(ty, (e) => {
        const tr = window.__evTrack, it = e.target.closest?.('[data-sg-item]');
        window.__ev.push(`${ty.slice(7)}@${it && tr.contains(it) ? '#' + [...tr.querySelectorAll('[data-sg-item]')].indexOf(it) : String(e.target.className ?? e.target.nodeName).slice(0, 20)}${tr.hasAttribute('data-sg-pressing') ? ' P' : ''}${tr.hasAttribute('data-sg-dragging') ? ' D' : ''}`);
      }, true);
      addEventListener('pointermove', () => { const tr = window.__evTrack; if (tr.hasAttribute('data-sg-dragging') && !window.__ev.includes('dragging')) window.__ev.push('dragging'); }, true);
    }, k);
    await p.mouse.move(x0, y); await p.mouse.down();
    for (let s = 1; s <= 14; s++) { await p.mouse.move(x0 + ((x1 - x0) * s) / 14, y); await p.waitForTimeout(12); }
    /* which item is under the finger at release */
    const under = await box.evaluate((el, { k, x, y }) => { const h = document.elementFromPoint(x, y)?.closest(k.item); return [...el.querySelectorAll(k.item)].indexOf(h); }, { k, x: x1, y });
    await p.mouse.up(); await still(box, k);
    return { under, s: await state(box, k), ev: (await p.evaluate(() => window.__ev)).join(' ') };
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
      `→ under #${a.under}: ${fmt(a.s)} [${a.ev}]; ← under #${c.under}: ${fmt(c.s)} [${c.ev}]`);
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
    /* showLabels={false}: icon tabs hide their label from sight but keep it as the name; a tab without an icon shows it */
    await p.goto(U('lab')); await settle(p, 700);
    const il = await p.evaluate(() => [...document.querySelectorAll('[data-lab="tabs-icons-text"] .sg-tabbar__item')].map((it) => ({
      icon: !!it.querySelector('svg'), w: it.querySelector('.sg-tabbar__label').getBoundingClientRect().width, name: it.textContent.trim() })));
    ok('icons-only tab bar: icon tabs hide their label, the tab without an icon shows it, every tab keeps its name',
      il.length === 3 && il.filter((t) => t.icon).every((t) => t.w <= 1) && il.filter((t) => !t.icon).every((t) => t.w > 10) && il.every((t) => t.name.length > 0), JSON.stringify(il));
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

/* browsing what is hidden, without choosing: a mouse wheel scrolls the strip sideways and hands over to the page at
   the end; a mouse drag that does not start on the selection pans the strip 1:1 and selects nothing; a click still
   selects.
   These checks depend on real time between events, as the component does: wheel events less than 300 ms apart are
   one gesture (core/overflow.ts LATCH), and a fling needs the release within 80 ms of the last move (core/bridge.ts).
   On a busy machine (suites side by side) the browser may deliver the test's events further apart than that — then
   the component rightly treats them as separate gestures and the check would test something else. So each gesture
   records its own event times in the page; one whose timing broke the premise is tried again (up to 3 times), and
   the check reports how many tries it took. A real fault fails all three. */
const GAP_WHEEL = 250, GAP_FLING = 70;
const browse = async () => {
  const p = await newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(U('lab')); await settle(p, 900);
  await p.evaluate(() => {
    window.__t = { wheel: [], move: [], up: [] };
    addEventListener('wheel', (e) => window.__t.wheel.push(e.timeStamp), { capture: true, passive: true });
    addEventListener('pointermove', (e) => { if (e.buttons) window.__t.move.push(e.timeStamp); }, true);
    addEventListener('pointerup', (e) => window.__t.up.push(e.timeStamp), true);
  });
  const resetTimes = () => p.evaluate(() => { window.__t.wheel = []; window.__t.move = []; window.__t.up = []; });
  const maxWheelGap = () => p.evaluate(() => { const a = window.__t.wheel; let m = 0; for (let i = 1; i < a.length; i++) m = Math.max(m, a[i] - a[i - 1]); return Math.round(m); });
  const releaseGap = () => p.evaluate(() => { const m = window.__t.move, u = window.__t.up; return m.length && u.length ? Math.round(u[u.length - 1] - m[m.length - 1]) : Infinity; });
  /* run a gesture until its timing held (pre() true), at most 3 times; returns the last result and the tries */
  const tries = async (fn) => { let r, n = 0; do { n++; r = await fn(); } while (!r.pre && n < 3); return { ...r, n }; };
  const note = (r) => (r.n > 1 ? ` (${r.n} tries: the browser delivered the events too far apart before)` : '') + (r.pre ? '' : ' — event timing never held');
  for (const id of ['many-seg-360', 'many-tabs-360']) {
    const t = p.locator(`[data-lab="${id}"] :is(.sg-segmented, .sg-tabbar__track)`).first();
    const st = () => t.evaluate((e) => ({ sl: Math.round(e.scrollLeft), max: e.scrollWidth - e.clientWidth,
      sel: [...e.querySelectorAll('[data-sg-item]')].findIndex((x) => x.getAttribute('aria-checked') === 'true' || x.getAttribute('aria-selected') === 'true') }));
    const y = () => p.evaluate(() => scrollY);
    /* the strip at its start, in view, the page still */
    const home = async () => { await t.evaluate((e) => { e.scrollLeft = 0; e.scrollIntoView({ block: 'center', behavior: 'instant' }); }); await settle(p, 450); };

    /* one gesture over the strip: it scrolls sideways, and reaching the end does not hand over mid-gesture */
    const g1 = await tries(async () => {
      await home();
      const bx = await t.boundingBox(), y0 = await y();
      await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
      await resetTimes();
      await p.mouse.wheel(0, 100); await settle(p, 120);
      const one = await st(), y1 = await y();
      for (let k = 0; k < 30; k++) await p.mouse.wheel(0, 100);
      await settle(p, 300);
      const end = await st(), y2 = await y();
      return { one, end, d1: y1 - y0, d2: y2 - y0, y2, pre: (await maxWheelGap()) < GAP_WHEEL };
    });
    ok(`${id}: the mouse wheel scrolls the strip sideways, and one gesture that reaches the end stays there (the page does not take over mid-gesture)${note(g1)}`,
      g1.pre && g1.one.sl > 0 && g1.d1 === 0 && g1.end.sl >= g1.end.max - 1 && g1.d2 === 0, `first ${g1.one.sl} (page ${g1.d1}), end ${g1.end.sl}/${g1.end.max} (page ${g1.d2})`);
    /* after a pause, a new turn at the end scrolls the page (a pause is always longer than the latch) */
    await settle(p, 400);
    for (let k = 0; k < 3; k++) await p.mouse.wheel(0, 100);
    await settle(p, 300);
    const y3 = await y();
    ok(`${id}: after a pause, the next turn at the end scrolls the page`, y3 > g1.y2, `page ${g1.y2} → ${y3}`);

    /* a gesture that started on the page keeps scrolling the page when the strip passes under the pointer */
    const g3 = await tries(async () => {
      await home();
      const b3 = await t.boundingBox();
      await p.mouse.move(b3.x + b3.width / 2, b3.y - 60);
      await resetTimes();
      await p.mouse.wheel(0, 60); await p.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2);
      const s4 = (await st()).sl, y4 = await y();
      await p.mouse.wheel(0, 60); await p.mouse.wheel(0, 60); await settle(p, 300);
      const s5 = (await st()).sl, y5 = await y();
      return { s4, s5, y4, y5, pre: (await maxWheelGap()) < GAP_WHEEL };
    });
    ok(`${id}: a wheel gesture that started on the page keeps scrolling the page over the strip${note(g3)}`, g3.pre && g3.s5 === g3.s4 && g3.y5 > g3.y4, `strip ${g3.s4} → ${g3.s5}, page ${g3.y4} → ${g3.y5}`);

    /* a mouse drag that starts off the selection pans the strip and chooses nothing; let go while moving, it coasts */
    const items = t.locator('[data-sg-item]');
    const g4 = await tries(async () => {
      await t.evaluate((e) => { e.scrollLeft = e.scrollWidth; e.scrollIntoView({ block: 'center', behavior: 'instant' }); }); await settle(p, 400);
      const b2 = await t.boundingBox(), before = await st();
      /* start on an item that is not the selection: the leftmost one in view */
      const startX = await items.evaluateAll((els, x) => { const s = els.find((e) => { const r = e.getBoundingClientRect(); return r.left >= x && e.getAttribute('aria-checked') !== 'true' && e.getAttribute('aria-selected') !== 'true'; }); const r = s.getBoundingClientRect(); return r.left + r.width / 2; }, b2.x);
      await resetTimes();
      await p.mouse.move(startX, b2.y + b2.height / 2); await p.mouse.down();
      await p.mouse.move(startX + 220, b2.y + b2.height / 2, { steps: 8 }); await p.mouse.up();
      const atRelease = (await st()).sl;
      await settle(p, 1200);
      return { before, atRelease, after: await st(), gap: await releaseGap(), pre: (await releaseGap()) < GAP_FLING };
    });
    ok(`${id}: a mouse drag off the selection pans the strip and chooses nothing (not even the item it ends on)`, g4.after.sl < g4.before.sl - 150 && g4.after.sel === g4.before.sel, `scroll ${g4.before.sl} → ${g4.after.sl}, selection ${g4.before.sel} → ${g4.after.sel}`);
    ok(`${id}: let go while moving, it coasts on and comes to rest (a fling)${note(g4)}`, g4.pre && (g4.after.sl < g4.atRelease - 20 || g4.after.sl === 0), `at release ${g4.atRelease} → at rest ${g4.after.sl}; release ${g4.gap} ms after the last move`);
    const k = g4.after.sel === 1 ? 2 : 1;
    await items.nth(k).click(); await settle(p, 400);
    ok(`${id}: a click still chooses`, (await st()).sel === k);
  }
  await p.context().close();
};

/* OVF_PART=checks: everything but browsing; OVF_PART=browse: only browsing — the runner puts browsing, which depends
   on real time between events, in its less crowded motion phase. OVF_WIDTHS=1280 OVF_ONLY=many-tabs-300-action:
   only these (while investigating one case). */
const PART = process.env.OVF_PART;
const WIDTHS = process.env.OVF_WIDTHS ? process.env.OVF_WIDTHS.split(',').map(Number) : [1280, 390, 320];
if (process.env.OVF_ONLY) CASES.splice(0, CASES.length, ...CASES.filter(([id]) => id === process.env.OVF_ONLY));
await Promise.all([
  ...(PART === 'browse' ? [] : [...WIDTHS.map(atWidth), ...(process.env.OVF_ONLY ? [] : [reduced()])]),
  ...(PART === 'checks' || process.env.OVF_ONLY ? [] : [browse()]),
]);

ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
