# @satin-glass/react

React components for [Satin Glass](https://github.com/webispy/satin-glass): frosted, grained translucency, a fixed top light and a soft sheen, with motion that stretches and sticks. Controls, layout, navigation, selection, overlays, feedback, and data (a virtualised table and SVG charts).

```bash
npm i @satin-glass/react
```

The tokens and the behaviour core come with it as dependencies. React 18.2 or later.

```tsx
import '@satin-glass/react/styles.css';
import { ThemeProvider, createTheme, Button } from '@satin-glass/react';

export function App() {
  return (
    <ThemeProvider theme={createTheme({ mode: 'system' })}>
      <Button variant="filled">Continue</Button>
    </ThemeProvider>
  );
}
```

Components are also exported by category (`@satin-glass/react/controls`, `/data`, …) with matching stylesheets (`@satin-glass/react/css/<category>.css`, `foundation.css` first). `styles.layer.css` puts everything in `@layer satin-glass`.

See the [docs](https://webispy.github.io/satin-glass/) for every component, and the [repository README](https://github.com/webispy/satin-glass#readme) for the category table and which stylesheets each category needs.

Licensed under [Apache-2.0](LICENSE).
