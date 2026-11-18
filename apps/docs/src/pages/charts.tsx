/* Charts and figures: KPI stats, line / area, bars, donut, sparklines and the small marks that live in table cells. */
import { useState } from 'react';
import {
  BarChart, BarMeter, Button, DonutChart, IntervalPlot, LineChart, SegmentedControl, Sparkline, Stack, Stat, Text,
} from '@glass-layer/react';
import { CircleDollarSign, MousePointerClick, RotateCcw, ShoppingBag } from 'lucide-react';
import { Demo, Page, Section } from '../shared';
import { CATEGORY_SHARE, DAYS, MONTHS, PRODUCTS, REGIONS, num, wonShort } from '../data';

const STAT_LABELS = { up: '증가', down: '감소', flat: '변화 없음' };
const week = (k: 'visits' | 'orders' | 'revenue') => DAYS.slice(-7).reduce((a, d) => a + d[k], 0);
const lastWeek = (k: 'visits' | 'orders' | 'revenue') => DAYS.slice(-14, -7).reduce((a, d) => a + d[k], 0);
const pct = (k: 'visits' | 'orders' | 'revenue') => { const v = (week(k) / lastWeek(k) - 1) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; };

export function ChartsPage() {
  return (
    <Page title="차트와 지표" intro="직접 그린 SVG 차트입니다. 계열 색은 테마 토큰(--gl-chart-1…6)을 쓰고, 네 테마 모두 카드 위에서 3:1 이상의 대비를 지킵니다. 키보드로 점을 옮기면 값을 읽어 주고, 전체 데이터는 화면에 보이지 않는 표로도 제공합니다.">
      <Stats />
      <Lines />
      <Bars />
      <Donut />
      <Small />
    </Page>
  );
}

function Stats() {
  const [loading, setLoading] = useState(false);
  const reload = () => { setLoading(true); setTimeout(() => setLoading(false), 1200); };
  return (
    <Section title="지표 (Stat)" intro="가장 중요한 숫자 하나와 그 변화, 최근 흐름입니다. 변화는 화살표와 색뿐 아니라 말로도 알려 줍니다. 비용이나 반품처럼 오르면 나쁜 지표는 invert로 색을 뒤집습니다.">
      <Demo col data-demo="stats">
        <Button size="sm" variant="neutral" startIcon={<RotateCcw />} onClick={reload} disabled={loading} style={{ alignSelf: 'flex-start' }}>다시 불러오기</Button>
        <div className="grid grid--4 stat-grid">
          <Stat label="방문" icon={<MousePointerClick />} value={num(week('visits'))} delta={pct('visits')} hint="지난주보다" trend={DAYS.slice(-14).map((d) => d.visits)} loading={loading} labels={STAT_LABELS} />
          <Stat label="주문" icon={<ShoppingBag />} value={num(week('orders'))} delta={pct('orders')} hint="지난주보다" trend={DAYS.slice(-14).map((d) => d.orders)} loading={loading} labels={STAT_LABELS} />
          <Stat label="매출" icon={<CircleDollarSign />} value={wonShort(week('revenue'))} delta={pct('revenue')} hint="지난주보다" trend={DAYS.slice(-14).map((d) => d.revenue)} loading={loading} labels={STAT_LABELS} />
          <Stat label="반품률" icon={<RotateCcw />} value="2.8%" delta="+0.4%p" hint="지난주보다" invert trend={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} loading={loading} labels={STAT_LABELS} />
        </div>
      </Demo>
    </Section>
  );
}

function Lines() {
  const [area, setArea] = useState<'line' | 'area'>('area');
  return (
    <Section title="선 · 영역" intro="포인터를 따라 십자선과 모든 계열의 값이 뜹니다. 범례를 누르면 계열을 숨기고 보일 수 있습니다(마지막 하나는 숨기지 않아요). 처음에는 선이 그려지고, 데이터가 바뀌면 이전 모양에서 이어집니다.">
      <Demo col data-demo="line">
        <SegmentedControl size="sm" aria-label="선 모양" value={area} onChange={setArea} options={[{ value: 'line', label: '선' }, { value: 'area', label: '영역' }]} style={{ alignSelf: 'flex-start' }} />
        <LineChart aria-label="하루 방문과 재방문" data={DAYS} x="day" series={[{ key: 'visits', label: '방문' }, { key: 'returning', label: '재방문' }]} area={area === 'area'} height={240} locale="ko-KR"
          yFormat={(v) => num(v)} caption="최근 30일. 주말마다 방문이 늘어요." />
      </Demo>
    </Section>
  );
}

