// Wheels, time and weekday pickers, the calendar's month / year wheels, and the navigation stack.
// usage: node tests/e2e/pickers.mjs   (BROWSER=webkit|firefox; PORT (default 4173); Q for settings)
// covers: selection, navigation   (categories, for `pnpm e2e:changed`; * = any, css = any stylesheet)
import * as pw from 'playwright';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '', PORT = process.env.PORT || '4173';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const go = async (id) => { await p.goto(`http://localhost:${PORT}/${Q}#/${id}`); await p.waitForTimeout(900); };
const reduced = /rm=1/.test(Q);
const demo = (id) => p.locator(`[data-demo="${id}"]`);
/* until a reading stops changing (a wheel settling, a page sliding) */
const still = async (read, ms = 2500) => { let last = await read(), same = 0; const t0 = Date.now(); while (Date.now() - t0 < ms) { await p.waitForTimeout(60); const v = await read(); same = v === last ? same + 1 : 0; last = v; if (same >= 4) break; } return last; };
/* the row under the band sits exactly in it */
/* PageUp / PageDown as plain key events: Playwright on macOS also sends them as scroll-page editing commands, which
   scroll a focused scroller even when the page prevents the key (a real keyboard does not) */
const pageKey = (loc, key) => loc.evaluate((e, key) => e.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })), key);
const aligned = (wheel) => wheel.evaluate((w) => { const sc = w.querySelector('.sg-wheel__scroller'), r = sc.getBoundingClientRect(), h = sc.firstElementChild.offsetHeight; const i = Math.round(sc.scrollTop / h); const row = sc.children[i].getBoundingClientRect(); return Math.abs((row.top + row.bottom) / 2 - (r.top + r.bottom) / 2) <= 1 && Math.abs(sc.scrollTop - i * h) <= 1; });

await go('selection');
/* ================================================================ wheels (the alarm's time wheel) */
{
  const a = demo('alarm'); await a.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  /* the value commits when a wheel comes to rest: wait on the wheels' positions as well as the text */
  const shown = () => a.locator('.alarm-time').textContent();
  const rest = () => still(() => a.evaluate((x) => [...x.querySelectorAll('.sg-wheel__scroller')].map((e) => e.scrollTop).join(',') + x.querySelector('.alarm-time').textContent), 4000).then(() => p.waitForTimeout(250));
  const hour = a.getByRole('spinbutton', { name: '시' }), minute = a.getByRole('spinbutton', { name: '분' }), period = a.getByRole('spinbutton', { name: '오전/오후' });
  const t0 = await shown();
  await hour.focus(); await p.keyboard.press('ArrowDown'); await rest();
  ok('wheel: ArrowDown moves one row and the value follows', (await shown()) === '오전 8:30' && (await hour.getAttribute('aria-valuetext')) === '8', `${t0} → ${await shown()}`);
  await pageKey(hour, 'PageUp'); await rest();
  ok('wheel: PageUp jumps several rows (3 hours)', (await shown()) === '오전 5:30', await shown());
  await minute.focus(); await p.keyboard.type('45'); await rest();
  ok('wheel: typing digits goes to that row', (await shown()) === '오전 5:45', await shown());
  /* the mouse wheel scrolls the column; it lands on a row, in the band */
  const mb = await minute.boundingBox();
  await p.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2); await p.mouse.wheel(0, 36 * 3); await p.waitForTimeout(200);
  await rest(); await p.waitForTimeout(200);
  /* how far one wheel turn goes is the platform's; it moves on and lands on a row */
  const mAfter = +(await shown()).split(':')[1];
  ok('wheel: the mouse wheel scrolls it and it comes to rest on a row, in the band', mAfter > 45 && mAfter <= 52 && await aligned(a.locator('.sg-wheel').nth(2)), `${await shown()}, aligned ${await aligned(a.locator('.sg-wheel').nth(2))}`);
  const mm = `:${mAfter}`;
  /* a click on a row brings that row to the band */
  const rows = a.locator('.sg-wheel').nth(1).locator('.sg-wheel__item');
  await rows.filter({ hasText: /^7$/ }).click(); await rest(); await p.waitForTimeout(150);
  ok('wheel: clicking a row brings it to the band', (await shown()) === `오전 7${mm}`, await shown());
  /* a mouse drags the column (slowly: no fling) */
  const hb = await a.locator('.sg-wheel').nth(1).boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - i * 6); await p.waitForTimeout(16); }
  await p.waitForTimeout(150); await p.mouse.up(); await rest(); await p.waitForTimeout(150);
  ok('wheel: dragging with the mouse turns it by as many rows as it moved (the release is not a click on the grabbed row)', (await shown()) === `오전 9${mm}` && await aligned(a.locator('.sg-wheel').nth(1)), await shown());
  await period.focus(); await p.keyboard.press('ArrowDown'); await rest();
  ok('wheel: the period column turns 오전 into 오후 (same hour)', (await shown()) === `오후 9${mm}`, await shown());
  /* the drum: the row in the band is solid, rows further away fade */
  const op = await a.locator('.sg-wheel').nth(1).evaluate((w) => { const sc = w.querySelector('.sg-wheel__scroller'), h = sc.firstElementChild.offsetHeight, i = Math.round(sc.scrollTop / h); return [0, 1, 2].map((d) => +getComputedStyle(sc.children[i + d].firstElementChild).opacity); });
  ok('wheel: rows bend away from the band (solid in it, fading with distance)', op[0] > 0.99 && op[1] < op[0] && op[2] < op[1], JSON.stringify(op));
}

