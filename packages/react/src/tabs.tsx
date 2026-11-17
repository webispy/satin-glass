/* Tabs (0.3): page-level tabs. The underline is the droplet bridge of the tab bar and segmented control (core
   bridge), so selection travels the same way everywhere. WAI-ARIA tabs: arrow keys move (and select, unless
   activation="manual"), Home/End; each tab controls its panel. Panels slide in from the side you moved toward. */
import { useDeferredValue, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { animate, fade, prefersReducedMotion, type MotionName } from '@glass-layer/core';
import { cx, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { useBridge } from './controls';

export type TabItem<T extends string = string> = { value: T; label: ReactNode; icon?: ReactNode; badge?: ReactNode; disabled?: boolean; content?: ReactNode };
export type TabsProps<T extends string = string> = {
  items: TabItem<T>[];
  value?: T; defaultValue?: T; onChange?: (value: T) => void;
  /** auto: arrow keys select; manual: arrow keys move focus, Enter/Space select */
  activation?: 'auto' | 'manual';
  'aria-label'?: string;
  motion?: MotionName;
  className?: string; style?: CSSProperties;
  /** class for the panel (when items carry content) */
  panelClassName?: string;
  /** underline (default: page sections) or pill (a filter-like row of choices; wraps onto more lines) */
  variant?: 'underline' | 'pill';
};

export function Tabs<T extends string = string>({ items, value, defaultValue, onChange, activation = 'auto', 'aria-label': label, motion, className, style, panelClassName, variant = 'underline' }: TabsProps<T>) {
  const [v, setV] = useControllable<T>(value, defaultValue ?? items.find((i) => !i.disabled)?.value ?? items[0]?.value, onChange);
  const index = Math.max(0, items.findIndex((i) => i.value === v));
  const list = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useStableId('gl-tabs');
  /* the tab itself answers at once; the panel's content (charts, tables…) renders as a transition, in slices,
     so a heavy panel never blocks the frame the tap lands in */
  const shown = useDeferredValue(index);
  const prev = useRef(shown);
  const hasPanels = items.some((i) => i.content !== undefined);
  /* the underline travels as a droplet; pills wrap onto several lines, where a travelling indicator would have to
     jump between rows — they simply light up (CSS transition) */
  useBridge(variant === 'underline' ? list : { current: null }, ind, index, () => {}, false);
  /* keep the selected tab in view when the list scrolls sideways (many tabs, narrow screen) */
  useIsoLayoutEffect(() => {
    const t = list.current?.querySelectorAll<HTMLElement>(':scope > [data-gl-item]')[index];
    const l = list.current;
    if (t && l && l.scrollWidth > l.clientWidth) {
      const left = t.offsetLeft - 16, right = t.offsetLeft + t.offsetWidth + 16;
      if (left < l.scrollLeft) l.scrollTo({ left, behavior: prefersReducedMotion(l) ? 'auto' : 'smooth' });
      else if (right > l.scrollLeft + l.clientWidth) l.scrollTo({ left: right - l.clientWidth, behavior: prefersReducedMotion(l) ? 'auto' : 'smooth' });
    }
  }, [index]);
  /* the new panel comes in from the side of travel */
  useIsoLayoutEffect(() => {
    const p = panel.current, dir = Math.sign(shown - prev.current);
    prev.current = shown;
    if (!p || !dir) return;
    if (prefersReducedMotion(p)) { fade(p, 0, 1, 120); return; }
    animate(p, [{ opacity: 0, transform: `translateX(${dir * 12}px)` }, { opacity: 1, transform: 'none' }], 'snappy');
  }, [shown]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(':scope > [data-gl-item]'));
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    const k = e.key;
    let next = -1;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { const pos = enabled.indexOf(at < 0 ? index : at); next = enabled[(pos + (k === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]; }
    else if (k === 'Home') next = enabled[0];
    else if (k === 'End') next = enabled[enabled.length - 1];
    else if ((k === 'Enter' || k === ' ') && at >= 0 && activation === 'manual') { e.preventDefault(); setV(items[at].value); return; }
    if (next === undefined || next < 0) return;
    e.preventDefault();
    tabs[next]?.focus();
    if (activation === 'auto') setV(items[next].value);
  };
  const cur = items[shown] ?? items[index];
  return (
    <div className={cx('gl-tabs', variant === 'pill' && 'gl-tabs--pill', className)} style={style} data-gl-motion={motion}>
      <div ref={list} role="tablist" aria-label={label} className="gl-tabs__list" onKeyDown={onKey}>
        {variant === 'underline' && <span ref={ind} className="gl-tabs__indicator" aria-hidden="true" />}
        {items.map((it, i) => (
          <button key={it.value} type="button" role="tab" id={`${id}-t${i}`} data-gl-item aria-selected={i === index}
            aria-controls={hasPanels ? `${id}-p` : undefined} tabIndex={i === index ? 0 : -1} disabled={it.disabled}
            className="gl-tabs__tab" onClick={() => setV(it.value)}>
            {it.icon}<span className="gl-tabs__label">{it.label}</span>{it.badge !== undefined && <span className="gl-tabs__badge">{it.badge}</span>}
          </button>
        ))}
      </div>
      {hasPanels && (
        <div ref={panel} role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t${shown}`} aria-busy={shown !== index || undefined} tabIndex={0} className={cx('gl-tabs__panel', panelClassName)}>
          {cur?.content}
        </div>
      )}
    </div>
  );
}
