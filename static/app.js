const state={project:null,page:1,zoom:1,activeClar:null,textCache:{}};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3200)}
function esc(s){return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function openClarifications(){return state.project?state.project.clarifications.filter(c=>c.status==='open'):[]}
function blockingClarifications(){return openClarifications().filter(c=>c.blocking)}
function currentPage(){return state.project?.pages.find(p=>p.page===state.page)||null}

function forceModalClosed(){
  const modal=$('#modal');
  if(!modal)return;
  modal.hidden=true;
  modal.style.display='none';
  state.activeClar=null;
}

async function upload(file){
  if(!file||!file.name.toLowerCase().endsWith('.pdf')){toast('Choose a PDF plan set.');return}
  $('#emptyState').hidden=true;$('#imageStage').hidden=true;$('#loadingState').hidden=false;
  $('#loadingTitle').textContent=`Reading ${file.name}`;$('#loadingText').textContent='Rendering sheets, extracting text, and checking cross-references…';
  const form=new FormData();form.append('file',file);
  try{
    const res=await fetch('/api/projects/upload',{method:'POST',body:form});
    const body=await res.json();if(!res.ok)throw new Error(body.detail||'Upload failed');
    state.project=body;state.page=1;state.zoom=1;state.textCache={};
    $('#projectBlock').hidden=false;$('#analyzeBtn').disabled=false;
    renderAll();await showPage(1);toast(`Loaded ${body.page_count} sheet${body.page_count===1?'':'s'}.`)
  }catch(err){$('#emptyState').hidden=false;toast(err.message)}finally{$('#loadingState').hidden=true}
}

function renderAll(){
  const p=state.project;if(!p)return;
  $('#projectName').textContent=p.name;$('#projectMeta').textContent=`${p.page_count} sheets · ${p.filename}`;$('#sheetCounter').textContent=p.page_count;
  $('#textPages').textContent=p.analysis.text_pages;$('#imagePages').textContent=p.analysis.image_only_pages;$('#hitCount').textContent=p.analysis.review_hit_count;$('#missingRefCount').textContent=p.missing_references.length;
  $('#refCount').textContent=p.cross_references.length;$('#analysisStatus').textContent=`${p.page_count} sheets parsed — review unresolved information before measuring`;
  $('#phaseUpload').classList.add('done');$('#phaseUpload').classList.remove('active');$('#phaseRead').classList.add('done');$('#phaseClarify').classList.add('active');
  renderSheets();renderClarifications();updateFinalize();
}

function renderSheets(){
  const list=$('#sheetList');const p=state.project;
  list.innerHTML=p.pages.map(pg=>`<div class="sheet-card ${pg.page===state.page?'active':''}" data-page="${pg.page}">
    <img src="${pg.thumb_url}" alt="Page ${pg.page} thumbnail"><div><b class="${pg.sheet_number?'':'unknown'}">${esc(pg.sheet_number||`Page ${pg.page} — unconfirmed`)}</b><span>${esc(pg.title||'Title not confirmed')}</span></div></div>`).join('');
  $$('.sheet-card').forEach(x=>x.onclick=()=>showPage(Number(x.dataset.page)));
}

async function showPage(n){
  if(!state.project)return;state.page=Math.max(1,Math.min(n,state.project.page_count));state.zoom=1;
  renderSheets();const pg=currentPage();
  $('#currentSheetNumber').textContent=pg.sheet_number||`PAGE ${pg.page}`;$('#currentSheetTitle').textContent=pg.title||'Sheet title not confirmed';
  $('#currentSheetSub').textContent=pg.scales.length?`Detected scale${pg.scales.length>1?'s':''}: ${pg.scales.join(' · ')}`:'Scale not confirmed on this sheet';
  $('#pageIndicator').textContent=`${pg.page} / ${state.project.page_count}`;$('#prevPage').disabled=pg.page===1;$('#nextPage').disabled=pg.page===state.project.page_count;
  ['zoomOut','zoomIn','fitBtn'].forEach(id=>$('#'+id).disabled=false);
  const img=$('#planImage');img.src=pg.preview_url;$('#emptyState').hidden=true;$('#imageStage').hidden=false;applyZoom();
  renderPageInfo();renderReviewHits();await loadText();
}

function applyZoom(){const img=$('#planImage');img.style.width=`${Math.round(state.zoom*100)}%`;img.style.height='auto';$('#zoomLabel').textContent=`${Math.round(state.zoom*100)}%`}
function renderPageInfo(){const pg=currentPage();if(!pg)return;$('#sheetInfo').innerHTML=`
  <div class="info-row"><small>Sheet number</small><strong>${esc(pg.sheet_number||'NOT CONFIRMED')}</strong></div>
  <div class="info-row"><small>Sheet title</small><strong>${esc(pg.title||'NOT CONFIRMED')}</strong></div>
  <div class="info-row"><small>Detected scale text</small><strong>${esc(pg.scales.length?pg.scales.join(' · '):'NOT CONFIRMED')}</strong></div>
  <div class="info-row"><small>Extractable text</small><strong>${pg.has_extractable_text?'Yes':'No — review required'}</strong></div>
  <div class="info-row"><small>PDF page size</small><strong>${pg.width_pt} × ${pg.height_pt} pt</strong></div>
  <div class="info-row"><small>Text characters</small><strong>${pg.text_characters.toLocaleString()}</strong></div>`}

function renderReviewHits(){const pg=currentPage();if(!pg)return;const el=$('#reviewHits');if(!pg.review_hits.length){el.innerHTML='<div class="empty-small">No configured framing/scope keywords were found in the extractable text on this sheet.</div>';return}
  el.innerHTML=pg.review_hits.slice(0,35).map(h=>`<div class="hit"><b>${esc(h.term)}</b><p>${esc(h.text)}</p></div>`).join('')}

async function loadText(){const pg=currentPage();if(!pg)return;if(state.textCache[pg.page]!=null){$('#sheetText').textContent=state.textCache[pg.page]||'No extractable PDF text on this sheet.';return}
  try{const r=await fetch(pg.text_url);const d=await r.json();state.textCache[pg.page]=d.text;$('#sheetText').textContent=d.text||'No extractable PDF text on this sheet.'}catch{$('#sheetText').textContent='Could not load extracted text.'}}

function renderClarifications(){const p=state.project;if(!p)return;const open=openClarifications(),block=blockingClarifications();$('#openClarCount').textContent=open.length;$('#blockingCount').textContent=block.length;$('#clarificationLabel').textContent=`${open.length} open`;
  const items=[...open,...p.clarifications.filter(c=>c.status==='resolved')];
  $('#clarificationList').innerHTML=items.length?items.map(c=>c.status==='resolved'?`<div class="resolved-card"><b>✓ ${esc(c.title)}</b><p>${esc(c.answer)}</p></div>`:`<div class="clar-card ${c.blocking?'':'nonblocking'}" data-clar="${c.id}"><b>${esc(c.title)}</b><p>${esc(c.question)}</p><div class="clar-meta"><span>${c.blocking?'<span class="blocking-tag">BLOCKING</span>':'<span class="advisory-tag">REVIEW</span>'}</span><span>${c.page?`Page ${c.page}`:'Plan set'}</span></div></div>`).join(''):'<div class="empty-small">No unresolved clarifications.</div>';
  $$('[data-clar]').forEach(el=>el.onclick=()=>openClar(el.dataset.clar));
}

function openClar(id){
  if(!state.project)return;
  const c=state.project.clarifications.find(x=>x.id===id);
  if(!c)return;
  state.activeClar=id;
  $('#modalTitle').textContent=c.title;
  $('#modalQuestion').textContent=c.question;
  $('#modalEvidence').textContent=c.evidence;
  $('#modalAnswer').value='';
  const modal=$('#modal');
  modal.hidden=false;
  modal.style.display='grid';
}
function closeModal(){forceModalClosed()}
async function resolveClar(){const answer=$('#modalAnswer').value.trim();if(!answer){toast('Enter the authoritative answer first.');return}const c=state.project.clarifications.find(x=>x.id===state.activeClar);if(!c)return;
  const r=await fetch(`/api/projects/${state.project.id}/clarifications/${c.id}/resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answer})});const d=await r.json();if(!r.ok){toast(d.detail||'Could not save clarification');return}state.project=d;closeModal();renderAll();await showPage(state.page);toast('Clarification saved as a user-approved value.')}
function updateFinalize(){const n=blockingClarifications().length;$('#finalizeBtn').disabled=!state.project||n>0;$('#drawerMessage').textContent=n?`${n} blocking clarification${n===1?'':'s'} remain. Measurement/takeoff finalization stays locked.`:'All blocking clarifications are resolved. The plan set is ready for the measurement-engine stage.';if(!n&&state.project){$('#phaseClarify').classList.add('done');$('#phaseClarify').classList.remove('active');$('#phaseMeasure').classList.add('active')}}

function pick(){$('#fileInput').click()}
$('#uploadPrimary').onclick=pick;$('#uploadTop').onclick=pick;$('#chooseFile').onclick=pick;$('#fileInput').onchange=e=>upload(e.target.files[0]);
const dz=$('#dropZone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragging')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragging')}));dz.addEventListener('drop',e=>upload(e.dataTransfer.files[0]));
$('#prevPage').onclick=()=>showPage(state.page-1);$('#nextPage').onclick=()=>showPage(state.page+1);$('#zoomOut').onclick=()=>{state.zoom=Math.max(.35,state.zoom-.1);applyZoom()};$('#zoomIn').onclick=()=>{state.zoom=Math.min(2.5,state.zoom+.1);applyZoom()};$('#fitBtn').onclick=()=>{state.zoom=1;applyZoom()};
$$('.inspect-tab').forEach(b=>b.onclick=()=>{$$('.inspect-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.inspect-pane').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.tab+'Tab').classList.add('active')});
$('#copyText').onclick=async()=>{try{await navigator.clipboard.writeText($('#sheetText').textContent);toast('Sheet text copied.')}catch{toast('Clipboard access was blocked by the browser.')}};
$('#modalClose').onclick=closeModal;$('#modalCancel').onclick=closeModal;$('#modalResolve').onclick=resolveClar;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
$('#analyzeBtn').onclick=()=>{if(!state.project)return;toast(`Plan set read. ${openClarifications().length} unresolved clarification${openClarifications().length===1?'':'s'} found; no values were invented.`)};
$('#finalizeBtn').onclick=async()=>{if(!state.project)return;const r=await fetch(`/api/projects/${state.project.id}/finalize-check`);const d=await r.json();if(!d.can_finalize){toast(d.message);return}toast('Plan-reading review finalized. Measurement engine is the next stage.')};
$('#railClar').onclick=()=>{$$('.inspect-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='review'));$$('.inspect-pane').forEach(x=>x.classList.toggle('active',x.id==='reviewTab'))};

async function resumeFromUrl(){
  const id=new URLSearchParams(location.search).get('project');
  if(!id)return;
  $('#emptyState').hidden=true;$('#loadingState').hidden=false;$('#loadingTitle').textContent='Opening saved project…';$('#loadingText').textContent='Loading previously parsed plan data.';
  try{const r=await fetch(`/api/projects/${id}`);const d=await r.json();if(!r.ok)throw new Error(d.detail||'Project not found');state.project=d;state.page=1;state.zoom=1;$('#projectBlock').hidden=false;$('#analyzeBtn').disabled=false;renderAll();await showPage(1)}
  catch(e){$('#emptyState').hidden=false;toast(e.message)}finally{$('#loadingState').hidden=true}
}

forceModalClosed();
resumeFromUrl();
