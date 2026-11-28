/* Link (#6): the native and router signatures, where it opens and what it says, the inert placeholder. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement, createRef, forwardRef, type AnchorHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import { DataTable, Link, ThemeProvider, createTheme } from '../src';

/* the accessible description: the text of the elements aria-describedby names */
const description = (el: Element) => (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');

/* a router link as most routers write one: a required `to`, rendered as an <a href> */
type To = { pathname: string; search?: string };
const RouterLink = forwardRef<HTMLAnchorElement, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string | To }>(function RouterLink({ to, ...rest }, ref) {
  return <a ref={ref} href={typeof to === 'string' ? to : to.pathname + (to.search ?? '')} {...rest} />;
});

/* a router link whose props are a union: each branch keeps its own required props */
type Dest = { kind: 'home' } | { kind: 'item'; itemId: string };
const DestLink = forwardRef<HTMLAnchorElement, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & Dest>(function DestLink(p, ref) {
  const { kind, ...rest } = p as Dest & Record<string, unknown>;
  delete rest.itemId;
  return <a ref={ref} href={kind === 'home' ? '/' : `/items/${(p as { itemId: string }).itemId}`} {...rest} />;
});
/* a NavLink as routers write one: className and children may be functions of its state */
type NavState = { isActive: boolean };
const NavLink = forwardRef<HTMLAnchorElement, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'> & {
  to: string; className?: string | ((s: NavState) => string | undefined); children?: ReactNode | ((s: NavState) => ReactNode);
}>(function NavLink({ to, className, children, ...rest }, ref) {
  const s = { isActive: to === '/here' };
  return <a ref={ref} href={to} className={typeof className === 'function' ? className(s) : className} {...rest}>{typeof children === 'function' ? children(s) : children}</a>;
});

describe('Link types', () => {
  it('holds the native and router signatures apart', () => {
    const a = createRef<HTMLAnchorElement>();
    const spread = { href: '/terms', dangerouslySetInnerHTML: { __html: 'terms' } };
    /* compiled, never rendered: the type errors are the test */
    const wrong = () => <>
      {/* @ts-expect-error a native link needs an href */}
      <Link>terms</Link>
      {/* @ts-expect-error a router link needs its own required props */}
      <Link component={RouterLink}>terms</Link>
      {/* @ts-expect-error `to` is not a native anchor's */}
      <Link href="/terms" to="/terms">terms</Link>
      {/* @ts-expect-error a button is not a link */}
      <Link component="button" href="/terms">terms</Link>
      {/* @ts-expect-error the item branch needs its itemId */}
      <Link component={DestLink} kind="item">item</Link>
      {/* @ts-expect-error Link draws its own children, so no raw inner HTML */}
      <Link href="/terms" dangerouslySetInnerHTML={{ __html: 'terms' }} />
      {/* @ts-expect-error nor through a spread */}
      <Link {...spread} />
    </>;
    expect(typeof wrong).toBe('function');
    render(<>
      <Link href="/terms" ref={a} onClick={(e) => e.currentTarget.href}>terms</Link>
      <Link component={RouterLink} to={{ pathname: '/terms', search: '?v=2' }}>terms</Link>
    </>);
    expect(screen.getAllByRole('link')[1].getAttribute('href')).toBe('/terms?v=2');
    expect(a.current).toBeInstanceOf(HTMLAnchorElement);
  });

  it('keeps each branch of a union of router props', () => {
    render(<><Link component={DestLink} kind="item" itemId="7">item</Link><Link component={DestLink} kind="home">home</Link></>);
    expect(screen.getByRole('link', { name: 'item' }).getAttribute('href')).toBe('/items/7');
  });

  it('is the native link for createElement and ComponentProps', () => {
    const p: ComponentProps<typeof Link> = { href: '/terms' };
    render(createElement(Link, p, 'terms'));
    expect(screen.getByRole('link', { name: 'terms' }).getAttribute('href')).toBe('/terms');
  });
});

