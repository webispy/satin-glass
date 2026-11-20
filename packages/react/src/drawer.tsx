/* Drawer (0.5): a panel that comes in from a side edge over the page — filters, details, a form beside a list.
   Always modal: a named dialog over a scrim, focus kept inside, the page under it inert (the layer stack), focus
   back to the opener when it closes. For side content that stays, use Sidebar.
   It answers the hand like Sheet does sideways: it enters from its edge on the gentle spring; dragged toward that
   edge it follows the finger 1:1 (resisting the other way), and on release either leaves from where it is (past a
   third of its width, or flicked) or settles back on the smooth spring. Reduced motion: it fades in place and does
   not follow the drag. `side` is logical: 'end' is the right edge in a left-to-right page, the left in RTL. */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { animate, drag, fade, prefersReducedMotion, pushLayer, trapFocus } from '@satin-glass/core';
import { cx, mergeRefs, useStableId } from './utils';
import { Portal, glassClass, useGlassLight } from './foundation';
import { IconButton } from './controls';
import { CloseIcon } from './icons';
import { useOverlayLifecycle, useRelease, type CloseReason } from './overlay-hooks';

type DrawerBase = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** 'end' (default) or 'start', following the writing direction */
  side?: 'start' | 'end';
  /** header buttons before the title and before the close button */
  leading?: ReactNode; trailing?: ReactNode;
  children?: ReactNode;
  /** default 360 px, never wider than the screen allows */
  width?: number | string;
  /** a click on the scrim or a swipe toward the edge closes it (default true); Escape and the close button always do */
  dismissible?: boolean;
  labels?: { close?: string };
  className?: string;
};
/** a drawer needs a name: a visible title, or an aria-label */
export type DrawerProps = DrawerBase & ({ title: ReactNode; 'aria-label'?: never } | { title?: never; 'aria-label': string });

/* a drag that starts on a form control, a slider or inside something that scrolls sideways belongs to that */
const ownsDrag = (t: EventTarget | null, panel: HTMLElement) => {
  for (let e = t as HTMLElement | null; e && e !== panel; e = e.parentElement) {
    if (e.matches('input, textarea, select, [role="slider"], [contenteditable="true"], [data-sg-nodrag]')) return true;
    const ox = getComputedStyle(e).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
  }
  return false;
};

export function Drawer({ open, onClose, side = 'end', title, leading, trailing, children, width = 360, dismissible = true, labels, className, 'aria-label': ariaLabel }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('sg-drawer');
  const lightRef = useGlassLight();
  const release = useRelease();
  const swiped = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const canSwipe = useRef(dismissible); canSwipe.current = dismissible;
  /* +1 when the drawer sits on the right edge (it leaves to the right), -1 on the left */
  const sign = (p: HTMLElement) => ((side === 'end') !== (getComputedStyle(p).direction === 'rtl') ? 1 : -1);
  const offscreen = (p: HTMLElement) => `translateX(calc(${sign(p) * 100}% + ${sign(p) * 16}px))`;

  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    swiped.current = false;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true, p);
    const trap = trapFocus(p);
    const s = sign(p);
    let x = 0;
    const off = drag(p, {
      axis: 'x', threshold: 6,
      start: (i) => canSwipe.current && !prefersReducedMotion(p) && !ownsDrag(i.event.target, p),
      move: ({ dx }) => {
        x = s * dx > 0 ? dx : -s * Math.sqrt(Math.abs(dx)) * 2;   /* toward the edge 1:1; the other way resists */
        p.getAnimations().forEach((a) => a.cancel());
        p.style.transform = `translateX(${x}px)`;
        if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - (s * x) / (p.offsetWidth * 1.2)));
      },
      end: ({ vx }) => {
        if (s * x > p.offsetWidth * 0.3 || s * vx > 900) { swiped.current = true; close.current('swipe'); return; }
        p.style.transform = '';
        if (scrim.current) scrim.current.style.opacity = '';
        animate(p, [{ transform: `translateX(${x}px)` }, { transform: 'none' }], 'smooth');
        x = 0;
      },
    });
    release.set(() => { pop(); trap(); off(); });
    if (prefersReducedMotion(p)) return fade(p, 0, 1, 140);
    return animate(p, [{ transform: offscreen(p) }, { transform: 'none' }], 'gentle').finished.then(() => undefined, () => undefined);
  }, () => {
    release.run();
    const p = panel.current!;
    scrim.current?.classList.remove('is-open');
    if (scrim.current) scrim.current.style.opacity = '';
    const from = p.style.transform || 'none';
    p.getAnimations().forEach((a) => a.cancel());
    if (prefersReducedMotion(p)) return fade(p, 1, 0, 110);
    return animate(p, [{ transform: from }, { transform: offscreen(p) }], 'smooth').finished.then(() => undefined, () => undefined);
  });
  if (!mounted) return null;
  const w = typeof width === 'number' ? `${width}px` : width;
  return (
    <Portal>
      <div ref={scrim} className="sg-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className="sg-drawer-wrap" data-side={side}>
        <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined} aria-label={title ? undefined : ariaLabel}
          className={cx('sg-drawer', glassClass('strong', false, 'overlay'), className)} style={{ '--_w': w } as CSSProperties}>
          <div className="sg-drawer__header">
            {leading}
            {title ? <h2 id={`${id}-t`} className="sg-drawer__title">{title}</h2> : <span className="sg-drawer__title" />}
            {trailing}
            <IconButton icon={<CloseIcon />} label={labels?.close ?? 'Close'} onClick={() => onClose('action')} data-sg-close />
          </div>
          <div className="sg-drawer__body">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
