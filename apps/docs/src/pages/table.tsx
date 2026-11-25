/* Data table: one table component from a plain sortable list up to thousands of rows or server paging. */
import { useEffect, useMemo, useState } from 'react';
import {
  BarMeter, Button, Chip, ColumnChooser, DataTable, FilterBar, EmptyState, Pagination, SearchField, SegmentedControl, Select, Stack, Switch, Tag, Text, type Column, type SortState,
} from '@satin-glass/react';
import { Columns3, PackageSearch } from 'lucide-react';
import { Demo, Page, Section, Usage } from '../shared';
import { L, useT } from '../i18n';
import { useData, type Order, type Product } from '../data';
import TableBasic from '../examples/table-basic';
import tableBasicSrc from '../examples/table-basic?raw';
import TableColumns from '../examples/table-columns';
import tableColumnsSrc from '../examples/table-columns?raw';
import FilterBarExample from '../examples/filter-bar';
import filterBarSrc from '../examples/filter-bar?raw';

/* text the table writes itself, in the reader's language */
function useTableLabels() {
  const t = useT();
  return {
    selectAll: t({ en: 'Select all rows', ko: '모든 행 선택' }), sortedAsc: t({ en: 'Sorted ascending', ko: '오름차순 정렬' }),
    sortedDesc: t({ en: 'Sorted descending', ko: '내림차순 정렬' }), empty: t({ en: 'No data', ko: '데이터 없음' }),
  };
}

/* columns shared by the product demos */
function useProductColumns() {
  const t = useT(), d = useData();
  const name: Column<Product> = { key: 'name', header: t({ en: 'Product', ko: '상품' }), width: 200, sortable: true };
  const category: Column<Product> = { key: 'category', header: t({ en: 'Category', ko: '분류' }), width: t({ en: 112, ko: 96 }), sortable: true, value: (p) => d.categoryLabel(p.category), render: (p) => d.categoryLabel(p.category) };
  const price: Column<Product> = { key: 'price', header: t({ en: 'Price', ko: '가격' }), align: 'end', width: 104, sortable: true, render: (p) => d.won(p.price) };
  const stock: Column<Product> = { key: 'stock', header: t({ en: 'Stock', ko: '재고' }), align: 'end', width: 84, sortable: true, render: (p) => d.num(p.stock) };
  const sold: Column<Product> = { key: 'sold', header: t({ en: 'Units sold', ko: '판매량' }), align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => d.num(p.sold) };
  return { name, category, price, stock, sold };
}

