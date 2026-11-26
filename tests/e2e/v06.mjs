// The 0.6 parts on their docs pages (#1): ColumnChooser, Combobox `multiple`, FilterBar, Tabs `variant="pill"` and
// ScatterChart.
// ColumnChooser: a group's own checkbox is indeterminate while the group is partly shown and shows or hides it whole;
// the sticky column is locked, so hiding everything else leaves it; hiding the sorted column ends the sort; Escape
// gives the focus back. (The last shown column that is not sticky cannot be hidden either: no docs table has one, so
// that is a unit test.) Combobox multiple: choosing toggles and keeps the list open; Backspace in the empty field
// removes the last chip; past `maxChips` a count stands in for the chips. FilterBar: a named group; the count and
// clear appear with the first criterion; clear resets them all and puts the focus on the first control. Pill tabs:
// they wrap, the selected pill is the raised one, and the keys are the underline tabs'. ScatterChart: the log/linear
// switch moves the points and brings them back; the highlighted points are labelled apart, inside the plot; the arrow
// keys go through the points from the left, reading each aloud.
// Every read waits until what it checks holds (at most 3 s) rather than after a fixed pause, so a busy machine slows
// the suite down instead of failing it.
// usage: node tests/e2e/v06.mjs   (BROWSER=webkit|firefox; E2E_PORT (default 4173); Q for settings)
// covers: data, selection, navigation, controls, overlays
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const wait = (ms) => p.waitForTimeout(ms);
/** the value of `f` once it is truthy, or its last value after `ms` */
const until = async (f, ms = 3000) => {
  const end = Date.now() + ms;
  let v;
  for (;;) {
    v = await f().catch(() => undefined);
    if (v || Date.now() > end) return v;
    await wait(50);
  }
};
const go = async (route) => { await p.goto(`${pw.ORIGIN}/${Q}#/${route}`); await p.waitForSelector('main .docs__page > *'); await wait(600); };
const isFocused = (l) => l.evaluate((e) => e === document.activeElement);

/* ================================================================ ColumnChooser */
await go('table');
{
  const demo = p.locator('[data-demo="table-groups"]');
  await demo.scrollIntoViewIfNeeded();
  const button = demo.locator('.sg-colchooser__button'), panel = p.locator('.sg-colchooser');
  const box = (name) => panel.getByRole('checkbox', { name, exact: true });
  const heads = () => demo.locator('thead th[scope="col"]').allTextContents().then((l) => l.map((s) => s.trim()));
  const sortedHeads = () => demo.locator('thead th[aria-sort="ascending"], thead th[aria-sort="descending"]').allTextContents();
  const open = async () => { if (!(await panel.isVisible())) { await button.click(); await panel.waitFor(); } };
  const close = async () => { await p.keyboard.press('Escape'); return panel.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false); };

  await open();
  const sales = box('판매');
  ok('column chooser: a partly shown group\'s own checkbox is indeterminate', await until(() => sales.evaluate((e) => e.indeterminate && !e.checked)));
  await sales.click();
  ok('column chooser: the group\'s checkbox shows the whole group', await until(async () => await sales.evaluate((e) => e.checked && !e.indeterminate) && (await heads()).some((h) => h.startsWith('반품률'))), (await heads()).join(' | '));
  await sales.click();
  ok('column chooser: and hides the whole group', await until(async () => await sales.evaluate((e) => !e.checked && !e.indeterminate) && !(await heads()).some((h) => /^(판매량|매출|반품률)/.test(h))), (await heads()).join(' | '));
  ok('column chooser: the sticky column is locked', await box('상품').isDisabled() && await box('상품').isChecked());

  /* hide everything that can be hidden: the sticky column stays */
  for (let guard = 0; guard < 20; guard++) {
    const next = panel.locator('input[type="checkbox"]:checked:not(:disabled)');
    const n = await next.count();
    if (!n) break;
    await next.first().click();
    await until(async () => (await next.count()) < n);
  }
  ok('column chooser: hiding all the rest leaves the sticky column', await until(async () => { const l = await heads(); return l.length === 1 && l[0].startsWith('상품'); }), (await heads()).join(' | '));
  await panel.getByRole('button', { name: '모두 보기' }).click();
  ok('column chooser: show all brings every column back', await until(async () => (await heads()).length === 10), (await heads()).length);

  ok('column chooser: Escape closes it and the focus goes back to its button', await close() && await until(() => isFocused(button)));

  /* the sorted column hidden: the sort ends, and it is not sorted when it shows again */
  await demo.locator('thead').getByRole('button', { name: /평점/ }).click();
  const sorted = await until(async () => { const l = await sortedHeads(); return l.length === 1 && /평점/.test(l[0]) ? l : null; });
  await open();
  await box('평점').click();
  const ended = await until(async () => (await sortedHeads()).length === 0 && !(await heads()).some((h) => h.startsWith('평점')));
  ok('column chooser: hiding the sorted column ends the sort', !!sorted && ended, `sorted ${JSON.stringify(sorted)}`);
  await box('평점').click();
  ok('column chooser: shown again, the column is not sorted (the sort ended, it was not only out of sight)',
    await until(async () => (await heads()).some((h) => h.startsWith('평점'))) && (await sortedHeads()).length === 0, JSON.stringify(await sortedHeads()));
  await close();
}

