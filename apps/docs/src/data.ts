/* Made-up data for the data pages and the dashboard example: a small online shop (products, orders, visits).
   Seeded, so every load (and every test run) sees the same numbers. No real shops, people or products.
   Built once per language from the same seed: the numbers, ids and order are the same in both, only the names and
   the formats differ. Pages read it through useData(); the bare exports below are the Korean set, for pages not yet
   moved to useData(). */
import { useLang, type Lang } from './i18n';

const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const round = (v: number, step = 1) => Math.round(v / step) * step;

export type CategoryKey = 'wear' | 'home' | 'kitchen' | 'paper' | 'digital';
const CATEGORY_NAMES: Record<CategoryKey, [string, string]> = {
  wear: ['Clothing', '의류'], home: ['Home', '생활'], kitchen: ['Kitchen', '주방'], paper: ['Stationery', '문구'], digital: ['Digital', '디지털'],
};

export type Product = {
  id: string; name: string; category: CategoryKey; price: number; stock: number;
  /** units sold in the last 30 days */
  sold: number; revenue: number;
  /** average rating out of 5, and the number of reviews it is based on */
  rating: number; reviews: number;
  returnRate: number;
  /** days until the stock runs out at the current pace (null: not selling) */
  daysLeft: number | null;
  /** weekly units, 12 weeks */
  trend: number[];
  paused: boolean;
};

const NAMES: [string, string, CategoryKey, number][] = [
  ['Linen overshirt', '리넨 오버셔츠', 'wear', 59000], ['Cotton T-shirt', '코튼 반팔 티셔츠', 'wear', 19000], ['Wool knit cardigan', '울 니트 카디건', 'wear', 89000], ['Wide denim trousers', '데님 와이드 팬츠', 'wear', 69000], ['Crew socks, 3 pairs', '중목 양말 3켤레', 'wear', 9900],
  ['Ceramic mugs, 2', '세라믹 머그 2개', 'kitchen', 24000], ['Wooden chopping board', '원목 도마', 'kitchen', 32000], ['Glass container set', '유리 밀폐 용기 세트', 'kitchen', 41000], ['Pour-over kettle', '핸드드립 주전자', 'kitchen', 54000],
  ['Cotton towels, 5', '면 수건 5장', 'home', 29000], ['Candle (fig)', '향초 (무화과)', 'home', 22000], ['Linen cushion cover', '리넨 쿠션 커버', 'home', 18000], ['Folding storage box', '접이식 수납 박스', 'home', 15000], ['Diffuser refill', '디퓨저 리필', 'home', 16000],
  ['Dot notebook A5', '도트 노트 A5', 'paper', 8000], ['Gel pens, 6 colours', '젤 펜 6색', 'paper', 7500], ['Leather pen case', '가죽 펜 케이스', 'paper', 26000], ['Desk calendar 2027', '탁상 달력 2027', 'paper', 12000],
  ['Wireless charging pad', '무선 충전 패드', 'digital', 35000], ['Cable organiser kit', '케이블 정리 키트', 'digital', 11000], ['Laptop sleeve 14"', '노트북 파우치 14"', 'digital', 39000], ['Mini Bluetooth speaker', '블루투스 스피커 미니', 'digital', 79000], ['Phone stand', '스마트폰 거치대', 'digital', 14000], ['USB-C hub 6-in-1', 'USB-C 허브 6in1', 'digital', 49000],
];

export type OrderStatus = 'paid' | 'shipping' | 'delivered' | 'cancelled' | 'refunded';
export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';
export type Order = { id: string; time: string; at: number; customer: string; product: string; qty: number; amount: number; channel: string; status: OrderStatus };

