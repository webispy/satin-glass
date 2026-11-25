import {
  createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore,
  type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, type ComponentPropsWithoutRef,
} from 'react';
import { createPortal } from 'react-dom';
import { attachLight, type MotionName } from '@satin-glass/core';
import type { TextStyle } from '@satin-glass/tokens';
import { cx, mergeRefs, useClient } from './utils';

/* ================================================================================================ Theme */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeContrast = 'standard' | 'more' | 'system';
/** how level −1 parts (rails, fields, troughs) are drawn: cut in, or a flat tint */
export type GrooveStyle = 'inset' | 'flat';
export type Theme = {
  mode: ThemeMode;
  contrast: ThemeContrast;
  /** solid surfaces instead of glass ('system' follows prefers-reduced-transparency) */
  reduceTransparency: boolean | 'system';
  /** pointer-following highlight on glass */
  light: boolean;
  /** CSS variable overrides, e.g. { accent: '#0a7' } → --sg-accent */
  tokens?: Record<string, string>;
  /** motion personality: 'calm' | 'lively' (default) | 'playful' */
  motion?: MotionName;
  /** reduce motion: true = always (e.g. a remote desktop / VDI session), false = never, 'system' = follow prefers-reduced-motion */
  reduceMotion: boolean | 'system';
  /** grooves (rails, fields, segmented and stepper troughs): 'inset' (default) cuts them in; 'flat' draws the same
      parts as a flat tint. Only level −1 changes: handles, glass and shadows stay. Unset inherits the outer theme */
  grooves?: GrooveStyle;
  /** the language, a BCP 47 tag ('ko-KR', 'en-US', 'ja-JP'): how dates, times and numbers are written, how text sorts,
      and the words components write themselves. Formats follow any locale; built-in words exist in English and Korean
      (other languages get English). Set it once for the app; a component's own `locale` prop wins, and unset inherits
      the outer theme, then 'en-US'. The element gets it as `lang`, and so do its portals */
  locale?: string;
};
/** the theme with every 'system' setting resolved: what its element (and its portals) actually show */
export type ResolvedTheme = Theme & { scheme: 'light' | 'dark'; name: 'light' | 'dark' | 'light-hc' | 'dark-hc'; reducedTransparency: boolean; reducedMotion: boolean; grooves: GrooveStyle; locale: string };

export function createTheme(t: Partial<Theme> = {}): Theme {
  return { mode: 'system', contrast: 'system', reduceTransparency: 'system', reduceMotion: 'system', light: true, ...t };
}

const ThemeCtx = createContext<ResolvedTheme>({ ...createTheme(), scheme: 'light', name: 'light', reducedTransparency: false, reducedMotion: false, grooves: 'inset', locale: 'en-US' });
export const useTheme = () => useContext(ThemeCtx);
/* the locale some provider above set, if any: only a set one becomes `lang` (else the page's own lang stands) */
const LangCtx = createContext<string | undefined>(undefined);
/** The locale in effect: the nearest ThemeProvider's `locale`, else 'en-US'. Components with a `locale` prop prefer
    their own. Not read from the browser: the server and the client must render the same words */
export const useLocale = (): string => useContext(ThemeCtx).locale;
/* whether a ThemeProvider is above: without one a portal writes no settings, so the page's own (system) ones apply */
const ProvidedCtx = createContext(false);

/* the motion personality in effect (overlays rendered in a portal read it from here) */
const MotionCtx = createContext<MotionName | undefined>(undefined);
export const useMotion = () => useContext(MotionCtx);

export type MotionScopeProps = {
  /** the personality inside: 'calm', 'lively' or 'playful'; unset inherits the one outside */
  motion?: MotionName;
  children?: ReactNode;
};
/** Sets the motion personality for everything inside: CSS springs via [data-sg-motion], JS springs and portals via
    context. This is the one way to give part of an app, or a single component, its own personality; components take
    no motion prop. The wrapper is display: contents but still a DOM parent, so put it around a whole group (a
    ButtonGroup, a TabBar), not around one of its children. Without `motion` it inherits, keeping the same element so
    toggling the override never remounts what is inside. */
