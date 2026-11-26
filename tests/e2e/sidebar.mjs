// The sidebar on the docs navigation page (the attached demo) and in the docs' own frame: items set their own type
// (nothing around them changes weight or line height), a long label keeps to one line with an ellipsis, the
// attached panel is opaque and square with a line on its inline end (also right to left, where the count moves to
// the left), the header and footer stay in place while the list scrolls and sit outside the navigation landmark,
// sections are groups named by their header, a short window scrolls the whole panel so the last item can be
// reached, and in forced colours the current item keeps a visible selection.
// usage: node tests/e2e/sidebar.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173 or E2E_PORT)
// covers: navigation, layout   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch(engine === 'firefox' ? { firefoxUserPrefs: { 'network.security.ports.banned.override': pw.PORT } } : {});
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id, q = '') => `${pw.ORIGIN}/${q}#/${id}`;
const errors = [];
const open = async (url, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url); await p.waitForSelector('.docs__nav .sg-sidebar__item'); await p.waitForTimeout(500);
  return p;
};
const DEMO = '[data-demo="sidebar-attached"]';

/* the attached demo: type, ellipsis, surface, landmark, pinned footer */
{
  const p = await open(U('navigation', '?lang=en'));
  await p.locator(DEMO).scrollIntoViewIfNeeded();
  const m = await p.evaluate((sel) => {
    const s = document.querySelector(`${sel} .sg-sidebar`), cs = (e) => getComputedStyle(e);
    const items = [...s.querySelectorAll('.sg-sidebar__item')];
    const cur = items.find((e) => e.getAttribute('aria-current') === 'page'), other = items.find((e) => !e.hasAttribute('aria-current'));
    const long = [...s.querySelectorAll('.sg-sidebar__label')].find((e) => e.textContent.startsWith('Billing'));
    const nav = s.querySelector('nav');
    return {
      weights: [cs(cur).fontWeight, cs(other).fontWeight], line: cs(other).lineHeight,
      sub: s.querySelector('.sg-sidebar__subtitle') && [cs(s.querySelector('.sg-sidebar__subtitle')).fontSize, cs(s.querySelector('.sg-sidebar__subtitle')).lineHeight],
      long: long && { over: long.scrollWidth > long.clientWidth, h: long.getBoundingClientRect().height, ellipsis: cs(long).textOverflow },
      panel: { radius: cs(s).borderTopLeftRadius, filter: cs(s).backdropFilter || cs(s).webkitBackdropFilter || 'none', end: cs(s).borderRightWidth, start: cs(s).borderLeftWidth, shadow: cs(s).boxShadow },
      outside: !nav.contains(s.querySelector('input')) && !nav.contains(s.querySelector('.sg-sidebar__footer button')),
      groups: [...nav.querySelectorAll('[role="group"]')].map((g) => (g.getAttribute('aria-labelledby') ? document.getElementById(g.getAttribute('aria-labelledby')).textContent : null)),
    };
  }, DEMO);
  ok('items set their own type: 450, 620 for the current one, 20 px lines', m.weights[0] === '620' && m.weights[1] === '450' && m.line === '20px', JSON.stringify(m.weights) + ' ' + m.line);
  ok('a subtitle is a footnote line (13/18)', m.sub && m.sub[0] === '13px' && m.sub[1] === '18px', JSON.stringify(m.sub));
  ok('a long label keeps to one line and ends in an ellipsis', m.long && m.long.over && m.long.h === 20 && m.long.ellipsis === 'ellipsis', JSON.stringify(m.long));
  ok('attached: square, no blur or shadow, a line on its inline end', m.panel.radius === '0px' && m.panel.filter === 'none' && m.panel.end === '1px' && m.panel.start === '0px' && m.panel.shadow === 'none', JSON.stringify(m.panel));
  ok('the header and footer sit outside the navigation landmark', m.outside);
  ok('sections are groups named by their header', JSON.stringify(m.groups) === JSON.stringify(['Projects']), JSON.stringify(m.groups));

  const footer = p.locator(`${DEMO} .sg-sidebar__footer`), header = p.locator(`${DEMO} .sg-sidebar__header`), nav = p.locator(`${DEMO} nav`);
  const before = await footer.boundingBox(), headBefore = await header.boundingBox();
  const scrolled = await nav.evaluate((e) => { e.scrollTop = e.scrollHeight; return e.scrollTop; });
  await p.waitForTimeout(100);
  const after = await footer.boundingBox(), headAfter = await header.boundingBox();
  ok('the header and footer stay in place while the list scrolls', scrolled > 0 && Math.abs(after.y - before.y) < 0.5 && Math.abs(headAfter.y - headBefore.y) < 0.5, `scrolled ${scrolled}, footer ${before.y} → ${after.y}, header ${headBefore.y} → ${headAfter.y}`);

  /* the list fades at an edge with more behind it, never over its scroll bar's strip */
  const fades = await p.evaluate(async (sel) => {
    const n = document.querySelector(`${sel} nav`), frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const at = async (y) => { n.scrollTop = y; await frame(); const cs = getComputedStyle(n); return { start: n.hasAttribute('data-sg-more-start'), end: n.hasAttribute('data-sg-more-end'), image: (cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage) || 'none', size: cs.maskSize || cs.webkitMaskSize, pos: cs.maskPosition || cs.webkitMaskPosition }; };
    const r = { top: await at(0), mid: await at(40), bottom: await at(n.scrollHeight) };
    n.scrollTop = 0; await frame();
    return r;
  }, DEMO);
  ok('fades: none at the top edge at the top, then at both edges, then only at the top at the end', !fades.top.start && fades.top.end && fades.mid.start && fades.mid.end && fades.bottom.start && !fades.bottom.end, JSON.stringify(fades));
  ok('fades: the mask is a fade and a solid strip (two gradients)', (fades.mid.image.match(/linear-gradient/g) ?? []).length === 2, fades.mid.image.slice(0, 80));
  ok('fades: the scrollbar strip (the list padding at the inline end) is kept clear', /,\s*10px 100%$/.test(fades.mid.size) && /,\s*100% 0(px)?$/.test(fades.mid.pos), JSON.stringify(fades.mid));
  const headPad = await p.evaluate((sel) => getComputedStyle(document.querySelector(`${sel} .sg-sidebar__header`)).paddingBottom, DEMO);
  ok('the header keeps 8 px under its last control', headPad === '8px', headPad);

  /* right to left: the line and the count move to the left */
  const rtl = await p.evaluate(async (sel) => {
    const d = document.querySelector(sel); d.dir = 'rtl';
    const s = d.querySelector('.sg-sidebar'), c = s.querySelector('.sg-sidebar__count'), l = c.closest('.sg-sidebar__item').querySelector('.sg-sidebar__label');
    const n = s.querySelector('nav'), frame = () => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
    n.scrollTop = 40; await frame();
    const cs = getComputedStyle(n);
    const r = { start: getComputedStyle(s).borderRightWidth, end: getComputedStyle(s).borderLeftWidth, countLeft: c.getBoundingClientRect().right <= l.getBoundingClientRect().left, maskPos: cs.maskPosition || cs.webkitMaskPosition };
    d.dir = ''; n.scrollTop = 0; await frame(); return r;
  }, DEMO);
  ok('right to left: the line is on the left and the count before the label', rtl.end === '1px' && rtl.start === '0px' && rtl.countLeft, JSON.stringify(rtl));
  ok('right to left: the scroll bar strip kept clear of the fade is on the left', /,\s*0(px)? 0(px)?$/.test(rtl.maskPos), rtl.maskPos);

  /* the search in the header filters the list, and Tab goes header → items → footer */
  await p.locator(`${DEMO} input`).fill('mobile'); await p.waitForTimeout(200);
  const names = await p.locator(`${DEMO} nav .sg-sidebar__label`).allTextContents();
  ok('the header search narrows the projects', names.includes('Mobile app') && !names.includes('Website redesign'), names.join(', '));
  await p.locator(`${DEMO} input`).fill('');
  await p.locator(`${DEMO} input`).focus();
  /* WebKit tabs to buttons only with Alt; Firefox also stops on a scrolling area itself (the list) */
  const TAB = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
  const seq = [];
  /* each row Tab brings in keeps clear of the 24 px fade at an edge with more behind it (scroll-padding) */
  const inFade = [];
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press(TAB); await p.waitForTimeout(120);
    seq.push(await p.evaluate(() => { const e = document.activeElement; return e.closest('.sg-sidebar__footer') ? 'footer' : e.matches('.sg-sidebar__item') ? 'item' : e.closest('.sg-sidebar') ? 'panel' : 'out'; }));
    const f = await p.evaluate(() => { const e = document.activeElement, n = e.closest('nav'); if (!n || !e.matches('.sg-sidebar__item')) return null;
      const r = e.getBoundingClientRect(), b = n.getBoundingClientRect();
      return { top: n.hasAttribute('data-sg-more-start') ? r.top - b.top : 99, bottom: n.hasAttribute('data-sg-more-end') ? b.bottom - r.bottom : 99, name: e.textContent }; });
    if (f && (f.top < 23 || f.bottom < 23)) inFade.push(f);
  }
  ok('Tab keeps a focused row out of the fades', inFade.length === 0, JSON.stringify(inFade));
  const toFooter = seq.slice(0, seq.indexOf('footer'));
  ok('Tab goes from the header through the items to the footer', seq.includes('footer') && toFooter.filter((x) => x === 'item').length === 7 && toFooter.every((x) => x !== 'out'), seq.join(' '));
  await p.context().close();
}

