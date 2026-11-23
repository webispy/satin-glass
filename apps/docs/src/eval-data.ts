/* Made-up data for the model evaluation example: fictional vendors and models, benchmark families with scores,
   95% confidence intervals and sample sizes, prices and speeds. Nothing here is a real model, vendor or result; the numbers
   come from a seeded generator so every load shows the same page.
   Built once per language from the same seed: the numbers, ids and order are the same in both, only the words
   differ. The page reads it through useEvalData(). */
import { useLang, type Lang } from './i18n';

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

/* names come in [en, ko] pairs */
const VENDOR_NAMES: [key: string, en: string, ko: string][] = [
  ['northlight', 'Northlight', '노스라이트'], ['harbor', 'Harbour', '하버'], ['mist', 'Mist', '미스트'],
  ['quill', 'Quill', '퀼'], ['orbit', 'Orbit', '오르빗'], ['cedar', 'Cedar', '시더'],
];
/** a vendor's colour: the chart colour the scatter gives it, so every view marks a vendor the same way */
export const vendorColor = (k: string) => `var(--sg-chart-${(Math.max(0, VENDOR_NAMES.findIndex(([key]) => key === k)) % 6) + 1})`;

const FAMILY_NAMES: [key: string, en: string, ko: string][] = [
  ['knowledge', 'Knowledge', '지식'], ['reasoning', 'Reasoning', '추론'], ['coding', 'Coding', '코딩'],
  ['instruct', 'Instructions', '지시 따르기'], ['korean', 'Korean', '한국어'],
];
const BENCHMARK_DEFS: { key: string; family: string; chance?: number; label: [string, string]; note: [string, string] }[] = [
  { key: 'gen', family: 'knowledge', chance: 25, label: ['General', '일반 지식'],
    note: ['1,200 multiple-choice questions across many fields. With 4 options, guessing scores 25.', '여러 분야 객관식 1,200문항이에요. 보기가 4개라 찍으면 25점이에요.'] },
  { key: 'pro', family: 'knowledge', chance: 25, label: ['Expert', '전문 지식'],
    note: ['450 graduate-level science questions. With 4 options, guessing scores 25.', '대학원 수준 과학 문제 450개예요. 보기가 4개라 찍으면 25점이에요.'] },
  { key: 'math', family: 'reasoning', label: ['Maths', '수학'],
    note: ['60 competition-style problems. The answer is written out, so guessing scores nothing.', '경시대회형 문제 60개예요. 답을 직접 써야 해서 찍기 점수가 없어요.'] },
  { key: 'logic', family: 'reasoning', label: ['Logic', '논리'],
    note: ['800 reasoning problems that take several steps.', '여러 단계를 거쳐야 하는 추론 문제 800개예요.'] },
  { key: 'func', family: 'coding', label: ['Functions', '함수 작성'],
    note: ['The share of functions, written from a description, that pass hidden tests.', '설명을 보고 작성한 함수가 비공개 테스트를 통과한 비율이에요.'] },
  { key: 'fix', family: 'coding', label: ['Bug fixes', '버그 수정'],
    note: ['The share of bugs in repository-sized code fixed so that their failing tests pass.', '저장소 규모의 코드에서 버그를 고쳐 실패하던 테스트를 통과시킨 비율이에요.'] },
  { key: 'format', family: 'instruct', label: ['Formatting', '형식 지키기'],
    note: ['The share of answers that follow every verifiable instruction: length, format, banned words.', '길이·형식·금지어처럼 확인할 수 있는 지시를 모두 지킨 비율이에요.'] },
  { key: 'long', family: 'instruct', label: ['Long prompts', '긴 지시'],
    note: ['The share of conversations that follow a system prompt of over 3,000 characters to the end.', '3,000자가 넘는 시스템 프롬프트를 대화 끝까지 따른 비율이에요.'] },
  { key: 'read', family: 'korean', chance: 20, label: ['Reading', '독해'],
    note: ['Korean reading comprehension, multiple choice. With 5 options, guessing scores 20.', '한국어 지문 독해 객관식이에요. 보기가 5개라 찍으면 20점이에요.'] },
  { key: 'write', family: 'korean', label: ['Writing', '작문'],
    note: ['Korean writing, scored against a rubric (0–100).', '한국어 글쓰기를 채점 기준표로 평가한 점수(0–100)예요.'] },
];
/** every benchmark's key, in order (the same in both languages) */
export const BENCHMARK_KEYS = BENCHMARK_DEFS.map((b) => b.key);

/* a small seeded generator (mulberry32) */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
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

function build(lang: Lang) {
  const ko = lang === 'ko', L = (en: string, k: string) => (ko ? k : en);
  /* a fresh generator per language: the same draws in the same order, so the numbers match */
  const r = rng(20261122);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const VENDORS = VENDOR_NAMES.map(([key, en, k]) => ({ key, label: L(en, k) }));
  const vendorLabel = (k: string) => VENDORS.find((v) => v.key === k)?.label ?? k;
  const EFFORT_WORD = ko ? ['없음', '낮음', '중간', '높음'] : ['None', 'Low', 'Medium', 'High'];
  const DEPLOY_WORD: Record<Deploy, string> = { hosted: L('Hosted', '호스팅'), local: L('Local', '로컬') };
  const FAMILIES = FAMILY_NAMES.map(([key, en, k]) => ({ key, label: L(en, k) }));
  const BENCHMARKS: Benchmark[] = BENCHMARK_DEFS.map(({ key, family, chance, label, note }) => (
    { key, label: L(...label), family, note: L(...note), ...(chance !== undefined ? { chance } : {}) }));
  const EFFORT_SETTING = ko ? ['추론 없음', '추론 낮음', '추론 중간', '추론 높음'] : ['no reasoning', 'reasoning low', 'reasoning medium', 'reasoning high'];

  const MODELS: Model[] = LINES.flatMap((line) => line.sizes.map((size, si) => {
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
        config: `temperature 0 · ${EFFORT_SETTING[effort]} · ${L('max output', '최대 출력')} ${pick(['4K', '8K', '16K'])}`,
        date: `2026-11-${String(3 + Math.floor(r() * 15)).padStart(2, '0')}`,
        missing: missing.length ? `${missing.join(', ')}: ${L('not measured; longer than the local runtime’s context window.', '로컬 실행 환경의 컨텍스트 한도를 넘어 측정하지 못했어요.')}` : undefined,
      },
    } satisfies Model;
  }));

  return { lang, VENDORS, vendorLabel, EFFORT_WORD, DEPLOY_WORD, FAMILIES, BENCHMARKS, MODELS };
}

export type EvalData = ReturnType<typeof build>;
const cache: Partial<Record<Lang, EvalData>> = {};
export const evalDataFor = (lang: Lang): EvalData => (cache[lang] ??= build(lang));
/** The evaluation data in the reader's language. */
export const useEvalData = () => evalDataFor(useLang());

/** mean of a model's scores over the given benchmarks (missing ones left out); null when it has none */
export function overall(m: Model, keys: string[]): number | null {
  const xs = keys.map((k) => m.scores[k]?.v).filter((v): v is number => v !== undefined);
  return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null;
}
/** how many benchmarks a model has results for */
export const measured = (m: Model) => Object.values(m.scores).filter(Boolean).length;
/** smallest sample among a model's results */
export const minSample = (m: Model) => Math.min(...Object.values(m.scores).filter((s): s is NonNullable<Score> => !!s).map((s) => s.n));
export const usd = (v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(v < 10 ? 1 : 0)}`);
