/** Browser uses DOM component doubles; it is not the WordPress/Gutenberg editor. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {harness,names,switches} = require('./inspector-groups-smoke.cjs');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const locale of ['en','ja']) for(const width of [320,1280]) {
   const h=harness(locale,false,true);h.reset({...h.fields,pages:[...h.fields.pages,{...h.fields.pages[0],pageKey:'third-page'}]});let actions=new Map(),nextId=0,epoch=0;
   const page=await browser.newPage({viewport:{width,height:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   function serialize(n) {
    if(n===null || n===undefined || n===false)return null;
    if(typeof n!=='object')return n;
    const props={}; for(const [key,value] of Object.entries(n.props)) {
     if(typeof value==='function' && ['onChange','onClick'].includes(key)){const id=String(++nextId);actions.set(id,value);props[key]=id;}
     else if(['title','label','help','checked','value','selected','disabled','initialOpen','role','options'].includes(key))props[key]=value;
    }
    return {type:n.type,props,children:(n.children||[]).map(serialize)};
   }
   function snapshot(){actions=new Map();const tree=h.render();return {epoch:++epoch,nodes:h.panels(tree).map(serialize)};}
   await page.exposeFunction('editorFixtureAction',async(id,value)=>{const fn=actions.get(id);assert.ok(fn,'Current callback must exist');fn(value);return snapshot();});
   await page.setContent('<!doctype html><meta charset="utf-8"><main id="editor"></main>');
   await page.evaluate(() => {
    window.mountFixture=function(state){
     const host=document.getElementById('editor'),panelOpen=new Map(Array.from(host.querySelectorAll('details[data-panel]'),el=>[el.dataset.panel,el.open]));host.replaceChildren();document.body.dataset.epoch=String(state.epoch);
     async function call(id,value){window.mountFixture(await window.editorFixtureAction(id,value));}
     function build(n){
      if(n===null)return document.createDocumentFragment();if(typeof n!=='object')return document.createTextNode(String(n));
      const p=n.props;let el;
      if(n.type==='Fragment'){el=document.createDocumentFragment();}
      else if(n.type==='PanelBody'){el=document.createElement('details');el.open=panelOpen.has(p.title)?panelOpen.get(p.title):p.initialOpen!==false;const head=document.createElement('summary');head.textContent=p.title;el.append(head);el.dataset.panel=p.title;}
      else if(n.type==='ToggleControl'){el=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=!!p.checked;input.disabled=!!p.disabled;input.setAttribute('aria-label',p.label);input.onchange=()=>call(p.onChange,input.checked);el.append(input,document.createTextNode(p.label));}
      else if(n.type==='RadioControl'){el=document.createElement('fieldset');el.setAttribute('role','radiogroup');el.setAttribute('aria-label',p.label);const legend=document.createElement('legend');legend.textContent=p.label;el.append(legend);for(const opt of p.options||[]){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=p.label;input.value=opt.value;input.checked=p.selected===opt.value;input.setAttribute('aria-label',opt.label);input.onchange=()=>call(p.onChange,input.value);label.append(input,document.createTextNode(opt.label));el.append(label);}}
      else if(n.type==='SelectControl'){el=document.createElement('label');el.append(document.createTextNode(p.label));const input=document.createElement('select');input.setAttribute('aria-label',p.label);input.disabled=!!p.disabled;for(const opt of p.options||[]){const o=document.createElement('option');o.textContent=opt.label;o.value=opt.value;o.disabled=!!opt.disabled;input.append(o);}input.value=p.value;input.onchange=()=>call(p.onChange,input.value);el.append(input);}
      else if(n.type==='Button'){el=document.createElement('button');el.disabled=!!p.disabled;if(p.onClick)el.onclick=()=>call(p.onClick);}
      else if(n.type==='RangeControl'||n.type==='TextControl'){el=document.createElement('label');el.append(document.createTextNode(p.label));const input=document.createElement('input');input.type=n.type==='RangeControl'?'number':'text';input.value=p.value??'';input.setAttribute('aria-label',p.label);if(p.onChange)input.onchange=()=>call(p.onChange,n.type==='RangeControl'?Number(input.value):input.value);el.append(input);}
      else {el=document.createElement(n.type==='p'?'p':'div');if(p.role)el.setAttribute('role',p.role);}
      for(const child of n.children||[])el.append(build(child));
      if(p.help){const help=document.createElement('small');help.textContent=p.help;el.append(help);}
      return el;
     }
     for(const n of state.nodes)host.append(build(n));
    };
   });
   await page.evaluate(state=>window.mountFixture(state),snapshot());
   const translatedNames=['Cover image',...names].map(n=>h.translate(n,'mangafocus'));
   assert.deepEqual(await page.locator('summary').allTextContents(),translatedNames);
   for(const title of translatedNames){
    const section=page.locator('details').filter({has:page.getByText(title,{exact:true})}).first();
    const open=await section.evaluate(el=>el.open);await section.locator('summary').click();
    assert.equal(await section.evaluate(el=>el.open),!open);
    await section.locator('summary').click();assert.equal(await section.evaluate(el=>el.open),open);
   }
   for(let i=0;i<3;i++) {
    const label=h.translate(switches[i],'mangafocus'), title=h.translate(names[i+1],'mangafocus');
    const section=page.locator('details').filter({has:page.getByText(title,{exact:true})}).first();
    assert.equal(await section.getByRole('checkbox',{name:label,exact:true}).count(),1,'Switch belongs to its detailed panel');
   }
   const before=JSON.parse(JSON.stringify(h.attrs));
   for(const [toggle,detail] of [[switches[0],'Automatically adjust scroll position'],[switches[1],'Fullscreen reading mode'],[switches[2],'Configure mobile panels separately']]){
    let current=Number(await page.locator('body').getAttribute('data-epoch'));
    await page.getByRole('checkbox',{name:h.translate(toggle,'mangafocus'),exact:true}).click();
    await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,current);
    assert.equal(await page.getByLabel(h.translate(detail,'mangafocus'),{exact:true}).count(),0);
    current=Number(await page.locator('body').getAttribute('data-epoch'));
    await page.getByRole('checkbox',{name:h.translate(toggle,'mangafocus'),exact:true}).click();
    await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,current);
    assert.equal(await page.getByLabel(h.translate(detail,'mangafocus'),{exact:true}).count(),1);
    assert.deepEqual(h.attrs,before);
   }
   const startLabel=h.translate('When switching to panel reading','mangafocus');
   const start=page.getByRole('radiogroup',{name:startLabel,exact:true});
   const choices=[['first',false,'Read from the first page'],['current',true,'Continue from the current page']];
   assert.equal(await start.getByRole('radio').count(),2);
   assert.equal(await page.getByRole('combobox',{name:startLabel,exact:true}).count(),0,'No old select or toggle remains');
   assert.equal(await page.getByRole('checkbox',{name:h.translate('Start panel reading from the current page','mangafocus'),exact:true}).count(),0);
   await page.exposeFunction('reloadSettingsFixture',()=>{h.reset(JSON.parse(JSON.stringify(h.attrs)));return snapshot();});
   for(const [value,stored,label] of choices){
    const previous=JSON.parse(JSON.stringify(h.attrs));const epochBefore=Number(await page.locator('body').getAttribute('data-epoch'));
    await start.getByRole('radio',{name:h.translate(label,'mangafocus'),exact:true}).check();await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,epochBefore);
    assert.equal(h.attrs.focusReaderStartAtCurrent,stored);assert.equal(typeof h.attrs.focusReaderStartAtCurrent,'boolean');assert.deepEqual(h.attrs,{...previous,focusReaderStartAtCurrent:stored});
    await page.evaluate(async()=>window.mountFixture(await window.reloadSettingsFixture()));assert.equal(await start.getByRole('radio',{name:h.translate(label,'mangafocus'),exact:true}).isChecked(),true);
   }
   const general=page.locator('details').filter({has:page.getByText(h.translate('General settings','mangafocus'),{exact:true})}).first();
   if(!await general.evaluate(el=>el.open))await general.locator('summary').click();
   const layoutControl=page.getByRole('combobox',{name:h.translate('Page layout','mangafocus'),exact:true});
   const firstPage=page.getByRole('checkbox',{name:h.translate('Show the first page separately','mangafocus'),exact:true});
   for(const stored of [true,false]){
    if(await firstPage.isChecked()!==stored){const epochBefore=Number(await page.locator('body').getAttribute('data-epoch'));await firstPage.setChecked(stored);await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,epochBefore);}
    for(const layout of ['single','auto','spread']){
     const previous=JSON.parse(JSON.stringify(h.attrs)),epochBefore=Number(await page.locator('body').getAttribute('data-epoch'));
     await layoutControl.selectOption(layout);await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,epochBefore);
     assert.deepEqual(h.attrs,{...previous,pageLayout:layout});assert.equal(h.attrs.singleFirstPage,stored);assert.equal(await firstPage.count(),layout==='single'?0:1);
     await page.evaluate(async()=>window.mountFixture(await window.reloadSettingsFixture()));assert.equal(await firstPage.count(),layout==='single'?0:1);if(layout!=='single')assert.equal(await firstPage.isChecked(),stored);
    }
   }
   assert.deepEqual(h.attrs,before,'Radio and layout round trips retain all saved values');
   await page.exposeFunction('twoPageSettingsFixture',()=>{h.reset({...h.attrs,pages:h.attrs.pages.slice(0,2),pageLayout:'single',singleFirstPage:true});return snapshot();});
   await page.evaluate(async()=>window.mountFixture(await window.twoPageSettingsFixture()));
   assert.equal(await firstPage.count(),0);assert.equal(await layoutControl.locator('option[value="spread"]').isDisabled(),false);
   let epochBefore=Number(await page.locator('body').getAttribute('data-epoch'));await layoutControl.selectOption('spread');await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,epochBefore);
   assert.equal(await firstPage.isChecked(),true);assert.equal(h.attrs.singleFirstPage,true,'Choosing spread does not reset the retained flag');
   epochBefore=Number(await page.locator('body').getAttribute('data-epoch'));await firstPage.uncheck();await page.waitForFunction(v=>Number(document.body.dataset.epoch)>v,epochBefore);assert.equal(h.attrs.singleFirstPage,false);
   await page.exposeFunction('restoreInitialSettingsFixture',()=>{h.reset(before);return snapshot();});await page.evaluate(async()=>window.mountFixture(await window.restoreInitialSettingsFixture()));assert.deepEqual(h.attrs,before);
   await page.exposeFunction('blockSelectionFixture', selected=>{h.setSelected(selected);return snapshot();});
   await page.evaluate(async()=>window.mountFixture(await window.blockSelectionFixture(false)));
   assert.equal(await page.locator('summary').filter({hasText:h.translate('Cover image','mangafocus')}).count(),0);
   assert.deepEqual(h.nativePanelCalls,[],'Deselecting must leave standard panel state untouched');
   await page.evaluate(async()=>window.mountFixture(await window.blockSelectionFixture(true)));
   assert.deepEqual(await page.locator('summary').allTextContents(),translatedNames,'Cover first after reselect');
   assert.deepEqual(errors,[]);
   await page.close();console.log('PASS: '+locale+' '+width+'px '+' inspector DOM doubles: six groups including cover, deselect/reselect, collapse/reopen, mode-linked details and retained values');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
