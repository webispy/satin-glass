/* Calendar and DatePicker (0.2). The calendar is a WAI-ARIA date grid: arrows move a day / a week, Home / End
   the start / end of the week, PageUp / PageDown a month (with Shift, a year), Enter / Space choose. Changing the
   month slides the grid on the smooth spring (reduced motion: a short fade). Dates are local calendar days.
   The head shows the month and the year as two chips, in the order the locale writes them ("2026년 11월",
   "November 2026"). Each opens a grid in place of the days — twelve months, or every year from min to max in one
   scrolling grid (typing digits jumps: "198" → 1980) — that blooms from its chip; picking a year goes on to the
   months, picking a month back to the days. `monthPicker="wheel"` opens month and year wheels instead.
   RangeCalendar and DateRangePicker (0.4) choose a start and an end on the same grid: the days between are joined
   by one band whose head rides a spring: it follows the pointer while the end is chosen and runs a touch past the
   end when it is picked, which the end day then takes (stretch, then stick). */
import { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Spring, animate, fade, loop, motionFor, prefersReducedMotion, type Placement } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Portal, glassClass, useGlassLight } from './foundation';
import { IconButton } from './controls';
import { Wheel, WheelGroup } from './wheel';
import { useAnchored } from './overlay-hooks';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

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

