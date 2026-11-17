import { useEffect, useRef, useState } from 'react';
import { palette, STEPS, motions, springAt, springDuration, typography, SPRING_NAMES, type Hue, type MotionName, type SpringName } from '@glass-layer/tokens';
import { Button, Glass, Stack, Text, SegmentedControl, Switch, Slider, Stepper, Progress, PageControl, TabBar, Tab, MotionScope, Menu, MenuItem, Badge, useTheme } from '@glass-layer/react';
import { Home, Map, Bookmark, User, Footprints, Bike, Car } from 'lucide-react';
import { Sun, Sparkles, MousePointer2 } from 'lucide-react';
import { Demo, Page, Photo, Section, sceneTint } from '../shared';

export function Overview() {
  return (
    <Page title="Glass Layer" intro="빛을 따라 움직이는 유리 재질 위에 만든 React UI 라이브러리. 콘텐츠가 먼저 보이고, 컨트롤은 그 위에 가볍게 떠 있습니다.">
      <Section title="원칙">
        <div className="grid grid--3">
          {[
            ['콘텐츠 우선', '유리는 컨트롤과 내비게이션에만 씁니다. 콘텐츠 영역은 불투명하고 또렷하게.'],
            ['빛을 따르는 재질', '테두리는 빛을 받는 쪽만 밝고, 포인터가 있는 곳에 하이라이트가 모입니다.'],
            ['끊김 없는 움직임', '모든 전환은 이름 붙은 스프링 네 가지. 움직이는 건 transform과 opacity뿐입니다.'],
            ['고정 반경', '컨트롤 12 · 바와 패널 22 · 시트 28. 캡슐은 칩과 토글에만.'],
            ['접근성 기본값', '고대비 테마 두 가지, 투명도 줄이기, 동작 줄이기, 키보드 조작을 모두 지원합니다.'],
            ['한글 우선 타이포', 'Pretendard 기반. 한글과 영문의 무게와 높이를 맞췄습니다.'],
          ].map(([t, d]) => (
            <Glass key={t} variant="subtle" style={{ padding: 18, borderRadius: 'var(--gl-radius-lg)' }}>
              <Text variant="headline">{t}</Text>
              <Text variant="subhead" tone="secondary" style={{ marginTop: 4 }}>{d}</Text>
            </Glass>
          ))}
        </div>
      </Section>
      <Section title="설치">
        <Demo col>
          <code className="code">pnpm add @glass-layer/react</code>
          <code className="code">import '@glass-layer/react/styles.css'</code>
          <code className="code">{'<ThemeProvider theme={createTheme({ mode: "system" })}>…</ThemeProvider>'}</code>
        </Demo>
      </Section>
    </Page>
  );
}

export function Colors() {
  const sem = ['bg', 'bg-grouped', 'surface', 'label', 'label-secondary', 'label-tertiary', 'separator', 'fill', 'accent', 'accent-soft', 'success', 'warning', 'danger', 'info', 'glass-fill', 'glass-selection'];
  return (
    <Page title="색" intro="OKLCH로 만든 자체 팔레트. 같은 단계(예: 500)는 어떤 색이든 같은 밝기로 보여서 대비를 예측할 수 있습니다. 강조색은 보라 쪽으로 기운 파랑 ‘iris’.">
      <Section title="팔레트" intro="11가지 색 × 11단계. 빌드할 때 sRGB 색역 안으로 채도를 맞춥니다.">
        <Demo col>
          <div className="swatches">
            <span />{STEPS.map((s) => <span key={s} style={{ textAlign: 'center' }}>{s}</span>)}
            {(Object.keys(palette) as Hue[]).map((h) => [
              <b key={h} style={{ fontWeight: 600, color: 'var(--gl-label-secondary)' }}>{h}</b>,
              ...STEPS.map((s) => <i key={h + s} className="swatch" style={{ background: palette[h][s] }} title={`${h}-${s} ${palette[h][s]}`} />),
            ])}
          </div>
        </Demo>
      </Section>
      <Section title="의미 색" intro="테마(라이트·다크·고대비 2종)에 따라 바뀌는 이름. 빌드 시 WCAG 대비를 검사합니다 — 본문 7:1, 보조 텍스트 4.5:1 이상.">
        <div className="grid grid--4">
          {sem.map((k) => (
            <div key={k} className="token-chip"><i style={{ background: `var(--gl-${k})` }} /><span className="code">--gl-{k}</span></div>
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
          <div key={k} className="label-row" style={{ borderBottom: '1px solid var(--gl-separator)', paddingBottom: 8 }}>
            <Text variant={k} truncate>유리 너머의 풍경 Glass Layer</Text>
            <span className="code" style={{ flex: 'none' }}>{k} · {typography[k][0]}/{typography[k][1]}</span>
          </div>
        ))}
      </Demo>
    </Page>
  );
}

const PERSONAS: { id: MotionName; label: string; note: string }[] = [
  { id: 'calm', label: '차분 calm', note: '넘침 없이 정확하게 멈춤. 업무용·정보 밀도 높은 화면' },
  { id: 'lively', label: '생동 lively (기본)', note: '한 번 살짝 넘쳤다가 자리 잡음. 늘어남·눌림이 적당히' },
  { id: 'playful', label: '경쾌 playful', note: '탄성이 크고 늘어남·납작해짐이 뚜렷함. 소비자 앱·온보딩' },
];