export function TablePage() {
  const t = useT();
  return (
    <Page title={t({ en: 'Tables', ko: '표' })} api={['DataTable', 'Column', 'ColumnChooser', 'FilterBar']} intro={<L
      en="A table for comparing numbers and choosing rows. The same component makes a short list, a comparison with column groups and summary rows, thousands of rows, or a table sorted and paged on a server. Numbers align to the end in tabular figures."
      ko="숫자를 비교하고 행을 선택하는 표입니다. 몇 줄짜리 목록부터 열 그룹과 요약 행이 있는 비교 표, 수천 행, 서버가 정렬과 페이지네이션을 맡는 표까지 같은 컴포넌트로 만듭니다. 숫자는 끝 쪽으로 정렬하고 고정폭 숫자(tabular-nums)로 씁니다." />}>
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
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const [density, setDensity] = useState<'regular' | 'compact'>('regular');
  return (
    <Section title={t({ en: 'Sorting', ko: '정렬' })} intro={<L
      en="Pressing a header sorts ascending, then descending, then not at all. A column read largest first (units sold, the latest time) can start descending (firstSort); empty values always sort last, in either direction."
      ko="헤더를 누르면 오름차순 → 내림차순 → 정렬 해제 순서로 바뀝니다. 판매량이나 최근 시각처럼 큰 값부터 보는 열은 내림차순부터 시작하게 할 수 있고(firstSort), 빈 값은 방향과 상관없이 늘 맨 뒤에 둡니다." />}>
      <Demo col data-demo="table-basic">
        <SegmentedControl size="sm" aria-label={t({ en: 'Row spacing', ko: '행 간격' })} value={density} onChange={setDensity} options={[{ value: 'regular', label: t({ en: 'Regular', ko: '보통' }) }, { value: 'compact', label: t({ en: 'Compact', ko: '촘촘하게' }) }]} style={{ alignSelf: 'flex-start' }} />
        <DataTable<Product> aria-label={t({ en: 'Products', ko: '상품 목록' })} rows={d.PRODUCTS.slice(0, 8)} rowKey={(p) => p.id} columns={[c.name, c.category, c.price, c.stock, c.sold]} density={density} labels={labels} />
      </Demo>
      <Usage example={TableBasic} code={tableBasicSrc} />
    </Section>
  );
}

function Selection() {
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const [sel, setSel] = useState<string[]>(['p2']);
  return (
    <Section title={t({ en: 'Selecting rows', ko: '행 선택' })} intro={<L
      en="The header checkbox is indeterminate while some rows are selected. Shift-click selects a range. From the keyboard, Space selects a row and Ctrl/Cmd+A selects them all."
      ko="헤더 체크박스는 일부만 선택했을 때 일부 선택 상태(indeterminate)가 됩니다. Shift를 누른 채 클릭하면 범위를 선택합니다. 키보드로는 Space로 행을 선택하고, Ctrl/Cmd+A로 모두 선택합니다." />}>
      <Demo col data-demo="table-select">
        <div className="table-bar" data-on={sel.length > 0 || undefined}>
          <Text variant="subhead" as="span">{sel.length ? t({ en: `${sel.length} selected`, ko: `${sel.length}개 선택됨` }) : t({ en: 'Select some products', ko: '상품을 선택해 보세요' })}</Text>
          <span className="table-bar__actions">
            <Button size="sm" variant="tinted" disabled={!sel.length}>{t({ en: 'Stop selling', ko: '판매 중지' })}</Button>
            <Button size="sm" variant="plain" disabled={!sel.length} onClick={() => setSel([])}>{t({ en: 'Clear selection', ko: '선택 해제' })}</Button>
          </span>
        </div>
        <DataTable<Product> aria-label={t({ en: 'Products to select from', ko: '선택할 수 있는 상품 목록' })} rows={d.PRODUCTS.slice(0, 8)} rowKey={(p) => p.id} columns={[c.name, c.category, c.price, c.stock]}
          selectable selected={sel} onSelectedChange={setSel} labels={{ ...labels, selectRow: (p) => t({ en: `Select ${p.name}`, ko: `${p.name} 선택` }) }} />
      </Demo>
    </Section>
  );
}

function Filters() {
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [inStock, setInStock] = useState(false);
  const [cheap, setCheap] = useState(false);
  const count = (q ? 1 : 0) + (cat !== 'all' ? 1 : 0) + (inStock ? 1 : 0) + (cheap ? 1 : 0);
  const query = q.toLocaleLowerCase(d.locale);
  const rows = d.PRODUCTS.filter((p) => (!q || p.name.toLocaleLowerCase(d.locale).includes(query)) && (cat === 'all' || p.category === cat) && (!inStock || p.stock > 0) && (!cheap || p.price < 30000));
  const clear = () => { setQ(''); setCat('all'); setInStock(false); setCheap(false); };
  return (
    <Section title={t({ en: 'Filter bar (FilterBar)', ko: '필터 바 (FilterBar)' })} intro={<L
      en='Search, filters, the applied count and clear sit in one row above a table or a list. Library controls inside it (a SearchField, filter selects — Select variant="filter" — and toggle chips) form a named group and take one height (32 px). The app keeps the filter state and counts what applies. Each control keeps its own keys, and Tab moves in reading order. A narrow bar wraps. Clear resets every filter in the count, then moves focus to the first control. The bar itself has no animation.'
      ko='표나 목록 위에 검색, 필터, 적용 개수, 초기화를 한 줄로 놓습니다. 검색란(SearchField), 필터 셀렉트(Select variant="filter"), 토글 칩(Chip) 같은 라이브러리 컨트롤을 넣으면 이름 붙은 그룹으로 묶이고, 안의 컨트롤은 모두 같은 높이(32px)로 맞춰집니다. 필터 상태와 적용 개수는 앱이 계산해 넘깁니다. 각 컨트롤은 자기 키보드 조작을 그대로 쓰고, Tab은 읽는 순서대로 이동합니다. 폭이 좁으면 다음 줄로 넘어갑니다. 초기화를 누르면 개수에 들어간 조건을 모두 되돌린 뒤 첫 컨트롤로 포커스를 옮깁니다. 바 자체에는 애니메이션이 없습니다.' />}>
      <Demo col data-demo="filterbar">
        <FilterBar aria-label={t({ en: 'Product filters', ko: '상품 필터' })} count={count} onClear={clear}
          labels={{ clear: t({ en: 'Clear', ko: '초기화' }), applied: (n) => t({ en: n === 1 ? '1 filter' : `${n} filters`, ko: `필터 ${n}개` }) }}>
          <SearchField aria-label={t({ en: 'Find a product', ko: '상품 찾기' })} placeholder={t({ en: 'Product name', ko: '상품 이름' })} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 200 }} />
          <Select variant="filter" label={t({ en: 'Category', ko: '분류' })} value={cat} onChange={setCat} options={[{ value: 'all', label: t({ en: 'All', ko: '전체' }) }, ...d.CATEGORIES.map((x) => ({ value: x.key, label: x.label }))]} />
          <Chip selected={inStock} onSelectedChange={setInStock}>{t({ en: 'In stock', ko: '재고 있음' })}</Chip>
          <Chip selected={cheap} onSelectedChange={setCheap}>{t({ en: 'Under ₩30,000', ko: '3만 원 미만' })}</Chip>
        </FilterBar>
        <DataTable<Product> aria-label={t({ en: 'Filtered products', ko: '필터링된 상품' })} rows={rows.slice(0, 6)} rowKey={(r) => r.id} columns={[c.name, c.category, c.price, c.stock]} density="compact" labels={labels}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title={t({ en: 'No products match', ko: '조건에 맞는 상품이 없어요' })} actions={<Button size="sm" variant="neutral" onClick={clear}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />} />
        <Text variant="footnote" tone="secondary">{rows.length > 6 ? t({ en: `Showing 6 of ${d.num(rows.length)}.`, ko: `${d.num(rows.length)}개 중 6개만 보여 줘요.` }) : t({ en: `${d.num(rows.length)} products`, ko: `${d.num(rows.length)}개` })}</Text>
      </Demo>
      <Usage example={FilterBarExample} code={filterBarSrc} />
    </Section>
  );
}

