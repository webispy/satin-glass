/* FilterBar (0.6; a docs recipe since 0.5): the row of search, filters, applied count and "clear" above a table or a
   list. The controls are the library's own and the app owns the filter state; the bar is a named group in reading
   order (each control keeps its own keys), wraps when narrow, and shows how many criteria apply with one "clear"
   that resets the same criteria the count counts. Clearing moves focus to the first control, since the clear button
   goes away under it. Nothing in the bar moves. */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cx } from './utils';
import { Button } from './controls';

export type FilterBarProps = {
  children: ReactNode;
  /** how many criteria apply (the app counts; 0 hides the count and the clear button) */
  count: number;
  /** reset every criterion the count counts */
  onClear: () => void;
  'aria-label': string;
  labels?: { clear?: string; applied?: (n: number) => string };
  className?: string; style?: CSSProperties;
};

export function FilterBar({ children, count, onClear, 'aria-label': label, labels = {}, className, style }: FilterBarProps) {
  const box = useRef<HTMLDivElement>(null);
  const clear = () => { onClear(); box.current?.querySelector<HTMLElement>('input, button, [tabindex="0"]')?.focus(); };
  return (
    <div ref={box} role="group" aria-label={label} className={cx('sg-filterbar', className)} style={style}>
      {children}
      {count > 0 && (
        <span className="sg-filterbar__applied">
          <span className="sg-filterbar__count">{labels.applied?.(count) ?? `${count} applied`}</span>
          <Button size="sm" variant="plain" onClick={clear}>{labels.clear ?? 'Clear'}</Button>
        </span>
      )}
    </div>
  );
}
