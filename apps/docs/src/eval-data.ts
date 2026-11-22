/* Made-up data for the model evaluation example: fictional vendors and models, benchmark families with scores,
   95 % intervals and sample sizes, prices and speeds. Nothing here is a real model, vendor or result; the numbers
   come from a seeded generator so every load shows the same page. */

export type Deploy = 'hosted' | 'local';
export type Effort = 0 | 1 | 2 | 3;   /* reasoning: none · low · medium · high */
export type Score = { v: number; lo: number; hi: number; n: number } | null;
export type Model = {
  id: string; name: string; vendor: string; deploy: Deploy; effort: Effort; single: boolean;
  /** USD per million tokens (input and output blended) */
  price: number;
  /** output tokens per second */
  speed: number;
  /** context window, thousands of tokens */
  context: number;
  released: string;
  scores: Record<string, Score>;
  trace: { run: string; config: string; date: string; missing?: string };
};
export type Benchmark = { key: string; label: string; family: string; note: string; chance?: number };

export const VENDORS = [
  { key: 'northlight', label: '노스라이트' }, { key: 'harbor', label: '하버' }, { key: 'mist', label: '미스트' },
  { key: 'quill', label: '퀼' }, { key: 'orbit', label: '오르빗' }, { key: 'cedar', label: '시더' },
];
export const vendorLabel = (k: string) => VENDORS.find((v) => v.key === k)?.label ?? k;
/** a vendor's colour: the chart colour the scatter gives it, so every view marks a vendor the same way */
export const vendorColor = (k: string) => `var(--sg-chart-${(Math.max(0, VENDORS.findIndex((v) => v.key === k)) % 6) + 1})`;
export const EFFORT_WORD = ['없음', '낮음', '중간', '높음'];
export const DEPLOY_WORD = { hosted: '호스팅', local: '로컬' } as const;

export const FAMILIES = [
  { key: 'knowledge', label: '지식' }, { key: 'reasoning', label: '추론' }, { key: 'coding', label: '코딩' },
  { key: 'instruct', label: '지시 따르기' }, { key: 'korean', label: '한국어' },
];
export const BENCHMARKS: Benchmark[] = [
  { key: 'gen', label: '일반 지식', family: 'knowledge', note: '여러 분야 객관식 1,200문항이에요. 보기가 4개라 찍으면 25점이에요.', chance: 25 },
  { key: 'pro', label: '전문 지식', family: 'knowledge', note: '대학원 수준 과학 문제 450문항이에요. 보기가 4개라 찍으면 25점이에요.', chance: 25 },
  { key: 'math', label: '수학', family: 'reasoning', note: '경시대회형 문제 60문항이에요. 답을 직접 써야 해서 찍기 점수가 없어요.' },
  { key: 'logic', label: '논리', family: 'reasoning', note: '여러 단계를 거쳐야 하는 추론 문제 800문항이에요.' },
  { key: 'func', label: '함수 작성', family: 'coding', note: '설명을 읽고 짠 함수가 숨은 테스트를 통과한 비율이에요.' },
  { key: 'fix', label: '버그 수정', family: 'coding', note: '실제 저장소 규모의 코드에서 버그를 고쳐 실패하던 테스트를 통과시킨 비율이에요.' },
  { key: 'format', label: '형식 지키기', family: 'instruct', note: '길이·형식·금지어처럼 확인할 수 있는 지시를 모두 지킨 비율이에요.' },
  { key: 'long', label: '긴 지시', family: 'instruct', note: '3천 자가 넘는 시스템 지시를 대화 끝까지 지킨 비율이에요.' },
  { key: 'read', label: '독해', family: 'korean', note: '한국어 지문 독해 객관식이에요. 보기가 5개라 찍으면 20점이에요.', chance: 20 },
  { key: 'write', label: '작문', family: 'korean', note: '한국어 글쓰기를 채점 기준표로 평가한 점수(0–100)예요.' },
];

