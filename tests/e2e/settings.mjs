// Settings decide at the nearest boundary (design-language.md, 4. 접근성 · 8. 깊이와 레이어):
//   · a dark island inside a light page draws dark shadows and dark depth (tokens re-declared on every theme element)
//   · a normal theme inside a high-contrast one gets its normal 1 px glass rim back; high contrast turns depth into
//     outlines; system high contrast without a theme attribute does too
//   · reduced motion: the nearest data-sg-reduce-motion decides for CSS springs (an inner "false" stops an outer
//     "true"), sibling areas do not affect each other, and the JS springs agree
//   · reduce transparency reaches portals: a menu opened with it on is solid, with no backdrop blur
//   · depth by role: floating dense glass vs an overlay, a light handle in every theme, a selection outline in high contrast
//   · tokens reach the controls: a control text role and a spacing step changed by a theme change buttons, labels, Stack
// usage: node tests/e2e/settings.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
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
      <div data-sg-theme="light"><div class="sg-tabbar__indicator" id="ind0" style="position:static;display:block;width:20px;height:20px"></div></div>
      <div data-sg-theme="light-hc"><div class="sg-card" id="cardH" style="width:40px;height:20px"></div><ul class="sg-list" id="listH"></ul><div class="sg-stat" id="statH"></div></div>
      <div data-sg-theme="light"><div class="sg-card" id="cardL" style="width:40px;height:20px"></div></div>`);
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const v = (id, k) => cs(id).getPropertyValue(k).trim();
    const out = { menu: cs('menu').boxShadow, sheet: cs('sheet').boxShadow, md: v('menu', '--sg-shadow-md'), lg: v('menu', '--sg-shadow-lg'),
      knobL: cs('knobL').backgroundImage, knobD: cs('knobD').backgroundImage, ind: cs('ind').boxShadow, ind0: cs('ind0').boxShadow,
      cardH: cs('cardH').boxShadow, listH: cs('listH').boxShadow, statH: cs('statH').boxShadow, cardL: cs('cardL').boxShadow };
    host.remove(); return out;
  });
  ok('depth: dense glass that floats (a menu) casts the floating shadow, an overlay (a sheet) the larger one', r.menu !== r.sheet && /48px/.test(r.sheet) && !/48px/.test(r.menu), `${r.menu.slice(0, 50)}… / ${r.sheet.slice(0, 50)}…`);
  ok('depth: a handle (switch knob) stays light in dark themes too', r.knobL === r.knobD && /255, 255, 255/.test(r.knobD), r.knobD.slice(0, 60));
  ok('depth: surfaces (card, list group, stat) get a 1 px edge in high contrast, and not otherwise', [r.cardH, r.listH, r.statH].every((x) => /inset/.test(x) && /1px/.test(x)) && !/inset 0px 0px 0px 1px/.test(r.cardL), `${r.cardH.slice(-50)} / ${r.cardL.slice(-50)}`);
  ok('depth: a flat selection on glass (tab bar) gets an outline in high contrast only', /1\.5px/.test(r.ind) && !/1\.5px/.test(r.ind0), `${r.ind} / ${r.ind0}`);
}

/* ---------------------------------------------------------------- spacing and control text follow their tokens */
{
  await p.goto('http://localhost:4173/?mode=light#/material'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = '--sg-text-control-size: 19px; --sg-text-label-size: 11px; --sg-space-3: 30px';
    host.innerHTML = '<button class="sg-button sg-button--filled" id="tb">Go</button><span class="sg-field__label" id="tl">L</span>';
    document.querySelector('.sg-root')?.appendChild(host);
    const out = { button: getComputedStyle(document.getElementById('tb')).fontSize, label: getComputedStyle(document.getElementById('tl')).fontSize };
    host.remove(); return out;
  });
  ok('type: a theme that changes a control text role changes the controls (button, field label)', r.button === '19px' && r.label === '11px', JSON.stringify(r));
  const gap = await p.evaluate(() => { const st = [...document.querySelectorAll('.sg-stack')].find((e) => e.style.gap.includes('--sg-space-')); return st ? st.style.gap : 'none'; });
  ok('space: Stack gaps on the scale read the spacing tokens', gap.startsWith('var(--sg-space-'), gap);
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

/* the docs' language: the switch under the brand is there (it was once squeezed to nothing by the sidebar's column),
   the browser's language decides first, a choice is kept across reloads, ?lang= wins, and <html lang> follows */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const q = await ctx.newPage();
  await q.goto('http://localhost:4173/#/table'); await q.waitForTimeout(900);
  const sw = await q.locator('.docs__lang').evaluate((e) => ({ h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }));
  ok('docs language: the switch under the brand is a full control', sw.h >= 28 && sw.w >= 120, JSON.stringify(sw));
  ok('docs language: an English browser opens in English', (await q.evaluate(() => document.documentElement.lang)) === 'en');
  await q.locator('.docs__lang').getByRole('radio', { name: '한국어' }).click(); await q.waitForTimeout(400);
  ok('docs language: choosing Korean sets ?lang=ko and <html lang="ko">', (await q.evaluate(() => [new URL(location.href).searchParams.get('lang'), document.documentElement.lang].join())) === 'ko,ko');
  await q.goto('http://localhost:4173/#/table'); await q.waitForTimeout(900);
  ok('docs language: the choice is kept without ?lang=', (await q.evaluate(() => document.documentElement.lang)) === 'ko');
  await q.goto('http://localhost:4173/?lang=en#/table'); await q.waitForTimeout(900);
  ok('docs language: ?lang= wins over the saved choice', (await q.evaluate(() => document.documentElement.lang)) === 'en');
  await ctx.close();
}

/* the docs' top bar: below 1360 px it holds only 40 px glass buttons (menu under 900, contents, settings) on one line;
   from 1360 the settings bar and the contents rail. Nothing in it moves while the page scrolls, whatever section the
   contents button names (its width once followed the name and pushed the settings bar on every scroll). */
for (const [w, locale] of [[390, 'en-US'], [1000, 'ko-KR'], [1359, 'en-US'], [1360, 'ko-KR'], [1600, 'en-US']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, locale });
  const q = await ctx.newPage();
  await q.goto('http://localhost:4173/#/table'); await q.waitForTimeout(900);
  const snap = () => q.evaluate(() => {
    const out = {};
    for (const [k, sel] of Object.entries({ menu: '.docs__menu-btn', contents: '.docs__contents-btn', settingsBtn: '.docs__settings-btn', bar: '.docs__settings--bar', rail: '.docs__toc' })) {
      const e = document.querySelector(sel);
      if (e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) { const r = e.getBoundingClientRect(); out[k] = [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 2) / 2); }
    }
    out.name = document.querySelector('.docs__contents-cur')?.textContent ?? null;
    return out;
  });
  const first = await snap(), wide = w >= 1360;
  const shown = ['menu', 'contents', 'settingsBtn', 'bar', 'rail'].filter((k) => first[k]).join(',');
  const want = wide ? 'bar,rail' : w <= 900 ? 'menu,contents,settingsBtn' : 'contents,settingsBtn';
  ok(`docs top bar at ${w} px: ${want}`, shown === want, shown);
  const btns = ['menu', 'contents', 'settingsBtn'].filter((k) => first[k]).map((k) => first[k]);
  ok(`docs top bar at ${w} px: one height and one middle`, btns.every((r) => r[3] === btns[0][3] && r[1] + r[3] / 2 === btns[0][1] + btns[0][3] / 2), JSON.stringify(btns));
  const H = await q.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let moved = '', names = new Set([first.name]);
  for (let k = 1; k <= 6; k++) {
    await q.evaluate((y) => scrollTo(0, y), Math.round((H * k) / 6)); await q.waitForTimeout(150);
    const s2 = await snap(); names.add(s2.name);
    for (const key of ['menu', 'contents', 'settingsBtn', 'bar']) if (JSON.stringify(s2[key]) !== JSON.stringify(first[key])) moved ||= `${key} at ${k}/6`;
  }
  ok(`docs top bar at ${w} px: nothing moves while the page scrolls`, !moved, moved);
  if (!wide) ok(`docs top bar at ${w} px: the contents button names the section in view`, names.size >= 3, [...names].join(' / '));
  await ctx.close();
}

/* an anchored panel whose anchor goes away closes (it once jumped to the top left): the settings popover opened from
   its button, then the window widened until the bar replaced the button; a select whose anchor stays keeps its list
   open, beside it */
{
  const ctx = await b.newContext({ viewport: { width: 1000, height: 800 }, locale: 'ko-KR' });
  const q = await ctx.newPage();
  const panels = () => q.evaluate(() => [...document.querySelectorAll('.sg-popover, .sg-menu, .sg-listbox')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0).length);
  await q.goto('http://localhost:4173/#/table'); await q.waitForTimeout(900);
  await q.locator('.docs__settings-btn').click(); await q.waitForTimeout(500);
  const before = await panels();
  await q.setViewportSize({ width: 1500, height: 800 }); await q.waitForTimeout(700);
  ok('anchored panel: closes when its anchor is hidden (settings popover, window widened)', before === 1 && (await panels()) === 0, `${before} → ${await panels()}`);
  /* the bar's switches mounted hidden (display: none at this width) and are shown now: each thumb rests 20 px wide
     against the end its state says (they kept a sliver measured at 0 × 0) */
  const thumbs = await q.evaluate(() => [...document.querySelectorAll('.docs__settings--bar .sg-switch')].map((s) => {
    const r = s.getBoundingClientRect(), t = s.querySelector('.sg-switch__thumb').getBoundingClientRect(), on = s.getAttribute('aria-checked') === 'true';
    return { w: Math.round(t.width), gap: Math.round(on ? r.right - t.right : t.left - r.left) };
  }));
  ok('switches mounted hidden rest in place once shown (settings bar after widening)', thumbs.length === 3 && thumbs.every((t) => t.w >= 16 && t.gap >= 1 && t.gap <= 4), JSON.stringify(thumbs));
  await q.setViewportSize({ width: 1300, height: 800 }); await q.waitForTimeout(400);
  const sel = q.locator('[data-demo="filterbar"] .sg-select'); await sel.scrollIntoViewIfNeeded(); await sel.click(); await q.waitForTimeout(500);
  await q.setViewportSize({ width: 1200, height: 800 }); await q.waitForTimeout(600);
  const gap = await q.evaluate(() => { const a = document.querySelector('[data-demo="filterbar"] .sg-select').getBoundingClientRect(), l = document.querySelector('.sg-listbox')?.getBoundingClientRect(); return l ? Math.round(l.top - a.bottom) : null; });
  ok('anchored panel: stays open beside an anchor that stays (select, window narrowed)', gap !== null && gap >= 0 && gap <= 16, String(gap));
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
