/* Drawer (0.5): a panel that comes in from a side edge over the page — filters, details, a form beside a list.
   Always modal: a named dialog over a scrim, focus kept inside, the page under it inert (the layer stack), focus
   back to the opener when it closes. For side content that stays, use Sidebar.
   It answers the hand like Sheet does sideways: it enters from its edge at the smooth spring's pace with the gentle
   one's damping (the gentle spring, a sheet's, dragged a wide panel in too slowly; it does not swing past its edge); dragged toward that
   edge it follows the finger 1:1 (resisting the other way), and on release either leaves from where it is (past a
   third of its width, or flicked) or settles back on the smooth spring. Reduced motion: it fades in place and does
   not follow the drag. `side` is logical: 'end' is the right edge in a left-to-right page, the left in RTL.
   side="top" / "bottom" dock it to that edge (a console, a log, a tool panel): it spans the width, is `height` tall
   (default half the screen), its body scrolls, and its header is what you drag toward the edge to put it away.
   Content that rises from the bottom to be read or filled in (sized to itself, with a grabber) is a Sheet; a list of
   actions is an ActionSheet.
   `resizable` (top / bottom): a grip on the free edge sets the height - dragged, it follows 1:1 and stops at
   minHeight / maxHeight (default: the header plus a few lines / the screen); it is a focusable separator (Up / Down by
   16 px, Home / End). The header still drags the drawer away. The height is kept across openings (uncontrolled), or
   controlled with height + onHeightChange. */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { animate, drag, fade, prefersReducedMotion, pushLayer, trapFocus, timing, easing, motionFor } from '@satin-glass/core';
import { cx, mergeRefs, useStableId } from './utils';
import { Portal, useGlassLight } from './foundation';
import { glassClass } from './glass-class';
import { IconButton } from './controls';
import { CloseIcon } from './icons';
import { useOverlayLifecycle, useRelease, type CloseReason } from './overlay-hooks';
import { useMessages } from './messages';

type DrawerBase = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** header buttons before the title */
  leading?: ReactNode;
  /** header buttons after the title, before the close button */
  trailing?: ReactNode;
  children?: ReactNode;
  /** a click on the scrim or a swipe towards the edge closes it (default true); Escape and the close button always do */
  dismissible?: boolean;
  labels?: { close?: string; resize?: string };
  className?: string;
};
type Length = number | string;
type Fixed = {
  /** top / bottom only: a grip on the free edge lets the user set the height, between minHeight and maxHeight */
  resizable?: false; minHeight?: never; maxHeight?: never; defaultHeight?: never; onHeightChange?: never;
};
/** top / bottom only: the user sets the height with a grip on the free edge (onHeightChange gets px) */
type Resizable = {
  /** top / bottom only: a grip on the free edge lets the user set the height, between minHeight and maxHeight */
  resizable: true;
  /** the minimum height the grip allows (default: the header plus a few lines) */
  minHeight?: Length;
  /** the maximum height the grip allows (default: the screen) */
  maxHeight?: Length;
} & (
  | {
      /** the height of a top / bottom drawer: px or any CSS length (default half the screen); with `resizable`, set it
          to control the height (use with `onHeightChange`) */
      height: Length; defaultHeight?: never;
      /** called with the new height in px when the user resizes it */
      onHeightChange: (height: number) => void }
  | {
      height?: never;
      /** the starting height when uncontrolled; what the user sets is kept while the drawer stays mounted */
      defaultHeight?: Length;
      /** called with the new height in px when the user resizes it */
      onHeightChange?: (height: number) => void }
);
/** where it comes from, and its size across that edge (a number is px, a string any CSS length; never more than the
    screen allows) */
export type DrawerPlacement =
  /** 'end' (default) or 'start', following the writing direction; width default 360 px */
  | (Fixed & {
      /** the edge it comes in from: 'end' (default) or 'start' follow the writing direction; 'top' and 'bottom' span the
      full width */
      side?: 'start' | 'end';
      /** the width of a start / end drawer: px or any CSS length */
      width?: Length; height?: never })
  /** from the top or bottom edge, the full width; height default half the screen */
  | ({
      /** the edge it comes in from: 'end' (default) or 'start' follow the writing direction; 'top' and 'bottom' span the
      full width */
      side: 'top' | 'bottom'; width?: never } & ((Fixed & {
      /** the height of a top / bottom drawer: px or any CSS length (default half the screen); with `resizable`, set it
          to control the height (use with `onHeightChange`) */
      height?: Length }) | Resizable));
/** a drawer needs a name: a visible title, or an aria-label */
export type DrawerProps = DrawerBase & DrawerPlacement & ({
  /** the heading in the header; it names the drawer (without one, `aria-label` is required) */
  title: ReactNode; 'aria-label'?: never;
} | { title?: never; 'aria-label': string });

/* a drag that starts on a form control, a slider or inside something that scrolls sideways belongs to that */
const ownsDrag = (t: EventTarget | null, panel: HTMLElement) => {
  for (let e = t as HTMLElement | null; e && e !== panel; e = e.parentElement) {
    if (e.matches('input, textarea, select, [role="slider"], [contenteditable="true"], [data-sg-nodrag]')) return true;
    const ox = getComputedStyle(e).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
  }
  return false;
};

