const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const html = execFileSync(process.env.MANGAFOCUS_PHP || 'php', [path.join(__dirname, 'reading-modes-smoke.php'), '--fixture-modes'], {encoding: 'utf8', env: process.env});
(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 try {
  for (const width of [1200, 390]) {
   const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route('https://example.test/**', route => route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#ddd"/></svg>'}));
   await page.setContent(html);
   await page.evaluate(() => {
    window.wp = {i18n: {__: text => text}}; window.testEvents = [];
    ['amv:viewer-ready','amv:viewer-viewchange','amv:viewer-interaction','amv:viewer-modechange','amv:viewer-fullscreenchange'].forEach(name => document.addEventListener(name, e => window.testEvents.push({name, detail: e.detail})));
    let element = null;
    Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => element});
    document.exitFullscreen = () => {element = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();};
    HTMLElement.prototype.requestFullscreen = function() {element = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();};
   });
   for (const css of ['blocks/viewer/style.css','assets/panel-reader/style.css']) await page.addStyleTag({path: path.join(root, css)});
   // A fullscreen API double must also supply the native fullscreen viewport geometry.
   await page.addStyleTag({content:'.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}'});
   for (const js of ['blocks/viewer/layout.js','blocks/viewer/view.js','assets/panel-reader/frontend.js']) await page.addScriptTag({path: path.join(root, js)});
   for (const code of ['001','010','011','100','101','110','111']) {
    const scope = page.locator('#mode-'+code); const viewer = scope.locator('.amv-reader');
    const inline = code[0] === '1', full = code[1] === '1', panel = code[2] === '1';
    assert.equal(await scope.locator('.amv-reader__stage').isVisible(), inline, code+' inline');
    assert.equal(await scope.locator('.amv-reader__cover-launcher').count(), inline ? 0 : 1);
    assert.equal(await scope.locator('.amv-reader__cover-launcher-button').count(), !inline && full ? 1 : 0);
    if (!inline) {
     assert.equal(await scope.locator('.amv-reader__stage').evaluate(el => el.inert), true);
     assert.equal(await scope.locator('.amv-reader').evaluate(el => window.aiMangaViewer.getInstance(el).getVisiblePages().length), 0);
    }
    if (!inline) {
     const before = await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getCurrentPage().index);
     await scope.locator('.amv-reader__stage').evaluate(el => {el.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true})); el.focus();});
     assert.equal(await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getCurrentPage().index), before);
     assert.equal(await scope.locator('.amv-reader__stage').evaluate(el => document.activeElement === el), false);
     assert.equal(await scope.locator('.amv-reader__page').evaluateAll(items => items.every(el => el.inert && el.getAttribute('aria-hidden') === 'true')), true);
    }
    if (panel) {
     const opener = scope.locator(inline ? '.amv-reader__focus-open' : '.amv-reader__cover-focus-open');
     await opener.click();
     const modal = page.locator('.amv-modal:not([hidden])');
     assert.equal(await modal.isVisible(), true);
     await modal.locator('.amv-modal__next').click();
     await page.waitForFunction(() => document.querySelector('.amv-modal:not([hidden]) .amv-modal__count')?.textContent === '2 / 2');
     assert.equal(await modal.locator('.amv-modal__count').textContent(), '2 / 2', 'Unconfigured page stays in reading order');
     await modal.locator('.amv-modal__close').click();
     assert.equal(await scope.locator('.amv-reader__stage').isVisible(), inline);
     assert.equal(await opener.evaluate(el => document.activeElement === el), true);
    }
    if (full) {
     const fullOpener = scope.locator(inline ? '.amv-reader__fullscreen' : '.amv-reader__cover-launcher-button');
     await fullOpener.click();
     assert.equal(await scope.locator('.amv-reader__stage').isVisible(), true);
     assert.equal(await scope.locator('.amv-reader').evaluate(el => window.aiMangaViewer.getInstance(el).isFullscreen()), true);
     await scope.locator('.amv-reader__zoom-in').click();
     assert.equal(await scope.locator('.amv-reader__zoom-level').textContent(), '125%');
     await scope.locator('.amv-reader__zoom-reset').click();
     assert.equal(await scope.locator('.amv-reader__zoom-level').textContent(), '100%');
     await scope.locator('.amv-reader__fullscreen').click();
     assert.equal(await scope.locator('.amv-reader__stage').isVisible(), inline);
     await page.waitForFunction(el => document.activeElement === el, await fullOpener.elementHandle());
    }
   }
   for (const layout of ['single','spread','auto']) for (const binding of ['rtl','ltr']) for (const mode of ['paged','vertical']) {
    const scope = page.locator('#layout-'+layout+'-'+binding+'-'+mode);
    await scope.locator('.amv-reader__cover-launcher-button').click();
    assert.equal(await scope.locator('.amv-reader__stage').isVisible(), true);
    if (mode === 'vertical') assert.equal(await scope.locator('.amv-reader').evaluate(el => el.classList.contains('is-vertical-reading')), true);
    await scope.locator('.amv-reader__fullscreen').click();
    assert.equal(await scope.locator('.amv-reader__stage').isVisible(), false);
   }
   await page.locator('#mobile-panels .amv-reader__cover-focus-open').click();
   await page.waitForFunction(() => document.querySelector('.amv-modal:not([hidden]) .amv-modal__count')?.textContent === '1 / 2');
   assert.equal(await page.locator('.amv-modal:not([hidden]) .amv-modal__overview').textContent(), width < 782 ? 'Full page' : 'Return to panel');
   await page.locator('.amv-modal:not([hidden]) .amv-modal__close').click();
   if (process.env.MANGAFOCUS_PRO_ANALYTICS) {
    await page.evaluate(() => {
     window.aiMangaViewerCapabilities = {analytics: {collection: true}};
     window.aiMangaViewerProAnalytics = {enabled: true, restUrl: 'https://example.test/events'};
     window.analyticsNames = [];
     window.fetch = async (_url, options) => {if (options?.body) {const data = JSON.parse(options.body); window.analyticsNames.push({name: data.name, mode: data.mode, pageNumber: data.pageNumber});} return {ok: true};};
    });
    await page.addScriptTag({path: process.env.MANGAFOCUS_PRO_ANALYTICS});
    await page.locator('#analytics-library .amv-reader__cover-focus-open').click();
    await page.waitForFunction(() => window.analyticsNames.some(e => e.name === 'read_start'));
    await page.locator('.amv-modal:not([hidden]) .amv-modal__next').click();
    await page.waitForFunction(() => window.analyticsNames.some(e => e.name === 'page_reach' && e.pageNumber === 2));
    const names = await page.evaluate(() => window.analyticsNames.map(e => e.name));
    for (const name of ['viewer_impression','read_start','page_reach','mode_use']) assert.ok(names.includes(name), 'Pro analytics contract '+name);
    await page.locator('.amv-modal:not([hidden]) .amv-modal__close').click();
   }
   assert.equal(await page.locator('#missing-panels .amv-reader__stage').isVisible(), true);
   const events = await page.evaluate(() => window.testEvents);
   for (const name of ['amv:viewer-ready','amv:viewer-viewchange','amv:viewer-modechange','amv:viewer-interaction','amv:viewer-fullscreenchange']) assert.ok(events.some(e => e.name === name), name);
   for (const e of events) {assert.equal(e.detail.apiVersion, 1); assert.ok(e.detail.identity.viewerKey); assert.ok(e.detail.identity.instanceKey);}
   assert.deepEqual(errors, []);
   await page.close();
   console.log('PASS: seven browser modes and layout/binding/vertical matrix at width '+width);
  }
  for (const failure of ['missing-api','rejected-request','sync-throw']) {
   const page = await browser.newPage({viewport: {width: 1000, height: 900}});
   await page.route('https://example.test/**', route => route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"/>'}));
   await page.setContent(html);
   await page.evaluate(failure => {
    if (failure === 'missing-api') {HTMLElement.prototype.requestFullscreen = undefined; document.exitFullscreen = undefined;}
    if (failure === 'rejected-request') HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Test denial'));
    if (failure === 'sync-throw') HTMLElement.prototype.requestFullscreen = () => {throw new Error('Test denial');};
   }, failure);
   for (const css of ['blocks/viewer/style.css','assets/panel-reader/style.css']) await page.addStyleTag({path: path.join(root, css)});
   // A fullscreen API double must also supply the native fullscreen viewport geometry.
   await page.addStyleTag({content:'.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}'});
   for (const js of ['blocks/viewer/layout.js','blocks/viewer/view.js','assets/panel-reader/frontend.js']) await page.addScriptTag({path: path.join(root, js)});
   if (failure !== 'missing-api') await page.locator('#mode-010 .amv-reader__cover-launcher-button').click();
   await page.waitForTimeout(80);
   assert.equal(await page.locator('#mode-010 .amv-reader__stage').isVisible(), true, failure);
   assert.equal(await page.locator('#mode-010 .amv-reader__cover-launcher').isVisible(), false, failure+' obsolete launcher must be hidden');
   assert.equal(await page.locator('#mode-010 .amv-reader__cover-launcher-button').isVisible(), false, failure+' fullscreen trigger must be hidden');
   if (failure === 'missing-api') assert.equal(await page.locator('#mode-011 .amv-reader__cover-launcher-button').isVisible(), false, 'Panel launcher must not retain unsupported fullscreen trigger');
   assert.equal(await page.locator('#mode-001 .amv-reader__stage').isVisible(), false, 'Panel-only must not expose inline');
   await page.locator('#mode-001 .amv-reader__cover-focus-open').click();
   assert.equal(await page.locator('.amv-modal:not([hidden])').isVisible(), true);
   await page.close();
  }
  console.log('PASS: fullscreen-only fallback for unavailable, rejected and throwing APIs; panel-only remains independent');
 } finally {await browser.close();}
})().catch(e => {console.error(e); process.exitCode = 1;});
