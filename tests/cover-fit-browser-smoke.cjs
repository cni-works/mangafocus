const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = execFileSync(process.env.MANGAFOCUS_PHP || 'php', [path.join(__dirname, 'reading-modes-smoke.php'), '--fixture-modes'], { encoding: 'utf8', env: process.env });
const css = process.env.MANGAFOCUS_COVER_CSS || path.join(root, 'blocks/viewer/style.css');
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 let cases = 0;
 try {
  for (const viewport of [{ width: 1200, height: 900 }, { width: 390, height: 844 }]) {
   const page = await browser.newPage({ viewport });
   await page.route('https://example.test/**', route => {
    const match = route.request().url().match(/cover-fit-(\d+)-(\d+)\.svg/);
    const width = match ? Number(match[1]) : 600;
    const height = match ? Number(match[2]) : 900;
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#c96"/></svg>` });
   });
   await page.setContent(html);
   await page.evaluate(() => document.body.classList.add('entry-content'));
   await page.addStyleTag({ content: 'body{margin:8px}.entry-content img{width:100%;max-width:100%;height:auto}' });
   await page.addStyleTag({ path: css });
   for (const mode of ['010', '001', '011']) {
    const cover = page.locator(`#mode-${mode} .amv-reader__cover-image`);
    assert.equal(await cover.count(), 1, `Cover exists in mode ${mode}`);
    for (const [width, height] of [[600, 900], [900, 1200], [900, 900], [1200, 800], [1800, 360], [120, 180]]) {
     await cover.evaluate(async (image, size) => { image.src = `https://example.test/cover-fit-${size[0]}-${size[1]}.svg`; await image.decode(); }, [width, height]);
     const box = await cover.evaluate(image => {
      const rect = image.getBoundingClientRect(), style = getComputedStyle(image);
      const launcher = image.closest('.amv-reader__cover-launcher').getBoundingClientRect();
      const button = image.parentElement.querySelector('.amv-reader__cover-actions').getBoundingClientRect();
      return { width: rect.width, height: rect.height, naturalRatio: image.naturalWidth / image.naturalHeight, borderX: parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth), borderY: parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth), center: rect.x + rect.width / 2, launcherCenter: launcher.x + launcher.width / 2, launcherWidth: launcher.width, bottom: rect.bottom, buttonTop: button.top, maxHeight: Math.min(innerHeight * .72, 880) };
     });
     const label = `${viewport.width}px mode ${mode} ${width}x${height}`;
     assert.ok(Math.abs((box.width - box.borderX) / (box.height - box.borderY) - box.naturalRatio) < .02, `Frame follows image ratio without side bars: ${label}`);
     assert.ok(box.width <= box.launcherWidth + 1, `No horizontal overflow: ${label}`);
     assert.ok(box.height <= box.maxHeight + 1, `Height cap maintained: ${label}`);
     assert.ok(Math.abs(box.center - box.launcherCenter) < 1, `Cover centered: ${label}`);
     assert.ok(box.buttonTop >= box.bottom, `Buttons remain below cover: ${label}`);
     cases++;
    }
   }
   await page.close();
  }
  console.log(`PASS: ${cases} cover frame cases; portrait/square/landscape/small images, desktop/mobile, fullscreen-only/panel-only/both, aspect ratio, bounds, centering and button separation`);
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });