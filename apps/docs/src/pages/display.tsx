import { useRef, useState, type ReactNode } from 'react';
import {
  Accordion, AppBar, Avatar, Breadcrumbs, Button, IconButton, List, ListItem, MediaViewer, SearchField, Skeleton, Stack, Text, Timeline, TimelineItem, useToast,
} from '@satin-glass/react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Folder, Home, MessageSquare, Pencil, Plus, Share, Star, UserPlus } from 'lucide-react';
import { Demo, Page, Photo, Section, Usage } from '../shared';
import { L, useT } from '../i18n';
import TimelineExample from '../examples/display-timeline';
import timelineSrc from '../examples/display-timeline?raw';
import AccordionExample from '../examples/display-accordion';
import accordionSrc from '../examples/display-accordion?raw';
import MediaViewerExample from '../examples/display-media-viewer';
import mediaViewerSrc from '../examples/display-media-viewer?raw';

function usePlaces() {
  const t = useT();
  return [
    t({ en: 'Hangang Park', ko: '한강 공원' }), t({ en: 'N Seoul Tower', ko: '남산 서울타워' }), t({ en: 'Bukchon Hanok Village', ko: '북촌 한옥마을' }), t({ en: 'Gyeongbokgung', ko: '경복궁' }),
    t({ en: 'Seoul Forest', ko: '서울숲' }), t({ en: 'Ikseon-dong', ko: '익선동' }), t({ en: 'Seongsu café street', ko: '성수동 카페거리' }), t({ en: 'Mangwon Market', ko: '망원 시장' }),
    t({ en: 'Haneul Park', ko: '하늘공원' }), t({ en: 'Deoksugung stone-wall road', ko: '덕수궁 돌담길' }), t({ en: 'Cheonggyecheon', ko: '청계천' }), t({ en: 'Naksan Park', ko: '낙산 공원' }),
    t({ en: 'Seokchon Lake', ko: '석촌 호수' }), t({ en: 'Olympic Park', ko: '올림픽 공원' }), t({ en: 'Yeouido Park', ko: '여의도 공원' }), t({ en: 'Eungbongsan', ko: '응봉산' }),
  ];
}
function usePhotos() {
  const t = useT();
  return [
    { scene: 0, w: 1600, h: 1040, caption: t({ en: 'Sunset over the Han River', ko: '한강 위로 지는 해' }) },
    { scene: 1, w: 1080, h: 1440, caption: t({ en: 'Dusk from Namsan (portrait)', ko: '남산에서 본 노을 (세로 사진)' }) },
    { scene: 2, w: 1600, h: 900, caption: t({ en: 'Morning on a forest path', ko: '숲길의 아침' }) },
    { scene: 3, w: 1600, h: 1040, caption: t({ en: 'Violet evening', ko: '보랏빛 저녁' }) },
    { scene: 4, w: 1200, h: 1200, caption: t({ en: 'Cloudy sky (square)', ko: '구름 낀 하늘 (정사각형)' }) },
    { scene: 5, w: 1600, h: 1040, caption: t({ en: 'A sandbank like a desert', ko: '사막 같은 모래톱' }) },
  ];
}

