/* Edge cases in one place: long text, many items, disabled and refused (controlled) states, empty states.
   The e2e edge suite drives this page; it is also a quick way to eyeball the awkward cases. */
import { useRef, useState } from 'react';
import {
  Button, ButtonGroup, Checkbox, Chip, DatePicker, Dialog, Select, IconButton, List, ListItem, ListSection, Menu, MenuItem, PageControl, Progress, SearchField,
  SegmentedControl, Slider, Stack, Stepper, Switch, Tab, TabBar, TabBarAction, Text, TextField, Badge,
} from '@satin-glass/react';
import { Home, Map, Bookmark, User, Settings, Bell, Heart, Share, Trash2, Search, Image as ImageIcon, Film, FileText, Music, Download } from 'lucide-react';
import { Demo, Page, Section } from '../shared';

const LONG = '아주 긴 이름을 가진 장소 — Very long place name that keeps going past any sensible width';

/* many items: more segments / tabs than fit on one line (long Korean labels, some with icons) */
const MANY_SEG = [
  { value: 'all', label: '전체' }, { value: 'fav', label: '즐겨찾기', icon: <Heart /> }, { value: 'recent', label: '최근 본 항목' },
  { value: 'shared', label: '공유됨', icon: <Share /> }, { value: 'local', label: '내 기기에만 있는 파일' }, { value: 'photo', label: '사진', icon: <ImageIcon /> },
  { value: 'video', label: '동영상', icon: <Film /> }, { value: 'doc', label: '문서', icon: <FileText /> }, { value: 'music', label: '음악', icon: <Music /> },
  { value: 'down', label: '다운로드', icon: <Download /> }, { value: 'trash', label: '휴지통', icon: <Trash2 /> }, { value: 'etc', label: '분류되지 않은 나머지 항목 전부' },
];
const manyTabs = () => [
  <Tab key="home" value="home" label="홈" icon={<Home />} />,
  <Tab key="map" value="map" label="지도" icon={<Map />} />,
  <Tab key="saved" value="saved" label="저장한 장소 목록" icon={<Bookmark />} badge={<Badge>{3}</Badge>} />,
  <Tab key="bell" value="bell" label="알림" icon={<Bell />} badge={<Badge>{1234}</Badge>} />,
  <Tab key="fav" value="fav" label="좋아요" icon={<Heart />} badge={<Badge dot />} />,
  <Tab key="share" value="share" label="공유" icon={<Share />} />,
  <Tab key="settings" value="settings" label="설정" icon={<Settings />} />,
  <Tab key="me" value="me" label="내 정보와 계정 관리" icon={<User />} />,
  <Tab key="trash" value="trash" label="휴지통" icon={<Trash2 />} />,
];

