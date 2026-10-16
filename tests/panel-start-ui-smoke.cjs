/** UI-only contract; public editor/store doubles, no WordPress or network. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {harness}=require('./inspector-groups-smoke.cjs');
const title='When switching to panel reading';
const description='Choose which page to start from when switching to panel reading after reading partway through the inline viewer.';
const note='This also applies when switching from fullscreen. Continuing starts at the first panel of the current page.';
const options=[['first',false,'Read from the first page'],['current',true,'Continue from the current page']];
let cases=0;
for(const locale of ['en','ja'])for(const legacy of [false,true])for(const saved of [undefined,false,true]){
 const h=harness(locale,false,false),t=s=>h.translate(s,'mangafocus');
 const initial=JSON.parse(JSON.stringify(h.fields));if(legacy)delete initial.enableInline;
 if(saved===undefined)delete initial.focusReaderStartAtCurrent;else initial.focusReaderStartAtCurrent=saved;
 h.reset(initial);let tree=h.render();h.runEffects();
 assert.equal(h.updates.length,0,'Opening the UI must not save or migrate attributes');
 assert.deepEqual(h.attrs,initial);
 const control=()=>h.findLabel(tree,title);
 assert.ok(control(),'Start control must exist');assert.equal(control().type,'RadioControl');
 assert.equal(control().props.selected,saved?'current':'first');
 assert.deepEqual(Array.from(control().props.options,o=>({value:o.value,label:o.label})),options.map(([value,,label])=>({value,label:t(label)})));
 assert.equal(control().props.help,t(description)+' '+t(note));
 assert.equal(h.findLabel(tree,'Start panel reading from the current page'),null,'Old toggle must not coexist');
 for(const [value,stored] of options){
  const before=JSON.parse(JSON.stringify(h.attrs));const n=h.updates.length;
  control().props.onChange(value);assert.equal(h.updates.length,n+1);
  assert.deepEqual(h.updates[n],{focusReaderStartAtCurrent:stored});assert.equal(typeof h.attrs.focusReaderStartAtCurrent,'boolean');
  assert.deepEqual(h.attrs,{...before,focusReaderStartAtCurrent:stored});
  tree=h.render();assert.equal(control().props.selected,value);
  const serialized=JSON.parse(JSON.stringify(h.attrs));h.reset(serialized);tree=h.render();h.runEffects();
  assert.deepEqual(h.attrs,serialized);assert.equal(h.updates.length,0,'Reload double must not write');assert.equal(control().props.selected,value);
 }
 h.reset({...initial,focusReader:false});tree=h.render();assert.equal(h.findLabel(tree,title),null,'Existing panel-reader display condition stays unchanged');
 if(locale==='ja')for(const s of [title,description,note,...options.map(o=>o[2])])assert.notEqual(t(s),s,'Japanese translation missing');
 cases++;
}
for(const locale of ['en','ja'])for(const inline of [false,true])for(const fullscreen of [false,true])for(const panel of [false,true]){
 if(!inline&&!fullscreen&&!panel)continue;
 const h=harness(locale,false,false);h.reset({...h.fields,enableInline:inline,enableFullscreen:fullscreen,focusReader:panel});const tree=h.render();
 assert.equal(!!h.findLabel(tree,title),panel,'Actual existing visibility follows panel mode; inline/fullscreen are not additional gates');
}
const metadata=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../blocks/viewer/block.json'),'utf8'));
assert.deepEqual(metadata.attributes.focusReaderStartAtCurrent,{type:'boolean',default:false});
console.log('PASS: '+cases+' start-UI contracts; first/current map to boolean false/true, default/legacy no-write, visibility, retained pages/CTA, serialized reload, en/ja.');
