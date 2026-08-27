const state = {
  project:null,
  takeoff:null,
  page:1,
  zoom:1,
  textCache:{},
  modalContext:null,
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(s){
  return String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=> t.hidden = true, 3200);
}
function currentPage(){
  return state.project?.pages.find(p=>p.page===state.page) || null;
}
function openClarifications(){
  return state.project ? state.project.clarifications.filter(c=>c.status==='open') : [];
}
function blockingClarifications(){
  return openClarifications().filter(c=>c.blocking);
}
function openTakeoffQuestions(){
  return state.takeoff ? state.takeoff.blocking_questions.filter(q=>q.status!=='resolved') : [];
}
function totalBlocking(){
  return blockingClarifications().length + openTakeoffQuestions().length;
}

async function apiJson(url, opts={}){
  const r = await fetch(url, opts);
  const body = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(body.detail || body.message || `Request failed (${r.status})`);
  return body;
}

async function upload(file){
  if(!file || !file.name.toLowerCase().endsWith('.pdf')){
    toast('Choose a PDF plan set.');
    return;
  }
  $('#emptyState').hidden = true;
  $('#imageStage').hidden = true;
  $('#loadingState').hidden = false;
  $('#loadingTitle').textContent = `Reading ${file.name}`;
  $('#loadingText').textContent = 'Rendering sheets, extracting plan data, and checking for a verified takeoff…';

  const form = new FormData();
  form.append('file', file);

  try{
    const body = await apiJson('/api/projects/upload', {method:'POST', body:form});
    await loadProjectObject(body, true);
    history.replaceState(null,'',`?project=${encodeURIComponent(body.id)}`);
    toast(`Loaded ${body.page_count} sheet${body.page_count===1?'':'s'}.`);
  }catch(err){
    $('#emptyState').hidden = false;
    toast(err.message);
  }finally{
    $('#loadingState').hidden = true;
  }
}

async function loadProjectObject(project, autoTakeoff=false){
  state.project = project;
  state.page = 1;
  state.zoom = 1;
  state.textCache = {};
  state.takeoff = null;

  $('#projectBlock').hidden = false;
  $('#analyzeBtn').disabled = false;

  renderProject();
  await showPage(1);
  await loadTakeoff();

  if(autoTakeoff && state.takeoff){
    activateInspectorTab('takeoff');
  }
}

function renderProject(){
  const p = state.project;
  if(!p) return;

  $('#projectName').textContent = p.name;
  $('#projectMeta').textContent = `${p.page_count} sheets · ${p.filename}`;
  $('#sheetCounter').textContent = p.page_count;
  $('#textPages').textContent = p.analysis.text_pages;
  $('#hitCount').textContent = p.analysis.review_hit_count;
  $('#refCount').textContent = p.cross_references.length;
  $('#analysisStatus').textContent = `${p.page_count} sheets parsed`;

  $('#phaseUpload').classList.add('done');
  $('#phaseUpload').classList.remove('active');
  $('#phaseRead').classList.add('done');
  $('#phaseClarify').classList.add('active');

  renderSheets();
  renderClarifications();
  updateFinalize();
}

function renderSheets(){
  const list = $('#sheetList');
  const p = state.project;
  list.innerHTML = p.pages.map(pg => `
    <div class="sheet-card ${pg.page===state.page?'active':''}" data-page="${pg.page}">
      <img src="${pg.thumb_url}" alt="Page ${pg.page} thumbnail">
      <div>
        <b class="${pg.sheet_number?'':'unknown'}">${esc(pg.sheet_number || `Page ${pg.page}`)}</b>
        <span>${esc(pg.title || 'Title not confirmed')}</span>
      </div>
    </div>
  `).join('');
  $$('.sheet-card').forEach(el => el.onclick = ()=>showPage(Number(el.dataset.page)));
}

