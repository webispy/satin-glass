// Nested corners (design-language.md, 9. 모서리). For each visible box that sits in a corner of a larger painted,
// rounded box, measure the two gaps at that corner and apply the rules in order:
//   1. flush (gap 0): the outer must clip it (overflow hidden / clip) or share its curve
//   2. equal gaps (±2 px) under the outer radius R: radius R − g, at least 4 px (±2 px)
//   3. a gap at or over R, or unequal gaps (one side only, centred): its own role radius — not checked here
// Radii are read as the browser draws them: % and elliptical values resolved, and scaled down when adjacent radii
// overlap (CSS Backgrounds 3, corner overlap). Not checked: table cells (content, edge to edge), the docs'
// deliberately wrong examples and the A2UI gallery's scaled-down pictures ([data-corners-skip]: at 0.58 the gaps and
// radii round apart), and nothing is measured against the docs' stages (demo frames,
// the phone mock, navigation stack, media viewer: they stand for a screen, whose corners the library cannot know).
// Runs on every docs page the router knows (read from apps/docs/src/routes.ts), in light and dark, at desktop and
// phone width; then with a menu, a select list, a time panel and an action sheet open. Fixtures first:
// a wrong radius and an unclipped flush box must be caught, a right one and an off-centre one must pass, and a page
// pass (a theme at a width) or an open panel that compares nothing fails — a check that sees nothing proves nothing
// (a single page may have no nested corners in view). Animations are stopped at rest first.
// usage: node tests/e2e/corners.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { PAGES } from './pages.mjs';
import { scan, TOL, MIN } from './corners-scan.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

/* ---------------------------------------------------------------- fixtures: the check must catch what it is for */
{
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  await p.goto('http://localhost:4173/?mode=light#/overview'); await p.waitForTimeout(500);
  const fx = async (html) => p.evaluate(({ html, TOL, MIN, scan }) => {
    const host = document.createElement('div'); host.className = 'fx-host'; host.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99999';
    host.innerHTML = html; document.body.appendChild(host);
    const res = new Function(`return (${scan})`)()({ TOL, MIN, root: '.fx-host' });
    host.remove(); return res;
  }, { html, TOL, MIN, scan: scan.toString() });
  const box = (r, pad, inner, extra = '', size = 'height:100%') => `<div class="fx-outer" style="width:200px;height:120px;padding:${pad};border-radius:${r}px;background:#ddd;${extra}"><div class="fx-inner" style="${size};border-radius:${inner};background:#888"></div></div>`;
  const right = await fx(box(22, '6px', '16px')), wrong = await fx(box(22, '6px', '22px')), unclipped = await fx(box(22, '0', '0', '', 'width:60%;height:60%')), clippedOk = await fx(box(22, '0', '0', 'overflow:hidden', 'width:60%;height:60%'));
  const offCentre = await fx(box(22, '0 6px', '0'));   /* 6 px at the sides only: not concentric, not checked */
  const pct = await fx(box(22, '6px', '8%'));          /* 8 % of 188 px wide = 15 px across, 9 px down: drawn as 9 */
  ok('fixture: R − g is accepted (22 − 6 = 16)', right.bad.length === 0 && right.pairs > 0, JSON.stringify(right));
  ok('fixture: a wrong radius is caught (22 in 22 with a 6 px gap)', wrong.bad.length > 0, JSON.stringify(wrong.bad));
  ok('fixture: a flush square box in an unclipped round box is caught', unclipped.bad.length > 0, JSON.stringify(unclipped.bad));
  ok('fixture: the same box clipped by its parent passes', clippedOk.bad.length === 0, JSON.stringify(clippedOk.bad));
  ok('fixture: unequal gaps (sides only) are left to the role radius', offCentre.bad.length === 0, JSON.stringify(offCentre.bad));
  ok('fixture: a % radius is read as drawn (elliptical: the smaller axis)', pct.bad.length > 0 && /r 9\./.test(pct.bad[0] || ''), JSON.stringify(pct.bad));
  await p.close();
}

/* ---------------------------------------------------------------- every page, two themes, two widths */
let total = 0;
for (const mode of ['light', 'dark']) for (const [w, h] of [[1280, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: mode });
  let seen = 0;
  for (const page of PAGES) {
    await p.goto(`http://localhost:4173/?mode=${mode}&rm=1#/${page}`); await p.waitForTimeout(600);
    const { bad, pairs } = await p.evaluate(scan, { TOL, MIN });
    seen += pairs;
    ok(`concentric corners · ${page} · ${mode} · ${w} (${pairs} compared)`, bad.length === 0, bad.slice(0, 5).join(' ;; ') + (bad.length > 5 ? ` … (+${bad.length - 5})` : ''));
  }
  ok(`corners were compared · ${mode} · ${w}`, seen > 20, `${seen}`);
  total += seen;
  await p.close();
}

/* ---------------------------------------------------------------- with panels open */
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const open = async (page, name, click, root) => {
    await p.goto(`http://localhost:4173/?mode=light&rm=1#/${page}`); await p.waitForTimeout(600);
    await click(); await p.waitForTimeout(500);
    const { bad, pairs } = await p.evaluate(scan, { TOL, MIN, root });
    ok(`concentric corners · ${name} open`, bad.length === 0 && pairs > 0, pairs === 0 ? 'nothing compared' : bad.slice(0, 5).join(' ;; '));
  };
  await open('overlays', 'menu (an item under the pointer)', async () => { await p.getByRole('button', { name: /길찾기/ }).first().click(); await p.waitForTimeout(400); await p.locator('.sg-portal .sg-menu__item').last().hover(); }, '.sg-portal');
  await open('selection', 'select list', () => p.locator('.sg-select').first().click(), '.sg-portal');
  await open('selection', 'time panel', () => p.getByRole('button', { name: /회의 시작/ }).click(), '.sg-portal');
  await open('overlays', 'action sheet (an action under the pointer)', async () => { await p.getByRole('button', { name: /공유 옵션/ }).first().click(); await p.waitForTimeout(500); await p.locator('.sg-portal .sg-actionsheet__action').last().hover(); }, '.sg-portal');
  await p.close();
}
ok('pairs were compared across the run', total > 100, `${total}`);

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
