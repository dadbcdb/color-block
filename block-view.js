/* A single continuous silhouette per piece; studs remain individually hit-testable. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
function outline(cells){
 const occupied=new Set(cells.map(([x,y])=>x+','+y)),edges=[];
 for(const [x,y]of cells){
  if(!occupied.has(x+','+(y-1)))edges.push([[x,y],[x+1,y],0]);
  if(!occupied.has((x+1)+','+y))edges.push([[x+1,y],[x+1,y+1],1]);
  if(!occupied.has(x+','+(y+1)))edges.push([[x+1,y+1],[x,y+1],2]);
  if(!occupied.has((x-1)+','+y))edges.push([[x,y+1],[x,y],3]);
 }
 const starts=new Map();for(const e of edges){const k=e[0].join(',');if(!starts.has(k))starts.set(k,[]);starts.get(k).push(e);}
 const used=new Set(),loops=[];
 for(const first of edges){if(used.has(first))continue;const points=[];let edge=first;
  while(edge&&!used.has(edge)){used.add(edge);points.push(edge[0]);const candidates=(starts.get(edge[1].join(','))||[]).filter(e=>!used.has(e));const priority=[1,0,3,2];candidates.sort((a,b)=>priority.indexOf((a[2]-edge[2]+4)%4)-priority.indexOf((b[2]-edge[2]+4)%4));edge=candidates[0];}
  if(points.length)loops.push(points);
 }
 const point=(v,toward)=>{const dx=toward[0]-v[0],dy=toward[1]-v[1],length=Math.hypot(dx,dy);return [v[0]+dx/length*.10,v[1]+dy/length*.10];};
 return loops.map(points=>{let d='';for(let i=0;i<points.length;i++){const v=points[i],a=point(v,points[(i+points.length-1)%points.length]),b=point(v,points[(i+1)%points.length]);d+=(i?'L':'M')+a.join(' ')+'Q'+v.join(' ')+' '+b.join(' ');}return d+'Z';}).join('');
}
function paint(host,cells,color,tileClass){
 const width=Math.max(...cells.map(c=>c[0]))+1,height=Math.max(...cells.map(c=>c[1]))+1;
 host.replaceChildren();const svg=document.createElementNS(NS,'svg');svg.classList.add('piece-body');svg.setAttribute('viewBox',[-.065,-.065,width+.13,height+.13].join(' '));svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 const d=outline(cells);for(const cls of ['piece-fill','piece-selection']){const path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.classList.add(cls);if(cls==='piece-fill')path.setAttribute('fill',color);svg.append(path);}host.append(svg);
 for(const [x,y]of cells){const tile=document.createElement('span');tile.className=tileClass;Object.assign(tile.style,{left:x/width*100+'%',top:y/height*100+'%',width:100/width+'%',height:100/height+'%'});const stud=document.createElement('span');stud.className='stud';tile.append(stud);host.append(tile);}
}
const api={outline,paint};root.BlockView=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
