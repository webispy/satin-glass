// Screenshots of every docs page in a theme. usage: node tests/e2e/shots.mjs <outDir> [theme] [width]
import * as pw from './pw.mjs';
const chromium = pw[process.env.BROWSER || 'chromium'];
const [out, theme = 'light', width = '1280'] = process.argv.slice(2);
const pages = ['overview', 'material', 'colors', 'type', 'motion', 'buttons', 'inputs', 'navigation', 'lists', 'overlays', 'showcase'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 1, colorScheme: theme.startsWith('dark') ? 'dark' : 'light' });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
for (const id of pages) {
  await p.goto(`${pw.ORIGIN}/#/${id}`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${theme}-${width}-${id}.png` });
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
