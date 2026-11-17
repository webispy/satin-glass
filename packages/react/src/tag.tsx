/* Tag and Level (0.3): small labels for table cells and cards ("1 run", "local", "boost: high"). */
import type { CSSProperties, ReactNode } from 'react';
import { cx } from './utils';

export type TagProps = {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  /** soft fill (default) or text only with a dotted underline (a term that has an explanation: pair with Tooltip) */
  variant?: 'soft' | 'outline' | 'text';
  icon?: ReactNode;
  className?: string; style?: CSSProperties;
  title?: string;
  tabIndex?: number;
};
export function Tag({ children, tone = 'neutral', variant = 'soft', icon, className, style, ...rest }: TagProps) {
  return <span className={cx('gl-tag', `gl-tag--${variant}`, className)} data-tone={tone} style={style} {...rest}>{icon}{children}</span>;
}

/** Signal-style bars for an intensity (off / low / medium / high). Decorative: say the level in words next to it. */
export function Level({ value, max = 3, className }: { value: number; max?: number; className?: string }) {
  return (
    <svg className={cx('gl-level', className)} viewBox={`0 0 ${max * 4} 12`} aria-hidden="true" focusable="false">
      {Array.from({ length: max }, (_, i) => <rect key={i} x={i * 4 + 0.5} y={12 - (i + 1) * (12 / max)} width={2.6} height={(i + 1) * (12 / max)} rx={0.8} data-on={i < value || undefined} />)}
    </svg>
  );
}
