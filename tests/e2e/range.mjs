// Date ranges: RangeCalendar and DateRangePicker on the docs selection page ("기간").
// The calendar: the first pick is the start, the second the end; the status line says what comes next and how long
// the range is; the band previews the range while the end is chosen; an earlier day, a day past a disabled one or
// past maxLength starts over; the start again clears it (minLength 1); the keyboard does the same as the mouse.
// The field: it opens on a day, closes when the end is chosen and submits an ISO 8601 interval; Escape or a click
// outside before then leaves the range as it was; a disabled day cannot be picked.
// Dates come from the page (today, the sold-out days), so the checks hold on any day of the month.
// usage: node tests/e2e/range.mjs   (BROWSER=webkit|firefox; E2E_PORT (default 4173); Q for settings)
// covers: selection
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const wait = (ms) => p.waitForTimeout(ms);

/* yyyy-mm-dd arithmetic, independent of the time of day */
const plus = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const dayIn = (root, iso) => root.locator(`button.sg-day[data-date="${iso}"]:not([data-outside])`);
/* the days of the month on show: date, pickable */
const days = (root) => root.locator('button.sg-day:not([data-outside])').evaluateAll((bs) => bs.map((x) => ({ iso: x.dataset.date, off: x.getAttribute('aria-disabled') === 'true' })));
const pressed = (root) => root.locator('button.sg-day[aria-pressed="true"]').evaluateAll((bs) => bs.map((x) => x.dataset.date));
/* n pickable days in a row in the month on show (the next month if this one has too few left) */
const run = async (root, n) => {
  for (let tries = 0; tries < 2; tries++) {
    const ds = await days(root);
    for (let i = 0; i + n <= ds.length; i++) if (ds.slice(i, i + n).every((d, j) => !d.off && (j === 0 || span(ds[i].iso, d.iso) === j))) return ds[i].iso;
    await root.getByRole('button', { name: '다음 달' }).click(); await wait(500);
  }
  return null;
};

await p.goto(`${pw.ORIGIN}/${Q}#/selection`); await wait(900);