/* the docs' frame: sections named, a short window scrolls the whole panel and reaches the last item */
for (const h of [900, 220]) {
  const p = await open(U('navigation', '?lang=ko'), { viewport: { width: 1280, height: h } });
  const m = await p.evaluate(() => {
    const s = document.querySelector('.docs__nav .sg-sidebar'), f = s.querySelector('.sg-sidebar__frame'), n = s.querySelector('nav');
    const groups = [...n.querySelectorAll('[role="group"]')].map((g) => document.getElementById(g.getAttribute('aria-labelledby'))?.textContent);
    const scrolls = f.scrollHeight > f.clientHeight + 1;
    f.scrollTop = f.scrollHeight; n.scrollTop = n.scrollHeight;
    const last = [...n.querySelectorAll('.sg-sidebar__item')].at(-1).getBoundingClientRect();
    return { groups, scrolls, nav: n.getBoundingClientRect().height, lastIn: last.bottom <= innerHeight + 1 && last.top >= 0, header: (() => { const h = s.querySelector('.sg-sidebar__header'); return !!h && !!h.querySelector('.docs__brand') && !!h.querySelector('.docs__lang') && !n.contains(h); })() };
  });
  if (h === 900) {
    ok('docs frame: every group is named (Korean)', m.groups.length >= 4 && m.groups.every(Boolean) && m.groups[0] === '가이드', JSON.stringify(m.groups));
    ok('docs frame: the brand and language switch sit in the header, outside the landmark', m.header);
    ok('docs frame: a tall window scrolls only the list', !m.scrolls, JSON.stringify(m));
  } else {
    ok('docs frame: a short window scrolls the whole panel, keeping the list at least 120 px', m.scrolls && m.nav >= 119, JSON.stringify(m));
    ok('docs frame: the last item can be reached in a short window', m.lastIn, JSON.stringify(m));
  }
  await p.context().close();
}

