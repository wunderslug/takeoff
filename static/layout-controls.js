(()=>{
  const app=document.querySelector('.app');
  const sheets=document.querySelector('.sheets-panel');
  const panelBrand=document.querySelector('.panel-brand');
  const drawer=document.querySelector('.bottom-drawer');
  const drawerTop=document.querySelector('.drawer-top');
  const grid=document.querySelector('.content-grid');
  const inspector=document.querySelector('.inspector');
  const inspectorTabs=document.querySelector('.inspector-tabs');

  let sheetApply=null;
  const setSheetsCollapsed=(collapsed)=>{
    if(!app)return;
    localStorage.setItem('takeoff.sheetsCollapsed',collapsed?'1':'0');
    if(sheetApply)sheetApply();
    else app.classList.toggle('sheets-collapsed',collapsed);
  };

  if(app&&sheets&&panelBrand&&!document.querySelector('#sheetsCollapse')){
    const btn=document.createElement('button');
    btn.id='sheetsCollapse';
    btn.className='panel-collapse-btn';
    btn.type='button';
    btn.title='Hide sheet list';
    btn.setAttribute('aria-label','Hide sheet list');
    btn.textContent='‹';
    panelBrand.appendChild(btn);

    sheetApply=()=>{
      const collapsed=localStorage.getItem('takeoff.sheetsCollapsed')==='1';
      app.classList.toggle('sheets-collapsed',collapsed);
      btn.textContent=collapsed?'›':'‹';
      btn.title=collapsed?'Show sheet list':'Hide sheet list';
      btn.setAttribute('aria-label',btn.title);
      const railPlans=document.querySelector('.rail-btn[title="Plans"]');
      if(railPlans){
        railPlans.classList.toggle('active',!collapsed);
        railPlans.title=collapsed?'Show sheets':'Hide sheets';
      }
    };
    btn.addEventListener('click',()=>setSheetsCollapsed(!app.classList.contains('sheets-collapsed')));
    sheetApply();
  }

  const railPlans=document.querySelector('.rail-btn[title="Plans"], .rail-btn[title="Show sheets"], .rail-btn[title="Hide sheets"]');
  if(railPlans&&!railPlans.dataset.sheetToggleBound){
    railPlans.dataset.sheetToggleBound='1';
    railPlans.addEventListener('click',()=>setSheetsCollapsed(!app.classList.contains('sheets-collapsed')));
  }

  if(drawer&&drawerTop&&!document.querySelector('#drawerToggle')){
    const btn=document.createElement('button');
    btn.id='drawerToggle';
    btn.className='drawer-toggle';
    btn.type='button';
    const right=drawerTop.querySelector('.phase-pills')||drawerTop.lastElementChild;
    if(right)right.appendChild(btn);else drawerTop.appendChild(btn);

    const apply=()=>{
      const expanded=localStorage.getItem('takeoff.drawerExpanded')==='1';
      drawer.classList.toggle('collapsed',!expanded);
      btn.textContent=expanded?'Hide details':'Show details';
      btn.setAttribute('aria-expanded',expanded?'true':'false');
    };
    btn.addEventListener('click',()=>{
      const expanded=drawer.classList.contains('collapsed');
      localStorage.setItem('takeoff.drawerExpanded',expanded?'1':'0');
      apply();
    });
    apply();
  }

  if(grid&&inspector&&inspectorTabs&&!document.querySelector('#inspectorCollapse')){
    const btn=document.createElement('button');
    btn.id='inspectorCollapse';
    btn.className='inspector-collapse-btn';
    btn.type='button';
    btn.title='Hide review panel';
    btn.setAttribute('aria-label','Hide review panel');
    btn.textContent='›';
    inspectorTabs.appendChild(btn);

    const apply=()=>{
      const collapsed=localStorage.getItem('takeoff.inspectorCollapsed')==='1';
      grid.classList.toggle('inspector-collapsed',collapsed);
      btn.title=collapsed?'Show review panel':'Hide review panel';
      btn.setAttribute('aria-label',btn.title);
    };
    btn.addEventListener('click',()=>{
      const next=!grid.classList.contains('inspector-collapsed');
      localStorage.setItem('takeoff.inspectorCollapsed',next?'1':'0');
      apply();
    });
    apply();
  }
})();