/* ================================================================ RangeCalendar (nights, minLength 1, from today) */
{
  const rc = p.locator('[data-demo="range-calendar"]');
  await rc.scrollIntoViewIfNeeded(); await wait(300);
  const status = () => rc.locator('.sg-calendar__status').textContent();
  ok('range calendar: the status line asks for the start first', (await status()) === '가는 날을 선택하세요', await status());

  const d0 = await run(rc, 5);
  ok('range calendar: five pickable days in a row on show', !!d0, String(d0));
  const s = plus(d0, 1), e = plus(d0, 3);
  await dayIn(rc, s).click(); await wait(250);
  const st1 = await status();
  ok('range calendar: the first pick is the start; the line says it and asks for the end',
    (await pressed(rc)).join() === s && st1.startsWith('가는 날 ') && st1.endsWith('오는 날을 선택하세요'), st1);

  await dayIn(rc, e).hover(); await wait(300);
  const prev = await rc.locator('td[data-band]').evaluateAll((ts) => ts.map((t) => `${t.dataset.band}${t.hasAttribute('data-preview') ? '*' : ''}`).join(' '));
  ok('range calendar: while the end is chosen the band previews start → pointer', prev === 'start* mid* end*', prev);

  await dayIn(rc, e).click(); await wait(400);
  const band = await rc.locator('td[data-band]').evaluateAll((ts) => ts.map((t) => `${t.dataset.band}${t.hasAttribute('data-preview') ? '*' : ''}:${t.getAttribute('aria-selected')}`).join(' '));
  const endName = await dayIn(rc, e).textContent();
  ok('range calendar: the second pick is the end; the band is drawn and the days between are selected',
    (await pressed(rc)).join() === `${s},${e}` && band === 'start:true mid:true end:true' && endName.includes('오는 날'), `${band} | ${endName}`);
  ok('range calendar: the line tells the span and its length in nights', (await status()).endsWith('2박 3일'), await status());
  /* each strip of the band sits on its row: its middle within 2 px of the row's middle (Safari once drew every strip
     a row low) */
  const off = await rc.evaluate((root) => {
    const strips = [...root.querySelectorAll('.sg-calendar__bands > *')].filter((e) => e.style.display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
    const rows = [...root.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('td[data-band]')).map((tr) => { const r = tr.getBoundingClientRect(); return r.top + r.height / 2; });
    return strips.length && strips.length === rows.length ? Math.max(...strips.map((y, i) => Math.abs(y - rows[i]))) : -1;
  });
  ok('range calendar: each strip of the band lies on its own row', off >= 0 && off <= 2, `${off.toFixed(1)} px off`);

  /* a complete range: the next pick starts again; an earlier day than the start starts over from there */
  await dayIn(rc, plus(d0, 2)).click(); await wait(200);
  await dayIn(rc, d0).click(); await wait(200);
  ok('range calendar: a day before the start starts over from that day', (await pressed(rc)).join() === d0 && (await status()).endsWith('오는 날을 선택하세요'), (await pressed(rc)).join());
  await dayIn(rc, d0).click(); await wait(200);
  ok('range calendar: the start again clears it (minLength 1)', (await pressed(rc)).length === 0 && (await status()) === '가는 날을 선택하세요', await status());

  /* the keyboard: Enter picks, arrows move */
  await dayIn(rc, d0).focus(); await p.keyboard.press('Enter'); await wait(150);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await wait(150);
  const kprev = await rc.locator('td[data-preview]').count();
  await p.keyboard.press('Enter'); await wait(400);
  ok('range calendar: keyboard — Enter, two arrows (previewed by focus), Enter make a two-night range',
    kprev === 3 && (await pressed(rc)).join() === `${d0},${plus(d0, 2)}` && (await status()).endsWith('2박 3일'), `${kprev} ${(await pressed(rc)).join()}`);
}

/* ================================================================ DateRangePicker: the stay (nights, sold-out days, name="stay") */
{
  const field = p.getByRole('button', { name: /숙박 일정/ });
  const input = p.locator('input[name="stay"]');
  const dlg = p.getByRole('dialog', { name: '숙박 일정' });
  const open = async () => { await field.scrollIntoViewIfNeeded(); await field.click(); await wait(500); };
  const panelStatus = () => dlg.locator('.sg-calendar__status').textContent();

  await open();
  const focused = await p.evaluate(() => document.activeElement?.closest('[role="dialog"]') ? document.activeElement.getAttribute('data-date') : null);
  ok('range field: opens a calendar dialog with focus on a day', (await dlg.count()) === 1 && !!focused, String(focused));

  const s = await run(dlg, 3), e = s && plus(s, 2);
  await dayIn(dlg, s).click(); await wait(150); await dayIn(dlg, e).click(); await wait(800);
  const shown = await field.textContent();
  ok('range field: choosing the end closes it; the field shows the span and its length', (await dlg.count()) === 0 && shown.includes('2박 3일'), shown);
  ok('range field: the form gets an ISO 8601 interval', (await input.inputValue()) === `${s}/${e}`, await input.inputValue());

  /* Escape before the end leaves the range as it was */
  await open();
  const t = plus(e, 1);
  const tBtn = (await dayIn(dlg, t).count()) ? dayIn(dlg, t) : dayIn(dlg, s);
  await tBtn.click(); await wait(200);
  const mid = await panelStatus();
  await p.keyboard.press('Escape'); await wait(400);
  ok('range field: Escape halfway closes it and keeps the range', (await dlg.count()) === 0 && mid.includes('체크아웃을 선택하세요') && (await input.inputValue()) === `${s}/${e}` && (await field.textContent()) === shown, mid);

  /* so does a click outside */
  await open();
  await tBtn.click(); await wait(200);
  await p.mouse.click(8, 450); await wait(400);
  ok('range field: a click outside halfway closes it and keeps the range', (await dlg.count()) === 0 && (await input.inputValue()) === `${s}/${e}`, await input.inputValue());

  /* a sold-out day cannot be picked, and a range cannot run across one */
  await open();
  let off = null;
  for (let tries = 0; tries < 3 && !off; tries++) {
    const ds = await days(dlg), today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const i = ds.findIndex((d, k) => d.off && d.iso > today && ds[k - 1] && !ds[k - 1].off && ds[k + 1] && !ds[k + 1].off);
    if (i >= 0) off = ds[i].iso; else { await dlg.getByRole('button', { name: '다음 달' }).click(); await wait(500); }
  }
  ok('range field: a sold-out day with pickable days on both sides is on show', !!off, String(off));
  if (off) {
    const before = await panelStatus();
    await dayIn(dlg, off).click({ force: true }); await wait(200);
    ok('range field: a sold-out day cannot be picked', (await panelStatus()) === before && (await dayIn(dlg, off).getAttribute('aria-pressed')) === 'false', await panelStatus());
    await dayIn(dlg, plus(off, -1)).click(); await wait(150);
    await dayIn(dlg, plus(off, 1)).click(); await wait(400);
    ok('range field: an end past a sold-out day starts over from it (the panel stays open)',
      (await dlg.count()) === 1 && (await pressed(dlg)).join() === plus(off, 1) && (await panelStatus()).includes('체크아웃을 선택하세요'), (await pressed(dlg)).join());
  }
  await p.keyboard.press('Escape'); await wait(400);
  ok('range field: still the first range after all that', (await input.inputValue()) === `${s}/${e}`, await input.inputValue());
}

/* ================================================================ DateRangePicker: the holiday (maxLength 29, days) */
{
  const field = p.getByRole('button', { name: /휴가 기간/ });
  const dlg = p.getByRole('dialog', { name: '휴가 기간' });
  await field.scrollIntoViewIfNeeded(); await field.click(); await wait(500);
  /* from the focused day: 29 days on (4 weeks + 1) is the longest range, 30 days */
  await p.keyboard.press('Enter'); await wait(100);
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight']) await p.keyboard.press(k);
  await wait(300); await p.keyboard.press('Enter'); await wait(800);
  const shown = await field.textContent();
  ok('range field: keyboard — the longest allowed range (maxLength 29) is taken', (await dlg.count()) === 0 && shown.includes('30일'), shown);

  await field.click(); await wait(500);
  await p.keyboard.press('Enter'); await wait(100);
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) await p.keyboard.press(k);
  await wait(300); await p.keyboard.press('Enter'); await wait(500);
  const st = await dlg.locator('.sg-calendar__status').textContent();
  ok('range field: one day past maxLength starts over instead (the panel stays open)', (await dlg.count()) === 1 && st.includes('종료일을 선택하세요') && (await pressed(dlg)).length === 1, st);
  await p.keyboard.press('Escape'); await wait(400);
  ok('range field: Escape keeps the 30-day range', (await field.textContent()) === shown, await field.textContent());
}

ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
