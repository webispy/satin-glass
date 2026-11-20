# @satin-glass/core

The framework-free part of [Satin Glass](https://github.com/webispy/satin-glass): springs and motion settings, the pointer sheen, the stretch-and-stick selection bridge, overflow fades, overlay placement with focus and layer stacks, and drag and long-press gestures, plus the component CSS.

Most apps install [`@satin-glass/react`](https://www.npmjs.com/package/@satin-glass/react), which depends on this package. Use it directly to build on the same behaviour and styles without React.

```bash
npm i @satin-glass/core
```

```js
import '@satin-glass/core/styles.css';        // every component style
// or per category: '@satin-glass/core/css/foundation.css' first, then e.g. 'css/controls.css'
// or '@satin-glass/core/styles.layer.css' to keep everything in @layer satin-glass
```

Licensed under [Apache-2.0](LICENSE).
