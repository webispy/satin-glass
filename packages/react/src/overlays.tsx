import {
  Children, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type HTMLAttributes, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { animate, bloomIn, bloomOut, drag, focusables, longPress, place, prefersReducedMotion, pushLayer, trapFocus, type Placement } from '@glass-layer/core';
import { cx, mergeRefs, useIsoLayoutEffect, usePresence, useStableId } from './utils';
import { Portal, glassClass, useGlassLight } from './foundation';
import { Button } from './controls';
import { CheckIcon, InfoIcon, SuccessIcon, AlertIcon } from './icons';

export type CloseReason = 'escape' | 'backdrop' | 'action' | 'swipe' | 'select';

/** Shared lifecycle: mount → enter animation → (open) → exit animation → unmount. */
function useOverlayLifecycle(open: boolean, enter: () => Promise<void> | void, exit: () => Promise<void>) {
  const { mounted, closing, done } = usePresence(open);
  /* 'idle' → 'open' → 'exiting' → idle. Re-opened while exiting (e.g. a click on another anchor closes and
     re-opens in two events): the exit is abandoned and enter runs again, so the overlay never gets stuck. */
  const phase = useRef<'idle' | 'open' | 'exiting'>('idle');
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

/* ================================================================================================ Dialog */
export type DialogProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  tone?: 'accent' | 'danger';
  /** buttons; give each a variant. Stacked automatically when there are three or more. */
  actions?: ReactNode;
  /** close by clicking the backdrop (off for confirmations) */
  dismissible?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
};

export function Dialog({ open, onClose, title, children, icon, tone = 'accent', actions, dismissible = false, role = 'alertdialog', className }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('gl-dialog');
  const lightRef = useGlassLight();
  const release = useRef<() => void>(() => {});
  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => onClose('escape'), true);
    const trap = trapFocus(p);
    release.current = () => { pop(); trap(); };
    return bloomIn(p, { x: p.offsetWidth / 2, y: p.offsetHeight / 2 }, 0.9);
  }, () => {
    release.current();
    scrim.current?.classList.remove('is-open');
    return bloomOut(panel.current!, 0.96);
  });
  if (!mounted) return null;
  const many = Children.count(actions) >= 3;
  return (
    <Portal>
      <div ref={scrim} className="gl-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className="gl-dialog-wrap">
        <div ref={mergeRefs(panel, lightRef)} role={role} aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={children ? `${id}-b` : undefined} className={cx('gl-dialog', glassClass('strong'), className)}>
          {icon && <div className="gl-dialog__icon" data-tone={tone}>{icon}</div>}
          <h2 id={`${id}-t`} className="gl-dialog__title">{title}</h2>
          {children && <div id={`${id}-b`} className="gl-dialog__body">{children}</div>}
          {actions && <div className={cx('gl-dialog__actions', many && 'gl-dialog__actions--stacked')}>{actions}</div>}
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Sheet */
export type SheetProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  title?: ReactNode;
  /** header buttons */
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  /** 'auto' fits the content; 'full' takes most of the screen */
  size?: 'auto' | 'full';
  /** centred dialog on wide screens */
  adaptive?: boolean;
  dismissible?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function Sheet({ open, onClose, title, leading, trailing, children, size = 'auto', adaptive = true, dismissible = true, className, 'aria-label': ariaLabel }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('gl-sheet');
  const lightRef = useGlassLight();
  const release = useRef<() => void>(() => {});
  const swiped = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const wide = () => adaptive && typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;

  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    swiped.current = false;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true);
    const trap = trapFocus(p);
    /* drag the grabber or header down to dismiss */
    const handle = p.querySelector<HTMLElement>('[data-gl-drag]') ?? p;
    let y = 0;
    const off = drag(handle, {
      axis: 'y', threshold: 4,
      move: ({ dy }) => {
        y = dy > 0 ? dy : -Math.sqrt(-dy) * 2; /* resists upward */
        p.getAnimations().forEach((a) => a.cancel());
        p.style.transform = `translateY(${y}px)`;
        if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - y / (p.offsetHeight * 1.2)));
      },
      end: ({ vy }) => {
        if (y > p.offsetHeight * 0.3 || vy > 900) { swiped.current = true; close.current('swipe'); return; }
        p.style.transform = '';
        if (scrim.current) scrim.current.style.opacity = '';
        animate(p, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], 'smooth');
        y = 0;
      },
    });
    release.current = () => { pop(); trap(); off(); };
    if (wide()) return bloomIn(p, { x: p.offsetWidth / 2, y: p.offsetHeight / 2 }, 0.94);
    if (prefersReducedMotion()) return;
    return animate(p, [{ transform: 'translateY(calc(100% + 24px))' }, { transform: 'none' }], 'gentle').finished.then(() => undefined, () => undefined);
  }, () => {
    release.current();
    const p = panel.current!;
    scrim.current?.classList.remove('is-open');
    if (scrim.current) scrim.current.style.opacity = '';
    if (wide() && !swiped.current) return bloomOut(p, 0.96);
    const from = p.style.transform || 'none';
    p.getAnimations().forEach((a) => a.cancel());
    return p.animate([{ transform: from }, { transform: 'translateY(calc(100% + 24px))' }], { duration: prefersReducedMotion() ? 1 : 260, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'both' }).finished.then(() => undefined, () => undefined);
  });
  if (!mounted) return null;
  return (
    <Portal>
      <div ref={scrim} className="gl-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className={cx('gl-sheet-wrap', adaptive && 'gl-sheet-wrap--adaptive')}>
        <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined} aria-label={title ? undefined : ariaLabel} className={cx('gl-sheet', size === 'full' && 'gl-sheet--full', glassClass('strong'), className)}>
          <div data-gl-drag>
            <div className="gl-sheet__grabber" aria-hidden="true" />
            {(title || leading || trailing) && (
              <div className="gl-sheet__header">
                {leading ?? <span />}
                {title && <h2 id={`${id}-t`} className="gl-sheet__title">{title}</h2>}
                {trailing ?? <span />}
              </div>
            )}
          </div>
          <div className="gl-sheet__body">{children}</div>
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Menu */
type MenuCtx = { select: (onSelect?: () => void) => void };
const MenuContext = createContext<MenuCtx>({ select: () => {} });

