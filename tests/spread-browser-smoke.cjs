const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const proRoot = path.resolve(root, '..', 'AI Manga Viewer Pro');
const viewerRoot = path.join(root, 'blocks/viewer');
const html = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--spread-fixture', '--pro-cta-fixture', '--pro-panel-fixture'], { encoding: 'utf8' });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://example.test/**', route => {
      if (route.request().url().endsWith('/wp-json/ai-manga-viewer/v1/events')) return route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
      const wide = route.request().url().includes('wide-2.svg');
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${wide ? 1200 : 600}" height="${wide ? 600 : 900}"><rect width="100%" height="100%" fill="#ddd"/></svg>` });
    });
    await page.setContent(html);
    await page.evaluate(() => {
      window.aiMangaViewerProAnalytics = { enabled: true, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events' };
      window.__spreadEvents = [];
      document.addEventListener('amv:reader-event', event => window.__spreadEvents.push(event.detail));
      let fullscreenElement = null;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
      document.exitFullscreen = () => { if (fullscreenElement && (fullscreenElement.closest('#vertical-fixture') || fullscreenElement.closest('#vertical-current-fixture') || fullscreenElement.closest('#cover-vertical-fixture'))) fullscreenElement.style.height = ''; fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
      HTMLElement.prototype.requestFullscreen = function() { fullscreenElement = this; if (this.closest('#vertical-fixture') || this.closest('#vertical-current-fixture') || this.closest('#cover-vertical-fixture')) this.style.height = '900px'; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    });
    await page.addStyleTag({ path: path.join(viewerRoot, 'style.css') });
    await page.addStyleTag({ path: path.join(proRoot, 'assets', 'cta', 'style.css') });
    await page.addStyleTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'style.css') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'layout.js') });
    await page.addScriptTag({ path: path.join(proRoot, 'assets', 'analytics', 'frontend.js') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'view.js') });
    await page.addScriptTag({ path: path.join(proRoot, 'assets', 'cta', 'frontend.js') });
    await page.addScriptTag({ path: path.join(proRoot, 'assets', 'panel-reader', 'frontend.js') });

    const cover = page.locator('#cover-fixture .amv-reader');
    const coverLauncher = cover.locator('.amv-reader__cover-launcher-button');
    assert.equal(await cover.locator('.amv-reader__stage').evaluate(node => getComputedStyle(node).display), 'none', 'Cover mode must hide the inline reader surface');
    assert.equal(await coverLauncher.isVisible(), true, 'Cover launcher must be the visible entry point');
	await cover.scrollIntoViewIfNeeded();
	await page.waitForTimeout(1100);
	assert.equal((await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'cover-viewer' && event.name === 'viewer_impression'))).length, 1, 'A visible cover must use the existing impression rule');
    assert.equal((await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'cover-viewer' && ['read_start', 'page_reach'].includes(event.name)))).length, 0, 'Showing a cover must not start reading or reach a page');
    await coverLauncher.click();
    await page.waitForFunction(() => document.querySelector('#cover-fixture .amv-reader').classList.contains('is-fullscreen'));
    assert.equal(await cover.locator('.amv-reader__count').textContent(), '1 / 6', 'Cover launch must always start from the first page');
    assert.equal(await cover.locator('.amv-reader__stage').evaluate(node => document.activeElement === node), true, 'Fullscreen entry must move focus into the reader');
    const coverEvents = await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'cover-viewer'));
    assert.equal(coverEvents.filter(event => event.name === 'read_start').length, 1, 'Cover launch must start one reading session');
    assert.deepEqual(coverEvents.filter(event => event.name === 'page_reach').map(event => event.pageNumber), [1], 'Cover launch must initially reach only page one');
    await cover.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => !document.querySelector('#cover-fixture .amv-reader').classList.contains('is-fullscreen'));
    await page.waitForFunction(() => document.activeElement === document.querySelector('#cover-fixture .amv-reader__cover-launcher-button'));
    assert.equal(await cover.locator('.amv-reader__stage').evaluate(node => getComputedStyle(node).display), 'none', 'Exiting fullscreen must restore the cover-only view');
	const coverFocusOpen = cover.locator('.amv-reader__cover-focus-open');
	assert.equal(await coverFocusOpen.isVisible(), true, 'A configured focus reader must be available beside the cover launcher');
	await coverFocusOpen.click();
	assert.equal(await page.locator('body > .amv-modal:not([hidden])').count(), 1, 'The cover focus action must open the existing dedicated viewer');
	await page.locator('body > .amv-modal:not([hidden]) .amv-modal__close').click();
	await page.waitForFunction(() => document.activeElement === document.querySelector('#cover-fixture .amv-reader__cover-focus-open'));

    const coverVertical = page.locator('#cover-vertical-fixture .amv-reader');
    await coverVertical.locator('.amv-reader__cover-launcher-button').click();
    await page.waitForFunction(() => document.querySelector('#cover-vertical-fixture .amv-reader').classList.contains('is-vertical-reading'));
    assert.equal(await coverVertical.locator('.amv-reader__page').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length), 6, 'Cover launch must support vertical fullscreen reading');
    assert.equal(await cover.evaluate(node => node.classList.contains('is-fullscreen')), false, 'Multiple cover launchers must keep independent fullscreen state');
	const verticalSideControls = coverVertical.locator('.amv-reader__zoom-controls--side');
	const rightRail = await verticalSideControls.evaluate(node => { const box = node.getBoundingClientRect(); const button = node.querySelector('button'); const style = getComputedStyle(node); const buttonStyle = getComputedStyle(button); return { position: style.position, direction: style.flexDirection, centerY: box.top + box.height / 2, right: innerWidth - box.right, color: buttonStyle.color, background: buttonStyle.backgroundColor }; });
	assert.equal(rightRail.position, 'fixed', 'Vertical side zoom controls must track the viewport');
	assert.equal(rightRail.direction, 'column', 'Right/left vertical zoom controls must remain a vertical rail');
	assert.ok(Math.abs(rightRail.centerY - 450) < 3 && Math.abs(rightRail.right - 16) < 3, 'Right zoom controls must sit in the outer viewport gutter');
	assert.equal(rightRail.color, 'rgb(31, 41, 55)', 'Vertical zoom button text must remain dark on the light background');
	assert.equal(rightRail.background, 'rgb(255, 255, 255)', 'Vertical zoom buttons must use a readable white background');
	await coverVertical.evaluate(node => { node.scrollTop = 600; });
	await page.waitForTimeout(50);
	assert.ok(Math.abs((await verticalSideControls.boundingBox()).y - (rightRail.centerY - (await verticalSideControls.boundingBox()).height / 2)) < 3, 'Side zoom controls must remain fixed while vertical pages scroll');
	await coverVertical.evaluate(node => { node.dataset.zoomPosition = 'left'; });
	await page.waitForTimeout(20);
	assert.ok(Math.abs((await verticalSideControls.boundingBox()).x - 16) < 3, 'Left zoom controls must move to the outer left gutter');
	await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => !document.querySelector('#cover-vertical-fixture .amv-reader').classList.contains('is-fullscreen'));
	await page.waitForFunction(() => document.activeElement === document.querySelector('#cover-vertical-fixture .amv-reader__cover-launcher-button'));

    const spread = page.locator('#spread-fixture .amv-reader');
    await spread.waitFor();
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader').classList.contains('has-spread-layout'));
    assert.equal(await spread.locator('.amv-reader__count').textContent(), '1 / 6');
    assert.equal(await spread.locator('.amv-reader__page.is-active').count(), 1, 'Cover must stay single');
    const singleWidth = (await spread.locator('.amv-reader__pages').boundingBox()).width;
    const singleStageWidth = (await spread.locator('.amv-reader__stage').boundingBox()).width;
    assert.ok(singleWidth <= 652, 'Single cover must retain the configured maxWidth');
    assert.ok(singleStageWidth <= 652, 'A standalone cover must keep its edge controls beside the single-page surface');

    await spread.locator('.amv-reader__edge--next').click();
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader__count').textContent === '2–3 / 6');
    assert.equal(await spread.locator('.amv-reader__page.is-active').count(), 2);
    const activeIndexes = await spread.locator('.amv-reader__page.is-active').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pageIndex)));
    assert.deepEqual(activeIndexes, [1, 2], 'DOM order must remain logical');
    const boxes = await spread.locator('.amv-reader__page.is-active').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
    assert.ok(boxes[0] > boxes[1], 'RTL must place the logically earlier page on the right');
    const spreadWidth = (await spread.locator('.amv-reader__pages').boundingBox()).width;
    const spreadStageWidth = (await spread.locator('.amv-reader__stage').boundingBox()).width;
    assert.ok(spreadWidth > singleWidth * 1.8 && spreadWidth <= 1314, 'Spread width must grow toward maxWidth x 2 plus the gap');
    assert.ok(spreadStageWidth > singleStageWidth * 1.8, 'The navigation stage must expand only for a two-page surface');

    const ctas = spread.locator('.amv-reader__page.is-active .amv-reader__cta');
    assert.equal(await ctas.count(), 2);
    await ctas.first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Number(document.activeElement.closest('.amv-reader__page').dataset.pageIndex)), 2, 'CTA tab order must follow logical DOM order');

    const events = await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'spread-viewer'));
    assert.equal(events.filter(event => event.name === 'read_start').length, 1);
    assert.equal(events.find(event => event.name === 'read_start').pageNumber, 1, 'read_start must use the primary page');
    assert.deepEqual(events.filter(event => event.name === 'page_reach').map(event => event.pageNumber), [1, 2, 3], 'Both visible spread pages must be reached');

    await spread.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader').classList.contains('is-fullscreen'));
    assert.equal(await spread.locator('.amv-reader__count').textContent(), '1 / 6', 'Default paged fullscreen entry must start from the first page');
    await spread.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => !document.querySelector('#spread-fixture .amv-reader').classList.contains('is-fullscreen'));
    await spread.locator('.amv-reader__edge--next').click();
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader__count').textContent === '2–3 / 6');

    const pageFocus = page.locator('#page-focus-fixture .amv-reader');
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader').classList.contains('has-spread-layout'));
    await pageFocus.locator('.amv-reader__edge--next').click();
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader__count').textContent === '2–3 / 6');
	assert.equal(await pageFocus.evaluate(node => node.classList.contains('is-page-focus')), false, 'Inline reading must keep the full spread visible');
	assert.equal(await pageFocus.locator('.amv-reader__spread-overview').isHidden(), true, 'The page-focus toggle must stay hidden outside fullscreen');
	await pageFocus.locator('.amv-reader__fullscreen').click();
	await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader').classList.contains('is-page-focus'));
	assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '2 / 6', 'Fullscreen pageFocus must begin at the logically first page in the active spread');
	assert.equal(await pageFocus.locator('.amv-reader__spread-overview').isVisible(), true, 'Fullscreen pageFocus must expose the temporary spread overview action');
	await pageFocus.locator('.amv-reader__edge--next').click();
	assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '3 / 6', 'Fullscreen pageFocus must advance one logical page at a time');
	await pageFocus.locator('.amv-reader__spread-overview').click();
	assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '2–3 / 6', 'Temporary overview must reveal the active spread');
	await pageFocus.locator('.amv-reader__spread-overview').click();
	assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '3 / 6', 'Leaving temporary overview must restore the focused page');
	await pageFocus.locator('.amv-reader__fullscreen').click();
		await page.waitForFunction(() => { const root = document.querySelector('#page-focus-fixture .amv-reader'); return !root.classList.contains('is-fullscreen') && !root.classList.contains('is-page-focus'); });
	assert.equal(await pageFocus.evaluate(node => node.classList.contains('is-page-focus')), false, 'Exiting fullscreen must restore inline spread overview');
	assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '2–3 / 6', 'Inline page numbering must return to the active spread range');
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(80);

    await spread.locator('.amv-reader__zoom-in').click();
    assert.match(await spread.locator('.amv-reader__surface').getAttribute('style'), /scale\(1\.25\)/, 'The whole surface must zoom');
    await spread.locator('.amv-reader__zoom-page--next').click();
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader__count').textContent === '4–5 / 6');
    assert.equal(await spread.locator('.amv-reader__zoom-level').textContent(), '100%');
    await spread.locator('.amv-reader__edge--next').click();
    assert.equal(await spread.locator('.amv-reader__count').textContent(), '6 / 6', 'Odd final page must be centered as a single page');
    assert.equal(await spread.locator('.amv-reader__page.is-active').count(), 1);

    const auto = page.locator('#auto-fixture .amv-reader');
    assert.equal(await auto.locator('.amv-reader__count').textContent(), '1–2 / 6', 'singleFirstPage OFF must pair the first two pages');
    await auto.locator('.amv-reader__edge--next').click();
    assert.equal(await auto.locator('.amv-reader__count').textContent(), '3–4 / 6');
    const ltrBoxes = await auto.locator('.amv-reader__page.is-active').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
    assert.ok(ltrBoxes[0] < ltrBoxes[1], 'LTR must place the logically earlier page on the left');
    await page.setViewportSize({ width: 730, height: 900 });
    await page.waitForFunction(() => document.querySelector('#auto-fixture .amv-reader__count').textContent === '3 / 6');
    await page.setViewportSize({ width: 760, height: 900 });
    await page.waitForTimeout(80);
    assert.equal(await auto.locator('.amv-reader__count').textContent(), '3 / 6', 'Auto layout must not re-enter below the upper hysteresis threshold');
    await auto.locator('.amv-reader__fullscreen').click();
    assert.equal(await auto.evaluate(element => element.classList.contains('is-fullscreen')), true);
    await page.setViewportSize({ width: 840, height: 900 });
    await page.waitForFunction(() => document.querySelector('#auto-fixture .amv-reader__count').textContent === '3–4 / 6');
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(80);
    assert.equal(await auto.locator('.amv-reader__count').textContent(), '3–4 / 6', 'Auto layout must remain spread above the lower hysteresis threshold');

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(100);
    const fullscreenGeometry = await auto.evaluate(element => {
      const imageBoxes = Array.from(element.querySelectorAll('.amv-reader__page.is-active .amv-reader__image')).map(node => node.getBoundingClientRect()).sort((a, b) => a.x - b.x);
      const surfaceBox = element.querySelector('.amv-reader__surface').getBoundingClientRect();
      const viewportBox = element.querySelector('.amv-reader__pages').getBoundingClientRect();
      return {
        gap: imageBoxes[1].x - imageBoxes[0].right,
        imagesWidth: imageBoxes[0].width + imageBoxes[1].width,
        surfaceWidth: surfaceBox.width,
        leftInset: surfaceBox.x - viewportBox.x,
        rightInset: viewportBox.right - surfaceBox.right
      };
    });
    assert.ok(Math.abs(fullscreenGeometry.gap - 12) < 1, 'Fullscreen overview must keep only the configured center gap');
    assert.ok(Math.abs(fullscreenGeometry.surfaceWidth - fullscreenGeometry.imagesWidth - 12) < 1, 'Fullscreen surface must shrink to the two rendered page widths plus the gap');
    assert.ok(Math.abs(fullscreenGeometry.leftInset - fullscreenGeometry.rightInset) < 2, 'Fullscreen spread must remain centered');

    const verticalCurrent = page.locator('#vertical-current-fixture .amv-reader');
    const verticalCurrentApiMoved = await verticalCurrent.evaluate(node => window.aiMangaViewer.getInstance(node).goToPage(2));
    assert.equal(verticalCurrentApiMoved, true);
    await verticalCurrent.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => document.querySelector('#vertical-current-fixture .amv-reader').classList.contains('is-vertical-reading'));
    assert.equal(await verticalCurrent.locator('.amv-reader__count').textContent(), '3 / 6', 'Enabled current-page setting must preserve the logical page in vertical fullscreen');
    await verticalCurrent.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => !document.querySelector('#vertical-current-fixture .amv-reader').classList.contains('is-fullscreen'));

    const vertical = page.locator('#vertical-fixture .amv-reader');
    assert.equal(await vertical.evaluate(node => window.aiMangaViewer.getInstance(node).goToPage(2)), true);
    await vertical.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader').classList.contains('is-vertical-reading'));
    assert.equal(await vertical.locator('.amv-reader__count').textContent(), '1 / 6', 'Default vertical fullscreen entry must start from the first page');
    assert.equal(await vertical.locator('.amv-reader__page').count(), 6);
    assert.equal(await vertical.locator('.amv-reader__page').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length), 6, 'Vertical fullscreen must expose every page');
    assert.equal(await vertical.locator('.amv-reader__page[aria-hidden="true"]').count(), 0, 'Vertical pages must remain available to assistive technology');
    assert.equal(await vertical.locator('.amv-reader__page').evaluateAll(nodes => nodes.some(node => node.inert)), false, 'Vertical page CTAs must remain keyboard reachable');
    assert.equal(await vertical.locator('.amv-reader__edge--next').evaluate(node => getComputedStyle(node).display), 'none', 'Paged edge navigation must be hidden');
    assert.equal(await vertical.locator('.amv-reader__zoom-controls').evaluate(node => getComputedStyle(node).display), 'flex', 'Vertical reading must expose width zoom controls');
    const verticalWidth100 = (await vertical.locator('.amv-reader__stage').boundingBox()).width;
    await vertical.locator('.amv-reader__zoom-in').click();
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader__zoom-level').textContent === '125%');
    const verticalWidth125 = (await vertical.locator('.amv-reader__stage').boundingBox()).width;
    assert.ok(verticalWidth125 > verticalWidth100 * 1.2, 'Vertical zoom must widen the reading column instead of transforming the long surface');
    assert.equal(await vertical.locator('.amv-reader__surface').evaluate(node => getComputedStyle(node).transform), 'none', 'Vertical zoom must preserve normal vertical layout');
    await vertical.locator('.amv-reader__zoom-reset').click();
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader__zoom-level').textContent === '100%');
    assert.ok(Math.abs((await vertical.locator('.amv-reader__stage').boundingBox()).width - verticalWidth100) < 2, 'Vertical reset must restore the configured reading width');
    await page.waitForTimeout(100);
    assert.equal((await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'vertical-viewer' && event.name === 'page_reach'))).length, 0, 'Vertical reach must not fire immediately on mode entry');
    await page.waitForTimeout(750);
    assert.deepEqual((await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'vertical-viewer' && event.name === 'page_reach').map(event => event.pageNumber))), [1], 'The first vertical page must be reached after dwell');
    await vertical.evaluate(node => { const page3 = node.querySelector('.amv-reader__page[data-page-index="2"]'); node.scrollTop += page3.getBoundingClientRect().top - node.getBoundingClientRect().top - 16; });
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader__count').textContent === '3 / 6');
    await page.waitForTimeout(750);
    assert.ok((await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'vertical-viewer' && event.name === 'page_reach').map(event => event.pageNumber))).includes(3), 'A settled vertical page must emit page reach');
    await vertical.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => !document.querySelector('#vertical-fixture .amv-reader').classList.contains('is-vertical-reading'));
    assert.equal(await vertical.locator('.amv-reader__count').textContent(), '2–3 / 6', 'Leaving vertical fullscreen must restore the paged view containing the current page');
    await vertical.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader').classList.contains('is-vertical-reading'));
    await vertical.evaluate(node => { const lastPage = node.querySelector('.amv-reader__page[data-page-index="5"]'); node.scrollTop += lastPage.getBoundingClientRect().top - node.getBoundingClientRect().top - 16; });
    await page.waitForFunction(() => document.querySelector('#vertical-fixture .amv-reader__count').textContent === '6 / 6');
    await vertical.locator('.amv-reader__fullscreen').click();
    await page.waitForFunction(() => !document.querySelector('#vertical-fixture .amv-reader').classList.contains('is-vertical-reading'));
    assert.equal(await vertical.locator('.amv-reader__count').textContent(), '1 / 6', 'Leaving vertical fullscreen from the final page must return to the first page');
    const verticalEvents = await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'vertical-viewer'));
    assert.equal(verticalEvents.find(event => event.name === 'read_start').mode, 'vertical');
    assert.equal(verticalEvents.find(event => event.name === 'mode_use').mode, 'vertical');

    const wide = page.locator('#wide-fixture .amv-reader');
    await page.waitForFunction(() => Number(document.querySelector('#wide-fixture .amv-reader__page[data-page-index="1"]').dataset.imageWidth) > 0);
    await wide.locator('.amv-reader__edge--next').click();
    assert.equal(await wide.locator('.amv-reader__count').textContent(), '2 / 6', 'A landscape image must remain a single display surface');
    await wide.locator('.amv-reader__edge--next').click();
    assert.equal(await wide.locator('.amv-reader__count').textContent(), '3–4 / 6');

    const expectedCounts = {
      1: ['1 / 1'],
      2: ['1 / 2', '2 / 2'],
      3: ['1 / 3', '2–3 / 3'],
      4: ['1 / 4', '2–3 / 4', '4 / 4'],
      5: ['1 / 5', '2–3 / 5', '4–5 / 5'],
      10: ['1 / 10', '2–3 / 10', '4–5 / 10', '6–7 / 10', '8–9 / 10', '10 / 10']
    };
    for (const [pageCount, expected] of Object.entries(expectedCounts)) {
      const fixture = page.locator(`#count-fixture-${pageCount} .amv-reader`);
      const actual = [await fixture.locator('.amv-reader__count').textContent()];
      while (!(await fixture.locator('.amv-reader__edge--next').isDisabled())) {
        await fixture.locator('.amv-reader__edge--next').click();
        actual.push(await fixture.locator('.amv-reader__count').textContent());
      }
      assert.deepEqual(actual, expected, `${pageCount}-page grouping must be stable`);
    }

    await page.setViewportSize({ width: 540, height: 900 });
    await page.waitForFunction(() => !document.querySelector('#spread-fixture .amv-reader').classList.contains('has-spread-layout'));
    await page.setViewportSize({ width: 620, height: 900 });
    await page.waitForFunction(() => document.querySelector('#spread-fixture .amv-reader').classList.contains('has-spread-layout'));

    assert.deepEqual(errors, []);
    console.log('PASS: spread overview, fullscreen-only pageFocus, vertical width zoom, accessibility, fullscreen/zoom layering, analytics, auto hysteresis and landscape singles');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
