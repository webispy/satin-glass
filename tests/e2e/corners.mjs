// Nested corners stay concentric (design-language.md, 9. 모서리). On every docs page, in light and dark, find each
// visible box that sits in a corner of a larger visible box — both gaps to that corner equal (±1.5 px) and smaller
// than the outer radius — and check its radius against the outer radius minus the gap (at least 4 px, ±2 px). Capsules
// count by their real curve (half their height). Boxes far from a corner keep their own role radius and are not
// checked. Not checked: table cells (content, edge to edge), the docs' deliberately wrong examples
// ([data-corners-skip]), and nothing is measured against the docs' stages (demo frames and the phone mock stand for
// a screen, whose corners the library cannot know). Animations are stopped at rest first.
// usage: node tests/e2e/corners.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const PAGES = ['overview', 'material', 'colors', 'type', 'motion', 'buttons', 'inputs', 'selection', 'navigation', 'lists', 'feedback', 'overlays', 'display', 'table', 'charts', 'showcase', 'dashboard'];
const TOL = 2, MIN = 4;   /* ±2 px cannot be told apart */

const scan = (args) => {
  const { TOL, MIN } = args;
  for (const a of document.getAnimations()) { try { a.finish(); } catch { a.cancel(); } }
  const visible = (el, cs) => {
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || cs.display === 'none') return false;
    const bg = cs.backgroundColor, img = cs.backgroundImage;
    const painted = (bg && !/rgba\(.*,\s*0\)$/.test(bg) && bg !== 'transparent') || (img && img !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) > 0;
    return painted;
  };
  const radius = (cs, r, corner) => {
    const v = parseFloat(cs[`border${corner}Radius`]) || 0;
    return Math.min(v, r.width / 2, r.height / 2);
  };
  const corners = [['TopLeft', 'left', 'top'], ['TopRight', 'right', 'top'], ['BottomLeft', 'left', 'bottom'], ['BottomRight', 'right', 'bottom']];
  const out = [];
  const label = (el) => (el.getAttribute('class') || el.tagName.toLowerCase()).split(/\s+/).filter((c) => c.startsWith('sg-') || !c.includes('-')).slice(0, 2).join('.') || el.tagName.toLowerCase();
  const stage = (n) => n.classList.contains('demo') || n.classList.contains('phone') || n.classList.contains('phone__screen') || n.classList.contains('sg-nav') || n.classList.contains('sg-media');   /* screens: bars are not fitted to them */
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-corners-skip], th, td')) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    /* the nearest painted ancestor with rounded corners */
    let p = el.parentElement, pcs = null;
    for (; p && p !== document.body && !stage(p); p = p.parentElement) { pcs = getComputedStyle(p); if (visible(p, pcs) && parseFloat(pcs.borderTopLeftRadius) + parseFloat(pcs.borderBottomRightRadius) > 0) break; }
    if (!p || p === document.body || stage(p)) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width <= r.width + 1 && pr.height <= r.height + 1) continue;   /* same box (a fill layer of its parent) */
    for (const [c, h, v] of corners) {
      const R = radius(pcs, pr, c); if (R < 6) continue;
      const gx = h === 'left' ? r.left - pr.left : pr.right - r.right, gy = v === 'top' ? r.top - pr.top : pr.bottom - r.bottom;
      if (gx < -0.5 || gy < -0.5 || Math.abs(gx - gy) > TOL || Math.max(gx, gy) >= R) continue;
      const g = (gx + gy) / 2, want = Math.max(MIN, R - g), have = radius(cs, r, c);
      if (g < 0.5 && have <= R + TOL) continue;           /* flush: clipped by the parent (overflow) or the same curve */
      if (Math.abs(have - want) > TOL && !(have >= r.height / 2 - 0.5 && want >= r.height / 2 - 0.5)) {
        out.push(`${label(el)} in ${label(p)} @${c}: r ${have.toFixed(1)} (want ${want.toFixed(1)} = ${R.toFixed(1)} − ${g.toFixed(1)})`);
      }
    }
  }
  return [...new Set(out)];
};

for (const mode of ['light', 'dark']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: mode });
  for (const page of PAGES) {
    await p.goto(`http://localhost:4173/?mode=${mode}&rm=1#/${page}`); await p.waitForTimeout(700);
    const bad = await p.evaluate(scan, { TOL, MIN });
    ok(`concentric corners · ${page} · ${mode}`, bad.length === 0, bad.slice(0, 6).join(' ;; ') + (bad.length > 6 ? ` … (+${bad.length - 6})` : ''));
  }
  await p.close();
}
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
