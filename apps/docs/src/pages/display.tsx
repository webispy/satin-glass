import { useRef, useState } from 'react';
import {
  Accordion, AppBar, Avatar, Breadcrumbs, Button, IconButton, List, ListItem, MediaViewer, SearchField, Skeleton, Stack, Text, useToast,
} from '@satin-glass/react';
import { ChevronLeft, Folder, Home, Plus, Share, Star } from 'lucide-react';
import { Demo, Page, Photo, Section } from '../shared';

const PLACES = ['한강 공원', '남산 서울타워', '북촌 한옥마을', '경복궁', '서울숲', '익선동', '성수동 카페거리', '망원 시장', '하늘공원', '덕수궁 돌담길', '청계천', '낙산 공원', '석촌 호수', '올림픽 공원', '여의도 공원', '응봉산'];
const PHOTOS = [
  { scene: 0, w: 1600, h: 1040, caption: '한강 위로 지는 해' },
  { scene: 1, w: 1080, h: 1440, caption: '남산에서 본 노을 (세로 사진)' },
  { scene: 2, w: 1600, h: 900, caption: '숲길의 아침' },
  { scene: 3, w: 1600, h: 1040, caption: '보랏빛 저녁' },
  { scene: 4, w: 1200, h: 1200, caption: '구름 낀 하늘 (정사각형)' },
  { scene: 5, w: 1600, h: 1040, caption: '사막 같은 모래톱' },
];

