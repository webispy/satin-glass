// Selection & input components in a real browser: checkbox, radio, choice list, select, calendar, date picker.
// usage: node tests/e2e/selection.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173; Q for settings)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost') && !/https?:\/\/(?!localhost)/.test(m.text())) errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`http://localhost:4173/${Q}#/${id}`); await p.waitForTimeout(600); };
/* record a reading every frame in the page while `act` runs */
const frames = (act, read, ms = 450) => p.evaluate(({ act, read, ms }) => new Promise((res) => {
  const a = new Function(`return (${act})`)(), r = new Function(`return (${read})`)();
  const out = []; const t0 = performance.now(); a();
  const f = () => { out.push(r()); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), { act, read, ms });
const between = (xs, a, z) => xs.filter((x) => Math.abs(x - a) > 0.01 && Math.abs(x - z) > 0.01).length;
const reduced = /rm=1/.test(Q);
const page = p.locator('.docs__page');

await go('selection');
/* ---------------- checkbox */
{
  const c = p.getByRole('checkbox', { name: '마케팅 수신 (선택)' });
  const tick = await frames(`() => document.querySelectorAll('.gl-check__input')[6].click()`, `() => parseFloat(getComputedStyle(document.querySelectorAll('.gl-check__tick')[6]).strokeDashoffset)`);
  const now = await c.isChecked();
  ok('checkbox: click toggles; the tick is drawn over several frames', !now && (reduced || between(tick, 0, 20) >= 2), `checked ${now}, drawing frames ${between(tick, 0, 20)}`);
  await c.focus(); await p.keyboard.press('Space');
  ok('checkbox: Space toggles', await c.isChecked());
  const parent = p.getByRole('checkbox', { name: '편의시설 모두' });
  const ind0 = await parent.evaluate((e) => e.indeterminate);
  await parent.click(); await p.waitForTimeout(200);
  const allChecked = await p.locator('.gl-check__input').evaluateAll((xs) => xs.slice(1, 5).every((x) => x.checked));
  await p.getByRole('checkbox', { name: '화장실' }).click();
  const ind1 = await parent.evaluate((e) => e.indeterminate);
  ok('checkbox: "all" shows mixed, checks every child, and goes mixed again when one is cleared', ind0 && allChecked && ind1, `${ind0} → all ${allChecked} → ${ind1}`);
}
/* ---------------- radio */
{
  const bike = p.getByRole('radio', { name: '자전거' });
  const dot = await frames(`() => document.querySelectorAll('.gl-check--radio .gl-check__input')[1].click()`, `() => new DOMMatrix(getComputedStyle(document.querySelectorAll('.gl-check--radio .gl-check__dot')[1]).transform).a`);
  ok('radio: click selects; the dot grows over several frames', await bike.isChecked() && (reduced || between(dot, 0, 1) >= 2), `growing frames ${between(dot, 0, 1)}`);
  await bike.focus(); await p.keyboard.press('ArrowDown');
  ok('radio: ↓ moves to and selects the next (native radio group)', await p.getByRole('radio', { name: '자동차' }).isChecked());
  await p.keyboard.press('ArrowDown');
  ok('radio: a disabled radio is skipped by the arrows', !(await p.getByRole('radio', { name: '배 (운항 중단)' }).isChecked()));
}
/* ---------------- choice list */
{
  const dark = page.getByRole('radio', { name: '다크' });
  await dark.click(); await p.waitForTimeout(400);
  ok('choice list: clicking a row chooses it (checkmark shows)', (await dark.getAttribute('aria-checked')) === 'true' && await dark.locator('.gl-choice__check').evaluate((e) => +getComputedStyle(e).opacity > 0.5));
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
  ok('choice list: ↓ moves focus and selection to the next row', (await page.getByRole('radio', { name: /시스템 설정/ }).getAttribute('aria-checked')) === 'true');
  const weather = p.getByRole('checkbox', { name: '날씨 경보' });
  await weather.click(); await weather.press('Space');
  ok('choice list (multiple): click and Space toggle independently', (await weather.getAttribute('aria-checked')) === 'false');
}
/* ---------------- select */
{
  const cb = p.getByRole('combobox', { name: /이동 수단/ });
  await cb.scrollIntoViewIfNeeded();
  /* bloom: sample the panel's scale while a real click opens it */
  await p.evaluate(() => { window.__sc = []; window.__rec = true; const f = () => { const l = document.querySelector('.gl-listbox'); if (l) window.__sc.push(new DOMMatrix(getComputedStyle(l).transform).d); if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await cb.click(); await p.waitForTimeout(650);
  const sc = await p.evaluate(() => { window.__rec = false; return window.__sc; });
  const lb = p.getByRole('listbox');
  const lr = await lb.boundingBox(), cr = await cb.boundingBox();
  const beside = lr.y >= cr.y + cr.height - 1 || lr.y + lr.height <= cr.y + 1;   /* below, or flipped above near the bottom */
  ok('select: click opens a listbox beside the field, at least as wide, blooming in', (await lb.count()) === 1 && beside && lr.width >= cr.width - 1 && (reduced || sc.some((x) => x > 0.05 && x < 0.95)), `width ${lr.width.toFixed(0)} vs ${cr.width.toFixed(0)}, bloom frames ${sc.filter((x) => x > 0.05 && x < 0.95).length}`);
  await p.getByRole('option', { name: '도보' }).click(); await p.waitForTimeout(450);
  ok('select: clicking an option chooses it, closes, focus stays on the field', (await cb.textContent()).includes('도보') && (await p.getByRole('listbox').count()) === 0 && await cb.evaluate((e) => e === document.activeElement), await cb.textContent());
  /* keyboard from a known state (도보): ↓ opens on it, End → last enabled (자동차; 기차 is disabled), Enter chooses */
  await cb.focus(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250);
  const act0 = await p.evaluate(() => document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))?.textContent);
  await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  ok('select (keyboard): ↓ opens on the current option, End goes to the last enabled one (skips disabled), Enter chooses', act0?.includes('도보') && (await cb.textContent()).includes('자동차'), `${act0} → ${await cb.textContent()}`);
  await cb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('select: Escape closes, focus stays on the field', (await p.getByRole('listbox').count()) === 0 && await cb.evaluate((e) => e === document.activeElement));

  const region = p.getByRole('combobox', { name: /지역/ });
  await region.focus(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250);
  await p.keyboard.press('End'); await p.waitForTimeout(200);
  const vis = await p.evaluate(() => { const lb = document.querySelector('.gl-listbox [data-gl-content]').getBoundingClientRect(); const a = document.querySelector('.gl-option[data-active]').getBoundingClientRect(); return a.top >= lb.top - 1 && a.bottom <= lb.bottom + 1; });
  const groups = await p.locator('.gl-listbox [role=group]').count();
  ok('select: long grouped list scrolls inside the panel; the active option is kept in view', vis && groups === 4, `groups ${groups}`);
  await p.mouse.click(1200, 120); await p.waitForTimeout(300);
  ok('select: a click outside closes it', (await p.getByRole('listbox').count()) === 0);

  const inl = p.getByRole('combobox', { name: '소리' });
  await inl.click(); await p.waitForTimeout(400);
  const ir = await inl.boundingBox(), il = await p.getByRole('listbox').boundingBox();
  ok('select (inline, bottom-end): the panel aligns to the field\'s right edge', Math.abs(il.x + il.width - (ir.x + ir.width)) < 2, `${(il.x + il.width).toFixed(0)} vs ${(ir.x + ir.width).toFixed(0)}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
}
/* ---------------- date picker & calendar */
{
  const dp = p.getByRole('button', { name: /방문 날짜/ });
  await dp.scrollIntoViewIfNeeded(); await dp.click(); await p.waitForTimeout(500);
  const dlg = p.getByRole('dialog');
  const focusDay = () => p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  const f0 = await focusDay();
  ok('date picker: opens a calendar dialog with focus on a day', (await dlg.count()) === 1 && !!f0, f0);
  const disabledPast = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const b = document.querySelector(`.gl-datepicker-panel [data-date="${iso}"]`); return b ? b.getAttribute('aria-disabled') === 'true' : true; });
  ok('date picker: days before min are disabled', disabledPast);
  await p.keyboard.press('ArrowRight'); const f1 = await focusDay();
  const slide = await frames(`() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))`, `() => new DOMMatrix(getComputedStyle(document.querySelector('.gl-datepicker-panel .gl-calendar__body')).transform).e`, 500);
  const f2 = await focusDay();
  ok('date picker: → moves a day; PageDown moves a month and the grid slides in', f1 > f0 && f2.slice(5, 7) !== f1.slice(5, 7) && (reduced || slide.some((x) => Math.abs(x) > 2)), `${f0} → ${f1} → ${f2}, max slide ${Math.max(...slide.map(Math.abs)).toFixed(1)}`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('date picker: Enter chooses, closes, and focus returns to the field', (await dlg.count()) === 0 && await dp.evaluate((e) => e === document.activeElement) && /\d/.test(await dp.textContent()), await dp.textContent());
  await dp.click(); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('date picker: Escape closes and focus returns to the field', (await dlg.count()) === 0 && await dp.evaluate((e) => e === document.activeElement));
  const wk = p.getByRole('button', { name: /주말만/ });
  await wk.click(); await p.waitForTimeout(400);
  const weekdays = await p.locator('.gl-datepicker-panel .gl-day').evaluateAll((bs) => bs.filter((x) => { const d = new Date(x.dataset.date + 'T12:00'); return d.getDay() !== 0 && d.getDay() !== 6; }).every((x) => x.getAttribute('aria-disabled') === 'true'));
  ok('date picker: isDateDisabled disables weekdays', weekdays);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const en = p.getByRole('button', { name: /English/ });
  await en.click(); await p.waitForTimeout(400);
  const head = await p.locator('.gl-datepicker-panel th').allTextContents();
  ok('date picker: locale en-US, Monday first', head[0] === 'M' && (await p.locator('.gl-datepicker-panel .gl-calendar__title').textContent()).match(/[A-Z][a-z]+ \d{4}/) !== null, head.join(''));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
}

/* ---------------- scrolling the page with a picker open: it follows its field; it closes once the field is gone */
{
  /* gap between field and panel (panel below → positive; flipped above → measured from the panel's bottom) */
  const attach = (panelSel, fieldLoc) => p.evaluate(({ panelSel }) => {
    const pr = document.querySelector(panelSel)?.getBoundingClientRect(); return pr ? { top: pr.top, bottom: pr.bottom } : null;
  }, { panelSel }).then(async (pr) => { if (!pr) return null; const f = await fieldLoc.boundingBox(); return Math.min(Math.abs(pr.top - (f.y + f.height)), Math.abs(f.y - pr.bottom)); });
  const check = async (name, open, panelSel, fieldLoc) => {
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    await fieldLoc.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -150)); await p.waitForTimeout(250);
    await open(); await p.waitForTimeout(600);
    const g0 = await attach(panelSel, fieldLoc);
    await p.mouse.move(1150, 500);
    for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(60); }
    await p.waitForTimeout(300);
    const still = (await p.locator(panelSel).count()) === 1, g1 = await attach(panelSel, fieldLoc);
    ok(`${name}: scrolling the page keeps it open, attached to its field`, still && g1 !== null && Math.abs(g1 - g0) < 2 && g1 < 14, `gap ${g0?.toFixed(1)} → ${g1?.toFixed(1)}`);
    /* push the field out of the window — down if the page has room below, otherwise up */
    const need = await fieldLoc.evaluate((e) => { const r = e.getBoundingClientRect(); const room = document.documentElement.scrollHeight - innerHeight - scrollY; return room > r.bottom + 20 ? r.bottom + 20 : -(innerHeight - r.top + 20); });
    /* scroll in 100 px steps that apply at once (Firefox animates wheel scrolling, which would race the check) */
    const steps = Math.ceil(Math.abs(need) / 100);
    for (let i = 0; i < steps; i++) { await p.evaluate((d) => scrollBy({ top: d, behavior: 'instant' }), Math.sign(need) * 100); await p.waitForTimeout(30); }
    await p.waitForTimeout(500);
    const gone = await fieldLoc.evaluate((e) => { const r = e.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; });
    ok(`${name}: once the field has scrolled out of the window, it closes`, gone && (await p.locator(panelSel).count()) === 0, `field out of view ${gone}`);
  };
  await go('selection');
  const dp = p.getByRole('button', { name: /방문 날짜/ });
  await check('date picker', () => dp.click(), '.gl-datepicker-panel', dp);
  const sel = p.getByRole('combobox', { name: /이동 수단/ });
  await check('select', () => sel.click(), '.gl-listbox', sel);
  await go('overlays');
  /* the overlays page is short: a lower window gives it room to scroll its button away */
  await p.setViewportSize({ width: 1280, height: 480 });
  const info = p.locator('.docs__page').getByRole('button', { name: '정보' });
  await check('popover', () => info.click(), '.gl-popover', info);
  /* menus stay short-lived: a scroll closes them */
  const dir = p.locator('.docs__page').getByRole('button', { name: '길찾기' });
  await p.evaluate(() => scrollTo(0, 0)); await dir.scrollIntoViewIfNeeded(); await dir.click(); await p.waitForTimeout(500);
  const way = await p.evaluate(() => (document.documentElement.scrollHeight - innerHeight - scrollY > 60 ? 1 : -1));
  for (let i = 0; i < 3; i++) { await p.evaluate((d) => scrollBy({ top: d, behavior: 'instant' }), way * 40); await p.waitForTimeout(60); }
  await p.waitForTimeout(400);
  ok('menu: a page scroll still closes it (menus are short-lived)', (await p.locator('.gl-menu').count()) === 0);
  await p.setViewportSize({ width: 1280, height: 900 });
}

console.log('page errors:', errs.length ? errs : 'none');
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
