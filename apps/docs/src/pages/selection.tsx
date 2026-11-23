import { useEffect, useState } from 'react';
import {
  Avatar, Button, Calendar, Checkbox, ChoiceList, Combobox, DatePicker, DateRangePicker, RangeCalendar, type DateRange, List, ListItem, ListSection, Radio, RadioGroup, Select, Stack, Switch, Text, TimePicker, TimeWheel,
  WeekdayPicker, describeWeekdays, useToast,
} from '@satin-glass/react';
import { Bike, Car, Footprints, Train, Moon, Sun, Monitor, Wifi, Bell, MapPin } from 'lucide-react';
import { Demo, Page, Section, Usage } from '../shared';
import { L, useLocale, useT } from '../i18n';
import { useData } from '../data';
import CheckboxExample from '../examples/selection-checkbox';
import checkboxSrc from '../examples/selection-checkbox?raw';
import SelectExample from '../examples/selection-select';
import selectSrc from '../examples/selection-select?raw';
import DateExample from '../examples/selection-date';
import dateSrc from '../examples/selection-date?raw';
import ComboboxExample from '../examples/selection-combobox';
import comboboxSrc from '../examples/selection-combobox?raw';
import DateRangeExample from '../examples/selection-date-range';
import dateRangeSrc from '../examples/selection-date-range?raw';

function useAmenities() {
  const t = useT();
  return [
    ['parking', t({ en: 'Parking', ko: '주차장' })], ['pets', t({ en: 'Pets allowed', ko: '반려동물 동반' })],
    ['toilet', t({ en: 'Restrooms', ko: '화장실' })], ['night', t({ en: 'Open at night', ko: '야간 개방' })],
  ] as const;
}