export function Drawer(props: DrawerProps) {
  const { open, onClose, side = 'end', title, leading, trailing, children, width = 360, dismissible = true, labels, className, 'aria-label': ariaLabel } = props;
  const m = useMessages();
  const { resizable, minHeight, maxHeight, defaultHeight, onHeightChange } = props as DrawerBase & Resizable;
  /* the height: controlled, or what the user last set (kept while the drawer stays mounted), or the given one */
  const [ownH, setOwnH] = useState<number | null>(null);
  const height: Length = props.height ?? ownH ?? defaultHeight ?? '50dvh';
  const grip = useRef<HTMLDivElement>(null);
  const top = side === 'top' || side === 'bottom';   /* docked to a horizontal edge: it moves along y */
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('sg-drawer');
  const lightRef = useGlassLight();
  const release = useRelease();
  const swiped = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const canSwipe = useRef(dismissible); canSwipe.current = dismissible;
  /* +1 when the drawer sits on the right (or bottom) edge and leaves that way, -1 on the left (or top) */
  const sign = (p: HTMLElement) => (top ? (side === 'bottom' ? 1 : -1) : (side === 'end') !== (getComputedStyle(p).direction === 'rtl') ? 1 : -1);
  const offscreen = (p: HTMLElement) => (side === 'top' ? 'translateY(calc(-100% - 16px - env(safe-area-inset-top, 0px)))'
    : side === 'bottom' ? 'translateY(calc(100% + 16px + env(safe-area-inset-bottom, 0px)))'
    : `translateX(calc(${sign(p) * 100}% + ${sign(p) * 16}px))`);
  const shift = (v: number) => (top ? `translateY(${v}px)` : `translateX(${v}px)`);

  /* the grip: the panel's height between its bounds (px); the free edge is the top of a bottom drawer */
  const px = (v: Length | undefined, p: HTMLElement, fallback: number) => {
    if (v === undefined) return fallback;
    if (typeof v === 'number') return v;
    const probe = document.createElement('div'); probe.style.cssText = `position:absolute;visibility:hidden;height:${v}`;
    p.parentElement!.appendChild(probe); const h = probe.offsetHeight; probe.remove(); return h || fallback;
  };
  const bounds = (p: HTMLElement) => {
    const wrap = p.parentElement!, cs = getComputedStyle(wrap);
    const room = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const head = p.querySelector<HTMLElement>('.sg-drawer__header')?.offsetHeight ?? 56;
    const lo = Math.min(room, px(minHeight, p, head + (grip.current?.offsetHeight ?? 0) + 48));
    return { lo, hi: Math.max(lo, Math.min(room, px(maxHeight, p, room))) };
  };
  const commit = (h: number) => { if (props.height === undefined) setOwnH(h); onHeightChange?.(h); };
  const growSign = side === 'bottom' ? -1 : 1;   /* a bottom drawer grows as its top edge goes up */
  const onGripKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const p = panel.current; if (!p) return;
    const { lo, hi } = bounds(p), now = p.offsetHeight;
    const k = e.key;
    /* Up / Down move the edge that way: up grows a bottom drawer and shrinks a top one */
    const next = k === 'ArrowUp' ? now - 16 * growSign : k === 'ArrowDown' ? now + 16 * growSign : k === 'Home' ? lo : k === 'End' ? hi : null;
    if (next === null) return;
    e.preventDefault();
    const h = Math.round(Math.min(hi, Math.max(lo, next)));
    p.style.setProperty('--_h', `${h}px`); commit(h);
  };
  const [gripNow, setGripNow] = useState<{ now: number; lo: number; hi: number } | null>(null);

  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    swiped.current = false;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true, p);
    const trap = trapFocus(p);
    const s = sign(p);
    let x = 0;
    /* a side drawer is dragged anywhere sideways; a top or bottom one by its header (its body scrolls up and down) */
    const extent = () => (top ? p.offsetHeight : p.offsetWidth);
    const off = drag(p, {
      axis: top ? 'y' : 'x', threshold: 6,
      start: (i) => canSwipe.current && !prefersReducedMotion(p) && !ownsDrag(i.event.target, p)
        && (!top || !!(i.event.target as HTMLElement).closest?.('.sg-drawer__header') && !(i.event.target as HTMLElement).closest('button, a, input')),
      move: ({ dx, dy }) => {
        const d = top ? dy : dx;
        x = s * d > 0 ? d : -s * Math.sqrt(Math.abs(d)) * 2;   /* toward the edge 1:1; the other way resists */
        p.getAnimations().forEach((a) => a.cancel());
        p.style.transform = shift(x);
        if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - (s * x) / (extent() * 1.2)));
      },
      /* a cancelled gesture (the system took the pointer) springs back: only a release dismisses */
      end: ({ vx, vy }, cancelled) => {
        if (!cancelled && (s * x > extent() * 0.3 || s * (top ? vy : vx) > 900)) { swiped.current = true; close.current('swipe'); return; }
        p.style.transform = '';
        if (scrim.current) scrim.current.style.opacity = '';
        animate(p, [{ transform: shift(x) }, { transform: 'none' }], 'smooth');
        x = 0;
      },
    });
    /* the grip: the free edge follows the pointer 1:1, between the bounds; it stops there, nothing springs */
    let h0 = 0, v0 = '', wrote = '', lim = { lo: 0, hi: 0 };
    const offGrip = resizable && grip.current ? drag(grip.current, {
      axis: 'y', threshold: 0,
      start: () => { h0 = p.offsetHeight; v0 = p.style.getPropertyValue('--_h'); wrote = ''; lim = bounds(p); p.getAnimations().forEach((a) => a.cancel()); p.dataset.resizing = ''; },
      move: ({ dy }) => {
        /* the app set a new height meanwhile (a controlled one): that is the height a cancel goes back to */
        const now = p.style.getPropertyValue('--_h'); if (now !== (wrote || v0)) v0 = now;
        const h = Math.min(lim.hi, Math.max(lim.lo, h0 + growSign * dy)); wrote = `${h.toFixed(1)}px`; p.style.setProperty('--_h', wrote);
      },
      /* cancelled (hidden mid-resize, #79, or the system took the pointer): back to the height it started at, and the
         app is not told of a height nobody let go at */
      end: (_, cancelled) => {
        delete p.dataset.resizing;
        if (cancelled) { if (p.style.getPropertyValue('--_h') === wrote) p.style.setProperty('--_h', v0); return; }
        const h = Math.round(p.offsetHeight); commit(h); setGripNow({ now: h, ...bounds(p) });
      },
    }) : Object.assign(() => {}, { cancel() {} });
    if (resizable) setGripNow({ now: p.offsetHeight, ...bounds(p) });
    /* hidden mid-drag or mid-resize (#79): the gesture is cancelled (its release would land elsewhere) and the drawer
       shown again at rest */
    release.set(() => { pop(); trap(); off(); offGrip(); }, { hide: () => { off.cancel(); offGrip.cancel(); pop.pause(true); }, show: () => { x = 0; p.style.transform = ''; delete p.dataset.resizing; if (scrim.current) scrim.current.style.opacity = ''; pop.pause(false); trap.resume(); } });
    if (prefersReducedMotion(p)) return fade(p, 0, 1, timing.appear);
    /* the smooth spring's pace with the gentle one's damping: quick, and it does not swing past its edge (a panel
       docked to an edge that overshoots opens a gap there) */
    const m = motionFor(p);
    return animate(p, [{ transform: offscreen(p) }, { transform: 'none' }], { response: m.smooth.response, damping: m.gentle.damping }).finished.then(() => undefined, () => undefined);
  }, () => {
    release.run();
    const p = panel.current!;
    scrim.current?.classList.remove('is-open');
    if (scrim.current) scrim.current.style.opacity = '';
    const from = p.style.transform || 'none';
    p.getAnimations().forEach((a) => a.cancel());
    if (prefersReducedMotion(p)) return fade(p, 1, 0, timing.leave);
    /* an exit: a short ease-in from wherever it is (a release mid-drag too), like the sheet */
    return p.animate([{ transform: from }, { transform: offscreen(p) }], { duration: timing.sheetOut, easing: easing.exit, fill: 'both' }).finished.then(() => undefined, () => undefined);
  }, release);
  if (!mounted) return null;
  const w = typeof width === 'number' ? `${width}px` : width, h = typeof height === 'number' ? `${height}px` : height;
  const gripEl = top && resizable ? (
    <div ref={grip} className="sg-drawer__grip" role="separator" aria-orientation="horizontal" tabIndex={0} aria-label={labels?.resize ?? m.resize}
      aria-controls={`${id}-b`} aria-valuenow={gripNow?.now} aria-valuemin={gripNow ? Math.round(gripNow.lo) : undefined} aria-valuemax={gripNow ? Math.round(gripNow.hi) : undefined}
      onKeyDown={(e) => { onGripKey(e); const p = panel.current; if (p) setGripNow({ now: Math.round(p.offsetHeight), ...bounds(p) }); }} />
  ) : null;
  return (
    <Portal>
      <div ref={scrim} className="sg-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className="sg-drawer-wrap" data-side={side}>
        <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined} aria-label={title ? undefined : ariaLabel}
          className={cx('sg-drawer', glassClass('strong', false, 'overlay'), className)} style={(top ? { '--_h': h } : { '--_w': w }) as unknown as CSSProperties}>
          {side === 'bottom' && gripEl}
          <div className="sg-drawer__header">
            {leading}
            {title ? <h2 id={`${id}-t`} className="sg-drawer__title">{title}</h2> : <span className="sg-drawer__title" />}
            {trailing}
            <IconButton icon={<CloseIcon />} label={labels?.close ?? m.close} onClick={() => onClose('action')} data-sg-close />
          </div>
          <div id={`${id}-b`} className="sg-drawer__body">{children}</div>
          {side === 'top' && gripEl}
        </div>
      </div>
    </Portal>
  );
}
