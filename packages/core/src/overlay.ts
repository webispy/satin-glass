/* Overlay helpers: anchored placement, the "bloom" open/close motion, focus management and a layer stack. */
import { animate, motionFor, prefersReducedMotion, type SpringName } from './motion';
/* springs named here resolve against the panel's motion personality (nearest [data-sg-motion]) */

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
/** Fixed timings, for what does not ride a spring: exits (they leave on a short ease-in and never bounce) and the
    reduced-motion fades that stand in for movement. Named here so every component shares them (design-language 3.). */
export const timing = {
  /** a reduced-motion stand-in appears in place */ appear: 140,
  /** and leaves */ leave: 110,
  /** an anchored panel folds back toward its anchor */ fold: 160,
  /** a sheet slides down off the screen */ sheetOut: 260,
  /** an action sheet, shorter, slides down */ actionSheetOut: 220,
  /** a toast lifts away */ toastOut: 200,
  /** the media viewer returns to its thumbnail */ mediaReturn: 260,
  /** a navigation page, reduced motion: appears / leaves (a whole screen, a little slower than a panel) */ pageIn: 180, pageOut: 160,
  /** a lifted preview settles back into the page */ liftReturn: 180,
  /** a picker closes this long after a choice, so the choice is seen landing */ closeAfterChoice: 260,
  /** the range band fades in after the month's slide */ bandIn: 200, bandInDelay: 120,
} as const;
/** the curves those exits use */
export const easing = {
  /** leaving: starts slow, accelerates away */ exit: 'cubic-bezier(0.4, 0, 1, 1)',
  /** folding into an anchor: sharper */ fold: 'cubic-bezier(0.5, 0, 0.75, 0.25)',
  /** a shape returning to a place on the page */ move: 'cubic-bezier(0.3, 0, 0.2, 1)',
  /** settling back without a spring */ settle: 'ease-out',
} as const;

/** The panel grows out of its anchor (per-axis start scale: it unfolds away from the anchor) with an overshoot;
    its content settles a beat later. Cancels a running exit, so re-opening mid-close just turns around. */
export function bloomIn(panel: HTMLElement, origin: { x: number; y: number }, from: number | [number, number] = 0.55, spring: SpringName = 'bouncy'): Promise<void> {
  panel.getAnimations().forEach((a) => a.cancel());
  panel.style.transformOrigin = `${origin.x}px ${origin.y}px`;
  if (prefersReducedMotion(panel)) return fade(panel, 0, 1, timing.appear);   /* no growing: a short fade */
  /* how far it unfolds follows the personality (its squash; lively as given): calm opens from closer to full size,
     playful from further away — with the pop spring's own overshoot, the three read clearly apart */
  const k = motionFor(panel).squash / 0.14, reach = 0.45 + 0.55 * k;
  const grow = (f: number) => Math.max(0.15, 1 - (1 - f) * reach);
  const [sx, sy] = (typeof from === 'number' ? [from, from] : from).map(grow);
  const a = animate(panel, [{ transform: `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` }, { transform: 'scale(1)' }], spring);
  const o = panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: spring === 'pop' ? 70 : 120, easing: 'linear', fill: 'backwards' });
  const content = panel.querySelector<HTMLElement>('[data-sg-content]');
  if (content) animate(content, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 'snappy', { delay: spring === 'pop' ? 25 : 40 });
  return Promise.all([a.finished, o.finished]).then(() => undefined, () => undefined);
}

