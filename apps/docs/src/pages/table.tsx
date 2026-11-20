/* Data table: one table component from a plain sortable list up to thousands of rows or server paging. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarMeter, Button, Chip, DataTable, EmptyState, Pagination, SearchField, SegmentedControl, Select, Stack, Switch, Tag, Text, type Column, type SortState,
} from '@satin-glass/react';
import { PackageSearch } from 'lucide-react';
import { Demo, Page, Section } from '../shared';
import { CATEGORIES, ORDERS, PRODUCTS, STATUS, categoryLabel, num, won, wonShort, type Order, type Product } from '../data';

const TABLE_LABELS = { selectAll: '모든 행 선택', sortedAsc: '오름차순 정렬', sortedDesc: '내림차순 정렬', empty: '데이터가 없어요' };
const BEST_SOLD = Math.max(...PRODUCTS.map((p) => p.sold));

/* columns shared by the product demos */
const name: Column<Product> = { key: 'name', header: '상품', width: 200, sortable: true };
const category: Column<Product> = { key: 'category', header: '분류', width: 96, sortable: true, value: (p) => categoryLabel(p.category), render: (p) => categoryLabel(p.category) };
const price: Column<Product> = { key: 'price', header: '가격', align: 'end', width: 104, sortable: true, render: (p) => won(p.price) };
const stock: Column<Product> = { key: 'stock', header: '재고', align: 'end', width: 84, sortable: true, render: (p) => num(p.stock) };
const sold: Column<Product> = { key: 'sold', header: '판매량', align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => num(p.sold) };

export function TablePage() {
  return (
    <Page title="표" intro="숫자를 비교하고 고르는 표입니다. 같은 컴포넌트가 몇 줄짜리 목록부터, 열 그룹과 요약 행이 있는 비교 표, 수천 행, 서버가 정렬·페이지를 맡는 표까지 맡습니다. 숫자는 끝에 맞춰 같은 폭 숫자로 씁니다.">
      <Basic />
      <Selection />
      <Filters />
      <Groups />
      <Cells />
      <States />
      <Server />
      <Virtual />
    </Page>
  );
}

function Basic() {
  const [density, setDensity] = useState<'regular' | 'compact'>('regular');
  return (
    <Section title="정렬" intro="머리글을 누르면 오름차순 → 내림차순 → 정렬 끔 순서로 바뀝니다. 큰 값이 좋은 열은 내림차순부터 시작하게 할 수 있고(firstSort), 빈 값은 방향과 상관없이 늘 맨 뒤에 둡니다.">
      <Demo col data-demo="table-basic">
        <SegmentedControl size="sm" aria-label="행 간격" value={density} onChange={setDensity} options={[{ value: 'regular', label: '보통' }, { value: 'compact', label: '촘촘하게' }]} style={{ alignSelf: 'flex-start' }} />
        <DataTable<Product> aria-label="상품 목록" rows={PRODUCTS.slice(0, 8)} rowKey={(p) => p.id} columns={[name, category, price, stock, sold]} density={density} labels={TABLE_LABELS} />
      </Demo>
    </Section>
  );
}

function Selection() {
  const [sel, setSel] = useState<string[]>(['p2']);
  return (
    <Section title="행 선택" intro="머리글 체크박스는 일부만 골랐을 때 미정 상태가 됩니다. Shift를 누른 채 누르면 범위를 고르고, 키보드로는 Space, 모두 고르기는 Ctrl/Cmd+A입니다.">
      <Demo col data-demo="table-select">
        <div className="table-bar" data-on={sel.length > 0 || undefined}>
          <Text variant="subhead" as="span">{sel.length ? `${sel.length}개 선택됨` : '상품을 골라 보세요'}</Text>
          <span className="table-bar__actions">
            <Button size="sm" variant="tinted" disabled={!sel.length}>판매 중지</Button>
            <Button size="sm" variant="plain" disabled={!sel.length} onClick={() => setSel([])}>선택 해제</Button>
          </span>
        </div>
        <DataTable<Product> aria-label="고를 수 있는 상품 목록" rows={PRODUCTS.slice(0, 8)} rowKey={(p) => p.id} columns={[name, category, price, stock]}
          selectable selected={sel} onSelectedChange={setSel} labels={{ ...TABLE_LABELS, selectRow: (p) => `${p.name} 선택` }} />
      </Demo>
    </Section>
  );
}

/* FilterBar — a recipe, not a library component: the controls are the library's own, the app owns the filter state.
   A named group in reading order (each control keeps its own keys), wrapping when narrow, with the applied count
   and one "clear" that resets the same criteria the count counts; focus goes back to the first control when the
   clear button goes away. */
function FilterBar({ children, count, onClear, labels }: { children: ReactNode; count: number; onClear: () => void; labels: { group: string; clear: string; applied: (n: number) => string } }) {
  const box = useRef<HTMLDivElement>(null);
  const clear = () => { onClear(); box.current?.querySelector<HTMLElement>('input, button')?.focus(); };
  return (
    <div ref={box} role="group" aria-label={labels.group} className="filterbar">
      {children}
      {count > 0 && (
        <span className="filterbar__applied">
          <Text variant="footnote" tone="secondary" as="span">{labels.applied(count)}</Text>
          <Button size="sm" variant="plain" onClick={clear}>{labels.clear}</Button>
        </span>
      )}
    </div>
  );
}

function Filters() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [inStock, setInStock] = useState(false);
  const [cheap, setCheap] = useState(false);
  const count = (q ? 1 : 0) + (cat !== 'all' ? 1 : 0) + (inStock ? 1 : 0) + (cheap ? 1 : 0);
  const rows = PRODUCTS.filter((p) => (!q || p.name.includes(q)) && (cat === 'all' || p.category === cat) && (!inStock || p.stock > 0) && (!cheap || p.price < 30000));
  return (
    <Section title="필터 줄 (조합 예시)" intro="표나 목록 위의 검색 · 필터 · 적용 개수 · 초기화 줄입니다. 라이브러리 컴포넌트가 아니라 조합 예시예요: 검색란(SearchField), 알약형 셀렉트(Select variant=&quot;filter&quot;), 토글 칩(Chip)을 이름 붙은 그룹으로 묶고, 필터 상태는 앱이 가집니다. 각 컨트롤은 제 키를 그대로 쓰고 Tab은 읽는 순서대로 갑니다. 좁으면 다음 줄로 넘어가고, 초기화는 개수가 센 조건을 모두 되돌린 뒤 첫 컨트롤로 포커스를 옮겨요. 줄 자체는 움직이지 않습니다.">
      <Demo col data-demo="filterbar">
        <FilterBar count={count} onClear={() => { setQ(''); setCat('all'); setInStock(false); setCheap(false); }}
          labels={{ group: '상품 필터', clear: '초기화', applied: (n) => `필터 ${n}개` }}>
          <SearchField aria-label="상품 찾기" placeholder="상품 이름" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 200 }} />
          <Select variant="filter" label="분류" value={cat} onChange={setCat} options={[{ value: 'all', label: '전체' }, ...CATEGORIES.map((c) => ({ value: c.key, label: c.label }))]} />
          <Chip selected={inStock} onSelectedChange={setInStock}>재고 있음</Chip>
          <Chip selected={cheap} onSelectedChange={setCheap}>3만 원 미만</Chip>
        </FilterBar>
        <DataTable<Product> aria-label="걸러진 상품" rows={rows.slice(0, 6)} rowKey={(r) => r.id} columns={[name, category, price, stock]} density="compact" labels={TABLE_LABELS}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title="조건에 맞는 상품이 없어요" actions={<Button size="sm" variant="neutral" onClick={() => { setQ(''); setCat('all'); setInStock(false); setCheap(false); }}>필터 지우기</Button>} />} />
        <Text variant="footnote" tone="secondary">{rows.length > 6 ? `${num(rows.length)}개 중 6개만 보여 줘요.` : `${num(rows.length)}개`}</Text>
      </Demo>
    </Section>
  );
}

