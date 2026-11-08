const $=s=>document.querySelector(s),board=$('#board');const names={red:'빨강',blue:'파랑',yellow:'노랑',green:'초록'};const copy=o=>JSON.parse(JSON.stringify(o));let level=0,blocks=[],moves=0,history=[],selected=null,drag=null,complete=new Set();try{complete=new Set(JSON.parse(localStorage.getItem('colorExitCompleted')||'[]'))}catch{};
function options(){ $('#levels').innerHTML=LEVELS.map((_,i)=>`<option value="${i}">${complete.has(i)?'✓ ':''}스테이지 ${i+1}</option>`).join('');$('#levels').value=level; }
function start(n){drag=null;level=n;blocks=copy(LEVELS[n]);moves=0;history=[];selected=null;$('#win').hidden=true;$('#levelLabel').textContent=`LEVEL ${String(n+1).padStart(2,'0')} / 05`;options();say('블록을 밀어 같은 색 출구로 보내세요.');render()}
function say(t){$('#note').textContent=t}
function render(){
  // Keep the touched button attached: replacing it mid-gesture lets some WebViews scroll.
  const activeIds=new Set(blocks.map(b=>String(b.id)));
  for(const el of board.querySelectorAll('.block')){
    if(!activeIds.has(el.dataset.id)){
      if(drag&&String(drag.id)===el.dataset.id)el.hidden=true;
      else el.remove();
    }
  }
  for(const b of blocks){
    let el=board.querySelector('[data-id="'+b.id+'"]');
    if(!el){
      el=document.createElement('button');
      el.dataset.id=b.id;
      for(let i=0;i<b.w*b.h;i++){const s=document.createElement('span');s.className='stud';el.append(s)}
      board.append(el);
    }
    el.hidden=false;
    el.className='block'+(selected===b.id?' selected':'');
    el.setAttribute('aria-label',names[b.color]+' '+b.w+'×'+b.h+' 블록');
    Object.assign(el.style,{left:'calc('+b.x*20+'% + 3px)',top:'calc('+b.y*100/6+'% + 3px)',width:'calc('+b.w*20+'% - 6px)',height:'calc('+b.h*100/6+'% - 6px)',background:'var(--'+b.color+')',gridTemplateColumns:'repeat('+b.w+',1fr)',gridTemplateRows:'repeat('+b.h+',1fr)',padding:'8px',gap:'8px'});
  }
  $('#moves').textContent=moves;$('#left').textContent=blocks.length;$('#undo').disabled=!history.length;
}
function canExit(b,dx,dy){return b.color==='red'&&dx===-1&&b.x===0&&b.y>=1&&b.y+b.h<=3||b.color==='blue'&&dy===-1&&b.y===0&&b.x>=0&&b.x+b.w<=2||b.color==='yellow'&&dx===1&&b.x+b.w===5&&b.y>=0&&b.y+b.h<=2||b.color==='green'&&dy===1&&b.y+b.h===6&&b.x>=3&&b.x+b.w<=5}
function free(b){return b.x>=0&&b.y>=0&&b.x+b.w<=5&&b.y+b.h<=6&&!blocks.some(a=>a.id!==b.id&&b.x<a.x+a.w&&b.x+b.w>a.x&&b.y<a.y+a.h&&b.y+b.h>a.y)}
function move(dx,dy){if(!$('#win').hidden)return;let b=blocks.find(a=>a.id===selected);if(!b){say('먼저 움직일 블록을 선택하세요.');return false}const exiting=canExit(b,dx,dy),n={...b,x:b.x+dx,y:b.y+dy};if(!exiting&&!free(n)){say('다른 블록을 옮겨 길을 만들어보세요.');return false}history.push({blocks:copy(blocks),moves,selected});moves++;if(exiting){blocks=blocks.filter(a=>a.id!==b.id);selected=null;say(`${names[b.color]} 블록 탈출!`);if(navigator.vibrate)navigator.vibrate(15)}else{Object.assign(b,n);say('출구와 블록의 색을 맞춰주세요.')}render();if(!blocks.length)win();return true}
function win(){complete.add(level);try{localStorage.setItem('colorExitCompleted',JSON.stringify([...complete]))}catch{}options();$('#result').textContent=`스테이지 ${level+1} · ${moves}번 움직여 클리어`;$('#next').textContent=level===4?'처음부터 다시 즐기기 ↻':'다음 스테이지 →';$('#win').hidden=false;say('멋져요! 모든 블록이 제자리를 찾았어요.')}
const usesTouchEvents='ontouchstart' in window;
function beginDrag(el,x,y,kind,identifier){
  selected=Number(el.dataset.id);
  drag={id:selected,x,y,kind,identifier};
  render();
}
function advanceDrag(x,y){
  if(!drag||selected===null)return;
  const step=board.clientWidth/5,dx=x-drag.x,dy=y-drag.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<step*.55)return;
  const horizontal=Math.abs(dx)>Math.abs(dy);
  move(horizontal?Math.sign(dx):0,horizontal?0:Math.sign(dy));
  drag.x=x;drag.y=y;
}
function release(){drag=null;render()}
board.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'&&usesTouchEvents)return;
  if(drag||e.button!==0)return;
  const el=e.target.closest('.block');if(!el)return;
  e.preventDefault();
  beginDrag(el,e.clientX,e.clientY,'pointer',e.pointerId);
  board.setPointerCapture(e.pointerId);
});
board.addEventListener('pointermove',e=>{
  if(!drag||drag.kind!=='pointer'||e.pointerId!==drag.identifier)return;
  if(e.cancelable)e.preventDefault();
  advanceDrag(e.clientX,e.clientY);
});
function endPointer(e){
  if(!drag||drag.kind!=='pointer'||e.pointerId!==drag.identifier)return;
  release();
}
board.addEventListener('pointerup',endPointer);
board.addEventListener('pointercancel',endPointer);
board.addEventListener('lostpointercapture',endPointer);
// Non-passive touch handlers also cover embedded browsers that ignore touch-action.
board.addEventListener('touchstart',e=>{
  if(e.cancelable)e.preventDefault();
  if(drag||e.touches.length!==1)return;
  const el=e.target.closest('.block');if(!el)return;
  const t=e.changedTouches[0];
  beginDrag(el,t.clientX,t.clientY,'touch',t.identifier);
},{passive:false});
board.addEventListener('touchmove',e=>{
  if(e.cancelable)e.preventDefault();
  if(!drag||drag.kind!=='touch')return;
  const t=Array.from(e.touches).find(t=>t.identifier===drag.identifier);
  if(t)advanceDrag(t.clientX,t.clientY);
},{passive:false});
function endTouch(e){
  if(!drag||drag.kind!=='touch')return;
  if(Array.from(e.touches).some(t=>t.identifier===drag.identifier))return;
  release();
}
board.addEventListener('touchend',endTouch);
board.addEventListener('touchcancel',endTouch);
window.addEventListener('blur',()=>{if(drag)release()});
$('#undo').onclick=()=>{if(!history.length)return;const h=history.pop();blocks=h.blocks;moves=h.moves;selected=h.selected;$('#win').hidden=true;render();say('한 수 되돌렸어요.')};$('#reset').onclick=()=>start(level);$('#next').onclick=()=>start((level+1)%5);$('#levels').onchange=e=>start(Number(e.target.value));document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>move(...b.dataset.dir.split(',').map(Number)));document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();move(...d)}});start(0);
