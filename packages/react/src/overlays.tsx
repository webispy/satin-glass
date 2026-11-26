import {
  Children, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type HTMLAttributes, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { animate, bloomIn, bloomOut, drag, fade, focusables, longPress, place, prefersReducedMotion, pushLayer, tabFrom, trapFocus, type Placement, timing, easing } from '@satin-glass/core';
import { cx, mergeRefs, useIsoLayoutEffect, usePresence, useStableId } from './utils';
import { Portal, useGlassLight } from './foundation';
import { glassClass } from './glass-class';
import { Button } from './controls';
import { CheckIcon, InfoIcon, SuccessIcon, AlertIcon } from './icons';

import { AnchorSource, useAnchored, useOverlayLifecycle, useRelease, type Anchor, type CloseReason } from './overlay-hooks';
import { useMessages } from './messages';
export type { CloseReason } from './overlay-hooks';

/* ================================================================================================ Dialog */
export type DialogProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** the heading; it names the dialog */
  title: ReactNode;
  children?: ReactNode;
  /** an icon in a tile above the title */
  icon?: ReactNode;
  /** the icon tile's colour: danger for a destructive confirmation */
  tone?: 'accent' | 'danger';
  /** buttons; give each a variant. Stacked automatically when there are three or more. */
  actions?: ReactNode;
  /** a click on the scrim closes it too (leave it off for confirmations); Escape always does */
  dismissible?: boolean;
  /** 'alertdialog' for a confirmation that interrupts; 'dialog' for one that does not need an answer at once */
  role?: 'dialog' | 'alertdialog';
  className?: string;
};