function Groups() {
  const rows = PRODUCTS.filter((p) => !p.paused);
  const total = (k: 'sold' | 'revenue' | 'stock') => rows.reduce((a, p) => a + p[k], 0);
  const avg = (k: 'price' | 'rating' | 'returnRate') => rows.reduce((a, p) => a + p[k], 0) / rows.length;
  const pinned = [
    { id: 'sum', name: '합계', category: 'wear', price: NaN, stock: total('stock'), sold: total('sold'), revenue: total('revenue'), rating: NaN, reviews: 0, returnRate: NaN, daysLeft: null, trend: [], paused: false },
    { id: 'avg', name: '평균', category: 'wear', price: Math.round(avg('price')), stock: Math.round(total('stock') / rows.length), sold: Math.round(total('sold') / rows.length), revenue: Math.round(total('revenue') / rows.length), rating: +avg('rating').toFixed(1), reviews: 0, returnRate: +avg('returnRate').toFixed(1), daysLeft: null, trend: [], paused: false },
  ] as Product[];
  const n = (v: number, f: (v: number) => string) => (Number.isNaN(v) ? '' : f(v));
  const cols: Column<Product>[] = [
    { ...name, sticky: true, render: (p, { pinned }) => (pinned ? <b>{p.name}</b> : p.name) },
    { ...category, render: (p, { pinned }) => (pinned ? '' : categoryLabel(p.category)) },
    { ...price, render: (p) => n(p.price, won) },
    { key: 'sold', header: '판매량', subheader: '최근 30일', group: '판매', align: 'end', width: 100, sortable: true, firstSort: 'desc', render: (p) => num(p.sold) },
    { key: 'revenue', header: '매출', subheader: '최근 30일', group: '판매', align: 'end', width: 108, sortable: true, firstSort: 'desc', render: (p) => wonShort(p.revenue) },
    { key: 'returnRate', header: '반품률', subheader: '%', group: '판매', align: 'end', width: 92, sortable: true, description: '받은 주문 중 반품으로 돌아온 비율이에요.', render: (p) => n(p.returnRate, (v) => v.toFixed(1)) },
    { key: 'stock', header: '재고', subheader: '개', group: '재고', align: 'end', width: 84, sortable: true, render: (p) => num(p.stock) },
    { key: 'daysLeft', header: '소진 예상', subheader: '일', group: '재고', align: 'end', width: 100, sortable: true, description: '최근 30일 속도로 팔릴 때 재고가 바닥나기까지 남은 날이에요.', render: (p) => (p.daysLeft === null ? '' : num(p.daysLeft)) },
    { key: 'rating', header: '평점', subheader: '5점 만점', group: '후기', align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => n(p.rating, (v) => v.toFixed(1)) },
    { key: 'reviews', header: '후기 수', group: '후기', align: 'end', width: 84, sortable: true, firstSort: 'desc', render: (p, { pinned }) => (pinned ? '' : num(p.reviews)) },
  ];
  return (
    <Section title="열 그룹 · 요약 행 · 고정 열" intro="이어진 열은 그룹 머리글을 함께 씁니다. 머리글 둘째 줄에는 단위나 기간을, 점선 밑줄이 있는 머리글에는 마우스를 올리거나 포커스하면 설명을 띄웁니다. 합계·평균 같은 요약 행은 정렬과 상관없이 위에 고정되고, 가로로 스크롤해도 첫 열이 남습니다.">
      <Demo col data-demo="table-groups">
        <DataTable<Product> aria-label="상품 판매와 재고" rows={rows} rowKey={(p) => p.id} columns={cols} pinnedRows={pinned} maxHeight={420} labels={TABLE_LABELS} />
      </Demo>
    </Section>
  );
}

