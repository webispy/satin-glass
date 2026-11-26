/* Tabs (0.3): sections of one page. The underline is the droplet bridge of the tab bar and segmented control (core
   bridge), so selection travels the same way everywhere, and too many tabs scroll sideways like those do (core
   overflow strip: faded ends, the selected tab kept in view). WAI-ARIA tabs: arrow keys move (and select, unless
   activation="manual"), Home/End; each tab controls its panel. Panels slide in from the side you moved toward.
   A row of filter choices is not tabs: use chips (or a segmented control for two to five options).
   variant="pill" (0.6): the tabs wrap onto as many lines as they need instead of scrolling — every section stays in
   sight on a phone (benchmark families, report sections). A drop cannot travel between lines, so the chosen pill
   wears the raised face itself (the chosen value is raised, 8.1) and the change is a short paint, with the press. */
import { useDeferredValue, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { animate, fade, prefersReducedMotion, timing } from '@satin-glass/core';
import { cx, tabStop, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Badge } from './controls';
import { useBridge } from './use-bridge';

export type TabItem<T extends string = string> = { value: T; label: ReactNode; icon?: ReactNode; badge?: ReactNode; disabled?: boolean; content?: ReactNode };
export type TabsProps<T extends string = string> = {
  /** the tabs, in order; a selected item's `content` shows in the panel below (without any, render the panel
      yourself); a number or string `badge` becomes a neutral Badge */
  items: TabItem<T>[];
  value?: T; defaultValue?: T; onChange?: (value: T) => void;
  /** 'underline' (default): one line, scrolls when it overflows; 'pill': wraps onto more lines */
  variant?: 'underline' | 'pill';
  /** 'auto': arrow keys move focus and select; 'manual': arrow keys move focus, and Enter or Space selects */
  activation?: 'auto' | 'manual';
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
  /** class for the panel (when items carry content) */
  panelClassName?: string;
};

export function Tabs<T extends string = string>({ items, value, defaultValue, onChange, variant = 'underline', activation = 'auto', 'aria-label': label, className, style, panelClassName }: TabsProps<T>) {
  const [v, setV] = useControllable<T>(value, defaultValue ?? items.find((i) => !i.disabled)?.value ?? items[0]?.value, onChange);
  const index = Math.max(0, items.findIndex((i) => i.value === v));
  const stop = tabStop(index, items.length, (i) => !!items[i].disabled);
  const list = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useStableId('sg-tabs');
  /* the tab itself answers at once; the panel's content (charts, tables…) renders as a transition, in slices,
     so a heavy panel never blocks the frame the tap lands in */
  const shown = useDeferredValue(index);
  const prev = useRef(shown);
  const hasPanels = items.some((i) => i.content !== undefined);
  /* the underline travels as a droplet (not draggable: tabs are pressed, not slid); pills have no indicator, so no
     bridge or overflow strip either */
  useBridge(list, ind, index, () => {}, false);
  /* the new panel comes in from the side of travel */
  useIsoLayoutEffect(() => {
    const p = panel.current, dir = Math.sign(shown - prev.current);
    prev.current = shown;
    if (!p || !dir) return;
    if (prefersReducedMotion(p)) { fade(p, 0, 1, timing.appear); return; }
    animate(p, [{ opacity: 0, transform: `translateX(${dir * 12}px)` }, { opacity: 1, transform: 'none' }], 'snappy');
  }, [shown]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(':scope > [data-sg-item]'));
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
    <div className={cx('sg-tabs', variant === 'pill' && 'sg-tabs--pill', className)} style={style}>
      <div ref={list} role="tablist" aria-label={label} className="sg-tabs__list" onKeyDown={onKey}>
        {variant !== 'pill' && <span ref={ind} className="sg-tabs__indicator" aria-hidden="true" />}
        {items.map((it, i) => (
          <button key={it.value} type="button" role="tab" id={`${id}-t${i}`} data-sg-item aria-selected={i === index}
            aria-controls={hasPanels ? `${id}-p` : undefined} tabIndex={i === stop ? 0 : -1} disabled={it.disabled}
            className="sg-tabs__tab" onClick={() => setV(it.value)}>
            {it.icon}<span className="sg-tabs__label" data-label={typeof it.label === 'string' ? it.label : undefined}>{it.label}</span>
            {/* a count or a word becomes the library's neutral Badge (it pops in and bumps on change, as in TabBar); any other node is used as given */}
            {it.badge !== undefined && (typeof it.badge === 'number' || typeof it.badge === 'string' ? <Badge tone="neutral" className="sg-tabs__badge">{it.badge}</Badge> : it.badge)}
          </button>
        ))}
      </div>
      {hasPanels && (
        <div ref={panel} role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t${shown}`} aria-busy={shown !== index || undefined} tabIndex={0} className={cx('sg-tabs__panel', panelClassName)}>
          {cur?.content}
        </div>
      )}
    </div>
  );
}
