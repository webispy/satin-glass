import {
  Children, cloneElement, forwardRef, isValidElement, useEffect, useRef, useState,
  type AnchorHTMLAttributes, type ButtonHTMLAttributes, type CSSProperties, type ElementType, type HTMLAttributes, type InputHTMLAttributes,
  type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from 'react';
import { animate, drag, loop, motionFor, prefersReducedMotion, Spring, springTiming } from '@satin-glass/core';
import { cx, mergeRefs, tabStop, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { useGlassLight } from './foundation';
import { glassClass } from './glass-class';
import { useBridge } from './use-bridge';
import { useMessages } from './messages';
import { ClearIcon, MinusIcon, PlusIcon, SearchIcon, CloseIcon } from './icons';

/* ================================================================================================ Spinner */
export function Spinner({ size = 20, label, className, style }: {
  /** diameter in px */
  size?: number;
  /** the accessible name (it is a progressbar with no value; default "Loading") */
  label?: string;
  className?: string; style?: CSSProperties;
}) {
  const words = useMessages();
  return (
    <svg className={cx('sg-spinner', className)} viewBox="0 0 24 24" role="progressbar" aria-label={label ?? words.loading} style={{ '--_s': `${size}px`, ...style } as CSSProperties}>
      <circle className="sg-spinner__track" cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="9" strokeDasharray="18 100" />
    </svg>
  );
}

/* ================================================================================================ Button */
export type ButtonVariant = 'filled' | 'tinted' | 'glass' | 'plain' | 'neutral';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** the look, from most to least emphasis: filled, tinted, glass (on glass, over content), neutral, plain (no background) */
  variant?: ButtonVariant;
  /** the height, and the size of the text and icons */
  size?: 'sm' | 'md' | 'lg';
  /** the colour: accent, danger for destructive actions, or neutral */
  tone?: 'accent' | 'danger' | 'neutral';
  /** 'round' makes the ends fully round (a capsule, or a circle with only an icon) */
  shape?: 'rounded' | 'round';
  /** fills the width of its container */
  block?: boolean;
  /** shows a spinner in place of the content and sets aria-busy; until it ends the button cannot be pressed (a link
      loses its href, as with `disabled`) */
  loading?: boolean;
  /** an icon before the text */
  startIcon?: ReactNode;
  /** an icon after the text */
  endIcon?: ReactNode;
  /** render as another element, e.g. a router link (default: 'a' when there is an `href`, else 'button') */
  component?: ElementType;
  /** the link target: the button is then a link (an `<a>`, unless `component` says otherwise) */
  href?: string;
  /** with `href`: where the link opens, e.g. '_blank' (add `rel="noopener"` for another site) */
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  /** with `href`: how the linked page relates to this one, e.g. 'noopener' */
  rel?: string;
  /** with `href`: download the linked file instead of opening it, optionally under this name */
  download?: boolean | string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'tinted', size = 'md', tone = 'accent', shape = 'rounded', block, loading, startIcon, endIcon, component, className, children, disabled, type, href, onClick, ...rest }, ref,
) {
  /* an href makes a link, as a native button cannot navigate */
  const Comp = (component ?? (href !== undefined ? 'a' : 'button')) as ElementType;
  const native = Comp === 'button';
  /* a link has no disabled state: it loses its href (so it cannot be followed) but keeps its role, says so with
     aria-disabled, and its clicks do nothing — a router link sees the prevented default and stays put */
  const off = !native && (disabled || loading);
  const glass = variant === 'glass';
  const lightRef = useGlassLight(glass);
  return (
    <Comp
      ref={mergeRefs(ref, glass ? lightRef : undefined)}
      type={native ? type ?? 'button' : undefined}
      disabled={native ? disabled || loading : undefined}
      href={off ? undefined : href}
      role={off && Comp === 'a' && href !== undefined ? 'link' : undefined}
      aria-disabled={off || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-tone={tone !== 'accent' ? tone : undefined}
      className={cx('sg-button', `sg-button--${variant}`, size !== 'md' && `sg-button--${size}`, shape === 'round' && 'sg-button--round', block && 'sg-button--block', glass && glassClass('regular'), className)}
      onClick={off ? (e: MouseEvent<HTMLButtonElement>) => e.preventDefault() : onClick}
      {...rest}
    >
      {startIcon}
      {children !== undefined && children !== null && <span>{children}</span>}
      {endIcon}
      {loading && <span className="sg-button__spinner"><Spinner size={size === 'sm' ? 16 : 18} /></span>}
    </Comp>
  );
});

export type IconButtonProps = Omit<ButtonProps, 'startIcon' | 'endIcon' | 'children'> & {
  /** the icon, the only visible content */
  icon: ReactNode;
  /** the accessible name, also shown as a tooltip (`title`) unless one is given */
  label: string;
};
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, className, variant = 'plain', ...rest }, ref) {
  return <Button ref={ref} variant={variant} aria-label={label} title={rest.title ?? label} className={cx('sg-button--icon', className)} startIcon={icon} {...rest} />;
});

