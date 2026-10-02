const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const proRoot = path.resolve(root, '..', 'AI Manga Viewer Pro');
const oldRoot = path.resolve(root, '../cni_blocks/blocks/page-flip');
const current = path.join(root, 'blocks/viewer');
const libraryCurrent = path.join(root, 'blocks/library-viewer');
const librarySource = fs.readFileSync(path.join(libraryCurrent, 'index.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(current, 'index.js'), 'utf8');
const ctaEditorSource = fs.readFileSync(path.join(proRoot, 'assets', 'cta', 'editor.js'), 'utf8');
const panelEditorSource = fs.readFileSync(path.join(proRoot, 'assets', 'panel-reader', 'editor.js'), 'utf8');
const layoutWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(current, 'layout.js'), 'utf8'), { window: layoutWindow });
const viewerLayout = layoutWindow.aiMangaViewerLayout;
const portrait = { width: 600, height: 900 };
const landscape = { width: 1200, height: 600 };
assert.equal(viewerLayout.landscapeRatio, 1.18);
assert.deepEqual(JSON.parse(JSON.stringify(viewerLayout.analyzePages([landscape, landscape, landscape, landscape], true))), { status: 'unavailable', pairCount: 0, hasUnknown: false });
assert.equal(viewerLayout.analyzePages([portrait, landscape, landscape], true).status, 'unavailable');
assert.equal(viewerLayout.analyzePages([portrait], false).status, 'unavailable');
assert.equal(viewerLayout.analyzePages([portrait, portrait], false).pairCount, 1);
assert.equal(viewerLayout.analyzePages([portrait, portrait, portrait], true).pairCount, 1);
assert.equal(viewerLayout.analyzePages([landscape, portrait, portrait, landscape], true).pairCount, 1);
assert.equal(viewerLayout.analyzePages([landscape, landscape, portrait, portrait, landscape, landscape, landscape, landscape, landscape, landscape], false).pairCount, 1);
assert.equal(viewerLayout.analyzePages([{}, {}], false).status, 'pending');
assert.equal(viewerLayout.analyzePages([portrait, portrait], true).status, 'unavailable');
assert.equal(viewerLayout.analyzePages([portrait, landscape, portrait], false).status, 'unavailable');
assert.equal(viewerLayout.analyzePages([portrait, portrait, landscape], false).pairCount, 1);
assert.match(librarySource, /item\.amv_cover_url/);
assert.match(librarySource, /_fields=[^']*amv_cover_url/);
assert.doesNotMatch(librarySource, /function dateOf|%2Cmodified/);
assert.match(librarySource, /scrollIntoView\( \{ behavior: 'auto', block: 'start' \} \)/);
assert.match(librarySource, /focus\( \{ preventScroll: true \} \)/);
assert.match(viewerSource, /漫画解析・AI相談を利用するには、漫画ライブラリへの登録後、登録済みViewerとして表示してください。/);
assert.match(viewerSource, /\/ai-manga-viewer\/v1\/library/);
assert.match(viewerSource, /replaceBlock/);
assert.match(viewerSource, /getCurrentPostType/);
assert.doesNotMatch(viewerSource, /function ctaOf|CTA画像を選択/);
assert.doesNotMatch(viewerSource, /コマ読みを有効化|スマホ用にコマを追加|amv-reader__focus-area/);
assert.match(ctaEditorSource, /freePosition: Object\.prototype\.hasOwnProperty\.call\( source, 'freePosition' \) \? !! source\.freePosition : ! saved/);
assert.match(panelEditorSource, /aiMangaViewer\.editor\.inspectorPanels/);
assert.match(panelEditorSource, /aiMangaViewer\.editor\.stageOverlays/);
assert.match(panelEditorSource, /mobileFocusAreas/);
assert.match(viewerSource, /見開き（利用できません）/);
assert.match(viewerSource, /現在のページ構成には、見開きとして組み合わせ可能なページがありません/);
assert.match(viewerSource, /画像情報を確認中です/);
const html = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--fixture', '--pro-cta-fixture', '--pro-panel-fixture'], { encoding: 'utf8' });
const sideHtml = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--side-fixture', '--pro-cta-fixture', '--pro-panel-fixture'], { encoding: 'utf8' });
const directHtml = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--direct-fixture', '--pro-cta-fixture', '--pro-panel-fixture'], { encoding: 'utf8' });
const analyticsFixture = path.join(proRoot, 'tests', 'analytics-module-smoke.php');
function runAnalyticsFixture(flag) {
	const tempFixture = path.join(os.tmpdir(), `amv-analytics-module-${process.pid}-${flag.replace(/[^a-z]/g, '')}.php`);
	const originalPrepare = "\t\t\t$query = preg_replace_callback( '/%[sd]/', function( $match ) use ( $arg ) { return '%d' === $match[0] ? (string) (int) $arg : \"'\" . str_replace( \"'\", \"''\", (string) $arg ) . \"'\"; }, $query, 1 );";
	const identifierAwarePrepare = "\t\t\t$query = preg_replace_callback( '/%[ids]/', function( $match ) use ( $arg ) { if ( '%i' === $match[0] ) { return '`' . str_replace( '`', '``', (string) $arg ) . '`'; } return '%d' === $match[0] ? (string) (int) $arg : \"'\" . str_replace( \"'\", \"''\", (string) $arg ) . \"'\"; }, $query, 1 );";
	let fixtureSource = fs.readFileSync(analyticsFixture, 'utf8');
	assert.match(fixtureSource, /preg_replace_callback\( '\/%\[sd\]\/'/);
	fixtureSource = fixtureSource.replace(originalPrepare, identifierAwarePrepare);
	fixtureSource = fixtureSource.replace("'INSERT IGNORE INTO wp_amv_reader_events'", "'INSERT IGNORE INTO `wp_amv_reader_events`'");
	for (const table of ['wp_amv_reader_events', 'wp_amv_page_reaches', 'wp_amv_reader_sessions']) {
		fixtureSource = fixtureSource.replaceAll(`DELETE FROM ${table} WHERE`, `DELETE FROM \`${table}\` WHERE`);
		fixtureSource = fixtureSource.replaceAll(`DELETE FROM ${table}'`, `DELETE FROM \`${table}\`'`);
	}
	fixtureSource = fixtureSource.replace("'DROP TABLE IF EXISTS wp_amv_'", "'DROP TABLE IF EXISTS `wp_amv_'");
	fixtureSource = fixtureSource.replace("$core_root = dirname( __DIR__, 2 ) . '/AI Manga Viewer';", `$core_root = '${root.replace(/\\/g, '/')}';`);
	fixtureSource = fixtureSource.replaceAll('dirname( __DIR__ )', `'${proRoot.replace(/\\/g, '/')}'`);
	fs.writeFileSync(tempFixture, fixtureSource, 'utf8');
	try {
		return execFileSync('php', [tempFixture, flag], { encoding: 'utf8' });
	} finally {
		fs.rmSync(tempFixture, { force: true });
	}
}
const analyticsHtml = runAnalyticsFixture('--fixture');
const analyticsAllHtml = runAnalyticsFixture('--all-fixture');
const analyticsLibraryHtml = runAnalyticsFixture('--library-fixture');
const analyticsCompleteHtml = runAnalyticsFixture('--complete-fixture');
const analyticsEnabledHtml = runAnalyticsFixture('--enabled-fixture');
const metadata = JSON.parse(fs.readFileSync(path.join(current, 'block.json')));
const legacyAttributes = JSON.parse(fs.readFileSync(path.join(oldRoot, 'block.json'))).attributes;
for (const [name, definition] of Object.entries(legacyAttributes)) assert.deepEqual(metadata.attributes[name], definition);
assert.deepEqual(metadata.attributes.focusReaderStartAtCurrent, { type: 'boolean', default: false });
assert.deepEqual(metadata.attributes.enableFullscreen, { type: 'boolean', default: false });
assert.deepEqual(metadata.attributes.fullscreenStartAtCurrent, { type: 'boolean', default: false });
assert.deepEqual(metadata.attributes.inlineDisplayMode, { type: 'string', default: 'reader' });
assert.deepEqual(metadata.attributes.fullscreenReadingMode, { type: 'string', default: 'paged' });
assert.deepEqual(metadata.attributes.enableZoom, { type: 'boolean', default: false });
assert.deepEqual(metadata.attributes.zoomControlsPosition, { type: 'string', default: 'bottom' });
assert.deepEqual(metadata.attributes.viewerKey, { type: 'string', default: '' });
assert.deepEqual(metadata.attributes.instanceKey, { type: 'string', default: '' });
assert.deepEqual(metadata.attributes.libraryViewerId, { type: 'integer', default: 0 });
assert.deepEqual(metadata.attributes.pageLayout, { type: 'string', default: 'single' });
assert.deepEqual(metadata.attributes.singleFirstPage, { type: 'boolean', default: true });
assert.deepEqual(metadata.attributes.spreadReadingMode, { type: 'string', default: 'overview' });
assert.equal(Object.keys(metadata.attributes).length, Object.keys(legacyAttributes).length + 13);
const registered = {};
const wp = { blocks: { registerBlockType: (name, settings) => registered[name] = settings }, element: {}, blockEditor: {}, components: {}, data: {}, i18n: { __: text => text }, apiFetch: () => Promise.resolve([]) };
for (const dir of [oldRoot, current]) vm.runInNewContext(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), { window: { wp, aiMangaViewerLayout: viewerLayout } });
vm.runInNewContext(fs.readFileSync(path.join(libraryCurrent, 'index.js'), 'utf8'), { window: { wp } });
assert.deepEqual(JSON.parse(JSON.stringify(registered['ai-manga-viewer/viewer'].attributes)), metadata.attributes);
const libraryMetadata = JSON.parse(fs.readFileSync(path.join(libraryCurrent, 'block.json')));
assert.deepEqual(JSON.parse(JSON.stringify(registered['ai-manga-viewer/library-viewer'].attributes)), libraryMetadata.attributes);
assert.deepEqual(libraryMetadata.attributes.instanceKey, { type: 'string', default: '' });
assert.equal(Object.keys(registered).length, 3);
assert.equal(registered['ai-manga-viewer/viewer'].save(), null);
assert.equal(registered['ai-manga-viewer/library-viewer'].save(), null);
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1200, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
      const errors = [];
      const analyticsRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://example.test/**', route => {
        if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/events')) {
          analyticsRequests.push(JSON.parse(route.request().postData()));
          return route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
        }
        if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/config')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true}' });
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#ddd"/></svg>' });
      });
      await page.setContent(html);
      await page.evaluate(() => {
        window.aiMangaViewerCapabilities = { analytics: { collection: true } };
        window.aiMangaViewerProAnalytics = { enabled: null, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events', configUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/config' };
        let fullscreenElement = null;
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
        document.exitFullscreen = () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
        HTMLElement.prototype.requestFullscreen = function() { fullscreenElement = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
      });
      for (const dir of [oldRoot, current]) {
        await page.addStyleTag({ path: path.join(dir, 'style.css') });
        if (dir === current) {
          await page.addStyleTag({ path: path.join(proRoot, 'assets', 'cta', 'style.css') });
          await page.addStyleTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'style.css') });
          await page.addScriptTag({ path: path.join(current, 'layout.js') });
          await page.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
        }
        await page.addScriptTag({ path: path.join(dir, 'view.js') });
        if (dir === current) { await page.addScriptTag({ path: path.join(proRoot, 'assets', 'cta', 'frontend.js') }); await page.addScriptTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'frontend.js') }); }
      }
      await page.evaluate(() => {
        window.__amvReaderEvents = [];
        document.addEventListener('amv:reader-event', event => window.__amvReaderEvents.push(event.detail));
      });
      const amv = page.locator('.wp-block-ai-manga-viewer-viewer');
      const old = page.locator('.wp-block-cni-blocks-page-flip');
      assert.equal(await amv.getAttribute('data-analytics-source'), 'library');
      const counterBox = await amv.locator('.amv-reader__count').boundingBox();
      const readerButtonBox = await amv.locator('.amv-reader__focus-open').boundingBox();
      const fullscreenButton = amv.locator('.amv-reader__fullscreen');
      const fullscreenButtonBox = await fullscreenButton.boundingBox();
      const zoomControlsBox = await amv.locator('.amv-reader__zoom-controls').boundingBox();
      const cta = amv.locator('.amv-reader__page.is-active .amv-reader__cta');
      const ctaBox = await cta.boundingBox();
      const stageBeforeFullscreenBox = await amv.locator('.amv-reader__stage').boundingBox();
      assert.equal(await cta.textContent(), '詳しく "見る" &');
      assert.equal(await cta.evaluate(element => element.parentElement.classList.contains('amv-reader__canvas')), true);
      assert.ok(ctaBox.x >= stageBeforeFullscreenBox.x && ctaBox.x + ctaBox.width <= stageBeforeFullscreenBox.x + stageBeforeFullscreenBox.width, 'CTA must stay inside the reader stage');
      assert.ok(counterBox.y + counterBox.height <= readerButtonBox.y, 'Page counter must be above the dedicated reader button');
      assert.ok(Math.abs((counterBox.y + counterBox.height / 2) - (zoomControlsBox.y + zoomControlsBox.height / 2)) <= 2, 'Page counter and bottom zoom controls must share one row');
      assert.ok(Math.abs((readerButtonBox.y + readerButtonBox.height / 2) - (fullscreenButtonBox.y + fullscreenButtonBox.height / 2)) <= 2, 'Fullscreen and dedicated reader controls must share one row');
      assert.ok(counterBox.x + counterBox.width <= zoomControlsBox.x, 'Page counter and zoom controls must not overlap');
      assert.ok(readerButtonBox.x >= 0 && readerButtonBox.x + readerButtonBox.width <= width, 'Reader button must fit the viewport');
      assert.ok(fullscreenButtonBox.x >= 0 && fullscreenButtonBox.x + fullscreenButtonBox.width <= width, 'Fullscreen button must fit the viewport');
      assert.ok(zoomControlsBox.x >= 0 && zoomControlsBox.x + zoomControlsBox.width <= width, 'Zoom controls must fit the viewport');
      await cta.evaluate(element => {
        element.addEventListener('click', event => event.preventDefault(), { once: true });
        element.click();
      });
      assert.deepEqual(await page.evaluate(() => window.__amvReaderEvents.map(event => ({ name: event.name, mode: event.mode, readingStarted: event.readingStarted, ctaKey: event.ctaKey }))), [
        { name: 'viewer_impression', mode: 'standard', readingStarted: false, ctaKey: undefined },
        { name: 'cta_click', mode: 'standard_direct', readingStarted: false, ctaKey: 'cta-main' }
      ]);
      await fullscreenButton.click();
      await page.waitForFunction(() => document.querySelector('.wp-block-ai-manga-viewer-viewer').classList.contains('is-fullscreen'));
      assert.equal(await fullscreenButton.getAttribute('aria-pressed'), 'true');
      assert.equal(await fullscreenButton.textContent(), '全画面を終了');
      const nextCue = await amv.locator('.amv-reader__edge--next').evaluate(element => ({ display: getComputedStyle(element, '::after').display, content: getComputedStyle(element, '::after').content }));
      const previousCue = await amv.locator('.amv-reader__edge--previous').evaluate(element => ({ display: getComputedStyle(element, '::after').display }));
      assert.notEqual(nextCue.display, 'none');
      assert.notEqual(nextCue.content, 'none');
      assert.equal(previousCue.display, 'none');
      const fullscreenImageBox = await amv.locator('.amv-reader__page.is-active .amv-reader__image').boundingBox();
      assert.ok(fullscreenImageBox.height <= 722, 'Fullscreen image must leave room for controls');
      const zoomIn = amv.locator('.amv-reader__zoom-in');
      const zoomReset = amv.locator('.amv-reader__zoom-reset');
      const zoomLevel = amv.locator('.amv-reader__zoom-level');
      const zoomPagePrevious = amv.locator('.amv-reader__zoom-page--previous');
      const zoomPageNext = amv.locator('.amv-reader__zoom-page--next');
      assert.equal(await zoomPagePrevious.isVisible(), false);
      assert.equal(await zoomPageNext.isVisible(), false);
      await zoomIn.click();
      assert.equal(await zoomLevel.textContent(), '125%');
      assert.equal(await amv.evaluate(element => element.classList.contains('is-zoomed')), true);
      assert.equal(await amv.locator('.amv-reader__edge--next').isDisabled(), true);
      assert.equal(await cta.evaluate(element => getComputedStyle(element).opacity), '1');
      await cta.evaluate(element => {
        window.__amvCtaClicks = 0;
        element.addEventListener('click', event => {
          event.preventDefault();
          window.__amvCtaClicks += 1;
        }, { once: true });
      });
      await cta.click();
      assert.equal(await page.evaluate(() => window.__amvCtaClicks), 1, 'CTA must remain clickable while zoomed');
      assert.equal(await zoomPagePrevious.isDisabled(), true);
      assert.equal(await zoomPageNext.isDisabled(), false);
      const zoomPagePreviousBox = await zoomPagePrevious.boundingBox();
      const zoomPageNextBox = await zoomPageNext.boundingBox();
      assert.ok(zoomPagePreviousBox.width >= 44 && zoomPagePreviousBox.height >= 44, 'Zoom page controls must keep a usable tap target');
      assert.ok(zoomPageNextBox.width >= 44 && zoomPageNextBox.height >= 44, 'Zoom page controls must keep a usable tap target');
      assert.ok(zoomPageNextBox.x < zoomPagePreviousBox.x, 'RTL zoom page controls must put next on the left');
      assert.match(await amv.locator('.amv-reader__surface').getAttribute('style'), /scale\(1\.25\)/);
      await amv.locator('.amv-reader__stage').evaluate(stage => {
        const start = new Touch({ identifier: 1, target: stage, clientX: 100, clientY: 200 });
        const moved = new Touch({ identifier: 1, target: stage, clientX: 130, clientY: 220 });
        stage.dispatchEvent(new TouchEvent('touchstart', { touches: [start], changedTouches: [start], cancelable: true }));
        stage.dispatchEvent(new TouchEvent('touchmove', { touches: [moved], changedTouches: [moved], cancelable: true }));
        stage.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [moved], cancelable: true }));
      });
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2');
      assert.match(await amv.locator('.amv-reader__surface').getAttribute('style'), /translate\([^)]*[1-9]/);
      await amv.locator('.amv-reader__stage').focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2');
      await amv.locator('.amv-reader__stage').evaluate(stage => {
        const firstA = new Touch({ identifier: 1, target: stage, clientX: 100, clientY: 200 });
        const firstB = new Touch({ identifier: 2, target: stage, clientX: 200, clientY: 200 });
        const movedA = new Touch({ identifier: 1, target: stage, clientX: 75, clientY: 200 });
        const movedB = new Touch({ identifier: 2, target: stage, clientX: 225, clientY: 200 });
        stage.dispatchEvent(new TouchEvent('touchstart', { touches: [firstA, firstB], changedTouches: [firstA, firstB], cancelable: true }));
        stage.dispatchEvent(new TouchEvent('touchmove', { touches: [movedA, movedB], changedTouches: [movedA, movedB], cancelable: true }));
        stage.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [movedA, movedB], cancelable: true }));
      });
      assert.equal(await zoomLevel.textContent(), '188%');
      await zoomReset.click();
      assert.equal(await zoomLevel.textContent(), '100%');
      assert.equal(await amv.evaluate(element => element.classList.contains('is-zoomed')), false);
      assert.equal(await amv.locator('.amv-reader__edge--next').isDisabled(), false);
      assert.equal(await cta.evaluate(element => getComputedStyle(element).opacity), '1');
      await zoomIn.click();
      await zoomPageNext.click();
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      assert.equal(await zoomLevel.textContent(), '100%');
      assert.equal(await amv.evaluate(element => element.classList.contains('is-zoomed')), false);
      await zoomIn.click();
      assert.equal(await zoomPagePrevious.isDisabled(), false);
      assert.equal(await zoomPageNext.getAttribute('aria-label'), 'ズームを解除して全画面を終了');
      await zoomPagePrevious.click();
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
      assert.equal(await zoomLevel.textContent(), '100%');
      const fullscreenExitBox = await fullscreenButton.boundingBox();
      const fullscreenReaderBox = await amv.locator('.amv-reader__focus-open').boundingBox();
      assert.ok(fullscreenExitBox.width > fullscreenReaderBox.width && fullscreenExitBox.height > fullscreenReaderBox.height, 'Fullscreen exit must be more prominent than the dedicated reader button');
      await amv.locator('.amv-reader__focus-open').click();
      const fullscreenModal = amv.locator('.amv-modal:not([hidden])');
      await fullscreenModal.waitFor({ state: 'visible' });
      assert.equal(await fullscreenModal.evaluate(element => element.parentElement.classList.contains('amv-reader')), true);
      const modalCta = fullscreenModal.locator('.amv-modal__extension-layer .amv-reader__cta');
      assert.equal(await modalCta.textContent(), '詳しく "見る" &');
      const modalImageBox = await fullscreenModal.locator('.amv-modal__image').boundingBox();
      const modalCtaLayerBox = await fullscreenModal.locator('.amv-modal__extension-layer').boundingBox();
      assert.ok(Math.abs(modalImageBox.x - modalCtaLayerBox.x) < 1 && Math.abs(modalImageBox.y - modalCtaLayerBox.y) < 1 && Math.abs(modalImageBox.width - modalCtaLayerBox.width) < 1 && Math.abs(modalImageBox.height - modalCtaLayerBox.height) < 1, 'Dedicated Viewer CTA must follow the focused page image');
      await modalCta.evaluate(element => { element.addEventListener('click', event => event.preventDefault(), { once: true }); element.click(); });
      await fullscreenModal.locator('.amv-modal__close').click();
      assert.equal(await amv.evaluate(element => element.classList.contains('is-fullscreen')), true);
      const fullscreenNext = amv.locator('.amv-reader__edge--next');
      await fullscreenNext.click();
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      assert.equal(await fullscreenNext.isDisabled(), false);
      assert.equal(await fullscreenNext.getAttribute('aria-label'), '全画面を終了');
      await fullscreenNext.click();
      await page.waitForFunction(() => !document.querySelector('.wp-block-ai-manga-viewer-viewer').classList.contains('is-fullscreen'));
      assert.equal(await fullscreenButton.getAttribute('aria-pressed'), 'false');
      assert.equal(await fullscreenButton.textContent(), '全画面で読む');
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2', 'Completing fullscreen reading must return the normal Viewer to page 1');
      assert.equal(await fullscreenNext.isDisabled(), false);
      assert.equal(await fullscreenNext.getAttribute('aria-label'), '次のページ');
      await fullscreenButton.click();
      await amv.locator('.amv-reader__stage').focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => !document.querySelector('.wp-block-ai-manga-viewer-viewer').classList.contains('is-fullscreen'));
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2');
      await fullscreenButton.click();
      async function swipeFullscreenForward() {
        await amv.locator('.amv-reader__stage').evaluate(stage => {
          const start = new Touch({ identifier: 1, target: stage, clientX: 100, clientY: 200 });
          const end = new Touch({ identifier: 1, target: stage, clientX: 200, clientY: 200 });
          stage.dispatchEvent(new TouchEvent('touchstart', { touches: [start], changedTouches: [start] }));
          stage.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [end] }));
        });
      }
      await swipeFullscreenForward();
      await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      await swipeFullscreenForward();
      await page.waitForFunction(() => !document.querySelector('.wp-block-ai-manga-viewer-viewer').classList.contains('is-fullscreen'));
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2');
      if (await amv.locator('.amv-reader__count').textContent() === '1 / 2') {
        await amv.locator('.amv-reader__edge--next').click();
        await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      }
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
      if (await amv.locator('.amv-reader__count').textContent() === '1 / 2') {
        await amv.locator('.amv-reader__edge--next').click();
        await page.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
      }
      await amv.locator('.amv-reader__focus-open').click();
      await page.waitForFunction(expected => document.querySelector('.amv-modal__count').textContent === expected, width < 782 ? '1 / 2' : '1 / 3');
      assert.equal(await modal.locator('.amv-modal__count').textContent(), width < 782 ? '1 / 2' : '1 / 3');
      assert.equal(await amv.locator('.amv-reader__count').textContent(), '1 / 2');
      await page.keyboard.press('Escape');
      await old.locator('.cni-page-flip__focus-open').click();
      assert.equal(await page.locator('.cni-manga-viewer').getAttribute('hidden'), null);
      assert.equal(await page.locator('.amv-modal').getAttribute('hidden'), '');
      await page.keyboard.press('Escape');
      await amv.evaluate(rootElement => {
        const controls = rootElement.querySelector('.amv-reader__zoom-controls');
        controls.classList.remove('amv-reader__zoom-controls--bottom');
        controls.classList.add('amv-reader__zoom-controls--side');
        rootElement.dataset.zoomPosition = 'right';
        rootElement.querySelector('.amv-reader__stage').appendChild(controls);
      });
      assert.equal(await amv.locator('.amv-reader__zoom-controls').evaluate(element => getComputedStyle(element).flexDirection), 'column');
      if (width >= 782) {
        const sideRightBox = await amv.locator('.amv-reader__zoom-controls').boundingBox();
        const stageBox = await amv.locator('.amv-reader__stage').boundingBox();
        assert.ok(sideRightBox.x >= stageBox.x + stageBox.width, 'Right zoom controls must sit outside the manga on desktop');
        await amv.evaluate(rootElement => { rootElement.dataset.zoomPosition = 'left'; });
        const sideLeftBox = await amv.locator('.amv-reader__zoom-controls').boundingBox();
        assert.ok(sideLeftBox.x + sideLeftBox.width <= stageBox.x, 'Left zoom controls must sit outside the manga on desktop');
      } else {
        assert.equal(await amv.locator('.amv-reader__zoom-controls').isVisible(), false, 'Side zoom controls must be hidden on phone and tablet widths');
      }
      if (width === 1200) {
        await page.waitForTimeout(1200);
        await page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      const readerEvents = await page.evaluate(() => window.__amvReaderEvents);
      const impressionEvents = readerEvents.filter(event => event.name === 'viewer_impression');
      assert.equal(impressionEvents.length, 1, 'Viewer impression must be de-duplicated per rendered Viewer');
      assert.equal(impressionEvents[0].sessionId, '');
      assert.equal(impressionEvents[0].readingStarted, false);
      assert.equal(readerEvents.filter(event => event.name === 'read_start').length, 1, 'Reading must start once across mode changes');
      assert.equal(readerEvents.find(event => event.name === 'read_start').mode, 'fullscreen');
      assert.deepEqual([...new Set(readerEvents.filter(event => event.name === 'mode_use').map(event => event.mode))].sort(), ['focus', 'fullscreen', 'standard', 'zoom']);
      const reached = readerEvents.filter(event => event.name === 'page_reach');
      assert.deepEqual(reached.map(event => event.pageKey).sort(), ['page-one', 'page-two']);
      assert.equal(new Set(reached.map(event => event.pageKey)).size, reached.length, 'Page reach must be de-duplicated per reading session');
      const ctaEvents = readerEvents.filter(event => event.name === 'cta_click');
      assert.equal(ctaEvents.length, 3);
      assert.equal(ctaEvents[0].mode, 'standard_direct');
      assert.equal(ctaEvents[0].readingStarted, false);
      assert.equal(ctaEvents[1].mode, 'zoom');
      assert.equal(ctaEvents[1].readingStarted, true);
      assert.equal(ctaEvents[2].mode, 'focus');
      assert.equal(ctaEvents[2].readingStarted, true);
      const activeEvents = readerEvents.filter(event => event.name === 'active_time');
      if (width === 1200) {
        assert.ok(activeEvents.length >= 1, 'Visible recent reader activity must emit active reading time');
        assert.ok(activeEvents.every(event => event.readingStarted === true && Number.isInteger(event.activeSecondsDelta) && event.activeSecondsDelta >= 1 && event.activeSecondsDelta <= 15));
      }
      assert.ok(readerEvents.every(event => event.viewerKey === 'viewer-main' && event.instanceKey === 'instance-main' && Number.isInteger(event.occurredAt)));
      assert.ok(readerEvents.every(event => /^visitor-[a-z0-9-]+$/.test(event.visitorId)), 'Every transmitted event must share an opaque anonymous visitor id');
      assert.equal(new Set(readerEvents.map(event => event.visitorId)).size, 1);
      assert.equal(new Set(readerEvents.map(event => event.eventId)).size, readerEvents.length, 'Every browser event must have a unique idempotency key');
      assert.equal(ctaEvents[0].sessionId, '', 'A direct CTA click before reading must not invent a reading session');
      const readingEvents = readerEvents.filter(event => event.name !== 'viewer_impression' && (event.name !== 'cta_click' || event.readingStarted));
      assert.equal(new Set(readingEvents.map(event => event.sessionId)).size, 1, 'Mode changes must share one browser reading session');
      assert.match(readingEvents[0].sessionId, /^session-/);
      for (let attempt = 0; attempt < 20 && analyticsRequests.length < readerEvents.length; attempt += 1) await page.waitForTimeout(25);
      assert.equal(analyticsRequests.length, readerEvents.length, 'Every internal reader event must reach the analytics transport once');
      assert.deepEqual(analyticsRequests.map(event => event.eventId).sort(), readerEvents.map(event => event.eventId).sort());
      assert.deepEqual(errors, []);
      await page.close();
    }
    const direct = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await direct.setContent(directHtml);
    await direct.evaluate(() => {
      window.aiMangaViewerCapabilities = { analytics: { collection: true } };
      window.aiMangaViewerProAnalytics = { enabled: true, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events' };
      window.__amvReaderEvents = [];
      document.addEventListener('amv:reader-event', event => window.__amvReaderEvents.push(event.detail));
    });
    await direct.addStyleTag({ path: path.join(current, 'style.css') });
    await direct.addScriptTag({ path: path.join(current, 'layout.js') });
    await direct.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await direct.addScriptTag({ path: path.join(current, 'view.js') });
    const directReader = direct.locator('.wp-block-ai-manga-viewer-viewer');
    assert.equal(await directReader.getAttribute('data-analytics-source'), null);
    await directReader.locator('.amv-reader__edge--next').click();
    await direct.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    assert.deepEqual(await direct.evaluate(() => window.__amvReaderEvents), [], 'Direct Viewer must remain readable without emitting analytics events');
    await direct.close();
    const disabledAnalytics = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    let disabledAnalyticsRequests = 0;
    await disabledAnalytics.route('https://example.test/**', route => {
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/events')) {
        disabledAnalyticsRequests += 1;
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"amv_analytics_disabled"}' });
      }
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/config')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":false}' });
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"/>' });
    });
    await disabledAnalytics.setContent(html);
    await disabledAnalytics.evaluate(() => {
      window.aiMangaViewerCapabilities = { analytics: { collection: true } };
      window.aiMangaViewerProAnalytics = { enabled: null, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events', configUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/config' };
      window.__disabledReaderEvents = [];
      document.addEventListener('amv:reader-event', event => window.__disabledReaderEvents.push(event.detail));
    });
    await disabledAnalytics.addStyleTag({ path: path.join(current, 'style.css') });
    await disabledAnalytics.addScriptTag({ path: path.join(current, 'layout.js') });
    await disabledAnalytics.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await disabledAnalytics.addScriptTag({ path: path.join(current, 'view.js') });
    await disabledAnalytics.locator('.wp-block-ai-manga-viewer-viewer .amv-reader__edge--next').click();
    await disabledAnalytics.waitForTimeout(100);
    assert.equal(await disabledAnalytics.evaluate(() => window.__disabledReaderEvents.length), 0, 'Disabled Analytics must not initialize the Pro collector');
    assert.equal(disabledAnalyticsRequests, 0, 'Disabled Analytics must not send reader events from the browser');
    await disabledAnalytics.close();
    const impressionPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await impressionPage.route('https://example.test/**', route => {
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/events')) return route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"/>' });
    });
    await impressionPage.setContent(html);
    await impressionPage.evaluate(() => {
      window.aiMangaViewerCapabilities = { analytics: { collection: true } };
      window.aiMangaViewerProAnalytics = { enabled: true, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events' };
      document.body.insertAdjacentHTML('afterbegin', '<div style="height:1800px"></div>');
      window.__impressionEvents = [];
      document.addEventListener('amv:reader-event', event => window.__impressionEvents.push(event.detail));
    });
    await impressionPage.addScriptTag({ path: path.join(current, 'layout.js') });
    await impressionPage.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await impressionPage.addScriptTag({ path: path.join(current, 'view.js') });
    await impressionPage.waitForTimeout(1150);
    assert.equal(await impressionPage.evaluate(() => window.__impressionEvents.filter(event => event.name === 'viewer_impression').length), 0, 'A Viewer outside the viewport must not count as displayed');
    await impressionPage.locator('.wp-block-ai-manga-viewer-viewer').scrollIntoViewIfNeeded();
    await impressionPage.waitForTimeout(1150);
    assert.equal(await impressionPage.evaluate(() => window.__impressionEvents.filter(event => event.name === 'viewer_impression').length), 1, 'A Viewer shown at least 50% for one second must count once');
    await impressionPage.evaluate(() => window.scrollTo(0, 0));
    await impressionPage.locator('.wp-block-ai-manga-viewer-viewer').scrollIntoViewIfNeeded();
    await impressionPage.waitForTimeout(1150);
    assert.equal(await impressionPage.evaluate(() => window.__impressionEvents.filter(event => event.name === 'viewer_impression').length), 1, 'Repeated visibility must not double-count one rendered Viewer');
    await impressionPage.close();
    const resume = await browser.newPage();
    await resume.route('https://example.test/**', route => {
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/events')) return route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/config')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true}' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await resume.addInitScript(() => {
      window.aiMangaViewerCapabilities = { analytics: { collection: true } };
      window.aiMangaViewerProAnalytics = { enabled: null, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events', configUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/config' };
      window.__amvReaderEvents = [];
      document.addEventListener('amv:reader-event', event => window.__amvReaderEvents.push(event.detail));
      let fullscreenElement = null;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
      document.exitFullscreen = () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
      HTMLElement.prototype.requestFullscreen = function() { fullscreenElement = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    });
    async function startResumeReader() {
      await resume.addScriptTag({ path: path.join(current, 'layout.js') });
    await resume.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await resume.addScriptTag({ path: path.join(current, 'view.js') });
      await resume.locator('.wp-block-ai-manga-viewer-viewer .amv-reader__fullscreen').click();
      await resume.waitForFunction(() => window.__amvReaderEvents.some(event => event.name === 'read_start'));
      return resume.evaluate(() => window.__amvReaderEvents.find(event => event.name === 'read_start'));
    }
    await resume.goto('https://example.test/resume');
    const firstRead = await startResumeReader();
    await resume.reload();
    const resumedRead = await startResumeReader();
    assert.equal(resumedRead.visitorId, firstRead.visitorId, 'Anonymous visitor id must persist in the same browser');
    assert.equal(resumedRead.sessionId, firstRead.sessionId, 'The same viewer placement must resume within 30 minutes');
    await resume.reload();
    await resume.evaluate(() => {
      const key = Object.keys(localStorage).find(name => name.startsWith('ai_manga_viewer_session_'));
      const value = JSON.parse(localStorage.getItem(key)); value.lastActivity = Date.now() - 1800001; localStorage.setItem(key, JSON.stringify(value));
    });
    const expiredRead = await startResumeReader();
    assert.equal(expiredRead.visitorId, firstRead.visitorId);
    assert.notEqual(expiredRead.sessionId, firstRead.sessionId, 'A reader session older than 30 minutes must not resume');
    await resume.close();
    for (const binding of ['rtl', 'ltr']) {
    const solo = await browser.newPage();
    await solo.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#ddd"/></svg>' }));
    await solo.setContent(html);
    await solo.locator('.wp-block-cni-blocks-page-flip').evaluate(node => node.remove());
    await solo.locator('.wp-block-ai-manga-viewer-viewer').evaluate((node, value) => { node.dataset.binding = value; node.dataset.animation = 'off'; }, binding);
    await solo.addStyleTag({ path: path.join(current, 'style.css') });
    await solo.addStyleTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'style.css') });
    await solo.addScriptTag({ path: path.join(current, 'layout.js') });
    await solo.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await solo.addScriptTag({ path: path.join(current, 'view.js') });
    await solo.addScriptTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'frontend.js') });
    const stage = solo.locator('.amv-reader__stage');
    async function swipe(target, dx, dy = 0, mode = 'single') {
      await target.evaluate((element, args) => {
        const make = (id, x, y) => new Touch({ identifier: id, target: element, clientX: x, clientY: y });
        const first = make(1, 200, 200);
        const fire = (type, touches, changedTouches) => element.dispatchEvent(new TouchEvent(type, { touches, changedTouches }));
        fire('touchstart', [first], [first]);
        if (args.mode === 'multi') fire('touchstart', [first, make(2, 240, 200)], [make(2, 240, 200)]);
        if (args.mode === 'cancel') fire('touchcancel', [], [first]);
        fire('touchend', [], [make(1, 200 + args.dx, 200 + args.dy)]);
      }, { dx, dy, mode });
      await solo.waitForTimeout(50);
    }
    const forward = binding === 'rtl' ? 100 : -100;
    const nextKey = binding === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backKey = binding === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const zoomInForBinding = solo.locator('.amv-reader__zoom-in');
    const zoomPreviousForBinding = solo.locator('.amv-reader__zoom-page--previous');
    const zoomNextForBinding = solo.locator('.amv-reader__zoom-page--next');
    await zoomInForBinding.click();
    const zoomPreviousForBindingBox = await zoomPreviousForBinding.boundingBox();
    const zoomNextForBindingBox = await zoomNextForBinding.boundingBox();
    assert.equal(zoomNextForBindingBox.x < zoomPreviousForBindingBox.x, binding === 'rtl');
    await zoomNextForBinding.click();
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    assert.equal(await solo.locator('.amv-reader__zoom-level').textContent(), '100%');
    await zoomInForBinding.click();
    await zoomPreviousForBinding.click();
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
    assert.equal(await solo.locator('.amv-reader__zoom-level').textContent(), '100%');
    for (const [dx, dy, mode] of [[forward, 200, 'single'], [forward, 0, 'multi'], [forward, 0, 'cancel'], [10, 0, 'single']]) {
      await swipe(stage, dx, dy, mode);
      assert.equal(await solo.locator('.amv-reader__count').textContent(), '1 / 2');
    }
    await swipe(stage, forward);
    assert.equal(await solo.locator('.amv-reader__count').textContent(), '2 / 2');
    await swipe(stage, -forward);
    assert.equal(await solo.locator('.amv-reader__count').textContent(), '1 / 2');
    await stage.focus();
    await solo.keyboard.press(nextKey);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    await solo.keyboard.press(backKey);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
    await solo.locator('.amv-reader__focus-open').click();
    const modalCount = solo.locator('.amv-modal__count');
    await solo.waitForFunction(() => document.querySelector('.amv-modal__count').textContent === '1 / 3');
    await solo.keyboard.press(nextKey);
    assert.equal(await modalCount.textContent(), '2 / 3');
    await solo.keyboard.press(backKey);
    assert.equal(await modalCount.textContent(), '1 / 3');
    const modalStage = solo.locator('.amv-modal__stage');
    for (const [dy, mode] of [[200, 'single'], [0, 'multi'], [0, 'cancel']]) {
      await swipe(modalStage, forward, dy, mode);
      assert.equal(await modalCount.textContent(), '1 / 3');
    }
    await swipe(modalStage, forward);
    assert.equal(await modalCount.textContent(), '2 / 3');
    await swipe(modalStage, -forward);
    assert.equal(await modalCount.textContent(), '1 / 3');
    const nextEdge = solo.locator('.amv-modal__edge--next');
    const previousEdge = solo.locator('.amv-modal__edge--previous');
    const nextBox = await nextEdge.boundingBox(), previousBox = await previousEdge.boundingBox();
    assert.equal(nextBox.x < previousBox.x, binding === 'rtl');
    await nextEdge.click();
    assert.equal(await modalCount.textContent(), '2 / 3');
    await solo.locator('.amv-modal__next').click();
    const modalNextTurn = solo.locator('.amv-modal__turning-sheet');
    assert.deepEqual(await modalNextTurn.evaluate(element => [getComputedStyle(element).getPropertyValue('--amv-modal-turn').trim(), getComputedStyle(element).getPropertyValue('--amv-modal-shift').trim()]), binding === 'rtl' ? ['-72deg', '10%'] : ['72deg', '-10%']);
    await solo.waitForFunction(() => document.querySelector('.amv-modal__count').textContent === '3 / 3');
    await solo.locator('.amv-modal__previous').click();
    const modalPreviousTurn = solo.locator('.amv-modal__turning-sheet').last();
    assert.deepEqual(await modalPreviousTurn.evaluate(element => [getComputedStyle(element).getPropertyValue('--amv-modal-turn').trim(), getComputedStyle(element).getPropertyValue('--amv-modal-shift').trim()]), binding === 'rtl' ? ['72deg', '-10%'] : ['-72deg', '10%']);
    await solo.waitForFunction(() => document.querySelector('.amv-modal__count').textContent === '2 / 3');
    await previousEdge.click();
    assert.equal(await modalCount.textContent(), '1 / 3');
    await solo.keyboard.press('Escape');
    await solo.locator('.wp-block-ai-manga-viewer-viewer').evaluate(node => { node.dataset.amvPanelStart = 'current'; });
    await stage.focus();
    await solo.keyboard.press(nextKey);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    await solo.locator('.amv-reader__focus-open').click();
    await solo.waitForFunction(() => document.querySelector('.amv-modal__count').textContent === '3 / 3');
    assert.equal(await modalCount.textContent(), '3 / 3');
    await solo.keyboard.press('Escape');
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
    await stage.focus();
    await solo.keyboard.press(nextKey);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    await solo.locator('.wp-block-ai-manga-viewer-viewer').evaluate(node => { node.dataset.animation = 'on'; });
    await stage.focus();
    await solo.keyboard.press(backKey);
    const previousTurn = solo.locator('.amv-reader__page.is-leaving-previous');
    await previousTurn.waitFor({ state: 'visible' });
    assert.deepEqual(await previousTurn.evaluate(element => [getComputedStyle(element).getPropertyValue('--amv-reader-turn').trim(), getComputedStyle(element).getPropertyValue('--amv-reader-shift').trim()]), binding === 'rtl' ? ['72deg', '-10%'] : ['-72deg', '10%']);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '1 / 2');
    await solo.keyboard.press(nextKey);
    const nextTurn = solo.locator('.amv-reader__page.is-leaving-next');
    await nextTurn.waitFor({ state: 'visible' });
    assert.deepEqual(await nextTurn.evaluate(element => [getComputedStyle(element).getPropertyValue('--amv-reader-turn').trim(), getComputedStyle(element).getPropertyValue('--amv-reader-shift').trim()]), binding === 'rtl' ? ['-72deg', '10%'] : ['72deg', '-10%']);
    await solo.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    await solo.close();
    }
    const admin = await browser.newPage();
    await admin.setViewportSize({ width: 1400, height: 900 });
    await admin.setContent('<body class="post-type-amv_viewer"><div class="tablenav"><div class="actions"><select aria-label="一括操作"><option>一括操作</option></select><select aria-label="日付で絞り込み"><option>すべての日付</option></select></div><span class="displaying-num">5項目</span><span class="pagination-links">ページネーション</span></div><p class="search-box"><input type="search" aria-label="漫画を検索"></p><table class="wp-list-table"><tbody>' + Array.from({ length: 5 }, (_, index) => { const id = 123 + index; const status = index === 1 ? 'draft' : 'publish'; const statusLabel = index === 1 ? '下書き' : '公開済み'; const cover = index === 0 ? '<img class="amv-library-cover-image" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'800\'/%3E">' : (index === 1 ? '<img class="amv-library-cover-image is-landscape" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'300\'/%3E">' : '<span class="amv-library-cover-placeholder">表紙未設定</span>'); return '<tr><th class="check-column"><input type="checkbox"></th><td class="column-amv_cover"><a class="amv-library-cover-link" href="/wp-admin/post.php?post=' + id + '&amp;action=edit" aria-label="この漫画を編集">' + cover + '</a></td><td class="column-title"><strong><a class="row-title" href="/wp-admin/post.php?post=' + id + '&amp;action=edit" aria-label="作品タイトル全文を編集">' + (index ? '漫画' + (index + 1) : '非常に長いタイトルでもカードからはみ出さずに表示される漫画作品タイトル全文') + '</a></strong><div class="row-actions"><span class="edit">編集</span> | <span class="inline">クイック編集</span> | <span class="trash">ゴミ箱へ移動</span> | <span class="clear-cache">Clear Cache</span></div></td><td class="column-amv_details"><div class="amv-library-meta"><span class="amv-library-badge amv-library-badge--status is-' + status + '">' + statusLabel + '</span><span class="amv-library-badge">8ページ</span><span class="amv-library-meta__id">Viewer ID: ' + id + '</span><span class="amv-library-meta__modified">更新: 2026-09-27 21:29</span></div><div class="amv-library-primary-actions"><a class="button amv-library-edit" href="/wp-admin/post.php?post=' + id + '&amp;action=edit">編集</a><a class="button amv-library-analytics" href="/wp-admin/edit.php?post_type=amv_viewer&page=ai-manga-viewer-analytics-report&amv_viewer=library-viewer-' + id + '">解析を見る</a><a class="button amv-library-consultation" href="/wp-admin/edit.php?post_type=amv_viewer&page=ai-manga-viewer-consultation&amv_viewer=library-viewer-' + id + '">AI相談資料を作成</a>' + (index ? '' : '<span class="amv-library-shortcode"><button class="amv-library-shortcode__copy" data-shortcode="[ai_manga_viewer id=&quot;123&quot;]" data-default-label="コピー" data-copied-label="コピーしました" data-success-message="ショートコードをコピーしました。" data-error-message="コピー失敗"><code class="amv-library-shortcode__code">[ai_manga_viewer id=&quot;123&quot;]</code><span class="amv-library-shortcode__feedback">コピー</span></button><span class="amv-library-shortcode__status" aria-live="polite"></span></span>') + '</div></td><td class="column-amv_modified"><span class="screen-reader-text">更新: 2026-09-27 21:29</span></td></tr>'; }).join('') + '</tbody></table></body>');
    await admin.evaluate(() => { document.execCommand = command => command === 'copy'; });
    await admin.addStyleTag({ content: '.row-title{font-size:14px!important;font-weight:600}' });
    await admin.addStyleTag({ path: path.join(root, 'assets/admin-library.css') });
    await admin.addScriptTag({ path: path.join(root, 'assets/admin-library.js') });
    const libraryCards = await admin.locator('.wp-list-table tbody tr').all();
    const firstCardBox = await libraryCards[0].boundingBox();
    const secondCardBox = await libraryCards[1].boundingBox();
    const thirdCardBox = await libraryCards[2].boundingBox();
    assert.ok(Math.abs(firstCardBox.y - secondCardBox.y) <= 2 && secondCardBox.x > firstCardBox.x && thirdCardBox.y > firstCardBox.y, 'Desktop Manga Library must show two horizontal cards per row');
    const coverBox = await admin.locator('.amv-library-cover-image').first().boundingBox();
    assert.ok(Math.abs(coverBox.width / coverBox.height - 4 / 3) < 0.03, 'Library cover area must use 4:3');
    assert.ok(Math.abs(coverBox.width - 176) < 1 && Math.abs(coverBox.height - 132) < 1, 'Desktop Manga Library cover must use the compact fixed size');
    assert.ok(firstCardBox.height <= 172, 'Desktop Manga Library card must stay close to the fixed cover height; actual ' + firstCardBox.height + 'px');
    assert.equal(await admin.locator('.amv-library-cover-image').first().evaluate(el => getComputedStyle(el).objectFit), 'contain');
    assert.equal(await admin.locator('.is-landscape').evaluate(el => getComputedStyle(el).objectFit), 'contain');
    assert.equal(await admin.locator('.row-title').first().evaluate(el => getComputedStyle(el).webkitLineClamp), '2');
    assert.equal(await admin.locator('.row-title').first().evaluate(el => getComputedStyle(el).fontSize), '16px');
    assert.equal(await admin.locator('.amv-library-meta').first().evaluate(el => getComputedStyle(el).fontSize), '13px');
    assert.equal(await admin.locator('.amv-library-primary-actions .button').first().evaluate(el => getComputedStyle(el).fontSize), '13px');
    assert.equal(await admin.locator('.amv-library-badge--status.is-publish').count(), 4);
    assert.equal(await admin.locator('.amv-library-badge--status.is-draft').count(), 1);
    assert.ok((await admin.locator('.amv-library-meta').first().textContent()).includes('8ページ'));
    assert.ok((await admin.locator('.amv-library-meta').first().textContent()).includes('Viewer ID: 123'));
    assert.ok((await admin.locator('.amv-library-meta').first().textContent()).includes('更新: 2026-09-27 21:29'));
    assert.ok((await admin.locator('.amv-library-edit').first().getAttribute('href')).includes('post=123&action=edit'));
    assert.ok((await admin.locator('.row-actions').first().textContent()).includes('Clear Cache'), 'Existing low-frequency row actions must remain available');
    assert.ok((await admin.locator('.row-actions').first().textContent()).includes('クイック編集'));
    assert.ok((await admin.locator('.row-actions').first().textContent()).includes('ゴミ箱へ移動'));
    assert.equal(await admin.locator('.row-actions').first().evaluate(el => getComputedStyle(el).opacity), '0');
    await admin.locator('.wp-list-table tbody tr').first().hover();
    assert.equal(await admin.locator('.row-actions').first().evaluate(el => getComputedStyle(el).opacity), '1');
    assert.ok((await admin.locator('.amv-library-analytics').first().getAttribute('href')).includes('amv_viewer=library-viewer-123'), 'Analytics action must target the selected Library Viewer');
    assert.ok((await admin.locator('.amv-library-consultation').first().getAttribute('href')).includes('page=ai-manga-viewer-consultation'), 'Consultation action must sit beside Analytics and target the selected Viewer');
    assert.equal(await admin.locator('input[type="checkbox"]').count(), 5);
    assert.equal(await admin.locator('input[type="search"]').count(), 1);
    assert.equal(await admin.locator('select[aria-label="一括操作"]').count(), 1);
    assert.equal(await admin.locator('select[aria-label="日付で絞り込み"]').count(), 1);
    assert.equal(await admin.locator('.pagination-links').count(), 1);
    assert.ok((await admin.locator('.amv-library-cover-link').first().getAttribute('href')).includes('post=123&action=edit'), 'Manga Library cover must link to the edit screen');
    assert.equal(await admin.locator('.amv-library-shortcode__code').textContent(), '[ai_manga_viewer id="123"]');
    await admin.locator('.amv-library-shortcode__copy').click();
    assert.equal(await admin.locator('.amv-library-shortcode__code').textContent(), '[ai_manga_viewer id="123"]');
    assert.equal(await admin.locator('.amv-library-shortcode__feedback').textContent(), 'コピーしました');
    assert.equal(await admin.locator('.amv-library-shortcode__status').textContent(), 'ショートコードをコピーしました。');
	await admin.evaluate(() => {
		const original = document.querySelectorAll('.wp-list-table tbody tr')[1];
		original.classList.add('hidden');
		const quickEdit = document.createElement('tr');
		quickEdit.className = 'inline-edit-row quick-edit-row';
		quickEdit.innerHTML = '<td class="colspanchange"><div class="inline-edit-wrapper"><strong>クイック編集</strong><label>タイトル <input value="漫画2"></label></div></td>';
		original.after(quickEdit);
	});
	assert.equal(await admin.locator('.wp-list-table tbody tr.hidden').evaluate(el => getComputedStyle(el).display), 'none', 'The original card must remain hidden while Quick Edit is open');
	const quickEditBox = await admin.locator('.inline-edit-row').boundingBox();
	const tableBodyBox = await admin.locator('.wp-list-table tbody').boundingBox();
	assert.ok(Math.abs(quickEditBox.x - tableBodyBox.x) < 2 && Math.abs(quickEditBox.width - tableBodyBox.width) < 2, 'Quick Edit must span the full two-column card grid');
	const quickEditContentBox = await admin.locator('.inline-edit-row .inline-edit-wrapper').boundingBox();
	assert.ok(quickEditContentBox.width >= quickEditBox.width - 4, 'Quick Edit fields must use the full row content width');
	await admin.evaluate(() => { document.querySelector('.inline-edit-row').remove(); document.querySelector('.wp-list-table tbody tr.hidden').classList.remove('hidden'); });
    await admin.setViewportSize({ width: 1000, height: 900 });
    const tabletCards = await admin.locator('.wp-list-table tbody tr').all();
    assert.ok((await tabletCards[1].boundingBox()).y > (await tabletCards[0].boundingBox()).y, 'Tablet Manga Library must use one column');
    assert.equal(await admin.locator('.row-actions').first().evaluate(el => getComputedStyle(el).opacity), '1');
    await admin.setViewportSize({ width: 560, height: 900 });
    const mobileCover = await admin.locator('.column-amv_cover').first().boundingBox();
    const mobileTitle = await admin.locator('.column-title').first().boundingBox();
    assert.ok(mobileTitle.y > mobileCover.y, 'Phone card must stack cover above Viewer information');
    await admin.close();
    const analyticsAdmin = await browser.newPage();
    await analyticsAdmin.setContent('<div class="amv-panel"><div class="amv-chart-toolbar"><button data-amv-metric="sessions"></button><button data-amv-metric="readers"></button></div><div class="amv-chart-selection" aria-live="polite"><strong data-amv-chart-date>日付を選択</strong><span data-amv-chart-values>棒をクリック</span></div><div class="amv-chart" data-amv-report-chart data-amv-max-sessions="4" data-amv-max-readers="3"><span data-amv-axis-top></span><span data-amv-axis-middle></span><button type="button" class="amv-chart-day" data-amv-day="2026-09-27" data-amv-readers="1" data-amv-sessions="2" aria-pressed="false"><span class="amv-chart-bar"></span></button><button type="button" class="amv-chart-day" data-amv-day="2026-09-28" data-amv-readers="3" data-amv-sessions="4" aria-pressed="false"><span class="amv-chart-bar"></span></button></div></div>');
    await analyticsAdmin.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'admin.js') });
    await analyticsAdmin.locator('.amv-chart-day').nth(1).click();
    assert.equal(await analyticsAdmin.locator('[data-amv-chart-date]').textContent(), '2026-09-28');
    assert.equal(await analyticsAdmin.locator('[data-amv-chart-values]').textContent(), '読者数 3人');
    assert.equal(await analyticsAdmin.locator('.amv-chart-day').nth(1).getAttribute('aria-pressed'), 'true');
    assert.equal(await analyticsAdmin.locator('.amv-chart-day').first().getAttribute('aria-pressed'), 'false');
    await analyticsAdmin.locator('[data-amv-metric="sessions"]').click();
    assert.equal(await analyticsAdmin.locator('[data-amv-chart-values]').textContent(), '読まれた回数 4回');
    assert.equal(await analyticsAdmin.locator('[data-amv-axis-top]').textContent(), '4');
    await analyticsAdmin.close();
    const consultationAdmin = await browser.newPage();
    await consultationAdmin.setContent('<textarea data-amv-consultation-markdown># 相談資料\n本文</textarea><button data-amv-copy-consultation data-default-label="相談資料をコピー" data-copied-label="コピーしました">相談資料をコピー</button><p data-amv-consultation-status></p>');
    await consultationAdmin.evaluate(() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => { window.__copiedConsultation = value; return Promise.resolve(); } } });
    });
    await consultationAdmin.addScriptTag({ path: path.join(proRoot, 'assets', 'ai-consultation', 'admin.js') });
    await consultationAdmin.locator('[data-amv-copy-consultation]').click();
    await consultationAdmin.waitForFunction(() => window.__copiedConsultation);
    assert.equal(await consultationAdmin.evaluate(() => window.__copiedConsultation), '# 相談資料\n本文');
    assert.equal(await consultationAdmin.locator('[data-amv-copy-consultation]').textContent(), 'コピーしました');
    assert.equal(await consultationAdmin.locator('[data-amv-consultation-status]').textContent(), 'AI相談資料をコピーしました。');
    await consultationAdmin.close();
    const analyticsReport = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await analyticsReport.setContent(analyticsHtml);
    await analyticsReport.addStyleTag({ path: path.join(proRoot, 'assets', 'analytics', 'admin.css') });
    await analyticsReport.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'admin.js') });
    const chartHeight = (await analyticsReport.locator('.amv-chart').boundingBox()).height;
    assert.ok(chartHeight >= 200 && chartHeight <= 250, 'Daily chart must use the compact 200-250px range');
    assert.equal(await analyticsReport.locator('.amv-selector-card.is-selected').count(), 1);
    assert.ok((await analyticsReport.locator('.amv-selected-viewer h2').textContent()).includes('登録漫画1'));
    assert.equal(await analyticsReport.locator('.amv-selected-actions a').count(), 1, 'Consultation action must be hidden while Analytics is disabled');
    assert.equal((await analyticsReport.locator('body').textContent()).includes('投稿内Viewer'), false);
    assert.equal((await analyticsReport.locator('.amv-donut__value').textContent()).trim(), '0.0%');
    assert.ok((await analyticsReport.locator('.amv-funnel').textContent()).includes('25%到達'));
    assert.ok((await analyticsReport.locator('.amv-completion-drop').textContent()).includes('2ページ目'));
    assert.equal(await analyticsReport.locator('.amv-reach-row.has-drop').count(), 1);
    assert.equal(await analyticsReport.locator('.amv-selector').evaluate(el => getComputedStyle(el).overflowX), 'auto');
    assert.equal(await analyticsReport.locator('input[name="amv_viewer"]').getAttribute('value'), 'library-viewer-2440');
    assert.deepEqual(await analyticsReport.locator('#amv-report-days option').allTextContents(), ['過去90日', '全期間']);
    await analyticsReport.locator('[data-amv-viewer-dialog-open]').click();
    const selectorCoverBox = await analyticsReport.locator('.amv-selector-cover').first().boundingBox();
    assert.ok(Math.abs(selectorCoverBox.width / selectorCoverBox.height - 4 / 3) < 0.03, 'Analytics selector thumbnails must use a compact 4:3 ratio');
    await analyticsReport.locator('[data-amv-viewer-dialog-close]').click();
    assert.equal((await analyticsReport.locator('.amv-reading-analysis-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)), 2);
    await analyticsReport.locator('.amv-chart-day').last().click();
    assert.equal(await analyticsReport.locator('[data-amv-chart-values]').textContent(), '読者数 1人');
    await analyticsReport.setViewportSize({ width: 850, height: 1000 });
    assert.equal((await analyticsReport.locator('.amv-reading-analysis-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)), 1);
    await analyticsReport.close();
    const analyticsEnabled = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await analyticsEnabled.setContent(analyticsEnabledHtml);
    await analyticsEnabled.addStyleTag({ path: path.join(proRoot, 'assets', 'analytics', 'admin.css') });
    const selectedCard = analyticsEnabled.locator('.amv-selected-viewer');
    const consultationButton = selectedCard.locator('.amv-selected-actions .button-primary');
    assert.equal(await consultationButton.textContent(), 'AI相談資料を作成');
    const selectedBox = await selectedCard.boundingBox(), actionBox = await consultationButton.boundingBox();
    assert.ok(actionBox.x >= selectedBox.x && actionBox.y >= selectedBox.y && actionBox.x + actionBox.width <= selectedBox.x + selectedBox.width && actionBox.y + actionBox.height <= selectedBox.y + selectedBox.height, 'Consultation action must remain inside the selected Viewer card');
    await analyticsEnabled.close();
    const analyticsAll = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await analyticsAll.setContent(analyticsAllHtml);
    await analyticsAll.addStyleTag({ path: path.join(proRoot, 'assets', 'analytics', 'admin.css') });
    assert.equal(await analyticsAll.locator('.amv-comparison').count(), 1);
    assert.equal(await analyticsAll.locator('.amv-funnel').count(), 0);
    assert.equal(await analyticsAll.locator('.amv-reach-row').count(), 0);
    assert.equal((await analyticsAll.locator('body').textContent()).includes('投稿内Viewer'), false);
    await analyticsAll.close();
    const analyticsLibrary = await browser.newPage();
    await analyticsLibrary.setContent(analyticsLibraryHtml);
    assert.ok((await analyticsLibrary.locator('.amv-selected-viewer').textContent()).includes('登録漫画2・解析なし'));
    assert.equal(await analyticsLibrary.locator('.amv-selected-viewer .is-placeholder').count(), 1);
    await analyticsLibrary.close();
    const analyticsComplete = await browser.newPage();
    await analyticsComplete.setContent(analyticsCompleteHtml);
    assert.equal((await analyticsComplete.locator('.amv-donut__value').textContent()).trim(), '100.0%');
    assert.ok((await analyticsComplete.locator('.amv-cta-detail').textContent()).includes('読書後CTAクリック'));
    await analyticsComplete.close();
    const side = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    await side.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#ddd"/></svg>' }));
    await side.setContent(sideHtml);
    await side.addStyleTag({ path: path.join(current, 'style.css') });
    await side.addScriptTag({ path: path.join(current, 'layout.js') });
    await side.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await side.addScriptTag({ path: path.join(current, 'view.js') });
    const sideReader = side.locator('.wp-block-ai-manga-viewer-viewer');
    const sideStageBox = await sideReader.locator('.amv-reader__stage').boundingBox();
    const sideControls = sideReader.locator('.amv-reader__zoom-controls--side');
    const sideControlsBox = await sideControls.boundingBox();
    assert.ok(sideControlsBox.x >= sideStageBox.x + sideStageBox.width + 16, 'Inline right zoom controls must leave horizontal space beside the page edge');
    await sideReader.evaluate(node => { node.dataset.zoomPosition = 'left'; });
    const leftControlsBox = await sideControls.boundingBox();
    assert.ok(leftControlsBox.x + leftControlsBox.width <= sideStageBox.x - 16, 'Inline left zoom controls must leave the same horizontal space beside the page edge');
    await sideReader.evaluate(node => { node.dataset.zoomPosition = 'right'; });
    const sideZoomIn = sideControls.locator('.amv-reader__zoom-in');
    await sideZoomIn.click(); await sideZoomIn.click(); await sideZoomIn.click();
    assert.equal(await sideControls.locator('.amv-reader__zoom-level').textContent(), '175%');
    await sideReader.evaluate(node => { node.classList.add('is-fullscreen'); });
    assert.equal(await sideControls.evaluate(node => getComputedStyle(node).right), '10px', 'Fullscreen right zoom placement must remain unchanged');
    assert.notEqual(await sideControls.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)', 'Fullscreen side zoom controls must not use the white desktop container');
    assert.equal(await sideZoomIn.evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)', 'Fullscreen side zoom buttons must remain visible against their container');
    await sideReader.evaluate(node => { node.classList.remove('is-fullscreen'); });
    assert.equal(await sideReader.locator('.amv-reader__zoom-page--next').isVisible(), true);
    await sideReader.locator('.amv-reader__zoom-page--next').click();
    await side.waitForFunction(() => document.querySelector('.amv-reader__count').textContent === '2 / 2');
    assert.equal(await sideControls.locator('.amv-reader__zoom-level').textContent(), '100%');
    await side.setViewportSize({ width: 781, height: 850 });
    assert.equal(await sideControls.isVisible(), false);
    await side.close();
    for (const focusViewport of [ { width: 1200, reducedMotion: 'no-preference' }, { width: 390, reducedMotion: 'reduce' } ]) {
      const wideFocus = await browser.newPage({ viewport: { width: focusViewport.width, height: 850 }, reducedMotion: focusViewport.reducedMotion });
      await wideFocus.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#ddd"/></svg>' }));
      await wideFocus.setContent(html);
      await wideFocus.evaluate(() => {
        const rootElement = document.querySelector('.wp-block-ai-manga-viewer-viewer');
        const firstPage = rootElement.querySelector('.amv-reader__page');
        rootElement.dataset.amvPanelMobile = 'off';
        firstPage.querySelector('[data-amv-panel-page]').dataset.amvPanelAreas = JSON.stringify([
          { id: 'wide-top', x: 50, y: 16, width: 100, height: 30, zoom: 100, view: 'auto' },
          { id: 'wide-middle', x: 50, y: 50, width: 100, height: 30, zoom: 100, view: 'auto' },
          { id: 'wide-bottom', x: 50, y: 84, width: 100, height: 30, zoom: 100, view: 'auto' },
          { id: 'wide-extreme', x: 50, y: 50, width: 100, height: 20, zoom: 100, view: 'auto' },
          { id: 'wide-offset', x: 40, y: 50, width: 80, height: 30, zoom: 100, view: 'auto' },
          { id: 'square', x: 50, y: 50, width: 45, height: 45, zoom: 100, view: 'auto' },
          { id: 'vertical', x: 50, y: 50, width: 25, height: 65, zoom: 100, view: 'auto' },
          { id: 'page-overview', x: 50, y: 50, width: 95, height: 90, zoom: 100, view: 'auto' }
        ]);
      });
      await wideFocus.addStyleTag({ path: path.join(current, 'style.css') });
      await wideFocus.addStyleTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'style.css') });
      await wideFocus.addScriptTag({ path: path.join(current, 'layout.js') });
      await wideFocus.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
      await wideFocus.addScriptTag({ path: path.join(current, 'view.js') });
      await wideFocus.addScriptTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'frontend.js') });
      await wideFocus.locator('.amv-reader__focus-open').click();
      const wideModal = wideFocus.locator('.amv-modal:not([hidden])');
      const wideImage = wideModal.locator('.amv-modal__image');
      const readFocus = () => wideModal.evaluate(modalElement => {
        const stageElement = modalElement.querySelector('.amv-modal__stage');
        const imageElement = modalElement.querySelector('.amv-modal__image');
        return {
          stageWidth: stageElement.getBoundingClientRect().width,
          imageWidth: parseFloat(imageElement.style.width),
          left: parseFloat(imageElement.style.left),
          top: parseFloat(imageElement.style.top),
          wide: modalElement.classList.contains('is-wide-focus'),
          transition: getComputedStyle(imageElement).transitionDuration
        };
      });
      await wideFocus.waitForFunction(() => parseFloat(document.querySelector('.amv-modal__image').style.width) > 0);
      const topFocus = await readFocus();
      assert.equal(topFocus.wide, true, 'A full-width shallow panel must remain a focus panel');
      assert.ok(topFocus.imageWidth > topFocus.stageWidth * .87, 'A horizontal panel must receive a modest smart zoom');
      assert.ok(topFocus.transition.split(',').every(value => value.trim() === (focusViewport.reducedMotion === 'reduce' ? '0s' : '0.4s')), 'Wide focus transition must use 400ms or be disabled by reduced motion');
      await wideModal.locator('.amv-modal__next').click();
      const middleFocus = await readFocus();
      await wideModal.locator('.amv-modal__next').click();
      const bottomFocus = await readFocus();
      assert.ok(topFocus.top > middleFocus.top && middleFocus.top > bottomFocus.top, 'Top, middle and bottom horizontal panels must move to distinct vertical positions');
      await wideModal.locator('.amv-modal__next').click();
      const extremeFocus = await readFocus();
      assert.ok(extremeFocus.imageWidth <= extremeFocus.stageWidth * 1.16, 'Extreme horizontal panels must stay within the 125% smart zoom cap');
      await wideModal.locator('.amv-modal__next').click();
      const offsetFocus = await readFocus();
      assert.ok(Math.abs(offsetFocus.left + offsetFocus.imageWidth * .4 - offsetFocus.stageWidth / 2) < 1, 'Smart zoom must center the registered panel rather than the page');
      await wideModal.locator('.amv-modal__next').click();
      assert.equal((await readFocus()).wide, false, 'Square panels must retain the normal focus behavior');
      await wideModal.locator('.amv-modal__next').click();
      assert.equal((await readFocus()).wide, false, 'Vertical panels must retain the normal focus behavior');
      await wideModal.locator('.amv-modal__next').click();
      assert.equal((await readFocus()).wide, false, 'A panel near the full page size must use overview behavior');
      assert.equal(await wideModal.locator('.amv-modal__overview').textContent(), 'コマへ戻る');
      await wideModal.locator('.amv-modal__close').click();
      await wideFocus.close();
    }
    console.log('PASS: editor registration/schema, desktop/mobile coexistence, navigation, modal sequences, first/current start options, focus trap/return; no page errors');
    console.log('PASS: RTL/LTR page and panel keys/swipes/edge buttons/turn effects; vertical, multi-touch and cancelled gestures ignored');
    console.log('PASS: Manga Library two-column cards, contained 4:3 covers, responsive stacking, edit/analytics links and shortcode copy');
    console.log('PASS: Manga Library-only analytics events, compact selector, responsive two-column report, and persistent daily-bar details');
    console.log('PASS: Viewer impressions require 50% visibility for one second, remain distinct from reading, and are de-duplicated');
    console.log('PASS: provider-neutral AI consultation Markdown copy feedback');
    console.log('PASS: desktop side zoom controls remain clickable outside the manga; hidden at tablet width; zoom navigation resets and advances');
    console.log('PASS: smart horizontal-panel focus zoom, vertical positioning, 125% cap, centering and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
