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
| 2026-11-22 | css-split · reverse category order · dashboard `?mode=dark&hc=1&rm=1` | 3 | Chromium, full run, 16 at once; elements inside the charts' SVG differ (18 of 830) | open: suspect a chart still settling when the styles are read |
| 2026-11-23 | data · tabs: → selects the next tab and the underline travels under it | 1 | Chromium, full run, 16 at once; underline at 447 px, tab at 444 px | open |
| 2026-11-23 | edge · tab bar: window resized mid-travel → indicator still lands on the tab | 1 | full run, 16 at once, Chromium | open |
| 2026-11-23 | perf · showcase scroll under glass bars | 1 | Chromium, timing phase (alone); 2 frames over 25 ms | open |
| 2026-11-22 | edge · 320 px reflow on the Colour page (`colors`, 7 px too wide) | 1 | Chromium, full run, 16 at once | open |
