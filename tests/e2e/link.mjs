// Text links (#6) on the docs Typography page ("링크") and in the Getting started prose.
// In the four themes: the link colour is --sg-link-text and reaches 4.5:1 (7:1 in high contrast) on the card it sits
// on; it is underlined at rest (2 px in high contrast); `tone="inherit"` takes the surrounding colour; the external
// link has its arrow, opens in a new tab with rel noopener, and carries the new-tab notice as its description, not in
// its name. Hovering thickens the underline and moves nothing. With forced colours (Chromium) the link is LinkText.
// usage: node tests/e2e/link.mjs   (BROWSER=webkit|firefox; E2E_PORT (default 4173))
// covers: foundation, css
import * as pw from './pw.mjs';
const engine = process.env.BROWSER || 'chromium';
const b = await pw[engine].launch();
let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const THEMES = [['light', 'mode=light', 4.5], ['dark', 'mode=dark', 4.5], ['light-hc', 'mode=light&hc=1', 7], ['dark-hc', 'mode=dark&hc=1', 7]];
for (const [name, q, min] of THEMES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${pw.ORIGIN}/?lang=ko&rm=1&${q}#/type`);
  const links = p.locator('.docs__page .demo .sg-link');
  await links.first().waitFor();
  /* geometry and wrapping read after the web font is in */
  await p.evaluate(() => document.fonts.ready);
  const r = await links.evaluateAll((as) => {
    const rgb = (c) => { const m = c.match(/[\d.]+/g).map(Number); return c.startsWith('color(') ? m.slice(0, 3).map((x) => x * 255) : m.slice(0, 3); };
    const lum = (c) => { const v = rgb(c).map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const ground = (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
    /* the token itself, resolved to a colour by a probe */
    const probe = document.createElement('span'); probe.style.color = 'var(--sg-link-text)'; as[0].parentElement.appendChild(probe);
    const token = getComputedStyle(probe).color; probe.remove();
    return as.map((a) => {
      const cs = getComputedStyle(a), parent = getComputedStyle(a.parentElement);
      const ids = (a.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
      return { color: cs.color, token, parent: parent.color, ratio: ratio(cs.color, ground(a)), line: cs.textDecorationLine, thick: parseFloat(cs.textDecorationThickness),
        inherit: a.classList.contains('sg-link--inherit'), arrow: !!a.querySelector('svg.sg-link__arrow[aria-hidden="true"]'), target: a.getAttribute('target'), rel: a.getAttribute('rel'),
        description: ids.map((id) => document.getElementById(id)?.textContent).join(' ') };
    });
  });
  const [plain, ext] = r;
  ok(`link · ${name}: the link colour, ${plain.ratio.toFixed(2)}:1 on its card (≥ ${min})`, plain.color === plain.token && plain.ratio >= min, JSON.stringify(plain));
  ok(`link · ${name}: underlined at rest (${plain.thick}px)`, plain.line.includes('underline') && plain.thick >= (name.endsWith('hc') ? 2 : 1) - 0.01, JSON.stringify(plain));
  ok(`link · ${name}: tone="inherit" takes the surrounding colour`, ext.inherit && ext.color === ext.parent, JSON.stringify(ext));
  /* the accessible name (Playwright's computation): the visible text alone, the notice left out. In Chromium the
     browser's own accessibility tree is read as well, for the name and the description */
  const named = await p.getByRole('link', { name: 'Lucide', exact: true }).count();
  if (engine === 'chromium') {
    const cdp = await p.context().newCDPSession(p);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const node = nodes.find((n) => n.role?.value === 'link' && n.name?.value === 'Lucide');
    const desc = node?.description?.value;
    ok(`link · ${name}: the browser's accessibility tree names it "Lucide" and describes it as opening a new tab`, desc === '새 탭 또는 창에서 열림', JSON.stringify({ found: !!node, desc }));
    await cdp.detach();
  }
  ok(`link · ${name}: external, new tab — arrow, rel noopener, the notice as a description, not in the name`,
    ext.arrow && ext.target === '_blank' && /\bnoopener\b/.test(ext.rel) && ext.description === '새 탭 또는 창에서 열림' && named === 1, JSON.stringify({ ...ext, named }));
  /* hover thickens the underline and moves nothing */
  const first = links.first();
  await first.scrollIntoViewIfNeeded();
  const before = await first.boundingBox();
  await first.hover();
  const hovered = await first.evaluate((a) => parseFloat(getComputedStyle(a).textDecorationThickness));
  const after = await first.boundingBox();
  ok(`link · ${name}: hover thickens the underline in place`, hovered >= 2 - 0.01 && Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5, `${hovered}px, ${JSON.stringify([before, after])}`);
  ok(`link · ${name}: no page errors`, errs.length === 0, errs.join('; '));
  await p.close();
}

/* the prose links of Getting started are links now, and a link wrapped over two lines keeps its focus ring */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${pw.ORIGIN}/?lang=ko&rm=1#/start`);
  const a = p.locator('.docs__page .sg-link').first();
  await a.waitFor();
  ok('link · Getting started: the prose links are Links', (await p.locator('.docs__page .sg-link').count()) >= 5);
  await a.evaluate(async (el) => { el.textContent = '아주 긴 이름의 링크가 두 줄로 넘어가는지 보는 문장입니다 한 번 더 길게 늘여 둡니다'; await document.fonts.ready; el.scrollIntoView({ block: 'center' }); });
  await a.focus();
  const mod = engine === 'webkit' ? 'Alt+' : '';
  await p.keyboard.press(`${mod}Shift+Tab`); await p.keyboard.press(`${mod}Tab`);
  const f = await a.evaluate((el) => ({ focused: document.activeElement === el, lines: new Set([...el.getClientRects()].map((r) => Math.round(r.top))).size, outline: getComputedStyle(el).outlineStyle, width: parseFloat(getComputedStyle(el).outlineWidth), underline: parseFloat(getComputedStyle(el).textDecorationThickness) }));
  ok('link · 390 px: a link over two lines or more takes keyboard focus with a 2 px outline and a 2 px underline', f.focused && f.lines >= 2 && f.outline === 'solid' && f.width === 2 && f.underline >= 1.99, JSON.stringify(f));
  await p.close();
}

if (engine === 'chromium') {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.emulateMedia({ forcedColors: 'active' });
  await p.goto(`${pw.ORIGIN}/?lang=ko&rm=1&mode=light#/type`);
  const a = p.locator('.docs__page .demo .sg-link').first();
  await a.waitFor();
  const c = await a.evaluate((el) => { const s = document.createElement('span'); s.style.color = 'LinkText'; document.body.appendChild(s); const want = getComputedStyle(s).color; s.remove(); return { got: getComputedStyle(el).color, want, line: getComputedStyle(el).textDecorationLine }; });
  ok('link · forced colours: LinkText, still underlined', c.got === c.want && c.line.includes('underline'), JSON.stringify(c));
  await p.close();

  /* the underline width follows the nearest theme boundary: a standard theme inside a high-contrast page is 1 px again,
     and a plain .sg-link outside any provider follows the system's high contrast */
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await q.emulateMedia({ contrast: 'more' });
  await q.goto(`${pw.ORIGIN}/?lang=ko&rm=1&mode=light&hc=1#/type`);
  await q.locator('.docs__page .demo .sg-link').first().waitFor();
  const w = await q.evaluate(() => {
    const put = (host) => { const a = document.createElement('a'); a.className = 'sg-link'; a.href = '#/type'; a.textContent = 'x'; host.appendChild(a); return parseFloat(getComputedStyle(a).textDecorationThickness); };
    const island = document.createElement('div'); island.setAttribute('data-sg-theme', 'light'); document.querySelector('.docs__page').appendChild(island);
    return { island: put(island), bare: put(document.body), hc: parseFloat(getComputedStyle(document.querySelector('.docs__page .demo .sg-link')).textDecorationThickness) };
  });
  ok('link · underline width by the nearest theme: 2 px in high contrast, 1 px in a standard island, 2 px bare under the system setting', w.hc === 2 && w.island < 1.5 && w.bare === 2, JSON.stringify(w));
  await q.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
