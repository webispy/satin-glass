import { useEffect, useRef, useState } from 'react';
import {
  ActionSheet, AppBar, Avatar, AvatarGroup, Badge, Drawer, Select, BadgeAnchor, Button, ButtonGroup, Card, CardBody, Chip, ContextMenu, Dialog, Glass,
  ChoiceList, IconButton, List, ListItem, ListSection, Menu, MenuItem, MenuLabel, MenuSeparator, NavigationPage, NavigationStack, PageControl, Pagination, Popover, Progress, SearchField,
  SegmentedControl, Sheet, Sidebar, SidebarItem, SidebarSection, Slider, Spinner, Stack, Stepper, Switch, Tab, TabBar, TabBarAction,
  Tabs, Text, TextField, Timeline, TimelineItem, useNavigation, useToast,
} from '@satin-glass/react';
import {
  Bell, Bike, Bookmark, Car, ChevronLeft, Copy, Download, Footprints, Heart, Home, Map, MoreHorizontal, Moon, Pencil, Plus, Search,
  Settings, Share, Star, Trash2, User, Wifi, Sun, Monitor, Lock, KeyRound, Smartphone, Laptop, ShieldCheck, Mail, Plane, MapPin, Compass, Info, ShoppingBag, Package, MessageSquare, BarChart3,
} from 'lucide-react';
import { Demo, Page, Photo, Section, Usage } from '../shared';
import { L, useT } from '../i18n';
import ButtonsVariants from '../examples/buttons-variants';
import buttonsVariantsSrc from '../examples/buttons-variants?raw';
import ButtonsIcon from '../examples/buttons-icon';
import buttonsIconSrc from '../examples/buttons-icon?raw';
import InputsTextField from '../examples/inputs-textfield';
import inputsTextFieldSrc from '../examples/inputs-textfield?raw';
import InputsControls from '../examples/inputs-controls';
import inputsControlsSrc from '../examples/inputs-controls?raw';
import InputsSegmented from '../examples/inputs-segmented';
import inputsSegmentedSrc from '../examples/inputs-segmented?raw';
import NavigationTabBar from '../examples/navigation-tabbar';
import navigationTabBarSrc from '../examples/navigation-tabbar?raw';
import NavigationSidebar from '../examples/navigation-sidebar';
import navigationSidebarSrc from '../examples/navigation-sidebar?raw';
import NavigationTabs from '../examples/navigation-tabs';
import navigationTabsSrc from '../examples/navigation-tabs?raw';
import NavigationPagination from '../examples/navigation-pagination';
import navigationPaginationSrc from '../examples/navigation-pagination?raw';
import ListsSettings from '../examples/lists-settings';
import listsSettingsSrc from '../examples/lists-settings?raw';
import ListsCard from '../examples/lists-card';
import listsCardSrc from '../examples/lists-card?raw';
import ListsAvatarGroup from '../examples/lists-avatar-group';
import listsAvatarGroupSrc from '../examples/lists-avatar-group?raw';
import OverlaysMenu from '../examples/overlays-menu';
import overlaysMenuSrc from '../examples/overlays-menu?raw';
import OverlaysDialog from '../examples/overlays-dialog';
import overlaysDialogSrc from '../examples/overlays-dialog?raw';
import OverlaysDrawer from '../examples/overlays-drawer';
import overlaysDrawerSrc from '../examples/overlays-drawer?raw';
import OverlaysToast from '../examples/overlays-toast';
import overlaysToastSrc from '../examples/overlays-toast?raw';

/* ================================================================================================ Buttons */
export function Buttons() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  return (
    <Page title={t({ en: 'Buttons', ko: '버튼' })} api={['Button', 'IconButton', 'ButtonGroup']} intro={<L
      en="Filled, tinted (the default), glass, plain and neutral. A button sinks slightly when pressed (to 0.965×), and a glass button gathers light under the finger."
      ko="채움(filled) · 틴트(tinted, 기본) · 유리(glass) · 평면(plain) · 중립(neutral). 누르면 살짝 들어가고(0.965배), 유리 버튼은 손가락 아래로 빛이 모입니다." />}>
      <Section title={t({ en: 'Variants', ko: '변형' })}>
        <Demo>
          <Button variant="filled">{t({ en: 'Continue', ko: '계속' })}</Button>
          <Button>{t({ en: 'Save', ko: '저장' })}</Button>
          <Button variant="glass">{t({ en: 'Share', ko: '공유' })}</Button>
          <Button variant="plain">{t({ en: 'Cancel', ko: '취소' })}</Button>
          <Button variant="neutral">{t({ en: 'Archive', ko: '보관' })}</Button>
          <Button variant="filled" tone="danger" startIcon={<Trash2 />}>{t({ en: 'Delete', ko: '삭제' })}</Button>
          <Button variant="tinted" tone="danger">{t({ en: 'Reset', ko: '초기화' })}</Button>
        </Demo>
        <Usage example={ButtonsVariants} code={buttonsVariantsSrc} />
      </Section>
      <Section title={t({ en: 'Sizes and states', ko: '크기와 상태' })}>
        <Demo>
          <Button size="sm" variant="filled">{t({ en: 'Small', ko: '작게' })}</Button>
          <Button variant="filled">{t({ en: 'Medium', ko: '보통' })}</Button>
          <Button size="lg" variant="filled">{t({ en: 'Large', ko: '크게' })}</Button>
          <Button variant="filled" loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>{t({ en: 'Download', ko: '다운로드' })}</Button>
          <Button variant="filled" disabled>{t({ en: 'Disabled', ko: '비활성' })}</Button>
          <Button variant="tinted" startIcon={<Plus />} shape="round">{t({ en: 'Add', ko: '추가' })}</Button>
        </Demo>
      </Section>
      <Section title={t({ en: 'Icon buttons and groups', ko: '아이콘 버튼과 그룹' })} intro={<L
        en="Icon buttons are rounded squares by default; shape=&quot;round&quot; makes them circles. A group shares one piece of glass, so glass never sits on glass."
        ko="아이콘 버튼은 둥근 사각형이 기본이고, 원형은 shape=&quot;round&quot;입니다. 그룹은 유리 한 장을 나눠 씁니다. 유리 위에 유리를 겹치지 않습니다." />}>
        <Demo media>
          <Photo scene={3} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <IconButton variant="glass" icon={<ChevronLeft />} label={t({ en: 'Back', ko: '뒤로' })} />
            <ButtonGroup><IconButton icon={<Share />} label={t({ en: 'Share', ko: '공유' })} /><IconButton icon={<Heart />} label={t({ en: 'Like', ko: '좋아요' })} /><IconButton icon={<MoreHorizontal />} label={t({ en: 'More', ko: '더 보기' })} /></ButtonGroup>
            <IconButton variant="glass" shape="round" icon={<Plus />} label={t({ en: 'Add', ko: '추가' })} />
            <Button variant="glass">{t({ en: 'Edit', ko: '편집' })}</Button>
          </div>
        </Demo>
        <Usage example={ButtonsIcon} code={buttonsIconSrc} />
      </Section>
    </Page>
  );
}

