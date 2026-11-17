import {
  springs, motions, defaultMotion, reducedMotion, springAt, springDuration, springEasing,
  type SpringParams, type SpringName, type MotionName, type Motion,
} from '@glass-layer/tokens';

export { springs, motions, defaultMotion, reducedMotion, springAt, springDuration, springEasing };
export type { SpringParams, SpringName, MotionName, Motion };

/** The motion personality in effect for an element: the nearest [data-gl-motion], else the default. */
export function motionOf(el?: Element | null): MotionName {
  const m = el?.closest?.('[data-gl-motion]')?.getAttribute('data-gl-motion');
  return m && m in motions ? (m as MotionName) : defaultMotion;
}
/** The motion in effect for `el`: its personality, or the reduced motion when motion is reduced there. */
export const motionFor = (el?: Element | null): Motion => (prefersReducedMotion(el) ? reducedMotion : motions[motionOf(el)]);

const params = (s: SpringName | SpringParams, el?: Element | null): SpringParams => (typeof s === 'string' ? motionFor(el)[s] : s);

/** Whether motion should be reduced for `el`: the nearest [data-gl-reduce-motion] decides ("true" / "false",
    set by ThemeProvider or reduceMotionScope), otherwise the system setting (prefers-reduced-motion). */
export function prefersReducedMotion(el?: Element | null): boolean {
  const scope = el?.closest?.('[data-gl-reduce-motion]') ?? (typeof document !== 'undefined' ? document.querySelector('[data-gl-reduce-motion]') : null);
  const forced = scope?.getAttribute('data-gl-reduce-motion');
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return systemReduced();
}
let mq: MediaQueryList | null = null;
const systemReduced = () => {
  if (typeof matchMedia !== 'function') return false;
  mq ??= matchMedia('(prefers-reduced-motion: reduce)');
  return mq.matches;
};

/** A damped spring integrated in fixed 4 ms steps (stable at any frame rate). For finger-driven motion. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  private k: number;
  private c: number;
  constructor(value: number, spring: SpringName | SpringParams = 'smooth', el?: Element | null) {
    this.value = this.target = value;
    const p = params(spring, el);
    const w = (2 * Math.PI) / p.response;
    this.k = w * w;
    this.c = 2 * p.damping * w;
  }
  /** change the spring; a name resolves against the personality of `el` (if given) */
  set(spring: SpringName | SpringParams, el?: Element | null) {
    const p = params(spring, el), w = (2 * Math.PI) / p.response;
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
export function springTiming(s: SpringName | SpringParams, el?: Element | null): SpringTiming {
  const p = params(s, el), key = `${p.response}/${p.damping}`;
  let t = cache.get(key);
  if (!t) { t = { duration: springDuration(p), easing: springEasing(p) }; cache.set(key, t); }
  return t;   /* reduced motion arrives here as the short, non-bouncing reducedMotion springs (see motionFor) */
}

/** element.animate with a spring; resolves when finished (or immediately if cancelled). */
export function animate(el: Element, keyframes: Keyframe[], spring: SpringName | SpringParams, extra: KeyframeAnimationOptions = {}): Animation {
  return el.animate(keyframes, { fill: 'both', ...springTiming(spring, el), ...extra });
}
