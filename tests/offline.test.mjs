import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const scope='https://example.test/color-block/';
function harness(){
 const events={}, stores=new Map();let online=true,failed='';
 const cacheAPI={
  async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {
   async addAll(requests){const pending=await Promise.all(requests.map(async request=>[request.url,await network(request)]));for(const [key,value]of pending)map.set(key,value)},
   async match(key){return map.get(typeof key==='string'?key:key.url)?.clone()},
   async put(key,value){map.set(key,value)}
  }},async keys(){return [...stores.keys()]},async delete(key){return stores.delete(key)}
 };
 async function network(request){const url=typeof request==='string'?request:request.url;if(!online||url.endsWith(failed||'NO_FAILURE'))throw new Error('Network unavailable');const path=new URL(url).pathname.replace('/color-block/','');return new Response(await readFile(new URL('../'+path,import.meta.url)),{status:200})}
 let claimed=false;
 const self={registration:{scope},addEventListener(name,callback){events[name]=callback},async skipWaiting(){},clients:{async claim(){claimed=true}}};
 vm.runInNewContext(source,{self,caches:cacheAPI,Request,Response,URL,fetch:network});
 async function lifecycle(type){let work;events[type]({waitUntil(p){work=p}});await work}
 return {events,stores,cacheAPI,lifecycle,setOnline(v){online=v},fail(file){failed=file},get claimed(){return claimed},async fetch(url,mode='cors',method='GET'){let work;events.fetch({request:{url,mode,method},respondWith(p){work=p}});return work?await work:undefined},async ready(){let work,result;events.message({data:{type:'CHECK_OFFLINE_READY'},ports:[{postMessage(value){result=value}}],waitUntil(p){work=p}});await work;return result.ready}};
}
test('Full game is cached and navigation/assets work without any network',async()=>{
 const h=harness();await h.lifecycle('install');await h.lifecycle('activate');assert.equal(h.claimed,true);assert.equal(await h.ready(),true);h.setOnline(false);
 const home=await h.fetch(scope,'navigate');assert.match(await home.text(),/컬러 탈출/);
 const queried=await h.fetch(scope+'?source=homescreen','navigate');assert.equal(queried.status,200);
 const explicit=await h.fetch(scope+'index.html','navigate');assert.equal(explicit.status,200);
 for(const f of ['game.js','levels.js','pwa.js','board-photo.jpg','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'])assert.equal((await h.fetch(scope+f)).status,200,f);
});
test('Incomplete downloads never report readiness',async()=>{
 const h=harness();h.fail('board-photo.jpg');await assert.rejects(h.lifecycle('install'));assert.equal(await h.ready(),false);
});
test('Activation only removes old versions for this app scope',async()=>{
 const h=harness();const old='color-exit:'+scope+':old';const neighbor='color-exit:https://example.test/other/:old';await h.cacheAPI.open(old);await h.cacheAPI.open(neighbor);await h.lifecycle('install');await h.lifecycle('activate');assert.equal(h.stores.has(old),false);assert.equal(h.stores.has(neighbor),true);
});
test('External requests, unknown routes and non-GET requests are untouched',async()=>{
 const h=harness();await h.lifecycle('install');h.setOnline(false);
 for(const url of ['https://other.test/color-block/game.js','https://example.test/elsewhere/game.js',scope+'not-a-game-file'])assert.equal(await h.fetch(url),undefined);
 assert.equal(await h.fetch(scope+'game.js','cors','POST'),undefined);
});
test('Manifest and all HTML assets use portable relative paths',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){const path=match[1];assert.ok(!path.startsWith('/')&&!path.includes('://'),path);await access(new URL('../'+path,import.meta.url));}
});
