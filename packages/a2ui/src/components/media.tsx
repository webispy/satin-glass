/* Image, Icon, Video and AudioPlayer of the A2UI basic catalog. URLs pass web_core's sanitiser and then the app's
   policy; a refused one draws nothing and raises a diagnostic. Icons come from the app (`useA2ui({ icons })`): the
   library draws only a minimal set of glyphs of its own (design language §1); a name the app did not give draws a
   neutral glyph, so an icon-only button stays visible, and is reported once. */
import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MediaViewer } from '@satin-glass/react';
import { agentA11y, BODY_PAD, EdgeContext, grow, InButtonContext, InTriggerContext, useEnv, useHostSink, type Rendered } from './shared';
import { mediaUrl, type UrlUse } from '../urls';

function useUrl(r: Rendered<unknown>, raw: unknown, use: Exclude<UrlUse, 'open'>) {
  const env = useEnv();
  const url = raw == null || raw === '' ? undefined : mediaUrl(raw, use, env.allowUrl);
  const told = useRef('');
  useLayoutEffect(() => {
    if (url || raw == null || raw === '' || told.current === String(raw)) return;
    told.current = String(raw);
    env.warn({ code: 'refused-url', componentId: r.context.componentModel.id, message: `A ${use} URL was refused: ${String(raw).slice(0, 120)}` });
  });
  return url;
}

/* the wire's variants: icon, avatar, smallFeature, mediumFeature (the default), largeFeature, header */
const SIZE: Record<string, CSSProperties> = {
  icon: { width: 24, height: 24 },
  avatar: { width: 40, height: 40, borderRadius: '50%' },
  smallFeature: { width: 100, height: 100 },
  mediumFeature: { width: '100%', maxWidth: 300 },
  largeFeature: { width: '100%', maxHeight: 400 },
  header: { width: '100%', height: 200 },
};
const FIT: Record<string, CSSProperties['objectFit']> = { contain: 'contain', cover: 'cover', fill: 'fill', none: 'none', scaleDown: 'scale-down' };
const FEATURES = ['mediumFeature', 'largeFeature', 'header'];
/** whether an image is drawn cropped: covering a box whose proportions differ from the photo's by more than 3 % */
export function isCropped(box: { w: number; h: number }, natural: { w: number; h: number }, fit: string): boolean {
  if (fit !== 'cover' || !(box.w > 0 && box.h > 0 && natural.w > 0 && natural.h > 0)) return false;
  return Math.abs((box.w / box.h) / (natural.w / natural.h) - 1) > 0.03 + 1e-9;   /* exactly 3 % is not cropped */
}

/** an image at a card's edge. Where it is cropped (a portrait over the height limit, a header band), a button laid
    over it shows it whole in Satin's media viewer: the renderer cut the photo, so it gives a way to see all of it. The
    picture itself never moves, so it looks the same either way and its size is followed throughout. The button comes
    without taking the focus, and stays while it has the focus or the viewer is open. Inside the agent's own button or
    a dialog's trigger there is no second button: the press belongs to them. */