/* ================================================================================================ Inputs */
export function Inputs() {
  const t = useT();
  const [wifi, setWifi] = useState(true);
  const [vol, setVol] = useState(60);
  const [guests, setGuests] = useState(2);
  const [view, setView] = useState('map');
  const [tags, setTags] = useState<string[]>(['hike']);
  const [name, setName] = useState('');
  return (
    <Page title={t({ en: 'Inputs', ko: '입력' })} api={['TextField', 'SearchField', 'Switch', 'Slider', 'Stepper', 'SegmentedControl', 'Chip', 'SegmentOption']} intro={<L
      en="Text fields, switches, sliders, steppers, segmented controls and chips. Each works controlled (value/onChange) or uncontrolled (defaultValue), except that a switch uses checked/defaultChecked and a toggle chip is always controlled (selected/onSelectedChange)."
      ko="텍스트 필드, 스위치, 슬라이더, 스테퍼, 세그먼트, 칩입니다. 모두 제어(value/onChange)와 비제어(defaultValue) 방식을 함께 지원합니다. 단, 스위치는 checked/defaultChecked를 쓰고, 토글 칩은 항상 제어 방식(selected/onSelectedChange)입니다." />}>
      <Section title={t({ en: 'Text fields', ko: '텍스트 필드' })}>
        <div className="grid grid--2">
          <Demo col>
            <TextField label={t({ en: 'Place name', ko: '장소 이름' })} placeholder={t({ en: 'e.g. Heron Point', ko: '예: 헤론 포인트' })} value={name} onChange={(e) => setName(e.target.value)} clearable onClear={() => setName('')} helperText={t({ en: 'Shown on the map and in lists', ko: '지도와 목록에 보이는 이름' })} />
            <TextField label={t({ en: 'Email', ko: '이메일' })} type="email" defaultValue="hello@" error={t({ en: 'Enter a valid email address', ko: '이메일 형식이 아니에요' })} />
          </Demo>
          <Demo col>
            <SearchField placeholder={t({ en: 'Search places or addresses', ko: '장소, 주소 검색' })} onCancel={() => {}} />
            <TextField label={t({ en: 'Notes', ko: '메모' })} multiline placeholder={t({ en: 'Directions, parking…', ko: '가는 길, 주차 정보…' })} />
          </Demo>
        </div>
        <Usage example={InputsTextField} code={inputsTextFieldSrc} />
      </Section>
      <Section title={t({ en: 'Switch · slider · stepper', ko: '스위치 · 슬라이더 · 스테퍼' })} intro={<L
        en="While pressed, a switch's thumb stretches towards where it will go, and dragging the thumb turns it on or off. Grabbing a slider shows its value in a glass bubble."
        ko="스위치는 누르는 동안 손잡이가 움직일 쪽으로 늘어나고, 손잡이를 끌어서 켜고 끌 수도 있습니다. 슬라이더는 잡으면 유리 말풍선에 값이 뜹니다." />}>
        <Demo col>
          <div className="label-row"><Text>Wi‑Fi</Text><Switch checked={wifi} onChange={setWifi} aria-label="Wi‑Fi" /></div>
          <div className="label-row"><Text>{t({ en: 'Offline maps', ko: '오프라인 지도' })}</Text><Switch defaultChecked={false} aria-label={t({ en: 'Offline maps', ko: '오프라인 지도' })} /></div>
          <div className="label-row" style={{ gap: 24 }}><Text style={{ flex: 'none' }}>{t({ en: 'Distance', ko: '거리' })}</Text><Slider value={vol} onChange={setVol} format={(v) => `${v} km`} aria-label={t({ en: 'Distance', ko: '거리' })} style={{ flex: 1, maxWidth: 360 }} /></div>
          <div className="label-row"><Text>{t({ en: 'Guests', ko: '인원' })}</Text><Stepper value={guests} onChange={setGuests} min={1} max={12} label={t({ en: 'Guests', ko: '인원' })} format={(v) => t({ en: v === 1 ? '1 guest' : `${v} guests`, ko: `${v}명` })} /></div>
        </Demo>
        <Usage example={InputsControls} code={inputsControlsSrc} />
      </Section>
      <Section title={t({ en: 'Segmented control', ko: '세그먼트' })} intro={<L
        en="The selection stretches like a droplet into the next segment, then gathers there. Dragging chooses too."
        ko="선택 표시가 물방울처럼 늘어나 다음 칸까지 이어졌다가 모입니다. 끌어서 선택할 수도 있습니다." />}>
        <Demo col>
          <SegmentedControl aria-label={t({ en: 'View', ko: '보기' })} value={view} onChange={setView} options={[{ value: 'map', label: t({ en: 'Map', ko: '지도' }) }, { value: 'list', label: t({ en: 'List', ko: '목록' }) }, { value: 'photo', label: t({ en: 'Photos', ko: '사진' }) }, { value: 'saved', label: t({ en: 'Saved', ko: '저장됨' }) }]} />
          <SegmentedControl size="sm" aria-label={t({ en: 'Travel mode', ko: '이동 수단' })} defaultValue="walk" options={[{ value: 'walk', label: t({ en: 'Walk', ko: '도보' }), icon: <Footprints /> }, { value: 'bike', label: t({ en: 'Cycle', ko: '자전거' }), icon: <Bike /> }, { value: 'car', label: t({ en: 'Drive', ko: '자동차' }), icon: <Car /> }]} style={{ maxWidth: 340 }} />
        </Demo>
        <Usage example={InputsSegmented} code={inputsSegmentedSrc} />
      </Section>
      <Section title={t({ en: 'Chips', ko: '칩' })}>
        <Demo>
          {t({
            en: [['hike', 'Hiking'], ['beach', 'Beach'], ['camp', 'Camping'], ['city', 'City'], ['view', 'Views']],
            ko: [['hike', '하이킹'], ['beach', '바다'], ['camp', '캠핑'], ['city', '도시'], ['view', '전망']],
          }).map(([k, l]) => (
            <Chip key={k} selected={tags.includes(k)} onSelectedChange={(on) => setTags((t) => (on ? [...t, k] : t.filter((x) => x !== k)))}>{l}</Chip>
          ))}
          <Chip icon={<MapPin />} onRemove={() => {}}>{t({ en: 'Seoul', ko: '서울' })}</Chip>
        </Demo>
      </Section>
    </Page>
  );
}

