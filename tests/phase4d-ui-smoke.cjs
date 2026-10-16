/** Phase4D public store/component doubles; actual Gutenberg remains an integration test. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,names,switches}=require('./inspector-groups-smoke.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
for(const locale of ['en','ja']) {
 const h=harness(locale,true,true),t=s=>h.translate(s,'mangafocus');let tree=h.render();h.runEffects();assert.deepEqual(h.updates,[]);assert.deepEqual(h.postEdits,[]);
 const core=h.panels(tree).slice(1,6);assert.deepEqual(core.map(p=>p.props.title),names.map(t));
 for(let i=0;i<3;i++) {
  const panel=core[i+1];assert.equal(panel.children[0].props.label,t(switches[i]));
  assert.equal(panel.props.initialOpen,true);
  for(let j=0;j<3;j++)assert.equal(!!h.findLabel(panel,switches[j]),i===j,'No duplicate or displaced mode switches');
 }
 for(const mask of [1,2,3,4,5,6,7]) {
  h.reset({...h.fields,enableInline:!!(mask&1),enableFullscreen:!!(mask&2),focusReader:!!(mask&4)});
  tree=h.render();h.runEffects();assert.deepEqual(h.updates,[]);assert.deepEqual(h.attrs.pages,h.fields.pages);
  for(const [label,bit] of switches.map((v,i)=>[v,1<<i]))assert.equal(h.findLabel(tree,label).props.checked,!!(mask&bit));
  for(const [title,bit,detail,label] of [['Inline viewer',1,'Automatically adjust scroll position',switches[0]],['Fullscreen mode',2,'Fullscreen reading mode',switches[1]],['Panel reading mode',4,'Configure mobile panels separately',switches[2]]]) {
   const panel=h.find(tree,n=>n.type==='PanelBody'&&n.props.title===t(title));assert.ok(panel,'OFF keeps its panel and switch');
   assert.ok(h.findLabel(panel,label));assert.equal(!!h.findLabel(panel,detail),!!(mask&bit),'Only details follow OFF/ON');
  }
 }
 for(const oldMode of ['reader','coverLauncher']) {
  const old={...h.fields,inlineDisplayMode:oldMode};delete old.enableInline;h.reset(old);tree=h.render();h.runEffects();assert.deepEqual(h.attrs,old);assert.deepEqual(h.updates,[]);
  h.findLabel(tree,'Show page numbers').props.onChange(true);assert.equal('enableInline' in h.attrs,false);assert.deepEqual(h.attrs.pages,old.pages);
 }
 h.reset(h.fields);tree=h.render();
 const scroll=h.findLabel(tree,'Automatically adjust scroll position');assert.equal(scroll.props.help,t('After document scrolling stops, adjust the comic position in the viewport. This is not automatic alignment on page turns.'));
 const arrows=h.findLabel(tree,'Show navigation arrows on every page');assert.ok(arrows.props.help.includes(t('Arrows require page-edge navigation to be enabled.')));assert.ok(arrows.props.help.includes(t('Off: first page only. On: every page.')));
 // Losing the custom UI AFTER successful use must leave the native fallback untouched.
 h.setCoverSaved(23);const saved=clone(h.standardCoverPreview());
 for(const transition of [()=>h.setSelected(false),()=>h.setCoverAccess(false),()=>h.setCoverPermission(false),()=>h.setCoverBroken(true),()=>h.setCoverPicker(false),()=>h.setCoverEditApi(false),()=>h.setPostType('post'),()=>h.setPostType('page')]) {
  transition();h.render();h.runEffects();assert.deepEqual(h.nativePanelCalls,[]);assert.deepEqual(h.standardCoverPreview(),saved);assert.deepEqual(h.postEdits,[]);
  h.setSelected(true);h.setCoverAccess(true);h.setCoverPermission(true);h.setCoverBroken(false);h.setCoverPicker(true);h.setCoverEditApi(true);h.setPostType('amv_viewer');
 }
 tree=h.render();assert.ok(JSON.stringify(tree).includes('cover-23.svg'));
 console.log('PASS Phase4D '+locale+': per-mode switches/details x7, legacy/non-mode preservation, accurate help, late-unavailable native fallback, no cover/data writes.');
}
// Keep native classic UI and PHP storage unchanged; checked separately by the before/after hash gate.
