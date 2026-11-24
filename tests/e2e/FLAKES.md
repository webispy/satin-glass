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
| 2026-11-22 | css-split · reverse category order · dashboard `?mode=dark&hc=1&rm=1` | 4 | Chromium, full run, 16 at once, and once in CI (shard 1/4); elements inside the charts' SVG differ (18–36 of 830) | open ([#2](https://github.com/webispy/satin-glass/issues/2)): suspect a chart still settling when the styles are read |
| 2026-11-23 | data · tabs: → selects the next tab and the underline travels under it | 1 | Chromium, full run, 16 at once; underline at 447 px, tab at 444 px | open |
| 2026-11-23 | edge · tab bar: window resized mid-travel → indicator still lands on the tab | 1 | full run, 16 at once, Chromium | open |
| 2026-11-23 | perf · showcase scroll under glass bars | 1 | Chromium, timing phase (alone); 2 frames over 25 ms | open |
| 2026-11-24 | reduce-motion · in-app toggle: tab selection slides briefly, rigid | 2 | Firefox on a CI runner, suite alone, 1 of 3 runs each time: arrived 304 ms, then 316 ms after it started moving (limit 300); onset at frame 1, at rest, no overshoot. Probe runs 45336553163 and 45353522022 (artifact `firefox-probe`) | open: Firefox delivers frames later on shared runners; Chromium and WebKit arrive in 191-248 ms |
| 2026-11-24 | data · bar chart: grouped → stacked over many frames (no jump) | 1 | Firefox on a CI runner, suite alone (1 of 3 runs, probe 45336553163): largest step 12.1 px per 60 Hz frame (limit 12) | open: steps are now scaled to the frame time as loop() advances it; 3 of 3 pass in the last probe (45353522022) |
| 2026-11-22 | edge · 320 px reflow on the Colour page (`colors`, 7 px too wide) | 1 | Chromium, full run, 16 at once | open |