function build(lang: Lang) {
  const ko = lang === 'ko', L = (en: string, k: string) => (ko ? k : en);
  const locale = ko ? 'ko-KR' : 'en-US';
  const R = rand(11);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)];
  const CATEGORIES = (Object.keys(CATEGORY_NAMES) as CategoryKey[]).map((key) => ({ key, label: L(...CATEGORY_NAMES[key]) }));
  const categoryLabel = (k: CategoryKey) => CATEGORIES.find((c) => c.key === k)!.label;

  const PRODUCTS: Product[] = NAMES.map(([en, kn, category, price], i) => {
  const name = L(en, kn);
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
  const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
    paid: { label: L('Paid', '결제 완료'), tone: 'accent' },
    shipping: { label: L('In transit', '배송 중'), tone: 'info' },
    delivered: { label: L('Delivered', '배송 완료'), tone: 'success' },
    cancelled: { label: L('Cancelled', '취소'), tone: 'neutral' },
    refunded: { label: L('Refunded', '환불'), tone: 'warning' },
  };
  const [WEB, APP, STORE] = [L('Web', '웹'), L('App', '앱'), L('Store', '매장')];
  const CHANNELS = [WEB, APP, STORE];
  /* the same draws in both languages: a name is picked by index from lists of the same length */
  const FAMILY = ko ? ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권']
    : ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon'];
  const GIVEN = ko ? ['하린', '도윤', '서연', '지호', '민준', '수아', '예준', '지안', '하준', '윤서', '시우', '채원', '주원', '다은', '건우', '서진']
    : ['Harin', 'Doyun', 'Seoyeon', 'Jiho', 'Minjun', 'Sua', 'Yejun', 'Jian', 'Hajun', 'Yunseo', 'Siwoo', 'Chaewon', 'Juwon', 'Daeun', 'Geonwoo', 'Seojin'];
  const START = new Date(2026, 10, 18, 18, 0).getTime();
  const ORDERS: Order[] = Array.from({ length: 5000 }, (_, i) => {
  const p = pick(PRODUCTS.filter((x) => !x.paused)), qty = R() < 0.8 ? 1 : R() < 0.7 ? 2 : 3;
  const at = START - i * 7 * 60_000 - Math.floor(R() * 6 * 60_000);
  const d = new Date(at), age = i / 5000;
  const r = R();
  const status: OrderStatus = r < 0.04 ? 'cancelled' : r < 0.07 ? 'refunded' : age < 0.02 ? 'paid' : age < 0.06 ? (r < 0.5 ? 'paid' : 'shipping') : age < 0.12 ? 'shipping' : 'delivered';
  return {
    id: `${100480 - i}`, at,
    time: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    customer: ko ? `${pick(FAMILY)}${pick(GIVEN)}` : ((f: string, g: string) => `${g} ${f}`)(pick(FAMILY), pick(GIVEN)), product: p.name, qty, amount: p.price * qty,
    channel: R() < 0.48 ? APP : R() < 0.8 ? WEB : STORE, status,
  };
  });

  /* ---------------------------------------------------------------- days and months */
  const DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 9, 20 + i), weekend = d.getDay() === 0 || d.getDay() === 6;
  const visits = round(4200 + i * 75 + (weekend ? 1300 : 0) + (R() - 0.5) * 500);
  const orders = round(visits * (0.027 + i * 0.00015 + R() * 0.004));
  return { day: `${d.getMonth() + 1}/${d.getDate()}`, visits, returning: round(visits * (0.34 + i * 0.002 + (R() - 0.5) * 0.05)), orders, revenue: orders * round(38000 + R() * 9000, 100) };
});
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short' });
  const MONTHS = [5, 6, 7, 8, 9, 10].map((m) => monthName.format(new Date(2026, m, 1))).map((m, i) => ({
  month: m, web: round(3800 + i * 210 + R() * 500, 10), app: round(4200 + i * 420 + R() * 600, 10), store: round(1600 + R() * 400, 10),
}));
  const CATEGORY_SHARE = CATEGORIES.map((c) => ({ label: c.label, value: PRODUCTS.filter((p) => p.category === c.key).reduce((a, p) => a + p.revenue, 0) }));

  /* ---------------------------------------------------------------- delivery (for interval plots) */
  const REGIONS = [['Seoul area', '수도권'], ['Gangwon', '강원'], ['Chungcheong', '충청'], ['Jeolla', '전라'], ['Gyeongsang', '경상'], ['Jeju', '제주']].map(([en, kn], i) => {
    const island = i === 5;   /* deliveries to the island take longer and vary more */
    const mean = +(1.2 + i * 0.25 + R() * 0.5 + (island ? 1.2 : 0)).toFixed(1);
    return { name: L(en, kn), mean, low: +(mean - 0.4 - R() * 0.3).toFixed(1), high: +(mean + 0.5 + R() * (island ? 1.4 : 0.6)).toFixed(1) };
  });

  const fmt = new Intl.NumberFormat(locale), compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const num = (v: number) => fmt.format(v);
  const won = (v: number) => `₩${fmt.format(v)}`;
  /** 1,234,000 → "123만" / "1.2M", 123,400,000 → "1.2억" / "123.4M" */
  const wonShort = (v: number) => (ko ? (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${fmt.format(Math.round(v / 1e4))}만` : fmt.format(v)) : compact.format(v));
  /* text compared in the reader's language (the simulated server sorts this way) */
  const collator = new Intl.Collator(locale, { numeric: true });
  return { lang, locale, CATEGORIES, categoryLabel, PRODUCTS, STATUS, CHANNELS, ORDERS, DAYS, MONTHS, CATEGORY_SHARE, REGIONS, num, won, wonShort, collator };
}

export type ShopData = ReturnType<typeof build>;
const cache: Partial<Record<Lang, ShopData>> = {};
export const dataFor = (lang: Lang): ShopData => (cache[lang] ??= build(lang));
/** The shop data in the reader's language. */
export const useData = () => dataFor(useLang());

/* the Korean set, for pages not yet on useData() */
export const { CATEGORIES, categoryLabel, PRODUCTS, STATUS, CHANNELS, ORDERS, DAYS, MONTHS, CATEGORY_SHARE, REGIONS, num, won, wonShort } = dataFor('ko');
export type Channel = string;