export function Selection() {
  const t = useT(), locale = useLocale();
  const AMENITIES = useAmenities();
  const [agree, setAgree] = useState(false);
  const [am, setAm] = useState<string[]>(['parking']);
  const [mode, setMode] = useState('walk');
  const [unit, setUnit] = useState('km');
  const [region, setRegion] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [cal, setCal] = useState<Date | null>(new Date());
  const [notif, setNotif] = useState<string[]>(['sunset']);
  const [appearance, setAppearance] = useState('system');
  const [birth, setBirth] = useState<Date | null>(null);
  const [meet, setMeet] = useState<string | null>(null);
  const [al, setAl] = useState({ time: '07:30', days: [1, 2, 3, 4, 5], on: true });
  const [stay, setStay] = useState<DateRange | null>(null);
  const [trip, setTrip] = useState<DateRange | null>(null);
  const [report, setReport] = useState<DateRange | null>(null);
  const putAlarm = (patch: Partial<typeof al>) => setAl((a) => ({ ...a, ...patch }));
  const [fCat, setFCat] = useState('all'), [fSort, setFSort] = useState('new'), [fShip, setFShip] = useState('all');
  const toast = useToast();
  const all = am.length === AMENITIES.length, some = am.length > 0 && !all;
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
  /* a few sold-out nights in the next weeks (the hotel demo) */
  const soldOut = (d: Date) => { const n = Math.round((d.getTime() - Date.now()) / 864e5); return n === 9 || n === 10 || n === 23; };
  /* the demos that show another locale show the one the page is not in */
  const otherLocale = t({ en: 'ko-KR', ko: 'en-US' });
  return (
    <Page title={t({ en: 'Selection', ko: '선택' })} api={['Checkbox', 'RadioGroup', 'Radio', 'ChoiceList', 'Select', 'Combobox', 'DatePicker', 'Calendar', 'DateRangePicker', 'RangeCalendar', 'TimePicker', 'TimeWheel', 'WeekdayPicker', 'SelectOption', 'ChoiceOption']} intro={<L
      en="Checkboxes, radios, choice lists, selects, date, range and time pickers, and comboboxes. Checkboxes and radios are real inputs, so form submission, the keyboard and screen readers work as usual; selects and calendars follow the WAI-ARIA patterns (combobox, date grid)."
      ko="체크박스, 라디오, 선택 목록, 셀렉트, 날짜·기간·시간 선택기, 콤보박스입니다. 체크박스와 라디오는 실제 input이라 폼 제출·키보드·스크린 리더가 그대로 동작하고, 셀렉트와 달력은 WAI-ARIA 패턴(콤보박스·날짜 그리드)을 따릅니다." />}>
      <Section title={t({ en: 'Checkbox', ko: '체크박스' })} intro={<L
        en="A press draws the check quickly (snappy), and a set that is only partly chosen can show as indeterminate."
        ko="누르면 체크 표시가 빠르게 그려지고(snappy), 일부만 선택된 상태(indeterminate)도 표시할 수 있습니다." />}>
        <div className="grid grid--2">
          <Demo col>
            <Checkbox label={t({ en: 'All amenities', ko: '편의시설 모두' })} indeterminate={some} checked={all} onChange={(on) => setAm(on ? AMENITIES.map(([k]) => k) : [])} />
            <Stack gap={3} style={{ paddingLeft: 32 }}>
              {AMENITIES.map(([k, l]) => <Checkbox key={k} label={l} checked={am.includes(k)} onChange={(on) => setAm((x) => (on ? [...x, k] : x.filter((y) => y !== k)))} />)}
            </Stack>
          </Demo>
          <Demo col>
            <Checkbox label={t({ en: 'I agree to the terms of use', ko: '이용 약관에 동의' })} description={t({ en: 'Place details are kept up to date by the community.', ko: '장소 정보는 커뮤니티 기여로 갱신돼요.' })} checked={agree} onChange={setAgree} />
            <Checkbox label={t({ en: 'Marketing emails (optional)', ko: '마케팅 수신 (선택)' })} defaultChecked />
            <Checkbox label={t({ en: 'Disabled', ko: '비활성' })} disabled />
            <Button variant="filled" disabled={!agree} onClick={() => toast({ title: t({ en: 'Saved', ko: '저장했어요' }), tone: 'success' })}>{t({ en: 'Continue', ko: '계속' })}</Button>
          </Demo>
        </div>
        <Usage example={CheckboxExample} code={checkboxSrc} />
      </Section>

      <Section title={t({ en: 'Radio', ko: '라디오' })} intro={<L
        en="Moving focus with the arrow keys chooses at once, and Tab enters the group at the chosen option. When chosen, the centre dot grows to fill."
        ko="방향키로 포커스를 옮기면 바로 선택되고, Tab으로 그룹에 들어오면 선택된 항목에 포커스가 갑니다. 선택하면 가운데 점이 커지며 원을 채웁니다." />}>
        <Demo>
          <RadioGroup label={t({ en: 'Travel mode', ko: '이동 수단' })} value={mode} onChange={setMode}>
            <Radio value="walk" label={t({ en: 'Walk', ko: '도보' })} description={t({ en: 'Includes stairs and slopes', ko: '계단·오르막 포함' })} />
            <Radio value="bike" label={t({ en: 'Bike', ko: '자전거' })} />
            <Radio value="car" label={t({ en: 'Car', ko: '자동차' })} />
            <Radio value="boat" label={t({ en: 'Ferry (suspended)', ko: '배 (운항 중단)' })} disabled />
          </RadioGroup>
          <RadioGroup label={t({ en: 'Units', ko: '단위' })} direction="row" value={unit} onChange={setUnit}>
            <Radio value="km" label={t({ en: 'Kilometres', ko: '킬로미터' })} /><Radio value="mi" label={t({ en: 'Miles', ko: '마일' })} />
          </RadioGroup>
        </Demo>
      </Section>

      <Section title={t({ en: 'Choice list', ko: '선택 목록' })} intro={<L
        en="As on a settings screen, the rows of the list are the options. A list takes one choice (radiogroup) or several (a group of checkboxes)."
        ko="설정 화면처럼 목록의 행이 곧 선택지입니다. 하나만 선택하는 목록(radiogroup)과 여러 개를 선택하는 목록(체크박스 묶음)이 있습니다." />}>
        <div className="grid grid--2">
          <ListSection header={t({ en: 'Appearance', ko: '화면 모드' })}>
            <ChoiceList aria-label={t({ en: 'Appearance', ko: '화면 모드' })} value={appearance} onChange={setAppearance} options={[
              { value: 'light', label: t({ en: 'Light', ko: '라이트' }), icon: <Sun />, tileColor: 'var(--sg-amber-500)' },
              { value: 'dark', label: t({ en: 'Dark', ko: '다크' }), icon: <Moon />, tileColor: 'var(--sg-iris-700)' },
              { value: 'system', label: t({ en: 'System', ko: '시스템 설정' }), description: t({ en: 'Follows the device setting', ko: '기기 설정을 따라요' }), icon: <Monitor />, tileColor: 'var(--sg-slate-500)' },
            ]} />
          </ListSection>
          <ListSection header={t({ en: 'Notify me about', ko: '알림 받을 항목' })} footer={t({ en: `${notif.length} selected`, ko: `${notif.length}개 선택` })}>
            <ChoiceList multiple aria-label={t({ en: 'Notify me about', ko: '알림 받을 항목' })} value={notif} onChange={setNotif} options={[
              { value: 'sunset', label: t({ en: '30 minutes before sunset', ko: '일몰 30분 전' }) },
              { value: 'weather', label: t({ en: 'Weather alerts', ko: '날씨 경보' }) },
              { value: 'nearby', label: t({ en: 'New places nearby', ko: '가까운 새 장소' }) },
              { value: 'beta', label: t({ en: 'Beta features', ko: '베타 기능' }), description: t({ en: 'Coming soon', ko: '준비 중' }), disabled: true },
            ]} />
          </ListSection>
        </div>
      </Section>

      <Section title={t({ en: 'Select', ko: '셀렉트' })} intro={<L
        en="Focus stays on the button while ↑↓ move through the options and Enter chooses, and typing jumps to the option that starts with those letters. The list grows out of the button."
        ko="포커스는 버튼에 둔 채 ↑↓로 항목 사이를 이동하고 Enter로 선택하며, 글자를 입력하면 그 글자로 시작하는 항목으로 이동합니다. 목록은 버튼에서 피어납니다." />}>
        <div className="grid grid--2">
          <Demo col>
            <Select label={t({ en: 'Travel mode', ko: '이동 수단' })} value={mode} onChange={setMode} options={[
              { value: 'walk', label: t({ en: 'Walk', ko: '도보' }), icon: <Footprints /> },
              { value: 'bike', label: t({ en: 'Bike', ko: '자전거' }), icon: <Bike /> },
              { value: 'car', label: t({ en: 'Car', ko: '자동차' }), icon: <Car />, description: t({ en: 'Only where you can park', ko: '주차 가능한 곳만' }) },
              { value: 'train', label: t({ en: 'Train', ko: '기차' }), icon: <Train />, disabled: true },
            ]} />
            <Select label={t({ en: 'Region', ko: '지역' })} placeholder={t({ en: 'Choose a region', ko: '지역 선택' })} value={region} onChange={setRegion} helperText={t({ en: 'Narrows the places to this region', ko: '장소 목록이 이 지역으로 좁혀져요' })} name="region" options={[
              { label: t({ en: 'Seoul area', ko: '수도권' }), options: [{ value: 'seoul', label: t({ en: 'Seoul', ko: '서울' }) }, { value: 'incheon', label: t({ en: 'Incheon', ko: '인천' }) }, { value: 'gyeonggi', label: t({ en: 'Gyeonggi', ko: '경기' }) }] },
              { label: t({ en: 'Gangwon · Chungcheong', ko: '강원·충청' }), options: [{ value: 'gangwon', label: t({ en: 'Gangwon', ko: '강원' }) }, { value: 'chungbuk', label: t({ en: 'North Chungcheong', ko: '충북' }) }, { value: 'chungnam', label: t({ en: 'South Chungcheong', ko: '충남' }) }, { value: 'daejeon', label: t({ en: 'Daejeon', ko: '대전' }) }] },
              { label: t({ en: 'Yeongnam', ko: '영남' }), options: [{ value: 'busan', label: t({ en: 'Busan', ko: '부산' }) }, { value: 'daegu', label: t({ en: 'Daegu', ko: '대구' }) }, { value: 'ulsan', label: t({ en: 'Ulsan', ko: '울산' }) }, { value: 'gyeongbuk', label: t({ en: 'North Gyeongsang', ko: '경북' }) }, { value: 'gyeongnam', label: t({ en: 'South Gyeongsang', ko: '경남' }) }] },
              { label: t({ en: 'Honam · Jeju', ko: '호남·제주' }), options: [{ value: 'gwangju', label: t({ en: 'Gwangju', ko: '광주' }) }, { value: 'jeonbuk', label: t({ en: 'North Jeolla', ko: '전북' }) }, { value: 'jeonnam', label: t({ en: 'South Jeolla', ko: '전남' }) }, { value: 'jeju', label: t({ en: 'Jeju', ko: '제주' }) }] },
            ]} />
            <Select label={t({ en: 'Required', ko: '필수 항목' })} placeholder={t({ en: 'Choose one', ko: '선택하세요' })} error={t({ en: 'Choose an option', ko: '하나를 선택해 주세요' })} options={[{ value: 'a', label: t({ en: 'A', ko: '가' }) }, { value: 'b', label: t({ en: 'B', ko: '나' }) }]} />
          </Demo>
          <Demo col>
            <Text variant="subhead" tone="secondary">{t({ en: 'Inside a list row (inline)', ko: '목록 행 안에서 (inline)' })}</Text>
            <List>
              <ListItem leading={<MapPin />} tileColor="var(--sg-coral-500)" title={t({ en: 'Distance unit', ko: '거리 단위' })} trailing={<Select variant="inline" aria-label={t({ en: 'Distance unit', ko: '거리 단위' })} value={unit} onChange={setUnit} options={[{ value: 'km', label: t({ en: 'Kilometres', ko: '킬로미터' }) }, { value: 'mi', label: t({ en: 'Miles', ko: '마일' }) }]} />} />
              <ListItem leading={<Wifi />} tileColor="var(--sg-azure-500)" title={t({ en: 'Map downloads', ko: '지도 다운로드' })} trailing={<Select variant="inline" aria-label={t({ en: 'Map downloads', ko: '지도 다운로드' })} defaultValue="wifi" options={[{ value: 'wifi', label: t({ en: 'Wi‑Fi only', ko: 'Wi‑Fi에서만' }) }, { value: 'always', label: t({ en: 'Always', ko: '항상' }) }, { value: 'never', label: t({ en: 'Never', ko: '안 함' }) }]} />} />
              <ListItem leading={<Bell />} tileColor="var(--sg-rose-500)" title={t({ en: 'Sound', ko: '소리' })} trailing={<Select variant="inline" aria-label={t({ en: 'Sound', ko: '소리' })} defaultValue="chime" placement="bottom-end" options={[{ value: 'chime', label: t({ en: 'Chime', ko: '차임' }) }, { value: 'bell', label: t({ en: 'Bell', ko: '종' }) }, { value: 'none', label: t({ en: 'None', ko: '없음' }) }]} />} />
            </List>
          </Demo>
        </div>
        <Usage example={SelectExample} code={selectSrc} />
      </Section>

      <Section title={t({ en: 'Filter select', ko: '필터 셀렉트' })} intro={<L
        en='Small pill selects to line up above a list or a table (variant="filter"). Each shows its name with the current value, as in ‘Category All’, and screen readers read it that way. Choosing works as in a regular select.'
        ko="목록이나 표 위에 나란히 놓는 작은 필 셀렉트입니다(variant=&quot;filter&quot;). ‘분류 전체’처럼 이름과 현재 값을 함께 보여 주고, 스크린 리더도 그렇게 읽습니다. 선택하는 방식은 일반 셀렉트와 같습니다." />}>
        <Demo data-demo="filter-select">
          <Select variant="filter" label={t({ en: 'Category', ko: '분류' })} value={fCat} onChange={setFCat} options={[{ value: 'all', label: t({ en: 'All', ko: '전체' }) }, { value: 'wear', label: t({ en: 'Clothing', ko: '의류' }) }, { value: 'home', label: t({ en: 'Home', ko: '생활' }) }, { value: 'kitchen', label: t({ en: 'Kitchen', ko: '주방' }) }, { value: 'digital', label: t({ en: 'Digital', ko: '디지털' }) }]} />
          <Select variant="filter" label={t({ en: 'Delivery', ko: '배송' })} value={fShip} onChange={setFShip} options={[{ value: 'all', label: t({ en: 'All', ko: '전체' }) }, { value: 'today', label: t({ en: 'Ships today', ko: '오늘 출발' }) }, { value: 'free', label: t({ en: 'Free delivery', ko: '무료 배송' }) }]} />
          <Select variant="filter" label={t({ en: 'Sort', ko: '정렬' })} value={fSort} onChange={setFSort} options={[{ value: 'new', label: t({ en: 'Newest', ko: '최신순' }) }, { value: 'sold', label: t({ en: 'Best selling', ko: '판매량순' }) }, { value: 'low', label: t({ en: 'Price: low to high', ko: '낮은 가격순' }) }, { value: 'high', label: t({ en: 'Price: high to low', ko: '높은 가격순' }) }]} />
        </Demo>
      </Section>

      <Section title={t({ en: 'Date', ko: '날짜' })} intro={<L
        en={<>The arrow keys move a day or a week, PageUp/PageDown a month (with Shift, a year). The year and month chips at the top sit in the order the language writes them (‘<span lang="ko">2026년 11월</span>’ in Korean, ‘November 2026’ in English). Pressing a chip opens, in place, a scrolling grid of the twelve months or of every year; in the year grid, typing 1, 9, 8, 0 goes to 1980. Choosing a year leads to its months, and a month to its days. For dates far in the past, such as a date of birth, the field can open on the year (openTo="year") and start at a given month (defaultMonth). Where wheels suit the screen, monthPicker="wheel" opens year and month wheels.</>}
        ko="방향키로 하루·한 주, PageUp/PageDown으로 한 달(Shift와 함께 누르면 1년)씩 이동합니다. 위쪽의 연도·월 칩은 언어별 표기 순서대로 놓입니다(한국어는 ‘2026년 11월’, 영어는 ‘November 2026’). 칩을 누르면 그 자리에 열두 달, 또는 모든 연도를 담은 스크롤 그리드가 피어나고, 연도 그리드에서 1·9·8·0을 차례로 입력하면 1980년으로 갑니다. 연도를 선택하면 달로, 달을 선택하면 날짜로 이어집니다. 생년월일처럼 주로 먼 과거를 입력하는 칸은 연도부터 열고(openTo=&quot;year&quot;), 처음 보여 줄 달(defaultMonth)을 정할 수 있습니다. 휠이 편한 화면에서는 monthPicker=&quot;wheel&quot;로 연도·월 휠을 엽니다." />}>
        <div className="grid grid--2">
          <Demo col data-demo="date">
            <DatePicker label={t({ en: 'Date of birth', ko: '생년월일' })} locale={locale} value={birth} onChange={setBirth} openTo="year" defaultMonth={new Date(1990, 0, 1)} min={new Date(1920, 0, 1)} max={new Date()} name="birth" helperText={t({ en: 'Year → month → day', ko: '연도 → 월 → 날짜 순서로' })} />
            <DatePicker label={t({ en: 'Date of birth (wheels)', ko: '생년월일 (휠로 선택)' })} locale={locale} monthPicker="wheel" openTo="month" defaultMonth={new Date(1990, 0, 1)} min={new Date(1920, 0, 1)} max={new Date()} helperText="monthPicker=&quot;wheel&quot;" />
            <DatePicker label={t({ en: 'Visit date', ko: '방문 날짜' })} locale={locale} value={date} onChange={setDate} min={new Date()} max={maxDate} helperText={t({ en: 'Within 3 months of today', ko: '오늘부터 3개월 이내' })} name="visit" />
            <DatePicker label={t({ en: 'Weekends only (weekdays disabled)', ko: '주말만 (평일 선택 불가)' })} locale={locale} isDateDisabled={(d) => d.getDay() !== 0 && d.getDay() !== 6} />
            <DatePicker label={t({ en: 'Korean, Monday first', ko: '영어(English), 월요일 시작' })} locale={otherLocale} weekStartsOn={1} />
          </Demo>
          <Demo center data-demo="calendar">
            <Calendar value={cal} onChange={setCal} locale={locale} aria-label={t({ en: 'Calendar', ko: '달력' })} />
          </Demo>
        </div>
        <Usage example={DateExample} code={dateSrc} />
      </Section>

      <Combos />

      <Section title={t({ en: 'Date range', ko: '기간' })} intro={<L
        en="Choose two dates, a start and an end: the first day pressed is the start, the second the end. While the end is being chosen, a faint band in the groove follows on a spring from the start to the day under the pointer (or keyboard focus), and choosing the end fills its mark from the centre. Pressing a day before the start, or one the range cannot reach (beyond the maximum length, or across a day that cannot be chosen), starts again from that day. The line below says what to choose next and how long the range is (‘2 nights’ or ‘3 days’)."
        ko="시작과 끝, 두 날짜를 선택합니다. 첫 번째로 누른 날이 시작, 두 번째가 끝입니다. 끝을 선택하는 동안에는 시작부터 포인터(또는 키보드 포커스)가 있는 날까지 홈 안의 옅은 띠가 스프링을 타고 따라 흐르고, 끝을 선택하면 끝 날짜의 표시가 가운데에서 차오릅니다. 시작보다 앞선 날이나 기간으로 이을 수 없는 날(최대 길이를 넘거나, 중간에 선택할 수 없는 날이 끼어 있는 경우)을 누르면 그날부터 다시 시작합니다. 아래 줄은 지금 무엇을 선택할 차례인지와 기간의 길이(‘2박 3일’ 또는 ‘3일’)를 알려 줍니다." />}>
        <div className="grid grid--2">
          <Demo col data-demo="range">
            <DateRangePicker label={t({ en: 'Stay', ko: '숙박 일정' })} locale={locale} value={stay} onChange={setStay} unit="nights" labels={{ start: t({ en: 'check-in', ko: '체크인' }), end: t({ en: 'check-out', ko: '체크아웃' }) }} minLength={1} maxLength={14}
              min={new Date()} max={maxDate} isDateDisabled={(d) => soldOut(d)} name="stay" helperText={t({ en: 'Up to 14 nights · struck-through nights are full', ko: '최대 14박 · 줄 그은 날은 만실' })} />
            <DateRangePicker label={t({ en: 'Holiday', ko: '휴가 기간' })} locale={locale} value={trip} onChange={setTrip} maxLength={29} helperText={t({ en: 'Up to 30 days', ko: '최대 30일' })} />
            <DateRangePicker label={t({ en: 'Report period', ko: '보고서 기간' })} locale={locale} value={report} onChange={setReport} max={new Date()} defaultMonth={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)} helperText={t({ en: 'Up to today', ko: '오늘까지' })} />
            <Stack direction="row" gap={8} wrap>
              {([[t({ en: 'Last 7 days', ko: '최근 7일' }), 6], [t({ en: 'Last 30 days', ko: '최근 30일' }), 29]] as const).map(([l, n]) => {
                const end = new Date(); end.setHours(12, 0, 0, 0); const start = new Date(end); start.setDate(end.getDate() - n);
                return <Button key={l} size="sm" variant="tinted" onClick={() => setReport({ start, end })}>{l}</Button>;
              })}
              <Button size="sm" variant="plain" onClick={() => setReport(null)}>{t({ en: 'Clear', ko: '지우기' })}</Button>
            </Stack>
            <Text variant="footnote" tone="secondary">{report
              ? t({ en: `Report: ${report.start.toLocaleDateString(locale)} – ${report.end.toLocaleDateString(locale)}`, ko: `보고서: ${report.start.toLocaleDateString(locale)} – ${report.end.toLocaleDateString(locale)}` })
              : t({ en: 'No report period', ko: '보고서 기간 없음' })}{t({ en: ' · The value can also change from outside, as the quick buttons do.', ko: ' · 빠른 선택 버튼처럼 바깥에서 값을 바꿀 수도 있습니다.' })}</Text>
          </Demo>
          <Demo center data-demo="range-calendar">
            <RangeCalendar aria-label={t({ en: 'Trip dates', ko: '여행 일정' })} locale={locale} unit="nights" labels={{ start: t({ en: 'departure', ko: '가는 날' }), end: t({ en: 'return', ko: '오는 날' }) }} minLength={1} min={new Date()} />
          </Demo>
        </div>
        <Usage example={DateRangeExample} code={dateRangeSrc} />
      </Section>

      <Section title={t({ en: 'Time and weekdays', ko: '시간과 요일' })} intro={<L
        en="Times are chosen on wheels. A flick rolls on with momentum and stops on a row; with a mouse, drag, scroll or press a row. From the keyboard, the up and down arrows move one row, PageUp/PageDown several, and typing a number goes to it. AM/PM and where it sits follow the language. The weekday picker is a row of round toggles for choosing several days, shaped like the calendar's days. describeWeekdays puts the chosen days into words, such as ‘Weekdays’, ‘Weekends’ or ‘Mon, Wed, Fri’."
        ko="시간은 휠로 선택합니다. 손가락으로 튕기면 관성대로 굴러가 한 칸에 멈추고, 마우스로는 끌거나 휠을 스크롤하거나 칸을 누릅니다. 키보드로는 위아래 방향키로 한 칸, PageUp/PageDown으로 여러 칸 이동하고, 숫자를 입력하면 그 값으로 이동합니다. 오전/오후와 그 순서는 언어 설정을 따릅니다. 요일 선택기는 여러 개를 선택하는 둥근 토글로, 달력의 날짜와 같은 모양입니다. describeWeekdays는 선택한 요일을 ‘주중’, ‘주말’, ‘월, 수, 금’처럼 말로 바꿔 줍니다." />}>
        <div className="grid grid--2">
          <Demo col data-demo="time">
            <TimePicker label={t({ en: 'Meeting starts', ko: '회의 시작' })} locale={locale} value={meet} onChange={setMeet} minuteStep={5} name="meet" helperText={t({ en: 'In 5-minute steps', ko: '5분 단위' })} />
            <TimePicker label={t({ en: '24-hour clock', ko: '24시간제' })} locale={locale} hour12={false} defaultValue="18:45" />
            <TimePicker label={t({ en: 'Korean (ko-KR)', ko: '영어 표기 (en-US)' })} locale={otherLocale} defaultValue="21:15" />
            <WeekdayPicker aria-label={t({ en: 'Opening days', ko: '영업일' })} locale={locale} defaultValue={[1, 2, 3, 4, 5]} weekStartsOn={1} size="sm" />
          </Demo>
          <Demo col data-demo="alarm">
            <ListSection header={t({ en: 'Alarm', ko: '알람' })} footer={t({ en: `Repeat: ${describeWeekdays(al.days, { locale })}`, ko: `반복: ${describeWeekdays(al.days, { locale })}` })}>
              <List>
                <ListItem title={<span className="alarm-time" style={{ opacity: al.on ? 1 : 0.5 }}>{new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, +al.time.slice(0, 2), +al.time.slice(3)))}</span>}
                  trailing={<Switch checked={al.on} onChange={(on) => putAlarm({ on })} aria-label={t({ en: 'Alarm on', ko: '알람 켜기' })} />} />
              </List>
            </ListSection>
            <TimeWheel aria-label={t({ en: 'Alarm time', ko: '알람 시간' })} locale={locale} value={al.time} onChange={(time) => putAlarm({ time })} disabled={!al.on} />
            <WeekdayPicker aria-label={t({ en: 'Repeat on', ko: '반복 요일' })} locale={locale} value={al.days} onChange={(days) => putAlarm({ days })} disabled={!al.on} style={{ marginInline: 'auto' }} />
          </Demo>
        </div>
      </Section>
    </Page>
  );
}

