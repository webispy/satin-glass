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
import { Demo, Page, Photo, Section } from '../shared';

/* ================================================================================================ Buttons */
export function Buttons() {
  const [loading, setLoading] = useState(false);
  return (
    <Page title="버튼" intro="채움(filled) · 틴트(tinted, 기본) · 유리(glass) · 평면(plain) · 중립(neutral). 누르면 살짝 들어가고(0.965배), 유리 버튼은 손가락 아래로 빛이 모입니다.">
      <Section title="변형">
        <Demo>
          <Button variant="filled">계속</Button>
          <Button>저장</Button>
          <Button variant="glass">공유</Button>
          <Button variant="plain">취소</Button>
          <Button variant="neutral">보관</Button>
          <Button variant="filled" tone="danger" startIcon={<Trash2 />}>삭제</Button>
          <Button variant="tinted" tone="danger">초기화</Button>
        </Demo>
      </Section>
      <Section title="크기와 상태">
        <Demo>
          <Button size="sm" variant="filled">작게</Button>
          <Button variant="filled">보통</Button>
          <Button size="lg" variant="filled">크게</Button>
          <Button variant="filled" loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>다운로드</Button>
          <Button variant="filled" disabled>비활성</Button>
          <Button variant="tinted" startIcon={<Plus />} shape="round">추가</Button>
        </Demo>
      </Section>
      <Section title="아이콘 버튼과 그룹" intro="아이콘 버튼은 둥근 사각형이 기본이고, 원형은 shape='round'입니다. 그룹은 유리 한 장을 나눠 씁니다. 유리 위에 유리를 겹치지 않습니다.">
        <Demo media>
          <Photo scene={3} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <IconButton variant="glass" icon={<ChevronLeft />} label="뒤로" />
            <ButtonGroup><IconButton icon={<Share />} label="공유" /><IconButton icon={<Heart />} label="좋아요" /><IconButton icon={<MoreHorizontal />} label="더 보기" /></ButtonGroup>
            <IconButton variant="glass" shape="round" icon={<Plus />} label="추가" />
            <Button variant="glass">편집</Button>
          </div>
        </Demo>
      </Section>
    </Page>
  );
}

/* ================================================================================================ Inputs */
export function Inputs() {
  const [wifi, setWifi] = useState(true);
  const [vol, setVol] = useState(60);
  const [guests, setGuests] = useState(2);
  const [view, setView] = useState('map');
  const [tags, setTags] = useState<string[]>(['hike']);
  const [name, setName] = useState('');
  return (
    <Page title="입력" intro="필드, 스위치, 슬라이더, 스테퍼, 세그먼트, 칩. 모두 제어(value/onChange)와 비제어(defaultValue) 방식을 함께 지원합니다.">
      <Section title="텍스트 필드">
        <div className="grid grid--2">
          <Demo col>
            <TextField label="장소 이름" placeholder="예: 헤론 포인트" value={name} onChange={(e) => setName(e.target.value)} clearable onClear={() => setName('')} helperText="지도와 목록에 보이는 이름" />
            <TextField label="이메일" type="email" defaultValue="hello@" error="이메일 형식이 아니에요" />
          </Demo>
          <Demo col>
            <SearchField placeholder="장소, 주소 검색" onCancel={() => {}} />
            <TextField label="메모" multiline placeholder="가는 길, 주차 정보…" />
          </Demo>
        </div>
      </Section>
      <Section title="스위치 · 슬라이더 · 스테퍼" intro="스위치는 누르는 동안 손잡이가 움직일 쪽으로 늘어나고, 손잡이를 끌어서 켜고 끌 수도 있습니다. 슬라이더는 잡으면 유리 말풍선에 값이 뜹니다.">
        <Demo col>
          <div className="label-row"><Text>Wi‑Fi</Text><Switch checked={wifi} onChange={setWifi} aria-label="Wi‑Fi" /></div>
          <div className="label-row"><Text>오프라인 지도</Text><Switch defaultChecked={false} aria-label="오프라인 지도" /></div>
          <div className="label-row" style={{ gap: 24 }}><Text style={{ flex: 'none' }}>거리</Text><Slider value={vol} onChange={setVol} format={(v) => `${v} km`} aria-label="거리" style={{ flex: 1, maxWidth: 360 }} /></div>
          <div className="label-row"><Text>인원</Text><Stepper value={guests} onChange={setGuests} min={1} max={12} label="인원" format={(v) => `${v}명`} /></div>
        </Demo>
      </Section>
      <Section title="세그먼트" intro="선택 표시가 물방울처럼 늘어나 다음 칸까지 이어졌다가 모입니다. 끌어서 선택할 수도 있습니다.">
        <Demo col>
          <SegmentedControl aria-label="보기" value={view} onChange={setView} options={[{ value: 'map', label: '지도' }, { value: 'list', label: '목록' }, { value: 'photo', label: '사진' }, { value: 'saved', label: '저장됨' }]} />
          <SegmentedControl size="sm" aria-label="이동 수단" defaultValue="walk" options={[{ value: 'walk', label: '도보', icon: <Footprints /> }, { value: 'bike', label: '자전거', icon: <Bike /> }, { value: 'car', label: '자동차', icon: <Car /> }]} style={{ maxWidth: 340 }} />
        </Demo>
      </Section>
      <Section title="칩">
        <Demo>
          {[['hike', '하이킹'], ['beach', '바다'], ['camp', '캠핑'], ['city', '도시'], ['view', '전망']].map(([k, l]) => (
            <Chip key={k} selected={tags.includes(k)} onSelectedChange={(on) => setTags((t) => (on ? [...t, k] : t.filter((x) => x !== k)))}>{l}</Chip>
          ))}
          <Chip icon={<MapPin />} onRemove={() => {}}>서울</Chip>
        </Demo>
      </Section>
    </Page>
  );
}

