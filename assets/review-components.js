/* Business-neutral review components. Project renderers supply facts and fixed scenes. */
(()=>{
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const route=(text,id)=>{const a=el('a','rc-route',text);a.href='#'+encodeURIComponent(id);a.dataset.reviewLink=id;return a};
 function features(host,spec){
  host.classList.add('review-diagram-card','rc-feature-map');host.replaceChildren();const root=el('div','rc-feature-root',spec.title);host.append(root);const branches=el('div','rc-features');host.append(branches);
  for(const item of spec.groups){const card=el('article','rc-feature');const meta=el('div','rc-feature-meta');meta.append(el('small','',item.owner||''));if(item.change)meta.append(el('span','rc-feature-badge',item.change));card.append(meta,el('h3','',item.title));const list=el('ul');for(const text of item.items||[])list.append(el('li','',text));card.append(list);if(item.rule)card.append(el('p','rc-rule',item.rule));if(item.target)card.append(route('查看对应页面 ↗',item.target));branches.append(card)}
  if(spec.foundation)host.append(el('p','rc-foundation',spec.foundation));
 }
 function description(host,sections){host.replaceChildren();for(const title of ['功能说明','逻辑说明','交互说明','备注']){if(!sections[title])continue;const box=el('div','prd-section');box.append(el('h3','prd-section__title',title),el('p','',sections[title]));host.append(box)}}
 function boards(host,groups,renderScene){
  host.replaceChildren();const toolbar=el('div','rc-board-tools');const label=el('label','','画板尺寸 '),select=el('select');for(const [value,text] of [['overview','概览'],['full','原尺寸']]){const o=el('option','',text);o.value=value;select.append(o)}label.append(select);toolbar.append(label);host.append(toolbar);
  const list=el('div','rc-board-list');host.append(list);select.onchange=()=>{list.classList.toggle('rc-full',select.value==='full');size()};
  function size(){list.querySelectorAll('.rc-frame').forEach(frame=>{const full=list.classList.contains('rc-full')||frame.closest('article').classList.contains('rc-full');const w=+frame.dataset.width,h=+frame.dataset.height,z=full?1:Math.min(1,560/w,760/h);frame.style.width=w*z+'px';frame.style.height=h*z+'px';frame.firstElementChild.style.transform=`scale(${z})`})}
  for(const group of groups){const box=el('section','review-board-group');box.append(el('h2','',group.title));if(group.description)box.append(el('p','rc-rule',group.description));const scroll=el('div','review-board-scroll'),row=el('div','rc-board-row');scroll.append(row);box.append(scroll);list.append(box);
   group.scenes.forEach((scene,index)=>{if(index){const edge=el('div','rc-edge');edge.append(el('span','',scene.trigger||'请定义触发条件'),el('div','rc-arrow'));row.append(edge)}const card=el('article','rc-board');const head=el('header');head.append(el('b','',scene.title));const zoom=el('button','','原尺寸');zoom.type='button';zoom.onclick=()=>{card.classList.toggle('rc-full');zoom.textContent=card.classList.contains('rc-full')?'恢复概览':'原尺寸';size()};head.append(zoom);card.append(head);
    const rendered=renderScene(scene);if(!(rendered instanceof HTMLElement))throw Error('renderScene must return an HTMLElement');const ui=rendered.cloneNode(true);
    const frame=el('div','rc-frame');frame.dataset.width=String(scene.width);frame.dataset.height=String(scene.height);if(!(scene.width>0&&scene.height>0))throw Error('Each scene needs positive width/height');
    // Keep static fixtures out of live business initialization and editor dimension audits.
    ui.classList.remove('prototype-viewport','macos-window','mobile-frame');ui.classList.add('rc-static-ui');ui.style.width=scene.width+'px';ui.style.height=scene.height+'px';
    ui.querySelectorAll('[id]').forEach(n=>{n.id='static-'+scene.id+'-'+n.id});ui.removeAttribute('id');[ui,...ui.querySelectorAll('*')].forEach(n=>{for(const a of [...n.attributes])if(a.name.startsWith('on')||a.name==='data-review-test-action')n.removeAttribute(a.name)});ui.querySelectorAll('input[type=radio]').forEach(n=>n.name='static-'+scene.id+'-'+n.name);ui.querySelectorAll('[for]').forEach(n=>n.htmlFor='static-'+scene.id+'-'+n.htmlFor);
    frame.append(ui);card.append(frame);if(scene.note)card.append(el('p','rc-board-note',scene.note));row.append(card)
   });if(group.returnLabel)box.append(el('p','rc-return','← '+group.returnLabel))
  }size();
 }
 function flow(host,spec){
  host.classList.add('review-diagram-card');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('width',spec.width);svg.setAttribute('height',spec.height);svg.setAttribute('viewBox',`0 0 ${spec.width} ${spec.height}`);const byId=new Map(spec.nodes.map(n=>[n.id,n]));const markerId='rc-arrow-'+crypto.randomUUID();const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker'),arrow=document.createElementNS(ns,'path');marker.setAttribute('id',markerId);for(const [k,v]of Object.entries({viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'}))marker.setAttribute(k,v);arrow.setAttribute('d','M0 0 L10 5 L0 10 Z');arrow.setAttribute('fill','#7188aa');marker.append(arrow);defs.append(marker);svg.append(defs);
  for(const edge of spec.edges){const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)throw Error('Unknown flow edge');const x=a.x+a.width/2,y=a.y+a.height,x2=b.x+b.width/2,y2=b.y;const path=document.createElementNS(ns,'path');path.setAttribute('d',edge.path||`M${x},${y} V${(y+y2)/2} H${x2} V${y2}`);path.setAttribute('class','rc-flow-edge');path.setAttribute('marker-end','url(#'+markerId+')');svg.append(path);if(edge.label){const t=document.createElementNS(ns,'text');t.setAttribute('x',edge.labelX??x2+8);t.setAttribute('y',edge.labelY??(y+y2)/2-8);t.textContent=edge.label;svg.append(t)}}
  for(const n of spec.nodes){const shape=document.createElementNS(ns,n.type==='decision'?'polygon':'rect');if(n.type==='decision')shape.setAttribute('points',`${n.x+n.width/2},${n.y} ${n.x+n.width},${n.y+n.height/2} ${n.x+n.width/2},${n.y+n.height} ${n.x},${n.y+n.height/2}`);else for(const [k,v]of Object.entries({x:n.x,y:n.y,width:n.width,height:n.height,rx:6}))shape.setAttribute(k,v);shape.setAttribute('class','rc-flow-node');svg.append(shape);const t=document.createElementNS(ns,'text');t.setAttribute('x',n.x+n.width/2);t.setAttribute('y',n.y+n.height/2+5);t.setAttribute('text-anchor','middle');t.textContent=n.label;svg.append(t)}host.replaceChildren(svg);
 }
 window.ReviewComponents={features,boards,flow,description};
})();