export type MenuItemProps = Omit<HTMLAttributes<HTMLButtonElement>, 'onSelect'> & {
  icon?: ReactNode; hint?: ReactNode; tone?: 'default' | 'danger'; disabled?: boolean; checked?: boolean;
  onSelect?: () => void;
};
export function MenuItem({ icon, hint, tone = 'default', disabled, checked, onSelect, children, className, ...rest }: MenuItemProps) {
  const { select } = useContext(MenuContext);
  return (
    <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} aria-disabled={disabled || undefined} tabIndex={-1}
      data-tone={tone !== 'default' ? tone : undefined} className={cx('gl-menu__item', className)}
      onClick={() => !disabled && select(onSelect)} {...rest}>
      {icon}
      <span className="gl-menu__item-label">{children}</span>
      {hint && <span className="gl-menu__item-hint">{hint}</span>}
      {checked && <CheckIcon className="gl-menu__check" />}
    </button>
  );
}
export const MenuSeparator = () => <div className="gl-menu__sep" role="separator" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="gl-menu__label" role="presentation">{children}</div>;

function menuKeys(e: KeyboardEvent<HTMLElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.gl-menu__item:not([aria-disabled="true"])'));
  const i = items.indexOf(document.activeElement as HTMLElement);
  let n = -1;
  if (e.key === 'ArrowDown') n = (i + 1) % items.length;
  else if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = items.length - 1;
  else if (e.key.length === 1 && /\S/.test(e.key)) {
    const k = e.key.toLowerCase();
    n = items.findIndex((it, j) => j > i && it.textContent?.trim().toLowerCase().startsWith(k));
    if (n < 0) n = items.findIndex((it) => it.textContent?.trim().toLowerCase().startsWith(k));
  } else if (e.key === 'Tab') { e.preventDefault(); return; }
  if (n >= 0) { e.preventDefault(); items[n]?.focus(); }
}

type Anchor = HTMLElement | DOMRect | null | undefined;
const rectOf = (a: Anchor) => (a instanceof HTMLElement ? a.getBoundingClientRect() : a ?? new DOMRect(innerWidth / 2, innerHeight / 2, 0, 0));

