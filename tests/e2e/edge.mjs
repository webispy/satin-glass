// Edge cases a user can produce: rapid repeats, changes mid-animation, navigation mid-gesture, bounds, disabled
// and refused (controlled) states, long text, touch, keyboard-only use, 320 px reflow, leftovers after many
// open/close cycles. Uses the docs "lab" page plus the regular pages. The axe scan is axe.mjs.
// usage: node tests/e2e/edge.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173 or E2E_PORT)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { PAGES } from './pages.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id, q = '') => `${pw.ORIGIN}/${q}#/${id}`;
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

  /* a drag still held when the page changes, and the pointer moves on while the next page loads: the next page's
     module is held back until the hand has let go, so the moves fall while the docs show the loading page and the
     old page is hidden (its layout effects cleaned up, not yet its passive ones). A drag torn down in a passive
     effect read its component's state after the layout cleanup had cleared it (a page error every run). Each case
     takes a page module this run has not loaded yet, so the loading page shows */
  /* hold a page module back; `open()` lets it through and says whether it was asked for (the case proves nothing if
     the loading page came from anything else). Idempotent, so a case can call it again in `finally` */
  const holdModule = async (chunk) => {
    let release, passed, asked = false, opened = false; const held = new Promise((res) => { release = res; }), through = new Promise((res) => { passed = res; });
    await p.route(chunk, async (route) => { asked = true; await held; await route.continue().catch(() => {}); passed(); });
    /* a module that was never asked for must not hang the suite */
    return async () => { if (!opened) { opened = true; release(); if (asked) await Promise.race([through, p.waitForTimeout(5000)]); await p.unroute(chunk); } return asked; };
  };
  const toLoading = async (hash) => {
    await p.evaluate((h) => { location.hash = h; }, hash);
    return p.waitForFunction(() => !!document.querySelector('main .docs__page:empty'), null, { timeout: 3000 }).then(() => true, () => false);
  };
  /* the drag must have taken hold before the page changes, or the case proves nothing */
  const grab = async (locate, fx, holdClass) => {
    const el = p.locator(locate).first(); await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox();
    const [x0, x1, x2] = fx.map((f) => r.x + r.width * f), y = r.y + r.height / 2;
    await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x1, y, { steps: 4 });
    const held = await el.evaluate((e, c) => e.classList.contains(c), holdClass);
    return { el, x2, y, held };
  };
  const midDrag = async (name, locate, fx, holdClass, hash, chunk) => {
    await p.goto(U('inputs')); await settle(p, 600);
    const e0 = errors.length, open = await holdModule(chunk);
    let held, loading, asked;
    try {
      const g = await grab(locate, fx, holdClass); held = g.held;
      loading = await toLoading(hash);
      await p.mouse.move(g.x2, g.y, { steps: 3 }); await p.mouse.move(g.x2, g.y + 40, { steps: 2 }); await p.mouse.up(); await settle(p, 200);
    } finally { asked = await open(); }
    await settle(p, 400);
    ok(`${name}: navigating away mid-drag, moving and releasing while the next page loads → no errors`, held && loading && asked && errors.length === e0,
      !held ? 'the drag never took hold' : !(loading && asked) ? `the page module was not held back (loading page ${loading}, asked ${asked})` : errors.slice(e0).join(' | '));
  };
  await midDrag('switch', '.docs__page .sg-switch', [0.25, 0.7, 1.4], 'is-dragging', '#/charts', /\/assets\/charts-[\w-]+\.js/);
  await midDrag('slider', '.docs__page .sg-slider', [0.3, 0.5, 0.7], 'is-active', '#/table', /\/assets\/table-[\w-]+\.js/);

  /* hidden mid-drag and shown again (the hand comes back before the next page has loaded): the drag ended with the
     hiding, so nothing of it is left on the control, and the next key works */
  const hiddenMidDrag = async (name, route, locate, fx, holdClass, hash, chunk, after) => {
    await p.goto(U(route)); await settle(p, 600);
    const e0 = errors.length, open = await holdModule(chunk);
    let held, loading, left, asked;
    try {
      const before = await after.read();
      const g = await grab(locate, fx, holdClass); held = g.held;
      loading = await toLoading(hash);
      await p.mouse.move(0, 0, { steps: 2 }); await p.mouse.up();
      await p.evaluate((h) => { location.hash = h; }, `#/${route}`);
      await g.el.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}); await settle(p, 300);
      left = await after.check(g.el, before);
    } finally { asked = await open(); }
    await settle(p, 300);
    ok(`${name}: hidden mid-drag and shown again → nothing of the drag left`, held && loading && asked && left.ok && errors.length === e0,
      !held ? 'the drag never took hold' : !(loading && asked) ? `the page module was not held back (loading page ${loading}, asked ${asked})` : JSON.stringify(left) + errors.slice(e0).join(' | '));
  };
  await hiddenMidDrag('switch', 'inputs', '.docs__page .sg-switch', [0.25, 0.7], 'is-dragging', '#/dashboard', /\/assets\/dashboard-[\w-]+\.js/, {
    read: () => p.locator('.docs__page .sg-switch').first().getAttribute('aria-checked'),
    check: async (el, before) => {
      const look = await el.evaluate((e) => ({ pressed: e.classList.contains('is-pressed'), dragging: e.classList.contains('is-dragging'), drag: e.dataset.drag ?? null, checked: e.getAttribute('aria-checked') }));
      await el.focus(); await p.keyboard.press('Space'); await settle(p, 300);
      const toggled = await el.getAttribute('aria-checked');
      await p.keyboard.press('Space'); await settle(p, 300);
      return { ...look, toggled, ok: !look.pressed && !look.dragging && look.drag === null && look.checked === before && toggled !== before };
    },
  });
  await hiddenMidDrag('slider', 'inputs', '.docs__page .sg-slider', [0.3, 0.5], 'is-active', '#/evaluation', /\/assets\/evaluation-[\w-]+\.js/, {
    read: async () => null,
    check: async (el) => { const active = await el.evaluate((e) => e.classList.contains('is-active')); return { active, ok: !active }; },
  });
  /* PageControl's scrub picks the dot nearest the pointer: hidden, every dot measured at 0 and the page went to the
     first */
  {
    await p.goto(U('navigation')); await settle(p, 600);
    const pc = p.locator('.docs__page .sg-pagecontrol').first(); await pc.scrollIntoViewIfNeeded();
    const dots = pc.locator('.sg-pagecontrol__dot');
    const current = () => dots.evaluateAll((l) => l.findIndex((d) => d.getAttribute('aria-current') === 'true'));
    await dots.nth(3).click(); await settle(p, 300);
    const e0 = errors.length, open = await holdModule(/\/assets\/a2ui-[\w-]+\.js/);
    let scrubbed, loading, after, asked;
    try {
      /* scrub from the fourth dot to the third and wait for it to take. Under load in Firefox the page could still shift
         after the dots were measured, and the press missed the control: let go, measure again and try once more */
      let d2;
      for (let attempt = 0; attempt < 2; attempt++) {
        await pc.scrollIntoViewIfNeeded(); await settle(p, 200);
        const d3 = await dots.nth(3).boundingBox(); d2 = await dots.nth(2).boundingBox();
        await p.mouse.move(d3.x + d3.width / 2, d3.y + d3.height / 2); await p.mouse.down();
        await p.mouse.move(d2.x + d2.width / 2, d2.y + d2.height / 2, { steps: 6 });
        const took = await p.waitForFunction(() => document.querySelectorAll('.docs__page .sg-pagecontrol')[0]?.querySelectorAll('.sg-pagecontrol__dot')[2]?.getAttribute('aria-current') === 'true', null, { timeout: 2000 }).then(() => true, () => false);
        if (took) break;
        await p.mouse.up(); await dots.nth(3).click(); await settle(p, 300);
      }
      scrubbed = await current();
      loading = await toLoading('#/a2ui');
      await p.mouse.move(d2.x + 200, d2.y, { steps: 4 }); await p.mouse.up();
      await p.evaluate(() => { location.hash = '#/navigation'; });
      await pc.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}); await settle(p, 300);
      after = await current();
    } finally { asked = await open(); }
    await settle(p, 300);
    ok('page control: hidden mid-scrub and shown again → the page stays where the scrub left it', scrubbed === 2 && loading && asked && after === 2 && errors.length === e0,
      JSON.stringify({ scrubbed, loading, asked, after }));
  }
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
  const plus = bnd.getByRole('button', { name: '경계 스테퍼 늘리기' }), minus = bnd.getByRole('button', { name: '경계 스테퍼 줄이기' });
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
    const gap = () => p.evaluate(() => { const l = document.querySelector('.sg-listbox').getBoundingClientRect(), a = document.querySelector('[data-lab="inner-scroll"] [role=combobox]').getBoundingClientRect(); return +(l.top - a.top).toFixed(1); });
    const g0 = await gap();
    /* the wheel goes to whatever is under the pointer: put it on a corner of the area the open list does not cover
       (its middle may be under the list, depending on fonts and layout) */
    const ab = await area.boundingBox(), lb = await p.locator('.sg-listbox').boundingBox();
    const inList = (x, y) => lb && x >= lb.x && x <= lb.x + lb.width && y >= lb.y && y <= lb.y + lb.height;
    const spot = [[ab.x + 6, ab.y + 6], [ab.x + ab.width - 6, ab.y + 6], [ab.x + 6, ab.y + ab.height - 6], [ab.x + ab.width - 6, ab.y + ab.height - 6]].find(([x, y]) => !inList(x, y)) ?? [ab.x + 6, ab.y + 6];
    await p.mouse.move(spot[0], spot[1]); await p.mouse.wheel(0, 60); await settle(p, 300);
    const moved = await area.evaluate((e) => e.scrollTop), g1 = await gap(), still = (await p.getByRole('listbox').count()) === 1;
    /* within a pixel: the two are placed on whole pixels each, and a scroll by a fraction can round them apart by one
       (WebKit on a CI runner, -139 → -140 rounded, #113) */
    ok('inner scroll area: scrolling it keeps the select open and its list glued to the field', still && moved > 40 && Math.abs(g0 - g1) <= 1, `scrollTop ${moved}, gap ${g0} → ${g1}`);
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

