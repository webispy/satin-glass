import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachLight, invalidateLight } from '../src/light';

/* The pointer light (core/light.ts): what it writes each frame, and when. rAF is driven by hand. */

let frames: FrameRequestCallback[] = [];
const flush = () => { const f = frames; frames = []; for (const cb of f) cb(performance.now()); };
const move = (x: number, y: number) => {
  window.dispatchEvent(Object.assign(new MouseEvent('pointermove', { clientX: x, clientY: y }), { pointerType: 'mouse' }));
  flush();
};
const key = (el: Element, type: 'keydown' | 'keyup', k = ' ') => { el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); flush(); };
const detach: (() => void)[] = [];
const log: string[] = [];

/** a glass box at (left, top), 100 × 100, logging its rect reads and style writes */
function glass(id: string, left: number, top: number, parent: HTMLElement = document.body, cls = 'sg-glass') {
  const el = document.createElement('div');
  el.className = cls; el.id = id;
  parent.appendChild(el);
  el.getBoundingClientRect = () => { log.push(`read ${id}`); return new DOMRect(left, top, 100, 100); };
  const set = el.style.setProperty.bind(el.style);
  el.style.setProperty = (name: string, value: string | null, prio?: string) => { log.push(`write ${id} ${name}`); set(name, value, prio); };
  return el;
}
const attach = (el: HTMLElement) => { detach.push(attachLight(el)); return el; };