function Groups() {
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const [hidden, setHidden] = useState<string[]>(['returnRate', 'reviews']);
  const [lines, setLines] = useState<'none' | 'groups' | 'all'>('groups');
  const rows = d.PRODUCTS.filter((p) => !p.paused);
  const total = (k: 'sold' | 'revenue' | 'stock') => rows.reduce((a, p) => a + p[k], 0);
  const avg = (k: 'price' | 'rating' | 'returnRate') => rows.reduce((a, p) => a + p[k], 0) / rows.length;
  const pinned = [
    { id: 'sum', name: t({ en: 'Total', ko: '합계' }), category: 'wear', price: NaN, stock: total('stock'), sold: total('sold'), revenue: total('revenue'), rating: NaN, reviews: 0, returnRate: NaN, daysLeft: null, trend: [], paused: false },
    { id: 'avg', name: t({ en: 'Average', ko: '평균' }), category: 'wear', price: Math.round(avg('price')), stock: Math.round(total('stock') / rows.length), sold: Math.round(total('sold') / rows.length), revenue: Math.round(total('revenue') / rows.length), rating: +avg('rating').toFixed(1), reviews: 0, returnRate: +avg('returnRate').toFixed(1), daysLeft: null, trend: [], paused: false },
  ] as Product[];
  const n = (v: number, f: (v: number) => string) => (Number.isNaN(v) ? '' : f(v));
  const g = { sales: t({ en: 'Sales', ko: '판매' }), stock: t({ en: 'Stock', ko: '재고' }), reviews: t({ en: 'Reviews', ko: '후기' }) };
  const last30 = t({ en: 'last 30 days', ko: '최근 30일' });
  const cols: Column<Product>[] = [
    { ...c.name, sticky: true, render: (p, { pinned }) => (pinned ? <b>{p.name}</b> : p.name) },
    { ...c.category, render: (p, { pinned }) => (pinned ? '' : d.categoryLabel(p.category)) },
    { ...c.price, render: (p) => n(p.price, d.won) },
    { key: 'sold', header: t({ en: 'Units', ko: '판매량' }), subheader: last30, group: g.sales, align: 'end', width: 100, sortable: true, firstSort: 'desc', render: (p) => d.num(p.sold) },
    { key: 'revenue', header: t({ en: 'Revenue', ko: '매출' }), subheader: last30, group: g.sales, align: 'end', width: 108, sortable: true, firstSort: 'desc', render: (p) => d.wonShort(p.revenue) },
    { key: 'returnRate', header: t({ en: 'Returns', ko: '반품률' }), subheader: '%', group: g.sales, align: 'end', width: 92, sortable: true, description: t({ en: 'The share of orders that came back as returns.', ko: '받은 주문 중 반품으로 돌아온 비율이에요.' }), render: (p) => n(p.returnRate, (v) => v.toFixed(1)) },
    { key: 'stock', header: t({ en: 'In stock', ko: '재고' }), subheader: t({ en: 'units', ko: '개' }), group: g.stock, align: 'end', width: 84, sortable: true, render: (p) => d.num(p.stock) },
    { key: 'daysLeft', header: t({ en: 'Runs out in', ko: '소진 예상' }), subheader: t({ en: 'days', ko: '일' }), group: g.stock, align: 'end', width: 100, sortable: true, description: t({ en: 'Days until the stock runs out, selling at the last 30 days\' pace.', ko: '최근 30일 속도로 팔릴 때 재고가 바닥나기까지 남은 날이에요.' }), render: (p) => (p.daysLeft === null ? '' : d.num(p.daysLeft)) },
    { key: 'rating', header: t({ en: 'Rating', ko: '평점' }), subheader: t({ en: 'out of 5', ko: '5점 만점' }), group: g.reviews, align: 'end', width: 92, sortable: true, firstSort: 'desc', render: (p) => n(p.rating, (v) => v.toFixed(1)) },
    { key: 'reviews', header: t({ en: 'Reviews', ko: '후기 수' }), group: g.reviews, align: 'end', width: 84, sortable: true, firstSort: 'desc', render: (p, { pinned }) => (pinned ? '' : d.num(p.reviews)) },
  ];
  return (
    <Section title={t({ en: 'Column groups · summary rows · frozen columns · choosing columns', ko: '열 그룹 · 요약 행 · 고정 열 · 열 선택' })} intro={<L
      en="Adjacent columns share a group header. The second header line holds units or periods, and a header with a dotted underline explains itself on hover or focus. Summary rows (a total, an average) stay on top whatever the sort, and the first column stays when the table scrolls sideways. With many columns, a ColumnChooser picks which ones show: checkboxes grouped like the table, where a group's own box shows or hides the whole group. Frozen columns say which row is which, so they cannot be hidden, nor can the last visible column. Hiding the sorted column ends the sort. When many columns are hard to follow across, columnLines draws vertical lines: 'groups' where the group changes, 'all' between every column; hiding a column moves the lines with it."
      ko="이어진 열은 그룹 헤더를 함께 씁니다. 헤더 둘째 줄에는 단위나 기간을 적고, 점선 밑줄이 있는 헤더에 마우스를 올리거나 포커스하면 설명을 띄웁니다. 합계·평균 같은 요약 행은 정렬과 상관없이 위에 고정되고, 가로로 스크롤해도 첫 열이 남습니다. 열이 많으면 열 선택(ColumnChooser)으로 표시할 열을 정합니다. 체크박스는 표의 그룹대로 묶이고, 그룹 체크박스는 그룹 전체를 켜고 끕니다. 고정 열은 행을 구분해 주므로 숨길 수 없고, 마지막 남은 열도 숨길 수 없습니다. 정렬 중인 열을 숨기면 정렬이 풀립니다. 열이 많아 눈으로 따라가기 어려우면 columnLines로 세로줄을 긋습니다. 'groups'는 그룹이 바뀌는 곳에만, 'all'은 모든 열 사이에 긋고, 열을 숨기면 줄도 따라 옮겨집니다." />}>
      <Demo col data-demo="table-groups">
        <Stack direction="row" gap={2} align="center" wrap>
          <ColumnChooser columns={cols} hidden={hidden} onHiddenChange={setHidden} label={t({ en: 'Columns', ko: '열' })} icon={<Columns3 />} labels={{ panel: t({ en: 'Columns to show', ko: '표시할 열' }), showAll: t({ en: 'Show all', ko: '모두 보기' }) }} />
          <SegmentedControl size="sm" aria-label={t({ en: 'Column lines', ko: '세로줄' })} value={lines} onChange={setLines} options={[{ value: 'none', label: t({ en: 'No lines', ko: '세로줄 없음' }) }, { value: 'groups', label: t({ en: 'Between groups', ko: '그룹 사이' }) }, { value: 'all', label: t({ en: 'Every column', ko: '모든 열' }) }]} />
        </Stack>
        <DataTable<Product> aria-label={t({ en: 'Product sales and stock', ko: '상품 판매와 재고' })} rows={rows} rowKey={(p) => p.id} columns={cols} hiddenColumns={hidden} columnLines={lines} pinnedRows={pinned} maxHeight={420} labels={labels} />
      </Demo>
      <Usage example={TableColumns} code={tableColumnsSrc} />
    </Section>
  );
}

