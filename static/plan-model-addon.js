(()=>{
  const tabs=document.querySelector('.inspector-tabs');
  const body=document.querySelector('.inspector-body');
  if(!tabs||!body||document.querySelector('[data-tab="model"]')) return;

  const style=document.createElement('style');
  style.textContent=`
    .pm-toolbar{display:grid;grid-template-columns:1fr auto;gap:7px;margin-bottom:10px}
    .pm-search,.pm-select{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 9px;font-size:9px;color:#445064;min-width:0}
    .pm-select{grid-column:1/-1}
    .pm-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
    .pm-stat{border:1px solid var(--line);border-radius:9px;padding:9px;background:#f8fafb}.pm-stat small{font-size:7.5px;color:var(--muted);display:block}.pm-stat strong{font-size:15px}
    .pm-policy{border:1px solid #ffc7c4;background:var(--coralSoft);border-radius:9px;padding:9px;font-size:8.5px;line-height:1.55;color:#75413f;margin-bottom:10px}
    .pm-head{display:flex;justify-content:space-between;align-items:center;margin:12px 0 7px}.pm-head strong{font-size:10.5px}.pm-head span{font-size:8px;color:var(--muted)}
    .pm-review{border:1px solid #f0d6a4;border-left:4px solid var(--amber);background:#fffaf0;border-radius:9px;padding:10px;margin-bottom:8px}
    .pm-review-title{font-size:9.5px;font-weight:900;color:#5c4d32;margin-bottom:5px}.pm-review p{font-size:8.5px;color:#6f6249;line-height:1.5;margin:0 0 7px}.pm-review-sources{font-size:7.5px;color:#8a7957;display:flex;flex-wrap:wrap;gap:5px}
    .pm-list{display:flex;flex-direction:column;gap:8px}.pm-item{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}.pm-item.governing{border-left:4px solid var(--green)}.pm-item.superseded{border-left:4px solid var(--amber);background:#fffdf7}.pm-item.review{border-left:4px solid var(--coral)}
    .pm-item-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.pm-item-title{font-size:10px;font-weight:900;line-height:1.35}.pm-status{font-size:7px;font-weight:900;padding:4px 6px;border-radius:999px;white-space:nowrap;background:var(--navySoft);color:var(--navy)}.pm-status.good{background:var(--greenSoft);color:var(--green)}.pm-status.warn{background:#fff4dc;color:#9a6813}.pm-status.review{background:var(--coralSoft);color:var(--coral)}
    .pm-source-line{font-size:7.5px;color:var(--muted);margin:5px 0 8px}.pm-block{margin-top:7px}.pm-label{font-size:7.5px;font-weight:900;color:#7b8796;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}.pm-plan-text{font-size:8.8px;line-height:1.45;color:#344054;background:#f8fafb;border:1px solid #edf0f3;border-radius:7px;padding:7px}.pm-meaning{font-size:8.8px;line-height:1.5;color:#4f5c6c}.pm-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;font-size:7.5px;color:var(--muted)}.pm-source{border:0;background:transparent;color:var(--coral);font-size:7.8px;font-weight:900;padding:0}.pm-tech{margin-top:8px;border-top:1px solid #edf0f3;padding-top:7px}.pm-tech summary{font-size:7.5px;color:var(--muted);cursor:pointer;font-weight:800}.pm-tech-grid{margin-top:6px;font-size:7px;line-height:1.45;color:#667385;background:#f7f9fb;border-radius:6px;padding:7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
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
      <input class="pm-search" id="pmSearch" placeholder="Search plan information…">
      <button class="mini-btn" id="pmRebuild">Re-read</button>
      <select class="pm-select" id="pmCategory"><option value="">Everything recognized</option></select>
    </div>
    <div id="pmContent"><div class="pm-empty">Open this tab to review what the app recognized from the plans.</div></div>`;
  body.appendChild(pane);

  let model=null;
  let loading=false;

  const CATEGORY_LABELS={
    ewp_callout:'Engineered wood / EWP',
    conventional_framing_callout:'Conventional framing',
    truss_callout:'Truss requirement',
    hardware_callout:'Connector / hardware',
    scope_or_verification_note:'Scope / verification note',
    note_heading_or_text:'Plan note',
    legend_text:'Legend',
    detail_reference:'Detail reference',
    dimension_text:'Written dimension',
    sheet_scale:'Sheet scale'
  };
  const ROLE_LABELS={joist:'Joist',beam:'Beam',header:'Header',post:'Post',rafter:'Rafter',stud:'Stud',plate:'Plate',truss:'Truss',rim:'Rim board',engineered_member_unspecified:'Engineered member',unspecified:'',not_applicable:''};
  const SCOPE_LABELS={floor_system:'Floor system',roof_system:'Roof system',wall_system:'Wall framing',foundation:'Foundation',deck_or_porch:'Deck / porch',sheet:'Sheet',unspecified:''};

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function categoryLabel(c){return CATEGORY_LABELS[c]||String(c||'').replaceAll('_',' ')}
  function roleLabel(r){return ROLE_LABELS[r]||String(r||'').replaceAll('_',' ')}
  function scopeLabel(s){return SCOPE_LABELS[s]||String(s||'').replaceAll('_',' ')}
  function sourceLabel(item){return `${item.sheet_number||`Page ${item.page}`} · ${item.sheet_title||'Untitled sheet'}`}
  function itemById(id){return model?.items?.find(x=>x.id===id)}
  function openSource(page){const card=document.querySelector(`.sheet-card[data-page="${page}"]`);if(card)card.click()}

  function inchesText(value){
    if(value==null||Number.isNaN(Number(value)))return '';
    const n=Number(value);
    return Number.isInteger(n)?`${n}\"`:`${n.toFixed(2).replace(/\.00$/,'')}\"`;
  }

  function itemTitle(item){
    const n=item.normalized||{};
    const role=roleLabel(n.member_role);
    const scope=scopeLabel(n.scope);
    if(item.category==='sheet_scale') return `${sourceLabel(item)} scale`;
    if(role&&scope) return `${scope} — ${role}`;
    if(role) return role;
    if(scope&&['scope_or_verification_note','note_heading_or_text'].includes(item.category)) return `${scope} note`;
    return categoryLabel(item.category);
  }

  function interpretation(item){
    const n=item.normalized||{};
    const parts=[];
    const role=roleLabel(n.member_role);
    const scope=scopeLabel(n.scope);
    if(item.category==='ewp_callout'){
      parts.push(`${role||'Engineered member'} specification${scope?` for the ${scope.toLowerCase()}`:''}.`);
      if(n.ewp_tokens?.length) parts.push(`Product/type shown: ${n.ewp_tokens.join(', ')}.`);
      if(n.spacing_inches!=null) parts.push(`Spacing shown: ${inchesText(n.spacing_inches)} O.C.`);
    } else if(item.category==='conventional_framing_callout'){
      parts.push(`${role||'Conventional framing member'} callout${scope?` for the ${scope.toLowerCase()}`:''}.`);
      if(n.spacing_inches!=null) parts.push(`Spacing shown: ${inchesText(n.spacing_inches)} O.C.`);
    } else if(item.category==='truss_callout'){
      parts.push(`Truss information${scope?` for the ${scope.toLowerCase()}`:''}.`);
      if(n.truss_type) parts.push(`Truss type: ${n.truss_type}.`);
    } else if(item.category==='hardware_callout'){
      parts.push('Structural connector or hardware requirement found on the plan.');
    } else if(item.category==='scope_or_verification_note'){
      parts.push('Scope or verification language found. This must be reviewed before it is allowed to affect an order.');
    } else if(item.category==='detail_reference'){
      const refs=n.references||[];
      if(refs.length) parts.push(`References ${refs.map(r=>`Detail ${r.detail} on ${r.sheet}`).join(', ')}.`);
      else parts.push('Detail reference found.');
    } else if(item.category==='dimension_text'){
      const dims=n.dimensions||[];
      if(dims.length) parts.push(`Written dimension${dims.length>1?'s':''}: ${dims.map(d=>d.raw).join(', ')}.`);
      else parts.push('Written dimension found.');
    } else if(item.category==='sheet_scale'){
      parts.push(`Drawing scale: ${n.scale||item.raw_text}.`);
    } else if(item.category==='legend_text'){
      parts.push('Legend information found. It remains source information until interpreted in context.');
    } else if(item.category==='note_heading_or_text'){
      parts.push('Plan note found. The note remains tied to this exact source location for later framing interpretation.');
    }
    if(!parts.length) parts.push('Plan information recognized and preserved for later takeoff logic.');
    return parts.join(' ');
  }

  function statusFor(item){
    if(item.governing_status==='governing_by_ewp_policy') return {text:'Governing — EWP',cls:'good'};
    if(item.governing_status==='superseded_by_ewp_for_takeoff') return {text:'Review only — EWP governs',cls:'warn'};
    if(item.review_status==='review_note') return {text:'Review note',cls:'review'};
    if(item.category==='scope_or_verification_note') return {text:'Needs review',cls:'review'};
    return {text:'Plan source',cls:''};
  }

  function conflictHtml(){
    if(!model?.conflicts?.length) return '';
    return `<div class="pm-head"><strong>Review notes</strong><span>${model.conflicts.length}</span></div>`+
      model.conflicts.map(c=>{
        const governing=(c.governing_item_ids||[]).map(itemById).filter(Boolean);
        const review=(c.review_item_ids||[]).map(itemById).filter(Boolean);
        const role=roleLabel(c.member_role)||'Framing member';
        const scope=scopeLabel(c.scope)||'framing system';
        const sources=[...governing,...review].map(x=>x.sheet_number||`Page ${x.page}`);
        return `<div class="pm-review">
          <div class="pm-review-title">${esc(scope)} — ${esc(role)} conflict</div>
          <p>An engineered-wood specification conflicts with a conventional framing note for the same member. <strong>The EWP specification governs the takeoff.</strong> The conventional note stays visible for review.</p>
          <div class="pm-review-sources"><span>Sources:</span><span>${esc([...new Set(sources)].join(' + '))}</span></div>
        </div>`;
      }).join('');
  }

  function render(){
    if(!model)return;
    const q=(document.querySelector('#pmSearch')?.value||'').trim().toLowerCase();
    const cat=document.querySelector('#pmCategory')?.value||'';
    let items=model.items||[];
    if(cat)items=items.filter(x=>x.category===cat);
    if(q)items=items.filter(x=>`${x.raw_text} ${categoryLabel(x.category)} ${x.sheet_number||''} ${x.sheet_title||''} ${roleLabel(x.normalized?.member_role)} ${scopeLabel(x.normalized?.scope)}`.toLowerCase().includes(q));

    const summary=model.summary||{};
    const content=document.querySelector('#pmContent');
    content.innerHTML=`
      <div class="pm-summary">
        <div class="pm-stat"><small>Plan items found</small><strong>${summary.item_count||0}</strong></div>
        <div class="pm-stat"><small>Review notes</small><strong>${summary.conflict_count||0}</strong></div>
        <div class="pm-stat"><small>Shown</small><strong>${items.length}</strong></div>
      </div>
      <div class="pm-policy"><strong>How to read this screen:</strong> “What the plan says” is preserved verbatim. “App interpretation” is the structured meaning the takeoff engine may use later. Anything uncertain or conflicting stays visible for review instead of being guessed.</div>
      ${conflictHtml()}
      <div class="pm-head"><strong>Recognized plan information</strong><span>${items.length} item${items.length===1?'':'s'}</span></div>
      <div class="pm-list">${items.length?items.slice(0,220).map(item=>{
        const status=statusFor(item);
        const governing=item.governing_status==='governing_by_ewp_policy'?' governing':'';
        const superseded=item.governing_status==='superseded_by_ewp_for_takeoff'?' superseded':'';
        const review=item.category==='scope_or_verification_note'?' review':'';
        const tech={id:item.id,category:item.category,source_type:item.source_type,bbox_pt:item.bbox_pt,normalized:item.normalized,governing_status:item.governing_status,review_status:item.review_status,conflict_ids:item.conflict_ids};
        return `<div class="pm-item${governing}${superseded}${review}">
          <div class="pm-item-head"><div class="pm-item-title">${esc(itemTitle(item))}</div><span class="pm-status ${status.cls}">${esc(status.text)}</span></div>
          <div class="pm-source-line">Source: <strong>${esc(sourceLabel(item))}</strong></div>
          <div class="pm-block"><div class="pm-label">What the plan says</div><div class="pm-plan-text">${esc(item.raw_text)}</div></div>
          <div class="pm-block"><div class="pm-label">App interpretation</div><div class="pm-meaning">${esc(interpretation(item))}</div></div>
          <div class="pm-meta"><button class="pm-source" data-pm-page="${item.page}">Show source sheet</button>${item.bbox_pt?'<span>Exact source location saved</span>':''}</div>
          <details class="pm-tech"><summary>Technical details</summary><div class="pm-tech-grid">${esc(JSON.stringify(tech,null,2))}</div></details>
        </div>`;
      }).join(''):'<div class="pm-empty">No plan information matches this filter.</div>'}</div>
      ${items.length>220?`<div class="pm-empty">Showing the first 220 of ${items.length} matches. Use search or the filter to narrow the list.</div>`:''}`;
    content.querySelectorAll('[data-pm-page]').forEach(btn=>btn.onclick=()=>openSource(Number(btn.dataset.pmPage)));
  }

  async function load(force=false){
    if(loading)return;
    loading=true;
    const content=document.querySelector('#pmContent');
    content.innerHTML='<div class="pm-empty">Reading the saved plan and organizing recognized information…</div>';
    try{
      let projectId=null;
      try{const latest=await fetch('/api/projects/latest');if(latest.ok){const p=await latest.json();projectId=p.id}}catch{}
      const url=projectId?(force?`/api/projects/${projectId}/plan-model/rebuild`:`/api/projects/${projectId}/plan-model`):'/api/projects/latest/plan-model';
      const r=await fetch(url,{method:force?'POST':'GET'});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Could not read the plan model');
      model=d;
      const select=document.querySelector('#pmCategory');
      const prior=select.value;
      const cats=Object.keys(model.summary?.by_category||{});
      select.innerHTML='<option value="">Everything recognized</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(categoryLabel(c))} (${model.summary.by_category[c]})</option>`).join('');
      if(cats.includes(prior))select.value=prior;
      render();
    }catch(err){content.innerHTML=`<div class="pm-error">${esc(err.message)}</div>`}
    finally{loading=false}
  }

  tab.addEventListener('click',()=>{
    document.querySelectorAll('.inspect-tab').forEach(x=>x.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.inspect-pane').forEach(x=>x.classList.remove('active'));
    pane.classList.add('active');
    if(!model)load(false);
  });
  pane.querySelector('#pmSearch').addEventListener('input',render);
  pane.querySelector('#pmCategory').addEventListener('change',render);
  pane.querySelector('#pmRebuild').addEventListener('click',()=>load(true));
})();
