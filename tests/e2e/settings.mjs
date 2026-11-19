// Settings decide at the nearest boundary (design-language.md, 4. 접근성 · 8. 깊이와 레이어):
//   · a dark island inside a light page draws dark shadows and dark depth (tokens re-declared on every theme element)
//   · a normal theme inside a high-contrast one gets its normal 1 px glass rim back; high contrast turns depth into
//     outlines; system high contrast without a theme attribute does too
//   · reduced motion: the nearest data-sg-reduce-motion decides for CSS springs (an inner "false" stops an outer
//     "true"), sibling areas do not affect each other, and the JS springs agree
//   · reduce transparency reaches portals: a menu opened with it on is solid, with no backdrop blur
//   · depth by role: floating dense glass vs an overlay, a light handle in every theme, a selection outline in high contrast
// usage: node tests/e2e/settings.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
await p.goto('http://localhost:4173/?mode=light#/overview'); await p.waitForTimeout(700);

/* ---------------------------------------------------------------- nested themes (CSS only) */
const r = await p.evaluate(() => {
  const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; };
  const host = mk(`
    <div data-sg-theme="light" id="L"><div data-sg-theme="dark" id="D"><span id="Dk"></span></div></div>
    <div data-sg-theme="light-hc" id="H"><div data-sg-theme="light" id="N"><div class="sg-glass" id="Ng" style="width:40px;height:20px"></div></div></div>
    <div data-sg-reduce-motion="true" data-sg-motion="lively" id="RT"><div data-sg-reduce-motion="false" data-sg-motion="calm" id="RF"><span id="RFk"></span></div></div>
    <div data-sg-reduce-motion="false" data-sg-motion="calm" id="S1"></div><div data-sg-reduce-motion="true" data-sg-motion="calm" id="S2"></div>`);
  const v = (id, k) => getComputedStyle(document.getElementById(id)).getPropertyValue(k).trim();
  const out = {
    lightShadow: v('L', '--sg-shadow-md'), darkShadow: v('Dk', '--sg-shadow-md'),
    darkDepth: v('Dk', '--sg-depth-raised'), lightDepth: v('L', '--sg-depth-raised'),
    hcDepth: v('H', '--sg-depth-inset'), innerRim: getComputedStyle(document.getElementById('Ng'), '::before').paddingTop,
    rtSnappy: v('RT', '--sg-spring-snappy-duration'), rfSnappy: v('RFk', '--sg-spring-snappy-duration'),
    s1: v('S1', '--sg-spring-snappy-duration'), s2: v('S2', '--sg-spring-snappy-duration'),
  };
  host.remove();
  return out;
});
ok('a dark island draws dark shadows (not the page\'s light ones)', r.darkShadow !== r.lightShadow, `${r.lightShadow.slice(0, 48)}… / ${r.darkShadow.slice(0, 48)}…`);
ok('a dark island draws its own depth', r.darkDepth !== r.lightDepth);
ok('high contrast turns depth into an outline', /inset 0(px)? 0(px)? 0(px)? 1px/.test(r.hcDepth), r.hcDepth);
ok('a normal theme inside high contrast gets its 1 px glass rim back', r.innerRim === '1px', r.innerRim);
ok('reduced motion: an inner "false" stops an outer "true" (calm springs inside)', r.rfSnappy !== r.rtSnappy, `outer ${r.rtSnappy}, inner ${r.rfSnappy}`);
ok('reduced motion: sibling areas decide for themselves', r.s1 !== r.s2, `${r.s1} / ${r.s2}`);

/* the JS springs read the same nearest setting */
const js = await p.evaluate(() => {
  const d = document.createElement('div');
  d.innerHTML = '<div data-sg-reduce-motion="true"><div data-sg-reduce-motion="false"><i id="jf"></i></div><i id="jt"></i></div><i id="jn"></i>';
  document.body.appendChild(d);
  const has = (id) => document.getElementById(id).closest('[data-sg-reduce-motion]')?.getAttribute('data-sg-reduce-motion') ?? 'system';
  const res = [has('jf'), has('jt'), has('jn')];
  d.remove(); return res;
});
ok('JS: the nearest setting decides (inner false, outer true, none → system)', js.join() === 'false,true,system', js.join());

