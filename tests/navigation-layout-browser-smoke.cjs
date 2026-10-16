const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const pro = path.resolve(root, '../AI Manga Viewer Pro');
const fixture = process.env.MANGAFOCUS_NAV_FIXTURE || path.join(__dirname, 'navigation-layout-smoke.php');
const baselineCss = process.env.MANGAFOCUS_NAV_BASELINE_CSS || path.join(root, 'blocks/viewer/style.css');
const cases = [
 {name:'wide',width:1280,column:1100,outside:true},
 {name:'narrow',width:1280,column:340,outside:false},
 {name:'tight-gutter',width:1280,column:774,outside:false},
 {name:'phone',width:390,column:1100,outside:false,zoom:true},
 {name:'phone-landscape',width:844,column:1100,outside:true},
 {name:'tablet',width:768,column:1100,outside:false},
 {name:'full-width-image',width:1280,column:1100,maxWidth:1600,outside:false},
 {name:'spread',width:1700,column:1650,layout:'spread',outside:true},
 {name:'spread-narrow',width:844,column:800,layout:'spread',outside:true,afterOutside:false},
 {name:'landscape-pages',width:1280,column:1100,layout:'spread',landscape:true,outside:true},
 {name:'side-zoom',width:1280,column:1100,zoom:true,side:'right',outside:false},
 {name:'legacy',width:1280,column:1100,legacy:true,outside:true},
 {name:'clipped-parent',width:1280,column:1100,clip:true,outside:false},
 {name:'paint-contained-parent',width:1280,column:1100,clip:true,paint:true,outside:false}
];
const overlaps = (a,b) => !!a && !!b && Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5;
(async()=>{
 const browser = await chromium.launch({channel:'msedge',headless:true}); const results=[];
 try {
  async function setup(config) {
   const page = await browser.newPage({viewport:{width:config.width,height:900},reducedMotion:'reduce'}), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=route.request().url();
    if(url==='https://example.test/events') return route.fulfill({status:202,contentType:'application/json',body:'{"accepted":true,"duplicate":false}'});
    if(url.startsWith('https://example.test/')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="'+(url.includes('wide')||url.includes('901')?'1200" height="600':'600" height="900')+'"/>'});
    return route.abort();
   });
   const html=execFileSync(process.env.MANGAFOCUS_PHP||'php',[fixture,JSON.stringify(config),'--pro-cta-fixture'],{encoding:'utf8',env:process.env}).replaceAll('loading="lazy"','loading="eager"');
   await page.setContent(html);
   await page.evaluate(()=>{
    window.wp={i18n:{__:s=>s}};window.navEvents=[];window.readerEvents=[];
    window.aiMangaViewerCapabilities={analytics:{collection:true}};window.aiMangaViewerProAnalytics={enabled:true,restUrl:'https://example.test/events'};
    document.querySelectorAll('.amv-reader').forEach(el=>el.dataset.analyticsSource='library');
    for(const name of ['amv:viewer-viewchange','amv:viewer-interaction','amv:viewer-fullscreenchange'])document.addEventListener(name,e=>window.navEvents.push({name,detail:e.detail}));
    document.addEventListener('amv:reader-event',e=>window.readerEvents.push({name:e.detail.name,page:e.detail.pageIndex,mode:e.detail.mode}));
    let active=null;Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>active});
    document.exitFullscreen=()=>{active=null;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
    HTMLElement.prototype.requestFullscreen=function(){active=this;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
   });
   await page.addStyleTag({path:baselineCss});
   await page.addStyleTag({path:path.join(root,'assets/panel-reader/style.css')});
   await page.addStyleTag({path:path.join(pro,'assets/cta/style.css')});
   await page.addStyleTag({content:'.amv-reader.is-fullscreen{position:fixed!important;inset:0!important;z-index:100000}'});
   for(const js of [path.join(pro,'assets/analytics/frontend.js'),path.join(pro,'assets/cta/frontend.js'),path.join(root,'blocks/viewer/layout.js'),path.join(root,'blocks/viewer/view.js'),path.join(root,'assets/panel-reader/frontend.js')])await page.addScriptTag({path:js});
   const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await settle();
   const reader=page.locator('#reader-a .amv-reader'),other=page.locator('#reader-b .amv-reader');
   const originalWidth=(await reader.locator('.amv-reader__image').first().boundingBox()).width;
   const originalCta=await reader.locator('.amv-reader__cta').first().boundingBox();
   await page.addStyleTag({path:path.join(root,'blocks/viewer/style.css')});
   if(config.clip)await reader.evaluate((el,paint)=>{const wrapper=document.createElement('div');wrapper.style.cssText='width:700px;margin:auto;'+(paint?'contain:paint':'overflow:hidden');el.style.minWidth='1100px';el.style.marginLeft='-200px';el.before(wrapper);wrapper.appendChild(el)},!!config.paint);
   await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await settle();
   return {page,reader,other,errors,settle,originalWidth,originalCta};
  }
  for(const config of cases)for(const binding of ['rtl','ltr']) {
   const c={...config,binding,ctaX:binding==='rtl'?12:88};const {page,reader,other,errors,settle,originalWidth,originalCta}=await setup(c);
   const state=()=>reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getState());
   const otherBefore=await other.evaluate(el=>window.aiMangaViewer.getInstance(el).getState());
   assert.equal(await reader.evaluate(el=>el.classList.contains('is-inline-navigation-outside')),c.outside,c.name+' placement');
   const viewport=await reader.locator('.amv-reader__pages').boundingBox(),next=reader.locator('.amv-reader__edge--next'),previous=reader.locator('.amv-reader__edge--previous');
   const nb=await next.boundingBox(),pb=await previous.boundingBox();
   assert.equal(overlaps(nb,viewport)||overlaps(pb,viewport),false,c.name+' real button hit boxes must be outside image viewport');
   assert.ok(nb.width>=44&&nb.height>=44&&pb.width>=44&&pb.height>=44,c.name+' target sizes');
   assert.ok(binding==='rtl'?nb.x<pb.x:nb.x>pb.x,c.name+' binding order');
   assert.ok(c.outside ? nb.x+nb.width<=viewport.x || nb.x>=viewport.x+viewport.width : nb.y>=viewport.y+viewport.height,c.name+' position');
   const width=(await reader.locator('.amv-reader__image').first().boundingBox()).width;
   if(!c.clip)assert.ok(Math.abs(width-originalWidth)<1,c.name+' original image width');
   const cta=reader.locator('.amv-reader__page.is-active .amv-reader__cta');
   const ctaBox=await cta.boundingBox();assert.equal(overlaps(nb,ctaBox)||overlaps(pb,ctaBox),false,c.name+' CTA unobstructed');
   if(!c.clip){assert.ok(Math.abs(ctaBox.x-originalCta.x)<1&&Math.abs(ctaBox.y-originalCta.y)<1,c.name+' CTA position unchanged')}
   await cta.evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));
   await cta.click({position:{x:binding==='rtl'?Math.min(5,ctaBox.width/2):ctaBox.width-Math.min(5,ctaBox.width/2),y:ctaBox.height/2}});await settle();
   assert.equal((await state()).currentPage.index,0,c.name+' edge CTA must not navigate');
   assert.equal(await page.evaluate(()=>window.readerEvents.filter(e=>e.name==='cta_click').length),1,c.name+' CTA analytics');
   const eventStart=await page.evaluate(()=>window.navEvents.length);
   await next.click();await settle();await page.waitForFunction(()=>window.aiMangaViewer.getInstance(document.querySelector('#reader-a .amv-reader')).getCurrentPage().index===1);
   const navEvents=await page.evaluate(start=>window.navEvents.slice(start).filter(e=>e.detail.identity.instanceKey==='reader-a'),eventStart);
   assert.equal(navEvents.filter(e=>e.name==='amv:viewer-viewchange').length,1,c.name+' exactly one view change');
   assert.equal(navEvents.filter(e=>e.name==='amv:viewer-interaction'&&e.detail.action==='read').length,1,c.name+' exactly one read action');
   assert.equal(await page.evaluate(()=>window.readerEvents.filter(e=>e.name==='read_start').length),1,c.name+' one read_start');
   if(c.afterOutside!==undefined)assert.equal(await reader.evaluate(el=>el.classList.contains('is-inline-navigation-outside')),c.afterOutside,c.name+' spread width changes placement');
   async function assertNoOverlap(){const image=await reader.locator('.amv-reader__pages').boundingBox();assert.equal(overlaps(await next.boundingBox(),image)||overlaps(await previous.boundingBox(),image),false,c.name+' guide hit rectangles on every view');}
   await assertNoOverlap();
   let steps=1;
   while(!await next.isDisabled()) {await next.click();await settle();steps++;await assertNoOverlap();assert.ok(steps<=6,'Navigation must reach an end');}
   assert.equal((await state()).visiblePages.some(p=>p.index===5),true,c.name+' final page');
   const ended=(await state()).currentPage.index;await next.evaluate(el=>el.click());assert.equal((await state()).currentPage.index,ended,c.name+' disabled next');
   while(!await previous.isDisabled()){await previous.click();await settle();}
   assert.equal((await state()).currentPage.index,0,c.name+' back to start');
   assert.deepEqual(await other.evaluate(el=>window.aiMangaViewer.getInstance(el).getState()),otherBefore,c.name+' other Viewer unchanged');
   if(c.name==='wide'&&binding==='rtl'){await page.setViewportSize({width:390,height:900});await settle();assert.equal(await reader.evaluate(el=>el.classList.contains('is-inline-navigation-below')),true,'Resize to narrow');await assertNoOverlap();await page.setViewportSize({width:1280,height:900});await settle();assert.equal(await reader.evaluate(el=>el.classList.contains('is-inline-navigation-outside')),true,'Resize back to wide');}
   if(c.zoom){await reader.locator('.amv-reader__zoom-in').click();await settle();assert.equal(await next.isVisible(),false,c.name+' zoom uses original zoom navigation');await reader.locator('.amv-reader__zoom-reset').click();await settle();assert.equal(await next.isVisible(),true);}
   // Native fullscreen escapes ancestor clipping; the local fixed-position double cannot.
   if(c.clip){await reader.evaluate(el=>{const wrapper=el.parentElement;wrapper.before(el);wrapper.remove();el.style.minWidth='';el.style.marginLeft='';});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await settle();}
   await reader.locator('.amv-reader__fullscreen').click();await settle();
   assert.equal((await state()).fullscreen,true);
   const compact=await reader.evaluate(el=>el.classList.contains('has-compact-fullscreen-layout'));
   assert.equal(compact,c.width<=781,c.name+' compact fullscreen scope at 900px height');
   const fullEdge=await next.boundingBox(),fullViewport=await reader.locator('.amv-reader__pages').boundingBox();
   assert.equal(overlaps(fullEdge,fullViewport),!compact,c.name+' fullscreen guide hit area');
   if(compact){assert.ok(fullEdge.y>=fullViewport.y+fullViewport.height-.5,c.name+' compact guide below image');assert.ok(fullEdge.width>=44&&fullEdge.height>=44,c.name+' compact guide target size')}
   await reader.locator('.amv-reader__fullscreen').click();await settle();
   await reader.locator('.amv-reader__focus-open').click();await settle();assert.equal((await state()).readingMode,'panel');await page.locator('.amv-modal:not([hidden]) .amv-modal__close').click();await settle();
   assert.deepEqual(errors,[],c.name+' JS errors');results.push({case:c.name,binding,placement:c.outside?'outside':'below',passed:true});await page.close();
  }
  for(const guide of [false,true])for(const edge of [false,true]) {
   const {page,reader,settle,errors}=await setup({width:390,column:1100,binding:'rtl',guide,edge});const next=reader.locator('.amv-reader__edge--next'),stage=reader.locator('.amv-reader__stage');
   assert.equal(await next.isVisible(),edge,'First-page guide follows existing edge gate');
   const tap=()=>reader.locator('.amv-reader__pages').evaluate(el=>{const r=el.getBoundingClientRect();el.querySelector('img').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*.04,clientY:r.top+20}))});
   await tap();await settle();assert.equal(await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getCurrentPage().index),edge?1:0,'Image-edge setting');
   if(edge)assert.equal(await next.isVisible(),guide,'OFF means first page only, not fully hidden');
   await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).goToPage(0));await settle();
   if(edge){await next.click();await settle();if(!guide)assert.equal(await stage.evaluate(el=>document.activeElement===el),true,'Focus moves to stage when first-only cue disappears')}
   await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).goToPage(0));await settle();
   await stage.evaluate(el=>{const t=(x)=>new Touch({identifier:1,target:el,clientX:x,clientY:100});const a=t(100),b=t(180);el.dispatchEvent(new TouchEvent('touchstart',{touches:[a],changedTouches:[a]}));el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[b]}));const v=el.querySelector('.amv-reader__pages'),r=v.getBoundingClientRect();v.querySelector('img').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*.04,clientY:r.top+20}));});
   await settle();assert.equal(await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getCurrentPage().index),1,'Swipe plus compatibility click must advance once');
   await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).goToPage(0));await settle();await stage.focus();await page.keyboard.press('ArrowLeft');await settle();assert.equal(await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getCurrentPage().index),1,'Keyboard next');await page.keyboard.press('ArrowRight');await settle();assert.equal(await reader.evaluate(el=>window.aiMangaViewer.getInstance(el).getCurrentPage().index),0,'Keyboard previous');
   assert.deepEqual(errors,[]);results.push({case:'settings',guide,edge,passed:true});await page.close();
  }
  console.log('PASS: '+results.length+' navigation layout/settings cases; real hit rectangles, CTA, analytics, bindings, spread, fullscreen/panel and isolation');
  if(process.env.MANGAFOCUS_NAV_RESULTS)fs.writeFileSync(process.env.MANGAFOCUS_NAV_RESULTS,JSON.stringify({passed:true,environment:'Headless Edge; WordPress/Fullscreen doubles and synthetic touch; real layout/mouse/keyboard',results},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});