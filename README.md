# Satin Glass

빛을 따르는 유리 재질 위에 만든 React UI 라이브러리. 디자인 토큰, 프레임워크 없는 동작 코어, React 컴포넌트, 문서·카탈로그 앱으로 이루어진 pnpm 모노레포다.

> 상태: **0.3.0** (로컬 개발용, 변경 내역은 [`CHANGELOG.md`](CHANGELOG.md)).

## 구성

| 경로 | 패키지 | 내용 |
|---|---|---|
| `packages/tokens` | `@satin-glass/tokens` | OKLCH 팔레트, 테마 4종(라이트·다크·고대비 2종), 간격·반경·글자·모션 토큰 → `tokens.css`와 TS 값. 빌드할 때 WCAG 대비를 검사한다 |
| `packages/core` | `@satin-glass/core` | 프레임워크 없는 동작(스프링, 포인터 빛, 물방울 선택 표시, 오버레이 배치·피어남·포커스·레이어 스택, 끌기·길게 누르기)과 컴포넌트 CSS(`styles.css`, 범주별 `css/*.css`, `styles.layer.css`) |
| `packages/react` | `@satin-glass/react` | React 컴포넌트와 훅. 범주별 진입점(`/controls`, `/data` …)과 코어의 CSS를 함께 싣는다 |
| `apps/docs` | — | 문서·카탈로그 앱(Vite). 테마 전환과 실제 앱 형태의 쇼케이스 포함 |
| `tests/e2e` | — | Playwright: 상호작용(Chromium·WebKit·Firefox), 성능(CPU 4배 감속), 스크린샷 |

## 사용

React 앱은 `@satin-glass/react` 하나만 설치하면 된다. 토큰과 코어는 의존성으로 함께 설치된다.

```bash
npm i @satin-glass/react
```

```tsx
import '@satin-glass/react/styles.css';                 // 전체 스타일 한 파일
import { ThemeProvider, createTheme, Button } from '@satin-glass/react';

<ThemeProvider theme={createTheme({ mode: 'system' })}>
  <Button variant="filled">계속</Button>
</ThemeProvider>
```

### 범주별로 나눠 쓰기

컴포넌트와 스타일은 같은 이름의 범주로 나뉜다. 루트(`@satin-glass/react`)에서 모두 가져와도 되고, 범주 경로에서 가져와도 된다. JS는 번들러가 쓰지 않는 코드를 걷어 내므로 어느 쪽이든 결과 크기는 같다. 범주 경로는 스타일을 필요한 것만 불러올 때 짝을 맞추기 쉽게 하려고 둔다.

```tsx
import '@satin-glass/react/css/foundation.css';         // 항상 맨 먼저 (토큰 포함)
import '@satin-glass/react/css/controls.css';
import '@satin-glass/react/css/data.css';
import '@satin-glass/react/css/selection.css';          // data가 필요로 함

import { ThemeProvider } from '@satin-glass/react/foundation';
import { Button } from '@satin-glass/react/controls';
import { DataTable, LineChart } from '@satin-glass/react/data';
```

| 범주 | 컴포넌트 | 함께 불러올 CSS (foundation 외) |
|---|---|---|
| `foundation` | `ThemeProvider` `createTheme` `useTheme` `MotionScope` `Glass` `Text` `Stack` `Divider` `Portal` `VisuallyHidden`, 아이콘, `useControllable` `useImageTint` `useGlassLight` | — |
| `controls` | `Button` `IconButton` `ButtonGroup` `Switch` `Slider` `Stepper` `SegmentedControl` `TextField` `SearchField` `Chip` `Badge` `BadgeAnchor` `Avatar` `Progress` `Spinner` `PageControl` | — |
| `layout` | `Card` `CardMedia` `CardBody` `CardHeader` `List` `ListItem` `ListSection` `Accordion` `Skeleton` `MediaViewer` | — |
| `navigation` | `TabBar` `Tab` `TabBarAction` `Tabs` `AppBar` `ScrollFade` `Sidebar` `SidebarSection` `SidebarItem` `Breadcrumbs` `NavigationStack` `NavigationPage` `useNavigation` `Pagination` | — |
| `selection` | `Checkbox` `RadioGroup` `Radio` `ChoiceList` `Select` `Calendar` `DatePicker` `Wheel` `WheelGroup` `TimePicker` `TimeWheel` `WeekdayPicker` `describeWeekdays` | `controls` `overlays` |
| `overlays` | `Dialog` `Sheet` `Menu` `MenuItem` `MenuSeparator` `MenuLabel` `Popover` `ActionSheet` `ContextMenu` `Toaster` `useToast` `Tooltip` | — |
| `feedback` | `Banner` `EmptyState` `Tag` | — |
| `data` | `DataTable` `LineChart` `BarChart` `DonutChart` `Sparkline` `BarMeter` `IntervalPlot` `Stat` | `controls` `selection` |