/* ---------------------------------------------------------------- system high contrast without a theme attribute */
{
  const ctx = await b.newContext({ viewport: { width: 800, height: 600 } });
  const q = await ctx.newPage();
  if (engine === 'chromium') {
    const cdp = await ctx.newCDPSession(q);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: 'more' }] });
    await q.goto('http://localhost:4173/#/overview'); await q.waitForTimeout(500);
    const d = await q.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sg-depth-inset').trim());
    ok('system high contrast without a theme attribute: depth becomes outlines on :root', /1px/.test(d) && !/rgba/.test(d), d);
  }
  await ctx.close();
}

/* ---------------------------------------------------------------- depth by role (design-language.md 8) */
{
  const r = await p.evaluate(() => {
    const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; };
    const host = mk(`<div data-sg-theme="light"><div class="sg-glass sg-glass--strong" id="menu"></div><div class="sg-glass sg-glass--strong sg-glass--overlay" id="sheet"></div>
      <span class="sg-switch__knob" id="knobL" style="position:static;display:block;width:20px;height:20px"></span></div>
      <div data-sg-theme="dark"><span class="sg-switch__knob" id="knobD" style="position:static;display:block;width:20px;height:20px"></span></div>
      <div data-sg-theme="light-hc"><div class="sg-tabbar__indicator" id="ind" style="position:static;display:block;width:20px;height:20px"></div></div>
      <div data-sg-theme="light"><div class="sg-tabbar__indicator" id="ind0" style="position:static;display:block;width:20px;height:20px"></div></div>`);
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const v = (id, k) => cs(id).getPropertyValue(k).trim();
    const out = { menu: cs('menu').boxShadow, sheet: cs('sheet').boxShadow, md: v('menu', '--sg-shadow-md'), lg: v('menu', '--sg-shadow-lg'),
      knobL: cs('knobL').backgroundImage, knobD: cs('knobD').backgroundImage, ind: cs('ind').boxShadow, ind0: cs('ind0').boxShadow };
    host.remove(); return out;
  });
  ok('depth: dense glass that floats (a menu) casts the floating shadow, an overlay (a sheet) the larger one', r.menu !== r.sheet && /48px/.test(r.sheet) && !/48px/.test(r.menu), `${r.menu.slice(0, 50)}… / ${r.sheet.slice(0, 50)}…`);
  ok('depth: a handle (switch knob) stays light in dark themes too', r.knobL === r.knobD && /255, 255, 255/.test(r.knobD), r.knobD.slice(0, 60));
  ok('depth: a flat selection on glass (tab bar) gets an outline in high contrast only', /1\.5px/.test(r.ind) && !/1\.5px/.test(r.ind0), `${r.ind} / ${r.ind0}`);
}

/* ---------------------------------------------------------------- reduce transparency reaches portals */
await p.goto('http://localhost:4173/?mode=light&rt=1#/overlays'); await p.waitForTimeout(700);
await p.getByRole('button', { name: /길찾기/ }).first().click(); await p.waitForTimeout(500);
const menu = await p.evaluate(() => {
  const m = document.querySelector('.sg-menu'); if (!m) return null;
  const cs = getComputedStyle(m), bg = cs.backgroundColor, a = bg.startsWith('rgba') ? +bg.split(',')[3].replace(')', '') : 1;
  return { filter: cs.backdropFilter || cs.webkitBackdropFilter || 'none', alpha: a, portalRT: m.closest('.sg-portal')?.classList.contains('sg-reduce-transparency') };
});
ok('reduce transparency: an open menu is solid, with no backdrop blur', menu && menu.portalRT && (menu.filter === 'none' || menu.filter === '') && menu.alpha === 1, JSON.stringify(menu));

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
