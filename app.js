const $=id=>document.getElementById(id);
let lastData=null,lastIndex=0,lastLevel=null;
let basinRainData={lamone:null,marzeno:null};
const WMO={0:['Sereno','☀️'],1:['Prevalentemente sereno','🌤️'],2:['Parzialmente nuvoloso','⛅'],3:['Nuvoloso','☁️'],45:['Nebbia','🌫️'],48:['Nebbia','🌫️'],51:['Pioviggine','🌦️'],53:['Pioviggine','🌦️'],55:['Pioviggine','🌦️'],61:['Pioggia','🌧️'],63:['Pioggia','🌧️'],65:['Pioggia forte','🌧️'],80:['Rovescio','🌦️'],81:['Rovescio','🌧️'],82:['Rovescio forte','⛈️'],95:['Temporale','⛈️'],96:['Temporale/grandine','⛈️'],99:['Temporale/grandine','⛈️']};
function dewPoint(t,h){const a=17.27,b=237.7;const alpha=((a*t)/(b+t))+Math.log(Math.max(h,1)/100);return (b*alpha)/(a-alpha)}
function calcIndex(now,hourly){const rainMax=Math.max(...hourly.precipitation_probability.slice(0,6));const rainSum=hourly.precipitation.slice(0,6).reduce((a,b)=>a+b,0);let idx=0;idx+=rainMax*0.45;idx+=Math.min(25,rainSum*10);idx+=now.relative_humidity_2m>75?15:now.relative_humidity_2m>60?8:0;idx+=now.wind_gusts_10m>45?15:now.wind_gusts_10m>30?8:0;idx+=now.pressure_msl<1008?10:0;return Math.round(Math.min(100,idx))}
function level(idx){if(idx>=75)return ['Alta attenzione','rosso','red'];if(idx>=50)return ['Da seguire','arancione','yellow'];if(idx>=25)return ['Da monitorare','giallo','yellow'];return ['Tranquilla','tranquillo','green']}
function setDot(el,c){el.className='dot '+c} function setBig(c){$('statusDot').className='bigdot '+c}
function nextStart(times){const now=new Date(); let start=times.findIndex(t=>new Date(t)>now); return start<0?0:start;}

function setControlChip(id,color,label){
  const el=$(id); if(!el) return;
  const dot=el.querySelector('i'); if(dot) dot.className=color;
  const sm=el.querySelector('small'); if(sm) sm.textContent=label;
}
function updateControlBox(data){
  const box=$('controlCard'); if(!box) return;
  const c=data.current, h=data.hourly;
  const rain6=h.precipitation.slice(0,6).reduce((a,b)=>a+b,0);
  const rainMax=Math.max(...h.precipitation_probability.slice(0,6));
  const gust=Math.round(c.wind_gusts_10m||0);
  const code=c.weather_code||0;
  const storm=code>=95 || h.weather_code.slice(0,6).some(x=>x>=95);
  let color='green', title='Situazione regolare', msg='Nessun avviso operativo. Se cambia il tempo, controlla prima Allerte ER e Radar live.';

  setControlChip('controlAlertChip','green','OK');
  setControlChip('controlRainChip','green','assente');
  setControlChip('controlWindChip','green','regolare');
  setControlChip('controlStormChip','green','assenti');

  if(rainMax>=70 || rain6>=10){
    color='yellow'; title='Pioggia da seguire'; msg=`Pioggia possibile nelle prossime ore. Apri Radar ER e Pretemp per seguire l’evoluzione.`;
    setControlChip('controlRainChip','yellow','da seguire');
  }
  if(gust>=50){
    color=gust>=70?'red':'yellow'; title=gust>=70?'Raffiche forti':'Vento da monitorare'; msg=`Raffiche previste fino a ${gust} km/h. Controlla Windy e bollettino vento.`;
    setControlChip('controlWindChip',color,gust>=70?'forte':'monitorare');
  }
  if(storm){
    color='yellow'; title='Temporali possibili'; msg='Possibili celle temporalesche: controlla Radar ER, Fulmini Live e Pretemp.';
    setControlChip('controlStormChip','yellow','possibili');
  }
  if(lastIndex>=50){
    color=lastIndex>=75?'red':'yellow'; title=lastIndex>=75?'Controllo immediato':'Situazione da controllare'; msg='Indice Meteo Conte in aumento. Apri Allerte ER e Radar live per verificare.';
    setControlChip('controlAlertChip',color,'verifica');
  }
  const titleEl=$('controlTitle'), textEl=$('controlText'), corner=$('controlCorner');
  if(titleEl) titleEl.textContent=title;
  if(textEl) textEl.textContent=msg;
  if(corner) corner.className='cornerdot '+color;
}
function updateControlBoxLamone(lam,mar,state){
  if(!$('controlCard') || !state || state.level<2) return;
  const titleEl=$('controlTitle'), textEl=$('controlText'), corner=$('controlCorner');
  if(titleEl) titleEl.textContent='Fiumi da controllare';
  if(textEl) textEl.textContent=`Piogge significative su ${state.source}: apri Lamone, Fiumi ER e Pioggia a monte.`;
  if(corner) corner.className='cornerdot '+state.color;
  setControlChip('controlAlertChip',state.color,'verifica');
}

