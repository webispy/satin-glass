import { useRef, useState } from 'react';
import {
  AppBar, Badge, Button, Chip, ContextMenu, Glass, IconButton, List, ListItem, ListSection, Menu, MenuItem, MenuSeparator, PageControl,
  Popover, SearchField, SegmentedControl, Sheet, Slider, Stack, Switch, Tab, TabBar, Text, useToast,
} from '@satin-glass/react';
import { Bookmark, Compass, Heart, Home, Info, Map, MoreHorizontal, Plus, Search, Settings2, Share, Trash2, User, Mountain, Waves, Tent, Building2 } from 'lucide-react';
import { Photo, sceneTint } from '../shared';
import { DisplaySettingsList } from '../settings';
import { L, useLang, useT, type Pair } from '../i18n';

const KIND: Record<string, Pair> = { hike: { en: 'Hiking', ko: '하이킹' }, beach: { en: 'Beach', ko: '바다' }, camp: { en: 'Camping', ko: '캠핑' }, view: { en: 'Views', ko: '전망' } };
/* made-up places, named in both languages */
const PLACE_DATA: { name: Pair; dist: string; scene: number; kind: string }[] = [
  { name: { en: 'Sunset Hill', ko: '노을 언덕' }, dist: '2.4 km', scene: 1, kind: 'hike' },
  { name: { en: 'Heron Point', ko: '헤론 포인트' }, dist: '5.1 km', scene: 0, kind: 'beach' },
  { name: { en: 'Green Valley', ko: '초록 계곡' }, dist: '8.7 km', scene: 2, kind: 'camp' },
  { name: { en: 'Starlight Lookout', ko: '별빛 전망대' }, dist: '12 km', scene: 3, kind: 'view' },
  { name: { en: 'Sky Lake', ko: '하늘 호수' }, dist: '14 km', scene: 4, kind: 'hike' },
  { name: { en: 'Golden Fields', ko: '황금 들판' }, dist: '21 km', scene: 5, kind: 'camp' },
];
const usePlaces = () => { const lang = useLang(); return PLACE_DATA.map((p) => ({ ...p, name: p.name[lang] })); };

