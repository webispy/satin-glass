import { useRef, useState } from 'react';
import {
  ActionSheet, AppBar, Avatar, Badge, BadgeAnchor, Button, ButtonGroup, Card, CardBody, Chip, ContextMenu, Dialog, Glass,
  ChoiceList, IconButton, List, ListItem, ListSection, Menu, MenuItem, MenuLabel, MenuSeparator, NavigationPage, NavigationStack, PageControl, Pagination, Popover, Progress, SearchField,
  SegmentedControl, Sheet, Sidebar, SidebarItem, SidebarSection, Slider, Spinner, Stack, Stepper, Switch, Tab, TabBar, TabBarAction,
  Tabs, Text, TextField, useNavigation, useToast,
} from '@glass-layer/react';
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
      <Section title="아이콘 버튼과 그룹" intro="아이콘 버튼은 둥근 사각형이 기본(원형은 shape='round'). 그룹은 유리 한 장을 나눠 씁니다 — 유리 위에 유리를 겹치지 않아요.">
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
      <Section title="스위치 · 슬라이더 · 스테퍼" intro="스위치는 누르는 동안 손잡이가 가는 쪽으로 늘어나고 끌어서도 켭니다. 슬라이더는 잡으면 유리 말풍선에 값이 뜹니다.">
        <Demo col>
          <div className="label-row"><Text>Wi‑Fi</Text><Switch checked={wifi} onChange={setWifi} aria-label="Wi‑Fi" /></div>
          <div className="label-row"><Text>오프라인 지도</Text><Switch defaultChecked={false} aria-label="오프라인 지도" /></div>
          <div className="label-row" style={{ gap: 24 }}><Text style={{ flex: 'none' }}>거리</Text><Slider value={vol} onChange={setVol} format={(v) => `${v} km`} aria-label="거리" style={{ flex: 1, maxWidth: 360 }} /></div>
          <div className="label-row"><Text>인원</Text><Stepper value={guests} onChange={setGuests} min={1} max={12} label="인원" format={(v) => `${v}명`} /></div>
        </Demo>
      </Section>
      <Section title="세그먼트" intro="선택 표시가 물방울처럼 늘어나 다음 칸까지 이어졌다가 모입니다. 끌어서 고를 수도 있어요.">
        <Demo col>
          <SegmentedControl aria-label="보기" value={view} onChange={setView} options={[{ value: 'map', label: '지도' }, { value: 'list', label: '목록' }, { value: 'photo', label: '사진' }, { value: 'saved', label: '저장됨' }]} />
          <SegmentedControl size="sm" aria-label="이동 수단" defaultValue="walk" options={[{ value: 'walk', label: '도보', icon: <Footprints /> }, { value: 'bike', label: '자전거', icon: <Bike /> }, { value: 'car', label: '차', icon: <Car /> }]} style={{ maxWidth: 340 }} />
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
    <Page title="내비게이션" intro="떠 있는 유리 바. 화면 가장자리에서 12px 띄우고, 모서리는 고정 반경 22px입니다. 페이지 안의 구역은 탭으로, 긴 목록은 페이지 이동으로 나눕니다.">
      <Section title="탭 바" intro="탭하면 선택 표시가 물방울처럼 늘어나 이어졌다가 새 탭에서 모입니다. 바 위를 끌면 손가락을 따라가고, 놓으면 그 탭이 선택됩니다. 표시는 바 안에만 머뭅니다.">
        <Demo media style={{ padding: 0, minHeight: 220 }}>
          <Photo scene={0} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, maxWidth: 460, margin: '0 auto' }}>
            <TabBar value={tab} onChange={setTab} aria-label="메인" action={<TabBarAction icon={<Search />} label="검색" />}>
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
          <div style={{ position: 'relative', width: '100%', color: 'var(--gl-label)' }}>
            <AppBar title="즐겨찾기" leading={<IconButton icon={<ChevronLeft />} label="뒤로" />} trailing={<><IconButton icon={<Share />} label="공유" /><IconButton icon={<Plus />} label="추가" /></>} style={{ position: 'relative' }} />
          </div>
        </Demo>
      </Section>
      <Section title="사이드바 · 페이지 컨트롤">
        <div className="grid grid--2">
          <Demo media style={{ padding: 12, minHeight: 300 }}>
            <Photo scene={2} style={{ position: 'absolute', inset: 0 }} />
            <Sidebar style={{ position: 'relative', height: 276, width: 240, color: 'var(--gl-label)' }}>
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
      <Section title="탭" intro="한 페이지 안의 구역을 나눕니다. 밑줄은 탭 바·세그먼트와 같은 물방울이라 같은 방식으로 이동합니다. 방향키로 옮기면 바로 선택되고(수동으로 하려면 activation=&quot;manual&quot;), 새 패널은 이동한 쪽에서 들어옵니다. 무거운 패널은 탭을 누른 프레임을 막지 않게 늦게 그립니다.">
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
          <Text variant="subhead" tone="secondary">탭이 많으면 줄이 가로로 스크롤되고, 더 있는 쪽 끝이 흐려집니다. 선택한 탭은 늘 보이는 곳으로 옵니다.</Text>
          <div style={{ maxWidth: 420 }}>
            <Tabs aria-label="분류" activation="manual" defaultValue="digital" items={['전체', '의류', '생활', '주방', '문구', '디지털', '반려동물', '캠핑', '선물 포장', '할인 중'].map((l, i) => ({ value: ['all', 'wear', 'home', 'kitchen', 'paper', 'digital', 'pet', 'camp', 'gift', 'sale'][i], label: l }))} />
          </div>
        </Demo>
      </Section>
      <Section title="페이지 이동" intro="처음과 끝, 지금 페이지의 이웃을 보여 주고 사이는 …로 접습니다. 지금 페이지가 가운데에서 움직이는 동안 버튼 개수가 그대로라 포인터 밑에서 버튼이 밀리지 않습니다. 좁은 곳에서는 ‘6 / 40’으로 바뀝니다.">
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
          <ListItem leading={<User />} tileColor="var(--gl-iris-500)" title="프로필" subtitle="hello@example.com" chevron onClick={() => nav.push(<ProfilePage />)} />
          <ListItem leading={<Bell />} tileColor="var(--gl-coral-500)" title="알림" trailing={<Switch checked={notif} onChange={setNotif} aria-label="알림" />} />
          <ListItem leading={<Moon />} tileColor="var(--gl-orchid-600)" title="화면 모드" trailing={MODES[mode]} chevron onClick={() => nav.push(<AppearancePage initial={mode} onChange={setMode} />)} />
          <ListItem leading={<Wifi />} tileColor="var(--gl-azure-500)" title="오프라인 지도" trailing={<Badge tone="accent">NEW</Badge>} chevron onClick={() => nav.push(<NavigationPage title="오프라인 지도"><ListSection footer="내려받은 지도는 연결이 없어도 볼 수 있어요."><List><ListItem title="서울" subtitle="312 MB" /><ListItem title="부산" subtitle="188 MB" /></List></ListSection></NavigationPage>)} />
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
          <ListItem leading={<Mail />} tileColor="var(--gl-azure-500)" title="이메일" trailing="hello@example.com" />
          <ListItem leading={<ShieldCheck />} tileColor="var(--gl-jade-600)" title="계정 보안" chevron onClick={() => nav.push(<SecurityPage />)} />
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
          <ListItem leading={<KeyRound />} tileColor="var(--gl-amber-500)" title="비밀번호 변경" chevron onClick={() => nav.push(<PasswordPage />)} />
          <ListItem leading={<Lock />} tileColor="var(--gl-slate-500)" title="2단계 인증" trailing={<Switch checked={twoStep} onChange={setTwoStep} aria-label="2단계 인증" />} />
          <ListItem leading={<Smartphone />} tileColor="var(--gl-iris-500)" title="로그인한 기기" trailing="2대" chevron onClick={() => nav.push(<DevicesPage />)} />
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
        <TextField label="지금 비밀번호" type="password" />
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
          <ListItem leading={<Smartphone />} tileColor="var(--gl-iris-500)" title="이 휴대폰" subtitle="지금 사용 중" />
          <ListItem leading={<Laptop />} tileColor="var(--gl-slate-500)" title="노트북" subtitle="3일 전" />
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
        { value: 'light', label: '라이트', icon: <Sun />, tileColor: 'var(--gl-amber-500)' },
        { value: 'dark', label: '다크', icon: <Moon />, tileColor: 'var(--gl-iris-700)' },
        { value: 'system', label: '시스템 설정', description: '기기 설정을 따라요', icon: <Monitor />, tileColor: 'var(--gl-slate-500)' },
      ]} />
    </NavigationPage>
  );
}

export function Lists() {
  return (
    <Page title="목록과 표시" intro="그룹 목록, 카드, 아바타, 배지, 진행 표시.">
      <div className="grid grid--2">
        <Stack gap={3}>
          <div data-demo="nav-stack">
            <NavigationStack labels={{ back: '뒤로' }} className="settings-stack"><SettingsRoot /></NavigationStack>
          </div>
          <Text variant="footnote" tone="secondary">줄을 누르면 다음 페이지가 오른쪽에서 들어옵니다(설정 › 프로필 › 계정 보안 › 비밀번호 변경, 깊이 제한 없음). 왼쪽 위 버튼은 바로 아래 페이지의 이름으로 돌아가고, 터치에서는 왼쪽 가장자리에서 밀어도 돌아갑니다. 아래 페이지는 스크롤 위치와 상태를 그대로 갖고 있어요.</Text>
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
    </Page>
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
          <ActionSheet open={as} onClose={() => setAs(false)} title="헤론 포인트" message="이 장소를 어떻게 보낼까요?"
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
      <Section title="컨텍스트 메뉴 · 토스트" intro="길게 누르거나 오른쪽 클릭(키보드: Shift+F10)하면 항목이 떠오르고 메뉴가 옆에 나타납니다.">
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

