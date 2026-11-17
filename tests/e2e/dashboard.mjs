// Dashboard components in a real browser: tabs, tooltip, banner, filter select, data table (sort, select,
// keyboard grid, virtualisation, sticky, server mode), pagination, charts, stat, accordion.
// usage: node tests/e2e/dashboard.mjs   (BROWSER=webkit|firefox; PORT (default 4173); Q for settings)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '', PORT = process.env.PORT || '4173';
const reduced = /rm=1/.test(Q);
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost')) errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async () => { await p.goto(`http://localhost:${PORT}/${Q}#/dashboard`); await p.waitForTimeout(900); };
const TAB = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
const active = () => p.evaluate(() => { const a = document.activeElement; const c = a?.closest('[data-r]'); return { tag: a?.tagName, r: c ? +c.dataset.r : null, c: c ? +c.dataset.c : null, text: (a?.textContent ?? '').trim().slice(0, 30), label: a?.getAttribute('aria-label') }; });

await go();
const grid = p.getByRole('grid', { name: '서버 프로필' });
const box = p.locator('.gl-table').first();
const names = () => grid.locator('tbody:last-of-type tr').evaluateAll((trs) => trs.map((tr) => tr.querySelector('th')?.textContent?.replace('1회 측정', '').trim()));

/* ---------------------------------------------------------------- tabs */
{
  const view = p.getByRole('tablist', { name: '보기' });
  const tabs = view.getByRole('tab');
  const ind = p.locator('.gl-tabs__indicator').nth(1);
  const x0 = await ind.evaluate((e) => e.getBoundingClientRect().left);
  await tabs.nth(0).focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(600);
  const x1 = await ind.evaluate((e) => e.getBoundingClientRect().left), t1 = await tabs.nth(1).boundingBox();
  ok('tabs: → selects the next tab and the underline travels under it', (await tabs.nth(1).getAttribute('aria-selected')) === 'true' && x1 > x0 && Math.abs(x1 - t1.x) < 1.5, `${x0.toFixed(0)} → ${x1.toFixed(0)} (tab at ${t1.x.toFixed(0)})`);
  ok('tabs: the panel is labelled by its tab and focus stays on the tab', (await p.getByRole('tabpanel').first().getAttribute('aria-labelledby')) === (await tabs.nth(1).getAttribute('id')) && await tabs.nth(1).evaluate((e) => e === document.activeElement));
  await p.keyboard.press('Home'); await p.waitForTimeout(500);
  ok('tabs: Home goes back to the first', (await tabs.nth(0).getAttribute('aria-selected')) === 'true');
}

