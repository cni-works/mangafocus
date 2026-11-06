const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = process.env.MANGAFOCUS_TEST_ROOT || path.resolve(__dirname, '..');
// Reuse real markup and existing WP doubles. Missing legacy CNI parity is not tested here.
let fixture = fs.readFileSync(path.join(root,'tests/render-smoke.php'),'utf8').split("require dirname( __DIR__, 2 ) . '/cni_blocks/")[0];
fixture = fixture.replaceAll('__DIR__',JSON.stringify(path.join(root,'tests').replaceAll('\\','/')));
const html = execFileSync('php',[],{input:fixture + "echo '<!doctype html><html><body>' . $spread_fixture . $auto_fixture . '</body></html>';",encoding:'utf8'});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://example.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"/>'}));
  await page.setContent(html);
  await page.evaluate(()=>{
   const add=EventTarget.prototype.addEventListener, remove=EventTarget.prototype.removeEventListener;
   const records=[];window.__globalListenerCount=()=>records.length;
   const observers=new Set();window.__observerCount=()=>observers.size;
   for(const name of ['ResizeObserver','IntersectionObserver']) {const Base=window[name];if(!Base)continue;window[name]=class extends Base {observe(...args){observers.add(this);return super.observe(...args);}disconnect(){observers.delete(this);return super.disconnect();}};}

   EventTarget.prototype.addEventListener=function(type,callback,options){if(this===window||this===document)records.push({target:this,type,callback});return add.call(this,type,callback,options);};
   EventTarget.prototype.removeEventListener=function(type,callback,options){const i=records.findIndex(r=>r.target===this&&r.type===type&&r.callback===callback);if(i>=0)records.splice(i,1);return remove.call(this,type,callback,options);};
  });
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'blocks/viewer/style.css'),'utf8')});
  for(const f of ['blocks/viewer/layout.js','blocks/viewer/view.js','assets/panel-reader/frontend.js']) await page.addScriptTag({path:path.join(root,f)});
  const result=await page.evaluate(async()=>{
   const runtime=window.aiMangaViewer, roots=[...document.querySelectorAll('.amv-reader')], a=roots[0],b=roots[1];
   const other=runtime.getInstance(b); const initial=a.outerHTML; let claims=0;
   const api=runtime.getInstance(a); if(runtime.mount(a)!==api) throw Error('double mount');
   api.goToPage(5);const unregister=api.registerTerminalHandler(()=>{claims++;return true;});
   a.querySelector('.amv-reader__button--next').click(); if(claims!==1) throw Error('terminal next');
   api.goToPage(0);api.requestTerminal('not-end'); if(claims!==1) throw Error('premature terminal');unregister();
   let callbacks=0; const scope=runtime.createResourceScope(); scope.timeout(()=>callbacks++,10);scope.frame(()=>callbacks++);scope.dispose();
   const listenerBaseline=window.__globalListenerCount(), observerBaseline=window.__observerCount();
   for(let i=0;i<12;i++) {
    const instance=runtime.getInstance(a); const open=a.querySelector('.amv-reader__focus-open'); if(open) open.click();
    if(!runtime.destroy(a)||runtime.destroy(a)!==false)throw Error('destroy idempotency');
    if(runtime.getInstance(a)!==null)throw Error('instance retained');
    if(document.body.classList.contains('amv-modal-open'))throw Error('modal body state retained');
    if(document.querySelectorAll('body > .amv-modal').length)throw Error('portal retained');
    if(instance.goToPage(1)!==false)throw Error('stale mutator');
    const next=runtime.mount(a);if(!next||next.getCurrentPage().index!==0)throw Error('remount');
    if(runtime.getInstance(b)!==other)throw Error('other instance changed');
    if(window.__globalListenerCount()!==listenerBaseline)throw Error('global listener growth');
    if(window.__observerCount()!==observerBaseline)throw Error('observer growth');
   }
   const focus=a.querySelector('.amv-reader__focus-open');focus.click();let count=0;
   const current=runtime.getInstance(a);const off=current.registerTerminalHandler(()=>{count++;return true;});
   const next=document.querySelector('.amv-modal:not([hidden]) .amv-modal__next');
   for(let i=0;i<30 && count===0;i++)next.click();
   if(count!==1)throw Error('panel terminal');off();runtime.destroy(a);runtime.destroy(b);
   if(window.__observerCount()!==0)throw Error('observer retained after destroy');
   await new Promise(resolve=>setTimeout(resolve,80)); if(callbacks)throw Error('disposed async callback');
   window.dispatchEvent(new Event('resize'));document.dispatchEvent(new Event('fullscreenchange'));
   return {cycles:12,normalTerminal:claims,focusTerminal:count,modalLeaks:document.querySelectorAll('body > .amv-modal').length,otherInstancePreserved:true};
  });
  assert.equal(errors.length,0,errors.join('\n')); console.log('PASS lifecycle browser',JSON.stringify(result));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
