/* Charts and figures: KPI stats, line / area, bars, donut, sparklines and the small marks that live in table cells. */
import { useState } from 'react';
import {
  BarChart, BarMeter, Button, DonutChart, IntervalPlot, LineChart, Meter, ScatterChart, SegmentedControl, Slider, Sparkline, Stack, Stat, Text,
} from '@satin-glass/react';
import { CircleDollarSign, MousePointerClick, RotateCcw, ShoppingBag } from 'lucide-react';
import { Demo, Page, Section, Usage } from '../shared';
import { L, useLocale, useT } from '../i18n';
import { useData, type ShopData } from '../data';
import ChartsStat from '../examples/charts-stat';
import chartsStatSrc from '../examples/charts-stat?raw';
import ChartsMeter from '../examples/charts-meter';
import chartsMeterSrc from '../examples/charts-meter?raw';
import ChartsLine from '../examples/charts-line';
import chartsLineSrc from '../examples/charts-line?raw';

type Day = ShopData['DAYS'][number];
type Key = 'visits' | 'orders' | 'revenue';
const week = (days: Day[], k: Key) => days.slice(-7).reduce((a, d) => a + d[k], 0);
const lastWeek = (days: Day[], k: Key) => days.slice(-14, -7).reduce((a, d) => a + d[k], 0);
const pct = (days: Day[], k: Key) => { const v = (week(days, k) / lastWeek(days, k) - 1) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; };

export function ChartsPage() {
  const t = useT();
  return (
    <Page title={t({ en: 'Charts and measures', ko: '차트와 지표' })}
      api={['Stat', 'Meter', 'LineChart', 'BarChart', 'ScatterChart', 'DonutChart', 'Sparkline', 'BarMeter', 'IntervalPlot']} intro={<L
      en="Charts drawn directly in SVG. Series colours come from theme tokens (--sg-chart-1…6) and keep at least 3:1 contrast on cards in all four themes. Moving between points with the keyboard reads each value aloud, and the full data is also there as a table hidden from view."
      ko="직접 그린 SVG 차트입니다. 계열 색은 테마 토큰(--sg-chart-1…6)을 쓰고, 네 테마 모두 카드 위에서 3:1 이상의 대비를 지킵니다. 키보드로 점 사이를 옮겨 다니면 값을 읽어 주고, 전체 데이터는 화면에 보이지 않는 표로도 제공합니다." />}>
      <Stats />
      <Meters />
      <Lines />
      <Bars />
      <Scatter />
      <Donut />
      <Small />
    </Page>
  );
}