function Bars() {
  const [stacked, setStacked] = useState<'group' | 'stack'>('group');
  return (
    <Section title="막대" intro="계열을 나란히 놓거나(묶음) 쌓아서(누적) 보여 줍니다. 막대는 바닥에서 자라고, 묶음과 누적을 바꾸면 제자리에서 다시 배치됩니다.">
      <Demo col data-demo="bar">
        <SegmentedControl size="sm" aria-label="막대 배치" value={stacked} onChange={setStacked} options={[{ value: 'group', label: '묶음' }, { value: 'stack', label: '누적' }]} style={{ alignSelf: 'flex-start' }} />
        <BarChart aria-label="경로별 월 주문" data={MONTHS} x="month" stacked={stacked === 'stack'} height={240} locale="ko-KR"
          series={[{ key: 'app', label: '앱' }, { key: 'web', label: '웹' }, { key: 'store', label: '매장' }]} />
      </Demo>
    </Section>
  );
}

function Donut() {
  return (
    <Section title="도넛" intro="전체에서 각 부분이 차지하는 몫입니다. 조각에 포인터를 올리거나 방향키로 옮기면 가운데에 그 몫이 나타납니다. 조각이 많으면 막대가 더 읽기 쉬워요. 다섯 개 안팎일 때 씁니다.">
      <Demo data-demo="donut">
        <DonutChart aria-label="분류별 매출" locale="ko-KR" centerLabel="30일 매출" format={(v) => wonShort(v)} data={CATEGORY_SHARE} />
      </Demo>
    </Section>
  );
}

function Small() {
  const top = PRODUCTS.filter((p) => !p.paused).sort((a, b) => b.sold - a.sold).slice(0, 5);
  const best = top[0].sold;
  return (
    <Section title="작은 표시" intro="숫자 옆에 붙는 작은 그림들입니다. 꾸밈이므로 스크린 리더에는 숨기고, 의미는 옆의 숫자가 전합니다. 스파크라인은 흐름, 막대(BarMeter)는 크기 비교, 구간(IntervalPlot)은 평균과 범위를 기준선과 함께 보여 줍니다.">
      <div className="grid grid--2">
        <Demo col data-demo="small-spark">
          <Text variant="subhead" tone="secondary">스파크라인 · 막대</Text>
          <ul className="mini-list">
            {top.map((p) => (
              <li key={p.id}>
                <span className="mini-list__name">{p.name}</span>
                <Sparkline values={p.trend} style={{ width: 88 }} tone={p.trend[11] >= p.trend[0] ? 'success' : 'danger'} />
                <BarMeter value={p.sold} max={best} width={56} tone={p.sold === best ? 'accent' : 'neutral'} />
                <span className="mini-list__num">{num(p.sold)}</span>
              </li>
            ))}
          </ul>
        </Demo>
        <Demo col data-demo="small-interval">
          <Text variant="subhead" tone="secondary">지역별 배송일 — 평균(점)과 90% 범위(막대), 목표 2일(세로선)</Text>
          <ul className="mini-list">
            {REGIONS.map((r) => (
              <li key={r.name}>
                <span className="mini-list__name">{r.name}</span>
                <IntervalPlot value={r.mean} low={r.low} high={r.high} min={0} max={5} reference={2} width={150} tone={r.mean > 2 ? 'accent' : 'neutral'} />
                <span className="mini-list__num">{r.mean.toFixed(1)}일</span>
              </li>
            ))}
          </ul>
        </Demo>
      </div>
      <Stack gap={1} style={{ marginTop: 8 }}><Text variant="footnote" tone="tertiary">표 안에 넣는 방법은 ‘표’ 페이지의 셀 안의 표시를 보세요.</Text></Stack>
    </Section>
  );
}