/** One glass shared by several buttons; as tall as a standalone button of the same size. */
export const ButtonGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
  /** stacks the buttons in a column */
  vertical?: boolean;
  /** the shared glass behind the buttons; false leaves them on their own */
  glass?: boolean;
  /** the group's height and corners; match the buttons' own `size` (it does not set theirs) */
  size?: 'sm' | 'md' | 'lg';
}>(function ButtonGroup({ vertical, glass = true, size = 'md', className, ...rest }, ref) {
  const lightRef = useGlassLight(glass);
  return <div ref={mergeRefs(ref, lightRef)} role="group" className={cx('sg-button-group', size !== 'md' && `sg-button-group--${size}`, vertical && 'sg-button-group--vertical', glass && glassClass('regular'), className)} {...rest} />;
});

/* ================================================================================================ Switch */
export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value' | 'defaultValue'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** 'sm' is a smaller switch, for dense rows */
  size?: 'sm' | 'md';
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, defaultChecked = false, onChange, size = 'md', className, disabled, onClick, ...rest }, ref) {
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
  const eng = useRef<{ L: Spring; R: Spring; W: number; T: number; pad: number; reach: number; stop: (() => void) | null; squashed: boolean; wall: 'l' | 'r' | null; knock?: (() => void) | null } | null>(null);
  const geom = () => {
    const b = el.current!, cs = getComputedStyle(b), th = b.querySelector<HTMLElement>('.sg-switch__thumb')!;
    return { W: b.clientWidth, T: th.offsetHeight, pad: parseFloat(cs.getPropertyValue('--_pad')) || 2, reach: parseFloat(cs.getPropertyValue('--_reach')) || 6 };
  };
  const render = () => {
    const e = eng.current, b = el.current;
    if (!e || !b) return;
    const lo = e.pad, hi = e.W - e.pad;
    const l = Math.min(hi, Math.max(lo, e.L.value)), r = Math.max(lo, Math.min(hi, e.R.value));
    const th = b.querySelector<HTMLElement>('.sg-switch__thumb')!;
    th.style.setProperty('--sg-sw-l', `${l.toFixed(2)}px`);
    th.style.setProperty('--sg-sw-r', `${Math.max(r, l + 1).toFixed(2)}px`);
    /* the moment the leading edge meets the end of the rail, the knob squashes against it (personality) */
    if (e.wall && !e.squashed && ((e.wall === 'r' && e.R.value >= hi - 0.6) || (e.wall === 'l' && e.L.value <= lo + 0.6))) {
      e.squashed = true;
      squash(e.wall);
    }
  };
  const squash = (side: 'l' | 'r') => {
    const b = el.current, knob = b?.querySelector<HTMLElement>('.sg-switch__knob');
    if (!b || !knob || prefersReducedMotion(b)) return;
    const s = motionFor(b).squash;
    if (s <= 0) return;
    /* one knock on the personality's pop spring: the knob is pressed against the wall (narrower, a little taller)
       and springs back, swinging past round as far as the pop overshoots. Anchored at the wall, so the knob never
       leaves the rail. The push is sized so the deepest press is squash × 1.1 of its width (lively ≈ 15%). */
    const e = eng.current;
    e?.knock?.();
    knob.style.transformOrigin = side === 'r' ? 'right center' : 'left center';
    const { response, damping: z } = motionFor(b).pop, w = (2 * Math.PI) / response;
    const reachPeak = z < 1 ? Math.exp(-(z / Math.sqrt(1 - z * z)) * Math.atan(Math.sqrt(1 - z * z) / z)) : Math.exp(-1);
    const C = new Spring(0, 'pop', b); C.velocity = (s * 1.1 * w) / reachPeak;
    const paint = () => { knob.style.transform = `scale(${(1 - C.value).toFixed(4)}, ${(1 + C.value * 0.32).toFixed(4)})`; };
    const off = loop((dt) => {
      C.step(dt); paint();
      /* settled in scale units (the spring's own test is for pixels) */
      if (Math.abs(C.value) > 0.001 || Math.abs(C.velocity) > 0.02) return;
      knob.style.transform = ''; if (e) e.knock = null;
      return false;
    });
    if (e) e.knock = () => { off(); knob.style.transform = ''; e.knock = null; };
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
    /* the thumb's edges are pixels measured from the switch: a switch mounted hidden (display: none — a settings bar a
       narrow layout swaps for a menu) measured 0 and kept a sliver of a thumb once shown. When its size changes and
       the thumb is at rest, measure again and put the edges where the state says */
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const e = eng.current;
      if (!e || e.stop) return;
      const n = geom();
      if (n.W === e.W && n.T === e.T && n.pad === e.pad) return;
      Object.assign(e, n);
      const on = onRef.current;
      e.L.jump(on ? n.W - n.pad - n.T : n.pad); e.R.jump(on ? n.W - n.pad : n.pad + n.T);
      render();
    });
    ro?.observe(b);
    return () => { ro?.disconnect(); eng.current?.stop?.(); eng.current?.knock?.(); eng.current = null; };
  }, []);
  const firstOn = useRef(true);
  useIsoLayoutEffect(() => { if (firstOn.current) { firstOn.current = false; return; } go(true); }, [on]);
  useIsoLayoutEffect(() => { go(false); }, [pressed]);

  /* the drag is set up and taken down with the engine, in a layout effect: taken down in a passive one, it outlived the
     engine while the next page loaded (Suspense) or the switch unmounted, and a move in between read the null engine */
  useIsoLayoutEffect(() => {
    const b = el.current;
    if (!b || disabled) return;
    let c0 = 0, startOn = false, box: DOMRect | null = null, engaged = false, holding = false;
    /* how far the pointer may stray before the switch lets go of it (the thumb then returns to where it was) */
    const SLOP_Y = 48, SLOP_X = 120;
    const off = drag(b, {
      axis: 'x',
      start: () => {
        holding = true;
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
        holding = false;
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
    /* taken down mid-drag (hidden while the next page loads, then shown again; or disabled): no release will come here,
       so end the drag as a cancel would; the switch kept its pressed, accent look. `dragged` stays: WebKit still sends
       the hidden switch the release's click, which must not toggle it (a key's click is never swallowed, below). The
       engine is gone by now; it is made again where the state says */
    return () => {
      off();
      if (!holding) return;
      holding = false; engaged = false;
      delete b.dataset.drag;
      setDraggingSw(false); setPressed(false);
    };
  }, [disabled, setOn]);

  return (
    <button
      ref={mergeRefs(ref, el)}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={cx('sg-switch', size === 'sm' && 'sg-switch--sm', pressed && 'is-pressed', draggingSw && 'is-dragging', className)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        /* the click a drag ends in is the drag's, not a toggle; a click from Space or Enter (detail 0) always toggles,
           so one never waits behind a drag that was cut short */
        if (dragged.current) { dragged.current = false; if (e.detail !== 0) return; }
        setOn(!on);
      }}
      {...rest}
    >
      <span className="sg-switch__thumb"><span className="sg-switch__knob" /></span>
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
  /** the lowest value, at the start of the track */
  min?: number;
  /** the highest value, at the end of the track */
  max?: number;
  /** the value moves in multiples of this from `min` (arrow keys move one step; Page Up / Down a tenth of the range) */
  step?: number;
  disabled?: boolean;
  /** text in the bubble and for screen readers */
  format?: (value: number) => string;
  /** a bubble above the thumb shows the value while it is dragged */
  showValue?: boolean;
};

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  { value, min = 0, max = 100, defaultValue = min, onChange, onChangeEnd, step = 1, disabled, format = (v) => String(v), showValue = true, className, style, ...rest }, ref,
) {
  const [given, setV] = useControllable(value, defaultValue, onChange);
  /* shown and announced within min..max, whatever was given (a value of 0 on a 10–20 track sits at 10) */
  const v = Math.min(max, Math.max(min, given));
  const el = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const vRef = useRef(v); vRef.current = v;
  /* the latest callback and range for the long-lived observer and drag handlers */
  const endRef = useRef(onChangeEnd); endRef.current = onChangeEnd;
  /* the thumb is driven by a JS spring so it can carry character: on a press it travels with the personality's
     snappy spring; while dragged it trails the finger by `lag` and stretches with speed by `gel` (squash & stretch) */
  const motor = useRef<{ pos: Spring; W: number; tracking: boolean; finger: number; stop: (() => void) | null } | null>(null);
  const snap = (x: number) => {
    const s = Math.round((x - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(s.toFixed(6))));
  };
  const ratio = (x: number) => (x - min) / (max - min || 1);
  const ratioRef = useRef(ratio); ratioRef.current = ratio;

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
    const ro = new ResizeObserver(() => { const m = motor.current!; m.W = s.clientWidth; travelTo(ratioRef.current(vRef.current) * m.W, 'jump'); });
    ro.observe(s);
    return () => { ro.disconnect(); motor.current?.stop?.(); motor.current = null; };
  }, []);
  /* value changes that are not the finger (press, keyboard, a controlled update) travel on the spring */
  useIsoLayoutEffect(() => {
    const m = motor.current;
    if (m && !m.tracking) travelTo(ratio(v) * m.W, 'spring');
  }, [v, min, max]);

  /* with the motor, in a layout effect (as Switch's drag) */
  useIsoLayoutEffect(() => {
    const s = el.current;
    if (!s || disabled) return;
    const at = (clientX: number) => {
      const r = s.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    let x0 = 0, holding = false;
    const off = drag(s, {
      start: ({ x, event }) => {
        holding = true;
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
        holding = false;
        const m = motor.current!;
        const was = m.tracking;
        m.tracking = false;
        setActive(false);
        /* settle on the stepped value with the snappy spring (and let the gel relax) */
        if (was) travelTo(ratio(vRef.current) * m.W, 'spring');
        endRef.current?.(vRef.current);
      },
    });
    /* taken down mid-drag (as Switch): no release will come, so the value bubble goes and the thumb stops following the
       finger. Hidden by Suspense, the motor is gone already and is made again at the value; set up again for a new
       disabled, min, max or step, the motor stays, so it lets go of the finger and travels to the value (left tracking,
       the thumb stayed where the finger was and missed every later change). onChangeEnd is not called: the hand did not
       let go here */
    return () => {
      off();
      if (!holding) return;
      holding = false;
      setActive(false);
      const m = motor.current;
      if (m?.tracking) { m.tracking = false; travelTo(ratioRef.current(vRef.current) * m.W, 'spring'); }
    };
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
      className={cx('sg-slider', active && 'is-active', className)}
      style={style}
      onKeyDown={onKey}
      {...rest}
    >
      <span className="sg-slider__track"><span className="sg-slider__fill" /></span>
      <span className="sg-slider__thumb" />
      {showValue && <span className={cx('sg-slider__bubble', glassClass('strong'))} aria-hidden="true">{format(v)}</span>}
    </div>
  );
});

