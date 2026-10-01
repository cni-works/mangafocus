const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const viewerRoot = path.join(root, 'blocks/viewer');
const viewerSource = fs.readFileSync(path.join(viewerRoot, 'index.js'), 'utf8');
const metadata = JSON.parse(fs.readFileSync(path.join(viewerRoot, 'block.json'), 'utf8'));
const layoutWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(viewerRoot, 'layout.js'), 'utf8'), { window: layoutWindow });

const registered = {};
const applied = [];
const hookApi = {
  applyFilters(name, value, context) {
    applied.push({ name, context });
    return value.concat([{ extensionHook: name }]);
  }
};
const createElement = (...args) => ({ args });
const element = {
  createElement,
  Fragment: 'fragment',
  useState: initial => [initial, () => {}],
  useEffect: () => {},
  useRef: initial => ({ current: initial })
};
const blockEditor = { InspectorControls: 'InspectorControls', MediaUpload: 'MediaUpload', MediaUploadCheck: 'MediaUploadCheck', useBlockProps: value => value };
const components = new Proxy({}, { get: (_, key) => String(key) });
const data = {
  useSelect(callback) {
    return callback(store => store === 'core/block-editor' ? { getBlocks: () => [] } : { getCurrentPostType: () => 'post', getCurrentPostId: () => 10, getEditedPostAttribute: () => 'Test' });
  },
  dispatch: () => ({ replaceBlock: () => {} })
};
const wp = { blocks: { registerBlockType: (name, settings) => { registered[name] = settings; } }, element, blockEditor, components, i18n: { __: text => text }, data, apiFetch: () => Promise.resolve({}), hooks: hookApi };
vm.runInNewContext(viewerSource, { window: { wp, aiMangaViewerLayout: layoutWindow.aiMangaViewerLayout, crypto: { randomUUID: () => 'test-key' } }, console });
const defaultAttributes = Object.fromEntries(Object.entries(metadata.attributes).map(([name, definition]) => [name, definition.default]));
defaultAttributes.pages = [{
  id: 1,
  url: 'https://example.test/editor-page.svg',
  alt: 'Editor page',
  thumbnailUrl: 'https://example.test/editor-page.svg',
  width: 600,
  height: 900,
  pageKey: 'editor-page-1',
  focusAreas: [],
  mobileFocusAreas: []
}];
const extendedEditor = registered['ai-manga-viewer/viewer'].edit({ attributes: defaultAttributes, setAttributes: () => {}, clientId: 'client-1' });
assert.deepEqual(applied.map(item => item.name), [
  'aiMangaViewer.editor.inspectorPanels',
  'aiMangaViewer.editor.stageOverlays',
  'aiMangaViewer.editor.auxiliary'
]);
for (const item of applied) {
  assert.equal(item.context.apiVersion, 1);
  assert.equal(item.context.clientId, 'client-1');
  assert.equal(typeof item.context.setAttributes, 'function');
  assert.equal(typeof item.context.updateCurrentPage, 'function');
}
const extendedEditorJson = JSON.stringify(extendedEditor);
for (const name of applied.map(item => item.name)) assert.ok(extendedEditorJson.includes(name), `Missing dummy editor extension: ${name}`);

hookApi.applyFilters = (name, value) => value;
const unextendedEditor = registered['ai-manga-viewer/viewer'].edit({ attributes: defaultAttributes, setAttributes: () => {}, clientId: 'client-2' });
assert.ok(unextendedEditor, 'Editor must render without registered extensions');
assert.equal(JSON.stringify(unextendedEditor).includes('extensionHook'), false, 'Unregistered extensions must not add editor UI');