function Meters() {
  const t = useT(), locale = useLocale();
  const [used, setUsed] = useState(37.4);
  const left = (50 - used).toFixed(1);
  const storage = used >= 45 ? t({ en: 'Almost full', ko: '거의 다 찼어요' }) : used >= 30 ? t({ en: `${left} GB left · worth tidying up`, ko: `${left} GB 남았어요 · 정리하면 좋아요` }) : t({ en: `${left} GB left`, ko: `${left} GB 남았어요` });
  const storageLabel = t({ en: 'Storage', ko: '저장 공간' });
  return (
    <Section title={t({ en: 'Meter', ko: '미터 (Meter)' })} intro={<L
      en="A value within a fixed range. It shows amounts with a set end — storage, quotas, scores — unlike progress (Progress), where a task moves towards its end. The bar is a groove, filled flat from the start up to the value. Given low, high and optimum, it takes its colour from the band like HTML's meter (good, warning or bad), and the status text says the same in words. Data changes the value, not the user's hand, so it updates at once with no animation."
      ko="정해진 범위 안의 값입니다. 저장 공간, 할당량, 점수처럼 끝이 정해진 양을 보여 주고, 작업이 끝을 향해 가는 진행(Progress)과는 다릅니다. 막대는 홈이고, 값만큼 시작점부터 평평하게 채워집니다. low · high · optimum을 주면 HTML의 meter처럼 구간에 따라 색이 정해지고(좋음 · 주의 · 나쁨), 그 뜻은 status 문구로도 알려 줍니다. 값은 사용자의 손이 아니라 데이터가 바꾸므로 애니메이션 없이 바로 반영됩니다." />}>
      <div className="grid grid--2">
        <Demo col data-demo="meter">
          <Meter label={storageLabel} value={used} max={50} low={30} high={45} optimum={0} format={(v) => `${v.toFixed(1)} GB / 50 GB`} status={storage} />
          <Meter label={t({ en: 'API calls this month', ko: '이번 달 API 호출' })} value={8200} max={10000} format={(v) => `${v.toLocaleString(locale)} / 10,000`} />
          <Meter label={t({ en: 'Customer satisfaction', ko: '고객 만족도' })} value={4.3} min={1} max={5} low={3} high={4} optimum={5} format={(v) => `${v.toFixed(1)} / 5`} status={t({ en: 'Good · up 0.2 on last month', ko: '좋아요 · 지난달보다 0.2 올랐어요' })} />
          <Meter label={t({ en: 'Battery', ko: '배터리' })} size="sm" value={18} low={20} high={80} optimum={100} status={t({ en: 'Needs charging', ko: '충전이 필요해요' })} />
          <Meter label={t({ en: 'Response time target', ko: '응답 시간 목표' })} value={Number.NaN} labels={{ unavailable: t({ en: 'Unknown', ko: '알 수 없음' }) }} status={t({ en: 'Measuring', ko: '측정 중이에요' })} />
        </Demo>
        <Demo col data-demo="meter-bands">
          <Text variant="subhead" tone="secondary">{t({ en: 'Change the value and the colour and text follow the band (warning from 30 GB, bad from 45 GB)', ko: '값을 바꾸면 구간에 따라 색과 문구가 바뀝니다 (30 GB부터 주의, 45 GB부터 나쁨)' })}</Text>
          <Meter label={storageLabel} value={used} max={50} low={30} high={45} optimum={0} format={(v) => `${v.toFixed(1)} GB`} status={storage} />
          <Slider aria-label={t({ en: 'Storage used', ko: '사용한 저장 공간' })} min={0} max={50} step={0.1} value={used} onChange={setUsed} format={(v) => `${v.toFixed(1)} GB`} />
        </Demo>
      </div>
      <Usage example={ChartsMeter} code={chartsMeterSrc} />
    </Section>
  );
}

function Stats() {
  const t = useT(), d = useData();
  const [loading, setLoading] = useState(false);
  const reload = () => { setLoading(true); setTimeout(() => setLoading(false), 1200); };
  const labels = { up: t({ en: 'Up', ko: '증가' }), down: t({ en: 'Down', ko: '감소' }), flat: t({ en: 'No change', ko: '변화 없음' }) };
  const hint = t({ en: 'vs last week', ko: '지난주보다' });
  const recent = d.DAYS.slice(-14);
  return (
    <Section title={t({ en: 'Stat', ko: '지표 (Stat)' })} intro={<L
      en="The one number that matters most, how it changed and its recent trend. The change is stated in text as well as shown by arrow and colour. For a metric where a rise is bad, such as costs or returns, invert flips the colours."
      ko="가장 중요한 숫자 하나와 그 변화, 최근 흐름입니다. 변화는 화살표와 색뿐 아니라 텍스트로도 알려 줍니다. 비용이나 반품처럼 오르면 나쁜 지표는 invert로 색을 뒤집습니다." />}>
      <Demo col data-demo="stats">
        <Button size="sm" variant="neutral" startIcon={<RotateCcw />} onClick={reload} disabled={loading} style={{ alignSelf: 'flex-start' }}>{t({ en: 'Reload', ko: '다시 불러오기' })}</Button>
        <div className="grid grid--4 stat-grid">
          <Stat label={t({ en: 'Visits', ko: '방문' })} icon={<MousePointerClick />} value={d.num(week(d.DAYS, 'visits'))} delta={pct(d.DAYS, 'visits')} hint={hint} trend={recent.map((x) => x.visits)} loading={loading} labels={labels} />
          <Stat label={t({ en: 'Orders', ko: '주문' })} icon={<ShoppingBag />} value={d.num(week(d.DAYS, 'orders'))} delta={pct(d.DAYS, 'orders')} hint={hint} trend={recent.map((x) => x.orders)} loading={loading} labels={labels} />
          <Stat label={t({ en: 'Revenue', ko: '매출' })} icon={<CircleDollarSign />} value={d.wonShort(week(d.DAYS, 'revenue'))} delta={pct(d.DAYS, 'revenue')} hint={hint} trend={recent.map((x) => x.revenue)} loading={loading} labels={labels} />
          <Stat label={t({ en: 'Return rate', ko: '반품률' })} icon={<RotateCcw />} value="2.8%" delta={t({ en: '+0.4 pp', ko: '+0.4%p' })} hint={hint} invert trend={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} loading={loading} labels={labels} />
        </div>
      </Demo>
      <Usage example={ChartsStat} code={chartsStatSrc} />
    </Section>
  );
}