- 범주 CSS는 `foundation.css`만 맨 먼저 오면 나머지 순서는 상관없다. e2e(`css-split`)가 모든 문서 페이지에서 순서를 뒤집어 불러와도, 범주마다 위 표의 CSS만 불러와도 계산된 스타일이 전체 파일과 같은지 확인한다.
- **CSS 레이어**: 앱이 자기 레이어 순서를 쓰는 경우(유틸리티 CSS 프레임워크 등)에는 `@satin-glass/react/styles.layer.css`를 쓴다. 전체가 `@layer satin-glass` 안에 들어 있어, 레이어 밖 앱 스타일이 선택자 우선순위와 상관없이 이긴다. 범주 파일은 `@import '@satin-glass/react/css/controls.css' layer(satin-glass);`처럼 직접 레이어에 넣는다.
- **React 없이**: `@satin-glass/tokens/tokens.css`(CSS 변수)와 `@satin-glass/core`(스프링, 포인터 빛, 물방울 선택 표시, 오버레이 배치)를 쓴다. 같은 CSS는 `@satin-glass/core/styles.css`와 `@satin-glass/core/css/*`에도 있다.
- 세 패키지는 버전을 같이 올린다.

글꼴은 Pretendard를 권장한다(라이브러리에 넣지 않음). 문서 앱의 `index.html`처럼 CDN이나 자체 호스팅으로 불러온다.

## 개발

```bash
pnpm install
pnpm build          # tokens → core → react
pnpm dev            # 문서 앱 (http://localhost:5173)
pnpm test           # 단위 테스트 (Vitest)
pnpm e2e            # 빌드 후 전체 검증: 렌더링 매트릭스, 상호작용, 동작 줄이기, 예외 상황 (3개 엔진) + 성능
pnpm test:changed   # 바뀐 곳에 해당하는 단위 테스트만
pnpm e2e:changed    # 바뀐 곳에 해당하는 e2e 묶음만 (--dry: 고른 것만 보기, --base <ref>: 비교 기준)
```

`e2e:changed`는 바뀐 파일을 범주로 바꿔(컴포넌트는 범주 진입점과 import 관계, CSS는 파일 이름, 문서 페이지는 보여 주는 범주), 그 범주를 다루는 묶음(각 파일의 `// covers:` 줄)을 세 엔진에서 돌린다. 렌더링 매트릭스·예외 상황·동작 줄이기는 Chromium에서 한 번 돌린다. 토큰, 코어 동작, foundation처럼 모든 범주가 기대는 것이나 범주를 알 수 없는 파일이 바뀌면 전체를 돌린다. 기준은 브랜치에서는 main과의 분기점, main에서는 커밋하지 않은 변경이다. 릴리스 전에는 전체 `pnpm e2e`를 돌린다.

문서 앱은 URL로 표시 설정을 받는다(`?mode=dark&hc=1&rt=1&rm=1&motion=calm`). 예외 상황을 모아 둔 `#/lab` 페이지가 있다.

설계 원칙과 결정 사항은 [`docs/design-language.md`](docs/design-language.md)에 있다.