/* ================================================================ edge panels turned round mid-motion (#106) */
/* On a phone, a sheet, a drawer or an action sheet re-opened while its exit still moves it out turns round from
   where it is, the same element, and ends open on screen and opaque: the exit held its end state, so once the
   entrance let go the open panel sat offscreen again (or transparent, after reduced motion's fade). Closed
   mid-entrance, the exit leaves from where the panel is, without first jumping back to fully open. Each case waits
   for the motion to be part way, frame by frame, and acts in the same task as it samples. */
for (const reduced of [false, true]) {
  const p = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await p.goto(U('overlays')); await settle(p, 700);
  const tag = reduced ? ' (reduced motion)' : '';
  for (const [name, opener, panelSel] of [['sheet', '장소 편집', '.sg-sheet'], ['action sheet', '공유 옵션…', '.sg-actionsheet'], ['drawer', '필터 열기', '.sg-drawer']]) {
    await p.locator('.docs__page button', { hasText: opener }).first().scrollIntoViewIfNeeded();
    /* in the page: the opener (clicked from the page, as the scrim covers it while open), a frame, the panel's box */
    const page = `const btn = () => [...document.querySelectorAll('.docs__page button')].find((x) => x.textContent.trim() === ${JSON.stringify(opener)});
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const panel = () => document.querySelector(${JSON.stringify(panelSel)});
      const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, opacity: +getComputedStyle(el).opacity, transform: getComputedStyle(el).transform, inline: el.style.transform }; };
      const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`;
    const run = (body) => p.evaluate(`(async () => { ${page} ${body} })()`);
    await run('btn().click();'); await settle(p, 900);
    const rest = await run('return box(panel());');
    const away = (a) => Math.abs(a.top - rest.top) + Math.abs(a.left - rest.left);

    /* re-opened mid-exit: part way out (60 px, or below 0.7 opacity), then the opener */
    const turn = await run(`const el = panel(), r0 = box(el); esc();
      let at = null;
      for (let i = 0; i < 90 && !at; i++) { await frame(); const b = box(el); if (${reduced} ? b.opacity < 0.7 : Math.abs(b.top - r0.top) + Math.abs(b.left - r0.left) > 60) at = b; }
      btn().click(); const path = [];
      for (let i = 0; i < 10; i++) { await frame(); path.push(box(el)); }
      return { at, path, same: panel() === el };`);
    await settle(p, 1200);
    const back = await run('return box(panel());');
    /* the ten frames after the click: it turns round from where it was. Never back offscreen (WebKit's box can trail
       by a frame, and the spring starts from rest), not at rest at once, and nearer rest by the tenth */
    const first = turn.path?.[0], last = turn.path?.at(-1);
    const handoff = turn.at && turn.same && (reduced
      ? first.opacity >= turn.at.opacity - 0.05 && first.opacity < turn.at.opacity + 0.35 && last.opacity > first.opacity
      : Math.max(...turn.path.map(away)) <= away(turn.at) * 1.3 + 2 && away(first) >= away(turn.at) * 0.3 && away(last) < away(turn.at));
    const rests = Math.abs(back.top - rest.top) <= 1 && Math.abs(back.left - rest.left) <= 1 && back.opacity === 1 && back.transform === 'none' && !back.inline;
    ok(`${name}: re-opened mid-exit it turns round from where it is and ends open${tag}`, handoff && rests,
      JSON.stringify({ at: turn.at && (reduced ? turn.at.opacity : away(turn.at)), path: turn.path?.map((b) => +(reduced ? b.opacity : away(b)).toFixed(2)), same: turn.same, back }));
    await p.keyboard.press('Escape'); await settle(p, 900);
    if (reduced) {
      /* closed mid-fade-in: the fade out goes on from the opacity it had reached, not from full */
      /* the fade is 140 ms: a loaded machine can draw it in two frames, so any frame part way will do, and the open
         and close are tried again if none came */
      let fadeCut = null;
      for (let tries = 0; tries < 4 && !fadeCut?.at; tries++) {
        if (fadeCut) await settle(p, 900);
        fadeCut = await run(`btn().click(); let at = null;
          for (let i = 0; i < 60 && !at; i++) { await frame(); const o = +getComputedStyle(panel()).opacity; if (o > 0.02 && o < 0.97) at = o; }
          const el = panel(); esc(); await frame();
          return { at, l0: +getComputedStyle(el).opacity, same: panel() === el };`);
      }
      ok(`${name}: closed mid-fade-in it fades out from where it was${tag}`, fadeCut.at !== null && fadeCut.same && fadeCut.l0 <= fadeCut.at + 0.05 && fadeCut.l0 >= fadeCut.at - 0.35, JSON.stringify(fadeCut));
      await settle(p, 900);
      /* swiped away with reduced motion (the sheet still takes the swipe): it fades where it was let go, not back
         at rest under the finger */
      if (name !== 'sheet') continue;
      await run('btn().click();'); await settle(p, 900);
      const g = await p.locator('.sg-sheet__grabber').boundingBox();
      const x0 = g.x + g.width / 2, y0 = g.y + 8;
      await p.mouse.move(x0, y0); await p.mouse.down();
      for (let i = 1; i <= 8; i++) { await p.mouse.move(x0, y0 + i * 40); await p.waitForTimeout(16); }
      await p.mouse.up();
      /* frame by frame until the fade has begun (the release reaches the exit through a render and an effect, a frame
         or two later on a slow runner): it begins where it was let go, and no frame before it is back near rest */
      const fading = await run(`const seen = [];
        for (let i = 0; i < 20; i++) { await frame(); const el = panel(); if (!el) break; const b = box(el); seen.push(b); if (b.opacity < 1) break; }
        return seen;`);
      const fadeAt = fading.find((b) => b.opacity < 1), before = fading.slice(0, fading.indexOf(fadeAt));
      ok('sheet: swiped away with reduced motion, it fades where it was let go', fadeAt && away(fadeAt) > 200 && before.every((b) => away(b) > 50),
        JSON.stringify({ frames: fading.length, away: fadeAt && away(fadeAt), opacity: fadeAt?.opacity, before: before.map((b) => Math.round(away(b))) }));
      await settle(p, 900);
      continue;
    }

    /* closed mid-entrance: the exit's first frame is no nearer rest than the entrance had come, give or take the
       frame it moved meanwhile (WebKit's box can trail the animation's value by one) */
    const cut = await run(`btn().click(); for (let i = 0; i < 3; i++) await frame();
      const el = panel(), e1 = box(el); await frame(); const e2 = box(el);
      esc(); await frame();
      return { e1, e2, l0: panel() && box(panel()), same: panel() === el };`);
    const step = Math.abs(away(cut.e1) - away(cut.e2));
    ok(`${name}: closed mid-entrance it leaves from where it is`, cut.same && cut.l0 && away(cut.e2) > 40 && Math.abs(away(cut.l0) - away(cut.e2)) <= 1.5 * step + 2,
      JSON.stringify({ entering: [away(cut.e1), away(cut.e2)], leaving: cut.l0 && away(cut.l0) }));
    await settle(p, 900);

    /* swiped away (a mouse drag: the sheet by its grabber, the drawer sideways) and re-opened as it leaves: the
       drag's last transform, left inline for the exit to start from, does not hold the panel part way */
    const grab = name === 'sheet' ? '.sg-sheet__grabber' : name === 'drawer' ? '.sg-drawer__header' : null;
    if (!grab) continue;
    await run('btn().click();'); await settle(p, 900);
    await run('panel().dataset.probe = "1";');
    const g = await p.locator(grab).boundingBox();
    const x0 = g.x + g.width / 2, y0 = g.y + Math.min(8, g.height / 2);
    await p.mouse.move(x0, y0); await p.mouse.down();
    /* within the viewport: Playwright's Firefox reports a pointer moved past it at the wrong place */
    for (let i = 1; i <= 8; i++) { await p.mouse.move(name === 'sheet' ? x0 : x0 + i * 20, name === 'sheet' ? y0 + i * 40 : y0); await p.waitForTimeout(16); }
    await p.mouse.up();
    const going = await run('await frame(); const b = box(panel()); btn().click(); return b;');
    await settle(p, 1200);
    const swiped = await run('return { ...box(panel()), probe: panel().dataset.probe };');
    ok(`${name}: swiped away and re-opened as it leaves, it ends open where it rests`,
      away(going) > 100 && swiped.probe === '1' && Math.abs(swiped.top - rest.top) <= 1 && Math.abs(swiped.left - rest.left) <= 1 && swiped.transform === 'none' && !swiped.inline,
      JSON.stringify({ going: away(going), swiped }));
    await p.keyboard.press('Escape'); await settle(p, 900);
  }
  await p.context().close();
}

