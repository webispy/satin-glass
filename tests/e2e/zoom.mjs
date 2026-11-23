// Zoomed screenshot of one element. usage: node tests/e2e/zoom.mjs <url-hash> <selector> <out.png> [dark]
import * as pw from './pw.mjs';
const [hash, sel, out, dark] = process.argv.slice(2);
const b = await pw[process.env.BROWSER || 'chromium'].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 3, colorScheme: dark ? 'dark' : 'light' });
await p.goto(`${process.env.URL || 'http://localhost:5173'}/#/${hash}`); await p.waitForTimeout(800);
const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await el.screenshot({ path: out }); await b.close();