/* ================================================================================================ Navigation */
export function Navigation() {
  const t = useT();
  const [tab, setTab] = useState('home');
  const [page, setPage] = useState(1);
  const [side, setSide] = useState('all');
  const [section, setSection] = useState('orders');
  const [pg, setPg] = useState(6);
  const pageLabels = { previous: t({ en: 'Previous page', ko: '이전 페이지' }), next: t({ en: 'Next page', ko: '다음 페이지' }), page: (n: number) => t({ en: `Page ${n}`, ko: `${n} 페이지` }) };
  return (
    <Page title={t({ en: 'Navigation', ko: '내비게이션' })} api={['TabBar', 'TabBarAction', 'Tabs', 'Pagination', 'AppBar', 'Sidebar', 'SidebarItem', 'SidebarSection', 'PageControl']} intro={<L
      en="Floating glass bars, held 12 px off the screen edge with a fixed 22 px corner radius. Tabs divide a page into sections; pagination divides a long list."
      ko="떠 있는 유리 바입니다. 화면 가장자리에서 12px 띄우고, 모서리는 고정 반경 22px입니다. 페이지 안의 구역은 탭으로, 긴 목록은 페이지네이션으로 나눕니다." />}>
      <Section title={t({ en: 'Tab bar', ko: '탭 바' })} intro={<L
        en="On a tap, the selection stretches like a droplet and gathers on the new tab, never leaving the bar. With draggable it follows a finger dragged along the bar, and releasing selects the tab under the finger. draggable is off by default, so tabs are selected by tapping; this example turns it on."
        ko="탭하면 선택 표시가 물방울처럼 늘어나 이어졌다가 새 탭에서 모입니다. 표시는 바 안에만 머뭅니다. draggable을 주면 바 위를 끌 때 손가락을 따라가고, 손을 뗀 자리의 탭이 선택됩니다. 기본은 꺼져 있어 탭해서 선택하며, 이 예시에서는 draggable을 켰습니다." />}>
        <Demo media style={{ padding: 0, minHeight: 220 }}>
          <Photo scene={0} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, maxWidth: 460, margin: '0 auto' }}>
            <TabBar draggable value={tab} onChange={setTab} aria-label={t({ en: 'Main', ko: '메인' })} action={<TabBarAction icon={<Search />} label={t({ en: 'Search', ko: '검색' })} />}>
              <Tab value="home" label={t({ en: 'Home', ko: '홈' })} icon={<Home />} />
              <Tab value="map" label={t({ en: 'Map', ko: '지도' })} icon={<Map />} />
              <Tab value="saved" label={t({ en: 'Saved', ko: '저장' })} icon={<Bookmark />} badge={<Badge>3</Badge>} />
              <Tab value="me" label={t({ en: 'Me', ko: '나' })} icon={<User />} />
            </TabBar>
          </div>
        </Demo>
        <Text variant="footnote" tone="tertiary" style={{ marginTop: 8 }}>{t({ en: 'Selected: ', ko: '선택: ' })}{tab}</Text>
        <Usage example={NavigationTabBar} code={navigationTabBarSrc} />
      </Section>
      <Section title={t({ en: 'App bar', ko: '앱 바' })}>
        <Demo media style={{ padding: 0, minHeight: 160, alignItems: 'flex-start' }}>
          <Photo scene={4} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative', width: '100%', color: 'var(--sg-label)' }}>
            <AppBar title={t({ en: 'Favourites', ko: '즐겨찾기' })} leading={<IconButton icon={<ChevronLeft />} label={t({ en: 'Back', ko: '뒤로' })} />} trailing={<><IconButton icon={<Share />} label={t({ en: 'Share', ko: '공유' })} /><IconButton icon={<Plus />} label={t({ en: 'Add', ko: '추가' })} /></>} style={{ position: 'relative' }} />
          </div>
        </Demo>
      </Section>
      <Section title={t({ en: 'Sidebar · page control', ko: '사이드바 · 페이지 컨트롤' })}>
        <div className="grid grid--2">
          <Demo media style={{ padding: 12, minHeight: 300 }}>
            <Photo scene={2} style={{ position: 'absolute', inset: 0 }} />
            <Sidebar style={{ position: 'relative', height: 276, width: 240, color: 'var(--sg-label)' }}>
              <SidebarSection>{t({ en: 'Library', ko: '라이브러리' })}</SidebarSection>
              <SidebarItem icon={<Compass />} selected={side === 'all'} count={24} onClick={() => setSide('all')}>{t({ en: 'All places', ko: '모든 장소' })}</SidebarItem>
              <SidebarItem icon={<Star />} selected={side === 'fav'} count={7} onClick={() => setSide('fav')}>{t({ en: 'Favourites', ko: '즐겨찾기' })}</SidebarItem>
              <SidebarItem icon={<Plane />} selected={side === 'trip'} count={3} onClick={() => setSide('trip')}>{t({ en: 'Trips', ko: '여행' })}</SidebarItem>
              <SidebarSection>{t({ en: 'Settings', ko: '설정' })}</SidebarSection>
              <SidebarItem icon={<Settings />} selected={side === 'set'} onClick={() => setSide('set')}>{t({ en: 'Preferences', ko: '환경설정' })}</SidebarItem>
            </Sidebar>
          </Demo>
          <Demo col center>
            <Stack align="center" gap={4}>
              <PageControl count={5} page={page} onChange={setPage} />
              <PageControl count={5} page={page} onChange={setPage} glass />
              <Text variant="footnote" tone="tertiary">{t({ en: 'Drag along the dots to turn pages quickly · ', ko: '점을 따라 끌면 페이지를 빠르게 넘깁니다 · ' })}{page + 1}/5</Text>
            </Stack>
          </Demo>
        </div>
        <Usage example={NavigationSidebar} code={navigationSidebarSrc} />
      </Section>
      <Section title={t({ en: 'Tabs', ko: '탭' })} intro={<L
        en="Tabs divide one page into sections. The underline is the same droplet as the tab bar's and the segmented control's, and moves the same way. Moving focus with the arrow keys selects at once (for manual selection, set activation=&quot;manual&quot;), and the new panel slides in from the side focus moved towards. A heavy panel is drawn a moment later, so the tab responds without a hitch."
        ko="한 페이지 안의 구역을 나눕니다. 밑줄은 탭 바·세그먼트와 같은 물방울이라 같은 방식으로 이동합니다. 방향키로 포커스를 옮기면 바로 선택되고(수동으로 하려면 activation=&quot;manual&quot;), 새 패널은 이동한 쪽에서 들어옵니다. 내용이 무거운 패널은 탭을 누른 직후의 반응이 끊기지 않도록 뒤로 미뤄 그립니다." />}>
        <Demo col data-demo="tabs">
          <Tabs aria-label={t({ en: 'Store admin', ko: '스토어 관리' })} value={section} onChange={setSection} items={[
            { value: 'orders', label: t({ en: 'Orders', ko: '주문' }), icon: <ShoppingBag />, badge: 12, content: <Text variant="subhead" tone="secondary">{t({ en: '12 new orders are waiting to be confirmed.', ko: '새 주문 12건이 확인을 기다려요.' })}</Text> },
            { value: 'products', label: t({ en: 'Products', ko: '상품' }), icon: <Package />, content: <Text variant="subhead" tone="secondary">{t({ en: '22 products listed, 2 hidden.', ko: '공개한 상품 22개, 숨긴 상품 2개.' })}</Text> },
            { value: 'reviews', label: t({ en: 'Reviews', ko: '후기' }), icon: <MessageSquare />, content: <Text variant="subhead" tone="secondary">{t({ en: '48 reviews this week, 4.6 on average.', ko: '이번 주 후기 48개, 평균 4.6점.' })}</Text> },
            { value: 'stats', label: t({ en: 'Stats', ko: '통계' }), icon: <BarChart3 />, content: <Text variant="subhead" tone="secondary">{t({ en: 'Visits and sales over time are on the Charts and measures page.', ko: '방문과 매출 흐름은 차트와 지표 페이지에서 볼 수 있어요.' })}</Text> },
            { value: 'settle', label: t({ en: 'Payouts', ko: '정산' }), disabled: true },
          ]} />
        </Demo>
        <Demo col data-demo="tabs-many" style={{ marginTop: 16 }}>
          <Text variant="subhead" tone="secondary"><L
            en="With many tabs the row scrolls sideways, and the edge fades on the side where tabs are hidden. The selected tab is always scrolled into view."
            ko="탭이 많으면 줄이 가로로 스크롤되고, 가려진 탭이 있는 쪽 끝이 흐려집니다. 선택한 탭은 항상 보이는 곳까지 스크롤됩니다." /></Text>
          <div style={{ maxWidth: 420 }}>
            <Tabs aria-label={t({ en: 'Categories', ko: '분류' })} activation="manual" defaultValue="digital" items={t({
              en: ['All', 'Clothing', 'Home', 'Kitchen', 'Stationery', 'Digital', 'Pets', 'Camping', 'Gift wrap', 'On sale'],
              ko: ['전체', '의류', '생활', '주방', '문구', '디지털', '반려동물', '캠핑', '선물 포장', '할인 중'],
            }).map((l, i) => ({ value: ['all', 'wear', 'home', 'kitchen', 'paper', 'digital', 'pet', 'camp', 'gift', 'sale'][i], label: l }))} />
          </div>
        </Demo>
        <Demo col data-demo="tabs-pill" style={{ marginTop: 16 }}>
          <Text variant="subhead" tone="secondary"><L
            en="Pill tabs (variant=&quot;pill&quot;) wrap onto new lines when they overflow, so every section is in view at once. Use them on phones when there are many sections. The droplet cannot move between lines, so the selected pill itself becomes the raised surface, and a change of selection is a short transition. Keyboard navigation is the same as for underline tabs."
            ko="필 탭(variant=&quot;pill&quot;)은 넘치면 다음 줄로 넘어가 모든 구역이 한눈에 보입니다. 휴대폰에서 구역이 많을 때 씁니다. 선택 표시(물방울)가 줄을 넘어 이동할 수 없으므로 선택한 필 자체가 볼록한 면이 되고, 선택이 바뀔 때는 짧은 전환 효과를 씁니다. 키보드 조작은 밑줄 탭과 같습니다." /></Text>
          <div style={{ maxWidth: 420 }}>
            <Tabs variant="pill" aria-label={t({ en: 'Benchmark suites', ko: '벤치마크 묶음' })} defaultValue="reason" items={[{ value: 'all', label: t({ en: 'All benchmarks', ko: '모든 벤치마크' }) }, { value: 'know', label: t({ en: 'Knowledge', ko: '지식' }) }, { value: 'reason', label: t({ en: 'Reasoning', ko: '추론' }) }, { value: 'code', label: t({ en: 'Coding', ko: '코딩' }) }, { value: 'inst', label: t({ en: 'Instruction following', ko: '지시 따르기' }) }, { value: 'ko', label: t({ en: 'Korean', ko: '한국어' }) }, { value: 'long', label: t({ en: 'Long context', ko: '긴 문맥' }), disabled: true }]} />
          </div>
        </Demo>
        <Usage example={NavigationTabs} code={navigationTabsSrc} />
      </Section>
      <Section title={t({ en: 'Pagination', ko: '페이지네이션' })} intro={<L
        en="Shows the first and last pages, the current page and its neighbours, and folds the gaps into …. While the current page moves through the middle, the number of buttons stays the same, so the button under the pointer never shifts. In a narrow space it becomes ‘6 / 40’."
        ko="처음과 끝, 현재 페이지와 그 앞뒤 페이지를 보여 주고 사이는 …로 접습니다. 현재 페이지가 가운데 구간에서 바뀌는 동안에는 버튼 개수가 그대로라 포인터 밑의 버튼이 밀리지 않습니다. 좁은 곳에서는 ‘6 / 40’으로 바뀝니다." />}>
        <Demo col data-demo="pagination">
          <Pagination page={pg} pageCount={40} onChange={setPg} aria-label={t({ en: 'Order list pages', ko: '주문 목록 페이지' })} labels={pageLabels} style={{ justifyContent: 'flex-start' }} />
          <Pagination page={pg} pageCount={40} siblings={2} onChange={setPg} aria-label={t({ en: 'Order list pages (2 neighbours)', ko: '주문 목록 페이지 (앞뒤 2개)' })} labels={pageLabels} style={{ justifyContent: 'flex-start' }} />
          <div style={{ width: 220 }}><Pagination page={pg} pageCount={40} onChange={setPg} aria-label={t({ en: 'Order list pages (narrow)', ko: '주문 목록 페이지 (좁게)' })} labels={pageLabels} /></div>
        </Demo>
        <Usage example={NavigationPagination} code={navigationPaginationSrc} />
      </Section>
    </Page>
  );
}

