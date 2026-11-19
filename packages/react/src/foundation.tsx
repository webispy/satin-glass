import {
  createContext, forwardRef, useContext, useEffect, useMemo, useState,
  type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, type ComponentPropsWithoutRef,
} from 'react';
import { createPortal } from 'react-dom';
import { attachLight, type MotionName } from '@satin-glass/core';
import type { TextStyle } from '@satin-glass/tokens';
import { cx, mergeRefs } from './utils';

/* ================================================================================================ Theme */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeContrast = 'standard' | 'more' | 'system';
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
};
export type ResolvedTheme = Theme & { scheme: 'light' | 'dark'; name: 'light' | 'dark' | 'light-hc' | 'dark-hc' };

export function createTheme(t: Partial<Theme> = {}): Theme {
  return { mode: 'system', contrast: 'system', reduceTransparency: 'system', reduceMotion: 'system', light: true, ...t };
}

const ThemeCtx = createContext<ResolvedTheme>({ ...createTheme(), scheme: 'light', name: 'light' });
export const useTheme = () => useContext(ThemeCtx);

/* the motion personality in effect (overlays rendered in a portal read it from here) */
const MotionCtx = createContext<MotionName | undefined>(undefined);
export const useMotion = () => useContext(MotionCtx);

export type MotionScopeProps = { motion?: MotionName; children?: ReactNode; /** context only, no wrapper element (for portals) */ bare?: boolean };
/** Sets the motion personality for everything inside: CSS springs via [data-sg-motion], JS springs and portals via context. */
export function MotionScope({ motion, children, bare }: MotionScopeProps) {
  const outer = useContext(MotionCtx);
  const m = motion ?? outer;
  if (!motion) return <>{children}</>;
  return (
    <MotionCtx.Provider value={m}>
      {bare ? children : <div data-sg-motion={m} style={{ display: 'contents' }}>{children}</div>}
    </MotionCtx.Provider>
  );
}

