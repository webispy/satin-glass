/* Strips with more items than fit (segmented controls, tab bars): items keep a readable minimum width and the
   track scrolls sideways instead of squeezing every label to "…". The ends fade where more items wait
   (data-sg-more-start / data-sg-more-end, toggled by an IntersectionObserver — no layout reads while scrolling),
   and when the selection changes the selected item is brought fully into view, clear of the fade.
   The droplet-bridge indicator lives inside the scrolled content, so it travels with the items for free. */
import { prefersReducedMotion } from './motion';

export type OverflowStrip = {
  /** Scrolls the strip (not the page) so `el` is fully visible, clear of the edge fade. One layout read per call. */
  reveal(el: HTMLElement | null | undefined, animate?: boolean): void;
  /** Re-attaches the edge watchers when the first or last item changed. Cheap; no layout reads. */
  refresh(): void;
  destroy(): void;
};

/* ---------------------------------------------------------------- gliding
   A mouse cannot fling a strip and a wheel notch jumps it, where touch and trackpads glide natively. glide() gives a
   strip the same feel by hand: a fling coasts on from the release speed and slows down (decay per ms, like a native
   scroller), a wheel notch eases to where the notches add up. Either stops at the end it reaches (no bounce) and at
   the next press. Positions are logical (0 → max toward the end), so right to left works the same. Reduced motion:
   no coasting, notches jump. */
export type Glide = { fling(velocity: number): void; by(delta: number): void; stop(): void; /** where it is heading (logical px) */ aim(): number };
const glides = new WeakMap<HTMLElement, Glide>();
const DECAY = 0.997, EASE = 0.075;   /* per ms; s (a notch is mostly there in ~150 ms) */
export function glide(el: HTMLElement): Glide {
  let g = glides.get(el);
  if (g) return g;
  /* the position is kept here, not read back each frame: the browser rounds scrollLeft, and the last sub-pixel steps
     of an ease would never arrive */
  let raf = 0, v = 0, target: number | null = null, last = 0, cur = 0, wrote = 0;
  const dir = () => (getComputedStyle(el).direction === 'rtl' ? -1 : 1);
  const max = () => Math.max(0, el.scrollWidth - el.clientWidth);
  const pos = () => el.scrollLeft * dir();
  const put = (x: number) => { el.scrollLeft = Math.max(0, Math.min(max(), x)) * dir(); wrote = pos(); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; v = 0; target = null; };
  const tick = (t: number) => {
    const dt = Math.min(48, t - last); last = t;
    /* something else moved the strip (a trackpad, a finger, a reveal): it gives way at once */
    if (Math.abs(pos() - wrote) > 2) { stop(); return; }
    const m = max();
    if (target !== null) {
      cur += (target - cur) * (1 - Math.exp(-dt / 1000 / EASE));
      if (Math.abs(target - cur) < 0.5) { put(target); stop(); return; }
    } else {
      cur = Math.max(0, Math.min(m, cur + v * dt / 1000));
      v *= Math.pow(DECAY, dt);
      if (Math.abs(v) < 12 || cur <= 0 || cur >= m) { put(cur); stop(); return; }
    }
    put(cur);
    raf = requestAnimationFrame(tick);
  };
  const run = () => { if (!raf) { cur = wrote = pos(); last = performance.now(); raf = requestAnimationFrame(tick); } };
  g = {
    fling(velocity) {
      stop();
      if (prefersReducedMotion(el) || Math.abs(velocity) < 60) return;
      v = Math.max(-6000, Math.min(6000, velocity)); run();
    },
    by(delta) {
      if (prefersReducedMotion(el)) { stop(); put(pos() + delta); return; }
      v = 0; target = Math.max(0, Math.min(max(), (target ?? pos()) + delta)); run();
    },
    stop,
    aim: () => target ?? pos(),
  };
  glides.set(el, g);
  return g;
}

/* wheel latching, as browsers do for nested scrollers: one wheel gesture (events less than LATCH ms apart, notches or
   a trackpad's coasting) belongs to whatever it started on. A gesture that started on the strip stays there even at
   its end (it stops; a fresh turn after a pause scrolls the page); one that started on the page keeps scrolling the
   page when the strip passes under the pointer. Every wheel event anywhere is timed, so a gesture is known to have
   started on the page even before it reaches a strip. Gestures are numbered: what a strip decided belongs to one
   gesture only, so a later gesture that reaches the strip mid-way (the page's) is not taken by an owner left over
   from an earlier one. */
const LATCH = 300;
let wheelPrev = -1e9, wheelLast = -1e9, gesture = 0;
if (typeof addEventListener === 'function') addEventListener('wheel', (e) => { if (e.timeStamp - wheelLast > LATCH) gesture++; wheelPrev = wheelLast; wheelLast = e.timeStamp; }, { capture: true, passive: true });

/** Room kept between a revealed item and the strip's edge (≥ the CSS edge fade, 24 px). */
const EDGE = 32;