function useCities() {
  const t = useT();
  return [
    { label: t({ en: 'Seoul area', ko: '수도권' }), options: [{ value: 'seoul', label: t({ en: 'Seoul', ko: '서울' }) }, { value: 'incheon', label: t({ en: 'Incheon', ko: '인천' }) }, { value: 'suwon', label: t({ en: 'Suwon', ko: '수원' }) }, { value: 'seongnam', label: t({ en: 'Seongnam', ko: '성남' }) }, { value: 'goyang', label: t({ en: 'Goyang', ko: '고양' }) }, { value: 'yongin', label: t({ en: 'Yongin', ko: '용인' }) }] },
    { label: t({ en: 'Chungcheong · Gangwon', ko: '충청 · 강원' }), options: [{ value: 'daejeon', label: t({ en: 'Daejeon', ko: '대전' }) }, { value: 'sejong', label: t({ en: 'Sejong', ko: '세종' }) }, { value: 'cheongju', label: t({ en: 'Cheongju', ko: '청주' }) }, { value: 'chuncheon', label: t({ en: 'Chuncheon', ko: '춘천' }) }, { value: 'gangneung', label: t({ en: 'Gangneung', ko: '강릉' }) }] },
    { label: t({ en: 'Yeongnam', ko: '영남' }), options: [{ value: 'busan', label: t({ en: 'Busan', ko: '부산' }) }, { value: 'daegu', label: t({ en: 'Daegu', ko: '대구' }) }, { value: 'ulsan', label: t({ en: 'Ulsan', ko: '울산' }) }, { value: 'pohang', label: t({ en: 'Pohang', ko: '포항' }) }, { value: 'gyeongju', label: t({ en: 'Gyeongju', ko: '경주' }) }, { value: 'changwon', label: t({ en: 'Changwon', ko: '창원' }) }] },
    { label: t({ en: 'Honam · Jeju', ko: '호남 · 제주' }), options: [{ value: 'gwangju', label: t({ en: 'Gwangju', ko: '광주' }) }, { value: 'jeonju', label: t({ en: 'Jeonju', ko: '전주' }) }, { value: 'yeosu', label: t({ en: 'Yeosu', ko: '여수' }) }, { value: 'mokpo', label: t({ en: 'Mokpo', ko: '목포' }), disabled: true }, { value: 'jeju', label: t({ en: 'Jeju', ko: '제주' }) }, { value: 'seogwipo', label: t({ en: 'Seogwipo', ko: '서귀포' }) }] },
  ];
}
function usePeople() {
  const t = useT();
  return [
    ['jimin', t({ en: 'Jimin Park', ko: '박지민' }), t({ en: 'Design', ko: '디자인' })], ['sora', t({ en: 'Sora Lee', ko: 'Lee Sora' }), t({ en: 'Frontend', ko: '프론트엔드' })],
    ['haneul', t({ en: 'Haneul Kim', ko: '김하늘' }), t({ en: 'Product', ko: '제품' })], ['yuna', t({ en: 'Yuna Choi', ko: 'Choi Yuna' }), t({ en: 'Data', ko: '데이터' })],
    ['daon', t({ en: 'Daon Jung', ko: '정다온' }), t({ en: 'Backend', ko: '백엔드' })],
  ] as const;
}
function useComboLabels() {
  const t = useT();
  return { empty: t({ en: 'No matches', ko: '맞는 항목이 없어요' }), loading: t({ en: 'Searching…', ko: '찾는 중…' }), clear: t({ en: 'Clear', ko: '지우기' }), toggle: t({ en: 'Show options', ko: '목록 보기' }) };
}

