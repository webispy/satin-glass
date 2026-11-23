/* The words components write themselves (visible text, accessible names, announcements), in English and Korean.
   Formats (dates, numbers, sorting) follow any locale through Intl; words exist only in these two, picked by the
   locale's language subtag: 'ko' gets Korean, anything else English. A component's `labels` / label props win over
   these. Internal: not exported from the package. */
import { useLocale } from './foundation';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/* 을 after a final consonant, 를 after a vowel ("체크인을", "날짜를"); 을 for anything that is not Hangul */
const objectParticle = (w: string) => { const c = w.trim().charCodeAt(w.trim().length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 === 0 ? '를' : '을'; };

const en = {
  clear: 'Clear', close: 'Close', cancel: 'Cancel', back: 'Back', dismiss: 'Dismiss', loading: 'Loading',
  previous: 'Previous', next: 'Next', search: 'Search', tabs: 'Tabs', progress: 'Progress', resize: 'Resize',
  remove: (name?: string) => (name ? `Remove ${name}` : 'Remove'),
  value: 'Value', decrease: (label: string) => `Decrease ${label}`, increase: (label: string) => `Increase ${label}`,
  page: 'Page', pageOf: (label: string, n: number, count: number) => `${label} ${n} of ${count}`,
  people: (n: number) => plural(n, 'person', 'people'), more: (n: number) => `${n} more`,
  breadcrumb: 'Breadcrumb', hiddenLevels: 'Show hidden levels',
  selectPlaceholder: 'Select…',
  combobox: { empty: 'No results', loading: 'Loading…', toggle: 'Show suggestions', count: (n: number) => `${n} selected` },
  filters: { clear: 'Clear', applied: (n: number) => `${n} applied` },
  mediaViewer: 'Media viewer',
  notifications: 'Notifications',
  pagination: { nav: 'Pagination', previous: 'Previous page', next: 'Next page', page: (n: number) => `Page ${n}` },
  stat: { up: 'Up', down: 'Down', flat: 'No change' },
  unavailable: 'Unavailable',
  table: { selectAll: 'Select all rows', selectRow: 'Select row', empty: 'No data', sortedAsc: 'sorted ascending', sortedDesc: 'sorted descending', columns: 'Columns', showAll: 'Show all' },
  timeline: { done: 'Completed', current: 'Current', upcoming: 'Upcoming' },
  chartSeries: (chart: string) => `${chart} — series`,
  weekdays: { never: 'Never', every: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends' },
  time: { hour: 'Hour', minute: 'Minute', period: 'AM/PM', choose: 'Choose a time', placeholder: 'Select a time', done: 'Done' },
  date: {
    rangeStart: 'start date', rangeEnd: 'end date', pickNext: (x: string) => `Choose the ${x}`,
    partial: (label: string, date: string) => `${label[0].toUpperCase()}${label.slice(1)}: ${date}`,
    days: (n: number) => plural(n, 'day', 'days'), nights: (n: number) => plural(n, 'night', 'nights'),
    chooseRange: 'Choose dates', prev: 'Previous month', next: 'Next month', prevYear: 'Previous year', nextYear: 'Next year',
    prevYears: 'Earlier years', nextYears: 'Later years', today: 'Today', choose: 'Choose a date', placeholder: 'Select a date',
    pick: 'Choose month and year', year: 'Year', month: 'Month', pickYear: 'Choose a year', pickMonth: 'Choose a month',
  },
};
export type Messages = typeof en;

const ko: Messages = {
  clear: '지우기', close: '닫기', cancel: '취소', back: '뒤로', dismiss: '닫기', loading: '불러오는 중',
  previous: '이전', next: '다음', search: '검색', tabs: '탭', progress: '진행률', resize: '크기 조절',
  remove: (name) => (name ? `${name} 제거` : '제거'),
  value: '값', decrease: (label) => `${label} 줄이기`, increase: (label) => `${label} 늘리기`,
  page: '페이지', pageOf: (label, n, count) => `${count}개 중 ${n}번째 ${label}`,
  people: (n) => `${n}명`, more: (n) => `${n}명 더`,
  breadcrumb: '이동 경로', hiddenLevels: '숨은 경로 보기',
  selectPlaceholder: '선택…',
  combobox: { empty: '결과 없음', loading: '불러오는 중…', toggle: '목록 보기', count: (n) => `${n}개 선택됨` },
  filters: { clear: '초기화', applied: (n) => `${n}개 적용됨` },
  mediaViewer: '미디어 뷰어',
  notifications: '알림',
  /* "3 페이지", spaced: the name must contain the visible "3" as a word (WCAG 2.5.3 label in name) */
  pagination: { nav: '페이지 이동', previous: '이전 페이지', next: '다음 페이지', page: (n) => `${n} 페이지` },
  stat: { up: '증가', down: '감소', flat: '변화 없음' },
  unavailable: '알 수 없음',
  table: { selectAll: '모든 행 선택', selectRow: '행 선택', empty: '데이터 없음', sortedAsc: '오름차순 정렬', sortedDesc: '내림차순 정렬', columns: '열', showAll: '모두 보기' },
  timeline: { done: '완료', current: '진행 중', upcoming: '예정' },
  chartSeries: (chart) => `${chart} — 계열`,
  weekdays: { never: '안 함', every: '매일', weekdays: '주중', weekends: '주말' },
  time: { hour: '시', minute: '분', period: '오전/오후', choose: '시간 선택', placeholder: '시간 선택', done: '완료' },
  date: {
    rangeStart: '시작일', rangeEnd: '종료일', pickNext: (x) => `${x}${objectParticle(x)} 선택하세요`, partial: (label, date) => `${label} ${date}`,
    days: (n) => `${n}일`, nights: (n) => `${n}박 ${n + 1}일`,
    chooseRange: '기간 선택', prev: '이전 달', next: '다음 달', prevYear: '이전 해', nextYear: '다음 해',
    prevYears: '이전 연도 보기', nextYears: '다음 연도 보기', today: '오늘', choose: '날짜 선택', placeholder: '날짜 선택',
    pick: '연도와 월 선택', year: '연도', month: '월', pickYear: '연도 선택', pickMonth: '월 선택',
  },
};

/** the words for a BCP 47 locale: Korean for 'ko', English for anything else */
export const messagesFor = (locale: string): Messages => (locale.split(/[-_]/)[0].toLowerCase() === 'ko' ? ko : en);

/** the locale in effect for a component: its own `locale` prop, else the theme's (else 'en-US') */
export function useLocaleOf(own?: string): string {
  const theme = useLocale();
  return own ?? theme;
}

/** the words for a component: by its own `locale` prop when it has one, else by the theme's locale */
export const useMessages = (own?: string): Messages => messagesFor(useLocaleOf(own));
