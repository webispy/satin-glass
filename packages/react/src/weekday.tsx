/* Weekdays (0.3): pick any days of the week — an alarm's repeat, opening days, a recurring booking. A row of round
   toggles in the calendar's own day shape; a chosen day fills from the middle on the pop spring. describeWeekdays
   says a set the way people do ("매일", "주중", "월, 수, 금"). Days are numbers as in Date#getDay (0 = Sunday). */
import { useMemo, type CSSProperties } from 'react';
import { cx, useControllable } from './utils';

const names = (locale: string, style: 'narrow' | 'short' | 'long') => {
  const f = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, d) => f.format(new Date(2023, 0, 1 + d)));   /* 2023-01-01 was a Sunday */
};
const order = (weekStartsOn: number) => Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);

/** "매일" / "주중" / "주말" / "월, 수, 금" (or "Every day" / "Weekdays" / "Weekends" / "Mon, Wed, Fri"); `never` for none */
export function describeWeekdays(days: number[], { locale = 'ko-KR', weekStartsOn = 0, never }: { locale?: string; weekStartsOn?: 0 | 1; never?: string } = {}): string {
  const ko = locale.toLowerCase().startsWith('ko');
  const set = new Set(days.filter((d) => d >= 0 && d <= 6));
  const is = (...ds: number[]) => set.size === ds.length && ds.every((d) => set.has(d));
  if (set.size === 0) return never ?? (ko ? '안 함' : 'Never');
  if (set.size === 7) return ko ? '매일' : 'Every day';
  if (is(1, 2, 3, 4, 5)) return ko ? '주중' : 'Weekdays';
  if (is(0, 6)) return ko ? '주말' : 'Weekends';
  const short = names(locale, 'short');
  return order(weekStartsOn).filter((d) => set.has(d)).map((d) => short[d]).join(', ');
}

export type WeekdayPickerProps = {
  value?: number[]; defaultValue?: number[]; onChange?: (days: number[]) => void;
  /** BCP 47 locale for the day names (default 'ko-KR') */
  locale?: string;
  /** 0 = Sunday (default), 1 = Monday */
  weekStartsOn?: 0 | 1;
  size?: 'sm' | 'md';
  disabled?: boolean;
  'aria-label': string;
  className?: string; style?: CSSProperties;
};

/** Toggles for the seven days; the value is the chosen days, sorted from Sunday. */
export function WeekdayPicker({ value, defaultValue = [], onChange, locale = 'ko-KR', weekStartsOn = 0, size = 'md', disabled, 'aria-label': label, className, style }: WeekdayPickerProps) {
  const [v, setV] = useControllable<number[]>(value, defaultValue, onChange);
  const narrow = useMemo(() => names(locale, 'narrow'), [locale]), long = useMemo(() => names(locale, 'long'), [locale]);
  const set = new Set(v);
  return (
    <div role="group" aria-label={label} className={cx('sg-weekdays', size === 'sm' && 'sg-weekdays--sm', className)} style={style}>
      {order(weekStartsOn).map((d) => (
        <button key={d} type="button" className="sg-weekday" aria-pressed={set.has(d)} aria-label={long[d]} disabled={disabled}
          data-weekend={d === 0 || d === 6 || undefined}
          onClick={() => { const n = new Set(set); if (n.has(d)) n.delete(d); else n.add(d); setV([...n].sort((a, b) => a - b)); }}>
          <span aria-hidden="true">{narrow[d]}</span>
        </button>
      ))}
    </div>
  );
}
