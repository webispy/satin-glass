import { Banner, Text } from '@satin-glass/react';
import { Code, Page, Section } from '../shared';
import { L, useT } from '../i18n';

export function GettingStarted() {
  const t = useT();
  return (
    <Page title={t({ en: 'Getting started', ko: '시작하기' })}
      intro={<L en="Install one package, load its styles, wrap the app in a theme, and use the components." ko="패키지 하나를 설치하고, 스타일을 불러오고, 앱을 테마로 감싼 뒤 컴포넌트를 씁니다." />}>
      <Section title={t({ en: 'Install', ko: '설치' })}>
        <div className="guide">
          <p><L en={<>A React app installs <code className="code">@satin-glass/react</code> only; the design tokens and the behaviour core come with it. React and React DOM 18.2 or later are peer dependencies.</>}
            ko={<>React 앱에는 <code className="code">@satin-glass/react</code> 하나만 설치하면 됩니다. 디자인 토큰과 동작 코어는 함께 설치됩니다. React와 React DOM 18.2 이상이 필요합니다(peer dependency).</>} /></p>
          <Code lang="shell">{`npm i @satin-glass/react`}</Code>
        </div>
      </Section>

      <Section title={t({ en: 'Styles', ko: '스타일' })}>
        <div className="guide">
          <p><L en="The simplest start is one stylesheet with every component's styles." ko="가장 간단하게는 모든 컴포넌트의 스타일이 든 파일 하나를 불러옵니다." /></p>
          <Code lang="tsx">{`import '@satin-glass/react/styles.css';`}</Code>
          <p><L en={<>Or load only the categories you use. <code className="code">foundation.css</code> comes first (it holds the tokens); the others load in any order. Selection needs controls and overlays; data needs controls, selection, overlays and layout.</>}
            ko={<>쓰는 카테고리만 불러올 수도 있습니다. <code className="code">foundation.css</code>가 맨 먼저 오고(토큰이 들어 있음), 나머지는 순서와 상관없습니다. selection에는 controls와 overlays가, data에는 controls, selection, overlays, layout이 함께 필요합니다.</>} /></p>
          <Code lang="tsx">{`import '@satin-glass/react/css/foundation.css';   // always first
import '@satin-glass/react/css/controls.css';
import '@satin-glass/react/css/overlays.css';     // needed by selection and data
import '@satin-glass/react/css/layout.css';       // needed by data
import '@satin-glass/react/css/selection.css';    // needed by data
import '@satin-glass/react/css/data.css';`}</Code>
          <p><L en={<>If your app orders its own CSS layers (a utility framework, for example), use <code className="code">styles.layer.css</code>: everything sits in <code className="code">@layer satin-glass</code>, so your unlayered styles win whatever their specificity.</>}
            ko={<>앱에서 CSS 레이어 순서를 직접 관리한다면(유틸리티 CSS 프레임워크 등) <code className="code">styles.layer.css</code>를 쓰세요. 모든 스타일이 <code className="code">@layer satin-glass</code> 안에 들어 있어서, 레이어 밖의 앱 스타일이 명시도와 상관없이 우선합니다.</>} /></p>
          <Code lang="css">{`@import '@satin-glass/react/styles.layer.css';
/* or one category, in the layer yourself */
@import '@satin-glass/react/css/controls.css' layer(satin-glass);`}</Code>
        </div>
      </Section>

      <Section title={t({ en: 'Theme', ko: '테마' })}>
        <div className="guide">
          <p><L en={<>Wrap the app in <code className="code">ThemeProvider</code>. <code className="code">createTheme</code> takes the appearance (light, dark or the system's), contrast, reduced transparency and motion, the motion personality, the groove style and the language (<code className="code">locale</code>, 'en-US' unless set). Appearance, contrast, reduced transparency and reduced motion follow the system unless set.</>}
            ko={<>앱을 <code className="code">ThemeProvider</code>로 감쌉니다. <code className="code">createTheme</code>은 화면 모드(라이트·다크·시스템), 대비, 투명도 줄이기, 동작 줄이기, 모션 성격, 홈 모양, 언어(<code className="code">locale</code>, 정하지 않으면 'en-US')를 받습니다. 화면 모드, 대비, 투명도 줄이기, 동작 줄이기는 정하지 않으면 시스템 설정을 따릅니다.</>} /></p>
          <Code lang="tsx">{`import { ThemeProvider, createTheme, Button } from '@satin-glass/react';

const theme = createTheme({ mode: 'system', motion: 'lively', locale: 'en-US' });

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <Button variant="filled">Continue</Button>
    </ThemeProvider>
  );
}`}</Code>
          <p><L en={<>Import components from the package root or from their category path (<code className="code">@satin-glass/react/controls</code>, <code className="code">/data</code> …); bundlers drop what you do not use either way.</>}
            ko={<>컴포넌트는 패키지 루트에서 가져오거나 카테고리 경로(<code className="code">@satin-glass/react/controls</code>, <code className="code">/data</code> …)에서 가져옵니다. 어느 쪽이든 번들러가 쓰지 않는 것은 뺍니다.</>} /></p>
        </div>
      </Section>

      <Section title={t({ en: 'Font', ko: '글꼴' })}>
        <div className="guide">
          <p><L en="Pretendard is the recommended font. It is not bundled: load it from a CDN or host it yourself."
            ko="권장 글꼴은 Pretendard입니다. 함께 배포하지 않으니 CDN에서 불러오거나 직접 호스팅하세요." /></p>
          <Code lang="html">{`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />`}</Code>
        </div>
      </Section>

      <Section title={t({ en: 'Next', ko: '다음' })}>
        <div className="guide">
          <Banner tone="info" title={t({ en: 'Each component page shows live demos, the code to use them and every option.', ko: '컴포넌트 페이지마다 실제로 동작하는 데모, 쓰는 코드, 모든 옵션이 있습니다.' })} />
          <Text variant="subhead" tone="secondary" as="p"><L en={<>Start with <a href="#/buttons">Buttons</a> or <a href="#/table">Tables</a>; the <a href="#/overview">Introduction</a> explains the material and its light. <a href="#/theming">Theming</a> covers the settings and colours, <a href="#/a11y">Accessibility</a> what the components do and what they need from you.</>}
            ko={<><a href="#/buttons">버튼</a>이나 <a href="#/table">표</a>부터 보세요. <a href="#/overview">소개</a>에서 재질과 빛을 설명합니다. 설정과 색은 <a href="#/theming">테마</a>에, 컴포넌트가 하는 것과 앱이 해 줘야 하는 것은 <a href="#/a11y">접근성</a>에 있습니다.</>} /></Text>
        </div>
      </Section>
    </Page>
  );
}

/* the theme settings, one row each: the option, what it takes, its default and what it does */
function useThemeOptions() {
  const t = useT();
  return [
    ['mode', `'light' | 'dark' | 'system'`, `'system'`, t({ en: 'Light or dark appearance.', ko: '라이트 또는 다크 화면.' })],
    ['contrast', `'standard' | 'more' | 'system'`, `'system'`, t({ en: 'More contrast: outlines instead of tints, stronger text and separators.', ko: '대비 높이기: 틴트 대신 윤곽선, 더 진한 글자와 구분선.' })],
    ['reduceTransparency', `boolean | 'system'`, `'system'`, t({ en: 'Opaque surfaces instead of glass.', ko: '유리 대신 불투명한 면.' })],
    ['reduceMotion', `boolean | 'system'`, `'system'`, t({ en: 'Short movements without overshoot; drags still follow the finger.', ko: '넘치지 않는 짧은 움직임. 드래그는 그대로 손가락을 따라갑니다.' })],
    ['motion', `'calm' | 'lively' | 'playful'`, `'lively'`, t({ en: 'The motion personality: how far springs overshoot and selections stretch.', ko: '모션 성격: 스프링이 넘치는 정도와 선택 표시가 늘어나는 정도.' })],
    ['grooves', `'inset' | 'flat'`, `'inset'`, t({ en: 'Rails, fields and troughs cut in, or drawn as a flat tint.', ko: '레일·입력란·트랙을 오목하게 파거나 평평한 틴트로 그립니다.' })],
    ['light', 'boolean', 'true', t({ en: 'The soft sheen that follows the pointer on glass.', ko: '유리 위에서 포인터를 따르는 은은한 광택.' })],
    ['locale', 'string', `'en-US'`, t({ en: 'The language, a BCP 47 tag: how dates, times and numbers are written, how text sorts, and the words components write themselves.', ko: '언어(BCP 47 태그): 날짜·시간·숫자 표기, 텍스트 정렬, 컴포넌트 내장 문구의 언어.' })],
    ['tokens', 'Record<string, string>', '–', t({ en: <>CSS variables to override: <code>{'{ accent: \'#0a7\' }'}</code> sets <code>--sg-accent</code>.</>, ko: <>바꿀 CSS 변수: <code>{'{ accent: \'#0a7\' }'}</code>는 <code>--sg-accent</code>를 바꿉니다.</> })],
  ] as const;
}

export function Theming() {
  const t = useT(), rows = useThemeOptions();
  return (
    <Page title={t({ en: 'Theming', ko: '테마' })}
      intro={<L en="One ThemeProvider sets the appearance, contrast, transparency, motion, grooves and language for everything inside it, overlays included. Settings left as 'system' follow the user's device."
        ko="ThemeProvider 하나가 안쪽의 모든 컴포넌트(오버레이 포함)에 화면 모드, 대비, 투명도, 모션, 홈 모양, 언어를 적용합니다. 'system'으로 둔 설정은 사용자 기기의 설정을 따릅니다." />}>
      <Section title={t({ en: 'Settings', ko: '설정' })}>
        <div className="guide">
          <p><L en={<><code className="code">createTheme</code> fills in what you leave out, so a theme names only what it changes.</>}
            ko={<><code className="code">createTheme</code>은 빠진 것을 채우므로, 테마에는 바꾸는 것만 적습니다.</>} /></p>
          <div className="api__scroll" tabIndex={0} role="region" aria-label={t({ en: 'Theme settings', ko: '테마 설정' })}>
            <table className="api__table">
              <thead><tr>
                <th scope="col">{t({ en: 'Option', ko: '옵션' })}</th><th scope="col">{t({ en: 'Type', ko: '타입' })}</th>
                <th scope="col">{t({ en: 'Default', ko: '기본값' })}</th><th scope="col">{t({ en: 'Description', ko: '설명' })}</th>
              </tr></thead>
              <tbody>{rows.map(([name, type, def, desc]) => (
                <tr key={name}><th scope="row"><code>{name}</code></th><td><code className="api__type">{type}</code></td><td><code>{def}</code></td><td>{desc}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <Code lang="tsx">{`import { ThemeProvider, createTheme } from '@satin-glass/react';

// a remote desktop or VDI session: no blur, no long movements, whatever the OS says
const theme = createTheme({ reduceMotion: true, reduceTransparency: true, motion: 'calm' });

<ThemeProvider theme={theme}>{/* the app */}</ThemeProvider>`}</Code>
        </div>
      </Section>

      <Section title={t({ en: 'Nesting', ko: '중첩' })}>
        <div className="guide">
          <p><L en={<>Themes nest: a provider inside another sets its own part of the page, such as a dark panel in a light app. An unset <code className="code">motion</code>, <code className="code">grooves</code> or <code className="code">locale</code> inherits from the provider outside. Menus, dialogs and toasts render at the end of the page but keep the theme of the provider they were opened from.</>}
            ko={<>테마는 중첩할 수 있습니다. 라이트 앱 안의 다크 패널처럼, 안쪽 프로바이더는 자기가 감싼 영역의 테마를 따로 정합니다. 정하지 않은 <code className="code">motion</code>, <code className="code">grooves</code>, <code className="code">locale</code>은 바깥 프로바이더를 따릅니다. 메뉴·대화상자·토스트는 페이지 끝에 그려지지만, 연 곳의 프로바이더 테마를 그대로 씁니다.</>} /></p>
          <Code lang="tsx">{`<ThemeProvider theme={createTheme({ mode: 'light' })}>
  <Toolbar />
  <ThemeProvider theme={createTheme({ mode: 'dark' })}>
    <Inspector />   {/* dark, with its menus and popovers */}
  </ThemeProvider>
</ThemeProvider>`}</Code>
          <p><L en={<>To give one part of the app its own motion personality without a new theme, wrap it in <code className="code">MotionScope</code>. Components take no <code className="code">motion</code> option of their own.</>}
            ko={<>테마를 새로 만들지 않고 앱의 한 부분만 모션 성격을 달리하려면 <code className="code">MotionScope</code>로 감쌉니다. 컴포넌트에는 따로 <code className="code">motion</code> 옵션이 없습니다.</>} /></p>
          <Code lang="tsx">{`import { MotionScope } from '@satin-glass/react';

<MotionScope motion="calm">
  <DataTable /* … */ />
</MotionScope>`}</Code>
        </div>
      </Section>

      <Section title={t({ en: 'Colours and tokens', ko: '색과 토큰' })}>
        <div className="guide">
          <p><L en={<>Every colour, radius, space, shadow and spring is a CSS variable named <code className="code">--sg-…</code>. Override one for a provider with <code className="code">tokens</code>, or in your own CSS on the provider's element or <code className="code">:root</code>.</>}
            ko={<>색·반경·간격·그림자·스프링은 모두 <code className="code">--sg-…</code> 이름의 CSS 변수입니다. 프로바이더 하나에서만 바꾸려면 <code className="code">tokens</code>를 쓰고, 앱 CSS에서는 프로바이더 요소나 <code className="code">:root</code>에 지정합니다.</>} /></p>
          <Code lang="tsx">{`createTheme({ tokens: { accent: '#0a7a5c', 'on-accent': '#fff' } });`}</Code>
          <Banner tone="warning" title={t({ en: 'Check the contrast of colours you bring', ko: '직접 정한 색은 대비를 확인하세요' })}>
            {t({ en: 'The built-in themes are checked for WCAG contrast when the tokens are built (7:1 body text, 4.5:1 secondary and accent text). A colour set at run time skips that check: keep text on it at 4.5:1 or more, and set it in each theme you use, high contrast included.', ko: '내장 테마는 토큰을 빌드할 때 WCAG 대비를 검사합니다(본문 7:1, 보조·강조 텍스트 4.5:1). 런타임에 지정한 색은 이 검사를 거치지 않으니, 그 위 텍스트의 대비를 4.5:1 이상으로 맞추고, 고대비를 포함해 쓰는 테마마다 지정하세요.' })}
          </Banner>
          <p><L en={<>The <a href="#/colors">Colour</a> page lists the palette and the semantic colours, each step with its contrast against white and black text.</>}
            ko={<><a href="#/colors">색</a> 페이지에 팔레트와 시맨틱 컬러가 있고, 칸마다 흰·검은 글자와의 대비가 적혀 있습니다.</>} /></p>
        </div>
      </Section>

      <Section title={t({ en: 'Reading the theme', ko: '테마 읽기' })}>
        <div className="guide">
          <p><L en={<><code className="code">useTheme()</code> returns the nearest theme with every 'system' setting resolved: <code className="code">scheme</code> is light or dark, <code className="code">reducedMotion</code> and <code className="code">reducedTransparency</code> are booleans. Use it for anything you draw yourself, such as a canvas or a third-party chart.</>}
            ko={<><code className="code">useTheme()</code>은 가장 가까운 테마를 돌려주며, 'system' 설정은 모두 실제 값으로 바뀌어 있습니다. <code className="code">scheme</code>은 light 또는 dark, <code className="code">reducedMotion</code>과 <code className="code">reducedTransparency</code>는 boolean입니다. 캔버스나 다른 차트 라이브러리처럼 직접 그리는 것에 쓰세요.</>} /></p>
          <Code lang="tsx">{`const { scheme, reducedMotion } = useTheme();
const duration = reducedMotion ? 0 : 240;`}</Code>
        </div>
      </Section>
    </Page>
  );
}

export function Accessibility() {
  const t = useT();
  return (
    <Page title={t({ en: 'Accessibility', ko: '접근성' })}
      intro={<L en="What the components do for you, what they need from you, and what has not been verified yet."
        ko="컴포넌트가 알아서 하는 것, 앱이 해 줘야 하는 것, 아직 확인하지 않은 것입니다." />}>
      <Section title={t({ en: 'What the components do', ko: '컴포넌트가 하는 것' })}>
        <div className="guide">
          <ul>
            <li><L en="Everything works from the keyboard. Tabs, segmented controls and radio groups move with the arrow keys; menus add Home, End and type-ahead; Escape closes overlays."
              ko="모든 컴포넌트를 키보드로 쓸 수 있습니다. 탭·세그먼트 컨트롤·라디오 그룹은 방향키로 이동하고, 메뉴에서는 Home·End와 첫 글자로 항목 찾기도 됩니다. 오버레이는 Esc로 닫힙니다." /></li>
            <li><L en="Dialogs, sheets and drawers keep focus inside while open and give it back to the control that opened them; menus return focus to their button, Safari included."
              ko="대화상자·시트·드로어는 열려 있는 동안 포커스를 안에 두고, 닫히면 연 컨트롤로 돌려줍니다. 메뉴는 Safari에서도 포커스를 버튼으로 돌려줍니다." /></li>
            <li><L en="Focus is always visible, in every theme and with forced colours."
              ko="포커스는 모든 테마와 강제 색상 모드에서 언제나 보입니다." /></li>
            <li><L en="The system's reduced motion, reduced transparency, increased contrast and forced colours are followed. Each can also be set in the app (see Theming), for remote desktops where motion and blur stutter."
              ko="시스템의 동작 줄이기, 투명도 줄이기, 대비 높이기, 강제 색상 모드를 따릅니다. 움직임과 블러가 끊기는 원격 데스크톱 등을 위해 앱에서 직접 켤 수도 있습니다(테마 참고)." /></li>
            <li><L en="Charts keep their data as a table for screen readers and announce the point under the keyboard."
              ko="차트는 스크린 리더용으로 데이터를 표로 갖고 있고, 키보드로 고른 점을 읽어 줍니다." /></li>
            <li><L en="Text colours meet WCAG contrast in every built-in theme; the token build fails otherwise."
              ko="모든 내장 테마의 글자 색이 WCAG 대비를 지킵니다. 못 지키면 토큰 빌드가 실패합니다." /></li>
          </ul>
        </div>
      </Section>

      <Section title={t({ en: 'What they need from you', ko: '앱이 해 줘야 하는 것' })}>
        <div className="guide">
          <ul>
            <li><L en={<>An accessible name for every control without visible text: <code className="code">IconButton</code> requires <code className="code">label</code>, and a <code className="code">SegmentedControl</code> with <code className="code">iconOnly</code> still takes a label per option.</>}
              ko={<>화면에 텍스트가 없는 컨트롤에는 접근성 이름을 지정합니다. <code className="code">IconButton</code>은 <code className="code">label</code>이 필수이고, <code className="code">iconOnly</code>인 <code className="code">SegmentedControl</code>도 옵션마다 라벨을 받습니다.</>} /></li>
            <li><L en={<>An <code className="code">aria-label</code> for tables, charts, tab sets and toolbars that have no visible heading naming them.</>}
              ko={<>이름을 알려 주는 제목이 화면에 없는 표·차트·탭·툴바에는 <code className="code">aria-label</code>을 지정합니다.</>} /></li>
            <li><L en="Not colour alone: a status shown in colour also shows in text or an icon (Tag and Banner take both)."
              ko="색에만 기대지 않기: 색으로 나타내는 상태는 텍스트나 아이콘으로도 함께 보여 줍니다(Tag와 Banner는 둘 다 받습니다)." /></li>
            <li><L en={<>The page's language on <code className="code">{'<html lang>'}</code>, and the same language once in <code className="code">{"createTheme({ locale })"}</code>: dates, times, numbers and sorting follow any locale; the words components write themselves come in English and Korean (other languages get English).</>}
              ko={<><code className="code">{'<html lang>'}</code>에 페이지 언어를 적고, 같은 언어를 <code className="code">{"createTheme({ locale })"}</code>에 한 번 정합니다. 날짜·시간·숫자·정렬은 어떤 locale이든 따르고, 컴포넌트 내장 문구는 영어와 한국어를 지원합니다(그 밖의 언어는 영어로 표시).</>} /></li>
          </ul>
        </div>
      </Section>

      <Section title={t({ en: 'Not verified yet', ko: '아직 확인하지 않은 것' })}>
        <div className="guide">
          <Banner tone="info" title={t({ en: 'Checked in desktop browser engines only', ko: '데스크톱 브라우저 엔진에서만 확인했습니다' })}>
            {t({ en: 'The automated checks (an axe scan of the docs pages, keyboard and focus on every control, touch emulated in Chromium) run in Chromium, WebKit and Firefox. The components have not yet been tried on real iOS and Android devices or with VoiceOver, TalkBack or NVDA. Reports are welcome as GitHub issues.', ko: '자동 검사(문서 페이지의 axe 검사, 모든 컨트롤의 키보드·포커스, Chromium의 터치 에뮬레이션)는 Chromium·WebKit·Firefox에서 실행합니다. 실제 iOS·Android 기기와 VoiceOver·TalkBack·NVDA에서는 아직 써 보지 않았습니다. 발견한 문제는 GitHub 이슈로 알려 주세요.' })}
          </Banner>
        </div>
      </Section>
    </Page>
  );
}
