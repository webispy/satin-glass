/* Calendar and DatePicker (0.2). The calendar is a WAI-ARIA date grid: arrows move a day / a week, Home / End
   the start / end of the week, PageUp / PageDown a month (with Shift, a year), Enter / Space choose. Changing the
   month slides the grid on the smooth spring (reduced motion: a short fade). Dates are local calendar days. */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { animate, fade, prefersReducedMotion, type MotionName, type Placement } from '@glass-layer/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { MotionScope, Portal, glassClass, useGlassLight } from './foundation';
import { IconButton } from './controls';
import { useAnchored } from './overlay-hooks';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/* ---------------------------------------------------------------- date helpers (local days) */
const ymd = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const day = (y: number, m: number, d: number) => new Date(y, m, d, 12);   /* noon: immune to DST edges */
const startOfMonth = (d: Date) => day(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => day(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const t = day(d.getFullYear(), d.getMonth() + n, 1);
  const last = day(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return day(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
};
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const strings = (locale: string) => locale.toLowerCase().startsWith('ko')
  ? { prev: '이전 달', next: '다음 달', today: '오늘', choose: '날짜 선택', placeholder: '날짜 선택' }
  : { prev: 'Previous month', next: 'Next month', today: 'Today', choose: 'Choose a date', placeholder: 'Select a date' };

/* ================================================================================================ Calendar */
export type CalendarProps = {
  value?: Date | null; defaultValue?: Date | null; onChange?: (date: Date) => void;
  min?: Date; max?: Date;
  /** return true for days that cannot be chosen (weekends, holidays…) */
  isDateDisabled?: (date: Date) => boolean;
  /** BCP 47 locale for month and weekday names (default 'ko-KR') */
  locale?: string;
  /** 0 = Sunday (default), 1 = Monday */
  weekStartsOn?: 0 | 1;
  /** move focus to the selected (or today's) day when shown */
  autoFocus?: boolean;
  motion?: MotionName;
  className?: string; style?: CSSProperties; 'aria-label'?: string;
};

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  { value, defaultValue = null, onChange, min, max, isDateDisabled, locale = 'ko-KR', weekStartsOn = 0, autoFocus, motion, className, style, 'aria-label': ariaLabel }, ref,
) {
  const [v, setV] = useControllable<Date | null>(value, defaultValue, onChange as (d: Date | null) => void);
  const today = useMemo(() => { const n = new Date(); return day(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const [focused, setFocused] = useState<Date>(() => v ?? today);
  const [month, setMonth] = useState<Date>(() => startOfMonth(v ?? today));
  const root = useRef<HTMLDivElement>(null), body = useRef<HTMLTableSectionElement>(null);
  const t = strings(locale);
  const id = useStableId('gl-cal');
  const fmt = useMemo(() => ({
    title: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }),
    full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    wdShort: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    wdLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
  }), [locale]);

  const disabled = (d: Date) => (min && ymd(d) < ymd(min)) || (max && ymd(d) > ymd(max)) || Boolean(isDateDisabled?.(d));
  /* follow an outside change of value to its month */
  useEffect(() => { if (v && !sameMonth(v, month)) { setMonth(startOfMonth(v)); setFocused(v); } }, [v ? ymd(v) : 0]);

  /* the month changed: slide the grid in from the side it came from */
  const last = useRef(month);
  useIsoLayoutEffect(() => {
    const prev = last.current; last.current = month;
    const b = body.current;
    if (!b || sameMonth(prev, month)) return;
    const dir = ymd(month) > ymd(prev) ? 1 : -1;
    if (prefersReducedMotion(b)) { fade(b, 0, 1, 140); return; }
    animate(b, [{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth');
  }, [month]);

  /* keep keyboard focus on the focused day after it moves (only when focus is already in the grid) */
  const keyboard = useRef(false);
  useEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus();
  }, [focused]);
  useEffect(() => {
    if (autoFocus) root.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus({ preventScroll: true });
  }, []);

  const goMonth = (n: number) => {
    const m = addMonths(month, n);
    setMonth(startOfMonth(m));
    setFocused((f) => (sameMonth(f, m) ? f : addMonths(f, n)));
  };
  const focusDay = (d0: Date) => {
    /* keyboard movement stays inside min / max; days disabled by isDateDisabled stay focusable (aria-disabled) */
    let d = d0;
    if (min && ymd(d) < ymd(min)) d = day(min.getFullYear(), min.getMonth(), min.getDate());
    if (max && ymd(d) > ymd(max)) d = day(max.getFullYear(), max.getMonth(), max.getDate());
    keyboard.current = true;
    setFocused(d);
    if (!sameMonth(d, month)) setMonth(startOfMonth(d));
  };
  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const k = e.key;
    const dow = (focused.getDay() - weekStartsOn + 7) % 7;
    let d: Date | null = null;
    if (k === 'ArrowLeft') d = addDays(focused, -1);
    else if (k === 'ArrowRight') d = addDays(focused, 1);
    else if (k === 'ArrowUp') d = addDays(focused, -7);
    else if (k === 'ArrowDown') d = addDays(focused, 7);
    else if (k === 'Home') d = addDays(focused, -dow);
    else if (k === 'End') d = addDays(focused, 6 - dow);
    else if (k === 'PageUp') d = addMonths(focused, e.shiftKey ? -12 : -1);
    else if (k === 'PageDown') d = addMonths(focused, e.shiftKey ? 12 : 1);
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (!disabled(focused)) setV(focused); return; }
    if (!d) return;
    e.preventDefault();
    focusDay(d);
  };

  /* 6 weeks starting on weekStartsOn, so the grid never changes height */
  const first = month, lead = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  const titleId = `${id}-title`;

  return (
    <div ref={mergeRefs(ref, root)} className={cx('gl-calendar', className)} style={style} data-gl-motion={motion}>
      <div className="gl-calendar__head">
        <h2 id={titleId} className="gl-calendar__title" aria-live="polite">{fmt.title.format(month)}</h2>
        <div className="gl-calendar__nav">
          <IconButton size="sm" icon={<ChevronLeftIcon />} label={t.prev} onClick={() => goMonth(-1)} disabled={min ? ymd(addDays(month, -1)) < ymd(min) : false} />
          <IconButton size="sm" icon={<ChevronRightIcon />} label={t.next} onClick={() => goMonth(1)} disabled={max ? ymd(addMonths(month, 1)) > ymd(max) : false} />
        </div>
      </div>
      <table role="grid" aria-labelledby={ariaLabel ? undefined : titleId} aria-label={ariaLabel} className="gl-calendar__grid" onKeyDown={onKey}>
        <thead>
          <tr>{weeks[0].map((d) => <th key={d.getDay()} scope="col" abbr={fmt.wdLong.format(d)}>{fmt.wdShort.format(d)}</th>)}</tr>
        </thead>
        <tbody ref={body} className="gl-calendar__body">
          {weeks.map((wk, wi) => (
            <tr key={wi}>
              {wk.map((d) => {
                const sel = v ? ymd(d) === ymd(v) : false, isToday = ymd(d) === ymd(today), off = disabled(d), out = !sameMonth(d, month);
                return (
                  <td key={ymd(d)} role="gridcell" aria-selected={sel}>
                    <button type="button" className="gl-day" data-date={toISODate(d)} tabIndex={ymd(d) === ymd(focused) ? 0 : -1}
                      aria-pressed={sel} aria-current={isToday ? 'date' : undefined} aria-disabled={off || undefined}
                      data-today={isToday ? '' : undefined} data-outside={out ? '' : undefined}
                      onClick={() => { if (off) return; setFocused(d); if (out) setMonth(startOfMonth(d)); setV(d); }}>
                      {/* the number is what you see; the full date is what a screen reader hears */}
                      <span aria-hidden="true">{d.getDate()}</span>
                      <span className="gl-visually-hidden">{`${fmt.full.format(d)}${isToday ? `, ${t.today}` : ''}`}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* ================================================================================================ DatePicker */
export type DatePickerProps = Omit<CalendarProps, 'autoFocus' | 'className' | 'style'> & {
  placeholder?: ReactNode;
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits yyyy-mm-dd with forms */
  name?: string;
  /** how the chosen date is written in the field (default: Intl dateStyle 'medium' for the locale) */
  format?: (date: Date) => string;
  placement?: Placement;
  id?: string; className?: string; style?: CSSProperties;
};

const CalendarIcon = () => (
  <svg className="gl-select__chevrons" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="3" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
);

/** A field that opens a Calendar in an anchored panel; choosing a day closes it and returns focus to the field. */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, defaultValue = null, onChange, placeholder, label, helperText, error, disabled, name, format, placement = 'bottom-start', locale = 'ko-KR', motion, id, className, style, 'aria-label': ariaLabel, ...calendar }, ref,
) {
  const [v, setV] = useControllable<Date | null>(value, defaultValue, onChange as (d: Date | null) => void);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('gl-date');
  const fid = id ?? auto;
  const t = strings(locale);
  const lightRef = useGlassLight();
  const fmt = useMemo(() => format ?? ((d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)), [format, locale]);
  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), (p) => {
    (p.querySelector<HTMLButtonElement>('.gl-day[tabindex="0"]') ?? p).focus({ preventScroll: true });
  });
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  return (
    <>
      <div className={cx('gl-field', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <span id={labelId} className="gl-field__label">{label}</span>}
        <button ref={mergeRefs(ref, trigger)} id={fid} type="button" className="gl-select" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-labelledby={labelId ? `${labelId} ${fid}` : undefined} aria-label={labelId ? undefined : ariaLabel ?? t.choose}
          aria-invalid={invalid || undefined} aria-describedby={help ? `${fid}-help` : undefined} data-gl-motion={motion}
          onClick={() => setOpen((o) => !o)}>
          <span className="gl-select__value">{v ? <span>{fmt(v)}</span> : <span className="gl-select__placeholder">{placeholder ?? t.placeholder}</span>}</span>
          <CalendarIcon />
        </button>
        {help && <span id={`${fid}-help`} className="gl-field__help">{help}</span>}
      </div>
      {name && <input type="hidden" name={name} value={v ? toISODate(v) : ''} />}
      {mounted && (
        <MotionScope motion={motion} bare><Portal className="gl-portal--passthrough">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : t.choose} tabIndex={-1} className={cx('gl-datepicker-panel', glassClass('strong'))}>
            <div data-gl-content>
              <Calendar {...calendar} locale={locale} motion={motion} value={v} onChange={(d) => { setV(d); setOpen(false); }} />
            </div>
          </div>
        </Portal></MotionScope>
      )}
    </>
  );
});
