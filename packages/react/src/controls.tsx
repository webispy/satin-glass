import {
  Children, forwardRef, isValidElement, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ElementType, type HTMLAttributes, type InputHTMLAttributes,
  type KeyboardEvent, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from 'react';
import { createBridge, drag, type Bridge } from '@glass-layer/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { glassClass, useGlassLight } from './foundation';
import { ClearIcon, MinusIcon, PlusIcon, SearchIcon, CloseIcon } from './icons';

/* ================================================================================================ Spinner */
export function Spinner({ size = 20, label = 'Loading', className, style }: { size?: number; label?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg className={cx('gl-spinner', className)} viewBox="0 0 24 24" role="progressbar" aria-label={label} style={{ '--_s': `${size}px`, ...style } as CSSProperties}>
      <circle className="gl-spinner__track" cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="9" strokeDasharray="18 100" />
    </svg>
  );
}

/* ================================================================================================ Button */
export type ButtonVariant = 'filled' | 'tinted' | 'glass' | 'plain' | 'neutral';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'accent' | 'danger' | 'neutral';
  shape?: 'rounded' | 'round';
  block?: boolean;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** render as another element, e.g. 'a' */
  component?: ElementType;
  href?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'tinted', size = 'md', tone = 'accent', shape = 'rounded', block, loading, startIcon, endIcon, component, className, children, disabled, type, ...rest }, ref,
) {
  const Comp = (component ?? 'button') as ElementType;
  const glass = variant === 'glass';
  const lightRef = useGlassLight(glass);
  return (
    <Comp
      ref={mergeRefs(ref, glass ? lightRef : undefined)}
      type={Comp === 'button' ? type ?? 'button' : undefined}
      disabled={Comp === 'button' ? disabled || loading : undefined}
      aria-disabled={Comp !== 'button' && disabled ? true : undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-tone={tone !== 'accent' ? tone : undefined}
      className={cx('gl-button', `gl-button--${variant}`, size !== 'md' && `gl-button--${size}`, shape === 'round' && 'gl-button--round', block && 'gl-button--block', glass && glassClass('regular'), className)}
      {...rest}
    >
      {startIcon}
      {children !== undefined && children !== null && <span>{children}</span>}
      {endIcon}
      {loading && <span className="gl-button__spinner"><Spinner size={size === 'sm' ? 16 : 18} /></span>}
    </Comp>
  );
});

export type IconButtonProps = Omit<ButtonProps, 'startIcon' | 'endIcon' | 'children'> & { icon: ReactNode; label: string };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, className, variant = 'plain', ...rest }, ref) {
  return <Button ref={ref} variant={variant} aria-label={label} title={rest.title ?? label} className={cx('gl-button--icon', className)} startIcon={icon} {...rest} />;
});

export const ButtonGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { vertical?: boolean; glass?: boolean }>(function ButtonGroup({ vertical, glass = true, className, ...rest }, ref) {
  const lightRef = useGlassLight(glass);
  return <div ref={mergeRefs(ref, lightRef)} role="group" className={cx('gl-button-group', vertical && 'gl-button-group--vertical', glass && glassClass('regular'), className)} {...rest} />;
});