/* ================================================================================================ Stepper */
export type StepperProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  value?: number; defaultValue?: number; onChange?: (v: number) => void;
  /** the lowest value; the − button is disabled there (default: no limit) */
  min?: number;
  /** the highest value; the + button is disabled there (default: no limit) */
  max?: number;
  /** how much one press adds or takes away; holding a button repeats it */
  step?: number;
  /** how the value is shown, e.g. with a unit (default: the number) */
  format?: (v: number) => ReactNode;
  /** names the group and the buttons for assistive technology ("Decrease {label}", "Increase {label}"; default "Value") */
  label?: string;
};
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper({ value, defaultValue = 0, onChange, min = -Infinity, max = Infinity, step = 1, format = (v) => v, label: labelProp, className, ...rest }, ref) {
  const m = useMessages(), label = labelProp ?? m.value;
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
  const repeated = useRef(false);
  const hold = (d: number) => () => {
    stop(); repeated.current = false;
    timer.current.t = window.setTimeout(() => { timer.current.i = window.setInterval(() => { repeated.current = true; bump(d); }, 80); }, 400);
  };
  /* the click that ends a repeat is not one more step; a keyboard click (detail 0) always is */
  const press = (d: number) => (e: MouseEvent<HTMLButtonElement>) => { if (repeated.current && e.detail > 0) { repeated.current = false; return; } bump(d); };
  const stop = () => { clearTimeout(timer.current.t); clearInterval(timer.current.i); };
  useEffect(() => stop, []);
  return (
    <div ref={mergeRefs(ref, root)} role="group" aria-label={label} className={cx('sg-stepper', className)} {...rest}>
      <button type="button" className="sg-stepper__btn" aria-label={m.decrease(label)} disabled={v <= min} onClick={press(-step)} onPointerDown={hold(-step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><MinusIcon /></button>
      <span className="sg-stepper__value" aria-live="polite">
        {leaving.map((l) => (
          <span key={`out-${l.id}`} data-leave={l.dir} aria-hidden="true" onAnimationEnd={() => setLeaving((xs) => xs.filter((x) => x.id !== l.id))}>{format(l.v)}</span>
        ))}
        <span key={v} data-roll={dir}>{format(v)}</span>
      </span>
      <button type="button" className="sg-stepper__btn" aria-label={m.increase(label)} disabled={v >= max} onClick={press(step)} onPointerDown={hold(step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}><PlusIcon /></button>
    </div>
  );
});

/* ================================================================================================ Segmented control */
export type SegmentOption<T extends string> = {
  /** the value this option stands for: what `value` and `onChange` carry when it is chosen */
  value: T;
  /** the segment's text; with `iconOnly` it names the segment for assistive technology and as a tooltip */
  label: ReactNode;
  /** an icon before the label (required on every option with `iconOnly`) */
  icon?: ReactNode;
  disabled?: boolean;
};
export type SegmentedControlProps<T extends string> = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> & {
  /** the segments, in order; without a value the first enabled one is selected */
  options: SegmentOption<T>[];
  value?: T; defaultValue?: T; onChange?: (v: T) => void;
  /** 'sm' is shorter, for toolbars and card headers */
  size?: 'sm' | 'md';
  /** only the icons show (each option needs one); the labels still name the options, to assistive technology and as
      a tooltip, as an IconButton's label does */
  iconOnly?: boolean;
  'aria-label'?: string;
};

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
  const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(':scope > [data-sg-item]');
  items[next]?.focus();
}

export function SegmentedControl<T extends string>({ options, value, defaultValue, onChange, size = 'md', iconOnly, className, ...rest }: SegmentedControlProps<T>) {
  const [v, setV] = useControllable(value, defaultValue ?? (options.find((o) => !o.disabled) ?? options[0])?.value, onChange);
  const box = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === v));
  useBridge(box, ind, index, (i) => !options[i].disabled && setV(options[i].value));
  const stop = tabStop(index, options.length, (i) => !!options[i].disabled);
  return (
    <div ref={box} role="radiogroup" className={cx('sg-segmented', size === 'sm' && 'sg-segmented--sm', iconOnly && 'sg-segmented--icons', className)} onKeyDown={(e) => rovingKeys(e, options.length, index, (i) => setV(options[i].value), (i) => !!options[i].disabled)} {...rest}>
      <span ref={ind} className="sg-segmented__indicator" aria-hidden="true" />
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" data-sg-item aria-checked={i === index} tabIndex={i === stop ? 0 : -1} disabled={o.disabled} className="sg-segmented__item" onClick={() => setV(o.value)}
          title={iconOnly && typeof o.label === 'string' ? o.label : undefined}>
          {o.icon}{iconOnly ? <span className="sg-visually-hidden">{o.label}</span> : <span className="sg-segmented__label" data-label={typeof o.label === 'string' ? o.label : undefined}>{o.label}</span>}
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
  /** an action at the end of the bar, after a hairline (e.g. search): a TabBarAction. It is not a tab, so the
      selection never travels to it */
  action?: ReactNode;
  /** the selection can be dragged across the tabs and lands where it is released (off by default: a tap selects) */
  draggable?: boolean;
  /** `false` shows icons only, in a shorter bar; the labels stay for screen readers, and a tab without an icon
      keeps its label visible */
  showLabels?: boolean;
  /** the bar's name (default "Tabs") */
  'aria-label'?: string;
};

