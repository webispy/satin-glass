// Keyboard focus is always visible (design-language.md, 4. 접근성): Tab through the first stops of each component
// page and compare the area around the focused element with the same area once focus is gone — they must differ.
// In the four themes and with forced colours (Windows high contrast), where the browser drops box-shadows: the
// focus mark is an outline, never a shadow (a shadow list with a `none` depth token in it was void, and selected
// states painted over it). Chromium only (forced colours are emulated there).
// usage: node tests/e2e/focus.mjs   (vite preview on :4173; SHARD=k/n for a share of the themes)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const b = await pw.chromium.launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const PAGES = ['buttons', 'inputs', 'selection', 'navigation', 'lists', 'display', 'feedback', 'table', 'charts'];
const STOPS = 18;
const MODES = [['light', '?mode=light&rm=1', {}], ['dark', '?mode=dark&rm=1', {}], ['light-hc', '?mode=light&hc=1&rm=1', {}], ['dark-hc', '?mode=dark&hc=1&rm=1', {}], ['forced colours', '?mode=light&rm=1', { forcedColors: 'active' }]];

/* SHARD=2/5: only every 5th theme from the 2nd (the run gives each theme its own share) */
const [k, n] = (process.env.SHARD || '1/1').split('/').map(Number);
for (const [mode, qs, media] of MODES.filter((_, i) => i % n === k - 1)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.emulateMedia({ reducedMotion: 'reduce', ...media });
  for (const page of PAGES) {
    await p.goto(`http://localhost:4173/${qs}#/${page}`); await p.waitForTimeout(700);
    await p.mouse.move(2, 2);
    /* start from the page's own content, not the docs chrome */
    await p.evaluate(() => { const a = document.querySelector('.docs__page'); a?.setAttribute('tabindex', '-1'); a?.focus(); });
    const missing = [];
    for (let i = 0; i < STOPS; i++) {
      await p.keyboard.press('Tab'); await p.waitForTimeout(60);
      const box = await p.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body || !e.closest('.docs__page')) return null;
        e.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
        const pad = 8, x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
        return { x, y, width: Math.min(innerWidth - x, r.width + pad * 2), height: Math.min(innerHeight - y, r.height + pad * 2), name: `${e.tagName.toLowerCase()}${e.getAttribute('class') ? '.' + e.getAttribute('class').split(/\s+/)[0] : ''}${e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : ''}`.slice(0, 60) };
      });
      if (!box) continue;
      await p.waitForTimeout(40);
      const focused = (await p.screenshot({ clip: box })).toString('base64');
      /* the same element without focus: hide the focus mark by moving focus to a neutral spot (no scroll) */
      const mark = await p.evaluate(() => { const e = document.activeElement; e.setAttribute('data-focus-probe', ''); const s = document.createElement('span'); s.tabIndex = -1; s.id = 'focus-probe-sink'; s.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;'; document.body.appendChild(s); s.focus({ preventScroll: true }); return true; });
      await p.waitForTimeout(40);
      const plain = (await p.screenshot({ clip: box })).toString('base64');
      if (focused === plain) missing.push(box.name);
      /* back to the element, keyboard-style, so Tab continues from it */
      await p.evaluate(() => { document.getElementById('focus-probe-sink')?.remove(); const e = document.querySelector('[data-focus-probe]'); e?.removeAttribute('data-focus-probe'); e?.focus({ preventScroll: true }); });
      void mark;
    }
    ok(`focus visible · ${page} · ${mode}`, missing.length === 0, missing.slice(0, 6).join(', '));
  }
  await p.close();
}
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
