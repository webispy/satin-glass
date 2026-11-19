/* Wheels (0.3): a column of values that scrolls under a fixed selection band — for picking one of many quickly
   (a year out of a century, an hour and a minute). Built on native scrolling with scroll snap, so a finger flick or a
   trackpad keeps its platform momentum and lands on a row; a mouse can drag it (with a fling), the wheel scrolls it,
   a click on a row brings that row to the band. Rows bend away from the band like a drum (drawn per scroll frame,
   transforms and opacity only).
   For assistive technology each column is a spinbutton: arrows step, PageUp / PageDown jump `pageStep` rows,
   Home / End go to the ends, typing digits or letters jumps to the first row that starts with them. */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { drag, prefersReducedMotion, type MotionName, type Placement } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { MotionScope, Portal, glassClass, useGlassLight } from './foundation';
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
  id?: string;
  className?: string; style?: CSSProperties;
};

const DRUM = 2.6;   /* drum radius in rows: rows ±2.5 from the band turn ~55° away */

export function Wheel<T>({ options, value, defaultValue, onChange, 'aria-label': label, pageStep = 5, align = 'center', onCommit, id, className, style }: WheelProps<T>) {
  const [v, setV] = useControllable<T | undefined>(value, defaultValue ?? options.find((o) => !o.disabled)?.value, onChange as (x: T | undefined) => void);
  const found = options.findIndex((o) => Object.is(o.value, v));
  const idx = found < 0 ? 0 : found;
  const sc = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(idx);
  const s = useRef({ timer: 0, raf: 0, dragging: false, user: false, mounted: false, typed: '', typedAt: 0, target: -1, dragged: 0, waits: 0 }).current;
  const opts = useRef(options); opts.current = options;
  const cur = useRef(v); cur.current = v;
  const set = useRef(setV); set.current = setV;

  const rowH = () => sc.current?.firstElementChild instanceof HTMLElement ? (sc.current.firstElementChild as HTMLElement).offsetHeight || 36 : 36;
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

  /* the drum: each row near the band is placed on a cylinder — pulled toward the band, squashed and faded. Drawn on
     the row's label, never the row: a transformed row moves its own snap area, and a smooth scroll would stop short */
  const paint = () => {
    const el = sc.current; if (!el) return;
    /* clamped: Safari reports scrollTop past either end while an elastic bounce runs, which would bend the end rows */
    const h = rowH(), mid = Math.max(0, Math.min(el.children.length - 1, el.scrollTop / h)), R = DRUM * h;
    const from = Math.max(0, Math.floor(mid) - 4), to = Math.min(el.children.length - 1, Math.ceil(mid) + 4);
    for (let i = from; i <= to; i++) {
      const row = el.children[i].firstElementChild as HTMLElement, d = i - mid;
      const th = Math.max(-1.45, Math.min(1.45, (d * h) / R)), c = Math.cos(th);
      row.style.transform = `translateY(${(R * Math.sin(th) - d * h).toFixed(2)}px) scaleY(${c.toFixed(3)})`;
      row.style.opacity = (0.2 + 0.8 * c * c).toFixed(3);
    }
  };
  const go = (i: number, smooth: boolean) => {
    const el = sc.current; if (!el) return;
    s.target = i;
    el.scrollTo({ top: i * rowH(), behavior: smooth && !prefersReducedMotion(el) ? 'smooth' : 'instant' });
    /* already there (no scroll will follow): settle anyway; a scroll that does follow pushes this back */
    if (smooth) { clearTimeout(s.timer); s.timer = window.setTimeout(settle, 160); }
    if (!smooth) paint();
  };
  /* the wheel came to rest: settle on the row under the band and report it */
  const settle = () => {
    clearTimeout(s.timer);
    const el = sc.current; if (!el || s.dragging) return;
    const h = rowH();
    /* on its way to a row we sent it to (keys, a click, a fling): let it get there — some engines report the end of
       a smooth scroll early, and settling mid-way would stop it on the wrong row */
    if (s.target >= 0 && !s.user && Math.abs(el.scrollTop - s.target * h) > 1 && s.waits++ < 12) { s.timer = window.setTimeout(settle, 80); return; }
    s.waits = 0;
    const raw = clamp(Math.round(el.scrollTop / h)), i = enabled(raw);
    s.user = false; s.target = -1;
    if (i !== raw || Math.abs(el.scrollTop - i * h) > 1) { go(i, true); return; }
    const o = opts.current[i];
    if (o && !Object.is(o.value, cur.current)) set.current(o.value);
  };

  useIsoLayoutEffect(() => {
    const el = sc.current; if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(paint);
      setLive(clamp(Math.round(el.scrollTop / rowH())));
      clearTimeout(s.timer); s.timer = window.setTimeout(settle, 140);
    };
    const onEnd = () => settle();
    const user = () => { s.user = true; };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', onEnd);
    el.addEventListener('wheel', user, { passive: true });
    el.addEventListener('touchstart', user, { passive: true });
    /* a mouse drags the column (touch and trackpads scroll it natively) */
    let top0 = 0;
    const off = drag(el, {
      axis: 'y', threshold: 3,
      start: (i) => i.event.pointerType === 'mouse' ? (top0 = el.scrollTop, undefined) : false,
      move: (i) => { if (!s.dragging) { s.dragging = true; s.user = true; el.style.scrollSnapType = 'none'; } el.scrollTop = top0 - i.dy; },
      end: (i) => {
        if (!s.dragging) return;
        s.dragging = false; el.style.scrollSnapType = '';
        s.dragged = performance.now();   /* the click that ends a drag lands on the row it grabbed: not a choice */
        const h = rowH(), target = clamp(Math.round((el.scrollTop - i.vy * 0.2) / h));
        go(enabled(target, -Math.sign(i.vy)), true);
      },
    });
    return () => { off(); el.removeEventListener('scroll', onScroll); el.removeEventListener('scrollend', onEnd); el.removeEventListener('wheel', user); el.removeEventListener('touchstart', user); cancelAnimationFrame(s.raf); clearTimeout(s.timer); };
  }, []);

  /* the value (or the list) changed from outside: bring the row to the band — at once on first show */
  useIsoLayoutEffect(() => {
    const el = sc.current; if (!el || s.dragging || s.user) return;
    const target = idx * rowH();
    if (Math.abs(el.scrollTop - target) > 1 && s.target !== idx) go(idx, s.mounted);   /* not when already on its way there */
    else paint();
    setLive(idx);
    s.mounted = true;
  }, [idx, options.length]);
  /* fonts arriving or the column being shown (display: none → block) change the row height: place it again */
  const at = useRef(idx); at.current = idx;
  useEffect(() => {
    const el = sc.current; if (!el || typeof ResizeObserver === 'undefined') return;
    /* only a real change of row height (an observer's first report, or a resize mid-scroll, must not jump it) */
    let h0 = rowH();
    const ro = new ResizeObserver(() => {
      const h = rowH(); if (h === h0) return; h0 = h;
      if (!s.user && !s.dragging) { el.scrollTop = at.current * h; paint(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = (i: number, dir: number) => {
    const n = enabled(clamp(i), dir);
    go(n, true); setLive(n);
    const o = opts.current[n]; if (o && !Object.is(o.value, cur.current)) set.current(o.value);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
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
    <div className={cx('sg-wheel', className)} style={style} data-align={align !== 'center' ? align : undefined}>
      <div ref={sc} id={id} className="sg-wheel__scroller" role="spinbutton" tabIndex={0} aria-label={label}
        aria-valuenow={live} aria-valuemin={0} aria-valuemax={options.length - 1} aria-valuetext={shown?.label} onKeyDown={onKey}>
        {options.map((o, i) => (
          <div key={String(o.value)} className="sg-wheel__item" aria-hidden="true" data-disabled={o.disabled || undefined} data-at={i === live || undefined}
            onClick={() => { if (!s.dragging && !o.disabled && performance.now() - s.dragged > 300) go(i, true); }}><span className="sg-wheel__label">{o.label}</span></div>
        ))}
      </div>
    </div>
  );
}

/** Columns side by side under one selection band (a time: hour · minute · period; a month and a year). */
export function WheelGroup({ children, rows = 5, 'aria-label': label, className, style }: { children: ReactNode; rows?: number; 'aria-label'?: string; className?: string; style?: CSSProperties }) {
  return <div role="group" aria-label={label} className={cx('sg-wheels', className)} style={{ ...style, '--_rows': rows } as CSSProperties}>{children}</div>;
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
    labels: ko ? { hour: '시', minute: '분', period: '오전/오후', choose: '시간 선택', placeholder: '시간 선택' } : { hour: 'Hour', minute: 'Minute', period: 'AM/PM', choose: 'Choose a time', placeholder: 'Select a time' },
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
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
};

/** Hour, minute (and period) wheels for a time of day. Shows `value`, or 09:00 until one is chosen. */
export function TimeWheel({ value, defaultValue = null, onChange, minuteStep = 1, hour12, locale = 'ko-KR', rows = 5, onCommit, 'aria-label': label, className, style }: TimeWheelProps) {
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
    <WheelGroup rows={rows} aria-label={label ?? L.labels.choose} className={cx('sg-timewheel', className)} style={style}>
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
  motion?: MotionName;
  id?: string; className?: string; style?: CSSProperties;
};

const ClockIcon = () => (
  <svg className="sg-select__chevrons" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);

/** A field that opens time wheels in an anchored panel. The time changes as the wheels turn; Enter, Escape or a
    click outside closes it. Opening without a value starts at `openTo` (or now) and takes it as the value. */
export const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(function TimePicker(
  { value, defaultValue = null, onChange, minuteStep = 1, hour12, locale = 'ko-KR', placeholder, label, helperText, error, disabled, name, openTo, placement = 'bottom-start', motion, id, className, style, 'aria-label': ariaLabel }, ref,
) {
  const [v, setV] = useControllable<string | null>(value, defaultValue, onChange as (x: string | null) => void);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-time');
  const fid = id ?? auto;
  const L = useMemo(() => timeLocale(locale, hour12), [locale, hour12]);
  const lightRef = useGlassLight();
  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), (p) => {
    (p.querySelector<HTMLElement>('[role="spinbutton"]') ?? p).focus({ preventScroll: true });
  });
  const start = () => {
    if (v) return;
    const step = Math.max(1, minuteStep), n = new Date();
    let t = parse(openTo);
    if (!t) { const m = Math.ceil((n.getHours() * 60 + n.getMinutes()) / step) * step % (24 * 60); t = { h: Math.floor(m / 60), m: m % 60 }; }
    setV(toTimeString(t.h, t.m));
  };
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  const t = parse(v);
  return (
    <>
      <div className={cx('sg-field', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <span id={labelId} className="sg-field__label">{label}</span>}
        <button ref={mergeRefs(ref, trigger)} id={fid} type="button" className="sg-select" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-labelledby={labelId ? `${labelId} ${fid}` : undefined} aria-label={labelId ? undefined : ariaLabel ?? L.labels.choose}
          aria-invalid={invalid || undefined} aria-describedby={help ? `${fid}-help` : undefined} data-sg-motion={motion}
          onClick={() => { if (!open) start(); setOpen((o) => !o); }}>
          <span className="sg-select__value">{t ? <span className="sg-time-value">{L.format(t.h, t.m)}</span> : <span className="sg-select__placeholder">{placeholder ?? L.labels.placeholder}</span>}</span>
          <ClockIcon />
        </button>
        {help && <span id={`${fid}-help`} className="sg-field__help">{help}</span>}
      </div>
      {name && <input type="hidden" name={name} value={v ?? ''} />}
      {mounted && (
        <MotionScope motion={motion} bare><Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : L.labels.choose} tabIndex={-1} className={cx('sg-timepicker-panel', glassClass('strong'))}>
            <div data-sg-content>
              <TimeWheel value={v} onChange={setV} minuteStep={minuteStep} hour12={hour12} locale={locale} onCommit={() => { setOpen(false); }} />
            </div>
          </div>
        </Portal></MotionScope>
      )}
    </>
  );
});
