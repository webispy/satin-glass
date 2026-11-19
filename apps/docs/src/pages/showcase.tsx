import { useRef, useState } from 'react';
import {
  AppBar, Badge, Button, Chip, ContextMenu, Glass, IconButton, List, ListItem, ListSection, Menu, MenuItem, MenuSeparator, PageControl,
  Popover, SearchField, SegmentedControl, Sheet, Slider, Stack, Switch, Tab, TabBar, Text, useToast,
} from '@satin-glass/react';
import { Bookmark, Compass, Heart, Home, Info, Map, MoreHorizontal, Plus, Search, Settings2, Share, Trash2, User, Mountain, Waves, Tent, Building2 } from 'lucide-react';
import { Photo, sceneTint } from '../shared';
import { DisplaySettingsList } from '../settings';

const PLACES = [
  { name: '노을 언덕', dist: '2.4 km', scene: 1, kind: 'hike' },
  { name: '헤론 포인트', dist: '5.1 km', scene: 0, kind: 'beach' },
  { name: '초록 계곡', dist: '8.7 km', scene: 2, kind: 'camp' },
  { name: '별빛 전망대', dist: '12 km', scene: 3, kind: 'view' },
  { name: '하늘 호수', dist: '14 km', scene: 4, kind: 'hike' },
  { name: '황금 들판', dist: '21 km', scene: 5, kind: 'camp' },
];

