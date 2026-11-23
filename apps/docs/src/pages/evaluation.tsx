/* A model evaluation example: compare made-up language models, pick a few, and look at the evidence. The flow is
   filter → pick → compare → inspect, on the patterns public leaderboards share (a filterable score matrix, a
   quality-against-price scatter, a shortlist side by side, model details) and on the 0.6 parts: ColumnChooser,
   Combobox multiple, FilterBar, pill Tabs and ScatterChart.
   Encodings are the library's: accent only for selection and actions (leaders are bold, not coloured), a vendor is
   the same colour in every view (the scatter's), settings are words (reasoning effort, where a model runs), and
   uncertainty is shown where it applies (n= beside a score on a small sample) instead of fading whole rows.
   All names and numbers are made up. */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Accordion, BarMeter, Button, Card, CardBody, CardHeader, Chip, ColumnChooser, Combobox, DataTable, Drawer, EmptyState,
  FilterBar, IntervalPlot, ScatterChart, SearchField, SegmentedControl, Tabs, Text,
  type Column,
} from '@satin-glass/react';
import { Columns3, Scale, SearchX } from 'lucide-react';
import { Page } from '../shared';
import { L, useLocale, useT } from '../i18n';
import {
  BENCHMARK_KEYS, measured, minSample, overall, usd, useEvalData, vendorColor,
  type Deploy, type Model, type Score,
} from '../eval-data';

const ALL = BENCHMARK_KEYS;
const LOW_N = 100;
const EXAMPLE = ['kestrel-4', 'tide-pro', 'nimbus-2'];
const narrow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;

/* text the tables write themselves, in the reader's language */
function useTableLabels() {
  const t = useT();
  return { selectAll: t({ en: 'Select all models shown', ko: '보이는 모델 모두 선택' }), sortedAsc: t({ en: 'Sorted ascending', ko: '오름차순 정렬' }), sortedDesc: t({ en: 'Sorted descending', ko: '내림차순 정렬' }) };
}
const usePriceUnit = () => useT()({ en: 'USD per 1M tokens', ko: '100만 토큰당 USD' });

/* one table row: a model, or a summary of the models shown (highest / median / lowest) */
type Row = { id: string; name: string; model?: Model; values: Record<string, number | null> };
const valuesOf = (m: Model): Row['values'] => ({ overall: overall(m, ALL), price: m.price, speed: m.speed, effort: m.effort, ...Object.fromEntries(ALL.map((k) => [k, m.scores[k]?.v ?? null])) });
const median = (xs: number[]) => +(xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2).toFixed(2);
function summaries(rows: Row[], names: { max: string; median: string; min: string }): Row[] {
  const keys = ['overall', ...ALL, 'price', 'speed'];
  const by = (f: (xs: number[]) => number) => Object.fromEntries(keys.map((k) => {
    const xs = rows.map((r) => r.values[k]).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return [k, xs.length ? f(xs) : null];
  }));
  return [
    { id: 'max', name: names.max, values: by((xs) => xs[xs.length - 1]) },
    { id: 'median', name: names.median, values: by(median) },
    { id: 'min', name: names.min, values: by((xs) => xs[0]) },
  ];
}
/* the leader of a column among the models shown: the highest score, the lowest price */
const leaders = (rows: Row[]) => Object.fromEntries(['overall', ...ALL, 'price', 'speed'].map((k) => {
  const xs = rows.map((r) => r.values[k]).filter((v): v is number => v !== null);
  return [k, xs.length ? (k === 'price' ? Math.min(...xs) : Math.max(...xs)) : null];
}));

/* ---------------------------------------------------------------- shared marks */
function Vendor({ k }: { k: string }) {
  const e = useEvalData();
  return <span className="eval__vendor"><span className="eval__swatch" style={{ background: vendorColor(k) }} aria-hidden="true" />{e.vendorLabel(k)}</span>;
}
/** a score; on a small sample the sample size is shown right beside it */
function ScoreText({ s, lead }: { s: NonNullable<Score>; lead?: boolean }) {
  const t = useT();
  return (
    <span className="eval__score">
      <span className={lead ? 'sg-cell-strong' : undefined}>{s.v.toFixed(1)}</span>
      {s.n < LOW_N && <small className="eval__n" title={t({ en: `Only ${s.n} samples, so the margin of error is wide`, ko: `표본 ${s.n}개라 오차 범위가 넓어요` })}>n={s.n}</small>}
    </span>
  );
}