export const TabBar = forwardRef<HTMLElement, TabBarProps>(function TabBar({ value, defaultValue, onChange, children, action, draggable = false, showLabels = true, className, 'aria-label': labelProp, ...rest }, ref) {
  const words = useMessages(), label = labelProp ?? words.tabs;
  const tabs = Children.toArray(children).filter(isValidElement).map((c) => (c as ReactElement<TabProps>).props);
  const [v, setV] = useControllable(value, defaultValue ?? (tabs.find((t) => !t.disabled) ?? tabs[0])?.value, onChange);
  const bar = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null);
  const lightRef = useGlassLight();
  const index = Math.max(0, tabs.findIndex((t) => t.value === v));
  useBridge(bar, ind, index, (i) => !tabs[i].disabled && setV(tabs[i].value), draggable);
  const stop = tabStop(index, tabs.length, (i) => !!tabs[i].disabled);
  return (
    <nav ref={ref} className={cx('sg-tabbar', !showLabels && 'sg-tabbar--icons', className)} aria-label={label} {...rest}>
      {/* the glass clips; the track inside scrolls when the tabs do not fit (a scrolling glass would drag its rim along) */}
      <div ref={lightRef} className={cx('sg-tabbar__bar', glassClass('regular'))}>
        <div ref={bar} role="tablist" className="sg-tabbar__track" onKeyDown={(e) => rovingKeys(e, tabs.length, index, (i) => setV(tabs[i].value), (i) => !!tabs[i].disabled)}>
          <span ref={ind} className="sg-tabbar__indicator" aria-hidden="true" />
          {tabs.map((t, i) => (
            <button key={t.value} type="button" role="tab" data-sg-item aria-selected={i === index} tabIndex={i === stop ? 0 : -1} disabled={t.disabled} className={cx('sg-tabbar__item', !t.icon && 'sg-tabbar__item--text')} onClick={() => setV(t.value)}>
              <span className="sg-tabbar__icon">{t.icon}{t.badge}</span>
              <span className="sg-tabbar__label">{t.label}</span>
            </button>
          ))}
        </div>
        {action && <><span className="sg-tabbar__divider" aria-hidden="true" />{action}</>}
      </div>
    </nav>
  );
});