/** Anchored floating panel shared by Menu and Popover. */
function useAnchored(open: boolean, anchor: Anchor, placement: Placement, onClose: (r: CloseReason) => void, focusFirst: (p: HTMLElement) => void) {
  const panel = useRef<HTMLDivElement>(null);
  const release = useRef<() => void>(() => {});
  const close = useRef(onClose); close.current = onClose;
  const before = useRef<Element | null>(null);
  const life = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    before.current = document.activeElement;
    const r = rectOf(anchor);
    const at = place({ width: p.offsetWidth, height: p.offsetHeight }, r, placement);
    p.style.left = `${at.x}px`; p.style.top = `${at.y}px`; p.dataset.side = at.side;
    const pop = pushLayer(() => close.current('escape'), false);
    const outside = (e: PointerEvent) => {
      if (p.contains(e.target as Node)) return;
      if (anchor instanceof HTMLElement && anchor.contains(e.target as Node)) return; /* the anchor toggles itself */
      close.current('backdrop');
    };
    const onScroll = (e: Event) => { if (!p.contains(e.target as Node)) close.current('backdrop'); };
    document.addEventListener('pointerdown', outside, true);
    /* listen for scrolling only from the next frames on: a scroll queued before opening (e.g. the anchor was
       just scrolled into view) is delivered a frame late and must not close the panel it preceded */
    let armed = true;
    const arm = requestAnimationFrame(() => requestAnimationFrame(() => { if (armed) window.addEventListener('scroll', onScroll, true); }));
    release.current = () => {
      pop();
      armed = false; cancelAnimationFrame(arm);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', onScroll, true);
      /* Safari does not focus a button on click: fall back to the anchor so focus still goes home */
      const prev = before.current as HTMLElement | null;
      const b = (!prev || prev === document.body) && anchor instanceof HTMLElement ? anchor : prev;
      if (b && document.contains(b) && (p.contains(document.activeElement) || document.activeElement === document.body)) b.focus({ preventScroll: true });
    };
    focusFirst(p);
    /* unfold away from the anchor: the axis pointing away from it starts flatter */
    const vertical = at.side === 'top' || at.side === 'bottom';
    return bloomIn(p, { x: at.originX, y: at.originY }, vertical ? [0.6, 0.3] : [0.3, 0.6], 'pop');
  }, () => {
    release.current();
    const vertical = (panel.current!.dataset.side ?? 'bottom').match(/top|bottom/);
    return bloomOut(panel.current!, vertical ? [0.7, 0.45] : [0.45, 0.7], 150);
  });
  return { panel, ...life };
}

export type MenuProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  anchor: Anchor;
  placement?: Placement;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
};

export function Menu({ open, onClose, anchor, placement = 'bottom-start', children, className, 'aria-label': label }: MenuProps) {
  const lightRef = useGlassLight();
  const { panel, mounted } = useAnchored(open, anchor, placement, onClose, (p) => {
    (p.querySelector<HTMLElement>('.gl-menu__item:not([aria-disabled="true"])') ?? p).focus({ preventScroll: true });
  });
  const ctx = useMemo<MenuCtx>(() => ({ select: (fn) => { onClose('select'); fn?.(); } }), [onClose]);
  if (!mounted) return null;
  return (
    <Portal className="gl-portal--passthrough">
      <MenuContext.Provider value={ctx}>
        <div ref={mergeRefs(panel, lightRef)} role="menu" aria-label={label} tabIndex={-1} className={cx('gl-menu', glassClass('strong'), className)} onKeyDown={menuKeys}>
          <div data-gl-content>{children}</div>
        </div>
      </MenuContext.Provider>
    </Portal>
  );
}

