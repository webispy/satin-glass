/* Internal overlay plumbing shared by the overlay components (not part of the public API). */
import { createContext, useContext, useEffect, useRef } from 'react';
import { bloomIn, bloomOut, canFocus, dirOf, focusables, holdScrollLock, inLayerAbove, place, pushLayer, tabFrom, type Placement } from '@satin-glass/core';
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
/* an element anchor's box without its own scale, about the centre of the one on screen: a pressable anchor shrinks
   about its centre while pressed, and an iOS tap opens the panel while it still is, so its drawn box would place the
   panel a few pixels in and, once let go, every later measure would see the anchor move by as much */
const boxOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  /* its own scale only (from `transform` and `scale`); what its ancestors do to it is part of where it is */
  const m = /^matrix\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+)/.exec(cs.transform ?? '');
  const sc = (cs.scale ?? 'none') === 'none' ? [1, 1] : cs.scale.split(' ').map(Number);
  const sx = (m ? Math.hypot(+m[1], +m[2]) : 1) * sc[0], sy = (m ? Math.hypot(+m[3], +m[4]) : 1) * (sc[1] ?? sc[0]);
  if (!sx || !sy || (Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3)) return r;
  const w = r.width / sx, h = r.height / sy;
  return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
};
const rectOf = (a: Anchor) => (a instanceof HTMLElement ? boxOf(a) : a ?? new DOMRect(innerWidth / 2, innerHeight / 2, 0, 0));
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
/** Where a panel anchored to a bare DOMRect (a context menu at a point) takes its writing direction from: the element
    that opened it. Internal; an element anchor is its own source. */
export const AnchorSource = createContext<(() => Element | null) | null>(null);

