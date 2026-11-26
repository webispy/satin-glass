import { describe, it, expect, vi } from 'vitest';
import { Spring, place, springEasing, springDuration, springs, springAt, motions, motionOf, prefersReducedMotion, drag } from '../src';

describe('springs', () => {
  it('every named spring reaches its target and the CSS easing ends at exactly 1', () => {
    for (const s of Object.values(springs)) {
      const d = springDuration(s) / 1000;
      expect(Math.abs(1 - springAt(s, d))).toBeLessThan(0.0015);
      const e = springEasing(s);
      expect(e.startsWith('linear(0,')).toBe(true);
      expect(e.endsWith(', 1)')).toBe(true);
    }
  });
  it('personalities: calm never visibly overshoots on smooth, lively < playful everywhere', () => {
    const peak = (s: { response: number; damping: number }) => Math.max(...Array.from({ length: 1500 }, (_, i) => springAt(s, i / 1000)));
    expect(peak(motions.calm.smooth)).toBeLessThanOrEqual(1);
    for (const n of ['snappy', 'smooth', 'bouncy', 'gentle', 'pop'] as const) {
      expect(peak(motions.lively[n])).toBeGreaterThanOrEqual(peak(motions.calm[n]) - 1e-9);
      expect(peak(motions.playful[n])).toBeGreaterThan(peak(motions.lively[n]));
    }
    expect(motions.calm.squash).toBe(0);
    expect(motions.playful.squash).toBeGreaterThan(motions.lively.squash);
  });
  it('motionOf resolves the nearest [data-sg-motion], else the default', () => {
    document.body.innerHTML = '<div data-sg-motion="playful"><span id="a"></span></div><span id="b"></span>';
    expect(motionOf(document.getElementById('a'))).toBe('playful');
    expect(motionOf(document.getElementById('b'))).toBe('lively');
  });
  it('the integrated Spring is stable with long frames and settles', () => {
    const s = new Spring(0, 'snappy'); s.target = 100;
    for (let i = 0; i < 60; i++) s.step(0.05);
    expect(s.settled).toBe(true);
    expect(Math.abs(s.value - 100)).toBeLessThan(0.05);
  });
});

describe('place', () => {
  const vw = 1000, vh = 800;
  globalThis.innerWidth = vw; globalThis.innerHeight = vh;
  it('puts a menu below its anchor, start-aligned', () => {
    const r = place({ width: 200, height: 150 }, new DOMRect(100, 100, 80, 40), 'bottom-start');
    expect(r).toMatchObject({ x: 100, y: 148, side: 'bottom' });
  });
  it('flips above when there is no room below, and stays inside the viewport', () => {
    const r = place({ width: 200, height: 300 }, new DOMRect(900, 700, 80, 40), 'bottom-start');
    expect(r.side).toBe('top');
    expect(r.x + 200).toBeLessThanOrEqual(vw - 12);
    expect(r.y).toBe(700 - 8 - 300);
  });
  it('right to left, start and end above or below are the anchor\'s right and left edges', () => {
    const a = new DOMRect(500, 100, 80, 40);
    expect(place({ width: 200, height: 150 }, a, 'bottom-start', 8, 12, 'rtl').x).toBe(580 - 200);
    expect(place({ width: 200, height: 150 }, a, 'bottom-end', 8, 12, 'rtl').x).toBe(500);
    expect(place({ width: 200, height: 150 }, a, 'top-start', 8, 12, 'rtl').x).toBe(580 - 200);
    /* beside the anchor, start and end are its top and bottom either way */
    expect(place({ width: 200, height: 150 }, a, 'right-start', 8, 12, 'rtl').y).toBe(100);
    expect(place({ width: 200, height: 150 }, a, 'bottom', 8, 12, 'rtl').x).toBe(540 - 100);
  });
  it('sets the transform origin at the point nearest the anchor centre', () => {
    const r = place({ width: 200, height: 150 }, new DOMRect(100, 100, 80, 40), 'bottom-start');
    expect(r.originX).toBe(40); expect(r.originY).toBe(0);
  });
});

describe('reduce motion scope', () => {
  it('the nearest [data-sg-reduce-motion] decides; without one, the system setting', () => {
    document.body.innerHTML = '<div data-sg-reduce-motion="true"><span id="a"></span><div data-sg-reduce-motion="false"><span id="b"></span></div></div>';
    expect(prefersReducedMotion(document.getElementById('a'))).toBe(true);
    expect(prefersReducedMotion(document.getElementById('b'))).toBe(false);
  });
});

