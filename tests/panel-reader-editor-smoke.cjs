const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const filters = {};
const updates = [];
const attributeUpdates = [];
const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(value => value !== null && value !== false) });
const wp = {
  element: { createElement, Fragment: 'Fragment', useRef: value => ({ current: value }), useState: initial => [initial, () => {}], useEffect: effect => { effect(); } },
  i18n: { __: text => text },
  components: new Proxy({}, { get: (_, name) => String(name) }),
  hooks: { addFilter: (hook, namespace, callback) => { filters[hook] = callback; } }
};
const source = fs.readFileSync(path.join(root, 'assets/panel-reader/editor.js'), 'utf8');
assert.ok(source.includes('if ( ! editorAllowed ) return;'), 'Panel editor capability and deactivation guard is missing');
vm.runInNewContext(source, { window: { wp } });
assert.deepEqual(filters, {}, 'Missing capability map must not register panel editing UI');
vm.runInNewContext(source, { window: { wp, aiMangaViewerCapabilities: { panel_reader: { editor: true } } } });
assert.equal(typeof filters['aiMangaViewer.editor.inspectorPanels'], 'function');
assert.equal(typeof filters['aiMangaViewer.editor.stageOverlays'], 'function');

const page = { pageKey: 'page-1', focusAreas: [], mobileFocusAreas: [] };
const context = { clientId: 'client-panel', currentPageIndex: 0, currentPage: page, attributes: { focusReader: false, focusReaderStartAtCurrent: false, mobileFocusReader: false, pages: [page] }, setAttributes: value => attributeUpdates.push(value), updateCurrentPage: value => { updates.push(value); Object.assign(page, value); } };
function find(node, predicate) { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node; for (const child of node.children || []) { const match = find(child, predicate); if (match) return match; } return null; }
let inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
let inspector = inspectorElement.type(inspectorElement.props);
const enable = find(inspector, node => node.props && node.props.label === 'コマ読みを有効化');
enable.props.onChange(true);
assert.strictEqual(JSON.stringify(attributeUpdates[0]), JSON.stringify({ focusReader: true }));
context.attributes.focusReader = true;
inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
inspector = inspectorElement.type(inspectorElement.props);
for (const label of ['コマ読み', 'スマホ用のコマ設定を個別指定', '現在のページにコマを追加', '専用ビューアーの開始位置', '現在のページから開始']) assert.ok(JSON.stringify(inspector).includes(label), `Missing panel editor control: ${label}`);
find(inspector, node => node.type === 'Button' && (node.children || []).includes('現在のページにコマを追加')).props.onClick();
const stageElement = filters['aiMangaViewer.editor.stageOverlays']([], context)[0];
const stage = stageElement.type(stageElement.props);
assert.match(stage.props.className, /is-drawing/);
const layer = { classList: { contains: value => value === 'amv-panel-editor-layer' }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }), setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true };
const event = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, currentTarget: layer, preventDefault() {}, stopPropagation() {}, nativeEvent: { stopImmediatePropagation() {} } });
stage.props.onPointerDown(event(20, 10));
stage.props.onPointerMove(event(180, 70));
stage.props.onPointerUp(event(180, 70));
assert.equal(updates.at(-1).focusAreas.length, 1);
assert.equal(updates.at(-1).focusAreas[0].view, 'auto');


// Selection, stage drag, resize, list order, and deletion are available in Core.
inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
inspector = inspectorElement.type(inspectorElement.props);
find(inspector, node => node.type === 'Button' && (node.children || []).includes('1. コマ')).props.onClick();
let selectedStage = filters['aiMangaViewer.editor.stageOverlays']([], context)[0].type(stageElement.props);
let selectedBox = find(selectedStage, node => node.props && /amv-reader__focus-area/.test(node.props.className || '') && /is-selected/.test(node.props.className || ''));
const areaTarget = { classList: { contains: () => false }, closest: () => layer, setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true };
const areaEvent = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, currentTarget: areaTarget, preventDefault() {}, stopPropagation() {}, nativeEvent: { stopImmediatePropagation() {} } });
const beforeMoveX = page.focusAreas[0].x;
selectedBox.props.onPointerDown(areaEvent(100, 40));
selectedStage.props.onPointerMove(event(120, 50));
selectedStage.props.onPointerUp(event(120, 50));
assert.ok(page.focusAreas[0].x > beforeMoveX, 'Selected area should move on stage drag');

selectedStage = filters['aiMangaViewer.editor.stageOverlays']([], context)[0].type(stageElement.props);
selectedBox = find(selectedStage, node => node.props && /amv-reader__focus-area/.test(node.props.className || '') && /is-selected/.test(node.props.className || ''));
const resize = find(selectedBox, node => node.props && node.props.className === 'amv-reader__focus-resize');
const beforeResize = page.focusAreas[0].width;
resize.props.onPointerDown(areaEvent(180, 70));
selectedStage.props.onPointerMove(event(190, 75));
selectedStage.props.onPointerUp(event(190, 75));
assert.ok(page.focusAreas[0].width > beforeResize, 'Selected area should resize from its handle');

page.focusAreas = [page.focusAreas[0], { id: 'focus-second', x: 50, y: 80, width: 80, height: 20, view: 'auto', zoom: 100 }];
inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
inspector = inspectorElement.type(inspectorElement.props);
find(inspector, node => node.type === 'Button' && node.props.label === '次へ' && !node.props.disabled).props.onClick();
assert.equal(page.focusAreas[0].id, 'focus-second', 'Panel order should be editable');
inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
inspector = inspectorElement.type(inspectorElement.props);
find(inspector, node => node.type === 'Button' && (node.children || []).includes('1. コマ')).props.onClick();
inspectorElement = filters['aiMangaViewer.editor.inspectorPanels']([], context)[0];
inspector = inspectorElement.type(inspectorElement.props);
find(inspector, node => node.type === 'Button' && node.props.label === '削除').props.onClick();
assert.equal(page.focusAreas.length, 1, 'Selected panel should be deleted');

const coreEditor = fs.readFileSync(path.join(root, 'blocks/viewer/index.js'), 'utf8');
assert.match(coreEditor, /focusAreas: areasOf\( previous \), mobileFocusAreas: areasOf\( previous, true \)/);
console.log('PASS: Core panel reader Inspector/stage filters, enablement, area creation, editing, ordering and deletion verified.');