function Cells() {
  const rows = PRODUCTS.slice(0, 14);   /* includes one paused product: its "days left" is empty */
  const cols: Column<Product>[] = [
    name,
    { key: 'sold', header: '판매량', align: 'end', width: 150, sortable: true, firstSort: 'desc',
      render: (p) => <span className="sg-cell-meter"><BarMeter value={p.sold} max={BEST_SOLD} width={56} tone={p.sold === BEST_SOLD ? 'accent' : 'neutral'} /><span className={p.sold === BEST_SOLD ? 'sg-cell-strong' : undefined}>{num(p.sold)}</span></span> },
    { key: 'daysLeft', header: '소진 예상', align: 'end', width: 110, sortable: true,
      render: (p) => (p.daysLeft === null ? null : <span className={p.daysLeft <= 7 ? 'sg-cell-danger' : p.daysLeft <= 14 ? 'sg-cell-warning' : undefined}>{p.daysLeft}일</span>) },
    { key: 'status', header: '상태', width: 110, render: (p) => (p.paused ? <Tag>판매 중지</Tag> : p.daysLeft !== null && p.daysLeft <= 7 ? <Tag tone="danger">재고 부족</Tag> : <Tag tone="success">판매 중</Tag>) },
  ];
  return (
    <Section title="셀 안의 표시" intro="숫자 옆 짧은 막대로 크기를 비교하고, 셀 클래스로 의미를 더합니다. sg-cell-strong(가장 좋은 값), sg-cell-warning·sg-cell-danger(살펴볼 값), sg-cell-muted(덜 중요한 값). 색만으로 전하지 않도록 굵기나 태그 글자가 함께 바뀝니다. 판매를 멈춘 행은 흐리게(rowState) 둡니다.">
      <Demo col data-demo="table-cells">
        <DataTable<Product> aria-label="판매량과 재고 상태" rows={rows} rowKey={(p) => p.id} columns={cols} rowState={(p) => (p.paused ? { muted: true } : undefined)} defaultSort={{ key: 'sold', dir: 'desc' }} labels={TABLE_LABELS} />
        <Text variant="footnote" tone="secondary"><span className="sg-cell-strong">굵은 값</span> 가장 많이 팔림 · <span className="sg-cell-warning">주황</span> 2주 안에 소진 · <span className="sg-cell-danger">빨강</span> 1주 안에 소진</Text>
      </Demo>
    </Section>
  );
}

function States() {
  const [loading, setLoading] = useState(false);
  const [emptyOn, setEmptyOn] = useState(false);
  useEffect(() => { if (!loading) return; const t = setTimeout(() => setLoading(false), 1600); return () => clearTimeout(t); }, [loading]);
  const rows = emptyOn ? [] : PRODUCTS.slice(0, 5);
  return (
    <Section title="불러오는 중 · 빈 상태" intro="처음 불러올 때는 행 모양의 자리 표시를, 이미 있는 행을 다시 불러올 때는 행을 흐리게 하고 위에 진행선을 지나가게 합니다. 행이 없으면 무엇이 비었고 무엇을 할 수 있는지 알려 줍니다.">
      <Demo col data-demo="table-states">
        <Stack direction="row" gap={3} wrap align="center">
          <Button size="sm" variant="neutral" onClick={() => setLoading(true)} disabled={loading}>다시 불러오기</Button>
          <Switch aria-label="빈 결과 보기" checked={emptyOn} onChange={setEmptyOn} /><Text variant="subhead" as="span">결과 없음</Text>
        </Stack>
        <DataTable<Product> aria-label="불러오는 상품 목록" rows={rows} rowKey={(p) => p.id} columns={[name, category, price, stock]} loading={loading} labels={TABLE_LABELS}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title="조건에 맞는 상품이 없어요" description="필터를 줄이거나 다른 이름으로 찾아보세요." actions={<Button size="sm" variant="neutral" onClick={() => setEmptyOn(false)}>필터 지우기</Button>} />} />
      </Demo>
    </Section>
  );
}

