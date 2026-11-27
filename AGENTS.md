# Working on Satin Glass

How changes are made here, for people and for AI coding agents alike. The library's look and behaviour are held to
a written design language and checked by tests; most of the quality comes from the order in which work is done and
checked, which this file records. Setup, commit format, adding a component, tests and releases are in
[CONTRIBUTING.md](CONTRIBUTING.md). "The owner" below is the maintainer; for an outside contribution, read it as
the reviewer of your pull request.

## Read first

- [`docs/design-language.md`](docs/design-language.md): the principles in priority order and every decided value
  (material, depth and layers, how a choice is shown, corners, motion, performance, accessibility). It is in Korean,
  with an English summary at the top. A change that contradicts it either changes the document in the same commit,
  with the reason, or is wrong.
- [README, Development](README.md#development) for the commands; [`CHANGELOG.md`](CHANGELOG.md) for what changed
  recently.

## Before building

- **Write the public contract down first** for a new component, a new option or a changed default: names (compare
  the sibling components), what happens when an option is left out, precedence (the component's own option, then
  the nearest `ThemeProvider`, then the package default), server rendering and hydration, keyboard, accessible
  names, the locale and the built-in words (`packages/react/src/messages.ts`, English and Korean). Write the call an
  app would make with nothing set, and once it is built, run it. A default that suits only one language or one app
  is a bug.
- **Decisions get independent reviews.** For API and design trade-offs, get two reviews made without seeing each
  other (this project uses Codex `gpt-6.2-sol` and `gpt-6.2-astra`; [CLAUDE.md](CLAUDE.md) has the commands; a
  human reviewer will do), weigh them against the code and the design language, decide, and record why in the
  commit message. Do not hand the owner a multiple-choice question when the design language and the reviews can
  settle it.
- **References are for needs, not shapes.** When another product or site motivates a component, take from it what
  the user is trying to do, then design from the design language. Do not reproduce its layouts, names or data.

## While building

- **Visual work is previewed before it is applied.** Show it in the docs app (`pnpm dev`) or on a preview page,
  next to the alternatives when there are several (A/B studies side by side). Keep it in the tree only after the
  owner has looked. Write tests once a variant is chosen, not for every study.
- **Motion answers a user action.** Its direction, start and end match what the hand did; measure it frame by frame
  for short and long gestures and at the ends. No decorative effects. Follow the springs and personalities in
  [`docs/design-language.md`](docs/design-language.md) §5–7.
- **Edit CSS rule by rule.** Replacing a block deletes the rules inside it you did not mean to touch; review every
  removed line.
- **Parallel work only on disjoint files.** Several agents may edit different files in one working tree, but none
  builds or runs e2e while another is still working in it (they share `dist/` and half-edited sources). Independent
  features go on their own branches or worktrees from the start, so they can land as separate commits. Whoever
  integrates reads every line the others changed, not a sample.

## Before showing it

Check every surface the change touches:

- both languages (`?lang=en`, `?lang=ko`); all four themes (`?mode=light`, `?mode=dark`, each with `&hc=1`);
  reduced motion (`rm=1`) and reduced transparency (`rt=1`);
- each breakpoint the change can affect, just below and at its threshold, resizing both ways, and 390 px phone
  width;
- scrolling, hover, keyboard focus and open states (menus, popovers, sheets), including resizing or hiding the
  anchor while an overlay is open;
- alignment and sizes by measurement (positions, widths before and after scrolling), not by eye.

Bring the numbers and screenshots with the preview. The owner's review is for design judgement, not for finding
defects these checks would have found.

## Docs and words

- Every page reads in English and Korean. Strings sit next to the demo they explain as `t({ en, ko })` or
  `<L en ko />`. English is plain and precise, in British spelling. Korean uses the terms developers already use
  (스크롤, 툴팁, 필터 바, 드로어), not coined words, and no translationese. One term per concept across pages; the
  docs call component props "options".
- Every exported component option has JSDoc, unless the shared descriptions in `scripts/docs-props.mjs` cover it.
  Regenerate the API tabs with `node scripts/docs-props.mjs`; CI runs it with `--check` and fails on a missing
  description or a stale `apps/docs/src/generated/props.json`.
- A visible label must stay inside the control's accessible name as a word (WCAG 2.5.3): "3 페이지", not "3페이지",
  for a page button showing "3". Check copy suggestions against this before applying them.
- Prose is reviewed separately from code (this project uses Gemini through the `agy` CLI; see
  [CLAUDE.md](CLAUDE.md), or ask a human reviewer). Verify each finding against the code and these rules before
  taking it; reject it with a reason otherwise.
- The e2e suites read the Korean docs (the full run also checks the render matrix and axe in English). Changing a
  Korean string means updating the suites that match it.

## Tests

- While working: `pnpm test:changed` and `pnpm e2e:changed:quick` (Chromium, without the setting variants). Before
  asking to push: `pnpm typecheck`, `node scripts/docs-props.mjs --check`, `LC_ALL=en_US.UTF-8 pnpm test` (CI runs
  under an English locale) and `pnpm e2e:changed` (three engines). The `changed` commands compare uncommitted work
  on `main`, or a branch with its merge base; after committing on `main`, pass `--base origin/main`.
- A suite that fails and then passes, on a rerun or on the automatic second try of a timing suite, goes into
  [`tests/e2e/FLAKES.md`](tests/e2e/FLAKES.md) (its output and conditions are kept in `tests/e2e/failures/`) and
  is fixed at its cause.
- Before a release, the full `pnpm e2e` passes.

## Commits and pushing

- **Code is reviewed before it is pushed, in proportion to its reach.**
  - **Two independent reviews** (as for decisions, see Before building) for a change to shared internals or to the
    public contract: `@satin-glass/core`, a hook or helper several components share (overlays, anchoring, motion,
    layout; also one kept in a component's file, such as the charts' `useMorph`), the stylesheets every component
    reads (tokens, foundation), or an export or type, a public option, default, built-in word or callback.
  - **One review** for a change confined to one component's internals, or to tests, scripts or CI.
  - Prose is still reviewed separately in either case (see Docs and words).
  - If a one-review change widens during review (a component fix that ends up changing a shared hook, for example),
    get a second, independent review.
- Commit locally once a change is verified, and for visual work once the owner has chosen. Before pushing, drop
  studies that were not chosen and fold fix-ups into the feature commit they belong to, so that every pushed commit
  builds and passes.
- Kernel-style messages with `Signed-off-by` (`git commit -s`); the commit-msg hook (`.githooks`, set up by
  `pnpm install`) and CI check the format. Credit reviewers whose findings a commit acts on with `Reviewed-by`.
- Push to `main` only with the owner's agreement: normally a cleaned batch; an urgent fix may go alone, still with
  that agreement.