describe('overflow strip reveal', () => {
  const setup = async (dir: 'ltr' | 'rtl', scrollLeft: number, left: number) => {
    const { createOverflowStrip } = await import('../src/overflow');
    const strip = document.createElement('div'); strip.style.direction = dir;
    const item = document.createElement('button'); strip.append(item); document.body.append(strip);
    Object.defineProperty(strip, 'scrollWidth', { value: 800 }); Object.defineProperty(strip, 'clientWidth', { value: 300 });
    Object.defineProperty(strip, 'scrollLeft', { value: scrollLeft, writable: true });
    /* measured as laid out: the strip at x 100 on the page, the item `left` px into its scrolled content. Its
       offsetLeft is from another box (a positioned wrapper) and must not be read */
    strip.getBoundingClientRect = () => new DOMRect(100, 0, 300, 40);
    item.getBoundingClientRect = () => new DOMRect(100 + left - scrollLeft, 0, 60, 40);
    Object.defineProperty(item, 'offsetLeft', { value: 9999 });
    const to = vi.fn(); strip.scrollTo = to as unknown as typeof strip.scrollTo;
    return { s: createOverflowStrip(strip, () => [item]), item, to, strip };
  };
  it('left to right, scrolls an item past the end into view', async () => {
    const { s, item, to, strip } = await setup('ltr', 0, 400);
    s.reveal(item, false);
    expect(to).toHaveBeenCalledWith({ left: 400 + 60 + 32 - 300, behavior: 'auto' });
    s.destroy(); strip.remove();
  });
  it('right to left, scrolls to negative positions (the start is at 0, the end at -(scrollWidth - width))', async () => {
    /* the view at the start: x 0–300; the item lies past the end, on the left, at -400 */
    const { s, item, to, strip } = await setup('rtl', 0, -400);
    s.reveal(item, false);
    expect(to).toHaveBeenCalledWith({ left: -400 - 32, behavior: 'auto' });
    s.destroy(); strip.remove();
  });
  it('under a scaled ancestor, measures in layout px (the rects are on screen)', async () => {
    const { s, item, to, strip } = await setup('ltr', 0, 400);
    /* scale(.5): the 300 px strip is 150 px on screen, and the item at content x 400 is at 200 on screen, 30 wide;
       read as screen px it would look in view */
    Object.defineProperty(strip, 'offsetWidth', { value: 300 });
    strip.getBoundingClientRect = () => new DOMRect(100, 0, 150, 20);
    item.getBoundingClientRect = () => new DOMRect(100 + 200, 0, 30, 20);
    s.reveal(item, false);
    expect(to).toHaveBeenCalledWith({ left: 400 + 60 + 32 - 300, behavior: 'auto' });
    s.destroy(); strip.remove();
  });
  it('right to left, an item near the far end stops at the end, not at 0', async () => {
    const { s, item, to, strip } = await setup('rtl', -100, -500);
    s.reveal(item, false);
    expect(to).toHaveBeenCalledWith({ left: -500, behavior: 'auto' });
    s.destroy(); strip.remove();
  });
});

describe('overflow strip wheel latching', () => {
  it('a later gesture from the page that reaches the strip mid-way stays the page’s (no owner left over)', async () => {
    const { createOverflowStrip } = await import('../src/overflow');
    const strip = document.createElement('div');
    const item = document.createElement('button'); strip.append(item); document.body.append(strip);
    Object.defineProperty(strip, 'scrollWidth', { value: 800 }); Object.defineProperty(strip, 'clientWidth', { value: 300 });
    const s = createOverflowStrip(strip, () => [item]);
    const wheel = (target: EventTarget, t: number) => {
      const e = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'timeStamp', { value: t });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(wheel(strip, 10_000)).toBe(true);            /* a gesture that starts on the strip: the strip's */
    expect(wheel(document.body, 11_000)).toBe(false);   /* a pause, then a gesture on the page … */
    expect(wheel(strip, 11_050)).toBe(false);           /* … reaching the strip mid-way stays the page's */
    expect(wheel(strip, 12_000)).toBe(true);            /* a pause, a fresh turn on the strip: the strip's again */
    s.destroy(); strip.remove();
  });
});

describe('drag', () => {
  /* taken down mid-gesture (a component hidden by Suspense, or set up again): the pointer is let go, and nothing that
     comes after reaches the handlers, `end` included: the caller decides what a cut-short drag leaves */
  it('a disposer called mid-gesture releases the capture and ends nothing', () => {
    const el = document.createElement('div'); document.body.append(el);
    let held: number | null = null;
    el.setPointerCapture = vi.fn((id: number) => { held = id; });
    el.releasePointerCapture = vi.fn(() => { held = null; });
    el.hasPointerCapture = vi.fn((id: number) => held === id);
    const ev = (type: string, x: number, target: EventTarget) => { const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 0 }); Object.defineProperty(e, 'pointerId', { value: 7 }); target.dispatchEvent(e); };
    const move = vi.fn(), end = vi.fn();
    const off = drag(el, { move, end });
    ev('pointerdown', 0, el); ev('pointermove', 20, window);
    expect(held).toBe(7);
    expect(move).toHaveBeenCalledTimes(1);
    off();
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(held).toBeNull();
    ev('pointermove', 40, window); ev('lostpointercapture', 40, el); ev('pointerup', 40, window);
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    el.remove();
  });
  /* cancelled from outside (its element hidden mid-drag): ended as cancelled, the pointer let go, a later release ignored */
  it('cancel() ends a gesture in progress as cancelled', () => {
    const el = document.createElement('div'); document.body.append(el);
    let held: number | null = null;
    el.setPointerCapture = vi.fn((id: number) => { held = id; });
    el.releasePointerCapture = vi.fn(() => { held = null; });
    el.hasPointerCapture = vi.fn((id: number) => held === id);
    const ev = (type: string, x: number, target: EventTarget) => { const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 0 }); Object.defineProperty(e, 'pointerId', { value: 7 }); target.dispatchEvent(e); };
    const end = vi.fn();
    const off = drag(el, { end });
    off.cancel();   /* nothing in progress: nothing happens */
    expect(end).not.toHaveBeenCalled();
    ev('pointerdown', 0, el); ev('pointermove', 20, window);
    off.cancel();
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0][1]).toBe(true);
    expect(held).toBeNull();
    ev('pointerup', 40, window);
    expect(end).toHaveBeenCalledTimes(1);
    off(); el.remove();
  });
});
