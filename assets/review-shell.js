(()=>{
 function boot(){
  const all=s=>[...document.querySelectorAll(s)],pages=()=>all('[data-review-panel][id]');
  function diagramGroups(){
   for(const group of all('[data-review-diagram-group]')){
    group.querySelector(':scope > .review-diagram-tabs')?.remove();
    const items=[...group.querySelectorAll(':scope > [data-review-diagram-item]')];
    if(items.length<2){items.forEach(item=>item.hidden=false);continue;}
    const tabs=document.createElement('div');tabs.className='review-diagram-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','业务图示');
    const select=(index)=>{items.forEach((item,i)=>{item.hidden=i!==index;const button=tabs.children[i];button.classList.toggle('active',i===index);button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1})};
    items.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.textContent=item.dataset.reviewDiagramItem||`图 ${i+1}`;button.addEventListener('click',()=>select(i));tabs.append(button)});
    group.prepend(tabs);select(0);
   }
  }
  diagramGroups();
  function navigation(){for(const nav of all('[data-review-nav]')){nav.replaceChildren();for(const page of pages().filter(p=>p.dataset.reviewPanel===nav.dataset.reviewNav)){const a=document.createElement('a');a.href='#'+encodeURIComponent(page.id);a.dataset.reviewLink=page.id;a.textContent=page.dataset.reviewTitle||page.id;nav.append(a)}}}
  function show(id){
   const available=pages();if(!available.length)return;
   const page=available.find(p=>p.id===id)||available.find(p=>p.dataset.reviewPanel==='requirements')||available[0];
   navigation();available.forEach(p=>p.classList.toggle('review-current',p===page));
   all('[data-review-tab]').forEach(t=>{const on=t.dataset.reviewTab===page.dataset.reviewPanel;t.classList.toggle('active',on);t.setAttribute('aria-selected',String(on))});
   all('[data-review-nav]').forEach(n=>n.hidden=n.dataset.reviewNav!==page.dataset.reviewPanel);
   all('[data-review-link]').forEach(a=>{const on=a.dataset.reviewLink===page.id;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
   const title=document.querySelector('[data-review-heading]');if(title)title.textContent=page.dataset.reviewTitle||page.id;
   history.replaceState(null,'','#'+encodeURIComponent(page.id));window.scrollTo({top:0,behavior:'instant'});
   document.dispatchEvent(new CustomEvent('review:pagechange',{detail:{id:page.id,panel:page.dataset.reviewPanel}}));
  }
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-review-tab]');if(tab){e.preventDefault();const p=pages().find(p=>p.dataset.reviewPanel===tab.dataset.reviewTab);if(p)show(p.id);return}const link=e.target.closest('[data-review-link]');if(link){e.preventDefault();show(link.dataset.reviewLink)}});
  const route=()=>{let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{id=''}show(id)};
  window.addEventListener('hashchange',route);route();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