function SpringPlot({ name, motion }: { name: SpringName; motion: MotionName }) {
  const s = motions[motion][name], d = springDuration(s) / 1000, W = 300, H = 110;
  const pts = (m: MotionName) => { const p = motions[m][name], dd = springDuration(p) / 1000; return Array.from({ length: 121 }, (_, i) => { const t = (1.1 * i) / 120; return `${(t / 1.1) * W},${H - 14 - Math.min(1.3, springAt(p, Math.min(t, dd))) * (H - 40)}`; }).join(' '); };
  const [on, setOn] = useState(false);
  return (
    <Glass variant="subtle" style={{ padding: 14, borderRadius: 'var(--gl-radius-lg)' }}>
      <div className="label-row"><Text variant="headline">{name}</Text><span className="code">{s.response}s · ζ {s.damping} · {Math.round(d * 1000)}ms</span></div>
      <svg className="spring-plot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2={W} y1={26} y2={26} stroke="var(--gl-separator-strong)" strokeDasharray="3 4" />
        {PERSONAS.filter((p) => p.id !== motion).map((p) => <polyline key={p.id} points={pts(p.id)} fill="none" stroke="var(--gl-label-tertiary)" strokeWidth="1.2" opacity="0.5" />)}
        <polyline points={pts(motion)} fill="none" stroke="var(--gl-accent)" strokeWidth="2.5" />
      </svg>
      <div className="label-row" style={{ marginTop: 6 }}>
        <div style={{ flex: 1, height: 18 }}>
          <div className="spring-dot" style={{ transform: on ? 'translateX(200px)' : 'none', transition: `transform var(--gl-spring-${name}-duration) var(--gl-spring-${name})` }} />
        </div>
        <Button size="sm" variant="plain" onClick={() => setOn((v) => !v)}>재생</Button>
      </div>
    </Glass>
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
      <Glass variant="subtle" style={{ padding: 16, borderRadius: 'var(--gl-radius-xl)', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div><Text variant="headline">{p.label}</Text><Text variant="footnote" tone="secondary">{p.note}</Text></div>
        <SegmentedControl size="sm" aria-label={`${motion} 세그먼트`} value={seg} onChange={setSeg} options={[{ value: 'walk', label: '도보', icon: <Footprints /> }, { value: 'bike', label: '자전거', icon: <Bike /> }, { value: 'car', label: '차', icon: <Car /> }]} />
        <TabBar compact value={tab} onChange={setTab} aria-label={`${motion} 탭`} style={{ padding: 0 }}>
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
      </Glass>
    </MotionScope>
  );
}

export function Motion() {
  const theme = useTheme();
  const current = theme.motion ?? 'lively';
  return (
    <Page title="모션" intro="움직임은 이름 붙은 스프링 다섯 가지로 만들고, 그 성격(personality)을 세 가지 중에서 고릅니다. 오른쪽 위에서 앱 전체를 바꾸거나, 컴포넌트마다 motion 속성으로 따로 정할 수 있어요.">
      <Section title="성격 비교" intro="같은 컨트롤을 세 성격으로 나란히 놓았습니다. 세그먼트·탭을 눌러 보고, 슬라이더를 빠르게 끌어 보고, 스테퍼로 뱃지 숫자를 바꿔 보세요.">
        <div className="grid grid--3">{PERSONAS.map((p) => <MotionColumn key={p.id} motion={p.id} />)}</div>
      </Section>
      <Section title="쓰는 법">
        <Demo col>
          <code className="code">{'createTheme({ motion: "playful" })'}</code>
          <code className="code">{'<MotionScope motion="calm">…</MotionScope>'}</code>
          <code className="code">{'<SegmentedControl motion="playful" … />'}</code>
          <Text variant="subhead" tone="secondary">CSS 전환은 [data-gl-motion]의 linear() 이징을 따르고, 손가락을 따르는 JS 스프링과 포털로 뜨는 메뉴·시트도 같은 성격을 씁니다. 동작 줄이기를 켜면 모두 즉시 끝납니다.</Text>
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

export function Material() {
  const [scene, setScene] = useState('0');
  const s = Number(scene);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ block: 'nearest' }); }, []);
  return (
    <Page title="재질" intro="빛을 따르는 유리. 빛을 받는 쪽 테두리만 밝고 반대쪽은 그늘지며, 포인터(터치에서는 손가락)가 있는 곳에 하이라이트가 모입니다. 모든 브라우저에서 같은 모습입니다.">
      <Section title="변형" intro="regular · strong(패널) · subtle(보조 표면) · clear(사진 위). 포인터를 카드 위로 움직여 보세요.">
        <div ref={box}>
          <Photo scene={s} style={{ borderRadius: 'var(--gl-radius-xl)', padding: 28, minHeight: 320 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
              {(['regular', 'strong', 'subtle', 'clear'] as const).map((v) => (
                <Glass key={v} variant={v} pressable style={{ padding: 18, minHeight: 120, borderRadius: 'var(--gl-radius-xl)' }}>
                  <Stack gap={2}>
                    <MousePointer2 size={18} />
                    <Text variant="headline">{v}</Text>
                    <Text variant="footnote" style={{ opacity: 0.8 }}>{v === 'clear' ? '사진·영상 위 컨트롤' : v === 'strong' ? '메뉴, 시트, 대화상자' : v === 'subtle' ? '보조 표면' : '바, 버튼'}</Text>
                  </Stack>
                </Glass>
              ))}
              <Glass tint={sceneTint(s)} style={{ padding: 18, minHeight: 120, borderRadius: 'var(--gl-radius-xl)' }}>
                <Stack gap={2}><Sparkles size={18} /><Text variant="headline">tinted</Text><Text variant="footnote" style={{ opacity: 0.8 }}>배경 색이 스며든 유리 (useImageTint)</Text></Stack>
              </Glass>
            </div>
          </Photo>
        </div>
        <div style={{ marginTop: 14 }}>
          <SegmentedControl aria-label="배경" value={scene} onChange={setScene} options={[0, 1, 2, 3, 4, 5].map((i) => ({ value: String(i), label: `장면 ${i + 1}` }))} />
        </div>
      </Section>
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
