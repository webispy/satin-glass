/* Tag (0.3): a short, non-interactive status for table cells and cards ("배송 중", "재고 부족").
   Chips are what you press; a tag only says something. Colour backs up the words, never replaces them. */
import type { HTMLAttributes, ReactNode } from 'react';
import { cx, type Tone } from './utils';

export type TagProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  children: ReactNode;
  tone?: Tone;
  /** soft fill (default) or a hairline outline (quieter, for many tags side by side) */
  variant?: 'soft' | 'outline';
  icon?: ReactNode;
};
export function Tag({ children, tone = 'neutral', variant = 'soft', icon, className, ...rest }: TagProps) {
  return <span className={cx('gl-tag', variant === 'outline' && 'gl-tag--outline', className)} data-tone={tone} {...rest}>{icon}{children}</span>;
}
