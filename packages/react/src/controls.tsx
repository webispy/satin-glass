import {
  Children, forwardRef, isValidElement, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ElementType, type HTMLAttributes, type InputHTMLAttributes,
  type KeyboardEvent, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from 'react';
import { animate, createBridge, createOverflowStrip, drag, loop, motionFor, prefersReducedMotion, Spring, springTiming, type Bridge, type MotionName, type OverflowStrip } from '@glass-layer/core';
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

/** One glass shared by several buttons; as tall as a standalone button of the same size. */
export const ButtonGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { vertical?: boolean; glass?: boolean; size?: 'sm' | 'md' | 'lg' }>(function ButtonGroup({ vertical, glass = true, size = 'md', className, ...rest }, ref) {
  const lightRef = useGlassLight(glass);
  return <div ref={mergeRefs(ref, lightRef)} role="group" className={cx('gl-button-group', size !== 'md' && `gl-button-group--${size}`, vertical && 'gl-button-group--vertical', glass && glassClass('regular'), className)} {...rest} />;
});

/* ================================================================================================ Switch */
export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value' | 'defaultValue'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
  motion?: MotionName;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, defaultChecked = false, onChange, size = 'md', motion, className, disabled, onClick, ...rest }, ref) {
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  const el = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const onRef = useRef(on); onRef.current = on;
  /* press / drag looks live in React state so a re-render never strips them mid-gesture */
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false); pressedRef.current = pressed;
  const [draggingSw, setDraggingSw] = useState(false);

  /* ---- the thumb: two edges on JS springs (like the tab bar's drop), so a retarget mid-flight keeps its speed.
     A tap retargets three times (press reach → toggle → release); CSS transitions restarted from rest each time,
     which is what made the switch feel slower than everything else. ---- */
  const eng = useRef<{ L: Spring; R: Spring; W: number; T: number; pad: number; reach: number; stop: (() => void) | null; squashed: boolean; wall: 'l' | 'r' | null } | null>(null);
  const geom = () => {
    const b = el.current!, cs = getComputedStyle(b), th = b.querySelector<HTMLElement>('.gl-switch__thumb')!;
    return { W: b.clientWidth, T: th.offsetHeight, pad: parseFloat(cs.getPropertyValue('--_pad')) || 2, reach: parseFloat(cs.getPropertyValue('--_reach')) || 6 };
  };
  const render = () => {
    const e = eng.current, b = el.current;
    if (!e || !b) return;
    const lo = e.pad, hi = e.W - e.pad;
    const l = Math.min(hi, Math.max(lo, e.L.value)), r = Math.max(lo, Math.min(hi, e.R.value));
    const th = b.querySelector<HTMLElement>('.gl-switch__thumb')!;
    th.style.setProperty('--gl-sw-l', `${l.toFixed(2)}px`);
    th.style.setProperty('--gl-sw-r', `${Math.max(r, l + 1).toFixed(2)}px`);
    /* the moment the leading edge meets the end of the rail, the knob squashes against it (personality) */
    if (e.wall && !e.squashed && ((e.wall === 'r' && e.R.value >= hi - 0.6) || (e.wall === 'l' && e.L.value <= lo + 0.6))) {
      e.squashed = true;
      squash(e.wall);
    }
  };
  const squash = (side: 'l' | 'r') => {
    const b = el.current, knob = b?.querySelector<HTMLElement>('.gl-switch__knob');
    if (!b || !knob || prefersReducedMotion(b)) return;
    const s = motionFor(b).squash;
    if (s <= 0) return;
    knob.style.transformOrigin = side === 'r' ? 'right center' : 'left center';
    knob.animate([
      { transform: 'scale(1, 1)' },
      { transform: `scale(${1 - s * 1.1}, ${1 + s * 0.35})`, offset: 0.28 },
      { transform: `scale(${1 + s * 0.4}, ${1 - s * 0.15})`, offset: 0.6 },
      { transform: `scale(${1 - s * 0.12}, 1)`, offset: 0.82 },
      { transform: 'scale(1, 1)' },
    ], { duration: 300, easing: 'ease-out' });
  };
  const run = () => {
    const e = eng.current;
    if (!e || e.stop) return;
    e.stop = loop((dt) => {
      e.L.step(dt); e.R.step(dt); render();
      if (e.L.settled && e.R.settled) { e.L.jump(e.L.target); e.R.jump(e.R.target); render(); e.stop = null; return false; }
    });
  };
  /** move the edges to where the state says; the edge on the side of travel leads, the other trails a little */
  const go = (toggle: boolean) => {
    const e = eng.current, b = el.current;
    if (!e || !b) return;
    /* reduced motion: no reach on press and a rigid knob (both edges on the same short spring, no push) —
       it still slides, briefly and without overshoot, rather than snapping in three steps */
    const reduced = prefersReducedMotion(b);
    const isOn = onRef.current, reach = pressedRef.current && !reduced ? e.reach : 0;
    const tl = isOn ? e.W - e.pad - e.T - reach : e.pad;
    const tr = isOn ? e.W - e.pad : e.pad + e.T + reach;
    if (reduced) {
      const m = motionFor(b).snappy;
      e.L.set(m); e.R.set(m); e.L.target = tl; e.R.target = tr; run();
      return;
    }
    /* short travel, quick spring: a switch moves ~20 px where a segmented control moves ~90, so it uses the
       personality's snappy spring at 0.62× response (same character, same overshoot) — otherwise it covers a
       quarter of the distance in the same time and reads as sluggish. A toggle also gets an initial push so it
       leaves at once instead of easing out of rest. */
    const snappy = motionFor(b).snappy;
    const lead = { response: snappy.response * 0.62, damping: snappy.damping };
    const trail = { response: snappy.response * 0.82, damping: Math.min(1, snappy.damping + 0.05) };
    const right = tr > e.R.target + 0.01 || tl > e.L.target + 0.01;
    if (right) { e.R.set(lead); e.L.set(trail); } else { e.L.set(lead); e.R.set(trail); }
    if (toggle) {
      e.wall = isOn ? 'r' : 'l'; e.squashed = false;
      const push = (sp: Spring, to: number) => { sp.velocity += (to - sp.value) * 7; };
      push(right ? e.R : e.L, right ? tr : tl);
      push(right ? e.L : e.R, right ? tl : tr);
    }
    e.L.target = tl; e.R.target = tr;
    run();
  };

  useIsoLayoutEffect(() => {
    const b = el.current;
    if (!b) return;
    const g = geom();
    const isOn = onRef.current;
    eng.current = { L: new Spring(isOn ? g.W - g.pad - g.T : g.pad, 'snappy', b), R: new Spring(isOn ? g.W - g.pad : g.pad + g.T, 'snappy', b), ...g, stop: null, squashed: true, wall: null };
    render();
    return () => { eng.current?.stop?.(); eng.current = null; };
  }, []);
  const firstOn = useRef(true);
  useIsoLayoutEffect(() => { if (firstOn.current) { firstOn.current = false; return; } go(true); }, [on]);
  useIsoLayoutEffect(() => { go(false); }, [pressed]);

  useEffect(() => {
    const b = el.current;
    if (!b || disabled) return;
    let c0 = 0, startOn = false, box: DOMRect | null = null, engaged = false;
    /* how far the pointer may stray before the switch lets go of it (the thumb then returns to where it was) */
    const SLOP_Y = 48, SLOP_X = 120;
    return drag(b, {
      axis: 'x',
      start: () => {
        dragged.current = false; engaged = false; startOn = onRef.current;
        const e = eng.current!;
        Object.assign(e, geom());
        if (prefersReducedMotion(b)) e.reach = 0;
        const wide = e.T + e.reach;
        c0 = startOn ? e.W - e.pad - wide / 2 : e.pad + wide / 2;
        box = b.getBoundingClientRect();
        setPressed(true);
      },
      move: ({ x, y, dx }) => {
        if (!dragged.current && Math.abs(dx) < 4) return;
        const e = eng.current!;
        const far = !box || y < box.top - SLOP_Y || y > box.bottom + SLOP_Y || x < box.left - SLOP_X || x > box.right + SLOP_X;
        dragged.current = true;
        if (far) {
          if (engaged) { engaged = false; setDraggingSw(false); delete b.dataset.drag; go(false); }
          return;
        }
        if (!engaged) { engaged = true; setDraggingSw(true); }
        const wide = e.T + e.reach;
        const c = Math.min(e.W - e.pad - wide / 2, Math.max(e.pad + wide / 2, c0 + dx));
        /* the finger holds the thumb: both edges follow 1:1 */
        e.stop?.(); e.stop = null;
        e.L.jump(c - wide / 2); e.R.jump(c + wide / 2); render();
        b.dataset.drag = c > e.W / 2 ? 'on' : 'off';
      },
      end: (_i, cancelled) => {
        const next = b.dataset.drag === 'on';
        const commit = dragged.current && engaged && !cancelled && b.dataset.drag !== undefined;
        setDraggingSw(false);
        delete b.dataset.drag;
        engaged = false;
        if (commit && next !== startOn) setOn(next);
        else go(false);
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
      data-gl-motion={motion}
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
      <span className="gl-switch__thumb"><span className="gl-switch__knob" /></span>
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
  /** motion personality for this control (default: the theme's) */
  motion?: MotionName;
};

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { value, defaultValue = 0, onChange, onChangeEnd, min = 0, max = 100, step = 1, disabled, format = (v) => String(v), showValue = true, motion, className, style, ...rest }, ref,
) {
  const [v, setV] = useControllable(value, defaultValue, onChange);
  const el = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const vRef = useRef(v); vRef.current = v;
  /* the thumb is driven by a JS spring so it can carry character: on a press it travels with the personality's
     snappy spring; while dragged it trails the finger by `lag` and stretches with speed by `gel` (squash & stretch) */
  const motor = useRef<{ pos: Spring; W: number; tracking: boolean; finger: number; stop: (() => void) | null } | null>(null);
  const snap = (x: number) => {
    const s = Math.round((x - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(s.toFixed(6))));
  };
  const ratio = (x: number) => (x - min) / (max - min || 1);

  const render = () => {
    const m = motor.current, s = el.current;
    if (!m || !s) return;
    const W = m.W || 1, pos = Math.min(W, Math.max(0, m.pos.value));
    const mo = motionFor(s);
    const k = mo.gel * Math.min(1.6, Math.abs(m.pos.velocity) / 900);
    s.style.setProperty('--_pos', `${pos.toFixed(2)}px`);
    s.style.setProperty('--_fp', (pos / W).toFixed(4));
    s.style.setProperty('--_gx', (1 + k).toFixed(3));
    s.style.setProperty('--_gy', (1 - k * 0.45).toFixed(3));
  };
  const run = () => {
    const m = motor.current;
    if (!m || m.stop) return;
    m.stop = loop((dt) => {
      if (m.tracking) m.pos.target = m.finger;
      m.pos.step(dt); render();
      if (!m.tracking && m.pos.settled) { m.pos.jump(m.pos.target); render(); m.stop = null; return false; }
    });
  };
  const travelTo = (px: number, how: 'spring' | 'jump') => {
    const m = motor.current, s = el.current;
    if (!m || !s) return;
    if (how === 'jump') { m.stop?.(); m.stop = null; m.pos.jump(px); render(); return; }
    m.pos.set('snappy', s); m.pos.target = px; run();
  };

  useIsoLayoutEffect(() => {
    const s = el.current;
    if (!s) return;
    motor.current = { pos: new Spring(0, 'snappy', s), W: s.clientWidth, tracking: false, finger: 0, stop: null };
    travelTo(ratio(vRef.current) * s.clientWidth, 'jump');
    const ro = new ResizeObserver(() => { const m = motor.current!; m.W = s.clientWidth; travelTo(ratio(vRef.current) * m.W, 'jump'); });
    ro.observe(s);
    return () => { ro.disconnect(); motor.current?.stop?.(); motor.current = null; };
  }, []);
  /* value changes that are not the finger (press, keyboard, a controlled update) travel on the spring */
  useIsoLayoutEffect(() => {
    const m = motor.current;
    if (m && !m.tracking) travelTo(ratio(v) * m.W, 'spring');
  }, [v, min, max]);

  useEffect(() => {
    const s = el.current;
    if (!s || disabled) return;
    const at = (clientX: number) => {
      const r = s.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    let x0 = 0;
    return drag(s, {
      start: ({ x, event }) => {
        x0 = x;
        setActive(true);
        s.focus({ preventScroll: true });
        event.preventDefault();
        const nv = snap(min + at(x) * (max - min)); if (nv !== vRef.current) setV(nv);
      },
      move: ({ x }) => {
        const m = motor.current!;
        if (!m.tracking && Math.abs(x - x0) > 3) {
          /* from here the thumb follows the finger itself (not the stepped value), trailing by the personality's lag */
          m.tracking = true;
          const lag = motionFor(s).lag;
          if (lag > 0) m.pos.set({ response: lag, damping: 0.78 }); else { m.stop?.(); m.stop = null; }
        }
        const p = at(x);
        if (m.tracking) {
          m.finger = p * m.W;
          if (motionFor(s).lag > 0 && !prefersReducedMotion(s)) run(); else { m.pos.jump(m.finger); render(); }
        }
        const nv = snap(min + p * (max - min)); if (nv !== vRef.current) setV(nv);
      },
      end: () => {
        const m = motor.current!;
        const was = m.tracking;
        m.tracking = false;
        setActive(false);
        /* settle on the stepped value with the snappy spring (and let the gel relax) */
        if (was) travelTo(ratio(vRef.current) * m.W, 'spring');
        onChangeEnd?.(vRef.current);
      },
    });
  }, [disabled, min, max, step]);

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return;
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

  return (
    <div
      ref={mergeRefs(ref, el)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={v} aria-valuetext={format(v)}
      aria-disabled={disabled || undefined}
      data-gl-motion={motion}
      className={cx('gl-slider', active && 'is-active', className)}
      style={style}
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
  min?: number; max?: number; step?: number; format?: (v: number) => ReactNode; label?: string; motion?: MotionName;
};
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper({ value, defaultValue = 0, onChange, min = -Infinity, max = Infinity, step = 1, format = (v) => v, label = 'Value', motion, className, ...rest }, ref) {
  const [v, setV] = useControllable(value, defaultValue, onChange);
  const vr = useRef(v); vr.current = v;            /* latest value, for hold-to-repeat */
  /* direction of the last change, for the roll: up when increasing, down when decreasing */
  /* odometer: the new number rolls in from the side it came from, the old one rolls out the other way */
  const shown = useRef(v);
  const [dir, setDir] = useState<'up' | 'down' | undefined>(undefined);
  const [leaving, setLeaving] = useState<{ v: number; dir: 'up' | 'down'; id: number }[]>([]);
  const seq = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    if (v === shown.current) return;
    const d = v > shown.current ? 'up' : 'down', old = shown.current;
    shown.current = v;
    /* reduced motion: a number changing is content, not motion — it just changes (two numbers cross-fading
       in one spot read as a blur) */
    if (prefersReducedMotion(root.current)) { setDir(undefined); setLeaving([]); return; }
    setDir(d);
    setLeaving((l) => [...l.slice(-2), { v: old, dir: d, id: ++seq.current }]);
  }, [v]);
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
    <div ref={mergeRefs(ref, root)} role="group" aria-label={label} data-gl-motion={motion} className={cx('gl-stepper', className)} {...rest}>
      <button type="button" className="gl-stepper__btn" aria-label={`Decrease ${label}`} disabled={v <= min} onClick={() => bump(-step)} onPointerDown={hold(-step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><MinusIcon /></button>
      <span className="gl-stepper__value" aria-live="polite">
        {leaving.map((l) => (
          <span key={`out-${l.id}`} data-leave={l.dir} aria-hidden="true" onAnimationEnd={() => setLeaving((xs) => xs.filter((x) => x.id !== l.id))}>{format(l.v)}</span>
        ))}
        <span key={v} data-roll={dir}>{format(v)}</span>
      </span>
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
  motion?: MotionName;
  'aria-label'?: string;
};

const itemsOf = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(':scope > [data-gl-item]'));

/** Shared by SegmentedControl and TabBar: the droplet-bridge indicator, on a track that scrolls sideways when
    the items do not fit (the selected item is kept in view). */
export function useBridge(container: React.RefObject<HTMLElement | null>, indicator: React.RefObject<HTMLElement | null>, index: number, onDragCommit: (i: number) => void, draggable = true) {
  const bridge = useRef<Bridge | null>(null), strip = useRef<OverflowStrip | null>(null), sizes = useRef<ResizeObserver | null>(null);
  const commit = useRef(onDragCommit); commit.current = onDragCommit;
  const at = useRef(index); at.current = index;
  useIsoLayoutEffect(() => {
    const c = container.current, ind = indicator.current;
    if (!c || !ind) return;
    const items = () => itemsOf(c);
    bridge.current = createBridge(c, ind, {
      items, draggable,
      /* a drop released over a disabled item, or a value the (controlled) parent refuses, springs back home */
      onDragCommit: (i) => { commit.current(i); requestAnimationFrame(() => { if (at.current !== i) bridge.current?.moveTo(at.current); }); },
      onHover: (i) => items().forEach((el, j) => el.toggleAttribute('data-hover', i === j)),
    });
    bridge.current.moveTo(index, false);
    strip.current = createOverflowStrip(c, items);
    strip.current.reveal(items()[index], false);
    /* items sized to their labels can change width without the track changing (e.g. a late font): the drop follows
       (retargeted, so a move in flight keeps going; never while a finger holds it) */
    const seen = new WeakMap<Element, number>();
    sizes.current = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
      let moved = false;
      for (const e of entries) { const w = e.contentRect.width, was = seen.get(e.target); seen.set(e.target, w); if (was !== undefined && Math.abs(w - was) >= 0.5) moved = true; }
      if (moved && !c.hasAttribute('data-gl-dragging')) bridge.current?.moveTo(at.current);
    }) : null;
    return () => { bridge.current?.destroy(); bridge.current = null; strip.current?.destroy(); strip.current = null; sizes.current?.disconnect(); sizes.current = null; };
  }, []);
  useIsoLayoutEffect(() => {
    bridge.current?.moveTo(index);
    const c = container.current;
    if (c) strip.current?.reveal(itemsOf(c)[index]);
  }, [index]);
  /* items added or removed: watch the new first / last item for the edge fades, and every item's size */
  useIsoLayoutEffect(() => {
    strip.current?.refresh();
    const c = container.current;
    if (c && sizes.current) for (const el of itemsOf(c)) sizes.current.observe(el);
  });
}

/** Arrow keys / Home / End move and select, skipping disabled items. */
function rovingKeys(e: KeyboardEvent<HTMLElement>, count: number, current: number, select: (i: number) => void, disabled: (i: number) => boolean = () => false) {
  const k = e.key, dir = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
  const scan = (from: number, step: number) => {
    for (let n = 0, i = from; n < count; n++, i = (i + step + count) % count) if (!disabled(i)) return i;
    return -1;
  };
  let next = -1;
  if (dir) next = scan((current + dir + count) % count, dir);
  else if (k === 'Home') next = scan(0, 1);
  else if (k === 'End') next = scan(count - 1, -1);
  if (next < 0) return;
  e.preventDefault();
  select(next);
  const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(':scope > [data-gl-item]');
  items[next]?.focus();
}

export function SegmentedControl<T extends string>({ options, value, defaultValue, onChange, size = 'md', motion, className, ...rest }: SegmentedControlProps<T>) {
  const [v, setV] = useControllable(value, defaultValue ?? options[0]?.value, onChange);
  const box = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === v));
  useBridge(box, ind, index, (i) => !options[i].disabled && setV(options[i].value));
  return (
    <div ref={box} role="radiogroup" data-gl-motion={motion} className={cx('gl-segmented', size === 'sm' && 'gl-segmented--sm', className)} onKeyDown={(e) => rovingKeys(e, options.length, index, (i) => setV(options[i].value), (i) => !!options[i].disabled)} {...rest}>
      <span ref={ind} className="gl-segmented__indicator" aria-hidden="true" />
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" data-gl-item aria-checked={i === index} tabIndex={i === index ? 0 : -1} disabled={o.disabled} className="gl-segmented__item" onClick={() => setV(o.value)}>
          {o.icon}<span className="gl-segmented__label" data-label={typeof o.label === 'string' ? o.label : undefined}>{o.label}</span>
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
  motion?: MotionName;
  'aria-label'?: string;
};

export const TabBar = forwardRef<HTMLElement, TabBarProps>(function TabBar({ value, defaultValue, onChange, children, action, compact, motion, className, 'aria-label': label = 'Tabs', ...rest }, ref) {
  const tabs = Children.toArray(children).filter(isValidElement).map((c) => (c as ReactElement<TabProps>).props);
  const [v, setV] = useControllable(value, defaultValue ?? tabs[0]?.value, onChange);
  const bar = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const lightRef = useGlassLight();
  const index = Math.max(0, tabs.findIndex((t) => t.value === v));
  useBridge(bar, ind, index, (i) => !tabs[i].disabled && setV(tabs[i].value));
  return (
    <nav ref={ref} data-gl-motion={motion} className={cx('gl-tabbar', compact && 'gl-tabbar--compact', className)} aria-label={label} {...rest}>
      {/* the glass clips; the track inside scrolls when the tabs do not fit (a scrolling glass would drag its rim along) */}
      <div ref={lightRef} className={cx('gl-tabbar__bar', glassClass('regular'))}>
        <div ref={bar} role="tablist" className="gl-tabbar__track" onKeyDown={(e) => rovingKeys(e, tabs.length, index, (i) => setV(tabs[i].value), (i) => !!tabs[i].disabled)}>
          <span ref={ind} className="gl-tabbar__indicator" aria-hidden="true" />
          {tabs.map((t, i) => (
            <button key={t.value} type="button" role="tab" data-gl-item aria-selected={i === index} tabIndex={i === index ? 0 : -1} disabled={t.disabled} className="gl-tabbar__item" onClick={() => setV(t.value)}>
              <span className="gl-tabbar__icon">{t.icon}{t.badge}</span>
              <span className="gl-tabbar__label">{t.label}</span>
            </button>
          ))}
        </div>
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
      {onCancel && (
        <Button variant="plain" className={cx('gl-search__cancel', focused && 'is-shown')} tabIndex={focused ? undefined : -1} aria-hidden={focused ? undefined : true}
          onMouseDown={(e) => e.preventDefault() /* keep focus in the field until the click */} onClick={onCancel}>{cancelLabel}</Button>
      )}
    </div>
  );
});

/* ================================================================================================ Chip, Badge, Avatar */
export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  selected?: boolean; onSelectedChange?: (v: boolean) => void; icon?: ReactNode; onRemove?: () => void;
};
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ selected, onSelectedChange, icon, onRemove, className, children, onClick, style, ...rest }, ref) {
  const toggle = selected !== undefined;
  if (onRemove) {
    /* an input chip: a group with a label and its own remove button (a button may not contain another button) */
    const name = typeof children === 'string' ? children : undefined;
    return (
      <span role="group" aria-label={name} className={cx('gl-chip', 'gl-chip--removable', className)} style={style}>
        {icon}<span className="gl-chip__label">{children}</span>
        <button ref={ref} type="button" className="gl-chip__remove" aria-label={name ? `Remove ${name}` : 'Remove'} onClick={onRemove} disabled={rest.disabled}><CloseIcon width={14} height={14} /></button>
      </span>
    );
  }
  return (
    <button ref={ref} type="button" aria-pressed={toggle ? selected : undefined} className={cx('gl-chip', className)} style={style}
      onClick={(e) => { onClick?.(e); if (toggle) onSelectedChange?.(!selected); }} {...rest}>
      {icon}<span className="gl-chip__label">{children}</span>
    </button>
  );
});

