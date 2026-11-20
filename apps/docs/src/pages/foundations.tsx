import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { contrast, palette, STEPS, motions, springAt, springDuration, typography, SPRING_NAMES, type Hue, type MotionName, type SpringName } from '@satin-glass/tokens';
import { Button, Card, CardBody, Glass, Stack, Text, SegmentedControl, Switch, Slider, Stepper, Progress, PageControl, TabBar, Tab, MotionScope, Menu, MenuItem, Badge, useTheme } from '@satin-glass/react';
import { Home, Map, Bookmark, User, Footprints, Bike, Car } from 'lucide-react';
import { Sun, Sparkles, MousePointer2 } from 'lucide-react';
import { Demo, Page, Photo, Section, sceneTint } from '../shared';

export function Overview() {
  return (
    <Page title="Satin Glass" intro="빛을 부드럽게 흩뜨리는 새틴 유리 위에 만든 React UI 라이브러리. 작은 움직임 하나까지 손끝에 붙도록, 그리고 누구에게나 같은 매끄러움으로.">
      <Section title="원칙" intro="모든 기초 항목과 컴포넌트의 결정은 이 여섯 가지로 설명할 수 있어야 합니다. 둘이 부딪히면 위에 있는 것을 따릅니다 — 단, 마지막 원칙은 언제나 지켜야 할 바닥입니다.">
        <div className="grid grid--3">
          {[
            ['새틴 유리', '빛을 굴절시키는 맑은 유리가 아니라, 빛을 고르게 흩뜨리는 결 있는 반투명. 뒤의 색과 형태가 부드럽게 비치되, 렌즈처럼 휘지 않습니다.'],
            ['두 개의 빛', '위에서 오는 고정된 빛이 형태를 만듭니다(밝은 윗변, 그늘진 아랫변, 홈과 볼록). 손끝을 따르는 새틴 광택이 생기를 줍니다.'],
            ['표면장력', '선택은 물방울처럼 가는 쪽으로 늘어났다가 도착하면 달라붙습니다. 제 레일을 떠나지 않고, 차분할수록 점성이 높습니다.'],
            ['손끝의 감촉', '눌리는 것은 모두 살짝 들어가고, 손가락 아래로 빛이 모입니다. 잡는 것과 고른 것은 볼록, 그것이 움직이는 길은 홈입니다.'],
            ['작고 드문 기쁨', '한 번의 조작에 눈에 띄는 움직임은 하나. 반복하는 조작(스크롤, 입력)에는 효과를 얹지 않습니다.'],
            ['누구에게나 매끄럽게', '고대비에서는 윤곽선으로, 투명도 줄이기에서는 결 있는 불투명 판으로, 동작 줄이기에서는 짧고 넘치지 않는 움직임으로. 키보드 포커스는 언제나 보이고, 60fps를 지킵니다.'],
          ].map(([t, d]) => (
            <Card key={t} variant="outlined"><CardBody>
              <Text variant="headline">{t}</Text>
              <Text variant="subhead" tone="secondary" style={{ marginTop: 4 }}>{d}</Text>
            </CardBody></Card>
          ))}
        </div>
      </Section>
      <Section title="설치">
        <Demo col>
          <code className="code">pnpm add @satin-glass/react</code>
          <code className="code">import '@satin-glass/react/styles.css'</code>
          <code className="code">{'<ThemeProvider theme={createTheme({ mode: "system" })}>…</ThemeProvider>'}</code>
        </Demo>
      </Section>
    </Page>
  );
}

