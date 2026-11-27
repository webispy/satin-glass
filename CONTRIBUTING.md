# Contributing

How work is planned, checked and shown before it lands is in [AGENTS.md](AGENTS.md); this file covers setup,
commits, adding a component, tests and releases.

## Setup

Node 24 (`.nvmrc`) and pnpm (the version in `package.json`). Run `pnpm install`, which also points git at
`.githooks` (its `commit-msg` hook checks messages against the rules below), then `pnpm build` once: the docs app
and the tests use the packages' build output. The e2e suites need Playwright's browsers once:
`pnpm exec playwright install chromium webkit firefox`.

## Commits

Commit messages follow the Linux kernel style
([submitting-patches](https://www.kernel.org/doc/html/latest/process/submitting-patches.html#describe-your-changes)),
in English.

```
react/wheel: stop the drum bending at the list ends

A hard fling on a trackpad overscrolls the year wheel past its last
row, and the elastic bounce stretches the whole drum with it.

Turn overscroll off on the scroller and clamp the centre row used to
lay out the drum, so a bounce Safari still reports (scrollTop past the
end) cannot bend the end rows.

Signed-off-by: Your Name <you@example.com>
```

- **Subject**: `<area>: <summary>`, at most 72 characters (aim for 50–60), imperative mood ("add", "fix",
  "stop"), no capital after the colon, no full stop.
- **Area**: the part of the tree the change is about, from the table below. Use the narrowest one that applies;
  `<area>/<component>` when a change is about one component. A change spread evenly over the whole tree is
  `treewide`.
- **Body**: wrapped at 72 columns, after one blank line. Say why first: what was wrong or missing, as the user or
  the next maintainer would see it. Then say what the change does about it, at the level of decisions, not a list
  of edited files. Mention what was verified and how when it is not obvious (engines, e2e suites, measurements).
- **Trailers**: `Signed-off-by:` (`git commit -s`) on every commit, certifying the
  [Developer Certificate of Origin](https://developercertificate.org/); `Co-Authored-By:` for co-authors;
  `Reviewed-by:` for each reviewer whose findings the change acts on, people or AI agents (name the model:
  `Reviewed-by: Codex gpt-6.2-sol <noreply@openai.com>`, `Reviewed-by: Gemini gemini-4-neon-high <noreply@google.com>`);
  `Fixes: <12-char SHA> ("subject")` when fixing an earlier commit; `Link:` for an issue or discussion.
- **One logical change per commit**, and every commit builds and passes its tests, so `git bisect` works. No
  "WIP" or "fix typo in previous commit" commits on the main branch: fold them in before merging.
- Call out breaking API or CSS changes in the body and in `CHANGELOG.md`.
- `scripts/check-commits.mjs` checks the mechanical part: the subject's shape and length, the blank line, body
  lines within 72 columns (indented lines and URLs excepted), a `Signed-off-by` from the author, and `Name
  <address>` on every person trailer. The `commit-msg` hook runs it on each commit; CI runs it on every commit a
  push or pull request brings and also refuses `fixup!`, `squash!`, `amend!` and `wip` subjects. Choosing the area
  and saying why is up to you.

| Area | Scope |
|---|---|
| `tokens` | `packages/tokens`: palette, themes, tokens, contrast checks |
| `core` | `packages/core`: springs, the pointer sheen (`light`), the stretch-and-stick selection (`bridge`), gestures, overlays, and the CSS sources |
| `react` | `packages/react`; `react/<component>` for one component (`react/wheel`, `react/tabbar`) |
| `docs` | `apps/docs`, `docs/` and the root documents (README, CONTRIBUTING, AGENTS) |
| `e2e` | `tests/e2e` |
| `github` | `.github`: issue and pull request templates, workflows |
| `build` | package layout, bundling, workspace and tooling (`scripts/`, `.githooks/`) |
| `release` | version bumps and the changelog entry that goes with them (`release: 0.4.0`) |
| `treewide` | mechanical changes across everything (renames) |

## Adding a component

1. Write its public contract first ([AGENTS.md, Before building](AGENTS.md#before-building)) and get it reviewed.
2. Build it in `packages/react/src` and put its styles in the category stylesheet under `packages/core/styles`.
   Export it from `packages/react/src/index.ts` and from its category entry in `packages/react/src/entries/` (the
   entry is how `e2e:changed` and `scripts/docs-props.mjs` find it).
3. Put the words it writes itself (labels, accessible names, announcements) in `packages/react/src/messages.ts`, in
   English and Korean, and give every option JSDoc.
4. Show it in the docs app: a section on its category page in both languages, a usage example in
   `apps/docs/src/examples/`, and its name in that page's `<Page api={…}>`. Run `node scripts/docs-props.mjs`.
   Add it to the category table in `README.md` and `README.ko.md`.
5. Add unit tests for its behaviour. Once the design is chosen, add e2e for interaction and motion (see below).
   The suites that walk every page (`corners`, `blur-budget`, `focus`, `edge` with 320 px reflow, `axe`,
   `matrix`, `sweep`, `css-split`, `i18n`) pick it up by themselves.
6. Add a `CHANGELOG.md` entry under the unreleased version.

## Tests while working

`pnpm test:changed` and `pnpm e2e:changed` run only what covers the change: uncommitted work on `main`, or a branch
against its merge base (`--base <ref>` to compare with something else; see the [README](README.md#development)).
A new e2e suite needs two things to run at all: an entry in the phase lists of `tests/e2e/run.mjs` (and its time in
`EST`), and a `// covers: <categories>` line near its top (category names, `*` for any, `css` for any stylesheet)
so that `e2e:changed` picks it.

CI runs the e2e suites without the timing phase. On a pull request it runs Chromium's quick part (no setting
variants) in four jobs. On `main` it runs the full run, split by engine into jobs that run side by side: Chromium
with the setting variants and English in six, WebKit and Firefox in five each, one suite at a time (they draw
slower on a shared runner). WebKit's jobs leave out the wheel lens's frame-by-frame suite (`wheel-motion`): on the
runner WebKit stops drawing for 60–200 ms as each turn starts, so it runs in WebKit on macOS only (#113). On the
runner, WebKit still misses one timing check or another in most runs, so the failed checks of a suite that measures
motion as it happens (the motion phase), when it ran to its end, are reported as warnings on the run and in the
job's summary without turning the job or the commit red. A WebKit warning on `main` is a lead to check on macOS,
not a broken build. Any other WebKit failure still turns the job red: a setup or build step, a suite of the checks
phase, a suite that crashed or stopped part way, a page or console error. So a pull request is still checked in
three engines locally (`pnpm e2e:changed`), and an engine-only failure shows on `main` after the merge.

## Releases

The three packages are versioned together. A release is one commit, `release: X.Y.Z`: the version in every
`packages/*/package.json`, the date on the unreleased section of `CHANGELOG.md`, the status line in both READMEs.
It is tagged `vX.Y.Z`. Before tagging, `pnpm typecheck`, `pnpm test`, `node scripts/docs-props.mjs --check` and the
full `pnpm e2e` pass: every suite in all three engines, plus the Chromium runs (each theme, motion personality and
reduced setting; the render matrix and the axe scan with the docs in English) and performance with the CPU slowed
4×.