/* ================================================================================================ Navigation */
export function Navigation() {
  const [tab, setTab] = useState('home');
  const [page, setPage] = useState(1);
  const [side, setSide] = useState('all');
  const [section, setSection] = useState('orders');
  const [pg, setPg] = useState(6);
  return (
    <Page title="내비게이션" intro="떠 있는 유리 바입니다. 화면 가장자리에서 12px 띄우고, 모서리는 고정 반경 22px입니다. 페이지 안의 구역은 탭으로, 긴 목록은 페이지 이동으로 나눕니다.">
      <Section title="탭 바" intro="탭하면 선택 표시가 물방울처럼 늘어나 이어졌다가 새 탭에서 모입니다. 표시는 바 안에만 머뭅니다. draggable을 주면 바 위를 끌 때 손가락을 따라가고, 손을 뗀 자리의 탭이 선택됩니다. 기본은 꺼져 있어 탭해서 선택하며, 이 예시는 draggable을 켜 두었습니다.">
        <Demo media style={{ padding: 0, minHeight: 220 }}>
          <Photo scene={0} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, maxWidth: 460, margin: '0 auto' }}>
            <TabBar draggable value={tab} onChange={setTab} aria-label="메인" action={<TabBarAction icon={<Search />} label="검색" />}>
              <Tab value="home" label="홈" icon={<Home />} />
              <Tab value="map" label="지도" icon={<Map />} />
              <Tab value="saved" label="저장" icon={<Bookmark />} badge={<Badge>3</Badge>} />
              <Tab value="me" label="나" icon={<User />} />
            </TabBar>
          </div>
        </Demo>
        <Text variant="footnote" tone="tertiary" style={{ marginTop: 8 }}>선택: {tab}</Text>
      </Section>
      <Section title="앱 바">
        <Demo media style={{ padding: 0, minHeight: 160, alignItems: 'flex-start' }}>
          <Photo scene={4} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative', width: '100%', color: 'var(--sg-label)' }}>
            <AppBar title="즐겨찾기" leading={<IconButton icon={<ChevronLeft />} label="뒤로" />} trailing={<><IconButton icon={<Share />} label="공유" /><IconButton icon={<Plus />} label="추가" /></>} style={{ position: 'relative' }} />
          </div>
        </Demo>
      </Section>
      <Section title="사이드바 · 페이지 컨트롤">
        <div className="grid grid--2">
          <Demo media style={{ padding: 12, minHeight: 300 }}>
            <Photo scene={2} style={{ position: 'absolute', inset: 0 }} />
            <Sidebar style={{ position: 'relative', height: 276, width: 240, color: 'var(--sg-label)' }}>
              <SidebarSection>라이브러리</SidebarSection>
              <SidebarItem icon={<Compass />} selected={side === 'all'} count={24} onClick={() => setSide('all')}>모든 장소</SidebarItem>
              <SidebarItem icon={<Star />} selected={side === 'fav'} count={7} onClick={() => setSide('fav')}>즐겨찾기</SidebarItem>
              <SidebarItem icon={<Plane />} selected={side === 'trip'} count={3} onClick={() => setSide('trip')}>여행</SidebarItem>
              <SidebarSection>설정</SidebarSection>
              <SidebarItem icon={<Settings />} selected={side === 'set'} onClick={() => setSide('set')}>환경설정</SidebarItem>
            </Sidebar>
          </Demo>
          <Demo col center>
            <Stack align="center" gap={4}>
              <PageControl count={5} page={page} onChange={setPage} />
              <PageControl count={5} page={page} onChange={setPage} glass />
              <Text variant="footnote" tone="tertiary">점을 따라 끌면 페이지를 빠르게 넘깁니다 · {page + 1}/5</Text>
            </Stack>
          </Demo>
        </div>
      </Section>
      <Section title="탭" intro="한 페이지 안의 구역을 나눕니다. 밑줄은 탭 바·세그먼트와 같은 물방울이라 같은 방식으로 이동합니다. 방향키로 포커스를 옮기면 바로 선택되고(수동으로 하려면 activation=&quot;manual&quot;), 새 패널은 이동한 쪽에서 들어옵니다. 내용이 무거운 패널은 탭을 누른 직후의 반응이 끊기지 않도록 뒤로 미뤄 그립니다.">
        <Demo col data-demo="tabs">
          <Tabs aria-label="스토어 관리" value={section} onChange={setSection} items={[
            { value: 'orders', label: '주문', icon: <ShoppingBag />, badge: 12, content: <Text variant="subhead" tone="secondary">새 주문 12건이 확인을 기다려요.</Text> },
            { value: 'products', label: '상품', icon: <Package />, content: <Text variant="subhead" tone="secondary">공개한 상품 22개, 숨긴 상품 2개.</Text> },
            { value: 'reviews', label: '후기', icon: <MessageSquare />, content: <Text variant="subhead" tone="secondary">이번 주 후기 48개, 평균 4.6점.</Text> },
            { value: 'stats', label: '통계', icon: <BarChart3 />, content: <Text variant="subhead" tone="secondary">방문과 매출 흐름은 차트와 지표 페이지에서 볼 수 있어요.</Text> },
            { value: 'settle', label: '정산', disabled: true },
          ]} />
        </Demo>
        <Demo col data-demo="tabs-many" style={{ marginTop: 16 }}>
          <Text variant="subhead" tone="secondary">탭이 많으면 줄이 가로로 스크롤되고, 가려진 탭이 있는 쪽 끝이 흐려집니다. 선택한 탭은 항상 보이는 곳까지 스크롤됩니다.</Text>
          <div style={{ maxWidth: 420 }}>
            <Tabs aria-label="분류" activation="manual" defaultValue="digital" items={['전체', '의류', '생활', '주방', '문구', '디지털', '반려동물', '캠핑', '선물 포장', '할인 중'].map((l, i) => ({ value: ['all', 'wear', 'home', 'kitchen', 'paper', 'digital', 'pet', 'camp', 'gift', 'sale'][i], label: l }))} />
          </div>
        </Demo>
        <Demo col data-demo="tabs-pill" style={{ marginTop: 16 }}>
          <Text variant="subhead" tone="secondary">필 탭(variant=&quot;pill&quot;)은 넘치면 다음 줄로 넘어가 모든 구역이 한눈에 보입니다. 휴대폰에서 구역이 많을 때 씁니다. 선택 표시(물방울)가 줄을 넘어 이동할 수 없으므로 선택한 필 자체가 볼록한 면이 되고, 선택이 바뀌면 짧은 전환으로 바뀝니다. 키보드 조작은 밑줄 탭과 같습니다.</Text>
          <div style={{ maxWidth: 420 }}>
            <Tabs variant="pill" aria-label="벤치마크 묶음" defaultValue="reason" items={[{ value: 'all', label: '모든 벤치마크' }, { value: 'know', label: '지식' }, { value: 'reason', label: '추론' }, { value: 'code', label: '코딩' }, { value: 'inst', label: '지시 따르기' }, { value: 'ko', label: '한국어' }, { value: 'long', label: '긴 문맥', disabled: true }]} />
          </div>
        </Demo>
      </Section>
      <Section title="페이지 이동" intro="처음과 끝, 현재 페이지와 그 앞뒤 페이지를 보여 주고 사이는 …로 접습니다. 현재 페이지가 가운데 구간에서 바뀌는 동안에는 버튼 개수가 그대로라 포인터 밑의 버튼이 밀리지 않습니다. 좁은 곳에서는 ‘6 / 40’으로 바뀝니다.">
        <Demo col data-demo="pagination">
          <Pagination page={pg} pageCount={40} onChange={setPg} aria-label="주문 목록 페이지" labels={{ previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` }} style={{ justifyContent: 'flex-start' }} />
          <Pagination page={pg} pageCount={40} siblings={2} onChange={setPg} aria-label="주문 목록 페이지 (이웃 2개)" labels={{ previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` }} style={{ justifyContent: 'flex-start' }} />
          <div style={{ width: 220 }}><Pagination page={pg} pageCount={40} onChange={setPg} aria-label="주문 목록 페이지 (좁게)" labels={{ previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` }} /></div>
        </Demo>
      </Section>
    </Page>
  );
}

/* ================================================================================================ Lists & display */
/* the settings stack: four pages deep (설정 › 프로필 › 계정 보안 › 비밀번호 변경 / 로그인한 기기). Each page is its own
   component with its own state; a pushed page is an element, so values it shows come from its own state */
const MODES = { light: '라이트', dark: '다크', system: '시스템' } as const;
function SettingsRoot() {
  const nav = useNavigation();
  const [notif, setNotif] = useState(true);
  const [mode, setMode] = useState<keyof typeof MODES>('system');
  return (
    <NavigationPage title="설정" largeTitle>
      <ListSection header="계정" footer="알림은 기기마다 따로 설정할 수 있어요.">
        <List>
          <ListItem leading={<User />} tileColor="var(--sg-iris-500)" title="프로필" subtitle="hello@example.com" chevron onClick={() => nav.push(<ProfilePage />)} />
          <ListItem leading={<Bell />} tileColor="var(--sg-coral-500)" title="알림" trailing={<Switch checked={notif} onChange={setNotif} aria-label="알림" />} />
          <ListItem leading={<Moon />} tileColor="var(--sg-orchid-600)" title="화면 모드" trailing={MODES[mode]} chevron onClick={() => nav.push(<AppearancePage initial={mode} onChange={setMode} />)} />
          <ListItem leading={<Wifi />} tileColor="var(--sg-azure-500)" title="오프라인 지도" trailing={<Badge tone="accent">NEW</Badge>} chevron onClick={() => nav.push(<NavigationPage title="오프라인 지도"><ListSection footer="내려받은 지도는 연결이 없어도 볼 수 있어요."><List><ListItem title="서울" subtitle="312 MB" /><ListItem title="부산" subtitle="188 MB" /></List></ListSection></NavigationPage>)} />
        </List>
      </ListSection>
      <ListSection>
        <List><ListItem title="로그아웃" tone="danger" onClick={() => {}} /></List>
      </ListSection>
    </NavigationPage>
  );
}
function ProfilePage() {
  const nav = useNavigation();
  return (
    <NavigationPage title="프로필">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 6, paddingTop: 4 }}>
        <Avatar name="Kim Minji" size={72} />
        <Text variant="headline">김민지</Text>
      </div>
      <ListSection>
        <List>
          <ListItem leading={<Mail />} tileColor="var(--sg-azure-500)" title="이메일" trailing="hello@example.com" />
          <ListItem leading={<ShieldCheck />} tileColor="var(--sg-jade-600)" title="계정 보안" chevron onClick={() => nav.push(<SecurityPage />)} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function SecurityPage() {
  const nav = useNavigation();
  const [twoStep, setTwoStep] = useState(true);
  return (
    <NavigationPage title="계정 보안">
      <ListSection footer="2단계 인증을 켜면 새 기기에서 로그인할 때 확인 코드를 한 번 더 받아요.">
        <List>
          <ListItem leading={<KeyRound />} tileColor="var(--sg-amber-500)" title="비밀번호 변경" chevron onClick={() => nav.push(<PasswordPage />)} />
          <ListItem leading={<Lock />} tileColor="var(--sg-slate-500)" title="2단계 인증" trailing={<Switch checked={twoStep} onChange={setTwoStep} aria-label="2단계 인증" />} />
          <ListItem leading={<Smartphone />} tileColor="var(--sg-iris-500)" title="로그인한 기기" trailing="2대" chevron onClick={() => nav.push(<DevicesPage />)} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function PasswordPage() {
  const nav = useNavigation();
  return (
    <NavigationPage title="비밀번호 변경" trailing={<Button size="sm" variant="plain" onClick={() => nav.popToRoot()}>완료</Button>}>
      <Stack gap={4}>
        <TextField label="현재 비밀번호" type="password" />
        <TextField label="새 비밀번호" type="password" helperText="8자 이상, 숫자와 기호를 섞어서" />
      </Stack>
    </NavigationPage>
  );
}
function DevicesPage() {
  return (
    <NavigationPage title="로그인한 기기">
      <ListSection>
        <List>
          <ListItem leading={<Smartphone />} tileColor="var(--sg-iris-500)" title="이 휴대폰" subtitle="지금 사용 중" />
          <ListItem leading={<Laptop />} tileColor="var(--sg-slate-500)" title="노트북" subtitle="3일 전" />
        </List>
      </ListSection>
    </NavigationPage>
  );
}
function AppearancePage({ initial, onChange }: { initial: keyof typeof MODES; onChange: (m: keyof typeof MODES) => void }) {
  const [m, setM] = useState(initial);
  return (
    <NavigationPage title="화면 모드">
      <ChoiceList aria-label="화면 모드" value={m} onChange={(v) => { setM(v); onChange(v); }} options={[
        { value: 'light', label: '라이트', icon: <Sun />, tileColor: 'var(--sg-amber-500)' },
        { value: 'dark', label: '다크', icon: <Moon />, tileColor: 'var(--sg-iris-700)' },
        { value: 'system', label: '시스템 설정', description: '기기 설정을 따라요', icon: <Monitor />, tileColor: 'var(--sg-slate-500)' },
      ]} />
    </NavigationPage>
  );
}

export function Lists() {
  return (
    <Page title="목록과 표시" intro="그룹 목록, 카드, 아바타, 배지, 진행 표시입니다.">
      <div className="grid grid--2">
        <Stack gap={3}>
          <div data-demo="nav-stack">
            <NavigationStack labels={{ back: '뒤로' }} className="settings-stack"><SettingsRoot /></NavigationStack>
          </div>
          <Text variant="footnote" tone="secondary">행을 누르면 다음 페이지가 오른쪽에서 들어옵니다(설정 › 프로필 › 계정 보안 › 비밀번호 변경, 깊이 제한 없음). 왼쪽 위 뒤로 버튼에는 이전 페이지의 이름이 붙고, 터치에서는 왼쪽 가장자리에서 밀어도 돌아갑니다. 이전 페이지는 스크롤 위치와 상태를 그대로 유지합니다.</Text>
        </Stack>
        <Stack gap={4}>
          <Card interactive>
            <Photo scene={1} style={{ height: 150 }} />
            <CardBody><Text variant="headline">노을 언덕</Text><Text variant="subhead" tone="secondary">2.4 km · 오늘 18:42 일몰</Text></CardBody>
          </Card>
          <Demo>
            <Avatar name="Kim Minji" /><Avatar name="Lee Jun" /><Avatar name="Park Sora" size={32} />
            <BadgeAnchor badge={<Badge>5</Badge>}><IconButton variant="neutral" icon={<Bell />} label="알림" /></BadgeAnchor>
            <BadgeAnchor badge={<Badge dot />}><Avatar name="Choi Yuna" /></BadgeAnchor>
          </Demo>
          <Demo col>
            <Progress value={64} label="다운로드" />
            <Progress label="동기화" />
            <Stack direction="row" gap={3} align="center"><Spinner /><Text variant="subhead" tone="secondary">불러오는 중…</Text></Stack>
          </Demo>
        </Stack>
      </div>
      <AvatarGroups />
    </Page>
  );
}

function Drawers() {
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
  return (
    <Section title="서랍 (Drawer)" intro="화면 가장자리에서 들어오는 패널입니다. 옆(start · end)은 폭을 정해 쓰고, 위·아래(top · bottom)는 콘솔이나 로그 같은 도구 패널로 화면 폭 전체에 높이를 정합니다. 아래에서 올라와 내용을 읽거나 채우는 것은 시트입니다. 목록 옆의 필터, 상세 보기, 짧은 입력처럼 지금 화면을 떠나지 않고 할 일에 씁니다. 항상 모달이라 뒤 화면은 조작할 수 없고 스크린 리더에서도 숨겨지며(aria-hidden), 닫으면 서랍을 연 버튼으로 포커스가 돌아갑니다. 가장자리 쪽으로 끌면 손가락을 그대로 따라오고, 폭의 3분의 1을 넘기거나 빠르게 튕기면 닫히며, 덜 끌면 제자리로 돌아옵니다. side는 글 방향을 따라 'end'(기본, 왼쪽에서 오른쪽으로 쓰는 화면의 오른쪽)와 'start'입니다. 계속 보이는 옆 영역은 Sidebar를 씁니다.">
      <Demo data-demo="drawer">
        <Button variant="filled" onClick={() => setFilters(true)}>필터 열기</Button>
        <Button variant="tinted" onClick={() => setNav(true)}>메뉴 (start)</Button>
        <Button variant="neutral" onClick={() => setDetail(true)}>주문 상세 (넓게)</Button>
        <Button variant="neutral" onClick={() => setConsoleOpen(true)}>콘솔 (top, ` 키)</Button>
        <Button variant="neutral" onClick={() => setLogs(true)}>로그 보기 (bottom, 크기 조절)</Button>
      </Demo>
      <Drawer open={filters} onClose={() => setFilters(false)} title="필터" labels={{ close: '닫기' }}
        trailing={<Button size="sm" variant="plain" onClick={() => { setSort('new'); setOpen24(true); setKinds(['cafe']); }}>초기화</Button>}>
        <Stack gap={5}>
          <Select label="정렬" value={sort} onChange={setSort} options={[{ value: 'new', label: '최신순' }, { value: 'near', label: '가까운 순' }, { value: 'star', label: '별점 높은 순' }]} />
          <ChoiceList aria-label="종류" multiple value={kinds} onChange={setKinds} options={[{ value: 'cafe', label: '카페' }, { value: 'food', label: '음식점' }, { value: 'park', label: '공원' }]} />
          <ListItem title="24시간 영업" trailing={<Switch checked={open24} onChange={setOpen24} aria-label="24시간 영업" />} />
          <Button variant="tinted" tone="danger" onClick={() => { setAsking('filter'); setConfirm(true); }}>저장한 필터 삭제…</Button>
          <Button variant="filled" onClick={() => setFilters(false)}>결과 보기</Button>
        </Stack>
      </Drawer>
      <Drawer open={consoleOpen} onClose={() => setConsoleOpen(false)} side="top" resizable defaultHeight={320} title="콘솔" labels={{ close: '닫기', resize: '콘솔 크기' }}>
        <ConsoleBody />
      </Drawer>
      <Drawer open={logs} onClose={() => setLogs(false)} side="bottom" resizable defaultHeight={300} title="배포 로그" labels={{ close: '닫기', resize: '로그 창 크기' }}>
        <LogBody />
      </Drawer>
      {/* a wide detail panel: the list stays in view beside it on a desktop, and it is the whole width on a phone */}
      <Drawer open={detail} onClose={() => setDetail(false)} width={560} title="주문 상세" labels={{ close: '닫기' }}
        trailing={<IconButton icon={<Share />} label="공유" variant="plain" />}>
        <Stack gap={5}>
          <Photo scene={2} style={{ position: 'relative', height: 180, borderRadius: 'var(--sg-radius-lg)', overflow: 'hidden' }} />
          <Stack gap={1}>
            <Text variant="title-3">숲길 산책 키트</Text>
            <Text variant="subhead" tone="secondary">주문 2026-1120-0417 · 11월 20일 14:02</Text>
          </Stack>
          <ListSection header="결제와 배송">
            <List>
              <ListItem title="결제 금액" trailing={<Text variant="body" style={{ fontVariantNumeric: 'tabular-nums' }}>48,900원</Text>} />
              <ListItem title="결제 수단" trailing={<Text variant="body" tone="secondary">카드 일시불</Text>} />
              <ListItem title="받는 곳" subtitle="서울 성동구 왕십리로 83-21, 3층" />
            </List>
          </ListSection>
          <ListSection header="진행">
            <Timeline aria-label="배송 진행" labels={{ status: { done: '완료', current: '진행 중', upcoming: '예정' } }}>
              <TimelineItem status="done" title="결제 확인" time="11월 20일 14:05" />
              <TimelineItem status="current" title="배송 중" description="한빛택배 · 운송장 6021-4417-0093" />
              <TimelineItem status="upcoming" title="배송 완료" description="도착 예정 11월 22일(토)" />
            </Timeline>
          </ListSection>
          <Stack direction="row" gap={2}>
            <Button variant="neutral" style={{ flex: 1 }}>문의하기</Button>
            <Button variant="tinted" tone="danger" style={{ flex: 1 }} onClick={() => { setAsking('order'); setConfirm(true); }}>주문 취소…</Button>
          </Stack>
        </Stack>
      </Drawer>
      <Drawer open={nav} onClose={() => setNav(false)} side="start" title="둘러보기" labels={{ close: '닫기' }}>
        <List>
          <ListItem leading={<Home />} tileColor="var(--sg-azure-500)" title="홈" onClick={() => setNav(false)} />
          <ListItem leading={<Map />} tileColor="var(--sg-jade-500)" title="지도" onClick={() => setNav(false)} />
          <ListItem leading={<Bookmark />} tileColor="var(--sg-amber-500)" title="저장한 장소" onClick={() => setNav(false)} />
          <ListItem leading={<Settings />} tileColor="var(--sg-iris-500)" title="설정" onClick={() => setNav(false)} />
        </List>
      </Drawer>
      <Dialog open={confirm} onClose={() => setConfirm(false)} icon={<Trash2 />} tone="danger" title={asking === 'order' ? '주문을 취소할까요?' : '저장한 필터를 지울까요?'}
        actions={<><Button variant="neutral" onClick={() => setConfirm(false)}>{asking === 'order' ? '돌아가기' : '취소'}</Button><Button variant="filled" tone="danger" onClick={() => setConfirm(false)}>{asking === 'order' ? '주문 취소' : '삭제'}</Button></>}>
        {asking === 'order' ? '서랍 위에 뜬 대화상자입니다. 이때는 서랍도 뒤로 물러나 조작할 수 없습니다.' : '저장한 필터만 지워지고, 지금 보고 있는 목록은 그대로입니다.'}
      </Dialog>
    </Section>
  );
}