/** An action in a TabBar's `action` slot: an icon at the end of the bar, on the same glass, pressed like a tab. */
export const TabBarAction = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** the icon, the only visible content */
  icon: ReactNode;
  /** the accessible name, also shown as a tooltip */
  label: string;
}>(function TabBarAction({ icon, label, className, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cx('sg-tabbar__action', className)} {...rest}>
      <span className="sg-tabbar__icon" aria-hidden="true">{icon}</span>
    </button>
  );
});

/* ================================================================================================ TextField */
type FieldBase = {
  /** the visible label above the field, tied to it with htmlFor */
  label?: ReactNode;
  /** a hint under the field, read with it as its description; an `error` message takes its place */
  helperText?: ReactNode;
  /** marks the field invalid (aria-invalid); text is shown under the field in place of `helperText` */
  error?: ReactNode | boolean;
  /** inside the field, before the text: an icon, a currency sign */
  startAdornment?: ReactNode;
  /** inside the field, after the text: a unit, a button */
  endAdornment?: ReactNode;
  /** a clear button while the field has text; it empties an uncontrolled field (a controlled one: clear it in `onClear`) */
  clearable?: boolean;
  /** called when the clear button is pressed, before focus returns to the field */
  onClear?: () => void;
  /** class names for the outer wrapper (label, control and help text); `className` goes on the control */
  fieldClassName?: string;
};
/** `size` here is the native input attribute (the width in characters), not the design scale */
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldBase & {
  /** `true` renders a `<textarea>` (taking textarea attributes) instead of an `<input>`; a SearchField is always an input */
  multiline?: false;
};
export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBase & {
  /** `true` renders a `<textarea>` (taking textarea attributes) instead of an `<input>`; a SearchField is always an input */
  multiline: true;
};

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps | TextAreaFieldProps>(function TextField(props, ref) {
  const { label, helperText, error, startAdornment, endAdornment, clearable, onClear, fieldClassName, className, id, multiline, disabled, ...rest } = props as TextFieldProps & { multiline?: boolean };
  const auto = useStableId('sg-field');
  const m = useMessages();
  const fid = id ?? auto;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [filled, setFilled] = useState(Boolean(rest.value ?? rest.defaultValue));
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const helpId = help ? `${fid}-help` : undefined;
  const common = {
    id: fid, className: 'sg-field__input', disabled, 'aria-invalid': invalid || undefined, 'aria-describedby': helpId,
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
    <div className={cx('sg-field', fieldClassName)} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {label && <label className="sg-field__label" htmlFor={fid}>{label}</label>}
      <div className={cx('sg-field__control', className)}>
        {startAdornment && <span className="sg-field__adorn">{startAdornment}</span>}
        {multiline
          ? <textarea ref={mergeRefs(ref as React.Ref<HTMLTextAreaElement>, inputRef as React.Ref<HTMLTextAreaElement>)} {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} onInput={onInput} />
          : <input ref={mergeRefs(ref as React.Ref<HTMLInputElement>, inputRef as React.Ref<HTMLInputElement>)} {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} onInput={onInput} />}
        {clearable && filled && !disabled && <button type="button" className="sg-field__clear" aria-label={m.clear} onClick={clear}><ClearIcon /></button>}
        {endAdornment && <span className="sg-field__adorn">{endAdornment}</span>}
      </div>
      {help && <span id={helpId} className="sg-field__help">{help}</span>}
    </div>
  );
});