async function load(){
 try{
  await navigator.serviceWorker?.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister()));
  const url='https://api.open-meteo.com/v1/forecast?latitude=44.418&longitude=11.977&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl&timezone=Europe%2FRome&forecast_days=1';
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error('api');
  const data=await res.json(); lastData=data; const c=data.current, h=data.hourly;
  const desc=WMO[c.weather_code]||['Meteo','🌤️']; const idx=calcIndex(c,h); lastIndex=idx; const lv=level(idx); lastLevel=lv;
  const rain6=h.precipitation.slice(0,6).reduce((a,b)=>a+b,0); const rainMax=Math.max(...h.precipitation_probability.slice(0,6));
  $('headerIcon').textContent=desc[1]; $('headerTemp').textContent=Math.round(c.temperature_2m*10)/10+'°';
  $('statusTitle').textContent=lv[0];
  $('statusText').textContent=idx<25?'Nessun segnale nelle prossime 6 ore.':idx<50?'Qualche segnale da seguire.':'Controlla radar, allerte e temporali.';
  setBig(lv[2]); setDot($('dotMeteo'),lv[2]); setDot($('dotTemporali'),idx>=40?'yellow':'green'); setDot($('dotLamone'),'green'); setDot($('dotAllerte'),'green'); $('lamoneCorner').className='cornerdot green';
  $('indiceVal').textContent=idx; $('indiceLabel').textContent=lv[1];
  $('decisionTitle').textContent=idx<25?'Situazione gestibile':idx<50?'Da tenere d’occhio':'Controlla subito';
  $('decisionText').textContent=`Pioggia ${rainMax}% · raffica ${Math.round(c.wind_gusts_10m)} km/h · ${idx<25?'nessun rischio rilevante':'monitora evoluzione'}.`;
  $('tempNow').textContent=(Math.round(c.temperature_2m*10)/10)+'°C'; $('nowDesc').textContent=`${desc[0]} · ${rainMax}% pioggia max 6h`;
  $('feels').textContent=Math.round(c.apparent_temperature*10)/10+'°'; $('hum').textContent=Math.round(c.relative_humidity_2m)+'%'; $('dew').textContent=Math.round(dewPoint(c.temperature_2m,c.relative_humidity_2m)*10)/10+'°'; $('wind').textContent=Math.round(c.wind_speed_10m)+' km/h'; $('gust').textContent=Math.round(c.wind_gusts_10m)+' km/h'; $('press').textContent=Math.round(c.pressure_msl)+' hPa'; $('rain6').textContent=rain6.toFixed(1)+' mm';
  $('analysisBox').innerHTML=`<b>Perché ${idx}/100?</b><br>Pioggia max 6h ${rainMax}%, accumulo ${rain6.toFixed(1)} mm. Umidità ${Math.round(c.relative_humidity_2m)}%, raffica ${Math.round(c.wind_gusts_10m)} km/h, pressione ${Math.round(c.pressure_msl)} hPa. Se cambia il cielo, apri Radar ER, Fulmini e Lamone.`;
  renderRisk(h,idx); renderHours(h); updateControlBox(data); $('updated').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch(e){ $('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova.'; setBig('yellow'); $('decisionTitle').textContent='Valuto...'; $('decisionText').textContent='Sintesi in arrivo.'; setDot($('dotLamone'),'green'); $('lamoneCorner').className='cornerdot green'; const cc=$('controlCorner'); if(cc) cc.className='cornerdot yellow'; const ct=$('controlTitle'); if(ct) ct.textContent='Dati da aggiornare'; const cp=$('controlText'); if(cp) cp.textContent='Dati meteo non disponibili: usa i link ufficiali del Centro Controllo Meteo.'; }
}
function renderRisk(h,base){
 const target=$('riskTimeline'); if(!target) return;
 target.innerHTML='';
 for(let i=1;i<=4;i++){const p=h.precipitation_probability[i]||0;const risk=Math.max(base,p);const c=risk>=50?'yellow':'green'; const text=risk>=50?'attenzione':risk>=25?'monitorare':'tranquillo'; target.insertAdjacentHTML('beforeend',`<div class="riskitem"><span class="rball ${c}"></span><small>+${i}h</small><b>${text}</b></div>`)}
}
function renderHours(h){
 const target=$('hours'); if(!target) return;
 target.innerHTML=''; const start=nextStart(h.time);
 h.time.slice(start,start+6).forEach((t,i)=>{const k=start+i;const d=new Date(t); const code=h.weather_code[k]; const icon=(WMO[code]||['','☀️'])[1]; target.insertAdjacentHTML('beforeend',`<div class="hour"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><b>${Math.round(h.temperature_2m[k])}°</b><span>${icon}</span><small>${h.precipitation_probability[k]}% · ${h.precipitation[k].toFixed(1)}mm</small></div>`)});
}
function makeChart(vals,times,unit,type){
 const w=320,h=104,padX=18,padY=18;
 const min=Math.min(...vals), max=Math.max(...vals), span=(max-min)||1;
 const pts=vals.map((v,i)=>{
   const x=padX + i*((w-padX*2)/(Math.max(vals.length-1,1)));
   const y=h-padY - ((v-min)/span)*(h-padY*2);
   return {x,y,v,i};
 });
 const line=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const area=line + ` L ${pts[pts.length-1].x.toFixed(1)} ${h-padY} L ${pts[0].x.toFixed(1)} ${h-padY} Z`;
 const lab=pts.map((p,idx)=>{
   const d=new Date(times[idx]);
   const t=d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   const val=(type==='pressione'||type==='vento'||type==='umidita'||type==='pioggia')?Math.round(p.v):Math.round(p.v*10)/10;
   return `<g><circle cx="${p.x}" cy="${p.y}" r="4"></circle><text x="${p.x}" y="${Math.max(12,p.y-9)}" text-anchor="middle">${val}${unit}</text><text x="${p.x}" y="${h-4}" text-anchor="middle" class="time">${t}</text></g>`;
 }).join('');
 return `<div class="spark-card"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafico trend"><path class="area" d="${area}"></path><path class="line" d="${line}"></path>${lab}</svg></div>`;
}
function openTrend(type){
 if(!lastData) return; const h=lastData.hourly; const start=nextStart(h.time); const box=$('trendBox');
 const labels={temperatura:'Trend temperatura',pioggia:'Trend pioggia',vento:'Trend vento e raffiche',pressione:'Trend pressione',umidita:'Umidità e rugiada',indice:'Indice Conte'};
 let rows='', intro='', graph='';
 if(type==='indice'){
  intro=`Indice ${lastIndex}/100: ${lastLevel?.[1]||'--'}. Sintesi dei fattori principali.`;
  rows=[['Pioggia 6h',$('rain6').textContent],['Vento',$('wind').textContent],['Raffica',$('gust').textContent],['Pressione',$('press').textContent]].map(x=>`<div class="trend-row"><time>${x[0]}</time><div class="bar"><i style="width:25%"></i></div><b>${x[1]}</b></div>`).join('');
 } else {
  const cfg={
   temperatura:['temperature_2m','°','Temperatura prevista nelle prossime ore. Utile per capire calo serale, notte e picchi.'],
   pioggia:['precipitation_probability','%','Probabilità di pioggia nelle prossime ore.'],
   vento:['wind_gusts_10m',' km/h','Raffiche previste nelle prossime ore.'],
   pressione:['pressure_msl',' hPa','Pressione prevista nelle prossime ore.'],
   umidita:['relative_humidity_2m','%','Umidità prevista nelle prossime ore.']
  }[type] || ['temperature_2m','°','Trend rapido.'];
  const vals=h[cfg[0]].slice(start,start+6); const times=h.time.slice(start,start+6); const min=Math.min(...vals), max=Math.max(...vals); intro=cfg[2];
  graph=makeChart(vals,times,cfg[1],type);
  rows='';
 }
 box.innerHTML=`<div class="trend-head"><h2>${labels[type]||'Trend'}</h2><button class="closeTrend" type="button" aria-label="Chiudi trend">×</button></div><p>${intro}</p>${graph}<div class="trend-list ${graph?'mini':''}">${rows}</div>`;
 box.classList.remove('hidden'); box.scrollIntoView({behavior:'smooth',block:'start'});
 box.querySelector('.closeTrend')?.addEventListener('click',()=>box.classList.add('hidden'));
}
$('analyzeBtn')?.addEventListener('click',()=>{$('analysisBox').classList.toggle('hidden');}); $('refreshBtn')?.addEventListener('click',load);
document.querySelectorAll('[data-trend]').forEach(el=>{
  el.addEventListener('click',()=>openTrend(el.dataset.trend));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrend(el.dataset.trend)}});
});
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>$(el.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})));