/* ================================================================ FilterBar */
{
  const demo = p.locator('[data-demo="filterbar"]');
  await demo.scrollIntoViewIfNeeded();
  const bar = demo.getByRole('group', { name: '상품 필터' });
  const clear = bar.getByRole('button', { name: '초기화' }), count = bar.locator('.sg-filterbar__count');
  const category = bar.getByRole('combobox', { name: /분류/ }), search = bar.getByRole('searchbox');
  const said = () => count.textContent().catch(() => null);
  ok('filter bar: a named group, with no count or clear while nothing applies', await bar.count() === 1 && await clear.count() === 0 && await count.count() === 0);
  await bar.getByRole('button', { name: '재고 있음' }).click();
  ok('filter bar: the first criterion shows the count and clear', await until(async () => (await said()) === '필터 1개' && await clear.isVisible()), await said());
  await bar.getByRole('button', { name: '3만 원 미만' }).click();
  await search.fill('a');
  await category.click();
  await p.getByRole('option', { name: '주방' }).click();
  ok('filter bar: each criterion counts (chips, search and the filter select)', await until(async () => (await said()) === '필터 4개'), await said());
  await clear.click();
  ok('filter bar: clear resets every criterion and goes away with the count', await until(async () => await bar.locator('[aria-pressed="true"]').count() === 0 && await search.inputValue() === ''
    && (await category.textContent()).replace(/\s+/g, '') === '분류전체' && await clear.count() === 0 && await count.count() === 0), (await category.textContent()).replace(/\s+/g, ''));
  ok('filter bar: and the focus goes to the first control', await until(() => isFocused(search)), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
}

/* ================================================================ Combobox multiple */
await go('selection');
{
  const demo = p.locator('[data-demo="combobox-multiple"]');
  await demo.scrollIntoViewIfNeeded();
  const cb = demo.getByRole('combobox', { name: '방문할 도시' });
  const field = demo.locator('.sg-combobox').first();
  const chips = () => field.locator('.sg-combobox__chip-text').allTextContents().then((l) => l.join());
  const list = p.getByRole('listbox'), option = (name) => list.getByRole('option', { name });
  const opened = async () => await cb.getAttribute('aria-expanded') === 'true' && await list.isVisible();
  const shut = async (input) => { await p.keyboard.press('Escape'); if (!(await until(async () => await input.getAttribute('aria-expanded') === 'false', 800))) await p.keyboard.press('Escape'); await until(async () => await input.getAttribute('aria-expanded') === 'false'); };
  ok('combobox multiple: the chosen values are chips', (await chips()) === '서울,부산', await chips());
  await cb.click();
  await until(opened);
  ok('combobox multiple: the list is multi-selectable', await list.getAttribute('aria-multiselectable') === 'true');
  await option('인천').click();
  ok('combobox multiple: choosing adds a chip and keeps the list open', await until(async () => (await chips()) === '서울,부산,인천' && await opened() && await isFocused(cb)), await chips());
  ok('combobox multiple: the chosen option is marked', await option('인천').getAttribute('aria-selected') === 'true');
  await option('인천').click();
  ok('combobox multiple: choosing it again takes it away, and the list stays open', await until(async () => (await chips()) === '서울,부산' && await opened() && await option('인천').getAttribute('aria-selected') === 'false'), await chips());
  await shut(cb);
  await cb.focus(); await p.keyboard.press('Backspace');
  ok('combobox multiple: Backspace in the empty field removes the last chip', await until(async () => (await chips()) === '서울'), await chips());
  await shut(cb);

  const filter = demo.locator('.sg-combobox').nth(1), fcb = filter.getByRole('combobox');
  const counted = () => filter.locator('.sg-combobox__count').textContent().catch(() => null);
  const fchips = () => filter.locator('.sg-combobox__chip-text').allTextContents().then((l) => l.join());
  ok('combobox multiple: past maxChips a count stands in for the chips', await filter.locator('.sg-combobox__chip').count() === 0 && (await counted()) === '도시 3곳', await counted());
  const mid = (l) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
  const off = Math.abs(await mid(filter.locator('.sg-combobox__count')) - await mid(fcb));
  ok('combobox multiple: and the count sits on the text\'s line, so the field stays one line high', off < 4, `${off.toFixed(1)} px apart`);
  /* back under the limit the chip returns; over it again, the count */
  await fcb.click();
  await until(async () => await fcb.getAttribute('aria-expanded') === 'true' && await list.isVisible());
  await option('부산').click();
  await until(async () => (await counted()) === '도시 2곳');
  await option('대구').click();
  ok('combobox multiple: down to maxChips, the chip comes back instead of the count', await until(async () => (await fchips()) === '서울' && await filter.locator('.sg-combobox__count').count() === 0), await fchips());
  await option('부산').click();
  ok('combobox multiple: and past it again, the count', await until(async () => await filter.locator('.sg-combobox__chip').count() === 0 && (await counted()) === '도시 2곳'), await counted());
  await shut(fcb);
}

/* ================================================================ Tabs, pill */
await go('navigation');
{
  const demo = p.locator('[data-demo="tabs-pill"]');
  await demo.scrollIntoViewIfNeeded();
  const tabs = demo.getByRole('tab'), tab = (name) => demo.getByRole('tab', { name, exact: true });
  const lines = await tabs.evaluateAll((l) => new Set(l.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  const listOver = await demo.getByRole('tablist').evaluate((e) => e.scrollWidth - e.clientWidth);
  ok('pill tabs: they wrap onto more lines rather than scroll', lines > 1 && listOver <= 0, `${lines} lines, ${listOver} px over`);
  ok('pill tabs: no underline', await demo.locator('.sg-tabs__indicator').count() === 0);
  const shadow = (name) => tab(name).evaluate((e) => getComputedStyle(e).boxShadow);
  ok('pill tabs: the selected pill is raised (a shadow), the others are not', await until(async () => (await shadow('추론')) !== 'none' && (await shadow('지식')) === 'none'), `${await shadow('추론')} · ${await shadow('지식')}`);
  /* the key moved the selection and the focus to the tab named */
  const at = (name) => until(async () => await tab(name).getAttribute('aria-selected') === 'true' && await isFocused(tab(name)));
  await tab('추론').focus();
  await p.keyboard.press('ArrowRight');
  ok('pill tabs: → selects the next', await at('코딩'));
  await p.keyboard.press('End');
  ok('pill tabs: End skips the disabled last one', await at('한국어'));
  await p.keyboard.press('ArrowRight');
  ok('pill tabs: → at the end wraps to the first', await at('모든 벤치마크'));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  const further = await at('추론');
  await p.keyboard.press('Home');
  ok('pill tabs: Home from further along goes back to the first', further && await at('모든 벤치마크'), `two → reached 추론: ${further}`);
  ok('pill tabs: the shadow follows the selection, and the pill left behind loses it',
    await until(async () => (await shadow('모든 벤치마크')) !== 'none' && (await shadow('추론')) === 'none'), `left behind: ${await shadow('추론')}`);
}

/* ================================================================ ScatterChart */
await go('charts');
{
  const demo = p.locator('[data-demo="scatter"]');
  await demo.scrollIntoViewIfNeeded();
  const plot = demo.locator('.sg-scatter');
  const points = () => plot.locator('circle.sg-scatter__point').evaluateAll((l) => l.map((c) => +c.getAttribute('cx')));
  const ticks = () => plot.locator('.sg-chart__tick').allTextContents();
  /* the points move on springs: at rest once five readings in a row, 100 ms apart, agree; null if not within 5 s */
  const settled = async () => {
    let last = await points(), same = 0;
    for (let i = 0; i < 50; i++) {
      await wait(100);
      const now = await points();
      same = now.length === last.length && now.length > 0 && now.every((x, j) => Math.abs(x - last[j]) < 0.05) ? same + 1 : 0;
      if (same >= 5) return now;
      last = now;
    }
    return null;
  };
  const log = await settled(), logTicks = await ticks();
  ok('scatter: the points come to rest', !!log && log.length > 5, `${log?.length} points`);
  await demo.getByRole('radio', { name: '선형 스케일' }).click();
  /* away from where they were before resting there, so a reading taken before the move started does not count */
  await until(async () => { const now = await points(); return now.some((x, i) => Math.abs(x - log[i]) > 2); });
  const lin = await settled(), linTicks = await ticks();
  const moved = lin ? lin.filter((x, i) => Math.abs(x - log[i]) > 2).length : 0;
  ok('scatter: the linear scale moves the points and the axis', moved > log.length / 2 && linTicks.join() !== logTicks.join(), `${moved}/${log.length} moved`);
  await demo.getByRole('radio', { name: '로그 스케일' }).click();
  /* back: every point reaches where it was (not merely stops) */
  const back = await until(async () => { const now = await points(); return now.length === log.length && now.every((x, i) => Math.abs(x - log[i]) < 0.5) ? now : null; }, 5000);
  ok('scatter: back on the log scale, every point is where it was', !!back, JSON.stringify((await points()).map((x, i) => +(x - log[i]).toFixed(1)).filter((d) => d)));

  /* the labels: one beside each highlighted (picked) point, apart, inside the plot area (the grid). Apart: two labels
     sharing some width have their lines at least a font size apart, measured from the line's middle and the font
     size, not the text's box, whose height is the font's whole line box in Firefox and the glyphs' in Chromium */
  const geo = await plot.evaluate((root) => {
    const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const labels = [...root.querySelectorAll('.sg-scatter__label')].map((e) => ({ ...box(e), y: (box(e).t + box(e).b) / 2, fs: parseFloat(getComputedStyle(e).fontSize), text: e.textContent,
      ax: +e.getAttribute('x'), end: e.getAttribute('text-anchor') === 'end' }));
    const picked = [...root.querySelectorAll('circle[data-picked]')].map((c) => +c.getAttribute('cx'));
    const grid = [...root.querySelectorAll('.sg-chart__grid')].map(box);
    const area = { l: Math.min(...grid.map((g) => g.l)), r: Math.max(...grid.map((g) => g.r)), t: Math.min(...grid.map((g) => g.t)), b: Math.max(...grid.map((g) => g.b)) };
    return { labels, picked, area };
  });
  const { labels, picked, area } = geo;
  const overlap = labels.some((a, i) => labels.some((c, j) => j > i && a.l < c.r && c.l < a.r && Math.abs(a.y - c.y) < Math.max(a.fs, c.fs)));
  const inside = labels.every((a) => a.l >= area.l - 0.5 && a.r <= area.r + 0.5 && a.y >= area.t - 0.5 && a.y <= area.b + 0.5);
  /* each label is anchored 10 px from a picked point's centre: after it, or before it (text-anchor end) near the right
     edge. Read from the SVG's own coordinates: engines measure a text's box from different side bearings */
  const beside = labels.every((a) => picked.some((cx) => Math.abs(a.ax - (a.end ? cx - 10 : cx + 10)) < 0.5));
  ok('scatter: the two highlighted points are labelled, each beside its point', picked.length === 2 && labels.length === 2 && beside, JSON.stringify({ labels: labels.map((a) => [a.text, a.ax, a.end]), picked }));
  ok('scatter: the labels sit apart and inside the plot area', !overlap && inside, JSON.stringify({ labels: labels.map((a) => [Math.round(a.l), Math.round(a.r), Math.round(a.y)]), area }));

  /* the arrow keys: from the left, one point at a time, each read aloud by its name, the one the tooltip shows */
  await plot.focus();
  const sortedX = [...log].sort((a, c) => a - c);
  const live = demo.locator('[aria-live="polite"]').last();
  const steps = [];
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press('ArrowRight');
    const step = await until(async () => {
      const x = await plot.locator('circle[data-active]').evaluate((c) => +c.getAttribute('cx'));
      const name = (await plot.locator('.sg-chart__tip-title').textContent())?.trim();
      const said = (await live.textContent())?.trim();
      return Math.abs(x - sortedX[i]) < 0.5 && name && said?.startsWith(name) ? { x, name, said } : null;
    });
    steps.push(step);
  }
  ok('scatter: → goes through the points from the left, reading each aloud by its name', steps.every(Boolean) && new Set(steps.map((s) => s.name)).size === 6,
    steps.map((s) => (s ? `${s.x.toFixed(0)} ${s.name}` : '—')).join(' / '));
  await p.keyboard.press('ArrowLeft');
  ok('scatter: ← steps back', await until(async () => Math.abs(await plot.locator('circle[data-active]').evaluate((c) => +c.getAttribute('cx')) - sortedX[4]) < 0.5));
}

ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 200));
await b.close();
process.exit(failed ? 1 : 0);
