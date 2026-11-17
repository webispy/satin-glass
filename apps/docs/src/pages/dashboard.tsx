/* A dashboard example in the shape of a server benchmark board: dense comparison tables with
   column groups, pinned summaries and in-cell marks; filters; KPIs; charts. All names and numbers are made up. */
import { useEffect, useMemo, useState } from 'react';
import {
  Accordion, Banner, BarChart, BarMeter, Button, Card, DataTable, DonutChart, EmptyState, IntervalPlot, Level, LineChart,
  Pagination, SearchField, Select, Stack, Stat, Tabs, Tag, Text, Tooltip, useToast, type Column, type SortState,
} from '@glass-layer/react';
import { Activity, CheckCircle2, CircleDollarSign, FileSearch, Gauge, Timer } from 'lucide-react';
import { Page, Section } from '../shared';

/* ---------------------------------------------------------------- made-up data (seeded, stable) */
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = rand(7);
const FAMILIES = ['Nova', 'Atlas', 'Lumen', 'Orbit', 'Quill', 'Vela', 'Cirrus', 'Tessera', 'Halo', 'Juniper', 'Kestrel', 'Mosaic'];
const SIZES = ['Flash', 'Pro', 'Mini', '3.1', 'Large', '2 Turbo'];
const SETS = [
  { key: 'mix', label: '혼합 부하', sub: '서울, 120', group: '웹', desc: '여러 종류의 요청을 섞어 보내는 시험.' },
  { key: 'sys', label: '정적 파일', sub: '여러 지역, 120', group: '웹', desc: '정적 파일을 내려받는 시험.' },
  { key: 'biz', label: '동적 페이지', sub: '서울, 300', group: '웹', desc: '페이지를 그때그때 만들어 응답하는 시험.' },
  { key: 'k1', label: '읽기 A', sub: '도쿄, 210', group: '저장소', desc: '작은 파일을 무작위로 읽는 시험.' },
  { key: 'k2', label: '쓰기 B', sub: '서울, 200', group: '저장소', desc: '작은 파일을 무작위로 쓰는 시험.' },
  { key: 'm1', label: '압축', sub: '도쿄, 30', group: '연산', desc: '큰 파일을 압축하는 시험.' },
  { key: 'm2', label: '암호화', sub: '서울, 200', group: '연산', desc: '데이터를 암호화하는 시험.' },
] as const;
type SetKey = (typeof SETS)[number]['key'];
type Boost = '끔' | '낮음' | '높음' | '없음';
type Row = { id: string; model: string; vendor: string; boost: Boost; runs: number; cost: number; time: number; err: number } & Record<SetKey, number | null>;
const LEVEL: Record<Boost, number> = { 없음: 0, 끔: 1, 낮음: 2, 높음: 3 };

const ROWS: Row[] = FAMILIES.flatMap((f, fi) => {
  const modes: Boost[] = fi % 4 === 3 ? ['없음'] : fi % 3 === 0 ? ['낮음', '높음'] : ['끔', '높음'];
  return modes.map((m, mi) => {
    const base = 62 + R() * 22 + (m === '높음' ? 8 : m === '낮음' ? 4 : 0);
    const s = (spread: number, hard = 0) => Math.max(5, Math.min(100, Math.round(base - hard + (R() - 0.5) * spread)));
    return {
      id: `${f}-${mi}`, model: `${f} ${SIZES[fi % SIZES.length]}`, vendor: ['Northwind', 'Contoso', 'Fabrikam', 'Litware'][fi % 4], boost: m, runs: fi === 5 ? 1 : 3,
      mix: s(14, -14), sys: s(20, -8), biz: s(40, 45), k1: s(10, -6), k2: s(12, -2), m1: fi === 7 && mi === 0 ? null : s(50, 0), m2: s(16, -4),
      cost: +(0.08 + R() * (m === '높음' ? 20 : 3)).toFixed(2), time: +(2 + R() * (m === '높음' ? 30 : 8)).toFixed(1), err: +(R() * 3).toFixed(1),
    } as Row;
  });
});
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const vals = (k: keyof Row) => ROWS.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
const LOWER_BETTER = new Set(['cost', 'time', 'err']);
const summary = (kind: 'best' | 'median' | 'worst'): Row => {
  const out = { id: kind, model: kind === 'best' ? '가장 좋음' : kind === 'median' ? '기준 중앙값' : '가장 나쁨', vendor: '', boost: '없음', runs: 0 } as Row;
  for (const k of [...SETS.map((x) => x.key), 'cost', 'time', 'err'] as (keyof Row)[]) {
    const v = vals(k), low = LOWER_BETTER.has(k as string);
    (out as Record<string, unknown>)[k] = kind === 'median' ? +median(v).toFixed(2) : (kind === 'best') !== low ? Math.max(...v) : Math.min(...v);
  }
  return out;
};
const PINNED = [summary('best'), summary('median'), summary('worst')];
const BEST = PINNED[0];

