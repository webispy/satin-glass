// The 0.3 components on their own pages, then put together in the dashboard example.
//   navigation: tabs (auto / manual activation, many tabs), pagination · feedback: banner, tooltip · selection: filter
//   select · display: accordion · table: sort, selection, keyboard grid, sticky, states, server mode, 5,000 rows ·
//   charts: stat, line, bar, donut · dashboard: how the parts work together, axe on every section.
// usage: node tests/e2e/data.mjs   (BROWSER=webkit|firefox; E2E_PORT (default 4173); Q for settings)
// covers: data, navigation, feedback, overlays, layout   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { readFileSync } from 'node:fs';
import { motions, springAt } from '../../packages/core/dist/index.js';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url ?? '').includes('localhost')) errs.push(m.text()); });
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`${pw.ORIGIN}/${Q}#/${id}`); await p.waitForTimeout(900); };
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
  const tabs = d.getByRole('tab'), ind = d.locator('.sg-tabs__indicator');
  const x0 = await ind.evaluate((e) => e.getBoundingClientRect().left);
  await tabs.nth(0).focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
  const x1 = await ind.evaluate((e) => e.getBoundingClientRect().left), t1 = await tabs.nth(1).boundingBox();
  ok('tabs: → selects the next tab and the underline travels under it', (await tabs.nth(1).getAttribute('aria-selected')) === 'true' && x1 > x0 && Math.abs(x1 - t1.x) < 1.5, `${x0.toFixed(0)} → ${x1.toFixed(0)} (tab at ${t1.x.toFixed(0)})`);
  ok('tabs: the panel is labelled by its tab and focus stays on the tab', (await d.getByRole('tabpanel').getAttribute('aria-labelledby')) === (await tabs.nth(1).getAttribute('id')) && await tabs.nth(1).evaluate((e) => e === document.activeElement));
  await p.keyboard.press('End'); await p.waitForTimeout(300);
  ok('tabs: End skips the disabled last tab', (await tabs.nth(3).getAttribute('aria-selected')) === 'true');
  await p.keyboard.press('Home'); await p.waitForTimeout(300);
  ok('tabs: Home goes back to the first', (await tabs.nth(0).getAttribute('aria-selected')) === 'true');

  const m = demo('tabs-many'), list = m.locator('.sg-tabs__list'), mt = m.getByRole('tab');
  const fade = await list.evaluate((e) => ({ end: e.hasAttribute('data-sg-more-end'), scrolls: e.scrollWidth > e.clientWidth }));
  ok('tabs: too many for the width — the list scrolls sideways and fades where more tabs wait', fade.scrolls && fade.end, JSON.stringify(fade));
  await m.getByRole('tab', { name: '디지털' }).focus();
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(500);
  const focusedTab = await p.evaluate(() => document.activeElement?.textContent?.trim());
  ok('tabs (manual): arrows move focus only; the selection stays', focusedTab === '할인 중' && (await m.getByRole('tab', { name: '디지털' }).getAttribute('aria-selected')) === 'true', focusedTab);
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const seen = await m.evaluate((e) => { const l = e.querySelector('.sg-tabs__list').getBoundingClientRect(), t = e.querySelector('[aria-selected=true]').getBoundingClientRect(); return { inView: t.left >= l.left - 1 && t.right <= l.right + 1, start: e.querySelector('.sg-tabs__list').hasAttribute('data-sg-more-start') }; });
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
  ok('pagination: in a narrow box it reads "40 / 40" instead of buttons', (await narrow.locator('.sg-pagination__compact').isVisible()) && !(await narrow.locator('.sg-pagination__pages').isVisible()));
}

/* badges sit true: a tab's count is centred in its pill (the tab's 24 px line used to sink the digits); a tab-bar
   badge keeps the top of its ring (the scrolling track used to clip it) */
{
  const tb = p.locator('.docs__page .sg-tabs__badge').first(); await tb.scrollIntoViewIfNeeded();
  const off = await tb.evaluate((e) => { const r = e.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(e); const q = g.getBoundingClientRect(); return (q.top + q.bottom) / 2 - (r.top + r.bottom) / 2; });
  ok('tabs: the count sits in the middle of its pill', Math.abs(off) <= 0.75, `text centre ${off.toFixed(2)} px from the pill's`);
  const bar = p.locator('.docs__page .sg-tabbar').first(); await bar.scrollIntoViewIfNeeded();
  const g = await bar.evaluate((t) => { const tr = t.querySelector('.sg-tabbar__track').getBoundingClientRect(), bd = t.querySelector('.sg-tabbar__icon > .sg-badge:not(.sg-badge--dot)').getBoundingClientRect(), ind = t.querySelector('.sg-tabbar__indicator').getBoundingClientRect(), it = t.querySelector('.sg-tabbar__item').getBoundingClientRect(); return { ring: bd.top - 2 - tr.top, ind: [ind.top - it.top, ind.bottom - it.bottom] }; });
  ok('tab bar: a badge keeps its whole ring (inside the scrolling track) and the drop still fits the tab', g.ring >= 0 && Math.abs(g.ind[0]) < 0.5 && Math.abs(g.ind[1]) < 0.5, JSON.stringify(g));
}

