/** Visibility only; preserves singleFirstPage and legacy attributes across layout choices. */
const assert=require('node:assert/strict');
const {harness}=require('./inspector-groups-smoke.cjs');
const title='Show the first page separately';
const help='In spread view, display the first page on its own.';
let cases=0;
for(const locale of ['en','ja'])for(const legacy of [false,true])for(const layout of [undefined,'single','spread','auto'])for(const stored of [undefined,false,true]){
 const h=harness(locale,false,false),t=s=>h.translate(s,'mangafocus');
 const initial=JSON.parse(JSON.stringify(h.fields));initial.pages.push({...initial.pages[0],pageKey:'third-page'});
 if(legacy)delete initial.enableInline;if(layout===undefined)delete initial.pageLayout;else initial.pageLayout=layout;
 if(stored===undefined)delete initial.singleFirstPage;else initial.singleFirstPage=stored;
 h.reset(initial);let tree=h.render();h.runEffects();assert.equal(h.updates.length,0);assert.deepEqual(h.attrs,initial);
 const get=()=>h.findLabel(tree,title);const visible=layout==='spread'||layout==='auto';assert.equal(!!get(),visible,'Single/default layout must hide the first-page option');
 if(visible){assert.equal(get().props.checked,stored!==false);assert.equal(get().props.help,t(help));}
 const keep=JSON.parse(JSON.stringify(h.attrs));
 for(const next of ['spread','single','auto','spread']){
  const before=JSON.parse(JSON.stringify(h.attrs)),n=h.updates.length;
  h.findLabel(tree,'Page layout').props.onChange(next);tree=h.render();
  assert.deepEqual(h.updates[n],{pageLayout:next});assert.deepEqual(h.attrs,{...before,pageLayout:next});
  assert.equal(!!get(),next!=='single');if(get())assert.equal(get().props.checked,stored!==false);
  const serialized=JSON.parse(JSON.stringify(h.attrs));h.reset(serialized);tree=h.render();h.runEffects();assert.equal(h.updates.length,0);assert.deepEqual(h.attrs,serialized);
 }
 assert.deepEqual(h.attrs.pages,keep.pages);assert.equal(h.attrs.singleFirstPage,keep.singleFirstPage);assert.equal('singleFirstPage' in h.attrs,'singleFirstPage' in keep);
 for(const next of [false,true]){get().props.onChange(next);tree=h.render();assert.equal(h.attrs.singleFirstPage,next);assert.equal(get().props.checked,next);}
 if(locale==='ja')assert.equal(t(help),'見開き表示時、先頭ページを1ページだけで表示します。');cases++;
}
for(const locale of ['en','ja'])for(const stored of [undefined,true,false]){
 const h=harness(locale,false,false),initial=JSON.parse(JSON.stringify(h.fields));initial.pageLayout='single';
 if(stored===undefined)delete initial.singleFirstPage;else initial.singleFirstPage=stored;
 h.reset(initial);let tree=h.render();const selector=h.findLabel(tree,'Page layout');
 assert.equal(selector.props.options.find(o=>o.value==='spread').disabled,false,'Two portrait pages must allow selecting spread before revealing the first-page control');
 assert.equal(selector.props.options.find(o=>o.value==='auto').disabled,false);
 selector.props.onChange('spread');tree=h.render();assert.equal(h.attrs.pageLayout,'spread');
 assert.equal(h.attrs.singleFirstPage,initial.singleFirstPage);assert.equal('singleFirstPage' in h.attrs,'singleFirstPage' in initial);
 const first=h.findLabel(tree,title);assert.ok(first);assert.equal(first.props.checked,stored!==false);
 first.props.onChange(false);tree=h.render();assert.equal(h.attrs.singleFirstPage,false);assert.deepEqual(h.attrs.pages,initial.pages);cases++;
}
for(const locale of ['en','ja'])for(const kind of ['empty','one-page','landscape']){
 const h=harness(locale,false,false);const pages=kind==='empty'?[]:kind==='one-page'?[h.fields.pages[0]]:h.fields.pages.map(p=>({...p,width:1200,height:600}));
 h.reset({...h.fields,pageLayout:'single',pages});const tree=h.render(),selector=h.findLabel(tree,'Page layout');
 for(const option of selector.props.options.filter(o=>o.value!=='single'))assert.equal(option.disabled,true,'Unpairable page sets remain unavailable');
 selector.props.onChange('spread');assert.equal(h.updates.length,0,'Unavailable layout remains rejected');cases++;
}
console.log('PASS '+cases+' first-page visibility/retention contracts; default/single hidden, spread/auto visible, missing/false/true retained, legacy no-migration, en/ja.');