describe('Link', () => {
  it('renders an underlined anchor that opens in the same tab, with nothing set', () => {
    render(<p>Read the <Link href="/terms">terms</Link> first.</p>);
    const a = screen.getByRole('link', { name: 'terms' });
    expect(a.className).toBe('sg-link');
    expect(a.getAttribute('href')).toBe('/terms');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.hasAttribute('rel')).toBe(false);
    expect(a.hasAttribute('aria-describedby')).toBe(false);
    expect(a.querySelector('svg')).toBeNull();
  });

  it('takes the surrounding colour with tone="inherit"', () => {
    render(<Link href="/a" tone="inherit" className="mine">a</Link>);
    expect(screen.getByRole('link').className).toBe('sg-link sg-link--inherit mine');
  });

  it('marks an external link with an arrow, still in the same tab and with nothing announced', () => {
    render(<Link href="https://example.com" external>Example</Link>);
    const a = screen.getByRole('link', { name: 'Example' });
    expect(a.querySelector('svg.sg-link__arrow')?.getAttribute('aria-hidden')).toBe('true');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.hasAttribute('aria-describedby')).toBe(false);
  });

  it('says a new tab or window opens when target is _blank, as a description, and adds noopener', () => {
    render(<Link href="/report" target="_blank" aria-describedby="hint">Report</Link>);
    const a = screen.getByRole('link', { name: 'Report' });
    expect(a.getAttribute('rel')).toBe('noopener');
    const ids = a.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('hint');
    expect(document.getElementById(ids[1])?.textContent).toBe('opens in a new tab or window');
    /* an internal link opening a new tab gets the arrow too, once */
    expect(a.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps the parent to one child: the arrow and the notice are inside the link', () => {
    const { container } = render(<p><Link href="/report" target="_blank">Report</Link></p>);
    expect(container.querySelector('p')!.children).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Report' })).toBeTruthy();
  });

  it('writes an id that stays one token under an identifier prefix with a space', () => {
    const html = renderToString(<Link href="/x" target="_blank">x</Link>, { identifierPrefix: 'report pane-' });
    const ids = /aria-describedby="([^"]*)"/.exec(html)![1].split(' ');
    expect(ids).toHaveLength(1);
    expect(html).toContain(`id="${ids[0]}"`);
  });

  it('merges rel: keeps the given tokens, drops opener, does not add noreferrer', () => {
    const { rerender } = render(<Link href="/x" target="_BLANK" rel="ugc Opener nofollow">x</Link>);
    expect(screen.getByRole('link').getAttribute('rel')).toBe('ugc nofollow noopener');
    rerender(<Link href="/x" target="_blank" rel="NOOPENER noreferrer">x</Link>);
    expect(screen.getByRole('link').getAttribute('rel')).toBe('NOOPENER noreferrer');
    rerender(<Link href="/x" target="_blank" rel={'ugc UGC\tNOOPENER noopener'}>x</Link>);
    expect(screen.getByRole('link').getAttribute('rel')).toBe('ugc NOOPENER');
    rerender(<Link href="/x" target="_self" rel="opener">x</Link>);
    expect(screen.getByRole('link').getAttribute('rel')).toBe('opener');
  });

  it('keeps the name a label gives, and adds the notice to it as a description', () => {
    render(<Link href="/x" target="_blank" aria-label="Annual report 2026">Annual report</Link>);
    const a = screen.getByRole('link', { name: 'Annual report 2026' });
    expect(description(a)).toBe('opens in a new tab or window');
  });

  it('announces nothing for a download, but does for a download left out as null', () => {
    const { rerender } = render(<Link href="/a.pdf" target="_blank" download>PDF</Link>);
    expect(screen.getByRole('link').hasAttribute('aria-describedby')).toBe(false);
    rerender(<Link href="/a.pdf" target="_blank" download={null as unknown as undefined}>PDF</Link>);
    expect(description(screen.getByRole('link'))).toBe('opens in a new tab or window');
  });

  it('speaks the locale of the nearest theme, and takes its own words first', () => {
    const { rerender } = render(<ThemeProvider theme={createTheme({ locale: 'ko-KR' })}><Link href="/x" target="_blank">보고서</Link></ThemeProvider>);
    expect(description(screen.getByRole('link'))).toBe('새 탭 또는 창에서 열림');
    rerender(<ThemeProvider theme={createTheme({ locale: 'ko-KR' })}><Link href="/x" target="_blank" labels={{ opensInNewTab: '새 창' }}>보고서</Link></ThemeProvider>);
    expect(description(screen.getByRole('link'))).toBe('새 창');
  });

  it('renders a router link with its own props, the class and the ref', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(<Link component={RouterLink} to="/settings" ref={ref} target="_blank">Settings</Link>);
    const a = screen.getByRole('link', { name: 'Settings' });
    expect(a).toBe(ref.current);
    expect(a.getAttribute('href')).toBe('/settings');
    expect(a.className).toBe('sg-link');
    expect(a.getAttribute('rel')).toBe('noopener');
    expect(description(a)).toBe('opens in a new tab or window');
  });

  it('keeps a NavLink\'s className and children as functions of its state', () => {
    render(<><Link component={NavLink} to="/here" className={({ isActive }: NavState) => (isActive ? 'on' : undefined)}>{({ isActive }: NavState) => (isActive ? 'Here (current)' : 'Here')}</Link>
      <Link component={NavLink} to="/there" target="_blank" className="x">{() => 'There'}</Link></>);
    const here = screen.getByRole('link', { name: 'Here (current)' });
    expect(here.className).toBe('sg-link on');
    const there = screen.getByRole('link', { name: 'There' });
    expect(there.className).toBe('sg-link x');
    expect(there.querySelector('svg.sg-link__arrow')).not.toBeNull();
    expect(description(there)).toBe('opens in a new tab or window');
  });

  it('passes on every argument a component gives its className and children functions', () => {
    const Two = forwardRef<HTMLAnchorElement, { to: string; className?: (a: boolean, b: string) => string; children?: (a: boolean, b: string) => ReactNode }>(function Two({ to, className, children }, ref) {
      return <a ref={ref} href={to} className={className?.(true, 'second')}>{children?.(true, 'second')}</a>;
    });
    render(<Link component={Two} to="/x" className={(a, b) => `${a}-${b}`}>{(a, b) => `${a} ${b}`}</Link>);
    const l = screen.getByRole('link', { name: 'true second' });
    expect(l.className).toBe('sg-link true-second');
  });

  it('hands a children function on untouched when it adds nothing (no arrow, no notice)', () => {
    const Trim = forwardRef<HTMLAnchorElement, { to: string; children: (on: boolean) => string }>(function Trim({ to, children }, ref) {
      return <a ref={ref} href={to}>{children(true).trim()}</a>;
    });
    render(<Link component={Trim} to="/x">{(on) => (on ? ' Active ' : ' Idle ')}</Link>);
    expect(screen.getByRole('link', { name: 'Active' })).toBeTruthy();
  });

  it('in an actionable table row, a click or Enter on the link does not run the row action', () => {
    const onRowClick = vi.fn();
    const go = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<DataTable aria-label="Files" rowKey={(r: { name: string }) => r.name} rows={[{ name: 'a' }]} onRowClick={onRowClick}
      columns={[{ key: 'name', header: 'Name', render: (r: { name: string }) => <Link href={`/files/${r.name}`} onClick={go}>{r.name}</Link> }]} />);
    const a = screen.getByRole('link', { name: 'a' });
    fireEvent.click(a);
    a.focus();
    fireEvent.keyDown(a, { key: 'Enter' });
    expect(go).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('is plain text without an href at run time: no link role, no tab stop, no handlers', () => {
    const on = vi.fn();
    const ref = createRef<HTMLAnchorElement>();
    const Untyped = Link as unknown as (p: Record<string, unknown>) => ReturnType<typeof Link>;
    render(<Untyped ref={ref} onClick={on} target="_blank" role="link" tabIndex={0} aria-describedby="why">terms</Untyped>);
    expect(ref.current!.getAttribute('aria-describedby')).toBe('why');
    expect(ref.current!.hasAttribute('role')).toBe(false);
    expect(ref.current!.hasAttribute('tabindex')).toBe(false);
    expect(screen.queryByRole('link')).toBeNull();
    const a = ref.current!;
    expect(a.tagName).toBe('A');
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.hasAttribute('target')).toBe(false);
    a.focus();
    expect(document.activeElement).not.toBe(a);
    fireEvent.click(a);
    expect(on).not.toHaveBeenCalled();
  });
});