function Cells() {
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const rows = d.PRODUCTS.slice(0, 14);   /* includes one paused product: its "days left" is empty */
  const best = Math.max(...d.PRODUCTS.map((p) => p.sold));
  const cols: Column<Product>[] = [
    c.name,
    { key: 'sold', header: t({ en: 'Units sold', ko: '판매량' }), align: 'end', width: 150, sortable: true, firstSort: 'desc',
      render: (p) => <span className="sg-cell-meter"><BarMeter value={p.sold} max={best} width={56} tone={p.sold === best ? 'accent' : 'neutral'} /><span className={p.sold === best ? 'sg-cell-strong' : undefined}>{d.num(p.sold)}</span></span> },
    { key: 'daysLeft', header: t({ en: 'Runs out in', ko: '소진 예상' }), align: 'end', width: 110, sortable: true,
      render: (p) => (p.daysLeft === null ? null : <span className={p.daysLeft <= 7 ? 'sg-cell-danger' : p.daysLeft <= 14 ? 'sg-cell-warning' : undefined}>{t({ en: `${p.daysLeft} d`, ko: `${p.daysLeft}일` })}</span>) },
    { key: 'status', header: t({ en: 'Status', ko: '상태' }), width: 110, render: (p) => (p.paused ? <Tag>{t({ en: 'Paused', ko: '판매 중지' })}</Tag> : p.daysLeft !== null && p.daysLeft <= 7 ? <Tag tone="danger">{t({ en: 'Low stock', ko: '재고 부족' })}</Tag> : <Tag tone="success">{t({ en: 'On sale', ko: '판매 중' })}</Tag>) },
  ];
  return (
    <Section title={t({ en: 'Inside cells', ko: '셀 안의 표시' })} intro={<L
      en="A short bar beside a number compares sizes, and cell classes add meaning: sg-cell-strong (the best value), sg-cell-warning and sg-cell-danger (values to look at), sg-cell-muted (values that matter less). Weight or a tag's words change with the colour, so the meaning does not rest on colour alone. A paused product's row is dimmed (rowState)."
      ko="숫자 옆 짧은 막대로 크기를 비교하고, 셀 클래스로 의미를 더합니다. sg-cell-strong(가장 좋은 값), sg-cell-warning·sg-cell-danger(살펴볼 값), sg-cell-muted(덜 중요한 값)를 씁니다. 색만으로 의미를 전하지 않도록 굵기나 태그 글자가 함께 바뀝니다. 판매 중지한 상품의 행은 흐리게 표시합니다(rowState)." />}>
      <Demo col data-demo="table-cells">
        <DataTable<Product> aria-label={t({ en: 'Units sold and stock status', ko: '판매량과 재고 상태' })} rows={rows} rowKey={(p) => p.id} columns={cols} rowState={(p) => (p.paused ? { muted: true } : undefined)} defaultSort={{ key: 'sold', dir: 'desc' }} labels={labels} />
        <Text variant="footnote" tone="secondary"><L
          en={<><span className="sg-cell-strong">Bold</span> sells most · <span className="sg-cell-warning">Orange</span> runs out within 2 weeks · <span className="sg-cell-danger">Red</span> runs out within a week</>}
          ko={<><span className="sg-cell-strong">굵은 값</span> 가장 많이 팔림 · <span className="sg-cell-warning">주황</span> 2주 안에 소진 · <span className="sg-cell-danger">빨강</span> 1주 안에 소진</>} /></Text>
      </Demo>
    </Section>
  );
}

