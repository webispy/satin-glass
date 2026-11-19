/* Breadcrumbs (0.2): where you are in a hierarchy. The current page ends the trail (aria-current, not a link);
   long trails fold their middle into a "…" button that opens a menu of the hidden levels. */
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { cx } from './utils';
import { ChevronRightIcon } from './icons';
import { Menu, MenuItem } from './overlays';

export type Crumb = { label: ReactNode; href?: string; onClick?: (e: MouseEvent) => void; icon?: ReactNode };
export type BreadcrumbsProps = {
  items: Crumb[];
  /** fold the middle when there are more levels than this (0: never) */
  maxItems?: number;
  /** levels kept before / after the fold */
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
  /** name of the landmark (default "Breadcrumb") */
  'aria-label'?: string;
  /** label of the "…" button */
  moreLabel?: string;
  className?: string;
  style?: CSSProperties;
};

export function Breadcrumbs({ items, maxItems = 5, itemsBeforeCollapse = 1, itemsAfterCollapse = 2, 'aria-label': label = 'Breadcrumb', moreLabel = 'Show hidden levels', className, style }: BreadcrumbsProps) {
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const fold = maxItems > 0 && items.length > maxItems && itemsBeforeCollapse + itemsAfterCollapse < items.length;
  const head = fold ? items.slice(0, itemsBeforeCollapse) : items;
  const hidden = fold ? items.slice(itemsBeforeCollapse, items.length - itemsAfterCollapse) : [];
  const tail = fold ? items.slice(items.length - itemsAfterCollapse) : [];
  const last = items.length - 1;
  const crumb = (c: Crumb, i: number) => {
    const current = i === last;
    const body = <>{c.icon}<span className="sg-crumb__label">{c.label}</span></>;
    return (
      <li key={i} className="sg-crumb">
        {i > 0 && <ChevronRightIcon className="sg-crumb__sep" />}
        {current ? <span className="sg-crumb__item" aria-current="page">{body}</span>
          : c.href ? <a className="sg-crumb__item" href={c.href} onClick={c.onClick}>{body}</a>
          : <button type="button" className="sg-crumb__item" onClick={c.onClick}>{body}</button>}
      </li>
    );
  };
  const go = (c: Crumb) => () => {
    if (c.onClick) c.onClick({ preventDefault() {}, currentTarget: more.current } as unknown as MouseEvent);
    else if (c.href) location.assign(c.href);
  };
  return (
    <nav aria-label={label} className={cx('sg-breadcrumbs', className)} style={style}>
      <ol>
        {head.map((c, i) => crumb(c, i))}
        {fold && (
          <li className="sg-crumb sg-crumb--more">
            <ChevronRightIcon className="sg-crumb__sep" />
            <button ref={more} type="button" className="sg-crumb__item sg-crumb__more" aria-label={moreLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></svg>
            </button>
            <Menu open={open} onClose={() => setOpen(false)} anchor={more.current} placement="bottom-start" aria-label={moreLabel}>
              {hidden.map((c, i) => <MenuItem key={i} icon={c.icon} onSelect={go(c)}>{c.label}</MenuItem>)}
            </Menu>
          </li>
        )}
        {tail.map((c, i) => crumb(c, items.length - itemsAfterCollapse + i))}
      </ol>
    </nav>
  );
}
