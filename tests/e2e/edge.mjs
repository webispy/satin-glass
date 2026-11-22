// Edge cases a user can produce: rapid repeats, changes mid-animation, navigation mid-gesture, bounds, disabled
// and refused (controlled) states, long text, touch, keyboard-only use, 320 px reflow, leftovers after many
// open/close cycles, and an axe accessibility scan. Uses the docs "lab" page plus the regular pages.
// usage: node tests/e2e/edge.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
import { readFileSync } from 'node:fs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id, q = '') => `http://localhost:4173/${q}#/${id}`;
const errors = [];
const newPage = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost') && !/https?:\/\/(?!localhost)/.test(m.text())) errors.push(m.text()); });
  return p;
};
const settle = (p, ms = 900) => p.waitForTimeout(ms);
const lab = (p, sel) => p.locator(`[data-lab="${sel}"]`);
const portals = (p) => p.evaluate(() => [...document.querySelectorAll('.sg-portal')].filter((x) => !x.querySelector('.sg-toaster')).length);
const bodyLocked = (p) => p.evaluate(() => document.body.style.overflow === 'hidden');
/* where a switch thumb rests: 'on' = 2 px from the right end, 'off' = 2 px from the left */
const thumbSide = (loc) => loc.evaluate((e) => { const t = e.querySelector('.sg-switch__thumb').getBoundingClientRect(), r = e.getBoundingClientRect(); const L = t.left - r.left, R = r.right - t.right; return Math.abs(R - 2) < 0.6 ? 'on' : Math.abs(L - 2) < 0.6 ? 'off' : `mid(${L.toFixed(1)},${R.toFixed(1)})`; });
const indicatorOn = (p, bar, ind, item) => p.evaluate(({ bar, ind, item }) => {
  const i = document.querySelector(ind).getBoundingClientRect(), t = document.querySelectorAll(item);
  const sel = [...t].find((x) => x.getAttribute('aria-selected') === 'true' || x.getAttribute('aria-checked') === 'true');
  const s = sel.getBoundingClientRect();
  return { dx: +(i.left - s.left).toFixed(1), dw: +(i.width - s.width).toFixed(1), selected: [...t].filter((x) => x.getAttribute('aria-selected') === 'true' || x.getAttribute('aria-checked') === 'true').length };
}, { bar, ind, item });

/* ================================================================ rapid repeats */
{
  const p = await newPage();
  await p.goto(U('inputs')); await settle(p, 600);
  const sw = p.locator('.docs__page .sg-switch').first();
  const start = await sw.getAttribute('aria-checked');
  for (let i = 0; i < 15; i++) await sw.click({ delay: 0 });
  await settle(p);
  const end = await sw.getAttribute('aria-checked'), side = await thumbSide(sw), cls = await sw.getAttribute('class');
  ok('switch: 15 rapid clicks → state follows parity, thumb rests on the right side, no stuck press', end !== start && side === (end === 'true' ? 'on' : 'off') && cls === 'sg-switch', `${start}→${end}, thumb ${side}, class "${cls}"`);

  const seg = p.locator('.docs__page .sg-segmented').first(), items = seg.locator('.sg-segmented__item');
  const n = await items.count();
  for (let i = 0; i < 20; i++) await items.nth((i * 7) % n).click({ delay: 0 });
  await settle(p);
  const segOn = await indicatorOn(p, '.docs__page .sg-segmented', '.docs__page .sg-segmented .sg-segmented__indicator', '.docs__page .sg-segmented:first-of-type .sg-segmented__item');
  ok('segmented: 20 rapid taps → one selection, indicator exactly on it', segOn.selected === 1 && Math.abs(segOn.dx) < 1 && Math.abs(segOn.dw) < 1, JSON.stringify(segOn));

  await p.goto(U('navigation')); await settle(p, 600);
  const tabs = p.locator('.docs__page .sg-tabbar__bar').first().locator('.sg-tabbar__item');
  for (let i = 0; i < 20; i++) await tabs.nth((i * 3) % 4).click({ delay: 0 });
  await settle(p);
  const tabOn = await indicatorOn(p, '', '.docs__page .sg-tabbar__indicator', '.docs__page .sg-tabbar__bar .sg-tabbar__item');
  ok('tab bar: 20 rapid taps → one selection, indicator exactly on it', tabOn.selected === 1 && Math.abs(tabOn.dx) < 1 && Math.abs(tabOn.dw) < 1, JSON.stringify(tabOn));

  await p.goto(U('lab')); await settle(p, 600);
  const base = await portals(p);
  const tog = lab(p, 'spam').getByRole('button', { name: '메뉴 토글' });
  for (let i = 0; i < 9; i++) await tog.click({ delay: 0 });
  await settle(p, 700);
  const menus9 = await p.locator('.sg-menu').count();
  await p.keyboard.press('Escape'); await settle(p, 500);
  for (let i = 0; i < 10; i++) await tog.click({ delay: 0 });
  await settle(p, 700);
  const menus10 = await p.locator('.sg-menu').count(), left = await portals(p);
  ok('menu: 9 rapid toggles → exactly one menu; 10 → none; nothing left behind', menus9 === 1 && menus10 === 0 && left === base, `after 9: ${menus9}, after 10: ${menus10}, portals ${left} (base ${base})`);

  const openD = lab(p, 'spam').getByRole('button', { name: '대화상자' });
  await openD.click(); await p.waitForTimeout(40); await p.keyboard.press('Escape'); await p.waitForTimeout(40); await openD.click(); await settle(p, 700);
  const dialogs = await p.locator('[role=alertdialog]').count(), inside = await p.evaluate(() => !!document.activeElement?.closest('[role=alertdialog]'));
  ok('dialog: open → Esc → open within 80 ms ends with one open dialog, focus inside', dialogs === 1 && inside && await bodyLocked(p), `dialogs ${dialogs}, focus inside ${inside}`);
  await p.keyboard.press('Escape'); await settle(p, 500);
  ok('dialog: after closing, the page scrolls again', !(await bodyLocked(p)) && (await portals(p)) === base);
  await p.context().close();
}