/* ================================================================ feedback: banner, tooltip */
await go('feedback');
{
  /* a one-line banner with a button: icon, title and button share one centre line (the title used to sit high);
     with a body, the button stays level with the title */
  const mids = (ban) => ban.evaluate((e) => { const c = (s) => { const r = e.querySelector(s).getBoundingClientRect(); return (r.top + r.bottom) / 2; }; const r = e.getBoundingClientRect(); return { banner: (r.top + r.bottom) / 2, icon: c('.sg-banner__icon'), title: c('.sg-banner__title'), button: c('.sg-banner__actions .sg-button') }; });
  const one = await mids(p.locator('.docs__page .sg-banner--warning')), two = await mids(p.locator('.docs__page .sg-banner--danger'));
  const even = (o, keys) => Math.max(...keys.map((k) => o[k])) - Math.min(...keys.map((k) => o[k])) <= 1;
  ok('banner: one line — icon, title and button centre on one line, in the middle of the banner', even(one, ['banner', 'icon', 'title', 'button']), JSON.stringify(one));
  ok('banner: with a body — the button stays level with the title', even(two, ['icon', 'title', 'button']), JSON.stringify(two));
}
{
  const d = demo('banners'), next = d.locator('.sg-banner--success');
  await d.scrollIntoViewIfNeeded();
  /* in the demo's own coordinates (the click may scroll the page); the banner gives way to a 32 px "show again" button */
  const rel = () => next.evaluate((e) => e.getBoundingClientRect().top - e.closest('[data-demo]').getBoundingClientRect().top);
  const y0 = await rel();
  await d.getByRole('button', { name: '알림 닫기' }).click(); await p.waitForTimeout(600);
  const y1 = await rel();
  ok('banner: dismissing folds it away and the content below closes the gap', (await d.getByText('11월 정기 점검').count()) === 0 && y1 < y0 - 25, `${y0.toFixed(0)} → ${y1.toFixed(0)}`);
  ok('banner: a live danger banner is an alert; quiet ones have no role', (await d.locator('.sg-banner--danger').getAttribute('role')) === 'alert' && (await d.locator('.sg-banner--success').getAttribute('role')) === null);

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
  await t.getByRole('button', { name: '기울임' }).hover();
  /* well before the 500 ms delay (the previous tooltip may still be fading out meanwhile, so look for this one) */
  const warm = await p.getByRole('tooltip').filter({ hasText: '기울임' }).waitFor({ timeout: 300 }).then(() => true, () => false);
  ok('tooltip: moving to a neighbour shows its tooltip at once (warm)', warm);
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
  /* header text: every column on one line — inline-flex headers used to take their baseline from the sort icon */
  const tops = await grid.evaluate((t) => [...new Set([...t.querySelectorAll('thead .sg-table__title')].map((e) => e.getBoundingClientRect().top.toFixed(1)))]);
  ok('table: start- and end-aligned header titles sit on the same line', tops.length === 1, tops.join(' / '));
  const edges = await grid.evaluate((t) => [...t.querySelectorAll('thead th[data-align=end]')].map((th) => { const c = th.dataset.c, cell = t.querySelector(`tbody tr td[data-c="${c}"]`), r = document.createRange(); r.selectNodeContents(cell); return Math.abs(th.querySelector('.sg-table__title').getBoundingClientRect().right - r.getBoundingClientRect().right); }));
  ok('table: end-aligned header text ends where the numbers end', edges.every((d) => d < 1), edges.map((d) => d.toFixed(1)).join(','));
  /* the sort direction is drawn by transform + opacity (the CSS d property, used before, does not exist in WebKit) */
  const dir = await grid.evaluate((t) => { const th = t.querySelector('th[aria-sort=descending], th[aria-sort=ascending]'); const op = (s) => +getComputedStyle(th.querySelector(s)).opacity; return { sort: th.getAttribute('aria-sort'), up: op('.sg-table__sort-up'), down: op('.sg-table__sort-down') }; });
  /* within 0.02: the other chevron's fade can still be in its last frames on a loaded machine */
  const on = (v) => v > 0.98, off = (v) => v < 0.02;
  ok('table: the sort icon shows one chevron, pointing the sorted way', dir.sort === 'descending' ? on(dir.down) && off(dir.up) : on(dir.up) && off(dir.down), JSON.stringify(dir));
  const digits = await grid.evaluate((t) => { const s = document.createElement('span'); s.style.position = 'absolute'; t.querySelector('tbody td').appendChild(s); const w = (x) => { s.textContent = x; return s.getBoundingClientRect().width; }; const r = [w('1111'), w('8888')]; s.remove(); return r; });
  ok('table: numbers use tabular figures (every digit the same width)', Math.abs(digits[0] - digits[1]) < 0.1, digits.map((d) => d.toFixed(2)).join(' vs '));
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
  const bars = await cells.evaluate((t) => [...new Set([...t.querySelectorAll('.sg-barmeter')].map((b) => b.getBoundingClientRect().right.toFixed(1)))]);
  ok('table: meter bars end at one edge (the value keeps a fixed slot, bold or not)', bars.length === 1, bars.join(' / '));
  const mid = await cells.evaluate((t) => { const tr = t.querySelector('tbody tr'); const c = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return (b.top + b.bottom) / 2; }; return [c(tr.querySelector('.sg-cell-meter > :last-child')), c(tr.querySelector('th'))]; });
  ok('table: a meter cell\'s number is on the row\'s text line', Math.abs(mid[0] - mid[1]) <= 1, mid.map((v) => v.toFixed(1)).join(' vs '));

  /* selection */
  const sg = p.getByRole('grid', { name: '선택할 수 있는 상품 목록', exact: true });
  const boxes = sg.locator('tbody:last-of-type input[type=checkbox]');
  await sg.scrollIntoViewIfNeeded();
  await boxes.nth(0).click(); await boxes.nth(3).click({ modifiers: ['Shift'] }); await p.waitForTimeout(150);
  const head = sg.getByRole('checkbox', { name: '모든 행 선택' });
  ok('table: Shift-click selects a range; the header box goes mixed; the bar counts them', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 4 && await head.evaluate((e) => e.indeterminate) && (await demo('table-select').getByText('4개 선택됨').count()) === 1);
  await head.click(); await p.waitForTimeout(100);
  ok('table: the header box selects every row', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 8);
  await head.click(); await p.waitForTimeout(100);
  ok('table: …and clears them', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 0);
  ok('table: header and row boxes are the library checkbox (same box, drawn tick)', (await sg.locator('.sg-check__box').count()) === 9 && (await sg.locator('tbody .sg-check__tick').count()) === 8);
  /* the header box sits on the header text's line, like the other header cells (it used to sit on the line below) */
  const hb = await sg.evaluate((t) => { const box = t.querySelector('thead .sg-check__box').getBoundingClientRect(), title = t.querySelector('thead .sg-table__title').getBoundingClientRect(); return { box: (box.top + box.bottom) / 2, title: (title.top + title.bottom) / 2 }; });
  ok('table: the select-all box is centred on the header text line', Math.abs(hb.box - hb.title) <= 1.5, JSON.stringify(hb));
  await sg.locator('tbody:last-of-type tr').nth(2).locator('th').click(); await p.keyboard.press(' '); await p.waitForTimeout(80);
  ok('table: Space on a row selects it', (await sg.locator('tbody:last-of-type tr[aria-selected=true]').count()) === 1);
  await p.keyboard.press(' ');

  /* keyboard grid (groups, pinned rows, sticky column) */
  const gg = p.getByRole('grid', { name: '상품 판매와 재고', exact: true });
  await demo('table-groups').getByRole('radiogroup', { name: '세로줄' }).getByRole('radio', { checked: true }).focus();   /* the column-lines switch comes just before the grid */
  await p.keyboard.press(TAB);
  const a0 = await active();
  ok('table: one Tab stop leads into the grid', a0.grid === '상품 판매와 재고' && a0.r !== null, JSON.stringify(a0));
  await p.keyboard.press('ArrowDown'); const a1 = await active();
  await p.keyboard.press('ArrowRight'); const a2 = await active();
  ok('table: arrows move between cells', a1.r === a0.r + 1 && a1.c === a0.c && a2.c === a1.c + 1, `${JSON.stringify(a0)} → ${JSON.stringify(a1)} → ${JSON.stringify(a2)}`);
  /* the last column comes from the grid: the demo starts with some columns hidden by its column chooser */
  const lastC = await gg.evaluate((e) => Math.max(...[...e.querySelectorAll('[data-c]')].map((c) => +c.dataset.c)));
  await p.keyboard.press('End'); const a3 = await active();
  await p.keyboard.press('Home'); const a4 = await active();
  ok('table: End / Home go to the row\'s last / first cell', a3.c === lastC && a4.c === 0, `${a3.c} / ${a4.c} (last ${lastC})`);
  await p.keyboard.press('Control+End'); await p.waitForTimeout(100); const a5 = await active();
  const lastR = await gg.evaluate((e) => Math.max(...[...e.querySelectorAll('[data-r]')].map((c) => +c.dataset.r)));
  const gLastRow = await p.evaluate(() => document.activeElement.closest('tr')?.getAttribute('aria-rowindex'));
  ok('table: Ctrl+End jumps to the last cell', a5.r === lastR && a5.c === lastC && gLastRow === (await gg.getAttribute('aria-rowcount')), `${JSON.stringify(a5)}, row ${gLastRow}`);
  ok('table: still exactly one tab stop', (await gg.locator('[tabindex="0"]').count()) === 1);

  /* columnLines: where the group changes / every column / only the frozen seam; found between the columns shown */
  const lineCols = () => gg.evaluate((t) => {
    const row = [...t.querySelectorAll('tbody:last-of-type tr')].find((tr) => tr.querySelector('td'));
    return [...row.children].filter((c) => getComputedStyle(c).getPropertyValue('--_vline').trim() !== 'transparent').map((c) => c.textContent.trim() === '' ? '?' : +c.dataset.c);
  });
  const groupEnds = () => gg.evaluate((t) => {
    /* each column's group from the first header row (an ungrouped column spans both rows and has none); a line
       belongs where the next column's group differs */
    const g = [];
    for (const th of t.querySelectorAll('thead tr:first-child th')) {
      const span = +(th.getAttribute('colspan') || 1);
      for (let k = 0; k < span; k++) g.push(th.classList.contains('sg-table__group') ? th.textContent : '');
    }
    return { ends: g.map((x, i) => (i < g.length - 1 && x !== g[i + 1] ? i : -1)).filter((i) => i >= 0) };
  });
  const lineSwitch = demo('table-groups').getByRole('radiogroup', { name: '세로줄' });
  const gl = await lineCols(), ge = await groupEnds();
  /* default 'groups' in the demo: the frozen name column (0), the column before 판매, and each group's end but the last */
  const want = [...new Set([0, ...ge.ends])].sort((x, y) => x - y);
  ok('table lines: \'groups\' draws a line at the frozen seam and wherever the header group changes', JSON.stringify(gl) === JSON.stringify(want), `${JSON.stringify(gl)} vs ${JSON.stringify(want)}`);
  await lineSwitch.getByRole('radio', { name: '모든 열' }).click(); await p.waitForTimeout(150);
  const all = await lineCols(), nCols = await gg.evaluate((t) => t.querySelectorAll('thead tr:last-child th').length + t.querySelectorAll('thead tr:first-child th[rowspan]').length);
  ok('table lines: \'all\' draws one between every pair of columns (not after the last)', all.length === nCols - 1, `${all.length} lines, ${nCols} columns`);
  const labelWhole = await gg.evaluate((t) => [...t.querySelectorAll('thead tr:first-child .sg-table__group')].every((th) => th.classList.contains('sg-table__vline') || th === t.querySelector('thead tr:first-child th:last-child')));
  ok('table lines: …and a group label keeps one line at its end, none through it', labelWhole);
  await lineSwitch.getByRole('radio', { name: '세로줄 없음' }).click(); await p.waitForTimeout(150);
  ok('table lines: \'none\' keeps only the frozen seam', JSON.stringify(await lineCols()) === '[0]', JSON.stringify(await lineCols()));
  await lineSwitch.getByRole('radio', { name: '그룹 사이' }).click(); await p.waitForTimeout(150);
  /* hide the stock group's last column: the line moves to the column that now ends the group */
  await demo('table-groups').getByRole('button', { name: /^열/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('checkbox', { name: '소진 예상', exact: true }).click(); await p.waitForTimeout(150);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const stockEnd = await gg.evaluate((t) => +[...t.querySelectorAll('thead tr:last-child th')].find((th) => th.textContent.includes('재고')).dataset.c);
  ok('table lines: hiding the column at a group\'s end moves the line with the group', (await lineCols()).includes(stockEnd), `${JSON.stringify(await lineCols())}, stock at ${stockEnd}`);
  await demo('table-groups').getByRole('button', { name: /^열/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('checkbox', { name: '소진 예상', exact: true }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const gbox = demo('table-groups').locator('.sg-table');
  await gbox.evaluate((e) => { e.scrollTop = 200; e.scrollLeft = 400; }); await p.waitForTimeout(200);
  const g = await gbox.evaluate((e) => {
    const t = e.getBoundingClientRect(), th = e.querySelector('thead tr:last-child th').getBoundingClientRect(), td = e.querySelector('tbody:last-of-type tr th').getBoundingClientRect();
    return { headBottom: th.bottom - t.top, firstColLeft: td.left - t.left, headH: e.querySelector('thead').getBoundingClientRect().height };
  });
  ok('table: scrolled both ways, the header stays on top and the first column stays on the left', Math.abs(g.headBottom - g.headH) < 1 && Math.abs(g.firstColLeft) < 1, JSON.stringify(g));
  /* summary rows stay under the header when the table scrolls, and keyboard focus is never left behind a frozen column */
  const pinnedAt = await gbox.evaluate((e) => { const b = e.getBoundingClientRect(), h = e.querySelector('thead').getBoundingClientRect(), r = e.querySelector('.sg-table__pinned tr').getBoundingClientRect(); return { head: h.bottom - b.top, pinned: r.top - b.top }; });
  ok('table: summary rows stick right under the header while the table scrolls', Math.abs(pinnedAt.head - pinnedAt.pinned) < 1, JSON.stringify(pinnedAt));
  const titleTops = await gg.evaluate((t) => [...new Set([...t.querySelectorAll('thead .sg-table__title')].map((e) => e.getBoundingClientRect().top.toFixed(1)))]);
  ok('table: with second header lines, every title still sits on one line', titleTops.length === 1, titleTops.join(' / '));
  ok('table: grouped columns share a group header (scope colgroup)', (await gg.locator('th[scope=colgroup]').count()) === 3);
  ok('table: summary rows are pinned above the data and blank where a value does not apply', (await gg.locator('.sg-table__pinned tr').count()) === 2 && (await gg.locator('.sg-table__pinned .sg-table__none').count()) === 0);

  /* states */
  const st = demo('table-states');
  await st.scrollIntoViewIfNeeded();
  await st.getByRole('button', { name: '다시 불러오기' }).click(); await p.waitForTimeout(100);
  ok('table: reloading dims the rows under a progress line', (await st.locator('.sg-table--loading').count()) === 1 && (await st.locator('.sg-table__busy').count()) === 1);
  /* the line is really painted: on the header's bottom edge, above it (it used to be clipped / hidden behind the header) */
  const busyLine = await st.evaluate((d) => { const s = d.querySelector('.sg-table__busy span').getBoundingClientRect(), h = d.querySelector('thead').getBoundingClientRect(); const hit = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2); return { onEdge: Math.abs(s.bottom - h.bottom) < 1, h: s.height, top: !!hit?.closest('.sg-table__busy') }; });
  ok('table: the progress line is visible on the header\'s bottom edge', busyLine.onEdge && busyLine.h >= 2 && busyLine.top, JSON.stringify(busyLine));
  await p.waitForTimeout(1700);
  await st.getByRole('switch', { name: '빈 결과 보기' }).click(); await p.waitForTimeout(200);
  ok('table: no rows shows the empty state', (await st.getByText('조건에 맞는 상품이 없어요').count()) === 1);
  await st.getByRole('button', { name: '필터 초기화' }).click(); await p.waitForTimeout(200);
  ok('table: its action brings the rows back', (await bodyRows(st.getByRole('grid')).count()) === 5);

  /* server mode */
  const sv = demo('table-server'), srv = sv.getByRole('grid');
  await sv.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  ok('server table: 20 rows; aria-rowcount tells the real total', (await srv.locator('tbody tr').count()) === 20 && (await srv.getAttribute('aria-rowcount')) === '5001');
  await sv.getByRole('button', { name: PAGER.name(2) }).click(); await p.waitForTimeout(80);
  const dim = await sv.locator('.sg-table--loading').count(), line = await sv.locator('.sg-table__busy').count();
  await p.waitForTimeout(600);
  ok('pagination + server: page 2 — the rows dim under a progress line, then the next 20', dim === 1 && line === 1 && (await sv.getByRole('button', { name: PAGER.name(2) }).getAttribute('aria-current')) === 'page' && (await sv.getByText('5,000건 중 21–40').count()) === 1);
  await srv.getByRole('button', { name: /금액/ }).click(); await p.waitForTimeout(700);
  const amounts = await srv.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => +tr.querySelectorAll('td')[3].textContent.replace(/[₩,]/g, '')));
  const arrowX = async () => (await sv.getByRole('button', { name: '이전 페이지' }).boundingBox()).x;
  const xs = [await arrowX()];
  for (const n of [3, 4, 5]) { await sv.getByRole('button', { name: PAGER.name(n), exact: true }).click(); await p.waitForTimeout(650); xs.push(await arrowX()); }
  await sv.getByRole('button', { name: PAGER.name(250) }).click(); await p.waitForTimeout(650); xs.push(await arrowX());
  ok('pagination: the arrows stay put while the window of pages moves (every slot the same width)', Math.max(...xs) - Math.min(...xs) < 0.5, xs.map((x) => x.toFixed(1)).join(' '));
  await sv.getByRole('button', { name: PAGER.name(1), exact: true }).click(); await p.waitForTimeout(650);
  ok('server table: sorting goes to the "server" (back to page 1, highest first)', amounts.every((v, i) => i === 0 || amounts[i - 1] >= v) && (await sv.getByRole('button', { name: PAGER.name(1) }).getAttribute('aria-current')) === 'page', amounts.slice(0, 4).join(','));

  /* 5,000 rows */
  const vd = demo('table-virtual'), big = vd.getByRole('grid'), vbox = vd.locator('.sg-table');
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
  const ring = await p.evaluate(() => { const a = document.activeElement; return { sticky: a.classList.contains('sg-table__sticky--last'), shadow: getComputedStyle(a).boxShadow }; });
  ok('virtual table: a focused cell in the last frozen column shows its focus ring', ring.sticky ? ring.shadow !== 'none' && /inset/.test(ring.shadow) : true, JSON.stringify(ring));
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
  const busy = await s.locator('.sg-stat[aria-busy=true]').count();
  await p.waitForTimeout(1400);
  ok('stat: skeletons while loading, then the numbers', busy === 4 && (await s.locator('.sg-stat[aria-busy=true]').count()) === 0 && /\d/.test(await s.locator('.sg-stat__value').first().textContent()));
  const deltas = await s.locator('.sg-stat__delta').evaluateAll((ds) => ds.map((d) => ({ good: d.dataset.good, text: d.textContent })));
  const consistent = deltas.every((d, i) => { const up = /증가/.test(d.text), down = /감소/.test(d.text), invert = i === 3; return (up && d.text.includes('+') && d.good === (invert ? 'bad' : 'good')) || (down && /[-−]/.test(d.text) && d.good === (invert ? 'good' : 'bad')); });
  ok('stat: the change is said in words; colour follows whether it is good (returns up = bad)', consistent && deltas[3].good === 'bad', deltas.map((d) => `${d.good}:${d.text}`).join(' | '));

  const l = demo('line'), plot = l.locator('.sg-chart__plot');
  await plot.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const pr = await plot.boundingBox();
  await p.mouse.move(pr.x + pr.width * 0.5, pr.y + pr.height * 0.5); await p.waitForTimeout(200);
  const tipTitle = await l.locator('.sg-chart__tip-title').textContent().catch(() => '');
  ok('line chart: hovering shows a crosshair and a tooltip with every series', !!tipTitle && (await l.locator('.sg-chart__tip-row').count()) === 2 && (await l.locator('.sg-chart__cross circle').count()) === 2, tipTitle);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  await plot.focus(); await p.keyboard.press('End'); await p.waitForTimeout(100);
  const said = await l.locator('[aria-live]').first().textContent();
  ok('line chart: focusable; End moves to the last point and announces it', said.startsWith('11/18') && said.includes('방문'), said);
  const key = l.getByRole('button', { name: '재방문' });
  await key.click(); await p.waitForTimeout(500);
  ok('line chart: a legend key hides its series (aria-pressed false)', (await key.getAttribute('aria-pressed')) === 'false' && (await l.locator('.sg-chart__line').count()) === 1);
  const other = l.getByRole('button', { name: '방문', exact: true });
  await other.click(); await p.waitForTimeout(200);
  ok('line chart: the last visible series cannot be hidden', (await other.getAttribute('aria-pressed')) === 'true');
  await key.click();
  ok('line chart: the full data is there as a table for screen readers', (await l.locator('table tbody tr').count()) === 30);

  const bar = demo('bar');
  await bar.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const grouped = await bar.locator('.sg-chart__bar').count();
  /* switching layouts moves the bars (position, width and height) on one progress: no frame jumps sideways. Read as
     each frame is painted: a ResizeObserver callback runs after the frame's animation callbacks and layout, just
     before paint (a dummy box resized every frame makes it run), and is paired with that frame's own timestamp, the
     clock loop() advances the morph by. A read in an animation callback of its own could run before the chart's and
     see the step before; performance.now() there also counts the work the frame ran first, so a long frame followed by
     a short one measured as a 4 ms frame and made an ordinary step look four times as fast */
  const { base, frames } = await bar.evaluate(async (el) => {
    const read = () => [...el.querySelectorAll('.sg-chart__bar')].map((e) => { const r = e.getBBox(); return [r.x, r.width]; });
    const box = document.createElement('div'); box.style.cssText = 'position: fixed; left: 0; top: 0; height: 1px; opacity: 0; pointer-events: none';
    document.body.append(box);
    const base = read(), out = []; let ts = 0, w = 1;
    const ro = new ResizeObserver(() => { if (ts) out.push([ts, read()]); }); ro.observe(box);
    el.querySelectorAll('[role=radio]')[1].click();
    for (let i = 0; i < 70; i++) { ts = await new Promise(requestAnimationFrame); box.style.width = `${(w = 3 - w)}px`; }
    await new Promise(requestAnimationFrame); ro.disconnect(); box.remove();
    return { base, frames: out };
  });
  /* a jump, three ways. A missed frame: no bar's edge holds still for a frame between two that move it, and no painted
     step of one is faster, for the time its frame covers, than 1.4 times both the step before it and the step after
     it; the spring's own steps change smoothly (from rest they grow frame by frame, so only a step larger than both
     its neighbours counts), while a frame held and then drawn with the next is about twice as fast, or 1.5 times for
     a short frame held into a long one. React's scheduler did this before each frame was drawn by its own callback
     (#85). Scaled: no step larger than about twice a steady frame's
     (4.3 px), each step scaled to the time its frame covers as loop() advances the morph (1 to 50 ms a step: motion.ts),
     so a frame the machine dropped is not a jump and a faster display counts in full. Unscaled: no single painted step,
     the first from the layout before the click included, covers more of a bar's whole travel than the morph's spring
     (the personality's smooth response, critically damped: charts.tsx useMorph) moves in three of loop()'s 50 ms steps,
     while a snap covers all of it */
  const morph = { response: motions[/motion=(\w+)/.exec(Q)?.[1] ?? 'lively'].smooth.response, damping: 1 };
  let most = 0; for (let t = 0; t < 1500; t++) most = Math.max(most, springAt(morph, (t + 150) / 1000) - springAt(morph, t / 1000));
  let jump = 0, moved = 0, raw = 0, share = 0;
  const first = base, final = frames.length ? frames[frames.length - 1][1] : base;
  const seq = [[null, base], ...frames];
  /* each painted step of each edge, as a speed (px per ms of the frame it was drawn in) */
  const speed = [];
  for (let i = 1; i < seq.length; i++) {
    const [t, bars] = seq[i], [t0, prev] = seq[i - 1];
    const dt = t0 === null ? 0 : Math.min(50, Math.max(1, t - t0)), per = dt ? 16.7 / dt : 0;
    let m = false;
    speed.push(bars.map((bx, k) => bx.map((v, j) => {
      const d = Math.abs(v - (prev[k]?.[j] ?? v)), whole = Math.abs((final[k]?.[j] ?? v) - (first[k]?.[j] ?? v));
      if (d > 0.05) m = true;
      jump = Math.max(jump, d * per); if (per) raw = Math.max(raw, d);
      if (whole > 1) share = Math.max(share, d / whole);
      return dt ? [d, d / dt] : [d, 0];
    })));
    if (m) moved++;
  }
  let missed = 0, worst = '';
  for (let i = 1; i < speed.length - 1; i++) speed[i].forEach((bx, k) => bx.forEach(([d, v], j) => {
    const [d0, v0] = speed[i - 1][k]?.[j] ?? [0, 0], [d1, v1] = speed[i + 1][k]?.[j] ?? [0, 0], around = Math.max(v0, v1);
    if (d < 0.05 && d0 > 0.5 && d1 > 0.5) { missed++; worst ||= `frame ${i + 1} held between steps of ${d0.toFixed(1)} and ${d1.toFixed(1)} px`; }
    else if (d > 1 && v > 1.4 * around) { missed++; worst ||= `frame ${i + 1}: ${d.toFixed(1)} px at ${(v / (around || 1)).toFixed(1)} × its neighbours`; }
  }));
  if (/rm=1/.test(Q)) ok('bar chart (reduced motion): grouped → stacked changes at once', moved <= 1, `${moved} moving frames`);
  else ok('bar chart: grouped → stacked slides the bars together and widens them over many frames (no jump)', moved >= 8 && missed === 0 && jump < 9 && share < most, `${moved} moving frames, ${missed} missed frames${worst ? ` (${worst})` : ''}, largest step ${jump.toFixed(1)} px per 60 Hz frame (${raw.toFixed(1)} px as drawn, ${(share * 100).toFixed(0)} % of its travel; limit ${(most * 100).toFixed(0)} %)`);
  await p.waitForTimeout(600);
  const stacked = await bar.locator('.sg-chart__bar').count();
  ok('bar chart: one bar per series and month, grouped and stacked', grouped === 18 && stacked === 18, `${grouped} / ${stacked}`);
  /* a stack is one bar: square on the baseline, only its top rounded, its pieces parted by a 2 px seam, at most 40 px wide */
  const shape = await bar.evaluate((el) => {
    const base = +el.querySelector('.sg-chart__axis').getAttribute('y1');
    return [...el.querySelectorAll('.sg-chart__col')].map((g) => {
      const ps = [...g.querySelectorAll('.sg-chart__bar')].map((e) => { const r = e.getBBox(); return { y: r.y, b: r.y + r.height, w: r.width, arcs: [...e.getAttribute('d').matchAll(/a([\d.]+)/g)].filter((m) => +m[1] > 0.01).length }; }).sort((a, b) => b.b - a.b);
      const seams = ps.slice(1).map((q, i) => ps[i].y - q.b);
      return { foot: ps[0].b - base, seams, w: Math.max(...ps.map((q) => q.w)), roundTop: ps[ps.length - 1].arcs === 2, roundBelow: ps.slice(0, -1).some((q) => q.arcs > 0 && q.y - ps[ps.length - 1].b > 6) };
    });
  });
  ok('bar chart: a stack stands square on the baseline with only its top rounded', shape.every((c) => Math.abs(c.foot) < 0.5 && c.roundTop && !c.roundBelow), JSON.stringify(shape[0]));
  ok('bar chart: …its pieces parted by 2 px seams, and at most 40 px wide', shape.every((c) => c.seams.every((g) => Math.abs(g - 2) < 0.3) && c.w <= 40.01), JSON.stringify(shape[0]));
  await bar.getByRole('radio', { name: '묶음' }).click(); await p.waitForTimeout(700);

  const ring = demo('donut').locator('.sg-donut__ring');
  await ring.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('donut: arrow keys pick a slice; the centre and the announcement say its share', (await demo('donut').locator('.sg-donut__label').textContent()) === '의류' && (await demo('donut').locator('[aria-live]').textContent()).includes('의류'));
  await ring.blur();

  /* a mouse resting on a slice — at its middle and right at its inner edge, where the lift moves the slice away from
     the pointer — picks that slice and keeps it (it used to drop and catch it again, bouncing for as long as it rested) */
  {
    const dn = demo('donut'), label = () => dn.locator('.sg-donut__label').textContent();
    await ring.scrollIntoViewIfNeeded();
    const g = await ring.evaluate((e) => { const b = e.getBoundingClientRect(), c = b.width / 2, r = c - 6;
      return { x: b.left, y: b.top, c, r, ri: r - 22, names: [...e.closest('.sg-donut').querySelectorAll('.sg-donut__name')].map((n) => n.textContent) }; });
    /* each slice's middle angle, from the legend's shares (the default ring: 22 px thick, 6 px in from the edge) */
    const shares = await dn.locator('.sg-donut__pct').evaluateAll((ns) => ns.map((n) => parseFloat(n.textContent)));
    const tot = shares.reduce((a, v) => a + v, 0);
    let acc = 0, wrong = [], bounce = 0;
    for (let i = 0; i < shares.length; i++) {
      const mid = ((acc + shares[i] / 2) / tot) * Math.PI * 2; acc += shares[i];
      for (const rad of [(g.r + g.ri) / 2, g.ri + 1.5]) {
        await p.mouse.move(g.x + g.c + Math.sin(mid) * rad, g.y + g.c - Math.cos(mid) * rad); await p.waitForTimeout(80);
        const changes = await dn.evaluate((el) => new Promise((res) => { const lab = el.querySelector('.sg-donut__label'); let n = 0; const o = new MutationObserver(() => n++); o.observe(lab, { childList: true, characterData: true, subtree: true }); setTimeout(() => { o.disconnect(); res(n); }, 500); }));
        bounce = Math.max(bounce, changes);
        const now = await label(); if (now !== g.names[i]) wrong.push(`${g.names[i]}@${rad.toFixed(0)}→${now}`);
      }
    }
    ok('donut (mouse): resting on a slice — middle or inner edge — picks it and it stays put', wrong.length === 0 && bounce === 0, `${wrong.join(', ')} / most changes while resting: ${bounce}`);
    await p.mouse.move(5, 5); await p.waitForTimeout(200);
  }
}

/* ================================================================ the dashboard example: the parts together */
await go('dashboard');
{
  const d = demo('dashboard');
  /* controls side by side are one height: the period switch and the download button (default size), the order filters */
  const hOf = (loc) => loc.evaluate((e) => e.getBoundingClientRect().height);
  const head = [await hOf(d.getByRole('radiogroup', { name: '기간' })), await hOf(d.getByRole('button', { name: '내려받기' }))];
  ok('dashboard: the period switch and the download button are the same height (40)', head.every((h) => Math.abs(h - 40) < 0.5), JSON.stringify(head));
  const before = await d.locator('.sg-stat__value').first().textContent();
  await d.getByRole('radio', { name: '30일' }).click(); await p.waitForTimeout(100);
  const busy = await d.locator('.sg-stat[aria-busy=true]').count();
  await p.waitForTimeout(1000);
  ok('dashboard: the period switch reloads the stats (skeletons, then the 30-day numbers)', busy === 4 && (await d.locator('.sg-stat[aria-busy=true]').count()) === 0 && (await d.locator('.sg-stat__value').first().textContent()) !== before);
  ok('dashboard: …and redraws the chart with 30 days', (await d.locator('.sg-chart').first().locator('table tbody tr').count()) === 30);
  await d.getByRole('radio', { name: '주문', exact: true }).click(); await p.waitForTimeout(600);
  ok('dashboard: the card\'s segmented control swaps the chart (one series)', (await d.locator('.sg-chart').first().locator('.sg-chart__line').count()) === 1 && (await d.getByRole('heading', { name: '일별 주문' }).count()) === 1);

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
  ok('dashboard: the product sheet opens, titled with the product, with its details', (await sheet.count()) === 1 && (await p.getByRole('dialog', { name: product }).count()) === 1 && (await sheet.locator('.sg-sparkline').count()) === 1 && (await sheet.getByRole('button', { name: /배송/ }).count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok('dashboard: Escape closes it and focus returns to the product', (await sheet.count()) === 0 && (await p.evaluate(() => document.activeElement?.className)) === 'dash__link');

  await d.getByRole('tab', { name: /주문/ }).click(); await p.waitForTimeout(500);
  const og = d.getByRole('grid', { name: '주문', exact: true });
  const fh = await d.getByRole('group', { name: '주문 필터' }).evaluate((g) => [...g.querySelectorAll('.sg-search, .sg-select')].map((e) => e.getBoundingClientRect().height));
  ok('dashboard: the order filters are one height (the filter bar\'s 32)', fh.length === 3 && fh.every((h) => Math.abs(h - 32) < 0.5), JSON.stringify(fh));
  ok('dashboard: the orders tab shows the first 15 of 5,000', (await og.locator('tbody tr').count()) === 15 && (await og.getAttribute('aria-rowcount')) === '5001');
  const boxes = og.locator('tbody input[type=checkbox]');
  await boxes.nth(0).click(); await boxes.nth(1).click(); await p.waitForTimeout(150);
  ok('dashboard: selecting rows brings up the bulk action', (await d.getByText('2건 선택').count()) === 1 && (await d.getByRole('button', { name: '배송 준비' }).count()) === 1);
  await d.getByRole('button', { name: '선택 해제' }).click(); await p.waitForTimeout(100);
  const status = d.getByRole('combobox', { name: /상태/ });
  await status.click(); await p.waitForTimeout(400); await p.getByRole('option', { name: '환불' }).click(); await p.waitForTimeout(300);
  const st = await og.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelector('.sg-tag')?.textContent));
  ok('dashboard: the status filter narrows the orders', st.length > 0 && st.every((s) => s === '환불'), `${st.length} rows`);
  await d.getByRole('searchbox', { name: '주문 찾기' }).or(d.getByRole('textbox', { name: '주문 찾기' })).first().fill('없는주문'); await p.waitForTimeout(300);
  ok('dashboard: no match shows the empty state, with a way out', (await d.getByText('조건에 맞는 주문이 없어요').count()) === 1);
  await d.locator('.sg-empty').getByRole('button', { name: '필터 초기화' }).click(); await p.waitForTimeout(300);
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

/* ================================================================ phone (touch, no hover) */
{
  const mctx = await b.newContext(engine === 'firefox' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false } : { ...pw.devices['iPhone 13'] });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(`${pw.ORIGIN}/${Q}#/charts`); await m.waitForTimeout(1200);
  /* hover styles only where there is hover: every :hover rule sits under @media (hover: hover), so a tapped control
     keeps no hover look once the finger lifts */
  const loose = await m.evaluate(() => { const bad = []; const walk = (rules, inHover) => { for (const r of rules) { if (r instanceof CSSMediaRule) walk(r.cssRules, inHover || /hover:\s*hover/.test(r.conditionText ?? r.media.mediaText)); else if (r.selectorText?.includes(':hover') && !inHover) bad.push(r.selectorText); else if (r.cssRules) walk(r.cssRules, inHover); } }; for (const sh of document.styleSheets) { try { walk(sh.cssRules, false); } catch {} } return bad; });
  ok('touch: no :hover rule outside @media (hover: hover)', loose.length === 0, loose.slice(0, 4).join(' | '));
  const d = m.locator('[data-demo=donut]'); await d.scrollIntoViewIfNeeded(); await m.waitForTimeout(900);
  const slice = (i) => d.locator('.sg-donut__slice').nth(i), center = () => d.locator('.sg-donut__label').textContent();
  const tapSlice = async (i) => { const pt = await slice(i).evaluate((e) => { const r = e.getBoundingClientRect(); let best = null; for (let y = r.top + 2; y < r.bottom - 2; y += 3) for (let x = r.left + 2; x < r.right - 2; x += 3) if (document.elementFromPoint(x, y) === e) { const dd = Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2); if (!best || dd < best.d) best = { x, y, d: dd }; } return best; }); await m.touchscreen.tap(pt.x, pt.y); await m.waitForTimeout(350); };
  const rest = await center();
  await tapSlice(1); const c1 = await center();
  await tapSlice(3); const c2 = await center();
  await tapSlice(3); const c3 = await center();
  ok('donut (touch): a tap selects a slice and it stays after the finger lifts; another tap moves it; the same tap clears it', c1 === '생활' && c2 === '문구' && c3 === rest, `${c1} → ${c2} → ${c3}`);
  await tapSlice(0); await m.touchscreen.tap(20, 200); await m.waitForTimeout(350);
  ok('donut (touch): tapping outside the chart clears the selection', (await center()) === rest);
  await m.goto(`${pw.ORIGIN}/${Q}#/table`); await m.waitForTimeout(1200);
  const row = m.locator('[data-demo=table-basic] tbody tr').nth(1); await row.scrollIntoViewIfNeeded(); await row.locator('th').tap(); await m.waitForTimeout(300);
  const rowBg = await row.locator('td').first().evaluate((e) => getComputedStyle(e).getPropertyValue('--_row-bg').trim());
  const bodyBg = await row.locator('td').first().evaluate((e) => getComputedStyle(e.closest('.sg-table')).getPropertyValue('--_row-bg').trim());
  ok('table (touch): a tapped row keeps no hover tint', rowBg === bodyBg, `${rowBg} vs ${bodyBg}`);
  /* a phone-width banner puts its button below the text (the narrow rule used to have no container to measure, so the
     button stayed beside the text and squeezed it into a column) */
  await m.goto(`${pw.ORIGIN}/${Q}#/feedback`); await m.waitForTimeout(1200);
  const nb = await m.locator('.docs__page .sg-banner--danger').evaluate((e) => { const t = e.querySelector('.sg-banner__text').getBoundingClientRect(), a = e.querySelector('.sg-banner__actions').getBoundingClientRect(); return { below: a.top - t.bottom, left: a.left - t.left, textW: t.width, mainW: e.querySelector('.sg-banner__main').getBoundingClientRect().width }; });
  ok('banner (phone): the button goes below the text, which keeps the full width', nb.below >= 6 && Math.abs(nb.left) < 1 && nb.textW >= nb.mainW - 1, JSON.stringify(nb));
  await mctx.close();
}

ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
