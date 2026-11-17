import { springs, springAt, springDuration, springEasing, type SpringParams, type SpringName } from '@glass-layer/tokens';

export { springs, springAt, springDuration, springEasing };
export type { SpringParams, SpringName };

const params = (s: SpringName | SpringParams): SpringParams => (typeof s === 'string' ? springs[s] : s);

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A damped spring integrated in fixed 4 ms steps (stable at any frame rate). For finger-driven motion. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  private k: number;
  private c: number;
  constructor(value: number, spring: SpringName | SpringParams = 'smooth') {
    this.value = this.target = value;
    const p = params(spring);
    const w = (2 * Math.PI) / p.response;
    this.k = w * w;
    this.c = 2 * p.damping * w;
  }
  set(spring: SpringName | SpringParams) {
    const p = params(spring), w = (2 * Math.PI) / p.response;
    this.k = w * w; this.c = 2 * p.damping * w;
  }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
  }
  get settled() { return Math.abs(this.value - this.target) < 0.05 && Math.abs(this.velocity) < 0.5; }
  jump(v: number) { this.value = this.target = v; this.velocity = 0; }
}

/** Runs `frame(dt)` every animation frame until it returns false. Returns a cancel function. */
export function loop(frame: (dt: number) => boolean | void): () => void {
  let raf = 0, last = performance.now(), alive = true;
  const tick = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (frame(dt) === false) { alive = false; return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

export type SpringTiming = { duration: number; easing: string };
const cache = new Map<string, SpringTiming>();
/** Web Animations timing that traces a spring (compositor-driven when only transform/opacity animate). */
export function springTiming(s: SpringName | SpringParams): SpringTiming {
  const p = params(s), key = `${p.response}/${p.damping}`;
  let t = cache.get(key);
  if (!t) { t = { duration: springDuration(p), easing: springEasing(p) }; cache.set(key, t); }
  return prefersReducedMotion() ? { duration: 1, easing: 'linear' } : t;
}

/** element.animate with a spring; resolves when finished (or immediately if cancelled). */
export function animate(el: Element, keyframes: Keyframe[], spring: SpringName | SpringParams, extra: KeyframeAnimationOptions = {}): Animation {
  return el.animate(keyframes, { fill: 'both', ...springTiming(spring), ...extra });
}
