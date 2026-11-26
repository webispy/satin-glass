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
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Spring, animate, fade, loop, motionFor, prefersReducedMotion, type Placement, timing } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Portal, useGlassLight } from './foundation';
import { glassClass } from './glass-class';
import { IconButton } from './controls';
import { Wheel, WheelGroup } from './wheel';
import { messagesFor, useLocaleOf } from './messages';
import { useAnchored } from './overlay-hooks';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

/* ---------------------------------------------------------------- date helpers (local days)
   A date is a local day: the helpers build it at local noon. Given an instant instead (new Date('…T00:00:00Z')), it
   falls on different days in different time zones, so a server and the browser hydrating its HTML disagree. */
const ymd = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
/* noon: immune to DST edges. setFullYear, not the constructor, which reads years 0–99 as 1900–1999 */
const day = (y: number, m: number, d: number) => { const t = new Date(2000, 0, 1, 12); t.setFullYear(y, m, d); return t; };
const addDays = (d: Date, n: number) => day(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const t = day(d.getFullYear(), d.getMonth() + n, 1);
  const last = day(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return day(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
};
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const fromMonthKey = (k: number) => day(Math.floor(k / 12), k - Math.floor(k / 12) * 12, 1);
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
/* yyyy-mm-dd, the year in four digits (0042); outside 0–9999, a sign and six digits (-000001: 2 BC), as in ISO 8601's
   expanded years and in what Date parses */
const isoYear = (y: number) => (y >= 0 && y <= 9999 ? String(y).padStart(4, '0') : `${y < 0 ? '-' : '+'}${String(Math.abs(y)).padStart(6, '0')}`);
export const toISODate = (d: Date) => `${isoYear(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ---------------------------------------------------------------- today
   The browser's own day, in its own time zone, moving on at midnight while a calendar is shown. Unknown (null) on the
   server and while the browser hydrates what the server wrote: a server in another time zone, or one that rendered
   just before midnight, would mark another day than the reader's, so the marker (and a month taken from today) waits
   for the render right after hydration. A browser rendering on its own knows it from the first render. */
/* one watch for every calendar and picker on the page: a timer and a listener, however many subscribe */
const dayWatchers = new Set<() => void>();
let unwatchDay: (() => void) | null = null;
function watchDay(on: () => void) {
  dayWatchers.add(on);
  unwatchDay ??= startDayWatch(() => dayWatchers.forEach((f) => f()));
  return () => { dayWatchers.delete(on); if (!dayWatchers.size && unwatchDay) { unwatchDay(); unwatchDay = null; } };
}
function startDayWatch(on: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /* look at the day, and wait for the next local midnight from now: the time zone may have changed since (a laptop
     that travelled), so the wait is measured again each time, never kept from before */
  const arm = () => {
    clearTimeout(timer);
    const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    timer = setTimeout(check, next.getTime() - n.getTime() + 1000);
  };
  const check = () => { zone = readZone(); arm(); on(); };
  zone = readZone();
  arm();
  /* a sleeping computer holds its timers, and its zone may have changed: look again when the page is shown */
  document.addEventListener('visibilitychange', check);
  return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
}
/* The day is kept as its civil key (yyyymmdd), never as a Date: a Date is an instant, and noon of today in one zone
   is another day in a zone 13 hours away (from Honolulu to Auckland, noon on the 30th is the 1st). The zone is part
   of the snapshot, so a change of zone renders again and the formatters are built for the new one. It is read when
   a calendar starts watching and whenever the day is looked at again (a timer, the page shown), not in each render. */
let zone = '';
const readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? String(new Date().getTimezoneOffset());
const todayNow = () => `${ymd(new Date())} ${zone ||= readZone()}`;
type Today = { key: number; zone: string };
function useToday(): Today | null {
  const s = useSyncExternalStore(watchDay, todayNow, () => null);
  return useMemo(() => (s === null ? null : { key: +s.slice(0, 8), zone: s.slice(9) }), [s]);
}
/* the year is floored and the rest taken from it, so a year before 1 (ymd -8885 is 15 November, year -1) decodes too */
const fromKey = (k: number) => { const y = Math.floor(k / 10000), r = k - y * 10000; return day(y, Math.floor(r / 100) - 1, r % 100); };
const keyOf = (d: Date | null) => (d ? ymd(d) : null);
const dayOf = (k: number | null) => (k === null ? null : fromKey(k));
/* A day a component keeps itself (a value it was not given, a range's first day, the day under the pointer) is held
   as its civil key, like the month on show: kept as a Date, it would read as another day after a change of time
   zone. A value the app passes is the app's: it is read in the zone in force (pass local dates, see the README). */
function useDayValue(value: Date | null | undefined, defaultValue: Date | null, onChange?: (d: Date | null) => void): [Date | null, (d: Date | null) => void] {
  const [k, setK] = useControllable<number | null>(value === undefined ? undefined : keyOf(value), keyOf(defaultValue));
  const cb = useRef(onChange);
  cb.current = onChange;
  return [value === undefined ? dayOf(k) : value, useCallback((d: Date | null) => { setK(keyOf(d)); cb.current?.(d); }, [setK])];
}
/* stands in for the month while it is not known yet; never shown (the grid is drawn empty) */
const NO_MONTH = day(2000, 0, 1);

/* ================================================================================================ Calendar */
/* a RangeCalendar around a Calendar: the days show the range and a pick goes to it */
type RangeCtx = { start: Date | null; end: Date | null; pick: (d: Date) => void; reach: (d: Date) => boolean; starts: string; ends: string };
const RangeContext = createContext<RangeCtx | null>(null);

export type CalendarProps = {
  value?: Date | null; defaultValue?: Date | null; onChange?: (date: Date) => void;
  /** the earliest day that can be chosen; earlier days are disabled, and the keyboard, the month buttons and the year
      grid stop there */
  min?: Date;
  /** the latest day that can be chosen; later days are disabled, and the keyboard, the month buttons and the year
      grid stop there */
  max?: Date;
  /** return true for days that cannot be chosen (weekends, holidays…) */
  isDateDisabled?: (date: Date) => boolean;
  /** BCP 47 locale for month and weekday names and the words it writes (default: the ThemeProvider's `locale`, else
      'en-US') */
  locale?: string;
  /** 0 = Sunday (default), 1 = Monday */
  weekStartsOn?: 0 | 1;
  /** move focus to the selected (or today's) day when shown */
  autoFocus?: boolean;
  /** the month shown while there is no value (default: this month), e.g. when the likely dates are far from today */
  defaultMonth?: Date;
  /** open on the days (default), the months or the years — a birth date is quicker to reach by its year */
  openTo?: 'day' | 'month' | 'year';
  /** how the month and year are picked: grids (default) or wheels */
  monthPicker?: 'grid' | 'wheel';
  className?: string; style?: CSSProperties; 'aria-label'?: string;
};

export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  { value, defaultValue = null, onChange, min, max, isDateDisabled, locale: localeProp, weekStartsOn = 0, autoFocus, defaultMonth, openTo = 'day', monthPicker = 'grid', className, style, 'aria-label': ariaLabel }, ref,
) {
  const [v, setV] = useDayValue(value, defaultValue, onChange as (d: Date | null) => void);
  const range = useContext(RangeContext);
  /* while the end is being chosen, the day under the pointer (or keyboard focus) previews it */
  const [hoverK, setHoverK] = useState<number | null>(null);
  const hover = dayOf(hoverK), setHover = (d: Date | null) => setHoverK(keyOf(d));
  /* today's civil day (yyyymmdd) and its year and month: compared as numbers, never through a Date kept from an
     earlier render (see useToday) */
  const now = useToday(), todayK = now ? now.key : null;
  const todayY = todayK === null ? null : Math.floor(todayK / 10000), todayM = todayK === null ? -1 : Math.floor(todayK / 100) % 100 - 1;
  const initial = v ?? (defaultMonth ? day(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1) : todayK === null ? null : fromKey(todayK));
  /* The focused day and the month on show are kept as civil numbers (yyyymmdd; year × 12 + month), like today, and
     made into Dates (local noon) in each render: a Date kept from before is an instant, and after a change of time
     zone it can read as the day before (the 1st, local noon in Auckland, is the 31st in Honolulu). */
  const [focusedK, setFocusedK] = useState<number>(() => ymd(initial ?? NO_MONTH));
  const focused = fromKey(focusedK);
  const setFocused = (u: Date | ((f: Date) => Date)) => setFocusedK((k) => ymd(typeof u === 'function' ? u(fromKey(k)) : u));
  /* null: no value, no defaultMonth and today not known yet (hydrating); the month comes with today, below */
  const [shownM, setShownM] = useState<number | null>(() => initial && monthKey(initial));
  const setMonth = (d: Date) => setShownM(monthKey(d));
  const pending = shownM === null, month = shownM === null ? NO_MONTH : fromMonthKey(shownM);
  useIsoLayoutEffect(() => { if (pending && todayK !== null) { const d = fromKey(todayK); setMonth(d); setFocused(d); } }, [todayK]);
  const wheels = monthPicker === 'wheel';
  const [view, setView] = useState<'day' | 'month' | 'year'>(wheels && openTo === 'year' ? 'month' : openTo);
  const root = useRef<HTMLDivElement>(null), body = useRef<HTMLTableSectionElement>(null);
  const locale = useLocaleOf(localeProp), t = messagesFor(locale).date;
  const id = useStableId('sg-cal');
  const fmt = useMemo(() => ({
    title: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }),
    full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    wdShort: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    wdLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long' }),
    year: new Intl.DateTimeFormat(locale, { year: 'numeric' }),
    /* a formatter keeps the time zone it was built in: built again when the zone changes */
  }), [locale, now?.zone]);
  /* the years min..max (or a century back and twenty years on from today); months outside min / max are passed over */
  const thisYear = todayY ?? month.getFullYear();
  const y0 = min ? min.getFullYear() : thisYear - 100, y1 = max ? max.getFullYear() : thisYear + 20;
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
    if (prefersReducedMotion(b)) { fade(b, 0, 1, timing.appear); return; }
    const o = opener.current;
    if (view !== 'day' && o) {
      const r = b.getBoundingClientRect(), c = o.getBoundingClientRect();
      b.style.transformOrigin = `${(c.left + c.width / 2 - r.left).toFixed(1)}px 0px`;
      animate(b, [{ transform: 'scale(0.6, 0.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'pop');
    } else animate(b, [{ transform: 'translateY(6px) scale(0.98)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth');
  }, [view]);
  /* back to the days, focus on the day grid's tab stop as committed when the frame runs: a closure's own `focused` is
     the render it was made in, before a month picked with it has clamped the day (#89) */
  const backToDays = () => { opener.current = null; setView('day'); keyboard.current = true; requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('.sg-day[tabindex="0"]')?.focus({ preventScroll: true })); };
  const focusSoon = (sel: string) => requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true }));
  const yearPage = useRef<(dir: number) => void>(() => {});
  const [yearEdge, setYearEdge] = useState({ top: false, bottom: false });

  const disabled = (d: Date) => (min && ymd(d) < ymd(min)) || (max && ymd(d) > ymd(max)) || Boolean(isDateDisabled?.(d));
  /* follow an outside change of value to its month */
  useEffect(() => { if (v && (pending || !sameMonth(v, month))) { setMonth(v); setFocused(v); } }, [v ? ymd(v) : 0]);

  /* the month changed: slide the grid in from the side it came from */
  const last = useRef(shownM);
  useIsoLayoutEffect(() => {
    const prev = last.current; last.current = shownM;
    const b = body.current;
    if (!b || prev === null || shownM === null || prev === shownM) return;   /* the first month known does not slide in */
    const dir = shownM > prev ? 1 : -1;
    if (prefersReducedMotion(b)) { fade(b, 0, 1, timing.appear); return; }
    animate(b, [{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth');
  }, [shownM]);

  /* keep keyboard focus on the focused day after it moves (only when focus is already in the grid) */
  const keyboard = useRef(false);
  useEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus();
  }, [focusedK]);
  /* a flag no move took (going back to the same month's days) is dropped once the render is in, so a later move made
     elsewhere (the next month's button) does not pull focus into the grid */
  useEffect(() => { keyboard.current = false; });
  useEffect(() => {
    if (autoFocus && !pending) root.current?.querySelector<HTMLButtonElement>(`[data-date="${toISODate(focused)}"]`)?.focus({ preventScroll: true });
  }, [pending]);

  const goMonth = (n: number) => {
    const m = addMonths(month, n);
    setMonth(m);
    setFocused((f) => (sameMonth(f, m) ? f : addMonths(f, n)));
  };
  const focusDay = (d0: Date) => {
    /* keyboard movement stays inside min / max; days disabled by isDateDisabled stay focusable (aria-disabled) */
    let d = d0;
    if (min && ymd(d) < ymd(min)) d = day(min.getFullYear(), min.getMonth(), min.getDate());
    if (max && ymd(d) > ymd(max)) d = day(max.getFullYear(), max.getMonth(), max.getDate());
    /* a press that stays put (at min or max) changes no state, so nothing would take the flag: leave it down */
    if (ymd(d) === focusedK) return;
    keyboard.current = true;
    setFocused(d);
    if (!sameMonth(d, month)) setMonth(d);
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
  /* draw: this render's painting (its runs, kind and geometry), set again by every render, so a loop started by an
     earlier one paints what is shown now: an end picked mid-spring is a committed range, not the preview (#94) */
  type BandEng = { H: Spring; stop: (() => void) | null; month: number; key: string; draw: (head: number) => void };
  const bandEng = useRef<BandEng | null>(null);
  const candidate = range && range.start && !range.end && hover && range.reach(hover) && ymd(hover) !== ymd(range.start) ? hover : null;
  const hoverKey = candidate ? ymd(candidate) : 0;
  useIsoLayoutEffect(() => {
    const layer = bands.current, tb = body.current, table = tb?.parentElement as HTMLElement | undefined;
    /* no day grid (the months or years shown, or not known yet): a loop still running would paint segments no longer
       in the page, and draw would hold them; both stop, and the head moves on from where it was when days come back */
    if (!range || !layer || !tb || !table || view !== 'day' || pending) { const g = bandEng.current; if (g) { g.stop?.(); g.stop = null; g.draw = () => {}; } return; }
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
    if (!st) st = bandEng.current = { H: new Spring(tintTo, 'snappy', layer), stop: null, month: 0, key: '', draw: () => {} };
    st.draw = (head) => paint(runsAt(head));
    const was = st.key, newStart = !was || was.split('-')[0] !== String(ymd(startD)), committed = eI !== null && was !== key && !newStart;
    const fresh = st.month !== ymd(month) || !was || reduced;
    const monthMoved = Boolean(st.month) && st.month !== ymd(month);
    st.key = key; st.month = ymd(month);
    const e = st;
    const animateHead = (onTick?: () => void) => {
      if (e.stop) return;
      e.stop = loop((dt) => {
        e.H.step(dt); e.draw(e.H.value); onTick?.();
        if (!e.H.settled) return;
        e.H.jump(e.H.target); e.draw(e.H.value); e.stop = null;
        return false;
      });
    };
    if (fresh || newStart) {
      e.stop?.(); e.stop = null; e.H.jump(tintTo); paint(runsAt(tintTo));
      if (monthMoved) layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: timing.bandIn, delay: timing.bandInDelay, fill: 'backwards' });   /* after the month's slide */
      if (newStart && was && !reduced) seat(startD);
      return;
    }
    e.H.target = tintTo; animateHead();
    if (committed) seat(range.end!);
  }, [range?.start ? ymd(range.start) : 0, range?.end ? ymd(range.end) : 0, hoverKey, ymd(month), view, pending]);
  /* unmounted, or hidden by Activity: the loop stops and says so, so shown again a new spring can start */
  useEffect(() => () => { const e = bandEng.current; if (e) { e.stop?.(); e.stop = null; } }, []);

  return (
    <div ref={mergeRefs(ref, root)} className={cx('sg-calendar', className)} style={style} lang={localeProp}>
      <div className="sg-calendar__head">
        {/* the title for assistive technology (and the grid's label); the chips are what you see */}
        <h2 id={titleId} className="sg-visually-hidden" aria-live="polite">{pending ? '' : fmt.title.format(month)}</h2>
        <div className="sg-calendar__chips">
          {(() => {
            const chip = (which: 'year' | 'month') => {
              const open = !pending && (wheels ? view === 'month' : view === which);
              const shown = pending ? '' : which === 'year' ? fmt.year.format(month) : fmt.month.format(month);
              return (
                <button key={which} type="button" className="sg-calendar__chip" aria-expanded={open} disabled={pending || undefined}
                  aria-label={`${shown ? `${shown}, ` : ''}${which === 'year' ? t.pickYear : t.pickMonth}`}
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    if (open) { backToDays(); return; }
                    setView(wheels ? 'month' : which);
                    /* into the grid (or the wheels), so arrows and typing work at once */
                    focusSoon(wheels ? '.sg-calendar__wheels [role="spinbutton"]' : '.sg-calendar__cell[aria-selected="true"], .sg-calendar__cell[tabindex="0"]');
                  }}>
                  <span>{shown}</span><ChevronDownIcon className="sg-calendar__chip-chevron" />
                </button>
              );
            };
            return yearFirst ? [chip('year'), chip('month')] : [chip('month'), chip('year')];
          })()}
        </div>
        <div className="sg-calendar__nav" hidden={wheels && view === 'month' && !pending}>
          {pending ? (<>
            <IconButton size="sm" icon={<ChevronLeftIcon />} label={t.prev} disabled />
            <IconButton size="sm" icon={<ChevronRightIcon />} label={t.next} disabled />
          </>) : view === 'year' ? (<>
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
      {range && (view === 'day' || pending) && <div ref={bands} className="sg-calendar__bands" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <span key={i} className="sg-calendar__seg" />)}</div>}
      {/* while the month is not known yet, the days' grid is drawn empty (it keeps its size) */}
      {!pending && view === 'year' && !wheels ? (
        <YearGrid key={todayK === null ? 'guess' : 'today'} years={years} value={month.getFullYear()} current={todayY ?? -1} label={t.pickYear} pageRef={yearPage} onEdge={setYearEdge}
          onPick={(y) => { toMonth(y, month.getMonth()); opener.current = null; setView('month'); focusSoon('.sg-calendar__cell[aria-selected="true"]'); }} onCancel={backToDays} />
      ) : !pending && view === 'month' && !wheels ? (
        <MonthGrid months={months} value={month.getMonth()} current={month.getFullYear() === todayY ? todayM : -1} label={t.pickMonth} caption={fmt.year.format(month)}
          onPick={(m) => { toMonth(month.getFullYear(), m); backToDays(); }} onCancel={backToDays} />
      ) : !pending && view === 'month' ? (
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
          {pending ? weeks.map((wk, wi) => <tr key={wi}>{wk.map((_, col) => <td key={col} role="gridcell" />)}</tr>) : (() => {
            /* the range drawn: chosen, or from the start to the day under the pointer while the end is chosen */
            const lo = range?.start ?? null;
            const hi = range ? (range.end ?? (lo && hover && range.reach(hover) ? hover : null)) : null;
            const preview = Boolean(range && !range.end && hi);
            const a = lo && hi ? ymd(lo) : 0, z = lo && hi ? ymd(hi) : 0;
            return weeks.map((wk, wi) => (
              <tr key={wi}>
                {wk.map((d, col) => {
                  const k = ymd(d), isToday = k === todayK, off = disabled(d), out = !sameMonth(d, month);
                  const sel = range ? Boolean((range.start && k === ymd(range.start)) || (range.end && k === ymd(range.end))) : v ? k === ymd(v) : false;
                  const band = a && z && a !== z && k >= a && k <= z ? (k === a ? 'start' : k === z ? 'end' : 'mid') : undefined;
                  const role = range && sel ? (range.start && k === ymd(range.start) ? range.starts : range.ends) : '';
                  return (
                    <td key={k} role="gridcell" aria-selected={sel || (band === 'mid' && !preview)} data-band={band} data-col={band ? col : undefined} data-preview={band && preview ? '' : undefined}>
                      <button type="button" className="sg-day" data-date={toISODate(d)} tabIndex={k === ymd(focused) ? 0 : -1}
                        aria-pressed={sel} aria-current={isToday ? 'date' : undefined} aria-disabled={off || undefined}
                        data-today={isToday ? '' : undefined} data-outside={out ? '' : undefined}
                        onMouseEnter={range ? () => setHover(d) : undefined} onFocus={range ? () => setHover(d) : undefined}
                        onClick={() => { if (off) return; setFocused(d); if (out) setMonth(d); if (range) range.pick(d); else setV(d); }}>
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
/* whether focus is inside `el`, asked of its own root: inside a shadow root, document.activeElement is the host */
const holdsFocus = (el: HTMLElement | null) => !!el && el.contains((el.getRootNode() as Document | ShadowRoot).activeElement);
function useGridKeys(cells: Cell[], at: number, onPick: (v: number) => void, onCancel: () => void, extra?: (e: KeyboardEvent<HTMLDivElement>, i: number) => number | null) {
  /* the focused cell is kept by its value, not its place: the year list moves by one when today passes New Year,
     and the keyboard must stay on the year that has focus, or on the nearest one still shown when that year has
     left the list (the oldest one) */
  const chosen = cells[at]?.value;
  const [focusValue, setFocusValue] = useState(chosen);
  /* the chosen cell moves the keyboard to it, unless the list holds focus: a chosen year that left the list (New Year)
     falls back to the nearest one, and the focus must not follow that fallback away from the year it is on */
  useEffect(() => { if (!holdsFocus(box.current)) setFocusValue(chosen); }, [chosen]);
  let focus = focusValue === undefined ? -1 : cells.findIndex((c) => c.value === focusValue);
  if (focus < 0 && focusValue !== undefined && cells.length) {
    focus = 0;
    cells.forEach((c, i) => { if (Math.abs(c.value - focusValue) < Math.abs(cells[focus].value - focusValue)) focus = i; });
  }
  if (focus < 0) focus = at;
  const box = useRef<HTMLDivElement>(null);
  /* the cells changed under the keyboard: whether the list held focus is read before React removes a cell (a removed
     cell takes focus with it, to the page), and afterwards focus is put on the focused cell and kept in sight */
  const shown = useRef(cells), held = useRef(false);
  if (shown.current !== cells) {
    held.current = typeof document !== 'undefined' && holdsFocus(box.current);
    shown.current = cells;
  }
  useIsoLayoutEffect(() => {
    if (!held.current) return;
    held.current = false;
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${focus}"]`);
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [cells]);
  const move = (i: number) => {
    const n = Math.max(0, Math.min(cells.length - 1, i));
    setFocusValue(cells[n]?.value);
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${n}"]`);
    el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion(el) ? 'instant' : 'smooth' });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key, i = focus;
    let t: number | null = null;
    if (k === 'ArrowLeft') t = i - 1; else if (k === 'ArrowRight') t = i + 1;
    else if (k === 'ArrowUp') t = i - 3; else if (k === 'ArrowDown') t = i + 3;
    else if (k === 'Home') t = i - (i % 3); else if (k === 'End') t = i - (i % 3) + 2;
    /* no cell to pick when the list is empty (a `min` later than `max` leaves no years) */
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); const c = cells[i]; if (c && !c.disabled) onPick(c.value); return; }
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
  /* open with the chosen year in the middle; only on opening: when New Year moves the list, the scroll stays where
     the reader left it (and the focused year in sight, above). While hydrating, the list waits for today: the
     Calendar shows it anew once today is known (a key), which is its opening */
  useIsoLayoutEffect(() => {
    const g = k.box.current, sel = g?.querySelector<HTMLElement>(`[data-i="${at}"]`);
    if (g && sel) g.scrollTop = sel.offsetTop - (g.clientHeight - sel.offsetHeight) / 2;
  }, []);
  /* the caption names the years in sight, again when the list changes */
  useIsoLayoutEffect(() => {
    const g = k.box.current; if (!g) return;
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
  }, [years]);
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
  /** the visible label above the field; it names the field's button, with the value */
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
  { value, defaultValue = null, onChange, placeholder, label, helperText, error, disabled, name, format, placement = 'bottom-start', locale: localeProp, id, className, style, 'aria-label': ariaLabel, ...calendar }, ref,
) {
  const [v, setV] = useDayValue(value, defaultValue, onChange as (d: Date | null) => void);
  const [open, setOpen] = useState(false);
  useToday();   /* written again when the time zone changes, so the field shows the day the form submits */
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-date');
  const fid = id ?? auto;
  const locale = useLocaleOf(localeProp), t = messagesFor(locale).date;
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
      <div className={cx('sg-field', className)} style={style} lang={localeProp} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
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
      {/* a disabled field submits nothing, as a disabled native control */}
      {name && <input type="hidden" name={name} value={v ? toISODate(v) : ''} disabled={disabled} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : t.choose} lang={localeProp} tabIndex={-1} className={cx('sg-datepicker-panel', glassClass('strong'))}>
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
/* days between two dates as days on the calendar, whatever their time of day */
const utcDay = (d: Date) => { const t = new Date(0); t.setUTCFullYear(d.getFullYear(), d.getMonth(), d.getDate()); return t.getTime(); };
const spanDays = (a: Date, b: Date) => Math.round((utcDay(b) - utcDay(a)) / 864e5);
/* a range the picker keeps itself is held as two civil keys, as a day is (useDayValue) */
type RangeKeys = { s: number; e: number } | null;
function useRangeValue(value: DateRange | null | undefined, defaultValue: DateRange | null, onChange?: (r: DateRange | null) => void): [DateRange | null, (r: DateRange | null) => void] {
  const keys = (r: DateRange | null | undefined): RangeKeys | undefined => (r === undefined ? undefined : r && { s: ymd(r.start), e: ymd(r.end) });
  const [k, setK] = useControllable<RangeKeys>(keys(value), keys(defaultValue) ?? null);
  const cb = useRef(onChange);
  cb.current = onChange;
  return [value === undefined ? k && { start: fromKey(k.s), end: fromKey(k.e) } : value,
    useCallback((r: DateRange | null) => { setK(keys(r) ?? null); cb.current?.(r); }, [setK])];
}

export type RangeCalendarProps = Omit<CalendarProps, 'value' | 'defaultValue' | 'onChange' | 'openTo'> & {
  value?: DateRange | null; defaultValue?: DateRange | null;
  /** called when both days are chosen */
  onChange?: (range: DateRange) => void;
  /** the first day was chosen (a date) or cleared (null), the second is awaited */
  onPartial?: (start: Date | null) => void;
  /** fewest days from the start to the end (default 0: the end may be the start day; 1 asks for at least one night) */
  minLength?: number;
  /** most days from the start to the end (default: no limit); a day beyond it starts a new range instead */
  maxLength?: number;
  /** how the length is written: 'days' ("3 days", default) or 'nights' ("2 nights"; "2박 3일" in Korean) */
  unit?: 'days' | 'nights';
  /** what the two days are called (check-in / check-out); default "start date" / "end date" (시작일 / 종료일 in Korean) */
  labels?: { start?: string; end?: string };
  /** the line under the days that says what to choose next and how long the range is (default true) */
  status?: boolean;
};

/** A calendar that chooses a start and an end. The first pick is the start; the second, the end (an earlier day, or
    one the range cannot reach — past maxLength or past a disabled day — starts over; the start again clears it).
    Days between start and end are joined by a band. */
export const RangeCalendar = forwardRef<HTMLDivElement, RangeCalendarProps>(function RangeCalendar(
  { value, defaultValue = null, onChange, onPartial, minLength = 0, maxLength = Infinity, unit = 'days', labels, status = true, locale: localeProp, min, max, isDateDisabled, className, style, ...cal }, ref,
) {
  const [v, setV] = useRangeValue(value, defaultValue, onChange as (r: DateRange | null) => void);
  /* the days being chosen, as civil keys (see useDayValue) */
  const [draftK, setDraftK] = useState<{ s: number | null; e: number | null }>(() => ({ s: v ? ymd(v.start) : null, e: v ? ymd(v.end) : null }));
  const draft = { start: dayOf(draftK.s), end: dayOf(draftK.e) };
  const setDraft = (r: { start: Date | null; end: Date | null }) => setDraftK({ s: keyOf(r.start), e: keyOf(r.end) });
  /* the draft follows the value when its days change; the same instants read in a new time zone leave a range
     being chosen (a first day without its end) as it is */
  const seen = useRef<string>('');
  useEffect(() => {
    const now = v ? `${v.start.getTime()}/${v.end.getTime()}` : '';
    const same = now === seen.current; seen.current = now;
    if (same && draftK.s !== null && draftK.e === null) return;
    setDraft({ start: v?.start ?? null, end: v?.end ?? null });
  }, [v ? ymd(v.start) : 0, v ? ymd(v.end) : 0]);   // eslint-disable-line react-hooks/exhaustive-deps
  const locale = useLocaleOf(localeProp), t = messagesFor(locale).date;
  const zone = useToday()?.zone;   /* the status is written again in a new time zone, by a formatter built in it */
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
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }), [locale, zone]);
  const length = (a: Date, b: Date) => (unit === 'nights' ? t.nights(spanDays(a, b)) : t.days(spanDays(a, b) + 1));
  const line = !draft.start ? t.pickNext(S)
    : !draft.end ? `${t.partial(S, fmtDay.format(draft.start))} · ${t.pickNext(E)}`
    : `${formatRange(fmtDay, draft.start, draft.end)} · ${length(draft.start, draft.end)}`;
  /* the context's pick calls the latest one, with this render's setter and onPartial */
  const latestPick = useRef(pick);
  latestPick.current = pick;
  const ctx = useMemo<RangeCtx>(() => ({ start: draft.start, end: draft.end, pick: (d: Date) => latestPick.current(d), reach, starts: S, ends: E }),
    [draft.start ? ymd(draft.start) : 0, draft.end ? ymd(draft.end) : 0, minLength, maxLength, S, E, min ? ymd(min) : 0, max ? ymd(max) : 0, isDateDisabled, zone]);   /* its days are Dates of this zone */
  return (
    <div ref={ref} className={cx('sg-rangecalendar', className)} style={style} lang={localeProp}>
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
  /** the visible label above the field; it names the field's button, with the value */
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits the range with forms as an ISO 8601 interval, yyyy-mm-dd/yyyy-mm-dd */
  name?: string;
  /** how the range is written in the field (default: the locale's short span); its length always follows */
  format?: (range: DateRange) => string;
  placement?: Placement;
  id?: string; className?: string; style?: CSSProperties;
};

