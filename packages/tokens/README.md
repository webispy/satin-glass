# @satin-glass/tokens

Design tokens for [Satin Glass](https://github.com/webispy/satin-glass): an OKLCH palette, four themes (light, dark and two high-contrast), spacing, radius, type, depth and motion springs. The build checks WCAG contrast for the themes.

```bash
npm i @satin-glass/tokens
```

As CSS variables (`--sg-*`):

```css
@import '@satin-glass/tokens/tokens.css';
```

As TypeScript values:

```ts
import { palette, themes, space, radius, typography, motions } from '@satin-glass/tokens';
```

Licensed under [Apache-2.0](LICENSE).
