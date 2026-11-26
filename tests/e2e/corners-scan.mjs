// The nested-corners scan (design-language.md, 9. 모서리), shared by corners.mjs and the suites that measure a part of a
// page at full size (a2ui.mjs: an example in the gallery's sheet). Runs in the page: pass it to page.evaluate with
// { TOL, MIN, root }. The rules are in corners.mjs.
export const TOL = 2, MIN = 4;   /* ±2 px cannot be told apart */

export const scan = ({ TOL, MIN, root }) => {
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
