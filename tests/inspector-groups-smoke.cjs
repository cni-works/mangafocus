const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const names = ['Page images', 'Inline viewer', 'Fullscreen mode', 'Focus Mode', 'General settings'];
const switches = ['Enable inline viewer', 'Enable fullscreen mode', 'Enable Focus Mode'];
function harness(locale = 'en', withPro = false, withCover = false) {
 const messages = {};
 for (const handle of ['editor', 'panel-reader-editor']) Object.assign(messages, JSON.parse(fs.readFileSync(path.join(root, 'languages/mangafocus-ja-ai-manga-viewer-'+handle+'.json'))).locale_data.messages);
 const translate = (s, domain) => locale === 'ja' && domain === 'mangafocus' ? (messages[s]?.[0] || s) : s;
 const fields = {viewerKey: 'stable-viewer', instanceKey: 'stable-instance', inlineDisplayMode: 'reader', enableInline: true, enableFullscreen: true, focusReader: true, scrollAssist: true, scrollAssistPosition: 'top', scrollAssistStrength: 'strong', pageLayout: 'spread', singleFirstPage: false, binding: 'rtl', maxWidth: 900, showPageNumbers: false, enableEdgeClick: false, showGuideArrowOnAllPages: true, enableAnimation: false, enableZoom: true, zoomControlsPosition: 'left', fullscreenStartAtCurrent: true, fullscreenReadingMode: 'paged', spreadReadingMode: 'pageFocus', focusReaderStartAtCurrent: true, mobileFocusReader: true,
 pages: [1,2].map(n => ({id: 0, url: 'https://example.test/page-'+n+'.svg', width: 600, height: 900, pageKey: 'page-'+n, focusAreas: [{id:'area-'+n,x:50,y:50,width:80,height:60,zoom:95}], mobileFocusAreas: [{id:'mobile-'+n,x:40,y:50,width:70,height:50,zoom:90}], cta: {enabled:true,ctaKey:'cta-'+n,label:'Stable CTA',url:'https://example.test/action'}}))};
 let attrs = clone(fields), settings, states = [], cursor = 0, effects = [], updates = [], contexts = {}, postType='amv_viewer',selected=true,editedCover=0,savedCover=0,coverPermission=true,coverAccess=true,coverBroken=false,coverPicker=true,coverEditApi=true,coverFailed=false,postEdits=[],nativePanelCalls=[];
 const filters = {};
 const hooks = {addFilter(name, namespace, fn) {(filters[name] ||= []).push(fn);}, applyFilters(name, items, context) {contexts[name] = context; return (filters[name] || []).reduce((value, fn) => fn(value,context),items);}};
 function el(type, props, ...children) {
  const values = children.flat(Infinity).filter(x => x !== null && x !== false && x !== undefined);
  if (typeof type === 'function') return type({...props,children: values});
  return {type,props:props || {},children:values};
 }
 const win = {crypto:{randomUUID:()=>'fixture-key'},aiMangaViewerCapabilities:{panel_reader:{editor:true,runtime:true},cta:{editor:true,runtime:true}},aiMangaViewerProEditorAccess:{cta:{canDeactivate:true}}};
 win.wp = {blocks:{registerBlockType:(name,value)=>{assert.equal(name,'ai-manga-viewer/viewer');settings=value;}},
 element:{createElement:el,Fragment:'Fragment',useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:initial=>({current:initial}),useEffect:fn=>effects.push(fn)},
 blockEditor:{InspectorControls:'InspectorControls',MediaUpload:props=>coverPicker?el('MediaUpload',props,props.render({open(){}})):null,MediaUploadCheck:props=>coverAccess?el('MediaUploadCheck',{},props.children):null,useBlockProps:value=>value},
 components:new Proxy({}, {get:(_,key)=>key}),i18n:{__:translate},data:{useSelect:fn=>fn(name=>name==='core/block-editor'?{getBlocks:()=>[]}:name==='core'?{getPostType:()=>{if(coverBroken)throw Error('Unavailable core data');return {supports:{thumbnail:withCover}};},canUserEditEntityRecord:()=>coverPermission,getMedia:id=>({source_url:'https://example.test/cover-'+id+'.svg'})}:{getCurrentPostType:()=>postType,getCurrentPostId:()=>1,getEditedPostAttribute:key=>key==='featured_media'?editedCover:'Fixture',didPostSaveRequestFail:()=>coverFailed}),dispatch:name=>{if(name!=='core/editor')throw Error('Unexpected editor store mutation');return coverEditApi?{editPost:value=>{assert.deepEqual(Object.keys(value),['featured_media']);postEdits.push(clone(value));editedCover=value.featured_media;},removeEditorPanel:()=>nativePanelCalls.push('remove'),toggleEditorPanelEnabled:()=>nativePanelCalls.push('toggle')}:{};}},apiFetch:()=>Promise.resolve({}),hooks};
 const sandbox={window:win,console,Map,Set};
 for (const rel of ['blocks/viewer/layout.js','assets/panel-reader/editor.js','blocks/viewer/index.js']) vm.runInNewContext(fs.readFileSync(path.join(root,rel),'utf8'),sandbox);
 if(withPro) vm.runInNewContext(fs.readFileSync(path.resolve(root,'../AI Manga Viewer Pro/assets/cta/editor.js'),'utf8'),sandbox);
 function render() {cursor=0;effects=[];contexts={};return settings.edit({attributes:attrs,setAttributes:value=>{updates.push(clone(value));attrs={...attrs,...value};},clientId:'fixture-editor',isSelected:selected});}
 function find(node,predicate) {if(!node || typeof node!=='object')return null;if(predicate(node))return node;for(const child of node.children||[]){const result=find(child,predicate);if(result)return result;}return null;}
 const findLabel=(tree,label)=>find(tree,n=>n.props.label===translate(label,'mangafocus'));
 const panels=tree=>{const inspector=find(tree,n=>n.type==='InspectorControls');return inspector.children.filter(n=>n.type==='PanelBody');};
 return {render,find,findLabel,panels,translate,messages,settings,fields,reset(value){attrs=clone(value);states=[];updates=[];},get attrs(){return attrs;},get updates(){return updates;},get contexts(){return contexts;},runEffects(){effects.forEach(fn=>fn());},setPostType(value){postType=value;},setSelected(value){selected=value;},setCoverPermission(value){coverPermission=value;},setCoverAccess(value){coverAccess=value;},setCoverBroken(value){coverBroken=value;},setCoverPicker(value){coverPicker=value;},setCoverEditApi(value){coverEditApi=value;},setCoverSaved(id){savedCover=editedCover=id;},saveCover(ok=true){coverFailed=!ok;if(ok)savedCover=editedCover;},reloadCover(){editedCover=savedCover;coverFailed=false;},standardCoverChange(id){postEdits.push({featured_media:id});editedCover=id;},standardCoverPreview(){return {id:editedCover,url:editedCover?'https://example.test/cover-'+editedCover+'.svg':''};},get editedCover(){return editedCover;},get savedCover(){return savedCover;},get postEdits(){return postEdits;},get nativePanelCalls(){return nativePanelCalls;}};
}
function run() {
 for(const locale of ['en','ja']) {
  const h=harness(locale,true); let tree=h.render(); h.runEffects(); assert.equal(h.updates.length,0);
  const groups=h.panels(tree), core=groups.slice(0,5);
  assert.deepEqual(core.map(n=>n.props.title),names.map(n=>h.translate(n,'mangafocus')));
  assert.equal(groups.length,6,'Pro CTA inspector remains separate and present');
  for(let i=0;i<3;i++) {
   const panel=core[i+1];assert.equal(panel.props.initialOpen,true);
   assert.equal(panel.children[0].props.label,h.translate(switches[i],'mangafocus'),'Switch is first in its own mode panel');
   assert.equal(JSON.stringify(core).split('"label":'+JSON.stringify(h.translate(switches[i],'mangafocus'))).length-1,1,'Each switch appears exactly once');
   assert.ok(h.findLabel(panel,['Automatically adjust scroll position','Fullscreen reading mode','Configure mobile panels separately'][i]),'Details share their switch panel');
  }
  const before=clone(h.attrs);
  const dedicated=[['Enable inline viewer','Automatically adjust scroll position'],['Enable fullscreen mode','Fullscreen reading mode'],['Enable Focus Mode','Configure mobile panels separately']];
  for(const [toggle,detail] of dedicated) {
   h.findLabel(tree,toggle).props.onChange(false); tree=h.render();
   assert.equal(h.findLabel(tree,detail),null,'OFF must hide details');
   assert.ok(h.findLabel(tree,toggle),'OFF must retain switch');
   h.findLabel(tree,toggle).props.onChange(true); tree=h.render();
   assert.ok(h.findLabel(tree,detail),'ON restores details');
   assert.deepEqual(h.attrs,before,'Modes cannot reset settings/pages/CTA');
  }
  h.findLabel(tree,'Page layout').props.onChange('single');tree=h.render();
  assert.equal(h.attrs.pageLayout,'single');assert.equal(h.attrs.spreadReadingMode,'pageFocus','Hiding unavailable spread settings keeps value');
  assert.equal(h.findLabel(tree,'Fullscreen spread reading mode'),null);
  h.findLabel(tree,'Page layout').props.onChange('spread');tree=h.render();
  h.findLabel(tree,'Fullscreen reading mode').props.onChange('vertical');tree=h.render();
  assert.equal(h.findLabel(tree,'Fullscreen spread reading mode'),null);assert.equal(h.attrs.spreadReadingMode,'pageFocus');
  h.findLabel(tree,'Fullscreen reading mode').props.onChange('paged');tree=h.render();
  assert.ok(h.findLabel(tree,'Fullscreen spread reading mode'));
  h.findLabel(tree,'Enable free zoom and pan').props.onChange(false);tree=h.render();
  assert.equal(h.findLabel(tree,'Zoom control position'),null);assert.equal(h.attrs.zoomControlsPosition,'left');
  h.findLabel(tree,'Enable free zoom and pan').props.onChange(true);tree=h.render();
  assert.equal(h.findLabel(tree,'Zoom control position').props.value,'left');
  h.findLabel(tree,'Configure mobile panels separately').props.onChange(false);tree=h.render();
  const keptPages=clone(h.attrs.pages);
  h.findLabel(tree,'Configure mobile panels separately').props.onChange(true);tree=h.render();
  assert.deepEqual(h.attrs.pages,keptPages,'Mobile OFF/ON retains every saved region and CTA');
  const context=h.contexts['aiMangaViewer.editor.inspectorPanels'];
  assert.equal(context.apiVersion,1);assert.equal(context.currentPageIndex,0);assert.strictEqual(context.currentPage,h.attrs.pages[0]);
  assert.equal(typeof context.updateCurrentPage,'function');assert.equal(typeof context.setAttributes,'function');
  const ctaGroup=h.panels(tree)[5];
  const ctaLabel=h.find(ctaGroup,n=>n.props.label==='ボタンの文字'); assert.ok(ctaLabel, 'Actual Pro CTA edit control must remain');
  // Updating through the preserved add-on context affects only the current page.
  const p2=clone(h.attrs.pages[1]);ctaLabel.props.onChange('Updated fixture CTA');
  assert.equal(h.attrs.pages[0].cta.label,'Updated fixture CTA');assert.deepEqual(h.attrs.pages[1],p2);assert.equal(h.attrs.pages[0].pageKey,'page-1');
  h.reset({...h.fields,enableInline:true,enableFullscreen:false,focusReader:false});
  tree=h.render();h.findLabel(tree,'Enable inline viewer').props.onChange(false);tree=h.render();
  assert.equal(h.updates.length,0);assert.ok(JSON.stringify(tree).includes(h.translate('Keep at least one reading mode enabled.','mangafocus')));
  h.reset({...h.fields,enableInline:true,enableFullscreen:false,focusReader:true,pages:h.fields.pages.map(p=>({...p,focusAreas:[],mobileFocusAreas:[]}))});
  tree=h.render();assert.ok(JSON.stringify(tree).includes(h.translate('No panels are configured. Add panels before using Focus Mode alone.','mangafocus')));
  h.findLabel(tree,'Enable inline viewer').props.onChange(false);assert.equal(h.updates.length,0);
  h.reset({...h.fields,pages:[]});tree=h.render();assert.deepEqual(h.panels(tree).map(p=>p.props.title),names.map(n=>h.translate(n,'mangafocus')),'Five core panels without pages');
  for(const name of [...names,...switches,'When switching to Focus Mode','No panels are configured. Add panels before using Focus Mode alone.']) {
   if(locale==='ja')assert.notEqual(h.translate(name,'mangafocus'),name,'Missing Japanese '+name);
   else assert.equal(h.translate(name,'mangafocus'),name);
  }
 }
 const h=harness();
 for(const inline of [false,true])for(const full of [false,true])for(const panel of [false,true]) {
  if(!inline&&!full&&!panel)continue;
  h.reset({...h.fields,enableInline:inline,enableFullscreen:full,focusReader:panel});
  const tree=h.render();for(const [label,value]of [[switches[0],inline],[switches[1],full],[switches[2],panel]])assert.equal(h.findLabel(tree,label).props.checked,value);
 }
 for(const [label,value,key,stored=value] of [['Scroll adjustment strength','gentle','scrollAssistStrength'],['Fullscreen reading mode','vertical','fullscreenReadingMode'],['When switching to Focus Mode','first','focusReaderStartAtCurrent',false],['Page layout','single','pageLayout'],['Maximum comic width (px)',700,'maxWidth']]) {
  const legacy={...h.fields};delete legacy.enableInline;h.reset(legacy);
  const tree=h.render();h.runEffects();assert.equal(h.updates.length,0);
  h.findLabel(tree,label).props.onChange(value);
  assert.equal(h.attrs[key],stored);assert.equal('enableInline' in h.attrs,false,'Non-mode change must not migrate legacy');
  assert.deepEqual(h.attrs.pages,legacy.pages);assert.deepEqual(Object.keys(h.updates[0]),[key]);
 }
 console.log('PASS: five core groups (six with cover), per-mode switches and nested details, detail visibility/value retention, en/ja catalogs, restrictions, seven modes and read-only Pro inspector context fixture');
}
module.exports={harness,names,switches,root,run};
if(require.main===module)run();
