// The 0.5 components on their docs pages: Meter, AvatarGroup, Timeline (steps and a growing log), Drawer, Combobox and
// the Accordion's bloom.
// Meter: role, name, value text, fill, and a tone that follows the value's band. AvatarGroup: named by its head count,
// +N as a button that opens the rest and gets focus back. Timeline: one current step that follows prev/next however
// fast they are pressed (every mark ends where its status says, nothing left mid-move); a log that grows and shrinks
// leaves only its rows, at rest. Drawer: modal, named, focus in and back, Escape and the scrim close it, the start
// drawer comes from the start edge. Combobox: narrows as you type, ↓ and Enter choose, Escape goes back to the chosen
// name, nothing found says so. Accordion: opens and closes to rest with no inline styles left; a closed region is inert;
// a single accordion keeps one open.
// usage: node tests/e2e/v05.mjs   (BROWSER=webkit|firefox; E2E_PORT (default 4173); Q for settings)
// covers: data, controls, layout, overlays, selection
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium', Q = process.env.Q || '';
const b = await pw[engine].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const wait = (ms) => p.waitForTimeout(ms);
const go = async (route) => { await p.goto(`${pw.ORIGIN}/${Q}#/${route}`); await wait(900); };
const focused = () => p.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) : ''; });

/* ================================================================ Meter */
await go('charts');
{
  const demo = p.locator('[data-demo="meter"]');
  const m = demo.getByRole('meter', { name: '저장 공간' });
  ok('meter: role, name and value', await m.count() === 1 && await m.getAttribute('aria-valuenow') === '37.4' && await m.getAttribute('aria-valuemax') === '50', `now ${await m.getAttribute('aria-valuenow')}`);
  ok('meter: value text from format', await m.getAttribute('aria-valuetext') === '37.4 GB / 50 GB', await m.getAttribute('aria-valuetext'));
  const fill = await m.evaluate((t) => { const f = t.querySelector('.sg-meter__fill'); return new DOMMatrix(getComputedStyle(f).transform).a; });
  ok('meter: the fill is the value\'s share of the range', Math.abs(fill - 37.4 / 50) < 0.01, fill.toFixed(3));
  /* an unknown value is not a meter (no value to report): its name and "unavailable" are plain text */
  const na = demo.locator('.sg-meter', { hasText: '응답 시간 목표' });
  ok('meter: an unknown value shows as unavailable, with no meter role', await na.getByRole('meter').count() === 0 && /알 수 없음/.test(await na.innerText()), (await na.innerText()).replace(/\s+/g, ' '));
  /* the band follows the value: drive the slider beside the second storage meter to each end */
  const bands = p.locator('[data-demo="meter-bands"]'), slider = bands.getByRole('slider');
  const tone = () => bands.locator('.sg-meter').getAttribute('data-tone');
  await slider.focus(); await p.keyboard.press('Home'); await wait(150);
  const low = await tone(), lowText = await bands.locator('.sg-meter').innerText();
  await p.keyboard.press('End'); await wait(150);
  const high = await tone(), highText = await bands.locator('.sg-meter').innerText();
  ok('meter: the tone follows the value\'s band (low ≠ high)', low && high && low !== high, `${low} → ${high}`);
  ok('meter: the status follows too', lowText !== highText && /거의 다 찼어요/.test(highText), highText.replace(/\s+/g, ' ').slice(0, 60));
}

/* ================================================================ AvatarGroup */
await go('lists');
{
  const demo = p.locator('[data-demo="avatar-group"]');
  const g8 = demo.getByRole('group', { name: '참여자 8명' }).first();
  ok('avatar group: named by its head count', await g8.count() === 1);
  ok('avatar group: four faces and +4', await g8.locator('.sg-avatar:not(.sg-avatar-group__more)').count() === 4 && /\+4/.test(await g8.innerText()), (await g8.innerText()).replace(/\s+/g, ' '));
  /* a large rest shows capped (99+) and is named by what it shows, then the real count */
  const more = demo.getByRole('button', { name: /나머지 125명/ });
  const moreName = (await more.innerText()).replace(/\s+/g, ' ').trim();
  ok('avatar group: +N is a button named by what it shows, then the rest', await more.count() === 1 && /^99\+/.test(moreName), moreName);
  await more.click(); await wait(500);
  const panel = p.locator('.sg-portal [role="dialog"], .sg-portal .sg-popover').first();
  ok('avatar group: +N opens the rest', await panel.isVisible().catch(() => false));
  await p.keyboard.press('Escape'); await wait(500);
  ok('avatar group: Escape closes it and focus is back on +N', /나머지 125명/.test(await focused()), await focused());
}

