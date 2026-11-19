import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@satin-glass/react/styles.css';
import './docs.css';
import { ThemeProvider, createTheme, Sidebar, SidebarItem, SidebarSection, Glass, IconButton, Popover, Toaster, type ThemeMode } from '@satin-glass/react';
import { DisplaySettingsProvider, DisplaySettingsBar, DisplaySettingsList } from './settings';
import type { MotionName } from '@satin-glass/tokens';
import { Layers, Palette, Type, Waves, Sparkles, MousePointerClick, TextCursorInput, Navigation as NavIcon, List as ListIcon, PanelTop, Smartphone, Menu as MenuIcon, SlidersHorizontal, FlaskConical, ListChecks, GalleryVerticalEnd, LayoutDashboard, Table2, ChartLine, MessageSquareWarning, X } from 'lucide-react';
import { Overview, Colors, Typography, Motion, Material } from './pages/foundations';
import { Buttons, Inputs, Navigation, Lists, Overlays } from './pages/components';
import { Showcase } from './pages/showcase';
import { Lab } from './pages/lab';
import { Selection } from './pages/selection';
import { Display } from './pages/display';
import { Dashboard } from './pages/dashboard';
import { TablePage } from './pages/table';
import { ChartsPage } from './pages/charts';
import { FeedbackPage } from './pages/feedback';

const PAGES = [
  { id: 'overview', label: '소개', icon: Layers, el: Overview, group: '기초' },
  { id: 'material', label: '재질', icon: Sparkles, el: Material, group: '기초' },
  { id: 'colors', label: '색', icon: Palette, el: Colors, group: '기초' },
  { id: 'type', label: '타이포그래피', icon: Type, el: Typography, group: '기초' },
  { id: 'motion', label: '모션', icon: Waves, el: Motion, group: '기초' },
  { id: 'buttons', label: '버튼', icon: MousePointerClick, el: Buttons, group: '컴포넌트' },
  { id: 'inputs', label: '입력', icon: TextCursorInput, el: Inputs, group: '컴포넌트' },
  { id: 'selection', label: '선택', icon: ListChecks, el: Selection, group: '컴포넌트' },
  { id: 'navigation', label: '내비게이션', icon: NavIcon, el: Navigation, group: '컴포넌트' },
  { id: 'lists', label: '목록과 표시', icon: ListIcon, el: Lists, group: '컴포넌트' },
  { id: 'feedback', label: '상태와 피드백', icon: MessageSquareWarning, el: FeedbackPage, group: '컴포넌트' },
  { id: 'overlays', label: '오버레이', icon: PanelTop, el: Overlays, group: '컴포넌트' },
  { id: 'display', label: '구성과 미디어', icon: GalleryVerticalEnd, el: Display, group: '컴포넌트' },
  { id: 'table', label: '표', icon: Table2, el: TablePage, group: '데이터' },
  { id: 'charts', label: '차트와 지표', icon: ChartLine, el: ChartsPage, group: '데이터' },
  { id: 'showcase', label: '쇼케이스', icon: Smartphone, el: Showcase, group: '예제' },
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, el: Dashboard, group: '예제' },
  { id: 'lab', label: '예외 상황 랩', icon: FlaskConical, el: Lab, group: '예제' },
];

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
  /* initial display settings can come from the URL (?mode=dark&hc=1&rt=1&rm=1&motion=calm) — used by the test matrix */
  const q = new URLSearchParams(location.search);
  const [mode, setMode] = useState<ThemeMode>((q.get('mode') as ThemeMode) || 'system');
  const [hc, setHc] = useState(q.get('hc') === '1');
  const [rt, setRt] = useState(q.get('rt') === '1');
  const [rm, setRm] = useState(q.get('rm') === '1');
  const [motion, setMotion] = useState<MotionName>((q.get('motion') as MotionName) || 'lively');
  const [navOpen, setNavOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [setBtn, setSetBtn] = useState<HTMLButtonElement | null>(null);
  const display = { mode, setMode, motion, setMotion, hc, setHc, rm, setRm, rt, setRt };
  const theme = useMemo(() => createTheme({ mode, contrast: hc ? 'more' : 'standard', reduceTransparency: rt, reduceMotion: rm ? true : 'system', motion }), [mode, hc, rt, rm, motion]);
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
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
  let group = '';
  return (
    <DisplaySettingsProvider value={display}>
    <ThemeProvider theme={theme} style={{ minHeight: '100vh' }}>
      <Toaster>
        <div className="docs" data-nav-open={navOpen}>
          {/* a closed drawer is inert: its links are off screen and must not take Tab or a screen reader's cursor */}
          <div ref={nav} id="docs-nav" className="docs__nav" inert={(narrow && !navOpen) || undefined}>
            <Sidebar aria-label="문서">
              <div className="docs__brand"><span className="docs__logo" aria-hidden="true" /><div><b>Satin Glass</b><small>React UI · 0.3</small></div>
                {narrow && <IconButton ref={closeBtn} className="docs__nav-close" icon={<X />} label="메뉴 닫기" onClick={closeNav} />}</div>
              {PAGES.map((p) => {
                const head = p.group !== group ? (group = p.group) : null;
                return (
                  <div key={p.id} style={{ display: 'contents' }}>
                    {head && <SidebarSection>{head}</SidebarSection>}
                    <SidebarItem href={`#/${p.id}`} icon={<p.icon />} selected={p.id === current.id} onClick={closeNav}>{p.label}</SidebarItem>
                  </div>
                );
              })}
            </Sidebar>
          </div>
          <div className="docs__scrim" aria-hidden="true" onClick={closeNav} />
          <main className="docs__main">
            <div className="docs__top">
              <IconButton ref={menuBtn} className="docs__menu-btn" variant="glass" icon={<MenuIcon />} label="메뉴" aria-expanded={navOpen} aria-controls="docs-nav" onClick={() => setNavOpen((v) => !v)} />
              {/* wide: every display setting in one bar; narrow: one button opens them all (nothing is hidden) */}
              <Glass className="docs__settings docs__settings--bar" style={{ borderRadius: 'var(--sg-radius-lg)' }}>
                <DisplaySettingsBar />
              </Glass>
              <IconButton ref={setSetBtn} className="docs__settings-btn" variant="glass" icon={<SlidersHorizontal />} label="표시 설정" aria-expanded={setOpen} onClick={() => setSetOpen((v) => !v)} />
              <Popover open={setOpen} onClose={() => setSetOpen(false)} anchor={setBtn} placement="bottom-end" aria-label="표시 설정">
                <div style={{ width: 300 }}><DisplaySettingsList header="표시 설정" /></div>
              </Popover>
            </div>
            <Current />
          </main>
        </div>
      </Toaster>
    </ThemeProvider>
    </DisplaySettingsProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