const TEAM = ['김하늘', 'Lee Sora', '박지민', 'Choi Yuna', '정다온', 'Han Jiwoo', '오세린', 'Kang Minho'];
function AvatarGroups() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const groupLabels = { group: (n: number) => `참여자 ${n}명`, more: (n: number) => `나머지 ${n}명` };
  return (
    <Section title="아바타 묶음 (AvatarGroup)" intro="여러 사람을 겹친 얼굴로 보여 주고, 나머지는 +N으로 줄입니다. 묶음은 '참여자 8명'처럼 인원으로 읽히고, 보이는 사람은 각자 이름으로 읽힙니다. 얼굴 사이는 바탕과 같은 색의 고리로 나눕니다(--sg-avatar-ring, 기본은 카드 바탕색). 사람 목록은 내용이므로 움직임을 주지 않습니다. +N에 onMoreClick을 주면 버튼이 되어, 누르면 전체 목록을 띄울 수 있습니다.">
      <div className="grid grid--2">
        <Demo col data-demo="avatar-group">
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels}>{TEAM.map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
            <Text variant="subhead" tone="secondary">8명 · 4명까지 보이고 +4</Text>
          </Stack>
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels} max={3} total={128} onMoreClick={(e) => { anchor.current = e.currentTarget; setOpen(true); }}>
              {TEAM.slice(0, 5).map((n) => <Avatar key={n} name={n} />)}
            </AvatarGroup>
            <Text variant="subhead" tone="secondary">서버가 알려 준 128명 · +N을 누르면 목록</Text>
          </Stack>
          <Stack direction="row" gap={4} align="center" wrap>
            <AvatarGroup labels={groupLabels} size={24}>{TEAM.slice(0, 3).map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
            <AvatarGroup labels={groupLabels} size={40} max={5}>{TEAM.map((n) => <Avatar key={n} name={n} />)}</AvatarGroup>
          </Stack>
          <Popover open={open} onClose={() => setOpen(false)} anchor={anchor.current} aria-label="참여자 전체">
            <List>{TEAM.map((n) => <ListItem key={n} leading={<Avatar name={n} size={28} />} plainLeading title={n} />)}</List>
          </Popover>
        </Demo>
        <Demo col data-demo="avatar-group-page" style={{ background: 'var(--sg-bg)', ['--sg-avatar-ring' as string]: 'var(--sg-bg)' }}>
          <Text variant="subhead" tone="secondary">페이지 바탕 위에서는 고리도 페이지 색으로 (--sg-avatar-ring: var(--sg-bg))</Text>
          <AvatarGroup labels={groupLabels} max={6}>{[...TEAM.slice(0, 2).map((n) => <Avatar key={n} name={n} />), <Avatar key="img" name="Seo Yerin" src="/no-such-photo.jpg" />, ...TEAM.slice(2, 5).map((n) => <Avatar key={n} name={n} />)]}</AvatarGroup>
          <Text variant="footnote" tone="secondary">셋째 사람은 사진을 불러오지 못해 이니셜로 대신합니다.</Text>
        </Demo>
      </div>
    </Section>
  );
}

