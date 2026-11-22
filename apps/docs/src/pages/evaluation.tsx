/* A model evaluation example: compare made-up language models, pick a few, and look at the evidence. The flow is
   filter → pick → compare → inspect, on the patterns public leaderboards share (a filterable score matrix, a
   quality-against-price scatter, a shortlist side by side, model details) and on the 0.6 parts: ColumnChooser,
   Combobox multiple, FilterBar, pill Tabs and ScatterChart.
   Encodings are the library's: accent only for selection and actions (leaders are bold, not coloured), a vendor is
   the same colour in every view (the scatter's), settings are words (reasoning effort, where a model runs), and
   uncertainty is said where it applies (n= beside a score on a small sample) instead of fading whole rows.
   All names and numbers are made up. */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Accordion, BarMeter, Button, Card, CardBody, CardHeader, Chip, ColumnChooser, Combobox, DataTable, Drawer, EmptyState,
  FilterBar, IntervalPlot, ScatterChart, SearchField, SegmentedControl, Tabs, Text,
  type Column,
} from '@satin-glass/react';
import { Columns3, Scale, SearchX } from 'lucide-react';
import { Page } from '../shared';
import {
  BENCHMARKS, DEPLOY_WORD, EFFORT_WORD, FAMILIES, MODELS, VENDORS, measured, minSample, overall, usd, vendorColor, vendorLabel,
  type Deploy, type Model, type Score,
} from '../eval-data';

const ALL = BENCHMARKS.map((b) => b.key);
const TABLE_LABELS = { selectAll: '보이는 모델 모두 고르기', sortedAsc: '오름차순 정렬', sortedDesc: '내림차순 정렬' };
const LOW_N = 100;
const EXAMPLE = ['kestrel-4', 'tide-pro', 'nimbus-2'];
const PRICE = '100만 토큰당 USD';
const narrow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;

/* one table row: a model, or a summary of the models shown (highest / median / lowest) */
type Row = { id: string; name: string; model?: Model; values: Record<string, number | null> };
const valuesOf = (m: Model): Row['values'] => ({ overall: overall(m, ALL), price: m.price, speed: m.speed, effort: m.effort, ...Object.fromEntries(ALL.map((k) => [k, m.scores[k]?.v ?? null])) });
const median = (xs: number[]) => +(xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2).toFixed(2);
function summaries(rows: Row[]): Row[] {
  const keys = ['overall', ...ALL, 'price', 'speed'];
  const by = (f: (xs: number[]) => number) => Object.fromEntries(keys.map((k) => {
    const xs = rows.map((r) => r.values[k]).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return [k, xs.length ? f(xs) : null];
  }));
  return [
    { id: 'max', name: '최댓값', values: by((xs) => xs[xs.length - 1]) },
    { id: 'median', name: '중앙값', values: by(median) },
    { id: 'min', name: '최솟값', values: by((xs) => xs[0]) },
  ];
}
/* the leader of a column among the models shown: the highest score, the lowest price */
const leaders = (rows: Row[]) => Object.fromEntries(['overall', ...ALL, 'price', 'speed'].map((k) => {
  const xs = rows.map((r) => r.values[k]).filter((v): v is number => v !== null);
  return [k, xs.length ? (k === 'price' ? Math.min(...xs) : Math.max(...xs)) : null];
}));

/* ---------------------------------------------------------------- shared marks */
function Vendor({ k }: { k: string }) {
  return <span className="eval__vendor"><span className="eval__swatch" style={{ background: vendorColor(k) }} aria-hidden="true" />{vendorLabel(k)}</span>;
}
/** a score; on a small sample the sample size is said right beside it */
function ScoreText({ s, lead }: { s: NonNullable<Score>; lead?: boolean }) {
  return (
    <span className="eval__score">
      <span className={lead ? 'sg-cell-strong' : undefined}>{s.v.toFixed(1)}</span>
      {s.n < LOW_N && <small className="eval__n" title={`표본 ${s.n}개라 오차가 커요`}>n={s.n}</small>}
    </span>
  );
}