export function Showcase() {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [tab, setTab] = useState('home');
  const [kind, setKind] = useState('all');
  const [hero, setHero] = useState(0);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState<{ el: HTMLElement; name: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState('');
  const [dist, setDist] = useState(20);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const list = PLACES.filter((p) => kind === 'all' || p.kind === kind);
  const found = PLACES.filter((p) => p.name.includes(q.trim()));
  return (
    <article className="docs__page">
      <header>
        <Text variant="display">쇼케이스</Text>
        <Text variant="callout" tone="secondary" style={{ marginTop: 8 }}>컴포넌트를 실제 앱처럼 조합한 휴대폰 화면. 스크롤, 탭 바 끌기, 카드 길게 누르기, 메뉴와 시트를 모두 써 볼 수 있습니다. 떠 있는 유리 바는 한 화면에 하나만 둡니다 — 아래 탭 바가 떠 있으므로 위 바는 화면에 붙은 불투명 바(attached)입니다. 데스크톱·정보가 많은 화면의 기본 구성은 ‘대시보드’ 예제를 보세요(내용은 불투명 카드, 유리는 떠오르는 메뉴·팝오버·토스트에만).</Text>
      </header>
      <div style={{ display: 'grid', placeItems: 'center', padding: '12px 0 40px' }}>
        <div className="phone">
          <div className="phone__screen" ref={setScroller}>
            <div className="places">
              {/* one floating glass bar per screen: the tab bar floats at the bottom, so the top bar is attached
                  (opaque, flush with the edge) — design-language.md 8.4 */}
              <AppBar scrollTarget={scroller} attached title="둘러보기"
                leading={<IconButton variant="plain" icon={<Settings2 />} label="설정" onClick={() => setSettings(true)} />}
                trailing={<span style={{ display: 'inline-flex', gap: 8 }}>
                  <IconButton variant="plain" icon={<Search />} label="검색" onClick={() => setSearch(true)} />
                  <IconButton ref={moreBtn} variant="plain" icon={<MoreHorizontal />} label="더 보기" onClick={() => setMenu((v) => !v)} />
                </span>} />
              <Photo scene={hero} className="places__hero">
                <div className="places__hero-cap"><Text variant="title-1" style={{ color: '#fff' }}>{PLACES[hero].name}</Text><Text variant="subhead" style={{ color: '#fff', opacity: 0.9 }}>오늘의 추천 · {PLACES[hero].dist}</Text></div>
                <div style={{ position: 'absolute', right: 16, bottom: 18, zIndex: 2 }}>
                  <PageControl count={4} page={hero} onChange={setHero} glass onMedia />
                </div>
              </Photo>
              <div className="places__section">
                <div className="places__chips">
                  {[['all', '전체', Compass], ['hike', '하이킹', Mountain], ['beach', '바다', Waves], ['camp', '캠핑', Tent], ['view', '전망', Building2]].map(([k, l, I]) => {
                    const Icon = I as typeof Compass;
                    return <Chip key={k as string} selected={kind === k} onSelectedChange={() => setKind(k as string)} icon={<Icon />}>{l as string}</Chip>;
                  })}
                </div>
                <Text variant="title-3">즐겨찾기</Text>
                <div className="places__cards">
                  {list.map((p) => (
                    <ContextMenu key={p.name} aria-label={p.name} previewSelector=".photo" menu={<>
                      <MenuItem icon={<Share />} onSelect={() => toast({ title: '링크를 복사했어요', tone: 'success' })}>공유</MenuItem>
                      <MenuItem icon={<Heart />}>즐겨찾기 해제</MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => toast({ title: `${p.name}을(를) 삭제했어요`, action: { label: '실행 취소', onClick: () => {} } })}>삭제</MenuItem>
                    </>}>
                      <button type="button" className="places__card" onClick={() => setHero(p.scene % 4)}>
                        <Photo scene={p.scene} style={{ borderRadius: 18 }}>
                          <Glass variant="clear" tint={sceneTint(p.scene)} style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 2, padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 650 }}>{p.dist}</Glass>
                        </Photo>
                        <Text variant="headline" style={{ marginTop: 8 }}>{p.name}</Text>
                      </button>
                    </ContextMenu>
                  ))}
                </div>
                <ListSection header="가까운 곳">
                  <List>
                    {PLACES.slice(0, 5).map((p) => (
                      <ListItem key={p.name} leading={<Compass />} tileColor={sceneTint(p.scene)} title={p.name} subtitle={`${p.dist} · ${p.kind}`}
                        trailing={<IconButton size="sm" icon={<Info />} label={`${p.name} 정보`} onClick={(e) => setInfo({ el: e.currentTarget, name: p.name })} />} />
                    ))}
                  </List>
                </ListSection>
                <ListSection header="오프라인">
                  <List>
                    <ListItem title="지도 자동 다운로드" trailing={<Switch defaultChecked aria-label="지도 자동 다운로드" />} />
                    <ListItem title="반경" trailing={<span style={{ width: 150, display: 'block' }}><Slider value={dist} onChange={setDist} min={5} max={50} format={(v) => `${v} km`} aria-label="반경" /></span>} />
                  </List>
                </ListSection>
              </div>
            </div>
          </div>
          <div className="phone__fade" />
          <div className="phone__bottom">
            <TabBar value={tab} onChange={setTab} aria-label="메인">
              <Tab value="home" label="홈" icon={<Home />} />
              <Tab value="map" label="지도" icon={<Map />} />
              <Tab value="saved" label="저장" icon={<Bookmark />} badge={<Badge>2</Badge>} />
              <Tab value="me" label="나" icon={<User />} />
            </TabBar>
          </div>
        </div>
      </div>

      <Menu open={menu} onClose={() => setMenu(false)} anchor={moreBtn.current} placement="bottom-end" aria-label="더 보기">
        <MenuItem icon={<Plus />} onSelect={() => toast({ title: '새 장소' })}>장소 추가</MenuItem>
        <MenuItem icon={<Share />}>목록 공유</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Settings2 />} onSelect={() => setSettings(true)}>설정</MenuItem>
      </Menu>
      <Popover open={!!info} onClose={() => setInfo(null)} anchor={info?.el} placement="left" aria-label="장소 정보">
        <Stack gap={2} style={{ width: 230 }}>
          <Text variant="headline">{info?.name}</Text>
          <Text variant="subhead" tone="secondary">오늘 18:42 일몰 · 주차 가능 · 반려동물 동반</Text>
          <Button size="sm" variant="filled" onClick={() => setInfo(null)} style={{ marginTop: 6 }}>길찾기</Button>
        </Stack>
      </Popover>
      <Sheet open={settings} onClose={() => setSettings(false)} title="설정" trailing={<Button variant="plain" onClick={() => setSettings(false)}>완료</Button>}>
        <Stack gap={5}>
          <DisplaySettingsList header="화면" />
          <ListSection header="단위"><SegmentedControl aria-label="단위" defaultValue="km" options={[{ value: 'km', label: '킬로미터' }, { value: 'mi', label: '마일' }]} /></ListSection>
          <ListSection header="알림"><List>
            <ListItem title="일몰 알림" trailing={<Switch defaultChecked aria-label="일몰 알림" />} />
            <ListItem title="새 장소 추천" trailing={<Switch aria-label="새 장소 추천" />} />
          </List></ListSection>
        </Stack>
      </Sheet>
      <Sheet open={search} onClose={() => { setSearch(false); setQ(''); }} size="full" aria-label="검색">
        <Stack gap={4}>
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder="장소 검색" autoFocus />
          <List>{found.map((p) => <ListItem key={p.name} title={p.name} subtitle={p.dist} chevron onClick={() => { setHero(p.scene % 4); setSearch(false); setQ(''); }} />)}</List>
          {!found.length && <Text tone="secondary" style={{ textAlign: 'center', padding: 24 }}>결과가 없어요</Text>}
        </Stack>
      </Sheet>
    </article>
  );
}