$('riverChartBtn')?.addEventListener('click',()=>{
  const t=$('riverDetailText'); if(t) delete t.dataset.manualSensor;
  $('riverDetail')?.classList.toggle('hidden');
});
$('closeRiverDetail')?.addEventListener('click',(e)=>{
  e.stopPropagation();
  $('riverDetail')?.classList.add('hidden');
});

$('riverStateBtn')?.addEventListener('click',()=>{
  const d=$('riverDetail');
  if(d){
    d.classList.remove('hidden');
    d.scrollIntoView({behavior:'smooth',block:'center'});
  }
});

function openBasinDetail(key){
  const box=$('basinDetail');
  if(!box) return;
  const isMarzeno=key==='marzeno';
  const d=basinRainData[key];
  $('basinTitle').textContent=isMarzeno?'Bacino Marzeno · Modigliana':'Bacino Lamone · Marradi';
  $('basinText').textContent=isMarzeno?'Accumuli stimati sulla vallata Modigliana/Marzeno: dato utile prima della confluenza con il Lamone.':'Accumuli stimati sull’alto Lamone lato Marradi/Toscana: primo segnale da guardare a monte.';
  $('basin1h').textContent=d?d.h1.toFixed(1)+' mm':'-- mm';
  $('basin3h').textContent=d?d.h3.toFixed(1)+' mm':'-- mm';
  $('basin6h').textContent=d?d.h6.toFixed(1)+' mm':'-- mm';
  box.classList.remove('hidden');
  box.scrollIntoView({behavior:'smooth',block:'center'});
}
document.querySelectorAll('[data-basin]').forEach(btn=>btn.addEventListener('click',()=>openBasinDetail(btn.dataset.basin)));
$('closeBasinDetail')?.addEventListener('click',(e)=>{e.stopPropagation();$('basinDetail')?.classList.add('hidden');});