/* ================================================================ Timeline: steps */
await go('display');
{
  const list = p.getByRole('list', { name: '주문 진행' });
  const demo = p.locator('[data-demo="timeline-steps"]');
  const next = demo.getByRole('button', { name: '다음 단계' }), prev = demo.getByRole('button', { name: '이전 단계' });
  const state = () => list.evaluate((ol) => [...ol.querySelectorAll(':scope > li.sg-timeline__item')].map((li) => ({ s: li.dataset.status, look: li.dataset.look, cur: li.getAttribute('aria-current'), pass: li.hasAttribute('data-pass'), fill: li.style.getPropertyValue('--_fill') })));
  const at = async () => (await state()).findIndex((x) => x.cur === 'step');
  await list.scrollIntoViewIfNeeded();
  const i0 = await at();
  await next.click(); await wait(900);
  ok('timeline: next moves the current step on', await at() === i0 + 1, `${i0} → ${await at()}`);
  await prev.click(); await wait(900);
  ok('timeline: prev moves it back', await at() === i0);
  /* pressed fast, in any order: every mark ends where its status says, and nothing is left mid-move */
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 20; k++) {
    const btn = rnd() < 0.5 ? prev : next;
    if (await btn.isEnabled()) await btn.click({ delay: 0 });
    await wait(40 + Math.round(rnd() * 80));
  }
  await wait(1500);
  const s = await state();
  const bad = s.filter((x) => x.look !== x.s || x.pass || x.fill);
  ok('timeline: after fast presses every mark matches its status, nothing mid-move', bad.length === 0 && s.filter((x) => x.cur === 'step').length === 1, JSON.stringify(bad).slice(0, 160));
  ok('timeline: the last item has no line after it, and the list holds only items', await list.evaluate((ol) => { const it = [...ol.children].filter((c) => c.classList.contains('sg-timeline__item')); const last = it.at(-1); return [...ol.children].every((c) => c.tagName === 'LI') && last === ol.lastElementChild && getComputedStyle(last, '::before').content === 'none'; }));
  ok('timeline: the current step is the one between done and upcoming', s.every((x, i) => x.s === (i < (s.findIndex((y) => y.cur === 'step')) ? 'done' : i === s.findIndex((y) => y.cur === 'step') ? 'current' : 'upcoming')));
}
/* ================================================================ Timeline: a log that grows and shrinks */
{
  const list = p.getByRole('list', { name: '문서 활동' });
  const demo = p.locator('[data-demo="timeline-events"]');
  const rows = () => list.evaluate((ol) => [...ol.querySelectorAll(':scope > li.sg-timeline__item')].map((li) => ({ t: li.querySelector('.sg-timeline__title')?.textContent, phase: li.dataset.phase, h: li.style.height, pb: li.style.paddingBottom })));
  await list.scrollIntoViewIfNeeded();
  const n0 = (await rows()).length;
  await demo.getByRole('button', { name: '다음', exact: true }).first().click(); await wait(1200);
  let r = await rows();
  ok('timeline log: next adds the newest row at the top, at rest', r.length === n0 + 1 && r[0].t === '검토 승인' && r.every((x) => !x.h && !x.pb && x.phase !== 'leave'), JSON.stringify(r[0]));
  await demo.getByRole('button', { name: '이전', exact: true }).first().click(); await demo.getByRole('button', { name: '이전', exact: true }).first().click(); await wait(1400);
  r = await rows();
  ok('timeline log: prev removes rows completely (no leaving rows left behind)', r.length === n0 - 1 && r.every((x) => !x.h && !x.pb && x.phase !== 'leave'), `${r.length} rows`);
}

