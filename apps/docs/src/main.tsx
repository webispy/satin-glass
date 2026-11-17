import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@glass-layer/react/styles.css';
import './docs.css';
import { ThemeProvider, createTheme, Sidebar, SidebarItem, SidebarSection, Glass, IconButton, Popover, Toaster, type ThemeMode } from '@glass-layer/react';
import { DisplaySettingsProvider, DisplaySettingsBar, DisplaySettingsList } from './settings';
import type { MotionName } from '@glass-layer/tokens';
import { Layers, Palette, Type, Waves, Sparkles, MousePointerClick, TextCursorInput, Navigation as NavIcon, List as ListIcon, PanelTop, Smartphone, Menu as MenuIcon, SlidersHorizontal, FlaskConical, ListChecks, GalleryVerticalEnd } from 'lucide-react';
import { Overview, Colors, Typography, Motion, Material } from './pages/foundations';
import { Buttons, Inputs, Navigation, Lists, Overlays } from './pages/components';
import { Showcase } from './pages/showcase';
import { Lab } from './pages/lab';
import { Selection } from './pages/selection';
import { Display } from './pages/display';

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
  { id: 'overlays', label: '오버레이', icon: PanelTop, el: Overlays, group: '컴포넌트' },
  { id: 'display', label: '구성과 미디어', icon: GalleryVerticalEnd, el: Display, group: '컴포넌트' },
  { id: 'showcase', label: '쇼케이스', icon: Smartphone, el: Showcase, group: '예제' },
  { id: 'lab', label: '예외 상황 랩', icon: FlaskConical, el: Lab, group: '예제' },
];

function useHash() {
  const read = () => location.hash.replace(/^#\/?/, '') || 'overview';
  const [h, setH] = useState(read);
  useEffect(() => { const on = () => setH(read()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return h;
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
  let group = '';
  return (
    <DisplaySettingsProvider value={display}>
    <ThemeProvider theme={theme} style={{ minHeight: '100vh' }}>
      <Toaster>
        <div className="docs" data-nav-open={navOpen}>
          <div className="docs__nav">
            <Sidebar aria-label="문서">
              <div className="docs__brand"><span className="docs__logo" aria-hidden="true" /><div><b>Glass Layer</b><small>React UI · 0.1</small></div></div>
              {PAGES.map((p) => {
                const head = p.group !== group ? (group = p.group) : null;
                return (
                  <div key={p.id} style={{ display: 'contents' }}>
                    {head && <SidebarSection>{head}</SidebarSection>}
                    <SidebarItem href={`#/${p.id}`} icon={<p.icon />} selected={p.id === current.id}>{p.label}</SidebarItem>
                  </div>
                );
              })}
            </Sidebar>
          </div>
          <main className="docs__main">
            <div className="docs__top">
              <IconButton className="docs__menu-btn" variant="glass" icon={<MenuIcon />} label="메뉴" onClick={() => setNavOpen((v) => !v)} />
              {/* wide: every display setting in one bar; narrow: one button opens them all (nothing is hidden) */}
              <Glass className="docs__settings docs__settings--bar" style={{ borderRadius: 'var(--gl-radius-lg)' }}>
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