/* ================================================================ changes mid-animation / navigation mid-gesture */
{
  const p = await newPage();
  await p.goto(U('navigation')); await settle(p, 600);
  await p.locator('.docs__page .sg-tabbar__bar .sg-tabbar__item').nth(3).click();
  await p.setViewportSize({ width: 980, height: 900 }); await settle(p);
  const on = await indicatorOn(p, '', '.docs__page .sg-tabbar__indicator', '.docs__page .sg-tabbar__bar .sg-tabbar__item');
  ok('tab bar: window resized mid-travel → indicator still lands on the tab', Math.abs(on.dx) < 1 && Math.abs(on.dw) < 1, JSON.stringify(on));
  await p.setViewportSize({ width: 1280, height: 900 });

  await p.goto(U('overlays')); await settle(p, 600);
  await p.getByRole('button', { name: '장소 편집' }).click(); await p.waitForTimeout(60);
  await p.evaluate(() => { location.hash = '#/buttons'; }); await settle(p, 800);
  ok('sheet: navigating away while it opens → no sheet left, page unlocked', (await p.locator('.sg-sheet').count()) === 0 && !(await bodyLocked(p)));

  await p.goto(U('inputs')); await settle(p, 600);
  const sw = p.locator('.docs__page .sg-switch').first(); await sw.scrollIntoViewIfNeeded(); const r = await sw.boundingBox();
  await p.mouse.move(r.x + 8, r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 4 });
  await p.evaluate(() => { location.hash = '#/lists'; }); await p.waitForTimeout(300);
  await p.mouse.move(r.x + 60, r.y + 40, { steps: 3 }); await p.mouse.up(); await settle(p, 400);
  ok('switch: navigating away mid-drag, then releasing → no errors', errors.length === 0, errors.slice(-1).join(''));
  await p.context().close();
}