const fmtCost = (v: number) => `$${v.toFixed(2)}`;
const DAYS = Array.from({ length: 30 }, (_, i) => { const d = new Date(2026, 9, 19 + i); return `${d.getMonth() + 1}/${d.getDate()}`; });
const TRAFFIC = DAYS.map((d, i) => ({ d, answers: Math.round(1800 + Math.sin(i / 3) * 400 + i * 40 + R() * 300), graded: Math.round(1500 + Math.sin(i / 3 + 0.4) * 360 + i * 38 + R() * 250) }));
const COSTS = SETS.map((s) => ({ set: s.label, off: +(R() * 4 + 1).toFixed(1), high: +(R() * 18 + 4).toFixed(1) }));

/* big log for the virtualised table */
type Call = { id: string; time: string; model: string; set: string; ms: number; kb: number; ok: boolean };
const CALLS: Call[] = Array.from({ length: 5000 }, (_, i) => {
  const r = ROWS[i % ROWS.length];
  return { id: `c${i}`, time: `11-17 ${String(9 + Math.floor(i / 600)).padStart(2, '0')}:${String(Math.floor(i / 10) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, model: `${r.model} · ${r.boost}`, set: SETS[i % SETS.length].label, ms: Math.round(300 + R() * 9000), kb: Math.round(100 + R() * 3000), ok: R() > 0.03 };
});

/* ---------------------------------------------------------------- page */
export function Dashboard() {
  const toast = useToast();
  const [top, setTop] = useState('web');
  const [view, setView] = useState('profile');
  return (
    <Page title="대시보드 예제" intro="서버 성능 비교 화면 모양으로 꾸민 예제입니다. 열 그룹·요약 행·셀 안 막대가 있는 비교 표, 필터, 지표 카드, 차트, 수천 행 표. 이름과 숫자는 모두 지어낸 것입니다.">
      <div className="dash" data-demo="dashboard">
        <div className="dash__top">
          <Text variant="headline" as="span">서버 성능</Text>
          <Tabs aria-label="서버 종류" items={[{ value: 'web', label: '웹 서버' }, { value: 'db', label: '데이터베이스' }]} value={top} onChange={setTop} className="dash__toptabs" />
          <Text variant="footnote" tone="secondary" as="span" className="dash__stamp">11-17 16:06 갱신</Text>
        </div>
        <Tabs aria-label="보기" value={view} onChange={setView} panelClassName="dash__panel" items={[
          { value: 'profile', label: '프로필', content: <Profile onCompare={(n) => toast({ title: `${n}개 설정 비교` })} /> },
          { value: 'status', label: '측정 현황', badge: 3, content: <Status /> },
          { value: 'calls', label: '요청 기록', content: <Calls /> },
        ]} />
      </div>
    </Page>
  );
}

function Profile({ onCompare }: { onCompare: (n: number) => void }) {
  const [level, setLevel] = useState('all'), [lang, setLang] = useState('all'), [round, setRound] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [banner, setBanner] = useState(true);
  const rows = useMemo(() => ROWS.filter((r) => !q || r.model.toLowerCase().includes(q.toLowerCase()) || r.vendor.toLowerCase().includes(q.toLowerCase())), [q]);
  const score = (k: SetKey): Column<Row> => {
    const s = SETS.find((x) => x.key === k)!;
    return {
      key: k, header: s.label, subheader: s.sub, group: s.group, description: s.desc, align: 'end', width: 112, sortable: true, firstSort: 'desc',
      render: (r, { pinned }) => {
        const v = r[k];
        if (v === null) return null;
        if (pinned) return v;
        return <span className="gl-cell-bar"><BarMeter value={v} width={36} />{<span className={v === BEST[k] ? 'gl-cell-best' : undefined}>{v}</span>}</span>;
      },
    };
  };
  const cols: Column<Row>[] = [
    {
      key: 'model', header: '서버', width: 230, sticky: true, sortable: true,
      render: (r, { pinned }) => pinned ? <span className="dash__summary">{r.model}</span> : (
        <span className="dash__model"><span className="dash__logo" aria-hidden="true">{r.model[0]}</span><a href={`#/dashboard?model=${encodeURIComponent(r.id)}`} onClick={(e) => e.preventDefault()}>{r.model}</a>
          {r.runs === 1 && <Tooltip content="1회차만 측정했어요. 값이 흔들릴 수 있어요."><Tag variant="text" tone="warning" tabIndex={0}>1회 측정</Tag></Tooltip>}</span>
      ),
    },
    { key: 'boost', header: '부스트', width: 92, sortable: true, value: (r) => LEVEL[r.boost], render: (r, { pinned }) => pinned ? <span /> : <Tag icon={r.boost === '없음' ? undefined : <Level value={LEVEL[r.boost] - (r.boost === '끔' ? 1 : 0)} />}>{r.boost === '없음' ? '설정 없음' : r.boost}</Tag> },
    ...SETS.map((s) => score(s.key)),
    { key: 'cost', header: '비용', subheader: '1K 요청당', group: '비용과 속도', align: 'end', width: 92, sortable: true, description: '요청 1,000개를 처리할 때 드는 비용(달러).', render: (r) => <span className={r.cost === BEST.cost ? 'gl-cell-best' : undefined}>{fmtCost(r.cost)}</span> },
    { key: 'time', header: '시간', subheader: '중앙값', group: '비용과 속도', align: 'end', width: 84, sortable: true, render: (r) => `${r.time.toFixed(1)} s` },
    { key: 'err', header: '오류', subheader: '요청 대비', group: '비용과 속도', align: 'end', width: 84, sortable: true, description: '응답을 받지 못한 요청의 비율.', render: (r) => <span className={r.err >= 2.5 ? 'gl-cell-warn' : undefined}>{r.err.toFixed(1)}%</span> },
  ];
  return (
    <Stack gap={4}>
      {banner && <Banner tone="info" title="3회차 측정이 진행 중이에요" onDismiss={() => setBanner(false)} dismissLabel="알림 닫기">끝나면 값이 조금 바뀔 수 있어요. 회차 필터로 끝난 회차만 볼 수 있어요.</Banner>}
      <Card style={{ padding: 20 }}>
        <div className="dash__filters">
          <Select variant="filter" label="부하" value={level} onChange={setLevel} options={[{ value: 'all', label: '전체' }, { value: 'easy', label: '가벼움' }, { value: 'mid', label: '보통' }, { value: 'hard', label: '무거움' }]} />
          <Select variant="filter" label="지역" value={lang} onChange={setLang} options={[{ value: 'all', label: '전체' }, { value: 'en', label: '도쿄' }, { value: 'ko', label: '서울' }]} />
          <Select variant="filter" label="회차" value={round} onChange={setRound} options={[{ value: 'all', label: '전체' }, { value: '1', label: '1회차' }, { value: '2', label: '2회차' }, { value: '3', label: '3회차' }]} />
          <SearchField aria-label="서버 찾기" placeholder="서버 찾기" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ width: 220 }} />
          <span className="dash__spacer" />
          {sel.length > 0 && <Button size="sm" onClick={() => onCompare(sel.length)}>{sel.length}개 비교</Button>}
          <Text variant="footnote" tone="secondary" as="span">설정 {rows.length}개</Text>
        </div>
        <DataTable<Row> aria-label="서버 프로필" rows={rows} columns={cols} rowKey={(r) => r.id} pinnedRows={rows.length ? PINNED : []}
          selectable selected={sel} onSelectedChange={setSel} sort={sort} onSortChange={setSort} maxHeight={560}
          rowState={(r) => (r.runs === 1 ? { muted: false } : undefined)}
          labels={{ selectAll: '모든 설정 선택', selectRow: (r) => `${r.model} ${r.boost} 선택`, sortedAsc: '오름차순 정렬', sortedDesc: '내림차순 정렬' }}
          empty={<EmptyState compact icon={<FileSearch />} title="찾는 서버가 없어요" description={`"${q}"와 맞는 서버나 회사가 없어요.`} actions={<Button size="sm" variant="neutral" onClick={() => setQ('')}>검색 지우기</Button>} />} />
        <Text variant="footnote" tone="secondary" as="p" style={{ marginTop: 10 }}><b>굵은 값</b> 가장 좋은 값 · <span className="gl-cell-warn">주황 값</span> 오류율 2.5% 이상</Text>
      </Card>
    </Stack>
  );
}