/** A field that opens a RangeCalendar. Choosing the end closes it with the new range; Escape or a click outside
    before then leaves the range as it was. */
export const DateRangePicker = forwardRef<HTMLButtonElement, DateRangePickerProps>(function DateRangePicker(
  { value, defaultValue = null, onChange, placeholder, label, helperText, error, disabled, name, format, placement = 'bottom-start', locale: localeProp, unit = 'days', id, className, style, 'aria-label': ariaLabel, ...range }, ref,
) {
  const [v, setV] = useRangeValue(value, defaultValue, onChange as (r: DateRange | null) => void);
  const [open, setOpenNow] = useState(false);
  /* the close that follows a finished range: cancelled by any other open or close (and on unmount), so a quick
     reopen is not shut by the earlier choice's timer */
  const closing = useRef(0);
  const setOpen = (o: boolean | ((was: boolean) => boolean)) => { clearTimeout(closing.current); setOpenNow(o); };
  useEffect(() => () => clearTimeout(closing.current), []);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-range');
  const fid = id ?? auto;
  const locale = useLocaleOf(localeProp), t = messagesFor(locale).date;
  const lightRef = useGlassLight();
  /* written again in a new time zone, by a formatter built in it, so the field shows the days the form submits */
  const zone = useToday()?.zone;
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short' }), [locale, zone]);
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
      <div className={cx('sg-field', className)} style={style} lang={localeProp} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
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
      {name && <input type="hidden" name={name} value={v ? `${toISODate(v.start)}/${toISODate(v.end)}` : ''} disabled={disabled} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} role="dialog" aria-modal="false" aria-label={typeof label === 'string' ? label : t.chooseRange} lang={localeProp} tabIndex={-1} className={cx('sg-datepicker-panel', glassClass('strong'))}>
            <div data-sg-content>
              <RangeCalendar {...range} unit={unit} locale={locale} value={v}
                onChange={(r) => { setV(r); clearTimeout(closing.current); closing.current = window.setTimeout(() => setOpenNow(false), timing.closeAfterChoice); /* let the band fill before it closes */ }} />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
});