const html = execFileSync('php', [path.join(__dirname, 'render-smoke.php'), '--spread-fixture'], { encoding: 'utf8' });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="100%" height="100%" fill="#ddd"/></svg>' }));
    await page.setContent(html);
    await page.evaluate(() => {
      window.__extensionEvents = [];
      ['amv:viewer-ready', 'amv:viewer-viewchange', 'amv:viewer-fullscreenchange', 'amv:viewer-modechange', 'amv:viewer-interaction'].forEach(name => document.addEventListener(name, event => window.__extensionEvents.push({ name, detail: event.detail })));
      let fullscreenElement = null;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
      document.exitFullscreen = () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
      HTMLElement.prototype.requestFullscreen = function() { fullscreenElement = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    });
    await page.addStyleTag({ path: path.join(viewerRoot, 'style.css') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'layout.js') });
    await page.addScriptTag({ path: path.join(viewerRoot, 'view.js') });

    const result = await page.evaluate(async () => {
      const spreadRoot = document.querySelector('#spread-fixture .amv-reader');
      const autoRoot = document.querySelector('#auto-fixture .amv-reader');
      const spread = window.aiMangaViewer.getInstance(spreadRoot);
      const sameSpread = window.aiMangaViewer.getInstance('spread-instance');
      const auto = window.aiMangaViewer.getInstance('auto-instance');
      const fixtureInstances = ['page-focus-instance', 'vertical-instance', 'vertical-current-instance', 'cover-instance'].map(key => !!window.aiMangaViewer.getInstance(key));
      const initial = spread.getState();
      const invalid = spread.goToPage(99);
      const moved = spread.goToPage(2);
      const extensionModeSet = spread.setExtensionMode('panel', 'test-extension');
      const extensionMode = spread.getState().readingMode;
      const invalidExtensionMode = spread.setExtensionMode('Panel Reader', 'test-extension');
      const extensionModeCleared = spread.setExtensionMode('', 'test-extension');
      spreadRoot.querySelector('.amv-reader__stage').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const opened = spread.openFullscreen();
      await new Promise(resolve => setTimeout(resolve, 20));
      const fullscreen = spread.isFullscreen();
      const closed = spread.closeFullscreen();
      await new Promise(resolve => setTimeout(resolve, 20));
      autoRoot.remove();
      return {
        version: window.aiMangaViewer.extensionApiVersion,
        sameSpread: spread === sameSpread,
        separate: spread !== auto,
        fixtureInstances,
        removedInstance: window.aiMangaViewer.getInstance('auto-instance'),
        missing: window.aiMangaViewer.getInstance('missing-instance'),
        initial,
        current: spread.getCurrentPage(),
        visible: spread.getVisiblePages(),
        invalid,
        moved,
        extensionModeSet,
        extensionMode,
        invalidExtensionMode,
        extensionModeCleared,
        opened,
        fullscreen,
        closed,
        finalFullscreen: spread.isFullscreen(),
        rootMatches: spread.getRootElement() === spreadRoot,
        identity: spread.getIdentity(),
        events: window.__extensionEvents
      };
    });
    assert.equal(result.version, 1);
    assert.equal(result.sameSpread, true);
    assert.equal(result.separate, true);
    assert.deepEqual(result.fixtureInstances, [true, true, true, true]);
    assert.equal(result.removedInstance, null);
    assert.equal(result.missing, null);
    assert.equal(result.invalid, false);
    assert.equal(result.moved, true);
    assert.equal(result.extensionModeSet, true);
    assert.equal(result.extensionMode, 'panel');
    assert.equal(result.invalidExtensionMode, false);
    assert.equal(result.extensionModeCleared, true);
    assert.equal(result.current.index, 0, 'Default fullscreen entry must reset to the first page');
    assert.equal(result.rootMatches, true);
    assert.deepEqual(result.identity, { viewerKey: 'spread-viewer', instanceKey: 'spread-instance' });
    assert.equal(result.opened, true);
    assert.equal(result.fullscreen, true);
    assert.equal(result.closed, true);
    assert.equal(result.finalFullscreen, false);
    const names = result.events.map(event => event.name);
    for (const expected of ['amv:viewer-ready', 'amv:viewer-viewchange', 'amv:viewer-fullscreenchange', 'amv:viewer-modechange', 'amv:viewer-interaction']) assert.ok(names.includes(expected), `Missing ${expected}`);
    for (const event of result.events) {
      assert.equal(event.detail.apiVersion, 1);
      assert.ok(event.detail.identity.instanceKey);
      assert.equal(Object.prototype.hasOwnProperty.call(event.detail, 'sessionId'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(event.detail, 'visitorId'), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: editor extension hooks, isolated Viewer public APIs and generic frontend events');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
