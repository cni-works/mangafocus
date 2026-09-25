const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const oldRoot = path.resolve(root, '../cni_blocks/blocks/page-flip');
const current = path.join(root, 'blocks/viewer');
const html = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--fixture'], { encoding: 'utf8' });
const metadata = JSON.parse(fs.readFileSync(path.join(current, 'block.json')));
assert.deepEqual(metadata.attributes, JSON.parse(fs.readFileSync(path.join(oldRoot, 'block.json'))).attributes);
const registered = {};
const wp = { blocks: { registerBlockType: (name, settings) => registered[name] = settings }, element: {}, blockEditor: {}, components: {}, i18n: { __: text => text } };
for (const dir of [oldRoot, current]) vm.runInNewContext(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), { window: { wp } });
assert.deepEqual(JSON.parse(JSON.stringify(registered['ai-manga-viewer/viewer'].attributes)), metadata.attributes);
assert.equal(Object.keys(registered).length, 2);
assert.equal(registered['ai-manga-viewer/viewer'].save(), null);
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1200, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#ddd"/></svg>' }));
      await page.setContent(html);
      for (const dir of [oldRoot, current]) {
        await page.addStyleTag({ path: path.join(dir, 'style.css') });
        await page.addScriptTag({ path: path.join(dir, 'view.js') });
      }
      const amv = page.locator('.wp-block-ai-manga-viewer-viewer');
      const old = page.locator('.wp-block-cni-blocks-page-flip');
      await amv.locator('.amv-reader__edge--next').click();
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      assert.equal(await old.locator('.cni-page-flip__count').textContent(), '1 / 2');
      await amv.locator('.amv-reader__stage').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
      await amv.locator('.amv-reader__focus-open').click();
      const modal = page.locator('.amv-modal:not([hidden])');
      await page.waitForFunction(() => document.querySelector('.amv-modal__count').textContent.includes('/'));
      assert.equal(await modal.locator('.amv-modal__count').textContent(), width < 782 ? '1 / 2' : '1 / 3');
      assert.equal(await page.locator('.cni-manga-viewer').getAttribute('hidden'), '');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'amv-modal__previous');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'amv-modal__close');
      await modal.locator('.amv-modal__next').click();
      await page.waitForFunction(() => document.querySelector('.amv-modal__count').textContent.startsWith('2 /'));
      assert.equal(await modal.locator('.amv-modal__count').textContent(), width < 782 ? '2 / 2' : '2 / 3');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'amv-reader__focus-open');
      assert.equal(await page.evaluate(() => document.body.classList.contains('amv-modal-open')), false);
      await old.locator('.cni-page-flip__focus-open').click();
      assert.equal(await page.locator('.cni-manga-viewer').getAttribute('hidden'), null);
      assert.equal(await page.locator('.amv-modal').getAttribute('hidden'), '');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      await page.close();
    }
    const solo = await browser.newPage();
    await solo.setContent(html);
    await solo.locator('.wp-block-cni-blocks-page-flip').evaluate(node => node.remove());
    await solo.addStyleTag({ path: path.join(current, 'style.css') });
    await solo.addScriptTag({ path: path.join(current, 'view.js') });
    await solo.locator('.amv-reader__stage').evaluate(stage => {
      for (const [type, clientX] of [['touchstart', 200], ['touchend', 100]]) {
        stage.dispatchEvent(new TouchEvent(type, { changedTouches: [new Touch({ identifier: 1, target: stage, clientX })] }));
      }
    });
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    await solo.close();
    console.log('PASS: editor registration/schema, desktop/mobile coexistence, navigation, modal sequences, focus trap/return; no page errors');
    console.log('PASS: standalone frontend initialization and swipe');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