export type SearchFieldProps = Omit<TextFieldProps, 'startAdornment' | 'type' | 'label'> & {
  /** the field on glass, for search over content (in a bar, over a photo) */
  glass?: boolean;
  /** shows a Cancel button while the field has focus */
  onCancel?: () => void;
  /** the Cancel button's text (default "Cancel") */
  cancelLabel?: string;
  /** the field's accessible name (there is no visible label; default "Search") */
  label?: string;
};
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ glass, onCancel, cancelLabel, label, placeholder, className, ...rest }, ref) {
  const m = useMessages();
  const [focused, setFocused] = useState(false);
  return (
    <div className={cx('sg-search', glass && 'sg-search--glass', className)} role="search" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <TextField
        ref={ref as React.Ref<HTMLInputElement>}
        type="search"
        aria-label={label ?? m.search}
        placeholder={placeholder ?? m.search}
        clearable
        startAdornment={<SearchIcon />}
        className={glass ? glassClass('regular') : undefined}
        enterKeyHint="search"
        {...rest}
      />
      {onCancel && (
        <Button variant="plain" className={cx('sg-search__cancel', focused && 'is-shown')} tabIndex={focused ? undefined : -1} aria-hidden={focused ? undefined : true}
          onMouseDown={(e) => e.preventDefault() /* keep focus in the field until the click */} onClick={onCancel}>{cancelLabel ?? m.cancel}</Button>
      )}
    </div>
  );
});

/* ================================================================================================ Chip, Badge, Avatar */
export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  /** set (true or false) to make a toggle chip (aria-pressed); leave unset for an action chip */
  selected?: boolean;
  /** called with the opposite of `selected` on a click (a toggle chip is always controlled) */
  onSelectedChange?: (v: boolean) => void;
  /** an icon before the text */
  icon?: ReactNode;
  /** makes an input chip with a remove button, named "Remove {text}"; the chip itself is then not a button, so
      `selected` and `onClick` do not apply; `ref` and the other attributes go to the chip, and `disabled` to its
      remove button */
  onRemove?: () => void;
};
/* the ref is the chip's root: the button, or with `onRemove` the group around the label and the remove button */
export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip({ selected, onSelectedChange, icon, onRemove, className, children, onClick, style, ...rest }, ref) {
  const toggle = selected !== undefined;
  const m = useMessages();
  if (onRemove) {
    /* an input chip: a group with a label and its own remove button (a button may not contain another button) */
    const name = typeof children === 'string' ? children : undefined;
    const { disabled, ...attrs } = rest;
    return (
      <span ref={ref} role="group" aria-label={name} className={cx('sg-chip', 'sg-chip--removable', className)} style={style} {...(attrs as HTMLAttributes<HTMLSpanElement>)}>
        {icon}<span className="sg-chip__label">{children}</span>
        <button type="button" className="sg-chip__remove" aria-label={m.remove(name)} onClick={onRemove} disabled={disabled}><CloseIcon width={14} height={14} /></button>
      </span>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" aria-pressed={toggle ? selected : undefined} className={cx('sg-chip', className)} style={style}
      onClick={(e) => { onClick?.(e); if (toggle) onSelectedChange?.(!selected); }} {...rest}>
      {icon}<span className="sg-chip__label">{children}</span>
    </button>
  );
});

export function Badge({ children, tone = 'danger', dot, max = 99, label, className, ...rest }: HTMLAttributes<HTMLSpanElement> & {
  /** the colour */
  tone?: 'danger' | 'accent' | 'neutral';
  /** a small dot without the content; it has no text, so name it with `label` or say what it means elsewhere */
  dot?: boolean;
  /** what the badge means, for assistive technology ("3 unread messages", "New"): it is then read as an image with
      this name in place of its text */
  label?: string;
  /** numbers above this show as "99+" */
  max?: number;
}) {
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
  /* a name needs a role: aria-label on a plain span is ignored */
  const name = label ?? rest['aria-label'];
  return <span ref={el} role={name ? 'img' : undefined} className={cx('sg-badge', tone !== 'danger' && `sg-badge--${tone}`, dot && 'sg-badge--dot', className)} {...rest} aria-label={name}>{dot ? null : shown}</span>;
}
export function BadgeAnchor({ badge, children }: {
  /** a Badge, pinned to the top-right corner of the children */
  badge: ReactNode;
  children: ReactNode;
}) {
  return <span className="sg-badge-anchor">{children}{badge}</span>;
}

const AVATAR_HUES = ['iris', 'azure', 'teal', 'jade', 'amber', 'coral', 'rose', 'orchid'];
export type AvatarProps = {
  /** the person's name: the accessible name, the initials (first letters of the first two words) and the colour;
      without one the avatar is decorative, hidden from assistive technology */
  name?: string;
  /** the picture's URL; the initials show when it is missing or fails to load */
  src?: string;
  /** diameter in px */
  size?: number;
  className?: string; style?: CSSProperties;
};
/** A person's picture, or their initials on a colour picked from the name. A picture that fails to load falls back
    to the initials. */
