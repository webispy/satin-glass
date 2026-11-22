import { useEffect, useState } from 'react';
import {
  Avatar, Button, Calendar, Checkbox, ChoiceList, Combobox, DatePicker, DateRangePicker, RangeCalendar, type DateRange, List, ListItem, ListSection, Radio, RadioGroup, Select, Stack, Switch, Text, TimePicker, TimeWheel,
  WeekdayPicker, describeWeekdays, useToast,
} from '@satin-glass/react';
import { Bike, Car, Footprints, Train, Moon, Sun, Monitor, Wifi, Bell, MapPin } from 'lucide-react';
import { Demo, Page, Section } from '../shared';
import { PRODUCTS } from '../data';

const AMENITIES = [['parking', '주차장'], ['pets', '반려동물 동반'], ['toilet', '화장실'], ['night', '야간 개방']] as const;

export function Selection() {
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
  return (
    <Page title="선택" intro="체크박스, 라디오, 선택 목록, 셀렉트, 달력. 체크박스와 라디오는 실제 input이라 폼 제출·키보드·스크린 리더가 그대로 동작하고, 셀렉트와 달력은 WAI-ARIA 패턴(콤보박스·날짜 그리드)을 따릅니다.">
      <Section title="체크박스" intro="체크 표시가 그려지고(snappy), 일부만 선택된 상태(미정)를 표시할 수 있어요.">
        <div className="grid grid--2">
          <Demo col>
            <Checkbox label="편의시설 모두" indeterminate={some} checked={all} onChange={(on) => setAm(on ? AMENITIES.map(([k]) => k) : [])} />
            <Stack gap={3} style={{ paddingLeft: 32 }}>
              {AMENITIES.map(([k, l]) => <Checkbox key={k} label={l} checked={am.includes(k)} onChange={(on) => setAm((x) => (on ? [...x, k] : x.filter((y) => y !== k)))} />)}
            </Stack>
          </Demo>
          <Demo col>
            <Checkbox label="이용 약관에 동의" description="장소 정보는 커뮤니티 기여로 갱신됩니다." checked={agree} onChange={setAgree} />
            <Checkbox label="마케팅 수신 (선택)" defaultChecked />
            <Checkbox label="비활성" disabled />
            <Button variant="filled" disabled={!agree} onClick={() => toast({ title: '저장했어요', tone: 'success' })}>계속</Button>
          </Demo>
        </div>
      </Section>

      <Section title="라디오" intro="방향키로 옮기면 바로 선택되고, Tab은 선택된 항목으로 들어옵니다. 점이 자라며 채워져요.">
        <Demo>
          <RadioGroup label="이동 수단" value={mode} onChange={setMode}>
            <Radio value="walk" label="도보" description="계단·오르막 포함" />
            <Radio value="bike" label="자전거" />
            <Radio value="car" label="자동차" />
            <Radio value="boat" label="배 (운항 중단)" disabled />
          </RadioGroup>
          <RadioGroup label="단위" direction="row" value={unit} onChange={setUnit}>
            <Radio value="km" label="킬로미터" /><Radio value="mi" label="마일" />
          </RadioGroup>
        </Demo>
      </Section>

      <Section title="선택 목록" intro="설정 화면처럼 목록의 행이 곧 선택지입니다. 하나만 고르거나(radiogroup) 여러 개를 고를 수 있어요(체크박스 묶음).">
        <div className="grid grid--2">
          <ListSection header="화면 모드">
            <ChoiceList aria-label="화면 모드" value={appearance} onChange={setAppearance} options={[
              { value: 'light', label: '라이트', icon: <Sun />, tileColor: 'var(--sg-amber-500)' },
              { value: 'dark', label: '다크', icon: <Moon />, tileColor: 'var(--sg-iris-700)' },
              { value: 'system', label: '시스템 설정', description: '기기 설정을 따라요', icon: <Monitor />, tileColor: 'var(--sg-slate-500)' },
            ]} />
          </ListSection>
          <ListSection header="알림 받을 항목" footer={`${notif.length}개 선택`}>
            <ChoiceList multiple aria-label="알림 받을 항목" value={notif} onChange={setNotif} options={[
              { value: 'sunset', label: '일몰 30분 전' },
              { value: 'weather', label: '날씨 경보' },
              { value: 'nearby', label: '가까운 새 장소' },
              { value: 'beta', label: '베타 기능', description: '준비 중', disabled: true },
            ]} />
          </ListSection>
        </div>
      </Section>

      <Section title="셀렉트" intro="포커스는 버튼에 둔 채 ↑↓로 고르고, 글자를 치면 그 글자로 시작하는 항목으로 갑니다. 목록은 버튼에서 피어나요.">
        <div className="grid grid--2">
          <Demo col>
            <Select label="이동 수단" value={mode} onChange={setMode} options={[
              { value: 'walk', label: '도보', icon: <Footprints /> },
              { value: 'bike', label: '자전거', icon: <Bike /> },
              { value: 'car', label: '자동차', icon: <Car />, description: '주차 가능한 곳만' },
              { value: 'train', label: '기차', icon: <Train />, disabled: true },
            ]} />
            <Select label="지역" placeholder="지역 선택" value={region} onChange={setRegion} helperText="장소 목록이 이 지역으로 좁혀져요" name="region" options={[
              { label: '수도권', options: [{ value: 'seoul', label: '서울' }, { value: 'incheon', label: '인천' }, { value: 'gyeonggi', label: '경기' }] },
              { label: '강원·충청', options: [{ value: 'gangwon', label: '강원' }, { value: 'chungbuk', label: '충북' }, { value: 'chungnam', label: '충남' }, { value: 'daejeon', label: '대전' }] },
              { label: '영남', options: [{ value: 'busan', label: '부산' }, { value: 'daegu', label: '대구' }, { value: 'ulsan', label: '울산' }, { value: 'gyeongbuk', label: '경북' }, { value: 'gyeongnam', label: '경남' }] },
              { label: '호남·제주', options: [{ value: 'gwangju', label: '광주' }, { value: 'jeonbuk', label: '전북' }, { value: 'jeonnam', label: '전남' }, { value: 'jeju', label: '제주' }] },
            ]} />
            <Select label="필수 항목" placeholder="선택하세요" error="하나를 골라 주세요" options={[{ value: 'a', label: '가' }, { value: 'b', label: '나' }]} />
          </Demo>
          <Demo col>
            <Text variant="subhead" tone="secondary">목록 행 안에서 (inline)</Text>
            <List>
              <ListItem leading={<MapPin />} tileColor="var(--sg-coral-500)" title="거리 단위" trailing={<Select variant="inline" aria-label="거리 단위" value={unit} onChange={setUnit} options={[{ value: 'km', label: '킬로미터' }, { value: 'mi', label: '마일' }]} />} />
              <ListItem leading={<Wifi />} tileColor="var(--sg-azure-500)" title="지도 다운로드" trailing={<Select variant="inline" aria-label="지도 다운로드" defaultValue="wifi" options={[{ value: 'wifi', label: 'Wi‑Fi에서만' }, { value: 'always', label: '항상' }, { value: 'never', label: '안 함' }]} />} />
              <ListItem leading={<Bell />} tileColor="var(--sg-rose-500)" title="소리" trailing={<Select variant="inline" aria-label="소리" defaultValue="chime" placement="bottom-end" options={[{ value: 'chime', label: '차임' }, { value: 'bell', label: '종' }, { value: 'none', label: '없음' }]} />} />
            </List>
          </Demo>
        </div>
      </Section>

      <Section title="필터 셀렉트" intro="목록이나 표 위에 늘어놓는 작은 알약형 셀렉트입니다(variant=&quot;filter&quot;). ‘분류 전체’처럼 이름과 지금 값을 함께 보여 주고, 스크린 리더도 그렇게 읽습니다. 고르는 방식은 일반 셀렉트와 같습니다.">
        <Demo data-demo="filter-select">
          <Select variant="filter" label="분류" value={fCat} onChange={setFCat} options={[{ value: 'all', label: '전체' }, { value: 'wear', label: '의류' }, { value: 'home', label: '생활' }, { value: 'kitchen', label: '주방' }, { value: 'digital', label: '디지털' }]} />
          <Select variant="filter" label="배송" value={fShip} onChange={setFShip} options={[{ value: 'all', label: '전체' }, { value: 'today', label: '오늘 출발' }, { value: 'free', label: '무료 배송' }]} />
          <Select variant="filter" label="정렬" value={fSort} onChange={setFSort} options={[{ value: 'new', label: '최신순' }, { value: 'sold', label: '판매량순' }, { value: 'low', label: '낮은 가격순' }, { value: 'high', label: '높은 가격순' }]} />
        </Demo>
      </Section>

      <Section title="날짜" intro="방향키로 하루·한 주, PageUp/PageDown으로 한 달(Shift는 1년)씩 움직입니다. 위쪽의 연도·월 칩은 언어가 쓰는 순서대로 놓여요(한국어는 ‘2026년 11월’, 영어는 ‘November 2026’). 칩을 누르면 그 자리에 열두 달, 또는 모든 연도를 담은 스크롤 격자가 피어나고, 연도 격자에서 1·9·8·0을 차례로 치면 1980년으로 갑니다. 연도를 고르면 달로, 달을 고르면 날짜로 이어집니다. 생년월일처럼 먼 과거가 보통인 칸은 연도부터 열고(openTo=&quot;year&quot;), 처음 보여 줄 달(defaultMonth)을 정할 수 있어요. 휠이 편한 화면에서는 monthPicker=&quot;wheel&quot;로 연도·월 휠을 엽니다.">
        <div className="grid grid--2">
          <Demo col data-demo="date">
            <DatePicker label="생년월일" value={birth} onChange={setBirth} openTo="year" defaultMonth={new Date(1990, 0, 1)} min={new Date(1920, 0, 1)} max={new Date()} name="birth" helperText="연도 → 월 → 날짜 순서로" />
            <DatePicker label="생년월일 (휠로 고르기)" monthPicker="wheel" openTo="month" defaultMonth={new Date(1990, 0, 1)} min={new Date(1920, 0, 1)} max={new Date()} helperText="monthPicker=&quot;wheel&quot;" />
            <DatePicker label="방문 날짜" value={date} onChange={setDate} min={new Date()} max={maxDate} helperText="오늘부터 3개월 안" name="visit" />
            <DatePicker label="주말만 (평일 선택 불가)" isDateDisabled={(d) => d.getDay() !== 0 && d.getDay() !== 6} />
            <DatePicker label="English, Monday first" locale="en-US" weekStartsOn={1} />
          </Demo>
          <Demo center data-demo="calendar">
            <Calendar value={cal} onChange={setCal} aria-label="달력" />
          </Demo>
        </div>
      </Section>

      <Combos />

      <Section title="기간" intro="시작과 끝, 두 날짜를 고릅니다. 첫 번째로 누른 날이 시작, 두 번째가 끝이에요. 끝을 고르는 동안에는 시작부터 포인터(또는 키보드 포커스)가 있는 날까지 홈 안의 옅은 띠가 스프링을 타고 따라 흐르고, 끝을 고르면 끝 날짜의 구슬이 가운데에서 차오릅니다. 시작보다 앞선 날이나 닿을 수 없는 날(최대 길이를 넘거나, 중간에 고를 수 없는 날이 끼어 있는 경우)을 누르면 그 날부터 다시 시작해요. 아래 줄은 지금 무엇을 고를 차례인지와 기간의 길이(‘2박 3일’ 또는 ‘3일’)를 알려 줍니다.">
        <div className="grid grid--2">
          <Demo col data-demo="range">
            <DateRangePicker label="숙박 일정" value={stay} onChange={setStay} unit="nights" labels={{ start: '체크인', end: '체크아웃' }} minLength={1} maxLength={14}
              min={new Date()} max={maxDate} isDateDisabled={(d) => soldOut(d)} name="stay" helperText="최대 14박 · 줄 그은 날은 만실" />
            <DateRangePicker label="휴가 기간" value={trip} onChange={setTrip} maxLength={29} helperText="최대 30일" />
            <DateRangePicker label="보고서 기간" value={report} onChange={setReport} max={new Date()} defaultMonth={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)} helperText="오늘까지" />
            <Stack direction="row" gap={8} wrap>
              {([['최근 7일', 6], ['최근 30일', 29]] as const).map(([l, n]) => {
                const end = new Date(); end.setHours(12, 0, 0, 0); const start = new Date(end); start.setDate(end.getDate() - n);
                return <Button key={l} size="sm" variant="tinted" onClick={() => setReport({ start, end })}>{l}</Button>;
              })}
              <Button size="sm" variant="plain" onClick={() => setReport(null)}>지우기</Button>
            </Stack>
            <Text variant="footnote" tone="secondary">{report ? `보고서: ${report.start.toLocaleDateString('ko-KR')} – ${report.end.toLocaleDateString('ko-KR')}` : '보고서 기간 없음'} · 빠른 선택 버튼처럼 바깥에서 값을 바꿀 수도 있어요.</Text>
          </Demo>
          <Demo center data-demo="range-calendar">
            <RangeCalendar aria-label="여행 일정" unit="nights" labels={{ start: '가는 날', end: '오는 날' }} minLength={1} min={new Date()} />
          </Demo>
        </div>
      </Section>

      <Section title="시간과 요일" intro="시간은 휠로 고릅니다. 손가락으로 튕기면 관성대로 굴러가 한 칸에 멈추고, 마우스는 끌거나 휠을 굴리거나 칸을 누르면 됩니다. 키보드는 위아래로 한 칸, PageUp/PageDown으로 여러 칸, 숫자를 치면 그 값으로 갑니다. 오전/오후와 그 순서는 언어 설정을 따릅니다. 요일은 여러 개를 고르는 둥근 토글로, 달력의 날짜와 같은 모양입니다. describeWeekdays는 고른 요일을 ‘주중’, ‘주말’, ‘월, 수, 금’처럼 말로 바꿔 줍니다.">
        <div className="grid grid--2">
          <Demo col data-demo="time">
            <TimePicker label="회의 시작" value={meet} onChange={setMeet} minuteStep={5} name="meet" helperText="5분 단위" />
            <TimePicker label="24시간제" hour12={false} defaultValue="18:45" />
            <TimePicker label="영어 표기 (en-US)" locale="en-US" defaultValue="21:15" />
            <WeekdayPicker aria-label="영업일" defaultValue={[1, 2, 3, 4, 5]} weekStartsOn={1} size="sm" />
          </Demo>
          <Demo col data-demo="alarm">
            <ListSection header="알람" footer={`반복: ${describeWeekdays(al.days)}`}>
              <List>
                <ListItem title={<span className="alarm-time" style={{ opacity: al.on ? 1 : 0.5 }}>{new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, +al.time.slice(0, 2), +al.time.slice(3)))}</span>}
                  trailing={<Switch checked={al.on} onChange={(on) => putAlarm({ on })} aria-label="알람 켜기" />} />
              </List>
            </ListSection>
            <TimeWheel aria-label="알람 시간" value={al.time} onChange={(time) => putAlarm({ time })} disabled={!al.on} />
            <WeekdayPicker aria-label="반복 요일" value={al.days} onChange={(days) => putAlarm({ days })} disabled={!al.on} style={{ marginInline: 'auto' }} />
          </Demo>
        </div>
      </Section>
    </Page>
  );
}