export function Colors() {
  const sem = ['bg', 'bg-grouped', 'surface', 'label', 'label-secondary', 'label-tertiary', 'separator', 'fill', 'accent', 'accent-soft', 'success', 'warning', 'danger', 'info', 'glass-fill', 'glass-selection'];
  return (
    <Page title="색" intro="OKLCH로 만든 자체 팔레트. 같은 단계(예: 500)는 어떤 색이든 비슷한 밝기에서 출발해 단계마다 밝기 순서가 같습니다. 다만 최종 sRGB 색의 대비는 색마다 다르므로, 글자와 상태 표시에는 단계 번호가 아니라 검사를 통과한 의미 색을 씁니다. 강조색은 보라 쪽으로 기운 파랑 ‘iris’.">
      <Section title="팔레트" intro="11가지 색 × 11단계. 빌드할 때 sRGB 색역 안으로 채도를 맞춥니다. 칸 안의 숫자는 그 색 위에서 더 잘 읽히는 쪽(흰 글자 또는 검은 글자)의 대비입니다(칸에 마우스를 올리면 둘 다). 같은 500 단계라도 jade와 ruby의 흰 글자 대비가 다릅니다.">
        <Demo col>
          <div className="swatches">
            <span />{STEPS.map((s) => <span key={s} style={{ textAlign: 'center' }}>{s}</span>)}
            {(Object.keys(palette) as Hue[]).map((h) => [
              <b key={h} style={{ fontWeight: 600, color: 'var(--sg-label-secondary)' }}>{h}</b>,
              ...STEPS.map((s) => {
                const c = palette[h][s], w = contrast('#ffffff', c), k = contrast('#000000', c), onWhite = w >= k;
                const r = onWhite ? w : k;
                /* the digits are a sample of the swatch itself (the better of white or black text on it); the full
                   figures are in the title and for screen readers */
                return <i key={h + s} className="swatch" style={{ background: c, color: onWhite ? '#fff' : '#000' }} title={`${h}-${s} ${c} · 흰 글자 ${w.toFixed(2)}:1 · 검은 글자 ${k.toFixed(2)}:1`}>
                  <span className="swatch__ratio" aria-hidden="true">{r.toFixed(1)}</span>
                  <span className="sg-visually-hidden">{`${h}-${s}: 흰 글자 ${w.toFixed(1)} 대 1, 검은 글자 ${k.toFixed(1)} 대 1`}</span>
                </i>;
              }),
            ])}
          </div>
        </Demo>
      </Section>
      <Section title="의미 색" intro="테마(라이트·다크·고대비 2종)에 따라 바뀌는 이름. 빌드 시 WCAG 대비를 검사합니다 — 본문 7:1, 보조 텍스트 4.5:1 이상.">
        <div className="grid grid--4">
          {sem.map((k) => (
            <div key={k} className="token-chip"><i style={{ background: `var(--sg-${k})` }} /><span className="code">--sg-{k}</span></div>
          ))}
        </div>
      </Section>
    </Page>
  );
}

export function Typography() {
  return (
    <Page title="타이포그래피" intro="본문 16px(웹 기준), 크기가 커질수록 자간을 좁힙니다. 글꼴은 Pretendard → 시스템 글꼴 순.">
      <Demo col>
        {(Object.keys(typography) as (keyof typeof typography)[]).map((k) => (
          <div key={k} className="label-row" style={{ borderBottom: '1px solid var(--sg-separator)', paddingBottom: 8 }}>
            <Text variant={k} truncate>유리 너머의 풍경 Satin Glass</Text>
            <span className="code" style={{ flex: 'none' }}>{k} · {typography[k][0]}/{typography[k][1]}</span>
          </div>
        ))}
      </Demo>
    </Page>
  );
}

const PERSONAS: { id: MotionName; label: string; note: string }[] = [
  { id: 'calm', label: '차분 calm', note: '눈에 띄는 넘침 없이 멈춤. 업무용·정보 밀도 높은 화면' },
  { id: 'lively', label: '생동 lively (기본)', note: '한 번 살짝 넘쳤다가 자리 잡음. 늘어남·눌림이 적당히' },
  { id: 'playful', label: '경쾌 playful', note: '탄성이 크고 늘어남·납작해짐이 뚜렷함. 소비자 앱·온보딩' },
];

function SpringPlot({ name, motion }: { name: SpringName; motion: MotionName }) {
  const s = motions[motion][name], d = springDuration(s) / 1000, W = 300, H = 110;
  const pts = (m: MotionName) => { const p = motions[m][name], dd = springDuration(p) / 1000; return Array.from({ length: 121 }, (_, i) => { const t = (1.1 * i) / 120; return `${(t / 1.1) * W},${H - 14 - Math.min(1.3, springAt(p, Math.min(t, dd))) * (H - 40)}`; }).join(' '); };
  const [on, setOn] = useState(false);
  return (
    <div className="sg-card" style={{ padding: 14, borderRadius: 'var(--sg-radius-lg)' }}>
      <div className="label-row"><Text variant="headline">{name}</Text><span className="code">{s.response}s · ζ {s.damping} · {Math.round(d * 1000)}ms</span></div>
      <svg className="spring-plot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2={W} y1={26} y2={26} stroke="var(--sg-separator-strong)" strokeDasharray="3 4" />
        {PERSONAS.filter((p) => p.id !== motion).map((p) => <polyline key={p.id} points={pts(p.id)} fill="none" stroke="var(--sg-label-tertiary)" strokeWidth="1.2" opacity="0.5" />)}
        <polyline points={pts(motion)} fill="none" stroke="var(--sg-accent)" strokeWidth="2.5" />
      </svg>
      <div className="label-row" style={{ marginTop: 6 }}>
        <div style={{ flex: 1, height: 18 }}>
          <div className="spring-dot" style={{ transform: on ? 'translateX(200px)' : 'none', transition: `transform var(--sg-spring-${name}-duration) var(--sg-spring-${name})` }} />
        </div>
        <Button size="sm" variant="plain" onClick={() => setOn((v) => !v)}>재생</Button>
      </div>
    </div>
  );
}