/* ================================================================================================ Switch */
export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value' | 'defaultValue'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, defaultChecked = false, onChange, size = 'md', className, disabled, onClick, ...rest }, ref) {
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  const el = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const onRef = useRef(on); onRef.current = on;
  /* press / drag looks live in React state so a re-render never strips them mid-gesture */
  const [pressed, setPressed] = useState(false);
  const [draggingSw, setDraggingSw] = useState(false);

  useEffect(() => {
    const b = el.current;
    if (!b || disabled) return;
    let x0 = 0, max = 0, startOn = false;
    const thumb = () => b.querySelector<HTMLElement>('.gl-switch__thumb')!;
    return drag(b, {
      axis: 'x',
      start: () => {
        dragged.current = false; startOn = onRef.current;
        const cs = getComputedStyle(b), w = b.clientWidth, t = thumb().offsetHeight, pad = parseFloat(cs.getPropertyValue('--_pad')) || 2;
        max = w - t - 2 * pad; x0 = startOn ? max : 0;
        setPressed(true);
      },
      move: ({ dx }) => {
        if (!dragged.current && Math.abs(dx) < 4) return;
        if (!dragged.current) setDraggingSw(true);
        dragged.current = true;
        const x = Math.min(max, Math.max(0, x0 + dx));
        thumb().style.setProperty('--_x', `${x}px`);
        b.dataset.drag = x > max / 2 ? 'on' : 'off';
      },
      end: (_i, cancelled) => {
        const th = thumb();
        setDraggingSw(false);
        if (dragged.current && !cancelled) {
          const next = b.dataset.drag === 'on';
          th.style.removeProperty('--_x');
          if (next !== startOn) setOn(next);
        } else th.style.removeProperty('--_x');
        delete b.dataset.drag;
        /* keep the press look until the click has toggled, so the thumb never snaps back for a frame */
        requestAnimationFrame(() => requestAnimationFrame(() => setPressed(false)));
      },
    });
  }, [disabled, setOn]);

  return (
    <button
      ref={mergeRefs(ref, el)}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={cx('gl-switch', size === 'sm' && 'gl-switch--sm', pressed && 'is-pressed', draggingSw && 'is-dragging', className)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (dragged.current) { dragged.current = false; return; }
        setOn(!on);
      }}
      {...rest}
    >
      <span className="gl-switch__thumb" />
    </button>
  );
});

/* ================================================================================================ Slider */
export type SliderProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** fires once when the user lets go */
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** text in the bubble and for screen readers */
  format?: (value: number) => string;
  showValue?: boolean;
};

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { value, defaultValue = 0, onChange, onChangeEnd, min = 0, max = 100, step = 1, disabled, format = (v) => String(v), showValue = true, className, style, ...rest }, ref,
) {
  const [v, setV] = useControllable(value, defaultValue, onChange);
  const el = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const vRef = useRef(v); vRef.current = v;
  const snap = (x: number) => {
    const s = Math.round((x - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(s.toFixed(6))));
  };

  useIsoLayoutEffect(() => {
    const s = el.current;
    if (!s) return;
    const set = () => s.style.setProperty('--_w', `${s.clientWidth}px`);
    set();
    const ro = new ResizeObserver(set); ro.observe(s);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const s = el.current;
    if (!s || disabled) return;
    const at = (clientX: number) => {
      const r = s.getBoundingClientRect();
      return snap(min + ((clientX - r.left) / r.width) * (max - min));
    };
    return drag(s, {
      start: ({ x, event }) => {
        setActive(true); setDragging(true);
        s.focus({ preventScroll: true });
        event.preventDefault();
        const nv = at(x); if (nv !== vRef.current) setV(nv);
      },
      move: ({ x }) => { const nv = at(x); if (nv !== vRef.current) setV(nv); },
      end: () => { setDragging(false); setActive(false); onChangeEnd?.(vRef.current); },
    });
  }, [disabled, min, max, step]);

  const onKey = (e: KeyboardEvent) => {
    const big = Math.max(step, (max - min) / 10);
    const map: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big };
    let nv: number | undefined;
    if (e.key in map) nv = snap(v + map[e.key]);
    else if (e.key === 'Home') nv = min;
    else if (e.key === 'End') nv = max;
    if (nv === undefined) return;
    e.preventDefault();
    setV(nv); onChangeEnd?.(nv);
  };
  const p = (v - min) / (max - min || 1);

  return (
    <div
      ref={mergeRefs(ref, el)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={v} aria-valuetext={format(v)}
      aria-disabled={disabled || undefined}
      className={cx('gl-slider', active && 'is-active', dragging && 'is-dragging', className)}
      style={{ '--_p': p, ...style } as CSSProperties}
      onKeyDown={onKey}
      {...rest}
    >
      <span className="gl-slider__track"><span className="gl-slider__fill" /></span>
      <span className="gl-slider__thumb" />
      {showValue && <span className={cx('gl-slider__bubble', glassClass('strong'))} aria-hidden="true">{format(v)}</span>}
    </div>
  );
});

