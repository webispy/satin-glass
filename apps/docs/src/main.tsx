import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@glass-layer/react/styles.css';
import './docs.css';
import { ThemeProvider, createTheme, Sidebar, SidebarItem, SidebarSection, Glass, SegmentedControl, Switch, IconButton, Toaster, type ThemeMode } from '@glass-layer/react';
import { Layers, Palette, Type, Waves, Sparkles, MousePointerClick, TextCursorInput, Navigation as NavIcon, List as ListIcon, PanelTop, Smartphone, Menu as MenuIcon } from 'lucide-react';
import { Overview, Colors, Typography, Motion, Material } from './pages/foundations';
import { Buttons, Inputs, Navigation, Lists, Overlays } from './pages/components';
import { Showcase } from './pages/showcase';

const PAGES = [
  { id: 'overview', label: '소개', icon: Layers, el: Overview, group: '기초' },
  { id: 'material', label: '재질', icon: Sparkles, el: Material, group: '기초' },
  { id: 'colors', label: '색', icon: Palette, el: Colors, group: '기초' },
  { id: 'type', label: '타이포그래피', icon: Type, el: Typography, group: '기초' },
  { id: 'motion', label: '모션', icon: Waves, el: Motion, group: '기초' },
  { id: 'buttons', label: '버튼', icon: MousePointerClick, el: Buttons, group: '컴포넌트' },
  { id: 'inputs', label: '입력', icon: TextCursorInput, el: Inputs, group: '컴포넌트' },
  { id: 'navigation', label: '내비게이션', icon: NavIcon, el: Navigation, group: '컴포넌트' },
  { id: 'lists', label: '목록과 표시', icon: ListIcon, el: Lists, group: '컴포넌트' },
  { id: 'overlays', label: '오버레이', icon: PanelTop, el: Overlays, group: '컴포넌트' },
  { id: 'showcase', label: '쇼케이스', icon: Smartphone, el: Showcase, group: '예제' },
];

function useHash() {
  const read = () => location.hash.replace(/^#\/?/, '') || 'overview';
  const [h, setH] = useState(read);
  useEffect(() => { const on = () => setH(read()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return h;
}

function App() {
  const page = useHash();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [hc, setHc] = useState(false);
  const [rt, setRt] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const theme = useMemo(() => createTheme({ mode, contrast: hc ? 'more' : 'standard', reduceTransparency: rt }), [mode, hc, rt]);
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const Current = current.el;
  useEffect(() => { scrollTo(0, 0); setNavOpen(false); }, [page]);
  let group = '';
  return (
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
              <Glass className="docs__settings" style={{ borderRadius: 'var(--gl-radius-lg)' }}>
                <SegmentedControl size="sm" aria-label="화면 모드" value={mode} onChange={setMode} options={[{ value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }, { value: 'system', label: '시스템' }]} />
                <label>고대비 <Switch size="sm" checked={hc} onChange={setHc} aria-label="고대비" /></label>
                <label className="hide-sm">투명도 줄이기 <Switch size="sm" checked={rt} onChange={setRt} aria-label="투명도 줄이기" /></label>
              </Glass>
            </div>
            <Current />
          </main>
        </div>
      </Toaster>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