export function Avatar({ name = '', src, size = 40, className, style }: AvatarProps) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  const [broken, setBroken] = useState<string | null>(null);
  const showImg = !!src && broken !== src;
  return (
    /* without a name the portrait says nothing, so it is left out rather than read as an unnamed image */
    <span className={cx('sg-avatar', className)} role={name ? 'img' : undefined} aria-label={name || undefined} aria-hidden={name ? undefined : true}
      style={{ '--_s': `${size}px`, '--_bg': `var(--sg-${hue}-200)`, '--_fg': `var(--sg-${hue}-800)`, '--_fg-hc': `var(--sg-${hue}-950)`, ...style } as CSSProperties}>
      {showImg ? <img src={src} alt="" onError={() => setBroken(src!)} /> : initials}
    </span>
  );
}

/* AvatarGroup (0.5): overlapping portraits and a "+N" for the rest. Each portrait keeps its name; the group is named
   by the count. +N is text, or a button when there is something to open (a list of everyone in a Popover). The
   portraits are flat and part from each other with a ring in the colour they sit on (--sg-avatar-ring, default the
   surface). Nothing moves: the roster is content. */
export type AvatarGroupProps = {
  /** <Avatar /> elements */
  children: ReactNode;
  /** how many portraits to show before +N (default 4) */
  max?: number;
  /** how many people there are, when that is more than the portraits given (a count from the server) */
  total?: number;
  /** the diameter in px, given to every portrait (default 32) */
  size?: number;
  /** +N becomes a button; anchor a Popover to event.currentTarget */
  onMoreClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  labels?: { group?: (count: number) => string; more?: (hidden: number) => string };
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
};
export function AvatarGroup({ children, max = 4, total, size = 32, onMoreClick, labels, 'aria-label': ariaLabel, className, style }: AvatarGroupProps) {
  const portraits = Children.toArray(children).filter(isValidElement) as ReactElement<AvatarProps>[];
  const shown = portraits.slice(0, Math.max(0, Math.floor(Number.isFinite(max) ? max : 4)));
  const count = Math.max(Math.floor(Number.isFinite(total) ? total! : 0), portraits.length);
  const hidden = Math.max(0, count - shown.length);
  const m = useMessages();
  const more = labels?.more?.(hidden) ?? m.more(hidden);
  /* the circle holds two digits; the name keeps the real count */
  const shownMore = hidden > 99 ? '99+' : `+${hidden}`;
  return (
    <div role="group" aria-label={ariaLabel ?? labels?.group?.(count) ?? m.people(count)}
      className={cx('sg-avatar-group', className)} style={{ '--_s': `${size}px`, ...style } as CSSProperties}>
      {shown.map((a, i) => cloneElement(a, { key: a.key ?? i, size }))}
      {hidden > 0 && (onMoreClick
        /* the name starts with what is shown ("+3", "99+") and goes on with the full count: a name that does not
           contain the visible text fails "label in name" (speech control says what it sees) */
        ? <button type="button" className="sg-avatar-group__more" onClick={onMoreClick}>{shownMore}<span className="sg-visually-hidden">{`, ${more}`}</span></button>
        : <span className="sg-avatar-group__more" role="img" aria-label={more}>{shownMore}</span>)}
    </div>
  );
}

/* ================================================================================================ Card */
type CardBase = {
  /** elevated (a shadow) or outlined (a hairline border, no shadow) */
  variant?: 'elevated' | 'outlined';
  /** the element to render (default: 'button' when interactive, else 'div'), e.g. 'a' or 'article' */
  as?: ElementType;
};
/* an interactive card is a button, so it takes a button's attributes (type, a click on a button); a plain one a div's */
export type CardProps =
  | (HTMLAttributes<HTMLDivElement> & CardBase & {
      /** the whole card is one button (rendered as a button unless `as` says otherwise), pressed like one */
      interactive?: false;
    })
  | (ButtonHTMLAttributes<HTMLButtonElement> & CardBase & {
      /** the whole card is one button (rendered as a button unless `as` says otherwise), pressed like one */
      interactive: true;
    });
export const Card = forwardRef<HTMLElement, CardProps>(function Card({ variant = 'elevated', interactive, as, className, ...rest }, ref) {
  const Comp = (as ?? (interactive ? 'button' : 'div')) as ElementType;
  return <Comp ref={ref} className={cx('sg-card', variant === 'outlined' && 'sg-card--outlined', interactive && 'sg-card--interactive', className)} {...(Comp === 'button' ? { type: 'button' } : null)} {...rest} />;
});
export const CardMedia = (p: React.ImgHTMLAttributes<HTMLImageElement>) => <img className="sg-card__media" alt="" {...p} />;
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cx('sg-card__body', className)} {...p} />;
export type CardHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** the card's heading (an h3 unless `level` says otherwise) */
  title: ReactNode;
  /** a line under the title: the period, the source, the unit */
  description?: ReactNode;
  /** trailing controls: a segmented control, a filter, a "more" button */
  actions?: ReactNode;
  /** heading level of the title (default 3) */
  level?: 2 | 3 | 4 | 5 | 6;
};
/** A card's title row: what the card shows, and controls that change it. Put a CardBody below. */
export function CardHeader({ title, description, actions, level = 3, className, ...rest }: CardHeaderProps) {
  const H = `h${level}` as 'h3';
  return (
    <div className={cx('sg-card__header', className)} {...rest}>
      <div className="sg-card__heading"><H className="sg-card__title">{title}</H>{description && <p className="sg-card__desc">{description}</p>}</div>
      {actions && <div className="sg-card__actions">{actions}</div>}
    </div>
  );
}

