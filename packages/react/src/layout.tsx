import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx, mergeRefs, useIsoLayoutEffect, useStableId } from './utils';
import { glassClass, useGlassLight } from './foundation';
import { ChevronRightIcon } from './icons';

/* ================================================================================================ List */
export function ListSection({ header, footer, children, className, ...rest }: HTMLAttributes<HTMLElement> & {
  /** a heading above the list (an h3) */
  header?: ReactNode;
  /** a note under the list: what the settings above do */
  footer?: ReactNode;
}) {
  return (
    <section className={cx('sg-list-section', className)} {...rest}>
      {header && <h3 className="sg-list-section__header">{header}</h3>}
      {children}
      {footer && <p className="sg-list-section__footer">{footer}</p>}
    </section>
  );
}

export const List = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement> & {
  /** rows without the grouped background, corners and shadow, for a list inside a card or a panel */
  plain?: boolean;
}>(function List({ plain, className, ...rest }, ref) {
  return <ul ref={ref} role="list" className={cx('sg-list', plain && 'sg-list--plain', className)} {...rest} />;
});

export type ListItemProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** the row's main text */
  title: ReactNode;
  /** a second, smaller line under the title */
  subtitle?: ReactNode;
  /** an icon in a coloured tile (tileColor) or plain */
  leading?: ReactNode;
  /** the tile's colour, any CSS colour (default: the accent) */
  tileColor?: string;
  /** the leading icon without a tile, in the accent colour */
  plainLeading?: boolean;
  /** detail text, a Switch, a Badge… */
  trailing?: ReactNode;
  /** a chevron at the end: the row leads to another page */
  chevron?: boolean;
  /** colours the title: accent for an action row, danger for a destructive one */
  tone?: 'default' | 'accent' | 'danger';
  /** makes the whole row a button (or a link with href) */
  onClick?: () => void;
  /** makes the whole row a link to this URL (takes the place of `onClick`) */
  href?: string;
  disabled?: boolean;
};

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(function ListItem({ title, subtitle, leading, tileColor, plainLeading, trailing, chevron, tone = 'default', onClick, href, disabled, className, ...rest }, ref) {
  const action = Boolean(onClick || href);
  const Inner = (href ? 'a' : 'button') as ElementType;
  const content = (
    <>
      {leading && <span className={cx('sg-list-item__leading', plainLeading && 'sg-list-item__leading--plain')} style={tileColor ? ({ '--_tile': tileColor } as CSSProperties) : undefined} aria-hidden="true">{leading}</span>}
      <span className="sg-list-item__text">
        <span className="sg-list-item__title">{title}</span>
        {subtitle && <span className="sg-list-item__subtitle">{subtitle}</span>}
      </span>
      {(trailing || chevron) && (
        <span className="sg-list-item__trailing">
          {trailing}
          {chevron && <ChevronRightIcon className="sg-list-item__chevron" />}
        </span>
      )}
    </>
  );
  if (!action) {
    return <li ref={ref} className={cx('sg-list-row', 'sg-list-item', className)} data-has-leading={leading ? true : undefined} data-tone={tone !== 'default' ? tone : undefined} {...rest}>{content}</li>;
  }
  return (
    <li ref={ref} className="sg-list-row" data-has-leading={leading ? true : undefined} {...rest}>
      <Inner
        className={cx('sg-list-item', 'sg-list-item--action', className)}
        data-has-leading={leading ? true : undefined}
        data-tone={tone !== 'default' ? tone : undefined}
        {...(href ? { href } : { type: 'button', onClick, disabled })}
      >
        {content}
      </Inner>
    </li>
  );
});

/* ================================================================================================ AppBar */
export type AppBarProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** the page's title, in the bar as its h1 */
  title?: ReactNode;
  /** buttons at the start of the bar: back, a menu */
  leading?: ReactNode;
  /** buttons at the end of the bar: actions on the page */
  trailing?: ReactNode;
  /** a large title below the bar that hands over to the small one when scrolled away */
  largeTitle?: boolean;
  /** the bar is see-through until content scrolls under it */
  transparentAtTop?: boolean;
  /** scroll container to watch (defaults to window) */
  scrollTarget?: HTMLElement | null;
  /** flush with the top edge as an opaque surface (no glass): for dense web screens, or when another glass bar
      already floats on the screen (one floating bar per screen reads best) */
  attached?: boolean;
};

