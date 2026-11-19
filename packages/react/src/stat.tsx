/* Stat (0.3): one number that matters, how it moved, and its recent shape. The change is said in words as well
   as colour and arrow (colour alone is not enough); whether "up" is good is up to the metric (invert). */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { animate, prefersReducedMotion } from '@satin-glass/core';
import { cx, useIsoLayoutEffect } from './utils';
import { Skeleton } from './skeleton';
import { Sparkline } from './charts';

export type StatProps = {
  label: ReactNode;
  value: ReactNode;
  /** change against the comparison period, e.g. "+12.4%"; direction from the sign unless given */
  delta?: ReactNode;
  direction?: 'up' | 'down' | 'flat';
  /** a rise is bad for this metric (costs, errors, churn) */
  invert?: boolean;
  /** e.g. "vs. last week" */
  hint?: ReactNode;
  /** recent values for the sparkline */
  trend?: number[];
  icon?: ReactNode;
  loading?: boolean;
  /** spoken words for the direction (default English), as `labels` elsewhere */
  labels?: { up?: string; down?: string; flat?: string };
  className?: string; style?: CSSProperties;
};

const Arrow = ({ d }: { d: 'up' | 'down' | 'flat' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="sg-stat__arrow">{d === 'flat' ? <path d="M3 8h10" /> : d === 'up' ? <path d="M8 13V3.5M4 7.5l4-4 4 4" /> : <path d="M8 3v9.5M4 8.5l4 4 4-4" />}</svg>
);

export function Stat({ label, value, delta, direction, invert, hint, trend, icon, loading, labels = {}, className, style }: StatProps) {
  const val = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const text = typeof delta === 'string' || typeof delta === 'number' ? String(delta) : '';
  const dir = direction ?? (/^\s*[-−–]/.test(text) ? 'down' : /^\s*\+/.test(text) || (parseFloat(text) > 0) ? 'up' : 'flat');
  const good = dir === 'flat' ? 'neutral' : (dir === 'up') !== !!invert ? 'good' : 'bad';
  /* a new value settles in from below (content change: instant under reduced motion) */
  useIsoLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const v = val.current;
    if (v && !prefersReducedMotion(v)) animate(v, [{ opacity: 0.2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 'snappy');
  }, [typeof value === 'string' || typeof value === 'number' ? value : null]);
  return (
    <div className={cx('sg-stat', className)} style={style} aria-busy={loading || undefined}>
      <div className="sg-stat__head">{icon && <span className="sg-stat__icon" aria-hidden="true">{icon}</span>}<span className="sg-stat__label">{label}</span></div>
      {loading ? (
        <div aria-hidden="true"><Skeleton width="55%" height={30} style={{ margin: '6px 0' }} /><Skeleton width="40%" /></div>
      ) : (
        <>
          <div ref={val} className="sg-stat__value">{value}</div>
          {(delta !== undefined || hint) && (
            <div className="sg-stat__foot">
              {delta !== undefined && (
                <span className="sg-stat__delta" data-good={good}>
                  <Arrow d={dir} /><span className="sg-visually-hidden">{(dir === 'up' ? labels.up ?? 'Up' : dir === 'down' ? labels.down ?? 'Down' : labels.flat ?? 'No change')} </span>{delta}
                </span>
              )}
              {hint && <span className="sg-stat__hint">{hint}</span>}
            </div>
          )}
          {trend && trend.length > 1 && <Sparkline className="sg-stat__spark" values={trend} tone={good === 'bad' ? 'danger' : good === 'good' ? 'success' : 'accent'} />}
        </>
      )}
    </div>
  );
}
