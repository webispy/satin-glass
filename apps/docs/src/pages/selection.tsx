import { useState } from 'react';
import {
  Button, Calendar, Checkbox, ChoiceList, DatePicker, List, ListItem, ListSection, Radio, RadioGroup, Select, Stack, Switch, Text, TimePicker, TimeWheel,
  WeekdayPicker, describeWeekdays, useToast,
} from '@satin-glass/react';
import { Bike, Car, Footprints, Train, Moon, Sun, Monitor, Wifi, Bell, MapPin } from 'lucide-react';
import { Demo, Page, Section } from '../shared';

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
  const putAlarm = (patch: Partial<typeof al>) => setAl((a) => ({ ...a, ...patch }));
  const [fCat, setFCat] = useState('all'), [fSort, setFSort] = useState('new'), [fShip, setFShip] = useState('all');
  const toast = useToast();
  const all = am.length === AMENITIES.length, some = am.length > 0 && !all;
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
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
            <TimeWheel aria-label="알람 시간" value={al.time} onChange={(time) => putAlarm({ time })} />
            <WeekdayPicker aria-label="반복 요일" value={al.days} onChange={(days) => putAlarm({ days })} style={{ marginInline: 'auto' }} />
          </Demo>
        </div>
      </Section>
    </Page>
  );
}
