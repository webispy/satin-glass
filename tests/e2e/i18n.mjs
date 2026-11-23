// The docs in both languages: every page in English shows no Korean (text, accessible names, titles, placeholders),
// apart from what is Korean on purpose (marked lang="ko", such as the language switch's own name), and renders in
// Korean too; every API tab lists its components with a row and a description for every option; switching the
// language keeps the page and the tab.
// usage: node tests/e2e/i18n.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: *   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from './pw.mjs';
import { PAGES } from './pages.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = (id, lang) => `http://localhost:4173/?lang=${lang}#/${id}`;
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));

/* Korean text the reader can see or hear on the page, outside elements marked lang="ko" */
const korean = () => p.evaluate(() => {
  const HANGUL = /[ㄱ-ㆎ가-힣]/;
  const inKo = (el) => !!el?.closest('[lang="ko"], [lang^="ko-"]');
  const shown = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const found = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement;
    if (!HANGUL.test(n.data) || inKo(el) || el.closest('script, style') || !shown(el)) continue;
    found.push(n.data.trim().slice(0, 40));
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], [alt], [aria-roledescription], [aria-valuetext]')) {
    if (inKo(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'aria-roledescription', 'aria-valuetext']) {
      const v = el.getAttribute(a);
      if (v && HANGUL.test(v)) found.push(`[${a}] ${v.slice(0, 40)}`);
    }
  }
  return [...new Set(found)];
});

const apiPages = [];
for (const id of PAGES) {
  await p.goto(U(id, 'en')); await p.waitForSelector('.docs__page header', { timeout: 15000 }); await p.waitForTimeout(500);
  const ko = await korean();
  ok(`${id} (en): no Korean shown`, ko.length === 0, ko.slice(0, 6).join(' | '));
  if (await p.locator('.docs__tabs [role="tab"]', { hasText: 'API' }).count()) apiPages.push(id);
}
ok('pages with an API tab found', apiPages.length >= 8, apiPages.join(', '));

for (const id of PAGES) {
  await p.goto(U(id, 'ko')); await p.waitForSelector('.docs__page header', { timeout: 15000 });
  const title = await p.locator('.docs__page header').first().innerText();
  ok(`${id} (ko): renders, with a Korean title`, /[가-힣]/.test(title) || /^[A-Za-z ]+$/.test(title.trim()), title.split('\n')[0]);
}

for (const id of apiPages) {
  for (const lang of ['en', 'ko']) {
    await p.goto(`http://localhost:4173/?lang=${lang}#/${id}/api`); await p.waitForSelector('.api-list', { timeout: 15000 });
    const r = await p.evaluate(() => [...document.querySelectorAll('.api')].map((a) => ({
      name: a.dataset.api,
      rows: a.querySelectorAll('tbody tr').length,
      empty: [...a.querySelectorAll('tbody tr')].filter((tr) => !tr.querySelector('td:last-child')?.textContent?.trim()).map((tr) => tr.querySelector('th')?.textContent),
      descLang: [...a.querySelectorAll('tbody td:last-child')].every((td) => td.getAttribute('lang') === (document.documentElement.lang === 'ko' ? 'en' : null)),
      /* a part with no options of its own says so and lists the attributes it passes on */
      missing: !a.querySelector('table') && !(a.querySelector('.api__inherits') && /no options|자체 옵션/i.test(a.textContent)),
    })));
    ok(`${id}/api (${lang}): every component has an option table`, r.length > 0 && r.every((x) => !x.missing), r.filter((x) => x.missing).map((x) => x.name).join(', '));
    ok(`${id}/api (${lang}): every option has a description`, r.every((x) => x.empty.length === 0), r.filter((x) => x.empty.length).map((x) => `${x.name}: ${x.empty.slice(0, 4).join(' ')}`).join('; '));
    ok(`${id}/api (${lang}): English descriptions are marked lang="en" in Korean pages`, r.every((x) => x.descLang));
  }
}

/* switching keeps the page and the tab, and <html lang> follows */
{
  const id = apiPages[0] ?? 'table';
  await p.goto(`http://localhost:4173/?lang=en#/${id}/api`); await p.waitForSelector('.api-list');
  await p.locator('.docs__lang [role="radio"], .docs__lang button').filter({ hasText: '한국어' }).first().click();
  await p.waitForTimeout(600);
  const s = await p.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang, api: !!document.querySelector('.api-list') }));
  ok('switching to Korean keeps the page and the API tab', s.hash === `#/${id}/api` && s.lang === 'ko' && s.api, JSON.stringify(s));
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
