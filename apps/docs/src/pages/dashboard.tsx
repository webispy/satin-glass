/* A dashboard example: the store's operations screen, put together only from components shown on the other
   pages (tabs, cards with headers, stats, charts, tables, filters, chips, tags, banners, empty states, a sheet,
   an accordion). Nothing here is dashboard-specific code: it shows how the parts fit. All data is made up. */
import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, Banner, BarChart, BarMeter, Button, Card, CardBody, CardHeader, Chip, DataTable, DonutChart, EmptyState, FilterBar, IconButton,
  LineChart, Pagination, SearchField, SegmentedControl, Select, Sheet, Sparkline, Stat, Tabs, Tag, Text, Tooltip, useToast,
  type Column, type SortState,
} from '@satin-glass/react';
import { CircleDollarSign, Download, MousePointerClick, PackageSearch, RotateCcw, ShoppingBag, X } from 'lucide-react';
import { Page } from '../shared';
import { L, useLocale, useT } from '../i18n';
import { useData, type CategoryKey, type Order, type OrderStatus, type Product } from '../data';

/* words the components say themselves, in the reader's language */
function useLabels() {
  const t = useT();
  return {
    stat: { up: t({ en: 'Up', ko: '증가' }), down: t({ en: 'Down', ko: '감소' }), flat: t({ en: 'No change', ko: '변화 없음' }) },
    table: { selectAll: t({ en: 'Select all', ko: '모두 선택' }), sortedAsc: t({ en: 'Sorted ascending', ko: '오름차순 정렬' }), sortedDesc: t({ en: 'Sorted descending', ko: '내림차순 정렬' }) },
    filter: { clear: t({ en: 'Clear filters', ko: '필터 초기화' }), applied: (n: number) => t({ en: n === 1 ? '1 filter' : `${n} filters`, ko: `필터 ${n}개` }) },
    pager: { previous: t({ en: 'Previous page', ko: '이전 페이지' }), next: t({ en: 'Next page', ko: '다음 페이지' }), page: (n: number) => t({ en: `Page ${n}`, ko: `${n} 페이지` }) },
  };
}
/* products that run out within a week */
function useLow() {
  const d = useData();
  return useMemo(() => d.PRODUCTS.filter((p) => p.daysLeft !== null && p.daysLeft <= 7), [d]);
}

type Section = 'overview' | 'orders' | 'products';

export function Dashboard() {
  const t = useT(), d = useData();
  const [section, setSection] = useState<Section>('overview');
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [lowOnly, setLowOnly] = useState(false);
  const toast = useToast();
  const showLow = () => { setLowOnly(true); setSection('products'); };
  return (
    <Page title={t({ en: 'Dashboard', ko: '대시보드' })} intro={<L
      en="The operations screen of a made-up store, built only from components on the other pages. It shows how tabs, cards, stats, charts, tables, filters, chips, tags, banners, empty states, a sheet and an accordion work together on one screen. All names and numbers are made up."
      ko="다른 페이지의 컴포넌트만 조합해 만든 가상 스토어의 운영 화면입니다. 탭, 카드, 지표, 차트, 표, 필터, 칩, 태그, 배너, 빈 상태, 시트, 아코디언이 한 화면에서 어떻게 함께 쓰이는지 보여 줍니다. 이름과 숫자는 모두 지어낸 것입니다." />}>
      <div className="dash" data-demo="dashboard">
        <header className="dash__head">
          <div className="dash__title">
            <Text variant="title-2" as="h2">{t({ en: 'Store today', ko: '오늘의 스토어' })}</Text>
            <Text variant="footnote" tone="secondary" as="span">{t({ en: 'As of Nov 18, 6:00 PM', ko: '11월 18일 18:00 기준' })}</Text>
          </div>
          <div className="dash__tools">
            <SegmentedControl aria-label={t({ en: 'Period', ko: '기간' })} value={period} onChange={setPeriod} options={[{ value: '7', label: t({ en: '7 days', ko: '7일' }) }, { value: '30', label: t({ en: '30 days', ko: '30일' }) }]} />
            <Tooltip content={t({ en: 'Download the data shown as CSV', ko: '보이는 데이터를 CSV로 내려받아요' })}><IconButton icon={<Download />} label={t({ en: 'Download', ko: '내려받기' })} variant="glass" onClick={() => toast({ title: t({ en: 'Preparing the CSV', ko: 'CSV를 준비하고 있어요' }) })} /></Tooltip>
          </div>
        </header>
        <Tabs aria-label={t({ en: 'Store management', ko: '스토어 관리' })} value={section} onChange={setSection} panelClassName="dash__panel" items={[
          { value: 'overview', label: t({ en: 'Overview', ko: '개요' }), content: <Overview period={period} onShowLow={showLow} onShowOrders={() => setSection('orders')} /> },
          { value: 'orders', label: t({ en: 'Orders', ko: '주문' }), badge: d.ORDERS.filter((o) => o.status === 'paid').length, content: <Orders /> },
          { value: 'products', label: t({ en: 'Products', ko: '상품' }), content: <Products lowOnly={lowOnly} setLowOnly={setLowOnly} /> },
        ]} />
      </div>
    </Page>
  );
}

