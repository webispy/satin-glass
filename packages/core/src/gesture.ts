/* Pointer helpers: drag with velocity (sliders, switches, sheets) and long press (context menus). */

export type DragInfo = { x: number; y: number; dx: number; dy: number; vx: number; vy: number; event: PointerEvent };
export type DragHandlers = {
  /** return false to ignore this pointer */
  start?: (info: DragInfo) => boolean | void;
  move?: (info: DragInfo) => void;
  end?: (info: DragInfo, cancelled: boolean) => void;
  /** px the pointer must travel before `move` fires (0 = immediately) */
  threshold?: number;
  axis?: 'x' | 'y' | 'both';
};

export function drag(el: HTMLElement, h: DragHandlers): () => void {
  let id: number | null = null, sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, vx = 0, vy = 0, active = false;
  const thr = h.threshold ?? 0;
  const info = (e: PointerEvent): DragInfo => ({ x: e.clientX, y: e.clientY, dx: e.clientX - sx, dy: e.clientY - sy, vx, vy, event: e });
  const capture = () => { try { if (id !== null) el.setPointerCapture(id); } catch { /* not supported */ } };
  /* window-level listeners for the life of one gesture: moves and the release are seen wherever the pointer is,
     captured or not, so a gesture can never be left half-finished */
  const listen = (on: boolean) => {
    const m = on ? addEventListener : removeEventListener;
    m('pointermove', move, true);
    m('pointerup', up, true);
    m('pointercancel', cancel, true);
  };
  const down = (e: PointerEvent) => {
    if (id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    sx = lx = e.clientX; sy = ly = e.clientY; lt = e.timeStamp; vx = vy = 0; active = thr === 0;
    if (h.start?.(info(e)) === false) return;
    id = e.pointerId;
    listen(true);
    /* with a threshold, capture only once the drag is real: capturing on pointerdown would retarget the click
       away from buttons inside the handle (a sheet header's Cancel/Done, a toast's action, page dots) */
    if (active) capture();
  };
  function move(e: PointerEvent) {
    if (e.pointerId !== id) return;
    const dt = Math.max(1, e.timeStamp - lt);
    vx = 0.6 * vx + 0.4 * ((e.clientX - lx) / dt) * 1000;
    vy = 0.6 * vy + 0.4 * ((e.clientY - ly) / dt) * 1000;
    lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
    if (!active) {
      const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
      const d = h.axis === 'x' ? dx : h.axis === 'y' ? dy : Math.hypot(dx, dy);
      if (d < thr) return;
      /* a vertical scroll is not a horizontal drag (and vice versa) */
      if ((h.axis === 'x' && dy > dx) || (h.axis === 'y' && dx > dy)) { finish(e, true); return; }
      active = true;
      capture();
    }
    h.move?.(info(e));
  }
  function finish(e: PointerEvent, cancelled: boolean) {
    if (e.pointerId !== id) return;
    const pid = id, wasActive = active;
    id = null; active = false;
    listen(false);
    try { if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid); } catch { /* released */ }
    /* a release after a pause carries no fling */
    if (e.timeStamp - lt > 80) { vx = 0; vy = 0; }
    if (wasActive) h.end?.(info(e), cancelled);
  }
  function up(e: PointerEvent) { finish(e, false); }
  function cancel(e: PointerEvent) { finish(e, true); }
  /* the browser can drop the capture (window lost focus, element removed…): end the gesture there. Only our own
     capture counts: on touch the browser first captures the pointer to the element under the finger (a sheet's
     grabber inside its drag handle); moving that capture to the handle fires lostpointercapture on the grabber,
     which bubbles up here — taking it for the end of the gesture stopped every touch drag the moment it began */
  const lost = (e: PointerEvent) => { if (e.target === el && e.pointerId === id && active) finish(e, true); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('lostpointercapture', lost);
  /* taken down mid-gesture: the listeners go and the pointer is let go; the gesture is not ended (no `end`): the caller
     decides what a drag cut short leaves behind */
  return () => {
    listen(false);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('lostpointercapture', lost);
    if (id !== null) { const pid = id; id = null; active = false; try { if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid); } catch { /* released */ } }
  };
}

/** Fires `fire` after the pointer rests `ms` without moving more than `slop` px. Suppresses the click that follows. */
export function longPress(el: HTMLElement, fire: (e: PointerEvent) => void, ms = 420, slop = 8): () => void {
  let t = 0, sx = 0, sy = 0, fired = false;
  const clear = () => { clearTimeout(t); el.classList.remove('is-holding'); };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fired = false; sx = e.clientX; sy = e.clientY;
    el.classList.add('is-holding');
    t = window.setTimeout(() => { fired = true; el.classList.remove('is-holding'); fire(e); }, ms);
  };
  const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > slop) clear(); };
  const click = (e: MouseEvent) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } };
  const ctx = (e: MouseEvent) => { if (fired) e.preventDefault(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointercancel', clear);
  el.addEventListener('pointerleave', clear);
  el.addEventListener('click', click, true);
  el.addEventListener('contextmenu', ctx);
  return () => {
    clear();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', clear);
    el.removeEventListener('pointercancel', clear);
    el.removeEventListener('pointerleave', clear);
    el.removeEventListener('click', click, true);
    el.removeEventListener('contextmenu', ctx);
  };
}