/* ================================================================================================ Progress */
export function Progress({ value, max = 100, size = 'md', label, className }: {
  /** progress from 0 to `max`; leave unset while the amount is not known (an indeterminate bar) */
  value?: number;
  /** the value at which it is complete */
  max?: number;
  /** 'sm' is a thinner bar */
  size?: 'sm' | 'md';
  /** the accessible name: what is in progress (default "Progress") */
  label?: string;
  className?: string;
}) {
  const words = useMessages();
  const indeterminate = value === undefined;
  const p = indeterminate ? 0 : Math.min(1, Math.max(0, value / max));
  const el = useRef<HTMLDivElement>(null);
  /* a JS spring (smooth, of the personality) so frequent updates — a download ticking every 100 ms — keep their
     momentum instead of restarting a CSS transition from rest each time (which reads as stair-steps) */
  const eng = useRef<{ s: Spring; stop: (() => void) | null } | null>(null);
  useIsoLayoutEffect(() => {
    const d = el.current;
    if (!d || indeterminate) return;
    const bar = d.querySelector<HTMLElement>('.sg-progress__bar')!;
    const draw = (v: number) => bar.style.setProperty('--_p', Math.min(1, Math.max(0, v)).toFixed(4));
    if (!eng.current) { eng.current = { s: new Spring(p, 'smooth', d), stop: null }; draw(p); return; }
    const e = eng.current;
    e.s.set('smooth', d); e.s.target = p;
    if (!e.stop) e.stop = loop((dt) => { e.s.step(dt); draw(e.s.value); if (Math.abs(e.s.value - e.s.target) < 0.0005 && Math.abs(e.s.velocity) < 0.005) { e.s.jump(e.s.target); draw(e.s.target); e.stop = null; return false; } });
  }, [p, indeterminate]);
  useEffect(() => () => { eng.current?.stop?.(); }, []);
  return (
    <div ref={el} role="progressbar" aria-label={label ?? words.progress} aria-valuemin={0} aria-valuemax={max} aria-valuenow={indeterminate ? undefined : value}
      className={cx('sg-progress', size === 'sm' && 'sg-progress--sm', indeterminate && 'sg-progress--indeterminate', className)}>
      <span className="sg-progress__bar" />
    </div>
  );
}

/* ================================================================================================ Page control */
export type PageControlProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  /** how many pages (one dot each) */
  count: number;
  /** the current page, from 0 (controlled; use with `onChange`) */
  page?: number;
  /** the first page shown when uncontrolled, from 0 */
  defaultPage?: number;
  onChange?: (p: number) => void;
  /** glass capsule behind the dots */
  glass?: boolean;
  /** white dots for use over photos and video; with `glass`, the capsule is clear glass */
  onMedia?: boolean;
  /** names the group and each dot ("{label} 2 of 5") for assistive technology (default "Page") */
  label?: string;
};
export const PageControl = forwardRef<HTMLDivElement, PageControlProps>(function PageControl({ count, page, defaultPage = 0, onChange, glass, onMedia, label: labelProp, className, ...rest }, ref) {
  const m = useMessages(), label = labelProp ?? m.page;
  const [p, setP] = useControllable(page, defaultPage, onChange);
  const el = useRef<HTMLDivElement>(null);
  const lightRef = useGlassLight(Boolean(glass));
  const pr = useRef(p); pr.current = p;
  /* scrub: slide along the dots to jump pages. Taken down in a layout effect (as Switch's drag), so a page hidden while
     the next one loads does not measure its hidden dots and change page */
  useIsoLayoutEffect(() => {
    const c = el.current;
    if (!c) return;
    return drag(c, {
      axis: 'x', threshold: 6,
      move: ({ x }) => {
        const dots = Array.from(c.querySelectorAll<HTMLElement>('.sg-pagecontrol__dot'));
        let best = 0, d = Infinity;
        dots.forEach((dt, i) => { const r = dt.getBoundingClientRect(), dd = Math.abs(x - (r.left + r.width / 2)); if (dd < d) { d = dd; best = i; } });
        if (best !== pr.current) setP(best);
      },
    });
  }, [setP]);
  return (
    <div ref={mergeRefs(ref, el, glass ? lightRef : undefined)} role="group" aria-label={label} tabIndex={0}
      className={cx('sg-pagecontrol', glass && cx('sg-pagecontrol--glass', glassClass(onMedia ? 'clear' : 'regular')), onMedia && 'sg-pagecontrol--on-media', className)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' && p < count - 1) { e.preventDefault(); setP(p + 1); } if (e.key === 'ArrowLeft' && p > 0) { e.preventDefault(); setP(p - 1); } }}
      {...rest}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" tabIndex={-1} className="sg-pagecontrol__dot" aria-current={i === p ? 'true' : undefined} aria-label={m.pageOf(label, i + 1, count)} onClick={() => setP(i)} />
      ))}
    </div>
  );
});