export function Dialog({ open, onClose, title, children, icon, tone = 'accent', actions, dismissible = false, role = 'alertdialog', className }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('sg-dialog');
  const lightRef = useGlassLight();
  const release = useRelease();
  /* Escape calls the latest onClose, not the one from the render the dialog opened in */
  const close = useRef(onClose); close.current = onClose;
  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true, p);
    const trap = trapFocus(p);
    release.set(() => { pop(); trap(); }, { hide: () => pop.pause(true), show: () => { pop.pause(false); trap.resume(); } });
    return bloomIn(p, { x: p.offsetWidth / 2, y: p.offsetHeight / 2 }, 0.9);
  }, () => {
    release.run();
    scrim.current?.classList.remove('is-open');
    return bloomOut(panel.current!, 0.96);
  }, release);
  if (!mounted) return null;
  const many = Children.count(actions) >= 3;
  return (
    <Portal>
      <div ref={scrim} className="sg-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className="sg-dialog-wrap">
        <div ref={mergeRefs(panel, lightRef)} role={role} aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={children ? `${id}-b` : undefined} className={cx('sg-dialog', glassClass('strong', false, 'overlay'), className)}>
          <div className="sg-dialog__scroll">
            {icon && <div className="sg-dialog__icon" data-tone={tone}>{icon}</div>}
            <h2 id={`${id}-t`} className="sg-dialog__title">{title}</h2>
            {children && <div id={`${id}-b`} className="sg-dialog__body">{children}</div>}
            {actions && <div className={cx('sg-dialog__actions', many && 'sg-dialog__actions--stacked')}>{actions}</div>}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Sheet */
export type SheetProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** the heading in the sheet's header; it names the sheet (without one, give an aria-label) */
  title?: ReactNode;
  /** header buttons at the start: Cancel, Back */
  leading?: ReactNode;
  /** header buttons at the end: Done, Save */
  trailing?: ReactNode;
  children?: ReactNode;
  /** 'auto' fits the content; 'full' takes the available height */
  height?: 'auto' | 'full';
  /** centred dialog on wide screens */
  adaptive?: boolean;
  /** a click on the scrim or a swipe down closes it (default true); Escape always does */
  dismissible?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function Sheet({ open, onClose, title, leading, trailing, children, height = 'auto', adaptive = true, dismissible = true, className, 'aria-label': ariaLabel }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const id = useStableId('sg-sheet');
  const lightRef = useGlassLight();
  const release = useRelease();
  const swiped = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  /* read during the drag, so a change while open applies at once (as in the drawer) */
  const canSwipe = useRef(dismissible); canSwipe.current = dismissible;
  const wide = () => adaptive && typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;

  const { mounted } = useOverlayLifecycle(open, () => {
    const p = panel.current!;
    swiped.current = false;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true, p);
    const trap = trapFocus(p);
    /* drag the grabber or header down to dismiss */
    const handle = p.querySelector<HTMLElement>('[data-sg-drag]') ?? p;
    let y = 0;
    const off = drag(handle, {
      axis: 'y', threshold: 4,
      move: ({ dy }) => {
        /* resists upward; a sheet that will not be dismissed resists downward too, so the refusal is felt */
        y = dy > 0 && canSwipe.current ? dy : Math.sign(dy) * Math.sqrt(Math.abs(dy)) * 2;
        p.getAnimations().forEach((a) => a.cancel());
        p.style.transform = `translateY(${y}px)`;
        if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - y / (p.offsetHeight * 1.2)));
      },
      /* a cancelled gesture (the system took the pointer) springs back: only a release dismisses */
      end: ({ vy }, cancelled) => {
        if (!cancelled && canSwipe.current && (y > p.offsetHeight * 0.3 || vy > 900)) { swiped.current = true; close.current('swipe'); return; }
        p.style.transform = '';
        if (scrim.current) scrim.current.style.opacity = '';
        animate(p, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], 'smooth');
        y = 0;
      },
    });
    /* hidden mid-drag (#79): the drag is cancelled (its release would land elsewhere) and the sheet shown again at
       rest, not half dismissed */
    release.set(() => { pop(); trap(); off(); }, { hide: () => { off.cancel(); pop.pause(true); }, show: () => { y = 0; p.style.transform = ''; if (scrim.current) scrim.current.style.opacity = ''; pop.pause(false); trap.resume(); } });
    if (wide()) return bloomIn(p, { x: p.offsetWidth / 2, y: p.offsetHeight / 2 }, 0.94);
    if (prefersReducedMotion(p)) return fade(p, 0, 1, timing.appear);   /* reduced: appears in place */
    return animate(p, [{ transform: 'translateY(calc(100% + 24px))' }, { transform: 'none' }], 'gentle').finished.then(() => undefined, () => undefined);
  }, () => {
    release.run();
    const p = panel.current!;
    scrim.current?.classList.remove('is-open');
    if (scrim.current) scrim.current.style.opacity = '';
    if (wide() && !swiped.current) return bloomOut(p, 0.96);
    const from = p.style.transform || 'none';
    p.getAnimations().forEach((a) => a.cancel());
    if (prefersReducedMotion(p)) return fade(p, 1, 0, timing.leave);
    return p.animate([{ transform: from }, { transform: 'translateY(calc(100% + 24px))' }], { duration: timing.sheetOut, easing: easing.exit, fill: 'both' }).finished.then(() => undefined, () => undefined);
  }, release);
  if (!mounted) return null;
  return (
    <Portal>
      <div ref={scrim} className="sg-scrim" onClick={() => dismissible && onClose('backdrop')} />
      <div className={cx('sg-sheet-wrap', adaptive && 'sg-sheet-wrap--adaptive')}>
        <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="true" aria-labelledby={title ? `${id}-t` : undefined} aria-label={title ? undefined : ariaLabel} className={cx('sg-sheet', height === 'full' && 'sg-sheet--full', glassClass('strong', false, 'overlay'), className)}>
          <div data-sg-drag>
            <div className="sg-sheet__grabber" aria-hidden="true" />
            {(title || leading || trailing) && (
              <div className="sg-sheet__header">
                {leading ?? <span />}
                {title && <h2 id={`${id}-t`} className="sg-sheet__title">{title}</h2>}
                {trailing ?? <span />}
              </div>
            )}
          </div>
          <div className="sg-sheet__body">{children}</div>
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Menu */
type MenuCtx = { select: (onSelect?: () => void) => void };
const MenuContext = createContext<MenuCtx>({ select: () => {} });

export type MenuItemProps = Omit<HTMLAttributes<HTMLButtonElement>, 'onSelect'> & {
  /** an icon before the text */
  icon?: ReactNode;
  /** quiet text at the end, e.g. a keyboard shortcut */
  hint?: ReactNode;
  /** 'danger' colours a destructive item */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** set (true or false) to make a checkable item (menuitemcheckbox) with a check mark when true */
  checked?: boolean;
  /** called when the item is chosen, after the menu has asked to close */
  onSelect?: () => void;
};
export function MenuItem({ icon, hint, tone = 'default', disabled, checked, onSelect, onClick, children, className, ...rest }: MenuItemProps) {
  const { select } = useContext(MenuContext);
  return (
    <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} aria-disabled={disabled || undefined} tabIndex={-1}
      data-tone={tone !== 'default' ? tone : undefined} className={cx('sg-menu__item', className)} {...rest}
      /* the app's onClick runs first and can keep the menu open with preventDefault; it no longer replaces choosing */
      onClick={(e) => { onClick?.(e); if (!disabled && !e.defaultPrevented) select(onSelect); }}>
      {icon}
      <span className="sg-menu__item-label">{children}</span>
      {hint && <span className="sg-menu__item-hint">{hint}</span>}
      {checked && <CheckIcon className="sg-menu__check" />}
    </button>
  );
}
export const MenuSeparator = () => <div className="sg-menu__sep" role="separator" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="sg-menu__label" role="presentation">{children}</div>;