/* 을 after a final consonant, 를 after a vowel ("체크인을", "날짜를"); 을 for anything that is not Hangul */
const objectParticle = (w: string) => { const c = w.trim().charCodeAt(w.trim().length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 === 0 ? '를' : '을'; };
const strings = (locale: string) => locale.toLowerCase().startsWith('ko')
  ? { rangeStart: '시작일', rangeEnd: '종료일', pickNext: (x: string) => `${x}${objectParticle(x)} 고르세요`, partial: (label: string, date: string) => `${label} ${date}`, days: (n: number) => `${n}일`, nights: (n: number) => `${n}박 ${n + 1}일`, chooseRange: '기간 선택', prev: '이전 달', next: '다음 달', prevYear: '이전 해', nextYear: '다음 해', prevYears: '이전 연도들', nextYears: '다음 연도들', today: '오늘', choose: '날짜 선택', placeholder: '날짜 선택', pick: '연도와 월 고르기', year: '연도', month: '월', pickYear: '연도 고르기', pickMonth: '월 고르기' }
  : { rangeStart: 'start date', rangeEnd: 'end date', pickNext: (x: string) => `Choose the ${x}`, partial: (label: string, date: string) => `${label[0].toUpperCase()}${label.slice(1)}: ${date}`, days: (n: number) => `${n} day${n === 1 ? '' : 's'}`, nights: (n: number) => `${n} night${n === 1 ? '' : 's'}`, chooseRange: 'Choose dates', prev: 'Previous month', next: 'Next month', prevYear: 'Previous year', nextYear: 'Next year', prevYears: 'Earlier years', nextYears: 'Later years', today: 'Today', choose: 'Choose a date', placeholder: 'Select a date', pick: 'Choose month and year', year: 'Year', month: 'Month', pickYear: 'Choose a year', pickMonth: 'Choose a month' };

/* ================================================================================================ Calendar */
/* a RangeCalendar around a Calendar: the days show the range and a pick goes to it */
type RangeCtx = { start: Date | null; end: Date | null; pick: (d: Date) => void; reach: (d: Date) => boolean; starts: string; ends: string };
const RangeContext = createContext<RangeCtx | null>(null);

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
  /** the month shown while there is no value (default: this month) — e.g. some decades back for a birth date */
  defaultMonth?: Date;
  /** open on the days (default), the months or the years — a birth date is quicker to reach by its year */
  openTo?: 'day' | 'month' | 'year';
  /** how the month and year are picked: grids (default) or wheels */
  monthPicker?: 'grid' | 'wheel';
  className?: string; style?: CSSProperties; 'aria-label'?: string;
};

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  { value, defaultValue = null, onChange, min, max, isDateDisabled, locale = 'ko-KR', weekStartsOn = 0, autoFocus, defaultMonth, openTo = 'day', monthPicker = 'grid', className, style, 'aria-label': ariaLabel }, ref,
) {
  const [v, setV] = useControllable<Date | null>(value, defaultValue, onChange as (d: Date | null) => void);
  const range = useContext(RangeContext);
  /* while the end is being chosen, the day under the pointer (or keyboard focus) previews it */
  const [hover, setHover] = useState<Date | null>(null);
  const today = useMemo(() => { const n = new Date(); return day(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const initial = defaultMonth ? day(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1) : today;
  const [focused, setFocused] = useState<Date>(() => v ?? initial);
  const [month, setMonth] = useState<Date>(() => startOfMonth(v ?? initial));
  const wheels = monthPicker === 'wheel';
  const [view, setView] = useState<'day' | 'month' | 'year'>(wheels && openTo === 'year' ? 'month' : openTo);
  const root = useRef<HTMLDivElement>(null), body = useRef<HTMLTableSectionElement>(null);
  const t = strings(locale);
  const id = useStableId('sg-cal');
  const fmt = useMemo(() => ({
    title: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }),
    full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    wdShort: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    wdLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long' }),
    year: new Intl.DateTimeFormat(locale, { year: 'numeric' }),
  }), [locale]);
  /* the years min..max (or a century back and twenty years on from today); months outside min / max are passed over */
  const y0 = min ? min.getFullYear() : today.getFullYear() - 100, y1 = max ? max.getFullYear() : today.getFullYear() + 20;
  const years = useMemo(() => Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ value: y0 + i, label: fmt.year.format(day(y0 + i, 0, 1)) })), [y0, y1, fmt]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => ({
    value: m, label: fmt.month.format(day(2000, m, 1)),
    disabled: Boolean((min && (month.getFullYear() * 12 + m) < min.getFullYear() * 12 + min.getMonth()) || (max && (month.getFullYear() * 12 + m) > max.getFullYear() * 12 + max.getMonth())),
  })), [fmt, month.getFullYear(), min ? ymd(min) : 0, max ? ymd(max) : 0]);
  /* year first where the locale writes it first ("2026년 11월"), month first otherwise ("November 2026") */
  const yearFirst = useMemo(() => { const p = fmt.title.formatToParts(day(2000, 0, 1)); return p.findIndex((x) => x.type === 'year') < p.findIndex((x) => x.type === 'month'); }, [fmt]);
  const toMonth = (y: number, m: number) => {
    let t = day(y, m, 1);
    if (min && t.getFullYear() * 12 + t.getMonth() < min.getFullYear() * 12 + min.getMonth()) t = day(min.getFullYear(), min.getMonth(), 1);
    if (max && t.getFullYear() * 12 + t.getMonth() > max.getFullYear() * 12 + max.getMonth()) t = day(max.getFullYear(), max.getMonth(), 1);
    setMonth(t);
    setFocused((f) => { const last = day(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return day(t.getFullYear(), t.getMonth(), Math.min(f.getDate(), last)); });
  };
  /* swap days ↔ months / years: a grid blooms from the chip that opened it (the pop spring, from 0.6 × 0.3 like a
     menu); the days rise back in. Reduced motion: a fade */
  const viewBox = useRef<HTMLDivElement>(null), firstView = useRef(true), opener = useRef<HTMLElement | null>(null);
  useIsoLayoutEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    const b = viewBox.current; if (!b) return;
    if (prefersReducedMotion(b)) { fade(b, 0, 1, 140); return; }
    const o = opener.current;
    if (view !== 'day' && o) {
      const r = b.getBoundingClientRect(), c = o.getBoundingClientRect();
      b.style.transformOrigin = `${(c.left + c.width / 2 - r.left).toFixed(1)}px 0px`;
      animate(b, [{ transform: 'scale(0.6, 0.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'pop');
    } else animate(b, [{ transform: 'translateY(6px) scale(0.98)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth');
  }, [view]);
  const backToDays = () => { opener.current = null; setView('day'); keyboard.current = true; requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus({ preventScroll: true })); };
  const focusSoon = (sel: string) => requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true }));
  const yearPage = useRef<(dir: number) => void>(() => {});
  const [yearEdge, setYearEdge] = useState({ top: false, bottom: false });

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
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (!disabled(focused)) { if (range) range.pick(focused); else setV(focused); } return; }
    if (!d) return;
    e.preventDefault();
    focusDay(d);
  };

  /* 6 weeks starting on weekStartsOn, so the grid never changes height */
  const first = month, lead = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  const titleId = `${id}-title`;

  /* ---- the range band: the days between lie in a groove (the path a range is laid along: depth -1) holding the
     accent's soft tint, one strip in reading order drawn as runs per week behind the days, rounded at the week's
     edges and concentric with the end beads. While the end is chosen the tint's head follows the pointer (or
     keyboard focus) on the snappy spring, flowing round the week's end; a picked end, or a new start, opens its
     accent face (not the day, not its number) from the centre on the pop spring. Reduced motion: the final
     geometry, no springs. */
  const bands = useRef<HTMLDivElement>(null);
  type BandEng = { H: Spring; stop: (() => void) | null; month: number; key: string };
  const bandEng = useRef<BandEng | null>(null);
  const candidate = range && range.start && !range.end && hover && range.reach(hover) && ymd(hover) !== ymd(range.start) ? hover : null;
  const hoverKey = candidate ? ymd(candidate) : 0;
  useIsoLayoutEffect(() => {
    const layer = bands.current, tb = body.current, table = tb?.parentElement as HTMLElement | undefined;
    if (!range || !layer || !tb || !table || view !== 'day') return;
    const cell = tb.rows[0]?.cells[0]?.offsetWidth || 40, W = cell * 7, pool = layer.children as HTMLCollectionOf<HTMLElement>;
    /* a row's top within the table, from where the engine draws it: offsetTop of a row means different things here
       (the body is positioned, as it slides between months: Blink measures rows from the body, WebKit from the table,
       and Gecko skips the table in the chain), and adding the body's offset by hand drew every strip a row low in
       Safari. The table may be scaled (a picker's panel blooming), so the drawn distance is divided by its scale. */
    const tr = table.getBoundingClientRect(), k = tr.height / (table.offsetHeight || 1) || 1;
    const rowY = Array.from(tb.rows, (r) => table.offsetTop + (r.getBoundingClientRect().top - tr.top) / k + (r.offsetHeight - 36) / 2);
    const idx = (d: Date) => Math.round((d.getTime() - start.getTime()) / 864e5);
    const Lx = (i: number) => i * cell + 2, Rx = (i: number) => (i + 1) * cell - 2;
    type Run = [number, number, 'soft' | 'faint'];
    const paint = (runs: Run[]) => {
      let n = 0;
      for (const [a0, b0, kind] of runs) {
        const lo = Math.min(a0, b0), hi = Math.max(a0, b0);
        for (let r = 0; r < rowY.length && n < pool.length; r++) {
          const L = Math.max(2, Math.max(lo, r * W) - r * W), R = Math.min(W - 2, Math.min(hi, (r + 1) * W) - r * W);
          if (R - L < 1) continue;
          const el = pool[n++];
          el.dataset.kind = kind; el.style.display = 'block';
          el.style.transform = `translate(${(table.offsetLeft + L).toFixed(2)}px, ${rowY[r].toFixed(2)}px)`;
          el.style.width = `${(R - L).toFixed(2)}px`;
          el.style.borderRadius = `${Math.min(18, (R - L) / 2).toFixed(2)}px`;
        }
      }
      for (; n < pool.length; n++) pool[n].style.display = 'none';
    };
    const btnOf = (d: Date) => tb.querySelector<HTMLElement>(`[data-date="${toISODate(d)}"]`);
    const reduced = prefersReducedMotion(layer), sq = motionFor(layer).squash;
    /* the accent face opens from the centre on the pop spring: from 30 (calm) / 28 (lively) / 27 (playful) px to 36 */
    const seat = (d: Date) => { const f = btnOf(d)?.querySelector<HTMLElement>('.sg-day__face'); if (f && !reduced) animate(f, [{ transform: `scale(${((30 - 14 * sq) / 36).toFixed(3)})` }, { transform: 'none' }], 'pop'); };

    const startD = range.start;
    let st = bandEng.current;
    if (!startD) { st?.stop?.(); if (st) { st.stop = null; st.key = ''; } paint([]); return; }
    const sI = idx(startD), eI = range.end ? idx(range.end) : null, cI = candidate ? idx(candidate) : null;
    const tintTo = eI !== null ? Rx(eI) : cI !== null ? Rx(cI) : Lx(sI);
    const tintKind: Run[2] = eI !== null ? 'soft' : 'faint';
    const runsAt = (head: number): Run[] => (head > Lx(sI) + 1 ? [[Lx(sI), head, tintKind]] : []);
    const key = `${ymd(startD)}-${range.end ? ymd(range.end) : ''}`;
    if (!st) st = bandEng.current = { H: new Spring(tintTo, 'snappy', layer), stop: null, month: 0, key: '' };
    const was = st.key, newStart = !was || was.split('-')[0] !== String(ymd(startD)), committed = eI !== null && was !== key && !newStart;
    const fresh = st.month !== ymd(month) || !was || reduced;
    const monthMoved = Boolean(st.month) && st.month !== ymd(month);
    st.key = key; st.month = ymd(month);
    const e = st;
    const animateHead = (onTick?: () => void) => {
      if (e.stop) return;
      e.stop = loop((dt) => {
        e.H.step(dt); paint(runsAt(e.H.value)); onTick?.();
        if (!e.H.settled) return;
        e.H.jump(e.H.target); paint(runsAt(e.H.value)); e.stop = null;
        return false;
      });
    };
    if (fresh || newStart) {
      e.stop?.(); e.stop = null; e.H.jump(tintTo); paint(runsAt(tintTo));
      if (monthMoved) layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 120, fill: 'backwards' });   /* after the month's slide */
      if (newStart && was && !reduced) seat(startD);
      return;
    }
    e.H.target = tintTo; animateHead();
    if (committed) seat(range.end!);
  }, [range?.start ? ymd(range.start) : 0, range?.end ? ymd(range.end) : 0, hoverKey, ymd(month), view]);
  useEffect(() => () => bandEng.current?.stop?.(), []);

  return (
    <div ref={mergeRefs(ref, root)} className={cx('sg-calendar', className)} style={style}>
      <div className="sg-calendar__head">
        {/* the title for assistive technology (and the grid's label); the chips are what you see */}
        <h2 id={titleId} className="sg-visually-hidden" aria-live="polite">{fmt.title.format(month)}</h2>
        <div className="sg-calendar__chips">
          {(() => {
            const chip = (which: 'year' | 'month') => {
              const open = wheels ? view === 'month' : view === which;
              return (
                <button key={which} type="button" className="sg-calendar__chip" aria-expanded={open}
                  aria-label={`${which === 'year' ? fmt.year.format(month) : fmt.month.format(month)}, ${which === 'year' ? t.pickYear : t.pickMonth}`}
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    if (open) { backToDays(); return; }
                    setView(wheels ? 'month' : which);
                    /* into the grid (or the wheels), so arrows and typing work at once */
                    focusSoon(wheels ? '.sg-calendar__wheels [role="spinbutton"]' : '.sg-calendar__cell[aria-selected="true"], .sg-calendar__cell[tabindex="0"]');
                  }}>
                  <span>{which === 'year' ? fmt.year.format(month) : fmt.month.format(month)}</span><ChevronDownIcon className="sg-calendar__chip-chevron" />
                </button>
              );
            };
            return yearFirst ? [chip('year'), chip('month')] : [chip('month'), chip('year')];
          })()}
        </div>
        <div className="sg-calendar__nav" hidden={wheels && view === 'month'}>
          {view === 'year' ? (<>
            <IconButton size="sm" icon={<ChevronLeftIcon />} label={t.prevYears} onClick={() => yearPage.current(-1)} disabled={yearEdge.top} />
            <IconButton size="sm" icon={<ChevronRightIcon />} label={t.nextYears} onClick={() => yearPage.current(1)} disabled={yearEdge.bottom} />
          </>) : view === 'month' ? (<>
            <IconButton size="sm" icon={<ChevronLeftIcon />} label={t.prevYear} onClick={() => toMonth(month.getFullYear() - 1, month.getMonth())} disabled={month.getFullYear() <= y0} />
            <IconButton size="sm" icon={<ChevronRightIcon />} label={t.nextYear} onClick={() => toMonth(month.getFullYear() + 1, month.getMonth())} disabled={month.getFullYear() >= y1} />
          </>) : (<>
            <IconButton size="sm" icon={<ChevronLeftIcon />} label={t.prev} onClick={() => goMonth(-1)} disabled={min ? ymd(addDays(month, -1)) < ymd(min) : false} />
            <IconButton size="sm" icon={<ChevronRightIcon />} label={t.next} onClick={() => goMonth(1)} disabled={max ? ymd(addMonths(month, 1)) > ymd(max) : false} />
          </>)}
        </div>
      </div>
      <div ref={viewBox} className="sg-calendar__view">
      {range && view === 'day' && <div ref={bands} className="sg-calendar__bands" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={i} className="sg-calendar__seg" />)}</div>}
      {view === 'year' && !wheels ? (
        <YearGrid years={years} value={month.getFullYear()} current={today.getFullYear()} label={t.pickYear} pageRef={yearPage} onEdge={setYearEdge}
          onPick={(y) => { toMonth(y, month.getMonth()); opener.current = null; setView('month'); focusSoon('.sg-calendar__cell[aria-selected="true"]'); }} onCancel={backToDays} />
      ) : view === 'month' && !wheels ? (
        <MonthGrid months={months} value={month.getMonth()} current={month.getFullYear() === today.getFullYear() ? today.getMonth() : -1} label={t.pickMonth} caption={fmt.year.format(month)}
          onPick={(m) => { toMonth(month.getFullYear(), m); backToDays(); }} onCancel={backToDays} />
      ) : view === 'month' ? (
        <div className="sg-calendar__wheels">
          <WheelGroup rows={7} aria-label={t.pick}>
            {[
              <Wheel key="y" aria-label={t.year} options={years} value={month.getFullYear()} pageStep={10} onChange={(y) => toMonth(y, month.getMonth())} onCommit={backToDays} />,
              <Wheel key="m" aria-label={t.month} options={months} value={month.getMonth()} pageStep={3} onChange={(m) => toMonth(month.getFullYear(), m)} onCommit={backToDays} />,
            ][yearFirst ? 'slice' : 'reverse']()}
          </WheelGroup>
        </div>
      ) : (
      <table role="grid" aria-labelledby={ariaLabel ? undefined : titleId} aria-label={ariaLabel} aria-multiselectable={range ? true : undefined} className="sg-calendar__grid" onKeyDown={onKey}
        onMouseLeave={range ? () => setHover(null) : undefined}>
        <thead>
          <tr>{weeks[0].map((d) => <th key={d.getDay()} scope="col" abbr={fmt.wdLong.format(d)}>{fmt.wdShort.format(d)}</th>)}</tr>
        </thead>
        <tbody ref={body} className="sg-calendar__body">
          {(() => {
            /* the range drawn: chosen, or from the start to the day under the pointer while the end is chosen */
            const lo = range?.start ?? null;
            const hi = range ? (range.end ?? (lo && hover && range.reach(hover) ? hover : null)) : null;
            const preview = Boolean(range && !range.end && hi);
            const a = lo && hi ? ymd(lo) : 0, z = lo && hi ? ymd(hi) : 0;
            return weeks.map((wk, wi) => (
              <tr key={wi}>
                {wk.map((d, col) => {
                  const k = ymd(d), isToday = k === ymd(today), off = disabled(d), out = !sameMonth(d, month);
                  const sel = range ? Boolean((range.start && k === ymd(range.start)) || (range.end && k === ymd(range.end))) : v ? k === ymd(v) : false;
                  const band = a && z && a !== z && k >= a && k <= z ? (k === a ? 'start' : k === z ? 'end' : 'mid') : undefined;
                  const role = range && sel ? (range.start && k === ymd(range.start) ? range.starts : range.ends) : '';
                  return (
                    <td key={k} role="gridcell" aria-selected={sel || (band === 'mid' && !preview)} data-band={band} data-col={band ? col : undefined} data-preview={band && preview ? '' : undefined}>
                      <button type="button" className="sg-day" data-date={toISODate(d)} tabIndex={k === ymd(focused) ? 0 : -1}
                        aria-pressed={sel} aria-current={isToday ? 'date' : undefined} aria-disabled={off || undefined}
                        data-today={isToday ? '' : undefined} data-outside={out ? '' : undefined}
                        onMouseEnter={range ? () => setHover(d) : undefined} onFocus={range ? () => setHover(d) : undefined}
                        onClick={() => { if (off) return; setFocused(d); if (out) setMonth(startOfMonth(d)); if (range) range.pick(d); else setV(d); }}>
                        {range && sel && <span className="sg-day__face" aria-hidden="true" />}
                        {/* the number is what you see; the full date is what a screen reader hears */}
                        <span aria-hidden="true">{d.getDate()}</span>
                        <span className="sg-visually-hidden">{`${fmt.full.format(d)}${isToday ? `, ${t.today}` : ''}${role ? `, ${role}` : ''}`}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ));
          })()}
        </tbody>
      </table>
      )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------------------------------------ month / year grids
   A listbox laid out in three columns: arrows move a cell (up / down a row), Home / End the row's ends, Enter or a
   click chooses, Escape goes back to the days. The chosen cell fills from its middle on the pop spring (like a
   weekday); the current month or year has an accent ring. */
type Cell = { value: number; label: string; disabled?: boolean };
function useGridKeys(cells: Cell[], at: number, onPick: (v: number) => void, onCancel: () => void, extra?: (e: KeyboardEvent<HTMLDivElement>, i: number) => number | null) {
  const [focus, setFocus] = useState(at);
  useEffect(() => setFocus(at), [at]);
  const box = useRef<HTMLDivElement>(null);
  const move = (i: number) => {
    const n = Math.max(0, Math.min(cells.length - 1, i));
    setFocus(n);
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${n}"]`);
    el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion(el) ? 'instant' : 'smooth' });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key, i = focus;
    let t: number | null = null;
    if (k === 'ArrowLeft') t = i - 1; else if (k === 'ArrowRight') t = i + 1;
    else if (k === 'ArrowUp') t = i - 3; else if (k === 'ArrowDown') t = i + 3;
    else if (k === 'Home') t = i - (i % 3); else if (k === 'End') t = i - (i % 3) + 2;
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (!cells[i]?.disabled) onPick(cells[i].value); return; }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    else t = extra?.(e, i) ?? null;
    if (t === null) return;
    e.preventDefault(); move(t);
  };
  return { focus, box, onKeyDown, move };
}
function GridCells({ cells, value, current, focus, onPick }: { cells: Cell[]; value: number; current: number; focus: number; onPick: (v: number) => void }) {
  return (<>{cells.map((c, i) => (
    <div key={c.value} role="option" data-i={i} tabIndex={i === focus ? 0 : -1} className="sg-calendar__cell"
      aria-selected={c.value === value} aria-disabled={c.disabled || undefined} data-current={c.value === current || undefined}
      onClick={() => { if (!c.disabled) onPick(c.value); }}><span>{c.label}</span></div>
  ))}</>);
}
function MonthGrid({ months, value, current, label, caption, onPick, onCancel }: { months: Cell[]; value: number; current: number; label: string; caption: string; onPick: (m: number) => void; onCancel: () => void }) {
  const k = useGridKeys(months, value, onPick, onCancel);
  return (
    <div className="sg-calendar__picker">
      <div className="sg-calendar__caption" aria-hidden="true">{caption}</div>
      <div ref={k.box} role="listbox" aria-label={`${caption} · ${label}`} className="sg-calendar__cells" onKeyDown={k.onKeyDown}>
        <GridCells cells={months} value={value} current={current} focus={k.focus} onPick={onPick} />
      </div>
    </div>
  );
}
function YearGrid({ years, value, current, label, pageRef, onEdge, onPick, onCancel }: {
  years: Cell[]; value: number; current: number; label: string; pageRef: { current: (dir: number) => void }; onEdge: (e: { top: boolean; bottom: boolean }) => void;
  onPick: (y: number) => void; onCancel: () => void;
}) {
  const at = Math.max(0, years.findIndex((y) => y.value === value));
  const typed = useRef({ s: '', t: 0 });
  const k = useGridKeys(years, at, onPick, onCancel, (e, i) => {
    if (e.key === 'PageUp') return i - 12;
    if (e.key === 'PageDown') return i + 12;
    if (/^\d$/.test(e.key)) {   /* type-ahead: "198" → 1980, "1975" → 1975 */
      const now = performance.now(), T = typed.current;
      T.s = (now - T.t > 1000 ? '' : T.s) + e.key; T.t = now;
      const hit = years.findIndex((y) => String(y.value).startsWith(T.s.length >= 4 ? T.s : T.s.padEnd(4, '0')) || (T.s.length >= 3 && String(y.value).startsWith(T.s)));
      return hit >= 0 ? hit : null;
    }
    return null;
  });
  const [range, setRange] = useState('');
  useIsoLayoutEffect(() => {
    const g = k.box.current; if (!g) return;
    /* open with the chosen year in the middle */
    const sel = g.querySelector<HTMLElement>(`[data-i="${at}"]`);
    if (sel) g.scrollTop = sel.offsetTop - (g.clientHeight - sel.offsetHeight) / 2;
    const label = () => {
      const top = g.scrollTop, bot = top + g.clientHeight, cs = Array.from(g.children) as HTMLElement[];
      const vis = cs.filter((c) => c.offsetTop >= top - 2 && c.offsetTop + c.offsetHeight <= bot + 2);
      if (vis.length) setRange(`${years[+vis[0].dataset.i!].label} – ${years[+vis[vis.length - 1].dataset.i!].label}`);
      const atTop = top <= 0, atBottom = bot >= g.scrollHeight - 1;
      onEdge({ top: atTop, bottom: atBottom });
      /* fade only an edge that has more years behind it (none when everything fits) */
      g.toggleAttribute('data-more-top', !atTop); g.toggleAttribute('data-more-bottom', !atBottom);
    };
    label();
    g.addEventListener('scroll', label, { passive: true });
    pageRef.current = (dir) => {
      const row = (g.children[3] as HTMLElement | undefined)?.offsetTop ?? 52;
      g.scrollBy({ top: dir * 4 * row, behavior: prefersReducedMotion(g) ? 'instant' : 'smooth' });
    };
    return () => g.removeEventListener('scroll', label);
  }, []);
  return (
    <div className="sg-calendar__picker">
      <div className="sg-calendar__caption" aria-hidden="true">{range}</div>
      <div ref={k.box} role="listbox" aria-label={label} className="sg-calendar__cells sg-calendar__cells--scroll" onKeyDown={k.onKeyDown}>
        <GridCells cells={years} value={value} current={current} focus={k.focus} onPick={onPick} />
      </div>
    </div>
  );
}

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
  <svg className="sg-select__chevrons" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="3" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
);

/** A field that opens a Calendar in an anchored panel; choosing a day closes it and returns focus to the field. */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, defaultValue = null, onChange, placeholder, label, helperText, error, disabled, name, format, placement = 'bottom-start', locale = 'ko-KR', id, className, style, 'aria-label': ariaLabel, ...calendar }, ref,
) {
  const [v, setV] = useControllable<Date | null>(value, defaultValue, onChange as (d: Date | null) => void);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-date');
  const fid = id ?? auto;
  const t = strings(locale);
  const lightRef = useGlassLight();
  const fmt = useMemo(() => format ?? ((d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)), [format, locale]);
  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), (p) => {
    /* the day, the chosen month or year in a grid, or the first wheel — whatever the calendar opened on */
    (p.querySelector<HTMLElement>('.sg-day[tabindex="0"], .sg-calendar__cell[tabindex="0"], .sg-wheel__scroller') ?? p).focus({ preventScroll: true });
  });
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  return (
    <>
      <div className={cx('sg-field', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <span id={labelId} className="sg-field__label">{label}</span>}
        <button ref={mergeRefs(ref, trigger)} id={fid} type="button" className="sg-select" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-labelledby={labelId ? `${labelId} ${fid}` : undefined} aria-label={labelId ? undefined : ariaLabel ?? t.choose}
          aria-invalid={invalid || undefined} aria-describedby={help ? `${fid}-help` : undefined}
          onClick={() => setOpen((o) => !o)}>
          <span className="sg-select__value">{v ? <span>{fmt(v)}</span> : <span className="sg-select__placeholder">{placeholder ?? t.placeholder}</span>}</span>
          <CalendarIcon />
        </button>
        {help && <span id={`${fid}-help`} className="sg-field__help">{help}</span>}
      </div>
      {name && <input type="hidden" name={name} value={v ? toISODate(v) : ''} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : t.choose} tabIndex={-1} className={cx('sg-datepicker-panel', glassClass('strong'))}>
            <div data-sg-content>
              <Calendar {...calendar} locale={locale} value={v} onChange={(d) => { setV(d); setOpen(false); }} />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
});