function Lines() {
  const t = useT(), d = useData(), locale = useLocale();
  const [area, setArea] = useState<'line' | 'area'>('area');
  return (
    <Section title={t({ en: 'Line · area', ko: '선 · 영역' })} intro={<L
      en="A crosshair and the values of every series follow the pointer. Press a legend entry to hide or show its series (the last one cannot be hidden). The lines draw in at first; when the data changes, the old shape turns into the new one."
      ko="포인터를 따라 십자선과 모든 계열의 값이 뜹니다. 범례를 누르면 계열을 숨기거나 다시 보일 수 있습니다(마지막 하나는 숨길 수 없습니다). 처음에는 선이 그려지고, 데이터가 바뀌면 이전 모양이 새 모양으로 바뀌어 갑니다." />}>
      <Demo col data-demo="line">
        <SegmentedControl size="sm" aria-label={t({ en: 'Line style', ko: '선 모양' })} value={area} onChange={setArea} options={[{ value: 'line', label: t({ en: 'Line', ko: '선' }) }, { value: 'area', label: t({ en: 'Area', ko: '영역' }) }]} style={{ alignSelf: 'flex-start' }} />
        <LineChart aria-label={t({ en: 'Daily visits and return visits', ko: '하루 방문과 재방문' })} data={d.DAYS} x="day" series={[{ key: 'visits', label: t({ en: 'Visits', ko: '방문' }) }, { key: 'returning', label: t({ en: 'Return visits', ko: '재방문' }) }]} area={area === 'area'} height={240} locale={locale}
          yFormat={(v) => d.num(v)} caption={t({ en: 'Last 30 days. Visits rise every weekend.', ko: '최근 30일. 주말마다 방문이 늘어요.' })} />
      </Demo>
      <Usage example={ChartsLine} code={chartsLineSrc} />
    </Section>
  );
}

function Bars() {
  const t = useT(), d = useData(), locale = useLocale();
  const [stacked, setStacked] = useState<'group' | 'stack'>('group');
  return (
    <Section title={t({ en: 'Bars', ko: '막대' })} intro={<L
      en="Series stand side by side (grouped) or on top of each other (stacked). Bars meet the baseline with square corners and are rounded only at the top; stacked, only the top of the whole stack is rounded, and thin gaps split the segments so they read apart without relying on colour. At first each category rises from the baseline as one bar, one after another; switching between grouped and stacked moves position, width and height together into the new layout."
      ko="계열을 나란히 놓거나(묶음) 쌓아서(누적) 보여 줍니다. 막대는 바닥에 직각으로 서고 윗면만 둥글며, 누적에서는 쌓인 막대 전체의 윗면만 둥글고 조각 사이에 가는 틈이 있어 색에 기대지 않고도 나뉩니다. 처음에는 항목마다 막대 하나로 기준선에서 차례로 올라오고, 묶음과 누적을 바꾸면 위치·폭·높이가 함께 움직여 다시 배치됩니다." />}>
      <Demo col data-demo="bar">
        <SegmentedControl size="sm" aria-label={t({ en: 'Bar layout', ko: '막대 배치' })} value={stacked} onChange={setStacked} options={[{ value: 'group', label: t({ en: 'Grouped', ko: '묶음' }) }, { value: 'stack', label: t({ en: 'Stacked', ko: '누적' }) }]} style={{ alignSelf: 'flex-start' }} />
        <BarChart aria-label={t({ en: 'Monthly orders by channel', ko: '채널별 월 주문' })} data={d.MONTHS} x="month" stacked={stacked === 'stack'} height={240} locale={locale}
          series={[{ key: 'app', label: t({ en: 'App', ko: '앱' }) }, { key: 'web', label: t({ en: 'Web', ko: '웹' }) }, { key: 'store', label: t({ en: 'Store', ko: '매장' }) }]} />
      </Demo>
    </Section>
  );
}

