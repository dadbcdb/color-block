'use strict';
const E=BlockEngine,$=s=>document.querySelector(s),board=$('#board');
const builtinMaps=LEVELS.map((list,index)=>E.validateMap({schemaVersion:1,id:'builtin-'+(index+1),name:'스테이지 '+(index+1),width:5,height:6,floor:E.fullFloor(5,6),gates:[{id:'red',color:'red',side:'left',x:0,y:1,length:2},{id:'blue',color:'blue',side:'top',x:0,y:0,length:2},{id:'yellow',color:'yellow',side:'right',x:4,y:0,length:2},{id:'green',color:'green',side:'bottom',x:3,y:5,length:2}],blocks:list.map(b=>({id:String(b.id),color:b.color,x:b.x,y:b.y,cells:Array.from({length:b.w*b.h},(_,i)=>[i%b.w,Math.floor(i/b.w)])})),solution:[]}));
let maps=[],activeBase=null,currentMap=null,blocks=[],moves=0,history=[],selected=null,drag=null,preview=null;
let complete=new Set();try{complete=new Set(JSON.parse(localStorage.getItem('colorExitCompletedIds')||'[]'));for(const n of JSON.parse(localStorage.getItem('colorExitCompleted')||'[]'))complete.add('builtin-'+(Number(n)+1));}catch{}
const previewId=new URLSearchParams(location.search).get('preview');
if(previewId)try{const raw=JSON.parse(localStorage.getItem('colorExitEditorPreview')||'null');if(raw?.id===previewId)preview=E.validateMap(raw);}catch{}
function options(){const select=$('#levels');select.replaceChildren();for(const m of maps){const option=document.createElement('option');option.value=m.id;option.textContent=(complete.has(m.id)?'✓ ':'')+m.name;select.append(option);}if(currentMap)select.value=currentMap.id;$('#levelLabel').textContent=preview?'EDITOR TEST':'LEVEL '+String(Math.max(0,maps.findIndex(m=>m.id===currentMap?.id))+1).padStart(2,'0')+' / '+String(maps.length).padStart(2,'0');}
function applyCatalog(catalog,info={}){
 maps=preview?[preview]:builtinMaps.concat(catalog.maps.filter(m=>!m.id.startsWith('builtin-')));
 if(currentMap&&!maps.some(m=>m.id===currentMap.id))maps.push(activeBase);
 options();const count=catalog.maps.length;$('#map-sync-status').textContent=preview?'편집 중인 맵 테스트':info.stored===false?'새 맵 저장 공간이 부족해요.':info.online===false?'오프라인 · 저장한 추가 맵 '+count+'개':info.changed?'새 맵 목록 적용 · 현재 판은 유지돼요.':'추가 맵 '+count+'개 · 열 때 자동 확인';
}
function say(text){$('#note').textContent=text;}
function drawTerrain(){
 $('#frame').querySelectorAll('.gate').forEach(el=>el.remove());board.replaceChildren();
 board.style.backgroundSize=(100/currentMap.width)+'% '+(100/currentMap.height)+'%';
 const floor=E.floorSet(currentMap);
 for(let y=0;y<currentMap.height;y++)for(let x=0;x<currentMap.width;x++)if(!floor.has(E.key(x,y))){const wall=document.createElement('span');wall.className='terrain-wall';Object.assign(wall.style,{left:x/currentMap.width*100+'%',top:y/currentMap.height*100+'%',width:100/currentMap.width+'%',height:100/currentMap.height+'%'});board.append(wall);}
 for(const g of currentMap.gates){const el=document.createElement('div');el.className='gate dynamic-gate '+g.side;el.style.background=E.COLORS[g.color].hex;el.setAttribute('aria-label',E.COLORS[g.color].name+' 출구');el.textContent={left:'◀',right:'▶',top:'▲',bottom:'▼'}[g.side];el.dataset.gate=g.id;$('#frame').append(el);}
 fitGameBoard();
}
function placeGates(){if(!currentMap)return;const rect=board.getBoundingClientRect(),frame=$('#frame').getBoundingClientRect();for(const g of currentMap.gates){const el=$('#frame').querySelector('[data-gate="'+g.id+'"]');if(!el)continue;const cell=rect.width/currentMap.width,vertical=g.side==='left'||g.side==='right';Object.assign(el.style,{left:(rect.left-frame.left+g.x*cell+(g.side==='left'?-6:g.side==='right'?cell-6:0))+'px',top:(rect.top-frame.top+g.y*cell+(g.side==='top'?-6:g.side==='bottom'?cell-6:0))+'px',width:(vertical?12:g.length*cell)+'px',height:(vertical?g.length*cell:12)+'px'});}}
function startMap(id){const map=maps.find(m=>m.id===id)||maps[0];if(!map)return;drag=null;activeBase=E.clone(map);currentMap=E.clone(map);blocks=E.clone(map.blocks);moves=0;history=[];selected=null;$('#win').hidden=true;drawTerrain();options();say('블록을 밀어 같은 색 출구로 보내세요.');render();}
function render(){
 const ids=new Set(blocks.map(b=>b.id));for(const el of board.querySelectorAll('.block'))if(!ids.has(el.dataset.id)){if(drag?.id===el.dataset.id)el.hidden=true;else el.remove();}
 for(const b of blocks){let el=Array.from(board.querySelectorAll('.block')).find(el=>el.dataset.id===b.id);if(!el){el=document.createElement('button');el.dataset.id=b.id;board.append(el);}el.hidden=false;el.className='block poly-block'+(selected===b.id?' selected':'');el.setAttribute('aria-label',E.COLORS[b.color].name+' '+b.cells.length+'칸 블록');const d=E.dimensions(b.cells);
  Object.assign(el.style,{left:b.x/currentMap.width*100+'%',top:b.y/currentMap.height*100+'%',width:d.width/currentMap.width*100+'%',height:d.height/currentMap.height*100+'%',background:'transparent',padding:0,boxShadow:'none',display:'block'});
  if(el.childElementCount!==b.cells.length){el.replaceChildren();for(const [x,y]of b.cells){const tile=document.createElement('span');tile.className='poly-tile';Object.assign(tile.style,{left:'calc('+x/d.width*100+'% + 2px)',top:'calc('+y/d.height*100+'% + 2px)',width:'calc('+100/d.width+'% - 4px)',height:'calc('+100/d.height+'% - 4px)',background:E.COLORS[b.color].hex});const stud=document.createElement('span');stud.className='stud';tile.append(stud);el.append(tile);}}
 }
 $('#moves').textContent=moves;$('#left').textContent=blocks.length;$('#undo').disabled=!history.length;
}
function move(dx,dy){if(!$('#win').hidden)return false;const b=blocks.find(b=>b.id===selected);if(!b){say('먼저 움직일 블록을 선택하세요.');return false;}const result=E.step(currentMap,blocks,b.id,dx,dy);if(!result.ok){say('다른 블록을 옮겨 길을 만들어보세요.');return false;}history.push({blocks:E.clone(blocks),moves,selected});moves++;if(result.exit){blocks=blocks.filter(a=>a.id!==b.id);selected=null;say(E.COLORS[b.color].name+' 블록 탈출!');navigator.vibrate?.(15);}else{Object.assign(b,result.block);say('출구와 블록의 색을 맞춰주세요.');}render();if(!blocks.length)win();return true;}
function win(){complete.add(currentMap.id);try{localStorage.setItem('colorExitCompletedIds',JSON.stringify([...complete]));}catch{}options();$('#result').textContent=currentMap.name+' · '+moves+'번 움직여 클리어';$('#next').textContent=preview?'다시 테스트 ↻':'다음 스테이지 →';$('#win').hidden=false;say('모든 블록이 탈출했어요!');}
const usesTouchEvents='ontouchstart' in window;
function hitBlock(event){const tile=event.target.closest('.poly-tile');if(tile)return tile.closest('.block');const point=event.touches?.[0]||event,r=board.getBoundingClientRect(),x=Math.floor((point.clientX-r.left)/r.width*currentMap.width),y=Math.floor((point.clientY-r.top)/r.height*currentMap.height);const b=blocks.find(b=>b.cells.some(([cx,cy])=>b.x+cx===x&&b.y+cy===y));return b?board.querySelector('[data-id="'+b.id+'"]'):null;}
function beginDrag(el,x,y,kind,identifier){selected=el.dataset.id;drag={id:selected,x,y,kind,identifier};render();}
function advanceDrag(x,y){if(!drag||selected===null)return;const step=board.clientWidth/currentMap.width,dx=x-drag.x,dy=y-drag.y;if(Math.max(Math.abs(dx),Math.abs(dy))<step*.55)return;const horizontal=Math.abs(dx)>Math.abs(dy);const direction=Math.sign(horizontal?dx:dy),moved=move(horizontal?direction:0,horizontal?0:direction);if(!drag)return;if(moved){if(horizontal){drag.x+=direction*step;drag.y=y;}else{drag.y+=direction*step;drag.x=x;}}else{drag.x=x;drag.y=y;}}
function release(){drag=null;render();}
board.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&usesTouchEvents)return;if(drag||e.button!==0)return;const el=hitBlock(e);if(!el)return;e.preventDefault();beginDrag(el,e.clientX,e.clientY,'pointer',e.pointerId);board.setPointerCapture(e.pointerId);});
board.addEventListener('pointermove',e=>{if(!drag||drag.kind!=='pointer'||e.pointerId!==drag.identifier)return;if(e.cancelable)e.preventDefault();advanceDrag(e.clientX,e.clientY);});
function endPointer(e){if(drag?.kind==='pointer'&&e.pointerId===drag.identifier)release();}for(const type of ['pointerup','pointercancel','lostpointercapture'])board.addEventListener(type,endPointer);
board.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();if(drag||e.touches.length!==1)return;const el=hitBlock(e);if(!el)return;const t=e.changedTouches[0];beginDrag(el,t.clientX,t.clientY,'touch',t.identifier);},{passive:false});
board.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault();if(drag?.kind!=='touch')return;const t=Array.from(e.touches).find(t=>t.identifier===drag.identifier);if(t)advanceDrag(t.clientX,t.clientY);},{passive:false});
function endTouch(e){if(drag?.kind==='touch'&&!Array.from(e.touches).some(t=>t.identifier===drag.identifier))release();}board.addEventListener('touchend',endTouch);board.addEventListener('touchcancel',endTouch);
window.addEventListener('blur',()=>{if(drag)release();});
$('#undo').onclick=()=>{if(!history.length)return;const h=history.pop();blocks=h.blocks;moves=h.moves;selected=h.selected;$('#win').hidden=true;render();say('한 수 되돌렸어요.');};$('#reset').onclick=()=>startMap(currentMap.id);$('#next').onclick=()=>startMap(preview?preview.id:maps[(maps.findIndex(m=>m.id===currentMap.id)+1)%maps.length].id);$('#levels').onchange=e=>startMap(e.target.value);
for(const b of document.querySelectorAll('[data-dir]'))b.onclick=()=>move(...b.dataset.dir.split(',').map(Number));
document.addEventListener('keydown',e=>{if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();move(...d);}});
document.addEventListener('touchmove',e=>{if(!e.target.closest?.('dialog[open]')&&e.cancelable)e.preventDefault();},{passive:false,capture:true});
const playarea=document.querySelector('.playarea'),frame=$('#frame');
function fitGameBoard(){if(!currentMap)return;const width=playarea.clientWidth-40,height=playarea.clientHeight-40,cell=Math.max(0,Math.min(width/currentMap.width,height/currentMap.height));frame.style.width=(cell*currentMap.width+24)+'px';frame.style.height=(cell*currentMap.height+24)+'px';placeGates();}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitGameBoard).observe(playarea);window.addEventListener('resize',fitGameBoard);window.visualViewport?.addEventListener('resize',fitGameBoard);
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
applyCatalog(MapStore.getCatalog());startMap(preview?.id||maps[0]?.id);requestAnimationFrame(fitGameBoard);window.scrollTo(0,0);if(!preview){MapStore.subscribe(applyCatalog);MapStore.startAutoSync();}