/* ================================================================================================ ranges (0.4) */
export type DateRange = { start: Date; end: Date };
const spanDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);

export type RangeCalendarProps = Omit<CalendarProps, 'value' | 'defaultValue' | 'onChange' | 'openTo'> & {
  value?: DateRange | null; defaultValue?: DateRange | null;
  /** called when both days are chosen */
  onChange?: (range: DateRange) => void;
  /** the first day was chosen (a date) or cleared (null), the second is awaited */
  onPartial?: (start: Date | null) => void;
  /** fewest / most days from the start to the end (a stay of at least one night: minLength 1). Default 0 / none */
  minLength?: number; maxLength?: number;
  /** how the length is told: 'days' (3일, default) or 'nights' (2박 3일) */
  unit?: 'days' | 'nights';
  /** what the two days are called (체크인 / 체크아웃); default 시작일 / 종료일 */
  labels?: { start?: string; end?: string };
  /** the line under the days that says what to choose next and how long the range is (default true) */
  status?: boolean;
};

/** A calendar that chooses a start and an end. The first pick is the start; the second, the end (an earlier day, or
    one the range cannot reach — past maxLength or past a disabled day — starts over; the start again clears it).
    Days between start and end are joined by a band. */
export const RangeCalendar = forwardRef<HTMLDivElement, RangeCalendarProps>(function RangeCalendar(
  { value, defaultValue = null, onChange, onPartial, minLength = 0, maxLength = Infinity, unit = 'days', labels, status = true, locale = 'ko-KR', min, max, isDateDisabled, className, style, ...cal }, ref,
) {
  const [v, setV] = useControllable<DateRange | null>(value, defaultValue, onChange as (r: DateRange | null) => void);
  const [draft, setDraft] = useState<{ start: Date | null; end: Date | null }>(() => ({ start: v?.start ?? null, end: v?.end ?? null }));
  useEffect(() => { setDraft({ start: v?.start ?? null, end: v?.end ?? null }); }, [v ? ymd(v.start) : 0, v ? ymd(v.end) : 0]);
  const t = strings(locale);
  const S = labels?.start ?? t.rangeStart, E = labels?.end ?? t.rangeEnd;
  const blocked = (d: Date) => Boolean((min && ymd(d) < ymd(min)) || (max && ymd(d) > ymd(max)) || isDateDisabled?.(d));
  /* can d end the range that starts at the draft's start? Long enough, not too long, nothing disabled on the way */
  const reach = (d: Date) => {
    const s0 = draft.start; if (!s0 || draft.end) return false;
    const n = spanDays(s0, d);
    if (n < Math.max(0, minLength) || n > maxLength || blocked(d)) return false;
    for (let i = 1; i < n; i++) if (blocked(addDays(s0, i))) return false;
    return true;
  };
  const begin = (d: Date | null) => { setDraft({ start: d, end: null }); onPartial?.(d); };
  const pick = (d: Date) => {
    if (blocked(d)) return;
    if (!draft.start || draft.end) { begin(d); return; }
    if (ymd(d) === ymd(draft.start) && minLength > 0) { begin(null); return; }
    if (reach(d)) { const r = { start: draft.start, end: d }; setDraft(r); setV(r); return; }
    begin(d);
  };
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }), [locale]);
  const length = (a: Date, b: Date) => (unit === 'nights' ? t.nights(spanDays(a, b)) : t.days(spanDays(a, b) + 1));
  const line = !draft.start ? t.pickNext(S)
    : !draft.end ? `${t.partial(S, fmtDay.format(draft.start))} · ${t.pickNext(E)}`
    : `${formatRange(fmtDay, draft.start, draft.end)} · ${length(draft.start, draft.end)}`;
  const ctx = useMemo<RangeCtx>(() => ({ start: draft.start, end: draft.end, pick, reach, starts: S, ends: E }),
    [draft.start ? ymd(draft.start) : 0, draft.end ? ymd(draft.end) : 0, minLength, maxLength, S, E, min ? ymd(min) : 0, max ? ymd(max) : 0, isDateDisabled]);
  return (
    <div ref={ref} className={cx('sg-rangecalendar', className)} style={style}>
      <RangeContext.Provider value={ctx}>
        <Calendar {...cal} locale={locale} min={min} max={max} isDateDisabled={isDateDisabled} value={draft.start} />
      </RangeContext.Provider>
      {status && <p className="sg-calendar__status" aria-live="polite" data-done={draft.end ? '' : undefined}>{line}</p>}
    </div>
  );
});

