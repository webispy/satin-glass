/* Where an A2UI session's surfaces are drawn. Each sits in the app's tree, under the nearest ThemeProvider, so its
   controls and the dialogs they open follow the app's theme, language and settings. */
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEvent, type ReactNode, type RefObject } from 'react';
import { A2uiSurface as Surface } from '@a2ui/react';
import type { SurfaceModel } from '@a2ui/web_core';
import { useLocale } from '@satin-glass/react';
import { CardDepthContext, EnvContext, FieldScopeContext, GroundContext, newFieldScope, SurfaceIdContext, type Diagnostic, type Env, type Ground } from './components/shared';
import { defaultAllowUrl, type AllowUrl } from './urls';
import { wordsFor, type A2uiWords } from './words';
import type { A2uiSession } from './session';

/** the agent Cards' starting depth for where the app draws them: this option, else the nearest A2uiProvider's, else
    the page */
function useGround(ground: Ground | undefined) {
  const outer = useContext(GroundContext);
  return (ground ?? outer ?? 'page') === 'surface' ? 1 : 0;
}

/* Which surface holds the focus. React's focus events travel up the React tree, portals included, so a dialog a
   surface opened reports to that surface's wrapper wherever the dialog sits in the page. When the agent deletes the
   surface that holds the focus, the focus would fall to the page, so `fallback` takes it. Surfaces are compared by
   their model, so one deleted and created again under the same ID is still a deletion. Focus that the user takes
   away (to another control, or to nothing with an explicit blur) ends the ownership; a focused element removed with
   its surface does not. */
function useFocusOwner(surfaces: SurfaceModel[], fallback: () => HTMLElement | null | undefined) {
  const owner = useRef<SurfaceModel | null>(null);
  const prev = useRef<SurfaceModel[]>([]);
  const frame = useRef(0);
  useEffect(() => {
    const gone = prev.current.filter((s) => !surfaces.includes(s));
    prev.current = surfaces;
    if (!owner.current || !gone.includes(owner.current)) return;
    owner.current = null;
    /* after the deleted surface's dialog has unmounted and given its focus back to what is left */
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const a = document.activeElement;
      if (!a || a === document.body || !a.isConnected) fallback()?.focus({ preventScroll: true });
    });
  }, [surfaces]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return {
    take: (s: SurfaceModel) => () => { owner.current = s; },
    give: (s: SurfaceModel) => (e: FocusEvent) => {
      if (owner.current !== s) return;
      const to = e.relatedTarget as Node | null, from = e.target as Element;
      /* to somewhere outside this surface (a focus inside one of its dialogs comes back through take()) */
      if (to && !(e.currentTarget as Element).contains(to)) { owner.current = null; return; }
      /* to nothing: an explicit blur leaves the element in the page; a removal takes it out */
      if (!to) queueMicrotask(() => { if (from.isConnected && owner.current === s && document.activeElement === document.body) owner.current = null; });
    },
  };
}

const useSurfaces = (a2ui: A2uiSession) => useSyncExternalStore(a2ui.subscribe, a2ui.getSnapshot, a2ui.getSnapshot);
/* the environment of the session's last committed render, followed as it changes */
const useEnvOf = (a2ui: A2uiSession) => useSyncExternalStore(a2ui.subscribe, () => a2ui.env, () => a2ui.env);
const wrapperStyle: CSSProperties = { minWidth: 0 };

function Drawn({ s, focus }: { s: SurfaceModel; focus: ReturnType<typeof useFocusOwner> }) {
  const [fields] = useState(newFieldScope);
  return (
    <div data-a2ui-surface={s.id} style={wrapperStyle} onFocus={focus.take(s)} onBlur={focus.give(s)}>
      <SurfaceIdContext.Provider value={s.id}><FieldScopeContext.Provider value={fields}><Surface surface={s as never} /></FieldScopeContext.Provider></SurfaceIdContext.Provider>
    </div>
  );
}

/** Every surface of a session, in the order they were created, in one region that takes the focus when the agent
    deletes the surface that held it. `lang` is the language of the agent's content, when it differs from the page's. */