async function showPage(n){
  if(!state.project) return;
  state.page = Math.max(1, Math.min(n, state.project.page_count));
  state.zoom = 1;
  renderSheets();

  const pg = currentPage();
  $('#currentSheetNumber').textContent = pg.sheet_number || `PAGE ${pg.page}`;
  $('#currentSheetTitle').textContent = pg.title || 'Sheet title not confirmed';
  $('#currentSheetSub').textContent = pg.scales.length
    ? `Detected scale: ${pg.scales.join(' · ')}`
    : 'Scale not confirmed on this sheet';

  $('#pageIndicator').textContent = `${pg.page} / ${state.project.page_count}`;
  $('#prevPage').disabled = pg.page === 1;
  $('#nextPage').disabled = pg.page === state.project.page_count;
  ['zoomOut','zoomIn','fitBtn'].forEach(id => $('#'+id).disabled=false);

  const img = $('#planImage');
  img.src = pg.preview_url;
  $('#emptyState').hidden = true;
  $('#imageStage').hidden = false;
  applyZoom();

  renderReviewHits();
  await loadText();
}

function applyZoom(){
  const img = $('#planImage');
  img.style.width = `${Math.round(state.zoom*100)}%`;
  img.style.height = 'auto';
  $('#zoomLabel').textContent = `${Math.round(state.zoom*100)}%`;
}

function renderReviewHits(){
  const pg = currentPage();
  if(!pg) return;
  const el = $('#reviewHits');
  if(!pg.review_hits.length){
    el.innerHTML = '<div class="empty-small">No configured framing/scope keywords were found in the extractable text on this sheet.</div>';
    return;
  }
  el.innerHTML = pg.review_hits.slice(0,40).map(h=>`
    <div class="hit"><b>${esc(h.term)}</b><p>${esc(h.text)}</p></div>
  `).join('');
}

async function loadText(){
  const pg = currentPage();
  if(!pg) return;
  if(state.textCache[pg.page] != null){
    $('#sheetText').textContent = state.textCache[pg.page] || 'No extractable PDF text on this sheet.';
    return;
  }
  try{
    const d = await apiJson(pg.text_url);
    state.textCache[pg.page] = d.text;
    $('#sheetText').textContent = d.text || 'No extractable PDF text on this sheet.';
  }catch{
    $('#sheetText').textContent = 'Could not load extracted text.';
  }
}

function renderClarifications(){
  const p = state.project;
  if(!p) return;
  const open = openClarifications();
  const block = blockingClarifications();

  $('#openClarCount').textContent = open.length;
  $('#blockingCount').textContent = block.length;
  $('#clarificationLabel').textContent = `${open.length} open`;

  const resolved = p.clarifications.filter(c=>c.status==='resolved');
  const items = [...open, ...resolved];

  $('#clarificationList').innerHTML = items.length ? items.map(c =>
    c.status === 'resolved'
      ? `<div class="resolved-card"><b>✓ ${esc(c.title)}</b><p>${esc(c.answer)}</p></div>`
      : `<div class="clar-card ${c.blocking?'':'nonblocking'}" data-plan-clar="${c.id}">
          <b>${esc(c.title)}</b>
          <p>${esc(c.question)}</p>
          <div class="clar-meta">
            <span>${c.blocking?'<span class="blocking-tag">BLOCKING</span>':'<span class="advisory-tag">REVIEW</span>'}</span>
            <span>${c.page?`Page ${c.page}`:'Plan set'}</span>
          </div>
        </div>`
  ).join('') : '<div class="empty-small">No unresolved plan-reading clarifications.</div>';

  $$('[data-plan-clar]').forEach(el => el.onclick = ()=>openPlanClar(el.dataset.planClar));
}

async function loadTakeoff(){
  if(!state.project) return;
  try{
    state.takeoff = await apiJson(`/api/projects/${state.project.id}/takeoff`);
    renderTakeoff();
    $('#packageCount').textContent = state.takeoff.packages.length;
    $('#takeoffBlockers').textContent = openTakeoffQuestions().length;
    $('#phaseClarify').classList.toggle('done', totalBlocking()===0);
    $('#phaseTakeoff').classList.add('active');
    $('#drawerTitle').textContent = 'Verified takeoff';
    $('#analysisStatus').textContent = 'Material and cut outputs loaded';
  }catch(err){
    state.takeoff = null;
    renderNoTakeoff(err.message);
    $('#packageCount').textContent = '0';
    $('#takeoffBlockers').textContent = '0';
  }
  updateFinalize();
}

