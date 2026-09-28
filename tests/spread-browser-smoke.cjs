const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const viewerRoot = path.join(root, 'blocks/viewer');
const html = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--spread-fixture'], { encoding: 'utf8' });

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
      window.aiMangaViewerAnalytics = { enabled: true, restUrl: 'https://example.test/wp-json/ai-manga-viewer/v1/events' };
      window.__spreadEvents = [];
      document.addEventListener('amv:reader-event', event => window.__spreadEvents.push(event.detail));
      let fullscreenElement = null;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
      document.exitFullscreen = () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
      HTMLElement.prototype.requestFullscreen = function() { fullscreenElement = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    });
    await page.addStyleTag({ path: path.join(viewerRoot, 'style.css') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'layout.js') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'view.js') });

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

    const events = await page.evaluate(() => window.__spreadEvents);
    assert.equal(events.filter(event => event.name === 'read_start').length, 1);
    assert.equal(events.find(event => event.name === 'read_start').pageNumber, 1, 'read_start must use the primary page');
    assert.deepEqual(events.filter(event => event.name === 'page_reach').map(event => event.pageNumber), [1, 2, 3], 'Both visible spread pages must be reached');

    const pageFocus = page.locator('#page-focus-fixture .amv-reader');
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader').classList.contains('has-spread-layout'));
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '1 / 6', 'pageFocus must begin with the standalone cover');
    await pageFocus.locator('.amv-reader__edge--next').click();
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader__count').textContent === '2 / 6');
    assert.equal(await pageFocus.locator('.amv-reader__page.is-active').count(), 2, 'pageFocus must preserve the two-page surface');
    assert.equal(await pageFocus.locator('.amv-reader__page.is-focused-page').getAttribute('data-page-index'), '1');
    assert.equal(await pageFocus.locator('.amv-reader__page[data-page-index="2"]').getAttribute('aria-hidden'), 'true', 'Inactive spread page must be hidden from assistive technology');
    assert.equal(await pageFocus.locator('.amv-reader__page[data-page-index="2"]').evaluate(node => node.inert), true, 'Inactive spread page controls must be inert');
    assert.match(await pageFocus.locator('.amv-reader__focus-layer').getAttribute('style'), /scale\(/, 'pageFocus fit must use the outer focus layer');
    const focusedGeometry = await pageFocus.evaluate(element => ({
      page: element.querySelector('.amv-reader__page.is-focused-page').getBoundingClientRect().width,
      pageHeight: element.querySelector('.amv-reader__page.is-focused-page').getBoundingClientRect().height,
      viewport: element.querySelector('.amv-reader__pages').getBoundingClientRect().width,
      viewportHeight: window.innerHeight
    }));
    assert.ok(focusedGeometry.page <= focusedGeometry.viewport + 1, 'Focused page must not exceed the viewer width');
    assert.ok(focusedGeometry.pageHeight <= focusedGeometry.viewportHeight - 127, 'Normal pageFocus must keep the page and controls within the viewport height');

    await pageFocus.locator('.amv-reader__spread-overview').click();
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '2–3 / 6', 'Temporary overview must expose the full spread range');
    assert.equal(await pageFocus.locator('.amv-reader__page[data-page-index="2"]').getAttribute('aria-hidden'), 'false');
    assert.equal(await pageFocus.locator('.amv-reader__page[data-page-index="2"]').evaluate(node => node.inert), false);
    await pageFocus.locator('.amv-reader__spread-overview').click();
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '2 / 6');

    const focusTransformPage2 = await pageFocus.locator('.amv-reader__focus-layer').evaluate(node => getComputedStyle(node).transform);
    await pageFocus.locator('.amv-reader__stage').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader__count').textContent === '3 / 6');
    await page.waitForTimeout(30);
    const focusTransformPage3 = await pageFocus.locator('.amv-reader__focus-layer').evaluate(node => getComputedStyle(node).transform);
    assert.notEqual(focusTransformPage3, focusTransformPage2, 'RTL logical navigation must move focus across the same spread');
    assert.equal(await pageFocus.locator('.amv-reader__page.is-focused-page').getAttribute('data-page-index'), '2');

    await pageFocus.locator('.amv-reader__zoom-in').click();
    assert.match(await pageFocus.locator('.amv-reader__surface').getAttribute('style'), /scale\(1\.25\)/, 'Manual zoom must remain on the inner surface');
    assert.equal(await pageFocus.locator('.amv-reader__focus-layer').evaluate(node => getComputedStyle(node).transform), focusTransformPage3, 'Manual zoom must not replace the pageFocus fit transform');
    await pageFocus.locator('.amv-reader__zoom-page--next').click();
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader__count').textContent === '4 / 6');
    assert.equal(await pageFocus.locator('.amv-reader__zoom-level').textContent(), '100%', 'Logical page movement must reset only manual zoom');
    assert.equal(await pageFocus.evaluate(node => node.classList.contains('is-page-focus')), true);

    const pageFocusFullscreen = pageFocus.locator('.amv-reader__fullscreen');
    await pageFocusFullscreen.scrollIntoViewIfNeeded();
    const fullscreenReturnTop = await pageFocus.evaluate(node => node.getBoundingClientRect().top);
    await pageFocusFullscreen.click();
    await page.waitForTimeout(50);
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '4 / 6', 'Fullscreen must preserve the focused logical page');
    await page.evaluate(() => { window.scrollTo(0, Math.min(document.documentElement.scrollHeight - innerHeight, scrollY + 420)); document.exitFullscreen(); });
    await page.waitForTimeout(100);
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '4 / 6', 'Leaving fullscreen must preserve the focused logical page');
    const restoredTop = await pageFocus.evaluate(node => node.getBoundingClientRect().top);
    assert.ok(Math.abs(restoredTop - fullscreenReturnTop) < 2, 'Leaving fullscreen must restore the Viewer to its previous viewport position');

    await pageFocus.locator('.amv-reader__focus-open').click();
    const focusModal = page.locator('body > .amv-modal:not([hidden])');
    await focusModal.waitFor();
    assert.equal(await focusModal.locator('.amv-modal__count').textContent(), '4 / 6', 'Dedicated Viewer must start from the focused logical page');
    await focusModal.locator('.amv-modal__next').click();
    await focusModal.locator('.amv-modal__close').click();
    assert.equal(await pageFocus.locator('.amv-reader__count').textContent(), '5 / 6', 'Returning from the Dedicated Viewer must keep its logical page in pageFocus');

    await pageFocus.locator('.amv-reader__focus-open').click();
    await focusModal.waitFor();
    assert.equal(await focusModal.locator('.amv-modal__count').textContent(), '5 / 6');
    await focusModal.locator('.amv-modal__next').click();
    await focusModal.locator('.amv-modal__next').click();
    await page.waitForFunction(() => document.querySelector('#page-focus-fixture .amv-reader__count').textContent === '1 / 6');
    assert.equal(await focusModal.isHidden(), true, 'Completing the Dedicated Viewer must close it');

    const focusEvents = await page.evaluate(() => window.__spreadEvents.filter(event => event.viewerKey === 'page-focus-viewer'));
    assert.equal(focusEvents.find(event => event.name === 'read_start').pageNumber, 1, 'pageFocus read_start must use the logical focused page');
    assert.deepEqual(focusEvents.filter(event => event.name === 'page_reach').map(event => event.pageNumber), [1, 2, 3, 4, 5, 6], 'pageFocus must reach one focused page at a time, while temporary overview and Dedicated Viewer add their shown pages');

    const pageFocusAuto = page.locator('#page-focus-auto-fixture .amv-reader');
    await page.waitForFunction(() => document.querySelector('#page-focus-auto-fixture .amv-reader').classList.contains('has-spread-layout'));
    await pageFocusAuto.locator('.amv-reader__edge--next').click();
    await pageFocusAuto.locator('.amv-reader__edge--next').click();
    assert.equal(await pageFocusAuto.locator('.amv-reader__count').textContent(), '3 / 6');
    await page.setViewportSize({ width: 730, height: 900 });
    await page.waitForFunction(() => document.querySelector('#page-focus-auto-fixture .amv-reader__count').textContent === '3 / 6' && !document.querySelector('#page-focus-auto-fixture .amv-reader').classList.contains('has-spread-layout'));
    await page.setViewportSize({ width: 840, height: 900 });
    await page.waitForFunction(() => document.querySelector('#page-focus-auto-fixture .amv-reader').classList.contains('has-spread-layout'));
    assert.equal(await pageFocusAuto.locator('.amv-reader__count').textContent(), '3 / 6', 'Auto layout transitions must preserve the focused logical page');
    assert.equal(await pageFocusAuto.locator('.amv-reader__page.is-focused-page').getAttribute('data-page-index'), '2');

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
    console.log('PASS: spread overview/pageFocus navigation, temporary overview, accessibility, fullscreen/zoom layering, analytics, auto hysteresis and landscape singles');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
