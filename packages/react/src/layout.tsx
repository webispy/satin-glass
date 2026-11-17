import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx, mergeRefs } from './utils';
import { glassClass, useGlassLight } from './foundation';
import { ChevronRightIcon } from './icons';

/* ================================================================================================ List */
export function ListSection({ header, footer, children, className, ...rest }: HTMLAttributes<HTMLElement> & { header?: ReactNode; footer?: ReactNode }) {
  return (
    <section className={cx('gl-list-section', className)} {...rest}>
      {header && <h3 className="gl-list-section__header">{header}</h3>}
      {children}
      {footer && <p className="gl-list-section__footer">{footer}</p>}
    </section>
  );
}

export const List = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement> & { plain?: boolean }>(function List({ plain, className, ...rest }, ref) {
  return <ul ref={ref} role="list" className={cx('gl-list', plain && 'gl-list--plain', className)} {...rest} />;
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
      {leading && <span className={cx('gl-list-item__leading', plainLeading && 'gl-list-item__leading--plain')} style={tileColor ? ({ '--_tile': tileColor } as CSSProperties) : undefined} aria-hidden="true">{leading}</span>}
      <span className="gl-list-item__text">
        <span className="gl-list-item__title">{title}</span>
        {subtitle && <span className="gl-list-item__subtitle">{subtitle}</span>}
      </span>
      {(trailing || chevron) && (
        <span className="gl-list-item__trailing">
          {trailing}
          {chevron && <ChevronRightIcon className="gl-list-item__chevron" />}
        </span>
      )}
    </>
  );
  if (!action) {
    return <li ref={ref} className={cx('gl-list-row', 'gl-list-item', className)} data-has-leading={leading ? true : undefined} data-tone={tone !== 'default' ? tone : undefined} {...rest}>{content}</li>;
  }
  return (
    <li ref={ref} className="gl-list-row" data-has-leading={leading ? true : undefined} {...rest}>
      <Inner
        className={cx('gl-list-item', 'gl-list-item--action', className)}
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
export type AppBarProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** a large title below the bar that hands over to the small one when scrolled away */
  largeTitle?: boolean;
  /** the bar is see-through until content scrolls under it */
  transparentAtTop?: boolean;
  /** scroll container to watch (defaults to window) */
  scrollTarget?: HTMLElement | null;
};

export const AppBar = forwardRef<HTMLElement, AppBarProps>(function AppBar({ title, leading, trailing, largeTitle, transparentAtTop, scrollTarget, className, children, ...rest }, ref) {
  const lightRef = useGlassLight();
  const large = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const target: HTMLElement | Window = scrollTarget ?? window;
    const read = () => {
      const y = target instanceof Window ? target.scrollY : target.scrollTop;
      setAtTop(y < 4);
      if (largeTitle && large.current) setCollapsed(y > large.current.offsetTop + large.current.offsetHeight - 56);
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, [scrollTarget, largeTitle]);
  return (
    <>
      <header ref={ref} className={cx('gl-appbar', className)} data-large={largeTitle || undefined} data-collapsed={collapsed || undefined} {...rest}>
        <div ref={lightRef} className={cx('gl-appbar__bar', glassClass('regular'), transparentAtTop && atTop && 'gl-appbar__bar--transparent')}>
          <div className="gl-appbar__leading">{leading}</div>
          <h1 className="gl-appbar__title">{title}</h1>
          <div className="gl-appbar__trailing">{trailing}</div>
        </div>
        {children}
      </header>
      {largeTitle && <h2 ref={large} className="gl-appbar__large" aria-hidden="true">{title}</h2>}
    </>
  );
});

/** A colour fade under a floating bar (cheap: no blur). */
export function ScrollFade({ edge = 'top', className, style }: { edge?: 'top' | 'bottom'; className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cx('gl-scroll-fade', `gl-scroll-fade--${edge}`, className)} style={style} />;
}

/* ================================================================================================ Sidebar */
export const Sidebar = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { glass?: boolean }>(function Sidebar({ glass = true, className, ...rest }, ref) {
  const lightRef = useGlassLight(glass);
  return <nav ref={mergeRefs(ref, lightRef)} className={cx('gl-sidebar', glass && glassClass('regular'), className)} {...rest} />;
});
export function SidebarSection({ children }: { children: ReactNode }) {
  return <div className="gl-sidebar__section">{children}</div>;
}
export type SidebarItemProps = HTMLAttributes<HTMLElement> & { icon?: ReactNode; selected?: boolean; count?: ReactNode; href?: string; onClick?: () => void };
export function SidebarItem({ icon, selected, count, href, children, className, ...rest }: SidebarItemProps) {
  const Comp = (href ? 'a' : 'button') as ElementType;
  return (
    <Comp className={cx('gl-sidebar__item', className)} aria-current={selected ? 'page' : undefined} {...(href ? { href } : { type: 'button' })} {...rest}>
      {icon}<span>{children}</span>{count !== undefined && <span className="gl-sidebar__count">{count}</span>}
    </Comp>
  );
}