/* ================================================================================================ Stepper */
export type StepperProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  value?: number; defaultValue?: number; onChange?: (v: number) => void;
  min?: number; max?: number; step?: number; format?: (v: number) => ReactNode; label?: string;
};
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper({ value, defaultValue = 0, onChange, min = -Infinity, max = Infinity, step = 1, format = (v) => v, label = 'Value', className, ...rest }, ref) {
  const [v, setV] = useControllable(value, defaultValue, onChange);
  const vr = useRef(v); vr.current = v;
  const timer = useRef<{ t?: number; i?: number }>({});
  const bump = (d: number) => {
    const nv = Math.min(max, Math.max(min, Number((vr.current + d).toFixed(6))));
    if (nv !== vr.current) { vr.current = nv; setV(nv); }
  };
  /* hold to repeat: after 400 ms, every 80 ms */
  const hold = (d: number) => () => {
    stop();
    timer.current.t = window.setTimeout(() => { timer.current.i = window.setInterval(() => bump(d), 80); }, 400);
  };
  const stop = () => { clearTimeout(timer.current.t); clearInterval(timer.current.i); };
  useEffect(() => stop, []);
  return (
    <div ref={ref} role="group" aria-label={label} className={cx('gl-stepper', className)} {...rest}>
      <button type="button" className="gl-stepper__btn" aria-label={`Decrease ${label}`} disabled={v <= min} onClick={() => bump(-step)} onPointerDown={hold(-step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><MinusIcon /></button>
      <span className="gl-stepper__value" aria-live="polite">{format(v)}</span>
      <button type="button" className="gl-stepper__btn" aria-label={`Increase ${label}`} disabled={v >= max} onClick={() => bump(step)} onPointerDown={hold(step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><PlusIcon /></button>
    </div>
  );
});

/* ================================================================================================ Segmented control */
export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean };
export type SegmentedControlProps<T extends string> = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  options: SegmentOption<T>[];
  value?: T; defaultValue?: T; onChange?: (v: T) => void;
  size?: 'sm' | 'md';
  'aria-label'?: string;
};

/** Shared by SegmentedControl and TabBar: the droplet-bridge indicator. */
function useBridge(container: React.RefObject<HTMLElement | null>, indicator: React.RefObject<HTMLElement | null>, index: number, onDragCommit: (i: number) => void, draggable = true) {
  const bridge = useRef<Bridge | null>(null);
  const commit = useRef(onDragCommit); commit.current = onDragCommit;
  useIsoLayoutEffect(() => {
    const c = container.current, ind = indicator.current;
    if (!c || !ind) return;
    const items = () => Array.from(c.querySelectorAll<HTMLElement>(':scope > [data-gl-item]'));
    bridge.current = createBridge(c, ind, {
      items, draggable,
      onDragCommit: (i) => commit.current(i),
      onHover: (i) => items().forEach((el, j) => el.toggleAttribute('data-hover', i === j)),
    });
    bridge.current.moveTo(index, false);
    return () => { bridge.current?.destroy(); bridge.current = null; };
  }, []);
  useIsoLayoutEffect(() => { bridge.current?.moveTo(index); }, [index]);
}

function rovingKeys(e: KeyboardEvent<HTMLElement>, count: number, current: number, select: (i: number) => void) {
  const k = e.key, dir = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
  let next = -1;
  if (dir) next = (current + dir + count) % count;
  else if (k === 'Home') next = 0;
  else if (k === 'End') next = count - 1;
  if (next < 0) return;
  e.preventDefault();
  select(next);
  const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(':scope > [data-gl-item]');
  items[next]?.focus();
}

export function SegmentedControl<T extends string>({ options, value, defaultValue, onChange, size = 'md', className, ...rest }: SegmentedControlProps<T>) {
  const [v, setV] = useControllable(value, defaultValue ?? options[0]?.value, onChange);
  const box = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === v));
  useBridge(box, ind, index, (i) => !options[i].disabled && setV(options[i].value));
  return (
    <div ref={box} role="radiogroup" className={cx('gl-segmented', size === 'sm' && 'gl-segmented--sm', className)} onKeyDown={(e) => rovingKeys(e, options.length, index, (i) => setV(options[i].value))} {...rest}>
      <span ref={ind} className="gl-segmented__indicator" aria-hidden="true" />
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" data-gl-item aria-checked={i === index} tabIndex={i === index ? 0 : -1} disabled={o.disabled} className="gl-segmented__item" onClick={() => setV(o.value)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================================================ TabBar */
export type TabProps = { value: string; label: ReactNode; icon?: ReactNode; badge?: ReactNode; disabled?: boolean };
/** Declarative child of TabBar (rendered by TabBar). */
export function Tab(_: TabProps): null { return null; }

export type TabBarProps = Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'defaultValue'> & {
  value?: string; defaultValue?: string; onChange?: (v: string) => void;
  children: ReactElement<TabProps> | ReactElement<TabProps>[];
  /** a separate glass button beside the bar (e.g. search) */
  action?: ReactNode;
  compact?: boolean;
  'aria-label'?: string;
};

export const TabBar = forwardRef<HTMLElement, TabBarProps>(function TabBar({ value, defaultValue, onChange, children, action, compact, className, 'aria-label': label = 'Tabs', ...rest }, ref) {
  const tabs = Children.toArray(children).filter(isValidElement).map((c) => (c as ReactElement<TabProps>).props);
  const [v, setV] = useControllable(value, defaultValue ?? tabs[0]?.value, onChange);
  const bar = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const lightRef = useGlassLight();
  const index = Math.max(0, tabs.findIndex((t) => t.value === v));
  useBridge(bar, ind, index, (i) => !tabs[i].disabled && setV(tabs[i].value));
  return (
    <nav ref={ref} className={cx('gl-tabbar', compact && 'gl-tabbar--compact', className)} aria-label={label} {...rest}>
      <div ref={mergeRefs(bar, lightRef)} role="tablist" className={cx('gl-tabbar__bar', glassClass('regular'))} onKeyDown={(e) => rovingKeys(e, tabs.length, index, (i) => setV(tabs[i].value))}>
        <span ref={ind} className="gl-tabbar__indicator" aria-hidden="true" />
        {tabs.map((t, i) => (
          <button key={t.value} type="button" role="tab" data-gl-item aria-selected={i === index} tabIndex={i === index ? 0 : -1} disabled={t.disabled} aria-label={compact && typeof t.label === 'string' ? t.label : undefined} className="gl-tabbar__item" onClick={() => setV(t.value)}>
            {t.icon}
            <span className="gl-tabbar__label">{t.label}</span>
            {t.badge}
          </button>
        ))}
      </div>
      {action}
    </nav>
  );
});

/** The glass button that sits beside a TabBar. */
export const TabBarAction = forwardRef<HTMLButtonElement, Omit<IconButtonProps, 'variant'>>(function TabBarAction({ className, ...rest }, ref) {
  return <IconButton ref={ref} variant="glass" className={cx('gl-tabbar__action', className)} {...rest} />;
});

/* ================================================================================================ TextField */
type FieldBase = {
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  startAdornment?: ReactNode; endAdornment?: ReactNode;
  clearable?: boolean; onClear?: () => void;
  fieldClassName?: string;
};
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldBase & { multiline?: false };
export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBase & { multiline: true };

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps | TextAreaFieldProps>(function TextField(props, ref) {
  const { label, helperText, error, startAdornment, endAdornment, clearable, onClear, fieldClassName, className, id, multiline, disabled, ...rest } = props as TextFieldProps & { multiline?: boolean };
  const auto = useStableId('gl-field');
  const fid = id ?? auto;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [filled, setFilled] = useState(Boolean(rest.value ?? rest.defaultValue));
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const helpId = help ? `${fid}-help` : undefined;
  const common = {
    id: fid, className: 'gl-field__input', disabled, 'aria-invalid': invalid || undefined, 'aria-describedby': helpId,
  };
  const userOnInput = (rest as { onInput?: (e: never) => void }).onInput;
  const onInput = (e: { currentTarget: { value: string } }) => { setFilled(Boolean(e.currentTarget.value)); userOnInput?.(e as never); };
  useEffect(() => { if (rest.value !== undefined) setFilled(Boolean(rest.value)); }, [rest.value]);
  const clear = () => {
    const el = inputRef.current;
    if (!el) return;
    if (rest.value === undefined) { el.value = ''; setFilled(false); }
    onClear?.();
    el.focus();
  };
  return (
    <div className={cx('gl-field', fieldClassName)} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {label && <label className="gl-field__label" htmlFor={fid}>{label}</label>}
      <div className={cx('gl-field__control', className)}>
        {startAdornment && <span className="gl-field__adorn">{startAdornment}</span>}
        {multiline
          ? <textarea ref={mergeRefs(ref as React.Ref<HTMLTextAreaElement>, inputRef as React.Ref<HTMLTextAreaElement>)} {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} onInput={onInput} />
          : <input ref={mergeRefs(ref as React.Ref<HTMLInputElement>, inputRef as React.Ref<HTMLInputElement>)} {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} onInput={onInput} />}
        {clearable && filled && !disabled && <button type="button" className="gl-field__clear" aria-label="Clear" onClick={clear}><ClearIcon /></button>}
        {endAdornment && <span className="gl-field__adorn">{endAdornment}</span>}
      </div>
      {help && <span id={helpId} className="gl-field__help">{help}</span>}
    </div>
  );
});

export type SearchFieldProps = Omit<TextFieldProps, 'startAdornment' | 'type' | 'label'> & {
  glass?: boolean;
  /** shows a Cancel button while focused or filled */
  onCancel?: () => void;
  cancelLabel?: string;
  label?: string;
};
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ glass, onCancel, cancelLabel = 'Cancel', label = 'Search', placeholder = 'Search', className, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={cx('gl-search', glass && 'gl-search--glass', className)} role="search" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <TextField
        ref={ref as React.Ref<HTMLInputElement>}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        clearable
        startAdornment={<SearchIcon />}
        className={glass ? glassClass('regular') : undefined}
        enterKeyHint="search"
        {...rest}
      />
      {onCancel && focused && <Button variant="plain" className="gl-search__cancel" onClick={onCancel}>{cancelLabel}</Button>}
    </div>
  );
});