export function MotionScope({ motion, children }: MotionScopeProps) {
  const outer = useContext(MotionCtx);
  return (
    <MotionCtx.Provider value={motion ?? outer}>
      <div data-sg-motion={motion} style={{ display: 'contents' }}>{children}</div>
    </MotionCtx.Provider>
  );
}

/* A system preference, for the 'system' settings. A browser rendering on its own reads it in the first render (no
   frame of the light theme in a dark-mode app). The server cannot know it and answers false: light, standard
   contrast, motion and transparency on. While the browser hydrates the server's HTML it uses that same answer, so the
   two match (useSyncExternalStore's server snapshot), and React renders again with the system's own right after the
   hydration commit, correcting the attributes. The trade-off: until the script has run, a server-rendered page
   shows the server's guess, as it did before; an app that knows the reader's choice (a cookie) passes it as `mode`
   instead of 'system', and nothing changes on hydration. */
const noMedia = { matches: false, addEventListener() {}, removeEventListener() {} };
function useMedia(q: string): boolean {
  const mq = useMemo(() => (typeof matchMedia === 'function' ? matchMedia(q) : noMedia), [q]);
  const subscribe = useCallback((on: () => void) => { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [mq]);
  return useSyncExternalStore(subscribe, () => mq.matches, () => false);
}

const tokenStyle = (tokens?: Record<string, string>): CSSProperties | undefined =>
  tokens ? (Object.fromEntries(Object.entries(tokens).map(([k, v]) => [`--sg-${k}`, v])) as CSSProperties) : undefined;

export type ThemeProviderProps = HTMLAttributes<HTMLDivElement> & {
  /** the settings, made with createTheme; 'system' ones follow the user's OS preferences, and an unset `motion`,
      `grooves` or `locale` inherits from the provider outside */
  theme?: Theme;
  children?: ReactNode;
};

/** Sets the theme on its own element (themes nest: a dark island inside a light page works). */
export const ThemeProvider = forwardRef<HTMLDivElement, ThemeProviderProps>(function ThemeProvider({ theme = createTheme(), className, style, children, ...rest }, ref) {
  const sysDark = useMedia('(prefers-color-scheme: dark)');
  const sysMore = useMedia('(prefers-contrast: more)');
  const sysRT = useMedia('(prefers-reduced-transparency: reduce)');
  const sysRM = useMedia('(prefers-reduced-motion: reduce)');
  const outerMotion = useContext(MotionCtx);
  const outerGrooves = useContext(ThemeCtx).grooves;
  const outerLang = useContext(LangCtx);
  const lang = theme.locale ?? outerLang;
  const resolved = useMemo<ResolvedTheme>(() => {
    const scheme = theme.mode === 'system' ? (sysDark ? 'dark' : 'light') : theme.mode;
    const more = theme.contrast === 'system' ? sysMore : theme.contrast === 'more';
    return {
      ...theme, scheme, name: `${scheme}${more ? '-hc' : ''}` as ResolvedTheme['name'],
      reducedTransparency: theme.reduceTransparency === 'system' ? sysRT : theme.reduceTransparency,
      reducedMotion: theme.reduceMotion === 'system' ? sysRM : theme.reduceMotion,
      grooves: theme.grooves ?? outerGrooves,
      locale: lang ?? 'en-US',
    };
  }, [theme, sysDark, sysMore, sysRT, sysRM, outerGrooves, lang]);
  /* every setting is written resolved on the element, so the nearest provider decides for CSS, JS and portals alike.
     Reduced motion that follows the system is not known on the server, nor while hydrating: it is written "system"
     then, which neither forces motion on nor off, so the CSS follows the media query and prefersReducedMotion() asks
     matchMedia (a chart's entrance in the hydration commit stays still in a reduced-motion browser). Reduced
     transparency likewise: "system" until known, so the CSS follows its media query, and an explicit "false" stops an
     outer "true" (the class stays for stylesheets that look for it) */
  const known = useClient();
  const reduceMotion = theme.reduceMotion === 'system' && !known ? 'system' : String(resolved.reducedMotion);
  const reduceTransparency = theme.reduceTransparency === 'system' && !known ? 'system' : String(resolved.reducedTransparency);
  const motion = theme.motion ?? outerMotion;
  return (
    <ThemeCtx.Provider value={resolved}>
     <ProvidedCtx.Provider value={true}>
     <MotionCtx.Provider value={motion}>
     <LangCtx.Provider value={lang}>
      <div ref={ref} lang={theme.locale} data-sg-theme={resolved.name} data-sg-motion={motion ?? 'lively'} data-sg-reduce-motion={reduceMotion} data-sg-reduce-transparency={reduceTransparency} data-sg-grooves={resolved.grooves} className={cx('sg-root', reduceTransparency === 'true' && 'sg-reduce-transparency', className)} style={{ ...tokenStyle(theme.tokens), ...style }} {...rest}>
        {children}
      </div>
     </LangCtx.Provider>
     </MotionCtx.Provider>
     </ProvidedCtx.Provider>
    </ThemeCtx.Provider>
  );
});

/** Renders into document.body but keeps the surrounding theme. */
export function Portal({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTheme();
  const motion = useMotion();
  const provided = useContext(ProvidedCtx);
  const lang = useContext(LangCtx);
  /* synchronous host so the panel exists in the same commit (enter animations measure it in a layout effect). The
     server writes no portal, so while hydrating there is none either; it follows right after (useClient) */
  const client = useClient();
  if (!client) return null;
  const host = document.body;
  return createPortal(
    provided
      ? <div className={cx('sg-root sg-portal', t.reducedTransparency && 'sg-reduce-transparency', className)} data-sg-theme={t.name} data-sg-motion={motion ?? 'lively'} data-sg-reduce-motion={String(t.reducedMotion)} data-sg-reduce-transparency={String(t.reducedTransparency)} data-sg-grooves={t.grooves} lang={lang} style={tokenStyle(t.tokens)}>{children}</div>
      /* no theme above: the page's own settings and the system's apply (a default light, motion-on value would
         override prefers-color-scheme and prefers-reduced-motion) */
      : <div className={cx('sg-root sg-portal', className)} data-sg-motion={motion}>{children}</div>,
    host,
  );
}

/* ================================================================================================ Glass */
type PolyProps<E extends ElementType, P> = P & {
  /** the element or component to render, e.g. 'section' or 'button', whose props it then takes (default: a div; Text
      picks one from its variant) */
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'>;

export type GlassVariant = 'regular' | 'strong' | 'subtle' | 'clear';
/** how high the glass sits: floating (level 3: bars, menus, panels, toasts) or an overlay over a scrim (level 4:
    sheets, dialogs). The variant is only how dense it is */
export type GlassLevel = 'float' | 'overlay';
export type GlassOwnProps = {
  /** how dense the glass is: regular, strong (panels to read from), subtle, clear (over photos) */
  variant?: GlassVariant;
  /** how high it sits: 'float' (default: bars, menus, panels) or 'overlay' over a scrim (sheets, dialogs), with a deeper shadow */
  level?: GlassLevel;
  /** pointer-following highlight (default: theme.light) */
  light?: boolean;
  /** colour that seeps into the fill (e.g. from useImageTint) */
  tint?: string;
  /** corner radius, a step of the radius scale (default 'xl') */
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** shrinks a little while pressed, with a pointer cursor; for glass that acts as a button (render it `as="button"`,
      or give it a role and keyboard handling) */
  pressable?: boolean;
};

/** Hook form: registers an element with the pointer light. `enabled` says whether the element takes the light at all
    (a control that is glass only in one variant); `own` is the element's own option, which wins over the nearest
    theme's `light` (the usual precedence: the component, then the ThemeProvider). */
export function useGlassLight(enabled = true, own?: boolean) {
  const t = useTheme();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const on = enabled && (own ?? t.light);
  useEffect(() => (el && on ? attachLight(el) : undefined), [el, on]);
  return setEl;
}

export function glassClass(variant: GlassVariant = 'regular', pressable?: boolean, level: GlassLevel = 'float') {
  return cx('sg-glass', variant !== 'regular' && `sg-glass--${variant}`, level === 'overlay' && 'sg-glass--overlay', pressable && 'sg-pressable');
}

export const Glass = forwardRef(function Glass<E extends ElementType = 'div'>(
  { as, variant = 'regular', level = 'float', light, tint, radius, pressable, className, style, ...rest }: PolyProps<E, GlassOwnProps>,
  ref: React.Ref<HTMLElement>,
) {
  const Comp = (as ?? 'div') as ElementType;
  const lightRef = useGlassLight(true, light);
  return (
    <Comp
      ref={mergeRefs(ref, lightRef)}
      className={cx(glassClass(variant, pressable, level), className)}
      data-tint={tint ? '' : undefined}
      style={{ ...(tint ? { '--sg-tint': tint } : null), ...(radius ? { '--_radius': `var(--sg-radius-${radius})` } : null), ...style } as CSSProperties}
      {...rest}
    />
  );
}) as <E extends ElementType = 'div'>(p: PolyProps<E, GlassOwnProps> & { ref?: React.Ref<HTMLElement> }) => React.ReactElement | null;

/* ================================================================================================ Text, Stack, Divider */
export type TextProps<E extends ElementType = 'p'> = PolyProps<E, {
  /** the type style (default 'body'); also picks the element: display and title-1 render h1, title-2 h2, title-3 h3,
      headline h4, the rest p */
  variant?: TextStyle;
  /** the colour: secondary and tertiary for less important text, or a status colour */
  tone?: 'default' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success';
  /** one line, cut off with an ellipsis when it does not fit */
  truncate?: boolean;
  /** tabular figures: digits line up in columns and do not shift as a number changes */
  tabular?: boolean;
}>;
const defaultTag: Partial<Record<TextStyle, ElementType>> = { display: 'h1', 'title-1': 'h1', 'title-2': 'h2', 'title-3': 'h3', headline: 'h4' };

export const Text = forwardRef(function Text<E extends ElementType = 'p'>(
  { as, variant = 'body', tone = 'default', truncate, tabular, className, ...rest }: TextProps<E>, ref: React.Ref<HTMLElement>,
) {
  const Comp = (as ?? defaultTag[variant] ?? 'p') as ElementType;
  return <Comp ref={ref} className={cx('sg-text', `sg-text--${variant}`, tone !== 'default' && `sg-text--${tone}`, truncate && 'sg-text--truncate', tabular && 'sg-text--tabular', className)} {...rest} />;
}) as <E extends ElementType = 'p'>(p: TextProps<E> & { ref?: React.Ref<HTMLElement> }) => React.ReactElement | null;

/* a step of the spacing scale reads its token (so a theme that changes --sg-space-3 changes gap={3}); other numbers
   are 4 px units */
const SPACE_STEPS = new Set([0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16]);
const space = (v: number | string | undefined) => (v === undefined ? undefined : typeof v === 'number'
  ? (SPACE_STEPS.has(v) ? `var(--sg-space-${String(v).replace('.', '_')}, ${v * 4}px)` : `${v * 4}px`) : v);

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  /** lays the children out in a column (default) or a row */
  direction?: 'row' | 'column';
  /** gap in 4 px units, or any CSS length */
  gap?: number | string;
  /** where the children sit across the direction (CSS `align-items`) */
  align?: CSSProperties['alignItems'];
  /** how the children are spread along the direction (CSS `justify-content`) */
  justify?: CSSProperties['justifyContent'];
  /** lets the children wrap onto more lines */
  wrap?: boolean;
  /** padding in 4 px units, or any CSS length */
  padding?: number | string;
  /** the element to render (default 'div') */
  as?: ElementType;
};
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack({ direction = 'column', gap, align, justify, wrap, padding, as, className, style, ...rest }, ref) {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp ref={ref} className={cx('sg-stack', direction === 'row' && 'sg-stack--row', className)} style={{ gap: space(gap), alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : undefined, padding: space(padding), ...style }} {...rest} />;
});

export function Divider({ vertical, className, ...rest }: HTMLAttributes<HTMLHRElement> & {
  /** a vertical line between items in a row (aria-orientation vertical) */
  vertical?: boolean;
}) {
  return <hr className={cx('sg-divider', vertical && 'sg-divider--vertical', className)} aria-orientation={vertical ? 'vertical' : undefined} {...rest} />;
}

export function VisuallyHidden(props: HTMLAttributes<HTMLSpanElement>) {
  return <span className="sg-visually-hidden" {...props} />;
}
