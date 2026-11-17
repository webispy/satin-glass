/* Edge cases in one place: long text, many items, disabled and refused (controlled) states, empty states.
   The e2e edge suite drives this page; it is also a quick way to eyeball the awkward cases. */
import { useRef, useState } from 'react';
import {
  Button, ButtonGroup, Chip, Dialog, IconButton, List, ListItem, ListSection, Menu, MenuItem, PageControl, Progress, SearchField,
  SegmentedControl, Slider, Stack, Stepper, Switch, Tab, TabBar, Text, TextField, Badge,
} from '@glass-layer/react';
import { Home, Map, Bookmark, User, Settings, Bell, Heart, Share, Trash2 } from 'lucide-react';
import { Demo, Page, Section } from '../shared';

const LONG = '아주 긴 이름을 가진 장소 — Very long place name that keeps going past any sensible width';

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
