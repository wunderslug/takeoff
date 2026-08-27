(()=>{
  const tabs=document.querySelector('.inspector-tabs');
  const body=document.querySelector('.inspector-body');
  if(!tabs||!body||document.querySelector('[data-tab="model"]')) return;

  const style=document.createElement('style');
  style.textContent=`
    .pm-controls{display:flex;gap:7px;align-items:center;margin-bottom:10px}
    .pm-search{flex:1;min-width:0;border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px 10px;font-size:12px;color:#344054}
    .pm-fold{border:1px solid var(--line);border-radius:9px;background:#fff;margin-bottom:9px;overflow:hidden}
    .pm-fold>summary{list-style:none;cursor:pointer;padding:10px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:800;color:#344054;background:#fbfcfd}
    .pm-fold>summary::-webkit-details-marker{display:none}
    .pm-fold>summary:after{content:'›';font-size:17px;color:#7b8796;transition:transform .15s ease}
    .pm-fold[open]>summary:after{transform:rotate(90deg)}
    .pm-fold-body{padding:10px 11px;border-top:1px solid var(--line)}
    .pm-select{width:100%;border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px 10px;font-size:12px;color:#344054}
    .pm-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .pm-stat{border:1px solid var(--line);border-radius:9px;padding:9px;background:#f8fafb}
    .pm-stat small{font-size:10px;color:var(--muted);display:block;margin-bottom:2px}.pm-stat strong{font-size:18px}
    .pm-policy{font-size:11.5px;line-height:1.55;color:#5c6675;margin-top:9px}
    .pm-review{border:1px solid #f0d6a4;border-left:4px solid var(--amber);background:#fffaf0;border-radius:9px;padding:10px;margin-bottom:8px}
    .pm-review:last-child{margin-bottom:0}.pm-review b{font-size:12px;display:block;margin-bottom:5px}.pm-review p{font-size:11px;line-height:1.5;color:#665a42;margin:0}
    .pm-list{display:flex;flex-direction:column;gap:8px}
    .pm-item{border:1px solid var(--line);border-radius:10px;background:#fff;overflow:hidden}
    .pm-item.governing{border-left:4px solid var(--green)}.pm-item.superseded{border-left:4px solid var(--amber);background:#fffdf8}.pm-item.review{border-left:4px solid var(--coral)}
    .pm-item>summary{list-style:none;cursor:pointer;padding:11px 11px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 10px;align-items:start}
    .pm-item>summary::-webkit-details-marker{display:none}
    .pm-title{font-size:13px;font-weight:900;line-height:1.3;color:#263244}
    .pm-status{font-size:9.5px;font-weight:900;padding:4px 7px;border-radius:999px;background:var(--navySoft);color:var(--navy);white-space:nowrap}
    .pm-status.good{background:var(--greenSoft);color:var(--green)}.pm-status.warn{background:#fff4dc;color:#94630f}.pm-status.review{background:var(--coralSoft);color:var(--coral)}
    .pm-preview{grid-column:1/-1;font-size:11.5px;color:#566273;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pm-source-line{grid-column:1/-1;font-size:10.5px;color:var(--muted)}
    .pm-item-body{border-top:1px solid #edf0f3;padding:11px}
    .pm-label{font-size:10px;font-weight:900;color:#7a8796;text-transform:uppercase;letter-spacing:.04em;margin:0 0 5px}
    .pm-plan-text{font-size:12px;line-height:1.5;color:#2f3b4d;background:#f8fafb;border:1px solid #edf0f3;border-radius:8px;padding:9px;margin-bottom:11px}
    .pm-meaning{font-size:12px;line-height:1.55;color:#455264;margin-bottom:10px}
    .pm-source{border:0;background:transparent;color:var(--coral);font-size:11px;font-weight:900;padding:0}
    .pm-tech{margin-top:10px;border-top:1px solid #edf0f3;padding-top:8px}.pm-tech summary{font-size:10px;color:var(--muted);cursor:pointer;font-weight:800}.pm-tech pre{margin-top:7px;font-size:9.5px;background:#f7f9fb;border-radius:7px;padding:8px;max-height:240px;overflow:auto}
    .pm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:11px 0 7px}.pm-head strong{font-size:12px}.pm-head span{font-size:10px;color:var(--muted)}
    .pm-empty{font-size:11.5px;color:var(--muted);padding:12px 2px;line-height:1.5}.pm-error{font-size:11.5px;color:#84423f;background:#fff6f5;border:1px solid #ffc7c4;border-radius:8px;padding:10px;line-height:1.5}
  `;
  document.head.appendChild(style);

  const tab=document.createElement('button');
  tab.className='inspect-tab';
  tab.dataset.tab='model';
  tab.textContent='Plan Model';
  const collapseBtn=tabs.querySelector('.inspector-collapse-btn');
  if(collapseBtn)tabs.insertBefore(tab,collapseBtn);else tabs.appendChild(tab);

  const pane=document.createElement('div');
  pane.id='modelTab';
  pane.className='inspect-pane';
  pane.innerHTML=`
    <div class="pm-controls">
      <input class="pm-search" id="pmSearch" placeholder="Search recognized plan information…">
      <button class="mini-btn" id="pmRebuild">Re-read</button>
    </div>
    <details class="pm-fold" id="pmFilters">
      <summary><span>Filters</span><span id="pmFilterLabel">Everything</span></summary>
      <div class="pm-fold-body"><select class="pm-select" id="pmCategory"><option value="">Everything recognized</option></select></div>
    </details>
    <div id="pmContent"><div class="pm-empty">Open this tab to review what the app recognized from the plans.</div></div>`;
  body.appendChild(pane);

  let model=null;
  let loading=false;

  const CATEGORY_LABELS={
    ewp_callout:'Engineered wood / EWP', conventional_framing_callout:'Conventional framing',
    truss_callout:'Truss requirement', hardware_callout:'Connector / hardware',
    scope_or_verification_note:'Scope / verification note', note_heading_or_text:'Plan note',
    legend_text:'Legend', detail_reference:'Detail reference', dimension_text:'Written dimension', sheet_scale:'Sheet scale'
  };
  const ROLE_LABELS={joist:'Joist',beam:'Beam',header:'Header',post:'Post',rafter:'Rafter',stud:'Stud',plate:'Plate',truss:'Truss',rim:'Rim board',engineered_member_unspecified:'Engineered member',unspecified:'',not_applicable:''};
  const SCOPE_LABELS={floor_system:'Floor system',roof_system:'Roof system',wall_system:'Wall framing',foundation:'Foundation',deck_or_porch:'Deck / porch',sheet:'Sheet',unspecified:''};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function categoryLabel(v){return CATEGORY_LABELS[v]||String(v||'').replaceAll('_',' ')}
  function roleLabel(v){return ROLE_LABELS[v]||String(v||'').replaceAll('_',' ')}
  function scopeLabel(v){return SCOPE_LABELS[v]||String(v||'').replaceAll('_',' ')}
  function sourceLabel(item){return `${item.sheet_number||`Page ${item.page}`} — ${item.sheet_title||'Untitled sheet'}`}
  function itemById(id){return model?.items?.find(x=>x.id===id)}
  function openSource(page){const card=document.querySelector(`.sheet-card[data-page="${page}"]`);if(card)card.click()}

  function inchesText(value){
    if(value==null||Number.isNaN(Number(value)))return '';
    const n=Number(value); return Number.isInteger(n)?`${n}\"`:`${n.toFixed(2).replace(/\.00$/,'')}\"`;
  }

  function itemTitle(item){
    const n=item.normalized||{}, role=roleLabel(n.member_role), scope=scopeLabel(n.scope);
    if(item.category==='sheet_scale')return `${sourceLabel(item)} scale`;
    if(role&&scope)return `${scope} — ${role}`;
    if(role)return role;
    if(scope&&['scope_or_verification_note','note_heading_or_text'].includes(item.category))return `${scope} note`;
    return categoryLabel(item.category);
  }

  function interpretation(item){
    const n=item.normalized||{}, parts=[], role=roleLabel(n.member_role), scope=scopeLabel(n.scope);
    if(item.category==='ewp_callout'){
      parts.push(`${role||'Engineered member'} specification${scope?` for the ${scope.toLowerCase()}`:''}.`);
      if(n.ewp_tokens?.length)parts.push(`Product/type shown: ${n.ewp_tokens.join(', ')}.`);
      if(n.spacing_inches!=null)parts.push(`Spacing shown: ${inchesText(n.spacing_inches)} O.C.`);
    }else if(item.category==='conventional_framing_callout'){
      parts.push(`${role||'Conventional framing member'} callout${scope?` for the ${scope.toLowerCase()}`:''}.`);
      if(n.spacing_inches!=null)parts.push(`Spacing shown: ${inchesText(n.spacing_inches)} O.C.`);
    }else if(item.category==='truss_callout'){
      parts.push(`Truss information${scope?` for the ${scope.toLowerCase()}`:''}.`); if(n.truss_type)parts.push(`Truss type: ${n.truss_type}.`);
    }else if(item.category==='hardware_callout')parts.push('Structural connector or hardware requirement found on the plan.');
    else if(item.category==='scope_or_verification_note')parts.push('Scope or verification language found. It must be reviewed before it is allowed to affect an order.');
    else if(item.category==='detail_reference'){
      const refs=n.references||[]; parts.push(refs.length?`References ${refs.map(r=>`Detail ${r.detail} on ${r.sheet}`).join(', ')}.`:'Detail reference found.');
    }else if(item.category==='dimension_text'){
      const dims=n.dimensions||[]; parts.push(dims.length?`Written dimension${dims.length>1?'s':''}: ${dims.map(d=>d.raw).join(', ')}.`:'Written dimension found.');
    }else if(item.category==='sheet_scale')parts.push(`Drawing scale: ${n.scale||item.raw_text}.`);
    else if(item.category==='legend_text')parts.push('Legend information found. It remains source information until interpreted in context.');
    else if(item.category==='note_heading_or_text')parts.push('Plan note found and tied to this exact source location for later framing interpretation.');
    if(!parts.length)parts.push('Plan information recognized and preserved for later takeoff logic.');
    return parts.join(' ');
  }

  function statusFor(item){
    if(item.governing_status==='governing_by_ewp_policy')return{text:'Governing — EWP',cls:'good'};
    if(item.governing_status==='superseded_by_ewp_for_takeoff')return{text:'Review only — EWP governs',cls:'warn'};
    if(item.review_status==='review_note')return{text:'Review note',cls:'review'};
    if(item.category==='scope_or_verification_note')return{text:'Needs review',cls:'review'};
    return{text:'Plan source',cls:''};
  }

  function conflictsHtml(){
    const conflicts=model?.conflicts||[];
    if(!conflicts.length)return '';
    const cards=conflicts.map(c=>{
      const governing=(c.governing_item_ids||[]).map(itemById).filter(Boolean), review=(c.review_item_ids||[]).map(itemById).filter(Boolean);
      const sources=[...new Set([...governing,...review].map(x=>x.sheet_number||`Page ${x.page}`))];
      return `<div class="pm-review"><b>${esc(scopeLabel(c.scope)||'Framing system')} — ${esc(roleLabel(c.member_role)||'member')} conflict</b><p>Engineered-wood and conventional framing notes conflict for the same member. The EWP specification governs the takeoff; the conventional note remains visible for review.${sources.length?` Sources: ${esc(sources.join(' + '))}.`:''}</p></div>`;
    }).join('');
    return `<details class="pm-fold" open><summary><span>Review notes</span><span>${conflicts.length}</span></summary><div class="pm-fold-body">${cards}</div></details>`;
  }

  function summaryHtml(items){
    const s=model?.summary||{};
    return `<details class="pm-fold"><summary><span>Summary & rules</span><span>${s.item_count||0} items</span></summary><div class="pm-fold-body"><div class="pm-summary"><div class="pm-stat"><small>Plan items</small><strong>${s.item_count||0}</strong></div><div class="pm-stat"><small>Review notes</small><strong>${s.conflict_count||0}</strong></div><div class="pm-stat"><small>Shown</small><strong>${items.length}</strong></div></div><div class="pm-policy"><strong>Rule:</strong> “What the plan says” is preserved verbatim. The app interpretation is structured meaning for later takeoff logic. Anything uncertain or conflicting stays visible for review instead of being guessed.</div></div></details>`;
  }

  function itemHtml(item){
    const status=statusFor(item);
    const classes=[item.governing_status==='governing_by_ewp_policy'?'governing':'',item.governing_status==='superseded_by_ewp_for_takeoff'?'superseded':'',item.category==='scope_or_verification_note'?'review':''].filter(Boolean).join(' ');
    const tech={id:item.id,category:item.category,source_type:item.source_type,bbox_pt:item.bbox_pt,normalized:item.normalized,governing_status:item.governing_status,review_status:item.review_status,conflict_ids:item.conflict_ids};
    return `<details class="pm-item ${classes}"><summary><div class="pm-title">${esc(itemTitle(item))}</div><span class="pm-status ${status.cls}">${esc(status.text)}</span><div class="pm-preview">${esc(item.raw_text)}</div><div class="pm-source-line">${esc(sourceLabel(item))}</div></summary><div class="pm-item-body"><div class="pm-label">What the plan says</div><div class="pm-plan-text">${esc(item.raw_text)}</div><div class="pm-label">App interpretation</div><div class="pm-meaning">${esc(interpretation(item))}</div><button class="pm-source" data-pm-page="${item.page}">Show source sheet</button><details class="pm-tech"><summary>Technical details</summary><pre>${esc(JSON.stringify(tech,null,2))}</pre></details></div></details>`;
  }

  function render(){
    if(!model)return;
    const q=(pane.querySelector('#pmSearch')?.value||'').trim().toLowerCase();
    const cat=pane.querySelector('#pmCategory')?.value||'';
    let items=model.items||[];
    if(cat)items=items.filter(x=>x.category===cat);
    if(q)items=items.filter(x=>`${x.raw_text} ${categoryLabel(x.category)} ${x.sheet_number||''} ${x.sheet_title||''} ${roleLabel(x.normalized?.member_role)} ${scopeLabel(x.normalized?.scope)}`.toLowerCase().includes(q));
    pane.querySelector('#pmFilterLabel').textContent=cat?categoryLabel(cat):'Everything';
    const content=pane.querySelector('#pmContent');
    content.innerHTML=`${summaryHtml(items)}${conflictsHtml()}<div class="pm-head"><strong>Recognized plan information</strong><span>${items.length} item${items.length===1?'':'s'}</span></div><div class="pm-list">${items.length?items.slice(0,220).map(itemHtml).join(''):'<div class="pm-empty">No plan information matches this filter.</div>'}</div>${items.length>220?`<div class="pm-empty">Showing the first 220 of ${items.length} matches. Use search or filters to narrow the list.</div>`:''}`;
    content.querySelectorAll('[data-pm-page]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();openSource(Number(btn.dataset.pmPage))});
  }

  async function load(force=false){
    if(loading)return; loading=true;
    const content=pane.querySelector('#pmContent'); content.innerHTML='<div class="pm-empty">Reading the saved plan set and building the source model…</div>';
    try{
      let projectId=null;
      try{const latest=await fetch('/api/projects/latest');if(latest.ok){const p=await latest.json();projectId=p.id}}catch{}
      const url=projectId?(force?`/api/projects/${projectId}/plan-model/rebuild`:`/api/projects/${projectId}/plan-model`):'/api/projects/latest/plan-model';
      const r=await fetch(url,{method:force?'POST':'GET'}), d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Could not build plan model');
      model=d;
      const select=pane.querySelector('#pmCategory'), prior=select.value, cats=Object.keys(model.summary?.by_category||{});
      select.innerHTML='<option value="">Everything recognized</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(categoryLabel(c))} (${model.summary.by_category[c]})</option>`).join('');
      if(cats.includes(prior))select.value=prior;
      render();
    }catch(err){content.innerHTML=`<div class="pm-error">${esc(err.message)}</div>`}
    finally{loading=false}
  }

  tab.addEventListener('click',()=>{
    document.querySelectorAll('.inspect-tab').forEach(x=>x.classList.remove('active')); tab.classList.add('active');
    document.querySelectorAll('.inspect-pane').forEach(x=>x.classList.remove('active')); pane.classList.add('active');
    if(!model)load(false);
  });
  pane.querySelector('#pmSearch').addEventListener('input',render);
  pane.querySelector('#pmCategory').addEventListener('change',render);
  pane.querySelector('#pmRebuild').addEventListener('click',()=>load(true));
})();
