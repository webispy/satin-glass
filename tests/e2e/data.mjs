// The 0.3 components on their own pages, then put together in the dashboard example.
//   navigation: tabs (auto / manual activation, many tabs), pagination · feedback: banner, tooltip · selection: filter
//   select · display: accordion · table: sort, selection, keyboard grid, sticky, states, server mode, 5,000 rows ·
//   charts: stat, line, bar, donut · dashboard: how the parts work together, axe on every section.
// usage: node tests/e2e/data.mjs   (BROWSER=webkit|firefox; PORT (default 4173); Q for settings)
import * as pw from 'playwright';
import { readFileSync } from 'node:fs';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '', PORT = process.env.PORT || '4173';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost')) errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`http://localhost:${PORT}/${Q}#/${id}`); await p.waitForTimeout(900); };
const demo = (id) => p.locator(`[data-demo="${id}"]`);
const TAB = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
const active = () => p.evaluate(() => { const a = document.activeElement; const c = a?.closest('[data-r]'); return { tag: a?.tagName, r: c ? +c.dataset.r : null, c: c ? +c.dataset.c : null, grid: a?.closest('[role=grid]')?.getAttribute('aria-label') ?? null, text: (a?.textContent ?? '').trim().slice(0, 30) }; });
const bodyRows = (grid) => grid.locator('tbody:last-of-type tr:not([aria-hidden])');
const firstCells = (grid) => bodyRows(grid).evaluateAll((trs) => trs.map((tr) => tr.querySelector('th')?.textContent?.trim()));
const PAGER = { name: (n) => `${n} 페이지` };

/* ================================================================ navigation: tabs, pagination */
await go('navigation');
{
  const d = demo('tabs');
  await d.scrollIntoViewIfNeeded();
  const tabs = d.getByRole('tab'), ind = d.locator('.gl-tabs__indicator');
  const x0 = await ind.evaluate((e) => e.getBoundingClientRect().left);
  await tabs.nth(0).focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
  const x1 = await ind.evaluate((e) => e.getBoundingClientRect().left), t1 = await tabs.nth(1).boundingBox();
  ok('tabs: → selects the next tab and the underline travels under it', (await tabs.nth(1).getAttribute('aria-selected')) === 'true' && x1 > x0 && Math.abs(x1 - t1.x) < 1.5, `${x0.toFixed(0)} → ${x1.toFixed(0)} (tab at ${t1.x.toFixed(0)})`);
  ok('tabs: the panel is labelled by its tab and focus stays on the tab', (await d.getByRole('tabpanel').getAttribute('aria-labelledby')) === (await tabs.nth(1).getAttribute('id')) && await tabs.nth(1).evaluate((e) => e === document.activeElement));
  await p.keyboard.press('End'); await p.waitForTimeout(300);
  ok('tabs: End skips the disabled last tab', (await tabs.nth(3).getAttribute('aria-selected')) === 'true');
  await p.keyboard.press('Home'); await p.waitForTimeout(300);
  ok('tabs: Home goes back to the first', (await tabs.nth(0).getAttribute('aria-selected')) === 'true');

  const m = demo('tabs-many'), list = m.locator('.gl-tabs__list'), mt = m.getByRole('tab');
  const fade = await list.evaluate((e) => ({ end: e.hasAttribute('data-gl-more-end'), scrolls: e.scrollWidth > e.clientWidth }));
  ok('tabs: too many for the width — the list scrolls sideways and fades where more tabs wait', fade.scrolls && fade.end, JSON.stringify(fade));
  await m.getByRole('tab', { name: '디지털' }).focus();
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(500);
  const focusedTab = await p.evaluate(() => document.activeElement?.textContent?.trim());
  ok('tabs (manual): arrows move focus only; the selection stays', focusedTab === '할인 중' && (await m.getByRole('tab', { name: '디지털' }).getAttribute('aria-selected')) === 'true', focusedTab);
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const seen = await m.evaluate((e) => { const l = e.querySelector('.gl-tabs__list').getBoundingClientRect(), t = e.querySelector('[aria-selected=true]').getBoundingClientRect(); return { inView: t.left >= l.left - 1 && t.right <= l.right + 1, start: e.querySelector('.gl-tabs__list').hasAttribute('data-gl-more-start') }; });
  ok('tabs (manual): Enter selects; the far tab is scrolled into view and the start now fades', (await mt.last().getAttribute('aria-selected')) === 'true' && seen.inView && seen.start, JSON.stringify(seen));

  const pg = demo('pagination').locator('nav').first();
  await pg.scrollIntoViewIfNeeded();
  const count0 = await pg.locator('li').count();
  await pg.getByRole('button', { name: PAGER.name(7) }).click(); await p.waitForTimeout(100);
  const count1 = await pg.locator('li').count();
  ok('pagination: a page becomes current (aria-current) and the number of buttons stays put', (await pg.getByRole('button', { name: PAGER.name(7) }).getAttribute('aria-current')) === 'page' && count0 === count1, `${count0} → ${count1}`);
  await pg.getByRole('button', { name: PAGER.name(40) }).click(); await p.waitForTimeout(100);
  ok('pagination: on the last page Next is disabled', await pg.getByRole('button', { name: '다음 페이지' }).isDisabled());
  const narrow = demo('pagination').locator('nav').last();
  ok('pagination: in a narrow box it reads "40 / 40" instead of buttons', (await narrow.locator('.gl-pagination__compact').isVisible()) && !(await narrow.locator('.gl-pagination__pages').isVisible()));
}

