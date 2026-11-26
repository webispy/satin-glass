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
- **No styling from the agent.**
- **Agent data.**
  - Errors in an agent's messages are reported, not thrown. Each message must be a wire envelope: an object with an accepted `version` and exactly one message key for that version.
  - `sendDataModel` and action context carry what the user typed, obscured fields included.
- **Deleted surfaces.** When the agent deletes the surface that held the focus, the `<A2uiSurfaces>` region takes it (or, for `<A2uiSurface>`, the element in its `fallbackFocus` option).

## Licence
Apache-2.0. The A2UI examples in `test/fixtures` are Copyright Google LLC, under the Apache License 2.0; see the README in that folder.
