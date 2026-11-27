// The A2UI page's gallery of the A2UI project's own examples: every example of both protocol versions has a card,
// drawn once it comes near the screen, search finds them by name or component, nothing loads from another site until
// the media switch allows it, an example opens in a sheet beside its JSON, its messages can be stepped through (the
// keyboard stays in the sheet at either end), a press on the drawn screen shows what it sends back, and the sheet
// closes back to the card it opened from. Requests to other sites are refused in this suite; it counts every one
// that was tried, except the docs' own web font. Then what the package makes of the examples in Satin Glass terms, at
// full size in the sheet: surface and outlined cards, button labels in the control text role, an image at a card's top
// running to its sides (photos fulfilled here with a local picture), a cropped one opening whole in the media viewer,
// a short single choice as a segmented control, weighted panels in a narrow row stacking, in the themes and settings
// that change cards, and the nested corners (corners-scan.mjs) of what an example draws.
// usage: node tests/e2e/a2ui.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173 or E2E_PORT)
// covers: controls, layout, navigation, overlays, selection   (the components the gallery and the A2UI renderer draw with; a change to packages/a2ui or the docs frame runs everything)
import * as pw from './pw.mjs';
import { scan, TOL, MIN } from './corners-scan.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];
const outside = [];
const FONT = /^https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@/;

/* a picture of the size a photo's URL asks for (`w`, `h`; 600 × 900, taller than 4:5, when it asks for none), served
   for every photo an example asks for when `photos` is set */