function renderNoTakeoff(msg){
  $('#takeoffPanel').innerHTML = `
    <div class="empty-big">
      <strong>No verified material takeoff for this plan yet</strong>
      <span>${esc(msg)}</span>
    </div>`;
  $('#cutsPanel').innerHTML = `<div class="empty-big"><strong>No verified cut plan yet</strong></div>`;
  $('#specialPanel').innerHTML = `<div class="empty-big"><strong>No verified special-order package yet</strong></div>`;
}

function materialStatusClass(status=''){
  const s = status.toUpperCase();
  if(s.includes('SPECIAL')) return 'special';
  if(s.includes('BLOCK') || s.includes('CLARIFICATION')) return 'blocked';
  if(s === 'STOCK' || s.startsWith('STOCK ')) return 'stock';
  return '';
}

function renderTakeoff(){
  const t = state.takeoff;
  if(!t) return;

  const notes = t.review_notes.map(n=>`
    <div class="review-note ${esc(n.severity)}">
      <b>${esc(n.title)}</b>
      ${esc(n.text)}
      <div style="margin-top:4px;color:#8791a0">Source: ${esc(n.sources.join(', '))}</div>
    </div>
  `).join('');

  const questions = t.blocking_questions.map(q => q.status==='resolved'
    ? `<div class="resolved-card"><b>✓ ${esc(q.title)}</b><p>${esc(q.answer)}</p></div>`
    : `<div class="takeoff-question" data-takeoff-q="${q.id}">
        <b>${esc(q.title)}</b>
        <p>${esc(q.question)}</p>
        <span class="answer-link">Answer required · ${esc(q.source)}</span>
      </div>`
  ).join('');

  const packages = t.packages.map(pkg => `
    <div class="package">
      <div class="package-head">
        <b>${esc(pkg.id)} — ${esc(pkg.name)}</b>
        <span>${esc(pkg.status.replaceAll('_',' '))}</span>
      </div>
      ${pkg.materials.map(item => `
        <div class="material-row">
          <div class="qty">${esc(item.qty)}<div style="font-size:7px;color:#8a95a4">${esc(item.unit || '')}</div></div>
          <div class="desc">
            <b>${esc(item.material)}</b>
            <span>${esc(item.length || item.cut_length || item.purchase || '')}</span>
            ${item.assembly?`<span>${esc(item.assembly)}</span>`:''}
            ${item.purchase && (item.length || item.cut_length)?`<span>Order: ${esc(item.purchase)}</span>`:''}
            ${item.note?`<span>${esc(item.note)}</span>`:''}
            ${item.breakdown?`<ul class="breakdown">${item.breakdown.map(b=>`<li>${esc(b.qty)} × ${esc(b.length)} — ${esc(b.location)}</li>`).join('')}</ul>`:''}
            <span>Source: ${esc(item.source || '')}</span>
          </div>
          <div class="status ${materialStatusClass(item.stock_status || item.status)}">${esc(item.stock_status || item.status || '')}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  $('#takeoffPanel').innerHTML = `
    <div class="takeoff-head">
      <div>
        <h3>Verified material takeoff</h3>
        <p>First real regression case. Unresolved items remain visibly blocked instead of being guessed.</p>
      </div>
      <span class="case-badge">VERIFIED CASE</span>
    </div>
    ${notes}
    ${questions}
    ${packages}
    <div class="section-header"><strong>Not finalized yet</strong><span>Scope gaps</span></div>
    ${t.scope_gaps.map(g=>`<div class="scope-gap">• ${esc(g)}</div>`).join('')}
  `;

  $$('[data-takeoff-q]').forEach(el => el.onclick = ()=>openTakeoffQuestion(el.dataset.takeoffQ));

  renderCuts();
  renderSpecial();
}

function renderCuts(){
  const t = state.takeoff;
  if(!t) return;

  const dimensional = `
    <div class="section-header"><strong>Package cut plan</strong><span>1/8\" saw kerf</span></div>
    <table class="cut-table">
      <thead><tr><th>Board IDs</th><th>Stock</th><th>Cuts</th><th>Destination</th><th>Drop</th></tr></thead>
      <tbody>${t.cut_plan.map(r=>`
        <tr>
          <td><b>${esc(r.board_ids)}</b><br>${esc(r.qty_boards)} boards</td>
          <td>${esc(r.stock)}</td>
          <td>${r.cuts_each.map(c=>esc(c)).join('<br>')}</td>
          <td>${esc(r.destination)}</td>
          <td>${esc(r.drop_each)}</td>
        </tr>
      `).join('')}</tbody>
    </table>`;

  const ewp = `
    <div class="section-header"><strong>EWP supplier cut schedule</strong><span>Package P02</span></div>
    <table class="cut-table">
      <thead><tr><th>Qty</th><th>Member</th><th>Length</th><th>Location</th></tr></thead>
      <tbody>${t.ewp_cut_schedule.map(r=>`
        <tr>
          <td><b>${esc(r.qty)}</b></td>
          <td>${esc(r.member)}</td>
          <td>${esc(r.length)}</td>
          <td>${esc(r.location)}</td>
        </tr>
      `).join('')}</tbody>
    </table>`;

  $('#cutsPanel').innerHTML = dimensional + ewp;
}

function renderSpecial(){
  const t = state.takeoff;
  if(!t) return;
  const special = [];
  for(const pkg of t.packages){
    for(const item of pkg.materials){
      if((item.stock_status || '').toUpperCase().includes('SPECIAL')){
        special.push({pkg, item});
      }
    }
  }
  $('#specialPanel').innerHTML = `
    <div class="takeoff-head">
      <div><h3>Special-order package</h3><p>Engineered lumber, trusses, and dimensional material over 16 ft.</p></div>
      <span class="case-badge">${special.length} LINES</span>
    </div>
    ${special.map(({pkg,item})=>`
      <div class="special-card">
        <b>${esc(pkg.id)} · ${esc(item.material)}</b>
        <span>${esc(item.qty)} ${esc(item.unit||'')} ${esc(item.length || item.purchase || item.cut_length || '')}</span>
        ${item.assembly?`<span>${esc(item.assembly)}</span>`:''}
        <span>Source: ${esc(item.source || '')}</span>
      </div>
    `).join('')}
  `;
}

function activateInspectorTab(name){
  $$('.inspect-tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===name));
  $$('.inspect-pane').forEach(x=>x.classList.toggle('active', x.id===`${name}Tab`));
}

function openModal({title, question, evidence, type, id}){
  state.modalContext = {type,id};
  $('#modalTitle').textContent = title;
  $('#modalQuestion').textContent = question;
  $('#modalEvidence').textContent = evidence || '';
  $('#modalAnswer').value = '';
  $('#modal').style.display = 'grid';
}
function closeModal(){
  $('#modal').style.display = 'none';
  state.modalContext = null;
}
function openPlanClar(id){
  const c = state.project.clarifications.find(x=>x.id===id);
  if(!c) return;
  openModal({
    title:c.title, question:c.question, evidence:c.evidence,
    type:'plan', id:c.id
  });
}
function openTakeoffQuestion(id){
  const q = state.takeoff.blocking_questions.find(x=>x.id===id);
  if(!q) return;
  openModal({
    title:q.title, question:q.question,
    evidence:`Source: ${q.source}. This answer will be treated as authoritative for the order.`,
    type:'takeoff', id:q.id
  });
}

async function resolveModal(){
  const answer = $('#modalAnswer').value.trim();
  if(!answer){
    toast('Enter the authoritative answer first.');
    return;
  }
  const ctx = state.modalContext;
  if(!ctx) return;

  try{
    if(ctx.type === 'plan'){
      state.project = await apiJson(
        `/api/projects/${state.project.id}/clarifications/${ctx.id}/resolve`,
        {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({answer})}
      );
      renderProject();
      await showPage(state.page);
    }else{
      state.takeoff = await apiJson(
        `/api/projects/${state.project.id}/takeoff/questions/${ctx.id}/resolve`,
        {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({answer})}
      );
      renderTakeoff();
      $('#takeoffBlockers').textContent = openTakeoffQuestions().length;
    }
    closeModal();
    updateFinalize();
    toast('Authoritative answer saved.');
  }catch(err){
    toast(err.message);
  }
}

function updateFinalize(){
  const n = totalBlocking();
  $('#finalizeBtn').disabled = !state.project || n > 0;
  $('#drawerMessage').textContent = !state.project
    ? 'Actual material quantities remain locked until a plan is loaded.'
    : n
      ? `${n} blocking clarification${n===1?'':'s'} remain. Finalization stays locked.`
      : state.takeoff
        ? 'All current blocking clarifications are resolved. Remaining scope gaps are clearly marked.'
        : 'Plan-reading blockers are cleared, but no verified material takeoff is available yet.';
  $('#takeoffBlockers').textContent = openTakeoffQuestions().length;
}

function pick(){ $('#fileInput').click(); }

$('#uploadPrimary').onclick = pick;
$('#uploadTop').onclick = pick;
$('#chooseFile').onclick = pick;
$('#fileInput').onchange = e => upload(e.target.files[0]);

const dz = $('#dropZone');
['dragenter','dragover'].forEach(ev => dz.addEventListener(ev,e=>{
  e.preventDefault(); dz.classList.add('dragging');
}));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev,e=>{
  e.preventDefault(); dz.classList.remove('dragging');
}));
dz.addEventListener('drop',e=>upload(e.dataTransfer.files[0]));