/* ================================================================ bounds, disabled, refused, long text */
{
  const p = await newPage();
  await p.goto(U('inputs')); await settle(p, 600);
  const sl = p.locator('.docs__page .sg-slider').first(); await sl.scrollIntoViewIfNeeded(); const sb = await sl.boundingBox();
  /* far past the ends, but inside the window (automation cannot move the mouse outside it) */
  const vw = p.viewportSize().width;
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.mouse.down(); await p.mouse.move(Math.min(vw - 2, sb.x + sb.width + 300), sb.y + sb.height / 2, { steps: 6 }); await p.mouse.up();
  const hi = await sl.getAttribute('aria-valuenow');
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.mouse.down(); await p.mouse.move(Math.max(2, sb.x - 300), sb.y + sb.height / 2, { steps: 6 }); await p.mouse.up();
  const lo = await sl.getAttribute('aria-valuenow');
  ok('slider: dragged far past either end → exactly max / min', hi === '100' && lo === '0', `${hi} / ${lo}`);

  await p.goto(U('lab')); await settle(p, 700);
  const dis = lab(p, 'disabled');
  const dsw = dis.getByRole('switch', { name: '비활성 스위치' }); await dsw.click({ force: true });
  const dsl = dis.getByRole('slider'); await dsl.scrollIntoViewIfNeeded(); const db = await dsl.boundingBox();
  await p.mouse.move(db.x + 4, db.y + db.height / 2); await p.mouse.down(); await p.mouse.move(db.x + db.width, db.y + db.height / 2, { steps: 5 }); await p.mouse.up();
  await dsl.focus(); await p.keyboard.press('End');
  const segB = dis.getByRole('radio', { name: 'B' }); await segB.click({ force: true });
  ok('disabled: switch, slider (drag and keys) and a disabled segment ignore input', (await dsw.getAttribute('aria-checked')) === 'false' && (await dsl.getAttribute('aria-valuenow')) === '40' && (await segB.getAttribute('aria-checked')) === 'false',
    `switch ${await dsw.getAttribute('aria-checked')}, slider ${await dsl.getAttribute('aria-valuenow')}, B ${await segB.getAttribute('aria-checked')}`);
  ok('disabled: not focusable by Tab (slider tabindex -1, native disabled elsewhere)', (await dsl.getAttribute('tabindex')) === '-1' && await dsw.isDisabled());

  const ref = lab(p, 'refused');
  const rsw = ref.getByRole('switch'); await rsw.click(); await settle(p, 600);
  const rsl = ref.getByRole('slider'); await rsl.scrollIntoViewIfNeeded(); const rb = await rsl.boundingBox();
  await p.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + rb.width * 0.9, rb.y + rb.height / 2, { steps: 6 }); await p.mouse.up(); await settle(p, 700);
  const thumbAt = await rsl.evaluate((s) => { const t = s.querySelector('.sg-slider__thumb').getBoundingClientRect(), r = s.getBoundingClientRect(); return (t.left + t.width / 2 - r.left) / r.width; });
  await ref.getByRole('radio', { name: 'B' }).click(); await settle(p, 800);
  const segR = await indicatorOn(p, '', '[data-lab="refused"] .sg-segmented__indicator', '[data-lab="refused"] .sg-segmented__item');
  const tries = await ref.locator('[data-lab="tries"]').textContent();
  ok('refused (controlled) switch: stays off and the thumb goes home', (await rsw.getAttribute('aria-checked')) === 'false' && (await thumbSide(rsw)) === 'off');
  ok('refused (controlled) slider: value stays, thumb returns to it', (await rsl.getAttribute('aria-valuenow')) === '30' && Math.abs(thumbAt - 0.3) < 0.03, `thumb at ${(thumbAt * 100).toFixed(1)} %`);
  ok('refused (controlled) segmented: selection and indicator stay on A; the parent was asked each time', segR.selected === 1 && Math.abs(segR.dx) < 1 && (await ref.getByRole('radio', { name: 'A' }).getAttribute('aria-checked')) === 'true' && /[1-9]/.test(tries), `${JSON.stringify(segR)} ${tries}`);

  const bnd = lab(p, 'bounds');
  const plus = bnd.getByRole('button', { name: 'Increase 경계 스테퍼' }), minus = bnd.getByRole('button', { name: 'Decrease 경계 스테퍼' });
  await plus.scrollIntoViewIfNeeded(); const pb = await plus.boundingBox();
  await p.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await p.mouse.down(); await p.waitForTimeout(1400); await p.mouse.up(); await settle(p, 300);
  const top = await bnd.locator('.sg-stepper__value [data-roll], .sg-stepper__value > span:last-child').last().textContent();
  ok('stepper: holding + repeats up to the max and stops (+ disabled), − is enabled', top?.trim() === '3' && await plus.isDisabled() && !(await minus.isDisabled()), `value ${top}`);
  const pr = await bnd.locator('.sg-progress__bar').evaluateAll((bars) => bars.map((x) => +new DOMMatrix(getComputedStyle(x).transform).a.toFixed(3)));
  ok('progress: out-of-range values are clamped (150 → full, −20 → empty)', pr[0] === 1 && pr[1] === 0, JSON.stringify(pr));

  /* long text: everything stays inside its box (or inside a track that scrolls) and truncates with an ellipsis */
  const spill = await p.evaluate(() => {
    const out = [];
    for (const box of document.querySelectorAll('[data-lab^="long-"]')) {
      const br = box.getBoundingClientRect();
      /* content of a strip that scrolls sideways (many / long segments) is clipped by its track: the track itself
         must fit, what lies beyond it is scrolled to, not spilled */
      const clipped = (e) => { for (let a = e.parentElement; a && a !== box; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) return true; return false; };
      for (const e of box.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > br.right + 1 || r.left < br.left - 1) && !clipped(e)) out.push(`${box.dataset.lab}: ${e.tagName}.${(e.className?.baseVal ?? e.className ?? '').toString().split(' ')[0]}`); }
    }
    const ell = ['.sg-button > span', '.sg-tabbar__label', '.sg-segmented__label', '.sg-chip__label', '.sg-list-item__title'].map((sel) => {
      const e = document.querySelector(`[data-lab^="long-"] ${sel}`); if (!e) return `${sel}: missing`;
      const cs = getComputedStyle(e); return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth ? null : `${sel}: ${cs.textOverflow} ${e.scrollWidth}/${e.clientWidth}`;
    }).filter(Boolean);
    return { spill: out.slice(0, 5), ell };
  });
  ok('long text: nothing spills out of its box; labels truncate with an ellipsis', spill.spill.length === 0 && spill.ell.length === 0, JSON.stringify(spill));
  const badge = await lab(p, 'long-tabs').locator('.sg-badge').textContent();
  ok('badge: 1234 shows as 99+', badge === '99+', badge);
  await p.context().close();
}