export function useAnchored(open: boolean, anchor: Anchor, placement: Placement, onClose: (r: CloseReason) => void, focusFirst: ((p: HTMLElement) => void) | null, opts: { matchWidth?: boolean; lockScroll?: boolean; tab?: 'close' | 'edge' } = {}) {
  const panel = useRef<HTMLDivElement>(null);
  const source = useContext(AnchorSource), sourceRef = useRef(source); sourceRef.current = source;
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
       moves it with the page. An anchor the page's scrolling does not carry (in a fixed bar, or a bar stuck to the
       top of the view) puts the panel in the view's coordinates instead, for the same reason; were it carried, a page
       scrolled while it is open (a finger dragging inside the panel scrolls the page on iOS) took it off the anchor. An inner scroll area (a sidebar, a dialog body) moves the anchor within the page:
       the panel follows by exactly as much, in the frame of that scroll (read in the scroll event, written before the
       frame is drawn: no frame of lag, no flipping or clamping mid-scroll, so it never jumps). On resize it is placed again, on the side it opened on.
       A DOMRect anchor is a fixed point and has nothing to follow. */
    const follow = (to: Anchor) => {
      unfollow();
      el = to instanceof HTMLElement ? to : null;
      const r = rectOf(to);
      /* the panel is portalled to the body, out of the anchor's writing direction: it takes the anchor's (or, for a
         point, the opener's), so start and end are placed by it, its contents run in it, and a menu opened from an
         item inside it finds it there */
      const dirNow = () => dirOf(el ?? sourceRef.current?.() ?? p);
      let dir = dirNow();
      p.dir = dir;
      /* The panel's frame: the document, which the page's scrolling carries, or the view, for an anchor held still in
         it (in a fixed element, or a sticky one that sticks to the view rather than to an area around it). Decided
         again on resize (a breakpoint may make a bar sticky). Either way a page scroll that moves the anchor in the
         panel's frame is followed below, so a frame judged wrongly costs a frame of lag, not a panel left behind. */
      let pinned = false, probe: HTMLElement | null = null, clippers: HTMLElement[] = [];
      const frame = () => {
        let sticky = false, fixedAt: HTMLElement | null = null;
        for (let n: HTMLElement | null = el; n && n !== document.body && !fixedAt; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.position === 'fixed') fixedAt = n;
          else if (sticky && /auto|scroll|hidden/.test(cs.overflowX + cs.overflowY)) sticky = false;   /* it sticks in this area */
          else if (cs.position === 'sticky') sticky = true;
        }
        pinned = !!fixedAt || sticky;
        p.style.position = pinned ? 'fixed' : '';
        /* where the view's frame starts, measured: an ancestor with a transform holds fixed boxes instead of the
           view, and on iOS a zoomed-in visual viewport is offset from the layout one */
        if (pinned && !probe) { probe = document.createElement('span'); probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none'; p.parentElement?.appendChild(probe); }
        if (!pinned) { probe?.remove(); probe = null; }
        /* the scroll areas the anchor moves with: none above a fixed element, which they do not carry */
        clippers = [];
        for (let n = el?.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) clippers.push(n);   /* areas that scroll (a card that clips its own corners is not one) */
          if (cs.position === 'fixed') break;
        }
      };
      frame();
      const ox = () => (probe ? -probe.getBoundingClientRect().left : scrollX), oy = () => (probe ? -probe.getBoundingClientRect().top : scrollY);
      if (opts.matchWidth) p.style.minWidth = `${r.width}px`;
      const at = place({ width: p.offsetWidth, height: p.offsetHeight }, r, placement, undefined, undefined, dir);
      /* in the frame's coordinates (document ones: the panel is position: absolute in an anchored portal) */
      p.style.left = `${at.x + ox()}px`; p.style.top = `${at.y + oy()}px`; p.dataset.side = at.side;
      /* placed again (on another side, perhaps): it folds back towards the new anchor on closing */
      p.style.transformOrigin = `${at.originX}px ${at.originY}px`;
      const doc = (a: DOMRect) => ({ left: a.left + ox(), top: a.top + oy() });
      /* ...and clipped like the anchor. The scroll areas around the anchor (a phone screen, a dialog body) hide what
         scrolls out of them; the panel, part of the anchor, goes under their edges too instead of floating out of the
         frame. Only the sides where the panel opened inside the area are clipped (a list that opens past a sidebar's
         edge keeps showing there), and a panel clipped away entirely is hidden (no invisible clicks). */
      const visibleBox = () => clippers.reduce((b, n) => { const r = n.getBoundingClientRect(); return { top: Math.max(b.top, r.top), left: Math.max(b.left, r.left), bottom: Math.min(b.bottom, r.bottom), right: Math.min(b.right, r.right) }; }, { top: -Infinity, left: -Infinity, bottom: Infinity, right: Infinity });
      /* the panel's size, kept from when it was placed and from its own resizes: read in a scroll frame, after its
         place was written, it forced a layout every frame (#57) */
      let size = { w: p.offsetWidth, h: p.offsetHeight };
      /* the panel's own box (not its transformed one: it may be blooming), in viewport coordinates */
      const boxAt = (left: number, top: number) => ({ left, top, right: left + size.w, bottom: top + size.h, width: size.w, height: size.h });
      const box = () => boxAt(parseFloat(p.style.left) - ox(), parseFloat(p.style.top) - oy());
      const inside = (() => { if (!clippers.length) return null; const b = visibleBox(), q = box(); return { top: q.top >= b.top - 1, bottom: q.bottom <= b.bottom + 1, left: q.left >= b.left - 1, right: q.right <= b.right + 1 }; })();
      /* clipped to the areas' visible box `b`, for the panel at `q` (both read before any write of this frame) */
      const clip = (b?: { top: number; left: number; bottom: number; right: number } | null, q?: ReturnType<typeof boxAt>) => {
        if (!inside) return;
        b ??= visibleBox(); q ??= box();
        const t = inside.top ? Math.max(0, b.top - q.top) : 0, bo = inside.bottom ? Math.max(0, q.bottom - b.bottom) : 0;
        const l = inside.left ? Math.max(0, b.left - q.left) : 0, ri = inside.right ? Math.max(0, q.right - b.right) : 0;
        const gone = t + bo >= q.height - 0.5 || l + ri >= q.width - 0.5;
        p.style.clipPath = t || bo || l || ri ? `inset(${t}px ${ri}px ${bo}px ${l}px)` : '';
        p.style.visibility = gone ? 'hidden' : '';
      };
      if (anchored.current) { p.style.clipPath = ''; p.style.visibility = ''; }   /* placed again: clipped afresh */
      const target = el;
      let side = at.side, base = doc(r), pos = { x: at.x + ox(), y: at.y + oy() };
      const align = placement.includes('-') ? placement.slice(placement.indexOf('-')) : '';
      /* an anchor that is no longer laid out (display: none, or gone from the document) has no place to point at: the
         panel would be placed against a 0 × 0 box at the top left. It closes instead. */
      const lost = () => !!target && (!target.isConnected || target.getClientRects().length === 0);
      const onScroll = (e: Event) => {
        const t = e.target;
        if (p.contains(t as Node)) return;   /* the panel's own list */
        if (lost()) { pending = null; close.current('anchor'); return; }
        if (!target) return;
        /* an anchor inside another anchored panel (a menu opened from a popover) moves when that panel is placed, in
           its frame: it is measured there, after it */
        if (inPanel) { pending = 'measure'; if (!raf) raf = requestAnimationFrame(write); return; }
        /* read in the scroll event, written in the frame it belongs to (before it is drawn): written here, every read
           after it in this event, the panel's own or another scroll handler's (an app bar's large title), forced a
           layout, every frame (#57) */
        pending = measure();
        if (!raf) raf = requestAnimationFrame(write);
      };
      const measure = () => {
        const r = boxOf(target!), x0 = ox(), y0 = oy(), b = inside ? visibleBox() : null;
        /* the page's scrolling usually moves neither (it carries both, or neither); a sticky bar not stuck yet moves */
        const x = pos.x + r.left + x0 - base.left, y = pos.y + r.top + y0 - base.top;
        return { left: `${x}px`, top: `${y}px`, b, q: boxAt(x - x0, y - y0) };
      };
      const inPanel = !!target?.closest('.sg-portal--anchored');
      let pending: ReturnType<typeof measure> | 'measure' | null = null, raf = 0;
      const write = () => {
        raf = 0;
        const n = pending === 'measure' ? (target && !lost() ? measure() : null) : pending; pending = null;
        if (!n) return;
        if (n.left !== p.style.left || n.top !== p.style.top) { p.style.left = n.left; p.style.top = n.top; }
        clip(n.b, n.q);
      };
      const replace = () => {
        pending = null;   /* placed afresh: a scroll's pending place is stale */
        if (lost()) { close.current('anchor'); return; }
        if (!target) return;
        frame();
        /* the anchor's direction may have changed with the layout (a breakpoint) */
        dir = dirNow(); p.dir = dir;
        const a = boxOf(target);
        if (opts.matchWidth) p.style.minWidth = `${a.width}px`;
        size = { w: p.offsetWidth, h: p.offsetHeight };
        const next = place({ width: size.w, height: size.h }, a, `${side}${align}` as Placement, undefined, undefined, dir);
        side = next.side; base = doc(a); pos = { x: next.x + ox(), y: next.y + oy() };
        p.style.left = `${pos.x}px`; p.style.top = `${pos.y}px`; p.dataset.side = next.side;
        p.style.transformOrigin = `${next.originX}px ${next.originY}px`;
        clip();
      };
      /* the anchor can also leave the layout with no scroll or resize (a state change hides it, a re-render removes
         it): its size (or its parent's, which it took space in) changes, and the panel closes then. Cheap: no
         observer of the page's mutations. */
      const ro = target && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (lost()) close.current('anchor'); }) : null;
      /* the panel's size, kept current without reading it in a scroll frame (a list filtered as one types) */
      const own = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
        const w = p.offsetWidth, h = p.offsetHeight;
        if (w === size.w && h === size.h) return;
        /* the edge that meets the anchor stays where it is: a list that widens right to left keeps its right edge on
           the anchor's, one above its anchor keeps its bottom there (placing it afresh would also pull a panel that
           follows a scrolled-away anchor back into the view). While the anchor is in view the panel stays inside the
           view's padding, as when it was placed: a menu widening right to left near the left edge stops at it. Then
           clipped again for its new size: a scroll may have clipped it with the old one */
        const a0 = (align.slice(1) || 'center') as 'start' | 'center' | 'end';
        const h0 = dir === 'rtl' && a0 !== 'center' ? (a0 === 'start' ? 'end' : 'start') : a0;
        const kx = side === 'left' ? 1 : side === 'right' ? 0 : h0 === 'end' ? 1 : h0 === 'center' ? 0.5 : 0;
        const ky = side === 'top' ? 1 : side === 'bottom' ? 0 : a0 === 'end' ? 1 : a0 === 'center' ? 0.5 : 0;
        let dx = (w - size.w) * kx, dy = (h - size.h) * ky;
        size = { w, h };
        const a = target ? target.getBoundingClientRect() : null;
        if (a && a.bottom > 0 && a.right > 0 && a.top < innerHeight && a.left < innerWidth) {
          const PAD = 12, x0 = parseFloat(p.style.left) - ox(), y0 = parseFloat(p.style.top) - oy();
          const fit = (v: number, room: number, len: number) => Math.min(Math.max(PAD, v), room - PAD - len);
          dx = x0 - fit(x0 - dx, innerWidth, w); dy = y0 - fit(y0 - dy, innerHeight, h);
        }
        if (dx || dy) {
          pos = { x: pos.x - dx, y: pos.y - dy };
          p.style.left = `${parseFloat(p.style.left) - dx}px`; p.style.top = `${parseFloat(p.style.top) - dy}px`;
          const [gx, gy] = p.style.transformOrigin.split(' ').map(parseFloat);
          if (Number.isFinite(gx) && Number.isFinite(gy)) p.style.transformOrigin = `${gx + dx}px ${gy + dy}px`;
        }
        clip();
      }) : null;
      own?.observe(p, { box: 'border-box' });
      if (target) {
        ro?.observe(target); if (target.parentElement) ro?.observe(target.parentElement);
        window.addEventListener('scroll', onScroll, { capture: true, passive: true }); addEventListener('resize', replace);
      }
      unfollow = () => { cancelAnimationFrame(raf); raf = 0; pending = null; probe?.remove(); probe = null; ro?.disconnect(); own?.disconnect(); window.removeEventListener('scroll', onScroll, true); removeEventListener('resize', replace); };
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

