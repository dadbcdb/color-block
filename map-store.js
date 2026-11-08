(function(root){
'use strict';
const E=root.BlockEngine||(typeof require==='function'?require('./engine.js'):null);
const REPO='dadbcdb/color-block',KEY='colorExitMapCatalog.v1',MAX_BYTES=850000;
function bytes(text){return new TextEncoder().encode(text).length;}
function decode64(content){const binary=atob(content.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}
function encode64(text){const data=new TextEncoder().encode(text);let binary='';for(let i=0;i<data.length;i+=16384)binary+=String.fromCharCode(...data.subarray(i,i+16384));return btoa(binary);}
const empty=()=>({schemaVersion:1,revision:'',updatedAt:'',maps:[]});
function parse(text){if(bytes(text)>MAX_BYTES)throw Error('맵 목록이 너무 큽니다.');return E.validateCatalog(JSON.parse(text));}
function loadSaved(){try{return parse(localStorage.getItem(KEY)||JSON.stringify(empty()));}catch{return empty();}}
let catalog=typeof localStorage!=='undefined'?loadSaved():empty(),listeners=[],pending=null,lastAttempt=0;
function persist(next){catalog=E.clone(next);let stored=true;try{localStorage.setItem(KEY,JSON.stringify(catalog));}catch{stored=false;}return stored;}
function emit(info){for(const fn of listeners)fn(E.clone(catalog),info);}
async function readURL(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('맵 받기 실패');return parse(await r.text());}finally{clearTimeout(timer);}}
async function sync(force=false){
 if(pending)return pending;if(!force&&Date.now()-lastAttempt<30000)return {changed:false,catalog:E.clone(catalog)};lastAttempt=Date.now();
 pending=(async()=>{try{
  let next;try{next=await readURL('https://raw.githubusercontent.com/'+REPO+'/main/maps/catalog.json?v='+Date.now());}catch{next=await readURL(new URL('maps/catalog.json?v='+Date.now(),location.href).href);}
  if(catalog.updatedAt&&next.updatedAt<catalog.updatedAt)return {changed:false,stored:true,online:true,catalog:E.clone(catalog)};const changed=JSON.stringify(next)!==JSON.stringify(catalog),stored=persist(next);const info={changed,stored,online:true};emit(info);return {...info,catalog:E.clone(catalog)};
 }catch{const info={changed:false,stored:true,online:false};emit(info);return {...info,catalog:E.clone(catalog)};}finally{pending=null;}})();return pending;
}
function subscribe(fn){listeners.push(fn);return ()=>listeners=listeners.filter(x=>x!==fn);}
function startAutoSync(){sync();window.addEventListener('online',()=>sync(true));window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(()=>{if(!document.hidden)sync()},120000);}
class ConflictError extends Error{}
async function apiRead(token){
 const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/maps/catalog.json?ref=main',{cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});
 if(r.status===404)return {catalog:empty(),sha:null};if(!r.ok)throw Error(r.status===401?'GitHub 연결 키를 확인하세요.':'저장소의 맵 목록을 읽을 수 없습니다. 저장소 접근 권한을 확인하세요.');
 const d=await r.json();if(d.encoding!=='base64'||typeof d.content!=='string')throw Error('맵 목록을 읽을 수 없습니다.');return {catalog:parse(decode64(d.content)),sha:d.sha};
}
async function saveMap(input,token,baseModifiedAt=''){
 if(typeof token!=='string'||!token.trim())throw Error('먼저 GitHub 저장 연결을 설정하세요.');
 const map=E.validateMap(input),verification=E.verifySolution(map);if(!verification.ok)throw Error('풀이 검증: '+verification.reason);
 for(let attempt=0;attempt<2;attempt++){
  const current=await apiRead(token),existing=current.catalog.maps.find(m=>m.id===map.id);
  if((existing&&existing.modifiedAt!==baseModifiedAt)||(!existing&&baseModifiedAt))throw new ConflictError('다른 곳에서 이 맵이 바뀌었습니다. 최신 맵을 불러오거나 복사해서 저장하세요.');
  const written={...map,modifiedAt:new Date(Math.max(Date.now(),Date.parse(current.catalog.updatedAt)||0)+1).toISOString()},next={schemaVersion:1,revision:crypto.randomUUID(),updatedAt:written.modifiedAt,maps:existing?current.catalog.maps.map(m=>m.id===map.id?written:m):current.catalog.maps.concat(written)};
  const text=JSON.stringify(next);if(bytes(text)>MAX_BYTES||next.maps.length>100)throw Error('맵 목록 저장 한도를 넘었습니다.');
  const body={message:'Save map: '+map.name,branch:'main',content:encode64(text)};if(current.sha)body.sha=current.sha;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let r;
  try{r=await fetch('https://api.github.com/repos/'+REPO+'/contents/maps/catalog.json',{method:'PUT',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});}catch{throw Error('저장 결과를 확인하지 못했습니다. 최신 맵 목록을 확인한 뒤 다시 시도하세요.');}finally{clearTimeout(timer);}
  if(r.status===409&&attempt===0)continue;
  if(!r.ok)throw Error(r.status===401?'GitHub 연결 키를 확인하세요.':r.status===403?'이 저장소의 Contents 쓰기 권한이 필요합니다.':r.status===409?'동시에 맵이 변경됐습니다. 최신 맵을 다시 불러오세요.':'GitHub 저장에 실패했습니다. 연결과 권한을 확인하세요.');
  const result=await r.json();const stored=persist(next);emit({changed:true,stored,online:true});return {map:written,commitUrl:result.commit?.html_url||'',stored};
 }
}
const api={REPO,KEY,MAX_BYTES,parse,getCatalog:()=>E.clone(catalog),subscribe,sync,startAutoSync,saveMap,ConflictError,encode64,decode64};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MapStore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