beforeEach(() => {
  frames = []; log.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  document.body.innerHTML = '';
});
afterEach(() => {
  while (detach.length) detach.pop()!();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('pointer light', () => {
  it('writes a surface far from the pointer once, then leaves it alone', () => {
    const near = attach(glass('near', 0, 0));
    attach(glass('far', 2000, 2000));
    move(50, 50);
    move(60, 55);
    log.length = 0;
    move(70, 60);
    move(80, 65);
    expect(log.filter((l) => l.startsWith('write far'))).toEqual([]);
    expect(log.filter((l) => l.startsWith('write near')).length).toBeGreaterThan(0);
    expect(near.style.getPropertyValue('--sg-hx')).toBe('80.0px');
    expect(near.style.getPropertyValue('--sg-hk')).toBe('1.000');
  });

  it('lights only the glass a finger pressed, and none from a press elsewhere', () => {
    const bar = attach(glass('bar', 0, 0));
    let top = 200;
    const btn = attach(glass('btn', 0, 200));
    btn.getBoundingClientRect = () => new DOMRect(0, top, 100, 100);
    const other = document.body.appendChild(document.createElement('button'));
    const touch = (type: string, target: Element, x: number, y: number) => {
      target.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, buttons: 1 }), { pointerType: 'touch' }));
      flush();
    };
    const lift = () => { document.documentElement.dispatchEvent(new Event('pointerleave')); flush(); };
    touch('pointerdown', other, 50, 150);   /* 50 px from both glasses: within a mouse's reach, but a finger is on neither */
    expect(bar.style.getPropertyValue('--sg-hk')).toBe('0.000');
    expect(btn.style.getPropertyValue('--sg-hk')).toBe('0.000');
    expect(bar.hasAttribute('data-sg-lit') || btn.hasAttribute('data-sg-lit')).toBe(false);
    lift();
    top = 260;   /* the layout moved the button since it was measured */
    touch('pointerdown', btn, 40, 270);
    expect(btn.style.getPropertyValue('--sg-hk')).toBe('1.000');
    expect(btn.style.getPropertyValue('--sg-hy')).toBe('10.0px');
    expect(btn.hasAttribute('data-sg-lit')).toBe(true);
    expect(bar.hasAttribute('data-sg-lit')).toBe(false);
    touch('pointermove', btn, 40, 500);   /* dragged off it, still pressed: it stays lit */
    expect(btn.style.getPropertyValue('--sg-hk')).toBe('1.000');
    lift();
    expect(btn.style.getPropertyValue('--sg-hk')).toBe('0.000');
    move(50, 150);   /* a mouse at the first place reaches both rims */
    expect(Number(bar.style.getPropertyValue('--sg-hk'))).toBeGreaterThan(0);
  });

  it('reads every rect before it writes anything (after a scroll)', () => {
    attach(glass('a', 0, 0)); attach(glass('b', 120, 0)); attach(glass('c', 240, 0));
    move(50, 50);
    window.dispatchEvent(new Event('scroll'));
    log.length = 0;
    move(60, 50);
    const lastRead = log.map((l) => l.startsWith('read')).lastIndexOf(true);
    const firstWrite = log.findIndex((l) => l.startsWith('write'));
    expect(log.filter((l) => l.startsWith('read'))).toEqual(['read a', 'read b', 'read c']);
    expect(firstWrite).toBeGreaterThan(lastRead);
  });

  it('does not write nested glass, whose sheen the stylesheet hides, unless its parent is a clear app bar', () => {
    const outer = attach(glass('outer', 0, 0));
    const inner = attach(glass('inner', 10, 10, outer));
    const bar = document.createElement('header');
    bar.className = 'sg-appbar'; bar.setAttribute('data-transparent-top', ''); bar.setAttribute('data-at-top', '');
    document.body.appendChild(bar);
    const barGlass = glass('barGlass', 0, 0, bar);
    const inBar = attach(glass('inBar', 10, 10, barGlass));
    move(20, 20);
    expect(log.some((l) => l.startsWith('write inner'))).toBe(false);
    expect(inner.style.getPropertyValue('--sg-hk')).toBe('');
    expect(outer.style.getPropertyValue('--sg-hk')).toBe('1.000');
    expect(inBar.style.getPropertyValue('--sg-hk')).toBe('1.000');
  });

  it('stops listening after the last surface goes and listens again on the next', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const a = glass('a', 0, 0), b = glass('b', 200, 0);
    const offA = attachLight(a), offB = attachLight(b);
    expect(add.mock.calls.filter(([t]) => t === 'pointermove')).toHaveLength(1);
    offA();
    expect(remove.mock.calls.filter(([t]) => t === 'pointermove')).toHaveLength(0);
    offB();
    for (const t of ['pointermove', 'pointerdown', 'scroll', 'resize']) expect(remove.mock.calls.some(([u]) => u === t)).toBe(true);
    log.length = 0;
    move(50, 50);
    expect(frames).toHaveLength(0);
    expect(log).toEqual([]);
    attach(a);
    expect(add.mock.calls.filter(([t]) => t === 'pointermove')).toHaveLength(2);
    move(50, 50);
    expect(a.style.getPropertyValue('--sg-hk')).toBe('1.000');
    add.mockRestore(); remove.mockRestore();
  });

  it('keeps the light off under reduced motion, and follows a change of the setting', async () => {
    const scope = document.createElement('div');
    scope.setAttribute('data-sg-reduce-motion', 'true');
    document.body.appendChild(scope);
    const el = attach(glass('a', 0, 0, scope));
    move(50, 50);
    expect(el.style.getPropertyValue('--sg-hx')).toBe('');
    expect(+(el.style.getPropertyValue('--sg-hk') || 0)).toBe(0);
    /* the answer is kept until the setting changes, not looked up on every frame */
    const closest = vi.spyOn(Element.prototype, 'closest');
    move(55, 50); move(60, 50);
    expect(closest).not.toHaveBeenCalled();
    closest.mockRestore();
    scope.setAttribute('data-sg-reduce-motion', 'false');
    await Promise.resolve();
    move(50, 50);
    expect(el.style.getPropertyValue('--sg-hk')).toBe('1.000');
    scope.setAttribute('data-sg-reduce-motion', 'true');
    await Promise.resolve();
    move(60, 50);
    expect(+el.style.getPropertyValue('--sg-hk')).toBe(0);
  });

  it('keeps a compositing layer only while the sheen shows or fades', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const el = attach(glass('a', 0, 0));
    expect(el.hasAttribute('data-sg-lit')).toBe(false);
    move(50, 50);
    expect(el.hasAttribute('data-sg-lit')).toBe(true);
    move(1000, 1000);
    expect(el.style.getPropertyValue('--sg-hk')).toBe('0.000');
    expect(el.hasAttribute('data-sg-lit')).toBe(true);      /* still fading */
    expect(el.style.getPropertyValue('--sg-hx')).toBe('1000.0px'); /* and following the pointer as it fades */
    vi.advanceTimersByTime(400);
    flush();
    expect(el.hasAttribute('data-sg-lit')).toBe(false);
  });

  it('a detached surface is left as it was, so attaching it again starts dark', () => {
    const el = glass('a', 0, 0);
    const off = attachLight(el);
    move(50, 50);
    expect(el.style.getPropertyValue('--sg-hk')).toBe('1.000');
    off();
    for (const p of ['--sg-hx', '--sg-hy', '--sg-hk']) expect(el.style.getPropertyValue(p)).toBe('');
    expect(el.hasAttribute('data-sg-lit')).toBe(false);
    attach(el);
    move(2000, 2000);
    expect(+(el.style.getPropertyValue('--sg-hk') || 0)).toBe(0);
  });

  it('decides nesting again when a parent stops being glass, and without waiting for the pointer to move', async () => {
    const outer = attach(glass('outer', 0, 0));
    const inner = attach(glass('inner', 10, 10, outer));
    move(20, 20);
    expect(inner.style.getPropertyValue('--sg-hk')).toBe('');
    outer.className = 'sg-sidebar';  /* <Sidebar glass={false}>: the button inside is glass on its own now */
    await Promise.resolve();
    flush();
    expect(inner.style.getPropertyValue('--sg-hk')).toBe('1.000');
  });

  it('turns the light off when reduced motion turns on under a pointer that stays still', async () => {
    const scope = document.createElement('div');
    document.body.appendChild(scope);
    const el = attach(glass('a', 0, 0, scope));
    move(50, 50);
    expect(el.style.getPropertyValue('--sg-hk')).toBe('1.000');
    scope.setAttribute('data-sg-reduce-motion', 'true');
    await Promise.resolve();
    flush();
    expect(+el.style.getPropertyValue('--sg-hk')).toBe(0);
  });

  it("fades for the theme's own --sg-duration-slow", () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const theme = document.createElement('div');
    theme.style.setProperty('--sg-duration-slow', '1s');
    document.body.appendChild(theme);
    const el = attach(glass('a', 0, 0, theme));
    move(50, 50);
    move(1000, 1000);
    vi.advanceTimersByTime(600);
    move(1100, 1000);
    expect(el.hasAttribute('data-sg-lit')).toBe(true);
    expect(el.style.getPropertyValue('--sg-hx')).toBe('1100.0px');
    vi.advanceTimersByTime(500);
    flush();
    expect(el.hasAttribute('data-sg-lit')).toBe(false);
  });

  it("a slider's value bubble shows the sheen of the glass it sits in, also inside nested glass", () => {
    /* the component never registers the bubble: <span class="sg-slider__bubble sg-glass"> inside .sg-slider */
    const css = readFileSync(join(import.meta.dirname, '../styles/controls.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.sg-glass :has\(\.sg-slider__bubble\), \.sg-glass \.sg-slider__bubble \{ --sg-hx: inherit; --sg-hy: inherit; --sg-hk: inherit; \}/);
    const outer = attach(glass('outer', 0, 0));
    const inner = attach(glass('inner', 10, 10, outer));
    const slider = document.createElement('div'); slider.className = 'sg-slider';
    const bubble = document.createElement('span'); bubble.className = 'sg-slider__bubble sg-glass';
    slider.appendChild(bubble); inner.appendChild(slider);
    move(20, 20);
    /* as before: the nearest registered glass carries the values the bubble inherits */
    expect(inner.style.getPropertyValue('--sg-hk')).toBe('1.000');
    expect(inner.style.getPropertyValue('--sg-hx')).toBe('10.0px');
  });

  it('invalidateLight() does nothing more than mark the rects stale while no surface is registered', () => {
    /* as without a DOM: no requestAnimationFrame to call */
    vi.stubGlobal('requestAnimationFrame', undefined);
    expect(() => invalidateLight()).not.toThrow();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    invalidateLight();
    expect(frames).toHaveLength(0);
    /* while one is, it decides again for a pointer that is not moving */
    attach(glass('a', 0, 0));
    invalidateLight();
    expect(frames).toHaveLength(1);
  });

  it('nodes coming and going outside the glass schedule no frame; glass added or the tree inside a surface do', async () => {
    const card = attach(glass('card', 0, 0));
    move(50, 50);
    /* a streaming log, a virtual table or a chart elsewhere on the page */
    const list = document.createElement('ul');
    document.body.appendChild(list);
    await Promise.resolve();
    flush();
    for (let i = 0; i < 5; i++) { const li = document.createElement('li'); li.innerHTML = '<span>row</span>'; list.appendChild(li); }
    list.firstChild!.remove();
    await Promise.resolve();
    expect(frames).toHaveLength(0);
    /* glass added inside something that is not glass */
    const wrap = document.createElement('div'); wrap.innerHTML = '<div class="sg-glass"></div>';
    list.appendChild(wrap);
    await Promise.resolve();
    expect(frames).toHaveLength(1);
    flush();
    /* removed again */
    wrap.remove();
    await Promise.resolve();
    expect(frames).toHaveLength(1);
    flush();
    /* the tree inside a registered surface */
    card.appendChild(document.createElement('p'));
    await Promise.resolve();
    expect(frames).toHaveLength(1);
  });

  it("reads the fade's length when the sheen goes out, not when it lit up", () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const theme = document.createElement('div');
    theme.style.setProperty('--sg-duration-slow', '100ms');
    document.body.appendChild(theme);
    const el = attach(glass('a', 0, 0, theme));
    move(50, 50);
    /* the theme changes while the surface is lit: the CSS fades over the new length */
    theme.style.setProperty('--sg-duration-slow', '1s');
    move(1000, 1000);
    vi.advanceTimersByTime(600);
    flush();
    expect(el.hasAttribute('data-sg-lit')).toBe(true);
    vi.advanceTimersByTime(500);
    flush();
    expect(el.hasAttribute('data-sg-lit')).toBe(false);
  });

  it("a registered glass holding a slider writes its own strength from the start, so its bubble does not show its outer glass's", () => {
    const outer = attach(glass('outer', 0, 0));
    /* nested in the outer glass, but far from the pointer (a tall panel scrolled inside it) */
    const inner = attach(glass('inner', 2000, 2000, outer));
    const slider = document.createElement('div'); slider.className = 'sg-slider';
    const bubble = document.createElement('span'); bubble.className = 'sg-slider__bubble sg-glass';
    slider.appendChild(bubble); inner.appendChild(slider);
    move(20, 20);
    expect(outer.style.getPropertyValue('--sg-hk')).toBe('1.000');
    /* an inline value: `.sg-glass :has(.sg-slider__bubble) { --sg-hk: inherit }` does not reach it */
    expect(inner.style.getPropertyValue('--sg-hk')).toBe('0.000');
    log.length = 0;
    move(25, 20);
    expect(log.filter((l) => l.startsWith('write inner'))).toEqual([]);
  });

  it('a key press shows the sheen where the last pointer event put it, as every frame used to write it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const btn = attach(glass('btn', 2000, 1000, document.body, 'sg-glass sg-pressable'));
    const plain = attach(glass('plain', 2000, 2000));
    /* no pointer event yet (a keyboard-only user): the press puts it far off, where the pointer starts, as main's first
       frame did, not at the registered initial on the top edge */
    key(btn, 'keydown');
    expect(btn.style.getPropertyValue('--sg-hx')).toBe('-12000.0px');
    expect(btn.style.getPropertyValue('--sg-hy')).toBe('-11000.0px');
    key(btn, 'keyup');
    vi.advanceTimersByTime(400);
    flush();
    expect(btn.hasAttribute('data-sg-lit')).toBe(false);
    move(50, 50);
    /* out of reach, so not written by the move */
    expect(btn.style.getPropertyValue('--sg-hx')).toBe('-12000.0px');
    key(btn, 'keydown');
    expect(btn.style.getPropertyValue('--sg-hx')).toBe('-1950.0px');
    expect(btn.style.getPropertyValue('--sg-hy')).toBe('-950.0px');
    expect(btn.style.getPropertyValue('--sg-hk')).toBe('0.000');
    expect(btn.hasAttribute('data-sg-lit')).toBe(true);
    /* and follows the pointer while the key is held */
    move(60, 40);
    expect(btn.style.getPropertyValue('--sg-hx')).toBe('-1940.0px');
    expect(btn.style.getPropertyValue('--sg-hy')).toBe('-960.0px');
    /* a glass that does not press is not written */
    key(plain, 'keydown');
    expect(plain.style.getPropertyValue('--sg-hx')).toBe('');
    key(btn, 'keyup');
    expect(btn.hasAttribute('data-sg-lit')).toBe(true); /* fading back */
    vi.advanceTimersByTime(400);
    flush();
    expect(btn.hasAttribute('data-sg-lit')).toBe(false);
  });

  it('a scroll with no lit surface schedules nothing', () => {
    attach(glass('far', 2000, 2000));
    move(10, 10);
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBe(0);
  });
  it('a sheen fading out stays with a still pointer when the glass scrolls away from it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    let left = 0;
    const card = attach(glass('card', 0, 0));
    card.getBoundingClientRect = () => new DOMRect(left, 0, 100, 100);
    move(50, 50);
    expect(card.style.getPropertyValue('--sg-hx')).toBe('50.0px');
    /* the page scrolls the card away under the pointer: out of reach, fading, measured again */
    left = 600; window.dispatchEvent(new Event('scroll')); flush();
    expect(card.hasAttribute('data-sg-lit')).toBe(true);
    expect(card.style.getPropertyValue('--sg-hx')).toBe('-550.0px');
  });

  it('the stylesheet registers the light properties as not inherited and keys will-change on [data-sg-lit]', () => {
    const css = readFileSync(join(import.meta.dirname, '../styles/foundation.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const p of ['hx', 'hy', 'hk']) {
      expect(css).toMatch(new RegExp(`@property --sg-${p} \\{[^}]*inherits: false`));
      expect(css).toMatch(new RegExp(`\\.sg-glass::after \\{[^}]*--sg-${p}: inherit`));
    }
    const after = css.match(/\.sg-glass::after \{[^}]*\}/)![0];
    expect(after).not.toMatch(/will-change/);
    expect(css).toMatch(/\.sg-glass\[data-sg-lit\]::after \{ will-change: transform, opacity; \}/);
  });
});