/* a small seeded generator (mulberry32) */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r = rng(20261122);
const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* fictional model lines: a vendor, a strength (0–1), a price level, and the sizes in the line */
const LINES: { vendor: string; name: string; skill: number; price: number; local?: boolean; sizes: string[] }[] = [
  { vendor: 'northlight', name: 'Kestrel', skill: 0.9, price: 9, sizes: ['4', '4 mini', '3.5'] },
  { vendor: 'northlight', name: 'Wren', skill: 0.62, price: 0.5, sizes: ['2', '2 nano'] },
  { vendor: 'harbor', name: 'Tide', skill: 0.86, price: 6, sizes: ['Pro', 'Plus', 'Lite'] },
  { vendor: 'harbor', name: 'Ferry', skill: 0.55, price: 0.3, local: true, sizes: ['8B', '3B'] },
  { vendor: 'mist', name: 'Nimbus', skill: 0.8, price: 3.5, sizes: ['2 Ultra', '2', '2 Flash'] },
  { vendor: 'mist', name: 'Drizzle', skill: 0.5, price: 0.2, local: true, sizes: ['7B', '2B'] },
  { vendor: 'quill', name: 'Script', skill: 0.74, price: 2.2, sizes: ['X', 'M', 'S'] },
  { vendor: 'orbit', name: 'Apogee', skill: 0.83, price: 4.8, sizes: ['3', '3 Fast'] },
  { vendor: 'orbit', name: 'Perigee', skill: 0.58, price: 0.4, local: true, sizes: ['14B', '7B'] },
  { vendor: 'cedar', name: 'Grove', skill: 0.68, price: 1.1, sizes: ['Large', 'Medium', 'Small'] },
  { vendor: 'cedar', name: 'Sapling', skill: 0.45, price: 0.12, local: true, sizes: ['3B', '1B'] },
];
/* how hard each benchmark is (a strong model's typical score) */
const CEIL: Record<string, number> = { gen: 88, pro: 70, math: 72, logic: 80, func: 86, fix: 52, format: 90, long: 78, read: 90, write: 84 };

export const MODELS: Model[] = LINES.flatMap((line) => line.sizes.map((size, si) => {
  const skill = clamp(line.skill - si * 0.11 + (r() - 0.5) * 0.06, 0.2, 0.98);
  const effort = (line.skill > 0.8 && si === 0 ? 3 : line.skill > 0.7 && si < 2 ? pick([1, 2] as Effort[]) : 0) as Effort;
  const single = r() < 0.18;
  const scores: Record<string, Score> = {};
  for (const b of BENCHMARKS) {
    /* some local models were never run on the long-context and repository benchmarks */
    if (line.local && (b.key === 'long' || b.key === 'fix') && r() < 0.6) { scores[b.key] = null; continue; }
    const base = b.chance ?? 0;
    const lift = effort && b.family === 'reasoning' ? 6 + effort * 3 : 0;
    const v = clamp(base + (CEIL[b.key] - base) * Math.pow(skill, 1.35) + lift + (r() - 0.5) * 8, base * 0.8, 98);
    const n = single ? Math.round(30 + r() * 40) : Math.round(200 + r() * 900);
    const half = 1.96 * Math.sqrt((v / 100) * (1 - v / 100) / n) * 100;
    scores[b.key] = { v: +v.toFixed(1), lo: +Math.max(0, v - half).toFixed(1), hi: +Math.min(100, v + half).toFixed(1), n };
  }
  const price = +(line.price * Math.pow(0.42, si) * (0.85 + r() * 0.3) * (effort === 3 ? 1.6 : 1)).toPrecision(2);
  const name = `${line.name} ${size}`;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const missing = Object.entries(scores).filter(([, s]) => !s).map(([k]) => BENCHMARKS.find((b) => b.key === k)!.label);
  return {
    id, name, vendor: line.vendor, deploy: line.local ? 'local' : 'hosted', effort, single, price,
    speed: Math.round((line.local ? 40 : 60) + (1 - skill) * 180 + r() * 40 - effort * 12),
    context: pick([32, 128, 128, 200, 256, 1000]),
    released: `2026-${String(1 + Math.floor(r() * 10)).padStart(2, '0')}`,
    scores,
    trace: {
      run: `run-${(0x10000 + Math.floor(r() * 0xeffff)).toString(16)}`,
      config: `temperature 0 · ${effort ? ['', '추론 낮음', '추론 중간', '추론 높음'][effort] : '추론 없음'} · 최대 출력 ${pick(['4K', '8K', '16K'])}`,
      date: `2026-11-${String(3 + Math.floor(r() * 15)).padStart(2, '0')}`,
      missing: missing.length ? `${missing.join(', ')}: 로컬 실행 환경에서 컨텍스트가 모자라 측정하지 못했어요.` : undefined,
    },
  } satisfies Model;
}));

/** mean of a model's scores over the given benchmarks (missing ones left out); null when it has none */
export function overall(m: Model, keys: string[]): number | null {
  const xs = keys.map((k) => m.scores[k]?.v).filter((v): v is number => v !== undefined);
  return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null;
}
/** smallest sample among a model's results */
/** how many benchmarks a model has results for */
export const measured = (m: Model) => Object.values(m.scores).filter(Boolean).length;
export const minSample = (m: Model) => Math.min(...Object.values(m.scores).filter((s): s is NonNullable<Score> => !!s).map((s) => s.n));
export const usd = (v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(v < 10 ? 1 : 0)}`);
