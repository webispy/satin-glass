// The A2UI page's gallery of the A2UI project's own examples: every example of both protocol versions has a card,
// drawn once it comes near the screen, search finds them by name or component, nothing loads from another site until
// the media switch allows it, an example opens in a sheet beside its JSON, its messages can be stepped through (the
// keyboard stays in the sheet at either end), a press on the drawn screen shows what it sends back, and the sheet
// closes back to the card it opened from. Requests to other sites are refused in this suite; it counts every one
// that was tried, except the docs' own web font.
// usage: node tests/e2e/a2ui.mjs   (BROWSER=webkit|firefox optional; vite preview on :4173)
// covers: controls, layout, navigation, overlays, selection   (the components the gallery and the A2UI renderer draw with; a change to packages/a2ui or the docs frame runs everything)
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];
const outside = [];
const FONT = /^https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@/;

async function open(width = 1440) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  /* every request to another site is refused here and counted, whatever its kind; only the docs' web font (Pretendard,
     from jsDelivr, loaded by the docs shell on every page) is let through uncounted */
  await p.route(/^https?:\/\/(?!localhost)/, (r) => { if (!FONT.test(r.request().url())) outside.push(r.request().url()); return r.abort(); });
  await p.goto('http://localhost:4173/#/a2ui');
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
const firstJson = (p) => p.locator('.a2ui-inspector__panel .a2ui-json').first().textContent();
const search = (p) => p.getByRole('searchbox', { name: '예제 찾기' });
async function openExample(p, q) {
  await search(p).fill(q);
  await p.waitForTimeout(300);
  const opener = p.locator('.a2ui-thumb__open').first();
  await opener.click();
  await p.getByRole('dialog').waitFor();
  await p.waitForTimeout(700);
  return opener;
}

/* ---------------------------------------------------------------- the grid, the versions, search */
{
  const p = await open();
  ok('v1.0: all 43 examples in the grid', (await thumbs(p)) === 43 && /43개 중 43개/.test(await count(p)), `${await thumbs(p)} · ${await count(p)}`);
  /* a card is drawn once it comes near the screen, not before; drawn, it stays drawn */
  const seen = await onScreen(p);
  const drawn = await p.locator('.a2ui-thumb__surface').count();
  ok('the cards on the screen have drawn their example; the ones far below have not yet', seen.length > 0 && seen.every(Boolean) && drawn < 43, `${seen.filter(Boolean).length}/${seen.length} on screen drawn, ${drawn} of 43 mounted`);
  ok('a card shows what its example draws (Coffee Order: Sunrise Coffee)', /Sunrise Coffee/.test(await card(p, 'Coffee Order').locator('.a2ui-thumb__frame').textContent() ?? ''));
  /* the first card's drawing, marked: scrolled far away from it, it is the same node, still in the page */
  await p.locator('.a2ui-thumb__surface').first().evaluate((e) => { e.dataset.e2eFirst = ''; });
  await p.locator('.a2ui-thumb').last().scrollIntoViewIfNeeded();
  const end = await p.waitForFunction(() => { const on = [...document.querySelectorAll('.a2ui-thumb__frame')].filter((f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return on.length > 0 && on.every((f) => f.querySelector('.a2ui-thumb__surface [data-a2ui-surface]')); }, null, { timeout: 5000 }).then(() => true, () => false);
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
  ok('v0.9.1: the opened example\'s messages are v0.9 messages', /"version": "v0\.9"/.test(await firstJson(p)), (await firstJson(p)).slice(0, 40));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
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
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:4173' });
    await p.getByRole('tab', { name: /에이전트 → 화면/ }).click();
    await p.locator('.a2ui-inspector__panel .a2ui-code__copy').first().click();
    await p.waitForTimeout(400);
    const copied = await p.evaluate(() => navigator.clipboard.readText()).then((t) => { try { return JSON.parse(t); } catch { return null; } });
    ok('copying the JSON copies the three messages and says so', await p.locator('.sg-toaster').getByText('복사했어요').isVisible()
      && Array.isArray(copied) && copied.length === 3 && 'createSurface' in copied[0]);
  }

  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  ok('Escape closes the sheet and focus goes back to the card that opened it', !(await sheet.isVisible()) && await opener.evaluate((e) => e === document.activeElement));

  /* the close button in the header: the way out without a keyboard */
  await opener.click();
  await sheet.waitFor();
  await p.waitForTimeout(700);
  await sheet.getByRole('button', { name: '닫기', exact: true }).click();
  await p.waitForTimeout(600);
  ok('the close button closes the sheet and focus goes back to the card that opened it', !(await sheet.isVisible()) && await opener.evaluate((e) => e === document.activeElement));
  ok('nothing was requested from another site in the sheet with the switch off', outside.length === 0, outside.slice(0, 3).join(' '));
  await p.context().close();
}

/* ---------------------------------------------------------------- media in the sheet: off, on, off */
{
  outside.length = 0;
  const p = await open();
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

ok('no page errors', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' | '));
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
