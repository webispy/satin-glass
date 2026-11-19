/* A dashboard example: the store's operations screen, put together only from components shown on the other
   pages (tabs, cards with headers, stats, charts, tables, filters, chips, tags, banners, empty states, a sheet,
   an accordion). Nothing here is dashboard-specific code: it shows how the parts fit. All data is made up. */
import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, Banner, BarChart, BarMeter, Button, Card, CardBody, CardHeader, Chip, DataTable, DonutChart, EmptyState, IconButton,
  LineChart, Pagination, SearchField, SegmentedControl, Select, Sheet, Sparkline, Stat, Tabs, Tag, Text, Tooltip, useToast,
  type Column, type SortState,
} from '@satin-glass/react';
import { CircleDollarSign, Download, MousePointerClick, PackageSearch, RotateCcw, ShoppingBag, X } from 'lucide-react';
import { Page } from '../shared';
import {
  CATEGORIES, CATEGORY_SHARE, CHANNELS, DAYS, MONTHS, ORDERS, PRODUCTS, STATUS,
  categoryLabel, num, won, wonShort, type CategoryKey, type Order, type OrderStatus, type Product,
} from '../data';

const STAT_LABELS = { up: '증가', down: '감소', flat: '변화 없음' };
const TABLE_LABELS = { selectAll: '모두 선택', sortedAsc: '오름차순 정렬', sortedDesc: '내림차순 정렬' };
const PAGER_LABELS = { previous: '이전 페이지', next: '다음 페이지', page: (n: number) => `${n} 페이지` };
const LOW = PRODUCTS.filter((p) => p.daysLeft !== null && p.daysLeft <= 7);

type Section = 'overview' | 'orders' | 'products';

export function Dashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [lowOnly, setLowOnly] = useState(false);
  const toast = useToast();
  const showLow = () => { setLowOnly(true); setSection('products'); };
  return (
    <Page title="대시보드 예제" intro="다른 페이지의 컴포넌트만 조합해 만든 가상 스토어의 운영 화면입니다. 탭, 제목이 있는 카드, 지표, 차트, 표, 필터, 칩, 태그, 배너, 빈 상태, 시트가 한 화면에서 어떻게 어울리는지 보여 줍니다. 이름과 숫자는 모두 지어낸 것입니다.">
      <div className="dash" data-demo="dashboard">
        <header className="dash__head">
          <div className="dash__title">
            <Text variant="title-2" as="h2">오늘의 스토어</Text>
            <Text variant="footnote" tone="secondary" as="span">11월 18일 18:00 기준</Text>
          </div>
          <div className="dash__tools">
            <SegmentedControl size="sm" aria-label="기간" value={period} onChange={setPeriod} options={[{ value: '7', label: '7일' }, { value: '30', label: '30일' }]} />
            <Tooltip content="보이는 데이터를 CSV로 내려받아요"><IconButton icon={<Download />} label="내려받기" variant="glass" onClick={() => toast({ title: 'CSV를 준비하고 있어요' })} /></Tooltip>
          </div>
        </header>
        <Tabs aria-label="스토어 관리" value={section} onChange={setSection} panelClassName="dash__panel" items={[
          { value: 'overview', label: '개요', content: <Overview period={period} onShowLow={showLow} onShowOrders={() => setSection('orders')} /> },
          { value: 'orders', label: '주문', badge: ORDERS.filter((o) => o.status === 'paid').length, content: <Orders /> },
          { value: 'products', label: '상품', content: <Products lowOnly={lowOnly} setLowOnly={setLowOnly} /> },
        ]} />
      </div>
    </Page>
  );
}