/* "11월 20일 (목) ~ 22일 (토)": the locale's own way of writing a span, where it has one */
function formatRange(f: Intl.DateTimeFormat, a: Date, b: Date) {
  const r = (f as Intl.DateTimeFormat & { formatRange?: (x: Date, y: Date) => string }).formatRange;
  return r ? r.call(f, a, b) : `${f.format(a)} – ${f.format(b)}`;
}

export type DateRangePickerProps = Omit<RangeCalendarProps, 'status' | 'onPartial' | 'className' | 'style'> & {
  placeholder?: ReactNode;
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits the range with forms as an ISO 8601 interval, yyyy-mm-dd/yyyy-mm-dd */
  name?: string;
  /** how the range is written in the field (default: the locale's short span, then its length) */
  format?: (range: DateRange) => string;
  placement?: Placement;
  id?: string; className?: string; style?: CSSProperties;
};

/** A field that opens a RangeCalendar. Choosing the end closes it with the new range; Escape or a click outside
    before then leaves the range as it was. */
export const DateRangePicker = forwardRef<HTMLButtonElement, DateRangePickerProps>(function DateRangePicker(
  { value, defaultValue = null, onChange, placeholder, label, helperText, error, disabled, name, format, placement = 'bottom-start', locale = 'ko-KR', unit = 'days', id, className, style, 'aria-label': ariaLabel, ...range }, ref,
) {
  const [v, setV] = useControllable<DateRange | null>(value, defaultValue, onChange as (r: DateRange | null) => void);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-range');
  const fid = id ?? auto;
  const t = strings(locale);
  const lightRef = useGlassLight();
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }), [locale]);
  const text = (r: DateRange) => format ? format(r) : formatRange(fmtDay, r.start, r.end);
  const length = (r: DateRange) => (unit === 'nights' ? t.nights(spanDays(r.start, r.end)) : t.days(spanDays(r.start, r.end) + 1));
  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), (p) => {
    (p.querySelector<HTMLElement>('.sg-day[tabindex="0"], .sg-calendar__cell[tabindex="0"], .sg-wheel__scroller') ?? p).focus({ preventScroll: true });
  });
  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  return (
    <>
      <div className={cx('sg-field', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <span id={labelId} className="sg-field__label">{label}</span>}
        <button ref={mergeRefs(ref, trigger)} id={fid} type="button" className="sg-select" disabled={disabled}
          aria-haspopup="dialog" aria-expanded={open} aria-labelledby={labelId ? `${labelId} ${fid}` : undefined} aria-label={labelId ? undefined : ariaLabel ?? t.chooseRange}
          aria-invalid={invalid || undefined} aria-describedby={help ? `${fid}-help` : undefined}
          onClick={() => setOpen((o) => !o)}>
          <span className="sg-select__value">{v
            ? <><span>{text(v)}</span><span className="sg-select__meta">{length(v)}</span></>
            : <span className="sg-select__placeholder">{placeholder ?? t.chooseRange}</span>}</span>
          <CalendarIcon />
        </button>
        {help && <span id={`${fid}-help`} className="sg-field__help">{help}</span>}
      </div>
      {name && <input type="hidden" name={name} value={v ? `${toISODate(v.start)}/${toISODate(v.end)}` : ''} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : t.chooseRange} tabIndex={-1} className={cx('sg-datepicker-panel', glassClass('strong'))}>
            <div data-sg-content>
              <RangeCalendar {...range} unit={unit} locale={locale} value={v}
                onChange={(r) => { setV(r); window.setTimeout(() => setOpen(false), 260); /* let the band fill before it closes */ }} />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
});
