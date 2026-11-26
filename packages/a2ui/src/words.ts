/* The words the A2UI components draw themselves, in English and Korean. An app can give its own through
   `useA2ui({ words })`; they win over these. The language follows the session's locale. */
export type A2uiWords = {
  /** the name of the region each surface sits in */
  surface: string;
  /** a dialog's close action */
  close: string;
  /** a dialog's title when the agent gave its modal no label */
  dialog: string;
  /** a filterable choice's search field */
  filter: string;
  /** under a button its checks disable, when the check gave no message */
  fix: string;
  /** a choice list that the filter emptied */
  noMatches: string;
  /** a date and time field's two halves */
  date: string;
  time: string;
  /** a v0.9.1 text field whose `validationRegexp` the text does not match */
  format: string;
  /** a date or time outside the agent's `min` and `max` */
  range: string;
  /** a cropped image's button, which opens it whole (followed by the image's description) */
  wholeImage: string;
  /** check messages, for a check the agent gave no message of its own: web_core's English words, in the session's language */
  invalid: string;
  required: string;
  number: string;
  email: string;
  tooLong: string;
  unchecked: string;
  minLength: (n: string) => string;
  maxLength: (n: string) => string;
  minValue: (n: string) => string;
  maxValue: (n: string) => string;
};

const en: A2uiWords = {
  surface: 'Agent content', close: 'Close', dialog: 'Details', filter: 'Filter options', fix: 'Check the fields above.',
  noMatches: 'No matching options', date: 'Date', time: 'Time', format: 'Check the format.', range: 'Choose a value within the allowed range.', wholeImage: 'View the whole image',
  invalid: 'Check this value.', required: 'Fill this in.', number: 'Enter a number.', email: 'Enter an email address, such as user@example.com.',
  tooLong: 'This is too long to check.', unchecked: 'This value cannot be checked.',
  minLength: (n) => `Use at least ${n} characters.`, maxLength: (n) => `Use at most ${n} characters.`,
  minValue: (n) => `Enter ${n} or more.`, maxValue: (n) => `Enter ${n} or less.`,
};
const ko: A2uiWords = {
  surface: '에이전트 콘텐츠', close: '닫기', dialog: '상세 정보', filter: '항목 필터', fix: '위 항목을 확인하세요.',
  noMatches: '일치하는 항목 없음', date: '날짜', time: '시간', format: '형식을 확인하세요.', range: '허용 범위 안의 값을 선택하세요.', wholeImage: '사진 전체 보기',
  invalid: '값을 확인하세요.', required: '입력하세요.', number: '숫자를 입력하세요.', email: '이메일 주소를 입력하세요(예: user@example.com).',
  tooLong: '확인하기에는 너무 깁니다.', unchecked: '이 값은 확인할 수 없습니다.',
  minLength: (n) => `${n}자 이상 입력하세요.`, maxLength: (n) => `${n}자 이하로 입력하세요.`,
  minValue: (n) => `${n} 이상을 입력하세요.`, maxValue: (n) => `${n} 이하를 입력하세요.`,
};

export const wordsFor = (locale: string, own?: Partial<A2uiWords>): A2uiWords =>
  ({ ...(locale.split(/[-_]/)[0].toLowerCase() === 'ko' ? ko : en), ...own });

/* web_core's own check messages (and this package's), used when the agent's check has none: shown in the session's
   language. A message the agent wrote is shown as it is. */
const FIXED: [string, keyof A2uiWords][] = [
  ['Validation failed', 'invalid'], ['This field is required.', 'required'], ['Value must be a valid number.', 'number'],
  ['Please enter a valid email address (e.g. user@example.com).', 'email'], ['Value does not match required pattern.', 'format'],
  ['Value exceeds the maximum length for pattern matching.', 'tooLong'], ['The pattern is not one this renderer runs.', 'unchecked'],
];
const COUNTED: [RegExp, 'minLength' | 'maxLength' | 'minValue' | 'maxValue'][] = [
  [/^Minimum length is (.+)\.$/, 'minLength'], [/^Maximum length is (.+)\.$/, 'maxLength'],
  [/^Minimum value is (.+)\.$/, 'minValue'], [/^Maximum value is (.+)\.$/, 'maxValue'],
];
export function checkText(message: string, words: A2uiWords): string {
  for (const [en, key] of FIXED) if (message === en) return words[key] as string;
  for (const [re, key] of COUNTED) { const m = re.exec(message); if (m) return words[key](m[1]); }
  return message;
}
