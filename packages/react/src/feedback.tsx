/* Tooltip, Banner, EmptyState (0.3). */
import {
  cloneElement, isValidElement, useEffect, useRef, useState,
  type CSSProperties, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { animate, fade, place, prefersReducedMotion, pushLayer, type Placement, timing } from '@satin-glass/core';
import { cx, mergeRefs, useIsoLayoutEffect, usePresence, useStableId } from './utils';
import { Portal } from './foundation';
import { useMessages } from './messages';
import { IconButton } from './controls';
import { AlertIcon, CloseIcon, InfoIcon, SuccessIcon } from './icons';

/* ================================================================================================ Tooltip */
/* scanning a toolbar: while a tooltip is open, or within 400 ms of one closing, the next one shows at once — and
   the one before closes at once, so two never overlap. (The open one counts too: it lingers 120 ms after the pointer
   leaves, so moving straight onto a neighbour would otherwise find nothing "just closed" and wait the full delay.) */
let warmUntil = 0;
let shown: (() => void) | null = null;

export type TooltipProps = {
  /** the tooltip's text; it becomes the trigger's description (aria-describedby), so keep it short and not the only
      name an icon-only control has */
  content: ReactNode;
  /** the trigger: one element that takes a ref and pointer and focus handlers */
  children: ReactElement;
  placement?: Placement;
  /** the wait in ms before it appears on hover (instant when another tooltip was just open) */
  delay?: number;
  /** shows no tooltip; the trigger itself is unchanged */
  disabled?: boolean;
};

/** A short label for a control, on hover and on keyboard focus. It describes the control (aria-describedby),
    stays open while the pointer moves onto it, closes on Escape, and never takes focus. Not for touch. */
export function Tooltip({ content, children, placement = 'top', delay = 500, disabled }: TooltipProps) {
  const [open, setOpen] = useState(false);
  /* it fades out (110 ms, as the other overlays' quick exits) — except when the next tooltip takes over */
  const { mounted, closing, done } = usePresence(open);
  const instant = useRef(false);
  const trigger = useRef<HTMLElement | null>(null), tip = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const id = useStableId('sg-tip');
  const show = (now = false) => {
    if (disabled) return;
    clearTimeout(timer.current);
    if (now || shown || performance.now() < warmUntil) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = (soon = true) => {
    clearTimeout(timer.current);
    if (soon) timer.current = window.setTimeout(() => setOpen(false), 120);   /* grace: time to move onto the tooltip */
    else setOpen(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useIsoLayoutEffect(() => {
    const t = tip.current, a = trigger.current;
    if (!open || !mounted || !t || !a) return;   /* the tip mounts one render after open (it stays for its exit) */
    const r = a.getBoundingClientRect();
    const at = place({ width: t.offsetWidth, height: t.offsetHeight }, r, placement, 6, 8);
    t.style.left = `${at.x + scrollX}px`; t.style.top = `${at.y + scrollY}px`; t.dataset.side = at.side;
    const off = { top: [0, 4], bottom: [0, -4], left: [4, 0], right: [-4, 0] }[at.side];
    t.getAnimations().forEach((x) => x.cancel());
    if (prefersReducedMotion(t)) fade(t, 0, 1, timing.appear);
    else animate(t, [{ opacity: 0, transform: `translate(${off[0]}px, ${off[1]}px)` }, { opacity: 1, transform: 'none' }], 'snappy');
    const pop = pushLayer(() => setOpen(false), false, t);
    const close = () => { clearTimeout(timer.current); instant.current = true; setOpen(false); };
    if (shown) shown();
    shown = close;
    return () => { pop(); if (shown === close) shown = null; warmUntil = performance.now() + 400; };
  }, [open && mounted]);
  useEffect(() => {
    if (!closing) return;
    const t = tip.current;
    if (!t || instant.current) { instant.current = false; done(); return; }
    let alive = true;
    fade(t, 1, 0, timing.leave).then(() => { if (alive) done(); });
    return () => { alive = false; };
  }, [closing]);
  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown> & { ref?: Ref<HTMLElement> }>;
  const p = child.props;
  const call = (name: string, e: unknown) => (p[name] as ((e: unknown) => void) | undefined)?.(e);
  return (
    <>
      {cloneElement(child, {
        ref: mergeRefs(trigger, p.ref as Ref<HTMLElement> | undefined),   /* React 19: ref is a prop */
        'aria-describedby': open ? cx(p['aria-describedby'] as string | undefined, id) : p['aria-describedby'],
        onPointerEnter: (e: PointerEvent) => { call('onPointerEnter', e); if (e.pointerType !== 'touch') show(); },
        onPointerLeave: (e: PointerEvent) => { call('onPointerLeave', e); hide(); },
        onPointerDown: (e: PointerEvent) => { call('onPointerDown', e); hide(false); },
        onFocus: (e: FocusEvent) => { call('onFocus', e); const t = e.target as HTMLElement; if (t.matches?.(':focus-visible')) show(true); },
        onBlur: (e: FocusEvent) => { call('onBlur', e); hide(false); },
      })}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={tip} id={id} role="tooltip" className="sg-tooltip" onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={() => hide()}>{content}</div>
        </Portal>
      )}
    </>
  );
}

/* ================================================================================================ Banner */
export type BannerProps = {
  /** the colour and the default icon */
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  /** a bold first line */
  title?: ReactNode;
  children?: ReactNode;
  /** replaces the tone's icon; false shows none */
  icon?: ReactNode | false;
  /** buttons on the trailing side (or below on narrow widths) */
  actions?: ReactNode;
  /** shows a close button; called once the banner has folded away */
  onDismiss?: () => void;
  /** the close button's accessible name (default "Dismiss", or 닫기 in Korean) */
  dismissLabel?: string;
  /** announce it when it appears (role alert for danger/warning, status otherwise) */
  live?: boolean;
  className?: string; style?: CSSProperties;
};

const TONE_ICON = { info: <InfoIcon />, success: <SuccessIcon />, warning: <AlertIcon />, danger: <AlertIcon />, neutral: <InfoIcon /> };

/** An inline message in the flow of the page. Dismissing folds it away (the content below closes the gap). */
export function Banner({ tone = 'info', title, children, icon, actions, onDismiss, dismissLabel: dismissProp, live, className, style }: BannerProps) {
  const words = useMessages(), dismissLabel = dismissProp ?? words.dismiss;
  const el = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const dismiss = () => {
    const d = el.current;
    if (!d) { setGone(true); onDismiss?.(); return; }
    const done = () => { setGone(true); onDismiss?.(); };
    if (prefersReducedMotion(d)) { fade(d, 1, 0, timing.leave).then(done); return; }
    /* fade first, then close the gap (height is the one layout property animated here: one short-lived element) */
    const h = d.offsetHeight;
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: timing.appear, easing: 'ease-in', fill: 'forwards' }).finished
      .then(() => animate(d, [{ height: `${h}px`, marginBottom: getComputedStyle(d).marginBottom }, { height: '0px', marginBottom: '0px' }], { response: 0.26, damping: 1 }, { fill: 'forwards' }).finished)   /* the gap closes on a short critically-damped spring: a height must not overshoot */
      .then(done, done);
  };
  if (gone) return null;
  const role = live ? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status') : undefined;
  return (
    <div ref={el} role={role} className={cx('sg-banner', `sg-banner--${tone}`, className)} style={style}>
      {icon !== false && <span className="sg-banner__icon" aria-hidden="true">{icon ?? TONE_ICON[tone]}</span>}
      {/* text and actions share a box whose width decides when the actions drop below the text */}
      <div className="sg-banner__main">
        <div className="sg-banner__text">
          {title && <div className="sg-banner__title">{title}</div>}
          {children && <div className="sg-banner__body">{children}</div>}
        </div>
        {actions && <div className="sg-banner__actions">{actions}</div>}
      </div>
      {onDismiss && <IconButton className="sg-banner__close" size="sm" icon={<CloseIcon />} label={dismissLabel} onClick={dismiss} />}
    </div>
  );
}

/* ================================================================================================ EmptyState */
export type EmptyStateProps = {
  /** a large icon above the title (decorative) */
  icon?: ReactNode;
  /** what is missing: "No results" */
  title: ReactNode;
  /** why, or what to do about it */
  description?: ReactNode;
  /** buttons that fix it: create the first item, clear the filters */
  actions?: ReactNode;
  /** 'sm': less padding, for an empty state inside a table or a card */
  size?: 'sm' | 'md';
  className?: string; style?: CSSProperties;
};

/** What to show where content would be: what is missing and what to do about it. */
export function EmptyState({ icon, title, description, actions, size = 'md', className, style }: EmptyStateProps) {
  return (
    <div className={cx('sg-empty', size === 'sm' && 'sg-empty--sm', className)} style={style}>
      {icon && <div className="sg-empty__icon" aria-hidden="true">{icon}</div>}
      <div className="sg-empty__title">{title}</div>
      {description && <div className="sg-empty__desc">{description}</div>}
      {actions && <div className="sg-empty__actions">{actions}</div>}
    </div>
  );
}