export function Display() {
  const t = useT(), PLACES = usePlaces(), PHOTOS = usePhotos();
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const toast = useToast();
  const load = () => { setLoading(true); setTimeout(() => setLoading(false), 1800); };
  const people = [t({ en: 'Haneul Kim', ko: '김하늘' }), t({ en: 'Sora Lee', ko: 'Lee Sora' }), t({ en: 'Jimin Park', ko: '박지민' })];
  const sizes = [
    ['S', t({ en: 'Chest 88–92 · Waist 72–76 · Hips 90–94', ko: '가슴 88–92 · 허리 72–76 · 엉덩이 90–94' })], ['M', t({ en: 'Chest 94–98 · Waist 78–82 · Hips 96–100', ko: '가슴 94–98 · 허리 78–82 · 엉덩이 96–100' })],
    ['L', t({ en: 'Chest 100–104 · Waist 84–88 · Hips 102–106', ko: '가슴 100–104 · 허리 84–88 · 엉덩이 102–106' })], ['XL', t({ en: 'Chest 106–110 · Waist 90–94 · Hips 108–112', ko: '가슴 106–110 · 허리 90–94 · 엉덩이 108–112' })],
    ['2XL', t({ en: 'Chest 112–116 · Waist 96–100 · Hips 114–118', ko: '가슴 112–116 · 허리 96–100 · 엉덩이 114–118' })],
  ] as const;
  const home = t({ en: 'Home', ko: '홈' }), docs = t({ en: 'Documents', ko: '문서' }), plans = t({ en: 'Travel plans', ko: '여행 계획' }), seoul = t({ en: 'Seoul', ko: '서울' });
  return (
    <Page title={t({ en: 'Layout and media', ko: '레이아웃과 미디어' })} api={['AppBar', 'Breadcrumbs', 'Timeline', 'TimelineItem', 'Accordion', 'Skeleton', 'MediaViewer']} intro={<L
      en="An app bar whose large title folds into the bar as the page scrolls, breadcrumbs, timelines, accordions, skeletons for content that is loading, and a full-screen media viewer."
      ko="스크롤하면 큰 제목이 바 안으로 접히는 앱 바, 브레드크럼, 타임라인, 아코디언, 불러오는 동안 보여 주는 스켈레톤, 전체 화면 미디어 뷰어입니다." />}>
      <Section title={t({ en: 'Large title', ko: '큰 제목' })} intro={<L
        en="As the page scrolls, the large title slides under the glass bar while the bar's small title rises by the same amount. It follows the scroll position instead of switching at a set point."
        ko="스크롤하면 큰 제목이 유리 바 밑으로 들어가면서, 바의 작은 제목이 그만큼 떠오릅니다. 정해진 지점에서 한 번에 바뀌지 않고 스크롤 위치를 그대로 따라갑니다." />}>
        <Demo center data-demo="largetitle" style={{ padding: 24 }}>
          <div className="phone" style={{ height: 600 }}>
            <div ref={setScreen} className="phone__screen" data-scroll="largetitle">
              <AppBar largeTitle transparentAtTop scrollTarget={screen} title={t({ en: 'Saved places', ko: '저장한 장소' })}
                leading={<IconButton icon={<ChevronLeft />} label={t({ en: 'Back', ko: '뒤로' })} />}
                trailing={<IconButton icon={<Plus />} label={t({ en: 'Add place', ko: '장소 추가' })} onClick={() => toast({ title: t({ en: 'Add place', ko: '장소 추가' }) })} />} />
              <div style={{ padding: '4px 16px 16px' }}><SearchField placeholder={t({ en: 'Search places', ko: '장소 검색' })} aria-label={t({ en: 'Search places', ko: '장소 검색' })} /></div>
              <div style={{ padding: '0 16px 40px' }}>
                <List>{PLACES.map((p, i) => <ListItem key={p} title={p} subtitle={`${(i * 0.7 + 0.4).toFixed(1)} km`} leading={<Star />} tileColor={['#6f7be0', '#e07a55', '#3fb39a', '#e0a53a'][i % 4]} chevron onClick={() => {}} />)}</List>
              </div>
            </div>
          </div>
        </Demo>
      </Section>

      <Section title={t({ en: 'Breadcrumbs', ko: '브레드크럼' })} intro={<L
        en="The current location comes last, in bold, and is not a link. With many levels, the middle folds into a … button that opens the hidden levels in a menu. When space is narrow, each level shortens with an ellipsis."
        ko="현재 위치는 맨 끝에 굵은 글씨로 표시되고 링크가 아닙니다. 단계가 많으면 가운데를 … 버튼으로 접고, 누르면 숨은 단계가 메뉴로 열립니다. 폭이 좁으면 각 단계가 말줄임표로 줄어듭니다." />}>
        <Demo col data-demo="breadcrumbs">
          <Breadcrumbs aria-label={t({ en: 'Breadcrumb', ko: '경로' })} items={[{ label: home, href: '#/display', icon: <Home /> }, { label: t({ en: 'Travel', ko: '여행' }), href: '#/display' }, { label: t({ en: 'Seoul walks', ko: '서울 산책' }) }]} />
          <Breadcrumbs aria-label={t({ en: 'Long breadcrumb', ko: '긴 경로' })} moreLabel={t({ en: 'Show hidden levels', ko: '숨은 단계 보기' })} maxItems={4} items={[
            { label: home, icon: <Home />, onClick: () => toast({ title: home }) }, { label: docs, icon: <Folder />, onClick: () => toast({ title: docs }) },
            { label: '2026', onClick: () => toast({ title: '2026' }) }, { label: plans, onClick: () => toast({ title: plans }) },
            { label: seoul, onClick: () => toast({ title: seoul }) }, { label: t({ en: 'Autumn walking route, final', ko: '가을 산책 코스 최종본' }) }]} />
          <div style={{ width: 260, maxWidth: '100%' }}>
            <Breadcrumbs aria-label={t({ en: 'Narrow breadcrumb', ko: '좁은 경로' })} items={[{ label: t({ en: 'A parent folder with a very long name', ko: '아주 긴 이름의 상위 폴더' }), href: '#/display' }, { label: t({ en: 'Another long subfolder name', ko: '또 하나의 긴 하위 폴더 이름' }), href: '#/display' }, { label: t({ en: 'The very long title of the last document', ko: '마지막 문서의 아주 긴 제목' }) }]} />
          </div>
        </Demo>
      </Section>

      <Section title={t({ en: 'Timeline', ko: '타임라인 (Timeline)' })} intro={<L
        en='Lays out events in order along one line. Where there are steps, as in an order or an application, done (a check), current (a location dot) and upcoming (an empty circle) differ in shape, and the part of the line already passed is drawn in the accent colour. The current step carries aria-current="step", and each step’s status is also given to screen readers in words. A list where events pile up, such as an activity log, marks them with toned (coloured) dots or icons. When the current step changes, the dot travels along the line and fills it as it passes; when an entry is added, its row unfolds.'
        ko="순서가 있는 일을 한 줄로 잇습니다. 주문이나 신청처럼 단계가 있으면 완료(체크) · 진행 중(위치 점) · 예정(빈 원)을 모양으로 구별하고, 지나온 구간은 강조색 선으로 그립니다. 진행 중인 단계에는 aria-current=&quot;step&quot;을 붙이고, 각 단계의 상태는 스크린 리더에 텍스트로도 전합니다. 활동 기록처럼 일이 쌓이는 목록은 톤(색)이 있는 점이나 아이콘으로 표시합니다. 진행 중인 단계가 바뀌면 위치 점이 선을 따라 옮겨 가며 지나온 선을 채우고, 기록이 추가되면 그 줄이 펼쳐집니다." />}>
        <div className="grid grid--2">
          <Demo col data-demo="timeline-steps">
            <Text variant="subhead" tone="secondary">{t({ en: 'Order delivery · steps (move between steps with the buttons)', ko: '주문 배송 · 단계 (버튼으로 단계를 옮겨 보세요)' })}</Text>
            <OrderSteps />
          </Demo>
          <Demo col data-demo="timeline-events">
            <Text variant="subhead" tone="secondary">{t({ en: 'Activity log · icons and tones (Next adds an entry on top, Previous removes the latest)', ko: '활동 기록 · 아이콘과 톤 (다음: 새 기록이 위에 추가, 이전: 최근 기록이 빠짐)' })}</Text>
            <EventLog />
            <Text variant="subhead" tone="secondary">{t({ en: 'Dots and tones only (no icons)', ko: '점과 톤만 (아이콘 없음)' })}</Text>
            <DeployLog />
          </Demo>
        </div>
        <Usage example={TimelineExample} code={timelineSrc} />
      </Section>

      <Section title={t({ en: 'Accordion', ko: '아코디언' })} intro={<L
        en="Folds away content people seldom need. The title button opens and closes its section (aria-expanded); as the section's height grows, the content drops in gently from behind the title. To allow only one open at a time, set multiple={false}."
        ko="자주 보지 않는 내용을 접어 둡니다. 제목 버튼을 누르면 구역이 열리고 닫히며(aria-expanded), 구역의 높이가 늘어나면서 내용이 제목 뒤에서 살짝 내려옵니다. 하나만 열리게 하려면 multiple={false}를 줍니다." />}>
        <div className="grid grid--2">
          <Demo col data-demo="accordion">
            <Accordion defaultValue={['ship']} items={[
              { value: 'ship', title: t({ en: 'Delivery', ko: '배송' }), meta: t({ en: 'Weekdays, order by 2 p.m.', ko: '평일 오후 2시 마감' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Orders paid by 2 p.m. ship the same day. Jeju and the other islands take a day or two longer.', ko: '오후 2시까지 결제한 주문은 그날 보내요. 제주와 섬 지역은 하루 이틀 더 걸려요.' })}</Text> },
              { value: 'return', title: t({ en: 'Exchanges and returns', ko: '교환과 반품' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Request one within 7 days of delivery. If you simply changed your mind, you pay shipping both ways.', ko: '받은 날부터 7일 안에 신청할 수 있어요. 단순 변심이면 왕복 배송비가 들어요.' })}</Text> },
              { value: 'gift', title: t({ en: 'Gift wrapping', ko: '선물 포장' }), meta: t({ en: '₩2,000', ko: '2,000원' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Choose it at checkout. A message card is free.', ko: '주문서에서 고를 수 있어요. 메시지 카드는 무료예요.' })}</Text> },
              { value: 'size', title: t({ en: 'Size guide', ko: '사이즈 안내' }), meta: t({ en: 'Long content', ko: '긴 내용' }), content: (
                <Stack gap={2}>
                  <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Measured on a close-fitting garment. Between two sizes, we suggest the larger.', ko: '몸에 꼭 맞는 옷을 기준으로 재요. 두 사이즈 사이라면 큰 쪽을 권해요.' })}</Text>
                  {sizes.map(([k, v]) => (
                    <Text key={k} variant="subhead" as="p"><b>{k}</b> · {v} cm</Text>
                  ))}
                  <Text variant="footnote" tone="secondary" as="p">{t({ en: 'Linen and knits can shrink 2–3% in the first wash. For sleeve length, see the measurements under the model photos.', ko: '리넨과 니트는 처음 세탁하면 2–3% 줄어들 수 있어요. 소매 길이는 모델 사진 아래의 실측표를 함께 보세요.' })}</Text>
                </Stack>
              ) },
              { value: 'bulk', title: t({ en: 'Bulk orders', ko: '대량 주문' }), disabled: true, content: null },
            ]} />
          </Demo>
          <Demo col data-demo="accordion-single">
            <Accordion multiple={false} level={4} items={[
              { value: 'a', title: t({ en: 'I want to cancel my order', ko: '주문을 취소하고 싶어요' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Before it is prepared for shipping, you can cancel it from your order history.', ko: '배송 준비 전이면 주문 내역에서 바로 취소할 수 있어요.' })}</Text> },
              { value: 'b', title: t({ en: 'Where do I get a receipt?', ko: '영수증은 어디서 받나요?' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Download it from ‘Receipt’ in the order details.', ko: '주문 상세의 ‘영수증’에서 내려받을 수 있어요.' })}</Text> },
              { value: 'c', title: t({ en: 'Can I change the delivery address?', ko: '배송지를 바꿀 수 있나요?' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Yes, until the order’s status changes to Shipping.', ko: '배송 중으로 바뀌기 전까지 바꿀 수 있어요.' })}</Text> },
            ]} />
          </Demo>
        </div>
        <Usage example={AccordionExample} code={accordionSrc} />
      </Section>

      <Section title={t({ en: 'Skeleton', ko: '스켈레톤' })} intro={<L
        en="Shows the shape of the content while it loads. One sweep of light passes over every placeholder (skeleton) together. With reduced motion on, they slowly brighten and dim instead, as if breathing."
        ko="불러오는 동안 내용의 모양을 미리 보여 줍니다. 빛 한 줄기가 모든 스켈레톤을 함께 지나갑니다. 동작 줄이기를 켜면 천천히 숨 쉬듯 밝아졌다 어두워집니다." />}>
        <Demo col data-demo="skeleton">
          <Stack direction="row" gap={3} align="center"><Button variant="tinted" onClick={load} disabled={loading}>{t({ en: 'Reload', ko: '다시 불러오기' })}</Button><Text variant="footnote" tone="secondary">{loading ? t({ en: 'Loading…', ko: '불러오는 중…' }) : t({ en: 'Loaded', ko: '불러옴' })}</Text></Stack>
          <div aria-busy={loading} aria-live="polite" style={{ width: '100%', maxWidth: 520 }}>
            {[0, 1, 2].map((i) => (
              <Stack key={i} direction="row" gap={3} align="center" style={{ padding: '10px 0' }}>
                {loading ? <Skeleton variant="circle" size={44} /> : <Avatar name={people[i]} size={44} />}
                <div style={{ flex: 1, minWidth: 0 }} className={loading ? undefined : 'fade-in'}>
                  {loading ? <Skeleton lines={2} /> : <>
                    <Text variant="headline">{people[i]}</Text>
                    <Text variant="subhead" tone="secondary">{[t({ en: 'Shared photos from Seoul Forest', ko: '서울숲에서 사진을 공유했어요' }), t({ en: 'Saved the Bukchon walking route', ko: '북촌 산책 코스를 저장했어요' }), t({ en: 'Added the Namsan night-view route to favourites', ko: '남산 야경 코스를 즐겨찾기에 추가했어요' })][i]}</Text>
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

      <Section title={t({ en: 'Media viewer', ko: '미디어 뷰어' })} intro={<L
        en="When pressed, a photo opens out of its thumbnail, and goes back into it when closed. Swipe between photos; zoom with a double tap, a pinch, Ctrl+wheel or +/−; drag while zoomed; swipe down to close."
        ko="사진을 누르면 그 자리에서 커지며 열리고, 닫으면 제자리로 돌아갑니다. 좌우로 넘기기, 두 번 탭·핀치·Ctrl+휠·+/−로 확대·축소, 확대한 채 끌기, 아래로 쓸어내려 닫기를 지원합니다." />}>
        <Demo data-demo="media">
          <div className="grid grid--3" style={{ width: '100%', gap: 8 }}>
            {PHOTOS.map((ph, i) => (
              <button key={i} ref={(el) => { thumbs.current[i] = el; }} type="button" aria-label={t({ en: `View larger: ${ph.caption}`, ko: `${ph.caption} 크게 보기` })} className="thumb"
                style={{ border: 0, padding: 0, borderRadius: 12, overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', position: 'relative' }}
                onClick={() => { setAt(i); setViewer(i); }}>
                {/* a real thumbnail is the photo cropped to the square (object-fit: cover): draw the photo at its own
                    shape and let the square crop it, so it is the very picture the viewer opens */}
                <Photo scene={ph.scene} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: ph.w >= ph.h ? `${(ph.w / ph.h) * 100}%` : '100%', height: ph.w >= ph.h ? '100%' : `${(ph.h / ph.w) * 100}%` }} />
              </button>
            ))}
          </div>
        </Demo>
        <Usage example={MediaViewerExample} code={mediaViewerSrc} />
      </Section>
      <MediaViewer open={viewer !== null} onClose={() => setViewer(null)} index={at} onIndexChange={setAt}
        aria-label={t({ en: 'Photo viewer', ko: '사진 보기' })} labels={{ close: t({ en: 'Close', ko: '닫기' }), previous: t({ en: 'Previous photo', ko: '이전 사진' }), next: t({ en: 'Next photo', ko: '다음 사진' }) }}
        getOrigin={(i) => thumbs.current[i]}
        actions={<IconButton variant="glass" icon={<Share />} label={t({ en: 'Share', ko: '공유' })} onClick={() => toast({ title: t({ en: 'Share', ko: '공유' }) })} />}
        items={PHOTOS.map((ph) => ({ alt: ph.caption, caption: ph.caption, width: ph.w, height: ph.h, render: () => <Photo scene={ph.scene} style={{ position: 'relative' }} /> }))} />
    </Page>
  );
}

function useOrderSteps(): { title: string; time?: ReactNode; description?: string }[] {
  const t = useT();
  return [
    { title: t({ en: 'Order placed', ko: '주문 접수' }), time: <time dateTime="2026-11-18T14:02">{t({ en: 'Nov 18, 14:02', ko: '11월 18일 14:02' })}</time> },
    { title: t({ en: 'Payment confirmed', ko: '결제 확인' }), time: <time dateTime="2026-11-18T14:05">{t({ en: 'Nov 18, 14:05', ko: '11월 18일 14:05' })}</time> },
    { title: t({ en: 'Preparing', ko: '상품 준비 중' }), description: t({ en: 'Due to leave the warehouse this afternoon.', ko: '오늘 오후에 출고될 예정이에요.' }) },
    { title: t({ en: 'Shipping', ko: '배송 중' }), description: t({ en: 'Hanbit Express · tracking 6021-4417-0093', ko: '한빛택배 · 운송장 6021-4417-0093' }) },
    { title: t({ en: 'Delivered', ko: '배송 완료' }), description: t({ en: 'Expected Sat, Nov 22', ko: '도착 예정 11월 22일(토)' }) },
  ];
}
function OrderSteps() {
  const t = useT(), ORDER_STEPS = useOrderSteps();
  const [at, setAt] = useState(2);
  return (
    <>
      <Timeline aria-label={t({ en: 'Order progress', ko: '주문 진행' })} labels={{ status: { done: t({ en: 'Completed', ko: '완료' }), current: t({ en: 'Current', ko: '진행 중' }), upcoming: t({ en: 'Upcoming', ko: '예정' }) } }}>
        {ORDER_STEPS.map((s, i) => <TimelineItem key={s.title} status={i < at ? 'done' : i === at ? 'current' : 'upcoming'} title={s.title} time={s.time} description={s.description} />)}
      </Timeline>
      <Stack direction="row" gap={2} wrap>
        <Button size="sm" variant="neutral" disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>{t({ en: 'Previous step', ko: '이전 단계' })}</Button>
        <Button size="sm" variant="tinted" disabled={at === ORDER_STEPS.length - 1} onClick={() => setAt((n) => Math.min(ORDER_STEPS.length - 1, n + 1))}>{t({ en: 'Next step', ko: '다음 단계' })}</Button>
        <Button size="sm" variant="plain" onClick={() => setAt(0)}>{t({ en: 'To the start', ko: '처음으로' })}</Button>
        <Button size="sm" variant="plain" onClick={() => setAt(ORDER_STEPS.length - 1)}>{t({ en: 'To the end', ko: '끝으로' })}</Button>
      </Stack>
    </>
  );
}

type LogEntry = { id: string; title: string; time: string; description?: string; tone?: 'accent' | 'info' | 'success' | 'warning' | 'danger'; icon?: ReactNode };
/* a log, oldest first; the demo shows the first n of it, newest at the top */
function useActivity(): LogEntry[] {
  const t = useT(), yesterday = t({ en: 'Yesterday', ko: '어제' });
  return [
    { id: 'draft', title: t({ en: 'Draft written', ko: '초안 작성' }), time: t({ en: 'Nov 18', ko: '11월 18일' }), icon: <Pencil /> },
    { id: 'invite', title: t({ en: 'Invited Seoyun Lee', ko: '이서윤 님 초대' }), time: yesterday, icon: <UserPlus />, tone: 'accent' },
    { id: 'due', title: t({ en: 'One day left until the deadline', ko: '마감이 하루 남았어요' }), time: yesterday, icon: <AlertTriangle />, tone: 'warning' },
    { id: 'comments', title: t({ en: '2 comments', ko: '댓글 2개' }), time: '09:15', description: t({ en: '“Please give the prices in won.”', ko: '“가격표 단위를 원으로 맞춰 주세요.”' }), icon: <MessageSquare />, tone: 'info' },
    { id: 'approved', title: t({ en: 'Review approved', ko: '검토 승인' }), time: '10:42', description: t({ en: 'Approved by Jimin Park.', ko: '박지민 님이 승인했어요.' }), icon: <CheckCircle2 />, tone: 'success' },
    { id: 'published', title: t({ en: 'Published', ko: '공개 게시' }), time: '11:05', description: t({ en: 'Posted to the customer notice board.', ko: '고객 공지 게시판에 올렸어요.' }), icon: <Share />, tone: 'accent' },
  ];
}
function useDeploys(): LogEntry[] {
  const t = useT(), nov20 = t({ en: 'Nov 20', ko: '11월 20일' });
  return [
    { id: 'v030', title: t({ en: '0.3.0 tagged', ko: '0.3.0 태그' }), time: t({ en: 'Nov 19', ko: '11월 19일' }) },
    { id: 'ci', title: t({ en: 'CI failed: touch checks', ko: 'CI 실패: 터치 검사' }), time: nov20, description: t({ en: 'Synthetic gestures did not arrive, so those checks are now skipped.', ko: '합성 제스처가 전달되지 않아 건너뛰게 바꿨어요.' }), tone: 'danger' },
    { id: 'v040', title: t({ en: '0.4.0 released', ko: '0.4.0 배포' }), time: nov20, tone: 'success' },
    { id: 'fix', title: t({ en: 'Two Safari fixes', ko: 'Safari 수정 두 건' }), time: nov20, tone: 'info' },
    { id: 'v050', title: t({ en: '0.5.0 in preparation', ko: '0.5.0 준비' }), time: t({ en: 'Next week', ko: '다음 주' }), tone: 'accent' },
  ];
}
function Log({ entries, start, label }: { entries: LogEntry[]; start: number; label: string }) {
  const t = useT();
  const [n, setN] = useState(start);
  return (
    <>
      <Timeline aria-label={label}>
        {entries.slice(0, n).reverse().map((e) => (e.icon
          ? <TimelineItem key={e.id} icon={e.icon} tone={e.tone} title={e.title} time={e.time} description={e.description} />
          : <TimelineItem key={e.id} tone={e.tone} title={e.title} time={e.time} description={e.description} />))}
      </Timeline>
      <Stack direction="row" gap={2} wrap>
        <Button size="sm" variant="neutral" disabled={n <= 1} onClick={() => setN((x) => Math.max(1, x - 1))}>{t({ en: 'Previous', ko: '이전' })}</Button>
        <Button size="sm" variant="tinted" disabled={n >= entries.length} onClick={() => setN((x) => Math.min(entries.length, x + 1))}>{t({ en: 'Next', ko: '다음' })}</Button>
      </Stack>
    </>
  );
}
function EventLog() { const t = useT(); return <Log entries={useActivity()} start={4} label={t({ en: 'Document activity', ko: '문서 활동' })} />; }
function DeployLog() { const t = useT(); return <Log entries={useDeploys()} start={3} label={t({ en: 'Deploy log', ko: '배포 기록' })} />; }
