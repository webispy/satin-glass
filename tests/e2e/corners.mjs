// Nested corners (design-language.md, 9. 모서리). For each visible box that sits in a corner of a larger painted,
// rounded box, measure the two gaps at that corner and apply the rules in order:
//   1. flush (gap 0): the outer must clip it (overflow hidden / clip) or share its curve
//   2. equal gaps (±2 px) under the outer radius R: radius R − g, at least 4 px (±2 px)
//   3. a gap at or over R, or unequal gaps (one side only, centred): its own role radius — not checked here
// Radii are read as the browser draws them: % and elliptical values resolved, and scaled down when adjacent radii
// overlap (CSS Backgrounds 3, corner overlap). Not checked: table cells (content, edge to edge), the docs'
// deliberately wrong examples ([data-corners-skip]), and nothing is measured against the docs' stages (demo frames,
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
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOL = 2, MIN = 4;   /* ±2 px cannot be told apart */

const scan = ({ TOL, MIN, root }) => {
  for (const a of document.getAnimations()) { try { a.finish(); } catch { a.cancel(); } }
  const visible = (el, cs) => {
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || cs.display === 'none') return false;
    const bg = cs.backgroundColor, img = cs.backgroundImage;
    return (bg && !/rgba\(.*,\s*0\)$/.test(bg) && bg !== 'transparent') || (img && img !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) > 0;
  };
  /* the radius each corner is drawn with: % and elliptical values resolved, then the corner-overlap scale applied */
  const NAMES = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
  const radii = (cs, r) => {
    const one = (c) => { const [h, v = h] = cs[`border${c}Radius`].split(' '); const px = (x, side) => (x.endsWith('%') ? (parseFloat(x) / 100) * side : parseFloat(x) || 0); return { h: px(h, r.width), v: px(v, r.height) }; };
    const q = Object.fromEntries(NAMES.map((c) => [c, one(c)]));
    const f = Math.min(1, r.width / (q.TopLeft.h + q.TopRight.h || 1e9), r.width / (q.BottomLeft.h + q.BottomRight.h || 1e9), r.height / (q.TopLeft.v + q.BottomLeft.v || 1e9), r.height / (q.TopRight.v + q.BottomRight.v || 1e9));
    return Object.fromEntries(NAMES.map((c) => [c, Math.min(q[c].h, q[c].v) * f]));
  };
  const clips = (cs) => /hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY);
  const corners = [['TopLeft', 'left', 'top'], ['TopRight', 'right', 'top'], ['BottomLeft', 'left', 'bottom'], ['BottomRight', 'right', 'bottom']];
  const out = []; let pairs = 0;
  const label = (el) => (el.getAttribute('class') || el.tagName.toLowerCase()).split(/\s+/).filter((c) => c.startsWith('sg-') || c.startsWith('fx-') || !c.includes('-')).slice(0, 2).join('.') || el.tagName.toLowerCase();
  const stage = (n) => n.classList.contains('demo') || n.classList.contains('phone') || n.classList.contains('phone__screen') || n.classList.contains('sg-nav') || n.classList.contains('sg-media');
  const scope = root ? document.querySelectorAll(root) : [document.body];
  for (const top of scope) for (const el of top.querySelectorAll('*')) {
    if (el.closest('[data-corners-skip], th, td')) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    /* the nearest painted ancestor with rounded corners; on the way, whether anything clips */
    let p = el.parentElement, pcs = null, clipped = false;
    for (; p && p !== document.body && !stage(p); p = p.parentElement) {
      pcs = getComputedStyle(p);
      if (visible(p, pcs) && parseFloat(pcs.borderTopLeftRadius) + parseFloat(pcs.borderBottomRightRadius) > 0) break;
      if (clips(pcs)) clipped = true;
    }
    if (!p || p === document.body || stage(p)) continue;
    if (clips(pcs)) clipped = true;
    const pr = p.getBoundingClientRect();
    if (pr.width <= r.width + 1 && pr.height <= r.height + 1) continue;   /* same box (a fill layer of its parent) */
    const PR = radii(pcs, pr), CR = radii(cs, r);
    for (const [c, h, v] of corners) {
      const R = PR[c]; if (R < 6) continue;
      const gx = h === 'left' ? r.left - pr.left : pr.right - r.right, gy = v === 'top' ? r.top - pr.top : pr.bottom - r.bottom;
      if (gx < -0.5 || gy < -0.5 || Math.abs(gx - gy) > TOL || Math.max(gx, gy) >= R) continue;   /* rule 3: its own role */
      pairs++;
      const g = (gx + gy) / 2, have = CR[c];
      if (g < 0.5) {   /* rule 1: flush — clipped, or the same curve */
        if (!clipped && Math.abs(have - R) > TOL) out.push(`${label(el)} flush in ${label(p)} @${c}: r ${have.toFixed(1)}, not clipped (want clipping or ${R.toFixed(1)})`);
        continue;
      }
      const want = Math.max(MIN, R - g);   /* rule 2 */
      if (Math.abs(have - want) > TOL && !(have >= r.height / 2 - 0.5 && want >= r.height / 2 - 0.5)) {
        out.push(`${label(el)} in ${label(p)} @${c}: r ${have.toFixed(1)} (want ${want.toFixed(1)} = ${R.toFixed(1)} − ${g.toFixed(1)})`);
      }
    }
  }
  return { bad: [...new Set(out)], pairs };
};

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