const PAGE = 20;
function Server() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'time', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Order[]>([]);
  /* a pretend server: sorts and pages after a short delay */
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const s = [...ORDERS];
      if (sort) {
        const k = (sort.key === 'time' ? 'at' : sort.key) as keyof Order;
        s.sort((a, b) => { const x = a[k], y = b[k]; const c = typeof x === 'number' ? (x as number) - (y as number) : String(x).localeCompare(String(y), 'ko'); return sort.dir === 'asc' ? c : -c; });
      }
      setRows(s.slice((page - 1) * PAGE, page * PAGE)); setLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, [page, sort]);
  return (
    <Section title="서버가 정렬하고 나누는 표" intro="manualSort를 켜면 표는 정렬이 바뀌었다고 알리기만 하고, 받은 행을 그대로 보여 줍니다. 페이지 이동은 Pagination이 맡고, 전체 행 수(rowCount)는 스크린 리더에 알려 줍니다.">
      <Demo col data-demo="table-server">
        <DataTable<Order> aria-label="주문 (서버)" rows={rows} columns={orderColumns} rowKey={(r) => r.id} manualSort sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
          loading={loading} rowCount={ORDERS.length} density="compact" labels={TABLE_LABELS} />
        <div className="table-pager">
          <Text variant="footnote" tone="secondary" as="span">{num(ORDERS.length)}건 중 {num((page - 1) * PAGE + 1)}–{num(Math.min(page * PAGE, ORDERS.length))}</Text>
          <Pagination page={page} pageCount={Math.ceil(ORDERS.length / PAGE)} onChange={setPage} aria-label="주문 페이지" labels={{ previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` }} />
        </div>
      </Demo>
    </Section>
  );
}

const orderColumns: Column<Order>[] = [
  { key: 'id', header: '주문 번호', width: 104, sortable: true },
  { key: 'time', header: '주문 시각', width: 112, sortable: true, firstSort: 'desc', value: (o) => o.at },
  { key: 'customer', header: '주문자', width: 88, sortable: true },
  { key: 'product', header: '상품', width: 180, sortable: true, render: (o) => (o.qty > 1 ? `${o.product} ×${o.qty}` : o.product) },
  { key: 'amount', header: '금액', align: 'end', width: 108, sortable: true, firstSort: 'desc', render: (o) => won(o.amount) },
  { key: 'channel', header: '경로', width: 72, sortable: true },
  { key: 'status', header: '상태', width: 104, sortable: true, value: (o) => STATUS[o.status].label, render: (o) => <Tag tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Tag> },
];

function Virtual() {
  const [sel, setSel] = useState<string[]>([]);
  const cols = useMemo(() => orderColumns.map((c, i) => (i === 0 ? { ...c, sticky: true } : c)), []);
  return (
    <Section title="수천 행" intro="높이(maxHeight) 안에서 80행이 넘으면 보이는 행만 그립니다. 5,000행을 빠르게 굴려도 프레임이 끊기지 않고, Ctrl+End처럼 키보드로 먼 행까지 가면 그 행을 그린 뒤 포커스를 옮깁니다.">
      <Demo col data-demo="table-virtual">
        <DataTable<Order> aria-label="주문 5,000건" rows={ORDERS} columns={cols} rowKey={(r) => r.id} defaultSort={{ key: 'time', dir: 'desc' }} density="compact" maxHeight={420}
          selectable selected={sel} onSelectedChange={setSel} labels={{ ...TABLE_LABELS, selectRow: (o) => `주문 ${o.id} 선택` }} />
        <Text variant="footnote" tone="secondary">{sel.length ? `${num(sel.length)}건 선택됨` : `${num(ORDERS.length)}건`} · 분류 {CATEGORIES.length}개</Text>
      </Demo>
    </Section>
  );
}