function Scatter() {
  const t = useT(), d = useData(), locale = useLocale();
  const [y, setY] = useState<'sold' | 'rating'>('sold');
  const [scale, setScale] = useState<'log' | 'linear'>('log');
  const top = [...d.PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 2).map((p) => p.name);
  return (
    <Section title={t({ en: 'Scatter plot (ScatterChart)', ko: '산점도 (ScatterChart)' })} intro={<L
      en="Two values of the same thing (price and units sold, quality and cost) as one point. When values span several orders of magnitude, as prices do, a log scale spaces them evenly. Each group has a colour and can be hidden or shown from the legend; points named in highlight are drawn larger and labelled, and the rest fade. The pointer finds the nearest point, and the arrow keys step through the points from the left, reading each aloud. Points appear one by one from the left, and changing the measure or the scale moves the axes and the points together."
      ko="같은 대상의 두 값(가격과 판매량, 품질과 비용 등)을 점 하나로 나타냅니다. 가격처럼 값이 여러 자릿수에 걸치면 로그 스케일로 간격을 고르게 봅니다. 그룹마다 색이 다르고 범례로 숨기거나 다시 보일 수 있으며, highlight로 지정한 점은 크게 그리고 이름을 붙이며 나머지는 흐려집니다. 포인터를 올리면 가장 가까운 점을 찾고, 방향키로는 왼쪽부터 점을 하나씩 옮겨 가며 값을 읽어 줍니다. 점은 왼쪽부터 차례로 나타나고, 지표나 스케일을 바꾸면 축과 점이 함께 옮겨 갑니다." />}>
      <Demo col data-demo="scatter">
        <Stack direction="row" gap={2} wrap>
          <SegmentedControl size="sm" aria-label={t({ en: 'Vertical axis', ko: '세로축' })} value={y} onChange={setY} options={[{ value: 'sold', label: t({ en: 'Units sold', ko: '판매량' }) }, { value: 'rating', label: t({ en: 'Rating', ko: '평점' }) }]} />
          <SegmentedControl size="sm" aria-label={t({ en: 'Price scale', ko: '가격 스케일' })} value={scale} onChange={setScale} options={[{ value: 'log', label: t({ en: 'Log scale', ko: '로그 스케일' }) }, { value: 'linear', label: t({ en: 'Linear scale', ko: '선형 스케일' }) }]} />
        </Stack>
        <ScatterChart aria-label={t({ en: `${y === 'sold' ? 'Units sold' : 'Rating'} by price`, ko: `가격 대비 ${y === 'sold' ? '판매량' : '평점'}` })} data={d.PRODUCTS.filter((p) => !p.paused) as unknown as Record<string, string | number>[]} x="price" y={y} pointLabel="name"
          group="category" groups={d.CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} highlight={top} xScale={scale} height={280} locale={locale}
          xLabel={t({ en: 'Price (₩)', ko: '가격(원)' })} yLabel={y === 'sold' ? t({ en: 'Units sold, 30 days', ko: '30일 판매량' }) : t({ en: 'Rating (out of 5)', ko: '평점(5점 만점)' })} xFormat={(v) => d.wonShort(v)} yFormat={(v) => (y === 'rating' ? v.toFixed(1) : d.num(v))} />
      </Demo>
    </Section>
  );
}

