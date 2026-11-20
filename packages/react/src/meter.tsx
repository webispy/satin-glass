/* Meter (0.5): a value within a known range — storage used, a quota, a score. Not progress (a task moving to its
   end: Progress) and not a mark beside a number in a table cell (BarMeter).
   The track is a groove (the path the value runs along); the fill is flat, from the inline start. The value comes
   from data, not from a hand, so a change is drawn at once in every motion setting.
   With low / high / optimum the tone follows the bands the way HTML's <meter> rates them: in the optimum band it is
   good (success), one band off suboptimal (warning), two bands off bad (danger). Meaning goes in words too: `status`
   is shown under the bar and read with it. */
import type { CSSProperties, ReactNode } from 'react';
import { cx, useStableId, type Tone } from './utils';

export type MeterProps = {
  value: number;
  /** the range (default 0–100) */
  min?: number; max?: number;
  /** the visible label, also the meter's name */
  label: ReactNode;
  /** the visible value, also what a screen reader says (default: the share of the range in percent) */
  format?: (value: number) => string;
  /** what a screen reader says instead of the visible value, e.g. "37 GB of 50 GB" */
  valueText?: string;
  /** bands as in <meter>: below low is low, above high is high; optimum says which band is best */
  low?: number; high?: number; optimum?: number;
  /** the fill's tone; overrides the one the bands give (default accent) */
  tone?: Tone;
  /** a line under the bar that says what the value means ("Almost full"); read with the meter */
  status?: ReactNode;
  showValue?: boolean;
  size?: 'sm' | 'md';
  labels?: { unavailable?: string };
  className?: string; style?: CSSProperties;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The tone HTML's <meter> would give: optimum band → success, the next band → warning, the far band → danger. */
export function meterTone(value: number, min: number, max: number, low?: number, high?: number, optimum?: number): Tone | null {
  if (low === undefined && high === undefined && optimum === undefined) return null;
  const lo = clamp(low ?? min, min, max), hi = clamp(high ?? max, lo, max), opt = clamp(optimum ?? (min + max) / 2, min, max);
  const band = (v: number) => (v < lo ? 0 : v > hi ? 2 : 1);
  const o = band(opt), b = band(clamp(value, min, max));
  if (b === o) return 'success';
  /* an optimum in the middle band: either side is only suboptimal */
  return o === 1 || Math.abs(b - o) === 1 ? 'warning' : 'danger';
}

export function Meter({ value, min = 0, max = 100, label, format, valueText, low, high, optimum, tone, status, showValue = true, size = 'md', labels, className, style }: MeterProps) {
  const id = useStableId('sg-meter');
  const ok = Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max > min;
  const v = ok ? clamp(value, min, max) : 0;
  const p = ok ? (v - min) / (max - min) : 0;
  const shown = ok ? (format ? format(v) : `${Math.round(p * 100)}%`) : labels?.unavailable ?? 'Unavailable';
  const t = tone ?? (ok ? meterTone(v, min, max, low, high, optimum) : null) ?? 'accent';
  return (
    <div className={cx('sg-meter', size === 'sm' && 'sg-meter--sm', className)} style={style} data-tone={t}>
      <div className="sg-meter__head">
        <span id={`${id}-label`} className="sg-meter__label">{label}</span>
        {(showValue || !ok) && <span className="sg-meter__value" aria-hidden={ok || undefined}>{shown}</span>}
      </div>
      {ok
        ? (
          <div className="sg-meter__track" role="meter" aria-labelledby={`${id}-label`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={v}
            aria-valuetext={valueText ?? shown} aria-describedby={status ? `${id}-status` : undefined}>
            <span className="sg-meter__fill" style={{ transform: `scaleX(${p.toFixed(4)})` }} />
          </div>
        )
        : <div className="sg-meter__track" aria-hidden="true" />}
      {status && <span id={`${id}-status`} className="sg-meter__status">{status}</span>}
    </div>
  );
}