export function Badge({ children, tone = 'danger', dot, max = 99, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: 'danger' | 'accent' | 'neutral'; dot?: boolean; /** numbers above this show as "99+" */ max?: number }) {
  const shown = typeof children === 'number' && children > max ? `${max}+` : children;
  const el = useRef<HTMLSpanElement>(null);
  const prev = useRef<ReactNode>(undefined);
  const mounted = useRef(false);
  /* appears: pops in from half size with one overshoot; count changes: a short bump */
  useEffect(() => {
    const b = el.current;
    if (!b) return;
    const reduced = prefersReducedMotion(b);
    if (!mounted.current) { mounted.current = true; animate(b, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 'bouncy'); }
    else if (prev.current !== shown && !reduced) animate(b, [{ transform: 'scale(1.28)' }, { transform: 'scale(1)' }], 'bouncy');
    prev.current = shown;
  }, [shown]);
  return <span ref={el} className={cx('gl-badge', tone !== 'danger' && `gl-badge--${tone}`, dot && 'gl-badge--dot', className)} {...rest}>{dot ? null : shown}</span>;
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
      style={{ '--_s': `${size}px`, '--_bg': `var(--gl-${hue}-200)`, '--_fg': `var(--gl-${hue}-800)`, '--_fg-hc': `var(--gl-${hue}-950)`, ...style } as CSSProperties}>
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
export function Progress({ value, max = 100, size = 'md', label = 'Progress', motion, className }: { value?: number; max?: number; size?: 'sm' | 'md'; label?: string; motion?: MotionName; className?: string }) {
  const indeterminate = value === undefined;
  const p = indeterminate ? 0 : Math.min(1, Math.max(0, value / max));
  const el = useRef<HTMLDivElement>(null);
  /* a JS spring (smooth, of the personality) so frequent updates — a download ticking every 100 ms — keep their
     momentum instead of restarting a CSS transition from rest each time (which reads as stair-steps) */
  const eng = useRef<{ s: Spring; stop: (() => void) | null } | null>(null);
  useIsoLayoutEffect(() => {
    const d = el.current;
    if (!d || indeterminate) return;
    const bar = d.querySelector<HTMLElement>('.gl-progress__bar')!;
    const draw = (v: number) => bar.style.setProperty('--_p', Math.min(1, Math.max(0, v)).toFixed(4));
    if (!eng.current) { eng.current = { s: new Spring(p, 'smooth', d), stop: null }; draw(p); return; }
    const e = eng.current;
    e.s.set('smooth', d); e.s.target = p;
    if (!e.stop) e.stop = loop((dt) => { e.s.step(dt); draw(e.s.value); if (Math.abs(e.s.value - e.s.target) < 0.0005 && Math.abs(e.s.velocity) < 0.005) { e.s.jump(e.s.target); draw(e.s.target); e.stop = null; return false; } });
  }, [p, indeterminate]);
  useEffect(() => () => { eng.current?.stop?.(); }, []);
  return (
    <div ref={el} role="progressbar" data-gl-motion={motion} aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={indeterminate ? undefined : value}
      className={cx('gl-progress', size === 'sm' && 'gl-progress--sm', indeterminate && 'gl-progress--indeterminate', className)}>
      <span className="gl-progress__bar" />
    </div>
  );
}

/* ================================================================================================ Page control */
export type PageControlProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  count: number; page?: number; defaultPage?: number; onChange?: (p: number) => void;
  /** glass capsule behind the dots */
  glass?: boolean; onMedia?: boolean; label?: string; motion?: MotionName;
};
export const PageControl = forwardRef<HTMLDivElement, PageControlProps>(function PageControl({ count, page, defaultPage = 0, onChange, glass, onMedia, label = 'Page', motion, className, ...rest }, ref) {
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
    <div ref={mergeRefs(ref, el, glass ? lightRef : undefined)} role="group" aria-label={label} tabIndex={0} data-gl-motion={motion}
      className={cx('gl-pagecontrol', glass && cx('gl-pagecontrol--glass', glassClass(onMedia ? 'clear' : 'regular')), onMedia && 'gl-pagecontrol--on-media', className)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' && p < count - 1) { e.preventDefault(); setP(p + 1); } if (e.key === 'ArrowLeft' && p > 0) { e.preventDefault(); setP(p - 1); } }}
      {...rest}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" tabIndex={-1} className="gl-pagecontrol__dot" aria-current={i === p ? 'true' : undefined} aria-label={`${label} ${i + 1} of ${count}`} onClick={() => setP(i)} />
      ))}
    </div>
  );
});

