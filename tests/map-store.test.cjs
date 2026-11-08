const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),E=require('../engine.js');
const source=fs.readFileSync(__dirname+'/../map-store.js','utf8'),seed=JSON.parse(fs.readFileSync(__dirname+'/fixtures/catalog.json','utf8'));
test('saving retries a catalog conflict without losing another map or storing credentials',async()=>{
 const storage=new Map();let catalog=E.clone(seed),sha='one',attempts=0;const target=E.clone(seed.maps[0]);target.id='new-map';target.name='새 맵';target.modifiedAt='';
 const peer={...E.clone(seed.maps[0]),id:'peer-map',name:'다른 PC의 맵'};
 const fetch=async(url,options={})=>{
  if(url.includes('/contents/')){assert.equal(options.headers.Authorization,'Bearer dummy-test-key');if(options.method!=='PUT')return new Response(JSON.stringify({encoding:'base64',sha,content:Buffer.from(JSON.stringify(catalog)).toString('base64')}));
   attempts++;if(attempts===1){catalog.maps.push(peer);sha='two';return new Response('{}',{status:409});}
   const body=JSON.parse(options.body);assert.equal(body.sha,'two');catalog=JSON.parse(Buffer.from(body.content,'base64').toString());return new Response(JSON.stringify({commit:{html_url:'https://github.com/example/test'}}));
  }
  return new Response('invalid-json');
 };
 const context=vm.createContext({BlockEngine:E,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},TextEncoder,TextDecoder,AbortController,URL,Response,atob,btoa,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fetch,location:{href:'https://example.test/color-block/'}});
 vm.runInContext(source,context);const store=context.MapStore;
 await store.saveMap(target,'dummy-test-key','');assert.equal(attempts,2);assert.equal(catalog.maps.length,3);assert.ok(catalog.maps.some(m=>m.id==='peer-map'));assert.equal(JSON.stringify([...storage.values()]).includes('dummy-test-key'),false);
 const existing=catalog.maps.find(m=>m.id==='new-map');await assert.rejects(store.saveMap(existing,'dummy-test-key','old-revision'),/다른 곳에서/);assert.equal(attempts,2);
 const before=JSON.stringify(store.getCatalog());const result=await store.sync(true);assert.equal(result.online,false);assert.equal(JSON.stringify(store.getCatalog()),before,'invalid remote data cannot wipe offline maps');
});