/** Folds back toward the anchor: quick ease-in, gone in ~150 ms. */
export function bloomOut(panel: HTMLElement, to: number | [number, number] = 0.9, duration: number = timing.fold): Promise<void> {
  if (prefersReducedMotion(panel)) { panel.getAnimations().forEach((a) => a.cancel()); return fade(panel, 1, 0, timing.leave); }
  panel.getAnimations().forEach((a) => a.cancel());
  const [sx, sy] = typeof to === 'number' ? [to, to] : to;
  const a = panel.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${sx}, ${sy})`, opacity: 0 }], { duration, easing: easing.fold, fill: 'both' });
  return a.finished.then(() => undefined, () => undefined);
}

export function fade(el: HTMLElement, a: number, b: number, ms: number) {
  /* fading out holds the end (the element is about to go); fading in lets go, as animate() does */
  return el.animate([{ opacity: a }, { opacity: b }], { duration: ms, fill: b === 0 ? 'both' : 'backwards' }).finished.then(() => undefined, () => undefined);
}

/* ---------------------------------------------------------------- focus */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

/** Moves focus into `root` and keeps Tab inside it. Returns a release function that restores focus. */
/* Safari does not focus a button that is clicked, so a layer opened by a click found the page itself focused and gave
   focus back to nothing on close. The control last pressed stands in for it (a moment ago, and still in the page). */
let pressed: { el: HTMLElement; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    pressed = el ? { el, at: performance.now() } : null;
  }, true);
}
const opener = (): HTMLElement | null => {
  const a = document.activeElement as HTMLElement | null;
  if (a && a !== document.body) return a;
  return pressed && document.contains(pressed.el) && performance.now() - pressed.at < 3000 ? pressed.el : a;
};

export function trapFocus(root: HTMLElement, initial?: HTMLElement | null): () => void {
  const before = opener();
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

/* ---------------------------------------------------------------- layer stack (Esc order, scroll lock, inert page) */
type Layer = { onEscape: () => void; modal: boolean; el: HTMLElement | null; inert: boolean };
const stack: Layer[] = [];
let locked = false, savedPad = '', savedOverflow = '', holds = 0;

function syncLock() {
  const need = stack.some((l) => l.modal) || holds > 0;
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

/* A modal layer hides everything under it from assistive technology (aria-modal alone is not honoured everywhere):
   aria-hidden on every child of <body> except the portal of the top modal layer, the portals of layers opened above it
   (a menu or a dialog opened from a drawer) and live regions (toasts must still be announced). The scrim already
   takes the pointer and the focus trap the keyboard; aria-hidden, unlike inert, costs no style recalculation of the
   page, so the overlay's first frame stays light. Only what this hid is given back. */
const madeHidden = new Set<HTMLElement>();
const hostOf = (el: HTMLElement | null) => { let e = el; while (e && e.parentElement && e.parentElement !== document.body) e = e.parentElement; return e && e.parentElement === document.body ? e : null; };
function syncHidden() {
  let m = -1;
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].inert && hostOf(stack[i].el)) { m = i; break; }
  const keep = new Set<Element>();
  if (m >= 0) for (let i = m; i < stack.length; i++) { const h = hostOf(stack[i].el); if (h) keep.add(h); }
  const want = new Set<HTMLElement>();
  if (m >= 0) for (const c of Array.from(document.body.children) as HTMLElement[]) {
    if (keep.has(c) || c.matches('script, style, link, template') || c.querySelector('[aria-live], .sg-toaster')) continue;
    if (c.getAttribute('aria-hidden') !== 'true' || madeHidden.has(c)) want.add(c);
  }
  for (const c of madeHidden) if (!want.has(c)) { c.removeAttribute('aria-hidden'); madeHidden.delete(c); }
  for (const c of want) if (!madeHidden.has(c)) { c.setAttribute('aria-hidden', 'true'); madeHidden.add(c); }
}
const onKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].onEscape();
};

/** Puts an overlay on the layer stack: Escape goes to the top one, a modal one locks the page's scroll and (unless
    `opts.inert` is false: an anchored menu that only holds the scroll) hides the rest of the page from assistive
    technology. `el` is the
    overlay's element (any element inside its portal). Returns the removal. */
export function pushLayer(onEscape: () => void, modal: boolean, el: HTMLElement | null = null, opts: { inert?: boolean } = {}): () => void {
  const layer = { onEscape, modal, el, inert: opts.inert ?? modal };
  if (!stack.length) document.addEventListener('keydown', onKeydown);
  stack.push(layer); syncLock(); syncHidden();
  return () => {
    const i = stack.indexOf(layer);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onKeydown);
    syncLock(); syncHidden();
  };
}
export const topLayerCount = () => stack.length;

/** Keeps the page's scroll lock (if there is one) until the returned release is called — for an overlay's exit
    animation. Unlocking brings the scrollbar back, which narrows the window: a centred panel still fading out
    would jump sideways by half the scrollbar's width. Release is idempotent. */
export function holdScrollLock(): () => void {
  if (!locked) return () => {};
  holds++;
  let done = false;
  return () => { if (done) return; done = true; holds--; syncLock(); };
}