function menuKeys(e: KeyboardEvent<HTMLElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.sg-menu__item:not([aria-disabled="true"])'));
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
  }
  if (n >= 0) { e.preventDefault(); items[n]?.focus(); }
}

export type MenuProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** the element (or a DOMRect in viewport coordinates) the panel opens next to and follows; a click on it does
      not close the panel, and the panel closes when it leaves the layout. Changed from one element to another while
      open, the panel closes; from a point or none, it moves to the new anchor; set to none, it keeps the anchor it
      has (a ref React has let go of, as while Suspense hides the page, reads none). `ref.current` is read when the
      owner renders, and setting a ref does not render: for a panel open from the first render, keep the element in
      state (`ref={setAnchor}`) */
  anchor: Anchor;
  placement?: Placement;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  /** keep the page from scrolling while the menu is open (used by ContextMenu, whose lifted item and scrim
      are a moment of focus) */
  lockScroll?: boolean;
};

/* Tab from inside an anchored panel goes to its layer's own Tab (useAnchored's `tab`); not a Tab the content already
   took (a text area that indents), nor one from a list opened inside it */
function onTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab' || e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
  if (tabFrom(document.activeElement as HTMLElement, e.shiftKey)) e.preventDefault();
}

export function Menu({ open, onClose, anchor, placement = 'bottom-start', children, className, lockScroll, 'aria-label': label }: MenuProps) {
  const lightRef = useGlassLight();
  const { panel, mounted } = useAnchored(open, anchor, placement, onClose, (p) => {
    (p.querySelector<HTMLElement>('.sg-menu__item:not([aria-disabled="true"])') ?? p).focus({ preventScroll: true });
  }, { lockScroll, tab: 'close' });
  const ctx = useMemo<MenuCtx>(() => ({ select: (fn) => { onClose('select'); fn?.(); } }), [onClose]);
  if (!mounted) return null;
  return (
    <Portal className="sg-portal--passthrough sg-portal--anchored">
      <MenuContext.Provider value={ctx}>
        <div ref={mergeRefs(panel, lightRef)} role="menu" aria-label={label} tabIndex={-1} className={cx('sg-menu', glassClass('strong'), className)}
          onKeyDown={(e) => (e.key === 'Tab' ? onTab(e) : menuKeys(e))}>
          <div data-sg-content>{children}</div>
        </div>
      </MenuContext.Provider>
    </Portal>
  );
}

