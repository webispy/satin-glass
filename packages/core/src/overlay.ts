/* Overlay helpers: anchored placement, the "bloom" open/close motion, focus management and a layer stack. */
import { animate, prefersReducedMotion, type SpringName } from './motion';
/* springs named here resolve against the panel's motion personality (nearest [data-gl-motion]) */

/* ---------------------------------------------------------------- placement */
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-${Align}`;
export type Placed = { x: number; y: number; side: Side; originX: number; originY: number };

export function place(size: { width: number; height: number }, anchor: DOMRect, placement: Placement = 'bottom-start', offset = 8, pad = 12): Placed {
  const vw = innerWidth, vh = innerHeight;
  let [side, align] = placement.split('-') as [Side, Align | undefined];
  align = align ?? 'center';
  const room: Record<Side, number> = { top: anchor.top - pad, bottom: vh - anchor.bottom - pad, left: anchor.left - pad, right: vw - anchor.right - pad };
  const need = side === 'top' || side === 'bottom' ? size.height + offset : size.width + offset;
  const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  if (room[side] < need && room[opposite[side]] > room[side]) side = opposite[side];
  let x: number, y: number;
  if (side === 'top' || side === 'bottom') {
    y = side === 'bottom' ? anchor.bottom + offset : anchor.top - offset - size.height;
    x = align === 'start' ? anchor.left : align === 'end' ? anchor.right - size.width : anchor.left + anchor.width / 2 - size.width / 2;
  } else {
    x = side === 'right' ? anchor.right + offset : anchor.left - offset - size.width;
    y = align === 'start' ? anchor.top : align === 'end' ? anchor.bottom - size.height : anchor.top + anchor.height / 2 - size.height / 2;
  }
  x = Math.min(Math.max(pad, x), vw - pad - size.width);
  y = Math.min(Math.max(pad, y), vh - pad - size.height);
  /* transform origin: the point of the panel closest to the anchor's centre, so it grows out of the anchor */
  const ax = anchor.left + anchor.width / 2, ay = anchor.top + anchor.height / 2;
  const originX = Math.min(Math.max(ax - x, 0), size.width), originY = Math.min(Math.max(ay - y, 0), size.height);
  return { x, y, side, originX, originY };
}

/* ---------------------------------------------------------------- bloom (compositor-only: transform + opacity) */
/** The panel grows out of its anchor (per-axis start scale: it unfolds away from the anchor) with an overshoot;
    its content settles a beat later. Cancels a running exit, so re-opening mid-close just turns around. */
export function bloomIn(panel: HTMLElement, origin: { x: number; y: number }, from: number | [number, number] = 0.55, spring: SpringName = 'bouncy'): Promise<void> {
  panel.getAnimations().forEach((a) => a.cancel());
  panel.style.transformOrigin = `${origin.x}px ${origin.y}px`;
  if (prefersReducedMotion(panel)) return fade(panel, 0, 1, 120);
  const [sx, sy] = typeof from === 'number' ? [from, from] : from;
  const a = animate(panel, [{ transform: `scale(${sx}, ${sy})` }, { transform: 'scale(1)' }], spring);
  const o = panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: spring === 'pop' ? 70 : 120, easing: 'linear', fill: 'both' });
  const content = panel.querySelector<HTMLElement>('[data-gl-content]');
  if (content) animate(content, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 'snappy', { delay: spring === 'pop' ? 25 : 40 });
  return Promise.all([a.finished, o.finished]).then(() => undefined, () => undefined);
}

/** Folds back toward the anchor: quick ease-in, gone in ~150 ms. */
export function bloomOut(panel: HTMLElement, to: number | [number, number] = 0.9, duration = 160): Promise<void> {
  if (prefersReducedMotion(panel)) return fade(panel, 1, 0, 100);
  panel.getAnimations().forEach((a) => a.cancel());
  const [sx, sy] = typeof to === 'number' ? [to, to] : to;
  const a = panel.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${sx}, ${sy})`, opacity: 0 }], { duration, easing: 'cubic-bezier(0.5, 0, 0.75, 0.25)', fill: 'both' });
  return a.finished.then(() => undefined, () => undefined);
}

function fade(el: HTMLElement, a: number, b: number, ms: number) {
  return el.animate([{ opacity: a }, { opacity: b }], { duration: ms, fill: 'both' }).finished.then(() => undefined, () => undefined);
}

/* ---------------------------------------------------------------- focus */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

/** Moves focus into `root` and keeps Tab inside it. Returns a release function that restores focus. */
export function trapFocus(root: HTMLElement, initial?: HTMLElement | null): () => void {
  const before = document.activeElement as HTMLElement | null;
  const first = initial ?? root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(root)[0] ?? root;
  if (first === root && !root.hasAttribute('tabindex')) root.tabIndex = -1;
  first.focus({ preventScroll: true });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    /* move focus ourselves: WebKit's default Tab skips buttons, which would let focus escape the trap */
    e.preventDefault();
    const list = focusables(root);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1);
    list[next].focus();
  };
  root.addEventListener('keydown', onKey);
  return () => {
    root.removeEventListener('keydown', onKey);
    if (before && document.contains(before) && (!document.activeElement || root.contains(document.activeElement) || document.activeElement === document.body)) before.focus({ preventScroll: true });
  };
}

/* ---------------------------------------------------------------- layer stack (Esc order, scroll lock) */
type Layer = { onEscape: () => void; modal: boolean };
const stack: Layer[] = [];
let locked = false, savedPad = '', savedOverflow = '';

function syncLock() {
  const need = stack.some((l) => l.modal);
  if (need === locked) return;
  locked = need;
  const b = document.body;
  if (need) {
    const sw = innerWidth - document.documentElement.clientWidth;
    savedPad = b.style.paddingRight; savedOverflow = b.style.overflow;
    b.style.overflow = 'hidden';
    if (sw > 0) b.style.paddingRight = `${sw}px`;
  } else {
    b.style.overflow = savedOverflow; b.style.paddingRight = savedPad;
  }
}
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].onEscape();
};

export function pushLayer(onEscape: () => void, modal: boolean): () => void {
  const layer = { onEscape, modal };
  if (!stack.length) document.addEventListener('keydown', onKeydown);
  stack.push(layer); syncLock();
  return () => {
    const i = stack.indexOf(layer);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onKeydown);
    syncLock();
  };
}
export const topLayerCount = () => stack.length;