/* ================================================================================================ Lists & display */
/* the settings stack: four pages deep (Settings › Profile › Account security › Change password / Signed-in devices).
   Each page is its own component with its own state; a pushed page is an element, so values it shows come from its
   own state */
type Mode = 'light' | 'dark' | 'system';
function useModes(): Record<Mode, string> {
  const t = useT();
  return { light: t({ en: 'Light', ko: '라이트' }), dark: t({ en: 'Dark', ko: '다크' }), system: t({ en: 'System', ko: '시스템' }) };
}
function SettingsRoot() {
  const t = useT(), modes = useModes();
  const nav = useNavigation();
  const [notif, setNotif] = useState(true);
  const [mode, setMode] = useState<Mode>('system');
  return (
    <NavigationPage title={t({ en: 'Settings', ko: '설정' })} largeTitle>
      <ListSection header={t({ en: 'Account', ko: '계정' })} footer={t({ en: 'Notifications can be set separately on each device.', ko: '알림은 기기마다 따로 설정할 수 있어요.' })}>
        <List>
          <ListItem leading={<User />} tileColor="var(--sg-iris-500)" title={t({ en: 'Profile', ko: '프로필' })} subtitle="hello@example.com" chevron onClick={() => nav.push(<ProfilePage />)} />
          <ListItem leading={<Bell />} tileColor="var(--sg-coral-500)" title={t({ en: 'Notifications', ko: '알림' })} trailing={<Switch checked={notif} onChange={setNotif} aria-label={t({ en: 'Notifications', ko: '알림' })} />} />
          <ListItem leading={<Moon />} tileColor="var(--sg-orchid-600)" title={t({ en: 'Appearance', ko: '화면 모드' })} trailing={modes[mode]} chevron onClick={() => nav.push(<AppearancePage initial={mode} onChange={setMode} />)} />
          <ListItem leading={<Wifi />} tileColor="var(--sg-azure-500)" title={t({ en: 'Offline maps', ko: '오프라인 지도' })} trailing={<Badge tone="accent">NEW</Badge>} chevron onClick={() => nav.push(<OfflineMapsPage />)} />
        </List>
      </ListSection>
      <ListSection>
        <List><ListItem title={t({ en: 'Sign out', ko: '로그아웃' })} tone="danger" onClick={() => {}} /></List>
      </ListSection>
    </NavigationPage>
  );
}
function OfflineMapsPage() {
  const t = useT();
  return (
    <NavigationPage title={t({ en: 'Offline maps', ko: '오프라인 지도' })}><ListSection footer={t({ en: 'Downloaded maps work without a connection.', ko: '내려받은 지도는 연결이 없어도 볼 수 있어요.' })}><List><ListItem title={t({ en: 'Seoul', ko: '서울' })} subtitle="312 MB" /><ListItem title={t({ en: 'Busan', ko: '부산' })} subtitle="188 MB" /></List></ListSection></NavigationPage>
  );
}
function ProfilePage() {
  const t = useT();
  const nav = useNavigation();
  return (
    <NavigationPage title={t({ en: 'Profile', ko: '프로필' })}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 6, paddingTop: 4 }}>
        <Avatar name="Kim Minji" size={72} />
        <Text variant="headline">{t({ en: 'Kim Minji', ko: '김민지' })}</Text>
      </div>
      <ListSection>
        <List>
          <ListItem leading={<Mail />} tileColor="var(--sg-azure-500)" title={t({ en: 'Email', ko: '이메일' })} trailing="hello@example.com" />
          <ListItem leading={<ShieldCheck />} tileColor="var(--sg-jade-600)" title={t({ en: 'Account security', ko: '계정 보안' })} chevron onClick={() => nav.push(<SecurityPage />)} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function SecurityPage() {
  const t = useT();
  const nav = useNavigation();
  const [twoStep, setTwoStep] = useState(true);
  return (
    <NavigationPage title={t({ en: 'Account security', ko: '계정 보안' })}>
      <ListSection footer={t({ en: 'With two-step verification on, signing in on a new device also asks for a code.', ko: '2단계 인증을 켜면 새 기기에서 로그인할 때 확인 코드를 한 번 더 받아요.' })}>
        <List>
          <ListItem leading={<KeyRound />} tileColor="var(--sg-amber-500)" title={t({ en: 'Change password', ko: '비밀번호 변경' })} chevron onClick={() => nav.push(<PasswordPage />)} />
          <ListItem leading={<Lock />} tileColor="var(--sg-slate-500)" title={t({ en: 'Two-step verification', ko: '2단계 인증' })} trailing={<Switch checked={twoStep} onChange={setTwoStep} aria-label={t({ en: 'Two-step verification', ko: '2단계 인증' })} />} />
          <ListItem leading={<Smartphone />} tileColor="var(--sg-iris-500)" title={t({ en: 'Signed-in devices', ko: '로그인한 기기' })} trailing={t({ en: '2', ko: '2대' })} chevron onClick={() => nav.push(<DevicesPage />)} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function PasswordPage() {
  const t = useT();
  const nav = useNavigation();
  return (
    <NavigationPage title={t({ en: 'Change password', ko: '비밀번호 변경' })} trailing={<Button size="sm" variant="plain" onClick={() => nav.popToRoot()}>{t({ en: 'Done', ko: '완료' })}</Button>}>
      <Stack gap={4}>
        <TextField label={t({ en: 'Current password', ko: '현재 비밀번호' })} type="password" />
        <TextField label={t({ en: 'New password', ko: '새 비밀번호' })} type="password" helperText={t({ en: '8 or more characters, mixing numbers and symbols', ko: '8자 이상, 숫자와 기호를 섞어서' })} />
      </Stack>
    </NavigationPage>
  );
}
function DevicesPage() {
  const t = useT();
  return (
    <NavigationPage title={t({ en: 'Signed-in devices', ko: '로그인한 기기' })}>
      <ListSection>
        <List>
          <ListItem leading={<Smartphone />} tileColor="var(--sg-iris-500)" title={t({ en: 'This phone', ko: '이 휴대폰' })} subtitle={t({ en: 'In use now', ko: '지금 사용 중' })} />
          <ListItem leading={<Laptop />} tileColor="var(--sg-slate-500)" title={t({ en: 'Laptop', ko: '노트북' })} subtitle={t({ en: '3 days ago', ko: '3일 전' })} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function AppearancePage({ initial, onChange }: { initial: Mode; onChange: (m: Mode) => void }) {
  const t = useT();
  const [m, setM] = useState(initial);
  return (
    <NavigationPage title={t({ en: 'Appearance', ko: '화면 모드' })}>
      <ChoiceList aria-label={t({ en: 'Appearance', ko: '화면 모드' })} value={m} onChange={(v) => { setM(v); onChange(v); }} options={[
        { value: 'light', label: t({ en: 'Light', ko: '라이트' }), icon: <Sun />, tileColor: 'var(--sg-amber-500)' },
        { value: 'dark', label: t({ en: 'Dark', ko: '다크' }), icon: <Moon />, tileColor: 'var(--sg-iris-700)' },
        { value: 'system', label: t({ en: 'System', ko: '시스템 설정' }), description: t({ en: 'Follows the device setting', ko: '기기 설정을 따라요' }), icon: <Monitor />, tileColor: 'var(--sg-slate-500)' },
      ]} />
    </NavigationPage>
  );
}

export function Lists() {
  const t = useT();
  return (
    <Page title={t({ en: 'Lists and display', ko: '목록과 표시' })} api={['List', 'ListItem', 'ListSection', 'NavigationStack', 'NavigationPage', 'Card', 'CardBody', 'Avatar', 'AvatarGroup', 'Badge', 'BadgeAnchor', 'Progress', 'Spinner']} intro={<L
      en="Grouped lists, cards, avatars, badges and progress indicators."
      ko="그룹 목록, 카드, 아바타, 배지, 진행 표시입니다." />}>
      <div className="grid grid--2">
        <Stack gap={3}>
          <div data-demo="nav-stack">
            <NavigationStack labels={{ back: t({ en: 'Back', ko: '뒤로' }) }} className="settings-stack"><SettingsRoot /></NavigationStack>
          </div>
          <Text variant="footnote" tone="secondary"><L
            en="Pressing a row slides the next page in from the right (Settings › Profile › Account security › Change password, to any depth). The back button at the top left carries the previous page's name, and on touch a swipe from the left edge also goes back. Earlier pages keep their scroll position and state."
            ko="행을 누르면 다음 페이지가 오른쪽에서 들어옵니다(설정 › 프로필 › 계정 보안 › 비밀번호 변경, 깊이 제한 없음). 왼쪽 위 뒤로 버튼에는 이전 페이지의 이름이 붙고, 터치에서는 왼쪽 가장자리에서 밀어도 돌아갑니다. 이전 페이지는 스크롤 위치와 상태를 그대로 유지합니다." /></Text>
        </Stack>
        <Stack gap={4}>
          <Card interactive>
            <Photo scene={1} style={{ height: 150 }} />
            <CardBody><Text variant="headline">{t({ en: 'Sunset Hill', ko: '노을 언덕' })}</Text><Text variant="subhead" tone="secondary">{t({ en: '2.4 km · sunset 6:42 pm today', ko: '2.4 km · 오늘 18:42 일몰' })}</Text></CardBody>
          </Card>
          <Demo>
            <Avatar name="Kim Minji" /><Avatar name="Lee Jun" /><Avatar name="Park Sora" size={32} />
            <BadgeAnchor badge={<Badge>5</Badge>}><IconButton variant="neutral" icon={<Bell />} label={t({ en: 'Notifications', ko: '알림' })} /></BadgeAnchor>
            <BadgeAnchor badge={<Badge dot />}><Avatar name="Choi Yuna" /></BadgeAnchor>
          </Demo>
          <Demo col>
            <Progress value={64} label={t({ en: 'Download', ko: '다운로드' })} />
            <Progress label={t({ en: 'Syncing', ko: '동기화' })} />
            <Stack direction="row" gap={3} align="center"><Spinner /><Text variant="subhead" tone="secondary">{t({ en: 'Loading…', ko: '불러오는 중…' })}</Text></Stack>
          </Demo>
        </Stack>
      </div>
      <Usage title={t({ en: 'Usage: a settings stack with grouped lists', ko: '사용법: 그룹 목록으로 만든 설정 스택' })} example={ListsSettings} code={listsSettingsSrc} />
      <Usage title={t({ en: 'Usage: cards', ko: '사용법: 카드' })} example={ListsCard} code={listsCardSrc} />
      <AvatarGroups />
    </Page>
  );
}

function Drawers() {
  const t = useT();
  const [filters, setFilters] = useState(false);
  const [nav, setNav] = useState(false);
  const [detail, setDetail] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [logs, setLogs] = useState(false);
  /* the old games' console key: ` opens and closes it (not while typing somewhere else) */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]') && !t.closest('.console')) return;
      e.preventDefault(); setConsoleOpen((v) => !v);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  const [confirm, setConfirm] = useState(false);
  /* which confirmation is open: deleting a saved filter, or cancelling the order in the drawer (kept after closing so the title holds while the dialog leaves) */
  const [asking, setAsking] = useState<'filter' | 'order'>('filter');
  const [sort, setSort] = useState<string | null>('new');
  const [open24, setOpen24] = useState(true);
  const [kinds, setKinds] = useState<string[]>(['cafe']);
  const close = t({ en: 'Close', ko: '닫기' });
  return (
    <Section title={t({ en: 'Drawer', ko: '드로어' })} intro={<L
      en="A panel that comes in from an edge of the screen. Side drawers (start, end) take a width; top and bottom drawers are tool panels such as a console or a log, the full width of the screen with a set height. A panel that rises from the bottom for reading or filling in is a sheet. Use a drawer for work that should not leave the current screen: filters beside a list, a detail view, a short form. It is always modal: the screen behind cannot be used and is hidden from screen readers (aria-hidden), and closing it returns focus to the button that opened it. Dragged towards its edge it follows the finger (a top or bottom drawer by its header); past a third of its width (its height, for top and bottom), or with a quick flick, it closes, and short of that it settles back. For a side drawer, side follows the writing direction: 'end' (the default; the right side in left-to-right text) or 'start'. For a side area that stays in view, use Sidebar."
      ko="화면 가장자리에서 들어오는 패널입니다. 옆(start · end)은 폭을 정해 쓰고, 위·아래(top · bottom)는 콘솔이나 로그 같은 도구 패널로 화면 폭 전체에 높이를 정합니다. 아래에서 올라와 내용을 읽거나 채우는 것은 시트입니다. 목록 옆의 필터, 상세 보기, 짧은 입력처럼 지금 화면을 떠나지 않고 할 일에 씁니다. 항상 모달이라 뒤 화면은 조작할 수 없고 스크린 리더에서도 숨겨지며(aria-hidden), 닫으면 드로어를 연 버튼으로 포커스가 돌아갑니다. 가장자리 쪽으로 끌면 손가락을 그대로 따라오고(위·아래 드로어는 헤더를 끌 때), 폭(위·아래는 높이)의 3분의 1을 넘기거나 빠르게 튕기면 닫히며, 덜 끌면 제자리로 돌아옵니다. 옆 드로어의 side는 글 방향을 따라 'end'(기본, 왼쪽에서 오른쪽으로 쓰는 화면의 오른쪽)와 'start'입니다. 계속 보이는 옆 영역은 Sidebar를 씁니다." />}>
      <Demo data-demo="drawer">
        <Button variant="filled" onClick={() => setFilters(true)}>{t({ en: 'Open filters', ko: '필터 열기' })}</Button>
        <Button variant="tinted" onClick={() => setNav(true)}>{t({ en: 'Menu (start)', ko: '메뉴 (start)' })}</Button>
        <Button variant="neutral" onClick={() => setDetail(true)}>{t({ en: 'Order details (wide)', ko: '주문 상세 (넓게)' })}</Button>
        <Button variant="neutral" onClick={() => setConsoleOpen(true)}>{t({ en: 'Console (top, ` key)', ko: '콘솔 (top, ` 키)' })}</Button>
        <Button variant="neutral" onClick={() => setLogs(true)}>{t({ en: 'Logs (bottom, resizable)', ko: '로그 보기 (bottom, 크기 조절)' })}</Button>
      </Demo>
      <Usage example={OverlaysDrawer} code={overlaysDrawerSrc} />
      <Drawer open={filters} onClose={() => setFilters(false)} title={t({ en: 'Filters', ko: '필터' })} labels={{ close }}
        trailing={<Button size="sm" variant="plain" onClick={() => { setSort('new'); setOpen24(true); setKinds(['cafe']); }}>{t({ en: 'Reset', ko: '초기화' })}</Button>}>
        <Stack gap={5}>
          <Select label={t({ en: 'Sort', ko: '정렬' })} value={sort} onChange={setSort} options={[{ value: 'new', label: t({ en: 'Newest', ko: '최신순' }) }, { value: 'near', label: t({ en: 'Nearest', ko: '가까운 순' }) }, { value: 'star', label: t({ en: 'Highest rated', ko: '별점 높은 순' }) }]} />
          <ChoiceList aria-label={t({ en: 'Kind', ko: '종류' })} multiple value={kinds} onChange={setKinds} options={[{ value: 'cafe', label: t({ en: 'Cafés', ko: '카페' }) }, { value: 'food', label: t({ en: 'Restaurants', ko: '음식점' }) }, { value: 'park', label: t({ en: 'Parks', ko: '공원' }) }]} />
          <ListItem title={t({ en: 'Open 24 hours', ko: '24시간 영업' })} trailing={<Switch checked={open24} onChange={setOpen24} aria-label={t({ en: 'Open 24 hours', ko: '24시간 영업' })} />} />
          <Button variant="tinted" tone="danger" onClick={() => { setAsking('filter'); setConfirm(true); }}>{t({ en: 'Delete saved filter…', ko: '저장한 필터 삭제…' })}</Button>
          <Button variant="filled" onClick={() => setFilters(false)}>{t({ en: 'Show results', ko: '결과 보기' })}</Button>
        </Stack>
      </Drawer>
      <Drawer open={consoleOpen} onClose={() => setConsoleOpen(false)} side="top" resizable defaultHeight={320} title={t({ en: 'Console', ko: '콘솔' })} labels={{ close, resize: t({ en: 'Console size', ko: '콘솔 크기' }) }}>
        <ConsoleBody />
      </Drawer>
      <Drawer open={logs} onClose={() => setLogs(false)} side="bottom" resizable defaultHeight={300} title={t({ en: 'Deploy log', ko: '배포 로그' })} labels={{ close, resize: t({ en: 'Log panel size', ko: '로그 창 크기' }) }}>
        <LogBody />
      </Drawer>
      {/* a wide detail panel: the list stays in view beside it on a desktop, and it is the whole width on a phone */}
      <Drawer open={detail} onClose={() => setDetail(false)} width={560} title={t({ en: 'Order details', ko: '주문 상세' })} labels={{ close }}
        trailing={<IconButton icon={<Share />} label={t({ en: 'Share', ko: '공유' })} variant="plain" />}>
        <Stack gap={5}>
          <Photo scene={2} style={{ position: 'relative', height: 180, borderRadius: 'var(--sg-radius-lg)', overflow: 'hidden' }} />
          <Stack gap={1}>
            <Text variant="title-3">{t({ en: 'Forest walk kit', ko: '숲길 산책 키트' })}</Text>
            <Text variant="subhead" tone="secondary">{t({ en: 'Order 2026-1120-0417 · Nov 20, 14:02', ko: '주문 2026-1120-0417 · 11월 20일 14:02' })}</Text>
          </Stack>
          <ListSection header={t({ en: 'Payment and delivery', ko: '결제와 배송' })}>
            <List>
              <ListItem title={t({ en: 'Amount paid', ko: '결제 금액' })} trailing={<Text variant="body" style={{ fontVariantNumeric: 'tabular-nums' }}>{t({ en: '₩48,900', ko: '48,900원' })}</Text>} />
              <ListItem title={t({ en: 'Paid with', ko: '결제 수단' })} trailing={<Text variant="body" tone="secondary">{t({ en: 'Card, in full', ko: '카드 일시불' })}</Text>} />
              <ListItem title={t({ en: 'Deliver to', ko: '받는 곳' })} subtitle={t({ en: '3F, 83-21 Wangsimni-ro, Seongdong-gu, Seoul', ko: '서울 성동구 왕십리로 83-21, 3층' })} />
            </List>
          </ListSection>
          <ListSection header={t({ en: 'Progress', ko: '진행' })}>
            <Timeline aria-label={t({ en: 'Delivery progress', ko: '배송 진행' })} labels={{ status: { done: t({ en: 'Done', ko: '완료' }), current: t({ en: 'In progress', ko: '진행 중' }), upcoming: t({ en: 'Upcoming', ko: '예정' }) } }}>
              <TimelineItem status="done" title={t({ en: 'Payment confirmed', ko: '결제 확인' })} time={t({ en: 'Nov 20, 14:05', ko: '11월 20일 14:05' })} />
              <TimelineItem status="current" title={t({ en: 'On the way', ko: '배송 중' })} description={t({ en: 'Hanbit Express · tracking 6021-4417-0093', ko: '한빛택배 · 운송장 6021-4417-0093' })} />
              <TimelineItem status="upcoming" title={t({ en: 'Delivered', ko: '배송 완료' })} description={t({ en: 'Expected Sat, Nov 22', ko: '도착 예정 11월 22일(토)' })} />
            </Timeline>
          </ListSection>
          <Stack direction="row" gap={2}>
            <Button variant="neutral" style={{ flex: 1 }}>{t({ en: 'Contact seller', ko: '문의하기' })}</Button>
            <Button variant="tinted" tone="danger" style={{ flex: 1 }} onClick={() => { setAsking('order'); setConfirm(true); }}>{t({ en: 'Cancel order…', ko: '주문 취소…' })}</Button>
          </Stack>
        </Stack>
      </Drawer>
      <Drawer open={nav} onClose={() => setNav(false)} side="start" title={t({ en: 'Browse', ko: '둘러보기' })} labels={{ close }}>
        <List>
          <ListItem leading={<Home />} tileColor="var(--sg-azure-500)" title={t({ en: 'Home', ko: '홈' })} onClick={() => setNav(false)} />
          <ListItem leading={<Map />} tileColor="var(--sg-jade-500)" title={t({ en: 'Map', ko: '지도' })} onClick={() => setNav(false)} />
          <ListItem leading={<Bookmark />} tileColor="var(--sg-amber-500)" title={t({ en: 'Saved places', ko: '저장한 장소' })} onClick={() => setNav(false)} />
          <ListItem leading={<Settings />} tileColor="var(--sg-iris-500)" title={t({ en: 'Settings', ko: '설정' })} onClick={() => setNav(false)} />
        </List>
      </Drawer>
      <Dialog open={confirm} onClose={() => setConfirm(false)} icon={<Trash2 />} tone="danger" title={asking === 'order' ? t({ en: 'Cancel this order?', ko: '주문을 취소할까요?' }) : t({ en: 'Delete the saved filter?', ko: '저장한 필터를 지울까요?' })}
        actions={<><Button variant="neutral" onClick={() => setConfirm(false)}>{asking === 'order' ? t({ en: 'Go back', ko: '돌아가기' }) : t({ en: 'Cancel', ko: '취소' })}</Button><Button variant="filled" tone="danger" onClick={() => setConfirm(false)}>{asking === 'order' ? t({ en: 'Cancel order', ko: '주문 취소' }) : t({ en: 'Delete', ko: '삭제' })}</Button></>}>
        {asking === 'order'
          ? t({ en: 'A dialog over a drawer. The drawer steps back as well and cannot be used until the dialog closes.', ko: '드로어 위에 뜬 대화상자예요. 대화상자를 닫을 때까지 드로어도 뒤로 물러나 조작할 수 없어요.' })
          : t({ en: 'Only the saved filter is deleted; the list you are looking at stays as it is.', ko: '저장한 필터만 지워지고, 지금 보고 있는 목록은 그대로예요.' })}
      </Dialog>
    </Section>
  );
}

/* the people in the avatar demos: Hangul and Latin names in Korean (both kinds of initials), romanised in English */
function useTeam() {
  const t = useT();
  return t({
    en: ['Kim Haneul', 'Lee Sora', 'Park Jimin', 'Choi Yuna', 'Jung Daon', 'Han Jiwoo', 'Oh Serin', 'Kang Minho'],
    ko: ['김하늘', 'Lee Sora', '박지민', 'Choi Yuna', '정다온', 'Han Jiwoo', '오세린', 'Kang Minho'],
  });
}
function AvatarGroups() {
  const t = useT(), TEAM = useTeam();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const groupLabels = { group: (n: number) => t({ en: `${n} people`, ko: `참여자 ${n}명` }), more: (n: number) => t({ en: `${n} more`, ko: `나머지 ${n}명` }) };
  return (
    <Section title={t({ en: 'Avatar group', ko: '아바타 그룹' })} intro={<L
      en="Shows several people as overlapping faces and folds the rest into +N. The group reads as a head count, such as ‘8 people’, and each visible person by name. Rings the colour of the background separate the faces (--sg-avatar-ring, the card background by default). A list of people is content, so it is not animated. With onMoreClick, +N becomes a button that can open the full list."
      ko="여러 사람을 겹친 얼굴로 보여 주고, 나머지는 +N으로 줄입니다. 그룹은 ‘참여자 8명’처럼 인원으로 읽히고, 보이는 사람은 각자 이름으로 읽힙니다. 얼굴 사이는 바탕과 같은 색의 고리로 나눕니다(--sg-avatar-ring, 기본은 카드 바탕색). 사람 목록은 내용이므로 움직임을 주지 않습니다. +N에 onMoreClick을 주면 버튼이 되어, 누르면 전체 목록을 띄울 수 있습니다." />}>
      <div className="grid grid--2">
        <Demo col data-demo="avatar-group">
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels}>{TEAM.map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
            <Text variant="subhead" tone="secondary">{t({ en: '8 people · 4 shown, then +4', ko: '8명 · 4명까지 보이고 +4' })}</Text>
          </Stack>
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels} max={3} total={128} onMoreClick={(e) => { anchor.current = e.currentTarget; setOpen(true); }}>
              {TEAM.slice(0, 5).map((n) => <Avatar key={n} name={n} />)}
            </AvatarGroup>
            <Text variant="subhead" tone="secondary">{t({ en: '128 people, as the server reports · +N opens the list', ko: '서버가 알려 준 128명 · +N을 누르면 목록' })}</Text>
          </Stack>
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels} size={24}>{TEAM.slice(0, 3).map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
            <AvatarGroup labels={groupLabels} size={40} max={5}>{TEAM.map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
          </Stack>
          <Popover open={open} onClose={() => setOpen(false)} anchor={anchor.current} aria-label={t({ en: 'Everyone taking part', ko: '참여자 전체' })}>
            <List>{TEAM.map((n) => <ListItem key={n} leading={<Avatar name={n} size={28} />} plainLeading title={n} />)}</List>
          </Popover>
        </Demo>
        <Demo col data-demo="avatar-group-page" style={{ background: 'var(--sg-bg)', ['--sg-avatar-ring' as string]: 'var(--sg-bg)' }}>
          <Text variant="subhead" tone="secondary">{t({ en: 'On the page background, the ring takes the page colour too (--sg-avatar-ring: var(--sg-bg))', ko: '페이지 바탕 위에서는 고리도 페이지 색으로 (--sg-avatar-ring: var(--sg-bg))' })}</Text>
          <AvatarGroup labels={groupLabels} max={6}>{[...TEAM.slice(0, 2).map((n) => <Avatar key={n} name={n} />), <Avatar key="img" name="Seo Yerin" src="/no-such-photo.jpg" />, ...TEAM.slice(2, 5).map((n) => <Avatar key={n} name={n} />)]}</AvatarGroup>
          <Text variant="footnote" tone="secondary">{t({ en: 'The third person\'s photo does not load, so their initials stand in.', ko: '세 번째 사람은 사진을 불러오지 못해 이니셜을 대신 보여 줍니다.' })}</Text>
        </Demo>
      </div>
      <Usage example={ListsAvatarGroup} code={listsAvatarGroupSrc} />
    </Section>
  );
}

/* ================================================================================================ Overlays */
export function Overlays() {
  const t = useT();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const [as, setAs] = useState(false);
  const [mode, setMode] = useState('walk');
  const menuBtn = useRef<HTMLButtonElement>(null), popBtn = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  return (
    <Page title={t({ en: 'Overlays', ko: '오버레이' })} api={['Menu', 'MenuItem', 'MenuLabel', 'Popover', 'Dialog', 'ActionSheet', 'Sheet', 'Drawer', 'ContextMenu', 'Toaster']} intro={<L
      en="Menus and popovers bloom from their anchor with a single bounce (bouncy); sheets rise from the bottom and close when dragged down. The background is dimmed, never blurred."
      ko="메뉴와 팝오버는 앵커에서 한 번 출렁이며 피어나고(bouncy), 시트는 아래에서 올라와 끌어내려 닫습니다. 배경은 흐리게 하지 않고 어둡게만 합니다." />}>
      <Section title={t({ en: 'Menu · popover', ko: '메뉴 · 팝오버' })}>
        <Demo>
          <Button ref={menuBtn} variant="glass" startIcon={<Footprints />} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>{t({ en: 'Directions', ko: '길찾기' })}</Button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={menuBtn.current} aria-label={t({ en: 'Travel mode', ko: '이동 수단' })}>
            <MenuLabel>{t({ en: 'Travel mode', ko: '이동 수단' })}</MenuLabel>
            <MenuItem icon={<Footprints />} checked={mode === 'walk'} onSelect={() => setMode('walk')}>{t({ en: 'Walk', ko: '도보' })}</MenuItem>
            <MenuItem icon={<Bike />} checked={mode === 'bike'} onSelect={() => setMode('bike')}>{t({ en: 'Cycle', ko: '자전거' })}</MenuItem>
            <MenuItem icon={<Car />} checked={mode === 'car'} onSelect={() => setMode('car')} hint={t({ en: '12 min', ko: '12분' })}>{t({ en: 'Drive', ko: '자동차' })}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Copy />} onSelect={() => toast({ title: t({ en: 'Address copied', ko: '주소를 복사했어요' }), tone: 'success' })}>{t({ en: 'Copy address', ko: '주소 복사' })}</MenuItem>
          </Menu>
          <Button ref={popBtn} variant="tinted" startIcon={<Info />} onClick={() => setPop((v) => !v)}>{t({ en: 'Info', ko: '정보' })}</Button>
          <Popover open={pop} onClose={() => setPop(false)} anchor={popBtn.current} aria-label={t({ en: 'About this place', ko: '장소 정보' })}>
            <Stack gap={2} style={{ width: 260 }}>
              <Text variant="headline">{t({ en: 'Heron Point', ko: '헤론 포인트' })}</Text>
              <Text variant="subhead" tone="secondary">{t({ en: 'A lookout at the end of the coastal path. Busiest half an hour before sunset.', ko: '해안 산책로 끝의 전망대. 일몰 30분 전이 가장 붐벼요.' })}</Text>
              <Stack direction="row" gap={2} style={{ marginTop: 8 }}><Button size="sm" variant="filled" onClick={() => setPop(false)}>{t({ en: 'Directions', ko: '길찾기' })}</Button><Button size="sm" variant="plain" onClick={() => setPop(false)}>{t({ en: 'Close', ko: '닫기' })}</Button></Stack>
            </Stack>
          </Popover>
        </Demo>
        <Usage example={OverlaysMenu} code={overlaysMenuSrc} />
      </Section>
      <Section title={t({ en: 'Dialog · action sheet · sheet', ko: '대화상자 · 액션 시트 · 시트' })}>
        <Demo>
          <Button variant="tinted" tone="danger" onClick={() => setDialog(true)}>{t({ en: 'Delete place…', ko: '장소 삭제…' })}</Button>
          <Dialog open={dialog} onClose={() => setDialog(false)} icon={<Trash2 />} tone="danger" title={t({ en: 'Delete this place?', ko: '이 장소를 삭제할까요?' })}
            actions={<><Button variant="neutral" onClick={() => setDialog(false)}>{t({ en: 'Cancel', ko: '취소' })}</Button><Button variant="filled" tone="danger" onClick={() => { setDialog(false); toast({ title: t({ en: 'Deleted', ko: '삭제했어요' }), action: { label: t({ en: 'Undo', ko: '실행 취소' }), onClick: () => {} } }); }}>{t({ en: 'Delete', ko: '삭제' })}</Button></>}>
            {t({ en: 'Its photos and notes are deleted too, and this can\'t be undone.', ko: '사진과 메모도 함께 지워지고 되돌릴 수 없어요.' })}
          </Dialog>
          <Button variant="neutral" onClick={() => setAs(true)}>{t({ en: 'Share options…', ko: '공유 옵션…' })}</Button>
          <ActionSheet open={as} onClose={() => setAs(false)} cancelLabel={t({ en: 'Close', ko: '닫기' })} title={t({ en: 'Heron Point', ko: '헤론 포인트' })} message={t({ en: 'How would you like to send this place?', ko: '이 장소를 어떻게 보낼까요?' })}
            actions={[{ label: t({ en: 'Copy link', ko: '링크 복사' }), icon: <Copy size={18} /> }, { label: t({ en: 'Save map image', ko: '지도 이미지 저장' }), icon: <Download size={18} /> }, { label: t({ en: 'Remove from list', ko: '목록에서 삭제' }), tone: 'danger', icon: <Trash2 size={18} /> }]} />
          <Button variant="filled" onClick={() => setSheet(true)} startIcon={<Pencil />}>{t({ en: 'Edit place', ko: '장소 편집' })}</Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} title={t({ en: 'Edit place', ko: '장소 편집' })}
            leading={<Button variant="plain" onClick={() => setSheet(false)}>{t({ en: 'Cancel', ko: '취소' })}</Button>}
            trailing={<Button variant="plain" style={{ fontWeight: 700 }} onClick={() => { setSheet(false); toast({ title: t({ en: 'Saved', ko: '저장했어요' }), tone: 'success' }); }}>{t({ en: 'Done', ko: '완료' })}</Button>}>
            <Stack gap={4}>
              <TextField label={t({ en: 'Name', ko: '이름' })} defaultValue={t({ en: 'Heron Point', ko: '헤론 포인트' })} clearable />
              <TextField label={t({ en: 'Notes', ko: '메모' })} multiline defaultValue={t({ en: 'Park in the public car park left of the entrance.', ko: '주차는 입구 왼쪽 공영주차장.' })} />
              <ListSection header={t({ en: 'Options', ko: '옵션' })}><List>
                <ListItem title={t({ en: 'Pin to map', ko: '지도에 고정' })} trailing={<Switch defaultChecked aria-label={t({ en: 'Pin to map', ko: '지도에 고정' })} />} />
                <ListItem title={t({ en: 'Save offline', ko: '오프라인 저장' })} trailing={<Switch aria-label={t({ en: 'Save offline', ko: '오프라인 저장' })} />} />
              </List></ListSection>
              <Text variant="footnote" tone="tertiary">{t({ en: 'Drag the handle or the title down to close.', ko: '손잡이나 제목 부분을 아래로 끌어 닫을 수 있어요.' })}</Text>
            </Stack>
          </Sheet>
        </Demo>
        <Usage example={OverlaysDialog} code={overlaysDialogSrc} />
      </Section>
      <Drawers />
      <Section title={t({ en: 'Context menu · toast', ko: '컨텍스트 메뉴 · 토스트' })} intro={<L
        en="A long press or a right-click (keyboard: Shift+F10) lifts the item and opens a menu beside it."
        ko="길게 누르거나 마우스 오른쪽 버튼을 클릭하면(키보드: Shift+F10) 항목이 떠오르고 메뉴가 옆에 나타납니다." />}>
        <Demo>
          <ContextMenu aria-label={t({ en: 'Photo', ko: '사진' })} menu={<>
            <MenuItem icon={<Share />}>{t({ en: 'Share', ko: '공유' })}</MenuItem><MenuItem icon={<Heart />}>{t({ en: 'Favourite', ko: '즐겨찾기' })}</MenuItem><MenuItem icon={<Copy />}>{t({ en: 'Copy', ko: '복사' })}</MenuItem>
            <MenuSeparator /><MenuItem icon={<Trash2 />} tone="danger">{t({ en: 'Delete', ko: '삭제' })}</MenuItem></>}>
            <button type="button" style={{ border: 0, padding: 0, borderRadius: 16, overflow: 'hidden', width: 180, height: 120, cursor: 'pointer' }} aria-label={t({ en: 'Sunset photo', ko: '노을 사진' })}><Photo scene={1} style={{ width: '100%', height: '100%' }} /></button>
          </ContextMenu>
          <Button variant="neutral" onClick={() => toast({ title: t({ en: 'Offline map downloaded', ko: '오프라인 지도를 받았어요' }), description: t({ en: 'Seoul · 312 MB', ko: '서울 · 312 MB' }), tone: 'success' })}>{t({ en: 'Toast', ko: '토스트' })}</Button>
          <Button variant="neutral" onClick={() => toast({ title: t({ en: 'Connection lost', ko: '연결이 끊겼어요' }), tone: 'danger', action: { label: t({ en: 'Try again', ko: '다시 시도' }), onClick: () => {} } })}>{t({ en: 'Error toast', ko: '오류 토스트' })}</Button>
        </Demo>
        <Usage example={OverlaysToast} code={overlaysToastSrc} />
      </Section>
    </Page>
  );
}


/* a little console for the top drawer: commands echo into a log that scrolls, newest at the bottom */
function ConsoleBody() {
  const t = useT();
  const help = t({
    en: ['help — list the commands', 'status — server status', 'fps — screen refresh rate', 'clear — clear the log'],
    ko: ['help — 명령 목록', 'status — 서버 상태', 'fps — 화면 주사율', 'clear — 지우기'],
  });
  const [lines, setLines] = useState<string[]>(() => t({ en: ['Satin Glass console · ` opens and closes it', 'Try typing help'], ko: ['Satin Glass 콘솔 · ` 키로 열고 닫아요', 'help를 입력해 보세요'] }));
  const [cmd, setCmd] = useState('');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [lines]);
  const run = (c: string) => {
    const k = c.trim().toLowerCase();
    if (!k) return;
    if (k === 'clear') { setLines([]); return; }
    const out = k === 'help' ? help
      : k === 'status' ? t({ en: ['api ok · latency 42ms', 'db ok · connections 18/64'], ko: ['api 정상 · 지연 42ms', 'db 정상 · 연결 18/64'] })
      : k === 'fps' ? [`${Math.round(55 + Math.random() * 5)} fps`]
      : [t({ en: `Unknown command: ${k}`, ko: `알 수 없는 명령: ${k}` })];
    setLines((l) => [...l, `> ${c}`, ...out]);
  };
  return (
    <div className="console">
      <div ref={log} className="console__log" role="log" aria-live="polite">{lines.map((l, i) => <div key={i} className={l.startsWith('> ') ? 'console__cmd' : undefined}>{l}</div>)}</div>
      <form className="console__prompt" onSubmit={(e) => { e.preventDefault(); run(cmd); setCmd(''); }}>
        <span aria-hidden="true">&gt;</span>
        <input aria-label={t({ en: 'Command', ko: '명령' })} value={cmd} onChange={(e) => setCmd(e.target.value)} autoComplete="off" spellCheck={false} data-autofocus />
      </form>
    </div>
  );
}

