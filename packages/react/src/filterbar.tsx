/* FilterBar (0.6; a docs recipe since 0.5): the row of search, filters, applied count and "clear" above a table or a
   list. The controls are the library's own and the app owns the filter state; the bar is a named group in reading
   order (each control keeps its own keys), wraps when narrow, and shows how many criteria apply with one "clear"
   that resets the same criteria the count counts. Clearing moves focus to the first control, since the clear button
   goes away under it. Nothing in the bar moves. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from './utils';
import { Button } from './controls';
import { useMessages } from './messages';

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
  const m = useMessages().filters;
  /* focus moves once the clear has rendered: before it, the first control may be a chip that is about to go. The
     first control that can take focus: not disabled, not taken out of the tab order, still in the bar */
  const [refocus, setRefocus] = useState(0);
  const pending = useRef(false);
  const clear = () => { onClear(); pending.current = true; setRefocus((n) => n + 1); };
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const all = box.current?.querySelectorAll<HTMLElement>('input:not([type="hidden"]), button, select, textarea, a[href], [tabindex]') ?? [];
    /* one hidden by the layout (display: none at a breakpoint) does not take focus: try the next until one does */
    for (const el of Array.from(all)) {
      if (el.matches(':disabled') || el.tabIndex < 0 || el.closest('[hidden], [inert]')) continue;
      el.focus();
      if (document.activeElement === el) break;
    }
  }, [refocus]);
  return (
    <div ref={box} role="group" aria-label={label} className={cx('sg-filterbar', className)} style={style}>
      {children}
      {count > 0 && (
        <span className="sg-filterbar__applied">
          <span className="sg-filterbar__count">{labels.applied?.(count) ?? m.applied(count)}</span>
          <Button size="sm" variant="plain" onClick={clear}>{labels.clear ?? m.clear}</Button>
        </span>
      )}
    </div>
  );
}