/* ================================================================ selection components */
{
  const p = await newPage();
  await p.goto(U('lab')); await settle(p, 700);
  const box = lab(p, 'select');
  const long = box.getByRole('combobox', { name: /긴 항목 40개/ });
  await long.scrollIntoViewIfNeeded();
  for (let i = 0; i < 7; i++) await long.click({ delay: 0 });
  await settle(p, 700);
  ok('select: 7 rapid clicks → exactly one list', (await p.getByRole('listbox').count()) === 1);
  const fit = await p.evaluate(() => { const r = document.querySelector('.sg-listbox').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
  const ell = await p.evaluate(() => { const e = [...document.querySelectorAll('.sg-option__label')].find((x) => x.textContent.includes('Very long')); const cs = getComputedStyle(e); return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth; });
  ok('select: a 40-option list stays inside the window; long labels truncate', fit && ell);
  await p.keyboard.press('Home'); for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowDown');
  const active = await p.evaluate(() => document.querySelector('.sg-option[data-active]')?.textContent);
  ok('select: arrows skip the disabled option (6번 is disabled)', !!active && !active.startsWith('6번'), active);
  await p.keyboard.press('Escape'); await settle(p, 400);
  const ref = box.getByRole('combobox', { name: /거부 셀렉트/ });
  await ref.click(); await p.getByRole('option', { name: '나' }).click(); await settle(p, 400);
  ok('select (refused, controlled): stays on its value', (await ref.textContent()).includes('가'));
  const dis = box.getByRole('combobox', { name: /비활성 셀렉트/ });
  await dis.click({ force: true }); await settle(p, 300);
  ok('select (disabled): does not open', (await p.getByRole('listbox').count()) === 0 && await dis.isDisabled());
  const dp = box.getByRole('button', { name: /이번 달만/ });
  await dp.click(); await settle(p, 500);
  const navOff = await p.locator('.sg-datepicker-panel .sg-calendar__nav button').evaluateAll((bs) => bs.map((x) => x.disabled));
  await p.keyboard.press('PageDown'); await settle(p, 300);
  const stillHere = await p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  const lastDay = await p.evaluate(() => { const n = new Date(); const l = new Date(n.getFullYear(), n.getMonth() + 1, 0); return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`; });
  ok('date picker (min/max = this month): month buttons disabled; PageDown stops at the last allowed day, focus kept', navOff.every(Boolean) && stillHere === lastDay, `${navOff} ${stillHere} (max ${lastDay})`);
  await p.keyboard.press('Escape'); await settle(p, 300);
  /* an anchor inside an inner scroll area: the panel follows that scrolling too */
  {
    const area = p.locator('[data-lab="inner-scroll"]');
    await area.scrollIntoViewIfNeeded();
    const cb = area.getByRole('combobox');
    await area.evaluate((e) => { e.scrollTop = 40; }); await settle(p, 200);
    await cb.click(); await settle(p, 600);
    const gap = () => p.evaluate(() => { const l = document.querySelector('.sg-listbox').getBoundingClientRect(), a = document.querySelector('[data-lab="inner-scroll"] [role=combobox]').getBoundingClientRect(); return Math.round(l.top - a.top); });
    const g0 = await gap();
    /* the wheel goes to whatever is under the pointer: put it on a corner of the area the open list does not cover
       (its middle may be under the list, depending on fonts and layout) */
    const ab = await area.boundingBox(), lb = await p.locator('.sg-listbox').boundingBox();
    const inList = (x, y) => lb && x >= lb.x && x <= lb.x + lb.width && y >= lb.y && y <= lb.y + lb.height;
    const spot = [[ab.x + 6, ab.y + 6], [ab.x + ab.width - 6, ab.y + 6], [ab.x + 6, ab.y + ab.height - 6], [ab.x + ab.width - 6, ab.y + ab.height - 6]].find(([x, y]) => !inList(x, y)) ?? [ab.x + 6, ab.y + 6];
    await p.mouse.move(spot[0], spot[1]); await p.mouse.wheel(0, 60); await settle(p, 300);
    const moved = await area.evaluate((e) => e.scrollTop), g1 = await gap(), still = (await p.getByRole('listbox').count()) === 1;
    ok('inner scroll area: scrolling it keeps the select open and its list glued to the field', still && moved > 40 && g0 === g1, `scrollTop ${moved}, gap ${g0} → ${g1}`);
    await p.keyboard.press('Escape'); await settle(p, 400);
  }
  for (let i = 0; i < 6; i++) { await dp.click({ delay: 0 }); }
  await settle(p, 700);
  ok('date picker: 6 rapid clicks → closed again, nothing left', (await p.locator('.sg-datepicker-panel').count()) === 0);
  await p.context().close();
}
{
  const p = await newPage({ hasTouch: true, isMobile: engine !== 'firefox', viewport: { width: 390, height: 844 } });
  await p.goto(U('selection')); await settle(p, 700);
  const cb = p.getByRole('combobox', { name: /이동 수단/ }); await cb.scrollIntoViewIfNeeded(); await cb.tap(); await settle(p, 600);
  await p.getByRole('option', { name: '자전거' }).tap(); await settle(p, 500);
  ok('touch: tap a select, tap an option', (await cb.textContent()).includes('자전거') && (await p.getByRole('listbox').count()) === 0);
  const fit = await (async () => { await cb.tap(); await settle(p, 600); return p.evaluate(() => { const r = document.querySelector('.sg-listbox').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }); })();
  ok('touch (390 px): the list fits the phone screen', fit);
  await p.keyboard.press('Escape'); await settle(p, 300);
  const box = p.getByRole('checkbox', { name: '화장실' }); await box.scrollIntoViewIfNeeded(); await box.tap();
  ok('touch: tap a checkbox', await box.isChecked());
  const dp = p.getByRole('button', { name: /방문 날짜/ }); await dp.scrollIntoViewIfNeeded(); await dp.tap(); await settle(p, 600);
  const inView = await p.evaluate(() => { const r = document.querySelector('.sg-datepicker-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  await p.locator('.sg-datepicker-panel .sg-day:not([aria-disabled="true"]):not([data-outside])').nth(3).tap(); await settle(p, 500);
  ok('touch (390 px): the date panel fits; tapping a day chooses it', inView && (await p.locator('.sg-datepicker-panel').count()) === 0 && /\d/.test(await dp.textContent()));
  await p.context().close();
}

/* ================================================================ touch */
{
  const p = await newPage({ hasTouch: true, isMobile: engine !== 'firefox', viewport: { width: 390, height: 844 } });
  await p.goto(U('inputs')); await settle(p, 700);
  const sw = p.locator('.docs__page .sg-switch').first(); await sw.scrollIntoViewIfNeeded();
  const before = await sw.getAttribute('aria-checked'); await sw.tap(); await settle(p, 500);
  ok('touch: tapping a switch toggles it', (await sw.getAttribute('aria-checked')) !== before);
  await p.goto(U('navigation')); await settle(p, 700);
  const t2 = p.locator('.docs__page .sg-tabbar__bar .sg-tabbar__item').nth(2); await t2.scrollIntoViewIfNeeded(); await t2.tap(); await settle(p, 700);
  ok('touch: tapping a tab selects it', (await t2.getAttribute('aria-selected')) === 'true');
  await p.goto(U('overlays')); await settle(p, 700);
  const dir = p.getByRole('button', { name: '길찾기' }); await dir.scrollIntoViewIfNeeded(); await dir.tap(); await settle(p, 600);
  const menuOpen = await p.locator('.sg-menu').count();
  await p.locator('.sg-menu__item').nth(1).tap(); await settle(p, 500);
  ok('touch: a menu opens on tap and closes when an item is tapped', menuOpen === 1 && (await p.locator('.sg-menu').count()) === 0);
  if (engine === 'chromium') {
    /* a real touch long-press (CDP): the context menu opens, and the click that follows the lift does not fire */
    const ph = p.getByRole('button', { name: '노을 사진' }); await ph.scrollIntoViewIfNeeded(); const r = await ph.boundingBox();
    const cdp = await p.context().newCDPSession(p);
    const pt = [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await p.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(p, 500);
    ok('touch: long-press opens the context menu', (await p.locator('.sg-menu').count()) === 1 && (await p.locator('.sg-lift').count()) === 1);
    await p.keyboard.press('Escape'); await settle(p, 400);
    /* swipe a sheet down with a finger */
    await p.getByRole('button', { name: '장소 편집' }).tap(); await settle(p, 800);
    const g = await p.locator('.sg-sheet__grabber').boundingBox();
    const x = g.x + g.width / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: g.y + 8 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: g.y + 8 + i * 50 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(p, 700);
    ok('touch: swiping the sheet down dismisses it', (await p.locator('.sg-sheet').count()) === 0);
  }
  await p.context().close();
}

/* ================================================================ keyboard only */
{
  const p = await newPage();
  await p.goto(U('inputs')); await settle(p, 700);
  await p.locator('.docs__page h1').click();
  const seen = new Map();
  /* Safari's default: Tab skips buttons, Option+Tab reaches everything */
  const TAB = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press(TAB);
    const info = await p.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const host = e.closest('.sg-field__control') ?? e;
      const hs = getComputedStyle(host);
      /* the mark may sit on the part that shows the value: the slider's thumb */
      const part = e.querySelector(':scope > .sg-slider__thumb, :scope .sg-slider__thumb'), ps = part ? getComputedStyle(part) : null;
      const outlined = (x) => x && x.outlineStyle !== 'none' && parseFloat(x.outlineWidth) > 0;
      const ring = outlined(cs) || outlined(ps) || outlined(hs) || cs.boxShadow !== 'none' || hs.boxShadow !== 'none';
      return { kind: e.getAttribute('role') || e.tagName.toLowerCase(), cls: (e.className || '').toString().split(' ')[0], ring, inPage: !!e.closest('.docs__page') };
    });
    if (info?.inPage) seen.set(`${info.kind}/${info.cls}`, info.ring);
  }
  const missing = [...seen].filter(([, r]) => !r).map(([k]) => k);
  ok('keyboard: Tab reaches the page controls and each shows a focus ring', seen.size >= 6 && missing.length === 0, `kinds ${[...seen.keys()].join(', ')}${missing.length ? ' · no ring: ' + missing.join(', ') : ''}`);
  const sw = p.locator('.docs__page .sg-switch').first(); await sw.focus(); const s0 = await sw.getAttribute('aria-checked');
  await p.keyboard.press('Space'); await settle(p, 300); const s1 = await sw.getAttribute('aria-checked');
  await p.keyboard.press('Enter'); await settle(p, 300); const s2 = await sw.getAttribute('aria-checked');
  ok('keyboard: Space and Enter toggle a switch', s1 !== s0 && s2 === s0);
  await p.context().close();
}

/* ================================================================ classic scrollbars: nothing jumps when the page lock comes and goes */
{
  /* headless browsers hide scrollbars by default; a visible 15 px scrollbar is what exposes the jump */
  const sb = await pw[engine].launch(engine === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {});
  const p = await sb.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(U('overlays')); await p.waitForTimeout(700);
  const width = await p.evaluate(() => innerWidth - document.documentElement.clientWidth);
  if (!width) console.log(`SKIP classic scrollbars: ${engine} headless shows no scrollbar here`);
  else {
    /* centre of the panel in every frame while it closes */
    /* [centre while open, …centres in every frame while it closes] */
    const closing = (sel) => p.evaluate((sel) => new Promise((res) => {
      const o = document.querySelector(sel).getBoundingClientRect();
      const out = [o.left + o.width / 2]; const t0 = performance.now();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const f = () => { const el = document.querySelector(sel); if (el && +getComputedStyle(el).opacity > 0.02) { const r = el.getBoundingClientRect(); out.push(r.left + r.width / 2); } if (performance.now() - t0 < 500) requestAnimationFrame(f); else res(out); };
      requestAnimationFrame(f);
    }), sel);
    const pageX = () => p.evaluate(() => document.querySelector('.docs__page h1, .docs__page header').getBoundingClientRect().left);
    for (const [name, open, sel] of [
      ['sheet (dialog on wide screens)', () => p.getByRole('button', { name: '장소 편집' }).click(), '.sg-sheet'],
      ['dialog', () => p.getByRole('button', { name: '장소 삭제…' }).click(), '[role=alertdialog]'],
    ]) {
      const x0 = await pageX();
      await open(); await p.waitForTimeout(800);
      const x1 = await pageX();
      const xs = await closing(sel); await p.waitForTimeout(500);
      const spread = Math.max(...xs.map((x) => Math.abs(x - xs[0])));
      ok(`classic ${width} px scrollbar — ${name}: the page behind does not shift when it opens, and the panel does not slide sideways while it closes`, Math.abs(x1 - x0) < 0.5 && xs.length >= 4 && spread < 0.5, `page ${x0.toFixed(1)} → ${x1.toFixed(1)}, panel centre moves up to ${spread.toFixed(1)} px from where it was open (${xs.length - 1} frames)`);
    }
    await p.goto(U('display')); await p.waitForTimeout(700);
    await p.locator('[data-demo=media] button').nth(0).scrollIntoViewIfNeeded(); await p.locator('[data-demo=media] button').nth(0).click(); await p.waitForTimeout(800);
    const cx = await p.evaluate(() => new Promise((res) => { const out = [document.querySelector('.sg-media__stage').getBoundingClientRect().width]; const t0 = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const f = () => { const s = document.querySelector('.sg-media__stage'); if (s) out.push(s.getBoundingClientRect().width); if (performance.now() - t0 < 400) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
    ok(`classic scrollbar — media viewer: its stage keeps its width while it closes`, new Set(cx.map((w) => Math.round(w))).size <= 1, [...new Set(cx.map((w) => Math.round(w)))].join(', '));
    ok('classic scrollbar: afterwards the page scrolls again and its scrollbar is back', await p.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden' && innerWidth - document.documentElement.clientWidth > 0));
  }
  await sb.close();
}

/* ================================================================ 320 px reflow (≈ 400 % zoom) */
{
  const p = await newPage({ viewport: { width: 320, height: 640 } });
  const wide = [];
  for (const id of ['overview', 'material', 'colors', 'type', 'motion', 'buttons', 'inputs', 'selection', 'navigation', 'lists', 'feedback', 'overlays', 'display', 'table', 'charts', 'showcase', 'dashboard', 'evaluation', 'lab']) {
    await p.goto(U(id)); await settle(p, 450);
    const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (o > 1) wide.push(`${id} +${o}`);
  }
  ok('320 px wide (400 % zoom): no page scrolls sideways', wide.length === 0, wide.join(', '));
  await p.context().close();
}

/* ================================================================ many open/close cycles leave nothing behind */
{
  const p = await newPage();
  await p.goto(U('overlays')); await settle(p, 600);
  const base = await portals(p);
  for (let i = 0; i < 12; i++) { await p.getByRole('button', { name: '길찾기' }).click(); await p.waitForTimeout(60); await p.keyboard.press('Escape'); await p.waitForTimeout(60); }
  for (let i = 0; i < 6; i++) { await p.getByRole('button', { name: '장소 편집' }).click(); await p.waitForTimeout(120); await p.keyboard.press('Escape'); await p.waitForTimeout(120); }
  for (let i = 0; i < 6; i++) { await p.getByRole('button', { name: '장소 삭제…' }).click(); await p.waitForTimeout(80); await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
  await settle(p, 900);
  const after = { portals: await portals(p), locked: await bodyLocked(p), menus: await p.locator('.sg-menu, .sg-sheet, [role=alertdialog]').count() };
  ok('48 open/close cycles (menu, sheet, dialog) leave no overlay, portal or scroll lock behind', after.portals === base && !after.locked && after.menus === 0, JSON.stringify({ ...after, base }));
  const btn = p.getByRole('button', { name: '길찾기' }); await btn.click(); await settle(p, 500);
  ok('…and everything still works afterwards', (await p.locator('.sg-menu').count()) === 1);
  await p.keyboard.press('Escape');
  await p.context().close();
}

/* ================================================================ axe accessibility scan */
{
  const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const found = new Map();
  for (const q of ['', '?mode=dark&hc=1']) {
    const p = await newPage();
    for (const id of ['overview', 'buttons', 'inputs', 'selection', 'navigation', 'lists', 'feedback', 'overlays', 'display', 'table', 'charts', 'showcase', 'dashboard', 'evaluation', 'lab']) {
      await p.goto(U(id, q)); await settle(p, 500);
      /* let entrance animations (fades) finish first — half-faded text would read as low contrast; endless ones
         (spinners, shimmer) are left running */
      await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]));
      await p.addScriptTag({ content: axe });
      const v = await p.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: true } } });
        return r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => ({ id: x.id, n: x.nodes.length, ex: x.nodes[0]?.target?.join(' ') }));
      });
      for (const x of v) found.set(`${x.id} (${id}${q ? ' ' + q : ''})`, `${x.n}× e.g. ${x.ex}`);
    }
    await p.context().close();
  }
  ok('axe: no serious or critical accessibility violations', found.size === 0, [...found].slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(' | '));
}

/* ---------------------------------------------------------------- a panel in a scroll area is clipped like its anchor */
{
  const q = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  await q.goto('http://localhost:4173/?mode=light#/showcase'); await q.waitForTimeout(800);
  await q.evaluate(() => document.querySelector('.phone').scrollIntoView({ block: 'center' }));
  const scr = q.locator('.phone__screen');
  await scr.evaluate((e) => { e.scrollTop = e.scrollHeight; }); await q.waitForTimeout(300);
  await q.getByRole('button', { name: '하늘 호수 정보' }).click(); await q.waitForTimeout(600);
  const look = () => q.evaluate(() => {
    const sr = document.querySelector('.phone__screen').getBoundingClientRect(), pop = document.querySelector('.sg-portal .sg-popover');
    const r = pop.getBoundingClientRect(), cs = getComputedStyle(pop), v = (/inset\(([^)]*)\)/.exec(cs.clipPath)?.[1] ?? '0px').split(/\s+/).map(parseFloat);
    const top = r.top + v[0], bottom = r.bottom - (v[2] ?? v[0]);
    return { hidden: cs.visibility === 'hidden', top, bottom, sTop: sr.top, sBottom: sr.bottom, inside: cs.visibility === 'hidden' || (top >= sr.top - 1 && bottom <= sr.bottom + 1) };
  });
  const seen = [];
  for (const f of [0.66, 0.33, 0]) { await scr.evaluate((e, f) => { e.scrollTop = (e.scrollHeight - e.clientHeight) * f; }, f); await q.waitForTimeout(150); seen.push(await look()); }
  ok('a popover in a scrolling phone screen goes under its edge, never out of the frame', seen.every((x) => x.inside) && seen.some((x) => !x.hidden && x.bottom < x.sBottom + 1 && x.bottom > x.sBottom - 200), JSON.stringify(seen.map((x) => [Math.round(x.top), Math.round(x.bottom), x.hidden])));
  ok('…and is hidden (no invisible clicks) once it is all out of view', seen.at(-1).hidden, JSON.stringify(seen.at(-1)));
  await scr.evaluate((e) => { e.scrollTop = e.scrollHeight; }); await q.waitForTimeout(200);
  const back = await look();
  ok('…and comes back whole when its anchor scrolls back', !back.hidden && back.inside, JSON.stringify(back));
  await q.close();
}
ok('no page errors during the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
