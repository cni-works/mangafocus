/** Actual block Edit rendered with public store/component doubles, not WordPress integration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness:editorHarness}=require('./inspector-groups-smoke.cjs');
const root=path.resolve(__dirname,'..');
function harness(locale='en') {
 const h=editorHarness(locale,false,true), t=s=>h.translate(s,'mangafocus');
 const coverPanel=tree=>h.find(tree,n=>n.type==='PanelBody'&&n.props.title===t('Cover image'));
 return {t,coverPanel,render:h.render,find:h.find,runEffects:h.runEffects,panels:h.panels,fields:h.fields,reset:h.reset,findLabel:h.findLabel,
 select(tree,id){const panel=coverPanel(tree);assert.ok(panel);h.find(panel,n=>n.type==='MediaUpload').props.onSelect({id,type:'image'});},
 save:h.saveCover,reload:h.reloadCover,setSaved:h.setCoverSaved,setType:h.setPostType,setSelected:h.setSelected,setAccess:h.setCoverAccess,setPermission:h.setCoverPermission,setBroken:h.setCoverBroken,setPickerAvailable:h.setCoverPicker,setEditApi:h.setCoverEditApi,
 get saved(){return h.savedCover;},get edited(){return h.editedCover;},get removed(){return h.nativePanelCalls;},get edits(){return h.postEdits;},get pages(){return h.attrs.pages;},get attrs(){return h.attrs;},get updates(){return h.updates;},standardChange:h.standardCoverChange,standardPreview:h.standardCoverPreview};
}
function run(){
 const source=fs.readFileSync(path.join(root,'blocks/viewer/index.js'),'utf8');
 assert.doesNotMatch(source,/PluginDocumentSettingPanel|registerPlugin|removeEditorPanel|toggleEditorPanelEnabled/,'No document UI or native panel mutation');
 for(const locale of ['en','ja']){
  const h=harness(locale),original=JSON.stringify(h.attrs);let tree=h.render();h.runEffects();
  assert.deepEqual(h.panels(tree).map(n=>n.props.title),['Cover image','Page images','Inline viewer','Fullscreen mode','Focus Mode','General settings'].map(h.t));
  assert.equal(h.coverPanel(tree).props.initialOpen,true);
  assert.ok(JSON.stringify(h.coverPanel(tree)).includes(h.t('First-page preview (not a saved cover)')));
  h.select(tree,7);assert.equal(h.saved,0,'Only edited state');tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes('cover-7.svg'));assert.deepEqual(h.standardPreview(),{id:7,url:'https://example.test/cover-7.svg'},'Unsaved block change updates native preview state');h.standardChange(8);tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes('cover-8.svg'),'Unsaved native change updates selected block immediately');assert.equal(h.saved,0);assert.deepEqual(h.standardPreview(),{id:8,url:'https://example.test/cover-8.svg'});
  h.save(false);tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes(h.t('The last save failed. The cover shown here may not be saved yet.')));assert.equal(h.saved,0);
  h.reload();tree=h.render();h.select(tree,7);h.save();h.reload();tree=h.render();assert.equal(h.edited,7);
  h.select(tree,9);h.save();h.reload();tree=h.render();assert.equal(h.edited,9);
  h.setSelected(false);tree=h.render();assert.equal(h.coverPanel(tree),null,'Deselect/another block must release cover Inspector');h.runEffects();assert.equal(h.edited,9);assert.deepEqual(h.removed,[],'Native panel never changes');
  h.standardChange(11);h.setSelected(true);tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes('cover-11.svg'),'Reselection reflects native editor state');
  h.findLabel(tree,'Maximum comic width (px)').props.onChange(800);tree=h.render();assert.equal(h.edited,11);assert.deepEqual(h.pages,JSON.parse(original).pages,'Unrelated settings keep cover and CTA');
  h.find(h.coverPanel(tree),n=>n.type==='Button'&&n.children.includes(h.t('Remove cover image'))).props.onClick();assert.equal(h.edited,0);assert.deepEqual(h.standardPreview(),{id:0,url:''},'Unsaved block removal updates native state');assert.equal(h.saved,9);h.save();h.reload();tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes(h.t('First-page preview (not a saved cover)')));
  h.standardChange(14);tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes('cover-14.svg'));assert.equal(h.saved,0);h.standardChange(0);tree=h.render();assert.ok(JSON.stringify(h.coverPanel(tree)).includes(h.t('First-page preview (not a saved cover)')),'Unsaved native removal reaches block fallback');const beforePages=JSON.stringify(h.pages);h.coverPanel(tree)&&h.select(tree,15);h.setSelected(false);h.setSelected(true);tree=h.render();assert.equal(h.edited,15);assert.equal(JSON.stringify(h.pages),beforePages);assert.deepEqual(h.removed,[]);
  for(const type of ['post','page']){h.setType(type);tree=h.render();assert.equal(h.coverPanel(tree),null);h.runEffects();assert.deepEqual(h.removed,[]);assert.equal(h.edited,15);}
  for(const [method,value] of [['setAccess',false],['setPermission',false],['setPermission',undefined],['setBroken',true],['setPickerAvailable',false],['setEditApi',false]]){const g=harness(locale);g[method](value);g.render();g.runEffects();assert.deepEqual(g.removed,[],method+' preserves standard editing');assert.equal(g.edits.length,0);}
  assert.equal(JSON.stringify(h.pages),beforePages);assert.ok(h.edits.every(v=>Object.keys(v).join()==='featured_media'));
  if(locale==='ja')for(const key of ['Cover image','Select cover image','Change cover image','Remove cover image','Set the cover here. The standard Featured image panel is also available as a fallback and uses the same image.'])assert.notEqual(h.t(key),key);
 }
 const pro=editorHarness('en',true,true);const tree=pro.render();assert.deepEqual(pro.panels(tree).slice(0,6).map(n=>n.props.title),['Cover image','Page images','Inline viewer','Fullscreen mode','Focus Mode','General settings']);assert.equal(pro.panels(tree).length,7,'Pro CTA remains after core settings');
 console.log('PASS: real block Edit Inspector cover first, six groups including cover, featured_media select/change/unlink, save success/failure doubles, deselect/reselect/native sync, ordinary post/page isolation, no panel mutations, Pro CTA context, en/ja.');
}
module.exports={harness,run};if(require.main===module)run();