/* a short window: a wheel turned over the list, past its end, goes on to the frame and brings the footer into view.
   Separate wheel events re-latch to the frame once the list is at its end whatever the list's overscroll-behavior, so
   the list's computed value is checked too: with `contain` one continuous trackpad or touch gesture would stop at the
   list's end */
{
  const p = await open(U('navigation', '?lang=en'), { viewport: { width: 1280, height: 900 } });
  await p.locator(DEMO).scrollIntoViewIfNeeded();
  /* squeeze the demo so the header and footer leave the list less than 120 px */
  await p.evaluate((sel) => { document.querySelector(sel).style.height = '190px'; }, DEMO);
  await p.waitForTimeout(200);
  const box = await p.locator(`${DEMO} nav`).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  /* turn to the list's end; then, after a pause (Firefox keeps a wheel transaction on the area it began in for 1.5 s,
     as a person pausing would end it), turn again: the scroll goes on to the frame */
  for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  /* Chromium and WebKit go on to the frame within the same run of wheel events; Firefox needs the pause below */
  const early = await p.evaluate((sel) => document.querySelector(`${sel} .sg-sidebar__frame`).scrollTop, DEMO);
  if (engine !== 'firefox') ok('short panel: the same run of wheel events goes on to the frame (no pause)', early > 0, `frame scrollTop ${early}`);
  await p.waitForTimeout(1400);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(30); }
  await p.waitForTimeout(400);
  const m = await p.evaluate((sel) => {
    const s = document.querySelector(`${sel} .sg-sidebar`), f = s.querySelector('.sg-sidebar__frame'), n = s.querySelector('nav');
    const foot = s.querySelector('.sg-sidebar__footer').getBoundingClientRect(), fr = f.getBoundingClientRect();
    const rows = [...n.querySelectorAll('.sg-sidebar__item')].map((e) => Math.round(e.getBoundingClientRect().height));
    return { chain: getComputedStyle(n).overscrollBehaviorY, frame: [f.scrollTop, f.scrollHeight - f.clientHeight], navAtEnd: Math.abs(n.scrollTop - (n.scrollHeight - n.clientHeight)) < 2, footerIn: foot.bottom <= fr.bottom + 1, rows };
  }, DEMO);
  ok('short panel: a wheel over the list scrolls on to the frame and reveals the footer', m.frame[1] > 0 && m.frame[0] >= m.frame[1] - 1 && m.navAtEnd && m.footerIn, JSON.stringify(m));
  ok('beside a header or footer the list hands its scroll on (overscroll-behavior auto)', m.chain === 'auto', JSON.stringify(m.chain));
  ok('short panel: two-line rows keep their height (none squeezed)', m.rows.every((h) => h >= 38) && m.rows.filter((h) => h >= 54).length >= 4, JSON.stringify(m.rows));
  await p.context().close();
}

