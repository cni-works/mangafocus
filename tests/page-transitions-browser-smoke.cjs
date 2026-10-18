const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root=path.resolve(__dirname,'..');
const html=execFileSync(process.env.MANGAFOCUS_PHP||'php',[path.join(__dirname,'page-transitions-smoke.php'),'--fixture'],{encoding:'utf8'});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let assertions=0;
 const check=(v,msg)=>{assert.ok(v,msg);assertions++;};
 try {
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://example.test/**',async route=>{
   const delay=route.request().url().includes('delayed');
   if(delay)await new Promise(r=>setTimeout(r,650));
   if(route.request().url().includes('broken'))return route.abort();
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#ddeeff"/></svg>'});
  });
  await page.setContent(html);
  await page.evaluate(()=>{
   window.wp={i18n:{__:(s)=>s,sprintf:(s,...a)=>{let i=0;return s.replace(/%[0-9]+\$d|%d/g,()=>a[i++]);}}};
   let fullscreen=null;
   Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen});
   document.exitFullscreen=()=>{fullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
   HTMLElement.prototype.requestFullscreen=function(){fullscreen=this;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
   document.querySelectorAll('.amv-reader').forEach(r=>{
    r.testViews=[];r.testCtaClicks=0;
    r.addEventListener('amv:viewer-viewchange',e=>r.testViews.push(e.detail.visiblePages.map(p=>p.index)));
    r.querySelectorAll('.amv-reader__page').forEach((p,i)=>{
     const link=document.createElement('a');link.href='#cta-'+i;link.dataset.amvPageInteractive='true';link.className='fixture-cta';link.textContent='CTA';
     link.addEventListener('click',e=>{e.preventDefault();r.testCtaClicks++;});p.appendChild(link);
    });
   });
  });
  for(const css of ['blocks/viewer/style.css','assets/panel-reader/style.css'])await page.addStyleTag({path:path.join(root,css)});
  await page.addStyleTag({content:'.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}.fixture-cta{display:block;height:25px}'});
  for(const js of ['blocks/viewer/layout.js','blocks/viewer/view.js','assets/panel-reader/frontend.js'])await page.addScriptTag({path:path.join(root,js)});
  await page.evaluate(async()=>Promise.all(Array.from(document.querySelectorAll('.amv-reader__image')).map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));
  await page.waitForTimeout(100);
  const viewer=(layout,binding,effect)=>page.locator('#pt-'+layout+'-'+binding+'-'+effect+' .amv-reader');
  const reset=async r=>{
   await r.evaluate(r=>{window.aiMangaViewer.getInstance(r).goToPage(0);r.testViews=[];r.testCtaClicks=0;});
   await page.waitForTimeout(35);
  };
  const click=async(r,which)=>r.locator('.amv-reader__button--'+which).evaluate(b=>b.click());
  const current=r=>r.evaluate(r=>window.aiMangaViewer.getInstance(r).getCurrentPage().index);
  const preload=viewer('single','rtl','slide');
  await preload.locator('.amv-reader__image').nth(1).evaluate(img=>{img.loading='lazy';img.src='https://example.test/prefetch-cold.svg';});
  await preload.locator('.amv-reader__image').nth(5).evaluate(img=>{img.loading='lazy';});
  await preload.evaluate(r=>window.aiMangaViewer.getInstance(r).goToPage(0));
  await page.waitForFunction(r=>{const img=r.querySelectorAll('.amv-reader__image')[1];return img.complete&&img.naturalWidth>0;},await preload.elementHandle());
  check(await preload.locator('.amv-reader__image').nth(1).getAttribute('loading')==='eager','Next view is warmed before navigating');
  check(await preload.locator('.amv-reader__image').nth(5).getAttribute('loading')==='lazy','Distant pages are not eagerly fetched');
  await preload.locator('.amv-reader__image').nth(1).evaluate(async img=>{img.src='https://example.test/animation-1.svg';await img.decode();});
  for(const layout of ['single','spread','auto'])for(const binding of ['rtl','ltr'])for(const effect of ['none','turn','fade','slide']){
   const r=viewer(layout,binding,effect);await reset(r);await click(r,'next');
   if(effect==='none'){
    check(await current(r)===1,'Instant navigation is synchronous');
    check(await r.getAttribute('aria-busy')===null,'None takes no lock');
   }else{
    check(await r.getAttribute('aria-busy')==='true','Effect locks normal navigation');
    await click(r,'next');await click(r,'previous');
    if(effect!=='turn'||layout!=='single'){
     check(await r.locator('.amv-reader__transition-sheet').count()===1,'One visual sheet per view');
     check(await r.locator('.amv-reader__transition-sheet a,.amv-reader__transition-sheet button,.amv-reader__transition-sheet [id],.amv-reader__transition-sheet [data-amv-page-interactive],.amv-reader__transition-sheet .amv-reader__page').count()===0,'No CTA, interactive DOM, page selectors or IDs cloned');
     check(await r.locator('.fixture-cta').count()===6,'CTA DOM count unchanged');
     if(layout!=='single')check(await r.evaluate(r=>window.aiMangaViewer.getInstance(r).getVisiblePages().length)===2,'Whole spread changes together');
     if(effect==='slide'){
      await page.waitForTimeout(65);
      const geometry=await r.evaluate(r=>{
       const a=r.querySelector('.amv-reader__transition-sheet'),b=r.querySelector('.amv-reader__transition-content');
       const x=new DOMMatrixReadOnly(getComputedStyle(a).transform).m41,y=new DOMMatrixReadOnly(getComputedStyle(b).transform).m41;
       const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
       return {x,y,gap:r.dataset.binding==='rtl'?Math.abs(br.right-ar.left):Math.abs(br.left-ar.right)};
      });
      check(binding==='rtl'?geometry.x>0&&geometry.y<0:geometry.x<0&&geometry.y>0,'Next slide direction follows binding');
      check(geometry.gap<3,'Incoming/outgoing move together without a horizontal gap');
     }
    }
   }
   await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());
   check(await current(r)===1,'Repeated and reverse inputs do not skip the requested view');
   check((await r.evaluate(r=>r.testViews.length))===1,'One view event per committed view');
   await r.locator('.amv-reader__page.is-active .fixture-cta').first().evaluate(a=>a.click());
   check(await r.evaluate(r=>r.testCtaClicks)===1,'One CTA click only');
   if(effect==='slide'){
    await click(r,'previous');await page.waitForTimeout(60);
    const x=await r.locator('.amv-reader__transition-sheet').evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m41);
    check(binding==='rtl'?x<0:x>0,'Previous slide reverses direction');
    await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());
    check(await current(r)===0,'Previous restores first view');
   }
  }
  for(const layout of ['single','spread'])for(const effect of ['legacy-on','legacy-off','missing']){
   const r=viewer(layout,'rtl',effect);await reset(r);await click(r,'next');
   const oldTurn=layout==='single'&&effect!=='legacy-off';
   check((await r.getAttribute('aria-busy')==='true')===oldTurn,'Legacy ON/OFF/default and spread behavior retained');
   if(oldTurn)await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());
   check(await current(r)===1,'Legacy page position retained');
  }
  const r=viewer('single','rtl','slide');
  for(const input of ['key','edge','tap','swipe']){
   await reset(r);
   if(input==='key')await r.locator('.amv-reader__stage').evaluate(s=>s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true})));
   if(input==='edge')await r.locator('.amv-reader__edge--next').evaluate(b=>b.click());
   if(input==='tap')await r.locator('.amv-reader__stage').evaluate(s=>{const box=s.querySelector('.amv-reader__pages').getBoundingClientRect();s.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:box.left+box.width*.08,clientY:box.top+box.height*.5}));});
   if(input==='swipe')await r.locator('.amv-reader__stage').evaluate(s=>{
    const emit=(type,x)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:200}]});Object.defineProperty(e,'changedTouches',{value:[{clientX:x,clientY:200}]});s.dispatchEvent(e);};emit('touchstart',100);emit('touchend',220);
   });
   check(await r.getAttribute('aria-busy')==='true',input+' uses common animation');
   await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());
   check(await current(r)===1,input+' advances once');
  }
  await reset(r);await click(r,'next');await page.setViewportSize({width:1100,height:950});
  await page.waitForTimeout(50);check(await r.getAttribute('aria-busy')===null,'Resize releases animation');check(await current(r)===1,'Resize keeps the committed target');
  for(const effect of ['turn','slide']){
   const r=viewer('single','rtl',effect);await reset(r);await click(r,'next');
   await r.evaluate(r=>window.aiMangaViewer.getInstance(r).goToPage(4));await page.waitForTimeout(450);
   check(await current(r)===4,'API interrupt cancels stale '+effect+' callback');
   check(await r.locator('.amv-reader__transition-sheet').count()===0,'API leaves no temporary sheet');
  }
  await reset(r);await click(r,'next');await r.locator('.amv-reader__fullscreen').evaluate(b=>b.click());
  await page.waitForTimeout(50);check(await r.getAttribute('aria-busy')===null,'Fullscreen entry settles animation');
  await click(r,'next');await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(50);
  check(await r.locator('.amv-reader__transition-sheet').count()===0,'Fullscreen exit cleans animation');
  check(await r.getAttribute('aria-busy')===null,'Fullscreen exit releases lock');
  for(const special of ['vertical','pageFocus']){
   const v=page.locator('#pt-'+special+' .amv-reader');await v.evaluate(r=>window.aiMangaViewer.getInstance(r).goToPage(1));await v.locator('.amv-reader__fullscreen').evaluate(b=>b.click());await page.waitForTimeout(50);
   const old=await current(v);await click(v,'next');
   check(await v.locator('.amv-reader__transition-sheet').count()===0,'No normal animation in '+special);
   check(await current(v)===(special==='vertical'?old:old+1),'Existing special navigation retained');
   await page.evaluate(()=>document.exitFullscreen());
  }
  await reset(r);await r.locator('.amv-reader__focus-open').evaluate(b=>b.click());await page.waitForTimeout(30);
  await page.locator('.amv-modal:not([hidden]) .amv-modal__next').click();
  check(await r.locator('.amv-reader__transition-sheet').count()===0,'Panel API synchronization never starts normal effects');
  check(await page.locator('.amv-modal:not([hidden]) .amv-modal__turning-sheet').count()===1,'Existing panel page turn retained');
  await page.locator('.amv-modal:not([hidden]) .amv-modal__close').click();
  await reset(r);await click(r,'next');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(40);
  check(await r.getAttribute('aria-busy')===null,'Motion preference change cancels current wait');
  for(const effect of ['none','turn','fade','slide','legacy-on']){
   const v=viewer('single','rtl',effect);await reset(v);await click(v,'next');
   check(await current(v)===1,'Reduced motion commits synchronously: '+effect);
   check(await v.getAttribute('aria-busy')===null,'Reduced motion skips JS lock: '+effect);
   check(await v.locator('.amv-reader__transition-sheet').count()===0,'Reduced motion creates no visual sheet');
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await reset(r);await r.locator('.amv-reader__image').nth(5).evaluate(img=>{img.src='https://example.test/offscreen-delayed.svg';});
  await click(r,'next');await page.waitForTimeout(50);
  await r.locator('.amv-reader__image').nth(5).evaluate(img=>img.dispatchEvent(new Event('load')));
  check(await r.getAttribute('aria-busy')==='true','Unrelated offscreen image loading does not interrupt the current transition');
  await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());
  await r.locator('.amv-reader__image').nth(5).evaluate(async img=>{img.src='https://example.test/animation-5.svg';await img.decode();});
  await reset(r);
  await r.locator('.amv-reader__image').nth(1).evaluate(img=>{img.src='https://example.test/delayed.svg';});
  await click(r,'next');
  check(await current(r)===1&&await r.getAttribute('aria-busy')===null,'Slow image uses immediate unlocked fallback');
  await page.waitForTimeout(750);check(await current(r)===1,'Late load cannot rewind navigation');
  await reset(r);await r.locator('.amv-reader__image').nth(1).evaluate(img=>{img.src='https://example.test/broken.svg';});
  await page.waitForTimeout(40);await click(r,'next');
  check(await current(r)===1&&await r.getAttribute('aria-busy')===null,'Broken image never leaves a lock');
  await r.locator('.amv-reader__image').nth(1).evaluate(async img=>{img.src='https://example.test/animation-1.svg';await img.decode();});
  await page.setViewportSize({width:390,height:850});await page.waitForTimeout(80);
  for(const layout of ['single','spread','auto'])for(const binding of ['rtl','ltr'])for(const effect of ['fade','slide']){
   const v=viewer(layout,binding,effect);await reset(v);await click(v,'next');
   check(await v.getAttribute('aria-busy')==='true','Small viewport starts '+effect);
   await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await v.elementHandle());
   check(await current(v)===1,'Small viewport page position');
   check(await v.evaluate(r=>window.aiMangaViewer.getInstance(r).getVisiblePages().length)===1,'Narrow spread/auto uses existing single-page fallback');
  }
  await reset(r);
  await r.evaluate(r=>{r.querySelector('.amv-reader__transition-content').animate=()=>{throw new Error('fixture animation failure');};});
  await click(r,'next');
  check(await current(r)===1&&await r.getAttribute('aria-busy')===null,'Animation API failure settles without stale lock');
  check(await r.locator('.amv-reader__transition-sheet').count()===0,'Animation API failure removes temporary visuals');
  // Read-only Pro frontend compatibility reference; no SDK or real REST endpoint.
  const pro=viewer('single','ltr','fade');await reset(pro);
  await pro.evaluate(r=>{
   window.aiMangaViewerCapabilities={analytics:{collection:true}};
   window.aiMangaViewerProAnalytics={enabled:true,restUrl:'https://example.test/wp-json/ai-manga-viewer/v1/events'};
   window.IntersectionObserver=undefined;r.dataset.analyticsSource='library';r.proEvents=[];
   r.addEventListener('amv:reader-event',e=>r.proEvents.push(e.detail));
   r.querySelectorAll('.fixture-cta').forEach((a,i)=>{a.dataset.ctaKey='cta-'+i;a.dataset.amvCtaInstance=r.dataset.instanceKey;a.dataset.amvCtaPage=String(i);});
  });
  await page.route('https://example.test/wp-json/ai-manga-viewer/v1/events',route=>route.fulfill({status:202,contentType:'application/json',body:'{"accepted":true}'}));
  await page.addScriptTag({path:path.resolve(root,'../AI Manga Viewer Pro/assets/analytics/frontend.js')});
  await page.addScriptTag({path:path.resolve(root,'../AI Manga Viewer Pro/assets/cta/frontend.js')});
  await click(pro,'next');await click(pro,'next');
  await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await pro.elementHandle());
  await pro.locator('.amv-reader__page.is-active .fixture-cta').evaluate(a=>a.click());
  const counts=await pro.evaluate(r=>({starts:r.proEvents.filter(e=>e.name==='read_start').length,reaches:r.proEvents.filter(e=>e.name==='page_reach').map(e=>e.pageKey),clicks:r.proEvents.filter(e=>e.name==='cta_click').length,impressions:r.proEvents.filter(e=>e.name==='viewer_impression').length}));
  check(counts.starts===1,'Pro read_start emitted once');
  check(counts.reaches.length===2&&new Set(counts.reaches).size===2,'Pro page_reach has no duplicated old/new page');
  check(counts.clicks===1,'Pro CTA click emitted once');
  check(counts.impressions===1,'Pro viewer impression emitted once');
  check(errors.length===0,errors.join('\n'));
  console.log('PASS: '+assertions+' local-browser assertions; four effects, binding/direction, simultaneous gapless spreads, inputs, CTA/event uniqueness, legacy, interrupts, reduced motion and slow/broken images. Fullscreen API mocked; read-only Pro frontend reference; no SDK or real WordPress/DB/network.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