/* ================================================================================================ Chip, Badge, Avatar */
export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  selected?: boolean; onSelectedChange?: (v: boolean) => void; icon?: ReactNode; onRemove?: () => void;
};
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ selected, onSelectedChange, icon, onRemove, className, children, onClick, ...rest }, ref) {
  const toggle = selected !== undefined;
  return (
    <button ref={ref} type="button" aria-pressed={toggle ? selected : undefined} className={cx('gl-chip', className)}
      onClick={(e) => { onClick?.(e); if (toggle) onSelectedChange?.(!selected); }} {...rest}>
      {icon}{children}
      {onRemove && <span className="gl-chip__remove" role="button" aria-label="Remove" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onRemove(); }}><CloseIcon width={14} height={14} /></span>}
    </button>
  );
});

export function Badge({ children, tone = 'danger', dot, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: 'danger' | 'accent' | 'neutral'; dot?: boolean }) {
  return <span className={cx('gl-badge', tone !== 'danger' && `gl-badge--${tone}`, dot && 'gl-badge--dot', className)} {...rest}>{dot ? null : children}</span>;
}
export function BadgeAnchor({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return <span className="gl-badge-anchor">{children}{badge}</span>;
}

const AVATAR_HUES = ['iris', 'azure', 'teal', 'jade', 'amber', 'coral', 'rose', 'orchid'];
export function Avatar({ name = '', src, size = 40, className, style }: { name?: string; src?: string; size?: number; className?: string; style?: CSSProperties }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <span className={cx('gl-avatar', className)} role="img" aria-label={name || undefined}
      style={{ '--_s': `${size}px`, '--_bg': `var(--gl-${hue}-200)`, '--_fg': `var(--gl-${hue}-800)`, ...style } as CSSProperties}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

/* ================================================================================================ Card */
export type CardProps = HTMLAttributes<HTMLDivElement> & { variant?: 'elevated' | 'outlined'; interactive?: boolean; as?: ElementType };
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ variant = 'elevated', interactive, as, className, ...rest }, ref) {
  const Comp = (as ?? (interactive ? 'button' : 'div')) as ElementType;
  return <Comp ref={ref} className={cx('gl-card', variant === 'outlined' && 'gl-card--outlined', interactive && 'gl-card--interactive', className)} {...(Comp === 'button' ? { type: 'button' } : null)} {...rest} />;
});
export const CardMedia = (p: React.ImgHTMLAttributes<HTMLImageElement>) => <img className="gl-card__media" alt="" {...p} />;
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cx('gl-card__body', className)} {...p} />;

