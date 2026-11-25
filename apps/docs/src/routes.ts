/* Every docs page once: its hash, its name in both languages, its sidebar group and how to load it. The sidebar,
   the router and the e2e page lists read this; pages load when first opened. Hashes never change (links and tests
   use them); a page that moves keeps its old hash as an alias. */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  Layers, Palette, Type, Waves, Sparkles, MousePointerClick, TextCursorInput, Navigation as NavIcon, List as ListIcon, PanelTop, Smartphone,
  FlaskConical, ListChecks, Bot, GalleryVerticalEnd, LayoutDashboard, Gauge, Table2, ChartLine, MessageSquareWarning, Rocket, SwatchBook, Accessibility,
  type LucideIcon,
} from 'lucide-react';
import type { Pair } from './i18n';

export type GroupId = 'guides' | 'foundations' | 'components' | 'data' | 'examples';
export const GROUPS: Record<GroupId, Pair> = {
  guides: { en: 'Guides', ko: '가이드' },
  foundations: { en: 'Foundations', ko: '기초' },
  components: { en: 'Components', ko: '컴포넌트' },
  data: { en: 'Data', ko: '데이터' },
  examples: { en: 'Examples', ko: '예제' },
};

export type Route = { id: string; label: Pair; group: GroupId; icon: LucideIcon; el: LazyExoticComponent<ComponentType>; aliases?: string[] };

/* a named export of a page module, loaded on first use */
const page = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
const foundations = () => import('./pages/foundations');
const components = () => import('./pages/components');

export const ROUTES: Route[] = [
  { id: 'start', label: { en: 'Getting started', ko: '시작하기' }, group: 'guides', icon: Rocket, el: page(() => import('./pages/guides'), 'GettingStarted') },
  { id: 'theming', label: { en: 'Theming', ko: '테마' }, group: 'guides', icon: SwatchBook, el: page(() => import('./pages/guides'), 'Theming') },
  { id: 'a11y', label: { en: 'Accessibility', ko: '접근성' }, group: 'guides', icon: Accessibility, el: page(() => import('./pages/guides'), 'Accessibility') },
  { id: 'overview', label: { en: 'Introduction', ko: '소개' }, group: 'foundations', icon: Layers, el: page(foundations, 'Overview') },
  { id: 'material', label: { en: 'Material', ko: '재질' }, group: 'foundations', icon: Sparkles, el: page(foundations, 'Material') },
  { id: 'colors', label: { en: 'Colour', ko: '색' }, group: 'foundations', icon: Palette, el: page(foundations, 'Colors') },
  { id: 'type', label: { en: 'Typography', ko: '타이포그래피' }, group: 'foundations', icon: Type, el: page(foundations, 'Typography') },
  { id: 'motion', label: { en: 'Motion', ko: '모션' }, group: 'foundations', icon: Waves, el: page(foundations, 'Motion') },
  { id: 'buttons', label: { en: 'Buttons', ko: '버튼' }, group: 'components', icon: MousePointerClick, el: page(components, 'Buttons') },
  { id: 'inputs', label: { en: 'Inputs', ko: '입력' }, group: 'components', icon: TextCursorInput, el: page(components, 'Inputs') },
  { id: 'selection', label: { en: 'Selection', ko: '선택' }, group: 'components', icon: ListChecks, el: page(() => import('./pages/selection'), 'Selection') },
  { id: 'navigation', label: { en: 'Navigation', ko: '내비게이션' }, group: 'components', icon: NavIcon, el: page(components, 'Navigation') },
  { id: 'lists', label: { en: 'Lists and display', ko: '목록과 표시' }, group: 'components', icon: ListIcon, el: page(components, 'Lists') },
  { id: 'feedback', label: { en: 'Status and feedback', ko: '상태와 피드백' }, group: 'components', icon: MessageSquareWarning, el: page(() => import('./pages/feedback'), 'FeedbackPage') },
  { id: 'overlays', label: { en: 'Overlays', ko: '오버레이' }, group: 'components', icon: PanelTop, el: page(components, 'Overlays') },
  { id: 'display', label: { en: 'Layout and media', ko: '레이아웃과 미디어' }, group: 'components', icon: GalleryVerticalEnd, el: page(() => import('./pages/display'), 'Display') },
  { id: 'table', label: { en: 'Tables', ko: '표' }, group: 'data', icon: Table2, el: page(() => import('./pages/table'), 'TablePage') },
  { id: 'charts', label: { en: 'Charts and measures', ko: '차트와 지표' }, group: 'data', icon: ChartLine, el: page(() => import('./pages/charts'), 'ChartsPage') },
  { id: 'showcase', label: { en: 'Showcase', ko: '쇼케이스' }, group: 'examples', icon: Smartphone, el: page(() => import('./pages/showcase'), 'Showcase') },
  { id: 'dashboard', label: { en: 'Dashboard', ko: '대시보드' }, group: 'examples', icon: LayoutDashboard, el: page(() => import('./pages/dashboard'), 'Dashboard') },
  { id: 'evaluation', label: { en: 'Model evaluation', ko: '모델 평가' }, group: 'examples', icon: Gauge, el: page(() => import('./pages/evaluation'), 'Evaluation') },
  { id: 'lab', label: { en: 'Edge-case lab', ko: '예외 상황 랩' }, group: 'examples', icon: FlaskConical, el: page(() => import('./pages/lab'), 'Lab') },
  /* @satin-glass/a2ui, experimental and unpublished (#62) */
  { id: 'a2ui', label: { en: 'A2UI', ko: 'A2UI' }, group: 'examples', icon: Bot, el: page(() => import('./pages/a2ui'), 'A2ui') },
];

/* a hash is the page, then an optional sub-page: #/table, #/table/api */
export const routeFor = (hash: string) => { const id = hash.split('/')[0]; return ROUTES.find((r) => r.id === id || r.aliases?.includes(id)); };