export function Evaluation() {
  const t = useT(), e = useEvalData();
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
  const base = useMemo(() => e.MODELS.filter((m) => (!q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))
    && (!vendors.length || vendors.includes(m.vendor)) && (!enough || minSample(m) >= LOW_N)), [e, q, vendors, enough]);
  const models = useMemo(() => base.filter((m) => deploy === 'all' || m.deploy === deploy), [base, deploy]);
  const count = (q.trim() ? 1 : 0) + (vendors.length ? 1 : 0) + (deploy !== 'all' ? 1 : 0) + (enough ? 1 : 0);
  const clear = () => { setQ(''); setVendors([]); setDeploy('all'); setEnough(false); };
  const n = (d: Deploy) => base.filter((m) => m.deploy === d).length;
  const filters = (
    <FilterBar aria-label={t({ en: 'Model filters', ko: '모델 필터' })} count={count} onClear={clear} labels={{ clear: t({ en: 'Clear', ko: '초기화' }), applied: (k) => t({ en: k === 1 ? '1 filter' : `${k} filters`, ko: `필터 ${k}개` }) }}>
      <SearchField aria-label={t({ en: 'Find a model', ko: '모델 찾기' })} placeholder={t({ en: 'Model name', ko: '모델 이름' })} value={q} onChange={(ev) => setQ(ev.currentTarget.value)} style={{ width: 160 }} />
      <Combobox multiple aria-label={t({ en: 'Vendor', ko: '공급사' })} placeholder={t({ en: 'Vendor', ko: '공급사' })} maxChips={1} value={vendors} onChange={setVendors} style={{ width: 200 }}
        options={e.VENDORS.map((v) => ({ value: v.key, label: v.label, icon: <span className="eval__swatch" style={{ background: vendorColor(v.key) }} aria-hidden="true" /> }))}
        labels={{ remove: (x) => t({ en: `Remove ${x}`, ko: `${x} 제거` }), clear: t({ en: 'Clear all', ko: '모두 지우기' }), toggle: t({ en: 'Vendor list', ko: '공급사 목록' }), empty: t({ en: 'No vendors match', ko: '맞는 공급사가 없어요' }), count: (k) => t({ en: k === 1 ? '1 vendor' : `${k} vendors`, ko: `공급사 ${k}곳` }) }} />
      <SegmentedControl size="sm" aria-label={t({ en: 'Runs on', ko: '실행 위치' })} value={deploy} onChange={setDeploy}
        options={[{ value: 'all', label: t({ en: `All ${base.length}`, ko: `전체 ${base.length}` }) }, { value: 'hosted', label: t({ en: `Hosted ${n('hosted')}`, ko: `호스팅 ${n('hosted')}` }) }, { value: 'local', label: t({ en: `Local ${n('local')}`, ko: `로컬 ${n('local')}` }) }]} />
      <Chip selected={enough} onSelectedChange={setEnough}>{t({ en: `${LOW_N}+ samples only`, ko: `표본 ${LOW_N}개 이상만` })}</Chip>
    </FilterBar>
  );
  return (
    <Page title={t({ en: 'Model evaluation', ko: '모델 평가' })} intro={<L
      en="The flow public leaderboards share — narrow the list, pick a few to compare, check the evidence — built from library components. It uses what 0.6 added: the column chooser (ColumnChooser), a multi-select Combobox, the filter bar (FilterBar), pill tabs and the scatter chart (ScatterChart). All model and vendor names and scores are made up."
      ko="공개 순위표(리더보드)에서 흔히 보는 흐름, 곧 목록을 좁히고 몇 개를 골라 비교한 뒤 근거를 확인하는 과정을 라이브러리 컴포넌트로 만든 화면입니다. 0.6에서 추가한 열 선택(ColumnChooser), 다중 선택 Combobox, 필터 바(FilterBar), 필 탭, 산점도(ScatterChart)를 씁니다. 모델·공급사 이름과 점수는 모두 지어낸 것입니다." />}>
      <div className="dash eval" data-demo="evaluation">
        <header className="dash__head">
          <div className="dash__title">
            <Text variant="title-2" as="h2">{t({ en: 'Language model evaluation', ko: '언어 모델 평가' })}</Text>
            <Text variant="footnote" tone="secondary" as="span">{t({ en: `Eval set v3 · ${e.BENCHMARKS.length} benchmarks · updated Nov 18 · made-up example data`, ko: `평가 세트 v3 · 벤치마크 ${e.BENCHMARKS.length}개 · 11월 18일 갱신 · 예제용 가상 데이터` })}</Text>
          </div>
        </header>
        <Tabs aria-label={t({ en: 'Evaluation views', ko: '평가 보기' })} value={section} onChange={setSection} panelClassName="dash__panel" items={[
          { value: 'board', label: t({ en: 'Leaderboard', ko: '순위표' }), content: <Board models={models} filters={filters} onClear={clear} picked={picked} setPicked={setPicked} onCompare={() => setSection('compare')} onOpen={setOpen} /> },
          { value: 'compare', label: t({ en: 'Compare', ko: '비교' }), badge: picked.length || undefined, content: <Compare models={models} picked={picked} setPicked={setPicked} onBack={() => setSection('board')} onOpen={setOpen} /> },
          { value: 'models', label: t({ en: 'Models', ko: '모델' }), content: <Cards models={models} filters={filters} onClear={clear} picked={picked} toggle={toggle} onOpen={setOpen} /> },
        ]} />
      </div>
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''} width={440}>
        {open && <Detail m={e.MODELS.find((x) => x.id === open.id) ?? open} picked={picked.includes(open.id)} onPick={(on) => toggle(open.id, on)} />}
      </Drawer>
    </Page>
  );
}

