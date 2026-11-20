/* Wheels (0.3): a column of values that scrolls under a fixed selection band — for picking one of many quickly
   (a year out of a century, an hour and a minute). Built on native scrolling, so a finger flick or a trackpad keeps
   its platform momentum; a mouse can drag it (with a fling), the wheel scrolls it, a click on a row brings that row
   to the band. The row in the band is drawn a little larger and the others recede (smaller, fainter); the band is a
   raised lens like the segmented control's chosen segment. Coming to rest, the wheel does not snap: the library's
   spring pulls the nearest row into the lens (surface tension — a touch past it and back with the livelier
   personalities). While a hand turns it, the lens squeezes the way the rows go and pops back when they stop (see
   the lens below). Drawn per frame, transforms and opacity only; none of the motion with reduced motion.
   For assistive technology each column is a spinbutton: arrows step, PageUp / PageDown jump `pageStep` rows,
   Home / End go to the ends, typing digits or letters jumps to the first row that starts with them. */
import { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Spring, drag, loop, motionFor, motionOf, prefersReducedMotion, type Placement } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Portal, glassClass, useGlassLight } from './foundation';
import { Button } from './controls';
import { useAnchored } from './overlay-hooks';

export type WheelOption<T> = { value: T; label: string; disabled?: boolean };
export type WheelProps<T> = {
  options: WheelOption<T>[];
  value?: T; defaultValue?: T;
  /** called once the wheel comes to rest on a row (or at once from the keyboard) */
  onChange?: (value: T) => void;
  'aria-label': string;
  /** rows moved by PageUp / PageDown (default 5) */
  pageStep?: number;
  /** where the text sits in the column (default 'center') */
  align?: 'start' | 'center' | 'end';
  /** Enter / Space on the column (a picker can close, a calendar can go back to its days) */
  onCommit?: () => void;
  /** shown but not turned: no scrolling, dragging, clicks or keys, and out of the tab order */
  disabled?: boolean;
  id?: string;
  className?: string; style?: CSSProperties;
};

/* ------------------------------------------------------------------------------------------------ the lens
   One lens per group (a lone wheel has its own): a still raised chip the rows turn under — the same raised surface as
   the segmented control's chosen segment, with no panel behind the column. */
const GroupContext = createContext<{ disabled: boolean } | null>(null);
const Lens = () => <span className="sg-wheels__lens" aria-hidden="true" />;

/* The lens squeezes, in the switch's language: its two edges ride their own springs. When a hand turns the wheel the
   rows drag the lens the way they travel — the trailing edge is pulled in, so the lens squashes against its leading
   edge and widens a touch (as the switch's knob squashes against the rail); each row that crosses knocks that edge a
   little further in; when the wheel lands on its row, the edge springs back on the personality's pop spring, out
   past the lens's size and home. It answers the rows, not the input: pushing on at an end moves nothing, so the lens stays still, and
   the spring that pulls the last row into place only keeps a squeeze going, never starts one. A short turn (one
   notch, one key) still gets the whole gesture. None with calm (no squash) or reduced motion.
   One state per lens: the columns under a group's lens share it. Settings are read once, when a squeeze starts. */
type Edge = { v: number; x: number };
type LensState = {
  top: Edge; bot: Edge; dir: number; until: number; since: number; held: boolean; lastKnock: number; raf: number; t: number;
  h: number; depth: number; pw: number; pz: number; css: string; released: boolean;
};
const lensStates = new WeakMap<HTMLElement, LensState>();
const lensState = (lens: HTMLElement) => {
  let st = lensStates.get(lens);
  if (!st) lensStates.set(lens, (st = { top: { v: 0, x: 0 }, bot: { v: 0, x: 0 }, dir: 0, until: 0, since: 0, held: false, lastKnock: -1e9, raf: 0, t: 0, h: 36, depth: 0, pw: 20, pz: 0.6, css: '', released: false }));
  return st;
};
const SQUEEZE_W = (2 * Math.PI) / 0.13, SQUEEZE_Z = 0.78;   /* pulling in: quick and firm */
const HOLD = 400, MIN_HOLD = 110, KNOCK_GAP = 55;           /* ms: let go at the latest this long after the rows stop (it lets go when the wheel
                                                              lands, see letGo); a short turn holds at least this long; knocks at most this often */
