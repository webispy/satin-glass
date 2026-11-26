// Right to left by the nearest dir attribute, through the docs' production build (whose CSS minifier would rewrite a
// :dir() selector into a list of right-to-left languages): the data table's column line and a meter's growth move to
// the inline start and end, an LTR section inside an RTL page stays left to right, a navigation stack's edge shadow
// follows the direction its motion uses, and the drawer's header pads its start.
// usage: node tests/e2e/rtl.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173, PORT=… to change)
// covers: data, navigation, overlays, layout, foundation   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const PORT = process.env.PORT || 4173;
const b = await pw[engine].launch(engine === 'firefox' ? { firefoxUserPrefs: { 'network.security.ports.banned.override': String(PORT) } } : {});
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id) => `http://localhost:${PORT}/?lang=en#/${id}`;
const errors = [];
const page = async (id) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(U(id)); await p.waitForSelector('.docs__page'); await p.waitForTimeout(800);
  return p;
};

{
  const p = await page('table');
  const t = await p.evaluate(() => {
    /* a cell with a column line drawn (the demo's columnLines="groups"): its line's layer, the second background */
    const td = document.querySelector('.sg-table td.sg-table__vline'), table = td.closest('.sg-table'), host = table.parentElement;
    const line = (el) => getComputedStyle(el).backgroundPosition.split(',')[1].trim();
    const drawn = getComputedStyle(td).backgroundImage.split('linear-gradient').length > 2 && !/rgba\(0, 0, 0, 0\)\)$/.test(getComputedStyle(td).backgroundImage);
    /* a fling placeholder row, as the table draws one on a fast scroll: the bar's place and the line's */
    const tr = document.createElement('tr'); tr.className = 'sg-table__fling';
    for (const bar of [null, '', 'end', 'center']) { const c = document.createElement('td'); if (bar !== null) c.dataset.bar = bar; tr.append(c); }
    td.closest('tbody').append(tr);
    const fling = () => [...tr.children].map((c) => getComputedStyle(c).backgroundPosition.replace(/\s+/g, ' '));
    const ltr = { line: line(td), fling: fling() };
    document.documentElement.dir = 'rtl';
    const rtl = { line: line(td), fling: fling() };
    td.setAttribute('dir', 'ltr'); const ownDir = line(td); td.removeAttribute('dir');   /* a cell with its own dir keeps the table's side */
    host.setAttribute('dir', 'ltr'); const nested = line(td); host.removeAttribute('dir');
    document.documentElement.dir = ''; tr.remove();
    return { drawn, ltr, rtl, ownDir, nested };
  });
  ok('table: the column line is drawn at the inline end (right, then left right to left)', t.drawn && t.ltr.line.startsWith('100%') && t.rtl.line.startsWith('0%'), JSON.stringify({ drawn: t.drawn, ltr: t.ltr.line, rtl: t.rtl.line }));
  ok('table: a cell with its own dir keeps the line on the table\'s side', t.ownDir === t.rtl.line, JSON.stringify(t.ownDir));
  ok('table: an LTR section inside an RTL page stays left to right', t.nested === t.ltr.line, JSON.stringify(t.nested));
  /* fling cells: [plain, bar at start, bar at end, centred bar]; the bar layer leads where there is one */
  const startOf = (pos) => pos.split(',')[0].trim();
  /* 12 px in from the start (left 12px) is `12px` left to right and `calc(100% - 12px)` right to left, and the reverse
     for a bar at the end; the line (the layer after the bar) is at 100 % or 0 % */
  const IN = '12px', FAR = 'calc(100% - 12px)', lineOf = (pos) => pos.split(',').at(-2).trim();
  ok('table: fling placeholders mirror (the bar at the start or end, the line at the end)',
    startOf(t.ltr.fling[1]).startsWith(IN) && startOf(t.rtl.fling[1]).startsWith(FAR) && startOf(t.ltr.fling[2]).startsWith(FAR) && startOf(t.rtl.fling[2]).startsWith(IN)
    && t.ltr.fling.every((f) => lineOf(f).startsWith('100%')) && t.rtl.fling.every((f) => lineOf(f).startsWith('0%')), JSON.stringify({ ltr: t.ltr.fling, rtl: t.rtl.fling }));
  await p.context().close();
}
{
  const p = await page('charts');
  const m = await p.evaluate(() => ['.sg-meter__fill', '.sg-barmeter__fill'].map((sel) => [...document.querySelectorAll(sel)].find((f) => f.offsetWidth > 0)).filter(Boolean).map((f) => {
    const w = f.offsetWidth, o = () => parseFloat(getComputedStyle(f).transformOrigin);   /* its own width, before the fill's scale */
    const ltr = o(); document.documentElement.dir = 'rtl'; const rtl = o(); document.documentElement.dir = '';
    return { kind: f.className, ltr, rtl, w };
  }));
  ok('meter and bar meter: the fill grows from the inline start', m.some((x) => /barmeter/.test(x.kind)) && m.some((x) => !/barmeter/.test(x.kind)) && m.every((x) => x.ltr === 0 && Math.abs(x.rtl - x.w) < 1), JSON.stringify(m));
  await p.context().close();
}
for (const dir of ['ltr', 'rtl']) {
  const p = await page('lists');
  await p.evaluate((d) => { document.documentElement.dir = d; }, dir);
  await p.locator('[data-demo="nav-stack"] .sg-list-item', { hasText: 'Profile' }).first().click(); await p.waitForTimeout(900);
  const n = await p.evaluate(() => { const s = document.querySelector('[data-demo="nav-stack"] .sg-nav'), pg = s.querySelector('.sg-nav__page:not([data-depth="0"])');
    const x = parseFloat(getComputedStyle(pg).boxShadow.replace(/rgba?\([^)]*\)/, '').trim()); return { mark: s.hasAttribute('data-sg-rtl'), x }; });
  ok(`navigation stack (${dir}): the pushed page's edge shadow is on its start side`, dir === 'rtl' ? n.mark && n.x > 0 : !n.mark && n.x < 0, JSON.stringify(n));
  await p.context().close();
}
for (const dir of ['ltr', 'rtl']) {
  const p = await page('overlays');
  await p.evaluate((d) => { document.documentElement.dir = d; }, dir);
  await p.getByRole('button', { name: 'Open filters' }).click(); await p.waitForTimeout(700);
  const d = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('.sg-drawer__header')); return [parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)]; });
  ok(`drawer (${dir}): the header pads its start 20 px and its end 10 px`, dir === 'rtl' ? d[0] === 10 && d[1] === 20 : d[0] === 20 && d[1] === 10, JSON.stringify(d));
  await p.context().close();
}

ok('no page errors during the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
