import { prefersReducedMotion } from './motion';

/* Light-following glass: every registered glass surface carries a soft highlight that sits where the pointer is
   (or where the finger presses). One passive pointermove listener, rAF-batched, rects cached until scroll/resize.
   The highlight is moved with a transform on a composited pseudo-element, so moving it never repaints the glass. */

type Entry = { el: HTMLElement; rect: DOMRect | null };
const entries = new Set<Entry>();
const byEl = new WeakMap<HTMLElement, Entry>();
let px = -1e4, py = -1e4, pending = false, dirty = true, bound = false;

const REACH = 220; /* px outside the surface where the light still glows on its rim */

function frame() {
  pending = false;
  for (const e of entries) {
    /* reduced motion (forced by the theme, or the system): no light chasing the pointer */
    if (prefersReducedMotion(e.el)) { e.el.style.setProperty('--gl-hk', '0'); continue; }
    if (dirty || !e.rect) e.rect = e.el.getBoundingClientRect();
    const r = e.rect;
    const x = px - r.left, y = py - r.top;
    const dx = Math.max(r.left - px, 0, px - r.right), dy = Math.max(r.top - py, 0, py - r.bottom);
    const d = Math.hypot(dx, dy);
    const k = d >= REACH ? 0 : 1 - d / REACH;
    e.el.style.setProperty('--gl-hx', `${x.toFixed(1)}px`);
    e.el.style.setProperty('--gl-hy', `${y.toFixed(1)}px`);
    e.el.style.setProperty('--gl-hk', (k * k).toFixed(3));
  }
  dirty = false;
}
const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(frame); } };
const onMove = (ev: PointerEvent) => {
  if (ev.pointerType === 'touch' && ev.type === 'pointermove' && ev.buttons === 0) return;
  px = ev.clientX; py = ev.clientY; schedule();
};
const onLeave = () => { px = py = -1e4; schedule(); };
const invalidate = () => { dirty = true; };

function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', invalidate, { passive: true, capture: true });
  window.addEventListener('resize', invalidate, { passive: true });
}

/** Registers a glass element for the pointer light. Returns an unregister function. */
export function attachLight(el: HTMLElement): () => void {
  if (byEl.has(el)) return () => {};
  bind();
  const e: Entry = { el, rect: null };
  entries.add(e); byEl.set(el, e);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null;
  ro?.observe(el);
  return () => { entries.delete(e); byEl.delete(el); ro?.disconnect(); };
}

/** Call after layout changes that do not resize or scroll (e.g. an element moved by a transform). */
export const invalidateLight = invalidate;
