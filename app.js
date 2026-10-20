(() => {
  'use strict';
  const C = window.PDMCalc;
  const ROWS = window.PDM_ISA_TABLE;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const validTabs = ['overview','atmosphere','winds','speeds','engine','cruise','vertical','coverage'];
  const labels = {overview:'Overview',atmosphere:'Atmosphere & airspeed',winds:'Runway & wind',speeds:'Reference speeds',engine:'Engine power',cruise:'Cruise & fuel',vertical:'Climb & descent',coverage:'Chart coverage'};
  const stored = (()=>{try{return JSON.parse(localStorage.getItem('pdm-input-v1') || '{}') || {}}catch{return {}}})();
  for(const el of $$('[data-key]')){
    if(Object.prototype.hasOwnProperty.call(stored,el.dataset.key)) el.value=stored[el.dataset.key];
  }
  const get = name => {
    const el = document.querySelector(`[data-key="${name}"]`);
    if (!el) return undefined;
    if (el.tagName === 'SELECT') return el.value;
    if (el.value.trim() === '') return undefined;
    const num = Number(el.value);
    return Number.isFinite(num) ? num : NaN;
  };
  const num = (v,dec=1)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:dec,minimumFractionDigits:dec}).format(v):'—';
  const metric = (v,label,unit,description)=>`<div class="main-metric"><span class="metric-label">${label}</span><span class="metric-big">${num(v)} <small>${unit}</small></span><span class="metric-caption">${description}</span></div>`;
  const stat = (label,v,unit='',dec=1)=>`<div class="stat"><small>${label}</small><strong>${num(v,dec)} <span>${unit}</span></strong></div>`;
  const group = (...items)=>`<div class="stat-grid">${items.join('')}</div>`;
  const meta = str=>`<p class="result-meta">${str}</p>`;
  const problem = e=>`<div class="result-error">${String(e.message||e).replace(/</g,'&lt;')}</div>`;
  const setHTML=(target, markup)=>{const el=$(target);if(el)el.innerHTML=markup;};
  let current='overview';
  let installEvent=null;
  const toast=(msg)=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window._toastTimeout);window._toastTimeout=setTimeout(()=>el.classList.remove('show'),2300)};

  function navigate(tab){
    if (!validTabs.includes(tab)) tab='overview';
    current=tab;
    $$('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${tab}`));
    $$('.nav-item').forEach(el=>{const active=el.dataset.tab===tab;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
    $('#breadcrumbCurrent').textContent=labels[tab];
    $('#sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'instant'});
    calculateAll();
  }
  function updateAtmos(){
    try {
      const alt=get('altitude'), temp=get('oat');
      const a=C.atmosphere(ROWS,alt,temp);
      const eas=get('eas');
      const extras=Number.isFinite(eas)&&eas>=0 ? group(stat('Equivalent airspeed',eas,'KEAS'),stat('True airspeed from EAS',eas*a.easToTasMultiplier,'KTAS')) : `<p class="no-data">Supply EAS to estimate TAS using density ratio.</p>`;
      setHTML('#atmosResult',metric(a.deviation,'ISA deviation','°C',`${a.deviation>=0?'ISA +':'ISA −'}${num(Math.abs(a.deviation))} °C, interpolated from Table 1-1`)+group(
        stat('ISA temperature',a.isaC,'°C'),stat('Standard pressure',a.pressureInHg,'inHg',2),
        stat('ISA density ratio σ',a.sigma,'',4),stat('Actual density ratio',a.actualDensityRatio,'',4),
        stat('Pressure ratio δ',a.delta,'',4),stat('Actual density',a.densityKgM3,'kg/m³',3)
      )+`<div class="math-details">EAS/TAS based on TAS = EAS / √(actual density ratio).</div><div style="height:13px"></div>`+extras+meta('Source: Table 1-1 for ISA. Actual-temperature density and EAS/TAS are standard physics extensions, not chart-derived CAS/TAS performance. No IAS correction is applied.'));
      drawISA(a.altitude,a.oatC,a.isaC);
    } catch(e){setHTML('#atmosResult',problem(e));setHTML('#isaGraph','');}
  }
  function drawISA(alt,temp,isaTemp){
    const w=800,h=240,left=56,right=20,top=25,bottom=35;
    const x=v=>left+(v+65)/90*(w-left-right);
    const y=v=>h-bottom-v/30000*(h-top-bottom);
    const ticks=[-60,-40,-20,0,20];
    let path='';
    ROWS.forEach((r,i)=>{path+=`${i?'L':'M'} ${x(r[4]).toFixed(2)} ${y(r[0]).toFixed(2)} `;});
    const grid=ticks.map(t=>`<line x1="${x(t)}" y1="${top}" x2="${x(t)}" y2="${h-bottom}" stroke="#254056" stroke-dasharray="4 7"/><text x="${x(t)}" y="${h-13}" font-size="12" fill="#7fa4b8" text-anchor="middle">${t}°C</text>`).join('')+
      [0,5000,10000,15000,20000,25000,30000].map(v=>`<line x1="${left}" y1="${y(v)}" x2="${w-right}" y2="${y(v)}" stroke="#203b50" stroke-dasharray="3 7"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#7fa4b8">${v/1000}k</text>`).join('');
    const cx=x(isaTemp),cy=y(alt),ax=x(temp);
    const svg=`<svg role="img" aria-label="ISA temperature by pressure altitude from the published table, with currently selected altitude and temperature" viewBox="0 0 ${w} ${h}">${grid}<path d="${path}" stroke="#4ed6c9" stroke-width="3" fill="none"/><line x1="${cx}" x2="${ax}" y1="${cy}" y2="${cy}" stroke="#f9bd80" stroke-width="3" stroke-dasharray="5 4"/><circle cx="${cx}" cy="${cy}" r="6" fill="#53eadb" stroke="#072139" stroke-width="3"/><circle cx="${ax}" cy="${cy}" r="5" fill="#f6c27f" stroke="#072139" stroke-width="2"/></svg><p class="graph-caption">Teal: published ISA profile. Orange: difference between standard and input OAT at your selected altitude. Altitude axis in thousands of feet.</p>`;
    setHTML('#isaGraph',svg);
  }
  function updateWind(){
    try {
      const a=C.winds(get('rw'),get('wd'),get('ws'),get('wg'),get('policy'));
      const surface=get('surface');
      const rcr=C.runwayRcr[surface],rfi=C.runwayRfi[surface];
      const primary=a.tailwind>0?{name:'Tailwind incl. gust',value:a.tailwind}:{name:'Headwind steady',value:a.headwind};
      setHTML('#windResult',metric(primary.value,primary.name,'kt',`Wind angle: ${num(a.angle,0)}° relative to runway`)+group(
        stat('Headwind component',a.headwind,'kt'),stat('Tailwind component',a.tailwind,'kt'),
        stat(`Crosswind ${a.crosswindSide}`,a.crosswind,'kt'),stat('Gust increment',a.gustIncrement,'kt'),
        stat('Applied headwind allowance',a.appliedHeadwind,'kt'),stat('150% tailwind allowance',a.appliedTailwind,'kt'),
        stat('Runway RCR',rcr ?? NaN,'',0),stat('Runway RFI',rfi ?? NaN,'',0)
      )+meta('Headwind uses steady wind. Tailwind and crosswind use gust-inclusive wind, matching PDM Section 3. For obstacle clearance, the PDM takes zero headwind credit. RCR/RFI are input classifications, not braking-distance outputs.'));
    }catch(e){setHTML('#windResult',problem(e));}
  }
  function updateSpeeds(){
    try {
      const props={vsrUp:get('vsrUp'),vsrLanding:get('vsrLand'),vmcl:get('vmcl'),vth:get('vth'),vsrTakeoff:get('vsrTo'),vmca:get('vmca'),normalV2Factor:get('v2factor')};
      for(const [k,v] of Object.entries(props)) if(!Number.isFinite(v)||v<=0)throw Error(`Enter a valid positive value for ${k}.`);
      if(props.normalV2Factor<1.13||props.normalV2Factor>1.18) throw Error('Normal V2 factor must be 1.13–1.18.');
      const v=C.speeds(props);
      setHTML('#speedResult',metric(v.vapp,'VAPP','KIAS','VTH + 10 KIAS · definition on PDM 1-3')+group(
        stat('VFTO',v.vfto,'kt'),stat('VTO-UP minimum',v.vtoUpMin,'KIAS'),
        stat('Normal VREF',v.vrefNormal,'kt'),stat('Short-field VREF',v.vrefShort,'kt'),
        stat('Normal V2 candidate*',v.normalV2Candidate,'kt')
      )+meta('*V2 candidate demonstrates the described 1.13–1.18 VSR and 1.1 VMCA relation only. Full selection requires operational charts and conditions. Different VSR inputs must correspond to their actual flap configurations.'));
    }catch(e){setHTML('#speedResult',problem(e));}
  }
  function updateEngine(){
    setHTML('#powerRows',C.POWER.map(row=>`<tr><td><strong>${row.setting}</strong></td><td>${row.bleed}</td><td>${row.np}</td><td>${num(row.shp,0)} SHP</td><td>${row.limit}</td></tr>`).join(''));
  }
  function updateCruise(){
    try {
      const data=C.cruise({tas:get('tas'),headwind:get('hw'),fuelFlowPerEngine:get('ff'),engines:Number(get('engines')),usableFuel:get('fuel'),durationMin:get('dur'),distanceNm:get('dist')});
      setHTML('#cruiseResult',metric(data.groundRangeNm,'Ground range on fuel budget','NM','Constant TAS, groundspeed and fuel flow; no reserves deducted')+group(
        stat('Groundspeed',data.groundSpeed,'kt'),stat('Total fuel flow',data.totalFlow,'kg/h'),
        stat('Specific range',data.specificRange,'NM/kg',3),stat('Specific ground range',data.specificGroundRange,'NM/kg',3),
        stat('Endurance',data.enduranceHours,'h',2),stat('Still-air range',data.stillAirRangeNm,'NM'),
        stat('Fuel for selected duration',data.legFuelKg,'kg'),stat('Distance in duration',data.legDistanceNm,'NM'),
        stat('Fuel for selected distance',data.fuelForDistanceKg,'kg'),stat('Time for distance',data.durationForDistanceMin,'min')
      )+meta('Uses the PDM definitions SR = TAS / total fuel flow and SGR = GS / total fuel flow. No climb, descent, reserve, taxi, contingency or aircraft performance allowances are included.'));
    }catch(e){setHTML('#cruiseResult',problem(e));}
  }
  function updateVertical(){
    try {
      const d=C.vertical({startFt:get('startAlt'),endFt:get('endAlt'),rateFpm:get('verticalRate'),groundSpeed:get('vgs')});
      setHTML('#verticalResult',metric(d.minutes,`Time to ${d.direction}`,'min','Constant vertical speed and groundspeed assumption')+group(
        stat('Altitude change',d.altitudeChangeFt,'ft',0),stat('Horizontal distance',d.horizontalDistanceNm,'NM'),
        stat('Average vertical rate',get('verticalRate'),'ft/min',0),stat('Track speed',get('vgs'),'kt',0),
        stat('Geometric track gradient',d.gradientPercent,'%',2)
      )+meta('Gradient is vertical rise/run as a percentage using groundspeed and 1 NM = 6076.12 ft. It is not an aircraft-certified climb gradient and is not a takeoff obstacle-clearance calculation.'));
    } catch(e){setHTML('#verticalResult',problem(e));}
  }
  function calculateAll(){updateAtmos();updateWind();updateSpeeds();updateEngine();updateCruise();updateVertical();}
  function save(){
    const values={};for(const el of $$('[data-key]'))values[el.dataset.key]=el.value;
    try{localStorage.setItem('pdm-input-v1',JSON.stringify(values))}catch{}
  }
  function exportData(){
    const fields={};for(const el of $$('[data-key]'))fields[el.dataset.key]=el.value;
    const out={app:'PDM training-only offline calculator',source:'CA-0117B-PD000-02, Issue 001, 21/12/2022',warning:'NOT APPROVED FOR FLIGHT',exportedAt:new Date().toISOString(),inputs:fields,assumptions:'ISA table interpolated; input-provided performance, chart-based results NOT computed.'};
    const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pdm-training-inputs.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);toast('Training input JSON exported.');
  }
  $$('#menu .nav-item').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>navigate(location.hash.substring(1)),0)));
  $$('.jump').forEach(el=>el.addEventListener('click',()=>{location.hash=el.dataset.goto;navigate(el.dataset.goto)}));
  $('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('.content-wrap').addEventListener('click',e=>{if(!e.target.closest('.mobile-menu'))$('#sidebar').classList.remove('open')});
  $('#exportBtn').addEventListener('click',exportData);
  $$('[data-key]').forEach(el=>{el.addEventListener('input',()=>{save();calculateAll()});el.addEventListener('change',()=>{save();calculateAll()})});
  window.addEventListener('hashchange',()=>navigate(location.hash.substring(1)));
  window.addEventListener('online',updateNet);window.addEventListener('offline',updateNet);
  function updateNet(){const el=$('#netStatus');el.innerHTML=navigator.onLine?'<i></i> READY OFFLINE':'<i></i> OFFLINE MODE';}
  window.addEventListener('beforeinstallprompt',evt=>{evt.preventDefault();installEvent=evt;$('#installBtn').classList.remove('hidden')});
  $('#installBtn').addEventListener('click',async()=>{if(!installEvent)return;installEvent.prompt();try{await installEvent.userChoice}catch{}installEvent=null;$('#installBtn').classList.add('hidden')});
  if('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }
  updateNet();navigate(location.hash.replace('#','')||'overview');
})();