/* ================================================================================================ Overlays */
export function Overlays() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const [as, setAs] = useState(false);
  const [mode, setMode] = useState('walk');
  const menuBtn = useRef<HTMLButtonElement>(null), popBtn = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  return (
    <Page title="오버레이" intro="메뉴와 팝오버는 앵커에서 한 번 출렁이며 피어나고(bouncy), 시트는 아래에서 올라와 끌어내려 닫습니다. 배경은 흐리게 하지 않고 어둡게만 합니다.">
      <Section title="메뉴 · 팝오버">
        <Demo>
          <Button ref={menuBtn} variant="glass" startIcon={<Footprints />} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>길찾기</Button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={menuBtn.current} aria-label="이동 수단">
            <MenuLabel>이동 수단</MenuLabel>
            <MenuItem icon={<Footprints />} checked={mode === 'walk'} onSelect={() => setMode('walk')}>도보</MenuItem>
            <MenuItem icon={<Bike />} checked={mode === 'bike'} onSelect={() => setMode('bike')}>자전거</MenuItem>
            <MenuItem icon={<Car />} checked={mode === 'car'} onSelect={() => setMode('car')} hint="12분">자동차</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Copy />} onSelect={() => toast({ title: '주소를 복사했어요', tone: 'success' })}>주소 복사</MenuItem>
          </Menu>
          <Button ref={popBtn} variant="tinted" startIcon={<Info />} onClick={() => setPop((v) => !v)}>정보</Button>
          <Popover open={pop} onClose={() => setPop(false)} anchor={popBtn.current} aria-label="장소 정보">
            <Stack gap={2} style={{ width: 260 }}>
              <Text variant="headline">헤론 포인트</Text>
              <Text variant="subhead" tone="secondary">해안 산책로 끝의 전망대. 일몰 30분 전이 가장 붐빕니다.</Text>
              <Stack direction="row" gap={2} style={{ marginTop: 8 }}><Button size="sm" variant="filled" onClick={() => setPop(false)}>길찾기</Button><Button size="sm" variant="plain" onClick={() => setPop(false)}>닫기</Button></Stack>
            </Stack>
          </Popover>
        </Demo>
      </Section>
      <Section title="대화상자 · 액션 시트 · 시트">
        <Demo>
          <Button variant="tinted" tone="danger" onClick={() => setDialog(true)}>장소 삭제…</Button>
          <Dialog open={dialog} onClose={() => setDialog(false)} icon={<Trash2 />} tone="danger" title="이 장소를 삭제할까요?"
            actions={<><Button variant="neutral" onClick={() => setDialog(false)}>취소</Button><Button variant="filled" tone="danger" onClick={() => { setDialog(false); toast({ title: '삭제했어요', action: { label: '실행 취소', onClick: () => {} } }); }}>삭제</Button></>}>
            사진과 메모도 함께 지워지고 되돌릴 수 없어요.
          </Dialog>
          <Button variant="neutral" onClick={() => setAs(true)}>공유 옵션…</Button>
          <ActionSheet open={as} onClose={() => setAs(false)} cancelLabel="닫기" title="헤론 포인트" message="이 장소를 어떻게 보낼까요?"
            actions={[{ label: '링크 복사', icon: <Copy size={18} /> }, { label: '지도 이미지 저장', icon: <Download size={18} /> }, { label: '목록에서 삭제', tone: 'danger', icon: <Trash2 size={18} /> }]} />
          <Button variant="filled" onClick={() => setSheet(true)} startIcon={<Pencil />}>장소 편집</Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="장소 편집"
            leading={<Button variant="plain" onClick={() => setSheet(false)}>취소</Button>}
            trailing={<Button variant="plain" style={{ fontWeight: 700 }} onClick={() => { setSheet(false); toast({ title: '저장했어요', tone: 'success' }); }}>완료</Button>}>
            <Stack gap={4}>
              <TextField label="이름" defaultValue="헤론 포인트" clearable />
              <TextField label="메모" multiline defaultValue="주차는 입구 왼쪽 공영주차장." />
              <ListSection header="옵션"><List>
                <ListItem title="지도에 고정" trailing={<Switch defaultChecked aria-label="지도에 고정" />} />
                <ListItem title="오프라인 저장" trailing={<Switch aria-label="오프라인 저장" />} />
              </List></ListSection>
              <Text variant="footnote" tone="tertiary">손잡이나 제목 부분을 아래로 끌어 닫을 수 있어요.</Text>
            </Stack>
          </Sheet>
        </Demo>
      </Section>
      <Drawers />
      <Section title="컨텍스트 메뉴 · 토스트" intro="길게 누르거나 마우스 오른쪽 버튼을 클릭하면(키보드: Shift+F10) 항목이 떠오르고 메뉴가 옆에 나타납니다.">
        <Demo>
          <ContextMenu aria-label="사진" menu={<>
            <MenuItem icon={<Share />}>공유</MenuItem><MenuItem icon={<Heart />}>즐겨찾기</MenuItem><MenuItem icon={<Copy />}>복사</MenuItem>
            <MenuSeparator /><MenuItem icon={<Trash2 />} tone="danger">삭제</MenuItem></>}>
            <button type="button" style={{ border: 0, padding: 0, borderRadius: 16, overflow: 'hidden', width: 180, height: 120, cursor: 'pointer' }} aria-label="노을 사진"><Photo scene={1} style={{ width: '100%', height: '100%' }} /></button>
          </ContextMenu>
          <Button variant="neutral" onClick={() => toast({ title: '오프라인 지도를 받았어요', description: '서울 · 312 MB', tone: 'success' })}>토스트</Button>
          <Button variant="neutral" onClick={() => toast({ title: '연결이 끊겼어요', tone: 'danger', action: { label: '다시 시도', onClick: () => {} } })}>오류 토스트</Button>
        </Demo>
      </Section>
    </Page>
  );
}