/** One column of live controls in a given personality. */
function MotionColumn({ motion }: { motion: MotionName }) {
  const [seg, setSeg] = useState('walk');
  const [sw, setSw] = useState(false);
  const [val, setVal] = useState(30);
  const [n, setN] = useState(2);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('home');
  const [prog, setProg] = useState(30);
  const [menu, setMenu] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const p = PERSONAS.find((x) => x.id === motion)!;
  return (
    <MotionScope motion={motion}>
      <div className="sg-card" style={{ padding: 16, borderRadius: 'var(--sg-radius-lg)', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div><Text variant="headline">{p.label}</Text><Text variant="footnote" tone="secondary">{p.note}</Text></div>
        <SegmentedControl size="sm" aria-label={`${motion} 세그먼트`} value={seg} onChange={setSeg} options={[{ value: 'walk', label: '도보', icon: <Footprints /> }, { value: 'bike', label: '자전거', icon: <Bike /> }, { value: 'car', label: '차', icon: <Car /> }]} />
        <TabBar showLabels={false} value={tab} onChange={setTab} aria-label={`${motion} 탭`} style={{ padding: 0 }}>
          <Tab value="home" label="홈" icon={<Home />} /><Tab value="map" label="지도" icon={<Map />} /><Tab value="saved" label="저장" icon={<Bookmark />} badge={<Badge>{n}</Badge>} /><Tab value="me" label="나" icon={<User />} />
        </TabBar>
        <div className="label-row"><Text variant="subhead">스위치</Text><Switch checked={sw} onChange={setSw} aria-label={`${motion} 스위치`} /></div>
        <Slider value={val} onChange={setVal} aria-label={`${motion} 슬라이더`} format={(v) => `${v}%`} />
        <div className="label-row"><Text variant="subhead">스테퍼 · 뱃지</Text><Stepper value={n} onChange={setN} min={0} max={20} label={`${motion} 개수`} /></div>
        <div className="label-row" style={{ gap: 12 }}><Progress value={prog} label={`${motion} 진행`} /><Button size="sm" variant="neutral" onClick={() => setProg((v) => (v >= 90 ? 10 : v + 30))}>+30</Button></div>
        <div className="label-row"><PageControl count={5} page={page} onChange={setPage} label={`${motion} 페이지`} />
          <Button size="sm" variant="tinted" ref={setAnchor as never} onClick={() => setMenu((v) => !v)}>메뉴</Button></div>
        <Menu open={menu} onClose={() => setMenu(false)} anchor={anchor} placement="bottom-end" aria-label={`${motion} 메뉴`}>
          <MenuItem icon={<Footprints />}>도보</MenuItem><MenuItem icon={<Bike />}>자전거</MenuItem><MenuItem icon={<Car />}>자동차</MenuItem>
        </Menu>
      </div>
    </MotionScope>
  );
}

export function Motion() {
  const theme = useTheme();
  const current = theme.motion ?? 'lively';
  return (
    <Page title="모션" intro="움직임은 이름 붙은 스프링 다섯 가지로 만들고, 그 성격(personality)을 세 가지 중에서 고릅니다. 오른쪽 위에서 앱 전체를 바꾸거나, MotionScope로 감싼 영역만 따로 정할 수 있어요.">
      <Section title="성격 비교" intro="같은 컨트롤을 세 성격으로 나란히 놓았습니다. 세그먼트·탭을 눌러 보고, 슬라이더를 빠르게 끌어 보고, 스테퍼로 뱃지 숫자를 바꿔 보세요.">
        <div className="grid grid--3">{PERSONAS.map((p) => <MotionColumn key={p.id} motion={p.id} />)}</div>
      </Section>
      <Section title="쓰는 법">
        <Demo col>
          <code className="code">{'createTheme({ motion: "playful" })'}</code>
          <code className="code">{'<MotionScope motion="calm">…</MotionScope>'}</code>
          <code className="code">{'<MotionScope motion="playful"><SegmentedControl … /></MotionScope>'}</code>
          <Text variant="subhead" tone="secondary">CSS 전환은 [data-sg-motion]의 linear() 이징을 따르고, 손가락을 따르는 JS 스프링과 포털로 뜨는 메뉴·시트도 같은 성격을 씁니다. 동작 줄이기를 켜면 넘침 없이 짧게(~110ms에 90%) 끝나고, 큰 움직임은 페이드로 바뀝니다. 컴포넌트에는 motion 속성이 없고, 하나만 바꿀 때도 MotionScope로 감쌉니다. 감싸는 요소는 화면에 상자를 만들지 않지만 DOM 부모는 되므로, 버튼 그룹이나 탭 바처럼 묶인 것은 묶음 전체를 감쌉니다.</Text>
        </Demo>
      </Section>
      <Section title={`스프링 곡선 — ${PERSONAS.find((p) => p.id === current)!.label}`} intro="굵은 선이 현재 성격, 옅은 선이 나머지 두 성격입니다.">
        <div className="grid grid--2">{SPRING_NAMES.map((n) => <SpringPlot key={n} name={n} motion={current} />)}</div>
      </Section>
      <Section title="쓰임">
        <Demo col>
          <Text variant="subhead"><b>snappy</b> — 탭, 토글, 눌림, 숫자 · <b>smooth</b> — 선택 이동, 제자리 복귀, 진행 · <b>bouncy</b> — 대화상자, 토스트, 뱃지 · <b>gentle</b> — 시트, 화면 전환 · <b>pop</b> — 메뉴·팝오버</Text>
        </Demo>
      </Section>
    </Page>
  );
}

/* depth and layers: one cross-section, each level drawn on what it actually sits on (a groove in a card, a card on the
   page, glass over content), so colour means something: a groove is a tinted fill, a raised thing is opaque, glass
   shows what is behind it */
function DepthTile({ level }: { level: string }) {
  switch (level) {
    case '−1': return <span className="depth-tile depth-tile--card"><span className="depth-groove"><span className="depth-knob" /></span></span>;
    case '0': return <span className="depth-tile depth-tile--page" />;
    case '1': return <span className="depth-tile depth-tile--page"><span className="depth-card" /></span>;
    case '2': return <span className="depth-tile depth-tile--card"><span className="depth-groove"><span className="depth-chip" /></span></span>;
    /* 3 and 4 are the same small screen: content with a floating bar; 4 dims all of it and a sheet rises above */
    case '3': return <span className="depth-tile depth-tile--screen"><Photo scene={0} className="depth-photo" /><Glass variant="regular" className="depth-bar" /></span>;
    default: return (
      <span className="depth-tile depth-tile--screen">
        <Photo scene={0} className="depth-photo" /><Glass variant="regular" className="depth-bar" /><span className="depth-scrim" />
        <Glass variant="strong" level="overlay" className="depth-sheet"><span className="depth-handle" /></Glass>
      </span>
    );
  }
}
const LEVELS: { n: string; name: string; what: string; where: string }[] = [
  { n: '−1', name: '홈', what: '값이 움직이는 길이나 값이 들어가는 자리. 안쪽 윗변이 그늘짐. 라이트에서는 옅은 채움 틴트, 다크에서는 주변보다 어두운 바탕', where: '스위치·슬라이더·진행 막대의 레일, 세그먼트·스테퍼의 바탕, 입력란과 셀렉트·날짜 선택처럼 값이 들어가는 자리' },
  { n: '0', name: '바탕', what: '페이지 자체', where: '배경, 목록 사이 여백' },
  { n: '1', name: '표면', what: '바탕 위의 불투명한 판. 아주 옅은 그림자 또는 머리카락 선', where: '카드, 목록 묶음, 표' },
  { n: '2', name: '볼록', what: '잡는 것과 고른 것. 불투명하고, 윗변이 밝고 아랫변이 그늘지며 짧은 그림자', where: '스위치·슬라이더 손잡이, 세그먼트의 고른 칸, 휠 렌즈, 고른 날짜·월·연도·요일(강조색 구슬)' },
  { n: '3', name: '떠 있는 유리', what: '내용 위에 뜬 새틴 유리. 뒤가 부드럽게 비치고 넓은 그림자', where: '앱 바, 탭 바, 사이드바, 메뉴, 팝오버, 셀렉트 목록, 날짜·시간 패널, 토스트' },
  { n: '4', name: '덮개', what: '화면 전체(떠 있는 유리까지)를 어둡게 덮고 그 위에 올라오는 진한 유리. 가장 넓은 그림자', where: '시트, 대화상자, 액션 시트, 미디어 뷰어' },
];
function DepthSection() {
  return (
    <Section title="깊이와 레이어" intro="모든 컴포넌트는 아래 여섯 층 중 하나에 놓입니다. 빛은 위에서 옵니다: 볼록한 것은 윗변이 밝고 아랫변이 그늘지며 아래로 짧은 그림자가 지고, 오목한 것은 안쪽 윗변이 그늘집니다. 층이 높을수록 그림자는 넓고 옅어집니다. 아래 예시는 각 층을 실제로 놓이는 자리 위에 그렸습니다.">
      <Demo col>
        <div className="depth-table">
          {LEVELS.map((l) => (
            <div key={l.n} className="depth-row">
              <span className="depth-n">{l.n}</span>
              <DepthTile level={l.n} />
              <span className="depth-text"><b>{l.name}</b> — {l.what}<br /><span className="depth-where">{l.where}</span></span>
            </div>
          ))}
        </div>
      </Demo>
      <Demo center caption="실제 컴포넌트: 레일은 홈(−1), 손잡이와 고른 칸은 볼록(2). 누르면 볼록한 것이 표면 쪽으로 살짝 들어갑니다(0.965배).">
        <Stack direction="row" gap={6} align="center" wrap justify="center">
          <Switch defaultChecked aria-label="깊이 예시 스위치" />
          <div style={{ width: 160 }}><Slider defaultValue={40} aria-label="깊이 예시 슬라이더" /></div>
          <SegmentedControl aria-label="깊이 예시 세그먼트" defaultValue="b" options={[{ value: 'a', label: '일' }, { value: 'b', label: '주' }, { value: 'c', label: '월' }]} />
          <Stepper defaultValue={2} aria-label="깊이 예시 스테퍼" />
          <div style={{ width: 120 }}><Progress value={60} aria-label="깊이 예시 진행" /></div>
        </Stack>
      </Demo>
      <ul className="rules">
        <li><b>한 층에 하나씩</b> — 유리 위에 유리를 겹치지 않습니다(버튼 묶음은 유리 하나에 평평한 버튼들). 볼록한 것은 홈이나 표면 위에만 놓입니다.</li>
        <li><b>고른 것은 볼록</b> — 선택을 표시하는 것은 그 길(홈)보다 위에 있습니다. 강조색으로 고른 것은 강조색 구슬(윗부분의 광택, 강조색 그림자)입니다.</li>
        <li><b>색이 아니라 빛으로</b> — 층은 밝은 윗변, 그늘, 그림자로 구분합니다. 홈만 채움 틴트(회색 기운)를 갖고, 볼록과 표면은 불투명, 유리는 뒤를 비춥니다.</li>
        <li><b>움직임은 층을 바꾸지 않음</b> — 늘어나고 달라붙는 물방울, 피어남은 같은 층 안에서 일어납니다. 층이 바뀌는 것은 덮개가 열릴 때뿐입니다.</li>
        <li><b>고대비</b> — 깊이 토큰이 윤곽선이 됩니다: 홈과 입력란 1px, 손잡이와 고른 것 1.5px.</li>
        <li className="rules__tokens">토큰: <code className="code">--sg-depth-inset</code> <code className="code">--sg-depth-raised</code> <code className="code">--sg-depth-raised-bg</code> <code className="code">--sg-depth-raised-accent</code> <code className="code">--sg-depth-sheen</code> <code className="code">--sg-depth-sheen-accent</code> · 그림자 <code className="code">--sg-shadow-sm / md / lg</code> · 유리 <code className="code">Glass variant</code></li>
      </ul>
    </Section>
  );
}

/* corners: radii by role, and the concentric rule for boxes inside boxes */
function Nested({ outer, gap, inner, label, good }: { outer: number; gap: number; inner: number; label: string; good: boolean }) {
  return (
    <div className="corner-demo" data-corners-skip={good ? undefined : ''}>
      <div className="corner-outer" style={{ borderRadius: outer, padding: gap }}>
        <div className="corner-inner" style={{ borderRadius: inner }} />
      </div>
      <span className="corner-cap" data-good={good || undefined}>{good ? '✓' : '✕'} {label}</span>
    </div>
  );
}
function CornerSection() {
  return (
    <Section title="모서리" intro="반경은 크기가 아니라 역할로 정합니다. 그리고 상자 안의 상자가 바깥 모서리 가까이에 있으면, 두 곡선이 같은 중심을 갖도록 안쪽 반경 = 바깥 반경 − 간격으로 맞춥니다. 그래야 두 테두리 사이의 띠가 모서리에서도 같은 두께로 이어집니다.">
      <Demo center caption="바깥 22px, 간격 6px. 안쪽이 16px이면 띠의 두께가 모서리까지 같고, 22px 그대로면 모서리에서 띠가 두꺼워지며, 10px이면 얇아져 모서리가 꺾여 보입니다.">
        <Stack direction="row" gap={6} wrap justify="center">
          <Nested outer={22} gap={6} inner={16} label="16 = 22 − 6" good />
          <Nested outer={22} gap={6} inner={22} label="22 (그대로)" good={false} />
          <Nested outer={22} gap={6} inner={10} label="10 (너무 작음)" good={false} />
        </Stack>
      </Demo>
      <Demo col>
        <div className="corner-table">
          <span><b>역할</b></span><span><b>반경</b></span><span><b>예</b></span>
          <span>아주 작은 것</span><span><code className="code">--sg-radius-xs</code> 6</span><span>표 셀 강조, 작은 표시</span>
          <span>작은 컨트롤</span><span><code className="code">--sg-radius-sm</code> 9</span><span>달력 칩, 작은 버튼, 세그먼트의 고른 칸(12 − 3)</span>
          <span>컨트롤</span><span><code className="code">--sg-radius-md</code> 12</span><span>버튼, 입력란, 세그먼트, 스테퍼, 렌즈, 격자 칸</span>
          <span>카드</span><span><code className="code">--sg-radius-lg</code> 16</span><span>카드, 목록 묶음, 메뉴, 휠의 열</span>
          <span>바·패널</span><span><code className="code">--sg-radius-xl</code> 22</span><span>앱 바, 탭 바, 사이드바, 액션 시트, 날짜 패널</span>
          <span>시트</span><span><code className="code">--sg-radius-2xl</code> 28</span><span>시트, 대화상자</span>
          <span>캡슐</span><span><code className="code">--sg-radius-full</code></span><span>칩, 토글, 배지, 진행 막대 — 캡슐 안의 캡슐은 저절로 같은 중심</span>
        </div>
      </Demo>
      <Demo col>
        <Text variant="subhead">· <b>같은 중심</b>: 안쪽 상자가 바깥 모서리에서 간격 g만큼 떨어져 있고 g가 바깥 반경 R보다 작으면, 안쪽 반경은 <b>R − g</b>(최소 4px)입니다. 예: 탭 바 22 − 5 = 17, 메뉴 16 − 6 = 10, 액션 시트 22 − 6 = 16, 세그먼트 12 − 3 = 9, 휠 16 − 4 = 12.</Text>
        <Text variant="subhead">· <b>멀리 있으면 자기 역할대로</b>: 간격이 바깥 반경보다 크면 곡선이 서로 보이지 않으므로, 안쪽은 자기 역할의 반경을 씁니다(패널 안 가운데의 버튼은 12).</Text>
        <Text variant="subhead">· <b>꽉 차면 바깥이 자름</b>: 간격 0으로 붙는 것(카드의 사진)은 반경을 주지 않고 바깥이 잘라냅니다.</Text>
        <Text variant="subhead">· <b>바깥을 맞추는 경우</b>: 안쪽이 정해진 모양이면 바깥을 맞춥니다. 캡슐 스위치(24) 옆 간격 8이면 막대는 12 + 8 = 20.</Text>
        <Text variant="subhead">· <b>화면에는 맞추지 않음</b>: 화면 역할을 하는 영역(내비게이션 스택, 미디어 뷰어)의 모서리에 떠 있는 바를 맞추지 않습니다. 바는 자기 역할의 반경(22)을 씁니다.</Text>
        <Text variant="subhead">· <b>CSS</b>: 바깥이 <code className="code">--_radius</code>를 갖고, 안쪽은 <code className="code">calc(var(--_radius) - 간격)</code>을 씁니다. 반경 숫자를 따로 적지 않아 바깥이 바뀌면 안쪽이 따라옵니다.</Text>
        <Text variant="subhead" tone="secondary">e2e <code className="code">corners</code>가 모든 문서 페이지에서 모서리 가까이 겹친 상자를 찾아 이 규칙을 확인합니다.</Text>
      </Demo>
    </Section>
  );
}

export function Material() {
  const [scene, setScene] = useState('0');

  const s = Number(scene);
  const [tinted, setTinted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ block: 'nearest' }); }, []);
  return (
    <Page title="재질" intro="새틴 유리. 빛을 굴절시키지 않고 고르게 흩뜨리는 결 있는 반투명이라, 뒤의 색과 형태가 부드럽게 비칩니다. 위에서 오는 고정된 빛이 테두리의 밝은 윗변과 그늘진 아랫변을 만들고, 포인터(터치에서는 손가락)가 있는 곳에 넓고 옅은 새틴 광택이 번집니다. 모든 브라우저에서 같은 모습입니다.">
      <Section title="변형" intro="regular · strong(패널) · subtle(보조 표면) · clear(사진 위). 포인터를 카드 위로 움직여 보세요.">
        <div ref={box}>
          <Photo scene={s} style={{ borderRadius: 'var(--sg-radius-xl)', padding: 28, minHeight: 320 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
              {/* four samples: with the docs' sidebar and settings bar that is the six large glass surfaces the blur
                  budget allows; the tint is a switch on the regular one */}
              {(['regular', 'strong', 'subtle', 'clear'] as const).map((v) => (
                <Glass key={v} variant={v} pressable tint={v === 'regular' && tinted ? sceneTint(s) : undefined} style={{ padding: 18, minHeight: 120, borderRadius: 'var(--sg-radius-xl)' }}>
                  <Stack gap={2}>
                    {v === 'regular' && tinted ? <Sparkles size={18} /> : <MousePointer2 size={18} />}
                    <Text variant="headline">{v === 'regular' && tinted ? 'regular + tint' : v}</Text>
                    <Text variant="footnote" style={{ opacity: 0.8 }}>{v === 'clear' ? '사진·영상 위 컨트롤' : v === 'strong' ? '메뉴, 시트, 대화상자' : v === 'subtle' ? '보조 표면' : tinted ? '배경 색이 스며든 유리 (useImageTint)' : '바, 버튼'}</Text>
                  </Stack>
                </Glass>
              ))}
            </div>
          </Photo>
        </div>
        <div className="label-row" style={{ marginTop: 10, maxWidth: 420 }}><Text variant="subhead">regular에 배경 색 스며들게 하기 (tint)</Text><Switch checked={tinted} onChange={setTinted} aria-label="regular에 배경 색 스며들게 하기" /></div>
        <div style={{ marginTop: 14 }}>
          <SegmentedControl aria-label="배경" value={scene} onChange={setScene} options={[0, 1, 2, 3, 4, 5].map((i) => ({ value: String(i), label: `장면 ${i + 1}` }))} />
        </div>
      </Section>
      <DepthSection />
      <CornerSection />
      <Section title="성능 규칙" intro="유리는 비싼 효과라서 규칙으로 제한합니다.">
        <Demo col>
          <Text variant="subhead">· 화면당 블러 레이어는 세 개까지(바, 패널 하나, 시트 하나). 전체 화면 블러는 쓰지 않습니다 — 배경은 어둡게만.</Text>
          <Text variant="subhead">· 하이라이트는 합성 레이어의 transform으로만 움직입니다. 포인터 이벤트는 한 곳에서 받아 rAF로 묶고, 위치 정보는 스크롤·크기 변화 때만 다시 잽니다.</Text>
          <Text variant="subhead">· 테두리 빛은 마스크 한 장(그림자 여러 겹 대신), 굴절 필터는 쓰지 않습니다.</Text>
          <Text variant="subhead" tone="secondary"><Sun size={14} style={{ verticalAlign: '-2px' }} /> 투명도 줄이기를 켜면 유리가 불투명 표면으로 바뀝니다.</Text>
        </Demo>
      </Section>
    </Page>
  );
}