/* ================================================================ feedback: banner, tooltip */
await go('feedback');
{
  const d = demo('banners'), next = d.locator('.gl-banner--success');
  await d.scrollIntoViewIfNeeded();
  /* in the demo's own coordinates (the click may scroll the page); the banner gives way to a 32 px "show again" button */
  const rel = () => next.evaluate((e) => e.getBoundingClientRect().top - e.closest('[data-demo]').getBoundingClientRect().top);
  const y0 = await rel();
  await d.getByRole('button', { name: '알림 닫기' }).click(); await p.waitForTimeout(600);
  const y1 = await rel();
  ok('banner: dismissing folds it away and the content below closes the gap', (await d.getByText('11월 정기 점검').count()) === 0 && y1 < y0 - 25, `${y0.toFixed(0)} → ${y1.toFixed(0)}`);
  ok('banner: a live danger banner is an alert; quiet ones have no role', (await d.locator('.gl-banner--danger').getAttribute('role')) === 'alert' && (await d.locator('.gl-banner--success').getAttribute('role')) === null);

  const t = demo('tooltips'), bold = t.getByRole('button', { name: '굵게' });
  await bold.scrollIntoViewIfNeeded();
  await bold.hover(); await p.waitForTimeout(250);
  const early = await p.getByRole('tooltip').count();
  await p.waitForTimeout(500);
  const tip = p.getByRole('tooltip');
  ok('tooltip: appears after a short delay on hover and describes the button', early === 0 && (await tip.count()) === 1 && (await bold.getAttribute('aria-describedby'))?.includes(await tip.getAttribute('id')));
  const tb = await tip.boundingBox(), hb = await bold.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y - 2); await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 4 }); await p.waitForTimeout(300);
  ok('tooltip: stays open while the pointer moves onto it (hoverable)', (await tip.count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('tooltip: Escape closes it', (await tip.count()) === 0);
  await bold.hover(); await p.waitForTimeout(700);
  await t.getByRole('button', { name: '기울임' }).hover(); await p.waitForTimeout(120);
  ok('tooltip: moving to a neighbour shows its tooltip at once (warm)', (await p.getByRole('tooltip').textContent().catch(() => '')).includes('기울임'));
  await p.mouse.move(5, 500); await p.waitForTimeout(400);
  await t.locator('.term').focus(); await p.keyboard.press(TAB); await p.keyboard.press('Shift+' + TAB); await p.waitForTimeout(150);
  ok('tooltip: keyboard focus shows it at once', (await p.getByRole('tooltip').textContent().catch(() => '')).includes('순매출') || (await p.getByRole('tooltip').count()) === 1);
  await p.keyboard.press('Escape');
}

/* ================================================================ selection: filter select */
await go('selection');
{
  const f = demo('filter-select').getByRole('combobox', { name: /분류/ });
  await f.scrollIntoViewIfNeeded(); await f.click(); await p.waitForTimeout(400);
  await p.getByRole('option', { name: '주방' }).click(); await p.waitForTimeout(350);
  ok('filter select: reads "label value" and changes', (await f.textContent()).replace(/\s+/g, '') === '분류주방');
}

/* ================================================================ display: accordion */
await go('display');
{
  const d = demo('accordion'), acc = d.getByRole('button', { name: /교환과 반품/ });
  await acc.scrollIntoViewIfNeeded(); await acc.click(); await p.waitForTimeout(600);
  const region = d.getByRole('region', { name: /교환과 반품/ });
  ok('accordion: opens its region', (await acc.getAttribute('aria-expanded')) === 'true' && (await region.boundingBox()).height > 10);
  await acc.click(); await p.waitForTimeout(600);
  ok('accordion: closes it again (the region folds to nothing and is inert)', (await region.boundingBox())?.height < 1 && await region.evaluate((e) => e.inert));
  const s = demo('accordion-single'), [a, c] = [s.getByRole('button', { name: /취소/ }), s.getByRole('button', { name: /영수증/ })];
  await a.click(); await p.waitForTimeout(200); await c.click(); await p.waitForTimeout(200);
  ok('accordion (single): opening one closes the other', (await a.getAttribute('aria-expanded')) === 'false' && (await c.getAttribute('aria-expanded')) === 'true');
}

/* ================================================================ table */
await go('table');
{
  /* sort */
  const grid = p.getByRole('grid', { name: '상품 목록', exact: true });
  const before = await firstCells(grid);
  const sb = grid.getByRole('button', { name: /^상품$/ });
  await sb.click(); await p.waitForTimeout(150);
  const asc = await firstCells(grid);
  ok('table: clicking a header sorts ascending (aria-sort) and announces it', asc.every((n, i, a) => i === 0 || a[i - 1].localeCompare(n, undefined, { numeric: true, sensitivity: 'base' }) <= 0)
    && (await sb.evaluate((e) => e.closest('th').getAttribute('aria-sort'))) === 'ascending' && (await demo('table-basic').locator('[aria-live]').first().textContent()).includes('오름차순'));
  await sb.click(); await sb.click(); await p.waitForTimeout(150);
  ok('table: the third click turns sorting off (original order)', JSON.stringify(await firstCells(grid)) === JSON.stringify(before));
  const soldBtn = grid.getByRole('button', { name: /판매량/ });
  await soldBtn.click(); await p.waitForTimeout(150);
  ok('table: a "more is better" column sorts high → low first (firstSort)', (await soldBtn.evaluate((e) => e.closest('th').getAttribute('aria-sort'))) === 'descending');
  await demo('table-basic').getByRole('radio', { name: '촘촘하게' }).click(); await p.waitForTimeout(200);
  ok('table: density — compact rows are 36 px', Math.round((await bodyRows(grid).first().boundingBox()).height) === 36);

  const cells = p.getByRole('grid', { name: '판매량과 재고 상태', exact: true });
  const days = cells.getByRole('button', { name: /소진 예상/ });
  const col = async () => bodyRows(cells).evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[1]?.textContent.trim()));
  await days.click(); await p.waitForTimeout(150);
  const up = await col(); await days.click(); await p.waitForTimeout(150); const down = await col();
  const n = (xs) => xs.filter((v) => v !== '–').map((v) => parseInt(v, 10));
  ok('table: empty values go last in both directions', up[up.length - 1] === '–' && down[down.length - 1] === '–' && n(up).every((v, i, a) => i === 0 || a[i - 1] <= v) && n(down).every((v, i, a) => i === 0 || a[i - 1] >= v), `${up.slice(-2)} / ${down.slice(-2)}`);
  ok('table: a paused product is a muted row', (await cells.locator('tr[data-muted]').count()) === 1);

  /* selection */
  const sg = p.getByRole('grid', { name: '고를 수 있는 상품 목록', exact: true });
  const boxes = sg.locator('tbody:last-of-type input[type=checkbox]');
  await sg.scrollIntoViewIfNeeded();
  await boxes.nth(0).click(); await boxes.nth(3).click({ modifiers: ['Shift'] }); await p.waitForTimeout(150);
  const head = sg.getByRole('checkbox', { name: '모든 행 선택' });
  ok('table: Shift-click selects a range; the header box goes mixed; the bar counts them', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 4 && await head.evaluate((e) => e.indeterminate) && (await demo('table-select').getByText('4개 선택됨').count()) === 1);
  await head.click(); await p.waitForTimeout(100);
  ok('table: the header box selects every row', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 8);
  await head.click(); await p.waitForTimeout(100);
  ok('table: …and clears them', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 0);
  ok('table: the boxes look like the library checkbox (header: Checkbox; rows: the same box drawn on the input)', (await sg.locator('thead .gl-check__box').count()) === 1
    && (await sg.locator('.gl-table__rowcheck').count()) === 8 && (await sg.locator('.gl-table__rowcheck').first().evaluate((e) => getComputedStyle(e).appearance)) === 'none');
  await sg.locator('tbody:last-of-type tr').nth(2).locator('th').click(); await p.keyboard.press(' '); await p.waitForTimeout(80);
  ok('table: Space on a row selects it', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 1);
  await p.keyboard.press(' ');

  /* keyboard grid (groups, pinned rows, sticky column) */
  const gg = p.getByRole('grid', { name: '상품 판매와 재고', exact: true });
  await demo('table-groups').evaluate((e) => { e.tabIndex = -1; e.focus(); });
  await p.keyboard.press(TAB);
  const a0 = await active();
  ok('table: one Tab stop leads into the grid', a0.grid === '상품 판매와 재고' && a0.r !== null, JSON.stringify(a0));
  await p.keyboard.press('ArrowDown'); const a1 = await active();
  await p.keyboard.press('ArrowRight'); const a2 = await active();
  ok('table: arrows move between cells', a1.r === a0.r + 1 && a1.c === a0.c && a2.c === a1.c + 1, `${JSON.stringify(a0)} → ${JSON.stringify(a1)} → ${JSON.stringify(a2)}`);
  await p.keyboard.press('End'); const a3 = await active();
  await p.keyboard.press('Home'); const a4 = await active();
  ok('table: End / Home go to the row\'s last / first cell', a3.c === 9 && a4.c === 0, `${a3.c} / ${a4.c}`);
  await p.keyboard.press('Control+End'); await p.waitForTimeout(100); const a5 = await active();
  const lastR = await gg.evaluate((e) => Math.max(...[...e.querySelectorAll('[data-r]')].map((c) => +c.dataset.r)));
  const gLastRow = await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'));
  ok('table: Ctrl+End jumps to the last cell', a5.r === lastR && a5.c === 9 && gLastRow === (await gg.getAttribute('aria-rowcount')), `${JSON.stringify(a5)}, row ${gLastRow}`);
  ok('table: still exactly one tab stop', (await demo('table-groups').locator('[tabindex="0"]').count()) === 1);
  const gbox = demo('table-groups').locator('.gl-table');
  await gbox.evaluate((e) => { e.scrollTop = 200; e.scrollLeft = 400; }); await p.waitForTimeout(200);
  const g = await gbox.evaluate((e) => {
    const t = e.getBoundingClientRect(), th = e.querySelector('thead tr:last-child th').getBoundingClientRect(), td = e.querySelector('tbody:last-of-type tr th').getBoundingClientRect();
    return { headBottom: th.bottom - t.top, firstColLeft: td.left - t.left, headH: e.querySelector('thead').getBoundingClientRect().height };
  });
  ok('table: scrolled both ways, the header stays on top and the first column stays on the left', Math.abs(g.headBottom - g.headH) < 1 && Math.abs(g.firstColLeft) < 1, JSON.stringify(g));
  ok('table: grouped columns share a group header (scope colgroup)', (await gg.locator('th[scope=colgroup]').count()) === 3);
  ok('table: summary rows are pinned above the data and blank where a value does not apply', (await gg.locator('.gl-table__pinned tr').count()) === 2 && (await gg.locator('.gl-table__pinned .gl-table__none').count()) === 0);

  /* states */
  const st = demo('table-states');
  await st.scrollIntoViewIfNeeded();
  await st.getByRole('button', { name: '다시 불러오기' }).click(); await p.waitForTimeout(100);
  ok('table: reloading dims the rows under a progress line', (await st.locator('.gl-table--loading').count()) === 1 && (await st.locator('.gl-table__busy').count()) === 1);
  await p.waitForTimeout(1700);
  await st.getByRole('switch', { name: '빈 결과 보기' }).click(); await p.waitForTimeout(200);
  ok('table: no rows shows the empty state', (await st.getByText('조건에 맞는 상품이 없어요').count()) === 1);
  await st.getByRole('button', { name: '필터 지우기' }).click(); await p.waitForTimeout(200);
  ok('table: its action brings the rows back', (await bodyRows(st.getByRole('grid')).count()) === 5);

  /* server mode */
  const sv = demo('table-server'), srv = sv.getByRole('grid');
  await sv.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  ok('server table: 20 rows; aria-rowcount tells the real total', (await srv.locator('tbody tr').count()) === 20 && (await srv.getAttribute('aria-rowcount')) === '5001');
  await sv.getByRole('button', { name: PAGER.name(2) }).click(); await p.waitForTimeout(80);
  const dim = await sv.locator('.gl-table--loading').count(), line = await sv.locator('.gl-table__busy').count();
  await p.waitForTimeout(600);
  ok('pagination + server: page 2 — the rows dim under a progress line, then the next 20', dim === 1 && line === 1 && (await sv.getByRole('button', { name: PAGER.name(2) }).getAttribute('aria-current')) === 'page' && (await sv.getByText('5,000건 중 21–40').count()) === 1);
  await srv.getByRole('button', { name: /금액/ }).click(); await p.waitForTimeout(700);
  const amounts = await srv.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => +tr.querySelectorAll('td')[3].textContent.replace(/[₩,]/g, '')));
  ok('server table: sorting goes to the "server" (back to page 1, highest first)', amounts.every((v, i) => i === 0 || amounts[i - 1] >= v) && (await sv.getByRole('button', { name: PAGER.name(1) }).getAttribute('aria-current')) === 'page', amounts.slice(0, 4).join(','));

  /* 5,000 rows */
  const vd = demo('table-virtual'), big = vd.getByRole('grid'), vbox = vd.locator('.gl-table');
  await vbox.scrollIntoViewIfNeeded();
  const rendered = await big.locator('tbody tr:not([aria-hidden])').count();
  ok('virtual table: 5,000 rows, only a window of them in the DOM', rendered < 80 && (await big.getAttribute('aria-rowcount')) === '5001', `${rendered} rows rendered`);
  await vbox.evaluate((e) => { e.scrollTop = 60000; }); await p.waitForTimeout(250);
  const idx = await big.locator('tbody tr[aria-rowindex]').evaluateAll((trs) => trs.map((t) => +t.getAttribute('aria-rowindex')));
  ok('virtual table: scrolling deep renders the rows that are there', idx.length > 5 && idx[0] > 1300 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1), `rows ${idx[0]}–${idx[idx.length - 1]}`);
  await vbox.evaluate((e) => { e.scrollTop = 0; }); await p.waitForTimeout(150);
  await big.locator('tbody tr').first().locator('th').click();
  await p.keyboard.press('Control+End'); await p.waitForTimeout(300);
  const lastCell = await active(), lastRow = await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'));
  ok('virtual table: Ctrl+End scrolls to the very last row and focuses its last cell', lastRow === '5001' && lastCell.c === 7, `row ${lastRow}, col ${lastCell.c}`);
  await p.keyboard.press('Control+Home'); await p.waitForTimeout(300);
  ok('virtual table: Ctrl+Home goes back to the first row', (await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'))) === '2');
  await p.keyboard.press('PageDown'); await p.waitForTimeout(200);
  const pd = +(await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex')));
  ok('virtual table: PageDown moves a screenful', pd > 6 && pd < 20, String(pd));
}

/* ================================================================ charts */
await go('charts');
{
  const s = demo('stats');
  await s.getByRole('button', { name: '다시 불러오기' }).click(); await p.waitForTimeout(100);
  const busy = await s.locator('.gl-stat[aria-busy=true]').count();
  await p.waitForTimeout(1400);
  ok('stat: skeletons while loading, then the numbers', busy === 4 && (await s.locator('.gl-stat[aria-busy=true]').count()) === 0 && /\d/.test(await s.locator('.gl-stat__value').first().textContent()));
  const deltas = await s.locator('.gl-stat__delta').evaluateAll((ds) => ds.map((d) => ({ good: d.dataset.good, text: d.textContent })));
  const consistent = deltas.every((d, i) => { const up = /증가/.test(d.text), down = /감소/.test(d.text), invert = i === 3; return (up && d.text.includes('+') && d.good === (invert ? 'bad' : 'good')) || (down && /[-−]/.test(d.text) && d.good === (invert ? 'good' : 'bad')); });
  ok('stat: the change is said in words; colour follows whether it is good (returns up = bad)', consistent && deltas[3].good === 'bad', deltas.map((d) => `${d.good}:${d.text}`).join(' | '));

  const l = demo('line'), plot = l.locator('.gl-chart__plot');
  await plot.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const pr = await plot.boundingBox();
  await p.mouse.move(pr.x + pr.width * 0.5, pr.y + pr.height * 0.5); await p.waitForTimeout(200);
  const tipTitle = await l.locator('.gl-chart__tip-title').textContent().catch(() => '');
  ok('line chart: hovering shows a crosshair and a tooltip with every series', !!tipTitle && (await l.locator('.gl-chart__tip-row').count()) === 2 && (await l.locator('.gl-chart__cross circle').count()) === 2, tipTitle);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  await plot.focus(); await p.keyboard.press('End'); await p.waitForTimeout(100);
  const said = await l.locator('[aria-live]').first().textContent();
  ok('line chart: focusable; End moves to the last point and announces it', said.startsWith('11/18') && said.includes('방문'), said);
  const key = l.getByRole('button', { name: '재방문' });
  await key.click(); await p.waitForTimeout(500);
  ok('line chart: a legend key hides its series (aria-pressed false)', (await key.getAttribute('aria-pressed')) === 'false' && (await l.locator('.gl-chart__line').count()) === 1);
  const other = l.getByRole('button', { name: '방문', exact: true });
  await other.click(); await p.waitForTimeout(200);
  ok('line chart: the last visible series cannot be hidden', (await other.getAttribute('aria-pressed')) === 'true');
  await key.click();
  ok('line chart: the full data is there as a table for screen readers', (await l.locator('table tbody tr').count()) === 30);

  const bar = demo('bar');
  await bar.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const grouped = await bar.locator('.gl-chart__bar').count();
  await bar.getByRole('radio', { name: '누적' }).click(); await p.waitForTimeout(600);
  const stacked = await bar.locator('.gl-chart__bar').count();
  ok('bar chart: one bar per series and month, grouped and stacked', grouped === 18 && stacked === 18, `${grouped} / ${stacked}`);

  const ring = demo('donut').locator('.gl-donut__ring');
  await ring.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('donut: arrow keys pick a slice; the centre and the announcement say its share', (await demo('donut').locator('.gl-donut__label').textContent()) === '의류' && (await demo('donut').locator('[aria-live]').textContent()).includes('의류'));
}

/* ================================================================ the dashboard example: the parts together */
await go('dashboard');
{
  const d = demo('dashboard');
  const before = await d.locator('.gl-stat__value').first().textContent();
  await d.getByRole('radio', { name: '30일' }).click(); await p.waitForTimeout(100);
  const busy = await d.locator('.gl-stat[aria-busy=true]').count();
  await p.waitForTimeout(1000);
  ok('dashboard: the period switch reloads the stats (skeletons, then the 30-day numbers)', busy === 4 && (await d.locator('.gl-stat[aria-busy=true]').count()) === 0 && (await d.locator('.gl-stat__value').first().textContent()) !== before);
  ok('dashboard: …and redraws the chart with 30 days', (await d.locator('.gl-chart').first().locator('table tbody tr').count()) === 30);
  await d.getByRole('radio', { name: '주문', exact: true }).click(); await p.waitForTimeout(600);
  ok('dashboard: the card\'s segmented control swaps the chart (one series)', (await d.locator('.gl-chart').first().locator('.gl-chart__line').count()) === 1 && (await d.getByRole('heading', { name: '하루 주문' }).count()) === 1);

  await d.getByRole('button', { name: '상품 보기' }).click(); await p.waitForTimeout(700);
  const lowChip = d.getByRole('button', { name: '재고 부족만' });
  ok('dashboard: the banner\'s action opens the products tab filtered to low stock', (await d.getByRole('tab', { name: '상품' }).getAttribute('aria-selected')) === 'true' && (await lowChip.getAttribute('aria-pressed')) === 'true'
    && (await d.getByRole('grid', { name: '상품', exact: true }).locator('tbody:last-of-type tr').evaluateAll((trs) => trs.every((tr) => tr.textContent.includes('재고 부족')))));
  await lowChip.click(); await p.waitForTimeout(200);
  await d.getByRole('button', { name: '문구' }).click(); await p.waitForTimeout(200);
  const cats = await d.getByRole('grid', { name: '상품', exact: true }).locator('tbody:last-of-type tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[0].textContent));
  ok('dashboard: a category chip filters the table', cats.length === 4 && cats.every((c) => c === '문구'), cats.join(','));
  /* the name cell holds one button: the grid hands focus to it, Enter opens the product sheet */
  const pg = d.getByRole('grid', { name: '상품', exact: true });
  await pg.locator('tbody:last-of-type tr').first().locator('td').first().click();
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(50);
  const a = await active();
  ok('dashboard: a cell with one control hands focus to it', a.tag === 'BUTTON' && a.c === 0, JSON.stringify(a));
  const product = (await p.evaluate(() => document.activeElement?.textContent?.trim())) ?? '';
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const sheet = p.getByRole('dialog');
  ok('dashboard: the product sheet opens, titled with the product, with its details', (await sheet.count()) === 1 && (await p.getByRole('dialog', { name: product }).count()) === 1 && (await sheet.locator('.gl-sparkline').count()) === 1 && (await sheet.getByRole('button', { name: /배송/ }).count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok('dashboard: Escape closes it and focus returns to the product', (await sheet.count()) === 0 && (await p.evaluate(() => document.activeElement?.className)) === 'dash__link');

  await d.getByRole('tab', { name: /주문/ }).click(); await p.waitForTimeout(500);
  const og = d.getByRole('grid', { name: '주문', exact: true });
  ok('dashboard: the orders tab shows the first 15 of 5,000', (await og.locator('tbody tr').count()) === 15 && (await og.getAttribute('aria-rowcount')) === '5001');
  const boxes = og.locator('tbody input[type=checkbox]');
  await boxes.nth(0).click(); await boxes.nth(1).click(); await p.waitForTimeout(150);
  ok('dashboard: selecting rows brings up the bulk action', (await d.getByText('2건 선택').count()) === 1 && (await d.getByRole('button', { name: '배송 준비' }).count()) === 1);
  await d.getByRole('button', { name: '선택 해제' }).click(); await p.waitForTimeout(100);
  const status = d.getByRole('combobox', { name: /상태/ });
  await status.click(); await p.waitForTimeout(400); await p.getByRole('option', { name: '환불' }).click(); await p.waitForTimeout(300);
  const st = await og.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelector('.gl-tag')?.textContent));
  ok('dashboard: the status filter narrows the orders', st.length > 0 && st.every((s) => s === '환불'), `${st.length} rows`);
  await d.getByRole('searchbox', { name: '주문 찾기' }).or(d.getByRole('textbox', { name: '주문 찾기' })).first().fill('없는주문'); await p.waitForTimeout(300);
  ok('dashboard: no match shows the empty state, with a way out', (await d.getByText('조건에 맞는 주문이 없어요').count()) === 1);
  await d.locator('.gl-empty').getByRole('button', { name: '필터 지우기' }).click(); await p.waitForTimeout(300);
  ok('dashboard: …which clears every filter', (await og.locator('tbody tr').count()) === 15 && (await status.textContent()).includes('전체'));

  const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const found = [];
  for (const tab of ['개요', '주문', '상품']) {
    await d.getByRole('tab', { name: new RegExp(tab) }).click(); await p.waitForTimeout(1200);
    await p.addScriptTag({ content: axe });
    const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('[data-demo=dashboard]'), { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes[0]?.target}`));
    found.push(...v.map((x) => `${tab}: ${x}`));
  }
  ok('axe: every dashboard tab — no serious or critical violations', found.length === 0, found.join(' | '));
}

ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
