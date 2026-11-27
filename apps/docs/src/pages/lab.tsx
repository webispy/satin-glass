/* Edge cases in one place: long text, many items, disabled and refused (controlled) states, empty states.
   The e2e edge suite drives this page; it is also a quick way to eyeball the awkward cases. */
import { useEffect, useRef, useState } from 'react';
import { A2uiSurfaces, useA2ui } from '@satin-glass/a2ui';
import chatMessage from '../../../../packages/a2ui/test/fixtures/v1/chat-message.json';
import contactCard from '../../../../packages/a2ui/test/fixtures/v1/contact-card.json';
import { A2UI_ICONS } from '../a2ui/icons';
import {
  Button, ButtonGroup, Checkbox, Chip, DatePicker, Dialog, Divider, Select, IconButton, List, ListItem, ListSection, Menu, MenuItem, PageControl, Progress, SearchField,
  SegmentedControl, Slider, Stack, Stepper, Switch, Tab, TabBar, TabBarAction, Text, TextField, Badge,
} from '@satin-glass/react';
import { Home, Map, Bookmark, User, Settings, Bell, Heart, Share, Trash2, Search, Image as ImageIcon, Film, FileText, Music, Download } from 'lucide-react';
import { Demo, Page, Section } from '../shared';
import { L, useLocale, useT } from '../i18n';

type T = ReturnType<typeof useT>;

/* a label longer than any sensible width (the Korean one mixes both scripts) */
const LONG_TEXT = { en: 'A place with a very, very long name — Very long place name that keeps going past any sensible width', ko: '아주 긴 이름을 가진 장소 — Very long place name that keeps going past any sensible width' };

/* many items: more segments / tabs than fit on one line (long labels, some with icons) */
const manySeg = (t: T) => [
  { value: 'all', label: t({ en: 'All', ko: '전체' }) }, { value: 'fav', label: t({ en: 'Favourites', ko: '즐겨찾기' }), icon: <Heart /> }, { value: 'recent', label: t({ en: 'Recently viewed', ko: '최근 본 항목' }) },
  { value: 'shared', label: t({ en: 'Shared', ko: '공유됨' }), icon: <Share /> }, { value: 'local', label: t({ en: 'Files only on this device', ko: '내 기기에만 있는 파일' }) }, { value: 'photo', label: t({ en: 'Photos', ko: '사진' }), icon: <ImageIcon /> },
  { value: 'video', label: t({ en: 'Videos', ko: '동영상' }), icon: <Film /> }, { value: 'doc', label: t({ en: 'Documents', ko: '문서' }), icon: <FileText /> }, { value: 'music', label: t({ en: 'Music', ko: '음악' }), icon: <Music /> },
  { value: 'down', label: t({ en: 'Downloads', ko: '다운로드' }), icon: <Download /> }, { value: 'trash', label: t({ en: 'Trash', ko: '휴지통' }), icon: <Trash2 /> }, { value: 'etc', label: t({ en: 'Everything else without a category', ko: '분류되지 않은 나머지 항목 전부' }) },
];
const manyTabs = (t: T) => [
  <Tab key="home" value="home" label={t({ en: 'Home', ko: '홈' })} icon={<Home />} />,
  <Tab key="map" value="map" label={t({ en: 'Map', ko: '지도' })} icon={<Map />} />,
  <Tab key="saved" value="saved" label={t({ en: 'List of saved places', ko: '저장한 장소 목록' })} icon={<Bookmark />} badge={<Badge>{3}</Badge>} />,
  <Tab key="bell" value="bell" label={t({ en: 'Alerts', ko: '알림' })} icon={<Bell />} badge={<Badge>{1234}</Badge>} />,
  <Tab key="fav" value="fav" label={t({ en: 'Likes', ko: '좋아요' })} icon={<Heart />} badge={<Badge dot />} />,
  <Tab key="share" value="share" label={t({ en: 'Share', ko: '공유' })} icon={<Share />} />,
  <Tab key="settings" value="settings" label={t({ en: 'Settings', ko: '설정' })} icon={<Settings />} />,
  <Tab key="me" value="me" label={t({ en: 'My profile and account', ko: '내 정보와 계정 관리' })} icon={<User />} />,
  <Tab key="trash" value="trash" label={t({ en: 'Trash', ko: '휴지통' })} icon={<Trash2 />} />,
];

