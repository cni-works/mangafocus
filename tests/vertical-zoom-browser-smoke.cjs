const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const runtime = process.env.MANGAFOCUS_VIEW_RUNTIME || path.join(root, 'blocks/viewer/view.js');
const fixture = process.env.MANGAFOCUS_VERTICAL_FIXTURE || path.join(__dirname, 'vertical-zoom-smoke.php');
// Eager fixture images keep lazy-loading shifts out of page-position assertions.
const html = execFileSync(process.env.MANGAFOCUS_PHP || 'php', [fixture, '--pro-cta-fixture'], {encoding: 'utf8', env: process.env}).replaceAll('loading="lazy"', 'loading="eager"');
(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 const results = [];
 try {
  for (const width of [390, 1200]) for (const observerMode of ['unavailable', 'native']) {
   const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route('**/*', route => route.request().url().startsWith('https://example.test/') ? route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"/>'}) : route.abort());
   await page.setContent(html);
   await page.evaluate(observerMode => {
    // Isolate intermediate-page state from content-visibility placeholder sizing.
    // A second pass keeps the native observer and starts at the first page.
    if (observerMode === 'unavailable') window.IntersectionObserver = undefined;
    window.wp = {i18n: {__: text => text}};
    window.verticalEvents = [];
    ['amv:viewer-viewchange', 'amv:viewer-modechange', 'amv:viewer-fullscreenchange', 'amv:viewer-interaction'].forEach(name => document.addEventListener(name, event => window.verticalEvents.push({name, detail: event.detail})));
    const selectors = {level: '.amv-reader__zoom-level', out: '.amv-reader__zoom-out', in: '.amv-reader__zoom-in', reset: '.amv-reader__zoom-reset', controls: '.amv-reader__zoom-controls', all: '.amv-reader__zoom-controls, .amv-reader__zoom-page'};
    document.querySelectorAll('section[data-remove]').forEach(section => {
     const selector = selectors[section.dataset.remove]; if (selector) section.querySelectorAll(selector).forEach(el => el.remove());
    });
    let active = null;
    Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => active});
    document.exitFullscreen = () => {active = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();};
    HTMLElement.prototype.requestFullscreen = function() {active = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();};
   }, observerMode);
   // Only emulate UA fullscreen placement. Plugin CSS/JS are loaded unchanged.
   await page.addStyleTag({content: '.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}'});
   for (const css of ['blocks/viewer/style.css', 'assets/panel-reader/style.css']) await page.addStyleTag({path: path.join(root, css)});
   for (const js of ['blocks/viewer/layout.js', runtime, 'assets/panel-reader/frontend.js']) await page.addScriptTag({path: path.isAbsolute(js) ? js : path.join(root, js)});

   const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   const snapshot = () => page.evaluate(() => Array.from(document.querySelectorAll('section')).map(section => {
    const el = section.querySelector('.amv-reader'), api = window.aiMangaViewer.getInstance(el);
    return {id: section.id, state: api.getState(), classes: el.className, verticalWidth: el.style.getPropertyValue('--amv-reader-vertical-width'), transform: el.querySelector('.amv-reader__surface').style.transform, zoom: el.querySelector('.amv-reader__zoom-level')?.textContent || null};
   }));
   const ids = await page.locator('section').evaluateAll(items => items.map(el => el.id));
   for (const id of ids.filter(value => (!process.env.MANGAFOCUS_VERTICAL_CASE_FILTER || value.includes(process.env.MANGAFOCUS_VERTICAL_CASE_FILTER)) && (observerMode !== 'native' || value.startsWith('modern-vertical-')))) {
    const scope = page.locator('#' + id), viewer = scope.locator('.amv-reader'), stage = scope.locator('.amv-reader__stage');
    const vertical = id.includes('-vertical-'), zoom = !id.includes('-off-');
    const beforeOthers = (await snapshot()).filter(row => row.id !== id);
    const identity = await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getIdentity());
    if (!zoom) assert.equal(await scope.locator('.amv-reader__zoom-controls, .amv-reader__zoom-level').count(), 0, id + ' zoom OFF has no UI');
    if (id.endsWith('-level') || id.endsWith('-controls') || id.endsWith('-all')) assert.equal(await scope.locator('.amv-reader__zoom-level').count(), 0, id + ' optional output removed before initialization');
    await viewer.evaluate((el, start) => window.aiMangaViewer.getInstance(el).goToPage(start), observerMode === 'native' ? 0 : 1);
    const launcher = scope.locator('.amv-reader__cover-launcher-button');
    const fromCover = await launcher.count() > 0;
    const opener = fromCover ? launcher : scope.locator('.amv-reader__fullscreen');
    const expectedPage = fromCover || observerMode === 'native' ? 0 : 1;
    for (let cycle = 0; cycle < 2; cycle++) {
     const eventStart = await page.evaluate(() => window.verticalEvents.length);
     await opener.click(); await settle();
     assert.deepEqual(errors, [], id + ' must not raise JS errors');
     const state = await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getState());
     assert.equal(state.readingMode, vertical ? 'vertical' : 'fullscreen', id + ' mode after entry');
     assert.equal(state.fullscreen, true);
     assert.equal(state.currentPage.index, expectedPage, id + ' entry page');
     assert.deepEqual(state.identity, identity);
     assert.equal(await viewer.evaluate(el => el.classList.contains('is-vertical-reading')), vertical);
     assert.equal(await stage.evaluate(el => el.inert), false);
     const base = vertical ? await viewer.evaluate(el => parseFloat(el.style.getPropertyValue('--amv-reader-vertical-width'))) : 0;
     await stage.dispatchEvent('keydown', {key: '+'}); await settle();
     if (vertical) {
      const after = await viewer.evaluate(el => parseFloat(el.style.getPropertyValue('--amv-reader-vertical-width')));
      assert.ok(Math.abs(after - base * (zoom ? 1.25 : 1)) < .1, id + ' zoom enabled independent of output DOM');
     } else {
      const transform = await scope.locator('.amv-reader__surface').evaluate(el => el.style.transform);
      assert.equal(transform.includes('scale(1.25)'), zoom, id + ' keyboard zoom policy');
     }
     const level = scope.locator('.amv-reader__zoom-level');
     if (await level.count()) assert.equal(await level.textContent(), '125%');
     await stage.dispatchEvent('keydown', {key: '0'}); await settle();
     if (vertical) assert.ok(Math.abs(await viewer.evaluate(el => parseFloat(el.style.getPropertyValue('--amv-reader-vertical-width'))) - base) < .1, id + ' reset width');
     if (await level.count()) assert.equal(await level.textContent(), '100%');
     const current = await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getCurrentPage());
     assert.equal(current.index, expectedPage, id + ' zoom must not navigate');
     await scope.locator('.amv-reader__fullscreen').click(); await settle();
     const ended = await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getState());
     assert.equal(ended.fullscreen, false); assert.equal(ended.readingMode, 'standard');
     assert.equal(ended.currentPage.index, expectedPage, id + ' non-final exit retains page');
     assert.equal(await viewer.evaluate(el => el.classList.contains('is-vertical-reading') || el.classList.contains('is-vertical-zoomed') || el.classList.contains('is-zoomed')), false);
     assert.equal(await viewer.evaluate(el => el.style.getPropertyValue('--amv-reader-vertical-width')), '');
     const events = await page.evaluate(start => window.verticalEvents.slice(start), eventStart);
     const own = events.filter(event => event.detail.identity.instanceKey === identity.instanceKey);
     assert.deepEqual(own.filter(event => event.name === 'amv:viewer-fullscreenchange').map(event => [event.detail.fullscreen, event.detail.readingMode]), [[true, vertical ? 'vertical' : 'fullscreen'], [false, 'standard']], id + ' public fullscreen events');
     assert.ok(own.some(event => event.name === 'amv:viewer-interaction' && event.detail.action === 'read' && event.detail.readingMode === (vertical ? 'vertical' : 'fullscreen')), id + ' read event');
     assert.ok(own.every(event => event.detail.apiVersion === 1), id + ' Extension API version');
     assert.deepEqual((await snapshot()).filter(row => row.id !== id), beforeOthers, id + ' other instances stay unchanged');
    }
    if (id.endsWith('-011') || id.endsWith('-111')) {
     const opener = scope.locator(fromCover ? '.amv-reader__cover-focus-open' : '.amv-reader__focus-open');
     await opener.click(); await settle();
     assert.equal(await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getState().readingMode), 'panel');
     await page.locator('.amv-modal:not([hidden]) .amv-modal__close').click(); await settle();
     assert.equal(await viewer.evaluate(el => window.aiMangaViewer.getInstance(el).getState().readingMode), 'standard');
    }
    assert.deepEqual(errors, [], id + ' no errors after exit/re-entry');
    results.push({width, observerMode, id, cycles: 2, passed: true});
   }
   console.log('PASS: vertical/paged, zoom ON/OFF, modern/legacy, optional UI, re-entry, instance isolation at width ' + width + ' / observer ' + observerMode);
   await page.close();
  }
  if (process.env.MANGAFOCUS_VERTICAL_RESULTS) fs.writeFileSync(process.env.MANGAFOCUS_VERTICAL_RESULTS, JSON.stringify({environment: 'headless Edge; fullscreen API/placement and WP doubles; synthetic keys; native observer first-page pass and observer-unavailable intermediate-page pass; not WordPress/physical device', cases: results, passed: true}, null, 2));
  console.log('PASS: ' + results.length + ' cases, ' + results.length * 2 + ' enter/exit cycles; unchanged API identities and page data');
 } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode = 1;});