/* ---------------------------------------------------------------- leaderboard */
function Board({ models, filters, onClear, picked, setPicked, onCompare, onOpen }: { models: Model[]; filters: ReactNode; onClear: () => void; picked: string[]; setPicked: (k: string[]) => void; onCompare: () => void; onOpen: (m: Model) => void }) {
  const t = useT(), e = useEvalData(), tableLabels = useTableLabels(), PRICE = usePriceUnit();
  const [family, setFamily] = useState('all');
  const [summary, setSummary] = useState(false);
  /* a phone starts with the model and its overall score; the chooser brings back the rest */
  const [phone] = useState(narrow);
  const [hidden, setHidden] = useState<string[]>(() => (narrow() ? ['vendor', 'effort', 'deploy', ...ALL, 'price', 'speed'] : ['speed']));
  const rows = useMemo<Row[]>(() => models.map((m) => ({ id: m.id, name: m.name, model: m, values: valuesOf(m) })), [models]);
  const lead = leaders(rows);
  const keys = family === 'all' ? ALL : e.BENCHMARKS.filter((b) => b.family === family).map((b) => b.key);
  const N = e.BENCHMARKS.length;
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
  const costSpeed = t({ en: 'Cost · speed', ko: '비용 · 속도' });
  const cols: Column<Row>[] = [
    { key: 'name', header: t({ en: 'Model', ko: '모델' }), width: phone ? 132 : 160, sticky: true, sortable: true,
      render: (r, { pinned }) => (pinned || !r.model ? <b>{r.name}</b> : <button type="button" className="dash__link" onClick={() => onOpen(r.model!)}>{r.name}</button>) },
    { key: 'vendor', header: t({ en: 'Vendor', ko: '공급사' }), width: 112, sortable: true, value: (r) => (r.model ? e.vendorLabel(r.model.vendor) : ''), render: (r) => (r.model ? <Vendor k={r.model.vendor} /> : null) },
    { key: 'effort', header: t({ en: 'Effort', ko: '추론 설정' }), width: t({ en: 76, ko: 92 }), sortable: true, value: (r) => r.values.effort,
      description: t({ en: 'The reasoning setting used for the evaluation. It is a run setting, not a measure of quality: higher settings are slower and cost more.', ko: '평가할 때 쓴 추론 설정이에요. 품질 지표가 아니라 실행 조건이에요. 높을수록 느리고 비싸져요.' }),
      render: (r) => (r.model ? e.EFFORT_WORD[r.model.effort] : null) },
    { key: 'deploy', header: t({ en: 'Runs on', ko: '실행 위치' }), width: 96, sortable: true, value: (r) => (r.model ? e.DEPLOY_WORD[r.model.deploy] : ''), render: (r) => (r.model ? e.DEPLOY_WORD[r.model.deploy] : null) },
    { key: 'overall', header: t({ en: 'Overall', ko: '종합' }), subheader: t({ en: 'mean of measured', ko: '측정한 항목 평균' }), align: 'end', width: phone ? 132 : 148, sortable: true, firstSort: 'desc', value: (r) => r.values.overall,
      description: t({ en: `The mean of the benchmarks with results. A model missing some of the ${N} also shows how many were measured. Chance scores differ between benchmarks, so a plain mean is only a guide.`, ko: `결과가 있는 벤치마크의 평균이에요. ${N}개 중 일부가 빠진 모델은 몇 개를 측정했는지 함께 보여요. 벤치마크마다 찍기 점수가 달라 단순 평균은 참고용이에요.` }),
      render: (r, { pinned }) => {
        const v = r.values.overall;
        if (v === null) return null;
        if (pinned || !r.model) return v.toFixed(1);
        const k = measured(r.model);
        return (
          <span className="sg-cell-meter">
            {k < N && <small className="eval__n" title={t({ en: `Only ${k} of ${N} measured`, ko: `${N}개 중 ${k}개만 측정했어요` })}>{k}/{N}</small>}
            <BarMeter value={v} max={100} width={36} />
            <span className={v === lead.overall ? 'sg-cell-strong' : undefined}>{v.toFixed(1)}</span>
          </span>
        );
      } },
    ...e.BENCHMARKS.map((b): Column<Row> => ({
      key: b.key, header: b.label, subheader: b.chance ? t({ en: `chance ${b.chance}`, ko: `찍기 ${b.chance}` }) : ' ', group: e.FAMILIES.find((f) => f.key === b.family)!.label,
      description: b.note, align: 'end', width: 112, sortable: true, firstSort: 'desc', value: (r) => r.values[b.key], render: score(b.key),
    })),
    { key: 'price', header: t({ en: 'Price', ko: '가격' }), subheader: PRICE, group: costSpeed, align: 'end', width: 116, sortable: true, value: (r) => r.values.price, render: plain('price', usd),
      description: t({ en: 'The price of a million tokens, input and output blended 3:1. Lower is better.', ko: '입력과 출력 토큰 가격을 3:1로 가중 평균한 100만 토큰 가격이에요. 낮을수록 좋아요.' }) },
    { key: 'speed', header: t({ en: 'Speed', ko: '속도' }), subheader: t({ en: 'output tokens/s', ko: '출력 토큰/초' }), group: costSpeed, align: 'end', width: 100, sortable: true, firstSort: 'desc', value: (r) => r.values.speed, render: plain('speed', (v) => v.toFixed(0)) },
  ];
  /* the family tab narrows the benchmark columns; the chooser hides any column within it */
  const outOfFamily = ALL.filter((k) => !keys.includes(k));
  const choosable = cols.filter((c) => !outOfFamily.includes(c.key));
  const names = picked.map((id) => e.MODELS.find((m) => m.id === id)?.name).filter(Boolean);
  return (
    <Card>
      <CardBody className="dash__table-card">
        {filters}
        <div className="eval__tablebar">
          <Tabs variant="pill" aria-label={t({ en: 'Benchmark groups', ko: '벤치마크 묶음' })} value={family} onChange={setFamily}
            items={[{ value: 'all', label: t({ en: 'All benchmarks', ko: '모든 벤치마크' }) }, ...e.FAMILIES.map((f) => ({ value: f.key, label: f.label }))]} />
          <span className="eval__tools">
            <Chip selected={summary} onSelectedChange={setSummary}>{t({ en: 'Summary rows', ko: '요약 행' })}</Chip>
            <ColumnChooser columns={choosable} hidden={hidden} onHiddenChange={setHidden} label={t({ en: 'Columns', ko: '열' })} icon={<Columns3 />}
              labels={{ panel: t({ en: 'Columns to show', ko: '표시할 열' }), showAll: t({ en: 'Show all', ko: '모두 보기' }), count: (s, a) => `${s}/${a}` }} />
          </span>
        </div>
        {/* what the table holds, and what was picked from it: the next step sits right here */}
        <div className="table-bar eval__pickbar" data-on={picked.length > 0 || undefined}>
          <Text variant="subhead" as="span" aria-live="polite">
            {picked.length
              ? t({ en: `${picked.length} selected · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''}`, ko: `${picked.length}개 선택했어요 · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` 외 ${names.length - 2}개` : ''}` })
              : t({ en: `${models.length} of ${e.MODELS.length} models · select the ones to compare`, ko: `모델 ${e.MODELS.length}개 중 ${models.length}개 · 비교할 모델을 선택하세요` })}
          </Text>
          {picked.length > 0 && (
            <span className="table-bar__actions">
              <Button size="sm" variant="tinted" onClick={onCompare}>{t({ en: `Compare ${picked.length}`, ko: `${picked.length}개 비교하기` })}</Button>
              <Button size="sm" variant="plain" onClick={() => setPicked([])}>{t({ en: 'Clear selection', ko: '선택 해제' })}</Button>
            </span>
          )}
        </div>
        <DataTable<Row> aria-label={t({ en: 'Model leaderboard', ko: '모델 순위표' })} rows={rows} rowKey={(r) => r.id} columns={cols} hiddenColumns={[...outOfFamily, ...hidden]} columnLines="groups"
          pinnedRows={summary && rows.length > 1 ? summaries(rows, { max: t({ en: 'Highest', ko: '최댓값' }), median: t({ en: 'Median', ko: '중앙값' }), min: t({ en: 'Lowest', ko: '최솟값' }) }) : []}
          defaultSort={{ key: 'overall', dir: 'desc' }} density="compact" maxHeight={560} selectable selected={picked} onSelectedChange={setPicked}
          labels={{ ...tableLabels, selectRow: (r) => t({ en: `Add ${r.name} to comparison`, ko: `${r.name} 비교에 추가` }) }}
          empty={<EmptyState size="sm" icon={<SearchX />} title={t({ en: 'No models match', ko: '조건에 맞는 모델이 없어요' })} actions={<Button size="sm" variant="neutral" onClick={onClear}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />} />
        <Text variant="footnote" tone="secondary" as="p">{t({
          en: `Bold is the best value among the models shown (for price, the lowest). n= marks a result on fewer than ${LOW_N} samples, with a wide margin of error; – marks a result not measured.`,
          ko: `굵게 표시한 값은 보이는 모델 중 가장 좋은 값이에요(가격은 가장 낮은 값). n=은 표본이 ${LOW_N}개보다 적어 오차 범위가 넓은 결과, –는 측정하지 않은 결과예요.` })}</Text>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- compare */
type CRow = { key: string; label: string; kind: 'overall' | 'bench' | 'price' | 'speed' | 'effort' | 'deploy'; chance?: number };
function Compare({ models, picked, setPicked, onBack, onOpen }: { models: Model[]; picked: string[]; setPicked: (k: string[]) => void; onBack: () => void; onOpen: (m: Model) => void }) {
  const t = useT(), e = useEvalData(), locale = useLocale(), PRICE = usePriceUnit();
  const chosen = picked.map((id) => e.MODELS.find((m) => m.id === id)).filter((m): m is Model => !!m);
  if (!chosen.length) {
    return (
      <EmptyState icon={<Scale />} title={t({ en: 'Select models to compare', ko: '비교할 모델을 선택해 주세요' })} description={t({ en: 'Select models in the leaderboard to see them here side by side.', ko: '순위표에서 모델을 선택하면 여기에 나란히 보여요.' })}
        actions={<><Button size="sm" variant="tinted" onClick={onBack}>{t({ en: 'Go to leaderboard', ko: '순위표로' })}</Button><Button size="sm" variant="neutral" onClick={() => setPicked(EXAMPLE)}>{t({ en: 'Try 3 examples', ko: '예시 3개로 보기' })}</Button></>} />
    );
  }
  const N = e.BENCHMARKS.length;
  /* the filtered models for context, and every pick — also the ones the filters now leave out */
  const outside = chosen.filter((m) => !models.includes(m));
  const cohort = [...models, ...outside];
  const points = cohort.map((m) => ({ name: m.name, price: m.price, overall: overall(m, ALL), vendor: m.vendor }));
  const rows: CRow[] = [
    { key: 'overall', label: t({ en: 'Overall', ko: '종합' }), kind: 'overall' },
    ...e.BENCHMARKS.map((b): CRow => ({ key: b.key, label: b.label, kind: 'bench', chance: b.chance })),
    { key: 'price', label: t({ en: 'Price', ko: '가격' }), kind: 'price' }, { key: 'speed', label: t({ en: 'Speed', ko: '속도' }), kind: 'speed' },
    { key: 'effort', label: t({ en: 'Effort', ko: '추론 설정' }), kind: 'effort' }, { key: 'deploy', label: t({ en: 'Runs on', ko: '실행 위치' }), kind: 'deploy' },
  ];
  const best = (r: CRow) => {
    const xs = chosen.map((m) => (r.kind === 'bench' ? m.scores[r.key]?.v : r.kind === 'overall' ? overall(m, ALL) : r.kind === 'price' ? m.price : r.kind === 'speed' ? m.speed : null)).filter((v): v is number => typeof v === 'number');
    return xs.length < 2 ? null : r.kind === 'price' ? Math.min(...xs) : Math.max(...xs);
  };
  const notRun = t({ en: 'Not measured', ko: '측정 안 함' });
  const cols: Column<CRow>[] = [
    { key: 'label', header: t({ en: 'Measure', ko: '항목' }), width: 104, sticky: true, render: (r) => (r.kind === 'bench' ? r.label : <b>{r.label}</b>) },
    ...chosen.map((m): Column<CRow> => ({
      key: m.id, width: 196, align: 'end',
      /* the column's own model: its name opens the details */
      header: <button type="button" className="dash__link" onClick={() => onOpen(m)}>{m.name}</button>, subheader: <Vendor k={m.vendor} />,
      render: (r) => {
        const top = best(r);
        if (r.kind === 'bench') {
          const s = m.scores[r.key];
          if (!s) return <span className="sg-cell-muted">{notRun}</span>;
          return (
            <span className="eval__ci">
              <IntervalPlot value={s.v} low={s.lo} high={s.hi} reference={r.chance} width={88}
                aria-label={t({
                  en: `${s.v.toFixed(1)}, 95% confidence interval ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}${r.chance ? `, chance ${r.chance}` : ''}`,
                  ko: `${s.v.toFixed(1)}점, 95% 신뢰 구간 ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}${r.chance ? `, 찍기 ${r.chance}점` : ''}` })} />
              <ScoreText s={s} lead={s.v === top} />
            </span>
          );
        }
        if (r.kind === 'overall') {
          const v = overall(m, ALL), k = measured(m);
          return v === null ? null : <span className="eval__score"><span className={v === top ? 'sg-cell-strong' : undefined}>{v.toFixed(1)}</span>{k < N && <small className="eval__n" title={t({ en: `Only ${k} of ${N} measured`, ko: `${N}개 중 ${k}개만 측정했어요` })}>{k}/{N}</small>}</span>;
        }
        if (r.kind === 'price') return <span className={m.price === top ? 'sg-cell-strong' : undefined}>{usd(m.price)}</span>;
        if (r.kind === 'speed') return <span className={m.speed === top ? 'sg-cell-strong' : undefined}>{t({ en: `${m.speed} tokens/s`, ko: `${m.speed} 토큰/초` })}</span>;
        if (r.kind === 'effort') return e.EFFORT_WORD[m.effort];
        return e.DEPLOY_WORD[m.deploy];
      },
    })),
  ];
  const scatterTitle = t({ en: 'Overall score against price', ko: '가격 대비 종합 점수' });
  return (
    <div className="dash__stack">
      <div className="eval__picked" role="group" aria-label={t({ en: 'Models being compared', ko: '비교 중인 모델' })}>
        {chosen.map((m) => <Chip key={m.id} onRemove={() => setPicked(picked.filter((x) => x !== m.id))}>{m.name}</Chip>)}
        <Button size="sm" variant="plain" onClick={() => setPicked([])}>{t({ en: 'Remove all', ko: '모두 제거' })}</Button>
      </div>
      <Card>
        <CardHeader title={t({ en: 'Side by side', ko: '나란히 보기' })} description={t({
          en: 'Bold is the best value among the selected models. The dot is the score, the line the 95% confidence interval, the tick the chance score. Select a model’s name for details.',
          ko: '굵게 표시한 값이 선택한 모델 중 가장 좋은 값이에요. 점은 점수, 선은 95% 신뢰 구간, 세로 눈금은 찍기 점수예요. 모델 이름을 누르면 자세히 볼 수 있어요.' })} />
        <CardBody>
          <DataTable<CRow> aria-label={t({ en: 'Selected models side by side', ko: '선택한 모델 나란히 보기' })} rows={rows} rowKey={(r) => r.key} columns={cols} density="compact" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={scatterTitle} description={t({
          en: `Up and to the left is cheaper and scores higher. Price is on a log scale. Selected models are labelled with their names.${outside.length ? ` ${outside.length === 1 ? 'One of them is' : `${outside.length} of them are`} outside the current filters but shown anyway.` : ''}`,
          ko: `왼쪽 위일수록 싸고 점수가 높아요. 가격은 로그 스케일이에요. 선택한 모델에는 이름이 표시돼요.${outside.length ? ` 그중 ${outside.length}개는 현재 필터에 맞지 않지만 함께 보여 줘요.` : ''}` })} />
        <CardBody>
          <ScatterChart aria-label={scatterTitle} data={points} x="price" y="overall" pointLabel="name" xScale="log" xLabel={t({ en: `Price (${PRICE})`, ko: `가격(${PRICE})` })} yLabel={t({ en: 'Overall score', ko: '종합 점수' })}
            xFormat={usd} yFormat={(v) => v.toFixed(0)} group="vendor" groups={e.VENDORS.map((v) => ({ ...v, color: vendorColor(v.key) }))} highlight={chosen.map((m) => m.name)} height={300} locale={locale} />
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- model cards */
function Cards({ models, filters, onClear, picked, toggle, onOpen }: { models: Model[]; filters: ReactNode; onClear: () => void; picked: string[]; toggle: (id: string, on: boolean) => void; onOpen: (m: Model) => void }) {
  const t = useT();
  return (
    <div className="dash__stack">
      {filters}
      {models.length === 0 && <EmptyState size="sm" icon={<SearchX />} title={t({ en: 'No models match', ko: '조건에 맞는 모델이 없어요' })} actions={<Button size="sm" variant="neutral" onClick={onClear}>{t({ en: 'Clear filters', ko: '필터 초기화' })}</Button>} />}
      <div className="eval__cards">
        {models.map((m) => <ModelCard key={m.id} m={m} picked={picked.includes(m.id)} onPick={(on) => toggle(m.id, on)} onOpen={() => onOpen(m)} />)}
      </div>
    </div>
  );
}

function Facts({ m }: { m: Model }) {
  const t = useT(), e = useEvalData();
  const o = overall(m, ALL), k = measured(m), N = e.BENCHMARKS.length;
  return (
    <dl className="eval__facts">
      <div><dt>{t({ en: `Overall${k < N ? ` · ${k}/${N} measured` : ''}`, ko: `종합${k < N ? ` · ${k}/${N}개 측정` : ''}` })}</dt><dd>{o?.toFixed(1) ?? '–'}</dd></div>
      <div><dt>{t({ en: 'Price per 1M tokens', ko: '100만 토큰당 가격' })}</dt><dd>{usd(m.price)}</dd></div>
      <div><dt>{t({ en: 'Reasoning effort', ko: '추론 설정' })}</dt><dd>{e.EFFORT_WORD[m.effort]}</dd></div>
      <div><dt>{t({ en: 'Runs on', ko: '실행 위치' })}</dt><dd>{e.DEPLOY_WORD[m.deploy]}</dd></div>
    </dl>
  );
}

function ModelCard({ m, picked, onPick, onOpen }: { m: Model; picked: boolean; onPick: (on: boolean) => void; onOpen: () => void }) {
  const t = useT();
  const low = Object.values(m.scores).filter((s) => s && s.n < LOW_N).length;
  return (
    <Card className="eval__card">
      <CardHeader title={m.name} description={<Vendor k={m.vendor} />} />
      <CardBody className="eval__card-body">
        <Facts m={m} />
        {low > 0 && <Text variant="footnote" tone="secondary" as="p">{t({
          en: `${low} small-sample ${low === 1 ? 'result' : 'results'} · ${m.single ? 'one run' : 'several runs'}`,
          ko: `표본이 작은 결과 ${low}개 · ${m.single ? '한 번 평가' : '여러 번 평가'}` })}</Text>}
        <div className="eval__card-actions">
          <Chip selected={picked} onSelectedChange={onPick}>{picked ? t({ en: 'In comparison', ko: '비교에 추가됨' }) : t({ en: 'Add to comparison', ko: '비교에 추가' })}</Chip>
          <Button size="sm" variant="plain" onClick={onOpen}>{t({ en: 'Details', ko: '자세히' })}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- details */
function Detail({ m, picked, onPick }: { m: Model; picked: boolean; onPick: (on: boolean) => void }) {
  const t = useT(), e = useEvalData();
  const ctx = m.context >= 1000 ? `${m.context / 1000}M` : `${m.context}K`;
  return (
    <div className="dash__detail eval__detail">
      <div className="eval__detail-head">
        <Vendor k={m.vendor} />
        <Button size="sm" variant={picked ? 'neutral' : 'tinted'} onClick={() => onPick(!picked)}>{picked ? t({ en: 'Remove from comparison', ko: '비교에서 제거' }) : t({ en: 'Add to comparison', ko: '비교에 추가' })}</Button>
      </div>
      <Facts m={m} />
      <Text variant="footnote" tone="secondary" as="p">{t({ en: 'The dot is the score, the line the 95% confidence interval, the tick the chance score.', ko: '점은 점수, 선은 95% 신뢰 구간, 세로 눈금은 찍기 점수예요.' })}</Text>
      <ul className="eval__scores">
        {e.BENCHMARKS.map((b) => {
          const s = m.scores[b.key];
          return (
            <li key={b.key}>
              <span>{b.label}</span>
              {s ? <IntervalPlot value={s.v} low={s.lo} high={s.hi} reference={b.chance} width={112} aria-label={t({
                en: `${s.v.toFixed(1)}, 95% confidence interval ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}${b.chance ? `, chance ${b.chance}` : ''}`,
                ko: `${s.v.toFixed(1)}점, 95% 신뢰 구간 ${s.lo.toFixed(1)}–${s.hi.toFixed(1)}${b.chance ? `, 찍기 ${b.chance}점` : ''}` })} /> : <span className="sg-cell-muted">{t({ en: 'Not measured', ko: '측정 안 함' })}</span>}
              {s ? <ScoreText s={s} /> : <span />}
            </li>
          );
        })}
      </ul>
      <Accordion items={[{ value: 'run', title: t({ en: 'Run settings and source', ko: '실행 설정과 출처' }), meta: m.trace.date, content: (
        <dl className="eval__trace">
          <dt>{t({ en: 'Run ID', ko: '실행 ID' })}</dt><dd>{m.trace.run}</dd>
          <dt>{t({ en: 'Settings', ko: '설정' })}</dt><dd>{m.trace.config}</dd>
          <dt>{t({ en: 'Runs', ko: '평가 횟수' })}</dt><dd>{m.single ? t({ en: 'One (a small sample)', ko: '한 번 (표본이 작아요)' }) : t({ en: 'Several', ko: '여러 번' })}</dd>
          <dt>{t({ en: 'Smallest sample', ko: '최소 표본' })}</dt><dd>{t({ en: `${minSample(m)}`, ko: `${minSample(m)}개` })}</dd>
          <dt>{t({ en: 'Speed · context', ko: '속도 · 컨텍스트' })}</dt><dd>{t({ en: `${m.speed} tokens/s · ${ctx} tokens`, ko: `${m.speed} 토큰/초 · ${ctx} 토큰` })}</dd>
          {m.trace.missing && <><dt>{t({ en: 'Missing results', ko: '빠진 결과' })}</dt><dd>{m.trace.missing}</dd></>}
        </dl>
      ) }]} />
    </div>
  );
}
