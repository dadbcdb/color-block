// Optional mobile regression: npm install --no-save playwright@1.56.1; npx playwright install chromium --only-shell; node tests/mobile-layout.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const appRoot=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(file==='/')file='/index.html';const location=path.join(appRoot,file);try{const mime=file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'image/jpeg';res.setHeader('Content-Type',mime);res.end(fs.readFileSync(location));}catch{res.statusCode=404;res.end('Not found')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const tested=[];
 for(const [width,height] of [[320,568],[360,640],[390,664],[412,700],[430,760],[1280,800]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:true});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForSelector('.block');
  await page.waitForFunction(()=>document.querySelector('.frame').style.width!=='');
  const geometry=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
   return {viewport:{width:innerWidth,height:innerHeight},board:rect('#board'),controls:rect('.pad'),status:rect('.offline-panel'),scrollHeight:document.scrollingElement.scrollHeight,scrollY};
  });
  assert.ok(geometry.scrollHeight<=height+1,JSON.stringify(geometry));
  assert.ok(geometry.board.width>100);assert.ok(Math.abs(geometry.board.width/geometry.board.height-5/6)<.01);
  assert.ok(geometry.status.bottom<=height+1);assert.ok(geometry.controls.bottom<=height+1);
  const session=await context.newCDPSession(page);
  const block=page.locator('[data-id="3"]');const rect=await block.boundingBox();const start={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  const distance=geometry.board.width/5;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let step=1;step<=5;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+distance*step/5,y:start.y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('#moves').textContent==='1');
  assert.equal(await page.evaluate(()=>scrollY),0);
  await page.mouse.wheel(0,600);assert.equal(await page.evaluate(()=>scrollY),0);
  const blue=await page.locator('[data-id="1"]').boundingBox();const bstart={x:blue.x+blue.width/2,y:blue.y+blue.height/2};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[bstart]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bstart.x,y:bstart.y-distance}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('#left').textContent==='6');assert.equal(await page.evaluate(()=>scrollY),0);
  await page.locator('#undo').click();assert.equal(await page.locator('#left').textContent(),'7');
  await page.locator('#help').click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),true);
  await page.locator('#close-help').click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
  assert.deepEqual(errors,[]);tested.push({width,height,boardWidth:geometry.board.width,scrollY:0});
  if(width===412){await page.waitForFunction(()=>document.querySelector('#offline-status').dataset.state==='ready');await context.setOffline(true);await page.reload();await page.waitForSelector('.block');assert.equal(await page.evaluate(()=>scrollY),0);}
  await context.close();
 }
 console.log(JSON.stringify({passed:true,viewports:tested,nativeTouch:'move and exit',wheel:'no page scroll',help:'opens and closes',offline:'reload passed'}));
 await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