/* ================================================================ Accordion */
{
  const acc = p.locator('[data-demo="accordion"] .sg-accordion');
  await acc.scrollIntoViewIfNeeded();
  const trig = acc.locator('.sg-accordion__trigger');
  const closedIdx = await trig.evaluateAll((ts) => ts.findIndex((t) => t.getAttribute('aria-expanded') === 'false'));
  const t = trig.nth(closedIdx), region = acc.locator('.sg-accordion__region').nth(closedIdx);
  await t.click(); await wait(1500);
  const open = await region.evaluate((r) => ({ h: r.getBoundingClientRect().height, inl: r.style.height, con: r.querySelector('.sg-accordion__content')?.style.transform ?? '', inert: r.inert }));
  ok('accordion: opens to rest — full height, no inline styles, reachable', await t.getAttribute('aria-expanded') === 'true' && open.h > 20 && !open.inl && !open.con && !open.inert, JSON.stringify(open));
  await t.click(); await wait(1500);
  const shut = await region.evaluate((r) => ({ h: r.getBoundingClientRect().height, inl: r.style.height, inert: r.inert }));
  ok('accordion: closes to rest — no height, no inline styles, inert', await t.getAttribute('aria-expanded') === 'false' && shut.h < 1 && !shut.inl && shut.inert, JSON.stringify(shut));
  const single = p.locator('[data-demo="accordion-single"] .sg-accordion'), st = single.locator('.sg-accordion__trigger');
  await single.scrollIntoViewIfNeeded();
  await st.nth(0).click(); await wait(400); await st.nth(1).click(); await wait(1200);
  const ex = await st.evaluateAll((ts) => ts.map((x) => x.getAttribute('aria-expanded')));
  ok('accordion (single): opening one closes the other', ex.filter((x) => x === 'true').length === 1 && ex[1] === 'true', ex.join(','));
}

/* ================================================================ Drawer */
await go('overlays');
{
  /* found by text, not role: while the drawer is open the page (and this button) is hidden from the role tree */
  const opener = p.locator('[data-demo="drawer"] button', { hasText: '필터 열기' });
  await opener.scrollIntoViewIfNeeded(); await opener.click(); await wait(900);
  const dlg = p.getByRole('dialog', { name: '필터' });
  ok('drawer: opens as a named modal dialog', await dlg.isVisible() && await dlg.getAttribute('aria-modal') === 'true');
  ok('drawer: focus goes into it', await dlg.evaluate((d) => d.contains(document.activeElement)));
  ok('drawer: the page behind is hidden from assistive technology', await opener.evaluate((o) => !!o.closest('[aria-hidden="true"]')));
  const box = await dlg.boundingBox();
  ok('drawer: comes in from the end edge', Math.abs(box.x + box.width - 1280) < 24, `x ${Math.round(box.x)} w ${Math.round(box.width)}`);
  await p.keyboard.press('Escape'); await wait(900);
  ok('drawer: Escape closes it and focus goes back to its button', !(await dlg.isVisible().catch(() => false)) && await focused() === '필터 열기', await focused());
  const start = p.locator('[data-demo="drawer"] button', { hasText: '메뉴 (start)' });
  await start.click(); await wait(900);
  const nav = p.getByRole('dialog', { name: '둘러보기' });
  const nb = await nav.boundingBox();
  ok('drawer (start): comes in from the start edge', nb && nb.x < 24, `x ${nb && Math.round(nb.x)}`);
  await p.mouse.click(1200, 450); await wait(900);
  ok('drawer: a click on the scrim closes it', !(await nav.isVisible().catch(() => false)));
  /* top and bottom: docked to the edge, the full width, dragged away by the header */
  await p.keyboard.press('Backquote'); await wait(900);
  const con = p.getByRole('dialog', { name: '콘솔' }), cb = await con.boundingBox();
  ok('drawer (top): the ` key opens the console at the top edge, the full width, focus in its prompt', cb && cb.y < 24 && cb.width > 1200 && await focused() === '명령', `y ${cb && Math.round(cb.y)} w ${cb && Math.round(cb.width)} focus ${await focused()}`);
  /* its header is at the top of the screen, with little room to drag up: shrink it to its least height with the grip
     first, then a slow drag of the header past 30 % of that puts it away (no flick speed to depend on; reduced
     motion: no drag) */
  if (!/rm=1/.test(Q)) {
    await con.getByRole('separator', { name: '콘솔 크기' }).focus(); await p.keyboard.press('Home'); await wait(150);
    const hb = await con.locator('.sg-drawer__header').boundingBox(), small = (await con.boundingBox()).height;
    await p.mouse.move(hb.x + 300, hb.y + hb.height - 4); await p.mouse.down();
    for (let k = 1; k <= 10; k++) { await p.mouse.move(hb.x + 300, hb.y + hb.height - 4 - k * 5); await wait(40); }
    await p.mouse.up(); await wait(900);
    ok('drawer (top): dragging its header up past a third of its height puts it away', !(await con.isVisible().catch(() => false)), `height ${Math.round(small)}`);
  } else { await p.keyboard.press('Escape'); await wait(600); }
  await p.locator('[data-demo="drawer"] button', { hasText: '로그 보기' }).click(); await wait(900);
  const lg = p.getByRole('dialog', { name: '배포 로그' }), lb = await lg.boundingBox();
  ok('drawer (bottom): docked to the bottom edge, the full width, its own height', lb && Math.abs(lb.y + lb.height - (900 - 8)) < 3 && lb.width > 1200 && Math.abs(lb.height - 300) < 2, JSON.stringify(lb && { y: Math.round(lb.y), h: Math.round(lb.height) }));
  /* resizable: the grip is a separator; Home / End take it to its bounds, Up grows a bottom drawer */
  const grip = lg.getByRole('separator', { name: '로그 창 크기' });
  await grip.focus(); await p.keyboard.press('End'); await wait(100);
  const hiH = Math.round((await lg.boundingBox()).height);
  await p.keyboard.press('Home'); await wait(100);
  const loH = Math.round((await lg.boundingBox()).height);
  await p.keyboard.press('ArrowUp'); await wait(100);
  const upH = Math.round((await lg.boundingBox()).height);
  ok('drawer (bottom, resizable): the grip takes it to its bounds and Up grows it, and says so', hiH > 700 && loH < 200 && upH === loH + 16 && await grip.getAttribute('aria-valuenow') === String(upH), `${hiH} / ${loH} / ${upH} (aria ${await grip.getAttribute('aria-valuenow')})`);
  await p.keyboard.press('Escape'); await wait(800);
  ok('drawer (bottom): Escape closes it', !(await lg.isVisible().catch(() => false)));
  await p.locator('[data-demo="drawer"] button', { hasText: '로그 보기' }).click(); await wait(900);
  ok('drawer (bottom, resizable): it opens again at the height it was left', Math.round((await lg.boundingBox()).height) === upH);
  await p.keyboard.press('Escape'); await wait(800);
}

