// Every control on every docs page, operated: buttons pressed, tabs / radios / checkboxes / switches chosen and then
// turned back (another option of the group, or the same toggle again), sliders moved, comboboxes opened and a value
// taken — each followed by Escape. Fails on a page error, a console error from the app, or a page that stops answering.
// It does not judge results or looks (the other suites do); it catches the part that breaks the page on the way there
// and back (a scatter switched to linear and back to log once hung the page this way).
// usage: node tests/e2e/sweep.mjs   (BROWSER=webkit|firefox, WIDTH=390 for phone width, SHARD=2/3 for every 3rd page
//        starting at the 2nd; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { PAGES } from './pages.mjs';   /* every page; a page missing from WEIGHT counts as 40 */
const engine = process.env.BROWSER || 'chromium';
const width = Number(process.env.WIDTH) || 1280;
/* pages with how many controls each had (2026-11-23): the time goes with the count, so the shares are dealt by it —
   each page to the lightest share so far, heaviest first (a page not listed counts as 40) */
const WEIGHT = { selection: 165, lab: 144, table: 90, navigation: 80, evaluation: 73, motion: 72, display: 56, showcase: 42, dashboard: 34,
  charts: 33, inputs: 32, buttons: 31, material: 27, overlays: 26, feedback: 23, lists: 21, start: 20, theming: 18, a11y: 8, colors: 13, overview: 13, type: 13 };
