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
  /* the band follows the grid it lies on (#108): narrowed to a width the seven columns share unevenly (below the
     280 px cap), and with the weekday header grown so every row moves down, each strip still runs from its first
     day to its last (2 px in from their edges) on its row */
  const fit = () => rc.evaluate((root) => {
    const strips = [...root.querySelectorAll('.sg-calendar__bands > *')].filter((e) => e.style.display !== 'none').map((e) => e.getBoundingClientRect());
    const rows = [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td[data-band]')]).filter((tds) => tds.length).map((tds) => {
      const a = tds[0].getBoundingClientRect(), z = tds[tds.length - 1].getBoundingClientRect(), r = tds[0].parentElement.getBoundingClientRect();
      return { left: a.left + 2, right: z.right - 2, mid: r.top + r.height / 2 };
    });
    if (!strips.length || strips.length !== rows.length) return { err: -1, n: `${strips.length}/${rows.length}` };
    const err = Math.max(...strips.map((s, i) => Math.max(Math.abs(s.left - rows[i].left), Math.abs(s.right - rows[i].right), Math.abs(s.top + s.height / 2 - rows[i].mid))));
    return { err, n: strips.length };
  });
  const calEl = rc.locator('.sg-calendar').first();
  await calEl.evaluate((c) => { c.style.width = '257.5px'; }); await wait(400);
  const narrowed = await fit();
  ok('range calendar: narrowed below its cap, the band still lies on its days', narrowed.err >= 0 && narrowed.err <= 1, JSON.stringify(narrowed));
  await calEl.evaluate((c) => { c.querySelector('thead th').style.height = '44px'; }); await wait(400);
  const lowered = await fit();
  ok('range calendar: with the weekday header grown, the band moves down with its rows', lowered.err >= 0 && lowered.err <= 1, JSON.stringify(lowered));
  await calEl.evaluate((c) => { c.style.width = ''; c.querySelector('thead th').style.height = ''; }); await wait(400);
  const back = await fit();
  ok('range calendar: back at full size, the band lies on its days again', back.err >= 0 && back.err <= 1, JSON.stringify(back));

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