/* ================================================================ Combobox */
await go('selection');
{
  const cb = p.getByRole('combobox', { name: '도시', exact: true });
  await cb.scrollIntoViewIfNeeded();
  ok('combobox: shows the chosen value\'s name', await cb.inputValue() === '부산', await cb.inputValue());
  await cb.click(); await cb.fill('대'); await wait(600);
  ok('combobox: typing opens the list', await cb.getAttribute('aria-expanded') === 'true');
  const opts = await p.getByRole('option').allInnerTexts();
  ok('combobox: the list narrows to what matches', opts.length >= 2 && opts.every((o) => o.includes('대')), opts.join(',').slice(0, 80));
  await p.keyboard.press('ArrowDown'); await wait(150);
  const active = await cb.getAttribute('aria-activedescendant');
  ok('combobox: ↓ marks an option while focus stays in the field', !!active && await cb.evaluate((e) => document.activeElement === e), active ?? 'none');
  const want = (await p.locator(`[id="${active}"]`).innerText()).split('\n')[0].trim();
  await p.keyboard.press('Enter'); await wait(500);
  ok('combobox: Enter chooses it and closes the list', await cb.inputValue() === want && await cb.getAttribute('aria-expanded') === 'false', `${await cb.inputValue()} / ${want}`);
  await cb.fill('없는도시'); await wait(600);
  ok('combobox: nothing found says so', await p.getByText('맞는 항목이 없어요').isVisible().catch(() => false));
  await p.keyboard.press('Escape'); await wait(500);
  if (await cb.getAttribute('aria-expanded') === 'true') { await p.keyboard.press('Escape'); await wait(400); }
  ok('combobox: Escape goes back to the chosen name', await cb.inputValue() === want, await cb.inputValue());
}

ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 200));
await b.close();
process.exit(failed ? 1 : 0);
