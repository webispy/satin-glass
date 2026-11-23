# Contributing

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
  `Reviewed-by: Codex gpt-6.2-sol <noreply@openai.com>`);
  `Fixes: <12-char SHA> ("subject")` when fixing an earlier commit; `Link:` for an issue or discussion.
- **One logical change per commit**, and every commit builds and passes its tests, so `git bisect` works. No
  "WIP" or "fix typo in previous commit" commits on the main branch: fold them in before merging.
- Call out breaking API or CSS changes in the body and in `CHANGELOG.md`.

| Area | Scope |
|---|---|
| `tokens` | `packages/tokens`: palette, themes, tokens, contrast checks |
| `core` | `packages/core`: springs, the pointer sheen (`light`), the stretch-and-stick selection (`bridge`), gestures, overlays, and the CSS sources |
| `react` | `packages/react`; `react/<component>` for one component (`react/wheel`, `react/tabbar`) |
| `docs` | `apps/docs` and `docs/` |
| `e2e` | `tests/e2e` |
| `github` | `.github`: issue and pull request templates, workflows |
| `build` | package layout, bundling, workspace and tooling |
| `release` | version bumps and the changelog entry that goes with them (`release: 0.4.0`) |
| `treewide` | mechanical changes across everything (renames) |

## Tests while working

`pnpm test:changed` and `pnpm e2e:changed` run only what covers the change (see the
[README](README.md#development)). Give a new e2e suite a `// covers: <categories>` line near its top, and export
a new component from its category entry in `packages/react/src/entries/`, so that `e2e:changed` can find them.

## Releases

Versions are tagged `vX.Y.Z` on the commit `release: X.Y.Z`. The three packages are versioned together. Before
tagging, `pnpm e2e` must pass in all three engines (all themes, motion personalities, reduced motion, edge cases,
axe, performance with the CPU slowed 4×).
