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

/* the nearest boundary decides at any depth, for the components' rules as for the springs: true → false → true, for
   reduced motion (the pointer sheen is off, a pressed button does not press in) and reduced transparency (solid, no
   blur), the class-only boundary included */
const deep = async () => p.evaluate(() => {
  const d = document.createElement('div');
  d.innerHTML = `
    <div data-sg-reduce-motion="true" data-sg-motion="lively"><i class="sg-glass m" id="m1"></i><b class="sg-spinner" id="sp1"></b>
      <div data-sg-reduce-motion="false"><i class="sg-glass m" id="m2"></i><b class="sg-spinner" id="sp2"></b>
        <div data-sg-reduce-motion="true"><i class="sg-glass m" id="m3"></i><b class="sg-spinner" id="sp3"></b></div>
        <div data-sg-reduce-motion="system"><i class="sg-glass m" id="m4"></i></div></div></div>
    <div data-sg-reduce-transparency="true"><i class="sg-glass t" id="t1"></i>
      <div data-sg-reduce-transparency="false"><i class="sg-glass t" id="t2"></i>
        <div class="sg-reduce-transparency"><i class="sg-glass t" id="t3"></i></div>
        <div data-sg-reduce-transparency="system"><i class="sg-glass t" id="t4"></i></div></div></div>
    <div data-sg-theme="light" data-sg-reduce-transparency="true"><i class="sg-glass sg-glass--clear" data-tint style="--sg-tint:#369" id="tc"></i>
      <div class="sg-appbar" data-transparent-top data-at-top><div class="sg-glass sg-appbar__bar" id="bar"></div></div></div>
    <i class="sg-glass m t" id="pg"></i>`;
  document.body.appendChild(d);
  const cs = (id, pe) => getComputedStyle(document.getElementById(id), pe);
  const sheen = (id) => cs(id, '::after').display;
  const blur = (id) => { const s = cs(id); return (s.backdropFilter || s.webkitBackdropFilter || 'none') !== 'none'; };
  /* solid: the fill's alpha is 1 */
  const solid = (id) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0000'; c.fillStyle = cs(id).backgroundColor; c.fillRect(0, 0, 1, 1); return c.getImageData(0, 0, 1, 1).data[3] === 255; };
  /* luma and alpha of the same sample: a transparent background reads as black, so a dark plate needs both */
  const luma = (id) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = cs(id).backgroundColor; c.fillRect(0, 0, 1, 1); const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data; return { l: Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b), a }; };
  const out = {
    sheen: ['m1', 'm2', 'm3', 'm4', 'pg'].map(sheen),
    spin: ['sp1', 'sp2', 'sp3'].map((id) => cs(id).animationDuration),
    blur: ['t1', 't2', 't3', 't4', 'pg'].map(blur),
    solid: ['t1', 't2', 't3', 't4', 'pg'].map(solid),
    clearTint: luma('tc'), bar: [solid('bar'), blur('bar')],
  };
  d.remove(); return out;
});
{
  const v = await deep();
  ok('reduced motion at any depth: true → false → true (sheen off, on, off; system and the page follow the system: on)', v.sheen.join() === 'none,block,none,block,block', v.sheen.join());
  ok('reduced motion at any depth: the spinner turns slower only where reduced', v.spin.join() === '1.4s,0.8s,1.4s', v.spin.join());
  ok('reduced transparency at any depth: true → false → class (no blur, blur, no blur; system and the page: blur)', v.blur.join() === 'false,true,false,true,true', v.blur.join());
  ok('reduced transparency at any depth: solid where reduced, see-through elsewhere', v.solid.join() === 'true,false,true,false,false', v.solid.join());
  ok('reduced transparency: tinted clear glass keeps its dark plate under white ink (light theme)', v.clearTint.l < 60 && v.clearTint.a === 255, `luma ${v.clearTint.l}, alpha ${v.clearTint.a}`);
  ok('reduced transparency: an app bar see-through at the top is solid, with no blur', v.bar.join() === 'true,false', v.bar.join());

  /* a glass button hovered with reduced transparency stays solid: hover shades its solid fill, it does not mix in the
     translucent highlight (#90); without it, hover still lifts toward the highlight */
  for (const theme of ['light', 'dark', 'light-hc', 'dark-hc']) {
    const ids = await p.evaluate((theme) => {
      const d = document.createElement('div'); d.id = 'hov'; d.style.cssText = 'position: fixed; left: 20px; top: 20px; z-index: 99999; display: flex; gap: 20px';
      /* a glass button and a glass search field (its control), with reduced transparency and without */
      /* the glass search field as SearchField draws it: the glass on the control itself */
      const field = (id, inner = 'Find', off = false) => `<div class="sg-search sg-search--glass" style="width: 140px"><div class="sg-field"${off ? ' data-disabled="true"' : ''}><div class="sg-field__control sg-glass" id="${id}" style="height: 36px">${inner}</div></div></div>`;
      d.innerHTML = `<div data-sg-theme="${theme}" data-sg-reduce-transparency="true" style="display: flex; gap: 12px"><button class="sg-button sg-button--glass sg-glass" id="gbr">A</button>${field('sfr')}</div>
        <div data-sg-theme="${theme}" data-sg-reduce-transparency="false" style="display: flex; gap: 12px"><button class="sg-button sg-button--glass sg-glass" id="gbn">B</button>${field('sfn')}
          ${field('sff', '<input id="sffi" style="width: 60px" aria-label="find">')}${field('sfd', 'Off', true)}
          <button class="sg-button sg-button--glass sg-glass sg-glass--clear" id="cbn">C</button></div>`;
      document.body.appendChild(d); return ['gbr', 'gbn', 'sfr', 'sfn', 'cbn'];
    }, theme);
    const look = {};
    /* the background's alpha (0-255) and its colour, read through a canvas */
    const read = (el) => el.evaluate((e) => {
      const bg = getComputedStyle(e).backgroundColor, c = document.createElement('canvas').getContext('2d');
      c.fillStyle = '#0000'; c.fillStyle = bg; c.fillRect(0, 0, 1, 1);
      return { bg, alpha: c.getImageData(0, 0, 1, 1).data[3], image: /gradient/.test(getComputedStyle(e).backgroundImage) };
    });
    for (const id of ids) {
      const el = p.locator(`#${id}`);
      const rest = await read(el);
      await el.hover(); await p.waitForTimeout(250);
      const hov = await read(el);
      look[id] = { rest: rest.alpha, alpha: hov.alpha, changed: hov.bg !== rest.bg, image: hov.image };
    }
    /* a focused search field keeps its focus surface under the pointer */
    /* a clear glass button hovers with its own highlight (a 35% white, set on clear glass), mixed in at the theme's
       amount: the expected colour, worked out by the browser from the button's own values */
    const clearExpected = await p.locator('#cbn').evaluate((e) => {
      const cs = getComputedStyle(e), probe = document.createElement('i');
      probe.style.backgroundColor = `color-mix(in oklab, ${cs.getPropertyValue('--_fill').trim()}, ${cs.getPropertyValue('--sg-glass-highlight').trim()} 30%)`;
      document.body.appendChild(probe); const v = getComputedStyle(probe).backgroundColor; probe.remove(); return v;
    });
    const same = (a, b) => p.evaluate(([a, b]) => { const px = (c) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#0000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; }; const [p1, p2] = [px(a), px(b)]; return p1.every((v, i) => Math.abs(v - p2[i]) <= 3); }, [a, b]);   /* engines round nested colour mixes a little differently */
    await p.locator('#cbn').hover(); await p.waitForTimeout(250);
    const clearHov = await read(p.locator('#cbn'));
    /* a disabled glass search field does not answer the pointer, as a disabled glass button does not */
    const fd = p.locator('#sfd'); const offBg = await read(fd); await fd.hover(); await p.waitForTimeout(250); const offHov = await read(fd);
    /* a focused search field (its input focused) keeps its focus surface under the pointer */
    const ff = p.locator('#sff');
    await p.locator('#sffi').focus(); await p.waitForTimeout(300); const focusBg = await read(ff); await ff.hover(); await p.waitForTimeout(250); const focusHov = await read(ff);
    await p.mouse.move(0, 0); await p.evaluate(() => document.getElementById('hov').remove());
    ok(`reduced transparency: a hovered glass button stays solid and still shows the hover (${theme})`, look.gbr.alpha === 255 && look.gbr.changed && look.gbn.changed, JSON.stringify({ gbr: look.gbr, gbn: look.gbn }));
    /* in high contrast glass is solid, and its highlight is transparent: hover shades the fill instead of mixing that in,
       which took the fill to 70% (#95). Over working glass in the normal themes, hover lifts toward the highlight (in dark
       themes a faint, see-through white, so the hovered glass is a little clearer, as designed) */
    const hc = theme.endsWith('-hc');
    if (hc) ok(`high contrast: a hovered glass button stays as opaque as at rest (${theme}, #95)`, look.gbn.alpha >= look.gbn.rest && look.gbn.changed, JSON.stringify(look.gbn));
    /* the glass search field keeps its glass on hover, as a glass button does, instead of the field's own groove tint
       (#96): solid with reduced transparency, solid in high contrast, and the hover shows */
    ok(`a hovered glass search field keeps its glass and its depth, and the hover shows (${theme}, #96)`,
      look.sfr.alpha === 255 && look.sfr.changed && look.sfn.changed && look.sfn.image && (!hc || look.sfn.alpha >= look.sfn.rest) && look.sfn.alpha === look.gbn.alpha, JSON.stringify({ sfr: look.sfr, sfn: look.sfn, gbn: look.gbn }));
    ok(`a disabled glass search field does not answer the pointer (${theme})`, offHov.bg === offBg.bg && offHov.image, JSON.stringify({ offBg, offHov }));
    ok(`a focused glass search field keeps its focus surface under the pointer (${theme})`, focusHov.bg === focusBg.bg, JSON.stringify({ focusBg, focusHov }));
    if (!hc) ok(`a hovered clear glass button mixes in its own highlight (${theme})`, await same(clearHov.bg, clearExpected), `${clearHov.bg} / expected ${clearExpected}`);
  }
  /* the hover tint is the nearest theme's: a normal theme inside a high-contrast one hovers as a normal theme does */
  {
    await p.evaluate(() => {
      const d = document.createElement('div'); d.id = 'nest'; d.style.cssText = 'position: fixed; left: 20px; top: 20px; z-index: 99999; display: flex; gap: 20px';
      d.innerHTML = `<div data-sg-theme="light" data-sg-reduce-transparency="false"><button class="sg-button sg-button--glass sg-glass" id="nl">L</button></div>
        <div data-sg-theme="light-hc" data-sg-reduce-transparency="false"><div data-sg-theme="light"><button class="sg-button sg-button--glass sg-glass" id="nhl">N</button></div></div>`;
      document.body.appendChild(d);
    });
    const hovered = async (id) => { const el = p.locator(`#${id}`); await el.hover(); await p.waitForTimeout(250); return el.evaluate((e) => getComputedStyle(e).backgroundColor); };
    const plain = await hovered('nl'), nested = await hovered('nhl');
    await p.mouse.move(0, 0); await p.evaluate(() => document.getElementById('nest').remove());
    ok('a normal theme inside a high-contrast one hovers its glass as a normal theme does (#95)', plain === nested, `${plain} / ${nested}`);
  }
  /* without backdrop filters (#92): the page's styles again in a frame, the @supports (backdrop-filter) rules left out, as a
     browser without them reads the stylesheet. Glass is solid there; clear glass, standalone or as a button, takes its dark
     plate under its white ink, and a hovered glass button stays solid */
  {
    const nb = await p.evaluate(async () => {
      const keep = (r) => !(r instanceof CSSSupportsRule && /backdrop-filter/.test(r.conditionText));
      const css = [...document.styleSheets].map((sh) => { try { return [...sh.cssRules].filter(keep).map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
      const f = document.createElement('iframe'); f.id = 'nbf'; f.style.cssText = 'position: fixed; left: 0; top: 0; width: 600px; height: 200px; border: 0; z-index: 99999';
      document.body.appendChild(f);
      const d = f.contentDocument; d.open(); d.write(`<!doctype html><style>${css}</style><body>
        ${['light', 'dark'].map((t) => `<div data-sg-theme="${t}" data-sg-reduce-transparency="false" style="display: flex; gap: 12px; padding: 8px">
          <div class="sg-glass sg-glass--clear" id="c-${t}" style="width: 40px; height: 30px">x</div>
          <button class="sg-button sg-button--glass sg-glass sg-glass--clear" id="cb-${t}">Clear</button>
          <button class="sg-button sg-button--glass sg-glass" id="gb-${t}">Glass</button>
          <div class="sg-glass sg-glass--clear" id="cp-${t}" style="padding: 6px"><button class="sg-button sg-button--glass sg-glass" id="nb-${t}">In</button></div>
          <div class="sg-search sg-search--glass" style="width: 120px"><div class="sg-field"><div class="sg-field__control sg-glass" id="sf-${t}" style="height: 34px">Find</div></div></div></div>`).join('')}</body>`); d.close();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return true;
    });
    const read = (id) => p.evaluate((id) => {
      const d = document.getElementById('nbf').contentDocument, e = d.getElementById(id), cs = getComputedStyle(e);
      const px = (c) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#0000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const [r, g, b, a] = x.getImageData(0, 0, 1, 1).data; return { l: Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b), a }; };
      const r = e.getBoundingClientRect(), fr = document.getElementById('nbf').getBoundingClientRect();
      return { bg: px(cs.backgroundColor), ink: px(cs.color), filter: cs.backdropFilter || cs.webkitBackdropFilter || 'none', x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
    }, id);
    const out = {};
    for (const t of ['light', 'dark']) {
      const c = await read(`c-${t}`), cb = await read(`cb-${t}`), gb = await read(`gb-${t}`), cp = await read(`cp-${t}`), nbt = await read(`nb-${t}`), sf = await read(`sf-${t}`);
      await p.mouse.move(gb.x, gb.y); await p.waitForTimeout(250);
      const gh = await read(`gb-${t}`);
      await p.mouse.move(cb.x, cb.y); await p.waitForTimeout(250);
      const ch = await read(`cb-${t}`);
      await p.mouse.move(sf.x, sf.y); await p.waitForTimeout(250);
      const sh = await read(`sf-${t}`);
      out[t] = { c, cb, gb, gh, ch, cp, nbt, sf, sh };
    }
    await p.mouse.move(0, 400); await p.evaluate(() => document.getElementById('nbf').remove());
    const plate = (x) => x.bg.a === 255 && x.bg.l < 60 && x.ink.l > 200;
    for (const t of ['light', 'dark']) {
      const o = out[t];
      ok(`without backdrop filters, clear glass and a clear glass button sit on the dark plate under white ink (${t}, #92)`, nb && o.c.filter === 'none' && plate(o.c) && plate(o.cb), JSON.stringify({ c: o.c, cb: o.cb }));
      ok(`without backdrop filters, glass buttons are solid at rest and hovered, and the hover shows on the plate too (${t}, #92)`,
        o.gb.bg.a === 255 && o.gh.bg.a === 255 && o.ch.bg.a === 255 && o.gh.bg.l !== o.gb.bg.l && Math.abs(o.ch.bg.l - o.cb.bg.l) >= 5, JSON.stringify({ gb: o.gb.bg, gh: o.gh.bg, cb: o.cb.bg, ch: o.ch.bg }));
      ok(`without backdrop filters, a glass button inside clear glass stays flat over the plate, under white ink (${t}, #92)`, plate(o.cp) && o.nbt.bg.a === 0 && o.nbt.ink.l > 200, JSON.stringify({ cp: o.cp.bg, nb: o.nbt }));
      ok(`without backdrop filters, the glass search field is solid at rest and hovered, and the hover shows (${t}, #92, #96)`, o.sf.bg.a === 255 && o.sh.bg.a === 255 && o.sh.bg.l !== o.sf.bg.l, JSON.stringify({ sf: o.sf.bg, sh: o.sh.bg }));
    }
  }
  /* the system's reduced transparency (Chromium can emulate it): "system" and the page follow it, an explicit "false" does not */
  if (engine === 'chromium') {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    const s = await deep();
    ok('system reduced transparency: "system" and the page go solid, an explicit "false" stays glass', s.solid.join() === 'true,false,true,true,true', s.solid.join());
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  }
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const r = await deep();
  ok('system reduced motion: an explicit "false" still keeps motion, "system" inside it and the page reduce', r.sheen.join() === 'none,block,none,none,none', r.sheen.join());
  await p.emulateMedia({ reducedMotion: 'no-preference' });
}

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
    /* a glass button under no theme follows the system's high contrast on hover too: as opaque as at rest (#95) */
    await q.evaluate(() => { const b = document.createElement('button'); b.className = 'sg-button sg-button--glass sg-glass'; b.id = 'sysb'; b.textContent = 'S'; b.style.cssText = 'position: fixed; left: 20px; top: 20px; z-index: 99999'; document.body.appendChild(b); });
    const alpha = () => q.locator('#sysb').evaluate((e) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0000'; c.fillStyle = getComputedStyle(e).backgroundColor; c.fillRect(0, 0, 1, 1); return c.getImageData(0, 0, 1, 1).data[3]; });
    const bgOf = () => q.locator('#sysb').evaluate((e) => getComputedStyle(e).backgroundColor);
    const rest = await alpha(), restBg = await bgOf(); await q.locator('#sysb').hover(); await q.waitForTimeout(250); const hov = await alpha(), hovBg = await bgOf();
    ok('system high contrast without a theme attribute: a hovered glass button stays as opaque as at rest, and the hover shows (#95)', hov >= rest && hovBg !== restBg, `${rest} → ${hov}; ${restBg} → ${hovBg}`);
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
  return { filter: cs.backdropFilter || cs.webkitBackdropFilter || 'none', alpha: a, portalRT: m.closest('.sg-portal')?.getAttribute('data-sg-reduce-transparency') === 'true' };
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
