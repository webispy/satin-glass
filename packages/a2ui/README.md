# @satin-glass/a2ui

**Experimental, not yet published** ([#62](https://github.com/webispy/satin-glass/issues/62)).

Draws [A2UI](https://a2ui.org) agent surfaces with Satin Glass controls. It covers protocol v1.0 and v0.9.1, and all 18 components of each version's basic catalog. `@a2ui/web_core` handles the protocol: messages, data bindings, checks and actions. This package only draws the surfaces, in the app's theme and language.

```tsx
import { A2uiSurfaces, useA2ui } from '@satin-glass/a2ui';

function AgentReply({ send }: { send: (envelope: unknown) => void }) {
  const a2ui = useA2ui({ onOutbound: send });
  // feed each message from the agent once, in order: a2ui.process(message)
  return <A2uiSurfaces a2ui={a2ui} />;
}
```

## The session
- `useA2ui(options)` returns a session.
  - `process(input)` takes one envelope, an array of envelopes, or JSONL text.
  - `surfaces` lists the surfaces, in the order they were created.
  - `capabilities()` returns what to tell the agent: the catalog IDs, by version.
  - `dataModel(version)` returns the data models of the surfaces that asked for theirs.
  - `reset()` starts a new session.
  - `processor` is the web_core `MessageProcessor`, for anything this API does not cover.
- Options:
  - `onOutbound(envelope)`: messages for the agent, versioned. These are actions, errors, function calls and their results.
  - `onReport(report)`: local reports, such as a payload that failed validation or a refused URL.
  - `locale`: the language for formatting and for the built-in words. Defaults to the locale of the nearest `ThemeProvider`.
  - `words`: overrides for any of the built-in words (the defaults come in English and Korean).
  - `icons`: what to draw for each icon name.
  - `allowUrl(url, use)`: the URL policy.
  - `versions`: which protocol versions to accept.
- `<A2uiSurfaces a2ui>` draws every surface in one region. `<A2uiSurface a2ui surfaceId>` draws one surface. Both take `lang`, the language of the agent's content when it differs from the page's.
- Both also take `ground`, which says where the app draws them. With `'page'` (the default) the agent's outermost Card is a Satin surface card, and a Card inside it has a hairline. When the surfaces already sit inside a card, sheet or bubble of the app's own, pass `ground="surface"`: every agent Card is then drawn with a hairline, so nothing lifts twice. A dialog the agent opens starts again. `<A2uiProvider ground>` sets it for the surfaces inside, and a surface's own option comes first.
- `satinCatalogs()` returns the catalogs, for an app that manages its own processor. Such an app draws its surfaces with `@a2ui/react`'s `A2uiSurface` inside `<A2uiProvider>`, which gives the components their words, icons, media URL policy and report handler.
- The session object and its methods keep their identity. `subscribe` and `getSnapshot` follow the surfaces.

## Satin Glass's look
Where the catalog leaves the look open, the surfaces take Satin Glass's, so an agent's screen reads as part of the app.
- **Cards.** The outermost Card is a surface card, and a Card inside it has a hairline. See `ground` above.
- **Buttons.** A Button's label uses the control text role (`--sg-text-control-*`). A Text of one plain paragraph inside a Button is drawn as the button's label, not as a paragraph; a heading, caption, list or several paragraphs keep their own type. A Button is as wide as its label, placed by its Column's alignment (at the start when the Column stretches); with a `weight` in a Row, it takes its share. It is made prominent by its variant, not its width. An Icon inside a Button takes the button's icon size.
- **Images at a Card's top or bottom.** An Image with the `mediumFeature`, `largeFeature` or `header` variant and no `weight` runs to the Card's sides and edge when it is the Card's child, or the first or last child of a Column that is the Card's child (stretched, without a `weight`, with its children listed by ID rather than from a template).
  - It keeps the image's proportions, up to a 4:5 portrait (5/4 of the Card's width) and 400 px. A header is 200 px high.
  - It fills that box (`cover`) unless the agent sets `fit`.
- **The whole image.** When such an image fills its box (`cover`) and the box's proportions differ from the image's by more than 3%, the box crops it. The image is then a button named "View the whole image", followed by the image's label or description when it has one. The button opens the image in full in the media viewer. The words can be changed with `words.wholeImage`.
- **Rows and Columns.** Both align their children by the catalog's default, `stretch`, when the agent gives no `align`, with one refinement: a Row with no `align` and no Column, Card or List in it aligns its children by their first baselines (a caption beside a Button's label, a small price beside a large one). A Column that contains only Texts (a name and its caption) keeps them 4 px apart, as one block.
  - **One line.** A Row keeps its children on one line, as the catalog draws it. Its Texts give way to their siblings and wrap between words; Icons and Images keep their size. It wraps only in three cases: to stack panels (see Narrow rows); to move whole Buttons to another line when it holds only Buttons; and, when it holds a `mediumFeature` or `largeFeature` Image, to move an unweighted Column beside the Image below it once that Column would be narrower than 9rem (a large picture sends its text below on a phone; a small one keeps it alongside).
  - **Width in a Column.** A Row whose `justify` is `spaceBetween` takes its Column's width whatever the Column's alignment, so its ends meet the ends of a full-width sibling such as a Slider. In a Column that does not stretch, a Row whose `justify` is `spaceAround` or `spaceEvenly` gives each child a slot of up to 6rem, and is placed by the Column's alignment, so a few numbers do not drift to the Card's edges. A field (TextField, Slider, DateTimeInput, ChoicePicker) takes its Column's width. With a `weight` in a Row, the whole TextField takes its share, not only its input.
  - **Tables.** A Row on one line with two or more weighted children is a row of a table. The rows in a Column share one width: the narrowest at which every cell, given its share by `weight`, keeps its longest word whole. Their columns then stay in line from row to row and with a header Row, and their figures are tabular. When the table is wider than its Column, the Column scrolls sideways: an edge with more content beyond it fades out, a flick past its end stops there, and it is a named region in the Tab order (`words.scrollTable`) that the arrow keys scroll.
- **Numbers.** A number with group separators (`$850,000,000,000.00`) is one word: it is never split across lines.
- **Images and Icons.** An Image that is not at a Card's edge keeps its own size: a `mediumFeature` (the default) no wider than the available space and 300 px, a `largeFeature` no wider than the space and no higher than 400 px. A 50 px thumbnail stays 50 px, and its Row or Column does not stretch it. An Icon sits in the middle of its 24 px box.
- **Short choices.** A ChoicePicker for a single choice, shown as chips, without a filter and with two to four options, is drawn as a segmented control when the agent's value is one of the options (a segmented control always shows one chosen) and the labels fit on one line. Otherwise, and before the page is laid out (server rendering), it is drawn as chips. The fit is checked again when the picker's width changes; a choice the user makes does not switch the control while they use it.
- **Dates.** The date and time pickers write dates and times in the session's language. `formatDate` treats single-quoted text in its pattern as literal text, as Unicode date patterns do: `'at'` is written as "at", and `''` as an apostrophe.

## Policies
- **Accessible names.** An agent's accessibility label (`@accessibility.label` in v1.0, `accessibility.label` in v0.9.1) names a control only when the control has no visible text, or the label contains that text as whole words. Otherwise the visible text stays the control's name (WCAG 2.5.3), the label names the component's group, and a report is raised. This departs on purpose from the protocol, where the label always wins.
- **Validation.**
  - A field shows its check messages once the user has left it.
  - A button disabled by its checks says why straight away.
- **Icons.** The app gives the icons. A name the app did not give draws a neutral glyph and raises a report.
- **URLs.**
  - Media URLs pass web_core's sanitiser, then `allowUrl`. By default `https:`, same-origin and `data:` media URLs (`image/`, `video/`, `audio/`) are allowed.
  - `openUrl` allows only `http:`, `https:`, `mailto:` and `tel:` URLs that also pass `allowUrl` (by default `https:`, same-origin, `mailto:` and `tel:`). It runs at most once per trusted press of an A2UI button, within a second of that press and, where the browser can tell, while the user's gesture is still live. A script's click opens nothing.
- **Patterns.** An agent's regular expressions (v0.9.1 `validationRegexp`, and the `regex` check in both versions) run only when their work is bounded. Backreferences, lookaround and `(?...)` groups other than `(?:...)` are not allowed, and neither is a repeated group that holds a repetition or an alternation. At most two unbounded repetitions are allowed, and bounded ones (with an upper bound of at most 1,000) may multiply to at most 256 ways. Patterns are at most 200 characters and run on text of at most 256 characters (longer text fails the check). Any other pattern is reported; it fails a `regex` check and is skipped for `validationRegexp`.
- **Narrow rows (a Satin adaptation).** The catalog says a Row lays its children out side by side, and the reference renderers keep them on one line. Here a Column or Card with a `weight` that is a Row's own child keeps a minimum width (15rem, or the whole row when it is narrower), so a narrow Row stacks such panels rather than squeezing them (WCAG 1.4.10 reflow). Weighted text, icons and buttons stay side by side.
- **No styling from the agent.**
- **Agent data.**
  - Errors in an agent's messages are reported, not thrown. Each message must be a wire envelope: an object with an accepted `version` and exactly one message key for that version.
  - `sendDataModel` and action context carry what the user typed, obscured fields included.
- **Deleted surfaces.** When the agent deletes the surface that held the focus, the `<A2uiSurfaces>` region takes it (or, for `<A2uiSurface>`, the element in its `fallbackFocus` option).

## Licence
Apache-2.0. The A2UI examples in `test/fixtures` are Copyright Google LLC, under the Apache License 2.0; see the README in that folder.