/* ================================================================ weekdays */
{
  const a = demo('alarm'), foot = () => a.locator('.sg-list-section__footer').textContent();
  const sat = a.getByRole('button', { name: '토요일' }), sun = a.getByRole('button', { name: '일요일' });
  ok('weekdays: Monday–Friday read as "주중"', (await foot()) === '반복: 주중', await foot());
  const fill = await sat.evaluate((el) => new Promise((res) => { const out = []; const t0 = performance.now(); el.click(); const f = () => { out.push(new DOMMatrix(getComputedStyle(el, '::before').transform).a); if (performance.now() - t0 < 400) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
  ok('weekdays: a chosen day is pressed and its fill grows in (reduced motion: fades)', (await sat.getAttribute('aria-pressed')) === 'true' && (reduced || fill.filter((x) => x > 0.45 && x < 0.97).length >= 2), `fill scale frames ${fill.map((x) => x.toFixed(2)).slice(0, 8).join(' ')}`);
  ok('weekdays: describeWeekdays names the days', (await foot()) === '반복: 월, 화, 수, 목, 금, 토', await foot());
  await sun.click(); await p.waitForTimeout(100);
  ok('weekdays: all seven read as "매일"', (await foot()) === '반복: 매일', await foot());
  await sat.click(); await sun.click(); await p.waitForTimeout(100);
  ok('weekdays: click again to un-choose', (await sat.getAttribute('aria-pressed')) === 'false' && (await foot()) === '반복: 주중', await foot());
}

/* ================================================================ time picker field */
{
  const t = demo('time'), field = t.getByRole('button', { name: /회의 시작/ });
  await field.scrollIntoViewIfNeeded();
  ok('time picker: empty shows the placeholder', (await field.textContent()).includes('시간 선택'));
  await field.click(); await p.waitForTimeout(500);
  const panel = p.locator('.sg-timepicker-panel');
  const v1 = await field.textContent(), focused = await p.evaluate(() => document.activeElement?.getAttribute('role'));
  ok('time picker: opening starts at a time (now, on the 5-minute step) and focuses the wheels', /^(오전|오후) \d{1,2}:\d[05]$/.test(v1.trim()) && focused === 'spinbutton' && (await panel.count()) === 1, `${v1} / ${focused}`);
  /* step toward the side that has room: the field opens at the current time, which may sit on a wheel's last row
     (12 o'clock, :55) */
  const stepFocused = () => p.evaluate(() => { const a = document.activeElement; return +a.getAttribute('aria-valuenow') < +a.getAttribute('aria-valuemax') ? 'ArrowDown' : 'ArrowUp'; });
  await p.keyboard.press('Tab'); await p.keyboard.press(await stepFocused()); await p.waitForTimeout(400);
  const v2 = await field.textContent();
  await p.keyboard.press('Tab'); await p.keyboard.press(await stepFocused()); await p.waitForTimeout(400);
  const v3 = await field.textContent();
  ok('time picker: the field follows the wheels (hour, then minute by the step)', v2 !== v1 && v3 !== v2 && /:\d[05]$/.test(v3.trim()), `${v1} → ${v2} → ${v3}`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const hidden = await p.locator('input[name=meet]').inputValue();
  ok('time picker: Enter closes it, focus goes back to the field, the form gets HH:mm', (await panel.count()) === 0 && (await field.evaluate((e) => e === document.activeElement)) && /^\d\d:\d[05]$/.test(hidden), hidden);
  ok('time picker: 24-hour and English formats', (await t.getByRole('button', { name: /24시간제/ }).textContent()).trim() === '18:45' && (await t.getByRole('button', { name: /영어 표기/ }).textContent()).trim() === '9:15 PM');
}

/* ================================================================ calendar: month / year chips and grids (and the wheel option) */
{
  const d = demo('date'), field = d.getByRole('button', { name: /^생년월일(?! \()/ });
  await field.scrollIntoViewIfNeeded(); await field.click(); await p.waitForTimeout(700);
  const panel = p.locator('.sg-datepicker-panel'), chips = panel.locator('.sg-calendar__chip');
  const chipText = async () => (await chips.allTextContents()).join(' ');
  const active = () => p.evaluate(() => document.activeElement?.textContent?.trim());
  ok('birth date: opens on the year grid (defaultMonth 1990), the year chip open, 1990 chosen and focused, Korean order (year, month)',
    (await panel.locator('.sg-calendar__cells--scroll').count()) === 1 && (await chips.first().getAttribute('aria-expanded')) === 'true' && (await active()) === '1990년' && (await chipText()) === '1990년 1월',
    `${await chipText()} / focus ${await active()}`);
  const mid = await panel.locator('.sg-calendar__cells--scroll').evaluate((g) => { const c = g.querySelector('[aria-selected="true"]'); return Math.round(c.offsetTop + c.offsetHeight / 2 - g.scrollTop - g.clientHeight / 2); });
  ok('birth date: the chosen year opens in the middle of the grid', Math.abs(mid) <= 2, `${mid}px off`);
  await p.keyboard.type('1980'); await p.waitForTimeout(700);
  ok('birth date: typing 1980 in the year grid goes there', (await active()) === '1980년', await active());
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  ok('birth date: choosing a year goes on to the months of that year (month chip open, focus on the month)', (await chipText()) === '1980년 1월' && (await chips.nth(1).getAttribute('aria-expanded')) === 'true' && (await active()) === '1월', `${await chipText()} / ${await active()}`);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const focusDay = await p.evaluate(() => document.activeElement?.getAttribute('data-date'));
  ok('birth date: choosing a month returns to its days, focus on a day', (await panel.locator('.sg-calendar__grid').count()) === 1 && /^1980-03-/.test(focusDay ?? '') && (await chipText()) === '1980년 3월', `${focusDay} / ${await chipText()}`);
  await panel.locator('[data-date="1980-03-15"]').click(); await p.waitForTimeout(500);
  ok('birth date: picking a day fills the field', (await field.textContent()).includes('1980'), await field.textContent());
  /* max = today: in this year, the months after this one cannot be chosen */
  await field.click(); await p.waitForTimeout(600);   /* opens on the years again (openTo) */
  await p.keyboard.type(String(new Date().getFullYear())); await p.waitForTimeout(500); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const now = new Date(), dis = await panel.locator('.sg-calendar__cell[aria-disabled="true"]').count();
  ok('birth date: with max = today, months after this one cannot be chosen', dis === 11 - now.getMonth() && (await chipText()).startsWith(`${now.getFullYear()}년`), `${dis} disabled, ${await chipText()}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  /* the wheel option: both chips open month and year wheels */
  const wf = d.getByRole('button', { name: /휠로/ });
  await wf.scrollIntoViewIfNeeded(); await wf.click(); await p.waitForTimeout(700);
  const year = panel.getByRole('spinbutton', { name: '연도' });
  ok('wheel option: opens on the wheels (1990), the year wheel focused', (await year.getAttribute('aria-valuetext')) === '1990년' && (await year.evaluate((e) => e === document.activeElement)), await year.getAttribute('aria-valuetext'));
  await p.keyboard.type('1980'); await p.waitForTimeout(700);
  await p.keyboard.press('Tab'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(600);
  ok('wheel option: typing a year, then the month wheel beside it (1월 → 3월)', (await chipText()) === '1980년 3월', await chipText());
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  ok('wheel option: Enter returns to the days of that month', (await panel.locator('.sg-calendar__grid').count()) === 1 && /^1980-03-/.test(await p.evaluate(() => document.activeElement?.getAttribute('data-date') ?? '')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  const cal = demo('calendar').locator('.sg-calendar');
  const box = () => cal.evaluate((e) => Math.round(e.getBoundingClientRect().height));
  const cchips = cal.locator('.sg-calendar__chip'), h0 = await box(), y0 = parseInt(await cchips.first().textContent());
  await cchips.nth(1).click(); await p.waitForTimeout(600);
  const h1 = await box(), months = await cal.locator('.sg-calendar__cell').count();
  await cchips.first().click(); await p.waitForTimeout(600);
  const h2 = await box();
  const range = () => cal.locator('.sg-calendar__caption').textContent();
  const r0 = await range(); await cal.getByRole('button', { name: '이전 연도들' }).click(); await p.waitForTimeout(800); const r1 = await range();
  ok('calendar: the month chip opens 12 months and the year chip the years, in place (same size); ‹ pages the years back', h1 === h0 && h2 === h0 && months === 12 && parseInt(r1) < parseInt(r0), `${h0}/${h1}/${h2} px, ${months} months, ${r0} → ${r1}`);
  await cchips.first().click(); await p.waitForTimeout(500);
  ok('calendar: the open chip again shows the days', (await cal.locator('.sg-calendar__grid').count()) === 1 && (await cchips.first().getAttribute('aria-expanded')) === 'false' && parseInt(await cchips.first().textContent()) === y0);
}

/* ================================================================ navigation stack */
await go('lists');
{
  const n = demo('nav-stack'), title = () => n.locator('.sg-nav__page:not([inert]) .sg-appbar__title').textContent();
  const pages = () => n.locator('.sg-nav__page').count();
  /* Safari does not focus a clicked button, so there is no row to go back to: the page's title takes focus instead */
  const webkitFocus = (t) => (engine === 'webkit' ? t : '\u0000');
  ok('navigation stack: starts on its first page', (await title()) === '설정' && (await pages()) === 1);
  const path = await p.evaluate(() => new Promise((res) => {
    const box = document.querySelector('[data-demo="nav-stack"]');
    const row = [...box.querySelectorAll('button')].find((x) => x.textContent.startsWith('프로필')); row.focus(); row.click();
    const out = []; const t0 = performance.now();
    const f = () => { const top = box.querySelectorAll('.sg-nav__page')[1]; if (top) out.push(Math.round(top.getBoundingClientRect().left - box.getBoundingClientRect().left)); if (performance.now() - t0 < 700) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  await p.waitForTimeout(300);
  ok('navigation stack: push slides the page in from the trailing edge (reduced motion: fades in place)', (await title()) === '프로필' && (reduced ? path.every((x) => x === 0) : path.filter((x) => x > 0 && x < 300).length >= 3 && path.at(-1) === 0), path.slice(0, 10).join(' '));
  ok('navigation stack: the back button is named after the page below', (await n.locator('.sg-nav__page:not([inert]) .sg-nav__back').textContent()).includes('설정'));
  ok('navigation stack: focus moves to the new page title', (await p.evaluate(() => document.activeElement?.textContent)) === '프로필');
  await n.getByRole('button', { name: '계정 보안' }).click(); await p.waitForTimeout(800);
  const twoStep = n.getByRole('switch', { name: '2단계 인증' });
  await twoStep.click(); await p.waitForTimeout(200);
  await n.getByRole('button', { name: /비밀번호 변경/ }).click(); await p.waitForTimeout(800);
  const below = await n.locator('.sg-nav__page').evaluateAll((ps) => ps.map((x) => `${x.hasAttribute('inert') ? 'i' : '-'}${x.hasAttribute('data-hidden') ? 'h' : '-'}`).join(' '));
  ok('navigation stack: four deep; the pages below are kept but hidden and inert', (await pages()) === 4 && (await title()) === '비밀번호 변경' && below === 'ih ih ih --', below);
  /* back, frame by frame: the leaving page only ever moves away (or fades) until it is gone — it must never come
     back over the screen for a frame when its slide ends (that was a visible flash) */
  const leave = await p.evaluate(() => new Promise((res) => {
    const box = document.querySelector('[data-demo="nav-stack"]'), page = box.querySelectorAll('.sg-nav__page')[3];
    [...box.querySelectorAll('.sg-nav__page')[3].querySelectorAll('button')].find((x) => x.textContent.includes('뒤로')).click();
    const out = []; const t0 = performance.now();
    const f = () => { out.push(page.isConnected ? `${Math.round(page.getBoundingClientRect().left - box.getBoundingClientRect().left)}/${(+getComputedStyle(page).opacity).toFixed(2)}` : 'gone'); if (performance.now() - t0 < 900) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  const back = leave.filter((x) => x !== 'gone').map((x) => x.split('/').map(Number));
  /* (a spring may sway a little past the edge and back: out of the box, so not seen — only coming back inside counts) */
  const W = await n.evaluate((e) => e.getBoundingClientRect().width);
  const flash = back.some(([x, o], i) => i > 0 && ((x < back[i - 1][0] - 1 && x < W - 1) || o > back[i - 1][1] + 0.01));
  ok('navigation stack: going back, the page leaves without flashing back over the screen at the end', leave.at(-1) === 'gone' && !flash && back.length > 3, `${back.length} frames: ${leave.filter((x) => x !== 'gone').join(' ')} → gone`);
  await p.waitForTimeout(200);
  ok('navigation stack: back drops the page; focus returns to the row that opened it; the page below kept its state', (await title()) === '계정 보안' && (await pages()) === 3
    && [webkitFocus('계정 보안'), '비밀번호 변경'].includes(await p.evaluate(() => document.activeElement?.textContent)) && (await twoStep.getAttribute('aria-checked')) === 'false',
    `${await title()} / ${await pages()} pages / focus ${await p.evaluate(() => document.activeElement?.textContent?.slice(0, 20))} / 2-step ${await twoStep.getAttribute('aria-checked')}`);
  await n.getByRole('button', { name: /비밀번호 변경/ }).click(); await p.waitForTimeout(800);
  await n.getByRole('button', { name: '완료' }).click(); await p.waitForTimeout(900);
  ok('navigation stack: popToRoot goes back to the first page and focus to the row that started it', (await title()) === '설정' && (await pages()) === 1 && (await p.evaluate(() => document.activeElement?.textContent ?? '')).startsWith('프로필'),
    `${await title()} / ${await pages()} pages / focus ${await p.evaluate(() => document.activeElement?.textContent?.slice(0, 20))}`);
  /* the value a deeper page sets shows on the page that opened it */
  await n.getByRole('button', { name: /화면 모드/ }).click(); await p.waitForTimeout(800);
  await n.getByRole('radio', { name: /다크/ }).click(); await p.waitForTimeout(150);
  await n.getByRole('button', { name: /뒤로/ }).click(); await p.waitForTimeout(800);
  ok('navigation stack: a choice made on a deeper page shows on the row that opened it', (await n.getByRole('button', { name: /화면 모드/ }).textContent()).includes('다크'));
  /* rapid: a second push while one is sliding is ignored (no half-pushed pages) */
  await n.getByRole('button', { name: /프로필/ }).evaluate((e) => { e.click(); e.click(); });
  await p.waitForTimeout(900);
  ok('navigation stack: a double click pushes once', (await pages()) === 2, `${await pages()} pages`);
}

ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
await b.close();
process.exitCode = failed ? 1 : 0;