function States() {
  const t = useT(), d = useData(), labels = useTableLabels(), c = useProductColumns();
  const [loading, setLoading] = useState(false);
  const [emptyOn, setEmptyOn] = useState(false);
  useEffect(() => { if (!loading) return; const id = setTimeout(() => setLoading(false), 1600); return () => clearTimeout(id); }, [loading]);
  const rows = emptyOn ? [] : d.PRODUCTS.slice(0, 5);
  return (
    <Section title={t({ en: 'Loading · empty', ko: '불러오는 중 · 빈 상태' })} intro={<L
      en="The first load shows row-shaped placeholders (skeletons); reloading rows already there dims them under a progress line. With no rows, the table says what is empty and what can be done."
      ko="처음 불러올 때는 행 모양의 스켈레톤을 보여 주고, 이미 있는 행을 다시 불러올 때는 행을 흐리게 한 뒤 위쪽에 진행 표시줄을 보여 줍니다. 행이 없으면 무엇이 비었고 무엇을 할 수 있는지 알려 줍니다." />}>
      <Demo col data-demo="table-states">
        <Stack direction="row" gap={3} wrap align="center">
          <Button size="sm" variant="neutral" onClick={() => setLoading(true)} disabled={loading}>{t({ en: 'Reload', ko: '다시 불러오기' })}</Button>
          <Switch aria-label={t({ en: 'Show no results', ko: '빈 결과 보기' })} checked={emptyOn} onChange={setEmptyOn} /><Text variant="subhead" as="span">{t({ en: 'No results', ko: '결과 없음' })}</Text>
        </Stack>
        <DataTable<Product> aria-label={t({ en: 'Products loading', ko: '불러오는 상품 목록' })} rows={rows} rowKey={(p) => p.id} columns={[c.name, c.category, c.price, c.stock]} loading={loading} labels={labels}
          empty={<EmptyState size="sm" icon={<PackageSearch />} title={t({ en: 'No products match', ko: '조건에 맞는 상품이 없어요' })} description={t({ en: 'Use fewer filters or try another name.', ko: '필터를 줄이거나 다른 이름으로 찾아보세요.' })} actions={<Button size="sm" variant="neutral" onClick={() => setEmptyOn(false)}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />} />
      </Demo>
    </Section>
  );
}

function useOrderColumns(): Column<Order>[] {
  const t = useT(), d = useData();
  return useMemo(() => [
    { key: 'id', header: t({ en: 'Order', ko: '주문 번호' }), width: 104, sortable: true },
    { key: 'time', header: t({ en: 'Time', ko: '주문 시각' }), width: 112, sortable: true, firstSort: 'desc', value: (o) => o.at },
    { key: 'customer', header: t({ en: 'Customer', ko: '주문자' }), width: 88, sortable: true },
    { key: 'product', header: t({ en: 'Product', ko: '상품' }), width: 180, sortable: true, render: (o) => (o.qty > 1 ? `${o.product} ×${o.qty}` : o.product) },
    { key: 'amount', header: t({ en: 'Amount', ko: '금액' }), align: 'end', width: 108, sortable: true, firstSort: 'desc', render: (o) => d.won(o.amount) },
    { key: 'channel', header: t({ en: 'Channel', ko: '채널' }), width: 72, sortable: true },
    { key: 'status', header: t({ en: 'Status', ko: '상태' }), width: 104, sortable: true, value: (o) => d.STATUS[o.status].label, render: (o) => <Tag tone={d.STATUS[o.status].tone}>{d.STATUS[o.status].label}</Tag> },
  ] as Column<Order>[], [d]);
}

const PAGE = 20;
function Server() {
  const t = useT(), d = useData(), labels = useTableLabels(), orderColumns = useOrderColumns();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'time', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Order[]>([]);
  /* a pretend server: sorts (text in the reader's language) and pages after a short delay */
  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => {
      const s = [...d.ORDERS];
      if (sort) {
        const k = (sort.key === 'time' ? 'at' : sort.key) as keyof Order;
        s.sort((a, b) => { const x = a[k], y = b[k]; const c = typeof x === 'number' ? (x as number) - (y as number) : d.collator.compare(String(x), String(y)); return sort.dir === 'asc' ? c : -c; });
      }
      setRows(s.slice((page - 1) * PAGE, page * PAGE)); setLoading(false);
    }, 450);
    return () => clearTimeout(id);
  }, [page, sort, d]);
  const from = d.num((page - 1) * PAGE + 1), to = d.num(Math.min(page * PAGE, d.ORDERS.length)), all = d.num(d.ORDERS.length);
  return (
    <Section title={t({ en: 'Sorted and paged by a server', ko: '서버 정렬과 페이지네이션' })} intro={<L
      en="With manualSort the table only reports that the sort changed and shows the rows it is given. Pagination moves between pages, and the total row count (rowCount) is exposed to screen readers."
      ko="manualSort를 켜면 표는 정렬이 바뀌었다고 알리기만 하고, 받은 행을 그대로 보여 줍니다. 페이지 이동은 Pagination이 맡고, 전체 행 수(rowCount)는 스크린 리더에 알려 줍니다." />}>
      <Demo col data-demo="table-server">
        <DataTable<Order> aria-label={t({ en: 'Orders (server)', ko: '주문 (서버)' })} rows={rows} columns={orderColumns} rowKey={(r) => r.id} manualSort sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
          loading={loading} rowCount={d.ORDERS.length} density="compact" labels={labels} />
        <div className="table-pager">
          <Text variant="footnote" tone="secondary" as="span">{t({ en: `${from}–${to} of ${all}`, ko: `${all}건 중 ${from}–${to}` })}</Text>
          <Pagination page={page} pageCount={Math.ceil(d.ORDERS.length / PAGE)} onChange={setPage} aria-label={t({ en: 'Order pages', ko: '주문 페이지' })}
            labels={{ previous: t({ en: 'Previous page', ko: '이전 페이지' }), next: t({ en: 'Next page', ko: '다음 페이지' }), page: (n) => t({ en: `Page ${n}`, ko: `${n} 페이지` }) }} />
        </div>
      </Demo>
    </Section>
  );
}