const PHOTO = (url) => {
  const u = new URL(url), w = +u.searchParams.get('w') || 600, h = +u.searchParams.get('h') || 900;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#7a8fa6"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#e8d9b5"/></svg>`;
};
async function open(width = 1440, { query = '', photos = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  /* every request to another site is refused here and counted, whatever its kind; only the docs' web font (Pretendard,
     from jsDelivr, loaded by the docs shell on every page) is let through uncounted */
  await p.route(/^https?:\/\/(?!localhost)/, (r) => {
    const url = r.request().url();
    if (FONT.test(url)) return r.abort();
    outside.push(url);
    return photos && r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO(url) }) : r.abort();
  });
  await p.goto(`${pw.ORIGIN}/${query}#/a2ui`);
  await p.waitForSelector('[data-demo="a2ui-gallery"] .a2ui-thumb');
  await p.locator('[data-demo="a2ui-gallery"]').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  return p;
}
const thumbs = (p) => p.locator('.a2ui-thumb').count();
const count = (p) => p.locator('.a2ui-toolbar__find [aria-live]').textContent();
const card = (p, name) => p.locator('.a2ui-thumb', { has: p.locator('.a2ui-thumb__open', { hasText: name }) });
/* the cards whose frame is on the screen, and whether each has drawn its example */
const onScreen = (p) => p.evaluate(() => [...document.querySelectorAll('.a2ui-thumb__frame')].filter((f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
  .map((f) => !!f.querySelector('.a2ui-thumb__surface [data-a2ui-surface]')));
/* the open sheet's first JSON panel (openExample waits for a closing sheet to go first) */
const firstJson = (p) => p.locator('[role="dialog"] .a2ui-inspector__panel .a2ui-json').first().textContent();
/* Escape, then until the sheet has gone (its exit, or its fold on a wide screen, can run well past 600 ms on a busy CI
   runner) and the focus has come back from it */
async function closeAndWait(p) {
  await p.keyboard.press('Escape');
  const gone = await p.waitForFunction(() => !document.querySelector('.sg-sheet') && !document.querySelector('[role="dialog"]'), null, { timeout: 5000 }).then(() => true, () => false);
  await p.waitForTimeout(100);
  return gone;
}
const search = (p) => p.getByRole('searchbox', { name: '예제 찾기' });
async function openExample(p, q) {
  /* a sheet still closing from the last example is gone first, so what is read next is the new one's (a sheet that
     never goes is a failure, not something to read past) */
  await p.waitForFunction(() => !document.querySelector('.sg-sheet'), null, { timeout: 5000 }).catch(() => { throw new Error('the last example\'s sheet did not close'); });
  await search(p).fill(q);
  await p.waitForTimeout(300);
  const opener = p.locator('.a2ui-thumb__open').first();
  await opener.click();
  await p.getByRole('dialog').waitFor();
  await p.waitForTimeout(700);
  /* and until the sheet has stopped growing in: its spring can still run after 700 ms, more so on a busy machine, and
     a table's rows were once read 2 px apart in WebKit while it ran, as if at two of its scales */
  await p.waitForFunction(() => { const s = document.querySelector('.sg-sheet'); return !!s && s.getAnimations().every((a) => a.playState !== 'running'); }, null, { timeout: 5000 });
  return opener;
}

/* ---------------------------------------------------------------- the grid, the versions, search */
{
  const p = await open();
  /* until the cards on the screen have drawn (or 15 s): drawing a dozen examples at once took WebKit on a CI runner
     about 7 s, where Chromium on the same machine took half a second (#113); one never drawn still fails below */
  await p.waitForFunction(() => [...document.querySelectorAll('.a2ui-thumb__frame')].filter((f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
    .every((f) => f.querySelector('.a2ui-thumb__surface [data-a2ui-surface]')), null, { timeout: 15000 }).catch(() => {});
  ok('v1.0: all 43 examples in the grid', (await thumbs(p)) === 43 && /43개 중 43개/.test(await count(p)), `${await thumbs(p)} · ${await count(p)}`);
  /* a card is drawn once it comes near the screen, not before; drawn, it stays drawn */
  const seen = await onScreen(p);
  const drawn = await p.locator('.a2ui-thumb__surface').count();
  ok('the cards on the screen have drawn their example; the ones far below have not yet', seen.length > 0 && seen.every(Boolean) && drawn < 43, `${seen.filter(Boolean).length}/${seen.length} on screen drawn, ${drawn} of 43 mounted`);
  /* brought on screen first, and drawn: WebKit scrolls the tall gallery to its middle, which leaves the first cards
     well above the view, too far to be drawn (#113) */
  const coffee = card(p, 'Coffee Order').locator('.a2ui-thumb__frame');
  await coffee.scrollIntoViewIfNeeded();
  await coffee.locator('[data-a2ui-surface]').waitFor({ timeout: 15000 }).catch(() => {});
  ok('a card shows what its example draws (Coffee Order: Sunrise Coffee)', /Sunrise Coffee/.test(await coffee.textContent() ?? ''));
  /* the first card's drawing, marked: scrolled far away from it, it is the same node, still in the page */
  await p.locator('.a2ui-thumb__surface').first().evaluate((e) => { e.dataset.e2eFirst = ''; });
  await p.locator('.a2ui-thumb').last().scrollIntoViewIfNeeded();
  const end = await p.waitForFunction(() => { const on = [...document.querySelectorAll('.a2ui-thumb__frame')].filter((f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return on.length > 0 && on.every((f) => f.querySelector('.a2ui-thumb__surface [data-a2ui-surface]')); }, null, { timeout: 15000 }).then(() => true, () => false);
  const first = await p.evaluate(() => { const e = document.querySelector('[data-e2e-first]'); const r = e?.closest('.a2ui-thumb__frame')?.getBoundingClientRect(); return { kept: !!e?.isConnected, away: !!r && (r.bottom < 0 || r.top > innerHeight) }; });
  ok('scrolled to the last card, the cards there draw; the first card, now out of view, keeps its drawing', end && first.kept && first.away, JSON.stringify(first));
  /* each card's name is a button named by the example; the drawn picture is inert and hidden from assistive technology */
  const a = await p.evaluate(() => [...document.querySelectorAll('.a2ui-thumb')].map((t) => ({
    name: t.querySelector('.a2ui-thumb__open')?.textContent?.trim(),
    inert: t.querySelector('.a2ui-thumb__frame')?.hasAttribute('inert') && t.querySelector('.a2ui-thumb__frame')?.getAttribute('aria-hidden') === 'true',
  })));
  ok('each card is opened by a button with the example\'s name; its picture is inert', a.every((x) => x.name && x.inert), JSON.stringify(a.find((x) => !x.name || !x.inert)));
  ok('nothing was requested from another site with the media switch off', outside.length === 0, outside.slice(0, 3).join(' '));

  await p.locator('.a2ui-toolbar').getByRole('radio', { name: 'v0.9.1' }).click();
  await p.waitForTimeout(500);
  ok('v0.9.1: all 43 examples in the grid', (await thumbs(p)) === 43 && /43개 중 43개/.test(await count(p)), `${await thumbs(p)} · ${await count(p)}`);
  ok('v0.9.1: a card draws its example', /Sunrise Coffee/.test(await card(p, 'Coffee Order').locator('.a2ui-thumb__frame').textContent() ?? ''));
  /* the version is really switched: the messages are the v0.9 ones */
  await openExample(p, 'coffee');
  /* read from the sheet named for the example opened */
  const coffeeJson = p.getByRole('dialog', { name: /Coffee Order/ }).locator('.a2ui-inspector__panel .a2ui-json').first();
  await p.waitForFunction((el) => /"version": "v0\.9"/.test(el?.textContent ?? ''), await coffeeJson.elementHandle(), { timeout: 5000 }).catch(() => {});
  const v09 = (await coffeeJson.textContent()) ?? '';
  ok('v0.9.1: the opened example\'s messages are v0.9 messages', /"version": "v0\.9"/.test(v09), v09.slice(0, 40));
  await closeAndWait(p);
  await search(p).fill('');
  await p.locator('.a2ui-toolbar').getByRole('radio', { name: 'v1.0' }).click();
  await p.waitForTimeout(300);

  await search(p).fill('slider');
  await p.waitForTimeout(300);
  const found = await p.locator('.a2ui-thumb__open').allTextContents();
  ok('search finds examples by a component they use (slider)', found.length >= 1 && found.length < 43 && /1개|\d+개/.test(await count(p)), found.join(', '));
  /* the card names only the components that set an example apart; search reads all of them */
  await search(p).fill('divider');
  await p.waitForTimeout(300);
  ok('search finds a component the card does not name (Divider)', (await p.locator('.a2ui-thumb__open').allTextContents()).includes('Coffee Order'));
  await search(p).fill('coffee');
  await p.waitForTimeout(300);
  ok('search finds an example by its name (coffee)', (await p.locator('.a2ui-thumb__open').allTextContents()).join() === 'Coffee Order');
  await search(p).fill('no such example');
  await p.waitForTimeout(300);
  ok('a search that matches nothing shows no cards and says 0', (await thumbs(p)) === 0 && /43개 중 0개/.test(await count(p)), await count(p));
  await search(p).fill('');
  await p.waitForTimeout(300);
  ok('clearing the search shows every example again', (await thumbs(p)) === 43);
  ok('nothing was requested from another site with the switch off, after all that', outside.length === 0, outside.slice(0, 3).join(' '));

  /* the switch lets the examples load what they link to (refused here, but asked for) */
  const before = outside.length;
  await p.getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).first().click();
  await p.waitForTimeout(1200);
  ok('with the media switch on, the examples ask for their media', outside.length > before, `${outside.length - before} requests`);
  await p.context().close();
}

/* ---------------------------------------------------------------- an example in the sheet */
{
  outside.length = 0;
  const p = await open();
  const opener = await openExample(p, 'coffee');
  const sheet = p.getByRole('dialog');
  ok('the sheet is named by the example', (await p.getByRole('dialog', { name: 'Coffee Order' }).count()) === 1);
  ok('v1.0: the messages are v1.0 messages', /"version": "1\.0"/.test(await firstJson(p)), (await firstJson(p)).slice(0, 40));
  /* the region is named in the page's language; only what the example drew is marked as English */
  const langs = await p.evaluate(() => { const r = document.querySelector('.a2ui-inspector__surface'); return { region: r.closest('[lang]')?.getAttribute('lang') ?? '', drawn: [...r.children].map((c) => c.getAttribute('lang')) }; });
  ok('the screen\'s region is in the page\'s language, what it drew in English', !/^en/.test(langs.region) && langs.drawn.length > 0 && langs.drawn.every((l) => l === 'en'), JSON.stringify(langs));
  const label = () => p.locator('.a2ui-steps__label').textContent();
  const blocks = () => p.locator('.a2ui-inspector__panel .a2ui-code__block').count();
  ok('it opens with every message applied, one JSON block per message', /메시지 3개 모두 적용/.test(await label()) && (await blocks()) === 3, `${await label()} · ${await blocks()}`);
  ok('the drawn screen is there, with its buttons', await p.locator('.a2ui-inspector__surface').getByRole('button', { name: 'Purchase' }).isVisible());

  /* stepping back to the first message with the keyboard: nothing is drawn yet, and the screen says so. At the first
     message the button stays focused: a press does nothing, and focus does not fall out of the sheet */
  const prev = p.getByRole('button', { name: '이전 메시지' });
  await prev.focus();
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
  await p.waitForTimeout(200);
  ok('stepping back shows the screen up to that message', /3개 중 1번째까지/.test(await label()) && /createSurface/.test(await p.locator('.a2ui-steps__kind').textContent()), await label());
  ok('with no components sent yet, the screen says nothing is drawn', await p.locator('.a2ui-inspector__note').first().isVisible()
    && !(await p.locator('.a2ui-inspector__surface').getByRole('button', { name: 'Purchase' }).count()));
  ok('at the first message the previous button says it is unavailable, and keeps the focus in the sheet', (await prev.getAttribute('aria-disabled')) === 'true'
    && await prev.evaluate((e) => e === document.activeElement && !!e.closest('[role="dialog"]')), await p.evaluate(() => document.activeElement?.tagName));
  await p.keyboard.press('Tab');
  ok('and Tab moves on to the next button', await p.getByRole('button', { name: '다음 메시지' }).evaluate((e) => e === document.activeElement));
  /* a message's heading applies the screen up to it */
  await p.locator('.a2ui-code__head').nth(1).click();
  await p.waitForTimeout(300);
  ok('a message heading applies the screen up to it', /3개 중 2번째까지/.test(await label()) && (await p.locator('.a2ui-code__head[aria-current="step"]').count()) === 1
    && (await p.locator('.a2ui-code__head').nth(1).getAttribute('aria-current')) === 'step', await label());
  /* its marker is on the start edge: the left here, the right when the text runs right to left */
  const marker = (dir) => p.evaluate((dir) => {
    const box = document.querySelector('.a2ui-inspector__panel .a2ui-code__scroll');
    box.dir = dir;
    const w = [...box.querySelectorAll('.a2ui-code__head')].map((h) => { const s = getComputedStyle(h, '::before'); return s.content === 'none' ? '-' : `${s.borderLeftWidth}|${s.borderRightWidth}`; });
    box.removeAttribute('dir');
    return w.join(' ');
  }, dir);
  const ltr = await marker('ltr'), rtl = await marker('rtl');
  ok('only the current message has the marker, on the start edge in either direction', ltr === '- 3px|0px -' && rtl === '- 0px|3px -', `ltr ${ltr} · rtl ${rtl}`);
  const all = p.getByRole('button', { name: '전체', exact: true });
  await all.focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  ok('"All" applies every message again; at the end it and the next button say they are unavailable, and it keeps the focus', /모두 적용/.test(await label())
    && (await p.getByRole('button', { name: '다음 메시지' }).getAttribute('aria-disabled')) === 'true' && (await all.getAttribute('aria-disabled')) === 'true'
    && await all.evaluate((e) => e === document.activeElement));
  /* a press would also bring back the agent's messages: with the other tab chosen, it stays chosen */
  await p.getByRole('tab', { name: /화면 → 에이전트/ }).click();
  await all.focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  ok('a press on an unavailable button does nothing', /모두 적용/.test(await label()) && (await p.getByRole('tab', { name: /화면 → 에이전트/ }).getAttribute('aria-selected')) === 'true');
  await p.getByRole('tab', { name: /에이전트 → 화면/ }).click();

  /* a press on the screen: what it sends back is shown at once */
  await p.locator('.a2ui-inspector__surface').getByRole('button', { name: 'Purchase' }).click();
  await p.waitForTimeout(400);
  const out = p.getByRole('tab', { name: /화면 → 에이전트/ });
  const panel = await p.locator('.a2ui-inspector__panel [role="region"]').first().textContent();
  ok('a press switches to what the screen sent, with the action in it', (await out.getAttribute('aria-selected')) === 'true' && /purchase/.test(panel ?? ''), (panel ?? '').slice(0, 80));

  /* the JSON panels scroll, so they take the keyboard */
  const regions = await p.locator('.a2ui-inspector__panel .a2ui-code__scroll').evaluateAll((l) => l.map((e) => e.tabIndex === 0 && e.getAttribute('role') === 'region' && !!e.getAttribute('aria-label')));
  ok('the JSON panel is a named region in the Tab order', regions.length > 0 && regions.every(Boolean));

  /* the copy button says it copied (where the engine lets the page write to the clipboard) */
  if (engine === 'chromium') {
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: pw.ORIGIN });
    await p.getByRole('tab', { name: /에이전트 → 화면/ }).click();
    await p.locator('.a2ui-inspector__panel .a2ui-code__copy').first().click();
    await p.waitForTimeout(400);
    const copied = await p.evaluate(() => navigator.clipboard.readText()).then((t) => { try { return JSON.parse(t); } catch { return null; } });
    ok('copying the JSON copies the three messages and says so', await p.locator('.sg-toaster').getByText('복사했어요').isVisible()
      && Array.isArray(copied) && copied.length === 3 && 'createSurface' in copied[0]);
  }

  const escGone = await closeAndWait(p);
  /* the focus comes back once the exit has ended */
  await p.waitForFunction((el) => el === document.activeElement, await opener.elementHandle(), { timeout: 3000 }).catch(() => {});
  ok('Escape closes the sheet and focus goes back to the card that opened it', escGone && await opener.evaluate((e) => e === document.activeElement));

  /* the close button in the header: the way out without a keyboard */
  await opener.click();
  await sheet.waitFor();
  await p.waitForTimeout(700);
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  const btnGone = await p.waitForFunction(() => !document.querySelector('.sg-sheet'), null, { timeout: 5000 }).then(() => true, () => false);
  await p.waitForFunction((el) => el === document.activeElement, await opener.elementHandle(), { timeout: 3000 }).catch(() => {});
  ok('the close button closes the sheet and focus goes back to the card that opened it', btnGone && await opener.evaluate((e) => e === document.activeElement));
  ok('nothing was requested from another site in the sheet with the switch off', outside.length === 0, outside.slice(0, 3).join(' '));
  await p.context().close();
}

/* ---------------------------------------------------------------- media in the sheet: off, on, off */
{
  outside.length = 0;
  /* the photos are served (a refused one is taken out of the screen), and still counted */
  const p = await open(1440, { photos: true });
  await openExample(p, 'movie');
  const sheet = p.getByRole('dialog');
  const media = p.locator('.a2ui-inspector__surface').locator('img[src^="http"], video[src^="http"]');
  const toggle = sheet.getByRole('switch', { name: '다른 사이트의 미디어 불러오기' });
  ok('Movie Card with the switch off: no media in the screen, nothing requested from another site, and the screen says what it left out', (await media.count()) === 0
    && outside.length === 0 && /불러오지 않았습니다/.test((await p.locator('.a2ui-inspector__note').allTextContents()).join()), outside.slice(0, 3).join(' '));
  await toggle.click();
  await p.waitForTimeout(1200);
  ok('switched on in the sheet, the open example draws its media and asks for it', (await media.count()) > 0 && outside.length > 0, `${await media.count()} in the screen, ${outside.length} requests`);
  await toggle.click();
  await p.waitForTimeout(300);
  outside.length = 0;
  ok('switched off again, the media leave the screen', (await media.count()) === 0);
  /* and the messages applied once more ask for nothing */
  await p.getByRole('button', { name: '이전 메시지' }).click();
  await p.waitForTimeout(200);
  await p.getByRole('button', { name: '전체', exact: true }).click();
  await p.waitForTimeout(1000);
  ok('switched off again, the example asks for nothing more', outside.length === 0, outside.slice(0, 3).join(' '));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  /* the switch does not draw the example again: a tab chosen in Recipe Card stays chosen */
  await openExample(p, 'recipe');
  const tabs = p.locator('.a2ui-inspector__surface');
  await tabs.getByRole('tab', { name: 'Ingredients' }).click();
  await toggle.click();
  await p.waitForTimeout(500);
  const on = await tabs.getByRole('tab', { name: 'Ingredients' }).getAttribute('aria-selected');
  await toggle.click();
  await p.waitForTimeout(500);
  const off = await tabs.getByRole('tab', { name: 'Ingredients' }).getAttribute('aria-selected');
  ok('turning the switch on and off keeps the screen\'s state (Recipe Card\'s chosen tab)', on === 'true' && off === 'true', `${on} · ${off}`);
  await p.context().close();
}

/* ---------------------------------------------------------------- Satin Glass's look, at full size in the sheet */
const screen = (p) => p.locator('.a2ui-inspector__surface');
const style = (loc, ...keys) => loc.evaluate((e, keys) => { const cs = getComputedStyle(e); return Object.fromEntries(keys.map((k) => [k, cs[k]])); }, keys);
const closeSheet = closeAndWait;
/* the outermost card of the screen and its inner cards: lifted (a shadow, or in high contrast an outline) and outlined */
const cards = (p) => screen(p).evaluate((s) => [...s.querySelectorAll('.sg-card')].map((c) => {
  const cs = getComputedStyle(c);
  return { outer: !c.parentElement.closest('.sg-card'), outlined: c.classList.contains('sg-card--outlined'), shadow: cs.boxShadow !== 'none', border: parseFloat(cs.borderTopWidth) > 0 };
}));
/* the element that draws a button's words */
const words = (button) => button.evaluate((bt) => { let e = bt; for (;;) { const k = [...e.children].find((c) => c.textContent.trim() === bt.textContent.trim()); if (!k) break; e = k; }
  const cs = getComputedStyle(e); return { weight: cs.fontWeight, size: cs.fontSize, tag: e.tagName.toLowerCase() }; });
/* the screen's corners: compared at full size by the corners suite's rules */
let compared = 0;
const corners = async (p) => { const c = await p.evaluate(scan, { TOL, MIN, root: '.a2ui-inspector__surface' }); compared += c.pairs; return c; };
/* the segmented controls a reader sees (the picker also draws a hidden one, to measure) */
const segments = (p) => screen(p).locator('.sg-segmented:not([data-a2ui-probe] *)');

for (const query of ['', '?mode=dark', '?mode=dark&hc=1', '?mode=light&hc=1&rt=1']) {
  const where = query || 'light';
  const p = await open(1440, { query });
  await openExample(p, 'coffee');
  const cc = await cards(p);
  const outer = cc.find((c) => c.outer);
  ok(`${where}: Coffee Order's outermost card is a surface card, lifted`, !!outer && !outer.outlined && (outer.shadow || outer.border), JSON.stringify(cc));
  const buy = screen(p).getByRole('button', { name: 'Purchase' });
  const w = await words(buy);
  ok(`${where}: a button's label is in the control text role (Purchase: 620, 15 px), not a paragraph`, w.weight === '620' && w.size === '15px' && w.tag !== 'p', JSON.stringify(w));
  let c = await corners(p);
  ok(`${where}: Coffee Order's corners nest (${c.pairs} compared)`, c.bad.length === 0, c.bad.slice(0, 4).join(' ;; '));
  await closeSheet(p);
  await openExample(p, 'incremental dashboard');
  /* no example nests a Card in a Card (the outline of an inner card is in the unit tests): a card in a weighted
     column of a row is still the outermost, and lifted */
  const ic = await cards(p);
  ok(`${where}: Incremental Dashboard's card, in a panel of a row, is a surface card too`, ic.length > 0 && ic.every((x) => x.outer && !x.outlined && (x.shadow || x.border)), JSON.stringify(ic));
  c = await corners(p);
  ok(`${where}: Incremental Dashboard's corners nest (${c.pairs} compared)`, c.bad.length === 0, c.bad.slice(0, 4).join(' ;; '));
  await p.context().close();
}

/* an image at a card's top, and the whole image */
for (const query of ['', '?rm=1']) {
  outside.length = 0;
  const where = query ? 'reduced motion' : 'default';
  const p = await open(1440, { query, photos: true });
  await openExample(p, 'movie');
  await p.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).click();
  const img = screen(p).locator('[data-a2ui-edge] img');
  await img.waitFor();
  await p.waitForFunction(() => document.querySelector('.a2ui-inspector__surface [data-a2ui-edge] img')?.naturalWidth > 0, null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  const m = await img.evaluate((i) => { const r = i.getBoundingClientRect(), c = i.closest('.sg-card').getBoundingClientRect(); return { left: r.left - c.left, right: c.right - r.right, top: r.top - c.top, w: r.width, h: r.height }; });
  ok(`${where}: Movie Card's poster runs to the card's sides and top`, Math.abs(m.left) <= 0.5 && Math.abs(m.right) <= 0.5 && Math.abs(m.top) <= 0.5, JSON.stringify(m));
  ok(`${where}: a 2:3 poster is cut to a 4:5 portrait of the card's width, at most 400 px`, m.h <= Math.min(1.25 * m.w, 400) + 0.5 && m.h >= Math.min(1.25 * m.w, 400) - 0.5, JSON.stringify(m));
  const whole = screen(p).getByRole('button', { name: /^(사진 전체 보기|View the whole image)/ });
  ok(`${where}: the cropped poster is a button that opens a dialog`, (await whole.count()) === 1 && (await whole.getAttribute('aria-haspopup')) === 'dialog');
  if (await whole.count()) {
    await whole.click();
    const viewer = p.locator('.sg-media[role="dialog"]');
    await viewer.waitFor({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(700);
    const shown = await viewer.locator('img').first().evaluate((i) => ({ w: i.naturalWidth, h: i.naturalHeight, ratio: i.getBoundingClientRect().width / i.getBoundingClientRect().height })).catch(() => null);
    /* the viewer's own picture loaded (not just its frame, which takes the thumbnail's size) and is the whole 2:3 photo */
    ok(`${where}: the media viewer shows the whole poster (2:3)`, await viewer.isVisible() && !!shown && shown.w > 0 && shown.h > 0 && Math.abs(shown.w / shown.h - 2 / 3) < 0.02 && Math.abs(shown.ratio - 2 / 3) < 0.02, JSON.stringify(shown));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(800);
    ok(`${where}: Escape closes the viewer, the sheet stays open, and the focus goes back to the poster`, !(await viewer.isVisible()) && await p.getByRole('dialog', { name: 'Movie Card' }).isVisible()
      && await whole.evaluate((e) => e === document.activeElement));
    /* reached with the keyboard, it shows the library's focus ring, inside the card's clip */
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    await p.waitForTimeout(200);
    const ring = await whole.evaluate((e) => { const cs = getComputedStyle(e); return { focused: e === document.activeElement, style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset }; });
    ok(`${where}: Tab onto the poster shows a focus ring drawn inside it`, ring.focused && ring.style !== 'none' && parseFloat(ring.width) > 0 && parseFloat(ring.offset) < 0, JSON.stringify(ring));
  }
  if (!query) {
    const c = await corners(p);
    ok(`Movie Card's corners nest, the poster clipped by the card (${c.pairs} compared)`, c.bad.length === 0 && c.pairs > 0, c.bad.slice(0, 4).join(' ;; '));
  }
  await p.context().close();
}

/* a short single choice */
{
  outside.length = 0;
  const p = await open();
  await openExample(p, 'software');
  const seg = segments(p);
  ok('Software Purchase: Annual / Monthly is a segmented control, Annual chosen', (await seg.count()) === 1 && (await seg.getByRole('radio', { name: 'Annual' }).getAttribute('aria-checked')) === 'true');
  /* the control shows the bound value (/billingPeriod), so a choice that stays shown was written to the data model
     and read back (the gallery sends no data model with an action, so it cannot be read from what is sent) */
  await seg.getByRole('radio', { name: 'Monthly' }).click();
  await p.waitForTimeout(400);
  ok('choosing Monthly writes it to the data model: it stays chosen, still a segmented control', (await segments(p).count()) === 1
    && (await seg.getByRole('radio', { name: 'Monthly' }).getAttribute('aria-checked')) === 'true' && (await seg.getByRole('radio', { name: 'Annual' }).getAttribute('aria-checked')) === 'false');
  await closeSheet(p);

  /* Live Invitation Builder: weighted panels in a row, its location as a segmented control while it fits */
  await openExample(p, 'invitation');
  /* the row of weighted panels: its inner width (as drawn, not rounded) and whether they stand on one line or two */
  const row = () => screen(p).evaluate((s) => {
    const panels = [...s.querySelectorAll('[data-a2ui-panel]')];
    let r = panels[0]?.parentElement ?? null;
    while (r && getComputedStyle(r).display === 'contents') r = r.parentElement;
    const cs = r && getComputedStyle(r);
    const inner = r ? r.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) : 0;
    return { n: panels.length, inner: Math.round(inner * 100) / 100, gap: r ? parseFloat(cs.columnGap) || 0 : 0, spare: s.getBoundingClientRect().width - inner,
      min: panels.map((x) => getComputedStyle(x).minWidth), lines: panels.length === 2 && Math.abs(panels[0].getBoundingClientRect().top - panels[1].getBoundingClientRect().top) > 1 ? 2 : 1 };
  });
  /* the screen given the width that makes the row's inner width the one asked for */
  const widthTo = async (target) => {
    const { spare } = await row();
    await screen(p).evaluate((s, w) => { s.style.flex = 'none'; s.style.maxWidth = 'none'; s.style.width = `${w}px`; }, target + spare);
    await p.waitForTimeout(300);
    return row();
  };
  const r0 = await row();
  const edge = 2 * 240 + r0.gap;
  ok('Live Invitation Builder: two weighted panels, each at least 15rem or the row', r0.n === 2 && r0.min.every((x) => /^min\(240px, 100%\)$/.test(x)), JSON.stringify(r0));
  const seq = [];
  for (const t of [edge - 1, edge, edge - 1, edge]) { const r = await widthTo(t); seq.push(`${r.inner}:${r.lines}`); }
  ok(`the row stacks the panels below ${edge} px and puts them side by side from it, both ways`, seq.join(' ') === `${edge - 1}:2 ${edge}:1 ${edge - 1}:2 ${edge}:1`, seq.join(' '));
  await screen(p).evaluate((s) => { s.style.width = ''; s.style.flex = ''; s.style.maxWidth = ''; });
  await p.waitForTimeout(400);
  const loc = () => screen(p).evaluate((s) => [...s.querySelectorAll('.sg-segmented')].some((x) => !x.closest('[data-a2ui-probe]') && /Grand Ballroom/.test(x.textContent)));
  ok('at the sheet\'s width the location is a segmented control', await loc());
  await p.context().close();

  for (const width of [390, 320]) {
    const q = await open(width);
    await openExample(q, 'invitation');
    const o = await q.evaluate(() => { const s = document.querySelector('.a2ui-inspector__surface'); const i = document.querySelector('.a2ui-inspector');
      return { page: document.documentElement.scrollWidth - innerWidth, inspector: i.scrollWidth - i.clientWidth, screen: s.scrollWidth - s.clientWidth,
        seg: [...s.querySelectorAll('.sg-segmented')].some((x) => !x.closest('[data-a2ui-probe]') && /Grand Ballroom/.test(x.textContent)), chips: ([...s.querySelectorAll('[role="radiogroup"]')].find((g) => !g.closest('[data-a2ui-probe]') && /Grand Ballroom/.test(g.textContent))?.querySelectorAll('.sg-chip').length ?? 0) >= 3 }; });
    ok(`at ${width} px Live Invitation Builder does not scroll sideways, and the location is chips`, o.page <= 0 && o.inspector <= 1 && o.screen <= 1 && !o.seg && o.chips, JSON.stringify(o));
    await q.context().close();
  }
}

/* the layout as the catalog means it: rows on one line, images at their own size, a table, spread rows, a blocked button */
{
  outside.length = 0;
  const p = await open(1440, { photos: true });
  const rect = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  /* the table in the grid's scaled-down card settles: its width and height hold still (it once measured in screen and
     layout pixels at once, and under the card's 0.58 scale went on resizing) */
  await search(p).fill('financial');
  await p.waitForTimeout(800);
  const thumb = p.locator('.a2ui-thumb__frame [data-a2ui-table]').first();
  const samples = [];
  for (let i = 0; i < 10; i++) { samples.push(await thumb.evaluate((t) => `${t.style.getPropertyValue('--a2ui-table-min')}/${Math.round(t.getBoundingClientRect().height * 10) / 10}`)); await p.waitForTimeout(100); }
  ok('the table in the grid\'s scaled-down card holds still', samples.every((x) => x === samples[0]), samples.join(' '));
  await search(p).fill('');
  await p.waitForTimeout(300);
  /* Financial Data Grid: one table, its columns in line with its header, no amount split, scrolling sideways */
  await openExample(p, 'financial');
  const grid = await screen(p).evaluate((s) => {
    const t = s.querySelector('[data-a2ui-table]');
    const rows = [...s.querySelectorAll('.sg-stack--row')].filter((r) => r.style.minWidth.includes('table-min'));
    const lefts = rows.map((r) => [...r.children].map((c) => { const x = getComputedStyle(c).display === 'contents' ? c.firstElementChild : c; return Math.round(x.getBoundingClientRect().left * 2) / 2; }));
    /* each amount on one line: its text's line boxes */
    const split = [...s.querySelectorAll('p, span')].filter((e) => /^-?\$?[\d,]+\.\d+%?$/.test(e.textContent.trim()) && e.children.length === 0)
      .filter((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1; }).map((e) => e.textContent);
    return { table: !!t, scrolls: t ? t.scrollWidth > t.clientWidth + 1 : false, mask: t ? getComputedStyle(t).maskImage || getComputedStyle(t).webkitMaskImage : '', rows: rows.length, lefts, split };
  });
  ok('Financial Data Grid: four rows of one table, scrolling sideways in a 486 px surface, its far edge faded', grid.table && grid.rows === 4 && grid.scrolls && /gradient/.test(grid.mask), JSON.stringify({ ...grid, lefts: undefined }));
  ok('its columns stay in line from the header through every row', grid.lefts.every((l) => JSON.stringify(l) === JSON.stringify(grid.lefts[0])), JSON.stringify(grid.lefts));
  ok('no amount is split across lines', grid.split.length === 0, grid.split.join(', '));
  /* nothing inside the table scrolls sideways on its own: a gesture would catch on it and stop (its list's padding
     once left the rows 8 px of room to scroll) */
  const inner = await screen(p).locator('[data-a2ui-table]').evaluate((t) => [...t.querySelectorAll('*')].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1).map((e) => `${e.tagName}:${e.scrollWidth - e.clientWidth}`));
  ok('nothing inside the table scrolls sideways on its own', inner.length === 0, inner.join(', '));
  /* scrolling it sideways (a trackpad's run of wheel events) writes nothing to the rows: no measuring, no new render
     (a write mid-scroll stops the trackpad's momentum), and it moves one way, to the end */
  const table = screen(p).locator('[data-a2ui-table]');
  await table.evaluate((t) => { window.__writes = 0; window.__mo = new MutationObserver((l) => { window.__writes += l.filter((m) => m.target !== t).length; }); window.__mo.observe(t, { attributes: true, subtree: true, attributeFilter: ['style'] }); t.scrollLeft = 0; });
  const tr = await rect(table);
  await p.mouse.move(tr.l + tr.w / 2, tr.t + tr.h / 2);
  const lefts = [];
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(30, 0); await p.waitForTimeout(30); lefts.push(Math.round(await table.evaluate((t) => t.scrollLeft))); }
  const scroll = await table.evaluate((t) => { window.__mo.disconnect(); return { writes: window.__writes, end: t.scrollWidth - t.clientWidth, at: t.scrollLeft }; });
  /* a table that scrolls is a named region in the Tab order; the arrow keys scroll it; a flick past its end stays in it */
  const region = await table.evaluate((t) => ({ role: t.getAttribute('role'), name: t.getAttribute('aria-label'), tab: t.tabIndex, contain: getComputedStyle(t).overscrollBehaviorX }));
  await table.evaluate((t) => { t.scrollLeft = 0; });
  await table.focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  const keyed = await table.evaluate((t) => t.scrollLeft);
  ok('a table that scrolls is a named region in the Tab order, scrolled by the arrow keys, and holds a flick at its end',
    region.role === 'region' && /^(가로로 스크롤되는 표|Table, scrolls sideways)$/.test(region.name ?? '') && region.tab === 0 && region.contain === 'contain' && keyed > 0, JSON.stringify({ ...region, keyed }));
  await table.evaluate((t) => { t.scrollLeft = t.scrollWidth; });
  ok('scrolling the table sideways writes nothing to its rows, and moves one way to its end', scroll.writes === 0 && lefts.every((x, i) => !i || x >= lefts[i - 1]) && Math.abs(scroll.at - scroll.end) < 1,
    JSON.stringify({ ...scroll, lefts }));
  await closeSheet(p);

  /* Music Player: the track and the times span the card; the glyphs sit in the middle of their buttons */
  await openExample(p, 'music');
  const music = await screen(p).evaluate((s) => {
    const card = s.querySelector('.sg-card__body').getBoundingClientRect(), pad = parseFloat(getComputedStyle(s.querySelector('.sg-card__body')).paddingLeft);
    const slider = s.querySelector('.sg-slider').getBoundingClientRect();
    const times = [...s.querySelectorAll('.sg-stack--row')].find((r) => /\d:\d\d.*\d:\d\d/.test(r.textContent)).getBoundingClientRect();
    const glyphs = [...s.querySelectorAll('.sg-button svg')].map((g) => { const b = g.closest('.sg-button').getBoundingClientRect(), r = g.getBoundingClientRect();
      return Math.max(Math.abs((r.left + r.right) / 2 - (b.left + b.right) / 2), Math.abs((r.top + r.bottom) / 2 - (b.top + b.bottom) / 2)); });
    return { inner: card.width - 2 * pad, slider: slider.width, times: times.width, glyphs: glyphs.length, off: Math.max(...glyphs) };
  });
  ok('Music Player: the track and the times span the card', Math.abs(music.slider - music.inner) < 1 && Math.abs(music.times - music.inner) < 1, JSON.stringify(music));
  /* a check over no glyphs proves nothing (Math.max of none is -Infinity) */
  ok('its glyphs sit in the middle of their buttons (within 1 px)', music.glyphs >= 3 && music.off <= 1, JSON.stringify(music));
  await closeSheet(p);

  /* Track List: a 50 px cover stays 50 px, beside its title */
  await openExample(p, 'track list');
  await p.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).click();
  await p.waitForTimeout(800);
  const covers = await screen(p).locator('img').evaluateAll((l) => l.map((i) => [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)]));
  ok('Track List: each 50 px cover stays 50 px', covers.length === 3 && covers.every(([w, h]) => w === 50 && h === 50), JSON.stringify(covers));
  await closeSheet(p);

  /* Calendar Day: the date column starts at the top of its row (the catalog's stretch) */
  await openExample(p, 'calendar');
  const day = await screen(p).evaluate((s) => { const d = [...s.querySelectorAll('*')].find((e) => !e.children.length && e.textContent.trim() === '28'); const row = d.closest('.sg-stack--row'); return { col: d.closest('.sg-stack').getBoundingClientRect().top, row: row.getBoundingClientRect().top }; });
  ok('Calendar Day: the date column starts at the top of its row', Math.abs(day.col - day.row) < 1, JSON.stringify(day));
  await closeSheet(p);

  /* Countdown: three numbers spread over 3 × 6rem, centred */
  await openExample(p, 'countdown');
  const cd = await screen(p).evaluate((s) => { const r = [...s.querySelectorAll('.sg-stack--row')].find((x) => /Days/.test(x.textContent)).getBoundingClientRect(), c = s.querySelector('.sg-card__body').getBoundingClientRect(); return { w: r.width, off: (r.left + r.right) / 2 - (c.left + c.right) / 2 }; });
  ok('Countdown: the numbers spread over 288 px, centred', Math.abs(cd.w - 288) < 1 && Math.abs(cd.off) < 1, JSON.stringify(cd));
  await closeSheet(p);

  /* Contact Card: the contact rows stay a centred block */
  await openExample(p, 'contact');
  const cc = await screen(p).evaluate((s) => { const phone = [...s.querySelectorAll('.sg-stack--row')].find((x) => /\(555\)/.test(x.textContent)); const block = phone.parentElement.closest('.sg-stack').getBoundingClientRect(), c = s.querySelector('.sg-card__body').getBoundingClientRect(); return { off: (block.left + block.right) / 2 - (c.left + c.right) / 2, w: block.width, card: c.width }; });
  ok('Contact Card: the contact rows stay a centred block', Math.abs(cc.off) < 1 && cc.w < cc.card - 40, JSON.stringify(cc));
  await closeSheet(p);

  /* Login Form: a blocked Sign in says nothing until pressed; a press sends nothing, says why and goes to Email */
  for (const how of ['pointer', 'keyboard']) {
    await openExample(p, 'login form');
    const signIn = screen(p).getByRole('button', { name: 'Sign in', exact: true });
    const why = screen(p).getByText('Please fix errors before signing in', { exact: true });
    const quiet = await why.evaluate((e) => !!e.closest('.sg-visually-hidden'));
    const linked = await signIn.evaluate((b) => (b.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent).join(' '));
    if (how === 'pointer') { const r = await rect(signIn); await p.mouse.click(r.l + r.w / 2, r.t + r.h / 2); } else { await signIn.focus(); await p.keyboard.press('Enter'); }
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ focus: document.activeElement?.id ? document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent : document.activeElement?.tagName }));
    const shown = await why.evaluate((e) => !e.closest('.sg-visually-hidden') && e.getBoundingClientRect().height > 0);
    const errors = await screen(p).getByText('Email is required', { exact: false }).count();
    /* and says it, with how many fields need attention, in the live region beside the button */
    const said = await signIn.evaluate((b) => b.parentElement.querySelector('[aria-live="polite"]')?.textContent ?? '');
    /* a press that sends shows what it sent at once (the other tab): this one stays on the agent's messages */
    const sent = await p.getByRole('tab', { name: /화면 → 에이전트/ }).getAttribute('aria-selected');
    ok(`Login Form (${how}): a blocked Sign in shows no reason until pressed, but says it to a screen reader`, quiet && /Please fix errors/.test(linked) && (await signIn.getAttribute('aria-disabled')) === 'true', linked);
    ok(`Login Form (${how}): a press sends nothing, shows why and the fields' errors, and moves to Email`, shown && errors > 0 && after.focus === 'Email' && sent !== 'true' && /Please fix errors before signing in \d+ fields? needs? attention\./.test(said), JSON.stringify({ shown, errors, after, sent, said }));
    await closeSheet(p);
  }
  await p.context().close();

  /* at 390 px: Chat Message's avatar stays beside its name and message */
  const q = await open(390, { photos: true });
  await openExample(q, 'chat');
  await q.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).click();
  await q.waitForTimeout(800);
  const chat = await screen(q).evaluate((s) => { const a = s.querySelector('img').getBoundingClientRect(), n = [...s.querySelectorAll('p')].find((e) => /Mike Chen/.test(e.textContent)).getBoundingClientRect(); return { beside: a.right <= n.left, sameLine: a.top < n.bottom }; });
  ok('Chat Message at 390 px: the avatar stays beside its name and message', chat.beside && chat.sameLine, JSON.stringify(chat));
  await closeSheet(q);
  /* Track List at 390 px: the 50 px cover is a feature image by default, so the title Column beside it may go below
     it under 15rem; at a phone's width it still has room, and each title stays beside its cover (#98 review) */
  await openExample(q, 'track list');
  const media = q.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' });
  if ((await media.getAttribute('aria-checked')) !== 'true') await media.click();
  await q.waitForTimeout(800);
  const tracks = await screen(q).evaluate((s) => [...s.querySelectorAll('img')].map((i) => {
    const a = i.getBoundingClientRect(), row = i.closest('.sg-stack--row');
    const texts = [...row.querySelectorAll('p')].map((e) => e.getBoundingClientRect()).filter((r) => r.left >= a.right - 1);
    return { beside: texts.length >= 2, sameLine: texts.every((r) => r.top < a.bottom), surface: Math.round(s.getBoundingClientRect().width) };
  }));
  ok('Track List at 390 px: each title and duration stay beside the cover', tracks.length === 3 && tracks.every((x) => x.beside && x.sameLine), JSON.stringify(tracks));
  await q.context().close();
}