export function createOverflowStrip(scroller: HTMLElement, items: () => HTMLElement[]): OverflowStrip {
  let io: IntersectionObserver | null = null, first: HTMLElement | null = null, last: HTMLElement | null = null;
  /* a reveal asked for before the strip could overflow (e.g. on mount, before the stylesheet applied) waits for
     the first geometry change the observer reports */
  let pending: HTMLElement | null = null;
  /* which way the fades run: the strip's own computed direction (CSS `direction` included, and a nearer dir="ltr"
     inside a right-to-left page). Read when the fades change, when the first or last item changes and when one is
     revealed, not on every refresh (it reads styles); a direction changed with none of those keeps the old fades
     until then */
  const markDir = () => scroller.toggleAttribute('data-sg-rtl', getComputedStyle(scroller).direction === 'rtl');
  const watch = () => {
    const list = items(), f = list[0] ?? null, l = list[list.length - 1] ?? null;
    if (f === first && l === last) return;
    markDir();
    io?.disconnect(); first = f; last = l;
    scroller.removeAttribute('data-sg-more-start'); scroller.removeAttribute('data-sg-more-end');
    if (!f || !l || typeof IntersectionObserver === 'undefined') return;
    const obs: IntersectionObserver = io = new IntersectionObserver((entries) => {
      /* entries queued before this observer was replaced or the strip destroyed are not this strip's any more */
      if (io !== obs) return;
      for (const e of entries) {
        const hidden = e.intersectionRatio < 0.98;
        markDir();
        if (e.target === first) scroller.toggleAttribute('data-sg-more-start', hidden);
        if (e.target === last) scroller.toggleAttribute('data-sg-more-end', hidden);
      }
      if (pending) strip.reveal(pending, false);
    }, { root: scroller, threshold: [0, 0.98, 1] });
    obs.observe(f); if (l !== f) obs.observe(l);
  };

  const strip: OverflowStrip = {
    reveal(el, animate = true) {
      glide(scroller).stop();
      pending = el ?? null;
      if (!el) return;
      const vw = scroller.clientWidth, sw = scroller.scrollWidth;
      if (sw <= vw + 1) return;
      pending = null;
      /* physical, in the scroller's own scrolled frame (whatever the item's offsetParent): the view's left edge is
         scrollLeft, and the item's edges are measured from the same origin. Right to left, scrollLeft runs from 0
         (the start, at the right) down to -(scrollWidth - width). The rects are on screen, after any transform of
         an ancestor (a strip in a sheet scaling in); scrollLeft and the widths are layout px: the rects are divided
         by the strip's scale */
      const vl = scroller.scrollLeft, box = scroller.getBoundingClientRect(), at = el.getBoundingClientRect();
      const k = scroller.offsetWidth ? box.width / scroller.offsetWidth || 1 : 1;
      const l = (at.left - box.left) / k - scroller.clientLeft + vl, r = l + at.width / k;
      const edge = Math.min(EDGE, Math.max(0, (vw - (r - l)) / 2));
      let to = vl;
      if (l - edge < vl) to = l - edge;
      else if (r + edge > vl + vw) to = r + edge - vw;
      markDir();
      const [lo, hi] = scroller.hasAttribute('data-sg-rtl') ? [vw - sw, 0] : [0, sw - vw];
      to = Math.max(lo, Math.min(hi, Math.round(to)));
      if (Math.abs(to - vl) < 1) return;
      scroller.scrollTo({ left: to, behavior: animate && !prefersReducedMotion(scroller) ? 'smooth' : 'auto' });
    },
    refresh: watch,
    destroy() {
      io?.disconnect(); io = null; pending = null; scroller.removeEventListener('wheel', wheel); glide(scroller).stop();
      /* the edge fades go with the strip (Tabs switched to wrapping pills keeps the same list) */
      scroller.removeAttribute('data-sg-more-start'); scroller.removeAttribute('data-sg-more-end'); scroller.removeAttribute('data-sg-rtl');
    },
  };
  /* a mouse wheel (vertical only, no modifier) scrolls an overflowing strip sideways: down toward the end. It takes
     the event only while the strip can move that way, so at either end the next turn scrolls the page. Trackpads'
     horizontal and diagonal swipes, and Shift + wheel, stay the browser's */
  let owner: 'strip' | 'page' | null = null, ownerOf = -1;
  const wheel = (e: WheelEvent) => {
    /* a new gesture: nothing (anywhere) within LATCH before this event */
    const fresh = e.timeStamp - wheelPrev > LATCH;
    if (ownerOf !== gesture) { owner = null; ownerOf = gesture; }
    if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey || e.deltaX !== 0 || e.deltaY === 0 || scroller.hasAttribute('data-sg-panning')) { owner ??= 'page'; return; }
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 1) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroller.clientWidth : 1);
    /* where the strip is heading, not where it is (notches that already add up to the end) */
    const at = glide(scroller).aim();
    const can = !((dy > 0 && at >= max - 0.5) || (dy < 0 && at <= 0.5));
    /* the gesture's owner is settled by its first event here: the strip if it can move, else the page; a gesture
       already under way elsewhere (it reached this strip mid-way) stays the page's */
    if (owner === null) owner = fresh && can ? 'strip' : 'page';
    if (owner === 'page') return;
    e.preventDefault();   /* the strip's gesture: at the end it simply stops, the page does not take over mid-gesture */
    if (can) glide(scroller).by(dy);   /* eased, the notches adding up */
  };
  scroller.addEventListener('wheel', wheel, { passive: false });
  watch();
  return strip;
}
