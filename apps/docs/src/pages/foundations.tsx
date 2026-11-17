import { useEffect, useRef, useState } from 'react';
import { palette, STEPS, springs, springAt, springDuration, typography, type Hue } from '@glass-layer/tokens';
import { Button, Glass, Stack, Text, SegmentedControl } from '@glass-layer/react';
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

function SpringPlot({ name }: { name: keyof typeof springs }) {
  const s = springs[name], d = springDuration(s) / 1000, W = 300, H = 110;
  const pts = Array.from({ length: 101 }, (_, i) => { const t = (d * i) / 100; return `${(i / 100) * W},${H - 12 - springAt(s, t) * (H - 34)}`; }).join(' ');
  const [on, setOn] = useState(false);
  return (
    <Glass variant="subtle" style={{ padding: 14, borderRadius: 'var(--gl-radius-lg)' }}>
      <div className="label-row"><Text variant="headline">{name}</Text><span className="code">{s.response}s · ζ {s.damping} · {Math.round(d * 1000)}ms</span></div>
      <svg className="spring-plot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2={W} y1={22} y2={22} stroke="var(--gl-separator-strong)" strokeDasharray="3 4" />
        <polyline points={pts} fill="none" stroke="var(--gl-accent)" strokeWidth="2.5" />
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

export function Motion() {
  return (
    <Page title="모션" intro="움직임은 이름 붙은 스프링 네 가지로만 만듭니다. CSS에서는 linear() 이징으로(합성기에서 실행), 손가락을 따라가는 동작은 JS 스프링으로 같은 값을 씁니다.">
      <div className="grid grid--2">
        {(Object.keys(springs) as (keyof typeof springs)[]).map((n) => <SpringPlot key={n} name={n} />)}
      </div>
      <Section title="쓰임">
        <Demo col>
          <Text variant="subhead"><b>snappy</b> — 탭, 토글, 눌림 · <b>smooth</b> — 선택 이동, 제자리 복귀 · <b>bouncy</b> — 메뉴·팝오버가 앵커에서 피어남, 토스트 · <b>gentle</b> — 시트, 화면 전환</Text>
          <Text variant="subhead" tone="secondary">동작 줄이기를 켜면 모든 스프링이 즉시 끝납니다.</Text>
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
