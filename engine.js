(function(root){
'use strict';
const COLORS={red:{name:'빨강',hex:'#f16c64'},blue:{name:'파랑',hex:'#648eee'},yellow:{name:'노랑',hex:'#edbe48'},green:{name:'초록',hex:'#63b88b'},purple:{name:'보라',hex:'#a480d1'},orange:{name:'주황',hex:'#ed9653'}};
const DIR={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]};
const clone=value=>JSON.parse(JSON.stringify(value));
const key=(x,y)=>x+','+y;
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function dimensions(cells){return {width:Math.max(...cells.map(c=>c[0]))+1,height:Math.max(...cells.map(c=>c[1]))+1};}
function normalizeShape(cells){
 if(!Array.isArray(cells)||!cells.length||cells.length>36)throw Error('블록은 1~36칸으로 그려주세요.');
 for(const c of cells)if(!Array.isArray(c)||c.length!==2||!integer(c[0],-14,14)||!integer(c[1],-14,14))throw Error('블록 칸 좌표가 올바르지 않습니다.');
 const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
 const out=[...new Map(cells.map(c=>[key(c[0]-minX,c[1]-minY),[c[0]-minX,c[1]-minY]])).values()].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 const dim=dimensions(out);if(dim.width>6||dim.height>6)throw Error('블록의 가로·세로는 최대 6칸입니다.');
 const set=new Set(out.map(c=>key(...c))),seen=new Set([key(...out[0])]),queue=[out[0]];
 for(let i=0;i<queue.length;i++)for(const [dx,dy]of Object.values(DIR)){const c=[queue[i][0]+dx,queue[i][1]+dy],k=key(...c);if(set.has(k)&&!seen.has(k)){seen.add(k);queue.push(c);}}
 if(seen.size!==out.length)throw Error('블록의 모든 칸이 상하좌우로 이어져야 합니다.');
 return out;
}
function rotate(cells){return normalizeShape(cells.map(([x,y])=>[-y,x]));}
function floorSet(map){return new Set(map.floor.map(c=>key(...c)));}
function occupied(blocks,except){const set=new Set();for(const b of blocks)if(b.id!==except)for(const [x,y]of b.cells)set.add(key(b.x+x,b.y+y));return set;}
function fits(map,blocks,b){const floor=floorSet(map),busy=occupied(blocks,b.id);return b.cells.every(([x,y])=>floor.has(key(b.x+x,b.y+y))&&!busy.has(key(b.x+x,b.y+y)));}
function gateEdges(g){return Array.from({length:g.length},(_,i)=>[g.x+(g.side==='top'||g.side==='bottom'?i:0),g.y+(g.side==='left'||g.side==='right'?i:0)]);}
function aligned(b,g){const d=dimensions(b.cells);if(g.side==='left')return b.x===g.x&&b.y>=g.y&&b.y+d.height<=g.y+g.length;if(g.side==='right')return b.x+d.width-1===g.x&&b.y>=g.y&&b.y+d.height<=g.y+g.length;if(g.side==='top')return b.y===g.y&&b.x>=g.x&&b.x+d.width<=g.x+g.length;return b.y+d.height-1===g.y&&b.x>=g.x&&b.x+d.width<=g.x+g.length;}
function canExit(map,blocks,b,g){
 if(!g||b.color!==g.color||!aligned(b,g))return false;
 const floor=floorSet(map),busy=occupied(blocks,b.id),[dx,dy]=DIR[g.side],d=dimensions(b.cells),depth=dx?d.width:d.height;
 for(let step=1;step<=depth;step++)for(const [cx,cy]of b.cells){
  const x=b.x+cx+dx*step,y=b.y+cy+dy*step;
  const outside=g.side==='left'?x<g.x:g.side==='right'?x>g.x:g.side==='top'?y<g.y:y>g.y;
  if(!outside&&(!floor.has(key(x,y))||busy.has(key(x,y))))return false;
 }
 return true;
}
function step(map,blocks,id,dx,dy,allowExit=true){
 if(Math.abs(dx)+Math.abs(dy)!==1)return {ok:false};
 const b=blocks.find(b=>b.id===id);if(!b)return {ok:false};
 if(allowExit)for(const g of map.gates){const dir=DIR[g.side];if(dir[0]===dx&&dir[1]===dy&&canExit(map,blocks,b,g))return {ok:true,exit:true,gateId:g.id};}
 const moved={...b,x:b.x+dx,y:b.y+dy};return fits(map,blocks,moved)?{ok:true,block:moved}:{ok:false};
}
function insert(map,blocks,cells,color,gateId,offset,id){
 cells=normalizeShape(cells);const g=map.gates.find(g=>g.id===gateId);if(!g||g.color!==color)throw Error('같은 색 입구를 선택하세요.');
 const d=dimensions(cells),span=g.side==='left'||g.side==='right'?d.height:d.width;
 if(g.length<span)throw Error('이 블록에는 '+span+'칸 이상 입구가 필요합니다.');
 if(!integer(offset,0,g.length-span))throw Error('입구 안의 시작 위치를 확인하세요.');
 const b={id:String(id),color,cells,x:g.x,y:g.y};
 if(g.side==='left')b.y+=offset;if(g.side==='right'){b.x-=d.width-1;b.y+=offset;}if(g.side==='top')b.x+=offset;if(g.side==='bottom'){b.y-=d.height-1;b.x+=offset;}
 if(!fits(map,blocks,b)||!canExit(map,blocks,b,g))throw Error('입구 안쪽 공간이 막혀 있습니다. 먼저 블록을 옮겨주세요.');
 return b;
}
function validateMap(input){
 if(!input||typeof input!=='object'||input.schemaVersion!==1)throw Error('지원하지 않는 맵 형식입니다.');
 if(!integer(input.width,3,14)||!integer(input.height,3,14))throw Error('맵 크기는 가로·세로 3~14칸입니다.');
 if(!/^[\w-]{1,80}$/.test(input.id))throw Error('맵 ID가 올바르지 않습니다.');
 const map={schemaVersion:1,id:input.id,name:String(input.name||'이름 없는 맵').trim().slice(0,60),width:input.width,height:input.height,floor:[],gates:[],blocks:[],solution:[],modifiedAt:typeof input.modifiedAt==='string'?input.modifiedAt.slice(0,40):''};
 if(!Array.isArray(input.floor)||!input.floor.length||input.floor.length>196)throw Error('바닥을 1칸 이상 그려주세요.');
 const seen=new Set();for(const c of input.floor){if(!Array.isArray(c)||c.length!==2||!integer(c[0],0,map.width-1)||!integer(c[1],0,map.height-1))throw Error('바닥 좌표가 올바르지 않습니다.');const k=key(...c);if(seen.has(k))throw Error('바닥 칸이 중복됩니다.');seen.add(k);map.floor.push([...c]);}
 if(!Array.isArray(input.gates)||input.gates.length>80)throw Error('입구 설정을 확인하세요.');
 const edges=new Set(),gateIds=new Set();for(const g of input.gates){
  if(!g||!Object.hasOwn(DIR,g.side)||!Object.hasOwn(COLORS,g.color)||!integer(g.x,0,map.width-1)||!integer(g.y,0,map.height-1)||!integer(g.length,1,14)||!/^[-\w]{1,80}$/.test(String(g.id))||gateIds.has(String(g.id)))throw Error('입구 설정을 확인하세요.');
  const gate={id:String(g.id),side:g.side,color:g.color,x:g.x,y:g.y,length:g.length};gateIds.add(gate.id);
  for(const [x,y]of gateEdges(gate)){const [dx,dy]=DIR[g.side],k=key(x,y)+','+g.side;if(!seen.has(key(x,y))||seen.has(key(x+dx,y+dy))||edges.has(k))throw Error('입구는 바닥의 노출된 가장자리에 겹치지 않게 그려주세요.');edges.add(k);}
  map.gates.push(gate);
 }
 if(!Array.isArray(input.blocks)||input.blocks.length>64)throw Error('블록은 최대 64개입니다.');
 const blockIds=new Set();for(const b of input.blocks){
  if(!b||!Object.hasOwn(COLORS,b.color)||!integer(b.x,0,map.width-1)||!integer(b.y,0,map.height-1)||!/^[-\w]{1,80}$/.test(String(b.id))||blockIds.has(String(b.id)))throw Error('블록 설정을 확인하세요.');
  const block={id:String(b.id),color:b.color,x:b.x,y:b.y,cells:normalizeShape(b.cells)};if(!fits(map,map.blocks,block))throw Error('블록이 바닥 밖에 있거나 서로 겹칩니다.');blockIds.add(block.id);map.blocks.push(block);
 }
 if(input.solution!==undefined){if(!Array.isArray(input.solution)||input.solution.length>5000)throw Error('풀이 기록은 최대 5000수입니다.');for(const a of input.solution){if(!a||!blockIds.has(String(a.blockId))||!['move','exit'].includes(a.type))throw Error('풀이 기록이 올바르지 않습니다.');if(a.type==='move'){if(!integer(a.dx,-1,1)||!integer(a.dy,-1,1)||Math.abs(a.dx)+Math.abs(a.dy)!==1)throw Error('이동 기록을 확인하세요.');map.solution.push({type:'move',blockId:String(a.blockId),dx:a.dx,dy:a.dy});}else{if(!gateIds.has(String(a.gateId)))throw Error('출구 기록을 확인하세요.');map.solution.push({type:'exit',blockId:String(a.blockId),gateId:String(a.gateId)});}}}
 return map;
}
function reverseSolution(history){return [...history].reverse().map(a=>a.type==='move'?{type:'move',blockId:a.blockId,dx:-a.dx,dy:-a.dy}:{type:'exit',blockId:a.blockId,gateId:a.gateId});}
function verifySolution(input){
 try{const map=validateMap(input),blocks=clone(map.blocks);if(!blocks.length)return {ok:false,reason:'블록을 입구에서 추가하세요.'};if(!map.solution.length)return {ok:false,reason:'역순 제작 기록이 없습니다.'};
  for(const a of map.solution){const b=blocks.find(b=>b.id===a.blockId);if(!b)throw Error('풀이 대상 블록이 없습니다.');if(a.type==='move'){const r=step(map,blocks,b.id,a.dx,a.dy,false);if(!r.ok)throw Error('기록한 이동 경로가 막혀 있습니다.');Object.assign(b,r.block);}else{const g=map.gates.find(g=>g.id===a.gateId);if(!canExit(map,blocks,b,g))throw Error('기록한 출구로 탈출할 수 없습니다.');blocks.splice(blocks.indexOf(b),1);}}
  return blocks.length?{ok:false,reason:'모든 블록이 탈출하지 않았습니다.'}:{ok:true,moves:map.solution.length};
 }catch(e){return {ok:false,reason:e.message};}
}
function historyFromMap(map){const blocks=clone(map.blocks),actions=[];for(const a of map.solution){const b=blocks.find(b=>b.id===a.blockId);if(!b)throw Error('풀이 기록 오류');if(a.type==='move'){actions.push({type:'move',blockId:b.id,dx:-a.dx,dy:-a.dy});b.x+=a.dx;b.y+=a.dy;}else{actions.push({type:'insert',blockId:b.id,gateId:a.gateId,block:clone(b)});blocks.splice(blocks.indexOf(b),1);}}return actions.reverse();}
function fullFloor(w,h){return Array.from({length:w*h},(_,i)=>[i%w,Math.floor(i/w)]);}
function validateCatalog(input){if(!input||input.schemaVersion!==1||!Array.isArray(input.maps)||input.maps.length>100)throw Error('맵 목록 형식을 확인하세요.');const ids=new Set();const maps=input.maps.map(x=>{const m=validateMap(x);if(ids.has(m.id))throw Error('맵 ID가 중복됩니다.');ids.add(m.id);return m;});return {schemaVersion:1,revision:String(input.revision||'').slice(0,80),updatedAt:String(input.updatedAt||'').slice(0,40),maps};}
const api={COLORS,DIR,clone,key,dimensions,normalizeShape,rotate,floorSet,occupied,fits,gateEdges,canExit,step,insert,validateMap,reverseSolution,verifySolution,historyFromMap,fullFloor,validateCatalog};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BlockEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