/* the nested corners of the examples with images, tabs and panels */
{
  const p = await open(1440, { photos: true });
  for (const name of ['recipe', 'invitation']) {
    await openExample(p, name);
    if (name === 'recipe') { await p.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).click(); await p.waitForTimeout(1000); }
    const c = await corners(p);
    /* neither example draws a painted box in a card's corner (Recipe Card's photo sits in its tabs, inside the card's
       padding), so each compares no pairs today: this catches a box that comes to sit there. That corners are compared
       at all is held by Movie Card's poster (above, more than none) and the total below */
    ok(`${name === 'recipe' ? 'Recipe Card' : 'Live Invitation Builder'}: corners nest at full size (${c.pairs} compared)`, c.bad.length === 0, c.bad.slice(0, 4).join(' ;; '));
    if (name === 'recipe') await p.getByRole('dialog').getByRole('switch', { name: '다른 사이트의 미디어 불러오기' }).click();
    await closeSheet(p);
  }
  await p.context().close();
  /* a check that compares nothing proves nothing. Few boxes in these examples sit in a card's corner: most of what a
     card holds is text, and the card's padding (14 / 16 px) is under its radius only where something painted starts
     there; the edge photo, flush in the card's top corners, is compared each time */
  ok('corners were compared in the examples at full size', compared >= 2, `${compared} pairs`);
}