/* A2UI tokens too long for a word (#100): the gallery's Chat Message and Contact Card given a long URL, ID and email
   address, and a short label beside a long sentence, in a surface of `width` px. The e2e a2ui suite measures them */
type Msg = { version: string; [k: string]: unknown };
const LONG_TOKENS = {
  email: 'alexandra.konstantinopoulou@engineering-department.example.com',
  text: 'Build is green: https://ci.example.com/acme/satin-glass/actions/runs/46002908302/attempts/2 — ticket ORD-2026-11-27-ABCDEFGHIJKLMNOP',
};
function a2uiLongMessages(width: number): Msg[] {
  const rename = (m: Msg, id: string): Msg => JSON.parse(JSON.stringify(m).replaceAll('"gallery-chat-message"', `"${id}"`).replaceAll('"gallery-contact-card"', `"${id}"`));
  const chat = (chatMessage as { messages: Msg[] }).messages.map((m) => rename(m, `long-chat-${width}`));
  const contact = (contactCard as { messages: Msg[] }).messages.map((m) => rename(m, `long-contact-${width}`));
  for (const m of chat) {
    const v = (m.updateDataModel as { value?: { messages?: { username: string; text: string }[] } } | undefined)?.value;
    if (v?.messages?.[0]) { v.messages[0].text = LONG_TOKENS.text; v.messages[0].username = 'mike.chen.engineering.lead.2026'; }
  }
  for (const m of contact) {
    const v = (m.updateDataModel as { value?: { email?: string } } | undefined)?.value;
    if (v?.email) v.email = LONG_TOKENS.email;
  }
  /* a short label beside a long sentence: the label stays one word on one line, the sentence wraps */
  const id = `long-label-${width}`, cat = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
  const label: Msg[] = [
    { version: '1.0', createSurface: { surfaceId: id, catalogId: cat } },
    { version: '1.0', updateComponents: { surfaceId: id, components: [
      { id: 'root', component: 'Card', child: 'row' }, { id: 'row', component: 'Row', children: ['k', 'v'] },
      { id: 'k', component: 'Text', text: 'Status:' },
      { id: 'v', component: 'Text', text: 'Waiting for the warehouse to confirm that every item in the order has been packed and labelled' },
    ] } },
  ];
  return [...chat, ...contact, ...label];
}
function A2uiLong({ width }: { width: number }) {
  const a2ui = useA2ui({ icons: A2UI_ICONS });
  /* once: the session keeps its surfaces through StrictMode's second run of the effect */
  const fed = useRef(false);
  useEffect(() => { if (fed.current) return; fed.current = true; for (const m of a2uiLongMessages(width)) a2ui.process(m as never); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return <div data-lab={`a2ui-long-${width}`} style={{ width, maxWidth: '100%', display: 'grid', gap: 12 }}><A2uiSurfaces a2ui={a2ui} /></div>;
}

export function Lab() {
  const t = useT(), locale = useLocale(), MANY_SEG = manySeg(t), LONG = t(LONG_TEXT);
  const [refused] = useState(false);
  const [tries, setTries] = useState(0);
  const [tab, setTab] = useState('a');
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [dlg, setDlg] = useState(false);
  const [n, setN] = useState(0);
  return (
    <Page title={t({ en: 'Edge-case lab', ko: '예외 상황 랩' })} intro={<L
      en="Long text, many items, disabled states, controlled values the parent does not apply, and empty states, all on one page. The automated checks (edge.mjs) use it."
      ko="긴 텍스트, 많은 항목, 비활성 상태, 반영되지 않는 제어 값, 빈 상태를 모아 둔 페이지입니다. 자동 검사(edge.mjs)에서 이 페이지를 사용합니다." />}>
      <Section title={t({ en: 'Long text', ko: '긴 텍스트' })}>
        <Demo col>
          <div data-lab="long-buttons" style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
            <Button variant="filled" style={{ maxWidth: 200 }}>{LONG}</Button>
            <Button>{LONG.slice(0, 12)}</Button>
          </div>
          <div data-lab="long-tabs" style={{ maxWidth: 420 }}>
            <TabBar draggable value={tab} onChange={setTab} aria-label={t({ en: 'Long tabs', ko: '긴 탭' })}>
              <Tab value="a" label={LONG} icon={<Home />} /><Tab value="b" label={t({ en: 'Map', ko: '지도' })} icon={<Map />} /><Tab value="c" label={LONG} icon={<Bookmark />} badge={<Badge>{1234}</Badge>} />
              <Tab value="d" label={t({ en: 'Me', ko: '나' })} icon={<User />} /><Tab value="e" label={t({ en: 'Settings', ko: '설정' })} icon={<Settings />} />
            </TabBar>
          </div>
          <div data-lab="long-seg" style={{ maxWidth: 360 }}>
            <SegmentedControl aria-label={t({ en: 'Long segments', ko: '긴 세그먼트' })} defaultValue="x" options={[{ value: 'x', label: LONG }, { value: 'y', label: t({ en: 'Short', ko: '짧음' }) }, { value: 'z', label: LONG }]} />
          </div>
          <div data-lab="long-list" style={{ maxWidth: 360 }}>
            <List>
              <ListItem title={LONG} subtitle={LONG} trailing={LONG.slice(0, 20)} chevron onClick={() => {}} leading={<Heart />} />
              <ListItem title={LONG} trailing={<Switch aria-label={t({ en: 'Long list switch', ko: '긴 목록 스위치' })} />} />
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

      <Section title={t({ en: 'Too many items', ko: '항목이 너무 많을 때' })} intro={<L
        en="Segments and tabs that do not fit on one line. Each item keeps a minimum width, the overflow scrolls horizontally, and the selected item is always scrolled into view."
        ko="한 줄에 다 들어가지 않는 세그먼트와 탭입니다. 항목마다 최소 폭을 지키고, 넘치는 부분은 가로로 스크롤해 볼 수 있고, 선택한 항목은 항상 보이도록 스크롤됩니다." />}>
        <Demo col data-lab="many-seg">
          <Text variant="footnote" tone="secondary">{t({ en: '12 segments · full width', ko: '세그먼트 12개 · 전체 폭' })}</Text>
          <div data-lab="many-seg-full"><SegmentedControl aria-label={t({ en: 'Many segments, full width', ko: '많은 세그먼트 전체 폭' })} defaultValue="all" options={MANY_SEG} /></div>
          <Text variant="footnote" tone="secondary">{t({ en: '12 segments · 360px', ko: '세그먼트 12개 · 360px' })}</Text>
          <div data-lab="many-seg-360" style={{ maxWidth: 360 }}><SegmentedControl aria-label={t({ en: 'Many segments 360', ko: '많은 세그먼트 360' })} defaultValue="video" options={MANY_SEG} /></div>
          <Text variant="footnote" tone="secondary">{t({ en: '8 segments · 240px · small', ko: '세그먼트 8개 · 240px · 작은 크기' })}</Text>
          <div data-lab="many-seg-240" style={{ maxWidth: 240 }}><SegmentedControl aria-label={t({ en: 'Many segments 240', ko: '많은 세그먼트 240' })} size="sm" defaultValue="all" options={MANY_SEG.slice(0, 8)} /></div>
          <Text variant="footnote" tone="secondary">{t({ en: 'Some disabled · 360px', ko: '일부 비활성 · 360px' })}</Text>
          <div data-lab="many-seg-disabled" style={{ maxWidth: 360 }}><SegmentedControl aria-label={t({ en: 'Many segments, some disabled', ko: '많은 세그먼트 일부 비활성' })} defaultValue="all" options={MANY_SEG.map((o, i) => (i % 4 === 1 ? { ...o, disabled: true } : o))} /></div>
          <Text variant="footnote" tone="secondary">{t({ en: 'Controlled value not applied · 360px (the parent does not update value)', ko: '반영되지 않는 제어 값 · 360px (부모가 value를 바꾸지 않음)' })}</Text>
          <div data-lab="many-seg-refused" style={{ maxWidth: 360 }}><SegmentedControl aria-label={t({ en: 'Many segments, refused', ko: '많은 세그먼트 변경 거부' })} value="doc" onChange={() => setTries((x) => x + 1)} options={MANY_SEG} /></div>
        </Demo>
        <Demo col data-lab="many-tabs">
          <Text variant="footnote" tone="secondary">{t({ en: '9 tabs · 360px · with a search button', ko: '탭 9개 · 360px · 검색 버튼 포함' })}</Text>
          <div data-lab="many-tabs-360-action" style={{ maxWidth: 360 }}>
            <TabBar draggable defaultValue="home" aria-label={t({ en: 'Many tabs 360 with search', ko: '많은 탭 360 검색' })} action={<TabBarAction icon={<Search />} label={t({ en: 'Search', ko: '검색' })} />}>{manyTabs(t)}</TabBar>
          </div>
          <Text variant="footnote" tone="secondary">{t({ en: '9 tabs · 360px', ko: '탭 9개 · 360px' })}</Text>
          <div data-lab="many-tabs-360" style={{ maxWidth: 360 }}><TabBar draggable defaultValue="settings" aria-label={t({ en: 'Many tabs 360', ko: '많은 탭 360' })}>{manyTabs(t)}</TabBar></div>
          <Text variant="footnote" tone="secondary">{t({ en: '7 tabs · 300px · with a search button', ko: '탭 7개 · 300px · 검색 버튼 포함' })}</Text>
          <div data-lab="many-tabs-300-action" style={{ maxWidth: 300 }}>
            <TabBar draggable defaultValue="home" aria-label={t({ en: 'Many tabs 300 with search', ko: '많은 탭 300 검색' })} action={<TabBarAction icon={<Search />} label={t({ en: 'Search', ko: '검색' })} />}>{manyTabs(t).slice(0, 7)}</TabBar>
          </div>
          <Text variant="footnote" tone="secondary">{t({ en: '9 tabs · 300px · icons only (showLabels={false})', ko: '탭 9개 · 300px · 아이콘만(showLabels={false})' })}</Text>
          <div data-lab="many-tabs-300-compact" style={{ maxWidth: 300 }}><TabBar draggable showLabels={false} defaultValue="home" aria-label={t({ en: 'Many tabs 300 icons only', ko: '많은 탭 300 아이콘만' })}>{manyTabs(t)}</TabBar></div>
          <Text variant="footnote" tone="secondary">{t({ en: 'Icons only · a tab without an icon shows its label', ko: '아이콘만 · 아이콘 없는 탭은 라벨을 표시함' })}</Text>
          <div data-lab="tabs-icons-text" style={{ maxWidth: 300 }}><TabBar showLabels={false} defaultValue="home" aria-label={t({ en: 'Icons only, one text tab', ko: '아이콘만, 텍스트 탭 하나' })}>{[<Tab key="home" value="home" label={t({ en: 'Home', ko: '홈' })} icon={<Home />} />, <Tab key="map" value="map" label={t({ en: 'Map', ko: '지도' })} icon={<Map />} />, <Tab key="more" value="more" label={t({ en: 'More', ko: '더 보기' })} />]}</TabBar></div>
        </Demo>
      </Section>

      <Section title={t({ en: 'No width of their own', ko: '자체 폭이 없는 컴포넌트' })}>
        <Demo col data-lab="fill">
          {/* a divider and a slider in a column that centres its items, and a slider beside a label in a row */}
          <Stack align="center" gap={3} data-lab="fill-column" style={{ width: 320 }}>
            <Text>{t({ en: 'Centred column', ko: '가운데 정렬 세로 스택' })}</Text>
            <Divider />
            <Slider aria-label={t({ en: 'Slider in a centred column', ko: '가운데 정렬 세로 스택의 슬라이더' })} defaultValue={40} />
            {/* with margins: the width left after them, not the column's whole width plus them */}
            <Divider data-lab="fill-inset" style={{ marginInline: 16 }} />
            <Slider data-lab="fill-inset" style={{ marginInline: 16 }} aria-label={t({ en: 'Slider with margins in a centred column', ko: '가운데 정렬 세로 스택에서 여백을 준 슬라이더' })} defaultValue={40} />
          </Stack>
          <Stack direction="row" align="center" gap={3} data-lab="fill-row" style={{ width: 320 }}>
            <Text style={{ flex: 'none' }}>{t({ en: 'Volume', ko: '음량' })}</Text>
            <Slider aria-label={t({ en: 'Slider beside a label', ko: '라벨 옆의 슬라이더' })} defaultValue={40} />
          </Stack>
        </Demo>
      </Section>

      <Section title={t({ en: 'Disabled', ko: '비활성' })}>
        <Demo data-lab="disabled">
          <Button variant="filled" disabled>{t({ en: 'Disabled button', ko: '비활성 버튼' })}</Button>
          <IconButton icon={<Share />} label={t({ en: 'Disabled icon button', ko: '비활성 아이콘 버튼' })} disabled />
          <Switch aria-label={t({ en: 'Disabled switch', ko: '비활성 스위치' })} disabled />
          <Switch aria-label={t({ en: 'Disabled switch, on', ko: '켜진 채 비활성인 스위치' })} disabled defaultChecked />
          <div style={{ width: 200 }}><Slider aria-label={t({ en: 'Disabled slider', ko: '비활성 슬라이더' })} disabled defaultValue={40} /></div>
          <SegmentedControl aria-label={t({ en: 'Some disabled', ko: '일부 비활성' })} defaultValue="a" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]} />
          <TextField label={t({ en: 'Disabled field', ko: '비활성 필드' })} disabled defaultValue={t({ en: 'Can’t be edited', ko: '수정할 수 없음' })} />
        </Demo>
      </Section>

      <Section title={t({ en: 'Controlled values not applied (the parent does not update value)', ko: '반영되지 않는 제어 값 (부모가 value를 바꾸지 않음)' })}>
        <Demo data-lab="refused">
          <Switch aria-label={t({ en: 'Refused switch', ko: '변경 거부 스위치' })} checked={refused} onChange={() => setTries((x) => x + 1)} />
          <div style={{ width: 200 }}><Slider aria-label={t({ en: 'Refused slider', ko: '변경 거부 슬라이더' })} value={30} onChange={() => setTries((x) => x + 1)} /></div>
          <SegmentedControl aria-label={t({ en: 'Refused segments', ko: '변경 거부 세그먼트' })} value="a" onChange={() => setTries((x) => x + 1)} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
          <Text variant="footnote" tone="secondary" data-lab="tries">{t({ en: `Tries ${tries}`, ko: `시도 ${tries}` })}</Text>
        </Demo>
      </Section>

      <Section title={t({ en: 'Limits and empty states', ko: '경계값과 빈 상태' })}>
        <Demo col data-lab="bounds">
          <Stepper label={t({ en: 'Bounded stepper', ko: '경계 스테퍼' })} value={n} onChange={setN} min={0} max={3} />
          <Progress value={150} label={t({ en: 'Progress over the maximum', ko: '최댓값을 넘는 진행률' })} />
          <Progress value={-20} label={t({ en: 'Negative progress', ko: '음수 진행률' })} />
          <PageControl count={1} label={t({ en: 'One page', ko: '페이지 1개' })} />
          <List data-lab="empty-list" />
          <SearchField placeholder={t({ en: 'Empty search', ko: '빈 검색' })} />
          <ButtonGroup><IconButton icon={<Bell />} label={t({ en: 'Notifications', ko: '알림' })} /><IconButton icon={<Trash2 />} label={t({ en: 'Delete', ko: '삭제' })} /></ButtonGroup>
        </Demo>
      </Section>

      <Section title={t({ en: 'Pickers', ko: '선택 컴포넌트' })}>
        <Demo col data-lab="select">
          <div style={{ maxWidth: 320 }}><Select label={t({ en: '40 long items', ko: '긴 항목 40개' })} placeholder={t({ en: 'Choose one', ko: '선택하세요' })} options={Array.from({ length: 40 }, (_, i) => ({ value: `o${i}`, label: i % 7 === 3 ? `${i + 1}. ${LONG}` : t({ en: `Item ${i + 1}`, ko: `${i + 1}번 항목` }), disabled: i % 9 === 5 }))} /></div>
          <div style={{ maxWidth: 320 }}><Select label={t({ en: 'Refused select', ko: '변경 거부 셀렉트' })} value="a" onChange={() => setTries((x) => x + 1)} options={[{ value: 'a', label: t({ en: 'A', ko: '가' }) }, { value: 'b', label: t({ en: 'B', ko: '나' }) }]} /></div>
          <div style={{ maxWidth: 320 }}><Select label={t({ en: 'Disabled select', ko: '비활성 셀렉트' })} disabled options={[{ value: 'a', label: t({ en: 'A', ko: '가' }) }]} /></div>
          <div style={{ maxWidth: 320 }}><DatePicker label={t({ en: 'This month only', ko: '이번 달만' })} locale={locale} min={new Date(new Date().getFullYear(), new Date().getMonth(), 1)} max={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)} /></div>
          <Checkbox label={LONG} description={LONG} />
          <div data-lab="inner-scroll" style={{ height: 180, overflow: 'auto', border: '1px dashed var(--sg-separator)', borderRadius: 12, padding: 12 }}>
            <div style={{ height: 120 }}>{t({ en: 'Inner scroll area ↓', ko: '안쪽 스크롤 영역 ↓' })}</div>
            <Select label={t({ en: 'Select inside a scroll area', ko: '스크롤 영역 안의 셀렉트' })} options={[{ value: 'a', label: t({ en: 'A', ko: '가' }) }, { value: 'b', label: t({ en: 'B', ko: '나' }) }, { value: 'c', label: t({ en: 'C', ko: '다' }) }]} />
            <div style={{ height: 300 }} />
          </div>
        </Demo>
      </Section>

      <Section title={t({ en: 'A2UI: tokens too long for a word', ko: 'A2UI: 단어로 보기엔 긴 토큰' })} intro={<L
        en="A long username, URL, ID and email address in Chat Message and Contact Card wrap within their cards; a short label beside a long sentence stays on one line."
        ko="Chat Message와 Contact Card 안의 긴 사용자 이름, URL, ID, 이메일 주소는 카드 안에서 줄바꿈됩니다. 긴 문장 옆의 짧은 라벨은 중간에 끊기지 않고 한 줄을 유지합니다." />}>
        <Demo>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}><A2uiLong width={320} /><A2uiLong width={390} /></div>
        </Demo>
      </Section>
      <Section title={t({ en: 'Rapid presses', ko: '빠르게 여러 번 누르기' })}>
        <Demo data-lab="spam">
          <Button ref={menuBtn} variant="tinted" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>{t({ en: 'Toggle menu', ko: '메뉴 토글' })}</Button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={menuBtn.current} aria-label={t({ en: 'Rapid-press menu', ko: '연타 메뉴' })}>
            <MenuItem>{t({ en: 'One', ko: '하나' })}</MenuItem><MenuItem>{t({ en: 'Two', ko: '둘' })}</MenuItem>
          </Menu>
          <Button variant="neutral" onClick={() => setDlg(true)}>{t({ en: 'Dialog', ko: '대화상자' })}</Button>
          <Dialog open={dlg} onClose={() => setDlg(false)} title={t({ en: 'Rapid-press dialog', ko: '연타 대화상자' })} dismissible actions={<Button variant="filled" onClick={() => setDlg(false)}>{t({ en: 'Close', ko: '닫기' })}</Button>}>{t({ en: 'Content', ko: '내용' })}</Dialog>
        </Demo>
      </Section>
      <ListSection header={t({ en: 'End', ko: '끝' })}><Stack><Text tone="tertiary">—</Text></Stack></ListSection>
    </Page>
  );
}
