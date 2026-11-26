import { StrictMode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@satin-glass/react/styles.css';
import './docs.css';
import { ThemeProvider, createTheme, Sidebar, SidebarItem, SidebarSection, Glass, IconButton, Popover, Toaster, type GrooveStyle, type ThemeMode } from '@satin-glass/react';
import { DisplaySettingsProvider, DisplaySettingsBar, DisplaySettingsList, LanguageSwitch } from './settings';
import type { MotionName } from '@satin-glass/tokens';
import { Menu as MenuIcon, SlidersHorizontal, X } from 'lucide-react';
import { ROUTES, GROUPS, routeFor, type Route } from './routes';
import { LangProvider, intlLocale, useLang, useT } from './i18n';

/* the pages in sidebar sections, one per group, in the routes' order */
const SECTIONS = ROUTES.reduce<{ group: Route['group']; routes: Route[] }[]>((acc, r) => {
  const last = acc.at(-1);
  if (last && last.group === r.group) last.routes.push(r); else acc.push({ group: r.group, routes: [r] });
  return acc;
}, []);

function useHash() {
  const read = () => location.hash.replace(/^#\/?/, '') || 'overview';
  const [h, setH] = useState(read);
  useEffect(() => { const on = () => setH(read()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return h;
}

/* narrow screens: the navigation is a drawer over the page */
function useNarrow(query = '(max-width: 900px)') {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => { const q = matchMedia(query), on = () => setM(q.matches); q.addEventListener('change', on); return () => q.removeEventListener('change', on); }, [query]);
  return m;
}

function App() {
  const page = useHash();
  const t = useT(), lang = useLang();
  /* initial display settings can come from the URL (?mode=dark&hc=1&rt=1&rm=1&motion=calm&grooves=flat) — used by the test matrix */
  const q = new URLSearchParams(location.search);
  const [mode, setMode] = useState<ThemeMode>((q.get('mode') as ThemeMode) || 'system');
  const [hc, setHc] = useState(q.get('hc') === '1');
  const [rt, setRt] = useState(q.get('rt') === '1');
  const [rm, setRm] = useState(q.get('rm') === '1');
  const [motion, setMotion] = useState<MotionName>((q.get('motion') as MotionName) || 'lively');
  const [grooves, setGrooves] = useState<GrooveStyle>(q.get('grooves') === 'flat' ? 'flat' : 'inset');
  const [navOpen, setNavOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [setBtn, setSetBtn] = useState<HTMLButtonElement | null>(null);
  const display = { mode, setMode, motion, setMotion, grooves, setGrooves, hc, setHc, rm, setRm, rt, setRt };
  /* the reader's language for every component's dates, numbers and built-in words */
  const theme = useMemo(() => createTheme({ mode, contrast: hc ? 'more' : 'standard', reduceTransparency: rt, reduceMotion: rm ? true : 'system', motion, grooves, locale: intlLocale(lang) }), [mode, hc, rt, rm, motion, grooves, lang]);
  const current = routeFor(page) ?? ROUTES.find((r) => r.id === 'overview')!;
  const Current = current.el;
  useEffect(() => { scrollTo(0, 0); setNavOpen(false); }, [page]);
  /* the drawer closes from a tap outside it (scrim), its close button, Escape, or choosing a page — including the
     page already shown; focus goes into it on open and back to the menu button on close */
  const narrow = useNarrow();
  const menuBtn = useRef<HTMLButtonElement>(null), closeBtn = useRef<HTMLButtonElement>(null), nav = useRef<HTMLDivElement>(null);
  const closeNav = () => {
    setNavOpen(false);
    if (nav.current?.contains(document.activeElement)) menuBtn.current?.focus();
  };
  useEffect(() => {
    if (!navOpen || !narrow) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeNav(); } };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [navOpen, narrow]);
  return (
    <DisplaySettingsProvider value={display}>
    <ThemeProvider theme={theme} style={{ minHeight: '100vh' }}>
      <Toaster>
        <div className="docs" data-nav-open={navOpen}>
          {/* a closed drawer is inert: its links are off screen and must not take Tab or a screen reader's cursor */}
          <div ref={nav} id="docs-nav" className="docs__nav" inert={(narrow && !navOpen) || undefined}>
            <Sidebar aria-label={t({ en: 'Documentation', ko: '문서' })} header={
              <header className="docs__head">
                <div className="docs__brand"><img className="docs__logo" src={`${import.meta.env.BASE_URL}logo-64.png`} alt="" width={36} height={36} /><div><b>Satin Glass</b><small>React UI · {__SG_VERSION__}</small></div>
                  {narrow && <IconButton ref={closeBtn} className="docs__nav-close" icon={<X />} label={t({ en: 'Close menu', ko: '메뉴 닫기' })} onClick={closeNav} />}</div>
                <LanguageSwitch />
              </header>
            }>
              {SECTIONS.map(({ group, routes }) => (
                <SidebarSection key={group} header={t(GROUPS[group])}>
                  {routes.map((p) => <SidebarItem key={p.id} href={`#/${p.id}`} icon={<p.icon />} selected={p.id === current.id} onClick={closeNav}>{t(p.label)}</SidebarItem>)}
                </SidebarSection>
              ))}
            </Sidebar>
          </div>
          <div className="docs__scrim" aria-hidden="true" onClick={closeNav} />
          <main className="docs__main">
            <div className="docs__top">
              <IconButton ref={menuBtn} className="docs__menu-btn" variant="glass" icon={<MenuIcon />} label={t({ en: 'Menu', ko: '메뉴' })} aria-expanded={navOpen} aria-controls="docs-nav" onClick={() => setNavOpen((v) => !v)} />
              {/* the page's contents button lands here on screens too narrow for the contents rail (shared.tsx) */}
              <div id="docs-contents-slot" className="docs__contents-slot" />
              {/* wide: every display setting in one bar; narrow: one button opens them all (nothing is hidden) */}
              <Glass className="docs__settings docs__settings--bar">
                <DisplaySettingsBar />
              </Glass>
              <IconButton ref={setSetBtn} className="docs__settings-btn" variant="glass" icon={<SlidersHorizontal />} label={t({ en: 'Display settings', ko: '표시 설정' })} aria-expanded={setOpen} onClick={() => setSetOpen((v) => !v)} />
              <Popover open={setOpen} onClose={() => setSetOpen(false)} anchor={setBtn} placement="bottom-end" aria-label={t({ en: 'Display settings', ko: '표시 설정' })}>
                <div style={{ width: 300 }}><DisplaySettingsList header={t({ en: 'Display settings', ko: '표시 설정' })} /></div>
              </Popover>
            </div>
            {/* a page loads on first visit; until then its place stays empty (no spinner for a local chunk) */}
            <Suspense fallback={<div className="docs__page" />}><Current key={lang} /></Suspense>
          </main>
        </div>
      </Toaster>
    </ThemeProvider>
    </DisplaySettingsProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><LangProvider><App /></LangProvider></StrictMode>);