/* ---------------------------------------------------------------- phone width */
{
  const p = await open(390);
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.a2ui-grid')).gridTemplateColumns.split(' ').length);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('at 390 px the grid has two columns and the page does not scroll sideways', cols === 2 && over <= 0, `${cols} columns, ${over} px over`);
  const h = await p.locator('.a2ui-thumb__frame').first().evaluate((e) => e.getBoundingClientRect().height);
  ok('at 390 px the cards\' pictures are 132 px tall', Math.abs(h - 132) < 0.5, `${h} px`);
  await p.locator('.a2ui-thumb__open').first().click();
  await p.getByRole('dialog').waitFor();
  await p.waitForTimeout(700);
  const fit = await p.evaluate(() => { const s = document.querySelector('.a2ui-inspector'); return s ? s.scrollWidth <= s.clientWidth + 1 : false; });
  ok('at 390 px an opened example fits the sheet\'s width', fit);
  await p.context().close();
}

/* ---------------------------------------------------------------- tokens long for a word (#100) */
/* the lab page's Chat Message and Contact Card, given a long URL, ID and email address, in surfaces of 320 and 390 px:
   nothing runs out of the card, the tokens wrap inside it, and a short label beside a long sentence stays one word
   on one line while the sentence wraps */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(`${pw.ORIGIN}/#/lab`); await p.waitForSelector('[data-lab="a2ui-long-390"] [data-a2ui-surface]');
  for (const w of [320, 390]) {
    const box = p.locator(`[data-lab="a2ui-long-${w}"]`);
    await box.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    const m = await box.evaluate((root) => {
      /* each against its own card (surface): nothing of it outside */
      const out = [...root.querySelectorAll('[data-a2ui-surface]')].flatMap((sf) => {
        const card = (sf.querySelector('.sg-card') ?? sf).getBoundingClientRect();
        return [...sf.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > card.right + 0.5 || r.left < card.left - 0.5); }).map((e) => String(e.className || e.tagName));
      });
      const lines = (el) => { if (!el) return 0; const rg = document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].filter((r) => r.width).map((r) => Math.round(r.top))).size; };
      const find = (re) => [...root.querySelectorAll('*')].find((e) => e.children.length === 0 && re.test(e.textContent));
      const email = find(/konstantinopoulou/), row = email?.closest('.sg-stack--row'), icon = row?.querySelector('svg')?.getBoundingClientRect(), er = email?.getBoundingClientRect();
      return { out: out.slice(0, 3), status: lines(find(/^Status:$/)), sentence: lines(find(/^Waiting for/)), email: lines(email), url: lines(find(/^https:\/\/ci\./)), id: lines(find(/^ORD-2026/)),
        iconBeside: !!icon && !!er && icon.right <= er.left + 0.5 && icon.top < er.bottom };
    });
    ok(`A2UI long tokens at ${w} px: nothing runs out of its card; the URL wraps inside it, the ID and the email fit, the email beside its icon (#100)`,
      m.out.length === 0 && m.url >= 2 && m.id >= 1 && m.email >= 1 && (w > 360 || m.email >= 2) && m.iconBeside, JSON.stringify(m));
    ok(`A2UI long tokens at ${w} px: a short label beside a long sentence stays whole on one line (#100)`, m.status === 1 && m.sentence >= 2, JSON.stringify({ status: m.status, sentence: m.sentence }));
  }
  await ctx.close();
}

ok('no page errors', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
