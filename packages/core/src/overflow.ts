/* Strips with more items than fit (segmented controls, tab bars): items keep a readable minimum width and the
   track scrolls sideways instead of squeezing every label to "…". The ends fade where more items wait
   (data-gl-more-start / data-gl-more-end, toggled by an IntersectionObserver — no layout reads while scrolling),
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

/** Room kept between a revealed item and the strip's edge (≥ the CSS edge fade, 24 px). */
const EDGE = 32;

export function createOverflowStrip(scroller: HTMLElement, items: () => HTMLElement[]): OverflowStrip {
  let io: IntersectionObserver | null = null, first: HTMLElement | null = null, last: HTMLElement | null = null;
  /* a reveal asked for before the strip could overflow (e.g. on mount, before the stylesheet applied) waits for
     the first geometry change the observer reports */
  let pending: HTMLElement | null = null;
  const watch = () => {
    const list = items(), f = list[0] ?? null, l = list[list.length - 1] ?? null;
    if (f === first && l === last) return;
    io?.disconnect(); first = f; last = l;
    scroller.removeAttribute('data-gl-more-start'); scroller.removeAttribute('data-gl-more-end');
    if (!f || !l || typeof IntersectionObserver === 'undefined') return;
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const hidden = e.intersectionRatio < 0.98;
        if (e.target === first) scroller.toggleAttribute('data-gl-more-start', hidden);
        if (e.target === last) scroller.toggleAttribute('data-gl-more-end', hidden);
      }
      if (pending) strip.reveal(pending, false);
    }, { root: scroller, threshold: [0, 0.98, 1] });
    io.observe(f); if (l !== f) io.observe(l);
  };

  const strip: OverflowStrip = {
    reveal(el, animate = true) {
      pending = el ?? null;
      if (!el) return;
      const vw = scroller.clientWidth, sw = scroller.scrollWidth;
      if (sw <= vw + 1) return;
      pending = null;
      const vl = scroller.scrollLeft, l = el.offsetLeft, r = l + el.offsetWidth;
      const edge = Math.min(EDGE, Math.max(0, (vw - (r - l)) / 2));
      let to = vl;
      if (l - edge < vl) to = l - edge;
      else if (r + edge > vl + vw) to = r + edge - vw;
      to = Math.max(0, Math.min(sw - vw, Math.round(to)));
      if (Math.abs(to - vl) < 1) return;
      scroller.scrollTo({ left: to, behavior: animate && !prefersReducedMotion(scroller) ? 'smooth' : 'auto' });
    },
    refresh: watch,
    destroy() { io?.disconnect(); io = null; pending = null; },
  };
  watch();
  return strip;
}
