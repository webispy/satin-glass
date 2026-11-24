import { duration } from '@satin-glass/tokens';
import { prefersReducedMotion } from './motion';

/* Light-following glass: every registered glass surface carries a soft highlight that sits where the pointer is
   (or where the finger presses). One passive pointermove listener, rAF-batched, rects cached until scroll/resize.
   The highlight is moved with a transform on a composited pseudo-element, so moving it never repaints the glass.

   Per frame the work is kept to what changes: --sg-hx/-hy/-hk are registered (@property, not inherited, so a write
   restyles the glass and its sheen, not its whole subtree); all rects are read before anything is written (no forced
   layout per surface); a surface out of the light's reach is written when its sheen goes out and while it fades,
   then left alone; nested glass (whose sheen the CSS hides) and surfaces under reduced motion are skipped. Which
   surfaces have a light is decided again only when glass is added, removed or moved, the tree inside a surface, a
   glass class, the app bar's state or the reduced-motion setting changes, or after a scroll or resize. [data-sg-lit] marks a sheen that shows or is fading, so only those
   keep a compositing layer (foundation.css). With no surface left, nothing listens. */

type Entry = {
  el: HTMLElement;
  rect: DOMRect | null;
  /** the `epoch` in which `off` was decided */
  epoch: number;
  /** no light here: nested glass (its sheen is hidden) or reduced motion */
  off: boolean;
  /** nested glass that holds no slider bubble: its values are never written */
  hidden: boolean;
  /** the values last written ('' until then) */
  k: string; x: string; y: string;
  /** this frame's values */
  nk: string; nx: string; ny: string;
  /** the position as of the last pointer event (what every frame once wrote on every surface), for a key press */
  mx: string; my: string;
  /** held down from the keyboard while its sheen is out of the light's reach (it shows on press, foundation.css) */
  held: boolean;
  /** whether the sheen showed in the last frame; when it went out, and how long it fades (the theme's
      --sg-duration-slow, read in the frame the fade starts) */
  shown: boolean;
  zeroAt: number;
  fade: number;
  lit: boolean;
};
const entries = new Set<Entry>();
const byEl = new WeakMap<HTMLElement, Entry>();
let raf = 0, px = -1e4, py = -1e4, pending = false, dirty = true, bound = false, epoch = 0, moved = false;
/* the element a finger pressed (a touch keeps its target while it moves, even off it): only the glass holding it is lit */
let touched: Element | null = null;
let wake: ReturnType<typeof setTimeout> | null = null;
let mo: MutationObserver | null = null, mq: MediaQueryList | null = null;

const REACH = 220; /* px outside the surface where the light still glows on its rim */
const ZERO = (0).toFixed(3);
const BUBBLE = '.sg-slider__bubble';
const GLASS = `.sg-glass, ${BUBBLE}`;

/* mirrors foundation.css: `.sg-glass:not(:where(.sg-appbar[data-transparent-top][data-at-top]) > *)
   .sg-glass:not(.sg-slider__bubble)::after { display: none }` */