/* ---------------------------------------------------------------- banner & tooltip */
{
  const close = p.getByRole('button', { name: '알림 닫기' });
  const tableY0 = await box.evaluate((e) => e.getBoundingClientRect().top);
  await close.click(); await p.waitForTimeout(500);
  const tableY1 = await box.evaluate((e) => e.getBoundingClientRect().top);
  ok('banner: dismissing folds it away and the content below closes the gap', (await p.locator('.gl-banner').count()) === 0 && tableY1 < tableY0 - 40, `${tableY0.toFixed(0)} → ${tableY1.toFixed(0)}`);
  const term = grid.getByRole('button', { name: /읽기 A/ });
  await term.hover(); await p.waitForTimeout(250);
  const early = await p.getByRole('tooltip').count();
  await p.waitForTimeout(500);
  const tip = p.getByRole('tooltip');
  ok('tooltip: appears after a short delay on hover, describing the header', early === 0 && (await tip.count()) === 1 && (await term.getAttribute('aria-describedby'))?.includes(await tip.getAttribute('id')));
  const tb = await tip.boundingBox(), hb = await term.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y - 2); await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 4 }); await p.waitForTimeout(300);
  ok('tooltip: stays open while the pointer moves onto it (hoverable)', (await tip.count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('tooltip: Escape closes it', (await tip.count()) === 0);
  await p.mouse.move(5, 500); await p.waitForTimeout(300);
}

/* ---------------------------------------------------------------- filter select */
{
  const lv = p.getByRole('combobox', { name: /부하/ });
  await lv.click(); await p.waitForTimeout(400);
  await p.getByRole('option', { name: '무거움' }).click(); await p.waitForTimeout(350);
  ok('filter select: reads "label value" and changes', (await lv.textContent()).replace(/\s+/g, '') === '부하무거움');
}

/* ---------------------------------------------------------------- table: sort */
{
  const before = await names();
  const sb = grid.getByRole('button', { name: /^서버$/ });
  await sb.click(); await p.waitForTimeout(150);
  const asc = await names();
  const sorted = [...asc].every((n, i, a) => i === 0 || a[i - 1].localeCompare(n, undefined, { numeric: true, sensitivity: 'base' }) <= 0);
  ok('table: clicking a header sorts ascending (aria-sort) and announces it', sorted && (await sb.evaluate((e) => e.closest('th').getAttribute('aria-sort'))) === 'ascending' && (await p.locator('.gl-table [aria-live]').first().textContent()).includes('오름차순'));
  const score = grid.getByRole('button', { name: /압축/ });
  await score.click(); await p.waitForTimeout(150);
  const vals = await grid.locator('tbody:last-of-type tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[7]?.textContent.trim()));
  const nums = vals.filter((v) => v !== '–').map(Number);
  ok('table: a score column sorts high → low first; empty values go last', nums.every((v, i) => i === 0 || nums[i - 1] >= v) && vals[vals.length - 1] === '–', vals.slice(-3).join(','));
  await score.click(); await score.click(); await p.waitForTimeout(150);
  ok('table: the third click turns sorting off (original order)', JSON.stringify(await names()) === JSON.stringify(before));
}

/* ---------------------------------------------------------------- table: selection */
{
  const boxes = grid.locator('tbody:last-of-type input[type=checkbox]');
  await boxes.nth(0).click(); await boxes.nth(3).click({ modifiers: ['Shift'] }); await p.waitForTimeout(150);
  const selected = await grid.locator('tbody:last-of-type tr[aria-selected=true]').count();
  const head = grid.getByRole('checkbox', { name: '모든 설정 선택' });
  ok('table: Shift-click selects a range; the header box goes mixed; a compare button appears', selected === 4 && await head.evaluate((e) => e.indeterminate) && (await p.getByRole('button', { name: '4개 비교' }).count()) === 1);
  await head.click(); await p.waitForTimeout(100);
  ok('table: the header box selects every row', (await grid.locator('tbody:last-of-type tr[aria-selected=true]').count()) === (await grid.locator('tbody:last-of-type tr').count()));
  await head.click(); await p.waitForTimeout(100);
  ok('table: …and clears them', (await grid.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 0);
}

/* ---------------------------------------------------------------- table: keyboard grid */
{
  await p.getByRole('searchbox', { name: '서버 찾기' }).or(p.getByRole('textbox', { name: '서버 찾기' })).first().focus();
  let found = false;
  for (let i = 0; i < 8 && !found; i++) { await p.keyboard.press(TAB); const a = await active(); found = a.r !== null; }
  const a0 = await active();
  ok('table: one Tab stop leads into the grid', found, JSON.stringify(a0));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const a1 = await active();
  await p.keyboard.press('ArrowRight');
  const a2 = await active();
  ok('table: arrows move between cells (into pinned rows, then data rows); a cell with one link focuses the link', a1.r === 3 && a2.c === a1.c + 1 && (a2.c !== 1 || a2.tag === 'A'), `${JSON.stringify(a1)} → ${JSON.stringify(a2)}`);
  await p.keyboard.press('End'); const a3 = await active();
  await p.keyboard.press('Home'); const a4 = await active();
  ok('table: End / Home go to the row\'s last / first cell', a3.c === 12 && a4.c === 0, `${a3.c} / ${a4.c}`);
  await p.keyboard.press(' '); await p.waitForTimeout(80);
  ok('table: Space on a row selects it', (await grid.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 1);
  await p.keyboard.press(' ');
  await p.keyboard.press('Control+End'); await p.waitForTimeout(100); const a5 = await active();
  const rows = await grid.locator('tbody:last-of-type tr').count();
  ok('table: Ctrl+End jumps to the last cell', a5.r === 2 + rows && a5.c === 12, JSON.stringify(a5));
  const stops = await box.evaluate((e) => e.querySelectorAll('[tabindex="0"]').length);
  ok('table: still exactly one tab stop', stops === 1, String(stops));
}

/* ---------------------------------------------------------------- table: sticky header & first columns */
{
  await box.evaluate((e) => { e.scrollTop = 260; e.scrollLeft = 500; }); await p.waitForTimeout(200);
  const g = await box.evaluate((e) => {
    const t = e.getBoundingClientRect(), th = e.querySelector('thead th[data-c="1"]').getBoundingClientRect(), td = e.querySelector('tbody:last-of-type tr th').getBoundingClientRect();
    return { headTop: th.top - t.top, firstColLeft: td.left - t.left, cbLeft: e.querySelector('tbody:last-of-type tr td').getBoundingClientRect().left - t.left };
  });
  ok('table: scrolled both ways, the header stays on top and the checkbox + model columns stay on the left', Math.abs(g.headTop) < 1 && Math.abs(g.cbLeft) < 1 && Math.abs(g.firstColLeft - 44) < 1, JSON.stringify(g));
  await box.evaluate((e) => { e.scrollTop = 0; e.scrollLeft = 0; });
}

/* ---------------------------------------------------------------- table: empty search */
{
  const s = p.getByRole('searchbox', { name: '서버 찾기' }).or(p.getByRole('textbox', { name: '서버 찾기' })).first();
  await s.fill('없는서버'); await p.waitForTimeout(250);
  ok('table: no match shows the empty state (and no summary rows)', (await p.getByText('찾는 서버가 없어요').count()) === 1 && (await p.locator('.gl-table__pinned').count()) === 0);
  await p.getByRole('button', { name: '검색 지우기' }).click(); await p.waitForTimeout(250);
  ok('table: clearing the search brings the rows back', (await grid.locator('tbody:last-of-type tr').count()) > 10);
}

/* ---------------------------------------------------------------- status tab: stat, charts, accordion */
{
  await p.getByRole('tab', { name: /측정 현황/ }).click(); await p.waitForTimeout(200);
  const busy = await p.locator('.gl-stat[aria-busy=true]').count();
  await p.waitForTimeout(1100);
  ok('stat: skeletons while loading, then the numbers', busy === 4 && (await p.locator('.gl-stat[aria-busy=true]').count()) === 0 && (await p.locator('.gl-stat__value').first().textContent()) === '161');
  const delta = await p.locator('.gl-stat__delta').evaluateAll((ds) => ds.map((d) => d.dataset.good + ':' + d.textContent));
  ok('stat: change said in words; colour by whether the change is good (costs up = bad)', delta[0].startsWith('good:증가') && delta[1].startsWith('good:감소') && delta[2].startsWith('bad:증가'), delta.join(' | '));
  const plot = p.locator('.gl-chart__plot').first();
  await plot.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const pr = await plot.boundingBox();
  await p.mouse.move(pr.x + pr.width * 0.5, pr.y + pr.height * 0.5); await p.waitForTimeout(200);
  const tipTitle = await p.locator('.gl-chart__tip-title').first().textContent().catch(() => '');
  ok('line chart: hovering shows a crosshair and a tooltip with every series', !!tipTitle && (await p.locator('.gl-chart__tip-row').count()) === 2 && (await p.locator('.gl-chart__cross circle').count()) === 2, tipTitle);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  await plot.focus(); await p.keyboard.press('End'); await p.waitForTimeout(100);
  const said = await p.locator('.gl-chart [aria-live]').first().textContent();
  ok('line chart: focusable; End moves to the last point and announces it', said.startsWith('11/17') && said.includes('받은 요청'), said);
  const key = p.getByRole('button', { name: '처리한 요청' }).first();
  await key.click(); await p.waitForTimeout(500);
  ok('line chart: a legend key hides its series (aria-pressed false)', (await key.getAttribute('aria-pressed')) === 'false' && (await p.locator('.gl-chart').first().locator('.gl-chart__line').count()) === 1);
  const other = p.getByRole('button', { name: '받은 요청' }).first();
  await other.click(); await p.waitForTimeout(200);
  ok('line chart: the last visible series cannot be hidden', (await other.getAttribute('aria-pressed')) === 'true');
  await key.click();
  ok('line chart: the full data is there as a table for screen readers', (await p.locator('.gl-chart').first().locator('table tbody tr').count()) === 30);
  /* bars rise from the baseline on entrance */
  const bars = await p.locator('.gl-chart__bar').count();
  ok('bar chart: stacked bars, one per series and category', bars === 14, String(bars));
  const ring = p.locator('.gl-donut__ring');
  await ring.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('donut: arrow keys pick a slice; the centre and the announcement say its share', (await p.locator('.gl-donut__label').textContent()) === '성공' && (await p.locator('.gl-donut [aria-live]').textContent()).includes('성공'));
  const acc = p.getByRole('button', { name: /추적 정보/ });
  await acc.click(); await p.waitForTimeout(500);
  const region = p.getByRole('region', { name: /추적 정보/ });
  ok('accordion: opens its region', (await acc.getAttribute('aria-expanded')) === 'true' && (await region.boundingBox()).height > 10);
  await acc.click(); await p.waitForTimeout(500);
  ok('accordion: closes it again (the region folds to nothing and is inert)', (await region.boundingBox())?.height < 1 && await region.evaluate((e) => e.inert));
}

/* ---------------------------------------------------------------- calls tab: server mode, pagination, virtualised 5,000 rows */
{
  await p.getByRole('tab', { name: /요청 기록/ }).click(); await p.waitForTimeout(150);
  const srv = p.getByRole('grid', { name: '요청 기록 (서버)' });
  ok('server table: skeleton rows while the first page loads', (await p.locator('.gl-table--loading').count()) >= 1);
  await p.waitForTimeout(600);
  ok('server table: 25 rows; aria-rowcount tells the real total', (await srv.locator('tbody tr').count()) === 25 && (await srv.getAttribute('aria-rowcount')) === '5001');
  await p.getByRole('button', { name: '2 페이지' }).click(); await p.waitForTimeout(80);
  const dim = await p.locator('.gl-table--loading').count(), line = await p.locator('.gl-table__busy').count();
  await p.waitForTimeout(600);
  ok('pagination: page 2 — while loading the rows dim under a progress line; then the next 25', dim === 1 && line === 1 && (await p.getByRole('button', { name: '2 페이지' }).getAttribute('aria-current')) === 'page' && (await p.getByText('5,000개 중 26–50').count()) === 1);
  await srv.getByRole('button', { name: /응답/ }).click(); await p.waitForTimeout(700);
  const ms = await srv.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => +tr.querySelectorAll('td')[2].textContent.replace(/,/g, '')));
  ok('server table: sorting goes to the "server" (back to page 1, highest first)', ms.every((v, i) => i === 0 || ms[i - 1] >= v) && (await p.getByRole('button', { name: '1 페이지' }).getAttribute('aria-current')) === 'page');
  await p.getByRole('button', { name: '200 페이지' }).click(); await p.waitForTimeout(700);
  ok('pagination: last page — Next disabled', await p.getByRole('button', { name: '다음 페이지' }).isDisabled());

  const big = p.getByRole('grid', { name: '요청 기록 5,000행' });
  const vbox = p.locator('.gl-table').nth(1);
  await vbox.scrollIntoViewIfNeeded();
  const rendered = await big.locator('tbody tr:not([aria-hidden])').count();
  ok('virtual table: 5,000 rows, only a window of them in the DOM', rendered < 80 && (await big.getAttribute('aria-rowcount')) === '5001', `${rendered} rows rendered`);
  await vbox.evaluate((e) => { e.scrollTop = 60000; }); await p.waitForTimeout(250);
  const idx = await big.locator('tbody tr[aria-rowindex]').evaluateAll((trs) => trs.map((t) => +t.getAttribute('aria-rowindex')));
  ok('virtual table: scrolling deep renders the rows that are there', idx.length > 5 && idx[0] > 1300 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1), `rows ${idx[0]}–${idx[idx.length - 1]}`);
  await vbox.evaluate((e) => { e.scrollTop = 0; }); await p.waitForTimeout(150);
  await big.locator('tbody tr').first().locator('th').click();
  await p.keyboard.press('Control+End'); await p.waitForTimeout(300);
  const last = await active();
  const lastTime = await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'));
  ok('virtual table: Ctrl+End scrolls to the very last row and focuses its last cell', lastTime === '5001' && last.c === 6, `row ${lastTime}, col ${last.c}`);
  await p.keyboard.press('Control+Home'); await p.waitForTimeout(300);
  ok('virtual table: Ctrl+Home goes back to the first row', (await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'))) === '2');
  await p.keyboard.press('PageDown'); await p.waitForTimeout(200);
  const pd = +(await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex')));
  ok('virtual table: PageDown moves a screenful', pd > 6 && pd < 20, String(pd));
}

/* ---------------------------------------------------------------- axe */
{
  const { readFileSync } = await import('node:fs');
  const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const found = [];
  for (const tab of ['프로필', '측정 현황', '요청 기록']) {
    await p.getByRole('tab', { name: new RegExp(tab) }).click(); await p.waitForTimeout(1400);
    await p.addScriptTag({ content: axe });
    const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('[data-demo=dashboard]'), { resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes[0]?.target}`));
    found.push(...v.map((x) => `${tab}: ${x}`));
  }
  ok('axe: dashboard tabs have no serious or critical violations', found.length === 0, found.join(' | '));
}

console.log('page errors:', errs.length ? errs : 'none');
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
