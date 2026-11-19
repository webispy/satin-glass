import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx, mergeRefs, useIsoLayoutEffect } from './utils';
import { glassClass, useGlassLight } from './foundation';
import { ChevronRightIcon } from './icons';

/* ================================================================================================ List */
export function ListSection({ header, footer, children, className, ...rest }: HTMLAttributes<HTMLElement> & { header?: ReactNode; footer?: ReactNode }) {
  return (
    <section className={cx('sg-list-section', className)} {...rest}>
      {header && <h3 className="sg-list-section__header">{header}</h3>}
      {children}
      {footer && <p className="sg-list-section__footer">{footer}</p>}
    </section>
  );
}

export const List = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement> & { plain?: boolean }>(function List({ plain, className, ...rest }, ref) {
  return <ul ref={ref} role="list" className={cx('sg-list', plain && 'sg-list--plain', className)} {...rest} />;
});

export type ListItemProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode;
  subtitle?: ReactNode;
  /** an icon in a coloured tile (tileColor) or plain */
  leading?: ReactNode;
  tileColor?: string;
  plainLeading?: boolean;
  /** detail text, a Switch, a Badge… */
  trailing?: ReactNode;
  chevron?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  /** makes the whole row a button (or a link with href) */
  onClick?: () => void;
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
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** a large title below the bar that hands over to the small one when scrolled away */
  largeTitle?: boolean;
  /** the bar is see-through until content scrolls under it */
  transparentAtTop?: boolean;
  /** scroll container to watch (defaults to window) */
  scrollTarget?: HTMLElement | null;
  /** flush with the top edge as an opaque surface (no glass): for dense web screens, or when another glass bar
      already floats on the screen (one floating bar per screen reads best; design-language.md 8.4) */
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
export function ScrollFade({ edge = 'top', className, style }: { edge?: 'top' | 'bottom'; className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cx('sg-scroll-fade', `sg-scroll-fade--${edge}`, className)} style={style} />;
}

/* ================================================================================================ Sidebar */
export const Sidebar = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { glass?: boolean }>(function Sidebar({ glass = true, className, children, ...rest }, ref) {
  const lightRef = useGlassLight(glass);
  return (
    <nav ref={mergeRefs(ref, lightRef)} className={cx('sg-sidebar', glass && glassClass('regular'), className)} {...rest}>
      <div className="sg-sidebar__scroll">{children}</div>
    </nav>
  );
});
export function SidebarSection({ children }: { children: ReactNode }) {
  return <div className="sg-sidebar__section">{children}</div>;
}
export type SidebarItemProps = HTMLAttributes<HTMLElement> & { icon?: ReactNode; selected?: boolean; count?: ReactNode; href?: string; onClick?: () => void };
export function SidebarItem({ icon, selected, count, href, children, className, ...rest }: SidebarItemProps) {
  const Comp = (href ? 'a' : 'button') as ElementType;
  return (
    <Comp className={cx('sg-sidebar__item', className)} aria-current={selected ? 'page' : undefined} {...(href ? { href } : { type: 'button' })} {...rest}>
      {icon}<span>{children}</span>{count !== undefined && <span className="sg-sidebar__count">{count}</span>}
    </Comp>
  );
}
