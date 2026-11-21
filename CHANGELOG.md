# Changelog

## 0.5.0 — unreleased

New components for screens that show and choose data (a meter, a group of people, a timeline, a drawer from any edge, a combobox, and a recipe for the filter row above a table); a theme setting for flat grooves; depth that reads in dark themes; motion reworked where it did not answer the hand (accordion, timeline, charts, switch, checkbox, media viewer, overflowing strips); and a consistency pass over every component against the design language, which fixed focus, stacking, right-to-left and reduced-motion faults and a Safari afterimage source.

### New
- **`Meter`** (data): a value within a known range (storage, a quota, a score), `role="meter"`. The track is a groove and the fill is flat from the inline start. `low` / `high` / `optimum` rate the value the way `<meter>` does (success, warning, danger), and `status` says it in words. An invalid value shows a localised "unavailable". It changes at once: the value comes from data, not a hand.
- **`AvatarGroup`** (controls): overlapping portraits parted by a ring in the colour they sit on (`--sg-avatar-ring`), and +N for the rest (`max`, `total` for a server count); +N is a button with `onMoreClick`, which gets the event so a popover can anchor to it.
- **`Timeline`, `TimelineItem`** (layout): an ordered list on a connecting line. Steps (`status`: done / current / upcoming, `aria-current="step"`, status read aloud via `labels.status`) and events (`tone`, `icon`) are separate in the type. A new current step sends the position dot along the line on the smooth spring, filling the lines it passes and drawing the checks of the steps it passes, then knocks the ring on arrival; chosen mid-way it turns from where it is, and however fast the steps change every mark ends right. Rows that come and go open and fold their height.
- **`Drawer`** (overlays): a modal panel from a side edge (`side` is logical), named by a title or an aria-label. It enters at the smooth spring's pace with the gentle one's damping, follows a drag toward its edge 1:1 and leaves past a third of its width or on a flick. It also docks to the top or bottom edge (`side="top" | "bottom"`, `height`, default half the screen): a full-width tool panel such as a console or a log, dragged away by its header. With `resizable` a grip on its free edge sets the height (dragged 1:1 between `minHeight` and `maxHeight`; a focusable separator, Up / Down by 16 px, Home / End), kept across openings or controlled with `height` + `onHeightChange`. Drawers enter at the smooth spring's pace with the gentle one's damping (the sheet's gentle spring dragged a wide panel in too slowly).
- **`Combobox`** (selection): a text field whose suggestions narrow as you type, for one value (WAI-ARIA editable combobox with list autocomplete). Server search with `filter="none"`, `inputValue` / `onInputChange`, `getOptionText`, `loading`; the typed part is emphasised; IME composition is left alone.
- **`createTheme({ grooves })`**: `'inset'` (default) cuts level −1 parts in (rails, fields, segmented and stepper troughs); `'flat'` draws the same parts as a flat tint. Only the grooves change. A nested theme inherits the setting unless it sets its own, and high contrast keeps the groove outline either way.
- **FilterBar recipe** on the tables page: search, filter selects and toggle chips in a named group, with the applied count and one clear.

### Changed
- Dark themes tell height by light: surfaces and glass step lighter than the page, raised and floating things get a lit top edge (`--sg-lit-edge`), and grooves are darker than their surroundings with a faint rim (`--sg-groove`, `--sg-groove-soft`, `--sg-groove-hover`).
- `Select` and the date, range and time picker triggers are grooves like the text fields beside them (they hold a form value). Inline and filter selects stay flat.
- Filled buttons are flat (the accent marks the main action; raised is for handles and the chosen value), and large buttons take the control radius, 12. Banners and outlined cards get the dark top light and their high-contrast outline; an interactive card brightens a little on hover instead of lifting. In high contrast the tab bar, sidebar and open calendar chip mark the selection by outline alone.
- `Accordion` opens as one motion, as the menus bloom: the region on the personality's smooth spring with the chevron on it, and the content coming out from behind the heading on the pop spring (a little small by the squash), folding back behind it on closing; a press mid-way turns back from where it is. The CSS `fr` transition, whose overshoot was cut off so every personality unfolded alike, is gone.
- Charts move their scale, gridlines, ticks and marks together on one progress when the data or the visible series change (the personality's smooth pace, no overshoot); leaving ticks fade out, new ones fade in. A resize redraws at once. The switch's knock against the end of its rail runs on the personality's pop spring instead of fixed keyframes.
- Overflowing segmented controls, tab bars and tabs can be browsed without choosing: a vertical mouse wheel scrolls the strip sideways (one wheel gesture stays with what it started on: at the strip's end it stops, and a fresh turn after a pause scrolls the page; a gesture begun on the page keeps scrolling the page over the strip), and a mouse drag that does not start on the selection pans the strip 1:1 and chooses nothing, coasting on from the speed it is let go at (a fling, as touch and trackpads do natively); wheel notches ease rather than jump. Only a drag that starts on the selection moves the drop. Strips that fit are unchanged.
- Badges take their own fill (`--sg-badge-fill`): the same red in light themes, a step calmer in dark ones, where the light theme's red glared. A tab bar badge's ring is the bar's own glass instead of an opaque ring that read as a dark border in dark themes.
- A modal layer (dialog, sheet, action sheet, media viewer, drawer) hides the rest of the page from assistive technology (`aria-hidden`); layers opened above it and live regions stay reachable. Anchored menus, even with a scrim, do not.
- `Avatar` shows the initials when its picture fails to load.
- Exits (sheet, action sheet, toast, anchored panels, media viewer) and the reduced-motion stand-in fades take their times and curves from named values in core (`timing`, `easing`), unchanged in pace. A dismissed banner fades without shrinking, then closes the gap.
- Design language: the navigation stack names `smooth` (quick, for back-and-forth); sheets drag by their grabber and action sheets do not; the sidebar changes its tint in place while the tab bar's travels; the last breadcrumb is marked by weight and colour; chosen-value markers (date beads, the wheel lens) stay raised inside glass picker panels.

### Fixed
- On an overflowing tab bar or segmented control on a phone, a drag that started on the selection scrolled the strip instead of moving the drop where the browser let the strip take the finger despite `touch-action` (iOS Safari). The first sideways move of a drop drag is now cancelled so nothing scrolls under it; an up-or-down swipe still scrolls the page.
- Timeline: the dot that travels between steps was the list's last child, so the last step was not `:last-child` and drew a line and a gap after it (and an `<ol>` held a non-item). The dot is now the list's first item, hidden from assistive technology.
- The media viewer closed into a thumbnail of a different shape: the whole photo shrank inside the square crop and swapped to the thumbnail at the last frame, and where scrollbars always show it landed half a scrollbar off (it measured the stage before the scroll lock widened it). The photo now folds into the thumbnail as the thumbnail shows it, cropped and rounded, and opens out of it the same way; it measures the stage itself. Paging by swipe keeps the top bar, as the buttons do (hiding it per flick made it bob).
- Where scrollbars always show (a mouse on Windows, macOS set to always), the browser's own scrollbar drew a grey bar on a white groove inside the sidebar, menus, select lists, dialogs, sheets and drawers. Their scroll areas now have a thin scrollbar with no groove, its thumb a faint tint while the pointer is over the area (solid in high contrast); overlay scrollbars are left as they are.
- In Safari, a layer opened by a click (dialog, sheet, drawer) gave focus back to nothing on close, since Safari does not focus a clicked button; the control last pressed stands in for it.
- Finished animations held their end values: each kept its own compositing layer (a source of Safari afterimages) and masked later inline style or class changes on the same property. `animate()` and the CSS entrances now let go once done (`fill: backwards`), as does `fade()` fading in; only exits and the navigation stack's pages and the lifted preview hold their end.
- The drawer closed on a spring; it leaves on the same short ease-in as the sheet, from wherever it is. The remaining literal timings (navigation fades, the lifted preview's return, the range band, a picker closing after a choice) are named in core `timing` / `easing`.
- Right to left, the navigation stack slid pages in from the wrong side and cast its edge shadow on the wrong edge (new `--sg-shadow-edge-end`), and the bar meter filled from the left. RTL rules also match a `[dir="rtl"]` ancestor, since bundlers rewrite `:dir()` into a language list.
- A cancelled swipe back returns on `smooth`, as other returns to place do.
- High contrast: a chosen chip gets the selection outline, and the current month or year keeps its stronger outline.
- Presses press by size: chips 0.965 like buttons, the +N avatar 0.9 like days and weekdays. Large button groups take the control radius, and their inner corners follow `--_nest`. The current page's bead fades its shadow in with its colour.
- Unchecking a checkbox undrew its tick on a bouncing spring that outlived the box's colour and, at its end, wrapped the dash into a speck. The tick now fades with the box; it draws only on the way in, and its draw stays inside the dash so the overshoot never opens a gap.
- Dragging a switch toward off showed a different rail colour from the resting off rail.
- Segmented controls, tab bars and tabs whose chosen item is disabled (or whose first item is disabled with no value) left the whole group out of the tab order; the first enabled item takes Tab now, and the default value skips disabled items.
- Toasts could be covered by a dialog opened after them; their portal now stacks above every dialog.
- A `Portal` with no `ThemeProvider` above wrote light, motion-on settings over the system ones (colour scheme, reduced motion).
- Menu and action sheet rows reached by keys show the focus ring, not only the fill a pointer shows; an invalid select keeps its focus halo (in the error colour), as text fields do.
- Right to left, the segmented, tab bar and tabs indicator stayed put or collapsed: its walls assumed the first item was leftmost.
- Reduced motion left a few presses and lifts moving (tab bar action, +N avatar, donut slice, context menu preview); press timings and the glass press light came from raw values and use the instant token now (the CSS rule check reads `transition-duration` and delays too).
- The tab bar sits on the bar layer (`--sg-z-bar`); the chosen segment has the raised sheen like the wheel lens; clear glass leaves the shadow to its level and keeps the solid rims in high contrast.
- Search fields showed the browser's own clear button beside the field's.

## 0.4.0 — 2026-11-20

The library gets its own name and its foundations: six design principles, a satin glass material, depth by part, corners from one source, focus, contrast and settings that hold everywhere, and checks that keep the CSS to these rules. It ships per category, and the wheel, calendar, action sheet and tab bar are redrawn in that language.

From this release on the changelog is in English; the entries for 0.3.0 and earlier are in Korean.

### Breaking changes
- **Renamed from Glass Layer to Satin Glass**, after satin (acid-etched) glass.
  - Packages: `@glass-layer/tokens|core|react` → `@satin-glass/tokens|core|react`.
  - CSS: classes `gl-*` → `sg-*`, custom properties `--gl-*` → `--sg-*`, data attributes `data-gl-*` → `data-sg-*`. The older entries below use the new names.
- `TabBar`: dragging the selection along the bar is opt-in with `draggable` (off by default; a tap selects).
- `TabBarAction` sits inside the bar after a hairline as an icon cell pressed like a tab, and has no `variant`.
- `Calendar`: the title is two chips (month and year, in the locale's order) that open month and year grids; `monthPicker="wheel"` keeps the wheels. `openTo` gains `'year'`.
- `TimePicker`: turning the wheels changes a draft; Done, Enter or a click outside commit it (`onChange` once), Cancel or Escape restore the previous time.
- Focus is drawn as an outline (`--sg-focus-outline`, `--sg-focus-offset`); `--sg-ring` is gone. `--sg-depth-well` is gone (a wheel's column is a groove).
- `Glass`: `variant` sets only fill and blur; `level="overlay"` casts the overlay shadow. Sheets, dialogs and action sheets are overlays; menus, popovers, list boxes, panels and toasts float.
- Components no longer take a `motion` prop (21 of them had one). The motion personality is set for the app with `createTheme({ motion })` and for a part of it, or a single component, with `<MotionScope motion>`; open panels follow it through their portal. `MotionScope` drops `bare` and keeps the same element when `motion` is unset.
- `TabBar`: `compact` becomes `showLabels={false}` (icons only; a tab without an icon keeps its label).
- `EmptyState`: `compact` becomes `size="sm"`. `Sheet`: `size` becomes `height` (`'auto'` | `'full'`).
- `Skeleton` takes `size` only with `variant="circle"`; `Checkbox` and `Radio` no longer pass the native `size` attribute.
- The calm motion personality's bouncy spring no longer overshoots (damping 0.72 → 0.9), and the pop springs of the three personalities are spread apart.

### Foundations
- **Six principles** open the docs and `docs/design-language.md`, highest first: satin glass, two lights, surface tension, fingertip touch, small and rare delights, and smooth for everyone.
- **Satin material**: a fine etched grain over the glass fill, and a wide, faint sheen that follows the pointer; the fixed top light keeps the form. No refraction.
- **Depth by part**: six levels (groove, page, surface, raised, floating glass, overlay) and depth tokens declared on every theme element. Paths (rails, slots, a range's band) are grooves; what is held or chosen is raised; a handle has a light face in every theme; a chosen value is an accent bead. How a selection shows is decided by its role, each with a high-contrast form.
- **Blur budget**, measured: glass inside glass draws flat, at most three blurred surfaces over any point and six large ones on a screen.
- **Corners** from one source: parents declare `--_radius` and `--_nest`, children use `calc(var(--_radius) - var(--_nest))`.
- **Focus, contrast and settings**: focus survives high contrast, selected states and forced colours; contrast is checked per state (hover, press, placeholders in fills, text on clear glass over a white photo); in high contrast depth becomes outlines from the same tokens; the nearest theme boundary decides shadows, reduced motion and reduced transparency, and portals carry the resolved settings.
- **Tokens reach every component**: control text roles (`--sg-text-control-*`, `label`, `item`), `Stack` gaps from the spacing scale, radii, shadows and times from tokens. The motion tables in the docs are generated from the springs.
- **One floating bar per screen**: `AppBar` takes `attached` (flush, opaque, a hairline under it); a floating tab bar goes with an attached top bar.

### Components
- New: **`RangeCalendar`** and **`DateRangePicker`** pick a start and an end on one grid (`minLength` / `maxLength`, days or nights, ISO 8601 interval in forms). The days between lie in a tinted groove whose head follows the pointer.
- `Wheel`, `WheelGroup`, `TimeWheel`: no drum or groove; a still, raised lens that squeezes the way the rows go and pops as a row arrives; a spring pulls the nearest row in (no scroll snap); `disabled`.
- `Calendar`: the year grid fades only where more years wait.
- `ActionSheet`: one glass panel with menu-like rows and a quiet close row.
- Anchored panels (popovers, menus) are clipped where the scroll area around their anchor clips it.
- 0.3 parts follow the depth rules: the bar meter's track is a groove, the current page is an accent bead, stat cards and banners take the card radius, and cards and list groups get an edge in high contrast.
- Menus and other blooms differ by motion personality (calm settles without overshoot, playful overshoots about 16 %).

### Packaging
- Three packages as before, versioned together; an app installs `@satin-glass/react` only.
- **Per-category entry points**: `@satin-glass/react/{foundation,controls,layout,navigation,selection,overlays,feedback,data}`; the root still exports everything.
- **Per-category stylesheets**: `css/<category>.css` (foundation first, then any order), `styles.css` with all of them, and `styles.layer.css` inside `@layer satin-glass`.
- Apache-2.0 license with `LICENSE` and `NOTICE` in each package; npm metadata (description, keywords, repository, `publishConfig.access`).

### Project
- English `README.md` with a Korean `README.ko.md`, and a short README per package.
- `CONTRIBUTING.md` (Linux kernel style commits in English, `Signed-off-by` under the DCO, `Reviewed-by` for reviewers, AI agents named with their model), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), issue and pull request templates.
- The icon, in the README and as the docs' favicon and logo.

### Tests and tooling
- `pnpm test:changed` and `pnpm e2e:changed` run only what covers a change; the full `pnpm e2e` still gates releases.
- New e2e suites: `css-split`, `focus`, `settings`, `corners`, `blur-budget`, `wheel-motion`, `range`; `core/test/css-rules.test.ts` checks every stylesheet for animated properties (with an allowlist that gives a reason per exception) and for raw radii, shadows and times.

## 0.3.0 — 2026-11-19

표·차트·지표 같은 데이터 컴포넌트와 휠·시간·요일 선택, 단계 탐색(`NavigationStack`)을 추가했다. 새 컴포넌트를 기존 컴포넌트와 같은 어휘와 모션으로 맞췄고, 휴대폰에서 터치 끌기가 시작하자마자 끝나거나 hover가 남던 문제를 라이브러리 전체에서 고쳤다.

표, 차트, 지표처럼 숫자를 다루는 화면에 쓰는 컴포넌트를 추가했다. 처음에는 한 화면의 모양을 따라 만들었으나, 특정 화면에만 맞는 부분을 걷어 내고 기존 컴포넌트와 같은 어휘로 정리했다(아래 '정리' 참고).

### 문서 구성
- 컴포넌트는 기존처럼 범주별 페이지에서 하나씩 보여 준다.
  - 내비게이션: 탭, 페이지 이동
  - 선택: 필터 셀렉트
  - 구성과 미디어: 펼치는 구역
  - 새 페이지 '상태와 피드백': 태그, 배너, 빈 상태, 툴팁
  - 새 묶음 '데이터': '표', '차트와 지표'
- 대시보드 예제는 그다음에, 이 컴포넌트들만 조합한 가상 스토어 운영 화면으로 바꿨다(개요·주문·상품 탭, 제목이 있는 카드, 필터, 일괄 선택, 상품 시트). 데이터는 모두 지어낸 것이다.

### 새 컴포넌트: 휠, 시간, 요일, 단계 탐색
- **`Wheel` · `WheelGroup`**: 고정된 띠 아래로 값이 굴러가는 열. 많은 값 중 하나를 빨리 고를 때 쓴다(백 년 중 한 해, 시와 분).
  - 브라우저 자체 스크롤과 스크롤 스냅 위에 만들어, 손가락 튕기기와 트랙패드의 관성이 그대로 살고 한 칸에 멈춘다.
  - 마우스는 끌기(튕기기 포함), 휠 굴리기, 칸 누르기로 쓴다.
  - 띠에서 먼 칸은 원통처럼 기울며 흐려진다. 칸이 아니라 칸 안의 글자에 그려서, 스냅 위치가 흔들리지 않는다.
  - 열마다 spinbutton이다. 위아래는 한 칸, PageUp/PageDown은 `pageStep`칸, Home/End는 양 끝으로 간다. 숫자나 글자를 치면 그것으로 시작하는 칸으로 간다(1·9·8·0 → 1980년).
- **`TimePicker` · `TimeWheel`**: 시·분(·오전/오후) 휠.
  - 값은 24시간 "HH:mm"이다. 오전/오후 표시와 그 앞뒤 순서는 언어를 따른다(`오전 7:30` / `7:30 AM`, `hour12`로 바꿀 수 있음).
  - `minuteStep`으로 분 간격을 정한다.
  - 필드는 날짜 선택과 같은 고정 패널로 열린다. 값이 없으면 지금 시각(간격에 맞춤)이나 `openTo`에서 시작하고, Enter로 닫힌다.
- **`WeekdayPicker` · `describeWeekdays`**: 여러 요일을 고르는 둥근 토글이다(알람 반복, 영업일).
  - 달력 날짜와 같은 모양이고, 고르면 가운데에서 채워진다(pop 스프링).
  - `describeWeekdays`는 고른 요일을 '매일', '주중', '주말', '월, 수, 금'처럼 말로 바꾼다.
- **`Calendar` · `DatePicker`: 연도와 월로 바로 가기.**
  - 제목('2026년 11월')을 누르면 그 자리에 연도와 월 휠이 열린다. 크기가 같아서 패널이 튀지 않는다.
  - `openTo="month"`이면 처음부터 휠로 열리고, `defaultMonth`로 처음 보여 줄 달을 정한다(생년월일).
  - 연도 휠은 `min`~`max`, 없으면 오늘 앞뒤 100년이다. 범위 밖의 달은 건너뛴다.
- **`NavigationStack` · `NavigationPage` · `useNavigation`**: 한 영역 안에서 깊이 제한 없이 들어가고 나오는 탐색이다(설정 › 프로필 › 계정 보안 › …).
  - `push`하면 다음 페이지가 오른쪽에서 덮으며 들어온다. 아래 페이지는 3분의 1만큼 밀려나며 어두워진다.
  - 뒤로 버튼에는 아래 페이지의 이름이 붙는다. 터치에서는 왼쪽 가장자리에서 밀어도 돌아간다(손가락을 따라오고, 짧으면 제자리로 돌아감).
  - 아래 페이지는 그대로 두어 스크롤과 상태가 남는다. 숨겨진 페이지는 `inert`라 키보드와 화면 낭독기가 닿지 않는다.
  - 포커스는 들어가면 새 페이지 제목으로, 나오면 그 페이지를 연 줄로 간다. Safari처럼 클릭이 포커스를 주지 않으면 제목으로 간다.
  - 동작 줄이기에서는 교차 페이드다. `popToRoot`는 맨 위 페이지를 첫 페이지 위로 바로 밀어낸다.
  - 뒤로 갈 때 떠나는 페이지가 끝나는 순간 한 프레임 화면을 다시 덮던 번쩍임을 고쳤다(사용자 확인으로 발견). 끝난 애니메이션을 지우지 않고, 그대로 둔 채 페이지를 뺀다. 프레임마다 위치를 기록하는 회귀 검사를 넣었다.
- 문서:
  - '선택' 페이지: 생년월일 필드, '시간과 요일' 절(알람 예시)
  - '목록과 표시' 페이지: 4단계 설정 탐색 예시
- 검사:
  - `tests/e2e/pickers.mjs`(엔진 3종 + 모션·대비·동작 줄이기 변형)
  - `touch.mjs`에 실제 터치 검사 추가(휠 튕기기 관성, 가장자리 밀어 뒤로 가기)

### 일관성 검토로 맞춘 것 (0.3 컴포넌트를 0.1·0.2와 비교한 독립 검토)
- **차트 모션이 라이브러리 스프링을 따른다.**
  - 처음 그려질 때: 막대는 'bouncy', 도넛은 'smooth', 선은 넘치지 않는 'gentle' 스프링을 쓴다. 전에는 고정 이징으로 차분한 성격에서도 튀었다.
  - 데이터가 바뀔 때: 값마다 스프링으로 옮겨 가고, 도중에 다시 바뀌면 속도를 이어 간다.
  - 동작 줄이기: 다른 컴포넌트처럼 140ms 페이드로 나타난다.
- **툴팁 모양을 하나로**: `Tooltip`과 차트 툴팁 모두 테마 색의 작은 떠 있는 카드다(전에는 어두운 알약형과 흰 카드 두 가지). `Tooltip`은 이제 110ms로 사라진다. 다음 툴팁으로 넘어갈 때는 바로 사라진다.
- `Accordion`: 머리에 hover와 누름 표시를 더했다(목록 줄과 같다). 동작 줄이기에서도 화살표가 짧게 돈다.
- `Pagination`: 높이를 작은 컨트롤 크기(32px)에 맞추고, 버튼처럼 눌리면 들어간다(0.965).
- `Tabs`:
  - 숫자나 글자 배지는 라이브러리 `Badge`(중립)로 그린다. `TabBar`처럼 나타날 때 튀고 바뀌면 통통 튄다.
  - 굵게 바뀌어도 탭 폭이 그대로다(세그먼트와 같은 방식).
- `Tag`: 고대비에서 soft 태그에 테두리를 그리는 규칙이 적용되지 않던 것을 고쳤다.
- `DataTable`: 불러오는 중 막대가 동작 줄이기에서도 미끄러지던 것을 고쳤다(진행 표시처럼 깜박임). 막대가 왼쪽 밖에서 들어온다.
- 필터 셀렉트 높이를 칩, 작은 버튼과 같은 32px로 맞췄다.
- `BarMeter`의 `tone="info"` 색을 추가했다.
- 반경을 `--sg-radius-xs` 토큰으로, 포커스 링을 `--sg-ring`으로, 동작 줄이기 페이드를 140ms로 맞췄다. 배너가 닫힐 때 높이는 넘치지 않는 스프링으로 줄어든다.
- 그대로 둔 것: `motion` prop이 일부 컴포넌트(Accordion, Tooltip, Banner, 차트, DataTable)에 없다(상위의 `data-sg-motion`은 따름). 크기 이름도 섞여 있다(`density` / `compact` / `size`). API 차이라 0.4에서 함께 정리한다.

### 정리 (0.3 안에서 바뀐 API)
- 의미 색 이름을 `Tone`(`neutral`·`accent`·`info`·`success`·`warning`·`danger`) 하나로 맞췄다. `Tag`, `BarMeter`, `Sparkline`이 쓴다.
- `Tag`: `variant`는 `soft`·`outline`만 남겼다. 점선 밑줄 `text`는 뺐다(용어 설명은 `Tooltip`으로). 나머지 `span` 속성은 그대로 전달한다.
- `Level`(세기 막대)은 뺐다. 한 화면에만 쓰이던 표시다.
- `Tabs`: `variant="pill"`을 뺐다. 필터처럼 고르는 줄은 칩이나 세그먼트로 만든다. 탭이 많으면 세그먼트·탭 바처럼 가로로 스크롤되고 끝이 흐려진다.
- `Stat`: 방향을 읽어 주는 말을 `words` 대신 `labels`로 받는다(다른 컴포넌트와 같은 이름).
- 표 셀 클래스 이름을 바꿨다: `sg-cell-best` → `sg-cell-strong`, `sg-cell-warn` → `sg-cell-warning`, `sg-cell-alert` → `sg-cell-danger`, `sg-cell-bar` → `sg-cell-meter`.
- `DataTable`
  - 행 선택 상자는 라이브러리 체크박스와 같은 마크업·모양·모션(체크 표시가 그려짐)이다. 머리글은 `Checkbox`, 행은 같은 마크업을 컴포넌트 없이 그린다(5,000행을 빠르게 굴릴 때 행마다 컴포넌트를 두면 프레임이 떨어졌다).
  - 요약 행에서 해당 없는 칸은 "–" 대신 빈칸으로 둔다.
  - 높이가 정해진 표에서 Firefox가 스크롤 상자를 Tab 정지점으로 하나 더 만들던 것을 막았다.
- 새 `CardHeader`(제목, 설명, 오른쪽 컨트롤): 차트나 표를 담는 카드의 제목 줄.

### 화면 검토로 고친 것 (2× 확대, 엔진 3종, 프레임 단위 추적 + 독립 리뷰)
- **숫자가 같은 폭이 아니었다(라이브러리 전체).** 기본 스타일의 `font-feature-settings: "tnum" 0`이 표·지표·차트·페이지 이동의 `font-variant-numeric: tabular-nums`를 모두 덮고 있었다. 기본값과 같은 `"tnum" 0`을 빼서, 같은 폭 숫자를 요청한 곳에서 실제로 켜지게 했다.
- **표 머리글**
  - 끝 정렬 열의 머리글이 2px 높았다. 인라인 flex가 정렬 아이콘을 기준선으로 삼았기 때문이다. 이제 셀 아래쪽에 맞춘다.
  - 둘째 줄(단위)이 있는 열과 없는 열의 제목 높이가 달랐다. 이제 어느 열에든 둘째 줄이 있으면 나머지 열도 빈 줄을 두어 제목이 한 줄에 선다.
  - 정렬 화살표가 둘째 줄 옆에 붙던 것을 제목 옆으로 옮겼다.
  - WebKit에서 정렬 방향이 보이지 않았다. CSS `d` 속성이 없어서 위아래 화살표가 늘 같이 보였다. 이제 두 화살표를 transform·opacity로 바꾸고, 모든 엔진에서 스프링으로 움직인다.
- **전체 선택 상자**가 머리글 아래 선에 붙어 있었다. 이제 머리글 글자 줄 가운데에 둔다.
- **고정 요약 행**이 스크롤하면 머리글 밑으로 사라졌다. 이제 머리글 바로 아래에 붙어 있다.
- **고정 열**
  - 키보드로 옮긴 셀이 고정 머리글·요약 행·고정 열 뒤에 가려졌다. `scroll-padding`으로 피하게 했다.
  - 마지막 고정 열의 구분선(`box-shadow !important`)이 포커스 링을 지웠다.
  - 고정 열로만 이루어진 열 그룹의 이름도 함께 고정한다.
- **선 그리기:** Firefox에서 열 사이에 머리카락 같은 세로선이 생겼다. 폭이 소수인 셀의 inset 그림자 때문이었다. 선을 1px 배경 층으로 바꿨다.
- **다시 불러오는 동안의 진행선**이 머리글 뒤에 가려져(높이 0 셀에 잘려) 보이지 않았다. 이제 머리글 아래 선 위에 보인다. 행이 흐려졌다가 원래대로 돌아올 때도 순간 전환 대신 서서히 돌아온다.
- **셀 안 막대:** 숫자가 같은 줄의 다른 셀보다 2px 낮았다. 굵은 값은 자리가 넓어져 막대 끝이 들쭉날쭉했다. 이제 값 자리 폭을 고정한다.
- **불러오는 중의 자리 표시**가 숫자 열에서도 왼쪽에 붙고 고정 열과 함께 고정되지 않았다. 이제 실제 셀과 같은 정렬과 고정을 쓴다.
- **가상 스크롤:** 셀 내용이 행보다 높으면 행이 커져 스크롤이 튀었다. 이제 행 높이를 고정한다.
- **페이지 이동**
  - 페이지가 넘어가면 이전 화살표가 최대 24px 움직였다. 숫자·… 칸을 모두 가장 긴 페이지 번호 폭으로 맞춰 고정했다.
  - 좁은 곳에서 옆 글자와 겹쳤다. "3 / 20" 형태로 바뀌는 폭을 키웠다.
- **표 상자:** 모서리 반경이 마지막 행의 선 끝을 잘라 냈다. 반경을 없앴다.
- **터치 끌기가 시작하자마자 끝났다(시트, 스위치, 슬라이더, 페이지 점, 토스트, 세그먼트, 탭 바).**
  - 원인: 손가락이 닿으면 브라우저가 그 요소(예: 시트 손잡이 막대)에 포인터를 자동으로 붙잡는다. 끌기가 시작될 때 붙잡는 대상을 끌기 요소로 옮기면 손잡이 막대에 `lostpointercapture`가 생긴다. 이 이벤트가 부모로 전파되어, 끌기 코드가 "내 끌기가 끝남"으로 받았다.
  - 그래서 휴대폰에서 시트를 손잡이로 끌어 닫을 수 없었다. 마우스에는 이 자동 붙잡기가 없어 데스크톱 검사로는 드러나지 않았다.
  - 이제 끌기 요소 자신의 붙잡기가 끝날 때만 끝으로 본다. 실제 터치 입력(CDP)으로 끄는 회귀 검사 `tests/e2e/touch.mjs`를 추가했다.
- **터치에서 hover 흔적이 남았다(라이브러리 전체).** 스마트폰은 마지막으로 탭한 요소에 `:hover`를 남겨 두어, 손을 뗀 뒤에도 버튼·행·칩 등이 hover 상태로 보였다. 모든 `:hover` 규칙(31개)을 `@media (hover: hover)` 안으로 옮겼다. hover만이 반응이던 곳(페이지 번호, 사이드바·경로 항목, 칩 지우기)에는 누르는 동안의 표시(`:active`)를 더했다.
- **도넛을 탭하면 번쩍였다.** 터치에도 마우스 hover처럼 처리해서, 손을 떼는 순간 '나감'으로 선택이 풀렸다. 조각이 튀어나오는 4px도 경로를 다시 그려 순간이동했다.
  - 이제 마우스는 올리면 보이고, 터치는 탭하면 선택되어 남는다. 같은 조각이나 바깥을 탭하면 풀린다. 범례도 같다.
  - 튀어나오는 움직임은 transform 스프링이다.
- **탭 바 배지의 테두리 윗부분이 잘렸다.** 탭이 많을 때 가로로 스크롤되는 트랙은 위아래도 잘라 내는데, 배지와 그 테두리가 트랙 위로 2px 넘었다. 트랙이 막대의 위아래 여백까지 차지하게 했다(바깥 여백은 줄이고 안쪽 여백은 늘림). 선택 물방울의 크기는 그대로다.
- **탭의 숫자 배지에서 숫자가 2.5px 아래로 치우쳤다.** 탭의 24px 줄 높이를 이어받아 배지(18px)보다 높은 줄이 생겼다. `.sg-badge`처럼 `line-height: 1`로 맞췄다.
- **배너**
  - 한 줄짜리 배너에서 버튼만 세로 가운데에 놓이고 제목은 위에 붙었다. 이제 아이콘, 제목 첫 줄, 닫기 단추, 버튼이 같은 24px 첫 줄에 중심을 맞춘다. 한 줄이면 모두 가운데에 있고, 본문이 있으면 버튼이 제목과 나란하다.
  - 좁은 폭에서 버튼을 글 아래로 내리는 규칙(`@container`)에 잴 컨테이너가 없어 한 번도 적용되지 않았다. 그래서 휴대폰에서 버튼이 글 옆에 남아 글을 좁게 눌렀다. 글과 버튼을 묶는 `.sg-banner__main`을 더하고, 그 폭이 400px 이하이면 버튼이 글 아래로 내려가게 했다.
- **도넛 조각의 안쪽 가장자리에 마우스를 두면 선택과 해제를 끝없이 되풀이했다.** 조각이 바깥으로 4px 튀어나오면 포인터 아래에서 빠져나가 '나감'이 되고, 제자리로 돌아오면 다시 '들어옴'이 되었다. 이제 어느 조각인지는 움직이는 조각이 아니라 고정된 링 위의 각도와 거리로 정한다. 튀어나온 만큼과 조각 사이 틈도 포함하므로, 조각 사이를 지날 때도 선택이 깜박이지 않는다.
- **iOS에서 표의 스크롤 막대가 둘로 끊겨 보였다.** 고정 열·머리글의 `z-index`가 표 밖까지 미쳐 iOS가 그리는 스크롤 막대를 덮었다. 표 상자를 독립된 쌓임 영역(`isolation: isolate`)으로 만들었다.
- **높이를 정하지 않은 표**는 가로로만 스크롤한다. 전에는 iOS에서 표를 터치로 끌면 스크롤바가 두 개 생겼고, 세로로 쓸어도 페이지가 아니라 표가 움직임을 잡았다(`overscroll-behavior: contain`이 양방향에 걸려 있었음). 자리를 차지하는 스크롤바 환경에서는 가로 스크롤바 때문에 세로 스크롤바까지 생길 수 있었다.
- **툴팁:** 툴바에서 이웃 버튼으로 바로 옮기면 지연을 다 기다렸다. 앞 툴팁이 120ms 늦게 닫히는 동안 "방금 닫힘"이 없었기 때문이다. 이제 열린 툴팁이 있으면 바로 뜨고, 앞 툴팁은 즉시 닫힌다.
- 위 항목마다 회귀 검사를 추가했다(`tests/e2e/data.mjs`).

### 표
- **`DataTable`**
  - 열 그룹, 두 줄 머리글(단위·표본 수), 머리글 설명 툴팁, 끝 정렬 숫자(같은 폭 숫자)를 지원한다.
  - 정렬은 오름 → 내림 → 끔 순서로 바뀐다. 빈 값은 방향과 상관없이 늘 맨 뒤다. 정렬을 서버에 맡기는 `manualSort`도 있다.
  - 행 선택: 머리글 체크박스(일부 선택 시 미정 표시), Shift 범위 선택, Space, Ctrl/Cmd+A.
  - 고정 요약 행(합계·평균 등), 고정 머리글, 고정 앞쪽 열을 지원한다.
  - `maxHeight` 안에서 80행이 넘으면 가상 스크롤로 보이는 행만 그린다. 5,000행에서도 빠르게 휠을 굴릴 때 프레임 드롭이 없다.
  - WAI-ARIA 격자다. Tab 정지점은 하나이고, 방향키·Home/End·Ctrl+Home/End·PageUp/PageDown으로 이동한다. 칸 안에 컨트롤이 하나면 그 컨트롤로 포커스가 간다. 가상 스크롤 밖으로 이동하면 그 행을 그린 뒤 포커스를 옮긴다.
  - 불러오는 중(첫 로딩은 스켈레톤 행, 다시 불러올 때는 흐려진 행과 진행선), 빈 상태, 흐린 행(`rowState`), 서버 총 행 수(`rowCount`)를 지원한다.
  - 셀 강조용 클래스: `sg-cell-strong`, `sg-cell-warning`, `sg-cell-danger`, `sg-cell-muted`, `sg-cell-meter`.
- **`Pagination`**: 처음·끝과 현재 주변을 보여 주고, 빈 구간은 …로 접는다. 현재 페이지가 움직여도 버튼 개수가 그대로라 버튼이 포인터 밑에서 밀리지 않는다. 좁은 곳에서는 "3 / 20" 표시로 바뀐다(컨테이너 쿼리).

### 차트 (자체 SVG)
- **`LineChart`**(선·영역), **`BarChart`**(묶음·누적), **`DonutChart`**, **`Sparkline`**
  - 계열 색은 테마 토큰 `--sg-chart-1…6`을 쓴다. 네 테마 모두 카드 대비 3:1 이상이고, 빌드할 때 검사한다.
  - 범례로 계열을 숨기고 보일 수 있다(마지막 하나는 숨기지 않는다). 포인터를 따라가는 십자선 툴팁이 있다.
  - 키보드로 포커스해 방향키·Home/End로 점을 옮기면 스크린 리더가 읽는다. 전체 데이터는 숨긴 표로 제공한다.
  - 처음에는 선이 그려지고 막대가 바닥에서 올라오고 도넛이 돈다. 데이터가 바뀌면 이전 값에서 이어지고, 동작 줄이기에서는 바로 나타난다.
- **셀 안 표시**: `BarMeter`(숫자 옆 짧은 막대), `IntervalPlot`(점, 신뢰 구간, 기준선)

### 화면 구성·표시
- **`Tabs`**
  - 밑줄은 탭 바·세그먼트와 같은 물방울 선택 표시다.
  - WAI-ARIA 탭이고, 자동 또는 수동 활성화를 고를 수 있다. 새 패널은 이동한 쪽에서 들어온다.
  - 무거운 패널은 지연 렌더링되어, 탭을 누른 프레임을 막지 않는다.
- **`Stat`**(KPI): 값, 증감(화살표·색과 함께 말로도 알림, 올라가면 나쁜 지표는 `invert`), 추이선, 불러오는 중
- **`Tooltip`**
  - 마우스를 올리거나 키보드로 포커스하면 나타나고, 트리거를 설명한다(`aria-describedby`).
  - 포인터를 툴팁 위로 옮겨도 열려 있고, Esc로 닫는다. 연달아 훑을 때는 바로 뜬다.
- **`Banner`**: 정보·성공·경고·위험·중립. 닫으면 접히며 아래 내용이 올라온다. `live`로 알릴 수 있다.
- **`EmptyState`**, **`Accordion`**(단일·다중), **`Tag`**(옅은 채움·외곽선), **`CardHeader`**
- **`Select variant="filter"`**: "분류 전체 ▾" 같은 알약형 필터 셀렉트

### 항목이 많은 세그먼트·탭 바
- 한 줄에 다 들어가지 않으면 라벨을 "…"로 줄이지 않고 줄이 가로로 스크롤된다. 항목은 읽을 수 있는 최소 폭을 지킨다.
- 더 있는 쪽 끝이 흐려진다(IntersectionObserver로 표시해 스크롤 중에는 레이아웃을 읽지 않는다).
- 선택이 바뀌면 선택된 항목이 흐린 끝에 가리지 않게 보이는 곳으로 스크롤된다. 스크롤된 상태에서 끌어도 물방울이 손가락 아래 항목에 놓인다.
- 회귀 검사: 1280·390·320px, 탭·키보드·끌기·사용 안 함·거부된 값·동작 줄이기, 엔진 3종.

### 검증 시간 단축
- `pnpm e2e`가 세 단계로 돈다. 엔진 3종은 처음부터 동시에 돈다.
  1. 결과만 보는 검사(렌더 매트릭스, 예외 상황, 항목 많은 세그먼트, 데이터·대시보드): 최대 16개 동시. 렌더 매트릭스는 설정 조합별 조각(shard)으로 나눈다.
  2. 애니메이션을 재는 검사(상호작용, 선택, 구성과 미디어, 동작 줄이기): 8개 동시. 16개로 돌리면 기기가 바빠 측정이 흔들렸다.
  3. 성능·타이밍 검사: 기기가 조용해진 뒤 하나씩. 실패하면 한 번 더 돌리고, 두 번째에 통과하면 요약에 그렇게 적는다.
- 전체 45개 검사가 약 5분에 끝난다(이전에는 순서대로 돌아 훨씬 오래 걸렸고, 병렬 첫 버전은 6분 반). 연속 두 번 모두 재시도 없이 통과했다.
- `pnpm e2e:quick`: Chromium만. `E2E_ONLY=overflow`처럼 일부만, `E2E_JOBS`·`E2E_MOTION_JOBS`로 동시 실행 수를 바꿀 수 있다.
- 고정 대기 대신 상태를 기다리게 바꿨다: 항목 많은 세그먼트(물방울이 선택 위에 멈출 때까지), 대화상자 Esc, axe 전 등장 애니메이션 끝.

### 수정
- **'마일' 셀렉트 버그:** 마지막 항목(예: 마일)이 골라진 셀렉트를 열면, 유리 테두리와 항목이 4px 내려앉으며 계단처럼 움직였다.
  - 원인: 활성 항목을 보이게 하는 `scrollIntoView`가 목록뿐 아니라 피어나는 중인 패널 자체까지 스크롤했다.
  - 수정: 목록만 스크롤하고, 앵커형 패널은 스스로 스크롤되지 않게 했다(`overflow: clip`).
  - 회귀 검사를 추가했다.
- **탭 밑줄·세그먼트 물방울:** 애니메이션 중 매 프레임 레이아웃을 읽던 것을 이동을 시작할 때 한 번만 재게 했다.

## 0.2.0 — 2026-11-17

선택·입력 컴포넌트 7종과 구성·미디어 컴포넌트 4종을 추가했다. 앵커형 패널이 스크롤로 닫히지 않고 페이지에 붙어 움직이게 했고, 모달이 닫힐 때 옆으로 밀리던 현상을 고쳤다.

### 선택·입력 컴포넌트
- **`Checkbox`**
  - 실제 `<input type="checkbox">`라서 폼 제출, 키보드, 스크린 리더가 그대로 동작한다.
  - 미정(indeterminate) 상태를 지원한다.
  - 체크 표시가 그려지는 애니메이션이 있다.
  - 설명(description)을 달 수 있다.
- **`RadioGroup`·`Radio`**
  - 실제 라디오 버튼이다. 방향키로 옮기면 바로 선택되고, Tab은 선택된 항목으로 들어온다.
  - 점이 커지며 채워진다. `fieldset`·`legend`를 쓰고, 가로 배치도 된다.
- **`ChoiceList`**
  - 설정 화면처럼 목록 행이 곧 선택지다.
  - 단일 선택(radiogroup, 방향키로 이동하면 바로 선택)과 다중 선택(체크박스 묶음)을 지원한다.
  - 고른 행 오른쪽에 체크 표시가 나온다.
- **`Select`**
  - WAI-ARIA 표준 콤보박스 패턴(select-only combobox)이다.
  - 포커스는 버튼에 둔 채 ↑↓ Home End PageUp PageDown으로 움직이고, 글자를 쳐서 고를 수 있다(같은 글자 반복 시 순환).
  - Enter·Space·Tab·Alt+↑로 고르고, Esc나 바깥 클릭으로 바꾸지 않고 닫는다.
  - 그룹, 비활성 항목, 설명·아이콘을 지원한다. 숨은 input으로 폼에 값을 제출한다.
  - 필드형과 목록 행 안에 넣는 인라인형이 있다. 목록은 버튼에서 피어난다.
- **`Calendar`**
  - WAI-ARIA 날짜 그리드다. ←→↑↓로 하루·한 주, Home·End로 주의 처음·끝, PageUp·PageDown으로 한 달(Shift는 1년)씩 움직인다.
  - 최소·최대 날짜와 `isDateDisabled`를 지원한다. 키보드 이동은 최소~최대 범위 안에 머물고, 고를 수 없는 날도 포커스는 받는다(`aria-disabled`).
  - 로캘(기본 ko-KR)과 주 시작 요일을 정할 수 있다.
  - 달이 바뀌면 그쪽에서 미끄러져 들어온다. 동작 줄이기에서는 페이드로 바뀐다.
- **`DatePicker`**
  - 필드를 누르면 달력 패널이 열린다. 날짜를 고르면 닫히고 포커스가 필드로 돌아온다.
  - 숨은 input으로 yyyy-mm-dd 형식의 값을 제출한다.

### 구성과 미디어
- **`AppBar` 큰 제목 (개선)**
  - 큰 제목에서 작은 제목으로 넘어가는 과정이 스크롤 위치에 그대로 묶였다. 큰 제목이 유리 바 밑으로 들어가며 사라지고, 바의 작은 제목이 그만큼 떠오른다. 이전에는 정해진 지점에서 한 번에 바뀌었다.
  - 스크롤 처리는 DOM의 CSS 변수 하나만 바꾼다. 스크롤할 때마다 React가 다시 렌더링하던 것을 없앴다.
  - 맨 위의 투명한 바도 같은 방식이다. 큰 제목은 말줄임되고, 스크린 리더에는 제목이 한 번만 읽힌다.
- **`Breadcrumbs`**
  - `nav` 랜드마크 안에 현재 페이지가 마지막에 온다(`aria-current`, 링크 아님).
  - `maxItems`를 넘으면 가운데 단계를 … 버튼으로 접고, 누르면 숨은 단계가 메뉴로 열린다(키보드 가능).
  - 좁으면 각 단계를 말줄임한다. 링크(`href`)와 버튼(`onClick`)을 모두 지원한다.
- **`Skeleton`**
  - 글줄(여러 줄, 마지막 줄은 짧게), 원, 사각형 모양이 있다.
  - 페이지의 모든 스켈레톤이 시계 하나를 나눠 써서, 빛 한 줄기가 같은 박자로 지나간다(transform만 사용).
  - 동작 줄이기에서는 빛이 지나가지 않고 숨 쉬듯 밝아졌다 어두워진다. 고대비에서는 윤곽선이 생긴다. 스크린 리더에는 숨긴다.
- **`MediaViewer`**
  - 전체 화면 사진 보기다. 썸네일 자리에서 커지며 열리고, 보던 사진의 썸네일로 접혀 들어가며 닫힌다. 닫힌 뒤 포커스도 그 썸네일로 간다.
  - 좌우로 넘기기: 손가락을 따라가다 놓으면 속도를 이어받아 자리 잡고, 양 끝에서는 고무줄처럼 버틴다.
  - 확대: 두 번 탭·두 번 클릭, 핀치, Ctrl+휠(트랙패드 핀치), + − 0 키를 지원한다. 확대한 곳이 손가락 아래에 고정된다.
  - 확대한 채 끌면 사진 가장자리까지만 움직이고, 방향키로도 옮길 수 있다.
  - 아래로 쓸어 닫는다. 내린 거리만큼 배경이 옅어진다.
  - 터치에서는 한 번 탭하면 상단 바와 설명을 숨기거나 보인다.
  - 항상 다크 테마이고(고대비 유지), 앞뒤 사진은 미리 그려 둔다.
  - 모달이라 포커스를 가두고 페이지 스크롤을 막는다. ← → Home End로 넘기고 Esc로 닫는다.
  - 동작 줄이기에서는 열기·닫기·버튼으로 넘기기가 페이드로 바뀐다.

### 수정
- 모달 오버레이(대화상자, 시트, 액션 시트, 미디어 뷰어, 컨텍스트 메뉴)가 닫힐 때 스크롤바 폭의 절반(15px 스크롤바면 7.5px)만큼 옆으로 밀리던 현상을 고쳤다.
  - 원인: 페이지 스크롤 잠금이 닫힘 애니메이션 시작 시점에 풀렸다. 그 순간 스크롤바가 돌아와 화면 폭이 줄면서, 가운데 정렬된 패널이 사라지는 도중에 밀렸다.
  - 이제 잠금은 패널이 화면에서 완전히 빠진 다음 프레임에 풀린다(core `holdScrollLock`, 모든 오버레이가 쓰는 공통 생명주기에서 처리).
  - 검증: 실제 스크롤바가 보이는 브라우저로 열 때 페이지가 밀리지 않는지, 닫히는 모든 프레임에서 패널 위치가 열려 있을 때와 같은지 확인한다. 수정을 빼면 이 검사가 실패하는 것도 확인했다.
- 앵커에 붙어 열리는 패널(메뉴·팝오버·셀렉트·날짜 선택)이 페이지 스크롤로 닫히지 않는다.
  - 페이지의 일부처럼 앵커에 붙어 같이 움직인다. 앵커와 함께 화면 밖으로 나갔다가 돌아와도 그대로 열려 있다.
  - 패널을 문서 좌표에 놓아 페이지 스크롤은 브라우저가 직접 옮긴다(모든 프레임에서 앵커와 간격 차이 0). 안쪽 스크롤 영역은 스크롤 이벤트 안에서 바로 따라간다.
  - 스크롤 중에는 위치를 다시 계산하지 않아(뒤집기·가장자리 맞춤 없음) 튀지 않는다. 창 크기가 바뀌면 열린 쪽 그대로 다시 놓인다.
  - 닫는 방법은 Esc, 바깥 클릭, 항목 선택이다.
  - 컨텍스트 메뉴는 항목을 들어 올리고 배경을 어둡게 하는 집중 상태라, 열려 있는 동안 페이지 스크롤을 막는다(`Menu`의 `lockScroll`).
- 오버레이 내부 로직을 `overlay-hooks`로 분리했다. Menu·Popover·Select·DatePicker가 같은 위치 계산·피어남·정리 로직을 쓴다.
- Safari: 셀렉트에서 마우스로 항목을 고른 뒤에도 포커스가 셀렉트에 남게 했다.

### 검증
- **단위 테스트:** 40개(새로 24개)
- **e2e:** 선택 컴포넌트 검사(`tests/e2e/selection.mjs`)와 구성·미디어 검사(`tests/e2e/display.mjs`)를 추가했다. 둘 다 3개 엔진과 경쾌·다크+고대비+투명도 줄이기·동작 줄이기 조건에서 돌린다. 핀치는 Chromium에서 실제 두 손가락 터치로 검사한다.
- **성능:** CPU 4배 감속에서 큰 제목 스크롤, 스켈레톤, 미디어 뷰어 열기·넘기기·끌기·확대·이동·쓸어 닫기 모두 프레임 드롭 0이다.
- **기존 검사에 추가:** 렌더링 매트릭스에 선택 페이지를, 예외 상황 검사에 다음 항목을 넣었다.
  - 연타, 40개 항목, 긴 항목, 값이 거부되는 셀렉트, 비활성 셀렉트
  - 이번 달만 고를 수 있는 날짜 선택, 터치 입력, axe 접근성 검사
- **동작 줄이기 점검:** 셀렉트 목록, 체크 표시, 라디오 점, 달 전환, 미디어 뷰어 열기·넘기기, 스켈레톤을 추가했다.

## 0.1.0 — 2026-11-17

Satin Glass의 첫 버전. 빛을 따르는 유리 재질 위에 만든 React UI 라이브러리다(자체 디자인 언어).

### 패키지
- `@satin-glass/tokens`: 디자인 토큰과 `tokens.css`. 들어 있는 것은 아래와 같다.
  - OKLCH 팔레트 11색 × 11단계
  - 테마 4종(라이트·다크·라이트 고대비·다크 고대비)
  - 간격·반경·글자·크기 값
  - 모션 성격 3종(`calm`·`lively`·`playful`)과 동작 줄이기용 `reducedMotion`
  - 빌드할 때 글자 대비를 검사한다. 기준에 못 미치면 빌드가 실패한다.
- `@satin-glass/core`: 프레임워크 없는 동작과 컴포넌트 CSS(`styles.css`). 들어 있는 것은 아래와 같다.
  - 스프링(속도를 이어가는 JS 스프링, CSS용 `linear()` 이징)
  - 포인터를 따르는 빛
  - 물방울 선택 표시
  - 오버레이: 위치 계산, 피어남 애니메이션, 포커스 가두기, 레이어 스택
  - 끌기, 길게 누르기
  - 동작 줄이기 범위 판단
- `@satin-glass/react`: React 컴포넌트 40여 개.
  - 기반: `ThemeProvider` `createTheme` `MotionScope` `Glass` `Text` `Stack` `Divider` `Portal`
  - 버튼: `Button` `IconButton` `ButtonGroup`
  - 입력: `TextField` `SearchField` `Switch` `Slider` `Stepper` `SegmentedControl` `Chip`
  - 내비게이션: `TabBar` `Tab` `TabBarAction` `AppBar` `ScrollFade` `Sidebar` `PageControl`
  - 표시: `List` `ListItem` `ListSection` `Card` `Avatar` `Badge` `Progress` `Spinner`
  - 오버레이: `Dialog` `Sheet` `Menu` `Popover` `ActionSheet` `ContextMenu` `Toaster`·`useToast`

### 디자인
- **재질:** 빛을 따르는 유리. 빛을 받는 쪽 테두리만 밝고, 포인터 하이라이트가 따라오며, 배경색이 옅게 스며드는 틴트를 쓸 수 있다.
- **모양:** 고정 반경을 쓴다. 컨트롤 12, 카드 16, 바·패널 22, 시트 28이다.
- **글꼴:** Pretendard를 권장한다(라이브러리에는 넣지 않음).
- **모션:**
  - 이름 붙은 스프링 5종과 성격 3종을 쓴다.
  - 탭·세그먼트 선택은 물방울 다리 방식이다(트랙 밖으로 나가지 않음).
  - 스위치는 물방울 손잡이에 도착할 때 눌림 효과가 있다.
  - 슬라이더 손잡이는 젤리처럼 늘어난다.
  - 메뉴·팝오버는 앵커에서 피어난다.
  - 짧게 움직이는 컨트롤일수록 빠른 스프링을 쓴다.
- **접근성:**
  - 고대비 테마 2종, 투명도 줄이기, 동작 줄이기를 지원한다. 셋 다 운영체제 설정을 따르거나 앱 안에서 켤 수 있다.
  - 동작 줄이기에서 작은 변화는 짧고 넘치지 않게 움직이고, 큰 움직임은 페이드로 바뀐다.
  - 키보드 조작, 포커스 링, 스크린 리더용 역할·이름을 갖춘다.

### 검증 (`pnpm test`, `pnpm e2e`)
- **단위 테스트:** core 8개, react 16개.
- **렌더링 매트릭스:**
  - 범위: 테마 × 고대비 × 투명도 줄이기 × 동작 줄이기 16가지 조합, 12페이지, 데스크톱·모바일 폭. WebKit·Firefox는 8가지 조합이다.
  - 항목: 페이지 오류, 가로 넘침, 글자 잘림, 실제 배경 기준 글자 대비(고대비 7:1), 투명도 줄이기 적용.
- **상호작용:**
  - 엔진: Chromium·WebKit·Firefox
  - 조건: 모션 성격 calm·playful, 다크+고대비+투명도 줄이기, 라이트+고대비
- **동작 줄이기:** 앱 안 토글과 시스템 설정 두 경로를 3개 엔진에서 검사한다. 동작을 줄이지 않으면 같은 검사가 모두 실패하는지도 함께 확인한다(검사가 실제 움직임을 잡아낸다는 확인).
- **예외 상황 (3개 엔진):**
  - 연타, 애니메이션 중 창 크기 변경·페이지 이동, 끌기 중 페이지 이동
  - 경계값, 비활성, 값이 거부되는 제어 컴포넌트
  - 긴 텍스트, 터치(탭·길게 누르기·스와이프), 키보드만으로 조작
  - 320px 폭, 열고 닫기 48회 뒤 남는 것이 없는지
  - axe 접근성 검사(심각·치명 위반 0)
- **성능:** CPU 4배 감속에서 주요 전환의 프레임 드롭 0. 페이지 첫 오버레이만 준비 비용으로 첫 프레임이 1번 늦을 수 있다.

### 알려진 한계
- 실제 iOS·Android 기기와 스크린 리더(VoiceOver·TalkBack)에서는 아직 확인하지 않았다. 자동 검사는 데스크톱 엔진의 터치·키보드 모방이다.
- SSR(Next.js)에서 렌더링하는 것까지만 고려했고, 하이드레이션 테스트는 없다.