/* a little console for the top drawer: commands echo into a log that scrolls, newest at the bottom */
const CONSOLE_HELP = ['help — 명령 목록', 'status — 서버 상태', 'fps — 화면 갱신 빈도', 'clear — 지우기'];
function ConsoleBody() {
  const [lines, setLines] = useState<string[]>(['Satin Glass 콘솔 · ` 키로 열고 닫아요', 'help를 입력해 보세요']);
  const [cmd, setCmd] = useState('');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [lines]);
  const run = (c: string) => {
    const k = c.trim().toLowerCase();
    if (!k) return;
    if (k === 'clear') { setLines([]); return; }
    const out = k === 'help' ? CONSOLE_HELP : k === 'status' ? ['api 정상 · 지연 42ms', 'db 정상 · 연결 18/64'] : k === 'fps' ? [`${Math.round(55 + Math.random() * 5)} fps`] : [`알 수 없는 명령: ${k}`];
    setLines((l) => [...l, `> ${c}`, ...out]);
  };
  return (
    <div className="console">
      <div ref={log} className="console__log" role="log" aria-live="polite">{lines.map((l, i) => <div key={i} className={l.startsWith('> ') ? 'console__cmd' : undefined}>{l}</div>)}</div>
      <form className="console__prompt" onSubmit={(e) => { e.preventDefault(); run(cmd); setCmd(''); }}>
        <span aria-hidden="true">&gt;</span>
        <input aria-label="명령" value={cmd} onChange={(e) => setCmd(e.target.value)} autoComplete="off" spellCheck={false} data-autofocus />
      </form>
    </div>
  );
}