/* ================================================================================================ Popover */
export type PopoverProps = Omit<MenuProps, 'aria-label' | 'lockScroll'> & {
  'aria-label'?: string;
  /** the id of a heading inside that names the popover (in place of `aria-label`) */
  'aria-labelledby'?: string;
};
export function Popover({ open, onClose, anchor, placement = 'bottom', children, className, ...aria }: PopoverProps) {
  const lightRef = useGlassLight();
  /* Tab past the last stop (or Shift+Tab before the first) leaves the popover: its portal sits outside the page's
     order and outside a dialog's focus trap, so the browser's Tab would carry focus off the page */
  const { panel, mounted } = useAnchored(open, anchor, placement, onClose, (p) => { (focusables(p)[0] ?? p).focus({ preventScroll: true }); }, { tab: 'edge' });
  if (!mounted) return null;
  return (
    <Portal className="sg-portal--passthrough sg-portal--anchored">
      <div ref={mergeRefs(panel, lightRef)} role="dialog" tabIndex={-1} className={cx('sg-popover', glassClass('strong'), className)} {...aria} onKeyDown={onTab}>
        <div data-sg-content>{children}</div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Action sheet */
export type ActionSheetAction = { label: ReactNode; onSelect?: () => void; tone?: 'default' | 'danger'; icon?: ReactNode; disabled?: boolean };
export type ActionSheetProps = {
  open: boolean; onClose: (reason: CloseReason) => void;
  /** a quiet heading above the actions; it names the sheet */
  title?: ReactNode;
  /** a line under the title: what the choice is about */
  message?: ReactNode;
  /** the rows, top to bottom; choosing one closes the sheet (onClose 'action'), then calls its onSelect */
  actions: ActionSheetAction[];
  /** the text of the closing row at the foot, which takes focus when the sheet opens (default "Cancel") */
  cancelLabel?: ReactNode;
  /** the sheet's accessible name when it has no `title` */
  'aria-label'?: string;
  /** the id of an element that names the sheet, when it has no `title` (in place of `aria-label`) */
  'aria-labelledby'?: string;
};
export function ActionSheet({ open, onClose, title, message, actions, cancelLabel: cancelProp, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy }: ActionSheetProps) {
  const words = useMessages(), cancelLabel = cancelProp ?? words.cancel;
  const box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  const release = useRelease();
  const id = useStableId('sg-as');
  const l1 = useGlassLight();
  const close = useRef(onClose); close.current = onClose;   /* Escape calls the latest onClose */
  const { mounted } = useOverlayLifecycle(open, () => {
    const b = box.current!;
    scrim.current?.classList.add('is-open');
    const pop = pushLayer(() => close.current('escape'), true, b);
    const trap = trapFocus(b, b.querySelector<HTMLElement>('[data-cancel]'));
    release.set(() => { pop(); trap(); }, { hide: () => pop.pause(true), show: () => { pop.pause(false); trap.resume(); } });
    if (prefersReducedMotion(b)) return fade(b, 0, 1, timing.appear);
    return animate(b, [{ transform: 'translateY(calc(100% + 24px))' }, { transform: 'none' }], 'smooth').finished.then(() => undefined, () => undefined);
  }, () => {
    release.run();
    scrim.current?.classList.remove('is-open');
    if (prefersReducedMotion(box.current)) return fade(box.current!, 1, 0, timing.leave);
    return box.current!.animate([{ transform: 'none' }, { transform: 'translateY(calc(100% + 24px))' }], { duration: timing.actionSheetOut, easing: easing.exit, fill: 'both' }).finished.then(() => undefined, () => undefined);
  }, release);
  if (!mounted) return null;
  /* arrows move between the rows like a menu (Tab still works); Home / End go to the ends */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(box.current?.querySelectorAll<HTMLButtonElement>('.sg-actionsheet__action:not(:disabled)') ?? []);
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    const t = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? (i < 0 ? rows.length - 1 : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : null;
    if (t === null || !rows.length) return;
    e.preventDefault(); rows[(t + rows.length) % rows.length].focus();
  };
  return (
    <Portal>
      <div ref={scrim} className="sg-scrim" onClick={() => onClose('backdrop')} />
      <div className="sg-actionsheet-wrap">
        {/* one glass panel: a heading, the actions as menu rows, and a quiet close row at the foot */}
        <div ref={mergeRefs(box, l1)} className={cx('sg-actionsheet', glassClass('strong', false, 'overlay'))} role="dialog" aria-modal="true"
          aria-labelledby={title ? `${id}-t` : labelledBy} aria-label={title || labelledBy ? undefined : ariaLabel} onKeyDown={onKeyDown}>
          {(title || message) && (
            <div className="sg-actionsheet__head">
              {title && <p id={`${id}-t`} className="sg-actionsheet__title">{title}</p>}
              {message && <p className="sg-actionsheet__message">{message}</p>}
            </div>
          )}
          {actions.map((a, i) => (
            <button key={i} type="button" className="sg-actionsheet__action" data-tone={a.tone === 'danger' ? 'danger' : undefined} disabled={a.disabled} onClick={() => { onClose('action'); a.onSelect?.(); }}>
              {a.icon && <span className="sg-actionsheet__icon" aria-hidden="true">{a.icon}</span>}<span className="sg-actionsheet__label">{a.label}</span>
            </button>
          ))}
          <div className="sg-actionsheet__sep" role="presentation" />
          <button type="button" data-cancel className="sg-actionsheet__action sg-actionsheet__action--cancel" onClick={() => onClose('action')}>{cancelLabel}</button>
        </div>
      </div>
    </Portal>
  );
}

/* ================================================================================================ Context menu */
export type ContextMenuProps = {
  /** the menu's content: MenuItem, MenuLabel and MenuSeparator elements */
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
  const opener = useRef(openMenu); opener.current = openMenu;
  /* the listeners sit on the child's element, which the child can replace (a re-render with another root element):
     a watch on the host's own children moves them to the new one */
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    let bound: HTMLElement | null = null, off = () => {};
    const bind = () => {
      const t = target();
      if (t === bound) return;
      off(); off = () => {}; bound = t;
      if (!t) return;
      const offLong = longPress(t, () => opener.current());
      const ctx = (e: MouseEvent) => { e.preventDefault(); opener.current(); };
      const key = (e: globalThis.KeyboardEvent) => { if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') { e.preventDefault(); opener.current(); } };
      t.addEventListener('contextmenu', ctx); t.addEventListener('keydown', key);
      off = () => { offLong(); t.removeEventListener('contextmenu', ctx); t.removeEventListener('keydown', key); };
    };
    bind();
    const mo = new MutationObserver(bind);
    mo.observe(h, { childList: true });
    return () => { mo.disconnect(); off(); };
  }, []);
  useIsoLayoutEffect(() => {
    if (!state.open || !lift.current) return;
    scrim.current?.classList.add('is-open');
    if (!prefersReducedMotion(lift.current)) animate(lift.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }], 'bouncy', { fill: 'both' });   /* held lifted while open */
  }, [state.open]);
  const close = () => {
    scrim.current?.classList.remove('is-open');
    if (lift.current && prefersReducedMotion(lift.current)) setState((s) => ({ ...s, rect: null }));   /* it never lifted */
    else if (lift.current) {
      lift.current.animate([{ transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: timing.liftReturn, easing: easing.settle, fill: 'both' })
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
        <Portal className="sg-portal--passthrough">
          <div ref={scrim} className="sg-scrim" style={{ pointerEvents: 'auto' }} />
          <div ref={lift} className="sg-lift" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: state.clone }} />
        </Portal>
      )}
      {/* anchored to a point: the item that opened it gives the menu its writing direction */}
      <AnchorSource.Provider value={target}>
        <Menu open={state.open} onClose={close} anchor={anchorRect} placement="bottom-start" aria-label={label} lockScroll>{menu}</Menu>
      </AnchorSource.Provider>
    </>
  );
}

