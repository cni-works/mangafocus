const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'blocks/viewer/block.json')));
assert.deepEqual(metadata.attributes.enableInline, {type: 'boolean'});
let settings;
let states = [], cursor = 0, effects = [], updates = [];
const el = (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity).filter(c => c !== null && c !== false)});
const win = {wp: {}, crypto: {randomUUID: () => 'test-id'}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'blocks/viewer/layout.js'), 'utf8'), {window: win});
const data = {useSelect: fn => fn(name => name === 'core/block-editor' ? {getBlocks: () => []} : {getCurrentPostType: () => 'post', getCurrentPostId: () => 10, getEditedPostAttribute: () => 'Title'})};
win.wp = {blocks: {registerBlockType: (name, value) => {assert.equal(name, 'ai-manga-viewer/viewer'); settings = value;}}, element: {createElement: el, Fragment: 'Fragment', useState: initial => {const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => {states[i] = value;}];}, useRef: value => ({current: value}), useEffect: fn => effects.push(fn)}, blockEditor: {InspectorControls: 'InspectorControls', MediaUpload: 'MediaUpload', MediaUploadCheck: 'MediaUploadCheck', useBlockProps: a => a}, components: new Proxy({}, {get: (_, key) => String(key)}), i18n: {__: s => s}, data, apiFetch: () => Promise.resolve({}), hooks: {applyFilters: (_, value) => value}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'blocks/viewer/index.js'), 'utf8'), {window: win, console});
assert.deepEqual(JSON.parse(JSON.stringify(settings.attributes.enableInline)), {type: 'boolean'});
function find(node, label) {if (!node || typeof node !== 'object') return null; if (node.props.label === label) return node; for (const child of node.children || []) {const found = find(child, label); if (found) return found;} return null;}
const pages = [{id: 0, url: 'https://example.test/one.svg', width: 600, height: 900, pageKey: 'keep-page', focusAreas: [{id: 'keep-area', x: 50, y: 50, width: 80, height: 60}], mobileFocusAreas: [], cta: {enabled: true, ctaKey: 'keep-cta'}}];
const base = {viewerKey: 'keep-viewer', instanceKey: 'keep-instance', pages, pageLayout: 'single', binding: 'rtl', inlineDisplayMode: 'reader', enableFullscreen: false, focusReader: false};
function render(a, reset = true) {if (reset) states = []; cursor = 0; effects = []; const tree = settings.edit({attributes: a, setAttributes: value => updates.push(value), clientId: 'client'}); return tree;}
for (const display of ['reader', 'coverLauncher']) for (const full of [false, true]) for (const panel of [false, true]) {
 const a = {...base, inlineDisplayMode: display, enableFullscreen: full, focusReader: panel}; updates = [];
 const tree = render(a); effects.forEach(fn => fn());
 assert.equal(updates.length, 0, 'Opening complete legacy data must not save anything');
 assert.equal(find(tree, 'Enable inline viewer').props.checked, display === 'reader');
 assert.equal(find(tree, 'Enable fullscreen mode').props.checked, full || display === 'coverLauncher');
 assert.equal(find(tree, 'Enable panel reading mode').props.checked, panel);
 assert.equal(JSON.stringify(tree).includes('Display method'), false, 'Legacy selector must not conflict');
 find(tree, 'Maximum comic width (px)').props.onChange(700);
 assert.deepEqual(JSON.parse(JSON.stringify(updates)), [{maxWidth: 700}]);
 assert.equal('enableInline' in a, false);
}
for (const inline of [false, true]) for (const full of [false, true]) for (const panel of [false, true]) {
 if (!inline && !full && !panel) continue;
 updates = []; const a = {...base, enableInline: inline, enableFullscreen: full, focusReader: panel, inlineDisplayMode: 'coverLauncher'};
 const tree = render(a);
 for (const [label, value] of [['Enable inline viewer', inline], ['Enable fullscreen mode', full], ['Enable panel reading mode', panel]]) assert.equal(find(tree, label).props.checked, value);
}
let a = {...base, inlineDisplayMode: 'coverLauncher', enableFullscreen: false}; updates = [];
let tree = render(a);
find(tree, 'Enable inline viewer').props.onChange(true);
assert.deepEqual(JSON.parse(JSON.stringify(updates[0])), {enableInline: true, enableFullscreen: true, focusReader: false});
assert.strictEqual(a.pages, pages); assert.equal(a.pages[0].cta.ctaKey, 'keep-cta');
updates = []; a = {...base, enableInline: true};
tree = render(a); find(tree, 'Enable inline viewer').props.onChange(false);
assert.equal(updates.length, 0); tree = render(a, false);
assert.ok(JSON.stringify(tree).includes('Keep at least one reading mode enabled.'));
updates = []; a = {...base, enableInline: true, focusReader: true, pages: [{...pages[0], focusAreas: []}]};
tree = render(a); find(tree, 'Enable inline viewer').props.onChange(false);
assert.equal(updates.length, 0); tree = render(a, false);
assert.ok(JSON.stringify(tree).includes('Add at least one panel'));
updates = []; a = {...base, enableInline: true, focusReader: true};
tree = render(a); find(tree, 'Enable inline viewer').props.onChange(false);
assert.equal(updates[0].enableInline, false); assert.strictEqual(a.pages, pages);
const serialized = JSON.stringify({...a, ...updates[0]});
assert.equal(JSON.parse(serialized).enableInline, false, 'Explicit false survives JSON comment attributes');
assert.equal(JSON.stringify({...base, maxWidth: 700}).includes('enableInline'), false, 'Unrelated legacy save retains absence');
console.log('PASS: editor legacy/non-mode saves, seven switches, blocked all-OFF and missing panels, immutable pages/CTA and optional boolean');