/* ================================================================ RangeCalendar months={2}: two months side by side (#5) */
{
  const rt = p.locator('[data-demo="range-two"]');
  await rt.scrollIntoViewIfNeeded(); await wait(300);
  const names = () => rt.locator('table[role="grid"]').evaluateAll((ts) => ts.map((t) => t.getAttribute('aria-label')));
  const n0 = await names();
  ok('two months: two grids, each named by its month; no day of another month drawn', n0.length === 2 && n0.every((x) => /\d{4}년 \d+월/.test(x)) && (await rt.locator('button.sg-day[data-outside]').count()) === 0, n0.join(' | '));
  /* a month on, so both months are after today (min is today) */
  await rt.getByRole('button', { name: '다음 달' }).click(); await wait(500);
  const n1 = await names();
  ok('two months: the arrow moves one month (the second month becomes the first)', n1[0] === n0[1], n1.join(' | '));
  const first = await rt.locator('table[role="grid"]').first().locator('button.sg-day').evaluateAll((bs) => bs.map((x) => x.dataset.date));
  const second = await rt.locator('table[role="grid"]').nth(1).locator('button.sg-day').evaluateAll((bs) => bs.map((x) => x.dataset.date));
  const s = first[first.length - 3], e = second[2];
  await dayIn(rt, s).click(); await wait(200); await dayIn(rt, e).click(); await wait(600);
  ok('two months: a range from the first month into the second is taken', (await pressed(rt)).join() === `${s},${e}` && (await rt.locator('.sg-calendar__status').textContent()).includes(`${span(s, e)}박`), await rt.locator('.sg-calendar__status').textContent());
  /* each strip of the band runs from its row's first banded day to its last (2 px in), in both grids */
  const fit = () => rt.evaluate((root) => {
    const key = (r) => Math.round(r.top) * 10000 + Math.round(r.left);
    const strips = [...root.querySelectorAll('.sg-calendar__bands > *')].filter((x) => x.style.display !== 'none').map((x) => x.getBoundingClientRect()).sort((a, b2) => key(a) - key(b2));
    const rows = [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td[data-band]')].map((td) => td.getBoundingClientRect())).filter((rs) => rs.length)
      .map((rs) => ({ left: Math.min(...rs.map((r) => r.left)) + 2, right: Math.max(...rs.map((r) => r.right)) - 2, mid: rs[0].top + rs[0].height / 2, top: rs[0].top }))
      .sort((a, b2) => key(a) - key(b2));
    if (!strips.length || strips.length !== rows.length) return { err: -1, n: `${strips.length}/${rows.length}` };
    return { err: Math.max(...strips.map((x, i) => Math.max(Math.abs(x.left - rows[i].left), Math.abs(x.right - rows[i].right), Math.abs(x.top + x.height / 2 - rows[i].mid)))), n: strips.length };
  });
  const f1 = await fit();
  ok('two months: the band lies on its days in both grids', f1.err >= 0 && f1.err <= 1 && f1.n >= 2, JSON.stringify(f1));
  /* the keys cross the gap: left from the second month's 1st is the first month's last day */
  await dayIn(rt, second[0]).focus(); await p.keyboard.press('ArrowLeft'); await wait(150);
  const crossed = await p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  ok('two months: the left arrow from the second month\'s 1st goes to the first month\'s last day', crossed === first[first.length - 1], String(crossed));
  /* right to left (a page whose dir is set before the range is chosen): the grids mirror, the band follows its days,
     and the left arrow is the next day */
  await rt.evaluate((r) => { r.setAttribute('dir', 'rtl'); }); await wait(300);
  await dayIn(rt, first[first.length - 5]).click(); await wait(200); await dayIn(rt, second[3]).click(); await wait(600);
  const f2 = await fit();
  ok('two months, right to left: the band lies on its days', f2.err >= 0 && f2.err <= 1, JSON.stringify(f2));
  await dayIn(rt, first[0]).focus(); await p.keyboard.press('ArrowLeft'); await wait(150);
  const next = await p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  ok('two months, right to left: the left arrow is the next day', next === first[1], String(next));
  /* the next-month chevron points the way the months go */
  const flip = await rt.evaluate((r) => getComputedStyle(r.querySelector('.sg-calendar__nav svg')).transform);
  ok('two months, right to left: the arrows\' chevrons are mirrored', /^matrix\(-1,/.test(flip), flip);
  await rt.evaluate((r) => { r.removeAttribute('dir'); }); await wait(300);
  /* the room: the stylesheet and the script agree at 584 px (a fraction under is one month) */
  const box = (w) => rt.evaluate((r, w) => { r.querySelector('.sg-rangecalendar').style.width = w; }, w);
  const shown = () => rt.locator('table[role="grid"]').evaluateAll((ts) => ts.filter((t) => t.offsetParent !== null).length);
  await box('583.75px'); await wait(400);
  const under = { grids: (await names()).length, shown: await shown() };
  await box('584px'); await wait(400);
  const at = { grids: (await names()).length, shown: await shown() };
  ok('two months: at 583.75 px one month (drawn and in the keys), at 584 px two', under.grids === 1 && under.shown === 1 && at.grids === 2 && at.shown === 2, JSON.stringify({ under, at }));
  /* narrowed with a day focused: it keeps the focus, in the first month or the second (its month comes in) */
  const focusAfter = async (iso) => {
    await box(''); await wait(400);
    await dayIn(rt, iso).focus(); await wait(100);
    await box('400px'); await wait(500);
    return p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  };
  const f1st = await focusAfter(first[10]), f2nd = await focusAfter(second[10]);
  ok('two months, narrowed with a day focused: the focus stays on it (first month, second month)', f1st === first[10] && f2nd === second[10], `${f1st} / ${f2nd}`);
  const narrow = await names();
  ok('two months, in 400 px: one month, its outside days shown', narrow.length === 1 && (await rt.locator('button.sg-day[data-outside]').count()) > 0, narrow.join(' | '));
  /* widened again with that day focused: it keeps the focus (its button may be in the other grid now) */
  await box(''); await wait(500);
  const fWide = await p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  ok('two months, wide again: two, and the focused day keeps the focus', (await names()).length === 2 && fWide === second[10], `${(await names()).join(' | ')} / ${fWide}`);
  /* the band's head goes along the days in order: while it grows into the second month, the first month's part
     already reaches that month's last day (it never jumps the gap ahead of the days before it) */
  await box(''); await wait(300);
  await rt.getByRole('button', { name: '이전 달' }).click(); await wait(500);
  const g1 = await rt.locator('table[role="grid"]').first().locator('button.sg-day').evaluateAll((bs) => bs.map((x) => x.dataset.date));
  const g2 = await rt.locator('table[role="grid"]').nth(1).locator('button.sg-day').evaluateAll((bs) => bs.map((x) => x.dataset.date));
  await dayIn(rt, g1[g1.length - 8]).click(); await wait(300);
  const started = (await pressed(rt)).join();
  /* the preview from the start to a day in the second month, sampled frame by frame. The head must move: some frame
     with the band longer than at the start and shorter than at its end. When the first try shows none, it is kept
     with the grids' layout before and after (what the band's geometry is measured from, #108): if that did not
     change, the jump is a bug and the check fails; if it did, the head started anew in a grid laid out again, and the
     preview is tried again from the start, up to three times */
  const seam = await rt.evaluate(async (root, [startIso, lastIso, targetIso]) => {
    const day = (iso) => root.querySelector(`button.sg-day[data-date="${iso}"]`);
    const hover = (el) => { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseenter')); };
    const frame = () => new Promise(requestAnimationFrame);
    /* the layout the band is measured from: each table's place, width and rows */
    /* rows from the first row, as bandGeometry takes them (WebKit measures a row's offsetTop from the body while it
       slides, from the table after) */
    const layout = () => [...root.querySelectorAll('table[role="grid"]')].map((t) => { const rows = [...t.tBodies[0].rows], r0 = rows[0]?.offsetTop ?? 0; return `${t.offsetLeft},${t.offsetTop},${getComputedStyle(t).width}:${t.tBodies[0].offsetTop}:${rows.map((r) => `${r.offsetTop - r0}/${r.offsetHeight}`).join(',')}`; }).join(' ; ');
    let r, first;
    for (let tries = 0; tries < 3; tries++) {
      if (tries) { hover(day(startIso)); for (let i = 0; i < 30; i++) await frame(); }
      const last = day(lastIso).getBoundingClientRect(), g2 = root.querySelectorAll('table[role="grid"]')[1].getBoundingClientRect();
      const before = layout();
      const lenOf = () => Math.round([...root.querySelectorAll('.sg-calendar__bands > *')].filter((e) => e.style.display !== 'none').reduce((a, e) => a + e.getBoundingClientRect().width, 0));
      const pre = lenOf(), active = document.activeElement?.getAttribute('data-date') ?? document.activeElement?.tagName, status = root.querySelector('.sg-calendar__status')?.textContent;
      hover(day(targetIso));
      const frames = [];
      for (let i = 0; i < 40; i++) {
        await frame();
        const strips = [...root.querySelectorAll('.sg-calendar__bands > *')].filter((e) => e.style.display !== 'none').map((e) => e.getBoundingClientRect());
        const inSecond = strips.some((x) => x.left >= g2.left - 1), firstEnd = Math.max(0, ...strips.filter((x) => x.left < g2.left - 1 && Math.abs(x.top + x.height / 2 - (last.top + last.height / 2)) < 8).map((x) => x.right));
        frames.push({ t: Math.round(performance.now()), inSecond, firstEnd, len: Math.round(strips.reduce((a, x) => a + x.width, 0)), w: strips.map((x) => Math.round(x.width)).join('+') });
      }
      const after = layout();
      const bad = frames.filter((f) => f.inSecond && f.firstEnd < last.right - 4).length;
      /* the head along every row: the band's whole length between where it began and where it settled */
      /* longer than before the hover and shorter than at its end */
      const end = frames[frames.length - 1].len;
      const partWay = frames.some((f) => f.len > pre + 6 && f.len < end - 6);
      r = { tries: tries + 1, frames: frames.length, bad, reached: frames.some((f) => f.inSecond), partWay };
      if (!partWay && !first) first = { pre, active, status, laidOut: before !== after, before: before === after ? undefined : before, after: before === after ? undefined : after, trace: frames.slice(0, 10).map((f) => `${f.t}:${f.w}`).join(' | ') };
      if (bad || partWay || before === after) break;   /* a jump in an unchanged layout is not retried, on any try */
    }
    return { ...r, first };
  }, [g1[g1.length - 8], g1[g1.length - 1], g2[5]]);
  /* with reduced motion the band is drawn at its end at once: no frame part way is asked for */
  ok('two months: the band\'s head moves through the days, reaching the first month\'s last day before it goes on into the second', started === g1[g1.length - 8] && seam.reached && seam.bad === 0 && (/rm=1/.test(Q) || seam.partWay), JSON.stringify({ started, ...seam }));
  /* with reduced motion the band is drawn at its end at once, so there is no first try to explain */
  await p.keyboard.press('Escape'); await wait(200);
}

/* ================================================================ DateRangePicker months={2}: resized while open */
{
  const field = p.getByRole('button', { name: /휴가 기간/ });
  const dlg = p.getByRole('dialog', { name: '휴가 기간' });
  await field.scrollIntoViewIfNeeded(); await field.click(); await wait(600);
  const count = () => dlg.locator('table[role="grid"]').count();
  const two = await count();
  const g2 = await dlg.locator('table[role="grid"]').nth(1).locator('button.sg-day').evaluateAll((bs) => bs.map((x) => x.dataset.date));
  await dlg.locator(`button.sg-day[data-date="${g2[12]}"]`).focus(); await wait(100);
  await p.setViewportSize({ width: 600, height: 900 }); await wait(600);
  const narrow = { grids: await count(), focus: await p.evaluate(() => document.activeElement?.getAttribute('data-date')) };
  await p.setViewportSize({ width: 1280, height: 900 }); await wait(600);
  const wide = { grids: await count(), focus: await p.evaluate(() => document.activeElement?.getAttribute('data-date')) };
  ok('range field, two months: resized while open, the focused day keeps the focus (632 px)', two === 2 && narrow.grids === 1 && narrow.focus === g2[12] && wide.grids === 2 && wide.focus === g2[12], JSON.stringify({ two, narrow, wide }));
  /* a header chip keeps the focus too */
  await dlg.locator('.sg-calendar__chip').first().focus(); await wait(100);
  await p.setViewportSize({ width: 600, height: 900 }); await wait(500);
  const chip = await p.evaluate(() => document.activeElement?.classList.contains('sg-calendar__chip'));
  await p.setViewportSize({ width: 1280, height: 900 }); await wait(500);
  const chip2 = await p.evaluate(() => document.activeElement?.classList.contains('sg-calendar__chip'));
  ok('range field, two months: resized while open, a header chip keeps the focus', chip && chip2, `${chip} / ${chip2}`);
  await p.keyboard.press('Escape'); await wait(400);
}

ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
