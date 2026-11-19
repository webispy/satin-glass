// the React package ships the same stylesheets as core, so an app installs and imports one package
import { cpSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
const require = createRequire(import.meta.url);
const from = dirname(require.resolve('@satin-glass/core/styles.css'));
for (const f of ['styles.css', 'styles.layer.css', 'css']) cpSync(`${from}/${f}`, new URL(`../dist/${f}`, import.meta.url), { recursive: true });