/* a sheet closed wide (folding into its bloom) and re-opened on a phone before that ends: the bloom is not left
   holding the panel transparent (#106) */
{
  const p = await newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(U('overlays')); await settle(p, 700);
  const opener = p.locator('.docs__page button', { hasText: '장소 편집' }).first();
  await opener.scrollIntoViewIfNeeded(); await opener.click(); await settle(p, 900);
  await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await p.waitForTimeout(40);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => [...document.querySelectorAll('.docs__page button')].find((x) => x.textContent.trim() === '장소 편집').click());
  await settle(p, 1200);
  const s = await p.evaluate(() => { const el = document.querySelector('.sg-sheet'); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { top: Math.round(r.top), bottom: Math.round(r.bottom), opacity: +cs.opacity, transform: cs.transform }; });
  ok('sheet: closed wide and re-opened on a phone mid-fold, it ends open and opaque', s && s.opacity === 1 && s.transform === 'none' && s.bottom <= 844 && s.top > 0, JSON.stringify(s));
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
  for (const id of PAGES) {
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

/* the axe scan is a suite of its own (axe.mjs), so it can run in English too */

/* ---------------------------------------------------------------- a panel in a scroll area is clipped like its anchor */
{
  const q = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  await q.goto(`${pw.ORIGIN}/?mode=light#/showcase`); await q.waitForTimeout(800);
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
/* ---------------------------------------------------------------- no width of their own: a divider and a slider fill a
   column that centres its items, and a slider beside a label in a row takes the rest of it, not 0 px */
{
  const p = await newPage();
  await p.goto(U('lab')); await settle(p, 600);
  const m = await p.evaluate(() => {
    const w = (e) => e.getBoundingClientRect().width;
    const col = document.querySelector('[data-lab="fill-column"]'), row = document.querySelector('[data-lab="fill-row"]');
    const label = row.querySelector('.sg-text, p, span');
    return { col: w(col), divider: w(col.querySelector('.sg-divider')), slider: w(col.querySelector('.sg-slider')),
      row: w(row), label: w(row.firstElementChild), gap: parseFloat(getComputedStyle(row).columnGap) || 0, rowSlider: w(row.querySelector('.sg-slider')),
      /* given 16 px margins, each takes the width left after them and stays inside the column */
      inset: [...col.querySelectorAll('[data-lab="fill-inset"]')].map((e) => { const r = e.getBoundingClientRect(), c = col.getBoundingClientRect(); return [+(r.left - c.left).toFixed(1), +(c.right - r.right).toFixed(1)]; }) };
  });
  ok('a divider and a slider in a centred column span it', Math.abs(m.divider - m.col) < 0.5 && Math.abs(m.slider - m.col) < 0.5, JSON.stringify(m));
  ok('a divider and a slider with 16 px margins in a centred column span it inside their margins', m.inset.length === 2 && m.inset.every(([l, r]) => Math.abs(l - 16) < 0.5 && Math.abs(r - 16) < 0.5), JSON.stringify(m.inset));
  ok('a slider beside a label in a row takes the rest of the row', Math.abs(m.rowSlider - (m.row - m.label - m.gap)) < 0.5 && m.rowSlider >= 120, JSON.stringify(m));
  await p.close();
}
ok('no page errors during the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