$('#prevPage').onclick = ()=>showPage(state.page-1);
$('#nextPage').onclick = ()=>showPage(state.page+1);
$('#zoomOut').onclick = ()=>{ state.zoom=Math.max(.35,state.zoom-.1); applyZoom(); };
$('#zoomIn').onclick = ()=>{ state.zoom=Math.min(2.5,state.zoom+.1); applyZoom(); };
$('#fitBtn').onclick = ()=>{ state.zoom=1; applyZoom(); };

$$('.inspect-tab').forEach(b=>b.onclick=()=>activateInspectorTab(b.dataset.tab));

$('#copyText').onclick = async()=>{
  try{
    await navigator.clipboard.writeText($('#sheetText').textContent);
    toast('Sheet text copied.');
  }catch{
    toast('Clipboard access was blocked by the browser.');
  }
};

$('#modalClose').onclick = closeModal;
$('#modalCancel').onclick = closeModal;
$('#modalResolve').onclick = resolveModal;
$('#modal').onclick = e => { if(e.target.id==='modal') closeModal(); };

$('#analyzeBtn').onclick = ()=>{
  if(!state.project) return;
  if(state.takeoff){
    activateInspectorTab('takeoff');
    toast(`Verified takeoff loaded. ${totalBlocking()} blocking clarification${totalBlocking()===1?'':'s'} remain.`);
  }else{
    toast(`Plan set read. ${openClarifications().length} unresolved plan clarification${openClarifications().length===1?'':'s'} found.`);
  }
};

$('#finalizeBtn').onclick = async()=>{
  if(!state.project) return;
  try{
    const d = await apiJson(`/api/projects/${state.project.id}/finalize-check`);
    if(!d.can_finalize){ toast(d.message); return; }
    toast('Current review can be finalized. No unresolved order-impacting questions remain.');
  }catch(err){ toast(err.message); }
};

async function resume(){
  $('#emptyState').hidden = true;
  $('#loadingState').hidden = false;
  $('#loadingTitle').textContent = 'Opening saved project…';
  $('#loadingText').textContent = 'Loading the most recent plan and takeoff state.';

  try{
    const params = new URLSearchParams(location.search);
    const id = params.get('project');
    let project;
    if(id){
      project = await apiJson(`/api/projects/${encodeURIComponent(id)}`);
    }else{
      project = await apiJson('/api/projects/latest');
      history.replaceState(null,'',`?project=${encodeURIComponent(project.id)}`);
    }
    await loadProjectObject(project, true);
  }catch{
    $('#emptyState').hidden = false;
  }finally{
    $('#loadingState').hidden = true;
  }
}
resume();