async function fetchBasinRain(key, lat, lon){
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&past_days=1&forecast_days=1&timezone=Europe%2FRome`;
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('rain api');
  const data=await res.json();
  const times=data.hourly.time.map(t=>new Date(t));
  const vals=data.hourly.precipitation||[];
  const now=new Date();
  const past=[];
  for(let i=0;i<times.length;i++){
    if(times[i] <= now) past.push({t:times[i],v:Number(vals[i]||0)});
  }
  function sumHours(n){return past.slice(-n).reduce((a,b)=>a+b.v,0)}
  const d={h1:sumHours(1),h3:sumHours(3),h6:sumHours(6),h24:sumHours(24),updated:new Date()};
  basinRainData[key]=d;
  return d;
}
function rainColor(mm6){return mm6>=50?'red':mm6>=25?'yellow':'green'}
function setBasinCard(key,d){
  const el=$(key==='lamone'?'basinLamoneSummary':'basinMarzenoSummary');
  if(!el) return;
  el.textContent=`1h ${d.h1.toFixed(1)} · 3h ${d.h3.toFixed(1)} · 6h ${d.h6.toFixed(1)} mm`;
  el.style.color=d.h6>=25?'var(--yellow)':'var(--green)';
}
function updateLamoneDecision(lam, mar){
  const state=sensorStateFromRain(lam,mar);
  const color=state.color;
  const titleEl=document.querySelector('.emergency-status h2');
  const descEl=document.querySelector('.emergency-status p');
  const decStrong=document.querySelector('.compact-decision strong');
  const decText=$('lamoneDecisionText') || document.querySelector('.compact-decision p');
  const riverDot=document.querySelector('.river-status .river-dot');
  if(riverDot) riverDot.className='river-dot '+color;
  const corner=$('lamoneCorner'); if(corner) corner.className='cornerdot '+color;
  const dot=$('dotLamone'); if(dot) setDot(dot,color);
  const drawerCorner=$('lamoneDrawerCorner'); if(drawerCorner) drawerCorner.className='cornerdot '+color;
  const drawerTitle=$('lamoneDrawerTitle');
  const drawerText=$('lamoneDrawerText');
  const drawerState=$('lamoneDrawerState');
  const drawerRain=$('lamoneDrawerRain');
  if(drawerRain) drawerRain.textContent=`${Math.max(lam?.h6||0,mar?.h6||0).toFixed(1)} mm / 6h`;
  if(drawerState) drawerState.textContent=state.level>=3?'criticità':state.level===2?'monitorare':state.level===1?'osservazione':'regolare';
  if(drawerTitle) drawerTitle.textContent=state.level>=3?'Lamone in criticità':state.level===2?'Lamone da monitorare':state.level===1?'Lamone sotto osservazione':'Lamone';
  if(drawerText) drawerText.textContent=state.level>=2?'Piogge significative a monte: apri il contenitore e segui sensori e onda verso valle.':state.level===1?'Primi accumuli a monte: il contenitore è pronto per un controllo rapido.':'Sensori, pioggia a monte e onda di piena.';

  updateSensorIntelligence(lam,mar);

  if(state.level>=3){
    if(titleEl) titleEl.textContent='Lamone in criticità';
    if(descEl) descEl.textContent='Accumuli forti a monte: priorità a sensori, bollettini e percorso onda.';
    if(decStrong) decStrong.textContent='Attenzione operativa';
  }else if(state.level===2){
    if(titleEl) titleEl.textContent='Lamone da monitorare';
    if(descEl) descEl.textContent='Pioggia significativa a monte: segui sensori da Marradi verso valle.';
    if(decStrong) decStrong.textContent='Monitoraggio consigliato';
  }else if(state.level===1){
    if(titleEl) titleEl.textContent='Lamone sotto osservazione';
    if(descEl) descEl.textContent='Primi accumuli a monte: utile ricontrollare se la pioggia continua.';
    if(decStrong) decStrong.textContent='Ricontrollo utile';
  }else{
    if(titleEl) titleEl.textContent='Lamone sotto controllo';
    if(descEl) descEl.textContent='Bacini, Marzeno, sensori e onda verso valle in un solo colpo d’occhio.';
    if(decStrong) decStrong.textContent='Situazione tranquilla';
  }
  if(decText) decText.textContent=lamoneSmartMessage(lam,mar,state);
  updateControlBoxLamone(lam,mar,state);
}
async function loadBasinRain(){
  try{
    const [lam,mar]=await Promise.all([
      fetchBasinRain('lamone',44.073,11.613),
      fetchBasinRain('marzeno',44.159,11.793)
    ]);
    setBasinCard('lamone',lam); setBasinCard('marzeno',mar);
    updateLamoneDecision(lam,mar);
  }catch(e){
    const a=$('basinLamoneSummary'), b=$('basinMarzenoSummary');
    if(a) a.textContent='accumuli non disponibili';
    if(b) b.textContent='accumuli non disponibili';
    const decText=$('lamoneDecisionText') || document.querySelector('.compact-decision p');
    const decStrong=document.querySelector('.compact-decision strong');
    if(decStrong) decStrong.textContent='Controllo manuale pronto';
    if(decText) decText.textContent='Accumuli non disponibili: usa Pioggia a monte, Radar ER e Dettagli Lamone.';
  }
}

const SENSOR_ORDER=['Marradi','Strada Casale','Sarna','Faenza','Reda','Pieve Cesato','Mezzano'];
let sensorStatus={};
function sensorStateFromRain(lam,mar){
  const max6=Math.max(lam?.h6||0,mar?.h6||0);
  const max3=Math.max(lam?.h3||0,mar?.h3||0);
  const source=(lam?.h6||0)>=(mar?.h6||0)?'Lamone/Marradi':'Marzeno/Modigliana';
  if(max6>=50 || max3>=30) return {level:3,color:'red',label:'Critico',active:3,wave:'criticità a monte',villanova:'monitorare',source};
  if(max6>=25 || max3>=15) return {level:2,color:'yellow',label:'Attenzione',active:2,wave:'onda in formazione',villanova:'da seguire',source};
  if(max6>=10 || max3>=8) return {level:1,color:'yellow',label:'In crescita',active:1,wave:'primi segnali a monte',villanova:'ricontrolla',source};
  return {level:0,color:'green',label:'Normale',active:-1,wave:'nessuna anomalia',villanova:'tranquilla',source:'nessuno'};
}
function lamoneSmartMessage(lam,mar,state){
  const l6=(lam?.h6||0).toFixed(1), m6=(mar?.h6||0).toFixed(1);
  if(state.level>=3) return `Criticità possibile: accumuli forti su ${state.source}. Lamone ${l6} mm / Marzeno ${m6} mm nelle ultime 6h. Apri sensori, bollettini e segui il passaggio monte → Faenza → valle.`;
  if(state.level===2) return `Monitoraggio consigliato: pioggia significativa su ${state.source}. Lamone ${l6} mm / Marzeno ${m6} mm nelle ultime 6h. Controlla Marradi, Sarna e Faenza.`;
  if(state.level===1) return `Ricontrollo utile: primi accumuli a monte. Lamone ${l6} mm / Marzeno ${m6} mm nelle ultime 6h. Tieni d’occhio il trend se continua a piovere.`;
  return `Situazione tranquilla: pioggia a monte bassa. Lamone ${l6} mm / Marzeno ${m6} mm nelle ultime 6h. Nessun segnale operativo sul percorso.`;
}
function updateSensorIntelligence(lam,mar){
  const state=sensorStateFromRain(lam,mar);
  SENSOR_ORDER.forEach((name,idx)=>{
    let color='green', label='Normale', trend='→ stabile';
    if(state.level>0){
      if(idx===state.active){ color=state.color; label=state.label; trend=state.level>=2?'↗ in crescita':'↗ lieve'; }
      else if(idx<state.active){ color='green'; label='Passato'; trend='→ controllo'; }
      else { color='green'; label='Normale'; trend='→ attesa'; }
    }
    sensorStatus[name]={color,label,trend};
    const ch=document.querySelector(`[data-sensor="${name}"]`);
    if(ch){
      ch.classList.remove('sensor-green','sensor-yellow','sensor-red');
      ch.classList.add('sensor-'+color);
      const dot=ch.querySelector('i'); if(dot) dot.className=color;
      const sm=ch.querySelector('small'); if(sm) sm.textContent=label;
    }
  });
  const wave=$('waveStatusLabel'); if(wave) wave.textContent=state.wave;
  const activeName=state.active>=0?SENSOR_ORDER[state.active]:'nessuno';
  const active=$('activeSensorLabel'); if(active) active.textContent=activeName;
  const villa=$('villanovaStatusLabel'); if(villa) villa.textContent=state.villanova;
  const dw=$('detailWaveState'); if(dw) dw.textContent=state.wave;
  const da=$('detailActiveState'); if(da) da.textContent=activeName;
  const dv=$('detailVillaState'); if(dv) dv.textContent=state.villanova;
  const text=$('riverDetailText');
  if(text && !text.dataset.manualSensor){
    text.textContent=state.level>0
      ? `Decisione Conte 2.0: segnale su ${state.source}. Segui il percorso ${activeName} → Faenza → valle e confronta con bollettini ufficiali.`
      : 'Decisione Conte 2.0: nessuna anomalia su pioggia a monte e percorso Lamone. Continua il controllo normale.';
  }
}

const SENSOR_META={
  'Marradi':{role:'Monte alto Lamone',phase:'primo segnale a monte',order:'1/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Strada Casale':{role:'Tratto alto/intermedio',phase:'controllo discesa verso Brisighella/Faenza',order:'2/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Sarna':{role:'Avvicinamento Faenza',phase:'utile per capire se l’onda sta arrivando alla città',order:'3/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Faenza':{role:'Nodo principale',phase:'riferimento per capire il passaggio verso valle',order:'4/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Reda':{role:'Valle dopo Faenza',phase:'controllo propagazione verso Bagnacavallo',order:'5/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Pieve Cesato':{role:'Bassa valle',phase:'segnale importante per il tratto verso Mezzano',order:'6/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'},
  'Mezzano':{role:'Valle / riferimento finale',phase:'ultimo controllo prima del tratto più vicino alla bassa Romagna',order:'7/7',link:'https://www.protezionecivilecalderara.org/sensori_fiumi/Fiume_Lamone/slamone.php'}
};
function openSensorDetail(name){
  const d=$('riverDetail'); if(!d) return;
  const m=SENSOR_META[name]||{};
  const title=d.querySelector('.river-detail-head b'); if(title) title.textContent='Sensore '+name;
  const text=$('riverDetailText');
  const st=(sensorStatus && sensorStatus[name]) || {label:'Normale',color:'green',trend:'→ stabile'};
  if(text){ text.dataset.manualSensor='1'; text.textContent=`${m.order||''} · ${m.role||'Sensore Lamone'}. ${m.phase||'Punto del percorso monte → valle'}. Stato operativo: ${st.label} · ${st.trend}. Link ufficiale sempre disponibile da Dettagli Lamone.`; }
  const vals=d.querySelectorAll('.propagation-values');
  if(vals[0]) vals[0].innerHTML=`<span>Posizione <b>${m.order||'--'}</b></span><span>Stato <b>${st.label}</b></span><span>Trend <b>${st.trend}</b></span>`;
  if(vals[1]) vals[1].innerHTML=`<span>Ruolo <b>${m.role||'Lamone'}</b></span><span>Percorso <b>monte → valle</b></span><span>Azioni <b>apri dettagli</b></span>`;
  d.classList.remove('hidden');
  d.scrollIntoView({behavior:'smooth',block:'center'});
}
function loadLamoneSensors(){
  const chips=[...document.querySelectorAll('[data-sensor]')];
  chips.forEach(ch=>{
    const name=ch.dataset.sensor;
    const sm=ch.querySelector('small'); if(sm) sm.textContent='Normale';
    const dot=ch.querySelector('i'); if(dot) dot.className='green';
    ch.classList.add('sensor-green');
    sensorStatus[name]={color:'green',label:'Normale',trend:'→ stabile'};
    ch.title='Apri dettaglio operativo '+name;
    ch.style.cursor='pointer';
    ch.addEventListener('click',(e)=>{e.stopPropagation();openSensorDetail(name);});
  });
  const label=$('sensorModeLabel'); if(label) label.textContent='sensori smart · tocca';
}

load();
loadBasinRain();
loadLamoneSensors();




// V51 - Cassetto Lamone: Home compatta, motore invariato
(function(){
  const openBtn=document.getElementById('openLamoneDrawer');
  const closeBtn=document.getElementById('closeLamoneDrawer');
  const drawer=document.getElementById('lamoneDrawer');
  const content=document.getElementById('lamoneCard');
  if(!openBtn||!content) return;
  const openDrawer=()=>{
    content.classList.remove('hidden');
    drawer?.classList.add('lamone-drawer-active');
    openBtn.setAttribute('aria-expanded','true');
    setTimeout(()=>content.scrollIntoView({behavior:'smooth',block:'start'}),40);
  };
  const closeDrawer=()=>{
    content.classList.add('hidden');
    drawer?.classList.remove('lamone-drawer-active');
    openBtn.setAttribute('aria-expanded','false');
    setTimeout(()=>drawer?.scrollIntoView({behavior:'smooth',block:'center'}),40);
  };
  openBtn.setAttribute('aria-expanded','false');
  openBtn.addEventListener('click',openDrawer);
  closeBtn?.addEventListener('click',closeDrawer);
})();



// V54 - Cassetto PRETEMP: Home compatta, contenuto V1 invariato
(function(){
  const openBtn=document.getElementById('openPretempDrawer');
  const closeBtn=document.getElementById('closePretempDrawer');
  const drawer=document.getElementById('pretempDrawer');
  const content=document.getElementById('pretempContainer');
  const validity=document.getElementById('pretempValidity');
  const drawerValidity=document.getElementById('pretempDrawerValidity');
  if(!openBtn||!content) return;
  const syncValidity=()=>{if(drawerValidity&&validity) drawerValidity.textContent=validity.textContent;};
  const openDrawer=()=>{
    syncValidity();
    content.classList.remove('hidden');
    drawer?.classList.add('pretemp-drawer-active');
    openBtn.setAttribute('aria-expanded','true');
    setTimeout(()=>content.scrollIntoView({behavior:'smooth',block:'start'}),40);
  };
  const closeDrawer=()=>{
    content.classList.add('hidden');
    drawer?.classList.remove('pretemp-drawer-active');
    openBtn.setAttribute('aria-expanded','false');
    setTimeout(()=>drawer?.scrollIntoView({behavior:'smooth',block:'center'}),40);
  };
  openBtn.setAttribute('aria-expanded','false');
  openBtn.addEventListener('click',openDrawer);
  closeBtn?.addEventListener('click',closeDrawer);
  setTimeout(syncValidity,800);
})();

// V50 - PRETEMP V1: mappa giornaliera e visualizzazione mobile
(function setupPretempV1(){
  const map=document.getElementById('pretempMap');
  const mapLarge=document.getElementById('pretempMapLarge');
  const mapButton=document.getElementById('pretempMapButton');
  const fallback=document.getElementById('pretempMapFallback');
  const modal=document.getElementById('pretempModal');
  const close=document.getElementById('closePretempModal');
  const validity=document.getElementById('pretempValidity');
  const forecastLink=document.getElementById('pretempForecastLink');
  const modalForecastLink=document.getElementById('pretempModalForecastLink');
  if(!map || !mapButton) return;

  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const pad=n=>String(n).padStart(2,'0');
  const makeUrls=date=>{
    const y=date.getFullYear(), m=date.getMonth(), d=date.getDate();
    const stamp=`${pad(d)}_${pad(m+1)}_${y}`;
    const base=`https://pretemp.altervista.org/archivio/${y}/${months[m]}`;
    return {
      image:`${base}/cartine/${stamp}.png`,
      forecast:`${base}/previsioni/${stamp}.html`,
      label:date.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'})
    };
  };

  const candidates=[];
  const today=new Date();
  for(let i=0;i<4;i++){const d=new Date(today);d.setDate(today.getDate()-i);candidates.push(makeUrls(d));}
  let attempt=0,current=candidates[0];
  const applyCandidate=()=>{
    current=candidates[attempt];
    map.src=current.image;
    if(mapLarge) mapLarge.src=current.image;
    forecastLink.href=current.forecast;
    if(modalForecastLink) modalForecastLink.href=current.forecast;
    validity.textContent=(attempt===0?'oggi':'ultima disponibile')+' · 00–24 UTC';
  };
  map.addEventListener('load',()=>{fallback?.classList.add('hidden');map.classList.remove('hidden');});
  map.addEventListener('error',()=>{
    attempt++;
    if(attempt<candidates.length){applyCandidate();return;}
    map.classList.add('hidden');fallback?.classList.remove('hidden');
    forecastLink.href='https://www.pretemp.it/';
    if(modalForecastLink) modalForecastLink.href='https://www.pretemp.it/';
    validity.textContent='in attesa di pubblicazione';
  });
  applyCandidate();

  const openModal=()=>{
    if(map.classList.contains('hidden')){window.open(forecastLink.href,'_blank','noopener');return;}
    if(mapLarge) mapLarge.src=map.src;
    modal?.classList.remove('hidden');
    document.body.classList.add('pretemp-modal-open');
  };
  const closeModal=()=>{modal?.classList.add('hidden');document.body.classList.remove('pretemp-modal-open');};
  mapButton.addEventListener('click',openModal);
  close?.addEventListener('click',closeModal);
  modal?.addEventListener('click',e=>{if(e.target===modal) closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeModal();});
})();