export function Evaluation() {
  const [section, setSection] = useState<'board' | 'compare' | 'models'>('board');
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<Model | null>(null);
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? (p.includes(id) ? p : [...p, id]) : p.filter((x) => x !== id)));
  /* filters, shared by the three views */
  const [q, setQ] = useState('');
  const [vendors, setVendors] = useState<string[]>([]);
  const [deploy, setDeploy] = useState<'all' | Deploy>('all');
  const [enough, setEnough] = useState(false);
  /* every filter but where a model runs — the segment's counts come from this, so they match what choosing one shows */
  const base = useMemo(() => MODELS.filter((m) => (!q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))
    && (!vendors.length || vendors.includes(m.vendor)) && (!enough || minSample(m) >= LOW_N)), [q, vendors, enough]);
  const models = useMemo(() => base.filter((m) => deploy === 'all' || m.deploy === deploy), [base, deploy]);
  const count = (q.trim() ? 1 : 0) + (vendors.length ? 1 : 0) + (deploy !== 'all' ? 1 : 0) + (enough ? 1 : 0);
  const clear = () => { setQ(''); setVendors([]); setDeploy('all'); setEnough(false); };
  const n = (d: Deploy) => base.filter((m) => m.deploy === d).length;
  const filters = (
    <FilterBar aria-label="모델 필터" count={count} onClear={clear} labels={{ clear: '초기화', applied: (k) => `필터 ${k}개` }}>
      <SearchField aria-label="모델 찾기" placeholder="모델 이름" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 160 }} />
      <Combobox multiple aria-label="공급사" placeholder="공급사" maxChips={1} value={vendors} onChange={setVendors} style={{ width: 200 }}
        options={VENDORS.map((v) => ({ value: v.key, label: v.label, icon: <span className="eval__swatch" style={{ background: vendorColor(v.key) }} aria-hidden="true" /> }))}
        labels={{ remove: (t) => `${t} 빼기`, clear: '모두 지우기', toggle: '공급사 목록', empty: '맞는 공급사가 없어요', count: (k) => `공급사 ${k}곳` }} />
      <SegmentedControl size="sm" aria-label="실행 위치" value={deploy} onChange={setDeploy}
        options={[{ value: 'all', label: `전체 ${base.length}` }, { value: 'hosted', label: `호스팅 ${n('hosted')}` }, { value: 'local', label: `로컬 ${n('local')}` }]} />
      <Chip selected={enough} onSelectedChange={setEnough}>표본 {LOW_N}개 이상만</Chip>
    </FilterBar>
  );
  return (
    <Page title="모델 평가 예제" intro="공개 리더보드에서 흔히 보는 흐름 — 걸러 보고, 몇 개를 골라 비교하고, 근거를 확인하기 — 을 라이브러리 컴포넌트로 만든 화면입니다. 0.6에서 더한 열 고르기(ColumnChooser), 여러 개 고르는 Combobox, 필터 줄(FilterBar), 알약 탭, 산점도(ScatterChart)를 씁니다. 모델·공급사 이름과 점수는 모두 지어낸 것입니다.">
      <div className="dash eval" data-demo="evaluation">
        <header className="dash__head">
          <div className="dash__title">
            <Text variant="title-2" as="h2">언어 모델 평가</Text>
            <Text variant="footnote" tone="secondary" as="span">평가 세트 v3 · 벤치마크 {BENCHMARKS.length}개 · 11월 18일 갱신 · 예제용 가상 데이터</Text>
          </div>
        </header>
        <Tabs aria-label="평가 보기" value={section} onChange={setSection} panelClassName="dash__panel" items={[
          { value: 'board', label: '순위표', content: <Board models={models} filters={filters} onClear={clear} picked={picked} setPicked={setPicked} onCompare={() => setSection('compare')} onOpen={setOpen} /> },
          { value: 'compare', label: '비교', badge: picked.length || undefined, content: <Compare models={models} picked={picked} setPicked={setPicked} onBack={() => setSection('board')} onOpen={setOpen} /> },
          { value: 'models', label: '모델', content: <Cards models={models} filters={filters} onClear={clear} picked={picked} toggle={toggle} onOpen={setOpen} /> },
        ]} />
      </div>
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''} width={440}>
        {open && <Detail m={open} picked={picked.includes(open.id)} onPick={(on) => toggle(open.id, on)} />}
      </Drawer>
    </Page>
  );
}