export const AppBar = forwardRef<HTMLElement, AppBarProps>(function AppBar({ title, leading, trailing, largeTitle, transparentAtTop, scrollTarget, attached, className, children, ...rest }, ref) {
  const lightRef = useGlassLight(!attached);
  const header = useRef<HTMLElement>(null), bar = useRef<HTMLDivElement>(null), large = useRef<HTMLHeadingElement>(null);
  /* Scroll-linked, written straight to the DOM (no React render per scroll event):
     --_p  0 → 1 while the large title slides under the bar: the large title fades out as the small one rises in,
           so the title hands over continuously instead of swapping at a threshold
     data-at-top: the bar's glass fades in once content is under it (transparentAtTop) */
  useIsoLayoutEffect(() => {
    const target: HTMLElement | Window = scrollTarget ?? window;
    const h = header.current, b = bar.current, l = large.current;
    if (!h || !b) return;
    let last = -1, top: boolean | null = null;
    const read = () => {
      const y = target instanceof Window ? target.scrollY : target.scrollTop;
      const atTop = y < 4;
      if (atTop !== top) { top = atTop; h.toggleAttribute('data-at-top', atTop); }
      if (!largeTitle || !l) return;
      const br = b.getBoundingClientRect(), lr = l.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (br.bottom - lr.top) / Math.max(1, lr.height)));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      h.style.setProperty('--_p', p.toFixed(3)); l.style.setProperty('--_p', p.toFixed(3));
      h.toggleAttribute('data-collapsed', p >= 0.999);
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    addEventListener('resize', read);
    return () => { target.removeEventListener('scroll', read); removeEventListener('resize', read); };
  }, [scrollTarget, largeTitle]);
  return (
    <>
      <header ref={mergeRefs(ref, header)} className={cx('sg-appbar', attached && 'sg-appbar--attached', className)} data-large={largeTitle || undefined} data-transparent-top={(transparentAtTop && !attached) || undefined} data-at-top="" {...rest}>
        <div ref={mergeRefs(bar, lightRef)} className={cx('sg-appbar__bar', attached ? 'sg-appbar__bar--solid' : glassClass('regular'))}>
          <div className="sg-appbar__leading">{leading}</div>
          <h1 className="sg-appbar__title">{title}</h1>
          <div className="sg-appbar__trailing">{trailing}</div>
        </div>
        {children}
      </header>
      {largeTitle && <h2 ref={large} className="sg-appbar__large" aria-hidden="true">{title}</h2>}
    </>
  );
});

/** A colour fade under a floating bar (cheap: no blur). */
export function ScrollFade({ edge = 'top', className, style }: {
  /** the edge it fades from: under a top bar, or above a bottom bar */
  edge?: 'top' | 'bottom';
  className?: string; style?: CSSProperties;
}) {
  return <div aria-hidden="true" className={cx('sg-scroll-fade', `sg-scroll-fade--${edge}`, className)} style={style} />;
}

/* ================================================================================================ Sidebar */
/** content worth a slot or a line: 0 is content; null, booleans and '' are not (React draws nothing for them) */
const shown = (n: ReactNode) => n !== undefined && n !== null && typeof n !== 'boolean' && n !== '';