function Virtual() {
  const t = useT(), d = useData(), labels = useTableLabels(), orderColumns = useOrderColumns();
  const [sel, setSel] = useState<string[]>([]);
  const cols = useMemo(() => orderColumns.map((c, i) => (i === 0 ? { ...c, sticky: true } : c)), [orderColumns]);
  return (
    <Section title={t({ en: 'Thousands of rows', ko: '수천 행' })} intro={<L
      en="A table given a maxHeight draws only the rows in view once it has more than 80. As it scrolls, the visible rows update once a frame, in time for the frame that shows them. A key that jumps far (such as Ctrl+End) draws that row first, then moves focus to it."
      ko="maxHeight로 높이를 정한 표는 80행이 넘으면 화면에 보이는 행만 그립니다. 스크롤할 때는 프레임마다 한 번, 화면이 스크롤되는 바로 그 프레임에 새로 들어오는 행을 그립니다. Ctrl+End처럼 키보드로 먼 행까지 가면 그 행을 그린 뒤 포커스를 옮깁니다." />}>
      <Demo col data-demo="table-virtual">
        <DataTable<Order> aria-label={t({ en: '5,000 orders', ko: '주문 5,000건' })} rows={d.ORDERS} columns={cols} rowKey={(r) => r.id} defaultSort={{ key: 'time', dir: 'desc' }} density="compact" maxHeight={420}
          selectable selected={sel} onSelectedChange={setSel} labels={{ ...labels, selectRow: (o) => t({ en: `Select order ${o.id}`, ko: `주문 ${o.id} 선택` }) }} />
        <Text variant="footnote" tone="secondary">{sel.length ? t({ en: `${d.num(sel.length)} selected`, ko: `${d.num(sel.length)}건 선택됨` }) : t({ en: `${d.num(d.ORDERS.length)} orders`, ko: `${d.num(d.ORDERS.length)}건` })}</Text>
      </Demo>
    </Section>
  );
}