const [k, n] = (process.env.SHARD || '1/1').split('/').map(Number);
const shares = Array.from({ length: n }, () => ({ w: 0, pages: [] }));
for (const id of [...PAGES].sort((a, c) => (WEIGHT[c] ?? 40) - (WEIGHT[a] ?? 40))) { const s = shares.reduce((m, x) => (x.w < m.w ? x : m)); s.pages.push(id); s.w += WEIGHT[id] ?? 40; }
const mine = shares[k - 1].pages;
const SEL = ['button:not([disabled])', '[role=tab]', '[role=radio]', '[role=checkbox]', '[role=switch]', '[role=combobox]', '[role=slider]', 'summary'].map((s) => `main ${s}`).join(', ');
const TOGGLES = new Set(['tab', 'radio', 'checkbox', 'switch']);
class Hang extends Error {}

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
  /* a page that never loads, or stops answering before its controls are read, fails alone: the pages after it are
     still swept */
  const loaded = await p.goto(url).then(() => true, () => false);
  if (!loaded) { ok(`${id} (${width} px): the page did not load`, false); await p.close().catch(() => {}); continue; }
  await p.waitForTimeout(900);
  const answers = () => Promise.race([p.evaluate(() => true), new Promise((r) => setTimeout(() => r(false), 4000))]).catch(() => false);
  /* two frames after each step: React has committed and its effects have run, which is all this suite judges (errors
     and hangs; results and looks are the other suites'). Waiting for animations to end as well (fixed 250 ms pauses,
     later a wait for them to settle) made this the longest suite of the run; the next step now often lands while
     the last one still animates, which exercises the interrupted paths too. Errors thrown when an animation ends
     are still caught: the page is drained before it closes (they may then be named after the next control). A
     renderer that stops producing frames is a hang: the wait gives up after 4 s, as `answers` does */
  const settle = async () => {
    const framed = await Promise.race([p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))), new Promise((r) => setTimeout(() => r(false), 4000))]).catch(() => true);
    if (!framed) throw new Hang();
  };
  /* the controls as the page first shows them, each marked with its index once: a list read live would shift as
     the steps mount and unmount controls, skipping some and visiting others twice. Each also gets a fingerprint (role,
     name, and which of the same it is), so a control replaced by a remount (a dismissed banner shown again, or the
     page loaded again) is found again as the same control. One an earlier step took away is looked for on the page
     loaded afresh; one that cannot be found even there is reported as gone */
  /* the fingerprint names what holds the control too (the nearest labelled region or demo): two tables' "Amount"
     sort buttons are different controls */
  const FP = (sel) => { const seen = {}; return [...document.querySelectorAll(sel)].map((e) => { const box = e.parentElement?.closest('[aria-label], [data-demo]'); const k = `${box ? box.getAttribute('aria-label') || box.getAttribute('data-demo') : ''}>${e.getAttribute('role') || e.tagName}|${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)}`; seen[k] = (seen[k] ?? 0) + 1; return [e, `${k}#${seen[k]}`]; }); };
  const bounded = (work) => Promise.race([work, new Promise((r) => setTimeout(() => r(Hang), 4000))]).then((v) => { if (v === Hang) throw new Hang(); return v; });
  const prints = await bounded(p.evaluate(([sel, fp]) => new Function(`return (${fp})`)()(sel).map(([e, f], i) => { e.setAttribute('data-sweep', String(i)); return f; }), [SEL, FP.toString()])).catch((e) => { if (e instanceof Hang) return null; throw e; });
  if (!prints) { ok(`${id} (${width} px): the page stopped answering before its controls were read`, false); await p.close().catch(() => {}); continue; }
  /* the ordinal is counted on the live page, so a kind of control is relinked only while the page shows as many of
     it as the first scan did: with one of two "Remove" buttons gone, or one still behind a placeholder, the other
     would take its index. Those wait for the page loaded afresh, and for all of them to be there */
  const relink = () => bounded(p.evaluate(([sel, fp, prints]) => {
    const kind = (f) => f.slice(0, f.lastIndexOf('#'));
    const live = new Function(`return (${fp})`)()(sel);
    const many = (list, k) => list.filter((f) => kind(f) === k).length;
    for (const [e, f] of live) {
      if (e.hasAttribute('data-sweep')) continue;
      if (many(live.map(([, x]) => x), kind(f)) !== many(prints, kind(f))) continue;
      const j = prints.indexOf(f);
      if (j >= 0 && !document.querySelector(`[data-sweep="${j}"]`)) e.setAttribute('data-sweep', String(j));
    }
  }, [SEL, FP.toString(), prints]));
  const count = prints.length;
  let operated = 0, hidden = 0, hung = false;
  const threw = [], gone = [];
  for (let i = 0; i < count && !hung; i++) {
    const el = p.locator(`[data-sweep="${i}"]`);
    try {
      if (!(await el.count())) await relink();
      /* still gone: an earlier step took it away (a tab switched, a month paged): the page as it first was has it */
      if (!(await el.count())) {
        /* afresh: an earlier step may have changed what the docs keep (the language), and the page's names with it */
        await bounded(p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* none */ } }));
        /* the page's own URL, not the current one: switching the language writes `?lang=` into it, and the query wins
           over storage. Through a blank page, so that it loads again: going to a URL that differs only in the hash
           keeps the document and the app's state */
        await p.goto('about:blank'); await p.goto(url);
        /* until it is there again (a page may show placeholders first: the dashboard's skeleton), at most 2.5 s */
        for (const t0 = Date.now(); Date.now() - t0 < 2500 && !(await el.count()); await p.waitForTimeout(150)) await relink();
      }
      if (!(await el.count())) { gone.push(prints[i]); continue; }
      /* not operable as the page stands: out of sight (a collapsed section, a disabled control) */
      if (!(await el.isVisible()) || !(await el.isEnabled())) { hidden++; continue; }
      const role = await el.getAttribute('role');
      const label = ((await el.getAttribute('aria-label')) || (await el.textContent()) || '').trim().slice(0, 30);
      where = `${role ?? 'button'} “${label}”`;
      let returned = true;
      await el.scrollIntoViewIfNeeded({ timeout: 1500 });
      if (role === 'slider') { await el.focus(); for (const key of ['ArrowRight', 'End', 'Home']) await p.keyboard.press(key); }
      else if (role === 'combobox') {
        await el.click({ timeout: 1500 });
        for (let j = 0; j < 2; j++) { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await settle(); }
      } else {
        /* and back: the same toggle again, or the option of its group chosen before (a tab, a radio, or a pressed
           button that selects rather than toggles: one of a row of category chips, a calendar day); with none chosen
           before, or this one, there is nothing to go back to */
        const pick = role === 'radio' || role === 'tab';
        const pressed = (await el.getAttribute('aria-pressed')) !== null;
        const toggle = TOGGLES.has(role ?? '') || pressed;
        const before = (pick || pressed) && await bounded(el.evaluate((e) => {
          document.querySelectorAll('[data-sweep-back]').forEach((o) => o.removeAttribute('data-sweep-back'));
          const r = e.getAttribute('role');
          const group = r ? e.closest('[role=radiogroup], [role=tablist]') ?? e.parentElement : e.parentElement?.closest('[role=group], [role=toolbar], [role=grid]') ?? e.parentElement;
          const was = [...(group?.querySelectorAll(r ? `[role=${r}]` : '[aria-pressed]') ?? [])].find((o) => o !== e && ['aria-checked', 'aria-selected', 'aria-pressed'].some((a) => o.getAttribute(a) === 'true'));
          if (!was) return false;
          was.setAttribute('data-sweep-back', ''); return true;
        }));
        await el.click({ timeout: 1500 }); await settle();
        if (toggle && (!pick || before)) {
          /* a pressed button whose neighbour stays pressed is a toggle of its own (a filter chip): it goes back by
             itself */
          const mark = p.locator('[data-sweep-back]');
          const back = before && !(pressed && (await mark.getAttribute('aria-pressed', { timeout: 500 }).catch(() => null)) === 'true') ? mark : el;
          /* a way back that cannot be clicked (covered by what the first click opened, or gone with it) means this
             control was not operated there and back */
          if (await back.isVisible().catch(() => false)) { await back.click({ timeout: 1500 }); await settle(); }
          else returned = false;
        }
        if (before) await bounded(p.evaluate(() => document.querySelectorAll('[data-sweep-back]').forEach((o) => o.removeAttribute('data-sweep-back')))).catch((e) => { if (e instanceof Hang) throw e; });
      }
      await p.keyboard.press('Escape'); await settle();
      if (!(await answers())) { hung = true; errors.push(`${where}: the page stopped answering`); break; }
      if (!p.url().endsWith(`#/${id}`)) { await p.goto(url); await p.waitForTimeout(700); await relink(); }
      if (returned) operated++; else threw.push(`${where}: no way back after the first click`);
    } catch (e) {
      if (e instanceof Hang) { hung = true; errors.push(`${where}: the page stopped drawing frames`); break; }
      threw.push(`${where}: ${String(e.message).split('\n')[0].slice(0, 120)}`);
      /* clicks time out when the renderer stops drawing (actionability waits for frames): check before going on */
      try { await settle(); } catch { hung = true; errors.push(`${where}: the page stopped drawing frames`); }
    }
  }
  /* errors thrown late (an exit animation's end) still belong to this page, and it must still answer after them */
  await p.waitForTimeout(500);
  if (!hung && !(await answers())) errors.push('after the last control: the page stopped answering');
  /* a control that went away, or is covered by what the last one opened, is not a failure by itself; but a page
     where most of the controls in sight could not be operated was not swept (it used to pass with one of many).
     Controls that were gone and not found again count as not operated */
  const shown = count - hidden;
  ok(`${id} (${width} px): ${operated} of ${shown} controls in sight operated, no page errors and no hang`, errors.length === 0 && operated > 0 && operated * 2 >= shown, [...new Set(errors)].slice(0, 3).join(' | '));
  if (threw.length) console.log(`  not operated: ${threw.slice(0, 5).join(' | ')}${threw.length > 5 ? ` (+${threw.length - 5})` : ''}`);
  if (gone.length) console.log(`  gone before their turn: ${gone.slice(0, 5).join(' | ')}${gone.length > 5 ? ` (+${gone.length - 5})` : ''}`);
  await p.close();
}
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