const CITIES = [
  { label: '수도권', options: [{ value: 'seoul', label: '서울' }, { value: 'incheon', label: '인천' }, { value: 'suwon', label: '수원' }, { value: 'seongnam', label: '성남' }, { value: 'goyang', label: '고양' }, { value: 'yongin', label: '용인' }] },
  { label: '충청 · 강원', options: [{ value: 'daejeon', label: '대전' }, { value: 'sejong', label: '세종' }, { value: 'cheongju', label: '청주' }, { value: 'chuncheon', label: '춘천' }, { value: 'gangneung', label: '강릉' }] },
  { label: '영남', options: [{ value: 'busan', label: '부산' }, { value: 'daegu', label: '대구' }, { value: 'ulsan', label: '울산' }, { value: 'pohang', label: '포항' }, { value: 'gyeongju', label: '경주' }, { value: 'changwon', label: '창원' }] },
  { label: '호남 · 제주', options: [{ value: 'gwangju', label: '광주' }, { value: 'jeonju', label: '전주' }, { value: 'yeosu', label: '여수' }, { value: 'mokpo', label: '목포', disabled: true }, { value: 'jeju', label: '제주' }, { value: 'seogwipo', label: '서귀포' }] },
];
const PEOPLE = [['jimin', '박지민', '디자인'], ['sora', 'Lee Sora', '프론트엔드'], ['haneul', '김하늘', '제품'], ['yuna', 'Choi Yuna', '데이터'], ['daon', '정다온', '백엔드']] as const;
const COMBO_LABELS = { empty: '맞는 항목이 없어요', loading: '찾는 중…', clear: '지우기', toggle: '목록 보기' };

