// @vitest-environment node
/* Foundation rules for the stylesheets (design-language.md 3. 성능 규칙, 8. 깊이, 9. 모서리), checked on every file:
   · what animates: transform / translate / scale / rotate / opacity freely; colours, backgrounds and shadows
     (paint only); anything else only when css-allowlist.json names it with a reason
   · corners come from the radius tokens (or the parent's --_radius): no raw px radius
   · shadows come from the shadow / depth tokens: raw colours only in outlines (inset 0 0 0 Npx …, high contrast
     and focus) and in a transparent "no shadow" for transitions
   · times come from the duration / spring tokens, except in endless loops (spinners, skeletons: a rhythm, not a
     response) */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = new URL('../styles/', import.meta.url);
const allow = JSON.parse(readFileSync(new URL('./css-allowlist.json', import.meta.url), 'utf8')) as Record<'animate' | 'radius' | 'shadow' | 'time', { selector: string; property?: string; value?: string; reason: string }[]>;
const FREE = new Set(['transform', 'translate', 'scale', 'rotate', 'opacity']);
const PAINT = new Set(['color', 'background-color', 'background', 'border-color', 'outline-color', 'box-shadow', 'fill', 'stroke', 'stroke-dashoffset']);
const TIME = /(?<![\w-])\d+(\.\d+)?m?s\b/g;

type Hit = { file: string; selector: string; what: string };
function scan() {
  const out: Record<'animate' | 'radius' | 'shadow' | 'time', Hit[]> = { animate: [], radius: [], shadow: [], time: [] };
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(new URL(file, DIR), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, name, body] of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g))
      for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) if (!FREE.has(prop) && !PAINT.has(prop)) out.animate.push({ file, selector: `@keyframes ${name}`, what: prop });
    for (const [, sel0, body] of css.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\}\s*\}/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = sel0.trim().replace(/\s+/g, ' ');
      for (const d of body.split(';')) {
        const m = /^\s*([a-z-]+)\s*:\s*([\s\S]+)$/.exec(d); if (!m) continue;
        const prop = m[1], val = m[2].trim();
        if (prop === 'transition-duration' || prop === 'transition-delay' || prop === 'animation-delay')
          for (const t of val.replace(/var\([^)]*\)/g, '').match(TIME) ?? []) out.time.push({ file, selector, what: t });
        if (prop === 'transition' || prop === 'transition-property') {
          for (const part of val.split(/,(?![^(]*\))/)) {
            const p = part.trim().split(/\s+/)[0];
            if (p && p !== 'none' && !FREE.has(p) && !PAINT.has(p)) out.animate.push({ file, selector, what: p });
          }
          for (const t of val.replace(/var\([^)]*\)/g, '').match(TIME) ?? []) out.time.push({ file, selector, what: t });
        }
        if ((prop === 'animation' || prop === 'animation-duration') && !/\binfinite\b/.test(val))
          for (const t of val.replace(/var\([^)]*\)/g, '').match(TIME) ?? []) out.time.push({ file, selector, what: t });
        if (/^border(-[a-z]+)*-radius$/.test(prop) && /(?<![\w.-])[1-9]\d*(\.\d+)?px\b/.test(val) && !/var\(/.test(val)) out.radius.push({ file, selector, what: val });
        if (prop === 'box-shadow') {
          const raw = val.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => /rgba?\(|#[0-9a-f]{3,8}\b/i.test(s.replace(/var\([^)]*\)/g, '')));
          const fine = (s: string) => /^inset 0 0 0 [\d.]+px /.test(s) || /^0 0 0 (0 )?rgba\(0, 0, 0, 0\)$/.test(s) || /^0 0 0 [\d.]+px /.test(s);
          for (const s of raw) if (!fine(s)) out.shadow.push({ file, selector, what: s });
        }
      }
    }
  }
  return out;
}
const listed = (kind: keyof typeof allow, h: Hit) => allow[kind].some((a) => h.selector.includes(a.selector) && (!a.property || a.property === h.what) && (!a.value || a.value === h.what) && a.reason.length > 10);
const show = (hs: Hit[]) => hs.map((h) => `${h.file} ${h.selector.slice(0, 80)} → ${h.what}`);

describe('stylesheets follow the foundation rules', () => {
  const hits = scan();
  it('animate only transform / opacity / paint, or an exception listed with its reason', () => expect(show(hits.animate.filter((h) => !listed('animate', h)))).toEqual([]));
  it('take corners from the radius tokens', () => expect(show(hits.radius.filter((h) => !listed('radius', h)))).toEqual([]));
  it('take shadows from the shadow and depth tokens', () => expect(show(hits.shadow.filter((h) => !listed('shadow', h)))).toEqual([]));
  it('take times from the duration and spring tokens (loops excepted)', () => expect(show(hits.time.filter((h) => !listed('time', h)))).toEqual([]));
  it('every exception still matches something (no stale entries)', () => {
    const all = [...hits.animate.map((h) => ['animate', h] as const), ...hits.radius.map((h) => ['radius', h] as const), ...hits.shadow.map((h) => ['shadow', h] as const), ...hits.time.map((h) => ['time', h] as const)];
    const stale = (['animate', 'radius', 'shadow', 'time'] as const).flatMap((k) => allow[k].filter((a) => !all.some(([kk, h]) => kk === k && h.selector.includes(a.selector) && (!a.property || a.property === h.what))).map((a) => `${k}: ${a.selector} ${a.property ?? ''}`));
    expect(stale).toEqual([]);
  });
});
