import { describe, it, expect } from 'vitest';
import { Spring, place, springEasing, springDuration, springs, springAt, motions, motionOf, prefersReducedMotion } from '../src';

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