/* read the settings when a squeeze starts; false when there is to be none */
const arm = (lens: HTMLElement, st: LensState) => {
  if (prefersReducedMotion(lens)) return false;
  const m = motionFor(lens); if (m.squash <= 0) return false;
  st.h = lens.offsetHeight || 36; st.depth = st.h * m.squash * 1.5;   /* lively ≈ 7.5 px, playful ≈ 12 px */
  st.pw = (2 * Math.PI) / m.pop.response; st.pz = m.pop.damping;
  return true;
};
const spring = (e: Edge, target: number, w: number, z: number, dt: number) => { e.v += (-w * w * (e.x - target) - 2 * z * w * e.v) * dt; e.x += e.v * dt; };
const tickLens = (lens: HTMLElement, st: LensState, now: number) => {
  if (!lens.isConnected) { st.raf = 0; return; }
  const dt = Math.min(1 / 30, Math.max(0, (now - st.t) / 1000)) / 3; st.t = now;
  const held = now < st.until;
  if (st.held && !held) (st.dir > 0 ? st.bot : st.top).v -= st.depth * st.pw * 1.35;   /* let go: the squeezed edge springs out */
  st.held = held;
  /* rows travelling up (dir > 0) pull the bottom edge in; down, the top */
  const inB = held && st.dir > 0, inT = held && st.dir < 0;
  for (let i = 0; i < 3; i++) {
    spring(st.bot, inB ? st.depth : 0, inB ? SQUEEZE_W : st.pw, inB ? SQUEEZE_Z : st.pz, dt);
    spring(st.top, inT ? st.depth : 0, inT ? SQUEEZE_W : st.pw, inT ? SQUEEZE_Z : st.pz, dt);
  }
  if (!held && Math.abs(st.top.x) + Math.abs(st.bot.x) < 0.04 && Math.abs(st.top.v) + Math.abs(st.bot.v) < 1) {
    st.top.x = st.top.v = st.bot.x = st.bot.v = 0; st.dir = 0; st.raf = 0; st.css = ''; lens.style.transform = ''; return;
  }
  const h = st.h, a = Math.max(-h * 0.3, Math.min(h * 0.6, st.top.x)), c = Math.max(-h * 0.3, Math.min(h * 0.6, st.bot.x));
  const sy = (h - a - c) / h, sx = 1 + 0.12 * (a + c) / h;   /* a squeezed lens widens a little (volume) */
  const css = `translateY(${((a - c) / 2).toFixed(2)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  if (css !== st.css) { st.css = css; lens.style.transform = css; }   /* held still: no write, no style work */
  st.raf = requestAnimationFrame((t) => tickLens(lens, st, t));
};
const wake = (lens: HTMLElement, st: LensState) => { if (!st.raf) { st.t = performance.now(); st.raf = requestAnimationFrame((t) => tickLens(lens, st, t)); } };
/* the rows moved under a hand, travelling `dir` (+1 up the screen, -1 down; 0: the settling spring) */
const turning = (lens: HTMLElement, dir: number) => {
  const st = lensState(lens), now = performance.now(), live = st.held && now < st.until;
  if (!dir && (!live || st.released)) return;   /* the settling pull only keeps a squeeze going, never starts or revives one */
  if (!live) { if (!arm(lens, st)) return; st.since = now; }
  if (dir) st.released = false;
  if (dir && dir !== st.dir) {   /* turned the other way: the old edge lets go, the other one squeezes */
    if (st.dir) (st.dir > 0 ? st.bot : st.top).v -= st.depth * 6;
    st.dir = dir;
  }
  if (!st.dir) return;
  st.held = true; st.until = Math.max(now + HOLD, st.since + MIN_HOLD);
  wake(lens, st);
};
/* a row crossed the lens: knock the squeezed edge a little further in */
const knock = (lens: HTMLElement) => {
  const st = lensStates.get(lens), now = performance.now();
  if (!st || !st.held || !st.dir || now - st.lastKnock < KNOCK_GAP) return;
  st.lastKnock = now;
  (st.dir > 0 ? st.bot : st.top).v += st.depth * SQUEEZE_W * 1.1;
  wake(lens, st);
};
/* the row reached the lens: let go now rather than after the hold */
const letGo = (lens: HTMLElement) => {
  const st = lensStates.get(lens);
  if (st && st.held && !st.released) { st.released = true; st.until = Math.max(performance.now() + 40, st.since + MIN_HOLD); wake(lens, st); }
};

export function Wheel<T>({ options, value, defaultValue, onChange, 'aria-label': label, pageStep = 5, align = 'center', onCommit, disabled: ownDisabled, id, className, style }: WheelProps<T>) {
  const [v, setV] = useControllable<T | undefined>(value, defaultValue ?? options.find((o) => !o.disabled)?.value, onChange as (x: T | undefined) => void);
  const found = options.findIndex((o) => Object.is(o.value, v));
  const idx = found < 0 ? 0 : found;
  const sc = useRef<HTMLDivElement>(null);
  const group = useContext(GroupContext), grouped = group !== null;
  const disabled = Boolean(ownDisabled || group?.disabled);
  const isOff = useRef(disabled); isOff.current = disabled;
  const [live, setLive] = useState(idx);
  const s = useRef({ timer: 0, raf: 0, dragging: false, user: false, mounted: false, typed: '', typedAt: 0, target: -1, dragged: 0, waits: 0, anim: null as (() => void) | null, hand: false, touching: false, lastAt: -1, prevTop: 0,
    h: 0, fade: 0.3, fadeAt: -1e9, lens: null as HTMLElement | null }).current;
  const opts = useRef(options); opts.current = options;
  const cur = useRef(v); cur.current = v;
  const set = useRef(setV); set.current = setV;

  /* the row height, measured on mount and whenever the column resizes (not per frame) */
  const measure = () => sc.current?.firstElementChild instanceof HTMLElement ? (sc.current.firstElementChild as HTMLElement).offsetHeight || 36 : 36;
  const rowH = () => s.h || (s.h = measure());
  const clamp = (i: number) => Math.max(0, Math.min(opts.current.length - 1, i));
  /* the nearest row that can be chosen (disabled rows are passed over) */
  const enabled = (i: number, dir = 0) => {
    const o = opts.current;
    if (!o[i]?.disabled) return i;
    for (let k = 1; k < o.length; k++) {
      if (dir >= 0 && i + k < o.length && !o[i + k].disabled) return i + k;
      if (dir <= 0 && i - k >= 0 && !o[i - k].disabled) return i - k;
    }
    return i;
  };

  /* rows recede with their distance from the band: smaller and fainter. Drawn on the row's label, never the row: a
     transformed row moves its own snap area, and a smooth scroll would stop short */
  const paint = () => {
    const el = sc.current; if (!el) return;
    /* clamped: Safari reports scrollTop past either end while an elastic bounce runs, which would shrink the end rows */
    const h = rowH(), mid = Math.max(0, Math.min(el.children.length - 1, el.scrollTop / h));
    /* higher contrast: rows away from the band fade much less, so every visible row keeps readable contrast */
    const now = performance.now();
    if (now - s.fadeAt > 500) { s.fade = el.closest('[data-sg-theme$="-hc"]') ? 0.16 : 0.3; s.fadeAt = now; }   /* looked up now and then, not per frame */
    const fade = s.fade;
    const from = Math.max(0, Math.floor(mid) - 4), to = Math.min(el.children.length - 1, Math.ceil(mid) + 4);
    for (let i = from; i <= to; i++) {
      const row = el.children[i].firstElementChild as HTMLElement, a = Math.abs(i - mid), k = Math.min(a, 2.5);
      const near = Math.max(0, 1 - a);   /* the row in the lens is magnified, easing in over the last row of travel */
      row.style.transform = `scale(${(1 - 0.085 * k + 0.14 * near * near).toFixed(4)})`;
      row.style.opacity = (1 - fade * k).toFixed(3);
    }
    ratchet(mid);
  };
  /* a row crossing the lens under a hand knocks it */
  const ratchet = (mid: number) => {
    const at = Math.round(mid);
    if (at === s.lastAt || Math.abs(mid - at) > 0.42) return;   /* ±0.08 row past the midpoint: no chatter on it */
    s.lastAt = at;
    const lens = lensOf(); if (lens && s.mounted && s.hand) knock(lens);
  };
  /* the spring that pulls a row into the lens (rather than the browser's scroll snap): the personality's snappy
     spring, so it overshoots a touch with lively and playful and not at all with calm or reduced motion */
  const stop = () => { s.anim?.(); s.anim = null; };
  /* the lens this column turns under (the group's, or a lone wheel's own) */
  const lensOf = () => {
    if (s.lens?.isConnected) return s.lens;
    return (s.lens = (sc.current?.closest('.sg-wheels') ?? sc.current?.parentElement)?.querySelector<HTMLElement>(':scope > .sg-wheels__lens') ?? null);
  };
  const go = (i: number, smooth: boolean) => {
    const el = sc.current; if (!el) return;
    s.target = i; stop();
    const top = i * rowH();
    if (!smooth || prefersReducedMotion(el)) { el.scrollTop = top; paint(); if (smooth) land(i); return; }
    const sp = new Spring(el.scrollTop, 'snappy', el); sp.target = top;
    let arrived = false;
    s.anim = loop((dt) => {
      sp.step(dt); el.scrollTop = sp.value; paint();
      /* the row reaches the lens (its spring may still swing a touch past and back): the lens pops now, with that
         swing, not after the spring's tail — a click or a key then feels as quick as a turn of the wheel */
      if (!arrived && Math.abs(sp.value - top) < rowH() * 0.2) { arrived = true; if (s.hand) { const lens = lensOf(); if (lens) letGo(lens); } }
      /* landed once it is in place to the eye (the spring's sub-pixel tail would hold the value and the lens back) */
      if (Math.abs(sp.value - top) > 0.5 || Math.abs(sp.velocity) > 12) return;
      el.scrollTop = top; paint(); s.anim = null; land(i);
      return false;
    });
  };
  /* arrived on row i: report it; a hand-turned wheel lets the lens go */
  const land = (i: number) => {
    s.target = -1;
    const o = opts.current[i];
    if (o && !Object.is(o.value, cur.current)) set.current(o.value);
    if (s.hand) { const lens = lensOf(); if (lens) letGo(lens); }
    s.hand = false;
  };
  /* the wheel came to rest (no scrolling for a moment, or scrollend): pull the nearest choosable row into the lens */
  const settle = () => {
    clearTimeout(s.timer);
    const el = sc.current; if (!el || s.dragging || s.touching || s.anim) return;
    const raw = clamp(Math.round(el.scrollTop / rowH())), i = enabled(raw);
    s.user = false;
    if (i !== raw || Math.abs(el.scrollTop - i * rowH()) > 0.5) go(i, true); else land(i);
  };

  useIsoLayoutEffect(() => {
    const el = sc.current; if (!el) return;
    const onScroll = () => {
      setLive(clamp(Math.round(el.scrollTop / rowH())));
      /* the hand's direction (not the settling spring's, which may pull back the other way) */
      const d = el.scrollTop - s.prevTop; s.prevTop = el.scrollTop;
      if (s.hand && Math.abs(d) > 0.3) { const lens = lensOf(); if (lens) turning(lens, s.anim ? 0 : Math.sign(d)); }
      if (s.anim) return;   /* our own spring: it paints and lands by itself */
      cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(paint);
      clearTimeout(s.timer); s.timer = window.setTimeout(settle, 140);
    };
    const onEnd = () => { if (!s.anim) settle(); };
    /* a hand on the wheel takes it from the spring. Settle soon after in any case: a finger that rests and lifts
       scrolls nothing, and the wheel must not stay "in hand" (it would stop following its value) */
    const later = () => { clearTimeout(s.timer); s.timer = window.setTimeout(settle, 140); };
    const user = () => { s.user = true; s.hand = true; stop(); later(); };
    /* a wheel pushed on at an end scrolls nothing: the turn is over (land now — a trackpad's momentum may keep sending
       events for a second), and it takes nothing from a spring */
    const onWheel = (e: WheelEvent) => {
      const dir = Math.sign(e.deltaY);
      /* at the end and not just moved there (a browser may apply the scroll before this event: one notch on a
         two-row column already sits at its end) */
      const atEnd = (dir < 0 && el.scrollTop <= 0.5) || (dir > 0 && el.scrollTop >= el.scrollHeight - el.clientHeight - 0.5);
      if (atEnd && Math.abs(el.scrollTop - s.prevTop) < 0.5) {
        if (s.hand && !s.dragging && !s.anim) settle();
        return;
      }
      user();
    };
    const touchStart = () => { s.touching = true; user(); };
    const touchEnd = () => { s.touching = false; later(); };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', onEnd);
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', touchStart, { passive: true });
    el.addEventListener('touchend', touchEnd, { passive: true });
    el.addEventListener('touchcancel', touchEnd, { passive: true });
    /* a mouse drags the column (touch and trackpads scroll it natively) */
    let top0 = 0;
    const off = drag(el, {
      axis: 'y', threshold: 3,
      start: (i) => i.event.pointerType === 'mouse' && !isOff.current ? (top0 = el.scrollTop, undefined) : false,
      move: (i) => { if (!s.dragging) { s.dragging = true; s.user = true; s.hand = true; stop(); } el.scrollTop = top0 - i.dy; },
      end: (i) => {
        if (!s.dragging) return;
        s.dragging = false;
        s.dragged = performance.now();   /* the click that ends a drag lands on the row it grabbed: not a choice */
        const h = rowH(), target = clamp(Math.round((el.scrollTop - i.vy * 0.2) / h));
        go(enabled(target, -Math.sign(i.vy)), true);
      },
    });
    return () => { off(); stop(); el.removeEventListener('scroll', onScroll); el.removeEventListener('scrollend', onEnd); el.removeEventListener('wheel', onWheel); el.removeEventListener('touchstart', touchStart); el.removeEventListener('touchend', touchEnd); el.removeEventListener('touchcancel', touchEnd); cancelAnimationFrame(s.raf); clearTimeout(s.timer); };
  }, []);

  /* the value (or the list) changed from outside: bring the row to the band — at once on first show */
  useIsoLayoutEffect(() => {
    const el = sc.current; if (!el || s.dragging || s.user) return;
    const target = idx * rowH();
    if (Math.abs(el.scrollTop - target) > 1 && s.target !== idx) go(idx, s.mounted);   /* not when already on its way there (keys, a click) */
    else paint();
    setLive(idx);
    s.mounted = true;
  }, [idx, options.length]);
  /* fonts arriving or the column being shown (display: none → block) change the row height: place it again */
  const at = useRef(idx); at.current = idx;
  useEffect(() => {
    const el = sc.current; if (!el || typeof ResizeObserver === 'undefined') return;
    /* only a real change of row height (an observer's first report, or a resize mid-scroll, must not jump it) */
    s.h = measure();
    const ro = new ResizeObserver(() => {
      const h = measure(); if (h === s.h) return; s.h = h;
      if (!s.user && !s.dragging) { el.scrollTop = at.current * h; paint(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = (i: number, dir: number) => {
    const n = enabled(clamp(i), dir);
    s.hand = true;
    { const lens = lensOf(); if (lens) turning(lens, dir); }
    go(n, true); setLive(n);
    const o = opts.current[n]; if (o && !Object.is(o.value, cur.current)) set.current(o.value);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const k = e.key, at = s.target >= 0 ? s.target : idx;   /* from where it is heading: quick presses add up */
    if (k === 'ArrowUp') step(at - 1, -1);
    else if (k === 'ArrowDown') step(at + 1, 1);
    else if (k === 'PageUp') step(at - pageStep, -1);
    else if (k === 'PageDown') step(at + pageStep, 1);
    else if (k === 'Home') step(0, 1);
    else if (k === 'End') step(opts.current.length - 1, -1);
    else if ((k === 'Enter' || k === ' ') && onCommit) onCommit();
    else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      /* type-ahead: "1", "9", "8" → the first row starting with "198" */
      const now = performance.now();
      s.typed = (now - s.typedAt > 900 ? '' : s.typed) + k.toLowerCase(); s.typedAt = now;
      const hit = opts.current.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(s.typed));
      if (hit >= 0) step(hit, 0);
    } else return;
    e.preventDefault();
  };

  const shown = options[Math.min(live, options.length - 1)];
  return (
    <div className={cx('sg-wheel', className)} style={style} data-align={align !== 'center' ? align : undefined} data-disabled={disabled || undefined}>
      {!grouped && <Lens />}
      <div ref={sc} id={id} className="sg-wheel__scroller" role="spinbutton" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled || undefined}
        aria-valuenow={live} aria-valuemin={0} aria-valuemax={options.length - 1} aria-valuetext={shown?.label} onKeyDown={onKey}>
        {options.map((o, i) => (
          <div key={String(o.value)} className="sg-wheel__item" aria-hidden="true" data-disabled={o.disabled || undefined} data-at={i === live || undefined}
            onClick={() => {
              if (disabled || s.dragging || o.disabled || performance.now() - s.dragged <= 300) return;
              s.hand = true;
              const lens = lensOf(), from = Math.round((sc.current?.scrollTop ?? 0) / rowH());
              if (lens && i !== from) turning(lens, Math.sign(i - from));
              go(i, true);
            }}><span className="sg-wheel__label">{o.label}</span></div>
        ))}
      </div>
    </div>
  );
}

/** Columns side by side under one selection band (a time: hour · minute · period; a month and a year). */
export function WheelGroup({ children, rows = 5, disabled = false, 'aria-label': label, className, style }: { children: ReactNode; rows?: number; disabled?: boolean; 'aria-label'?: string; className?: string; style?: CSSProperties }) {
  const ctx = useMemo(() => ({ disabled }), [disabled]);
  return (
    <div role="group" aria-label={label} aria-disabled={disabled || undefined} data-disabled={disabled || undefined} className={cx('sg-wheels', className)} style={{ ...style, '--_rows': rows } as CSSProperties}>
      <Lens />
      <GroupContext.Provider value={ctx}>{children}</GroupContext.Provider>
    </div>
  );
}

/* ================================================================================================ Time */
const pad = (n: number) => String(n).padStart(2, '0');
/** "HH:mm" (24 h) from hours and minutes */
export const toTimeString = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const parse = (t?: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  return m ? { h: Math.min(23, +m[1]), m: Math.min(59, +m[2]) } : null;
};
/** what the locale writes for a time, and whether it uses a 12-hour clock with the period first (오전 7:30) or last (7:30 AM) */
function timeLocale(locale: string, hour12?: boolean) {
  const probe = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', ...(hour12 === undefined ? {} : { hour12 }) });
  const cycle = probe.resolvedOptions().hourCycle;
  const h12 = hour12 ?? (cycle === 'h11' || cycle === 'h12');
  const parts = (d: Date) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: h12 }).formatToParts(d);
  const am = parts(new Date(2000, 0, 1, 9)), pm = parts(new Date(2000, 0, 1, 21));
  const period = (p: Intl.DateTimeFormatPart[]) => p.find((x) => x.type === 'dayPeriod')?.value ?? '';
  const periodFirst = am.findIndex((x) => x.type === 'dayPeriod') < am.findIndex((x) => x.type === 'hour');
  const ko = locale.toLowerCase().startsWith('ko');
  return {
    h12, periodFirst, periods: [period(am) || 'AM', period(pm) || 'PM'],
    format: (h: number, m: number) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: h12 }).format(new Date(2000, 0, 1, h, m)),
    labels: ko ? { hour: '시', minute: '분', period: '오전/오후', choose: '시간 선택', placeholder: '시간 선택', cancel: '취소', done: '완료' } : { hour: 'Hour', minute: 'Minute', period: 'AM/PM', choose: 'Choose a time', placeholder: 'Select a time', cancel: 'Cancel', done: 'Done' },
  };
}

export type TimeWheelProps = {
  /** "HH:mm", 24-hour */
  value?: string | null; defaultValue?: string | null; onChange?: (value: string) => void;
  /** minutes between rows (default 1; 5 is common for alarms and bookings) */
  minuteStep?: number;
  /** 12-hour clock with a period column; default: what the locale uses */
  hour12?: boolean;
  locale?: string;
  rows?: number;
  onCommit?: () => void;
  /** shown but not turned (an alarm that is off) */
  disabled?: boolean;
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
};

/** Hour, minute (and period) wheels for a time of day. Shows `value`, or 09:00 until one is chosen. */
export function TimeWheel({ value, defaultValue = null, onChange, minuteStep = 1, hour12, locale = 'ko-KR', rows = 5, onCommit, disabled, 'aria-label': label, className, style }: TimeWheelProps) {
  const [v, setV] = useControllable<string | null>(value, defaultValue, onChange as (x: string | null) => void);
  const L = useMemo(() => timeLocale(locale, hour12), [locale, hour12]);
  const t = parse(v) ?? { h: 9, m: 0 };
  const step = Math.max(1, Math.min(30, Math.floor(minuteStep)));
  const hours = useMemo(() => (L.h12
    ? Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
    : Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) }))), [L.h12]);
  const minutes = useMemo(() => {
    const list = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
    if (!list.includes(t.m)) list.push(t.m), list.sort((a, b) => a - b);   /* a value off the step keeps its own row */
    return list.map((m) => ({ value: m, label: pad(m) }));
  }, [step, t.m]);
  const pm = t.h >= 12, h12v = ((t.h + 11) % 12) + 1;
  const put = (h: number, m: number) => setV(toTimeString(h, m));
  const cols = [
    <Wheel key="h" aria-label={L.labels.hour} options={hours} value={L.h12 ? h12v : t.h} onCommit={onCommit} pageStep={3} align="end"
      onChange={(h) => put(L.h12 ? (h % 12) + (pm ? 12 : 0) : h, t.m)} />,
    <Wheel key="m" aria-label={L.labels.minute} options={minutes} value={t.m} onCommit={onCommit} pageStep={Math.max(1, Math.round(15 / step))} align="start"
      onChange={(m) => put(t.h, m)} />,
  ];
  if (L.h12) {
    const period = <Wheel key="p" aria-label={L.labels.period} options={[{ value: 0, label: L.periods[0] }, { value: 1, label: L.periods[1] }]} value={pm ? 1 : 0} onCommit={onCommit}
      onChange={(p) => put((t.h % 12) + (p ? 12 : 0), t.m)} className="sg-wheel--period" />;
    if (L.periodFirst) cols.unshift(period); else cols.push(period);
  }
  return (
    <WheelGroup rows={rows} disabled={disabled} aria-label={label ?? L.labels.choose} className={cx('sg-timewheel', className)} style={style}>
      {cols.flatMap((c, i) => (i && (c.key === 'm') ? [<span key="sep" className="sg-wheels__sep" aria-hidden="true">:</span>, c] : [c]))}
    </WheelGroup>
  );
}

export type TimePickerProps = Omit<TimeWheelProps, 'rows' | 'onCommit' | 'className' | 'style'> & {
  placeholder?: ReactNode;
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits HH:mm with forms */
  name?: string;
  /** the time the wheels open on while there is no value yet (default: now, rounded up to minuteStep) */
  openTo?: string;
  placement?: Placement;
  id?: string; className?: string; style?: CSSProperties;
};

const ClockIcon = () => (
  <svg className="sg-select__chevrons" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);

/** A field that opens time wheels in an anchored panel. The wheels change a draft, shown in the field while the
    panel is open; Done, Enter or a click outside takes it (onChange fires once), Cancel or Escape puts the time back
    as it was (empty, if it was). Opening without a value starts the draft at `openTo` (or now). */
export const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(function TimePicker(
  { value, defaultValue = null, onChange, minuteStep = 1, hour12, locale = 'ko-KR', placeholder, label, helperText, error, disabled, name, openTo, placement = 'bottom-start', id, className, style, 'aria-label': ariaLabel }, ref,
) {
  const [v, setV] = useControllable<string | null>(value, defaultValue, onChange as (x: string | null) => void);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-time');
  const fid = id ?? auto;
  const L = useMemo(() => timeLocale(locale, hour12), [locale, hour12]);
  const lightRef = useGlassLight();
  const commit = () => { if (draft && draft !== v) setV(draft); setOpen(false); };
  const cancel = () => setOpen(false);
  /* Escape cancels; a click outside takes what the field shows */
  const { panel, mounted } = useAnchored(open, trigger.current, placement, (r) => (r === 'escape' ? cancel() : commit()), (p) => {
    (p.querySelector<HTMLElement>('[role="spinbutton"]') ?? p).focus({ preventScroll: true });
  });
  /* the draft starts at the value, or at openTo / now (rounded up to the step) when there is none */
  const start = () => {
    const step = Math.max(1, minuteStep), n = new Date();
    let t = parse(v) ?? parse(openTo);
    if (!t) { const m = Math.ceil((n.getHours() * 60 + n.getMinutes()) / step) * step % (24 * 60); t = { h: Math.floor(m / 60), m: m % 60 }; }
    setDraft(toTimeString(t.h, t.m));
  };
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  const t = parse(open ? draft : v);
  return (
    <>
      <div className={cx('sg-field', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <span id={labelId} className="sg-field__label">{label}</span>}
        <button ref={mergeRefs(ref, trigger)} id={fid} type="button" className="sg-select" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-labelledby={labelId ? `${labelId} ${fid}` : undefined} aria-label={labelId ? undefined : ariaLabel ?? L.labels.choose}
          aria-invalid={invalid || undefined} aria-describedby={help ? `${fid}-help` : undefined}
          onClick={() => { if (open) commit(); else { start(); setOpen(true); } }}>
          <span className="sg-select__value">{t ? <span className="sg-time-value">{L.format(t.h, t.m)}</span> : <span className="sg-select__placeholder">{placeholder ?? L.labels.placeholder}</span>}</span>
          <ClockIcon />
        </button>
        {help && <span id={`${fid}-help`} className="sg-field__help">{help}</span>}
      </div>
      {name && <input type="hidden" name={name} value={v ?? ''} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : L.labels.choose} tabIndex={-1} className={cx('sg-timepicker-panel', glassClass('strong'))}>
            <div data-sg-content>
              <TimeWheel value={draft} onChange={setDraft} minuteStep={minuteStep} hour12={hour12} locale={locale} onCommit={commit} />
              <div className="sg-timepicker-panel__actions">
                <Button size="sm" variant="plain" onClick={cancel}>{L.labels.cancel}</Button>
                <Button size="sm" variant="tinted" onClick={commit}>{L.labels.done}</Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
});
