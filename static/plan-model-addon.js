(()=>{
  const tabs=document.querySelector('.inspector-tabs');
  const body=document.querySelector('.inspector-body');
  if(!tabs||!body||document.querySelector('[data-tab="model"]')) return;

  const style=document.createElement('style');
  style.textContent=`
    .pm-toolbar{display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:8px}
    .pm-search,.pm-select{border:1px solid var(--line);background:#fff;border-radius:7px;padding:7px 8px;font-size:8.5px;color:#445064;min-width:0}
    .pm-select{grid-column:1/-1}
    .pm-actions{display:flex;gap:5px;align-items:center}
    .pm-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px}
    .pm-stat{border:1px solid var(--line);border-radius:8px;padding:8px;background:#f8fafb}.pm-stat small{font-size:7px;color:var(--muted);display:block}.pm-stat strong{font-size:14px}
    .pm-policy{border:1px solid #ffc7c4;background:var(--coralSoft);border-radius:8px;padding:8px;font-size:8px;line-height:1.45;color:#75413f;margin-bottom:9px}
    .pm-conflict{border:1px solid #f0d6a4;border-left:4px solid var(--amber);background:#fffaf0;border-radius:8px;padding:8px;margin-bottom:7px}.pm-conflict b{font-size:9px;display:block}.pm-conflict p{font-size:8px;color:#6f6249;line-height:1.45;margin:4px 0 0}
    .pm-head{display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px}.pm-head strong{font-size:10px}.pm-head span{font-size:8px;color:var(--muted)}
    .pm-list{display:flex;flex-direction:column;gap:6px}.pm-item{border:1px solid var(--line);border-radius:8px;padding:8px;background:#fff}.pm-item.governing{border-left:4px solid var(--green)}.pm-item.superseded{border-left:4px solid var(--amber);background:#fffdf7}.pm-item-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.pm-item-top b{font-size:8.5px}.pm-chip{font-size:7px;font-weight:800;padding:3px 5px;border-radius:999px;background:var(--navySoft);color:var(--navy);white-space:nowrap}.pm-item p{font-size:8px;line-height:1.45;color:#536071;margin:6px 0}.pm-meta{display:flex;flex-wrap:wrap;gap:5px;font-size:7px;color:var(--muted)}.pm-source{border:0;background:transparent;color:var(--coral);font-size:7.5px;font-weight:800;padding:0}.pm-normalized{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:7px;color:#667385;background:#f7f9fb;border-radius:6px;padding:6px;margin-top:6px;white-space:pre-wrap;word-break:break-word}
    .pm-empty{font-size:9px;color:var(--muted);padding:12px 2px}.pm-error{border:1px solid #ffc7c4;background:#fff7f6;padding:9px;border-radius:8px;color:#84423f;font-size:8.5px;line-height:1.5}
  `;
  document.head.appendChild(style);

  const tab=document.createElement('button');
  tab.className='inspect-tab';
  tab.dataset.tab='model';
  tab.textContent='Plan Model';
  tabs.appendChild(tab);

  const pane=document.createElement('div');
  pane.id='modelTab';
  pane.className='inspect-pane';
  pane.innerHTML=`
    <div class="pm-toolbar">
      <input class="pm-search" id="pmSearch" placeholder="Search source callouts…">
      <button class="mini-btn" id="pmRebuild">Rebuild</button>
      <select class="pm-select" id="pmCategory"><option value="">All categories</option></select>
    </div>
    <div id="pmContent"><div class="pm-empty">Open this tab to build the structured source model.</div></div>`;
  body.appendChild(pane);

  let model=null;
  let loading=false;

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function categoryLabel(c){return String(c||'').replaceAll('_',' ')}
  function sourceLabel(item){return `${item.sheet_number||`Page ${item.page}`} · p${item.page}`}
  function openSource(page){
    const card=document.querySelector(`.sheet-card[data-page="${page}"]`);
    if(card){card.click();}
  }

  function conflictHtml(){
    if(!model?.conflicts?.length) return '';
    return `<div class="pm-head"><strong>Review notes</strong><span>${model.conflicts.length}</span></div>`+
      model.conflicts.map(c=>`<div class="pm-conflict"><b>${esc(categoryLabel(c.type))} — ${esc(categoryLabel(c.scope))}</b><p>${esc(c.policy)}</p></div>`).join('');
  }

  function render(){
    if(!model) return;
    const q=(document.querySelector('#pmSearch')?.value||'').trim().toLowerCase();
    const cat=document.querySelector('#pmCategory')?.value||'';
    let items=model.items||[];
    if(cat) items=items.filter(x=>x.category===cat);
    if(q) items=items.filter(x=>`${x.raw_text} ${x.category} ${x.sheet_number||''} ${x.sheet_title||''}`.toLowerCase().includes(q));

    const summary=model.summary||{};
    const content=document.querySelector('#pmContent');
    content.innerHTML=`
      <div class="pm-summary">
        <div class="pm-stat"><small>Source items</small><strong>${summary.item_count||0}</strong></div>
        <div class="pm-stat"><small>Conflicts</small><strong>${summary.conflict_count||0}</strong></div>
        <div class="pm-stat"><small>Shown</small><strong>${items.length}</strong></div>
      </div>
      <div class="pm-policy"><strong>Source discipline:</strong> order-affecting values must be supported by the plans or explicitly approved by the user. EWP governs over conflicting conventional framing, but the conflict remains visible for review.</div>
      ${conflictHtml()}
      <div class="pm-head"><strong>Structured source items</strong><span>raw → normalized</span></div>
      <div class="pm-list">${items.length?items.slice(0,220).map(item=>{
        const governing=item.governing_status==='governing_by_ewp_policy'?' governing':'';
        const superseded=item.governing_status==='superseded_by_ewp_for_takeoff'?' superseded':'';
        const normalized=JSON.stringify(item.normalized||{},null,2);
        return `<div class="pm-item${governing}${superseded}">
          <div class="pm-item-top"><b>${esc(categoryLabel(item.category))}</b><span class="pm-chip">${esc(item.governing_status)}</span></div>
          <p>${esc(item.raw_text)}</p>
          <div class="pm-meta"><span>${esc(sourceLabel(item))}</span><span>${esc(item.review_status)}</span>${item.bbox_pt?'<span>located on sheet</span>':''}<button class="pm-source" data-pm-page="${item.page}">Show source</button></div>
          <div class="pm-normalized">${esc(normalized)}</div>
        </div>`
      }).join(''):'<div class="pm-empty">No items match this filter.</div>'}</div>
      ${items.length>220?`<div class="pm-empty">Showing first 220 of ${items.length} matching items. Narrow the filter to inspect the rest.</div>`:''}`;
    content.querySelectorAll('[data-pm-page]').forEach(btn=>btn.onclick=()=>openSource(Number(btn.dataset.pmPage)));
  }

  async function load(force=false){
    if(loading) return;
    loading=true;
    const content=document.querySelector('#pmContent');
    content.innerHTML='<div class="pm-empty">Building structured plan model from the saved PDF…</div>';
    try{
      let projectId=null;
      try{
        const latest=await fetch('/api/projects/latest');
        if(latest.ok){const p=await latest.json();projectId=p.id}
      }catch{}
      const url=projectId?(force?`/api/projects/${projectId}/plan-model/rebuild`:`/api/projects/${projectId}/plan-model`):'/api/projects/latest/plan-model';
      const r=await fetch(url,{method:force?'POST':'GET'});
      const d=await r.json();
      if(!r.ok) throw new Error(d.detail||'Could not build plan model');
      model=d;
      const select=document.querySelector('#pmCategory');
      const prior=select.value;
      const cats=Object.keys(model.summary?.by_category||{});
      select.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(categoryLabel(c))} (${model.summary.by_category[c]})</option>`).join('');
      if(cats.includes(prior)) select.value=prior;
      render();
    }catch(err){content.innerHTML=`<div class="pm-error">${esc(err.message)}</div>`}
    finally{loading=false}
  }

  tab.addEventListener('click',()=>{
    document.querySelectorAll('.inspect-tab').forEach(x=>x.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.inspect-pane').forEach(x=>x.classList.remove('active'));
    pane.classList.add('active');
    if(!model) load(false);
  });
  pane.querySelector('#pmSearch').addEventListener('input',render);
  pane.querySelector('#pmCategory').addEventListener('change',render);
  pane.querySelector('#pmRebuild').addEventListener('click',()=>load(true));
})();