function Status() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 900); return () => clearTimeout(t); }, []);
  const ranked = useMemo(() => [...ROWS].sort((a, b) => (b.mix ?? 0) - (a.mix ?? 0)).slice(0, 8), []);
  return (
    <Stack gap={4}>
      <div className="grid grid--4 dash__kpis">
        <Stat label="측정한 설정·시험 쌍" icon={<Gauge />} value="161" delta="+14" hint="지난주보다" trend={[120, 128, 131, 140, 147, 152, 161]} loading={loading} words={{ up: '증가', down: '감소' }} />
        <Stat label="빠진 응답" icon={<Activity />} value="0" delta="-12" hint="지난주보다" invert trend={[18, 15, 12, 9, 4, 2, 0]} loading={loading} words={{ up: '증가', down: '감소' }} />
        <Stat label="1K 요청당 비용(중앙값)" icon={<CircleDollarSign />} value="$1.39" delta="+8.2%" hint="지난주보다" invert trend={[1.1, 1.2, 1.18, 1.25, 1.3, 1.36, 1.39]} loading={loading} words={{ up: '증가', down: '감소' }} />
        <Stat label="끝난 실행" icon={<CheckCircle2 />} value="42 / 42" hint="모든 회차" loading={loading} />
      </div>
      <div className="grid grid--2">
        <Card style={{ padding: 20 }}>
          <Text variant="headline" as="h3" style={{ marginBottom: 12 }}>하루 처리량</Text>
          <LineChart aria-label="하루 처리량: 받은 요청과 처리한 요청" data={TRAFFIC} x="d" series={[{ key: 'answers', label: '받은 요청' }, { key: 'graded', label: '처리한 요청' }]} area height={220} locale="ko-KR" />
        </Card>
        <Card style={{ padding: 20 }}>
          <Text variant="headline" as="h3" style={{ marginBottom: 12 }}>시험별 비용 (달러)</Text>
          <BarChart aria-label="시험별 비용: 부스트 끔과 높음" data={COSTS} x="set" series={[{ key: 'off', label: '부스트 끔' }, { key: 'high', label: '부스트 높음' }]} stacked height={220} locale="ko-KR" />
        </Card>
      </div>
      <div className="grid grid--2">
        <Card style={{ padding: 20 }}>
          <Text variant="headline" as="h3" style={{ marginBottom: 12 }}>응답의 구성</Text>
          <DonutChart aria-label="응답의 구성" locale="ko-KR" centerLabel="전체 응답" data={[{ label: '성공', value: 7120 }, { label: '실패', value: 2210 }, { label: '느림', value: 280 }, { label: '응답 없음', value: 95 }]} />
        </Card>
        <Card style={{ padding: 20 }}>
          <Text variant="headline" as="h3" style={{ marginBottom: 12 }}>혼합 부하 순위</Text>
          <DataTable<Row> aria-label="혼합 부하 순위" density="compact" rows={ranked} rowKey={(r) => r.id} columns={[
            { key: 'rank', header: '#', width: 36, render: (r) => ranked.indexOf(r) + 1 },
            { key: 'model', header: '서버', width: 150 },
            { key: 'mix', header: '처리율과 95% 구간', description: '점은 처리율, 막대는 95% 신뢰 구간, 세로선은 기준 중앙값.', width: 220, render: (r) => <span className="gl-cell-bar"><b style={{ width: 28 }}>{r.mix}</b><IntervalPlot value={r.mix ?? 0} low={(r.mix ?? 0) - 3 - (r.id.length % 3)} high={Math.min(100, (r.mix ?? 0) + 2 + (r.id.length % 2))} min={60} max={100} reference={PINNED[1].mix ?? 0} width={150} /></span> },
          ]} />
        </Card>
      </div>
      <Accordion items={[
        { value: 'trace', title: '추적 정보', meta: '실행 42개', content: <Text variant="subhead" tone="secondary" as="p">측정 실행 9번, 설정 24개, 응답 9,705개. 집계는 2026-11-17 16:02에 끝났어요.</Text> },
        { value: 'method', title: '측정 방법', content: <Text variant="subhead" tone="secondary" as="p">시험마다 같은 요청을 3번 보내고, 처리율은 세 회차의 평균이에요.</Text> },
      ]} />
    </Stack>
  );
}

