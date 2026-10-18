/** Per-mode panel contract with public editor doubles; never bootstraps WordPress. */
const assert=require('node:assert/strict');
const {harness,switches}=require('./inspector-groups-smoke.cjs');
for(const locale of ['en','ja']) {
 const h=harness(locale,true,true), t=s=>h.translate(s,'mangafocus');let tree=h.render();h.runEffects();
 const expected=['Cover image','Page images','Inline viewer','Fullscreen mode','Focus Mode','General settings'];
 assert.deepEqual(h.panels(tree).slice(0,6).map(p=>p.props.title),expected.map(t));assert.equal(h.panels(tree).length,7,'Pro panel follows six core groups');
 const initial=JSON.parse(JSON.stringify(h.attrs));
 for(let i=0;i<3;i++) {
  const title=expected[i+2],detail=['Automatically adjust scroll position','Fullscreen reading mode','Configure mobile panels separately'][i];
  const panel=()=>h.find(tree,n=>n.type==='PanelBody'&&n.props.title===t(title));
  assert.equal(panel().children[0].props.label,t(switches[i]));assert.ok(h.findLabel(panel(),detail));
  h.findLabel(panel(),switches[i]).props.onChange(false);tree=h.render();assert.ok(panel());assert.equal(h.findLabel(panel(),detail),null);assert.equal(h.findLabel(panel(),switches[i]).props.checked,false);
  // Save/reload is an attribute serialization double; no real WordPress save is claimed.
  h.reset(JSON.parse(JSON.stringify(h.attrs)));tree=h.render();assert.equal(h.findLabel(panel(),switches[i]).props.checked,false);assert.deepEqual(h.attrs.pages,initial.pages);
  h.findLabel(panel(),switches[i]).props.onChange(true);tree=h.render();assert.deepEqual(h.attrs,initial);
 }
 h.reset({...h.fields,enableInline:true,enableFullscreen:false,focusReader:false});tree=h.render();h.findLabel(tree,switches[0]).props.onChange(false);tree=h.render();
 const panel=h.find(tree,n=>n.type==='PanelBody'&&n.props.title===t('Inline viewer'));
 assert.ok(h.find(panel,n=>n.props.role==='alert'),'Rejected action is explained in the attempted mode panel');assert.equal(h.updates.length,0);
 for(const type of ['post','page']){h.setPostType(type);tree=h.render();assert.equal(h.find(tree,n=>n.type==='PanelBody'&&n.props.title===t('Cover image')),null);assert.deepEqual(h.nativePanelCalls,[]);}
 console.log('PASS '+locale+': six library groups; local switch/details, retained serialized attributes, in-panel rejection, no native-panel mutation');
}
