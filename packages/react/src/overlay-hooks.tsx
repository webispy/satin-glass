/* Internal overlay plumbing shared by the overlay components (not part of the public API). */
import { useEffect, useRef } from 'react';
import { bloomIn, bloomOut, canFocus, focusables, holdScrollLock, inLayerAbove, place, pushLayer, tabFrom, type Placement } from '@satin-glass/core';
import { useIsoLayoutEffect, usePresence } from './utils';

/** why an overlay asks to close; 'backdrop': a press outside it (or Tab leaving a menu or popover); 'anchor': the
    element an anchored panel points at is no longer on screen (it was hidden — a responsive layout swapping one
    control for another — or removed) */
export type CloseReason = 'escape' | 'backdrop' | 'action' | 'swipe' | 'select' | 'anchor';

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
const sameRect = (a: DOMRect, b: DOMRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Anchored floating panel shared by Menu, Popover, Select and DatePicker.
    focusFirst: move focus into the panel (and give it back on close); null keeps focus where it is (a combobox).
    matchWidth: the panel is at least as wide as the anchor (selects).
    lockScroll: the page does not scroll while it is open (a context menu over its scrim).
    tab: Tab leaves the panel as if from its anchor — 'close': any Tab (a menu); 'edge': Tab past its last stop or
    Shift+Tab before its first (a popover). It closes ('backdrop'), focus goes back to the anchor and moves on from
    there, inside the anchor's focus trap or panel when it is in one (the panel's portal is outside them both), else
    by the browser's own Tab; Shift+Tab from a popover's first stop lands on the anchor.
    Scrolling never closes a panel: it stays glued to its anchor and moves with it, like part of the page —
    out of the window and back again. */