/* ---------------------------------------------------------------- 순위표 */
function Board({ models, filters, onClear, picked, setPicked, onCompare, onOpen }: { models: Model[]; filters: ReactNode; onClear: () => void; picked: string[]; setPicked: (k: string[]) => void; onCompare: () => void; onOpen: (m: Model) => void }) {
  const [family, setFamily] = useState('all');
  const [summary, setSummary] = useState(false);
  /* a phone starts with the model and its overall score; the chooser brings back the rest */
  const [phone] = useState(narrow);
  const [hidden, setHidden] = useState<string[]>(() => (narrow() ? ['vendor', 'effort', 'deploy', ...ALL, 'price', 'speed'] : ['speed']));
  const rows = useMemo<Row[]>(() => models.map((m) => ({ id: m.id, name: m.name, model: m, values: valuesOf(m) })), [models]);
  const lead = leaders(rows);
  const keys = family === 'all' ? ALL : BENCHMARKS.filter((b) => b.family === family).map((b) => b.key);
  const score = (key: string) => (r: Row, { pinned }: { pinned: boolean }) => {
    const v = r.values[key];
    if (v === null) return null;
    const s = r.model?.scores[key];
    return pinned || !s ? v.toFixed(1) : <ScoreText s={s} lead={v === lead[key]} />;
  };
  const plain = (key: string, f: (v: number) => string) => (r: Row, { pinned }: { pinned: boolean }) => {
    const v = r.values[key];
    return v === null ? null : <span className={!pinned && v === lead[key] ? 'sg-cell-strong' : undefined}>{f(v)}</span>;
  };
  const cols: Column<Row>[] = [
    { key: 'name', header: '모델', width: phone ? 132 : 160, sticky: true, sortable: true,
      render: (r, { pinned }) => (pinned || !r.model ? <b>{r.name}</b> : <button type="button" className="dash__link" onClick={() => onOpen(r.model!)}>{r.name}</button>) },
    { key: 'vendor', header: '공급사', width: 112, sortable: true, value: (r) => (r.model ? vendorLabel(r.model.vendor) : ''), render: (r) => (r.model ? <Vendor k={r.model.vendor} /> : null) },
    { key: 'effort', header: '추론', width: 76, sortable: true, value: (r) => r.values.effort, description: '평가할 때 쓴 추론 설정이에요. 품질이 아니라 실행 조건입니다. 높을수록 느리고 비싸져요.',
      render: (r) => (r.model ? EFFORT_WORD[r.model.effort] : null) },
    { key: 'deploy', header: '실행 위치', width: 96, sortable: true, value: (r) => (r.model ? DEPLOY_WORD[r.model.deploy] : ''), render: (r) => (r.model ? DEPLOY_WORD[r.model.deploy] : null) },
    { key: 'overall', header: '종합', subheader: '측정한 것 평균', align: 'end', width: phone ? 132 : 148, sortable: true, firstSort: 'desc', value: (r) => r.values.overall,
      description: `결과가 있는 벤치마크의 평균이에요. ${BENCHMARKS.length}개 중 일부가 빠진 모델은 몇 개를 쟀는지 함께 보여요. 벤치마크마다 찍기 점수가 달라 단순 평균은 참고용입니다.`,
      render: (r, { pinned }) => {
        const v = r.values.overall;
        if (v === null) return null;
        if (pinned || !r.model) return v.toFixed(1);
        const k = measured(r.model);
        return (
          <span className="sg-cell-meter">
            {k < BENCHMARKS.length && <small className="eval__n" title={`${BENCHMARKS.length}개 중 ${k}개만 쟀어요`}>{k}/{BENCHMARKS.length}</small>}
            <BarMeter value={v} max={100} width={36} />
            <span className={v === lead.overall ? 'sg-cell-strong' : undefined}>{v.toFixed(1)}</span>
          </span>
        );
      } },
    ...BENCHMARKS.map((b): Column<Row> => ({
      key: b.key, header: b.label, subheader: b.chance ? `찍기 ${b.chance}` : ' ', group: FAMILIES.find((f) => f.key === b.family)!.label,
      description: b.note, align: 'end', width: 112, sortable: true, firstSort: 'desc', value: (r) => r.values[b.key], render: score(b.key),
    })),
    { key: 'price', header: '가격', subheader: PRICE, group: '비용 · 속도', align: 'end', width: 116, sortable: true, value: (r) => r.values.price, render: plain('price', usd),
      description: '입력과 출력 토큰을 3:1로 섞은 100만 토큰 가격이에요. 낮을수록 좋아요.' },
    { key: 'speed', header: '속도', subheader: '출력 토큰/초', group: '비용 · 속도', align: 'end', width: 100, sortable: true, firstSort: 'desc', value: (r) => r.values.speed, render: plain('speed', (v) => v.toFixed(0)) },
  ];
  /* the family tab narrows the benchmark columns; the chooser hides any column within it */
  const outOfFamily = ALL.filter((k) => !keys.includes(k));
  const choosable = cols.filter((c) => !outOfFamily.includes(c.key));
  const names = picked.map((id) => MODELS.find((m) => m.id === id)?.name).filter(Boolean);
  return (
    <Card>
      <CardBody className="dash__table-card">
        {filters}
        <div className="eval__tablebar">
          <Tabs variant="pill" aria-label="벤치마크 묶음" value={family} onChange={setFamily}
            items={[{ value: 'all', label: '모든 벤치마크' }, ...FAMILIES.map((f) => ({ value: f.key, label: f.label }))]} />
          <span className="eval__tools">
            <Chip selected={summary} onSelectedChange={setSummary}>요약 행</Chip>
            <ColumnChooser columns={choosable} hidden={hidden} onHiddenChange={setHidden} label="열" icon={<Columns3 />}
              labels={{ panel: '보일 열', showAll: '모두 보기', count: (s, t) => `${s}/${t}` }} />
          </span>
        </div>
        {/* what the table holds, and what was picked from it: the next step sits right here */}
        <div className="table-bar eval__pickbar" data-on={picked.length > 0 || undefined}>
          <Text variant="subhead" as="span" aria-live="polite">
            {picked.length ? `${picked.length}개 골랐어요 · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ' 외' : ''}` : `모델 ${MODELS.length}개 중 ${models.length}개 · 체크해서 비교할 모델을 고르세요`}
          </Text>
          {picked.length > 0 && (
            <span className="table-bar__actions">
              <Button size="sm" variant="tinted" onClick={onCompare}>{picked.length}개 비교하기</Button>
              <Button size="sm" variant="plain" onClick={() => setPicked([])}>선택 해제</Button>
            </span>
          )}
        </div>
        <DataTable<Row> aria-label="모델 순위표" rows={rows} rowKey={(r) => r.id} columns={cols} hiddenColumns={[...outOfFamily, ...hidden]} pinnedRows={summary && rows.length > 1 ? summaries(rows) : []}
          defaultSort={{ key: 'overall', dir: 'desc' }} density="compact" maxHeight={560} selectable selected={picked} onSelectedChange={setPicked}
          labels={{ ...TABLE_LABELS, selectRow: (r) => `${r.name} 비교에 넣기` }}
          empty={<EmptyState size="sm" icon={<SearchX />} title="조건에 맞는 모델이 없어요" actions={<Button size="sm" variant="neutral" onClick={onClear}>필터 초기화</Button>} />} />
        <Text variant="footnote" tone="secondary" as="p">굵은 값은 보이는 모델 중 가장 좋은 값이에요(가격은 가장 낮은 값). n=은 표본이 {LOW_N}개보다 작아 오차가 큰 결과, –는 재지 않은 결과예요.</Text>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- 비교 */
type CRow = { key: string; label: string; kind: 'overall' | 'bench' | 'price' | 'speed' | 'effort' | 'deploy'; chance?: number };
function Compare({ models, picked, setPicked, onBack, onOpen }: { models: Model[]; picked: string[]; setPicked: (k: string[]) => void; onBack: () => void; onOpen: (m: Model) => void }) {
  const chosen = picked.map((id) => MODELS.find((m) => m.id === id)).filter((m): m is Model => !!m);
  if (!chosen.length) {
    return (
      <EmptyState icon={<Scale />} title="비교할 모델을 골라 주세요" description="순위표에서 모델을 체크하면 여기에 나란히 보여요."
        actions={<><Button size="sm" variant="tinted" onClick={onBack}>순위표로</Button><Button size="sm" variant="neutral" onClick={() => setPicked(EXAMPLE)}>예시 3개로 보기</Button></>} />
    );
  }
  /* the filtered models for context, and every pick — also the ones the filters now leave out */
  const outside = chosen.filter((m) => !models.includes(m));
  const cohort = [...models, ...outside];
  const points = cohort.map((m) => ({ name: m.name, price: m.price, overall: overall(m, ALL), vendor: m.vendor }));
  const rows: CRow[] = [
    { key: 'overall', label: '종합', kind: 'overall' },
    ...BENCHMARKS.map((b): CRow => ({ key: b.key, label: b.label, kind: 'bench', chance: b.chance })),
    { key: 'price', label: '가격', kind: 'price' }, { key: 'speed', label: '속도', kind: 'speed' },
    { key: 'effort', label: '추론', kind: 'effort' }, { key: 'deploy', label: '실행 위치', kind: 'deploy' },
  ];
  const best = (r: CRow) => {
    const xs = chosen.map((m) => (r.kind === 'bench' ? m.scores[r.key]?.v : r.kind === 'overall' ? overall(m, ALL) : r.kind === 'price' ? m.price : r.kind === 'speed' ? m.speed : null)).filter((v): v is number => typeof v === 'number');
    return xs.length < 2 ? null : r.kind === 'price' ? Math.min(...xs) : Math.max(...xs);
  };
  const cols: Column<CRow>[] = [
    { key: 'label', header: '항목', width: 104, sticky: true, render: (r) => (r.kind === 'bench' ? r.label : <b>{r.label}</b>) },
    ...chosen.map((m): Column<CRow> => ({
      key: m.id, width: 196, align: 'end',
      /* the column's own model: its name opens the details */
      header: <button type="button" className="dash__link" onClick={() => onOpen(m)}>{m.name}</button>, subheader: <Vendor k={m.vendor} />,
      render: (r) => {
        const top = best(r);
        if (r.kind === 'bench') {
          const s = m.scores[r.key];
          if (!s) return <span className="sg-cell-muted">재지 않음</span>;
          return (
            <span className="eval__ci">
              <IntervalPlot value={s.v} low={s.lo} high={s.hi} reference={r.chance} width={88}
                aria-label={`${s.v.toFixed(1)}점, 95% 구간 ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}${r.chance ? `, 찍기 ${r.chance}점` : ''}`} />
              <ScoreText s={s} lead={s.v === top} />
            </span>
          );
        }
        if (r.kind === 'overall') {
          const v = overall(m, ALL), k = measured(m);
          return v === null ? null : <span className="eval__score"><span className={v === top ? 'sg-cell-strong' : undefined}>{v.toFixed(1)}</span>{k < BENCHMARKS.length && <small className="eval__n" title={`${BENCHMARKS.length}개 중 ${k}개만 쟀어요`}>{k}/{BENCHMARKS.length}</small>}</span>;
        }
        if (r.kind === 'price') return <span className={m.price === top ? 'sg-cell-strong' : undefined}>{usd(m.price)}</span>;
        if (r.kind === 'speed') return <span className={m.speed === top ? 'sg-cell-strong' : undefined}>{m.speed} 토큰/초</span>;
        if (r.kind === 'effort') return EFFORT_WORD[m.effort];
        return DEPLOY_WORD[m.deploy];
      },
    })),
  ];
  return (
    <div className="dash__stack">
      <div className="eval__picked" role="group" aria-label="비교 중인 모델">
        {chosen.map((m) => <Chip key={m.id} onRemove={() => setPicked(picked.filter((x) => x !== m.id))}>{m.name}</Chip>)}
        <Button size="sm" variant="plain" onClick={() => setPicked([])}>모두 빼기</Button>
      </div>
      <Card>
        <CardHeader title="나란히 보기" description="굵은 값이 고른 모델 중 가장 좋은 값이에요. 점은 점수, 선은 95% 구간, 세로 눈금은 찍기 점수예요. 모델 이름을 누르면 자세히 볼 수 있어요." />
        <CardBody>
          <DataTable<CRow> aria-label="고른 모델 나란히 보기" rows={rows} rowKey={(r) => r.key} columns={cols} density="compact" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="가격 대비 종합 점수" description={`왼쪽 위일수록 싸고 잘해요. 가격은 로그 눈금이에요. 고른 모델은 이름이 붙어요${outside.length ? ` · ${outside.length}개는 지금 필터 밖이지만 함께 보여요` : ''}.`} />
        <CardBody>
          <ScatterChart aria-label="가격 대비 종합 점수" data={points} x="price" y="overall" pointLabel="name" xScale="log" xLabel={`가격(${PRICE})`} yLabel="종합 점수"
            xFormat={usd} yFormat={(v) => v.toFixed(0)} group="vendor" groups={VENDORS.map((v) => ({ ...v, color: vendorColor(v.key) }))} highlight={chosen.map((m) => m.name)} height={300} locale="ko-KR" />
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- 모델 카드 */
function Cards({ models, filters, onClear, picked, toggle, onOpen }: { models: Model[]; filters: ReactNode; onClear: () => void; picked: string[]; toggle: (id: string, on: boolean) => void; onOpen: (m: Model) => void }) {
  return (
    <div className="dash__stack">
      {filters}
      {models.length === 0 && <EmptyState size="sm" icon={<SearchX />} title="조건에 맞는 모델이 없어요" actions={<Button size="sm" variant="neutral" onClick={onClear}>필터 초기화</Button>} />}
      <div className="eval__cards">
        {models.map((m) => <ModelCard key={m.id} m={m} picked={picked.includes(m.id)} onPick={(on) => toggle(m.id, on)} onOpen={() => onOpen(m)} />)}
      </div>
    </div>
  );
}

function Facts({ m }: { m: Model }) {
  const o = overall(m, ALL), k = measured(m);
  return (
    <dl className="eval__facts">
      <div><dt>종합{k < BENCHMARKS.length ? ` · ${k}/${BENCHMARKS.length}개 측정` : ''}</dt><dd>{o?.toFixed(1) ?? '–'}</dd></div>
      <div><dt>100만 토큰당 가격</dt><dd>{usd(m.price)}</dd></div>
      <div><dt>추론 설정</dt><dd>{EFFORT_WORD[m.effort]}</dd></div>
      <div><dt>실행 위치</dt><dd>{DEPLOY_WORD[m.deploy]}</dd></div>
    </dl>
  );
}

function ModelCard({ m, picked, onPick, onOpen }: { m: Model; picked: boolean; onPick: (on: boolean) => void; onOpen: () => void }) {
  const low = Object.values(m.scores).filter((s) => s && s.n < LOW_N).length;
  return (
    <Card className="eval__card">
      <CardHeader title={m.name} description={<Vendor k={m.vendor} />} />
      <CardBody className="eval__card-body">
        <Facts m={m} />
        {low > 0 && <Text variant="footnote" tone="secondary" as="p">표본이 작은 결과 {low}개 · 평가 {m.single ? '1회' : '여러 회'}</Text>}
        <div className="eval__card-actions">
          <Chip selected={picked} onSelectedChange={onPick}>{picked ? '비교에 넣음' : '비교에 넣기'}</Chip>
          <Button size="sm" variant="plain" onClick={onOpen}>자세히</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- 상세 */
function Detail({ m, picked, onPick }: { m: Model; picked: boolean; onPick: (on: boolean) => void }) {
  return (
    <div className="dash__detail eval__detail">
      <div className="eval__detail-head">
        <Vendor k={m.vendor} />
        <Button size="sm" variant={picked ? 'neutral' : 'tinted'} onClick={() => onPick(!picked)}>{picked ? '비교에서 빼기' : '비교에 넣기'}</Button>
      </div>
      <Facts m={m} />
      <Text variant="footnote" tone="secondary" as="p">점은 점수, 선은 95% 구간, 세로 눈금은 찍기 점수예요.</Text>
      <ul className="eval__scores">
        {BENCHMARKS.map((b) => {
          const s = m.scores[b.key];
          return (
            <li key={b.key}>
              <span>{b.label}</span>
              {s ? <IntervalPlot value={s.v} low={s.lo} high={s.hi} reference={b.chance} width={112} aria-label={`${s.v.toFixed(1)}점, 95% 구간 ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}`} /> : <span className="sg-cell-muted">재지 않음</span>}
              {s ? <ScoreText s={s} /> : <span />}
            </li>
          );
        })}
      </ul>
      <Accordion items={[{ value: 'run', title: '실행 설정과 출처', meta: m.trace.date, content: (
        <dl className="eval__trace">
          <dt>실행 ID</dt><dd>{m.trace.run}</dd>
          <dt>설정</dt><dd>{m.trace.config}</dd>
          <dt>평가 횟수</dt><dd>{m.single ? '1회 (표본이 작아요)' : '여러 회'}</dd>
          <dt>최소 표본</dt><dd>{minSample(m)}개</dd>
          <dt>속도 · 문맥</dt><dd>{m.speed} 토큰/초 · {m.context >= 1000 ? `${m.context / 1000}M` : `${m.context}K`} 토큰</dd>
          {m.trace.missing && <><dt>빠진 결과</dt><dd>{m.trace.missing}</dd></>}
        </dl>
      ) }]} />
    </div>
  );
}