export function Display() {
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const toast = useToast();
  const load = () => { setLoading(true); setTimeout(() => setLoading(false), 1800); };
  return (
    <Page title="구성과 미디어" intro="큰 제목이 바 안으로 접히는 내비게이션, 경로 표시, 펼치는 구역, 불러오는 동안의 자리 표시, 전체 화면 사진 보기입니다.">
      <Section title="큰 제목" intro="스크롤하면 큰 제목이 유리 바 밑으로 들어가면서, 바의 작은 제목이 그만큼 떠오릅니다. 정해진 지점에서 바뀌지 않고 손가락 위치를 그대로 따라갑니다.">
        <Demo center data-demo="largetitle" style={{ padding: 24 }}>
          <div className="phone" style={{ height: 600 }}>
            <div ref={setScreen} className="phone__screen" data-scroll="largetitle">
              <AppBar largeTitle transparentAtTop scrollTarget={screen} title="저장한 장소"
                leading={<IconButton icon={<ChevronLeft />} label="뒤로" />}
                trailing={<IconButton icon={<Plus />} label="장소 추가" onClick={() => toast({ title: '장소 추가' })} />} />
              <div style={{ padding: '4px 16px 16px' }}><SearchField placeholder="장소 검색" aria-label="장소 검색" /></div>
              <div style={{ padding: '0 16px 40px' }}>
                <List>{PLACES.map((p, i) => <ListItem key={p} title={p} subtitle={`${(i * 0.7 + 0.4).toFixed(1)} km`} leading={<Star />} tileColor={['#6f7be0', '#e07a55', '#3fb39a', '#e0a53a'][i % 4]} chevron onClick={() => {}} />)}</List>
              </div>
            </div>
          </div>
        </Demo>
      </Section>

      <Section title="경로 (Breadcrumbs)" intro="지금 있는 곳은 굵은 글씨로 끝에 오고 링크가 아닙니다. 단계가 많으면 가운데를 … 버튼으로 접고, 누르면 숨은 단계가 메뉴로 열립니다. 좁으면 각 단계가 말줄임됩니다.">
        <Demo col data-demo="breadcrumbs">
          <Breadcrumbs aria-label="경로" items={[{ label: '홈', href: '#/display', icon: <Home /> }, { label: '여행', href: '#/display' }, { label: '서울 산책' }]} />
          <Breadcrumbs aria-label="긴 경로" moreLabel="숨은 단계 보기" maxItems={4} items={[
            { label: '홈', icon: <Home />, onClick: () => toast({ title: '홈' }) }, { label: '문서', icon: <Folder />, onClick: () => toast({ title: '문서' }) },
            { label: '2026', onClick: () => toast({ title: '2026' }) }, { label: '여행 계획', onClick: () => toast({ title: '여행 계획' }) },
            { label: '서울', onClick: () => toast({ title: '서울' }) }, { label: '가을 산책 코스 최종본' }]} />
          <div style={{ width: 260, maxWidth: '100%' }}>
            <Breadcrumbs aria-label="좁은 경로" items={[{ label: '아주 긴 이름의 상위 폴더', href: '#/display' }, { label: '또 하나의 긴 하위 폴더 이름', href: '#/display' }, { label: '마지막 문서의 아주 긴 제목' }]} />
          </div>
        </Demo>
      </Section>

      <Section title="펼치는 구역 (Accordion)" intro="자주 보지 않는 내용을 접어 둡니다. 제목 버튼이 구역을 열고 닫고(aria-expanded), 구역은 높이를 펼치며 내용이 살짝 내려앉습니다. 하나만 열리게 하려면 multiple={false}.">
        <div className="grid grid--2">
          <Demo col data-demo="accordion">
            <Accordion defaultValue={['ship']} items={[
              { value: 'ship', title: '배송', meta: '평일 오후 2시 마감', content: <Text variant="subhead" tone="secondary" as="p">오후 2시까지 결제한 주문은 그날 보내요. 제주와 섬 지역은 하루 이틀 더 걸려요.</Text> },
              { value: 'return', title: '교환과 반품', content: <Text variant="subhead" tone="secondary" as="p">받은 날부터 7일 안에 신청할 수 있어요. 단순 변심이면 왕복 배송비가 들어요.</Text> },
              { value: 'gift', title: '선물 포장', meta: '2,000원', content: <Text variant="subhead" tone="secondary" as="p">주문서에서 고를 수 있어요. 메시지 카드는 무료예요.</Text> },
              { value: 'bulk', title: '대량 주문', disabled: true, content: null },
            ]} />
          </Demo>
          <Demo col data-demo="accordion-single">
            <Accordion multiple={false} level={4} items={[
              { value: 'a', title: '주문을 취소하고 싶어요', content: <Text variant="subhead" tone="secondary" as="p">배송 준비 전이면 주문 내역에서 바로 취소할 수 있어요.</Text> },
              { value: 'b', title: '영수증은 어디서 받나요', content: <Text variant="subhead" tone="secondary" as="p">주문 상세의 ‘영수증’에서 내려받을 수 있어요.</Text> },
              { value: 'c', title: '배송지를 바꿀 수 있나요', content: <Text variant="subhead" tone="secondary" as="p">배송 중으로 바뀌기 전까지 바꿀 수 있어요.</Text> },
            ]} />
          </Demo>
        </div>
      </Section>

      <Section title="스켈레톤" intro="불러오는 동안 내용의 모양을 미리 보여 줍니다. 빛 한 줄기가 모든 자리 표시를 함께 지나갑니다. 동작 줄이기에서는 천천히 숨 쉬듯 밝아졌다 어두워집니다.">
        <Demo col data-demo="skeleton">
          <Stack direction="row" gap={3} align="center"><Button variant="tinted" onClick={load} disabled={loading}>다시 불러오기</Button><Text variant="footnote" tone="secondary">{loading ? '불러오는 중…' : '불러옴'}</Text></Stack>
          <div aria-busy={loading} aria-live="polite" style={{ width: '100%', maxWidth: 520 }}>
            {[0, 1, 2].map((i) => (
              <Stack key={i} direction="row" gap={3} align="center" style={{ padding: '10px 0' }}>
                {loading ? <Skeleton variant="circle" size={44} /> : <Avatar name={['김하늘', 'Lee Sora', '박지민'][i]} size={44} />}
                <div style={{ flex: 1, minWidth: 0 }} className={loading ? undefined : 'fade-in'}>
                  {loading ? <Skeleton lines={2} /> : <>
                    <Text variant="headline">{['김하늘', 'Lee Sora', '박지민'][i]}</Text>
                    <Text variant="subhead" tone="secondary">{['서울숲에서 사진을 공유했어요', '북촌 산책 코스를 저장했어요', '남산 야경 코스에 별을 줬어요'][i]}</Text>
                  </>}
                </div>
              </Stack>
            ))}
          </div>
          <Stack direction="row" gap={16} align="center" style={{ width: '100%', maxWidth: 520 }}>
            <Skeleton variant="rect" width={160} height={100} />
            <div style={{ flex: 1 }}><Skeleton width="70%" /><Skeleton lines={3} /></div>
          </Stack>
        </Demo>
      </Section>

      <Section title="미디어 뷰어" intro="사진을 누르면 그 자리에서 커지며 열리고, 닫으면 제자리로 돌아갑니다. 좌우로 넘기기, 두 번 탭·핀치·Ctrl+휠·+/−로 확대, 확대한 채 끌기, 아래로 쓸어 닫기를 지원합니다.">
        <Demo data-demo="media">
          <div className="grid grid--3" style={{ width: '100%', gap: 8 }}>
            {PHOTOS.map((ph, i) => (
              <button key={i} ref={(el) => { thumbs.current[i] = el; }} type="button" aria-label={`${ph.caption} 크게 보기`} className="thumb"
                style={{ border: 0, padding: 0, borderRadius: 12, overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', position: 'relative' }}
                onClick={() => { setAt(i); setViewer(i); }}>
                <Photo scene={ph.scene} style={{ position: 'absolute', inset: 0 }} />
              </button>
            ))}
          </div>
        </Demo>
      </Section>
      <MediaViewer open={viewer !== null} onClose={() => setViewer(null)} index={at} onIndexChange={setAt}
        aria-label="사진 보기" labels={{ close: '닫기', previous: '이전 사진', next: '다음 사진' }}
        getOrigin={(i) => thumbs.current[i]}
        actions={<IconButton variant="glass" icon={<Share />} label="공유" onClick={() => toast({ title: '공유' })} />}
        items={PHOTOS.map((ph) => ({ alt: ph.caption, caption: ph.caption, width: ph.w, height: ph.h, render: () => <Photo scene={ph.scene} style={{ position: 'relative' }} /> }))} />
    </Page>
  );
}