/* ---------------------------------------------------------------- overview */
function Overview({ period, onShowLow, onShowOrders }: { period: '7' | '30'; onShowLow: () => void; onShowOrders: () => void }) {
  const t = useT(), d = useData(), locale = useLocale(), labels = useLabels(), LOW = useLow(), orderColumns = useOrderColumns();
  const n = Number(period);
  const [banner, setBanner] = useState(true);
  const [metric, setMetric] = useState<'visits' | 'orders'>('visits');
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const id = setTimeout(() => setLoading(false), 700); return () => clearTimeout(id); }, [period]);
  const days = d.DAYS.slice(-n), prev = d.DAYS.slice(-2 * n, -n);
  const sum = (xs: typeof d.DAYS, k: 'visits' | 'orders' | 'revenue') => xs.reduce((a, x) => a + x[k], 0);
  /* the 30-day view compares with an estimate (the data holds 30 days) */
  const before = (k: 'visits' | 'orders' | 'revenue') => (prev.length ? sum(prev, k) : sum(days, k) * 0.93);
  const delta = (k: 'visits' | 'orders' | 'revenue') => { const v = (sum(days, k) / before(k) - 1) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; };
  const conv = (sum(days, 'orders') / sum(days, 'visits')) * 100;
  const hint = n === 7 ? t({ en: 'vs previous 7 days', ko: '직전 7일 대비' }) : t({ en: 'vs previous 30 days', ko: '직전 30일 대비' });
  const top = useMemo(() => d.PRODUCTS.filter((p) => !p.paused).sort((a, b) => b.revenue - a.revenue).slice(0, 5), [d]);
  const recent = d.ORDERS.slice(0, 6);
  const visits = t({ en: 'Visits', ko: '방문' }), orders = t({ en: 'Orders', ko: '주문' }), revenue = t({ en: 'Revenue', ko: '매출' });
  const last30 = t({ en: 'Last 30 days', ko: '최근 30일' }), byCategory = t({ en: 'Revenue by category', ko: '분류별 매출' }), recentTitle = t({ en: 'Recent orders', ko: '최근 주문' });
  return (
    <div className="dash__stack">
      {banner && LOW.length > 0 && (
        <Banner tone="warning" title={t({ en: LOW.length === 1 ? '1 product will run out of stock within 7 days' : `${LOW.length} products will run out of stock within 7 days`, ko: `재고가 7일 안에 바닥나는 상품이 ${LOW.length}개 있어요` })}
          onDismiss={() => setBanner(false)} dismissLabel={t({ en: 'Dismiss', ko: '알림 닫기' })}
          actions={<Button size="sm" variant="tinted" onClick={onShowLow}>{t({ en: 'View products', ko: '상품 보기' })}</Button>}>
          {LOW.slice(0, 3).map((p) => p.name).join(', ')}{LOW.length > 3 ? t({ en: ` and ${LOW.length - 3} more`, ko: ` 외 ${LOW.length - 3}개` }) : ''}
        </Banner>
      )}
      <div className="grid grid--4 dash__kpis">
        <Stat label={visits} icon={<MousePointerClick />} value={d.num(sum(days, 'visits'))} delta={delta('visits')} hint={hint} trend={days.map((x) => x.visits)} loading={loading} labels={labels.stat} />
        <Stat label={orders} icon={<ShoppingBag />} value={d.num(sum(days, 'orders'))} delta={delta('orders')} hint={hint} trend={days.map((x) => x.orders)} loading={loading} labels={labels.stat} />
        <Stat label={revenue} icon={<CircleDollarSign />} value={d.wonShort(sum(days, 'revenue'))} delta={delta('revenue')} hint={hint} trend={days.map((x) => x.revenue)} loading={loading} labels={labels.stat} />
        <Stat label={t({ en: 'Return rate', ko: '반품률' })} icon={<RotateCcw />} value="2.8%" delta={t({ en: '+0.4 pp', ko: '+0.4%p' })} hint={hint} invert trend={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} loading={loading} labels={labels.stat} />
      </div>
      <div className="grid dash__charts">
        <Card>
          <CardHeader title={metric === 'visits' ? t({ en: 'Daily visits', ko: '일별 방문' }) : t({ en: 'Daily orders', ko: '일별 주문' })} description={t({ en: `Conversion rate ${conv.toFixed(1)}%`, ko: `구매 전환율 ${conv.toFixed(1)}%` })}
            actions={<SegmentedControl size="sm" aria-label={t({ en: 'Chart metric', ko: '차트 지표' })} value={metric} onChange={setMetric} options={[{ value: 'visits', label: visits }, { value: 'orders', label: orders }]} />} />
          <CardBody>
            <LineChart aria-label={metric === 'visits' ? t({ en: 'Daily visits and return visits', ko: '일별 방문과 재방문' }) : t({ en: 'Daily orders', ko: '일별 주문' })} data={days} x="day" area height={220} locale={locale}
              series={metric === 'visits' ? [{ key: 'visits', label: visits }, { key: 'returning', label: t({ en: 'Returning', ko: '재방문' }) }] : [{ key: 'orders', label: orders }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t({ en: 'Orders by channel', ko: '경로별 주문' })} description={t({ en: 'Last 6 months', ko: '최근 6개월' })} />
          <CardBody>
            <BarChart aria-label={t({ en: 'Monthly orders by channel', ko: '경로별 월 주문' })} data={d.MONTHS} x="month" stacked height={220} locale={locale}
              series={[{ key: 'app', label: t({ en: 'App', ko: '앱' }) }, { key: 'web', label: t({ en: 'Web', ko: '웹' }) }, { key: 'store', label: t({ en: 'Store', ko: '매장' }) }]} />
          </CardBody>
        </Card>
      </div>
      <div className="grid grid--2">
        <Card>
          <CardHeader title={byCategory} description={last30} />
          <CardBody><DonutChart aria-label={byCategory} locale={locale} size={160} centerLabel={revenue} format={(v) => d.wonShort(v)} data={d.CATEGORY_SHARE} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={t({ en: 'Best sellers', ko: '많이 팔린 상품' })} description={t({ en: 'By revenue, 12-week trend', ko: '매출순, 12주 추이' })} />
          <CardBody>
            <ul className="mini-list">
              {top.map((p) => (
                <li key={p.id}>
                  <span className="mini-list__name">{p.name}</span>
                  <Sparkline values={p.trend} style={{ width: 72 }} tone={p.trend[11] >= p.trend[0] ? 'success' : 'danger'} />
                  <BarMeter value={p.revenue} max={top[0].revenue} width={48} tone={p === top[0] ? 'accent' : 'neutral'} />
                  <span className="mini-list__num">{d.wonShort(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title={recentTitle} actions={<Button size="sm" variant="plain" onClick={onShowOrders}>{t({ en: 'View all', ko: '모두 보기' })}</Button>} />
        <CardBody>
          <DataTable<Order> aria-label={recentTitle} rows={recent} rowKey={(o) => o.id} density="compact" columns={orderColumns.filter((c) => c.key !== 'channel' && c.key !== 'customer')} labels={labels.table} />
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- orders */
function useOrderColumns(): Column<Order>[] {
  const t = useT(), d = useData();
  return useMemo(() => [
    { key: 'id', header: t({ en: 'Order', ko: '주문 번호' }), width: 100, sortable: true },
    { key: 'time', header: t({ en: 'Time', ko: '시각' }), width: 104, sortable: true, firstSort: 'desc', value: (o) => o.at },
    { key: 'customer', header: t({ en: 'Customer', ko: '주문자' }), width: t({ en: 116, ko: 84 }), sortable: true },
    { key: 'product', header: t({ en: 'Product', ko: '상품' }), width: 190, sortable: true, render: (o) => (o.qty > 1 ? `${o.product} ×${o.qty}` : o.product) },
    { key: 'amount', header: t({ en: 'Amount', ko: '금액' }), align: 'end', width: 104, sortable: true, firstSort: 'desc', render: (o) => d.won(o.amount) },
    { key: 'channel', header: t({ en: 'Channel', ko: '경로' }), width: t({ en: 84, ko: 68 }), sortable: true },
    { key: 'status', header: t({ en: 'Status', ko: '상태' }), width: 100, sortable: true, value: (o) => d.STATUS[o.status].label, render: (o) => <Tag tone={d.STATUS[o.status].tone}>{d.STATUS[o.status].label}</Tag> },
  ] as Column<Order>[], [d]);
}
const PAGE = 15;

function Orders() {
  const t = useT(), d = useData(), labels = useLabels(), orderColumns = useOrderColumns();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [channel, setChannel] = useState('all');
  const [sort, setSort] = useState<SortState>({ key: 'time', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const found = useMemo(() => d.ORDERS.filter((o) => (status === 'all' || o.status === status) && (channel === 'all' || o.channel === channel)
    && (!q.trim() || [o.customer, o.product, o.id].some((x) => x.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())))), [d, q, status, channel]);
  useEffect(() => setPage(1), [q, status, channel]);
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const sorted = useMemo(() => {
    if (!sort) return found;
    const col = orderColumns.find((c) => c.key === sort.key)!, get = col.value ?? ((o: Order) => o[sort.key as keyof Order]);
    return [...found].sort((a, b) => { const x = get(a) as string | number, y = get(b) as string | number; const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), d.lang); return sort.dir === 'asc' ? c : -c; });
  }, [found, sort, orderColumns, d]);
  const rows = sorted.slice((page - 1) * PAGE, page * PAGE);
  const applied = (q ? 1 : 0) + (status !== 'all' ? 1 : 0) + (channel !== 'all' ? 1 : 0);
  const reset = () => { setQ(''); setStatus('all'); setChannel('all'); };
  const all = t({ en: 'All', ko: '전체' });
  const from = d.num((page - 1) * PAGE + 1), to = d.num(Math.min(page * PAGE, found.length)), total = d.num(found.length);
  return (
    <Card>
      <CardBody className="dash__table-card">
        <div className="dash__filters">
          <FilterBar aria-label={t({ en: 'Order filters', ko: '주문 필터' })} className="dash__filterbar" count={applied} onClear={reset} labels={labels.filter}>
            <SearchField aria-label={t({ en: 'Find an order', ko: '주문 찾기' })} placeholder={t({ en: 'Customer, product, order no.', ko: '주문자, 상품, 주문 번호' })} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 240 }} />
            <Select variant="filter" label={t({ en: 'Status', ko: '상태' })} value={status} onChange={setStatus} options={[{ value: 'all', label: all }, ...(Object.keys(d.STATUS) as OrderStatus[]).map((k) => ({ value: k, label: d.STATUS[k].label }))]} />
            <Select variant="filter" label={t({ en: 'Channel', ko: '경로' })} value={channel} onChange={setChannel} options={[{ value: 'all', label: all }, ...d.CHANNELS.map((c) => ({ value: c, label: c }))]} />
          </FilterBar>
          {sel.length > 0 ? (
            <span className="dash__bulk">
              <Text variant="subhead" as="span">{t({ en: `${sel.length} selected`, ko: `${sel.length}건 선택` })}</Text>
              <Button size="sm" variant="tinted" onClick={() => { toast({ title: t({ en: `Marked ${sel.length} ${sel.length === 1 ? 'order' : 'orders'} as “Ready to ship”`, ko: `${sel.length}건을 ‘배송 준비’로 바꿨어요` }), tone: 'success' }); setSel([]); }}>{t({ en: 'Ready to ship', ko: '배송 준비' })}</Button>
              <IconButton size="sm" icon={<X />} label={t({ en: 'Clear selection', ko: '선택 해제' })} onClick={() => setSel([])} />
            </span>
          ) : <Text variant="footnote" tone="secondary" as="span">{t({ en: found.length === 1 ? '1 order' : `${total} orders`, ko: `${total}건` })}</Text>}
        </div>
        <DataTable<Order> aria-label={t({ en: 'Orders', ko: '주문' })} rows={rows} rowKey={(o) => o.id} columns={orderColumns} manualSort sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
          selectable selected={sel} onSelectedChange={setSel} rowCount={found.length} density="compact" labels={{ ...labels.table, selectRow: (o) => t({ en: `Select order ${o.id}`, ko: `주문 ${o.id} 선택` }) }}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title={t({ en: 'No orders match', ko: '조건에 맞는 주문이 없어요' })}
            description={q ? t({ en: `Nothing found for “${q}”.`, ko: `‘${q}’ 검색 결과가 없어요.` }) : t({ en: 'Try another status or channel.', ko: '다른 상태나 경로를 선택해 보세요.' })}
            actions={<Button size="sm" variant="neutral" onClick={reset}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />} />
        {found.length > PAGE && (
          <div className="dash__pager">
            <Text variant="footnote" tone="secondary" as="span">{t({ en: `${from}–${to} of ${total}`, ko: `${total}건 중 ${from}–${to}` })}</Text>
            <Pagination page={page} pageCount={pages} onChange={setPage} aria-label={t({ en: 'Order pages', ko: '주문 페이지' })} labels={labels.pager} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- products */
/* a product's sale state as a tag */
function StateTag({ p }: { p: Product }) {
  const t = useT();
  return p.paused ? <Tag>{t({ en: 'Paused', ko: '판매 중지' })}</Tag>
    : p.daysLeft !== null && p.daysLeft <= 7 ? <Tag tone="danger">{t({ en: 'Low stock', ko: '재고 부족' })}</Tag>
    : <Tag tone="success">{t({ en: 'Active', ko: '판매 중' })}</Tag>;
}

function Products({ lowOnly, setLowOnly }: { lowOnly: boolean; setLowOnly: (v: boolean) => void }) {
  const t = useT(), d = useData(), labels = useLabels();
  const [cats, setCats] = useState<CategoryKey[]>([]);
  const [open, setOpen] = useState<Product | null>(null);
  const rows = d.PRODUCTS.filter((p) => (!cats.length || cats.includes(p.category)) && (!lowOnly || (p.daysLeft !== null && p.daysLeft <= 7)));
  const best = Math.max(...d.PRODUCTS.map((p) => p.sold));
  const live = rows.filter((p) => !p.paused);
  const totals = { id: 'sum', name: t({ en: 'Total', ko: '합계' }), category: 'wear', price: NaN, stock: live.reduce((a, p) => a + p.stock, 0), sold: live.reduce((a, p) => a + p.sold, 0), revenue: live.reduce((a, p) => a + p.revenue, 0), rating: NaN, reviews: 0, returnRate: NaN, daysLeft: null, trend: [], paused: false } as Product;
  const sales = t({ en: 'Sales', ko: '판매' }), stock = t({ en: 'Stock', ko: '재고' }), days30 = t({ en: '30 days', ko: '30일' });
  const cols: Column<Product>[] = [
    { key: 'name', header: t({ en: 'Product', ko: '상품' }), width: 190, sticky: true, sortable: true, render: (p, { pinned }) => (pinned ? <b>{p.name}</b> : <button type="button" className="dash__link" onClick={() => setOpen(p)}>{p.name}</button>) },
    { key: 'category', header: t({ en: 'Category', ko: '분류' }), width: t({ en: 104, ko: 80 }), sortable: true, value: (p) => d.categoryLabel(p.category), render: (p, { pinned }) => (pinned ? '' : d.categoryLabel(p.category)) },
    { key: 'price', header: t({ en: 'Price', ko: '가격' }), align: 'end', width: 96, sortable: true, render: (p) => (Number.isNaN(p.price) ? '' : d.won(p.price)) },
    { key: 'sold', header: t({ en: 'Units sold', ko: '판매량' }), subheader: days30, group: sales, align: 'end', width: 136, sortable: true, firstSort: 'desc',
      render: (p, { pinned }) => (pinned ? d.num(p.sold) : <span className="sg-cell-meter"><BarMeter value={p.sold} max={best} width={44} tone={p.sold === best ? 'accent' : 'neutral'} /><span className={p.sold === best ? 'sg-cell-strong' : undefined}>{d.num(p.sold)}</span></span>) },
    { key: 'revenue', header: t({ en: 'Revenue', ko: '매출' }), subheader: days30, group: sales, align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => d.wonShort(p.revenue) },
    { key: 'stock', header: t({ en: 'In stock', ko: '재고량' }), group: stock, align: 'end', width: 76, sortable: true, render: (p) => d.num(p.stock) },
    { key: 'daysLeft', header: t({ en: 'Runs out in', ko: '소진 예상' }), group: stock, align: 'end', width: t({ en: 100, ko: 92 }), sortable: true,
      description: t({ en: 'Days until stock runs out at the last 30 days’ sales pace.', ko: '최근 30일 판매 속도를 기준으로 재고가 소진되기까지 남은 일수예요.' }),
      render: (p) => (p.daysLeft === null ? null : <span className={p.daysLeft <= 7 ? 'sg-cell-danger' : p.daysLeft <= 14 ? 'sg-cell-warning' : undefined}>{t({ en: `${p.daysLeft} d`, ko: `${p.daysLeft}일` })}</span>) },
    { key: 'state', header: t({ en: 'Status', ko: '상태' }), width: 96, render: (p, { pinned }) => (pinned ? null : <StateTag p={p} />) },
  ];
  const clear = () => { setCats([]); setLowOnly(false); };
  return (
    <Card>
      <CardBody className="dash__table-card">
        <div className="dash__filters">
          <FilterBar aria-label={t({ en: 'Product filters', ko: '상품 필터' })} className="dash__filterbar" count={cats.length + (lowOnly ? 1 : 0)} onClear={clear} labels={labels.filter}>
            {d.CATEGORIES.map((c) => <Chip key={c.key} selected={cats.includes(c.key)} onSelectedChange={(on) => setCats((x) => (on ? [...x, c.key] : x.filter((y) => y !== c.key)))}>{c.label}</Chip>)}
            <Chip selected={lowOnly} onSelectedChange={setLowOnly}>{t({ en: 'Low stock only', ko: '재고 부족만' })}</Chip>
          </FilterBar>
          <Text variant="footnote" tone="secondary" as="span">{t({ en: rows.length === 1 ? '1 product' : `${rows.length} products`, ko: `상품 ${rows.length}개` })}</Text>
        </div>
        <DataTable<Product> aria-label={t({ en: 'Products', ko: '상품' })} rows={rows} rowKey={(p) => p.id} columns={cols} pinnedRows={live.length ? [totals] : []} defaultSort={{ key: 'sold', dir: 'desc' }} maxHeight={520}
          rowState={(p) => (p.paused ? { muted: true } : undefined)} labels={labels.table}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title={t({ en: 'No products match', ko: '조건에 맞는 상품이 없어요' })} actions={<Button size="sm" variant="neutral" onClick={clear}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />} />
      </CardBody>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.name} aria-label={t({ en: 'Product details', ko: '상품 정보' })}>
        {open && <ProductDetail p={open} />}
      </Sheet>
    </Card>
  );
}

function ProductDetail({ p }: { p: Product }) {
  const t = useT(), d = useData();
  return (
    <div className="dash__detail">
      <div className="dash__detail-tags">
        <Tag>{d.categoryLabel(p.category)}</Tag>
        <StateTag p={p} />
      </div>
      <dl className="dash__facts">
        <div><dt>{t({ en: 'Price', ko: '가격' })}</dt><dd>{d.won(p.price)}</dd></div>
        <div><dt>{t({ en: 'Sold in 30 days', ko: '30일 판매' })}</dt><dd>{t({ en: d.num(p.sold), ko: `${d.num(p.sold)}개` })}</dd></div>
        <div><dt>{t({ en: 'In stock', ko: '재고' })}</dt><dd>{t({ en: d.num(p.stock), ko: `${d.num(p.stock)}개` })}</dd></div>
        <div><dt>{t({ en: 'Rating', ko: '평점' })}</dt><dd>{p.rating.toFixed(1)} <small>({d.num(p.reviews)})</small></dd></div>
      </dl>
      <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Weekly sales (12 weeks)', ko: '주간 판매 (12주)' })}</Text>
      <Sparkline values={p.trend} height={56} aria-label={t({ en: `${p.name} weekly sales trend`, ko: `${p.name} 주간 판매 추이` })} />
      <Accordion items={[
        { value: 'ship', title: t({ en: 'Shipping', ko: '배송' }), meta: t({ en: 'Weekdays, order by 2 PM', ko: '평일 오후 2시 마감' }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Orders paid by 2 PM ship the same day.', ko: '오후 2시까지 결제한 주문은 당일 출고해요.' })}</Text> },
        { value: 'return', title: t({ en: 'Returns', ko: '반품' }), meta: t({ en: `Return rate ${p.returnRate.toFixed(1)}%`, ko: `반품률 ${p.returnRate.toFixed(1)}%` }), content: <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Returns can be requested within 7 days of delivery.', ko: '받은 날부터 7일 안에 신청할 수 있어요.' })}</Text> },
      ]} />
    </div>
  );
}
