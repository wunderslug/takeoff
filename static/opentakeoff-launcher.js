(()=>{
  const actions=document.querySelector('.topbar .actions');
  if(!actions||document.querySelector('#openMeasurementCanvas')) return;

  const btn=document.createElement('button');
  btn.id='openMeasurementCanvas';
  btn.className='btn navy';
  btn.type='button';
  btn.textContent='Measurement Canvas';
  btn.title='Open the OpenTakeoff measurement engine';
  btn.addEventListener('click',()=>{
    const url=`${window.location.protocol}//${window.location.hostname}:3016/`;
    window.open(url,'_blank','noopener');
  });

  // Put measurement before analysis/finalization because it is the next workflow step.
  const analyze=document.querySelector('#analyzeBtn');
  if(analyze) actions.insertBefore(btn,analyze);
  else actions.appendChild(btn);
})();