function EdgeImage({ src, alt, edge, header, fit, pressable, onError }: { src: string; alt: string; edge: string; header: boolean; fit: CSSProperties['objectFit']; pressable: boolean; onError: () => void }) {
  const env = useEnv();
  const img = useRef<HTMLImageElement>(null), button = useRef<HTMLButtonElement>(null);
  const [cropped, setCropped] = useState(false), [open, setOpen] = useState(false), [focused, setFocused] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState(0);
  const measure = () => {
    const i = img.current;
    if (!i) return;
    if (i.clientWidth) setWidth(i.clientWidth);
    if (!i.naturalWidth) return;
    setSize({ w: i.naturalWidth, h: i.naturalHeight });
    setCropped(isCropped({ w: i.clientWidth, h: i.clientHeight }, { w: i.naturalWidth, h: i.naturalHeight }, i.style.objectFit || getComputedStyle(i).objectFit));
  };
  /* measured when it loads (or had loaded, from the cache) and whenever its box changes; again for a new photo */
  useLayoutEffect(() => {
    setCropped(false); setSize(null);
    const i = img.current;
    if (i?.complete) measure();
    if (!i || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(i);
    return () => ro.disconnect();
  }, [src]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* and when the agent changes only the fit: the box keeps its size, so nothing else would measure it */
  const fitted = useRef(fit);
  useLayoutEffect(() => { if (fitted.current !== fit) { fitted.current = fit; measure(); } }, [fit]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* the viewer gives the focus back to its opener as it closes, after this closes it: the button is held until the
     focus next moves (to it, where it then stays while focused, or elsewhere), even if the photo is no longer cropped */
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!hold) return;
    const done = () => setHold(false);
    document.addEventListener('focusin', done, true);
    return () => document.removeEventListener('focusin', done, true);
  }, [hold]);
  /* the photo keeps its proportions up to a 4:5 portrait of the card's width (as measured; 400 px until then) and
     400 px; a header keeps its 200 px band. No size containment: the picture still gives a card that sizes to its
     content its own width. */
  const height: CSSProperties = header ? { height: 200 } : { height: 'auto', maxHeight: width ? Math.min(1.25 * width, 400) : 400 };
  const asButton = pressable && (cropped || open || focused || hold);
  return (
    <div data-a2ui-edge={edge} style={{ position: 'relative', alignSelf: 'stretch', marginInline: -BODY_PAD.inline,
      marginBlockStart: edge === 'bottom' ? undefined : -BODY_PAD.top, marginBlockEnd: edge === 'top' ? undefined : -BODY_PAD.bottom }}>
      <img ref={img} src={src} alt={alt} aria-hidden={asButton || undefined} loading="lazy" decoding="async" onLoad={measure} onError={onError}
        style={{ display: 'block', width: '100%', borderRadius: 0, background: 'var(--sg-fill)', objectFit: fit, ...height }} />
      {asButton && (
        <button ref={button} type="button" className="sg-focusable" aria-haspopup="dialog" aria-label={alt ? `${env.words.wholeImage}: ${alt}` : env.words.wholeImage}
          onClick={() => setOpen(true)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ position: 'absolute', inset: 0, appearance: 'none', margin: 0, padding: 0, border: 0, background: 'transparent', color: 'inherit', font: 'inherit',
            cursor: typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches ? 'zoom-in' : undefined, outlineOffset: -3 }} />
      )}
      {pressable && (
        <MediaViewer open={open} onClose={() => { setOpen(false); setHold(true); }} items={[{ src, alt, ...(size ? { width: size.w, height: size.h } : {}) }]} getOrigin={() => button.current}
          aria-label={alt || env.words.wholeImage} labels={{ close: env.words.close }} />
      )}
    </div>
  );
}
export function A2uiImage(r: Rendered<{ url?: unknown; description?: unknown; fit?: string; variant?: string }>) {
  const { props } = r;
  useHostSink(r);
  const url = useUrl(r, props.url, 'image');
  const at = useContext(EdgeContext), inButton = useContext(InButtonContext), inTrigger = useContext(InTriggerContext);
  /* an image that fails to load is taken away, as a refused one is: no broken-image band. What it would still have
     said stays for a screen reader. A URL is tried again when it comes back after another */
  const [failed, setFailed] = useState<string | null>(null);
  const [shown, setShown] = useState(url);
  if (shown !== url) { setShown(url); setFailed(null); }
  if (!url) return null;
  const { label } = agentA11y(r);
  const alt = label ?? (props.description == null ? '' : String(props.description));
  if (failed === url) return alt ? <span role="img" aria-label={alt} className="sg-visually-hidden" /> : null;
  const variant = props.variant ?? 'mediumFeature';
  const edge = at?.id === r.context.componentModel.id && FEATURES.includes(variant) && !props.weight ? at.edge : null;
  if (edge) {
    /* at a card's edge: over the card body's padding to the card's sides (and top or bottom), where the card clips it.
       The photo keeps its proportions, up to a 4:5 portrait of the card's width and 400 px; beyond that it is
       filled from its centre. A header keeps its 200 px band. The agent's fit comes first. */
    return <EdgeImage src={url} alt={alt} edge={edge} header={variant === 'header'} fit={FIT[props.fit ?? ''] ?? 'cover'} pressable={!inButton && !inTrigger} onError={() => setFailed(url)} />;
  }
  return (
    <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(url)}
      style={{ display: 'block', objectFit: FIT[props.fit ?? 'fill'] ?? 'fill', borderRadius: variant === 'avatar' ? '50%' : variant === 'icon' ? 0 : 'var(--sg-radius-md)', ...SIZE[variant], ...grow(props.weight) }} />
  );
}

const GLYPH = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
export function A2uiIcon(r: Rendered<{ name?: unknown }>) {
  const { props } = r;
  const env = useEnv();
  useHostSink(r);
  const { label } = agentA11y(r);
  const raw = props.name;
  const path = raw && typeof raw === 'object' && 'svgPath' in raw ? String((raw as { svgPath: unknown }).svgPath ?? '') : undefined;
  const name = typeof raw === 'string' ? raw : undefined;
  const given: ReactNode | undefined = name ? env.icons[name] : undefined;
  const told = useRef('');
  useLayoutEffect(() => {
    if (!name || given !== undefined || told.current === name) return;
    told.current = name;
    env.warn({ code: 'missing-icon', componentId: r.context.componentModel.id, message: `No icon was given for "${name}"; a neutral glyph is drawn. Pass it in useA2ui({ icons }).` });
  });
  const glyph = path !== undefined
    ? <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false"><path d={path} /></svg>
    : given ?? GLYPH;
  return (
    <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ display: 'inline-flex', width: 24, height: 24, flex: 'none', color: 'inherit', ...grow(props.weight) }}>{glyph}</span>
  );
}

export function A2uiVideo(r: Rendered<{ url?: unknown; posterUrl?: unknown }>) {
  const { props } = r;
  useHostSink(r);
  const url = useUrl(r, props.url, 'video'), poster = useUrl(r, props.posterUrl, 'poster');
  const { label } = agentA11y(r);
  if (!url) return null;
  return <video src={url} poster={poster} controls preload="metadata" aria-label={label}
    style={{ display: 'block', width: '100%', borderRadius: 'var(--sg-radius-md)', background: 'var(--sg-fill)', ...grow(props.weight) }} />;
}

export function A2uiAudioPlayer(r: Rendered<{ url?: unknown; description?: unknown }>) {
  const { props } = r;
  useHostSink(r);
  const url = useUrl(r, props.url, 'audio');
  const { label } = agentA11y(r);
  if (!url) return null;
  const name = label ?? (props.description == null ? undefined : String(props.description));
  return <audio src={url} controls preload="metadata" aria-label={name} style={{ display: 'block', width: '100%', ...grow(props.weight) }} />;
}