/* ================================================================================================ Progress */
export function Progress({ value, max = 100, size = 'md', label = 'Progress', className }: { value?: number; max?: number; size?: 'sm' | 'md'; label?: string; className?: string }) {
  const indeterminate = value === undefined;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={indeterminate ? undefined : value}
      className={cx('gl-progress', size === 'sm' && 'gl-progress--sm', indeterminate && 'gl-progress--indeterminate', className)}
      style={{ '--_p': indeterminate ? 0 : Math.min(1, Math.max(0, value / max)) } as CSSProperties}>
      <span className="gl-progress__bar" />
    </div>
  );
}

/* ================================================================================================ Page control */
export type PageControlProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  count: number; page?: number; defaultPage?: number; onChange?: (p: number) => void;
  /** glass capsule behind the dots */
  glass?: boolean; onMedia?: boolean; label?: string;
};
export const PageControl = forwardRef<HTMLDivElement, PageControlProps>(function PageControl({ count, page, defaultPage = 0, onChange, glass, onMedia, label = 'Page', className, ...rest }, ref) {
  const [p, setP] = useControllable(page, defaultPage, onChange);
  const el = useRef<HTMLDivElement>(null);
  const lightRef = useGlassLight(Boolean(glass));
  const pr = useRef(p); pr.current = p;
  /* scrub: slide along the dots to jump pages */
  useEffect(() => {
    const c = el.current;
    if (!c) return;
    return drag(c, {
      axis: 'x', threshold: 6,
      move: ({ x }) => {
        const dots = Array.from(c.querySelectorAll<HTMLElement>('.gl-pagecontrol__dot'));
        let best = 0, d = Infinity;
        dots.forEach((dt, i) => { const r = dt.getBoundingClientRect(), dd = Math.abs(x - (r.left + r.width / 2)); if (dd < d) { d = dd; best = i; } });
        if (best !== pr.current) setP(best);
      },
    });
  }, [setP]);
  return (
    <div ref={mergeRefs(ref, el, glass ? lightRef : undefined)} role="group" aria-label={label} tabIndex={0}
      className={cx('gl-pagecontrol', glass && cx('gl-pagecontrol--glass', glassClass(onMedia ? 'clear' : 'regular')), onMedia && 'gl-pagecontrol--on-media', className)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' && p < count - 1) { e.preventDefault(); setP(p + 1); } if (e.key === 'ArrowLeft' && p > 0) { e.preventDefault(); setP(p - 1); } }}
      {...rest}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" tabIndex={-1} className="gl-pagecontrol__dot" aria-current={i === p ? 'true' : undefined} aria-label={`${label} ${i + 1} of ${count}`} onClick={() => setP(i)} />
      ))}
    </div>
  );
});