export function Lab() {
  const [refused] = useState(false);
  const [tries, setTries] = useState(0);
  const [tab, setTab] = useState('a');
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [dlg, setDlg] = useState(false);
  const [n, setN] = useState(0);
  return (
    <Page title="예외 상황 랩" intro="긴 텍스트, 많은 항목, 비활성·거부 상태, 빈 상태를 모아 둔 페이지. 자동 검사(edge.mjs)가 이 페이지를 씁니다.">
      <Section title="긴 텍스트">
        <Demo col>
          <div data-lab="long-buttons" style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
            <Button variant="filled" style={{ maxWidth: 200 }}>{LONG}</Button>
            <Button>{LONG.slice(0, 12)}</Button>
          </div>
          <div data-lab="long-tabs" style={{ maxWidth: 420 }}>
            <TabBar value={tab} onChange={setTab} aria-label="긴 탭">
              <Tab value="a" label={LONG} icon={<Home />} /><Tab value="b" label="지도" icon={<Map />} /><Tab value="c" label={LONG} icon={<Bookmark />} badge={<Badge>{1234}</Badge>} />
              <Tab value="d" label="나" icon={<User />} /><Tab value="e" label="설정" icon={<Settings />} />
            </TabBar>
          </div>
          <div data-lab="long-seg" style={{ maxWidth: 360 }}>
            <SegmentedControl aria-label="긴 세그먼트" defaultValue="x" options={[{ value: 'x', label: LONG }, { value: 'y', label: '짧음' }, { value: 'z', label: LONG }]} />
          </div>
          <div data-lab="long-list" style={{ maxWidth: 360 }}>
            <List>
              <ListItem title={LONG} subtitle={LONG} trailing={LONG.slice(0, 20)} chevron onClick={() => {}} leading={<Heart />} />
              <ListItem title={LONG} trailing={<Switch aria-label="긴 목록 스위치" />} />
            </List>
          </div>
          <div data-lab="long-field" style={{ maxWidth: 360 }}>
            <TextField label={LONG} defaultValue={LONG} helperText={LONG} clearable />
          </div>
          <div data-lab="long-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 360 }}>
            <Chip selected onSelectedChange={() => {}}>{LONG}</Chip><Chip onRemove={() => {}}>{LONG.slice(0, 10)}</Chip>
          </div>
        </Demo>
      </Section>

      <Section title="항목이 너무 많을 때" intro="한 줄에 다 들어가지 않는 세그먼트·탭. 항목마다 최소 폭을 지키고, 넘치면 옆으로 밀어 볼 수 있으며 선택한 항목은 늘 보이는 곳으로 옵니다.">
        <Demo col data-lab="many-seg">
          <Text variant="footnote" tone="secondary">세그먼트 12개 · 전체 폭</Text>
          <div data-lab="many-seg-full"><SegmentedControl aria-label="많은 세그먼트 전체 폭" defaultValue="all" options={MANY_SEG} /></div>
          <Text variant="footnote" tone="secondary">세그먼트 12개 · 360px</Text>
          <div data-lab="many-seg-360" style={{ maxWidth: 360 }}><SegmentedControl aria-label="많은 세그먼트 360" defaultValue="video" options={MANY_SEG} /></div>
          <Text variant="footnote" tone="secondary">세그먼트 8개 · 240px · 작은 크기</Text>
          <div data-lab="many-seg-240" style={{ maxWidth: 240 }}><SegmentedControl aria-label="많은 세그먼트 240" size="sm" defaultValue="all" options={MANY_SEG.slice(0, 8)} /></div>
          <Text variant="footnote" tone="secondary">일부 비활성 · 360px</Text>
          <div data-lab="many-seg-disabled" style={{ maxWidth: 360 }}><SegmentedControl aria-label="많은 세그먼트 일부 비활성" defaultValue="all" options={MANY_SEG.map((o, i) => (i % 4 === 1 ? { ...o, disabled: true } : o))} /></div>
          <Text variant="footnote" tone="secondary">거부되는 제어 값 · 360px (부모가 바꾸지 않음)</Text>
          <div data-lab="many-seg-refused" style={{ maxWidth: 360 }}><SegmentedControl aria-label="많은 세그먼트 거부" value="doc" onChange={() => setTries((t) => t + 1)} options={MANY_SEG} /></div>
        </Demo>
        <Demo col data-lab="many-tabs">
          <Text variant="footnote" tone="secondary">탭 9개 · 360px · 검색 버튼 함께</Text>
          <div data-lab="many-tabs-360-action" style={{ maxWidth: 360 }}>
            <TabBar defaultValue="home" aria-label="많은 탭 360 검색" action={<TabBarAction icon={<Search />} label="검색" />}>{manyTabs()}</TabBar>
          </div>
          <Text variant="footnote" tone="secondary">탭 9개 · 360px</Text>
          <div data-lab="many-tabs-360" style={{ maxWidth: 360 }}><TabBar defaultValue="settings" aria-label="많은 탭 360">{manyTabs()}</TabBar></div>
          <Text variant="footnote" tone="secondary">탭 7개 · 300px · 검색 버튼 함께</Text>
          <div data-lab="many-tabs-300-action" style={{ maxWidth: 300 }}>
            <TabBar defaultValue="home" aria-label="많은 탭 300 검색" action={<TabBarAction icon={<Search />} label="검색" />}>{manyTabs().slice(0, 7)}</TabBar>
          </div>
          <Text variant="footnote" tone="secondary">탭 9개 · 300px · 아이콘만(compact)</Text>
          <div data-lab="many-tabs-300-compact" style={{ maxWidth: 300 }}><TabBar compact defaultValue="home" aria-label="많은 탭 300 아이콘만">{manyTabs()}</TabBar></div>
        </Demo>
      </Section>

      <Section title="비활성">
        <Demo data-lab="disabled">
          <Button variant="filled" disabled>비활성 버튼</Button>
          <IconButton icon={<Share />} label="비활성 아이콘" disabled />
          <Switch aria-label="비활성 스위치" disabled />
          <Switch aria-label="비활성 켜짐 스위치" disabled defaultChecked />
          <div style={{ width: 200 }}><Slider aria-label="비활성 슬라이더" disabled defaultValue={40} /></div>
          <SegmentedControl aria-label="일부 비활성" defaultValue="a" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]} />
          <TextField label="비활성 필드" disabled defaultValue="읽기 전용" />
        </Demo>
      </Section>

      <Section title="거부되는 제어 값 (부모가 바꾸지 않음)">
        <Demo data-lab="refused">
          <Switch aria-label="거부 스위치" checked={refused} onChange={() => setTries((t) => t + 1)} />
          <div style={{ width: 200 }}><Slider aria-label="거부 슬라이더" value={30} onChange={() => setTries((t) => t + 1)} /></div>
          <SegmentedControl aria-label="거부 세그먼트" value="a" onChange={() => setTries((t) => t + 1)} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
          <Text variant="footnote" tone="secondary" data-lab="tries">시도 {tries}</Text>
        </Demo>
      </Section>

      <Section title="경계값과 빈 상태">
        <Demo col data-lab="bounds">
          <Stepper label="경계 스테퍼" value={n} onChange={setN} min={0} max={3} />
          <Progress value={150} label="넘치는 진행" />
          <Progress value={-20} label="음수 진행" />
          <PageControl count={1} label="한 쪽" />
          <List data-lab="empty-list" />
          <SearchField placeholder="빈 검색" />
          <ButtonGroup><IconButton icon={<Bell />} label="알림" /><IconButton icon={<Trash2 />} label="삭제" /></ButtonGroup>
        </Demo>
      </Section>

      <Section title="선택 컴포넌트">
        <Demo col data-lab="select">
          <div style={{ maxWidth: 320 }}><Select label="긴 항목 40개" placeholder="고르세요" options={Array.from({ length: 40 }, (_, i) => ({ value: `o${i}`, label: i % 7 === 3 ? `${i + 1}. ${LONG}` : `${i + 1}번 항목`, disabled: i % 9 === 5 }))} /></div>
          <div style={{ maxWidth: 320 }}><Select label="거부 셀렉트" value="a" onChange={() => setTries((t) => t + 1)} options={[{ value: 'a', label: '가' }, { value: 'b', label: '나' }]} /></div>
          <div style={{ maxWidth: 320 }}><Select label="비활성 셀렉트" disabled options={[{ value: 'a', label: '가' }]} /></div>
          <div style={{ maxWidth: 320 }}><DatePicker label="이번 달만" min={new Date(new Date().getFullYear(), new Date().getMonth(), 1)} max={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)} /></div>
          <Checkbox label={LONG} description={LONG} />
          <div data-lab="inner-scroll" style={{ height: 180, overflow: 'auto', border: '1px dashed var(--sg-separator)', borderRadius: 12, padding: 12 }}>
            <div style={{ height: 120 }}>안쪽 스크롤 영역 ↓</div>
            <Select label="안쪽 스크롤 안의 셀렉트" options={[{ value: 'a', label: '가' }, { value: 'b', label: '나' }, { value: 'c', label: '다' }]} />
            <div style={{ height: 300 }} />
          </div>
        </Demo>
      </Section>

      <Section title="연타용">
        <Demo data-lab="spam">
          <Button ref={menuBtn} variant="tinted" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>메뉴 토글</Button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={menuBtn.current} aria-label="연타 메뉴">
            <MenuItem>하나</MenuItem><MenuItem>둘</MenuItem>
          </Menu>
          <Button variant="neutral" onClick={() => setDlg(true)}>대화상자</Button>
          <Dialog open={dlg} onClose={() => setDlg(false)} title="연타 대화상자" dismissible actions={<Button variant="filled" onClick={() => setDlg(false)}>닫기</Button>}>내용</Dialog>
        </Demo>
      </Section>
      <ListSection header="끝"><Stack><Text tone="tertiary">—</Text></Stack></ListSection>
    </Page>
  );
}