export function useAnchored(open: boolean, anchor: Anchor, placement: Placement, onClose: (r: CloseReason) => void, focusFirst: ((p: HTMLElement) => void) | null, opts: { matchWidth?: boolean; lockScroll?: boolean; tab?: 'close' | 'edge' } = {}) {
  const panel = useRef<HTMLDivElement>(null);
  const release = useRelease();
  const close = useRef(onClose); close.current = onClose;
  const before = useRef<Element | null>(null);
  /* while open: what the panel is placed against, and how to place it against another */
  const anchored = useRef<{ at: Anchor; rect: DOMRect; to: (a: Anchor) => void } | null>(null);
  const life = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    p.removeAttribute('inert');   /* re-opened mid-exit */
    before.current = focusFirst ? document.activeElement : null;
    /* the element anchor the panel follows (null for a DOMRect or no anchor) */
    let el: HTMLElement | null = null, unfollow = () => {};
    /* Safari does not focus a button on click (the page, or a focusable container around it, has focus instead):
       fall back to the anchor so focus still goes home */
    const home = () => {
      const prev = before.current as HTMLElement | null;
      const b = (!prev || prev === document.body || (el && prev !== el && prev.contains(el))) && el ? el : prev;
      return b && b.isConnected ? b : null;
    };
    /* an anchored panel never makes the page inert: a context menu's lifted item and scrim live in their own portal */
    const tab = opts.tab && ((from: HTMLElement, back: boolean) => {
      if (opts.tab === 'edge') {
        const list = focusables(p), i = list.indexOf(from);
        if (back ? i > 0 : list.length > 0 && i !== list.length - 1) return false;   /* inside: the browser's Tab */
      }
      close.current('backdrop');
      /* Tab moves on from the anchor (the panel's place in the page), not from where focus was when it opened (a
         field the shortcut that opened it was pressed in); with no element anchor, from where focus goes back */
      /* only an anchor Tab can stop on: from a <span> or a <div> the step is not in the list, and it would start over at
         the first stop of the page or dialog */
      let h = el && canFocus(el) ? el : home();
      /* home() prefers the anchor inside what had focus (a span in the button that opened it): that button, then */
      if (h && h === el && !canFocus(h)) h = before.current as HTMLElement | null;
      /* nowhere to go back to (a context menu opened by a right click): focus stays for the close to settle */
      if (!h || h === document.body) return true;
      h.focus({ preventScroll: true });
      /* the panel turns inert once the parent closes it (below), before the browser's own Tab from the anchor can
         come back into it; a parent that keeps it open (unsaved edits) keeps it usable */
      return (opts.tab === 'edge' && back) || tabFrom(h, back);
    });
    const pop = pushLayer(() => close.current('escape'), !!opts.lockScroll, p, { inert: false, back: home, tab: tab || undefined });
    const outside = (e: PointerEvent) => {
      if (p.contains(e.target as Node)) return;
      if (el && el.contains(e.target as Node)) return; /* the anchor toggles itself */
      if (inLayerAbove(p, e.target as Node)) return;   /* a list or dialog opened from inside this panel */
      close.current('backdrop');
    };
    /* Places the panel against `a` and, for an element, keeps it there.
       Glued to the anchor. Page scrolling needs nothing: the panel sits in document coordinates and the browser
       moves it with the page. An inner scroll area (a sidebar, a dialog body) moves the anchor within the page:
       the panel follows by exactly as much, in the same scroll event (no frame of lag, no flipping or clamping
       mid-scroll, so it never jumps). On resize it is placed again, on the side it opened on.
       A DOMRect anchor is a fixed point and has nothing to follow. */
    const follow = (to: Anchor) => {
      unfollow();
      el = to instanceof HTMLElement ? to : null;
      const r = rectOf(to);
      if (opts.matchWidth) p.style.minWidth = `${r.width}px`;
      const at = place({ width: p.offsetWidth, height: p.offsetHeight }, r, placement);
      /* document coordinates (the panel is position: absolute in an anchored portal) */
      p.style.left = `${at.x + scrollX}px`; p.style.top = `${at.y + scrollY}px`; p.dataset.side = at.side;
      /* placed again (on another side, perhaps): it folds back towards the new anchor on closing */
      p.style.transformOrigin = `${at.originX}px ${at.originY}px`;
      const doc = (a: DOMRect) => ({ left: a.left + scrollX, top: a.top + scrollY });
      /* ...and clipped like the anchor. The scroll areas around the anchor (a phone screen, a dialog body) hide what
         scrolls out of them; the panel, part of the anchor, goes under their edges too instead of floating out of the
         frame. Only the sides where the panel opened inside the area are clipped (a list that opens past a sidebar's
         edge keeps showing there), and a panel clipped away entirely is hidden (no invisible clicks). */
      const clippers = (() => { const out: HTMLElement[] = []; for (let n = el?.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) out.push(n);   /* areas that scroll (a card that clips its own corners is not one) */ } return out; })();
      const visibleBox = () => clippers.reduce((b, n) => { const r = n.getBoundingClientRect(); return { top: Math.max(b.top, r.top), left: Math.max(b.left, r.left), bottom: Math.min(b.bottom, r.bottom), right: Math.min(b.right, r.right) }; }, { top: -Infinity, left: -Infinity, bottom: Infinity, right: Infinity });
      /* the panel's own box (not its transformed one: it may be blooming), in viewport coordinates */
      const box = () => { const left = parseFloat(p.style.left) - scrollX, top = parseFloat(p.style.top) - scrollY; return { left, top, right: left + p.offsetWidth, bottom: top + p.offsetHeight, width: p.offsetWidth, height: p.offsetHeight }; };
      const inside = (() => { if (!clippers.length) return null; const b = visibleBox(), q = box(); return { top: q.top >= b.top - 1, bottom: q.bottom <= b.bottom + 1, left: q.left >= b.left - 1, right: q.right <= b.right + 1 }; })();
      const clip = () => {
        if (!inside) return;
        const b = visibleBox(), q = box();
        const t = inside.top ? Math.max(0, b.top - q.top) : 0, bo = inside.bottom ? Math.max(0, q.bottom - b.bottom) : 0;
        const l = inside.left ? Math.max(0, b.left - q.left) : 0, ri = inside.right ? Math.max(0, q.right - b.right) : 0;
        const gone = t + bo >= q.height - 0.5 || l + ri >= q.width - 0.5;
        p.style.clipPath = t || bo || l || ri ? `inset(${t}px ${ri}px ${bo}px ${l}px)` : '';
        p.style.visibility = gone ? 'hidden' : '';
      };
      if (anchored.current) { p.style.clipPath = ''; p.style.visibility = ''; }   /* placed again: clipped afresh */
      const target = el;
      let side = at.side, base = doc(r), pos = { x: at.x + scrollX, y: at.y + scrollY };
      const align = placement.includes('-') ? placement.slice(placement.indexOf('-')) : '';
      /* an anchor that is no longer laid out (display: none, or gone from the document) has no place to point at: the
         panel would be placed against a 0 × 0 box at the top left. It closes instead. */
      const lost = () => !!target && (!target.isConnected || target.getClientRects().length === 0);
      const onScroll = (e: Event) => {
        const t = e.target;
        if (t === document || t === document.documentElement || p.contains(t as Node)) return;   /* the page, or the panel's own list */
        if (lost()) { close.current('anchor'); return; }
        if (!target) return;
        const a = doc(target.getBoundingClientRect());
        p.style.left = `${pos.x + a.left - base.left}px`; p.style.top = `${pos.y + a.top - base.top}px`;
        clip();
      };
      const replace = () => {
        if (lost()) { close.current('anchor'); return; }
        if (!target) return;
        const a = target.getBoundingClientRect();
        if (opts.matchWidth) p.style.minWidth = `${a.width}px`;
        const next = place({ width: p.offsetWidth, height: p.offsetHeight }, a, `${side}${align}` as Placement);
        side = next.side; base = doc(a); pos = { x: next.x + scrollX, y: next.y + scrollY };
        p.style.left = `${pos.x}px`; p.style.top = `${pos.y}px`; p.dataset.side = next.side;
        p.style.transformOrigin = `${next.originX}px ${next.originY}px`;
        clip();
      };
      /* the anchor can also leave the layout with no scroll or resize (a state change hides it, a re-render removes
         it): its size (or its parent's, which it took space in) changes, and the panel closes then. Cheap: no
         observer of the page's mutations. */
      const ro = target && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (lost()) close.current('anchor'); }) : null;
      if (target) {
        ro?.observe(target); if (target.parentElement) ro?.observe(target.parentElement);
        window.addEventListener('scroll', onScroll, { capture: true, passive: true }); addEventListener('resize', replace);
      }
      unfollow = () => { ro?.disconnect(); window.removeEventListener('scroll', onScroll, true); removeEventListener('resize', replace); };
      anchored.current = { at: to, rect: new DOMRect(r.x, r.y, r.width, r.height), to: follow };   /* a copy: the app may change its DOMRect */
      return at;
    };
    const at = follow(anchor);
    document.addEventListener('pointerdown', outside, true);
    release.set(() => {
      pop();
      unfollow();
      anchored.current = null;
      document.removeEventListener('pointerdown', outside, true);
      const b = home();
      if (focusFirst && b && (p.contains(document.activeElement) || document.activeElement === document.body)) b.focus({ preventScroll: true });
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
  /* leaving: no longer reachable by Tab or the pointer while it folds away. In the commit that closes it, so before
     the browser's Tab that follows a Tab handled above */
  useIsoLayoutEffect(() => { if (!open) panel.current?.setAttribute('inert', ''); }, [open]);
  /* the app points the open panel elsewhere. Away from the element it was placed against: that is no longer its
     anchor, as when the anchor leaves the layout, and it closes. From a point or none (a ref that was still null
     when it opened, a context menu's point moved): it is placed against the new anchor, and follows it if it is an
     element. A new point at the place it was placed against is the same anchor. */
  useEffect(() => {
    const cur = anchored.current;
    if (!open || !cur || anchor === cur.at) return;   /* not one already closing */
    if (cur.at instanceof HTMLElement) { close.current('anchor'); return; }
    if (!(anchor instanceof HTMLElement) && sameRect(cur.rect, rectOf(anchor))) return;
    cur.to(anchor);
  }, [anchor]);
  return { panel, ...life };
}

