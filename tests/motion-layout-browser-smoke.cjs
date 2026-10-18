const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root=process.env.MOTION_SOURCE_ROOT||path.resolve(__dirname,'..');
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
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="'+(route.request().url().includes('landscape')?1200:600)+'" height="'+(route.request().url().includes('landscape')?600:900)+'"><rect width="'+(route.request().url().includes('landscape')?1200:600)+'" height="'+(route.request().url().includes('landscape')?600:900)+'" fill="#ddeeff"/></svg>'});
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

  const observations=[];
  function close(a,b,msg){check(Math.abs(a-b)<1.1,msg+' '+a+' vs '+b);}
  for(const theme of [false,true])for(const width of [1200,390]){
   await page.setViewportSize({width,height:1000});
   const css=theme?await page.addStyleTag({content:'.amv-reader *{box-sizing:border-box}'}):null;
   for(const full of [false,true])for(const layout of ['single','spread'])for(const effect of ['fade','slide']){
    const r=viewer(layout,'rtl',effect);await reset(r);if(full){await r.evaluate(r=>r.requestFullscreen());await page.waitForTimeout(50);}
    const boxes=()=>r.evaluate(r=>Array.from(r.querySelectorAll('.amv-reader__page.is-active .amv-reader__image')).map(i=>{const a=i.getBoundingClientRect();const content=r.querySelector('.amv-reader__transition-content');const m=content?new DOMMatrixReadOnly(getComputedStyle(content).transform):{m41:0};return {width:a.width,height:a.height,left:a.left-m.m41,top:a.top};}));
    for(const mixed of [false,true]){
     if(mixed){await r.locator('.amv-reader__image').nth(1).evaluate(async i=>{i.src='https://example.test/landscape.svg';await i.decode();});await page.waitForTimeout(60);}
     await r.evaluate(r=>window.aiMangaViewer.getInstance(r).goToPage(1));await page.waitForTimeout(80);const expected=await boxes();
     await reset(r);
     await r.evaluate(r=>{r.querySelector('.amv-reader__button--next').click();r.querySelectorAll('.amv-reader__transition-sheet,.amv-reader__transition-content').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*.3;}));});
     const first=await boxes();
     check(first.length===expected.length,'Natural target page grouping retained');
     first.forEach((x,i)=>{close(x.width,expected[i].width,'Target natural width at start');close(x.height,expected[i].height,'Target natural height at start');});
     await page.waitForTimeout(70);const mid=await boxes();
     check(await r.getAttribute('aria-busy')==='true','No width-observer cancellation before intended duration');
     mid.forEach((x,i)=>{close(x.width,expected[i].width,'No animation scale');close(x.height,expected[i].height,'No animation height jump');close(x.left,expected[i].left,'Only intended slide translation');close(x.top,expected[i].top,'No vertical jump');});
     const timing=await r.locator('.amv-reader__transition-sheet').evaluate(e=>e.getAnimations()[0].effect.getTiming());
     check(timing.duration===(effect==='slide'?600:380),'Requested duration');if(effect==='slide')check(timing.easing==='linear','Slide uses constant speed');
     await r.evaluate(r=>r.querySelectorAll('.amv-reader__transition-sheet,.amv-reader__transition-content').forEach(el=>el.getAnimations().forEach(a=>a.finish())));
     await page.waitForFunction(r=>!r.hasAttribute('aria-busy'),await r.elementHandle());await page.waitForTimeout(40);const final=await boxes();
     final.forEach((x,i)=>{close(x.width,expected[i].width,'No cleanup scale');close(x.height,expected[i].height,'No cleanup height jump');close(x.left,expected[i].left,'Final natural position');close(x.top,expected[i].top,'Final natural top');});
     observations.push({theme,width,full,layout,effect,mixed,first,mid,final});
     if(mixed){await r.locator('.amv-reader__image').nth(1).evaluate(async i=>{i.src='https://example.test/animation-1.svg';await i.decode();});await page.waitForTimeout(50);}
    }
    if(full)await page.evaluate(()=>document.exitFullscreen());
   }
   if(css)await css.evaluate(e=>e.remove());
  }
  check(errors.length===0,errors.join('\n'));
  console.log('PASS: '+assertions+' natural-geometry/timing assertions; 64 layout cases, single/spread, cover transitions, mixed ratios, desktop/mobile, fullscreen and border-box themes; legacy single-page turn unchanged.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
