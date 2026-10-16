const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const fixture=process.env.MANGAFOCUS_START_FIXTURE||path.join(__dirname,'vertical-start-smoke.php');
const runtime=process.env.MANGAFOCUS_VIEW_RUNTIME||path.join(root,'blocks/viewer/view.js');
const css=process.env.MANGAFOCUS_START_CSS||path.join(root,'blocks/viewer/style.css');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{
 async function setup(c){
  const page=await browser.newPage({viewport:{width:c.width||390,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/*',async route=>{const u=route.request().url();if(!u.startsWith('https://example.test/start-'))return route.abort();if(c.delayed)await gate;if(c.failPrefix&&u.endsWith('start-0.svg'))return route.abort();return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"/>'});});
  const markup=execFileSync(process.env.MANGAFOCUS_PHP||'php',[fixture,JSON.stringify(c),'--pro-cta-fixture'],{encoding:'utf8',env:process.env});const html=c.lazy?markup:markup.replaceAll('loading="lazy"','loading="eager"');
  await page.setContent(html,{waitUntil:c.delayed?'domcontentloaded':'load'});
  await page.evaluate(()=>{
   window.wp={i18n:{__:s=>s}};window.startEvents=[];window.startObservers=[];
   for(const name of ['amv:viewer-viewchange','amv:viewer-fullscreenchange','amv:viewer-interaction'])document.addEventListener(name,e=>window.startEvents.push({name,detail:e.detail}));
   const Native=window.IntersectionObserver;
   window.IntersectionObserver=class extends Native{constructor(callback,options){super(callback,options);window.startObservers.push({observer:this,callback,disconnected:false});}disconnect(){const row=window.startObservers.find(row=>row.observer===this);if(row)row.disconnected=true;super.disconnect();}};
   let active=null;Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>active});
   HTMLElement.prototype.requestFullscreen=function(){active=this;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
   document.exitFullscreen=()=>{active=null;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
  });
  await page.addStyleTag({path:css});await page.addStyleTag({content:'.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}'});
  for(const js of [path.join(root,'blocks/viewer/layout.js'),runtime])await page.addScriptTag({path:js});
  const reader=page.locator('#start-reader .amv-reader'),other=page.locator('#other-reader .amv-reader');
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  await frame();const identity=await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getIdentity());const otherState=await other.evaluate(el=>window.aiMangaViewer.getInstance(el).getState());
  const state=()=>reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getState());
  const go=async index=>{await reader.evaluate((el,index)=>window.aiMangaViewer.getInstance(el).goToPage(index),index);await frame();};
  const open=async()=>{await reader.locator('.amv-reader__fullscreen').evaluate(el=>el.click());await frame();};
  const close=async()=>{await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).closeFullscreen());await frame();};
  const loaded=async()=>{release();await page.waitForFunction(()=>Array.from(document.querySelectorAll('#start-reader img')).every(img=>img.complete));await frame();await frame();};
  const finish=async()=>{assert.deepEqual(errors,[]);assert.deepEqual((await state()).identity,identity);assert.deepEqual(await other.evaluate(el=>window.aiMangaViewer.getInstance(el).getState()),otherState);await page.close();};
  return {page,reader,state,go,open,close,loaded,finish,frame};
 }
 for(const width of [390,1200])for(const zoom of [false,true])for(const legacy of [false,true])for(const start of [0,1,3]){
  const c={width,zoom,legacy,start},t=await setup(c);await t.go(start);
  for(let cycle=0;cycle<2;cycle++){
   if(cycle)await t.go(start);const at=await t.page.evaluate(()=>window.startEvents.length);await t.open();
   assert.equal((await t.state()).currentPage.index,start,'Native observer must retain requested start '+JSON.stringify(c));assert.equal((await t.state()).readingMode,'vertical');
   const scroll=t.reader.locator('.amv-reader__page').nth(start);
   const gap=await scroll.evaluate(el=>el.getBoundingClientRect().top-el.closest('.amv-reader').getBoundingClientRect().top);
   if(start===1)assert.ok(Math.abs(gap-16)<=2,'Requested page aligns to viewport inset');
   await t.close();assert.equal((await t.state()).currentPage.index,start===3?0:start,'Last-page close resets; other starts retain position');
   const own=await t.page.evaluate(at=>window.startEvents.slice(at).filter(e=>e.detail.identity.instanceKey==='start-reader'),at);
   assert.deepEqual(own.filter(e=>e.name==='amv:viewer-fullscreenchange').map(e=>e.detail.fullscreen),[true,false]);
   assert.equal(own.filter(e=>e.name==='amv:viewer-interaction'&&e.detail.action==='read').length,1,'One read action per entry');
   const changes=own.filter(e=>e.name==='amv:viewer-viewchange');for(let i=1;i<changes.length;i++)assert.notEqual(JSON.stringify(changes[i].detail.currentPage)+changes[i].detail.readingMode,JSON.stringify(changes[i-1].detail.currentPage)+changes[i-1].detail.readingMode,'No duplicate state notifications');
  }
  // Real scrolling must work after the one-shot start (no persistent page lock).
  await t.go(1);await t.open();await t.reader.evaluate(el=>{const p=el.querySelectorAll('.amv-reader__page')[3];el.scrollTop+=p.getBoundingClientRect().top-el.getBoundingClientRect().top-16;});
  await t.page.waitForFunction(()=>window.aiMangaViewer.getInstance(document.querySelector('#start-reader .amv-reader')).getCurrentPage().index===3);await t.close();
  await t.finish();results.push({...c,observer:'native',passed:true});
 }
 for(const zoom of [false,true])for(const start of [0,1,3]){
  const t=await setup({delayed:true,zoom});await t.go(start);await t.open();await t.loaded();assert.equal((await t.state()).currentPage.index,start,'Delayed unknown images settle before initial alignment');await t.close();await t.finish();results.push({delayed:true,zoom,start,passed:true});
 }
 for(const action of ['wheel','api','exit','reenter','stale']){
  const t=await setup({delayed:true,zoom:true});await t.go(1);await t.open();
  if(action==='wheel'){await t.reader.dispatchEvent('wheel',{deltaY:100});await t.loaded();assert.equal((await t.state()).currentPage.index,0,'User input cancels delayed start and does not pull back');await t.close();}
  if(action==='api'){await t.go(0);await t.loaded();assert.equal((await t.state()).currentPage.index,0,'API navigation cancels pending initial target');await t.close();}
  if(action==='exit'){await t.close();await t.loaded();assert.equal((await t.state()).readingMode,'standard');assert.equal(await t.page.evaluate(()=>window.startObservers.some(row=>!row.disconnected)),false,'Late load must not register an observer after exit');}
  if(action==='reenter'){await t.close();await t.go(3);await t.open();await t.loaded();assert.equal((await t.state()).currentPage.index,3,'Old pending entry must not align a new entry');await t.close();}
  if(action==='stale'){await t.loaded();await t.close();await t.go(0);await t.open();const before=await t.state();await t.page.evaluate(()=>{const row=window.startObservers.find(row=>row.disconnected);const target=document.querySelectorAll('#start-reader .amv-reader__page')[3];row.callback([{target,isIntersecting:true,intersectionRect:{height:900},boundingClientRect:{top:0,height:900}}]);});assert.deepEqual(await t.state(),before,'Disconnected callback must be ignored');await t.close();}
  await t.finish();results.push({action,delayed:true,passed:true});
 }
 const t=await setup({delayed:true,failPrefix:true});await t.go(1);await t.open();await t.loaded();assert.equal((await t.state()).currentPage.index,1,'Failed preceding image must not block start forever');await t.close();await t.finish();results.push({failedPrefix:true,passed:true});
 for(const known of [false,true]){
  const t=await setup({delayed:true,zoom:false,lazy:true,known});const original=await t.reader.locator('img').evaluateAll(images=>images.map(img=>img.getAttribute('loading')));await t.go(known?1:3);await t.open();
  if(known){await t.frame();assert.equal((await t.state()).currentPage.index,1,'Known image dimensions reserve the requested position before load');}
  await t.loaded();assert.equal((await t.state()).currentPage.index,known?1:3,'Image readiness and native lazy loading');assert.deepEqual(await t.reader.locator('img').evaluateAll(images=>images.map(img=>img.getAttribute('loading'))),original,'Original lazy/eager attributes restored after one-shot entry');await t.close();await t.finish();results.push({lazy:true,known,passed:true});
 }
 console.log('PASS: '+results.length+' vertical-start cases; native observer first/middle/last, delayed/error images, free scroll, cancellation/re-entry and stale-callback injection');
 if(process.env.MANGAFOCUS_START_RESULTS)fs.writeFileSync(process.env.MANGAFOCUS_START_RESULTS,JSON.stringify({passed:true,environment:'Headless Edge native IntersectionObserver; Fullscreen/WP doubles; stale callback injected separately',cases:results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