/* ================================================================================================ Toast */
export type ToastOptions = { title: ReactNode; description?: ReactNode; tone?: 'info' | 'success' | 'danger'; icon?: ReactNode; action?: { label: string; onClick: () => void }; duration?: number };
type ToastItem = ToastOptions & { id: number };
const ToastCtx = createContext<(t: ToastOptions) => () => void>(() => () => {});
export const useToast = () => useContext(ToastCtx);

export function Toaster({ children, position = 'top' }: {
  children?: ReactNode;
  /** the edge the toasts appear at, and swipe towards to dismiss */
  position?: 'top' | 'bottom';
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const words = useMessages();
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((t: ToastOptions) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
    return () => remove(id);
  }, [remove]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <Portal className="sg-portal--passthrough sg-portal--toasts">
        <div className={cx('sg-toaster', position === 'bottom' && 'sg-toaster--bottom')} role="region" aria-label={words.notifications}>
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
    const reduced = prefersReducedMotion(el.current);
    el.current.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: from, opacity: 1 }, { transform: `translateY(${sign * 24}px) scale(0.96)`, opacity: 0 }], { duration: reduced ? timing.leave : timing.toastOut, easing: easing.exit, fill: 'both' })
      .finished.then(onDone, onDone);
  }, [onDone, sign]);
  useIsoLayoutEffect(() => {
    const e = el.current!;
    if (prefersReducedMotion(e)) fade(e, 0, 1, timing.appear);
    else animate(e, [{ transform: `translateY(${sign * 28}px) scale(0.94)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 'bouncy');
    const timer = window.setTimeout(leave, t.duration ?? 4000);
    /* swipe toward the edge to dismiss */
    const off = drag(e, {
      axis: 'y', threshold: 4,
      move: ({ dy }) => { const y = dy * sign > 0 ? dy : dy * 0.25; e.getAnimations().forEach((a) => a.cancel()); e.style.transform = `translateY(${y}px)`; },
      end: ({ dy, vy }, cancelled) => {
        if (!cancelled && (dy * sign > 30 || vy * sign > 600)) leave();
        else { const from = e.style.transform; e.style.transform = ''; animate(e, [{ transform: from || 'none' }, { transform: 'none' }], 'snappy'); }
      },
    });
    return () => { clearTimeout(timer); off(); };
  }, []);
  /* the stack reflows when a toast arrives or leaves: glide from the old slot instead of jumping */
  const lastTop = useRef<number | null>(null);
  useIsoLayoutEffect(() => {
    const e = el.current;
    if (!e) return;
    const top = e.offsetTop;
    if (lastTop.current !== null && lastTop.current !== top && !leaving.current) {
      animate(e, [{ translate: `0 ${lastTop.current - top}px` }, { translate: '0 0' }], 'smooth', { composite: 'add' });
    }
    lastTop.current = top;
  });
  const icon = t.icon ?? (t.tone === 'success' ? <SuccessIcon /> : t.tone === 'danger' ? <AlertIcon /> : <InfoIcon />);
  return (
    <div ref={mergeRefs(el, lightRef)} role={t.tone === 'danger' ? 'alert' : 'status'} className={cx('sg-toast', glassClass('strong'))} data-tone={t.tone}>
      <span className="sg-toast__icon">{icon}</span>
      <div className="sg-toast__text">{t.title}{t.description && <small>{t.description}</small>}</div>
      {t.action && <Button size="sm" variant="tinted" onClick={() => { t.action!.onClick(); leave(); }}>{t.action.label}</Button>}
    </div>
  );
}

