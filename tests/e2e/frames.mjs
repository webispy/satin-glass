// Frame strip of an interaction. usage: node tests/e2e/frames.mjs <hash> <clickSelector> <clipSelector> <outPrefix> [n] [every]
import * as pw from './pw.mjs';
const [hash, clickSel, clipSel, out, n = '6', every = '45'] = process.argv.slice(2);
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });
await p.goto(`${pw.ORIGIN}/#/${hash}`); await p.waitForTimeout(900);
const clip = await p.locator(clipSel).first().boundingBox();
const pad = 6, c = { x: clip.x - pad, y: clip.y - pad, width: clip.width + pad * 2, height: clip.height + pad * 2 };
await p.locator(clickSel).first().click({ noWaitAfter: true });
for (let i = 0; i < +n; i++) { await p.screenshot({ path: `${out}-${i}.png`, clip: c }); await p.waitForTimeout(+every); }
await b.close();
