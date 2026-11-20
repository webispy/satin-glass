/* Skeleton (0.2): the shape of content that is on its way. A soft band of light passes over every placeholder
   at once (one sweep, in step across the screen); with reduced motion they breathe slowly instead.
   Placeholders are hidden from assistive technology: mark the loading region aria-busy. */
import { useRef, type CSSProperties } from 'react';
import { cx, useIsoLayoutEffect } from './utils';

const SWEEP_MS = 1600;

type Box = { width?: number | string; height?: number | string; radius?: number | string };
export type SkeletonProps = { className?: string; style?: CSSProperties } & (
  /** text: number of lines (the last one is shorter) */
  | ({ variant?: 'text'; lines?: number } & Box)
  | ({ variant: 'rect' } & Box)
  /** circle: diameter in px */
  | { variant: 'circle'; size?: number }
);

const len = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

export function Skeleton(props: SkeletonProps) {
  const { variant = 'text', className, style } = props;
  const lines = props.variant === 'circle' || props.variant === 'rect' ? 1 : props.lines ?? 1;
  const { width, height, radius } = props.variant === 'circle' ? ({} as Box) : props;
  const size = props.variant === 'circle' ? props.size ?? 40 : 40;
  const ref = useRef<HTMLSpanElement>(null);
  /* every skeleton on the page shares one clock, so the light sweeps them together */
  useIsoLayoutEffect(() => { ref.current?.style.setProperty('--_sync', `${-(performance.now() % SWEEP_MS)}ms`); }, []);
  if (variant === 'text' && lines > 1) {
    return (
      <span ref={ref} className={cx('sg-skeleton-lines', className)} style={{ width: len(width), ...style }} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => <span key={i} className="sg-skeleton sg-skeleton--text" style={i === lines - 1 ? { width: '62%' } : undefined} />)}
      </span>
    );
  }
  const dims: CSSProperties = variant === 'circle'
    ? { width: size, height: size }
    : { width: len(width), height: len(height), borderRadius: len(radius) };
  return <span ref={ref} className={cx('sg-skeleton', `sg-skeleton--${variant}`, className)} style={{ ...dims, ...style }} aria-hidden="true" />;
}