export function Showcase() {
  const t = useT(), PLACES = usePlaces();
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
  const found = PLACES.filter((p) => p.name.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));
  return (
    <article className="docs__page">
      <header>
        <Text variant="display">{t({ en: 'Showcase', ko: '쇼케이스' })}</Text>
        <Text variant="callout" tone="secondary" style={{ marginTop: 8 }}><L
          en="A phone screen that puts the components together the way a real app would. Scroll, drag the tab bar, long-press a card, and try the menus and sheets. A screen has only one floating glass bar: the tab bar floats at the bottom, so the top bar is opaque and attached to the edge (the attached option). The usual layout for dense, desktop-style screens is in the “Dashboard” example: there the content sits on opaque cards, and glass is kept for the menus, popovers and toasts that float over it."
          ko="컴포넌트를 실제 앱처럼 조합한 휴대폰 화면입니다. 스크롤하고, 탭 바를 끌고, 카드를 길게 누르고, 메뉴와 시트를 열어 볼 수 있습니다. 떠 있는 유리 바는 한 화면에 하나만 둡니다. 하단 탭 바가 떠 있으므로 상단 바는 화면 가장자리에 붙은 불투명 바(attached 옵션)입니다. 데스크톱처럼 정보가 많은 화면의 기본 구성은 ‘대시보드’ 예제에 있습니다. 대시보드에서는 내용을 불투명 카드에 담고, 유리는 그 위에 뜨는 메뉴·팝오버·토스트에만 씁니다." /></Text>
      </header>
      <div style={{ display: 'grid', placeItems: 'center', padding: '12px 0 40px' }}>
        <div className="phone">
          <div className="phone__screen" ref={setScroller}>
            <div className="places">
              {/* one floating glass bar per screen: the tab bar floats at the bottom, so the top bar is attached
                  (opaque, flush with the edge) — design-language.md 8.4 */}
              <AppBar scrollTarget={scroller} attached title={t({ en: 'Explore', ko: '둘러보기' })}
                leading={<IconButton variant="plain" icon={<Settings2 />} label={t({ en: 'Settings', ko: '설정' })} onClick={() => setSettings(true)} />}
                trailing={<span style={{ display: 'inline-flex', gap: 8 }}>
                  <IconButton variant="plain" icon={<Search />} label={t({ en: 'Search', ko: '검색' })} onClick={() => setSearch(true)} />
                  <IconButton ref={moreBtn} variant="plain" icon={<MoreHorizontal />} label={t({ en: 'More', ko: '더 보기' })} onClick={() => setMenu((v) => !v)} />
                </span>} />
              <Photo scene={hero} className="places__hero">
                <div className="places__hero-cap"><Text variant="title-1" style={{ color: '#fff' }}>{PLACES[hero].name}</Text><Text variant="subhead" style={{ color: '#fff', opacity: 0.9 }}>{t({ en: `Today’s pick · ${PLACES[hero].dist}`, ko: `오늘의 추천 · ${PLACES[hero].dist}` })}</Text></div>
                <div style={{ position: 'absolute', right: 16, bottom: 18, zIndex: 2 }}>
                  <PageControl count={4} page={hero} onChange={setHero} glass onMedia />
                </div>
              </Photo>
              <div className="places__section">
                <div className="places__chips">
                  {[['all', t({ en: 'All', ko: '전체' }), Compass], ['hike', t(KIND.hike), Mountain], ['beach', t(KIND.beach), Waves], ['camp', t(KIND.camp), Tent], ['view', t(KIND.view), Building2]].map(([k, l, I]) => {
                    const Icon = I as typeof Compass;
                    return <Chip key={k as string} selected={kind === k} onSelectedChange={() => setKind(k as string)} icon={<Icon />}>{l as string}</Chip>;
                  })}
                </div>
                <Text variant="title-3">{t({ en: 'Favourites', ko: '즐겨찾기' })}</Text>
                <div className="places__cards">
                  {list.map((p) => (
                    <ContextMenu key={p.name} aria-label={p.name} previewSelector=".photo" menu={<>
                      <MenuItem icon={<Share />} onSelect={() => toast({ title: t({ en: 'Link copied', ko: '링크를 복사했어요' }), tone: 'success' })}>{t({ en: 'Share', ko: '공유' })}</MenuItem>
                      <MenuItem icon={<Heart />}>{t({ en: 'Remove from favourites', ko: '즐겨찾기 해제' })}</MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => toast({ title: t({ en: `Deleted “${p.name}”`, ko: `‘${p.name}’ 장소를 삭제했어요` }), action: { label: t({ en: 'Undo', ko: '실행 취소' }), onClick: () => {} } })}>{t({ en: 'Delete', ko: '삭제' })}</MenuItem>
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
                <ListSection header={t({ en: 'Nearby', ko: '가까운 곳' })}>
                  <List>
                    {PLACES.slice(0, 5).map((p) => (
                      <ListItem key={p.name} leading={<Compass />} tileColor={sceneTint(p.scene)} title={p.name} subtitle={`${p.dist} · ${t(KIND[p.kind])}`}
                        trailing={<IconButton size="sm" icon={<Info />} label={t({ en: `About ${p.name}`, ko: `${p.name} 정보` })} onClick={(e) => setInfo({ el: e.currentTarget, name: p.name })} />} />
                    ))}
                  </List>
                </ListSection>
                <ListSection header={t({ en: 'Offline', ko: '오프라인' })}>
                  <List>
                    <ListItem title={t({ en: 'Download maps automatically', ko: '지도 자동 다운로드' })} trailing={<Switch defaultChecked aria-label={t({ en: 'Download maps automatically', ko: '지도 자동 다운로드' })} />} />
                    <ListItem title={t({ en: 'Radius', ko: '반경' })} trailing={<span style={{ width: 150, display: 'block' }}><Slider value={dist} onChange={setDist} min={5} max={50} format={(v) => `${v} km`} aria-label={t({ en: 'Radius', ko: '반경' })} /></span>} />
                  </List>
                </ListSection>
              </div>
            </div>
          </div>
          <div className="phone__fade" />
          <div className="phone__bottom">
            <TabBar draggable value={tab} onChange={setTab} aria-label={t({ en: 'Main', ko: '메인' })}>
              <Tab value="home" label={t({ en: 'Home', ko: '홈' })} icon={<Home />} />
              <Tab value="map" label={t({ en: 'Map', ko: '지도' })} icon={<Map />} />
              <Tab value="saved" label={t({ en: 'Saved', ko: '저장' })} icon={<Bookmark />} badge={<Badge>2</Badge>} />
              <Tab value="me" label={t({ en: 'Me', ko: '나' })} icon={<User />} />
            </TabBar>
          </div>
        </div>
      </div>

      <Menu open={menu} onClose={() => setMenu(false)} anchor={moreBtn.current} placement="bottom-end" aria-label={t({ en: 'More', ko: '더 보기' })}>
        <MenuItem icon={<Plus />} onSelect={() => toast({ title: t({ en: 'Place added', ko: '장소를 추가했어요' }) })}>{t({ en: 'Add place', ko: '장소 추가' })}</MenuItem>
        <MenuItem icon={<Share />}>{t({ en: 'Share list', ko: '목록 공유' })}</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Settings2 />} onSelect={() => setSettings(true)}>{t({ en: 'Settings', ko: '설정' })}</MenuItem>
      </Menu>
      <Popover open={!!info} onClose={() => setInfo(null)} anchor={info?.el} placement="left" aria-label={t({ en: 'Place details', ko: '장소 정보' })}>
        <Stack gap={2} style={{ width: 230 }}>
          <Text variant="headline">{info?.name}</Text>
          <Text variant="subhead" tone="secondary">{t({ en: 'Sunset today 6:42 PM · Parking · Pets welcome', ko: '오늘 일몰 18:42 · 주차 가능 · 반려동물 동반 가능' })}</Text>
          <Button size="sm" variant="filled" onClick={() => setInfo(null)} style={{ marginTop: 6 }}>{t({ en: 'Directions', ko: '길찾기' })}</Button>
        </Stack>
      </Popover>
      <Sheet open={settings} onClose={() => setSettings(false)} title={t({ en: 'Settings', ko: '설정' })} trailing={<Button variant="plain" onClick={() => setSettings(false)}>{t({ en: 'Done', ko: '완료' })}</Button>}>
        <Stack gap={5}>
          <DisplaySettingsList />
          <ListSection header={t({ en: 'Units', ko: '단위' })}><SegmentedControl aria-label={t({ en: 'Units', ko: '단위' })} defaultValue="km" options={[{ value: 'km', label: t({ en: 'Kilometres', ko: '킬로미터' }) }, { value: 'mi', label: t({ en: 'Miles', ko: '마일' }) }]} /></ListSection>
          <ListSection header={t({ en: 'Notifications', ko: '알림' })}><List>
            <ListItem title={t({ en: 'Sunset alerts', ko: '일몰 알림' })} trailing={<Switch defaultChecked aria-label={t({ en: 'Sunset alerts', ko: '일몰 알림' })} />} />
            <ListItem title={t({ en: 'Suggest new places', ko: '새 장소 추천' })} trailing={<Switch aria-label={t({ en: 'Suggest new places', ko: '새 장소 추천' })} />} />
          </List></ListSection>
        </Stack>
      </Sheet>
      <Sheet open={search} onClose={() => { setSearch(false); setQ(''); }} height="full" aria-label={t({ en: 'Search', ko: '검색' })}>
        <Stack gap={4}>
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t({ en: 'Search places', ko: '장소 검색' })} autoFocus />
          <List>{found.map((p) => <ListItem key={p.name} title={p.name} subtitle={p.dist} chevron onClick={() => { setHero(p.scene % 4); setSearch(false); setQ(''); }} />)}</List>
          {!found.length && <Text tone="secondary" style={{ textAlign: 'center', padding: 24 }}>{t({ en: 'No results', ko: '결과가 없어요' })}</Text>}
        </Stack>
      </Sheet>
    </article>
  );
}