/* ================================================================================================ Popover */
export type PopoverProps = Omit<MenuProps, 'aria-label'> & { 'aria-label'?: string; 'aria-labelledby'?: string };
export function Popover({ open, onClose, anchor, placement = 'bottom', children, className, ...aria }: PopoverProps) {
  const lightRef = useGlassLight();
  const { panel, mounted } = useAnchored(open, anchor, placement, onClose, (p) => { (focusables(p)[0] ?? p).focus({ preventScroll: true }); });
  if (!mounted) return null;
  return (
    <Portal className="gl-portal--passthrough">
      <div ref={mergeRefs(panel, lightRef)} role="dialog" tabIndex={-1} className={cx('gl-popover', glassClass('strong'), className)} {...aria}>
        <div data-gl-content>{children}</div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Action sheet */
export type ActionSheetAction = { label: ReactNode; onSelect?: () => void; tone?: 'default' | 'danger'; icon?: ReactNode; disabled?: boolean };
export type ActionSheetProps = {
  open: boolean; onClose: (reason: CloseReason) => void;
  title?: ReactNode; message?: ReactNode; actions: ActionSheetAction[]; cancelLabel?: ReactNode;
};
export function ActionSheet({ open, onClose, title, message, actions, cancelLabel = 'Cancel' }: ActionSheetProps) {
  const box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const release = useRef<() => void>(() => {});
  const id = useStableId('gl-as');
  const l1 = useGlassLight(), l2 = useGlassLight();
  const { mounted } = useOverlayLifecycle(open, () => {
    const b = box.current!;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => onClose('escape'), true);
    const trap = trapFocus(b, b.querySelector<HTMLElement>('[data-cancel]'));
    release.current = () => { pop(); trap(); };
    if (prefersReducedMotion()) return;
    return animate(b, [{ transform: 'translateY(calc(100% + 24px))' }, { transform: 'none' }], 'smooth').finished.then(() => undefined, () => undefined);
  }, () => {
    release.current();
    scrim.current?.classList.remove('is-open');
    return box.current!.animate([{ transform: 'none' }, { transform: 'translateY(calc(100% + 24px))' }], { duration: prefersReducedMotion() ? 1 : 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'both' }).finished.then(() => undefined, () => undefined);
  });
  if (!mounted) return null;
  return (
    <Portal>
      <div ref={scrim} className="gl-scrim" onClick={() => onClose('backdrop')} />
      <div className="gl-actionsheet-wrap">
        <div ref={box} className="gl-actionsheet" role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined}>
          <div ref={l1} className={cx('gl-actionsheet__group', glassClass('strong'))}>
            {(title || message) && (
              <div className="gl-actionsheet__head">
                {title && <p id={`${id}-t`} className="gl-actionsheet__title">{title}</p>}
                {message && <p className="gl-actionsheet__message">{message}</p>}
              </div>
            )}
            {actions.map((a, i) => (
              <button key={i} type="button" className="gl-actionsheet__action" data-tone={a.tone === 'danger' ? 'danger' : undefined} disabled={a.disabled} onClick={() => { onClose('action'); a.onSelect?.(); }}>
                {a.icon}{a.label}
              </button>
            ))}
          </div>
          <div ref={l2} className={cx('gl-actionsheet__group', glassClass('strong'))}>
            <button type="button" data-cancel className="gl-actionsheet__action gl-actionsheet__action--cancel" onClick={() => onClose('action')}>{cancelLabel}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Context menu */
export type ContextMenuProps = {
  /** MenuItems */
  menu: ReactNode;
  /** a single element; long press, right click, Shift+F10 or the Menu key open the menu */
  children: ReactElement;
  /** element inside the child to lift (defaults to the whole child) */
  previewSelector?: string;
  'aria-label'?: string;
};

export function ContextMenu({ menu, children, previewSelector, 'aria-label': label }: ContextMenuProps) {
  const host = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ open: boolean; rect: DOMRect | null; clone: string }>({ open: false, rect: null, clone: '' });
  const lift = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const target = () => host.current?.firstElementChild as HTMLElement | null;
  const openMenu = useCallback(() => {
    const t = target();
    if (!t) return;
    const src = (previewSelector ? t.querySelector<HTMLElement>(previewSelector) : null) ?? t;
    setState({ open: true, rect: src.getBoundingClientRect(), clone: src.outerHTML });
  }, [previewSelector]);
  useEffect(() => {
    const t = target();
    if (!t) return;
    const offLong = longPress(t, () => openMenu());
    const ctx = (e: MouseEvent) => { e.preventDefault(); openMenu(); };
    const key = (e: globalThis.KeyboardEvent) => { if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') { e.preventDefault(); openMenu(); } };
    t.addEventListener('contextmenu', ctx); t.addEventListener('keydown', key);
    return () => { offLong(); t.removeEventListener('contextmenu', ctx); t.removeEventListener('keydown', key); };
  }, [openMenu]);
  useIsoLayoutEffect(() => {
    if (!state.open || !lift.current) return;
    scrim.current?.classList.add('is-open');
    animate(lift.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }], 'bouncy');
  }, [state.open]);
  const close = () => {
    scrim.current?.classList.remove('is-open');
    if (lift.current) {
      lift.current.animate([{ transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out', fill: 'both' })
        .finished.then(() => setState((s) => ({ ...s, rect: null })), () => setState((s) => ({ ...s, rect: null })));
    }
    setState((s) => ({ ...s, open: false }));
  };
  const r = state.rect;
  /* the menu anchors below the lifted item, or above it when there is no room */
  const anchorRect = r ? new DOMRect(r.left, r.top - 6, r.width, r.height + 12) : null;
  return (
    <>
      <span ref={host} style={{ display: 'contents' }}>{children}</span>
      {r && (
        <Portal className="gl-portal--passthrough">
          <div ref={scrim} className="gl-scrim" style={{ pointerEvents: 'auto' }} />
          <div ref={lift} className="gl-lift" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: state.clone }} />
        </Portal>
      )}
      <Menu open={state.open} onClose={close} anchor={anchorRect} placement="bottom-start" aria-label={label}>{menu}</Menu>
    </>
  );
}

/* ================================================================================================ Toast */
export type ToastOptions = { title: ReactNode; description?: ReactNode; tone?: 'info' | 'success' | 'danger'; icon?: ReactNode; action?: { label: string; onClick: () => void }; duration?: number };
type ToastItem = ToastOptions & { id: number };
const ToastCtx = createContext<(t: ToastOptions) => () => void>(() => () => {});
export const useToast = () => useContext(ToastCtx);

export function Toaster({ children, position = 'top' }: { children?: ReactNode; position?: 'top' | 'bottom' }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((t: ToastOptions) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
    return () => remove(id);
  }, [remove]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <Portal className="gl-portal--passthrough">
        <div className={cx('gl-toaster', position === 'bottom' && 'gl-toaster--bottom')} role="region" aria-label="Notifications">
          {items.map((t) => <ToastView key={t.id} t={t} edge={position} onDone={() => remove(t.id)} />)}
        </div>
      </Portal>
    </ToastCtx.Provider>
  );
}

