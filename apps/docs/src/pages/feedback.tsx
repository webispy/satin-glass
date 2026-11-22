/* Status and feedback inside the page: tags, banners, empty states, tooltips. (Toasts and dialogs, which float
   above the page, are on the overlays page.) */
import { useState } from 'react';
import { Banner, Button, EmptyState, IconButton, Stack, Tag, Text, Tooltip } from '@satin-glass/react';
import { Bold, Check, Clock, Inbox, Italic, Link2, PackageSearch, Truck, Underline, WifiOff } from 'lucide-react';
import { Demo, Page, Section } from '../shared';

const TONES = [['neutral', '보관됨'], ['accent', '새 주문'], ['info', '배송 중'], ['success', '배송 완료'], ['warning', '재고 부족'], ['danger', '결제 실패']] as const;

export function FeedbackPage() {
  const [shown, setShown] = useState(true);
  const [count, setCount] = useState(0);
  return (
    <Page title="상태와 피드백" intro="페이지 안에서 상태를 알려 주는 요소들입니다. 짧은 상태는 태그, 페이지 전체에 해당하는 알림은 배너, 내용이 없을 때는 빈 상태, 컨트롤 설명은 툴팁을 씁니다. 잠깐 떠오르는 알림(토스트)은 오버레이 페이지에 있습니다.">
      <Section title="태그" intro="표의 셀이나 카드에 붙는 짧은 상태입니다. 태그는 누를 수 없고, 누르는 것이 필요하면 칩을 씁니다. 색은 의미를 거들 뿐이므로 글자만으로도 상태가 읽혀야 합니다.">
        <Demo col data-demo="tags">
          <Stack direction="row" gap={2} wrap>{TONES.map(([t, l]) => <Tag key={t} tone={t}>{l}</Tag>)}</Stack>
          <Stack direction="row" gap={2} wrap>{TONES.map(([t, l]) => <Tag key={t} tone={t} variant="outline">{l}</Tag>)}</Stack>
          <Stack direction="row" gap={2} wrap>
            <Tag tone="info" icon={<Truck />}>내일 도착</Tag><Tag tone="success" icon={<Check />}>검수 완료</Tag><Tag icon={<Clock />}>예약 판매</Tag>
          </Stack>
        </Demo>
      </Section>

      <Section title="배너" intro="페이지나 영역 전체에 해당하는 알림입니다. 페이지 안에 자기 자리를 차지하고, 닫으면 접히면서 아래 내용이 올라옵니다. 나중에 새로 나타나는 배너는 live로 스크린 리더에 전합니다(위험·경고는 alert, 나머지는 status).">
        <Demo col data-demo="banners">
          {shown ? (
            <Banner tone="info" title="11월 정기 점검" onDismiss={() => setShown(false)} dismissLabel="알림 닫기">11월 21일 새벽 2시부터 30분 동안 주문 관리를 잠시 쓸 수 없어요.</Banner>
          ) : <Button size="sm" variant="neutral" onClick={() => setShown(true)} style={{ alignSelf: 'flex-start' }}>배너 다시 보기</Button>}
          <Banner tone="success" title="정산이 끝났어요">10월 정산금 3,284만 원이 등록한 계좌로 입금됐어요.</Banner>
          <Banner tone="warning" title="재고가 7일 안에 바닥나는 상품이 3개 있어요" actions={<Button size="sm" variant="tinted">상품 보기</Button>} />
          <Banner tone="danger" title="결제 대행사와 연결이 끊겼어요" live actions={<Button size="sm">다시 연결</Button>}>새 주문의 결제가 승인되지 않아요.</Banner>
          <Banner tone="neutral" icon={<WifiOff />}>오프라인이에요. 연결되면 바뀐 내용을 저장할게요.</Banner>
        </Demo>
      </Section>

      <Section title="빈 상태" intro="내용이 있어야 할 자리가 비었을 때, 무엇이 비었고 무엇을 하면 되는지 알려 줍니다. 표나 카드 안에서는 size=&quot;sm&quot;으로 작게 씁니다.">
        <div className="grid grid--2">
          <Demo center data-demo="empty">
            <EmptyState icon={<Inbox />} title="아직 주문이 없어요" description="상품을 공개하면 들어온 주문이 여기에 쌓여요." actions={<><Button size="sm">상품 공개하기</Button><Button size="sm" variant="neutral">도움말</Button></>} />
          </Demo>
          <Demo center data-demo="empty-sm">
            <EmptyState size="sm" icon={<PackageSearch />} title="‘리넨 셔츠’와 맞는 상품이 없어요" description="띄어쓰기를 바꾸거나 다른 이름으로 찾아보세요." actions={<Button size="sm" variant="plain">검색어 지우기</Button>} />
          </Demo>
        </div>
      </Section>

      <Section title="툴팁" intro="아이콘만 있는 버튼처럼 짧은 설명이 필요한 컨트롤에 씁니다. 마우스를 올리면 잠시 뒤, 키보드로 포커스하면 바로 나타나고, 툴팁 위로 포인터를 옮겨도 열려 있습니다. Esc로 닫고, 툴팁이 하나 열린 상태에서 옆 컨트롤로 옮기면 기다리지 않고 바로 뜹니다. 터치 기기에서는 뜨지 않으므로 꼭 필요한 정보는 담지 않습니다.">
        <Demo data-demo="tooltips">
          <div className="tool-row" role="toolbar" aria-label="글자 모양">
            <Tooltip content="굵게 (⌘B)"><IconButton icon={<Bold />} label="굵게" onClick={() => setCount((c) => c + 1)} /></Tooltip>
            <Tooltip content="기울임 (⌘I)"><IconButton icon={<Italic />} label="기울임" /></Tooltip>
            <Tooltip content="밑줄 (⌘U)"><IconButton icon={<Underline />} label="밑줄" /></Tooltip>
            <Tooltip content="링크 넣기 (⌘K)" placement="bottom"><IconButton icon={<Link2 />} label="링크" /></Tooltip>
          </div>
          <Text variant="subhead" tone="secondary" as="span">
            <Tooltip content="주문 금액에서 할인과 환불을 뺀 금액이에요."><span className="term" tabIndex={0}>순매출</span></Tooltip>은 지난주보다 4.2% 늘었어요.
          </Text>
          {count > 0 && <Text variant="footnote" tone="tertiary" as="span">굵게 {count}번</Text>}
        </Demo>
      </Section>
    </Page>
  );
}
