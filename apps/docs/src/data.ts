/* Made-up data for the data pages and the dashboard example: a small online shop (products, orders, visits).
   Seeded, so every load (and every test run) sees the same numbers. No real shops, people or products. */

const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = rand(11);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)];
const round = (v: number, step = 1) => Math.round(v / step) * step;

export const CATEGORIES = [
  { key: 'wear', label: '의류' },
  { key: 'home', label: '생활' },
  { key: 'kitchen', label: '주방' },
  { key: 'paper', label: '문구' },
  { key: 'digital', label: '디지털' },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]['key'];
export const categoryLabel = (k: CategoryKey) => CATEGORIES.find((c) => c.key === k)!.label;

export type Product = {
  id: string; name: string; category: CategoryKey; price: number; stock: number;
  /** units sold in the last 30 days */
  sold: number; revenue: number;
  /** average rating out of 5, and how many reviews it rests on */
  rating: number; reviews: number;
  returnRate: number;
  /** days until the stock runs out at the current pace (null: not selling) */
  daysLeft: number | null;
  /** weekly units, 12 weeks */
  trend: number[];
  paused: boolean;
};

const NAMES: [string, CategoryKey, number][] = [
  ['리넨 오버셔츠', 'wear', 59000], ['코튼 반팔 티셔츠', 'wear', 19000], ['울 니트 카디건', 'wear', 89000], ['데님 와이드 팬츠', 'wear', 69000], ['라운드 양말 3켤레', 'wear', 9900],
  ['세라믹 머그 2개', 'kitchen', 24000], ['원목 도마', 'kitchen', 32000], ['유리 밀폐 용기 세트', 'kitchen', 41000], ['핸드드립 주전자', 'kitchen', 54000],
  ['면 수건 5장', 'home', 29000], ['향초 (무화과)', 'home', 22000], ['리넨 쿠션 커버', 'home', 18000], ['접이식 수납 박스', 'home', 15000], ['디퓨저 리필', 'home', 16000],
  ['도트 노트 A5', 'paper', 8000], ['젤 펜 6색', 'paper', 7500], ['가죽 펜 케이스', 'paper', 26000], ['탁상 달력 2027', 'paper', 12000],
  ['무선 충전 패드', 'digital', 35000], ['케이블 정리 키트', 'digital', 11000], ['노트북 파우치 14"', 'digital', 39000], ['블루투스 스피커 미니', 'digital', 79000], ['스마트폰 거치대', 'digital', 14000], ['USB-C 허브 6in1', 'digital', 49000],
];

export const PRODUCTS: Product[] = NAMES.map(([name, category, price], i) => {
  const pace = price < 20000 ? 260 : price < 50000 ? 140 : 70;
  const sold = round(pace * (0.35 + R() * 1.3));
  const paused = i === 12 || i === 21;
  const stock = paused ? 0 : round(sold * (0.15 + R() * 1.6));
  const trend = Array.from({ length: 12 }, (_, w) => Math.max(0, round((sold / 4.3) * (0.7 + w * 0.03 + (R() - 0.5) * 0.5))));
  return {
    id: `p${i + 1}`, name, category, price, stock, sold: paused ? 0 : sold, revenue: paused ? 0 : sold * price,
    rating: +(3.6 + R() * 1.35).toFixed(1), reviews: round(4 + R() * 380), returnRate: +(R() * (category === 'wear' ? 9 : 4)).toFixed(1),
    daysLeft: paused ? null : Math.round((stock / sold) * 30), trend, paused,
  };
});

/* ---------------------------------------------------------------- orders */
export type OrderStatus = 'paid' | 'shipping' | 'delivered' | 'cancelled' | 'refunded';
export const STATUS: Record<OrderStatus, { label: string; tone: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger' }> = {
  paid: { label: '결제 완료', tone: 'accent' },
  shipping: { label: '배송 중', tone: 'info' },
  delivered: { label: '배송 완료', tone: 'success' },
  cancelled: { label: '취소', tone: 'neutral' },
  refunded: { label: '환불', tone: 'warning' },
};
export const CHANNELS = ['웹', '앱', '매장'] as const;
export type Channel = (typeof CHANNELS)[number];
export type Order = { id: string; time: string; at: number; customer: string; product: string; qty: number; amount: number; channel: Channel; status: OrderStatus };

const FAMILY = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
const GIVEN = ['하린', '도윤', '서연', '지호', '민준', '수아', '예준', '지안', '하준', '윤서', '시우', '채원', '주원', '다은', '건우', '서진'];
const START = new Date(2026, 10, 18, 18, 0).getTime();
export const ORDERS: Order[] = Array.from({ length: 5000 }, (_, i) => {
  const p = pick(PRODUCTS.filter((x) => !x.paused)), qty = R() < 0.8 ? 1 : R() < 0.7 ? 2 : 3;
  const at = START - i * 7 * 60_000 - Math.floor(R() * 6 * 60_000);
  const d = new Date(at), age = i / 5000;
  const r = R();
  const status: OrderStatus = r < 0.04 ? 'cancelled' : r < 0.07 ? 'refunded' : age < 0.02 ? 'paid' : age < 0.06 ? (r < 0.5 ? 'paid' : 'shipping') : age < 0.12 ? 'shipping' : 'delivered';
  return {
    id: `${100480 - i}`, at,
    time: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    customer: `${pick(FAMILY)}${pick(GIVEN)}`, product: p.name, qty, amount: p.price * qty,
    channel: R() < 0.48 ? '앱' : R() < 0.8 ? '웹' : '매장', status,
  };
});

/* ---------------------------------------------------------------- days and months */
export const DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 9, 20 + i), weekend = d.getDay() === 0 || d.getDay() === 6;
  const visits = round(4200 + i * 75 + (weekend ? 1300 : 0) + (R() - 0.5) * 500);
  const orders = round(visits * (0.027 + i * 0.00015 + R() * 0.004));
  return { day: `${d.getMonth() + 1}/${d.getDate()}`, visits, returning: round(visits * (0.34 + i * 0.002 + (R() - 0.5) * 0.05)), orders, revenue: orders * round(38000 + R() * 9000, 100) };
});
export const MONTHS = ['6월', '7월', '8월', '9월', '10월', '11월'].map((m, i) => ({
  month: m, web: round(3800 + i * 210 + R() * 500, 10), app: round(4200 + i * 420 + R() * 600, 10), store: round(1600 + R() * 400, 10),
}));
export const CATEGORY_SHARE = CATEGORIES.map((c) => ({ label: c.label, value: PRODUCTS.filter((p) => p.category === c.key).reduce((a, p) => a + p.revenue, 0) }));

/* ---------------------------------------------------------------- delivery (for interval plots) */
export const REGIONS = ['수도권', '강원', '충청', '전라', '경상', '제주'].map((name, i) => {
  const mean = +(1.2 + i * 0.25 + R() * 0.5 + (name === '제주' ? 1.2 : 0)).toFixed(1);
  return { name, mean, low: +(mean - 0.4 - R() * 0.3).toFixed(1), high: +(mean + 0.5 + R() * (name === '제주' ? 1.4 : 0.6)).toFixed(1) };
});

export const won = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
/** 1,234,000 → "123만", 123,400,000 → "1.2억" */
export const wonShort = (v: number) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString('ko-KR')}만` : v.toLocaleString('ko-KR'));
export const num = (v: number) => v.toLocaleString('ko-KR');
