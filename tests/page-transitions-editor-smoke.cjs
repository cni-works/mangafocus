const assert = require('node:assert/strict');
const {harness} = require('./inspector-groups-smoke.cjs');
for (const locale of ['en','ja']) {
 const h=harness(locale,false,false);
 const defaults=h.settings.variations.find(v=>v.isDefault).attributes;
 assert.equal(defaults.pageTransition,'turn','New insertions explicitly select page turn without changing legacy defaults');
 assert.equal('default' in h.settings.attributes.pageTransition,false,'Parsed legacy blocks keep the new attribute absent');
 h.reset({...h.fields,...defaults});
 assert.equal(h.findLabel(h.render(),'Page transition animation').props.value,'turn');
 for(const old of [undefined,true,false]) {
  const a={...h.fields}; delete a.pageTransition;
  if(old===undefined)delete a.enableAnimation;else a.enableAnimation=old;
  h.reset(a);let tree=h.render();h.runEffects();
  assert.equal(h.updates.length,0,'Opening old work must not migrate attributes');
  let control=h.findLabel(tree,'Page transition animation');
  assert.equal(control.type,'SelectControl');
  assert.equal(control.props.value,old===false?'none':'turn');
  assert.deepEqual(Array.from(control.props.options,x=>x.value),['none','turn','fade','slide']);
  const before=JSON.stringify(h.attrs);
  for(const effect of ['fade','slide','none','turn']) {
   control.props.onChange(effect);tree=h.render();control=h.findLabel(tree,'Page transition animation');
   assert.equal(control.props.value,effect);
   const saved=JSON.parse(JSON.stringify(h.attrs));h.reset(saved);tree=h.render();
   assert.equal(h.findLabel(tree,'Page transition animation').props.value,effect);
   const {pageTransition,...unchanged}=h.attrs;
   assert.deepEqual(unchanged,JSON.parse(before),'Effect selection changes no old flags/pages/CTA');
  }
  const count=h.updates.length;h.findLabel(tree,'Page transition animation').props.onChange('unsafe');
  assert.equal(h.updates.length,count,'Invalid selection ignored');
 }
}
console.log('PASS: en/ja selector, default/legacy ON/OFF, four choices, save/reload, unchanged pages/CTA and old flag; no WordPress boot.');