function Combos() {
  const t = useT(), d = useData();
  const CITIES = useCities(), PEOPLE = usePeople(), COMBO_LABELS = useComboLabels();
  const [city, setCity] = useState<string | null>('busan');
  const [owner, setOwner] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>(['seoul', 'busan']);
  const [teams, setTeams] = useState<string[]>(['seoul', 'busan', 'daegu']);
  /* a server search: the options come already filtered, a moment later */
  const [q, setQ] = useState('');
  const [product, setProduct] = useState<string | null>(null);
  const [found, setFound] = useState(d.PRODUCTS.slice(0, 8));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    const id = setTimeout(() => { const k = q.trim().toLocaleLowerCase(d.locale); setFound(d.PRODUCTS.filter((x) => !k || x.name.toLocaleLowerCase(d.locale).includes(k)).slice(0, 8)); setBusy(false); }, 450);
    return () => clearTimeout(id);
  }, [q, d]);
  const chosen = d.PRODUCTS.find((x) => x.id === product)?.name;
  return (
    <Section title={t({ en: 'Combobox', ko: '콤보박스 (Combobox)' })} intro={<L
      en='A list that keeps only the options matching what is typed. Focus stays in the field while ↑↓ move through the options and Enter chooses, and the typed part is underlined in each option. Esc, or moving focus away, brings back the name of the value already chosen; leaving the field empty clears the value. While a character is being composed (as in Korean), Enter and the arrows belong to the input method. The list grows from the same panel as a select, and as typing filters it, the panel stays put and only the options change. When a server does the filtering, filter="none" shows the options as they arrive, and a status line outside the list says when it is searching or has found nothing.'
      ko="입력하면 맞는 항목만 남는 목록입니다. 포커스는 입력란에 둔 채 ↑↓로 항목 사이를 이동하고 Enter로 선택하며, 입력한 부분은 항목에서 밑줄로 표시합니다. Esc를 누르거나 포커스를 밖으로 옮기면 이미 선택한 값의 이름으로 돌아가고, 입력란을 비운 채 벗어나면 값이 지워집니다. 한글처럼 글자를 조합하는 동안에는 Enter와 방향키를 입력기에 맡깁니다. 목록은 셀렉트와 같은 패널에서 피어나고, 입력에 따라 필터링될 때는 패널은 그대로 두고 항목만 바뀝니다. 서버에서 필터링하는 목록은 filter=&quot;none&quot;으로 받은 그대로 보여 주고, 검색 중과 결과 없음은 목록 밖의 상태 줄로 알립니다." />}>
      <div className="grid grid--2">
        <Demo col data-demo="combobox">
          <Combobox label={t({ en: 'City', ko: '도시' })} placeholder={t({ en: 'City name', ko: '도시 이름' })} options={CITIES} value={city} onChange={setCity} labels={COMBO_LABELS} helperText={t({ en: 'Mokpo is unavailable right now', ko: '목포는 지금 고를 수 없어요' })} name="city" />
          <Combobox label={t({ en: 'Owner', ko: '담당자' })} placeholder={t({ en: 'Name or team', ko: '이름 또는 팀' })} value={owner} onChange={setOwner} labels={COMBO_LABELS}
            options={PEOPLE.map(([value, name, team]) => ({ value, label: name, description: team, icon: <Avatar name={name} size={24} /> }))}
            filter={(o, text) => `${o.label} ${o.description}`.toLocaleLowerCase().includes(text.toLocaleLowerCase())} />
          <Combobox label={t({ en: 'Disabled', ko: '비활성' })} options={CITIES} defaultValue="seoul" disabled labels={COMBO_LABELS} />
        </Demo>
        <Demo col data-demo="combobox-server">
          <Combobox label={t({ en: 'Find a product', ko: '상품 찾기' })} placeholder={t({ en: 'Product name', ko: '상품 이름' })} labels={COMBO_LABELS} filter="none" loading={busy}
            inputValue={q} onInputChange={(text) => setQ(text)} value={product} onChange={setProduct}
            getOptionText={(id) => d.PRODUCTS.find((x) => x.id === id)?.name ?? id}
            options={found.map((x) => ({ value: x.id, label: x.name, description: t({ en: d.won(x.price), ko: `${x.price.toLocaleString('ko-KR')}원` }) }))} />
          <Text variant="footnote" tone="secondary">{product ? t({ en: `Chosen: ${chosen}`, ko: `선택한 상품: ${chosen}` }) : t({ en: 'No product chosen', ko: '선택한 상품 없음' })}{t({ en: ' · Results arrive 0.45 s later, as if from a server.', ko: ' · 서버 검색을 흉내 내 0.45초 뒤에 결과가 옵니다.' })}</Text>
        </Demo>
        <Demo col data-demo="combobox-multiple">
          <Combobox multiple label={t({ en: 'Cities to visit', ko: '방문할 도시' })} placeholder={t({ en: 'City name', ko: '도시 이름' })} options={CITIES} value={cities} onChange={setCities} labels={{ ...COMBO_LABELS, remove: (text) => t({ en: `Remove ${text}`, ko: `${text} 제거` }) }} name="cities" />
          <Combobox multiple aria-label={t({ en: 'Filter: city', ko: '필터: 도시' })} placeholder={t({ en: 'City', ko: '도시' })} maxChips={1} options={CITIES} value={teams} onChange={setTeams} labels={{ ...COMBO_LABELS, count: (n) => t({ en: `${n} cities`, ko: `도시 ${n}곳` }) }} style={{ width: 220 }} />
          <Text variant="footnote" tone="secondary"><L
            en="Multiple selection (multiple): choosing keeps the list open, and chosen values become chips. Backspace in an empty field removes the last chip. Where the field must stay one line high, as in a filter bar, maxChips shows a count instead of chips once more values than that are chosen."
            ko="다중 선택(multiple): 선택해도 목록이 열린 채로 남고, 선택한 값은 칩이 됩니다. 입력란이 비어 있을 때 Backspace를 누르면 마지막 칩이 지워집니다. 필터 바처럼 높이가 한 줄이어야 하면 maxChips를 주어, 그보다 많이 선택했을 때 칩 대신 개수를 보여 줍니다." /></Text>
        </Demo>
      </div>
      <Usage example={ComboboxExample} code={comboboxSrc} />
    </Section>
  );
}