function Donut() {
  const t = useT(), d = useData(), locale = useLocale();
  return (
    <Section title={t({ en: 'Donut', ko: '도넛' })} intro={<L
      en="Each part's share of the whole. Point at a slice, or move between slices with the arrow keys, and its share appears in the centre. Use it for around five slices; with more, a bar chart is easier to read."
      ko="전체에서 각 부분이 차지하는 비율입니다. 조각에 포인터를 올리거나 방향키로 조각 사이를 옮겨 다니면 가운데에 그 비율이 나타납니다. 조각이 다섯 개 안팎일 때 쓰고, 그보다 많으면 막대 차트가 더 읽기 쉽습니다." />}>
      <Demo data-demo="donut">
        <DonutChart aria-label={t({ en: 'Revenue by category', ko: '분류별 매출' })} locale={locale} centerLabel={t({ en: '30-day revenue', ko: '30일 매출' })} format={(v) => d.wonShort(v)} data={d.CATEGORY_SHARE} />
      </Demo>
    </Section>
  );
}

function Small() {
  const t = useT(), d = useData();
  const top = d.PRODUCTS.filter((p) => !p.paused).sort((a, b) => b.sold - a.sold).slice(0, 5);
  const best = top[0].sold;
  return (
    <Section title={t({ en: 'Small marks', ko: '작은 표시' })} intro={<L
      en="Small figures that sit beside numbers. They are decoration, so screen readers skip them and the number beside them carries the meaning. A sparkline shows a trend, a bar meter (BarMeter) compares sizes, and an interval plot (IntervalPlot) shows a mean and a range against a reference line."
      ko="숫자 옆에 붙는 작은 차트입니다. 장식이므로 스크린 리더에는 숨기고, 의미는 옆의 숫자로 전합니다. 스파크라인은 흐름, 막대 미터(BarMeter)는 크기 비교, 구간 플롯(IntervalPlot)은 평균과 범위를 기준선과 함께 보여 줍니다." />}>
      <div className="grid grid--2">
        <Demo col data-demo="small-spark">
          <Text variant="subhead" tone="secondary">{t({ en: 'Sparkline · bar meter', ko: '스파크라인 · 막대 미터' })}</Text>
          <ul className="mini-list">
            {top.map((p) => (
              <li key={p.id}>
                <span className="mini-list__name">{p.name}</span>
                <Sparkline values={p.trend} style={{ width: 88 }} tone={p.trend[11] >= p.trend[0] ? 'success' : 'danger'} />
                <BarMeter value={p.sold} max={best} width={56} tone={p.sold === best ? 'accent' : 'neutral'} />
                <span className="mini-list__num">{d.num(p.sold)}</span>
              </li>
            ))}
          </ul>
        </Demo>
        <Demo col data-demo="small-interval">
          <Text variant="subhead" tone="secondary">{t({ en: 'Delivery days by region — mean (dot), 90% range (bar), 2-day target (line)', ko: '지역별 배송일 — 평균(점)과 90% 범위(막대), 목표 2일(세로선)' })}</Text>
          <ul className="mini-list">
            {d.REGIONS.map((r) => (
              <li key={r.name}>
                <span className="mini-list__name">{r.name}</span>
                <IntervalPlot value={r.mean} low={r.low} high={r.high} min={0} max={5} reference={2} width={150} tone={r.mean > 2 ? 'accent' : 'neutral'} />
                <span className="mini-list__num">{t({ en: `${r.mean.toFixed(1)} d`, ko: `${r.mean.toFixed(1)}일` })}</span>
              </li>
            ))}
          </ul>
        </Demo>
      </div>
      <Stack gap={1} style={{ marginTop: 8 }}><Text variant="footnote" tone="tertiary">{t({ en: 'To put these inside a table, see “Inside cells” on the Tables page.', ko: '표 안에 넣는 방법은 ‘표’ 페이지의 ‘셀 안의 표시’ 섹션에 있습니다.' })}</Text></Stack>
    </Section>
  );
}