/* forced colours (Chromium emulates them): the current item keeps a visible selection */
if (engine === 'chromium') {
  const p = await open(U('navigation', '?lang=en'), { forcedColors: 'active' });
  await p.locator(DEMO).scrollIntoViewIfNeeded();
  const m = await p.evaluate((sel) => {
    const items = [...document.querySelectorAll(`${sel} .sg-sidebar__item`)];
    const bg = (e) => getComputedStyle(e).backgroundColor;
    const t = document.createElement('div'); t.style.cssText = 'background: Highlight; forced-color-adjust: none'; document.body.append(t);
    const highlight = getComputedStyle(t).backgroundColor; t.remove();
    return { highlight, cur: bg(items.find((e) => e.getAttribute('aria-current') === 'page')), other: bg(items.find((e) => !e.hasAttribute('aria-current'))) };
  }, DEMO);
  ok('forced colours: the current item is filled with the system selection colour', m.cur === m.highlight && m.other !== m.highlight, JSON.stringify(m));
  await p.locator(`${DEMO} [aria-current="page"]`).focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
  const f = await p.evaluate((sel) => { const e = document.activeElement, t = document.createElement('div'); t.style.cssText = 'color: HighlightText; forced-color-adjust: none'; document.body.append(t);
    const r = { current: e.matches(`${sel} [aria-current="page"]`), outline: getComputedStyle(e).outlineColor, style: getComputedStyle(e).outlineStyle, text: getComputedStyle(t).color, shadow: getComputedStyle(e).boxShadow }; t.remove(); return r; }, DEMO);
  ok('forced colours: the focused current item shows its outline in the selection text colour', f.current && f.style !== 'none' && f.outline === f.text && f.shadow === 'none', JSON.stringify(f));
  const mask = await p.evaluate(async (sel) => { const n = document.querySelector(`${sel} nav`);
    /* let the focus just given settle first: a row reached by keyboard is scrolled clear of the fades a frame later */
    document.activeElement.blur(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); n.scrollTop = 40; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const cs = getComputedStyle(n);
    return { more: n.hasAttribute('data-sg-more-start'), image: cs.maskImage || cs.webkitMaskImage }; }, DEMO);
  ok('forced colours: the list does not fade (system colours stay whole)', mask.more && mask.image === 'none', JSON.stringify(mask));
  await p.context().close();
}

/* a scrollbar in its own gutter (shown, not overlaid; Chromium with scrollbars drawn): the clear strip is that wide */
if (engine === 'chromium') {
  const b2 = await pw.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await b2.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(U('navigation', '?lang=en')); await p.waitForSelector(`${DEMO} nav`); await p.locator(DEMO).scrollIntoViewIfNeeded();
  const g = await p.evaluate(async (sel) => { const n = document.querySelector(`${sel} nav`); n.style.scrollbarWidth = 'auto'; n.scrollTop = 40;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); n.dispatchEvent(new Event('scroll')); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cs = getComputedStyle(n); return { gutter: n.offsetWidth - n.clientWidth, size: cs.maskSize || cs.webkitMaskSize }; }, DEMO);
  const w = Number((g.size.match(/,\s*([\d.]+)px 100%$/) ?? [])[1]);
  ok('a scrollbar in its own gutter: the clear strip is at least as wide as the gutter', g.gutter === 0 || w >= g.gutter, JSON.stringify(g));
  await ctx.close(); await b2.close();
}

ok('no page errors during the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
