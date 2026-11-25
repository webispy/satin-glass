# Failures under watch

A suite that fails and then passes is not done: the first failure is evidence. That includes a timing suite
(`perf`, `progress-tick`, `timing`) that the runner tries a second time and reports as "passed on the second run".
`tests/e2e/run.mjs` keeps every failed run's output in `tests/e2e/failures/` (ignored by git; CI uploads it as the
`e2e-failures-*` artifact) with the engine, the settings, how many suites ran at once, the machine load and the
commit. Add a row for every such failure, or raise `Seen` when it is already listed; reproduce it in isolation and
under load. Close a row by setting `State` to `closed: <cause> (<commit>)` once the cause is fixed, never because a
rerun passed.

| Since | Suite · case | Seen | Conditions | State |
|---|---|---|---|---|
| 2026-11-22 | css-split · reverse category order · dashboard `?mode=dark&hc=1&rm=1` | 4 | Chromium, full run, 16 at once, and once in CI (shard 1/4); elements inside the charts' SVG differ (18–36 of 830) | closed ([#2](https://github.com/webispy/satin-glass/issues/2)): the snapshot came before the page settled — a chart not yet drawn and one-sided animations (6f4cd11), then the stat cards' 700 ms skeleton, which looked settled and swapped in sparklines that had not drawn by the snapshot; the wait now also needs nothing `aria-busy` |
| 2026-11-23 | data · tabs: → selects the next tab and the underline travels under it | 1 | Chromium, full run, 16 at once; underline at 447 px, tab at 444 px | open |
| 2026-11-23 | edge · tab bar: window resized mid-travel → indicator still lands on the tab | 1 | full run, 16 at once, Chromium | open |
| 2026-11-23 | perf · showcase scroll under glass bars | 1 | Chromium, timing phase (alone); 2 frames over 25 ms | open |
| 2026-11-24 | reduce-motion · in-app toggle: tab selection slides briefly, rigid | 2 | Firefox on a CI runner, suite alone, 1 of 3 runs each time: arrived 304 ms, then 316 ms after it started moving (limit 300); onset at frame 1, at rest, no overshoot. Probe runs 45336553163 and 45353522022 (artifact `firefox-probe`) | open: Firefox delivers frames later on shared runners; Chromium and WebKit arrive in 191-248 ms |
| 2026-11-24 | data · bar chart: grouped → stacked over many frames (no jump) | 1 | Firefox on a CI runner, suite alone (1 of 3 runs, probe 45336553163): largest step 12.1 px per 60 Hz frame (limit 12) | open: steps are now scaled to the frame time as loop() advances it; 3 of 3 pass in the last probe (45353522022) |
| 2026-11-24 | edge · disabled: switch, slider and a disabled segment ignore input | 1 | Chromium, full run (Chromium and WebKit, 16 at once); clicking the disabled segment `B` threw "Element is outside of the viewport" and ended the suite; passed twice alone | open |
| 2026-11-24 | perf · virtual table, 5,000 rows: fast wheel scrolling | 1 | Chromium, timing phase (alone), branch perf/pointer-light (32893fc): 2 frames over 25 ms; a 12-run comparison with main on the GPU showed no difference | open: not this branch: the same measure fails on main, on the GPU every run (#53) |
| 2026-11-25 | many-items, edge · first suites of a CI shard: `page.goto: net::ERR_CONNECTION_REFUSED` | 1 | CI, shard 4/4 (Chromium), PR #45, run 45527812331: both suites ended within 1 s, every later suite of the shard passed | closed: the runner waited a fixed 1.5 s for `vite preview`; it now serves the docs with Vite's `preview()` and starts once that listens ("e2e: start the suites once the docs server listens") |
| 2026-11-25 | interactions · tab tap: the drop stretches while travelling | 1 | Chromium, changed run (Chromium and WebKit, 6 at once, load 3.7), branch perf/fling-placeholders: peak 109 px against rest 91 px; passed 3 times alone | open |
| 2026-11-25 | many-items · many-seg-full @390: tap selects each item, indicator lands | 1 | Chromium, changed run (quick, many suites at once, load about 7), branch exp/a2ui-preview: the indicator 2.56 px off item #2; passed 3 times alone | open |
| 2026-11-25 | perf · tab bar: tap travel (droplet) | 3 | Chromium, timing phase (alone), changed runs of the #56 and #3 branches on 265abda (neither touches the tab bar), load 2.5–2.7: 2 frames over 25 ms (max 33.4), no long tasks; passed on the second run every time. The first two while unit tests and dry runs for a review were running on the same machine; the third (2026-11-26, #3 branch, full run) with nothing else running, load 2.7 falling from 7.5 | open: the same two frames each time, so not load alone |
| 2026-11-22 | edge · 320 px reflow on the Colour page (`colors`, 7 px too wide) | 1 | Chromium, full run, 16 at once | open |
