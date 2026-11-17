/* Internal overlay plumbing shared by the overlay components (not part of the public API). */
import { useEffect, useRef } from 'react';
import { bloomIn, bloomOut, place, pushLayer, type Placement } from '@glass-layer/core';
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
    let alive = true;
    exit().then(() => { if (alive && phase.current === 'exiting') { phase.current = 'idle'; done(); } });
    return () => { alive = false; };
  }, [closing]);
  return { mounted, closing };
}

export type Anchor = HTMLElement | DOMRect | null | undefined;
const rectOf = (a: Anchor) => (a instanceof HTMLElement ? a.getBoundingClientRect() : a ?? new DOMRect(innerWidth / 2, innerHeight / 2, 0, 0));

/** Anchored floating panel shared by Menu, Popover, Select and DatePicker.
    focusFirst: move focus into the panel (and give it back on close); null keeps focus where it is (a combobox).
    matchWidth: the panel is at least as wide as the anchor (selects).
    scroll: 'close' (menus: short-lived, a scroll dismisses them) or 'follow' (pickers and popovers: the panel
    stays attached to its anchor while the page scrolls, and closes only once the anchor has left the window). */
export function useAnchored(open: boolean, anchor: Anchor, placement: Placement, onClose: (r: CloseReason) => void, focusFirst: ((p: HTMLElement) => void) | null, opts: { matchWidth?: boolean; scroll?: 'close' | 'follow' } = {}) {
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
    p.style.left = `${at.x}px`; p.style.top = `${at.y}px`; p.dataset.side = at.side;
    const pop = pushLayer(() => close.current('escape'), false);
    const outside = (e: PointerEvent) => {
      if (p.contains(e.target as Node)) return;
      if (anchor instanceof HTMLElement && anchor.contains(e.target as Node)) return; /* the anchor toggles itself */
      close.current('backdrop');
    };
    const follow = opts.scroll === 'follow' && anchor instanceof HTMLElement;
    /* follow: on scroll / resize, re-place the panel next to the anchor (once per frame), keeping the side it
       opened on while it fits; close once the anchor is entirely out of the window */
    let side = at.side, raf = 0;
    const align = placement.includes('-') ? placement.slice(placement.indexOf('-')) : '';
    const reposition = () => {
      raf = 0;
      const a = (anchor as HTMLElement).getBoundingClientRect();
      if (a.bottom <= 0 || a.top >= innerHeight || a.right <= 0 || a.left >= innerWidth) { close.current('backdrop'); return; }
      const next = place({ width: p.offsetWidth, height: p.offsetHeight }, a, `${side}${align}` as Placement);
      side = next.side;
      p.style.left = `${next.x}px`; p.style.top = `${next.y}px`; p.dataset.side = next.side;
    };
    const onScroll = (e: Event) => {
      if (p.contains(e.target as Node)) return;   /* scrolling inside the panel (a long list) is the panel's own */
      if (follow) { if (!raf) raf = requestAnimationFrame(reposition); }
      else close.current('backdrop');
    };
    document.addEventListener('pointerdown', outside, true);
    if (follow) addEventListener('resize', onScroll);
    /* listen for scrolling only from the next frames on: a scroll queued before opening (e.g. the anchor was
       just scrolled into view) is delivered a frame late and must not close the panel it preceded */
    let armed = true;
    const arm = requestAnimationFrame(() => requestAnimationFrame(() => { if (armed) window.addEventListener('scroll', onScroll, true); }));
    release.set(() => {
      pop();
      armed = false; cancelAnimationFrame(arm); cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', onScroll);
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

