/* Status and feedback inside the page: tags, banners, empty states, tooltips. (Toasts and dialogs, which float
   above the page, are on the overlays page.) */
import { useState } from 'react';
import { Banner, Button, EmptyState, IconButton, Stack, Tag, Text, Tooltip } from '@satin-glass/react';
import { Bold, Check, Clock, Inbox, Italic, Link2, PackageSearch, Truck, Underline, WifiOff } from 'lucide-react';
import { Demo, Page, Section, Usage } from '../shared';
import { L, useT } from '../i18n';
import BannerExample from '../examples/feedback-banner';
import bannerSrc from '../examples/feedback-banner?raw';
import EmptyStateExample from '../examples/feedback-empty-state';
import emptyStateSrc from '../examples/feedback-empty-state?raw';

function useTones() {
  const t = useT();
  return [
    ['neutral', t({ en: 'Archived', ko: '보관됨' })], ['accent', t({ en: 'New order', ko: '새 주문' })], ['info', t({ en: 'Shipping', ko: '배송 중' })],
    ['success', t({ en: 'Delivered', ko: '배송 완료' })], ['warning', t({ en: 'Low stock', ko: '재고 부족' })], ['danger', t({ en: 'Payment failed', ko: '결제 실패' })],
  ] as const;
}

export function FeedbackPage() {
  const t = useT(), TONES = useTones();
  const [shown, setShown] = useState(true);
  const [count, setCount] = useState(0);
  return (
    <Page title={t({ en: 'Status and feedback', ko: '상태와 피드백' })} api={['Tag', 'Banner', 'EmptyState', 'Tooltip']} intro={<L
      en="Elements that report status within the page: a tag for a short status, a banner for a notice that concerns the whole page, an empty state where there is no content yet, and a tooltip to explain a control. Notices that float up for a moment (toasts) are on the Overlays page."
      ko="페이지 안에서 상태를 알려 주는 요소입니다. 짧은 상태는 태그, 페이지 전체에 해당하는 알림은 배너, 내용이 없을 때는 빈 상태, 컨트롤 설명은 툴팁을 씁니다. 잠깐 떠오르는 알림(토스트)은 오버레이 페이지에 있습니다." />}>
      <Section title={t({ en: 'Tag', ko: '태그' })} intro={<L
        en="A short status on a table cell or a card. A tag cannot be pressed; for something people press, use a chip. Colour only reinforces the meaning, so the words alone must convey the status."
        ko="표의 셀이나 카드에 붙는 짧은 상태입니다. 태그는 누를 수 없으니, 눌러야 하는 요소에는 칩을 씁니다. 색은 의미를 거들 뿐이므로 글자만으로도 상태를 알 수 있어야 합니다." />}>
        <Demo col data-demo="tags">
          <Stack direction="row" gap={2} wrap>{TONES.map(([tone, l]) => <Tag key={tone} tone={tone}>{l}</Tag>)}</Stack>
          <Stack direction="row" gap={2} wrap>{TONES.map(([tone, l]) => <Tag key={tone} tone={tone} variant="outline">{l}</Tag>)}</Stack>
          <Stack direction="row" gap={2} wrap>
            <Tag tone="info" icon={<Truck />}>{t({ en: 'Arrives tomorrow', ko: '내일 도착' })}</Tag><Tag tone="success" icon={<Check />}>{t({ en: 'Inspected', ko: '검수 완료' })}</Tag><Tag icon={<Clock />}>{t({ en: 'Pre-order', ko: '예약 판매' })}</Tag>
          </Stack>
        </Demo>
      </Section>

      <Section title={t({ en: 'Banner', ko: '배너' })} intro={<L
        en="A notice for a whole page or area. It takes its own place in the page, and dismissing it folds it away as the content below moves up. A banner that appears later is announced to screen readers with live (alert for danger and warning, status for the rest)."
        ko="페이지나 영역 전체에 해당하는 알림입니다. 페이지 안에 자기 자리를 차지하고, 닫으면 접히면서 아래 내용이 올라옵니다. 나중에 새로 나타나는 배너는 live로 스크린 리더에 전합니다(danger·warning은 alert, 나머지는 status)." />}>
        <Demo col data-demo="banners">
          {shown ? (
            <Banner tone="info" title={t({ en: 'November maintenance', ko: '11월 정기 점검' })} onDismiss={() => setShown(false)} dismissLabel={t({ en: 'Dismiss notice', ko: '알림 닫기' })}>{t({ en: 'Order management will be unavailable for 30 minutes from 2 a.m. on 21 November.', ko: '11월 21일 새벽 2시부터 30분 동안 주문 관리를 잠시 쓸 수 없어요.' })}</Banner>
          ) : <Button size="sm" variant="neutral" onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>{t({ en: 'Show the banner again', ko: '배너 다시 보기' })}</Button>}
          <Banner tone="success" title={t({ en: 'Settlement complete', ko: '정산이 끝났어요' })}>{t({ en: 'The October payout of ₩32,840,000 has been paid into your registered account.', ko: '10월 정산금 3,284만 원이 등록한 계좌로 입금됐어요.' })}</Banner>
          <Banner tone="warning" title={t({ en: '3 products will run out of stock within 7 days', ko: '재고가 7일 안에 바닥나는 상품이 3개 있어요' })} actions={<Button size="sm" variant="tinted">{t({ en: 'View products', ko: '상품 보기' })}</Button>} />
          <Banner tone="danger" title={t({ en: 'Lost connection to the payment provider', ko: '결제 대행사와 연결이 끊겼어요' })} live actions={<Button size="sm">{t({ en: 'Reconnect', ko: '다시 연결' })}</Button>}>{t({ en: 'Payments for new orders are not being approved.', ko: '새 주문의 결제가 승인되지 않아요.' })}</Banner>
          <Banner tone="neutral" icon={<WifiOff />}>{t({ en: 'You’re offline. Changes will be saved once you reconnect.', ko: '오프라인이에요. 연결되면 바뀐 내용을 저장할게요.' })}</Banner>
        </Demo>
        <Usage example={BannerExample} code={bannerSrc} />
      </Section>

      <Section title={t({ en: 'Empty state', ko: '빈 상태' })} intro={<L
        en='When an area meant for content is empty, an empty state says what is missing and what to do next. Inside a table or a card, use the small size (size="sm").'
        ko="내용이 있어야 할 자리가 비었을 때, 무엇이 비었고 무엇을 하면 되는지 알려 줍니다. 표나 카드 안에서는 size=&quot;sm&quot;으로 작게 씁니다." />}>
        <div className="grid grid--2">
          <Demo center data-demo="empty">
            <EmptyState icon={<Inbox />} title={t({ en: 'No orders yet', ko: '아직 주문이 없어요' })} description={t({ en: 'Once you publish products, new orders will collect here.', ko: '상품을 공개하면 들어온 주문이 여기에 쌓여요.' })} actions={<><Button size="sm">{t({ en: 'Publish products', ko: '상품 공개하기' })}</Button><Button size="sm" variant="neutral">{t({ en: 'Help', ko: '도움말' })}</Button></>} />
          </Demo>
          <Demo center data-demo="empty-sm">
            <EmptyState size="sm" icon={<PackageSearch />} title={t({ en: 'No products match ‘linen shirt’', ko: '‘리넨 셔츠’와 맞는 상품이 없어요' })} description={t({ en: 'Check the spelling or try another name.', ko: '철자를 확인하거나 다른 이름으로 찾아보세요.' })} actions={<Button size="sm" variant="plain">{t({ en: 'Clear search', ko: '검색어 지우기' })}</Button>} />
          </Demo>
        </div>
        <Usage example={EmptyStateExample} code={emptyStateSrc} />
      </Section>

      <Section title={t({ en: 'Tooltip', ko: '툴팁' })} intro={<L
        en="Use a tooltip for controls that need a short explanation, such as icon-only buttons. It appears after a moment on hover and at once on keyboard focus, and stays open while the pointer moves onto it. Esc closes it, and while one tooltip is open, moving to a neighbouring control shows the next without waiting. Touch devices do not show tooltips, so never put anything essential in one."
        ko="아이콘만 있는 버튼처럼 짧은 설명이 필요한 컨트롤에 씁니다. 마우스를 올리면 잠시 뒤, 키보드로 포커스하면 바로 나타나고, 툴팁 위로 포인터를 옮겨도 열려 있습니다. Esc로 닫고, 툴팁이 하나 열린 상태에서 옆 컨트롤로 옮기면 기다리지 않고 바로 뜹니다. 터치 기기에서는 뜨지 않으므로 꼭 필요한 정보는 담지 않습니다." />}>
        <Demo data-demo="tooltips">
          <div className="tool-row" role="toolbar" aria-label={t({ en: 'Text style', ko: '글자 모양' })}>
            <Tooltip content={t({ en: 'Bold (⌘B)', ko: '굵게 (⌘B)' })}><IconButton icon={<Bold />} label={t({ en: 'Bold', ko: '굵게' })} onClick={() => setCount((c) => c + 1)} /></Tooltip>
            <Tooltip content={t({ en: 'Italic (⌘I)', ko: '기울임 (⌘I)' })}><IconButton icon={<Italic />} label={t({ en: 'Italic', ko: '기울임' })} /></Tooltip>
            <Tooltip content={t({ en: 'Underline (⌘U)', ko: '밑줄 (⌘U)' })}><IconButton icon={<Underline />} label={t({ en: 'Underline', ko: '밑줄' })} /></Tooltip>
            <Tooltip content={t({ en: 'Insert link (⌘K)', ko: '링크 넣기 (⌘K)' })} placement="bottom"><IconButton icon={<Link2 />} label={t({ en: 'Link', ko: '링크' })} /></Tooltip>
          </div>
          <Text variant="subhead" tone="secondary" as="span"><L
            en={<><Tooltip content="Order value minus discounts and refunds."><span className="term" tabIndex={0}>Net sales</span></Tooltip> rose 4.2% from last week.</>}
            ko={<><Tooltip content="주문 금액에서 할인과 환불을 뺀 금액이에요."><span className="term" tabIndex={0}>순매출</span></Tooltip>은 지난주보다 4.2% 늘었어요.</>} />
          </Text>
          {count > 0 && <Text variant="footnote" tone="tertiary" as="span">{t({ en: `Bold pressed ${count} ${count === 1 ? 'time' : 'times'}`, ko: `굵게 ${count}번` })}</Text>}
        </Demo>
      </Section>
    </Page>
  );
}
