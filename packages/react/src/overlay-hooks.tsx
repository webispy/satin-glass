/* Internal overlay plumbing shared by the overlay components (not part of the public API). */
import { useEffect, useRef } from 'react';
import { bloomIn, bloomOut, holdScrollLock, place, pushLayer, type Placement } from '@satin-glass/core';
import { useIsoLayoutEffect, usePresence } from './utils';

export type CloseReason = 'escape' | 'backdrop' | 'action' | 'swipe' | 'select';

/** Holds an overlay's cleanup (scroll lock, focus trap, listeners). Runs it at most once per opening — on close,
    or on unmount if the overlay disappears while open (route change, a parent removing it mid-animation). */
export function useRelease() {
  const fn = useRef<() => void>(() => {});
  const api = useRef({
    set(f: () => void) { let done = false; fn.current = () => { if (done) return; done = true; f(); }; },
    run() { fn.current(); fn.current = () => {}; },
  }).current;
  useEffect(() => () => api.run(), []);
  return api;
}

/** Shared lifecycle: mount → enter animation → (open) → exit animation → unmount. */
export function useOverlayLifecycle(open: boolean, enter: () => Promise<void> | void, exit: () => Promise<void>) {
  const { mounted, closing, done } = usePresence(open);
  /* 'idle' → 'open' → 'exiting' → idle. Re-opened while exiting (e.g. a click on another anchor closes and
     re-opens in two events): the exit is abandoned and enter runs again, so the overlay never gets stuck. */
  const phase = useRef<'idle' | 'open' | 'exiting'>('idle');
  /* unmounted (or StrictMode's simulated remount): start over, so a remount that is open runs enter again */
  useIsoLayoutEffect(() => () => { phase.current = 'idle'; }, []);
  useIsoLayoutEffect(() => {
    if (mounted && !closing && phase.current !== 'open') { phase.current = 'open'; enter(); }
  }, [mounted, closing]);
  useEffect(() => {
    if (!closing) return;
    phase.current = 'exiting';
    /* the page stays locked until the exit animation is over (no sideways jump when the scrollbar returns) */
    const hold = holdScrollLock();
    let alive = true;
    exit().then(() => {
      if (alive && phase.current === 'exiting') { phase.current = 'idle'; done(); }
      requestAnimationFrame(() => hold());   /* once the panel has left the screen */
    });
    return () => { alive = false; hold(); };
  }, [closing]);
  return { mounted, closing };
}

export type Anchor = HTMLElement | DOMRect | null | undefined;
const rectOf = (a: Anchor) => (a instanceof HTMLElement ? a.getBoundingClientRect() : a ?? new DOMRect(innerWidth / 2, innerHeight / 2, 0, 0));

/** Anchored floating panel shared by Menu, Popover, Select and DatePicker.
    focusFirst: move focus into the panel (and give it back on close); null keeps focus where it is (a combobox).
    matchWidth: the panel is at least as wide as the anchor (selects).
    lockScroll: the page does not scroll while it is open (a context menu over its scrim).
    Scrolling never closes a panel: it stays glued to its anchor and moves with it, like part of the page —
    out of the window and back again. */
export function useAnchored(open: boolean, anchor: Anchor, placement: Placement, onClose: (r: CloseReason) => void, focusFirst: ((p: HTMLElement) => void) | null, opts: { matchWidth?: boolean; lockScroll?: boolean } = {}) {
  const panel = useRef<HTMLDivElement>(null);
  const release = useRelease();
  const close = useRef(onClose); close.current = onClose;
  const before = useRef<Element | null>(null);
  const life = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    before.current = focusFirst ? document.activeElement : null;
    const r = rectOf(anchor);
    if (opts.matchWidth) p.style.minWidth = `${r.width}px`;
    const at = place({ width: p.offsetWidth, height: p.offsetHeight }, r, placement);
    /* document coordinates (the panel is position: absolute in an anchored portal) */
    p.style.left = `${at.x + scrollX}px`; p.style.top = `${at.y + scrollY}px`; p.dataset.side = at.side;
    const pop = pushLayer(() => close.current('escape'), !!opts.lockScroll);
    const outside = (e: PointerEvent) => {
      if (p.contains(e.target as Node)) return;
      if (anchor instanceof HTMLElement && anchor.contains(e.target as Node)) return; /* the anchor toggles itself */
      close.current('backdrop');
    };
    /* glued to the anchor. Page scrolling needs nothing: the panel sits in document coordinates and the browser
       moves it with the page. An inner scroll area (a sidebar, a dialog body) moves the anchor within the page:
       the panel follows by exactly as much, in the same scroll event (no frame of lag, no flipping or clamping
       mid-scroll, so it never jumps). On resize it is placed again, on the side it opened on.
       A DOMRect anchor is a fixed point and has nothing to follow. */
    const el = anchor instanceof HTMLElement ? anchor : null;
    const doc = (a: DOMRect) => ({ left: a.left + scrollX, top: a.top + scrollY });
    let side = at.side, base = doc(r), pos = { x: at.x + scrollX, y: at.y + scrollY };
    const align = placement.includes('-') ? placement.slice(placement.indexOf('-')) : '';
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t === document || t === document.documentElement || p.contains(t as Node)) return;   /* the page, or the panel's own list */
      if (!el || !el.isConnected) return;
      const a = doc(el.getBoundingClientRect());
      p.style.left = `${pos.x + a.left - base.left}px`; p.style.top = `${pos.y + a.top - base.top}px`;
    };
    const replace = () => {
      if (!el || !el.isConnected) return;
      const a = el.getBoundingClientRect();
      if (opts.matchWidth) p.style.minWidth = `${a.width}px`;
      const next = place({ width: p.offsetWidth, height: p.offsetHeight }, a, `${side}${align}` as Placement);
      side = next.side; base = doc(a); pos = { x: next.x + scrollX, y: next.y + scrollY };
      p.style.left = `${pos.x}px`; p.style.top = `${pos.y}px`; p.dataset.side = next.side;
    };
    document.addEventListener('pointerdown', outside, true);
    if (el) { window.addEventListener('scroll', onScroll, { capture: true, passive: true }); addEventListener('resize', replace); }
    release.set(() => {
      pop();
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', replace);
      /* Safari does not focus a button on click: fall back to the anchor so focus still goes home */
      const prev = before.current as HTMLElement | null;
      const b = (!prev || prev === document.body) && anchor instanceof HTMLElement ? anchor : prev;
      if (focusFirst && b && document.contains(b) && (p.contains(document.activeElement) || document.activeElement === document.body)) b.focus({ preventScroll: true });
    });
    focusFirst?.(p);
    /* unfold away from the anchor: the axis pointing away from it starts flatter */
    const vertical = at.side === 'top' || at.side === 'bottom';
    return bloomIn(p, { x: at.originX, y: at.originY }, vertical ? [0.6, 0.3] : [0.3, 0.6], 'pop');
  }, () => {
    release.run();
    const vertical = (panel.current!.dataset.side ?? 'bottom').match(/top|bottom/);
    return bloomOut(panel.current!, vertical ? [0.7, 0.45] : [0.45, 0.7], 150);
  });
  return { panel, ...life };
}

