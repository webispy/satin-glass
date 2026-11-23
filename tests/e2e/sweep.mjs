// Every control on every docs page, operated: buttons pressed, tabs / radios / checkboxes / switches chosen and then
// turned back (another option of the group, or the same toggle again), sliders moved, comboboxes opened and a value
// taken — each followed by Escape. Fails on a page error, a console error from the app, or a page that stops answering.
// It does not judge results or looks (the other suites do); it catches the part that breaks the page on the way there
// and back (a scatter switched to linear and back to log once hung the page this way).
// usage: node tests/e2e/sweep.mjs   (BROWSER=webkit|firefox, WIDTH=390 for phone width, SHARD=2/3 for every 3rd page
//        starting at the 2nd; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium';
const width = Number(process.env.WIDTH) || 1280;
/* pages with how many controls each had (2026-11-23): the time goes with the count, so the shares are dealt by it —
   each page to the lightest share so far, heaviest first (a page not listed counts as 40) */
const WEIGHT = { selection: 165, lab: 144, navigation: 80, table: 75, evaluation: 73, motion: 72, display: 56, showcase: 42, dashboard: 34,
  charts: 33, inputs: 32, buttons: 31, material: 27, overlays: 26, feedback: 23, lists: 21, colors: 13, overview: 13, type: 13 };
const PAGES = Object.keys(WEIGHT);
const [k, n] = (process.env.SHARD || '1/1').split('/').map(Number);
const shares = Array.from({ length: n }, () => ({ w: 0, pages: [] }));
for (const id of [...PAGES].sort((a, c) => (WEIGHT[c] ?? 40) - (WEIGHT[a] ?? 40))) { const s = shares.reduce((m, x) => (x.w < m.w ? x : m)); s.pages.push(id); s.w += WEIGHT[id] ?? 40; }
const mine = shares[k - 1].pages;
const SEL = ['button:not([disabled])', '[role=tab]', '[role=radio]', '[role=checkbox]', '[role=switch]', '[role=combobox]', '[role=slider]', 'summary'].map((s) => `main ${s}`).join(', ');
const TOGGLES = new Set(['tab', 'radio', 'checkbox', 'switch']);

const b = await pw[engine].launch();
let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
for (const id of mine) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  let where = 'loading';
  p.on('pageerror', (e) => errors.push(`${where}: ${e.message.slice(0, 160)}`));
  /* console errors from the app; a resource the network failed to bring (a CDN font piece) is not the app's */
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${where}: console ${m.text().slice(0, 160)}`); });
  p.on('dialog', (d) => d.dismiss());
  const url = `http://localhost:4173/#/${id}`;
  await p.goto(url); await p.waitForTimeout(900);
  const answers = () => Promise.race([p.evaluate(() => true), new Promise((r) => setTimeout(() => r(false), 4000))]).catch(() => false);
  const count = await p.locator(SEL).count();
  let operated = 0, hung = false;
  for (let i = 0; i < count && !hung; i++) {
    const el = p.locator(SEL).nth(i);
    try {
      if (!(await el.isVisible()) || !(await el.isEnabled())) continue;
      const role = await el.getAttribute('role');
      const label = ((await el.getAttribute('aria-label')) || (await el.textContent()) || '').trim().slice(0, 30);
      where = `${role ?? 'button'} “${label}”`;
      await el.scrollIntoViewIfNeeded({ timeout: 1500 });
      if (role === 'slider') { await el.focus(); for (const key of ['ArrowRight', 'End', 'Home']) await p.keyboard.press(key); }
      else if (role === 'combobox') {
        await el.click({ timeout: 1500 });
        for (let j = 0; j < 2; j++) { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
      } else {
        await el.click({ timeout: 1500 }); await p.waitForTimeout(250);
        if (TOGGLES.has(role ?? '')) {
          /* and back: the same toggle again, or the first option of its group */
          const back = role === 'radio' || role === 'tab' ? el.locator('xpath=..').locator(`[role=${role}]`).first() : el;
          if (await back.isVisible().catch(() => false)) { await back.click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(250); }
        }
      }
      await p.keyboard.press('Escape'); await p.waitForTimeout(80);
      if (!(await answers())) { hung = true; errors.push(`${where}: the page stopped answering`); break; }
      if (!p.url().endsWith(`#/${id}`)) { await p.goto(url); await p.waitForTimeout(700); }
      operated++;
    } catch { /* a control that went away or is covered by what the last one opened: not a failure by itself */ }
  }
  ok(`${id} (${width} px): ${operated} of ${count} controls operated, no page errors and no hang`, errors.length === 0 && operated > 0, [...new Set(errors)].slice(0, 3).join(' | '));
  await p.close();
}
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
