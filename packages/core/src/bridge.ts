/* "Droplet bridge" selection indicator (tab bars, segmented controls).
   The indicator never floats above the bar: when the selection moves, its leading edge springs ahead and its
   trailing edge follows, so it stretches across the gap like a drop of water and pulls itself together at the
   new item. While dragged it follows the finger inside the bar, stretched toward the direction of travel.
   Only the indicator (a plain fill, no backdrop filter) is touched per frame, inside a contained container.
   Gesture state goes on data attributes (not classes) so a framework re-render never strips it mid-gesture. */
import { Spring, loop, motionFor } from './motion';

export type BridgeOptions = {
  items: () => HTMLElement[];
  /** Called when a drag ends over an item. Taps are left to the items' own click handlers. */
  onDragCommit?: (index: number) => void;
  /** Called while dragging with the item under the indicator (for highlighting). */
  onHover?: (index: number) => void;
  draggable?: boolean;
};

export type Bridge = {
  moveTo(index: number, animate?: boolean): void;
  refresh(): void;
  destroy(): void;
};

export function createBridge(container: HTMLElement, indicator: HTMLElement, opts: BridgeOptions): Bridge {
  const left = new Spring(0, 'snappy', container), right = new Spring(0, 'snappy', container);
  /* squash & stretch from the motion personality, re-read whenever a move starts (personalities can change live) */
  let squash = motionFor(container).squash;
  let current = -1, stop: (() => void) | null = null, hover = -1;
  let dragging = false, pressed = false, pid: number | null = null, startX = 0, grab = 0, lastX = 0, vx = 0, lastT = 0, swallow = false;

  const geom = (i: number) => {
    const el = opts.items()[i];
    return el ? { l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth, w: el.offsetWidth } : null;
  };
  /* inner bounds of the track: an overshoot past the first/last item is stopped by the wall and squeezes the drop */
  let lo = 0, hi = Infinity;
  const bounds = () => {
    const items = opts.items();
    if (!items.length) return;
    lo = items[0].offsetLeft; hi = items[items.length - 1].offsetLeft + items[items.length - 1].offsetWidth;
  };
  /* the width of the selected item, measured when a move starts — never per frame: reading layout every frame
     would force a synchronous layout whenever something else changes the page mid-animation (a tab switch mounting
     a whole panel) */
  let baseW = 0;
  const render = () => {
    const l = Math.min(hi, Math.max(lo, left.value)), r = Math.max(lo, Math.min(hi, right.value));
    const w = Math.max(0, r - l);
    const base = baseW || w || 1;
    const stretch = Math.max(0, w / base - 1);
    /* the drop flattens as it stretches (volume-ish), and springs back round as it pulls together */
    const sy = 1 - squash * Math.min(1, stretch * 1.4);
    indicator.style.transform = `translate3d(${l.toFixed(2)}px,0,0)${sy < 0.999 ? ` scaleY(${sy.toFixed(3)})` : ''}`;
    indicator.style.width = `${w.toFixed(2)}px`;
    container.style.setProperty('--sg-stretch', stretch.toFixed(3));
  };
  const run = () => {
    if (stop) return;
    stop = loop((dt) => {
      left.step(dt); right.step(dt); render();
      if (!dragging && left.settled && right.settled) {
        left.jump(left.target); right.jump(right.target); render(); stop = null; return false;
      }
    });
  };
  /* leading edge snappy, trailing edge smooth → the drop stretches toward where it is going */
  const lead = (dir: number) => {
    squash = motionFor(container).squash;
    if (dir > 0) { right.set('snappy', container); left.set('smooth', container); }
    else if (dir < 0) { left.set('snappy', container); right.set('smooth', container); }
  };

  function moveTo(index: number, animate = true) {
    const g = geom(index);
    if (!g) return;
    bounds();
    const first = current < 0 || !indicator.style.width;
    current = index; baseW = g.w;
    if (first || !animate) { left.jump(g.l); right.jump(g.r); render(); return; }
    lead(Math.sign(g.l - left.target));
    left.target = g.l; right.target = g.r;
    run();
  }

  /* the item under x (distance to its span, 0 inside): right for items of unequal width too, where the nearest
     centre can belong to a neighbour */
  const indexAt = (x: number) => {
    let best = -1, d = Infinity;
    opts.items().forEach((el, i) => {
      const l = el.offsetLeft, r = l + el.offsetWidth, dd = x < l ? l - x : x > r ? x - r : 0;
      if (dd < d) { d = dd; best = i; }
    });
    return best;
  };
  /* in the items' (content) coordinates: + scrollLeft, for a track that scrolls sideways (core/overflow.ts) */
  const localX = (ev: PointerEvent) => ev.clientX - container.getBoundingClientRect().left - container.clientLeft + container.scrollLeft;

  const onDown = (ev: PointerEvent) => {
    if (!opts.draggable || ev.button !== 0) return;
    const item = (ev.target as HTMLElement).closest('[data-sg-item]') as HTMLElement | null;
    if (!item || !container.contains(item)) return;
    pressed = true; dragging = false; pid = ev.pointerId; bounds();
    startX = lastX = localX(ev); lastT = performance.now(); vx = 0;
    const g = geom(current);
    grab = g ? startX - (g.l + g.r) / 2 : 0;
    container.toggleAttribute('data-sg-pressing', true);
  };
  const onMove = (ev: PointerEvent) => {
    if (!pressed || ev.pointerId !== pid) return;
    const x = localX(ev), now = performance.now();
    if (!dragging) {
      if (Math.abs(x - startX) < 6) return;
      const g = geom(current);
      /* drag starts from wherever the finger is: grabbing the selection keeps the offset, elsewhere centres on it */
      if (!g || startX < g.l || startX > g.r) grab = 0;
      dragging = true; container.toggleAttribute('data-sg-dragging', true);
      try { container.setPointerCapture(pid!); } catch { /* not supported */ }
    }
    const dt = Math.max(1, now - lastT);
    vx = 0.7 * vx + 0.3 * ((x - lastX) / dt) * 1000; lastX = x; lastT = now;
    const items = opts.items(), first = geom(0)!, last = geom(items.length - 1)!;
    const w = geom(current)?.w ?? first.w;
    const c = Math.min(last.r - w / 2, Math.max(first.l + w / 2, x - grab));
    lead(Math.sign(vx));
    left.target = c - w / 2; right.target = c + w / 2;
    const i = indexAt(c);
    if (i !== hover) { hover = i; opts.onHover?.(i); }
    run();
  };
  const finish = (commit: boolean) => {
    if (!pressed) return;
    pressed = false;
    container.removeAttribute('data-sg-pressing'); container.removeAttribute('data-sg-dragging');
    try { if (pid !== null && container.hasPointerCapture(pid)) container.releasePointerCapture(pid); } catch { /* released */ }
    pid = null;
    if (!dragging) return;
    dragging = false;
    swallow = true; setTimeout(() => { swallow = false; }, 0);
    const i = indexAt((left.target + right.target) / 2);
    hover = -1; opts.onHover?.(-1);
    if (commit && i >= 0 && i !== current) opts.onDragCommit?.(i);
    else moveTo(current);
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);
  const onClick = (ev: MouseEvent) => { if (swallow) { ev.stopPropagation(); ev.preventDefault(); } };

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onCancel);
  /* only the container's own capture ending counts: on touch the item under the finger holds the pointer first, and
     handing it to the container fires lostpointercapture on that item — it bubbles here and would end the drag at once */
  const onLost = (ev: PointerEvent) => { if (ev.target === container) onUp(); };
  container.addEventListener('lostpointercapture', onLost);
  container.addEventListener('click', onClick, true);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (current >= 0) moveTo(current, false); }) : null;
  ro?.observe(container);

  return {
    moveTo,
    refresh: () => { if (current >= 0) moveTo(current, false); },
    destroy() {
      stop?.(); ro?.disconnect();
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onCancel);
      container.removeEventListener('lostpointercapture', onLost);
      container.removeEventListener('click', onClick, true);
    },
  };
}