function Calls() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'time', dir: 'desc' });
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Call[]>([]);
  const PAGE = 25;
  /* "server": sorts and pages after a short delay */
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const s = [...CALLS];
      if (sort) s.sort((a, b) => { const x = a[sort.key as keyof Call], y = b[sort.key as keyof Call]; const c = typeof x === 'number' ? (x as number) - (y as number) : String(x).localeCompare(String(y)); return sort.dir === 'asc' ? c : -c; });
      setRows(s.slice((page - 1) * PAGE, page * PAGE)); setLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, [page, sort]);
  const cols: Column<Call>[] = [
    { key: 'time', header: '시각', width: 140, sortable: true, firstSort: 'desc' },
    { key: 'model', header: '설정', width: 200, sortable: true },
    { key: 'set', header: '시험', width: 120, sortable: true },
    { key: 'ms', header: '응답', subheader: 'ms', align: 'end', width: 96, sortable: true, firstSort: 'desc', render: (r) => <span className={r.ms > 8000 ? 'gl-cell-warn' : undefined}>{r.ms.toLocaleString('ko-KR')}</span> },
    { key: 'kb', header: '본문 크기', align: 'end', width: 100, sortable: true, render: (r) => r.kb.toLocaleString('ko-KR') },
    { key: 'ok', header: '결과', width: 90, render: (r) => (r.ok ? <Tag tone="success">성공</Tag> : <Tag tone="danger">실패</Tag>) },
  ];
  return (
    <Stack gap={4}>
      <Section title="서버 모드 (정렬·페이지는 서버가)" intro="정렬하거나 페이지를 넘기면 표는 알리기만 하고, 받은 행을 보여 줍니다. 받는 동안은 행이 흐려지고 위에 진행선이 지나갑니다.">
        <Card style={{ padding: 20 }}>
          <DataTable<Call> aria-label="요청 기록 (서버)" rows={rows} columns={cols} rowKey={(r) => r.id} manualSort sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }} loading={loading} rowCount={CALLS.length} density="compact" />
          <div className="dash__pager"><Text variant="footnote" tone="secondary" as="span">{CALLS.length.toLocaleString('ko-KR')}개 중 {((page - 1) * PAGE + 1).toLocaleString('ko-KR')}–{Math.min(page * PAGE, CALLS.length).toLocaleString('ko-KR')}</Text>
            <Pagination page={page} pageCount={Math.ceil(CALLS.length / PAGE)} onChange={setPage} aria-label="요청 기록 페이지" labels={{ previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` }} /></div>
        </Card>
      </Section>
      <Section title="5,000행 한 번에 (가상 스크롤)" intro="화면에 보이는 행만 그립니다. 머리글과 첫 열이 고정되고, 키보드로 끝까지 이동해도 해당 행을 그려서 포커스를 옮깁니다.">
        <Card style={{ padding: 20 }}>
          <DataTable<Call> aria-label="요청 기록 5,000행" rows={CALLS} columns={cols.map((c, i) => (i === 0 ? { ...c, sticky: true } : c))} rowKey={(r) => r.id} defaultSort={{ key: 'time', dir: 'desc' }} density="compact" maxHeight={420} selectable labels={{ selectAll: '모든 요청 선택', selectRow: (r) => `${r.time} 요청 선택` }} />
        </Card>
      </Section>
    </Stack>
  );
}