/* ---------------------------------------------------------------- 개요 */
function Overview({ period, onShowLow, onShowOrders }: { period: '7' | '30'; onShowLow: () => void; onShowOrders: () => void }) {
  const n = Number(period);
  const [banner, setBanner] = useState(true);
  const [metric, setMetric] = useState<'visits' | 'orders'>('visits');
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, [period]);
  const days = DAYS.slice(-n), prev = DAYS.slice(-2 * n, -n);
  const sum = (xs: typeof DAYS, k: 'visits' | 'orders' | 'revenue') => xs.reduce((a, d) => a + d[k], 0);
  /* the 30-day view compares with an estimate (the data holds 30 days) */
  const before = (k: 'visits' | 'orders' | 'revenue') => (prev.length ? sum(prev, k) : sum(days, k) * 0.93);
  const delta = (k: 'visits' | 'orders' | 'revenue') => { const v = (sum(days, k) / before(k) - 1) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; };
  const conv = (sum(days, 'orders') / sum(days, 'visits')) * 100;
  const hint = n === 7 ? '지난 7일보다' : '지난 30일보다';
  const top = useMemo(() => PRODUCTS.filter((p) => !p.paused).sort((a, b) => b.revenue - a.revenue).slice(0, 5), []);
  const recent = ORDERS.slice(0, 6);
  return (
    <div className="dash__stack">
      {banner && LOW.length > 0 && (
        <Banner tone="warning" title={`재고가 1주 안에 바닥나는 상품이 ${LOW.length}개 있어요`} onDismiss={() => setBanner(false)} dismissLabel="알림 닫기"
          actions={<Button size="sm" variant="tinted" onClick={onShowLow}>상품 보기</Button>}>
          {LOW.slice(0, 3).map((p) => p.name).join(', ')}{LOW.length > 3 ? ' 외' : ''}
        </Banner>
      )}
      <div className="grid grid--4 dash__kpis">
        <Stat label="방문" icon={<MousePointerClick />} value={num(sum(days, 'visits'))} delta={delta('visits')} hint={hint} trend={days.map((d) => d.visits)} loading={loading} labels={STAT_LABELS} />
        <Stat label="주문" icon={<ShoppingBag />} value={num(sum(days, 'orders'))} delta={delta('orders')} hint={hint} trend={days.map((d) => d.orders)} loading={loading} labels={STAT_LABELS} />
        <Stat label="매출" icon={<CircleDollarSign />} value={wonShort(sum(days, 'revenue'))} delta={delta('revenue')} hint={hint} trend={days.map((d) => d.revenue)} loading={loading} labels={STAT_LABELS} />
        <Stat label="반품률" icon={<RotateCcw />} value="2.8%" delta="+0.4%p" hint={hint} invert trend={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} loading={loading} labels={STAT_LABELS} />
      </div>
      <div className="grid dash__charts">
        <Card>
          <CardHeader title={metric === 'visits' ? '하루 방문' : '하루 주문'} description={`구매 전환율 ${conv.toFixed(1)}%`}
            actions={<SegmentedControl size="sm" aria-label="차트 지표" value={metric} onChange={setMetric} options={[{ value: 'visits', label: '방문' }, { value: 'orders', label: '주문' }]} />} />
          <CardBody>
            <LineChart aria-label={metric === 'visits' ? '하루 방문과 재방문' : '하루 주문'} data={days} x="day" area height={220} locale="ko-KR"
              series={metric === 'visits' ? [{ key: 'visits', label: '방문' }, { key: 'returning', label: '재방문' }] : [{ key: 'orders', label: '주문' }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="경로별 주문" description="최근 6개월" />
          <CardBody>
            <BarChart aria-label="경로별 월 주문" data={MONTHS} x="month" stacked height={220} locale="ko-KR" series={[{ key: 'app', label: '앱' }, { key: 'web', label: '웹' }, { key: 'store', label: '매장' }]} />
          </CardBody>
        </Card>
      </div>
      <div className="grid grid--2">
        <Card>
          <CardHeader title="분류별 매출" description="최근 30일" />
          <CardBody><DonutChart aria-label="분류별 매출" locale="ko-KR" size={160} centerLabel="매출" format={(v) => wonShort(v)} data={CATEGORY_SHARE} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="많이 팔린 상품" description="매출 순, 12주 흐름" />
          <CardBody>
            <ul className="mini-list">
              {top.map((p) => (
                <li key={p.id}>
                  <span className="mini-list__name">{p.name}</span>
                  <Sparkline values={p.trend} style={{ width: 72 }} tone={p.trend[11] >= p.trend[0] ? 'success' : 'danger'} />
                  <BarMeter value={p.revenue} max={top[0].revenue} width={48} tone={p === top[0] ? 'accent' : 'neutral'} />
                  <span className="mini-list__num">{wonShort(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="최근 주문" actions={<Button size="sm" variant="plain" onClick={onShowOrders}>모두 보기</Button>} />
        <CardBody>
          <DataTable<Order> aria-label="최근 주문" rows={recent} rowKey={(o) => o.id} density="compact" columns={ORDER_COLUMNS.filter((c) => c.key !== 'channel' && c.key !== 'customer')} labels={TABLE_LABELS} />
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- 주문 */
const ORDER_COLUMNS: Column<Order>[] = [
  { key: 'id', header: '주문 번호', width: 100, sortable: true },
  { key: 'time', header: '시각', width: 104, sortable: true, firstSort: 'desc', value: (o) => o.at },
  { key: 'customer', header: '주문자', width: 84, sortable: true },
  { key: 'product', header: '상품', width: 190, sortable: true, render: (o) => (o.qty > 1 ? `${o.product} ×${o.qty}` : o.product) },
  { key: 'amount', header: '금액', align: 'end', width: 104, sortable: true, firstSort: 'desc', render: (o) => won(o.amount) },
  { key: 'channel', header: '경로', width: 68, sortable: true },
  { key: 'status', header: '상태', width: 100, sortable: true, value: (o) => STATUS[o.status].label, render: (o) => <Tag tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Tag> },
];
const PAGE = 15;

function Orders() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [channel, setChannel] = useState('all');
  const [sort, setSort] = useState<SortState>({ key: 'time', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const found = useMemo(() => ORDERS.filter((o) => (status === 'all' || o.status === status) && (channel === 'all' || o.channel === channel)
    && (!q.trim() || o.customer.includes(q.trim()) || o.product.includes(q.trim()) || o.id.includes(q.trim()))), [q, status, channel]);
  useEffect(() => setPage(1), [q, status, channel]);
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const sorted = useMemo(() => {
    if (!sort) return found;
    const col = ORDER_COLUMNS.find((c) => c.key === sort.key)!, get = col.value ?? ((o: Order) => o[sort.key as keyof Order]);
    return [...found].sort((a, b) => { const x = get(a) as string | number, y = get(b) as string | number; const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'ko'); return sort.dir === 'asc' ? c : -c; });
  }, [found, sort]);
  const rows = sorted.slice((page - 1) * PAGE, page * PAGE);
  const filtered = q || status !== 'all' || channel !== 'all';
  const reset = () => { setQ(''); setStatus('all'); setChannel('all'); };
  return (
    <Card>
      <CardBody className="dash__table-card">
        <div className="dash__filters">
          <SearchField aria-label="주문 찾기" placeholder="주문자, 상품, 주문 번호" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 240 }} />
          <Select variant="filter" label="상태" value={status} onChange={setStatus} options={[{ value: 'all', label: '전체' }, ...(Object.keys(STATUS) as OrderStatus[]).map((k) => ({ value: k, label: STATUS[k].label }))]} />
          <Select variant="filter" label="경로" value={channel} onChange={setChannel} options={[{ value: 'all', label: '전체' }, ...CHANNELS.map((c) => ({ value: c, label: c }))]} />
          {filtered && <Button size="sm" variant="plain" onClick={reset}>필터 지우기</Button>}
          <span className="dash__spacer" />
          {sel.length > 0 ? (
            <span className="dash__bulk">
              <Text variant="subhead" as="span">{sel.length}건 선택</Text>
              <Button size="sm" variant="tinted" onClick={() => { toast({ title: `${sel.length}건을 배송 준비로 옮겼어요`, tone: 'success' }); setSel([]); }}>배송 준비</Button>
              <IconButton size="sm" icon={<X />} label="선택 해제" onClick={() => setSel([])} />
            </span>
          ) : <Text variant="footnote" tone="secondary" as="span">{num(found.length)}건</Text>}
        </div>
        <DataTable<Order> aria-label="주문" rows={rows} rowKey={(o) => o.id} columns={ORDER_COLUMNS} manualSort sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
          selectable selected={sel} onSelectedChange={setSel} rowCount={found.length} density="compact" labels={{ ...TABLE_LABELS, selectRow: (o) => `주문 ${o.id} 선택` }}
          empty={<EmptyState compact icon={<PackageSearch />} title="조건에 맞는 주문이 없어요" description={q ? `‘${q}’로 찾은 주문이 없어요.` : '다른 상태나 경로를 골라 보세요.'} actions={<Button size="sm" variant="neutral" onClick={reset}>필터 지우기</Button>} />} />
        {found.length > PAGE && (
          <div className="dash__pager">
            <Text variant="footnote" tone="secondary" as="span">{num(found.length)}건 중 {num((page - 1) * PAGE + 1)}–{num(Math.min(page * PAGE, found.length))}</Text>
            <Pagination page={page} pageCount={pages} onChange={setPage} aria-label="주문 페이지" labels={PAGER_LABELS} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- 상품 */
function Products({ lowOnly, setLowOnly }: { lowOnly: boolean; setLowOnly: (v: boolean) => void }) {
  const [cats, setCats] = useState<CategoryKey[]>([]);
  const [open, setOpen] = useState<Product | null>(null);
  const rows = PRODUCTS.filter((p) => (!cats.length || cats.includes(p.category)) && (!lowOnly || (p.daysLeft !== null && p.daysLeft <= 7)));
  const best = Math.max(...PRODUCTS.map((p) => p.sold));
  const live = rows.filter((p) => !p.paused);
  const totals = { id: 'sum', name: '합계', category: 'wear', price: NaN, stock: live.reduce((a, p) => a + p.stock, 0), sold: live.reduce((a, p) => a + p.sold, 0), revenue: live.reduce((a, p) => a + p.revenue, 0), rating: NaN, reviews: 0, returnRate: NaN, daysLeft: null, trend: [], paused: false } as Product;
  const cols: Column<Product>[] = [
    { key: 'name', header: '상품', width: 190, sticky: true, sortable: true, render: (p, { pinned }) => (pinned ? <b>{p.name}</b> : <button type="button" className="dash__link" onClick={() => setOpen(p)}>{p.name}</button>) },
    { key: 'category', header: '분류', width: 80, sortable: true, value: (p) => categoryLabel(p.category), render: (p, { pinned }) => (pinned ? '' : categoryLabel(p.category)) },
    { key: 'price', header: '가격', align: 'end', width: 96, sortable: true, render: (p) => (Number.isNaN(p.price) ? '' : won(p.price)) },
    { key: 'sold', header: '판매량', subheader: '30일', group: '판매', align: 'end', width: 136, sortable: true, firstSort: 'desc',
      render: (p, { pinned }) => (pinned ? num(p.sold) : <span className="sg-cell-meter"><BarMeter value={p.sold} max={best} width={44} tone={p.sold === best ? 'accent' : 'neutral'} /><span className={p.sold === best ? 'sg-cell-strong' : undefined}>{num(p.sold)}</span></span>) },
    { key: 'revenue', header: '매출', subheader: '30일', group: '판매', align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => wonShort(p.revenue) },
    { key: 'stock', header: '재고', group: '재고', align: 'end', width: 76, sortable: true, render: (p) => num(p.stock) },
    { key: 'daysLeft', header: '소진 예상', group: '재고', align: 'end', width: 92, sortable: true, description: '최근 30일 속도로 팔릴 때 재고가 바닥나기까지 남은 날이에요.',
      render: (p) => (p.daysLeft === null ? null : <span className={p.daysLeft <= 7 ? 'sg-cell-danger' : p.daysLeft <= 14 ? 'sg-cell-warning' : undefined}>{p.daysLeft}일</span>) },
    { key: 'state', header: '상태', width: 96, render: (p, { pinned }) => (pinned ? null : p.paused ? <Tag>판매 중지</Tag> : p.daysLeft !== null && p.daysLeft <= 7 ? <Tag tone="danger">재고 부족</Tag> : <Tag tone="success">판매 중</Tag>) },
  ];
  return (
    <Card>
      <CardBody className="dash__table-card">
        <div className="dash__filters" role="group" aria-label="상품 필터">
          {CATEGORIES.map((c) => <Chip key={c.key} selected={cats.includes(c.key)} onSelectedChange={(on) => setCats((x) => (on ? [...x, c.key] : x.filter((y) => y !== c.key)))}>{c.label}</Chip>)}
          <Chip selected={lowOnly} onSelectedChange={setLowOnly}>재고 부족만</Chip>
          <span className="dash__spacer" />
          <Text variant="footnote" tone="secondary" as="span">상품 {rows.length}개</Text>
        </div>
        <DataTable<Product> aria-label="상품" rows={rows} rowKey={(p) => p.id} columns={cols} pinnedRows={live.length ? [totals] : []} defaultSort={{ key: 'sold', dir: 'desc' }} maxHeight={520}
          rowState={(p) => (p.paused ? { muted: true } : undefined)} labels={TABLE_LABELS}
          empty={<EmptyState compact icon={<PackageSearch />} title="조건에 맞는 상품이 없어요" actions={<Button size="sm" variant="neutral" onClick={() => { setCats([]); setLowOnly(false); }}>필터 지우기</Button>} />} />
      </CardBody>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.name} aria-label="상품 정보">
        {open && <ProductDetail p={open} />}
      </Sheet>
    </Card>
  );
}

function ProductDetail({ p }: { p: Product }) {
  return (
    <div className="dash__detail">
      <div className="dash__detail-tags">
        <Tag>{categoryLabel(p.category)}</Tag>
        {p.paused ? <Tag>판매 중지</Tag> : p.daysLeft !== null && p.daysLeft <= 7 ? <Tag tone="danger">재고 부족</Tag> : <Tag tone="success">판매 중</Tag>}
      </div>
      <dl className="dash__facts">
        <div><dt>가격</dt><dd>{won(p.price)}</dd></div>
        <div><dt>30일 판매</dt><dd>{num(p.sold)}개</dd></div>
        <div><dt>재고</dt><dd>{num(p.stock)}개</dd></div>
        <div><dt>평점</dt><dd>{p.rating.toFixed(1)} <small>({num(p.reviews)})</small></dd></div>
      </dl>
      <Text variant="subhead" tone="secondary" as="p">주간 판매 (12주)</Text>
      <Sparkline values={p.trend} height={56} aria-label={`${p.name} 주간 판매 흐름`} />
      <Accordion items={[
        { value: 'ship', title: '배송', meta: '평일 오후 2시 마감', content: <Text variant="subhead" tone="secondary" as="p">오후 2시까지 결제한 주문은 그날 보내요.</Text> },
        { value: 'return', title: '반품', meta: `반품률 ${p.returnRate.toFixed(1)}%`, content: <Text variant="subhead" tone="secondary" as="p">받은 날부터 7일 안에 신청할 수 있어요.</Text> },
      ]} />
    </div>
  );
}