function ToastView({ t, edge, onDone }: { t: ToastItem; edge: 'top' | 'bottom'; onDone: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const lightRef = useGlassLight();
  const leaving = useRef(false);
  const sign = edge === 'top' ? -1 : 1;
  const leave = useCallback(() => {
    if (leaving.current || !el.current) return;
    leaving.current = true;
    const from = el.current.style.transform || 'none';
    el.current.animate([{ transform: from, opacity: 1 }, { transform: `translateY(${sign * 24}px) scale(0.96)`, opacity: 0 }], { duration: prefersReducedMotion() ? 1 : 200, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'both' })
      .finished.then(onDone, onDone);
  }, [onDone, sign]);
  useIsoLayoutEffect(() => {
    const e = el.current!;
    animate(e, [{ transform: `translateY(${sign * 28}px) scale(0.94)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 'bouncy');
    const timer = window.setTimeout(leave, t.duration ?? 4000);
    /* swipe toward the edge to dismiss */
    const off = drag(e, {
      axis: 'y', threshold: 4,
      move: ({ dy }) => { const y = dy * sign > 0 ? dy : dy * 0.25; e.getAnimations().forEach((a) => a.cancel()); e.style.transform = `translateY(${y}px)`; },
      end: ({ dy, vy }) => {
        if (dy * sign > 30 || vy * sign > 600) leave();
        else { const from = e.style.transform; e.style.transform = ''; animate(e, [{ transform: from || 'none' }, { transform: 'none' }], 'snappy'); }
      },
    });
    return () => { clearTimeout(timer); off(); };
  }, []);
  const icon = t.icon ?? (t.tone === 'success' ? <SuccessIcon /> : t.tone === 'danger' ? <AlertIcon /> : <InfoIcon />);
  return (
    <div ref={mergeRefs(el, lightRef)} role={t.tone === 'danger' ? 'alert' : 'status'} className={cx('gl-toast', glassClass('strong'))} data-tone={t.tone}>
      <span className="gl-toast__icon">{icon}</span>
      <div className="gl-toast__text">{t.title}{t.description && <small>{t.description}</small>}</div>
      {t.action && <Button size="sm" variant="tinted" onClick={() => { t.action!.onClick(); leave(); }}>{t.action.label}</Button>}
    </div>
  );
}