function nested(el: HTMLElement): boolean {
  if (!el.classList.contains('sg-glass') || el.classList.contains('sg-slider__bubble')) return false;
  for (let a = el.parentElement?.closest('.sg-glass'); a; a = a.parentElement?.closest('.sg-glass')) {
    if (!a.parentElement?.matches('.sg-appbar[data-transparent-top][data-at-top]')) return true;
  }
  return false;
}
/* the sheen fades over the theme's --sg-duration-slow (foundation.css), which a theme may change */
function fadeOf(el: HTMLElement): number {
  const v = getComputedStyle(el).getPropertyValue('--sg-duration-slow').trim();
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(v);
  return m ? parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : duration.slow;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function frame() {
  pending = false;
  const t = now();
  /* a frame after a pointer event: the position every frame used to write on every surface */
  const pointer = moved; moved = false;
  /* read everything first … */
  for (const e of entries) {
    if (e.epoch !== epoch || dirty) {
      e.epoch = epoch;
      /* nested glass hides its own sheen, but a slider's value bubble inside it takes the values it is given
         (controls.css); reduced motion (forced by the theme, or the system): no light chasing the pointer */
      e.hidden = nested(e.el) && !e.el.querySelector(BUBBLE);
      e.off = e.hidden || prefersReducedMotion(e.el);
      if (e.off) e.rect = null;
    }
    if (!e.off && (dirty || !e.rect)) e.rect = e.el.getBoundingClientRect();
    let k = 0, x = 0, y = 0;
    const r = e.rect;
    if (!e.off && r) {
      x = px - r.left; y = py - r.top;
      const dx = Math.max(r.left - px, 0, px - r.right), dy = Math.max(r.top - py, 0, py - r.bottom);
      const d = Math.hypot(dx, dy);
      /* a finger lights only the glass it pressed, fully, wherever the finger goes until it lifts (design-language.md
         8: with no pointer, as for touch, there is no sheen; a press gathers light under the finger). Lit by reach, a
         tap on anything else lit every glass within 220 px, the floating bar above it among them, making and dropping
         its sheen's layer on every tap, which iOS Safari shows as the glass flashing. The pressed element decides,
         not the rect: a glass that shrinks as it is pressed, or a glass behind an overlay, is judged rightly */
      k = touched ? (e.el.contains(touched) ? 1 : 0) : d >= REACH ? 0 : 1 - d / REACH;
    }
    e.nk = (k * k).toFixed(3); e.nx = `${x.toFixed(1)}px`; e.ny = `${y.toFixed(1)}px`;
    if (pointer && !e.off) { e.mx = e.nx; e.my = e.ny; }
    const shown = !e.off && (e.nk !== ZERO || e.held);
    /* the sheen goes out: it fades over the length the theme gives now */
    if (e.shown && !shown) { e.zeroAt = t; e.fade = fadeOf(e.el); }
    e.shown = shown;
  }
  dirty = false;
  /* … then write, and only what changed */
  let next = Infinity;
  for (const e of entries) {
    const ks = e.nk;
    const fading = !e.shown && t - e.zeroAt < e.fade;
    /* the sheen follows the pointer while it shows and while it fades out, as before (measured again, so a card
       that moves under a still pointer leaves the glow with the pointer); held from the keyboard out of the light's
       reach, it sits where the last pointer event put it, and with no pointer event yet, far off as the pointer is */
    if (!e.off && (e.shown || fading)) {
      const far = e.held && ks === ZERO && e.mx !== '';
      const x = far ? e.mx : e.nx, y = far ? e.my : e.ny;
      if (x !== e.x) { e.el.style.setProperty('--sg-hx', x); e.x = x; }
      if (y !== e.y) { e.el.style.setProperty('--sg-hy', y); e.y = y; }
    }
    /* written once even when it starts dark, so a registered glass never takes its outer glass's value
       (controls.css passes the values down to a slider's bubble); hidden nested glass is never written */
    if (ks !== e.k && !(e.hidden && e.k === '')) { e.el.style.setProperty('--sg-hk', ks); e.k = ks; }
    if (e.shown || fading) {
      if (!e.lit) { e.el.setAttribute('data-sg-lit', ''); e.lit = true; }
      if (fading) next = Math.min(next, e.zeroAt + e.fade);
    } else if (e.lit) { e.el.removeAttribute('data-sg-lit'); e.lit = false; }
  }
  /* one more frame once the last fade is over, to let its layer go */
  if (wake) { clearTimeout(wake); wake = null; }
  if (next < Infinity) wake = setTimeout(() => { wake = null; schedule(); }, Math.ceil(next - t) + 1);
}
const schedule = () => { if (bound && !pending) { pending = true; raf = requestAnimationFrame(frame); } };
const onMove = (ev: PointerEvent) => {
  if (ev.pointerType === 'touch' && ev.type === 'pointermove' && ev.buttons === 0) return;
  px = ev.clientX; py = ev.clientY; moved = true;
  touched = ev.pointerType === 'touch' && ev.target instanceof Element ? ev.target : null;
  /* a press measures again: the layout may have moved the glass since it was last measured */
  if (touched && ev.type === 'pointerdown') dirty = true;
  schedule();
};
const onLeave = () => { px = py = -1e4; touched = null; moved = true; schedule(); };
/* A key press (Space) shows the sheen of a pressable glass at full strength (foundation.css), where its values put
   it. Every frame used to write every surface's position, so it showed where the pointer is (often far off, or
   nowhere when the pointer had left the window); a surface the light has not reached since then is given that
   position for as long as the key is held. Before any pointer event it is given the far position the pointer starts
   at, so a keyboard-only press shows no glow (the registered initial would put it on the top edge). */
const PRESS = new Set([' ', 'Enter']);
const onKeyDown = (ev: KeyboardEvent) => {
  if (!PRESS.has(ev.key)) return;
  for (let n = ev.target instanceof Element ? ev.target : null; n; n = n.parentElement) {
    const e = byEl.get(n as HTMLElement);
    if (e && !e.held && n.classList.contains('sg-pressable')) { e.held = true; schedule(); }
  }
};
const release = () => { for (const e of entries) if (e.held) { e.held = false; schedule(); } };
const onKeyUp = (ev: KeyboardEvent) => { if (PRESS.has(ev.key)) release(); };
/* a scroll or resize moves the surfaces under a pointer that may be still: one that shows the sheen is measured
   again in a frame (it fades out, or follows), the others only when the pointer next moves */
const invalidate = () => { dirty = true; for (const e of entries) if (e.lit) { schedule(); return; } };
/* which surfaces have a light may have changed: decide again, now, for a pointer that is not moving too */
const reconsider = () => { epoch++; schedule(); };
const RELEVANT = /\bsg-(glass|slider__bubble|appbar)\b/;
const holdsGlass = (n: Node) => n.nodeType === 1 && ((n as Element).matches(GLASS) || (n as Element).querySelector(GLASS) !== null);
const inSurface = (n: Node) => {
  for (let a: Node | null = n; a; a = a.parentNode) if (byEl.has(a as HTMLElement)) return true;
  return false;
};
const some = (list: NodeList, f: (n: Node) => boolean) => { for (let i = 0; i < list.length; i++) if (f(list[i])) return true; return false; };
const onMutate = (records: MutationRecord[]) => {
  for (const r of records) {
    /* glass (or a slider's bubble) added, removed or moved, or the tree inside a surface changed; a glass class
       turned on or off; the app bar's state; the theme's reduced motion. Nodes coming and going elsewhere (a log,
       a virtual table, a chart) do not change which surfaces have a light. */
    if (r.type === 'childList'
      ? some(r.addedNodes, holdsGlass) || some(r.removedNodes, holdsGlass) || inSurface(r.target)
      : r.attributeName !== 'class'
        || RELEVANT.test(`${(r.target as Element).getAttribute('class') ?? ''} ${r.oldValue ?? ''}`)) { reconsider(); return; }
  }
};

function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', invalidate, { passive: true, capture: true });
  window.addEventListener('resize', invalidate, { passive: true });
  window.addEventListener('keydown', onKeyDown, { passive: true, capture: true });
  window.addEventListener('keyup', onKeyUp, { passive: true, capture: true });
  window.addEventListener('blur', release);
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(onMutate);
    mo.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, attributeOldValue: true,
      attributeFilter: ['class', 'data-sg-reduce-motion', 'data-at-top', 'data-transparent-top'],
    });
  }
  if (typeof matchMedia === 'function') {
    mq = matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', reconsider);
  }
}
function unbind() {
  if (!bound) return;
  bound = false;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerdown', onMove);
  document.documentElement.removeEventListener('pointerleave', onLeave);
  window.removeEventListener('scroll', invalidate, { capture: true });
  window.removeEventListener('resize', invalidate);
  window.removeEventListener('keydown', onKeyDown, { capture: true });
  window.removeEventListener('keyup', onKeyUp, { capture: true });
  window.removeEventListener('blur', release);
  mo?.disconnect(); mo = null;
  mq?.removeEventListener?.('change', reconsider); mq = null;
  if (wake) { clearTimeout(wake); wake = null; }
  if (pending) { cancelAnimationFrame(raf); pending = false; }
  px = py = -1e4; moved = false; touched = null; dirty = true; epoch++;
}

/** Registers a glass element for the pointer light. Returns an unregister function. */
export function attachLight(el: HTMLElement): () => void {
  if (byEl.has(el)) return () => {};
  bind();
  const e: Entry = {
    el, rect: null, epoch: -1, off: false, hidden: false, k: '', x: '', y: '', nk: ZERO, nx: '', ny: '', mx: '', my: '',
    held: false, shown: false, zeroAt: -Infinity, fade: duration.slow, lit: false,
  };
  entries.add(e); byEl.set(el, e);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null;
  ro?.observe(el);
  return () => {
    if (!entries.delete(e)) return;
    byEl.delete(el); ro?.disconnect();
    /* leave the element as it was before, so a later attach starts from the CSS initial values it assumes */
    el.style.removeProperty('--sg-hx'); el.style.removeProperty('--sg-hy'); el.style.removeProperty('--sg-hk');
    el.removeAttribute('data-sg-lit');
    if (!entries.size) unbind();
  };
}

/** Call after layout changes that do not resize or scroll (e.g. an element moved by a transform, or into another
    theme). */
export const invalidateLight = () => { invalidate(); reconsider(); };
