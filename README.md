# Glass Layer

빛을 따르는 유리 재질 위에 만든 React UI 라이브러리. 디자인 토큰, 프레임워크 없는 동작 코어, React 컴포넌트, 문서·카탈로그 앱으로 이루어진 pnpm 모노레포다.

> 상태: **0.2.0** (로컬 개발용, 변경 내역은 [`CHANGELOG.md`](CHANGELOG.md)).

## 구성

| 경로 | 패키지 | 내용 |
|---|---|---|
| `packages/tokens` | `@glass-layer/tokens` | OKLCH 팔레트, 테마 4종(라이트·다크·고대비 2종), 간격·반경·글자·모션 토큰 → `tokens.css`와 TS 값. 빌드할 때 WCAG 대비를 검사한다 |
| `packages/core` | `@glass-layer/core` | 프레임워크 없는 동작(스프링, 포인터 빛, 물방울 선택 표시, 오버레이 배치·피어남·포커스·레이어 스택, 끌기·길게 누르기)과 컴포넌트 CSS(`styles.css`) |
| `packages/react` | `@glass-layer/react` | React 컴포넌트 40여 개와 훅 |
| `apps/docs` | — | 문서·카탈로그 앱(Vite). 테마 전환과 실제 앱 형태의 쇼케이스 포함 |
| `tests/e2e` | — | Playwright: 상호작용(Chromium·WebKit·Firefox), 성능(CPU 4배 감속), 스크린샷 |

## 사용

```tsx
import '@glass-layer/react/styles.css';
import { ThemeProvider, createTheme, Button, TabBar, Tab } from '@glass-layer/react';

<ThemeProvider theme={createTheme({ mode: 'system' })}>
  <Button variant="filled">계속</Button>
</ThemeProvider>
```

글꼴은 Pretendard를 권장한다(라이브러리에 넣지 않음). 문서 앱의 `index.html`처럼 CDN이나 자체 호스팅으로 불러온다.

## 개발

```bash
pnpm install
pnpm build          # tokens → core → react
pnpm dev            # 문서 앱 (http://localhost:5173)
pnpm test           # 단위 테스트 (Vitest)
pnpm e2e            # 빌드 후 전체 검증: 렌더링 매트릭스, 상호작용, 동작 줄이기, 예외 상황 (3개 엔진) + 성능
```

문서 앱은 URL로 표시 설정을 받는다(`?mode=dark&hc=1&rt=1&rm=1&motion=calm`). 예외 상황을 모아 둔 `#/lab` 페이지가 있다.

## 컴포넌트

- **기반**: `ThemeProvider` `createTheme` `useTheme` `Glass` `Text` `Stack` `Divider` `Portal` `VisuallyHidden`
- **버튼**: `Button` `IconButton` `ButtonGroup`
- **입력**: `TextField` `SearchField` `Switch` `Slider` `Stepper` `SegmentedControl` `Chip`
- **선택** (0.2): `Checkbox` `RadioGroup` `Radio` `ChoiceList` `Select` `Calendar` `DatePicker`
- **구성과 미디어** (0.2): `AppBar largeTitle`(스크롤 연동) `Breadcrumbs` `Skeleton` `MediaViewer`
- **데이터** (0.3, 진행 중): `DataTable` `Pagination` `LineChart` `BarChart` `DonutChart` `Sparkline` `BarMeter` `IntervalPlot` `Stat` `CardHeader`
- **상태와 피드백 · 구성** (0.3, 진행 중): `Tabs` `Tooltip` `Banner` `EmptyState` `Tag` `Accordion` `Select variant="filter"`
- **내비게이션**: `TabBar` `Tab` `TabBarAction` `AppBar` `ScrollFade` `Sidebar` `SidebarItem` `SidebarSection` `PageControl`
- **표시**: `List` `ListItem` `ListSection` `Card` `CardMedia` `CardBody` `Avatar` `Badge` `BadgeAnchor` `Progress` `Spinner`
- **오버레이**: `Dialog` `Sheet` `Menu` `MenuItem` `MenuSeparator` `MenuLabel` `Popover` `ActionSheet` `ContextMenu` `Toaster` `useToast`
- **훅**: `useControllable` `useImageTint` `useGlassLight`

설계 원칙과 결정 사항은 [`docs/design-language.md`](docs/design-language.md)에 있다.