export function A2uiSurfaces({ a2ui, lang, ground, className, style }: {
  a2ui: A2uiSession; lang?: string;
  /** where the app draws the surfaces: `'page'` (the default) draws the agent's outermost Card as a surface card;
      `'surface'`, for surfaces already inside a card, sheet or bubble of the app's own, draws every agent Card with a
      hairline instead, so nothing lifts twice. A dialog the agent opens starts again. Left out: the nearest
      A2uiProvider's, else `'page'`. */
  ground?: Ground;
  className?: string; style?: CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const surfaces = useSurfaces(a2ui), env = useEnvOf(a2ui);
  const focus = useFocusOwner(surfaces, () => box.current);
  const depth = useGround(ground);
  return (
    <EnvContext.Provider value={env}><CardDepthContext.Provider value={depth}>
      <div ref={box} role="region" aria-label={env.words.surface} tabIndex={-1} lang={lang} className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, outline: 'none', ...style }}>
        {surfaces.map((s) => <Drawn key={s.id} s={s} focus={focus} />)}
      </div>
    </CardDepthContext.Provider></EnvContext.Provider>
  );
}

/** One surface of a session, by its ID; nothing while the agent has not created it. `fallbackFocus` takes the focus
    when the agent deletes this surface while it holds it. */
export function A2uiSurface({ a2ui, surfaceId, fallbackFocus, lang, ground, className, style }: {
  a2ui: A2uiSession; surfaceId: string; fallbackFocus?: RefObject<HTMLElement | null>; lang?: string;
  /** where the app draws the surface: see A2uiSurfaces' `ground` */
  ground?: Ground;
  className?: string; style?: CSSProperties;
}) {
  const all = useSurfaces(a2ui), env = useEnvOf(a2ui);
  const mine = useMemo(() => all.filter((s) => s.id === surfaceId), [all, surfaceId]);
  const focus = useFocusOwner(mine, () => fallbackFocus?.current);
  const depth = useGround(ground);
  return (
    <EnvContext.Provider value={env}><CardDepthContext.Provider value={depth}>
      <div role="region" aria-label={env.words.surface} lang={lang} className={className} style={{ minWidth: 0, ...style }}>
        {mine.map((s) => <Drawn key={s.id} s={s} focus={focus} />)}
      </div>
    </CardDepthContext.Provider></EnvContext.Provider>
  );
}

/** For an app that owns its own `MessageProcessor` (made with `satinCatalogs()`) and draws its surfaces with
    `@a2ui/react`'s `A2uiSurface`: gives the Satin components their words, icons, URL policy and reports. */
export function A2uiProvider({ locale, words, icons, allowUrl, onReport, ground, children }: {
  locale?: string; words?: Partial<A2uiWords>; icons?: Record<string, ReactNode>; allowUrl?: AllowUrl;
  onReport?: (d: Diagnostic) => void;
  /** where the app draws the surfaces inside it (see A2uiSurfaces' `ground`); a surface's own option comes first */
  ground?: Ground;
  children: ReactNode;
}) {
  const themeLocale = useLocale();
  const report = useRef(onReport); report.current = onReport;
  const env = useMemo<Env>(() => {
    const iconsTold = new Set<string>();
    return {
      locale: locale ?? themeLocale, words: wordsFor(locale ?? themeLocale, words), icons: icons ?? {}, allowUrl: allowUrl ?? defaultAllowUrl,
      warn: (d) => {
        if (d.code === 'missing-icon') { if (iconsTold.has(d.message)) return; iconsTold.add(d.message); }
        if (report.current) report.current(d); else console.warn('[@satin-glass/a2ui]', d.message);
      },
    };
  }, [locale, themeLocale, words, icons, allowUrl]);
  const outer = useContext(GroundContext), g = ground ?? outer;
  return (
    <EnvContext.Provider value={env}>
      {/* a surface drawn by @a2ui/react's own component reads the depth straight away; Satin's read the ground */}
      <GroundContext.Provider value={g}><CardDepthContext.Provider value={g === 'surface' ? 1 : 0}>{children}</CardDepthContext.Provider></GroundContext.Provider>
    </EnvContext.Provider>
  );
}
