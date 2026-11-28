/* Link: a text link in prose and table cells (#6). */
import { forwardRef, type AnchorHTMLAttributes, type ComponentPropsWithRef, type ComponentType, type ElementType, type ReactElement, type ReactNode, type Ref } from 'react';
import { cx, useStableId } from './utils';
import { useMessages } from './messages';

type LinkOwnProps = {
  /** the text colour: 'accent' (default) uses the link colour; 'inherit' takes the surrounding text's (for a link in
      secondary text or a table cell), so the underline alone marks it and the parent's colour sets the contrast */
  tone?: 'accent' | 'inherit';
  /** the link leaves the app: adds an arrow after the text. It does not change where the link opens (use `target`
      for that) */
  external?: boolean;
  /** words in place of the built-in ones for the theme's locale: `opensInNewTab`, which screen readers announce after
      the name of a link with `target="_blank"` */
  labels?: { opensInNewTab?: string };
};

/* Link draws its own children (an arrow, a hidden notice), so raw inner HTML cannot be given as well */
type NotOwn = keyof LinkOwnProps | 'component' | 'dangerouslySetInnerHTML';
/* never, not just left out: props spread from an object are checked against it too */
type NoInnerHtml = {
  /** not taken: Link draws its own children (the arrow, the new-tab notice), so the text goes in `children` */
  dangerouslySetInnerHTML?: never;
};

/** A native link: an `<a>` with an `href`. */
export type LinkProps = LinkOwnProps & NoInnerHtml & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, NotOwn | 'href'> & {
  /** where the link goes */
  href: string;
  /** a router's link component to render in place of the `<a>`; Link then takes that component's options (`to`, …)
      instead of `href`, and the component must render an `<a href>` (default: 'a') */
  component?: 'a';
};

/* Omit over each member of a union, so an adapter whose props are a union keeps each branch's required props */
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A Link rendered through another component, e.g. a router link: Link takes that component's options (`to`, …), and
    the component must render an `<a href>` and pass on to it the ref, `className`, children, events and ARIA
    attributes. If `className` or `children` is a function of the component's state (as in a NavLink), it stays one. */
export type LinkComponentProps<C extends ComponentType<any>> = LinkOwnProps & NoInnerHtml & { component: C } & OmitEach<ComponentPropsWithRef<C>, NotOwn>;

/* `rel` for a link that opens a new browsing context: split on HTML whitespace, each token once (case-insensitive,
   the first spelling kept), a conflicting opener dropped, noopener added */
const relFor = (rel: string | undefined) => {
  const seen = new Set<string>(), out: string[] = [];
  for (const t of (rel ?? '').split(/[\t\n\f\r ]+/)) {
    const k = t.toLowerCase();
    if (!t || k === 'opener' || seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  if (!seen.has('noopener')) out.push('noopener');
  return out.join(' ');
};

const Arrow = () => (
  <svg className="sg-link__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M7.5 16.5L16.5 7.5M9 7.5h7.5V15" />
  </svg>
);

/* what the function itself sees: the two public signatures below are its contract */
type AnyLinkProps = LinkOwnProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & {
  component?: ElementType;
  className?: string | ((...state: never[]) => string | undefined);
  children?: ReactNode | ((...state: never[]) => ReactNode);
};

/* attributes taken off a link without a destination, so it neither acts nor counts as a link */
const INERT = new Set(['target', 'rel', 'download', 'role', 'tabIndex', 'href', 'hrefLang', 'ping', 'referrerPolicy']);

/** A text link in a sentence or a table cell: the surrounding text's font, the link colour and an underline that is
    always there. `target="_blank"` adds `rel="noopener"`, the arrow, and a description telling screen readers that it
    opens in a new tab or window. */
export const Link = forwardRef<HTMLAnchorElement, AnyLinkProps>(function Link(
  { component, tone = 'accent', external, labels, className, children, ...rest },
  ref,
) {
  const m = useMessages();
  const id = useStableId('sg-link');
  const Comp = (component ?? 'a') as 'a';
  const { href, target, rel, download, 'aria-describedby': describedBy } = rest;
  const cls = (extra: string | undefined) => cx('sg-link', tone === 'inherit' && 'sg-link--inherit', extra);
  /* an <a> with no href is a placeholder, not a link: no role, no tab stop. It shows as plain text and keeps no
     handlers (an empty href="" is still a URL) */
  if (Comp === 'a' && (href === undefined || href === null)) {
    const shown = Object.fromEntries(Object.entries(rest).filter(([k]) => !/^on[A-Z]/.test(k) && !INERT.has(k)));
    return <a ref={ref} {...shown} className={cx('sg-link', typeof className === 'string' ? className : undefined)}>{typeof children === 'function' ? null : children}</a>;
  }
  const blank = typeof target === 'string' && target.toLowerCase() === '_blank';
  /* a download does not open the file in a new tab, whatever the target (React leaves out a null download) */
  const notice = blank && (download == null || download === false);
  const own = notice ? `${id}-new` : undefined;
  /* inside the link, so the parent keeps one child; hidden, so it is not part of the name (the visible text stays the
     name, WCAG 2.5.3), yet aria-describedby can still point at it, also when aria-label names the link */
  const extra = external || blank;
  const after = extra && (
    <>
      <Arrow />
      {own && <span id={own} hidden>{labels?.opensInNewTab ?? m.opensInNewTab}</span>}
    </>
  );
  /* every argument the component passes goes on (a NavLink passes its state; another may pass more) */
  type Fn<R> = (...state: never[]) => R;
  return (
    <Comp
      ref={ref}
      {...rest}
      rel={blank ? relFor(rel) : rel}
      aria-describedby={cx(describedBy, own) || undefined}
      /* a router's NavLink may take both as functions of its state: they stay functions */
      className={(typeof className === 'function' ? (...s: never[]) => cls((className as Fn<string | undefined>)(...s)) : cls(className)) as string}
    >
      {/* with nothing to add, the children go on as given (a function stays the component's own) */}
      {(!extra ? children : typeof children === 'function' ? (...s: never[]) => <>{(children as Fn<ReactNode>)(...s)}{after}</> : <>{children}{after}</>) as ReactNode}
    </Comp>
  );
}) as {
  /* the router signature first: a call with no `component` falls through to the native one, which createElement and
     ComponentProps<typeof Link> (they read the last signature) then see */
  <C extends ComponentType<any>>(p: LinkComponentProps<C>): ReactElement | null;
  (p: LinkProps & { ref?: Ref<HTMLAnchorElement> }): ReactElement | null;
};
