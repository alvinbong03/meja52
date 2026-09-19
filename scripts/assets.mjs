// Renders PNG icons and the OpenGraph card. Run: node scripts/assets.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'public');
const mark = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');

const browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
const page = await browser.newPage();

async function render(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(pub, file), omitBackground: false });
  console.log('wrote', file);
}

const icon = (size, pad) =>
  `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#203554">
     <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
   </div>`;

await render(icon(32, 0), 32, 32, 'favicon-32.png');
await render(icon(180, 14), 180, 180, 'apple-touch-icon.png');
await render(icon(192, 16), 192, 192, 'icon-192.png');
await render(icon(512, 40), 512, 512, 'icon-512.png');
await render(icon(512, 110), 512, 512, 'icon-maskable-512.png');

await render(
  `<div style="position:relative;width:1200px;height:630px;background:#203554;color:#f3eee4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden">
    <div style="position:absolute;left:82px;top:76px;font-size:45px;font-weight:750;letter-spacing:4px">MEJA<sup style="font-size:20px;font-weight:500;letter-spacing:0">52</sup></div>
    <div style="position:absolute;left:82px;top:208px">
      <div style="font-size:92px;font-weight:650;line-height:.93;letter-spacing:-4px">Poker chips.<br/>Any table. Any time.</div>
      <div style="margin-top:30px;font-size:25px;line-height:1.5;color:#c7c8c2">Digital chips for real cards<br/>and everyone around the table.</div>
    </div>
    <div style="position:absolute;right:-90px;bottom:-240px;width:660px;height:660px;border:72px solid rgba(246,244,239,.045);border-radius:50%"></div>
    <div style="position:absolute;right:108px;top:110px;width:132px;height:132px;border-radius:30px;background:#2c4564;box-shadow:0 26px 70px rgba(0,0,0,.24);display:grid;place-items:center;font-size:64px;font-weight:500">52<div style="position:absolute;bottom:22px;width:38px;height:5px;border-radius:3px;background:#b33a46"></div></div>
  </div>`,
  1200,
  630,
  'og.png',
);

await browser.close();