export type SidebarProps = HTMLAttributes<HTMLElement> & {
  /** a floating glass panel; false puts the items straight on the page's background. Ignored when `attached` is set */
  glass?: boolean;
  /** flush with the screen's start edge as an opaque surface with a line on its inner edge (no glass, rounded
      corners or shadow): for dense web screens, as `AppBar attached` is */
  attached?: boolean;
  /** pinned above the list, outside the navigation landmark: a brand, a search field */
  header?: ReactNode;
  /** pinned below the list under a separator line, outside the navigation landmark: an account, a "new" button or a form */
  footer?: ReactNode;
};
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar({ glass = true, attached, header, footer, className, children, role, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, ...rest }, ref) {
  const isGlass = glass && !attached;
  const lightRef = useGlassLight(isGlass);
  const navRef = useRef<HTMLElement>(null);
  /* the list fades at an edge with more behind it (CSS): this marks which edges, and the writing direction (which
     moves the scrollbar's clear strip to the left in right-to-left layouts), read once a frame on scroll and whenever
     the list or its children are added, removed or resized; never during render or in this effect (the observer's
     first call runs after layout). A direction changed without a resize is picked up on the next scroll */
  useEffect(() => {
    const n = navRef.current;
    if (!n || typeof ResizeObserver === 'undefined') return;
    let raf = 0, bar = -1;
    const read = () => {
      raf = 0;
      /* clamped: Safari's rubber band past the top (a negative scrollTop) is not progress */
      const max = n.scrollHeight - n.clientHeight, y = Math.min(Math.max(n.scrollTop, 0), max);
      n.toggleAttribute('data-sg-more-start', y > 0.5);
      n.toggleAttribute('data-sg-more-end', y < max - 0.5);
      n.toggleAttribute('data-sg-rtl', getComputedStyle(n).direction === 'rtl');
      /* a scrollbar shown in its own gutter is as wide as the platform draws it: the strip kept clear of the fade takes
         at least that width (an overlay scrollbar takes none and stays within the padding) */
      const w = n.offsetWidth - n.clientWidth;
      if (w !== bar) { bar = w; n.style.setProperty('--_bar', `${w}px`); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(read); };
    const ro = new ResizeObserver(schedule);
    const watch = () => { ro.disconnect(); ro.observe(n); for (const c of Array.from(n.children)) ro.observe(c); };
    const mo = new MutationObserver(() => { watch(); schedule(); });
    watch();
    mo.observe(n, { childList: true });
    n.addEventListener('scroll', schedule, { passive: true });
    /* a row reached by keyboard keeps clear of the fades: scroll-padding does that where the browser's focus scrolling
       honours it, and this (a no-op there) where it does not (Firefox) */
    let focusRaf = 0;
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t === n || !t.matches?.(':focus-visible')) return;
      cancelAnimationFrame(focusRaf);
      focusRaf = requestAnimationFrame(() => t.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    };
    n.addEventListener('focusin', onFocus);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(focusRaf); ro.disconnect(); mo.disconnect();
      n.removeEventListener('scroll', schedule); n.removeEventListener('focusin', onFocus);
      for (const a of ['data-sg-more-start', 'data-sg-more-end', 'data-sg-rtl']) n.removeAttribute(a);
      n.style.removeProperty('--_bar');
    };
  }, []);
  /* the panel holds the slots and the landmark; its frame scrolls as a whole only when the slots leave the list less
     than its minimum height (a short window, large text), so every row and control stays reachable. What names,
     describes or gives a role to the landmark goes to the <nav> (a role on the panel would make a second landmark);
     the ref, id, class, style and the rest stay on the panel */
  return (
    <div ref={mergeRefs(ref, lightRef)} className={cx('sg-sidebar', attached && 'sg-sidebar--attached', isGlass && glassClass('regular'), className)} {...rest}>
      <div className="sg-sidebar__frame">
        {shown(header) && <div className="sg-sidebar__header">{header}</div>}
        <nav ref={navRef} className="sg-sidebar__scroll" role={role} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-describedby={ariaDescribedBy}>{children}</nav>
        {shown(footer) && <div className="sg-sidebar__footer">{footer}</div>}
      </div>
    </div>
  );
});

export type SidebarSectionProps = HTMLAttributes<HTMLDivElement> & {
  /** the small heading over the section's items; it names the group for assistive technology. Items that need no
      heading go straight into the Sidebar */
  header: ReactNode;
  /** the section's items */
  children?: ReactNode;
};
/** A group of items under a small heading. */
export function SidebarSection({ header, children, className, ...rest }: SidebarSectionProps) {
  const id = useStableId('sg-sidebar-section');
  const named = shown(header);
  return (
    <div role="group" aria-labelledby={named ? id : undefined} className={cx('sg-sidebar__section', className)} {...rest}>
      {named && <div id={id} className="sg-sidebar__section-header">{header}</div>}
      {children}
    </div>
  );
}

export type SidebarItemProps = HTMLAttributes<HTMLElement> & {
  /** an icon before the text. Icon sets hide their glyphs from assistive technology; an icon with a name of its own
      (an img with alt) adds it to the item's name, as before */
  icon?: ReactNode;
  /** the current page: highlighted, and aria-current="page" */
  selected?: boolean;
  /** a second, smaller line under the label; read as the item's description, not as part of its name */
  subtitle?: ReactNode;
  /** a number at the end of the row, e.g. unread items; read after the label, as it shows */
  count?: ReactNode;
  /** makes the item a link to this URL instead of a button */
  href?: string;
  onClick?: () => void;
};
export function SidebarItem({ icon, selected, subtitle, count, href, children, className, ...rest }: SidebarItemProps) {
  const Comp = (href ? 'a' : 'button') as ElementType;
  const id = useStableId('sg-sidebar-item');
  const hasSub = shown(subtitle);
  /* the name is the visible label and count, from the content (so a voice command naming what shows finds it); the
     subtitle stays out of it, hidden from the name and read as the description */
  const a11y = hasSub ? { 'aria-describedby': cx(`${id}-sub`, rest['aria-describedby']) } : {};
  return (
    <Comp className={cx('sg-sidebar__item', className)} aria-current={selected ? 'page' : undefined} {...(href ? { href } : { type: 'button' })} {...rest} {...a11y}>
      {shown(icon) && <span className="sg-sidebar__icon">{icon}</span>}
      <span className="sg-sidebar__text">
        <span className="sg-sidebar__label">{children}</span>
        {hasSub && <span id={`${id}-sub`} className="sg-sidebar__subtitle" aria-hidden="true">{subtitle}</span>}
      </span>
      {/* the space keeps the label and count apart in the name; between flex items it takes no room */}
      {shown(count) && <>{' '}<span className="sg-sidebar__count">{count}</span></>}
    </Comp>
  );
}
