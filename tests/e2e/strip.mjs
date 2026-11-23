// Join PNG frames into one horizontal strip. usage: node tests/e2e/strip.mjs <out.png> <frame1.png> <frame2.png> ...
import { chromium } from './pw.mjs';
import { readFileSync } from 'node:fs';
const [out, ...frames] = process.argv.slice(2);
const imgs = frames.map((f, i) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${i}</figcaption></figure>`).join('');
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
await p.setContent(`<style>body{margin:0;display:flex;gap:8px;padding:8px;background:#ddd;font:12px sans-serif;width:max-content}figure{margin:0}img{display:block;height:180px}</style>${imgs}`);
await p.screenshot({ path: out, fullPage: true }); await b.close();