/* a log for the bottom drawer: a level filter over lines that scroll */
type LogLine = { t: string; lv: 'info' | 'warn' | 'error'; m: string };
function useLogLines(): LogLine[] {
  const t = useT();
  return [
    { t: '14:02:11', lv: 'info', m: t({ en: 'build started · commit c132b91', ko: 'build 시작 · 커밋 c132b91' }) },
    { t: '14:02:13', lv: 'info', m: t({ en: 'pnpm install · from cache (412 packages)', ko: 'pnpm install · 캐시 사용 (412 패키지)' }) },
    { t: '14:02:31', lv: 'warn', m: t({ en: 'tokens: label-tertiary contrast 4.61 (close to the 4.5 minimum)', ko: 'tokens: label-tertiary 대비 4.61 (기준 4.5에 가까움)' }) },
    { t: '14:02:44', lv: 'info', m: t({ en: 'core · react · docs built (38 s)', ko: 'core · react · docs 빌드 완료 (38초)' }) },
    { t: '14:03:20', lv: 'error', m: t({ en: 'e2e 2/4: edge cases · timed out, retrying', ko: 'e2e 2/4: edge cases · 시간 초과, 다시 시도' }) },
    { t: '14:05:02', lv: 'info', m: t({ en: 'e2e 2/4: passed on retry', ko: 'e2e 2/4: 다시 시도해 통과' }) },
    { t: '14:05:40', lv: 'info', m: t({ en: 'pages deployed · webispy.github.io/satin-glass', ko: 'pages 배포 · webispy.github.io/satin-glass' }) },
    { t: '14:05:41', lv: 'info', m: t({ en: 'done · 3 min 30 s', ko: '완료 · 3분 30초' }) },
    /* a busy afternoon after it, so there is a log to grow the drawer for */
    ...Array.from({ length: 36 }, (_, i): LogLine => {
      const m = 6 + i, time = `14:${String(Math.floor(m / 1) % 60).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;
      return i % 11 === 7 ? { t: time, lv: 'error', m: t({ en: `api returned 502 · /orders?page=${i} · retried once`, ko: `api 응답 502 · /orders?page=${i} · 재시도 1회` }) }
        : i % 5 === 3 ? { t: time, lv: 'warn', m: t({ en: `slow request ${820 + i * 13}ms · /search?q=forest`, ko: `느린 요청 ${820 + i * 13}ms · /search?q=숲길` }) }
        : { t: time, lv: 'info', m: `GET /places/${1000 + i * 7} 200 · ${18 + (i * 7) % 40}ms` };
    }),
  ];
}
function LogBody() {
  const t = useT(), lines = useLogLines();
  const [lv, setLv] = useState<'all' | 'warn' | 'error'>('all');
  const shown = lines.filter((l) => lv === 'all' || (lv === 'warn' ? l.lv !== 'info' : l.lv === 'error'));
  return (
    <div className="console">
      <SegmentedControl size="sm" aria-label={t({ en: 'Log level', ko: '로그 레벨' })} value={lv} onChange={setLv} options={[{ value: 'all', label: t({ en: 'All', ko: '전체' }) }, { value: 'warn', label: t({ en: 'Warnings and up', ko: '경고 이상' }) }, { value: 'error', label: t({ en: 'Errors', ko: '오류' }) }]} style={{ alignSelf: 'flex-start' }} />
      <div className="console__log" role="log">{shown.map((l) => <div key={l.t + l.m} className={`log--${l.lv}`}><span className="log__t">{l.t}</span> {l.m}</div>)}</div>
    </div>
  );
}
