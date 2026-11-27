/* Overlay helpers: anchored placement, the "bloom" open/close motion, focus management and a layer stack. */
import { animate, motionFor, prefersReducedMotion, type SpringName } from './motion';
/* springs named here resolve against the panel's motion personality (nearest [data-sg-motion]) */

/* ---------------------------------------------------------------- placement */
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-${Align}`;
export type Placed = { x: number; y: number; side: Side; originX: number; originY: number };

/** The writing direction an element is laid out in: placements' start and end follow it. */
export const dirOf = (el: Element | null | undefined): 'ltr' | 'rtl' => (el && getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr');

/** `start` and `end` are logical: above or below the anchor, they are its left and right edges left to right, and its
    right and left edges right to left (`dir`). Beside it (`left`, `right`), they are its top and bottom either way. */
export function place(size: { width: number; height: number }, anchor: DOMRect, placement: Placement = 'bottom-start', offset = 8, pad = 12, dir: 'ltr' | 'rtl' = 'ltr'): Placed {
  const vw = innerWidth, vh = innerHeight;
  let [side, align] = placement.split('-') as [Side, Align | undefined];
  align = align ?? 'center';
  if (dir === 'rtl' && (side === 'top' || side === 'bottom') && align !== 'center') align = align === 'start' ? 'end' : 'start';
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
/* what Tab can reach: laid out, not visibility: hidden (a clipped-away panel), not inside [inert] (a closed accordion
   region), not taken out of the order with a negative tabindex (a native button too: the inactive tabs of a Tabs),
   not disabled (a control in a disabled <fieldset> too, which the [disabled] test in FOCUSABLE misses), and, as
   browsers do, one stop per radio group (the focused or checked radio, else the first). The focused element
   stays in the list wherever it is, so the step from it is found. */
const shown = (el: HTMLElement) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : getComputedStyle(el).visibility !== 'hidden');
const isRadio = (el: Element): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'radio' && !!el.name;
export const focusables = (root: HTMLElement) => {
  const a = document.activeElement;
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[inert]') && !el.matches(':disabled') && (el === a || (el.tabIndex >= 0 && el.offsetParent !== null && shown(el))));
  /* each group's stop (a group is a name within a form), found in one pass */
  const stops = new Map<HTMLFormElement | null, Map<string, HTMLInputElement>>();
  for (const el of all) {
    if (!isRadio(el)) continue;
    const g = stops.get(el.form) ?? new Map<string, HTMLInputElement>(), cur = g.get(el.name);
    stops.set(el.form, g);
    if (!cur || (cur !== a && (el === a || (el.checked && !cur.checked)))) g.set(el.name, el);
  }
  return all.filter((el) => !isRadio(el) || stops.get(el.form)?.get(el.name) === el);
};
/* Tab and Shift+Tab inside `root`, wrapping: from `from` to the next stop that takes focus (one that refuses it, a
   control disabled a moment ago, is passed over instead of holding focus where it was) */
/** Whether Tab can stop on `el` now: connected, reachable by Tab, laid out and shown, not inert or disabled. */
export const canFocus = (el: HTMLElement) => el.isConnected && el.matches(FOCUSABLE) && !el.closest('[inert]') && !el.matches(':disabled') && el.tabIndex >= 0 && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed') && shown(el);

function step(root: HTMLElement, from: Element | null, back: boolean) {
  const list = focusables(root), n = list.length;
  if (!n) return;
  const i = list.indexOf(from as HTMLElement), start = i < 0 ? (back ? n : -1) : i;
  for (let k = 1; k <= n; k++) {
    const c = list[(((start + (back ? -k : k)) % n) + n) % n];
    c.focus();
    if (document.activeElement === c) return;
  }
}

/** Moves focus into `root` and keeps Tab inside it. Returns a release function that restores focus. */
/* Safari does not focus a button that is clicked, so a layer opened by a click found the page itself focused (or the
   nearest focusable container around the button, such as a tab panel) and gave focus back there on close. The control
   last pressed stands in for it (a moment ago, and still in the page). */
let pressed: { el: HTMLElement; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    pressed = el ? { el, at: performance.now() } : null;
  }, true);
}
const opener = (): HTMLElement | null => {
  const a = document.activeElement as HTMLElement | null;
  const recent = pressed && document.contains(pressed.el) && performance.now() - pressed.at < 3000 ? pressed.el : null;
  if (a && a !== document.body && !(recent && recent !== a && a.contains(recent))) return a;
  return recent ?? a;
};

/* Where focus goes back to: `el`, or, once it has left the document or cannot take focus (a menu item that opened a
   dialog as the menu closed: gone, or still folding away and inert), where the layer that held it would have given
   focus back (the menu's button), and so on down. `give` moves focus there, and on down the chain when `el` refuses
   it. */
function homeOf(el: HTMLElement | null): { home: () => HTMLElement | null; give: () => void } {
  const up = el ? layerOf(el)?.back : undefined;
  const home = () => (el && el.isConnected && !el.closest('[inert]') && !el.matches(':disabled') ? el : up?.() ?? null);
  /* down the chain of openers until one takes focus: the opener may be gone, and the one below it connected but
     hidden (a menu item inside a closed panel) */
  const give = () => {
    const seen = new Set<HTMLElement>();
    for (let h = home(); h && !seen.has(h); h = h === el ? up?.() ?? null : layerOf(h)?.back?.() ?? null) {
      seen.add(h);
      h.focus({ preventScroll: true });
      if (document.activeElement === h) return;
    }
  };
  return { home, give };
}

const traps: HTMLElement[] = [];
/* where each trap gives the focus back, changeable: a trap set up under one that already has the focus (an overlay
   opened inside it that registered first, #104) takes over where that one would give it back, and that one gives it
   to this trap instead, so closing the inner one leaves the focus in the outer one, not on the page under it */
const trapGive = new Map<HTMLElement, { get: () => () => void; set: (g: () => void) => void }>();
/* the layer a trap lies in: its own (the same element), else the nearest one holding it. Not one inside it (an inline
   panel opened from it), and not one beside it in a shared portal. Looked up when needed, so the order a trap and its
   layer were set up in does not matter. */
const layerOfTrap = (root: HTMLElement): Layer | undefined => {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].el === root) return stack[i];
  /* the nearest: the innermost element, whichever was pushed last */
  let best: Layer | undefined;
  for (const l of stack) if (l.el?.contains(root) && (!best || best.el!.contains(l.el))) best = l;
  return best;
};
/** A focus trap's release, which gives focus back to where it was when the trap began; `resume()` puts focus back in
    the trap after its root was hidden (Suspense, Activity) and shown again. */
export type FocusTrap = (() => void) & { resume(): void };
/** The shown modal layer's element that `el` lies under (on the page, or in a layer below it), other than the layer of
    `except`; null when none does. Where an anchored panel opened at once with a dialog around it gives the focus back:
    not to the page under that dialog (#104). */
export function modalCover(el: HTMLElement, except?: HTMLElement): HTMLElement | null {
  const skip = except ? layerIndexOf(except) : -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    const l = stack[i];
    if (i === skip || l.paused || !l.modal || !l.el) continue;
    return layerIndexOf(el) < i ? l.el : null;
  }
  return null;
}
/** Whether the layer holding `el` is under one that has the focus or that is a shown modal (an overlay opened inside
    it whose effects came first, or a modal opened above it meanwhile): then it takes no focus as it opens or is shown
    again. 'focus' when a layer above has the focus, 'modal' when only a modal is above it, false otherwise. */
export function heldAbove(el: HTMLElement): 'focus' | 'modal' | false {
  const i = layerIndexOf(el);
  if (i < 0) return false;
  const a = document.activeElement;
  if (a && a !== document.body && layerIndexOf(a) > i) return 'focus';
  return stack.slice(i + 1).some((l) => !l.paused && l.modal) ? 'modal' : false;
}
export function trapFocus(root: HTMLElement, initial?: HTMLElement | null): FocusTrap {
  /* the focus already in a layer above this one (an overlay opened inside it, whose effects came first: both open at
     once, or an Activity showing them again, #104) stays there; this one gives focus back where that one would */
  const now = document.activeElement as HTMLElement | null, above = heldAbove(root);
  const under = above !== false;
  const { home, give } = homeOf(opener());
  /* a layer opened above this one from inside it falls back here when its opener is gone */
  const own = layerOf(root);
  if (own && !own.back && own.el && (own.el === root || root.contains(own.el))) own.back = home;
  traps.push(root);
  const firstOf = () => (initial?.isConnected ? initial : null) ?? root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(root)[0] ?? root;
  const first = firstOf();
  if (first === root && !root.hasAttribute('tabindex')) root.tabIndex = -1;
  if (!under) first.focus({ preventScroll: true });
  /* focus `to`, or when it no longer takes it (disabled while hidden), the first control that does, else the panel */
  const land = (to: HTMLElement) => {
    for (const c of [to, ...focusables(root), root]) {
      if (c === root && !root.hasAttribute('tabindex')) root.tabIndex = -1;
      c.focus({ preventScroll: true });
      if (document.activeElement === c) return;
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    /* move focus ourselves: WebKit's default Tab skips buttons, which would let focus escape the trap */
    e.preventDefault();
    step(root, document.activeElement, e.shiftKey);
  };
  root.addEventListener('keydown', onKey);
  let giveNow = give;
  if (above === 'focus') {
    /* the nearest trap above this one, among those opened inside it: it gives the focus here from now on (while this
       one is still set up), and this one gives it where that one would have */
    const mineL = layerOfTrap(root), i0 = mineL ? stack.indexOf(mineL) : -1;
    let inner: HTMLElement | undefined, at = Infinity;
    for (const t of traps) {
      const l = layerOfTrap(t), i = l ? stack.indexOf(l) : -1;
      if (t !== root && i > i0 && i < at && mineL?.order && descends(l!.order, mineL.order)) { inner = t; at = i; }
    }
    const rec = inner && trapGive.get(inner);
    if (rec) {
      const before = rec.get();
      giveNow = before;
      /* this one gone: where this one gives it now (to a trap set up under it since, or on down) */
      rec.set(() => { if (traps.includes(root) && !layerOfTrap(root)?.paused) land(firstOf()); else giveNow(); });
      void before;
    }
  }
  trapGive.set(root, { get: () => giveNow, set: (g) => { giveNow = g; } });
  const release = () => {
    root.removeEventListener('keydown', onKey);
    const t = traps.lastIndexOf(root);
    if (t >= 0) traps.splice(t, 1);
    if (!document.activeElement || root.contains(document.activeElement) || document.activeElement === document.body) giveNow();
    trapGive.delete(root);
  };
  return Object.assign(release, {
    /* a modal trap holds the focus: shown again, it takes it back from wherever it went meanwhile, unless it is in a
       layer opened above this one (a menu from this dialog, shown again first) */
    resume() {
      const a = document.activeElement, mine = layerOf(root)?.el;
      if (a && a !== document.body && (root.contains(a) || (mine && inLayerAbove(mine, a)))) return;
      /* a modal opened above it meanwhile (outside what was hidden) keeps the focus: this one is under it */
      const mineL = layerOfTrap(root), i = mineL ? stack.indexOf(mineL) : -1;
      if (i >= 0 && stack.slice(i + 1).some((l) => !l.paused && l.modal)) return;
      /* what it holds may have changed while hidden: a control gone or disabled gives way to the next, and with
         nothing to focus left, the panel itself takes it */
      land(firstOf());
    },
  });
}

/** Moves focus on from `from` as Tab (or Shift+Tab, `back`) would, inside the focus trap that holds `from` — for a
    panel portalled outside that trap (a menu or popover opened in a dialog) whose Tab leaves it for its anchor's
    next stop. Outside any trap, the layer that holds `from` decides, when it was given `tab` (a popover passes Tab
    past its edge on to its anchor, and so on down to a trap). Returns false when nothing took it: the browser's
    own Tab moves on from `from`. */
export function tabFrom(from: HTMLElement, back = false): boolean {
  for (let i = traps.length - 1; i >= 0; i--) if (traps[i].contains(from) && !layerOfTrap(traps[i])?.paused) { step(traps[i], from, back); return true; }
  return layerOf(from)?.tab?.(from, back) ?? false;
}

/* ---------------------------------------------------------------- layer stack (Esc order, scroll lock, inert page) */
/* back: where the layer gives focus back to on closing, while that is still in the document; tab: its own Tab from
   an element inside it (see tabFrom); paused: its overlay is hidden for now (Suspense, Activity), so it keeps its place
   in the stack but locks nothing, hides nothing and takes no Escape until it is shown again */
type Layer = { onEscape: () => void; modal: boolean; el: HTMLElement | null; inert: boolean; back?: () => HTMLElement | null; tab?: (from: HTMLElement, back: boolean) => boolean; paused?: boolean; rank: number; own?: boolean; order?: LayerOrder };
const stack: Layer[] = [];

/* ---- the order of layers (#104). A layer's place is its opening's rank: openings are ranked in the order they are
   first registered, an opening's ancestors (the overlays it was opened inside) before it. So an overlay opened inside
   another is always above it, even when it registers first (React connects a child's effects before its parent's:
   both open at once, or an Activity showing them again), and two unrelated overlays stay in the order they were
   opened. An opening keeps its rank while it is set aside and comes back to its place. */
/** An overlay opening's place among the layers (opaque): made with the opening it was opened inside, ranked when it,
    or an opening inside it, first registers a layer. Pass it as `pushLayer`'s `opts.order`, or give it to the
    overlay's portal with `setLayerOrder` so that every layer whose element is in that portal takes it. */
export type LayerOrder = { readonly parent: LayerOrder | null };
export const createLayerOrder = (parent: LayerOrder | null = null): LayerOrder => ({ parent });
let nextRank = 0, renewing = 0;
const ranks = new WeakMap<LayerOrder, number>();
const rankOf = (o: LayerOrder): number => {
  let r = ranks.get(o);
  /* not ranked yet, or ranked before its parent was renewed (re-opened during its exit while this one had no layer):
     after its parent */
  const p = o.parent ? rankOf(o.parent) : -1;
  if (r === undefined || r < p) { r = nextRank++; ranks.set(o, r); }
  return r;
};
const hostOrder = new WeakMap<HTMLElement, LayerOrder>();
/** Gives a portal (a child of <body>) its opening's order: a layer whose element is inside it takes that place unless
    `pushLayer` is given its own, a layer pushed from inside it before this was called too. null forgets it. */
export function setLayerOrder(host: HTMLElement, order: LayerOrder | null) {
  if (!order) { hostOrder.delete(host); return; }
  hostOrder.set(host, order);
  /* layers pushed from inside it already (their effects ran before the portal's own) take its place now */
  let moved = false;
  for (const l of stack) if (!l.own && l.el && hostOf(l.el) === host) { l.order = order; l.rank = rankOf(order); moved = true; }
  if (moved) stack.sort((x, y) => x.rank - y.rank);
  placeHosts();
  if (moved) syncHidden();
}
/** Runs `open`, in which an overlay that is still leaving (re-opened during its exit) pushes its layer again, as a new
    opening: it takes a new place, above what was opened meanwhile, rather than the one it had. */
const descends = (o: LayerOrder | undefined, of: LayerOrder) => { for (let p = o?.parent ?? null; p; p = p.parent) if (p === of) return true; return false; };
function renew(order: LayerOrder) {
  const inner = stack.filter((l) => l.order && descends(l.order, order)).sort((x, y) => x.rank - y.rank);
  ranks.delete(order);
  const r = rankOf(order);
  for (const l of stack) if (l.order === order) l.rank = r;
  const seen = new Set<LayerOrder>();
  for (const l of inner) { const o = l.order!; if (!seen.has(o)) { seen.add(o); ranks.delete(o); } l.rank = rankOf(o); }
  stack.sort((x, y) => x.rank - y.rank);
}
export function asNewOpening<T>(open: () => T): T {
  renewing++;
  try { return open(); } finally { renewing--; }
}
/* paint order follows the stack: overlays share one z-index, so the later portal in <body> paints on top. Only
   portals that carry an order (the library's own) are moved, and only among themselves: from the top down, a host
   found after the one above it goes in front of it. So the lower one moves, not one that has just come in on top (its
   entrance and its focus already under way); a move keeps the focus */
function placeHosts() {
  /* each ordered host at the place of its topmost shown layer (a paused one holds no place) */
  const top = new Map<HTMLElement, number>();
  stack.forEach((l, i) => { const h = !l.paused && l.el && hostOf(l.el); if (h && hostOrder.has(h)) top.set(h, i); });
  const list = [...top.keys()].sort((x, y) => top.get(x)! - top.get(y)!);
  for (let i = list.length - 1; i > 0; i--) {
    if (!(list[i - 1].compareDocumentPosition(list[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) move(list[i - 1], list[i]);
  }
}
function move(h: HTMLElement, before: Node | null) {
  const a = document.activeElement as HTMLElement | null, had = a && h.contains(a) ? a : null;
  h.parentNode!.insertBefore(h, before);
  if (had && document.activeElement !== had) had.focus({ preventScroll: true });
}

/* the index of the layer that holds `node`: the top one whose element holds it, else (a scrim beside the panel in its
   portal) the top one whose portal holds it. By the element first, so two panels mounted in one container (a core
   user's own #overlays) are told apart. */
function layerIndexOf(node: Node): number {
  /* a paused layer (its overlay hidden for now) holds nothing: a node in a portal it shares belongs to a shown one */
  for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].paused && stack[i].el?.contains(node)) return i;
  for (let i = stack.length - 1; i >= 0; i--) { const e = stack[i].el, h = e && hostOf(e); if (!stack[i].paused && h && h.contains(node)) return i; }
  return -1;
}
const layerOf = (node: Node): Layer | undefined => stack[layerIndexOf(node)];
let locked = false, savedPad = '', savedOverflow = '', holds = 0;

function syncLock() {
  const need = stack.some((l) => l.modal && !l.paused) || holds > 0;
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
   (a menu or a dialog opened from a drawer), and live regions and the toaster at the top of <body> (toasts must still
   be announced; a live region inside the app, a table's sort announcement, does not keep the whole app exposed).
   The scrim already takes the pointer and the focus trap the keyboard; aria-hidden, unlike inert, costs no style
   recalculation of the page, so the overlay's first frame stays light. Only what this hid is given back. */
const madeHidden = new Set<HTMLElement>();
const hostOf = (el: HTMLElement | null) => { let e = el; while (e && e.parentElement && e.parentElement !== document.body) e = e.parentElement; return e && e.parentElement === document.body ? e : null; };
function syncHidden() {
  let m = -1;
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].inert && !stack[i].paused && hostOf(stack[i].el)) { m = i; break; }
  const keep = new Set<Element>();
  if (m >= 0) for (let i = m; i < stack.length; i++) { const h = hostOf(stack[i].el); if (h && !stack[i].paused) keep.add(h); }
  const want = new Set<HTMLElement>();
  if (m >= 0) for (const c of Array.from(document.body.children) as HTMLElement[]) {
    if (keep.has(c) || c.matches('script, style, link, template, [aria-live], [role="status"], [role="alert"], [role="log"], .sg-portal--toasts') || c.querySelector(':scope > .sg-toaster')) continue;
    if (c.getAttribute('aria-hidden') !== 'true' || madeHidden.has(c)) want.add(c);
  }
  for (const c of madeHidden) if (!want.has(c)) { c.removeAttribute('aria-hidden'); madeHidden.delete(c); }
  for (const c of want) if (!madeHidden.has(c)) { c.setAttribute('aria-hidden', 'true'); madeHidden.add(c); }
}
const onKeydown = (e: KeyboardEvent) => {
  /* an Escape that ends an IME composition (Korean, Japanese) belongs to the text field, not the layer */
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
  /* the top layer that is shown: a hidden one (paused) passes Escape to the one under it */
  let top: Layer | undefined;
  for (let i = stack.length - 1; i >= 0 && !top; i--) if (!stack[i].paused) top = stack[i];
  if (!top) return;
  e.preventDefault();
  top.onEscape();
};

/** Puts an overlay on the layer stack: Escape goes to the top one, a modal one locks the page's scroll and (unless
    `opts.inert` is false: an anchored menu that only holds the scroll) hides the rest of the page from assistive
    technology. `el` is the
    overlay's element (any element inside its portal). `opts.back` says where the overlay gives focus back to on
    closing (a focus trap records its own); a layer opened from inside this one goes there when its opener is gone.
    `opts.tab` handles Tab from an element inside a layer that is not a focus trap (see `tabFrom`): true when it
    moved focus, false to leave it to the browser. `opts.order` places it among the layers by its opening (see
    `LayerOrder`; by default the order of its portal, else the order it is pushed in). Returns the removal, whose `pause(true)` sets the layer aside while
    its overlay is hidden (Suspense, Activity: it keeps its place, so layers above and below it stay in order, but locks,
    hides and takes nothing) and `pause(false)` brings it back. */
export type LayerRemoval = (() => void) & { pause(on: boolean): void };
export function pushLayer(onEscape: () => void, modal: boolean, el: HTMLElement | null = null, opts: { inert?: boolean; back?: () => HTMLElement | null; tab?: (from: HTMLElement, back: boolean) => boolean; order?: LayerOrder } = {}): LayerRemoval {
  const host = el && hostOf(el), order = opts.order ?? (host ? hostOrder.get(host) : undefined);
  /* re-opened during its exit: a new opening, a new place, and the overlays still open inside it come along above it */
  if (order && renewing) renew(order);
  const layer: Layer = { onEscape, modal, el, inert: opts.inert ?? modal, back: opts.back, tab: opts.tab, rank: order ? rankOf(order) : nextRank++, own: !!opts.order, order };
  if (!stack.length) document.addEventListener('keydown', onKeydown);
  /* in its rank's place: above every layer ranked before it, below any ranked after (an overlay opened inside it
     that registered first) */
  let at = stack.length;
  while (at > 0 && stack[at - 1].rank > layer.rank) at--;
  stack.splice(at, 0, layer); placeHosts(); syncLock(); syncHidden();
  const remove = () => {
    const i = stack.indexOf(layer);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onKeydown);
    placeHosts(); syncLock(); syncHidden();
  };
  return Object.assign(remove, {
    pause(on: boolean) { if (!!layer.paused === on || !stack.includes(layer)) return; layer.paused = on; placeHosts(); syncLock(); syncHidden(); },
  });
}
/** Whether `target` is inside a layer opened above the layer whose element is `el` — a list opened from a popover
    is its own portal, yet a press in it is not a press outside the popover. */
export function inLayerAbove(el: HTMLElement, target: Node | null): boolean {
  const i = stack.findIndex((l) => l.el === el);
  return i >= 0 && !!target && layerIndexOf(target) > i;
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