function Combos() {
  const [city, setCity] = useState<string | null>('busan');
  const [owner, setOwner] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>(['seoul', 'busan']);
  const [teams, setTeams] = useState<string[]>(['seoul', 'busan', 'daegu']);
  /* a server search: the options come already filtered, a moment later */
  const [q, setQ] = useState('');
  const [product, setProduct] = useState<string | null>(null);
  const [found, setFound] = useState(PRODUCTS.slice(0, 8));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    const t = setTimeout(() => { const k = q.trim(); setFound(PRODUCTS.filter((x) => !k || x.name.includes(k)).slice(0, 8)); setBusy(false); }, 450);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Section title="콤보박스 (Combobox)" intro="입력하면 맞는 항목만 남는 목록입니다. 포커스는 입력란에 둔 채 ↑↓로 옮기고 Enter로 고르며, 입력한 부분은 항목에서 밑줄로 보여 줘요. Esc를 누르거나 다른 곳으로 옮기면 이미 고른 값의 이름으로 돌아가고, 입력란을 비우고 떠나면 값이 지워집니다. 한글처럼 글자를 조합하는 동안에는 Enter와 화살표를 입력기에 맡깁니다. 목록은 셀렉트와 같은 패널에서 피어나고, 거를 때는 줄만 바뀝니다. 서버에서 거르는 목록은 filter=&quot;none&quot;으로 받은 그대로 보여 주고, 찾는 중과 결과 없음은 목록 밖의 상태 줄로 알려요.">
      <div className="grid grid--2">
        <Demo col data-demo="combobox">
          <Combobox label="도시" placeholder="도시 이름" options={CITIES} value={city} onChange={setCity} labels={COMBO_LABELS} helperText="목포는 지금 고를 수 없어요" name="city" />
          <Combobox label="담당자" placeholder="이름 또는 팀" value={owner} onChange={setOwner} labels={COMBO_LABELS}
            options={PEOPLE.map(([value, name, team]) => ({ value, label: name, description: team, icon: <Avatar name={name} size={24} /> }))}
            filter={(o, t) => `${o.label} ${o.description}`.toLocaleLowerCase().includes(t.toLocaleLowerCase())} />
          <Combobox label="사용할 수 없음" options={CITIES} defaultValue="seoul" disabled labels={COMBO_LABELS} />
        </Demo>
        <Demo col data-demo="combobox-server">
          <Combobox label="상품 찾기" placeholder="상품 이름" labels={COMBO_LABELS} filter="none" loading={busy}
            inputValue={q} onInputChange={(t) => setQ(t)} value={product} onChange={setProduct}
            getOptionText={(id) => PRODUCTS.find((x) => x.id === id)?.name ?? id}
            options={found.map((x) => ({ value: x.id, label: x.name, description: `${x.price.toLocaleString('ko-KR')}원` }))} />
          <Text variant="footnote" tone="secondary">{product ? `고른 상품: ${PRODUCTS.find((x) => x.id === product)?.name}` : '고른 상품 없음'} · 서버 검색을 흉내 내 0.45초 뒤에 결과가 와요.</Text>
        </Demo>
        <Demo col data-demo="combobox-multiple">
          <Combobox multiple label="방문할 도시" placeholder="도시 이름" options={CITIES} value={cities} onChange={setCities} labels={{ ...COMBO_LABELS, remove: (t) => `${t} 빼기` }} name="cities" />
          <Combobox multiple aria-label="필터: 도시" placeholder="도시" maxChips={1} options={CITIES} value={teams} onChange={setTeams} labels={{ ...COMBO_LABELS, count: (n) => `도시 ${n}곳` }} style={{ width: 220 }} />
          <Text variant="footnote" tone="secondary">여러 개(multiple): 고르면 목록이 열린 채로 남고, 고른 값은 칩이 됩니다. 입력란이 비었을 때 Backspace는 마지막 칩을 지워요. 필터 줄처럼 한 줄을 지켜야 하면 maxChips로 그보다 많이 고를 때 칩 대신 개수를 보여 줍니다.</Text>
        </Demo>
      </div>
    </Section>
  );
}