/* a log for the bottom drawer: a level filter over lines that scroll */
const LOG_LINES: { t: string; lv: 'info' | 'warn' | 'error'; m: string }[] = [
  { t: '14:02:11', lv: 'info', m: 'build 시작 · 커밋 c132b91' },
  { t: '14:02:13', lv: 'info', m: 'pnpm install · 캐시 사용 (412 패키지)' },
  { t: '14:02:31', lv: 'warn', m: 'tokens: label-tertiary 대비 4.61 (기준 4.5에 가까움)' },
  { t: '14:02:44', lv: 'info', m: 'core · react · docs 빌드 완료 (38초)' },
  { t: '14:03:20', lv: 'error', m: 'e2e 2/4: edge cases · 시간 초과, 다시 시도' },
  { t: '14:05:02', lv: 'info', m: 'e2e 2/4: 다시 시도해 통과' },
  { t: '14:05:40', lv: 'info', m: 'pages 배포 · webispy.github.io/satin-glass' },
  { t: '14:05:41', lv: 'info', m: '완료 · 3분 30초' },
  /* a busy afternoon after it, so there is a log to grow the drawer for */
  ...Array.from({ length: 36 }, (_, i): { t: string; lv: 'info' | 'warn' | 'error'; m: string } => {
    const m = 6 + i, t = `14:${String(Math.floor(m / 1) % 60).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;
    return i % 11 === 7 ? { t, lv: 'error', m: `api 응답 502 · /orders?page=${i} · 재시도 1회` }
      : i % 5 === 3 ? { t, lv: 'warn', m: `느린 요청 ${820 + i * 13}ms · /search?q=숲길` }
      : { t, lv: 'info', m: `GET /places/${1000 + i * 7} 200 · ${18 + (i * 7) % 40}ms` };
  }),
];
function LogBody() {
  const [lv, setLv] = useState<'all' | 'warn' | 'error'>('all');
  const shown = LOG_LINES.filter((l) => lv === 'all' || (lv === 'warn' ? l.lv !== 'info' : l.lv === 'error'));
  return (
    <div className="console">
      <SegmentedControl size="sm" aria-label="수준" value={lv} onChange={setLv} options={[{ value: 'all', label: '전체' }, { value: 'warn', label: '경고 이상' }, { value: 'error', label: '오류' }]} style={{ alignSelf: 'flex-start' }} />
      <div className="console__log" role="log">{shown.map((l) => <div key={l.t + l.m} className={`log--${l.lv}`}><span className="log__t">{l.t}</span> {l.m}</div>)}</div>
    </div>
  );
}