function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(q), on = () => setM(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

const tokenStyle = (tokens?: Record<string, string>): CSSProperties | undefined =>
  tokens ? (Object.fromEntries(Object.entries(tokens).map(([k, v]) => [`--sg-${k}`, v])) as CSSProperties) : undefined;

export type ThemeProviderProps = HTMLAttributes<HTMLDivElement> & { theme?: Theme; children?: ReactNode };

/** Sets the theme on its own element (themes nest: a dark island inside a light page works). */
export const ThemeProvider = forwardRef<HTMLDivElement, ThemeProviderProps>(function ThemeProvider({ theme = createTheme(), className, style, children, ...rest }, ref) {
  const sysDark = useMedia('(prefers-color-scheme: dark)');
  const sysMore = useMedia('(prefers-contrast: more)');
  const sysRT = useMedia('(prefers-reduced-transparency: reduce)');
  const resolved = useMemo<ResolvedTheme>(() => {
    const scheme = theme.mode === 'system' ? (sysDark ? 'dark' : 'light') : theme.mode;
    const more = theme.contrast === 'system' ? sysMore : theme.contrast === 'more';
    return { ...theme, scheme, name: `${scheme}${more ? '-hc' : ''}` as ResolvedTheme['name'] };
  }, [theme, sysDark, sysMore]);
  const rt = theme.reduceTransparency === 'system' ? sysRT : theme.reduceTransparency;
  return (
    <ThemeCtx.Provider value={resolved}>
     <MotionCtx.Provider value={theme.motion}>
      <div ref={ref} data-sg-theme={resolved.name} data-sg-motion={theme.motion} data-sg-reduce-motion={theme.reduceMotion === 'system' ? undefined : String(theme.reduceMotion)} className={cx('sg-root', rt && 'sg-reduce-transparency', className)} style={{ ...tokenStyle(theme.tokens), ...style }} {...rest}>
        {children}
      </div>
     </MotionCtx.Provider>
    </ThemeCtx.Provider>
  );
});

/** Renders into document.body but keeps the surrounding theme. */
export function Portal({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTheme();
  const motion = useMotion();
  /* synchronous host so the panel exists in the same commit (enter animations measure it in a layout effect) */
  const host = typeof document !== 'undefined' ? document.body : null;
  if (!host) return null;
  return createPortal(
    <div className={cx('sg-root sg-portal', className)} data-sg-theme={t.name} data-sg-motion={motion} data-sg-reduce-motion={t.reduceMotion === 'system' ? undefined : String(t.reduceMotion)} style={tokenStyle(t.tokens)}>{children}</div>,
    host,
  );
}

/* ================================================================================================ Glass */
type PolyProps<E extends ElementType, P> = P & { as?: E } & Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'>;

export type GlassVariant = 'regular' | 'strong' | 'subtle' | 'clear';
export type GlassOwnProps = {
  variant?: GlassVariant;
  /** pointer-following highlight (default: theme.light) */
  light?: boolean;
  /** colour that seeps into the fill (e.g. from useImageTint) */
  tint?: string;
  radius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  pressable?: boolean;
};

/** Hook form: registers an element with the pointer light. */
export function useGlassLight(enabled = true) {
  const t = useTheme();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => (el && enabled && t.light ? attachLight(el) : undefined), [el, enabled, t.light]);
  return setEl;
}

export function glassClass(variant: GlassVariant = 'regular', pressable?: boolean) {
  return cx('sg-glass', variant !== 'regular' && `sg-glass--${variant}`, pressable && 'sg-pressable');
}

export const Glass = forwardRef(function Glass<E extends ElementType = 'div'>(
  { as, variant = 'regular', light, tint, radius, pressable, className, style, ...rest }: PolyProps<E, GlassOwnProps>,
  ref: React.Ref<HTMLElement>,
) {
  const Comp = (as ?? 'div') as ElementType;
  const lightRef = useGlassLight(light ?? true);
  return (
    <Comp
      ref={mergeRefs(ref, lightRef)}
      className={cx(glassClass(variant, pressable), className)}
      data-tint={tint ? '' : undefined}
      style={{ ...(tint ? { '--sg-tint': tint } : null), ...(radius ? { '--_radius': `var(--sg-radius-${radius})` } : null), ...style } as CSSProperties}
      {...rest}
    />
  );
}) as <E extends ElementType = 'div'>(p: PolyProps<E, GlassOwnProps> & { ref?: React.Ref<HTMLElement> }) => React.ReactElement | null;

/* ================================================================================================ Text, Stack, Divider */
export type TextProps<E extends ElementType = 'p'> = PolyProps<E, {
  variant?: TextStyle;
  tone?: 'default' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success';
  truncate?: boolean;
  tabular?: boolean;
}>;
const defaultTag: Partial<Record<TextStyle, ElementType>> = { display: 'h1', 'title-1': 'h1', 'title-2': 'h2', 'title-3': 'h3', headline: 'h4' };

export const Text = forwardRef(function Text<E extends ElementType = 'p'>(
  { as, variant = 'body', tone = 'default', truncate, tabular, className, ...rest }: TextProps<E>, ref: React.Ref<HTMLElement>,
) {
  const Comp = (as ?? defaultTag[variant] ?? 'p') as ElementType;
  return <Comp ref={ref} className={cx('sg-text', `sg-text--${variant}`, tone !== 'default' && `sg-text--${tone}`, truncate && 'sg-text--truncate', tabular && 'sg-text--tabular', className)} {...rest} />;
}) as <E extends ElementType = 'p'>(p: TextProps<E> & { ref?: React.Ref<HTMLElement> }) => React.ReactElement | null;

const space = (v: number | string | undefined) => (v === undefined ? undefined : typeof v === 'number' ? `${v * 4}px` : v);

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  direction?: 'row' | 'column';
  /** gap in 4 px units, or any CSS length */
  gap?: number | string;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
  padding?: number | string;
  as?: ElementType;
};
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack({ direction = 'column', gap, align, justify, wrap, padding, as, className, style, ...rest }, ref) {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp ref={ref} className={cx('sg-stack', direction === 'row' && 'sg-stack--row', className)} style={{ gap: space(gap), alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : undefined, padding: space(padding), ...style }} {...rest} />;
});

export function Divider({ vertical, className, ...rest }: HTMLAttributes<HTMLHRElement> & { vertical?: boolean }) {
  return <hr className={cx('sg-divider', vertical && 'sg-divider--vertical', className)} aria-orientation={vertical ? 'vertical' : undefined} {...rest} />;
}

export function VisuallyHidden(props: HTMLAttributes<HTMLSpanElement>) {
  return <span className="sg-visually-hidden" {...props} />;
}
