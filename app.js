const $=id=>document.getElementById(id);
let lastData=null,lastIndex=0,lastLevel=null;
let basinRainData={lamone:null,marzeno:null};
async function fetchJsonReliable(url, attempts=3, timeoutMs=9000){
 let lastError;
 for(let n=0;n<attempts;n++){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
   const res=await fetch(url,{cache:'no-store',signal:ctl.signal});
   if(!res.ok) throw new Error('HTTP '+res.status);
   return await res.json();
  }catch(err){lastError=err; if(n<attempts-1) await new Promise(r=>setTimeout(r,500*(n+1)));}
  finally{clearTimeout(timer);}
 }
 throw lastError||new Error('Fonte non disponibile');
}
const WMO={0:['Sereno','☀️'],1:['Prevalentemente sereno','🌤️'],2:['Parzialmente nuvoloso','⛅'],3:['Nuvoloso','☁️'],45:['Nebbia','🌫️'],48:['Nebbia','🌫️'],51:['Pioviggine','🌦️'],53:['Pioviggine','🌦️'],55:['Pioviggine','🌦️'],61:['Pioggia','🌧️'],63:['Pioggia','🌧️'],65:['Pioggia forte','🌧️'],80:['Rovescio','🌦️'],81:['Rovescio','🌧️'],82:['Rovescio forte','⛈️'],95:['Temporale','⛈️'],96:['Temporale/grandine','⛈️'],99:['Temporale/grandine','⛈️']};
function dewPoint(t,h){const a=17.27,b=237.7;const alpha=((a*t)/(b+t))+Math.log(Math.max(h,1)/100);return (b*alpha)/(a-alpha)}
function upcomingSlice(hourly,hours=6){const start=nextStart(hourly.time);return {start,end:Math.min(hourly.time.length,start+hours)}}
function currentPrecip(now){
 const total=Number(now.precipitation);
 if(Number.isFinite(total)) return Math.max(0,total);
 return Math.max(0,Number(now.rain||0),Number(now.showers||0));
}
function assessOperationalEvent(now,hourly){
 const {start,end}=upcomingSlice(hourly,6);
 const probs=(hourly.precipitation_probability||[]).slice(start,end).map(Number);
 const rains=(hourly.precipitation||[]).slice(start,end).map(Number);
 const gusts=(hourly.wind_gusts_10m||[]).slice(start,end).map(Number);
 const codes=(hourly.weather_code||[]).slice(start,end).map(Number);
 const rainMax=probs.length?Math.max(...probs):0;
 const rainSum=rains.reduce((a,b)=>a+(b||0),0);
 const gustNow=Number(now.wind_gusts_10m||0), gustMax=gusts.length?Math.max(gustNow,...gusts):gustNow;
 const precipNow=currentPrecip(now), codeNow=Number(now.weather_code||0);
 const stormNow=codeNow>=95, showerNow=codeNow>=80&&codeNow<=82;
 const stormSoon=codes.some(x=>x>=95), showerSoon=codes.some(x=>x>=80&&x<=82);
 let severity=0;
 if(precipNow>=0.1||showerNow) severity=Math.max(severity,2);
 if(stormNow) severity=3;
 if(gustNow>=35) severity=Math.max(severity,1);
 if(gustNow>=50) severity=Math.max(severity,2);
 if(gustNow>=70) severity=3;
 if(stormSoon||rainMax>=70||rainSum>=8||gustMax>=60) severity=Math.max(severity,2);
 if((stormSoon&&gustMax>=50)||rainSum>=15) severity=3;
 const color=['green','yellow','yellow','red'][severity];
 const title=['Tranquilla','Attenzione','Evento in corso / da seguire','Evento intenso in corso'][severity];
 const events=[];
 if(stormNow||stormSoon) events.push('temporali');
 else if(showerNow||showerSoon||precipNow>=0.1||rainSum>=1) events.push('pioggia/rovesci');
 if(gustNow>=35||gustMax>=50) events.push('raffiche');
 return {severity,color,title,events,rainMax,rainSum,gustNow,gustMax,precipNow,stormNow,stormSoon,showerNow,showerSoon};
}
function calcIndex(now,hourly){const a=assessOperationalEvent(now,hourly);let idx=0;idx+=a.rainMax*0.35;idx+=Math.min(25,a.rainSum*10);idx+=Math.min(25,a.precipNow*18);idx+=now.relative_humidity_2m>75?12:now.relative_humidity_2m>60?6:0;idx+=a.gustMax>60?20:a.gustMax>45?14:a.gustMax>30?8:0;idx+=now.pressure_msl<1008?8:0;if(a.stormNow)idx=Math.max(idx,75);else if(a.showerNow||a.precipNow>=0.1)idx=Math.max(idx,45);return Math.round(Math.min(100,idx))}
function level(idx){if(idx>=75)return ['Alta attenzione','rosso','red'];if(idx>=50)return ['Da seguire','arancione','yellow'];if(idx>=25)return ['Da monitorare','giallo','yellow'];return ['Tranquilla','tranquillo','green']}
function setDot(el,c){el.className='dot '+c} function setBig(c){$('statusDot').className='bigdot '+c}
function nextStart(times){const now=new Date(); let start=times.findIndex(t=>new Date(t)>now); return start<0?0:start;}
function formatHour(t){return new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});}
function buildNextSignal(h){
  const {start,end}=upcomingSlice(h,12);
  if(start>=end) return {kind:'quiet',text:'Nessun dato utile per le prossime ore.'};
  const rows=[];
  for(let i=start;i<end;i++) rows.push({i,time:h.time[i],code:h.weather_code[i]||0,prob:h.precipitation_probability[i]||0,rain:h.precipitation[i]||0,gust:h.wind_gusts_10m[i]||0});
  const storm=rows.find(r=>r.code>=95);
  if(storm) return {kind:'storm',text:`Possibili temporali verso le ${formatHour(storm.time)} · probabilità ${storm.prob}%`};
  const shower=rows.find(r=>r.code>=80&&r.code<=82);
  if(shower) return {kind:'rain',text:`Possibili rovesci verso le ${formatHour(shower.time)} · probabilità ${shower.prob}%`};
  const wet=rows.reduce((a,b)=>b.prob>a.prob?b:a,rows[0]);
  if(wet.prob>=40) return {kind:'rain',text:`Pioggia più probabile verso le ${formatHour(wet.time)} · probabilità ${wet.prob}%`};
  const windy=rows.reduce((a,b)=>b.gust>a.gust?b:a,rows[0]);
  if(windy.gust>=45) return {kind:'wind',text:`Raffiche fino a ${Math.round(windy.gust)} km/h verso le ${formatHour(windy.time)}`};
  return {kind:'quiet',text:'Nessun segnale rilevante nelle prossime 12 ore.'};
}
function renderNextSignal(h){const box=$('nextSignal');if(!box)return;const s=buildNextSignal(h);box.className='next-signal '+s.kind;const icon=s.kind==='storm'?'⛈️':s.kind==='rain'?'🌧️':s.kind==='wind'?'💨':'☀️';box.innerHTML=`<span>PROSSIMO SEGNALE</span><b>${icon} ${s.text}</b><small>Previsione oraria del modello: verifica con Radar e PRETEMP se la situazione cambia.</small>`;}

function buildHomeBriefing(c,h,idx){
  const a=assessOperationalEvent(c,h);
  let main='Nessun fenomeno rilevante previsto nelle prossime 6 ore.';
  let detail='Situazione stabile. Controllo ordinario dei monitor.';
  if(a.severity===1){
    main=a.gustNow>=35?`Attenzione: raffiche locali fino a ${Math.round(a.gustNow)} km/h.`:'Evoluzione meteo da seguire.';
    detail=`Pioggia max ${a.rainMax}%, accumulo previsto ${a.rainSum.toFixed(1)} mm. Apri Evoluzione e Radar per il controllo reale.`;
  }
  if(a.severity>=2){
    const active=a.events.length?a.events.join(' e '):'fenomeni meteo';
    main=`${a.severity===3?'Attenzione forte':'Evento da seguire'}: ${active} ${a.stormNow||a.showerNow||a.precipNow>=0.1?'in corso':'possibili a breve'}.`;
    const actions=['Evoluzione','Radar']; if(a.stormNow||a.stormSoon)actions.push('Fulmini'); actions.push('PRETEMP');
    detail=`Precipitazione locale ${a.precipNow.toFixed(1)} mm, probabilità max ${a.rainMax}%, raffiche ${Math.round(a.gustNow)} km/h (max ${Math.round(a.gustMax)}). Controlla ${actions.join(' → ')}.`;
  }
  return {main,detail,color:a.color,signals:a.events.length,assessment:a};
}
function setControlChip(id,color,label){
  const el=$(id); if(!el) return;
  const dot=el.querySelector('i'); if(dot) dot.className=color;
  const sm=el.querySelector('small'); if(sm) sm.textContent=label;
}

function updateAnalysisSnapshot(data){
  const box=$('analysisSnapshot'); if(!box) return;
  const c=data.current,h=data.hourly;
  const {start,end}=upcomingSlice(h,6);
  const probs=h.precipitation_probability.slice(start,end);
  const rains=h.precipitation.slice(start,end);
  const gusts=h.wind_gusts_10m.slice(start,end);
  const codes=h.weather_code.slice(start,end);
  const rainMax=probs.length?Math.max(...probs):0;
  const rainSum=rains.reduce((a,b)=>a+(b||0),0);
  const gustMax=gusts.length?Math.max(...gusts):c.wind_gusts_10m||0;
  const storm=c.weather_code>=95||codes.some(x=>x>=95);
  const showers=codes.some(x=>x>=80&&x<=82);
  const desc=WMO[c.weather_code]||['Meteo','🌤️'];
  $('snapshotNow').textContent=`${desc[1]} ${Math.round(c.temperature_2m)}°`;
  $('snapshotRain').textContent=rainSum>=0.1?`${rainSum.toFixed(1)} mm`:`${rainMax}%`;
  $('snapshotRainNote').textContent=rainSum>=0.1?`prob. max ${rainMax}%`:'probabilità max';
  $('snapshotWind').textContent=`${Math.round(gustMax)} km/h`;
  $('snapshotWindNote').textContent=gustMax>=50?'da controllare':'massima prevista';
  $('snapshotStorm').textContent=storm?'Possibili':showers?'Rovesci':'Nessun segnale';
  $('snapshotStormNote').textContent=storm?'verifica PRETEMP':showers?'verifica radar':'nelle prossime 6h';
  let color='green',title='Quadro regolare',advice='Nessun segnale rilevante dal modello: parti da Zoom Earth per il controllo generale.';
  if(rainMax>=45||rainSum>=3||gustMax>=40||showers){color='yellow';title='Evoluzione da seguire';advice='Apri PRETEMP e Radar evoluzione ER per verificare posizione e sviluppo dei fenomeni.';}
  if(storm||rainMax>=75||rainSum>=10||gustMax>=65){color=storm||gustMax>=75?'red':'yellow';title='Controllo operativo consigliato';advice='Controlla subito PRETEMP, radar evoluzione, fulmini e successivamente Lamone se la pioggia persiste.';}
  $('snapshotTitle').textContent=title;
  $('snapshotAdvice').textContent=advice;
  $('snapshotDot').className=color;

  const conteState=$('conteState'), conteDot=$('conteStateDot');
  const conteEvolution=$('conteEvolution'), conteAttention=$('conteAttention');
  const conteAction=$('conteAction'), conteReason=$('conteReason');
  let state='Situazione stabile', evolution='Stabile', attention='Bassa';
  let action='Controllo generale con Zoom Earth';
  let reason='Nessun segnale significativo dal modello nelle prossime 6 ore.';
  let conteColor='green';
  if(rainMax>=35 || rainSum>=1 || gustMax>=35 || showers){
    state='Situazione da seguire'; evolution=showers?'Rovesci possibili':'Possibile cambiamento'; attention='Moderata';
    action='Apri PRETEMP e Radar evoluzione ER';
    reason=`Pioggia max ${rainMax}%, accumulo ${rainSum.toFixed(1)} mm, raffiche fino a ${Math.round(gustMax)} km/h.`;
    conteColor='yellow';
  }
  if(storm || rainMax>=70 || rainSum>=8 || gustMax>=60){
    state='Controllo operativo'; evolution=storm?'Temporali possibili':'Fenomeni più intensi'; attention=storm||gustMax>=70?'Alta':'Elevata';
    action=storm?'PRETEMP → Radar → Fulmini':'PRETEMP → Radar → Lamone se persiste';
    reason=`Segnale più marcato: pioggia max ${rainMax}%, accumulo ${rainSum.toFixed(1)} mm, raffiche ${Math.round(gustMax)} km/h.`;
    conteColor=storm||gustMax>=70?'red':'yellow';
  }
  if(conteState) conteState.textContent=state;
  if(conteDot) conteDot.className=conteColor;
  if(conteEvolution) conteEvolution.textContent=evolution;
  if(conteAttention) conteAttention.textContent=attention;
  if(conteAction) conteAction.textContent=action;
  if(conteReason) conteReason.textContent=reason;
  updateOperativeRoute({rainMax,rainSum,gustMax,storm,showers});
}


function setOperativeRoute(config){
  const box=$('operativeRoute'); if(!box) return;
  const title=$('routeTitle'), note=$('routeNote');
  if(title) title.textContent=config.title;
  if(note) note.textContent=config.note;
  const ids=['routeStep1','routeStep2','routeStep3'];
  const buttons=[...box.querySelectorAll('[data-route-target]')];
  config.steps.forEach((step,i)=>{
    const label=$(ids[i]); if(label) label.textContent=step.label;
    if(buttons[i]) buttons[i].dataset.routeTarget=step.target;
  });
}
function updateOperativeRoute({rainMax,rainSum,gustMax,storm,showers}){
  let config={
    title:'Controllo essenziale',
    steps:[
      {label:'Zoom Earth',target:'toolZoom'},
      {label:'Radar evoluzione ER',target:'toolRadar'},
      {label:'Centro PRETEMP',target:'toolPretempMain'}
    ],
    note:'Parti dal quadro generale e approfondisci soltanto se noti segnali in evoluzione.'
  };
  if(rainMax>=35 || rainSum>=1 || gustMax>=35 || showers){
    config={
      title:'Verifica evoluzione',
      steps:[
        {label:'Centro PRETEMP',target:'toolPretempMain'},
        {label:'Radar evoluzione ER',target:'toolRadar'},
        {label:showers?'Zoom Earth':'Centro Lamone',target:showers?'toolZoom':'toolLamone'}
      ],
      note:showers?'Confronta previsione e osservazione; controlla Zoom Earth per direzione e sviluppo.':'Se la pioggia persiste, passa al controllo monte-valle del Lamone.'
    };
  }
  if(storm || rainMax>=70 || rainSum>=8 || gustMax>=60){
    config={
      title:'Sequenza operativa',
      steps:[
        {label:'Centro PRETEMP',target:'toolPretempMain'},
        {label:storm?'Fulmini live':'Radar evoluzione ER',target:storm?'toolLightning':'toolRadar'},
        {label:rainSum>=8?'Centro Lamone':'Allerte ufficiali',target:rainSum>=8?'toolLamone':'toolAlerts'}
      ],
      note:storm?'Verifica subito sviluppo, attività elettrica e comunicazioni ufficiali.':'Segui il fenomeno e passa al Lamone se le precipitazioni diventano persistenti.'
    };
  }
  setOperativeRoute(config);
}

function updateControlBox(data){
  const box=$('controlCard'); if(!box) return;
  const c=data.current, h=data.hourly;
  const {start,end}=upcomingSlice(h,6);
  const rain6=h.precipitation.slice(start,end).reduce((a,b)=>a+(b||0),0);
  const probs=h.precipitation_probability.slice(start,end);
  const rainMax=probs.length?Math.max(...probs):0;
  const gust=Math.round(c.wind_gusts_10m||0);
  const code=c.weather_code||0;
  const storm=code>=95 || h.weather_code.slice(start,end).some(x=>x>=95);
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

function updateWeatherHero(code,isDay){
  const hero=$('headerWeather'); if(!hero) return;
  let mood='weather-clear';
  if(code===45||code===48) mood='weather-fog';
  else if(code>=95) mood='weather-storm';
  else if((code>=51&&code<=82)||(code>=61&&code<=67)) mood='weather-rain';
  else if(code>=2&&code<=3) mood='weather-cloudy';
  if(isDay===0 && mood==='weather-clear') mood='weather-night';
  hero.classList.remove('weather-clear','weather-night','weather-cloudy','weather-rain','weather-storm','weather-fog');
  hero.classList.add(mood);
}


const OFFICIAL_ALERT_URL='https://allertameteo.regione.emilia-romagna.it/o/get-stato-allerta';
const OFFICIAL_ALERT_PAGE='https://allertameteo.regione.emilia-romagna.it/web/bagnacavallo';
let officialAlertState={color:'unknown',title:'Verifica ufficiale in corso',phenomena:[],data:null};
function alertRank(c){return ({green:0,yellow:1,orange:2,red:3})[c]??-1}
function alertColorLabel(c){return ({green:'VERDE',yellow:'GIALLA',orange:'ARANCIONE',red:'ROSSA'})[c]||'DA VERIFICARE'}
function parseOfficialAlert(data){
 const zone=data&&data.D1;
 if(!zone) return {color:'unknown',title:'Zona D1 non disponibile',phenomena:[],data};
 const labels={idraulica:'piene dei fiumi',idrogeologica:'frane e corsi minori',temporali:'temporali',vento:'vento',temperature_estreme:'temperature estreme',neve:'neve',ghiaccio_pioggia_gela:'ghiaccio/pioggia che gela',stato_mare:'stato del mare',mareggiate:'mareggiate'};
 let color='green', phenomena=[];
 Object.entries(labels).forEach(([key,label])=>{const c=zone[key];if(c&&alertRank(c)>0) phenomena.push({label,color:c});if(alertRank(c)>alertRank(color)) color=c;});
 return {color,title:data.titolo||'Documento ufficiale disponibile',phenomena,data};
}
function renderOfficialAlert(state){
 officialAlertState=state;
 const dot=$('dotAllerte'), line=$('briefAlert');
 const color=state.color==='unknown'?'yellow':state.color;
 if(dot) setDot(dot,color);
 if(line){
   line.className=state.color==='unknown'?'alert-yellow':'alert-'+state.color;
   const txt=state.color==='unknown'?'Verifica fonte ufficiale':state.color==='green'?'Nessuna attiva':`Allerta ${alertColorLabel(state.color).toLowerCase()}: ${state.phenomena.map(x=>x.label).join(', ')||'fenomeni segnalati'}`;
   line.textContent=txt;
 }
 renderConteAlertCenter();
 const title=$('homeAlertTitle'),text=$('homeAlertText');
 if(title&&text&&state.color!=='unknown'){
   title.textContent=state.color==='green'?'Nessuna allerta ufficiale':`Allerta ${alertColorLabel(state.color).toLowerCase()} attiva`;
   text.textContent=state.color==='green'?'Zona D1 regolare.':state.phenomena.map(x=>x.label).join(', ');
 }
}
async function loadOfficialAlert(){
 try{
   const res=await fetch(OFFICIAL_ALERT_URL,{cache:'no-store'}); if(!res.ok) throw new Error('alert api');
   renderOfficialAlert(parseOfficialAlert(await res.json()));
 }catch(e){renderOfficialAlert({color:'unknown',title:'Verifica non disponibile',phenomena:[],data:null});}
}
function updateBriefWeather(c,h){
 const line=$('briefWeather');if(!line)return;
 const s=buildNextSignal(h);const icon=s.kind==='storm'?'⛈️':s.kind==='rain'?'🌧️':s.kind==='wind'?'💨':'☁️';
 const short=s.kind==='storm'?'Temporali possibili':s.kind==='rain'?'Pioggia possibile':s.kind==='wind'?'Vento da monitorare':'Situazione stabile';
 line.querySelector('span').textContent=icon;line.querySelector('b').textContent=short;
}
async function load(){
 const alertPromise=loadOfficialAlert();
 try{
  if('serviceWorker' in navigator){ try{ await navigator.serviceWorker.register('./sw.js?v=rc35-3'); }catch(_e){} }
  const url='https://api.open-meteo.com/v1/forecast?latitude=44.418&longitude=11.977&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl,is_day&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl&daily=sunrise,sunset&timezone=Europe%2FRome&forecast_days=2';
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error('api');
  const data=await res.json(); lastData=data; const c=data.current, h=data.hourly; setTimeout(renderConteAlertCenter,0);
  const desc=WMO[c.weather_code]||['Meteo','🌤️']; const idx=calcIndex(c,h); lastIndex=idx; const lv=level(idx); lastLevel=lv;
  const {start,end}=upcomingSlice(h,6); const rain6=h.precipitation.slice(start,end).reduce((a,b)=>a+(b||0),0); const probs=h.precipitation_probability.slice(start,end); const rainMax=probs.length?Math.max(...probs):0;
  $('headerIcon').textContent=desc[1]; $('headerTemp').textContent=Math.round(c.temperature_2m*10)/10+'°';
  const headerDesc=$('headerDesc'); if(headerDesc) headerDesc.textContent=desc[0];
  updateWeatherHero(c.weather_code, c.is_day);
  const briefing=buildHomeBriefing(c,h,idx);
  $('statusTitle').textContent=lv[0];
  $('statusText').textContent=briefing.main;
  setBig(briefing.color); setDot($('dotMeteo'),briefing.color); setDot($('dotTemporali'),idx>=40?'yellow':'green'); setDot($('dotLamone'),'green'); $('lamoneCorner').className='cornerdot green';
  $('indiceVal').textContent=idx; $('indiceLabel').textContent=lv[1];
  $('decisionTitle').textContent=idx<25?'Situazione gestibile':idx<50?'Da tenere d’occhio':'Controlla subito';
  $('decisionText').textContent=briefing.detail;
  $('tempNow').textContent=(Math.round(c.temperature_2m*10)/10)+'°C'; $('nowDesc').textContent=`${desc[0]} · ${rainMax}% pioggia max 6h`;
  $('feels').textContent=Math.round(c.apparent_temperature*10)/10+'°'; $('hum').textContent=Math.round(c.relative_humidity_2m)+'%'; $('dew').textContent=Math.round(dewPoint(c.temperature_2m,c.relative_humidity_2m)*10)/10+'°'; $('wind').textContent=Math.round(c.wind_speed_10m)+' km/h'; $('gust').textContent=Math.round(c.wind_gusts_10m)+' km/h'; $('press').textContent=Math.round(c.pressure_msl)+' hPa'; $('rain6').textContent=rain6.toFixed(1)+' mm';
  const autoBox=$('analysisBox');
  if(autoBox){
    autoBox.textContent=briefing.detail;
    autoBox.className='analysis-auto '+briefing.color+(idx<25?' compact':' expanded');
  }
  renderNextSignal(h); updateBriefWeather(c,h); renderRisk(h,idx); renderHours(h); renderAstro(data,briefing,idx); await alertPromise; updateControlBox(data); updateAnalysisSnapshot(data); $('updated').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch(e){ $('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova.'; setBig('yellow'); $('decisionTitle').textContent='Valuto...'; $('decisionText').textContent='Sintesi in arrivo.'; const ns=$('nextSignal'); if(ns) ns.innerHTML='<span>PROSSIMO SEGNALE</span><b>⚠️ Previsione oraria non disponibile.</b>'; setDot($('dotLamone'),'green'); $('lamoneCorner').className='cornerdot green'; const cc=$('controlCorner'); if(cc) cc.className='cornerdot yellow'; const ct=$('controlTitle'); if(ct) ct.textContent='Dati da aggiornare'; const cp=$('controlText'); if(cp) cp.textContent='Dati meteo non disponibili: usa i link ufficiali del Centro Controllo Meteo.'; }
}
function renderRisk(h,base){
 const target=$('riskTimeline'); if(!target) return;
 target.innerHTML='';
 for(let i=1;i<=4;i++){const p=h.precipitation_probability[i]||0;const risk=Math.max(base,p);const c=risk>=50?'yellow':'green'; const text=risk>=50?'attenzione':risk>=25?'monitorare':'tranquillo'; target.insertAdjacentHTML('beforeend',`<div class="riskitem"><span class="rball ${c}"></span><small>+${i}h</small><b>${text}</b></div>`)}
}
function timelineState(h,k){
 const code=h.weather_code[k]||0;
 const prob=h.precipitation_probability[k]||0;
 const rain=h.precipitation[k]||0;
 const gust=h.wind_gusts_10m[k]||0;
 if(code>=95 || gust>=70 || rain>=8 || prob>=85) return {level:'red',label:code>=95?'Temporali':'Criticità'};
 if((code>=80&&code<=82) || gust>=50 || rain>=3 || prob>=60) return {level:'orange',label:code>=80&&code<=82?'Rovesci':'Da seguire'};
 if(code>=51 || gust>=35 || rain>=.2 || prob>=30) return {level:'yellow',label:code>=51?'Pioggia possibile':'Variabile'};
 if(code>=2&&code<=3) return {level:'green',label:'Nuvolosità'};
 return {level:'green',label:'Stabile'};
}
function renderOperationalTimeline(h){
 const target=$('operationalTimeline'); if(!target) return;
 const start=nextStart(h.time);
 const count=Math.min(6,h.time.length-start);
 const states=[];
 target.innerHTML='';
 for(let i=0;i<count;i++){
   const k=start+i, state=timelineState(h,k), time=formatHour(h.time[k]);
   const icon=(WMO[h.weather_code[k]]||['','☀️'])[1];
   const temp=Math.round(h.temperature_2m[k]);
   const prob=h.precipitation_probability[k]||0;
   states.push(state);
   target.insertAdjacentHTML('beforeend',`<div class="timeline-point ${state.level}"><time>${time}</time><span class="timeline-dot"></span><span class="timeline-weather">${icon}</span><b>${temp}°</b><small>${state.label} · ${prob}%</small></div>`);
 }
 const rank={green:0,yellow:1,orange:2,red:3};
 const max=states.reduce((a,b)=>rank[b.level]>rank[a.level]?b:a,states[0]||{level:'green',label:'Stabile'});
 const summary=$('timelineSummary');
 if(summary){
   summary.className='timeline-summary '+max.level;
   summary.textContent=max.level==='green'?'Evoluzione regolare: nessun passaggio operativo aggiuntivo richiesto.':max.level==='yellow'?'Possibile cambiamento: osserva l’evoluzione nelle prossime ore.':max.level==='orange'?'Fenomeni da seguire: confronta previsione, radar e PRETEMP.':'Segnale importante: attiva subito il percorso operativo consigliato.';
 }
}
function moonPhaseInfo(date=new Date()){
 const synodic=29.53058867;
 const knownNew=Date.UTC(2000,0,6,18,14,0);
 const age=(((date.getTime()-knownNew)/86400000)%synodic+synodic)%synodic;
 const fraction=age/synodic;
 if(fraction<0.0625||fraction>=0.9375)return {icon:'🌑',name:'Luna nuova',vis:Math.round((1-Math.cos(2*Math.PI*fraction))*50)+'%'};
 if(fraction<0.1875)return {icon:'🌒',name:'Crescente',vis:Math.round((1-Math.cos(2*Math.PI*fraction))*50)+'%'};
 if(fraction<0.3125)return {icon:'🌓',name:'Primo quarto',vis:'50%'};
 if(fraction<0.4375)return {icon:'🌔',name:'Gibbosa crescente',vis:Math.round((1-Math.cos(2*Math.PI*fraction))*50)+'%'};
 if(fraction<0.5625)return {icon:'🌕',name:'Luna piena',vis:'100%'};
 if(fraction<0.6875)return {icon:'🌖',name:'Gibbosa calante',vis:Math.round((1-Math.cos(2*Math.PI*fraction))*50)+'%'};
 if(fraction<0.8125)return {icon:'🌗',name:'Ultimo quarto',vis:'50%'};
 return {icon:'🌘',name:'Calante',vis:Math.round((1-Math.cos(2*Math.PI*fraction))*50)+'%'};
}
function renderAstro(data,briefing,idx){
 const daily=data.daily||{};
 const fmt=v=>v?new Date(v).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'--:--';
 const rise=$('sunriseTime'),set=$('sunsetTime');
 if(rise)rise.textContent=fmt(daily.sunrise&&daily.sunrise[0]);
 if(set)set.textContent=fmt(daily.sunset&&daily.sunset[0]);
 const moon=moonPhaseInfo();
 if($('moonIcon'))$('moonIcon').textContent=moon.icon;
 if($('moonPhase'))$('moonPhase').textContent=moon.name;
 if($('moonVisibility'))$('moonVisibility').textContent=moon.vis+' illuminata';
 const alertTitle=$('homeAlertTitle'),alertText=$('homeAlertText');
 if(alertTitle&&alertText){
   if(idx>=75){alertTitle.textContent='Controllo immediato';alertText.textContent='Più segnali richiedono monitoraggio continuo.';}
   else if(idx>=45){alertTitle.textContent='Situazione da seguire';alertText.textContent='Apri radar e percorso operativo per verificare.';}
   else if(idx>=25){alertTitle.textContent='Possibile evoluzione';alertText.textContent='Controllo periodico consigliato nelle prossime ore.';}
   else {alertTitle.textContent='Nessun segnale attivo';alertText.textContent='Situazione regolare sul territorio.';}
 }
}

function renderHours(h){
 const target=$('hours'); if(!target) return;
 target.innerHTML=''; const start=nextStart(h.time);
 h.time.slice(start,start+6).forEach((t,i)=>{const k=start+i;const d=new Date(t); const code=h.weather_code[k]; const icon=(WMO[code]||['','☀️'])[1]; target.insertAdjacentHTML('beforeend',`<div class="hour"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><b>${Math.round(h.temperature_2m[k])}°</b><span>${icon}</span><small>${h.precipitation_probability[k]}% · ${h.precipitation[k].toFixed(1)}mm</small></div>`)});
 renderOperationalTimeline(h);
}
function trendConfig(type){
 return {
  temperatura:{label:'Temperatura',icon:'🌡️',key:'temperature_2m',unit:'°C',decimals:1,rateUnit:'°C/h'},
  umidita:{label:'Umidità',icon:'💧',key:'relative_humidity_2m',unit:'%',decimals:0,rateUnit:'%/h'},
  pressione:{label:'Pressione',icon:'📉',key:'pressure_msl',unit:' hPa',decimals:0,rateUnit:'hPa/h'},
  vento:{label:'Vento e raffiche',icon:'💨',key:'wind_gusts_10m',secondary:'wind_speed_10m',unit:' km/h',decimals:0,rateUnit:'km/h'},
  pioggia:{label:'Pioggia',icon:'🌧️',key:'precipitation_probability',secondary:'precipitation',unit:'%',decimals:0,rateUnit:'%/h'},
  indice:{label:'Indice Conte',icon:'🧠',key:null,unit:'/100',decimals:0,rateUnit:'punti/h'}
 }[type]||null;
}
function fmtTrendValue(v,cfg){
 if(v==null||Number.isNaN(v)) return '--';
 return Number(v).toFixed(cfg.decimals)+(cfg.unit||'');
}
function linearRate(vals){
 if(!vals||vals.length<2) return 0;
 const n=vals.length, xm=(n-1)/2, ym=vals.reduce((a,b)=>a+b,0)/n;
 let num=0,den=0;
 vals.forEach((y,x)=>{num+=(x-xm)*(y-ym);den+=(x-xm)*(x-xm)});
 return den?num/den:0;
}
function classifyTrend(type,rate,vals){
 const abs=Math.abs(rate);
 const thresholds={temperatura:[.15,.55],umidita:[.8,2.5],pressione:[.18,.65],vento:[1.2,3.5],pioggia:[2,7],indice:[2,6]}[type]||[.5,2];
 const dir=rate>thresholds[0]?'in aumento':rate<-thresholds[0]?'in calo':'stabile';
 const speed=abs>=thresholds[1]?'rapido':abs>=thresholds[0]?'graduale':'quasi stabile';
 let color=abs>=thresholds[1]?'orange':abs>=thresholds[0]?'yellow':'green';
 let text=`Andamento ${speed}${dir==='stabile'?'':` e ${dir}`}.`;
 if(type==='pressione'&&rate<=-thresholds[1]) text='Pressione in rapido calo: segnale da confrontare con vento, umidità, radar e PRETEMP.';
 if(type==='umidita'&&rate>=thresholds[1]) text='Umidità in rapido aumento: aria sempre più satura, da leggere insieme agli altri segnali.';
 if(type==='vento'&&rate>=thresholds[1]) text='Raffiche in crescita rapida: possibile intensificazione della ventilazione.';
 if(type==='pioggia'&&Math.max(...vals)>=60) text='Probabilità di pioggia in aumento: controlla radar e orari previsti.';
 if(type==='temperatura'&&rate<=-thresholds[1]) text='Temperatura in rapido calo: verifica se coincide con pioggia, vento o passaggio temporalesco.';
 return {dir,speed,color,text};
}
function buildTrendSvg(vals,times,cfg,secondary){
 const w=360,h=190,pL=30,pR=15,pT=24,pB=34;
 const all=secondary?[...vals,...secondary]:vals;
 let min=Math.min(...all),max=Math.max(...all); if(max===min){max+=1;min-=1}
 const pad=(max-min)*.12; min-=pad;max+=pad;
 const pt=(v,i)=>({x:pL+i*((w-pL-pR)/Math.max(vals.length-1,1)),y:pT+(max-v)/(max-min)*(h-pT-pB)});
 const pts=vals.map(pt), path=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const secPts=secondary?secondary.map(pt):[], secPath=secPts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const grid=[0,.25,.5,.75,1].map(q=>{const y=pT+q*(h-pT-pB);const val=max-q*(max-min);return `<line x1="${pL}" y1="${y}" x2="${w-pR}" y2="${y}"/><text x="${pL-5}" y="${y+4}" text-anchor="end">${Math.round(val*10)/10}</text>`}).join('');
 const step=Math.max(1,Math.ceil(times.length/6));
 const labels=times.map((t,i)=>i%step?'':`<text class="xlab" x="${pts[i].x}" y="${h-10}" text-anchor="middle">${new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</text>`).join('');
 const dots=pts.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i===pts.length-1?4.5:2.5}"/>`).join('');
 return `<svg class="dcs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend ${cfg.label}"><g class="dcs-grid">${grid}</g><path class="dcs-area" d="${path} L ${pts.at(-1).x} ${h-pB} L ${pts[0].x} ${h-pB} Z"/><path class="dcs-line" d="${path}"/>${secondary?`<path class="dcs-line secondary" d="${secPath}"/>`:''}<g class="dcs-dots">${dots}</g>${labels}</svg>`;
}
function trendDiagnosis(h,start,count){
 const slice=k=>h[k].slice(start,start+count);
 const p=linearRate(slice('pressure_msl')), u=linearRate(slice('relative_humidity_2m')), g=linearRate(slice('wind_gusts_10m'));
 const rain=Math.max(...slice('precipitation_probability'));
 let score=0,parts=[];
 if(p<-.45){score+=2;parts.push('pressione in calo')}
 if(u>1.8){score+=1;parts.push('umidità in aumento')}
 if(g>2.5){score+=2;parts.push('raffiche in crescita')}
 if(rain>=60){score+=2;parts.push('pioggia probabile')}
 if(score>=5)return {color:'orange',title:'Evoluzione da seguire',text:`Segnali combinati: ${parts.join(', ')}. Apri radar, PRETEMP e allerte per la verifica operativa.`};
 if(score>=2)return {color:'yellow',title:'Variazioni presenti',text:`Si osservano ${parts.join(', ')}. Nessuna conclusione automatica: controlla l’evoluzione.`};
 return {color:'green',title:'Andamento regolare',text:'Le variabili non mostrano al momento una combinazione operativa significativa.'};
}
let activeTrendType='temperatura',activeTrendHours=12;
let trendSelectedOffset=0;
function multiTrendRows(){
 return [
  {id:'precip',label:'Precipitazioni',icon:'🌧️',unit:'mm',key:'precipitation',dec:1},
  {id:'prob',label:'Prob. pioggia',icon:'💧',unit:'%',key:'precipitation_probability',dec:0},
  {id:'gust',label:'Raffica vento',icon:'💨',unit:'km/h',key:'wind_gusts_10m',dec:0},
  {id:'pressure',label:'Pressione',icon:'🧭',unit:'hPa',key:'pressure_msl',dec:0,invert:true},
  {id:'humidity',label:'Umidità',icon:'💧',unit:'%',key:'relative_humidity_2m',dec:0},
  {id:'temp',label:'Temperatura',icon:'🌡️',unit:'°C',key:'temperature_2m',dec:1},
  {id:'dew',label:'Punto di rugiada',icon:'💦',unit:'°C',key:'dew_point_2m',dec:1}
 ];
}
function fmtMulti(v,row){return `${Number(v||0).toFixed(row.dec)} ${row.unit}`}
function multiSvg(values,times,row,selected){
 const w=620,h=82,l=4,r=4,t=8,b=18;
 let min=Math.min(...values),max=Math.max(...values);
 if(row.id==='prob'){min=0;max=100}
 if(max===min){max+=1;min-=1}
 const pad=(max-min)*.1; if(row.id!=='prob'){min-=pad;max+=pad}
 const x=i=>l+i*((w-l-r)/Math.max(values.length-1,1));
 const y=v=>t+(max-v)/(max-min)*(h-t-b);
 const path=values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
 const bars=row.id==='precip'?values.map((v,i)=>`<rect x="${x(i)-3}" y="${y(v)}" width="6" height="${h-b-y(v)}" rx="2"/>`).join(''):'';
 const step=Math.max(1,Math.ceil(values.length/6));
 const labs=times.map((tm,i)=>i%step?'':`<text x="${x(i)}" y="${h-3}" text-anchor="middle">${new Date(tm).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</text>`).join('');
 const sx=x(selected),sy=y(values[selected]);
 return `<svg class="multi-svg row-${row.id}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" data-multi-chart="1"><g class="multi-grid"><line x1="0" y1="${t+(h-t-b)/2}" x2="${w}" y2="${t+(h-t-b)/2}"/></g><g class="multi-bars">${bars}</g><path class="multi-line" d="${path}"/><line class="multi-cursor" x1="${sx}" y1="0" x2="${sx}" y2="${h-b}"/><circle class="multi-selected" cx="${sx}" cy="${sy}" r="5"/>${labs}</svg>`;
}
function combinedTrendReading(h,start,count){
 const sl=k=>h[k].slice(start,start+count).map(v=>Number(v||0));
 const pressure=sl('pressure_msl'), humidity=sl('relative_humidity_2m'), gusts=sl('wind_gusts_10m');
 const probs=sl('precipitation_probability'), precip=sl('precipitation'), temps=sl('temperature_2m');
 const p=linearRate(pressure),u=linearRate(humidity),g=linearRate(gusts);
 const prob=Math.max(...probs), rain=precip.reduce((a,b)=>a+b,0), maxGust=Math.max(...gusts);
 const tempDrop=temps.length>1?temps[0]-Math.min(...temps):0;
 let score=0,signals=[];
 if(p<-.35){score+=2;signals.push({icon:'🧭',label:'Pressione',value:'in calo',dir:'↓',tone:'yellow'})}
 else signals.push({icon:'🧭',label:'Pressione',value:'stabile',dir:'→',tone:'green'});
 if(u>1.2){score+=1;signals.push({icon:'💧',label:'Umidità',value:'in aumento',dir:'↑',tone:'cyan'})}
 else signals.push({icon:'💧',label:'Umidità',value:'regolare',dir:'→',tone:'green'});
 if(g>2||maxGust>=45){score+=2;signals.push({icon:'💨',label:'Raffiche',value:`fino a ${Math.round(maxGust)} km/h`,dir:'↑',tone:maxGust>=60?'orange':'yellow'})}
 else signals.push({icon:'💨',label:'Raffiche',value:`max ${Math.round(maxGust)} km/h`,dir:'→',tone:'green'});
 if(prob>=60){score+=2;signals.push({icon:'🌧️',label:'Pioggia',value:`prob. max ${Math.round(prob)}%`,dir:'↑',tone:prob>=80?'orange':'yellow'})}
 else signals.push({icon:'🌧️',label:'Pioggia',value:`prob. max ${Math.round(prob)}%`,dir:'→',tone:'green'});
 if(rain>=3){score+=2;signals.push({icon:'☔',label:'Accumulo',value:`${rain.toFixed(1)} mm`,dir:'↑',tone:rain>=10?'orange':'yellow'})}
 else signals.push({icon:'☔',label:'Accumulo',value:`${rain.toFixed(1)} mm`,dir:'→',tone:'green'});
 if(tempDrop>=5)signals.push({icon:'🌡️',label:'Temperatura',value:`calo ${tempDrop.toFixed(1)}°`,dir:'↓',tone:'cyan'});
 let level='green',title='Quadro regolare',text='I parametri non mostrano una combinazione operativa significativa.';
 if(score>=6){level='orange';title='Evoluzione da monitorare';text='Più parametri stanno convergendo: verifica posizione e sviluppo con radar, PRETEMP e allerte.'}
 else if(score>=3){level='yellow';title='Variazioni presenti';text='Sono presenti segnali di cambiamento. Segui i prossimi aggiornamenti e confrontali con il radar.'}
 return {level,title,text,score:Math.min(100,Math.round(score/8*100)),signals};
}
function buildTrendTimeline(h,start,count){
 const times=h.time.slice(start,start+count), probs=h.precipitation_probability.slice(start,start+count), rain=h.precipitation.slice(start,start+count), gust=h.wind_gusts_10m.slice(start,start+count);
 const sample=Math.max(1,Math.ceil(count/8));
 return times.map((tm,i)=>{
   if(i%sample&&i!==times.length-1)return '';
   const p=Number(probs[i]||0),r=Number(rain[i]||0),g=Number(gust[i]||0);
   let tone='green',label='Stabile',icon='●';
   if(p>=80||r>=5||g>=65){tone='orange';label='Attenzione';icon='▲'}
   else if(p>=45||r>=1||g>=40){tone='yellow';label='Da seguire';icon='◆'}
   return `<div class="event-step ${tone}"><time>${new Date(tm).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><i>${icon}</i><b>${label}</b></div>`;
 }).join('');
}
function renderTrendPage(){
 if(!lastData)return;
 const h=lastData.hourly,start=nextStart(h.time),count=Math.min(activeTrendHours||24,h.time.length-start);
 activeTrendHours=[6,12,24,48].includes(activeTrendHours)?activeTrendHours:24;
 const actualCount=Math.min(activeTrendHours,h.time.length-start),times=h.time.slice(start,start+actualCount);
 trendSelectedOffset=Math.min(trendSelectedOffset,actualCount-1);
 const selected=trendSelectedOffset;
 const rows=multiTrendRows();
 const reading=combinedTrendReading(h,start,actualCount);
 const idxNow=calcIndex(lastData.current,h);
 const evolutionScore=reading.score;
 const rowHtml=rows.map(row=>{
   const vals=h[row.key].slice(start,start+actualCount).map(v=>Number(v||0));
   const val=vals[selected], min=Math.min(...vals),max=Math.max(...vals),maxI=vals.indexOf(max), minI=vals.indexOf(min);
   const extreme=row.invert?`MIN ${fmtMulti(min,row)} · ${new Date(times[minI]).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:`MAX ${fmtMulti(max,row)} · ${new Date(times[maxI]).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
   return `<article class="multi-trend-row" data-row="${row.id}"><div class="multi-row-label"><span>${row.icon}</span><div><b>${row.label}</b><small>${row.unit}</small></div></div><div class="multi-chart-wrap">${multiSvg(vals,times,row,selected)}</div><div class="multi-row-value"><b>${fmtMulti(val,row)}</b><small>${extreme}</small></div></article>`;
 }).join('');
 const selectedTime=new Date(times[selected]).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 const box=$('trendBox');
 box.innerHTML=`<div class="trend-page-shell multi-dashboard"><header class="trend-page-head"><div><span class="label">ANALISI MULTI-PARAMETRICA SINCRONIZZATA</span><h2>📊 Trend Operativi</h2><p>Borgo Viazza · tocca i grafici per confrontare lo stesso orario.</p></div><button class="closeTrend" type="button" aria-label="Chiudi Trend Operativi">×</button></header>
 <section class="multi-kpis"><div><small>INDICE CONTE</small><b>${idxNow}<em>/100</em></b><span>${level(idxNow)[0]}</span></div><div><small>INDICE EVOLUZIONE</small><b>${evolutionScore}<em>/100</em></b><span>${reading.title}</span></div><div><small>AGGIORNAMENTO</small><b>${new Date(lastData.current.time).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</b><span>dati modello</span></div></section>
 <section class="event-timeline"><div class="event-timeline-head"><small>TIMELINE EVENTO</small><span>lettura automatica</span></div><div class="event-track">${buildTrendTimeline(h,start,actualCount)}</div></section>
 <div class="multi-controls"><div class="trend-periods"><span>Periodo</span>${[6,12,24,48].map(n=>`<button class="${n===activeTrendHours?'active':''}" data-trend-hours="${n}" type="button">${n}h</button>`).join('')}</div><div class="selected-hour">ORARIO SELEZIONATO <b>${selectedTime}</b></div></div>
 <section class="multi-trends"><div class="multi-axis-title"><span>TREND SINCRONIZZATI · PROSSIME ${actualCount} ORE</span><small>tocca un punto per leggere tutti i valori</small></div>${rowHtml}</section>
 <section class="signal-board"><small>SEGNALI PRINCIPALI</small><div class="signal-grid">${reading.signals.map(s=>`<div class="signal-chip ${s.tone}"><span>${s.icon}</span><div><b>${s.label}</b><small>${s.value}</small></div><em>${s.dir}</em></div>`).join('')}</div></section>
 <section class="multi-reading ${reading.level}"><div><small>LETTURA AUTOMATICA DEI TREND</small><h3>${reading.title}</h3><p>${reading.text}</p></div><div class="reading-actions"><button type="button" data-jump-trend="radar">📡 Radar</button><button type="button" data-jump-trend="pretemp">⛈️ PRETEMP</button></div></section>
 <p class="trend-disclaimer">Lettura orientativa su previsione oraria. Radar, PRETEMP e allerte ufficiali restano gli strumenti di conferma.</p></div>`;
 box.querySelector('.closeTrend')?.addEventListener('click',closeTrendPage);
 box.querySelectorAll('[data-trend-hours]').forEach(b=>b.addEventListener('click',()=>{activeTrendHours=Number(b.dataset.trendHours);trendSelectedOffset=0;renderTrendPage()}));
 box.querySelectorAll('[data-multi-chart]').forEach(svg=>svg.addEventListener('pointerdown',e=>{
   const rect=svg.getBoundingClientRect(); const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
   trendSelectedOffset=Math.round(ratio*(actualCount-1)); renderTrendPage();
 }));
 box.querySelector('[data-jump-trend="radar"]')?.addEventListener('click',()=>window.open('https://zoom.earth/maps/radar/','_blank','noopener'));
 box.querySelector('[data-jump-trend="pretemp"]')?.addEventListener('click',()=>{closeTrendPage();window.open('https://www.pretemp.it/','_blank','noopener')});
}
function openTrend(type='temperatura'){
 if(!lastData)return;
 activeTrendType=trendConfig(type)?type:'temperatura';
 const box=$('trendBox'); box.classList.remove('hidden'); document.body.classList.add('trend-open'); renderTrendPage();
 box.scrollTop=0;
}
function closeTrendPage(){ $('trendBox')?.classList.add('hidden');document.body.classList.remove('trend-open'); }
$('refreshBtn')?.addEventListener('click',load);
document.querySelectorAll('[data-trend]').forEach(el=>{
  el.addEventListener('click',()=>openTrend(el.dataset.trend));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrend(el.dataset.trend)}});
});

// RC34 · Intervento 1: la card Prossime Ore apre direttamente il Trend Operativo

$('openTrendPage')?.addEventListener('click',()=>openTrend('temperatura'));
$('openTrendPage')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrend('temperatura')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('trendBox')?.classList.contains('hidden'))closeTrendPage()});
$('openOfficialAlerts')?.addEventListener('click',()=>window.open(OFFICIAL_ALERT_PAGE,'_blank','noopener'));

function openWeatherAnalysis(){
 const page=$('weatherAnalysisPage'); if(!page)return;
 const sourceTitle=$('statusTitle')?.textContent?.trim();
 const sourceText=$('statusText')?.textContent?.trim();
 const title=$('weatherAnalysisTitle'), text=$('weatherAnalysisText'), dot=$('weatherAnalysisDot');
 if(title) title.textContent=sourceTitle&&sourceTitle!=='Valutazione in corso'?sourceTitle:'Quadro meteo delle prossime ore';
 if(text) text.textContent=sourceText&&sourceText!=='Aggiornamento dati in corso.'?sourceText:'Consulta gli strumenti operativi per verificare situazione ed evoluzione.';
 if(dot){dot.className='';dot.classList.add(lastLevel?.[2]||'green');}
 if(lastData){
  const c=lastData.current,h=lastData.hourly,{start,end}=upcomingSlice(h,6);
  const operational=assessOperationalEvent(c,h);
  if(title) title.textContent=operational.title;
  if(text) text.textContent=operational.severity>=2?`Segnali locali: ${operational.events.join(', ')||'evento meteo'}. Usa i monitor per verificare traiettoria e intensità.`:sourceText;
  if(dot){dot.className='';dot.classList.add(operational.color);}
  const rain=h.precipitation.slice(start,end).reduce((a,b)=>a+(b||0),0);
  const gust=Math.max(c.wind_gusts_10m||0,...h.wind_gusts_10m.slice(start,end));
  if($('controlRoomIndex')) $('controlRoomIndex').textContent=`${lastIndex}/100`;
  if($('controlRoomRain')) $('controlRoomRain').textContent=`${rain.toFixed(1)} mm`;
  if($('controlRoomGust')) $('controlRoomGust').textContent=`${Math.round(gust)} km/h`;
  if($('controlRoomPressure')) $('controlRoomPressure').textContent=`${Math.round(c.pressure_msl)} hPa`;

  const a=assessOperationalEvent(c,h);
  const p1=h.precipitation.slice(start,Math.min(start+1,h.precipitation.length)).reduce((x,b)=>x+(b||0),0);
  const probs=(h.precipitation_probability||[]).slice(start,Math.min(start+3,h.time.length));
  const prob1=probs.length?(probs[0]||0):0;
  const maxProb=probs.length?Math.max(...probs.map(v=>v||0)):0;
  const headline=$('quickReadHeadline'), now=$('quickReadNow'), plus1=$('quickReadPlus1'), next=$('quickReadNext'), action=$('quickReadAction');
  let level=['BASSO','ATTENZIONE','ATTIVO','ALTO'][a.severity];
  let headlineText=a.title, nowText='Nessuna precipitazione locale rilevata', plus1Text='Nessun segnale rilevante', nextText=`Interesse locale ${level.toLowerCase()}`, actionText='Controllo ordinario';
  if(a.precipNow>=0.1||a.showerNow||a.stormNow) nowText=`Fenomeno locale in corso · ${a.precipNow.toFixed(1)} mm`;
  else if(a.gustNow>=35) nowText=`Raffiche locali ${Math.round(a.gustNow)} km/h`;
  if(a.severity>=2){
    plus1Text=a.stormNow?'Temporale rilevato adesso':a.stormSoon?`Temporali possibili · ${prob1}%`:`Segui intensità e traiettoria · ${prob1}%`;
    nextText=`Probabilità fino al ${maxProb}% · raffiche max ${Math.round(a.gustMax)} km/h`;
    actionText=a.stormNow||a.stormSoon?'Evoluzione → Radar → Fulmini → PRETEMP':'Evoluzione → Radar → PRETEMP';
  }else if(a.severity===1){plus1Text=`Possibilità ${prob1}%`;nextText=`Raffiche max ${Math.round(a.gustMax)} km/h`;actionText='Ricontrolla tra 15 minuti';}
  if(headline)headline.textContent=headlineText;
  if(now)now.textContent=nowText;
  if(plus1)plus1.textContent=plus1Text;
  if(next)next.textContent=nextText;
  if(action)action.textContent=actionText;
  if($('quickReadFreshness'))$('quickReadFreshness').textContent=level;
  if($('radarQuickStatus'))$('radarQuickStatus').querySelector('b').textContent=(a.precipNow>=0.1||a.showerNow||a.stormNow)?'Fenomeno locale rilevato: osserva intensità e traiettoria':'Verifica eventuali celle in avvicinamento';
  if($('evolutionQuickStatus'))$('evolutionQuickStatus').querySelector('b').textContent=a.severity>=1?`Interesse locale ${level.toLowerCase()} · probabilità fino al ${maxProb}%`:'Interesse locale basso nelle prossime 2 ore';
  if($('lightningQuickStatus'))$('lightningQuickStatus').querySelector('b').textContent=(a.stormNow||a.stormSoon)?'Attività temporalesca possibile/in corso: controlla scariche recenti':'Nessun segnale temporalesco dai dati locali';
 }
 page.classList.remove('hidden');document.body.classList.add('weather-analysis-open');page.scrollTop=0;
}
function closeWeatherAnalysis(){ $('weatherAnalysisPage')?.classList.add('hidden');document.body.classList.remove('weather-analysis-open'); }
$('briefWeather')?.addEventListener('click',()=>{ window.location.href='radar.html'; });
$('closeWeatherAnalysis')?.addEventListener('click',closeWeatherAnalysis);
$('weatherAnalysisPretemp')?.addEventListener('click',()=>{closeWeatherAnalysis();window.open('https://www.pretemp.it/','_blank','noopener');});
$('weatherAnalysisLamone')?.addEventListener('click',()=>{closeWeatherAnalysis();document.getElementById('openLamoneDrawer')?.click();});
$('weatherAnalysisNews')?.addEventListener('click',()=>{closeWeatherAnalysis();const target=$('followSection');target?.scrollIntoView({behavior:'smooth',block:'start'});target?.classList.add('open');const toggle=target?.querySelector('.accordion-toggle');toggle?.setAttribute('aria-expanded','true');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('weatherAnalysisPage')?.classList.contains('hidden'))closeWeatherAnalysis();});
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>{
 const id=el.dataset.jump;
 if(id==='lamoneDrawer'){document.getElementById('openLamoneDrawer')?.click();return;}
 if(id==='pretempDrawer'){window.open('https://www.pretemp.it/','_blank','noopener');return;}
 $(id)?.scrollIntoView({behavior:'smooth',block:'start'});
}));

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
  const future=[]; for(let i=0;i<times.length;i++){if(times[i]>now) future.push({t:times[i],v:Number(vals[i]||0)});} function futureSum(n){return future.slice(0,n).reduce((a,b)=>a+b.v,0)} const d={h1:sumHours(1),h3:sumHours(3),h6:sumHours(6),h24:sumHours(24),f1:futureSum(1),f3:futureSum(3),f6:futureSum(6),updated:new Date()};
  basinRainData[key]=d;
  return d;
}
function rainColor(mm6){return mm6>=50?'red':mm6>=25?'yellow':'green'}
function setBasinCard(key,d){
  const el=$(key==='lamone'?'basinLamoneSummary':'basinMarzenoSummary');
  if(!el) return;
  el.textContent=`1h ${d.h1.toFixed(1)} · 3h ${d.h3.toFixed(1)} · 6h ${d.h6.toFixed(1)} mm`;
  el.style.color=d.h6>=25?'var(--yellow)':'var(--green)';
  const ids=key==='lamone'?['lamObs1','lamObs3','lamObs6','lamFor1','lamFor3','lamFor6']:['marObs1','marObs3','marObs6','marFor1','marFor3','marFor6'];
  [d.h1,d.h3,d.h6,d.f1,d.f3,d.f6].forEach((v,i)=>{const x=$(ids[i]);if(x)x.textContent=v.toFixed(1)+' mm';});
  const f=$(key==='lamone'?'basinLamoneForecast':'basinMarzenoForecast'); if(f) f.textContent=`prevista 1h ${d.f1.toFixed(1)} · 3h ${d.f3.toFixed(1)} · 6h ${d.f6.toFixed(1)} mm`;
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


document.querySelectorAll('[data-analysis-jump]').forEach(btn=>btn.addEventListener('click',()=>{
  const target=$(btn.dataset.analysisJump); if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}));
document.querySelectorAll('[data-route-target]').forEach(btn=>btn.addEventListener('click',()=>{
  const target=$(btn.dataset.routeTarget);
  if(!target) return;
  target.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>target.click(),320);
}));
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





// RC34.5 - PRETEMP diretto: nessun pannello interno, nessun parser, nessuna mappa in cache.
document.addEventListener('click', function(event){
  const trigger=event.target.closest('[data-pretemp-direct="1"]');
  if(!trigger) return;
  // Gli elementi sono normali link; questa guardia evita che vecchi listener impediscano l'apertura.
  trigger.setAttribute('href','https://www.pretemp.it/');
  trigger.setAttribute('target','_blank');
  trigger.setAttribute('rel','noopener');
}, true);
try{
  ['mc_pretemp_cache','mc_pretemp_cache_meta','mc_pretemp_last_check'].forEach(k=>localStorage.removeItem(k));
}catch(_e){}

// RC33: PRETEMP esclusivamente esterno. Rimuove eventuali residui legacy dal DOM.
document.querySelectorAll('#pretempDrawer,.pretemp-drawer,.pretemp-modal,[data-pretemp-panel]').forEach(el=>el.remove());
document.querySelectorAll('[data-pretemp-direct="1"],a[href*="pretemp"]').forEach(el=>{el.href='https://www.pretemp.it/';el.target='_blank';el.rel='noopener';});

/* RC33.1 — ripristino radar leggero Home (solo correzione inizializzazione) */
(function initHomeLiteRadar(){
 const el=document.getElementById('homeRadarMap');
 if(!el || typeof L==='undefined') return;
 try{
  el.innerHTML='';
  const map=L.map(el,{zoomControl:false,attributionControl:true,scrollWheelZoom:false,touchZoom:true,dragging:true}).setView([44.42,11.98],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
   maxZoom:18,attribution:'&copy; OpenStreetMap'
  }).addTo(map);
  L.circleMarker([44.42,11.98],{radius:6,weight:2,color:'#fff',fillColor:'#00a9c8',fillOpacity:1}).addTo(map);
  const timeEl=document.getElementById('radarFrameTime');
  async function refreshRadar(){
   if(timeEl) timeEl.textContent='LIVE · aggiornamento in corso';
   try{
    const res=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    const frames=Array.isArray(data?.radar?.past)?data.radar.past:[];
    const frame=frames.at(-1);
    if(!frame) throw new Error('Nessun frame radar');
    const host=data.host||'https://tilecache.rainviewer.com';
    if(map._homeRadarLayer) map.removeLayer(map._homeRadarLayer);
    map._homeRadarLayer=L.tileLayer(`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,{
      tileSize:256,opacity:.68,zIndex:450,maxNativeZoom:7,maxZoom:18,className:'radar-overlay-pane',attribution:'Radar © RainViewer'
    }).addTo(map);
    const d=new Date(frame.time*1000);
    if(timeEl) timeEl.textContent='LIVE · radar '+d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   }catch(err){
    console.warn('Radar Home non disponibile',err);
    if(timeEl) timeEl.textContent='LIVE · radar temporaneamente non disponibile';
   }
   setTimeout(()=>map.invalidateSize(),150);
  }
  refreshRadar();
  setInterval(refreshRadar,5*60*1000);
 }catch(err){ console.warn('Inizializzazione radar Home fallita',err); }
})();


/* =========================================================
   RC34.5 · INTERVENTO 2 — CENTRO OPERATIVO
   Ripristino reale dei 5 cassetti operativi.
   Una sezione aperta alla volta; nessuna nuova funzione.
   ========================================================= */
(function restoreOperationalAccordions(){
  const root=document.getElementById('operativeLinks');
  if(!root) return;

  const sections=[...root.querySelectorAll('.accordion-section')];
  const setState=(section,open)=>{
    section.classList.toggle('open',open);
    const btn=section.querySelector('.accordion-toggle');
    if(!btn) return;
    btn.setAttribute('aria-expanded',open?'true':'false');
    const arrow=btn.querySelector(':scope > i');
    if(arrow) arrow.textContent=open?'⌄':'›';
  };

  sections.forEach(section=>{
    const btn=section.querySelector('.accordion-toggle');
    if(!btn || btn.dataset.rc342Bound==='1') return;
    btn.dataset.rc342Bound='1';
    btn.addEventListener('click',()=>{
      const willOpen=!section.classList.contains('open');
      sections.forEach(other=>setState(other,false));
      setState(section,willOpen);
      if(willOpen){
        setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'nearest'}),40);
      }
    });
  });

  // Stato iniziale: Osserva aperto, gli altri chiusi.
  sections.forEach(section=>setState(section,section.id==='observeSection'));
})();


/* RC35 · Dirette & Social: link personali salvati solo sul dispositivo */
(function rc35SocialLinks(){
 const box=document.getElementById('socialLinks'), add=document.getElementById('addSocialLink'), form=document.getElementById('socialAddForm');
 if(!box||!add||!form) return;
 const name=document.getElementById('socialName'), url=document.getElementById('socialUrl'), save=document.getElementById('saveSocialLink'), cancel=document.getElementById('cancelSocialLink');
 const KEY='meteoConteSocialLinksV1';
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}};
 const write=v=>localStorage.setItem(KEY,JSON.stringify(v));
 function render(){
   box.querySelectorAll('.custom-social').forEach(x=>x.remove());
   read().forEach((item,i)=>{
     const a=document.createElement('a');a.className='custom-social';a.href=item.url;a.target='_blank';a.rel='noopener';
     const icon=document.createElement('i');icon.textContent='🔗';
     const span=document.createElement('span');const b=document.createElement('b');b.textContent=item.name;const sm=document.createElement('small');sm.textContent='link personale';span.append(b,sm);
     const rm=document.createElement('button');rm.type='button';rm.className='remove-social';rm.textContent='×';rm.setAttribute('aria-label','Rimuovi '+item.name);rm.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const v=read();v.splice(i,1);write(v);render()});
     a.append(icon,span,rm);box.append(a);
   });
 }
 function close(){form.classList.add('hidden');name.value='';url.value=''}
 add.addEventListener('click',()=>{form.classList.toggle('hidden');if(!form.classList.contains('hidden'))name.focus()});
 cancel?.addEventListener('click',close);
 save?.addEventListener('click',()=>{let n=name.value.trim(),u=url.value.trim();if(!n||!u)return; if(!/^https?:\/\//i.test(u))u='https://'+u;try{new URL(u)}catch{return}const v=read();v.push({name:n,url:u});write(v);render();close()});
 render();
})();

/* RC35.1 · pioggia sintetica */
(function(){const $=id=>document.getElementById(id);function showRain(){if(!lastData)return;const h=lastData.hourly,start=nextStart(h.time),v=h.precipitation.slice(start,start+6).map(Number),sum=n=>v.slice(0,n).reduce((a,b)=>a+(b||0),0),a=sum(1),b=sum(3),c=sum(6);if($("rc351Rain1"))$("rc351Rain1").textContent=a.toFixed(1)+" mm";if($("rc351Rain3"))$("rc351Rain3").textContent=b.toFixed(1)+" mm";if($("rc351Rain6"))$("rc351Rain6").textContent=c.toFixed(1)+" mm";if($("rc351RainMsg"))$("rc351RainMsg").textContent=c<.2?"Nessuna pioggia significativa prevista nelle prossime 6 ore.":c<2?"Pioggia debole prevista nelle prossime 6 ore.":c<10?"Pioggia prevista: controlla radar ed evoluzione.":"Pioggia consistente prevista: controlla anche il Lamone."}$("rc351RainBtn")?.addEventListener("click",()=>{$("rc351Rain")?.classList.toggle("hidden");showRain()});$("rc351RainClose")?.addEventListener("click",()=>$("rc351Rain")?.classList.add("hidden"));document.querySelector('[data-basin-forecast="1"]')?.addEventListener("click",()=>{document.querySelector('.basin-block')?.scrollIntoView({behavior:"smooth",block:"center"})});setTimeout(showRain,1800)})();

/* === RC35.2 · finale restyling: approfondimento prossime ore === */
function hourlyWeatherLabel(code){return (WMO[code]||['Meteo','🌤️'])[0]}
function renderHourlyDetail(selected=0){
 setTimeout(()=>renderHourlyGraph(hourlyGraphHorizon),0);
 const page=$('hourlyDetailPage'); if(!page||!lastData?.hourly)return;
 const h=lastData.hourly,start=nextStart(h.time),count=Math.min(13,h.time.length-start);
 const rows=Array.from({length:count},(_,i)=>start+i);
 const rain6=rows.slice(0,6).reduce((s,k)=>s+Number(h.precipitation[k]||0),0);
 const gustMax=Math.max(...rows.map(k=>Number(h.wind_gusts_10m[k]||0)));
 const minT=Math.min(...rows.map(k=>Number(h.temperature_2m[k]||0)));
 $('hourlyDetailSummary').innerHTML=`<span><small>PIOGGIA 6H</small><b>${rain6.toFixed(1)} mm</b></span><span><small>RAFFICA MAX</small><b>${Math.round(gustMax)} km/h</b></span><span><small>MINIMA</small><b>${Math.round(minT)}°C</b></span>`;
 $('hourlyDetailStrip').innerHTML=rows.map((k,i)=>{const d=new Date(h.time[k]),icon=(WMO[h.weather_code[k]]||['','🌤️'])[1];return `<button class="hour-detail-card ${i===selected?'active':''}" data-hour-detail="${i}" type="button"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><strong>${icon} ${Math.round(h.temperature_2m[k])}°</strong><small>🌧️ ${h.precipitation_probability[k]||0}% · ${Number(h.precipitation[k]||0).toFixed(1)} mm</small><small>💨 ${Math.round(h.wind_speed_10m[k]||0)} · ${Math.round(h.wind_gusts_10m[k]||0)} km/h</small></button>`}).join('');
 const k=rows[Math.max(0,Math.min(selected,rows.length-1))],d=new Date(h.time[k]);
 $('hourlySelected').innerHTML=`<small>ORA SELEZIONATA · ${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</small><b>${hourlyWeatherLabel(h.weather_code[k])} · ${Math.round(h.temperature_2m[k])}°C</b><div><span>Pioggia <strong>${h.precipitation_probability[k]||0}% · ${Number(h.precipitation[k]||0).toFixed(1)} mm</strong></span><span>Vento <strong>${Math.round(h.wind_speed_10m[k]||0)} km/h</strong></span><span>Raffica <strong>${Math.round(h.wind_gusts_10m[k]||0)} km/h</strong></span><span>Umidità <strong>${Math.round(h.relative_humidity_2m[k]||0)}%</strong></span></div>`;
 let msg=rain6<.2?'Nessuna pioggia significativa prevista nelle prossime 6 ore.':rain6<2?'Possibili precipitazioni deboli nelle prossime 6 ore.':rain6<10?'Pioggia prevista: utile confrontare con il radar.':'Pioggia consistente prevista: controlla radar, PRETEMP e Centro Lamone.';
 $('hourlyConte').innerHTML=`<small>LETTURA CONTE</small><b>${msg}</b>`;
 $('hourlyDetailStrip').querySelectorAll('[data-hour-detail]').forEach(b=>b.addEventListener('click',()=>renderHourlyDetail(Number(b.dataset.hourDetail))));
}
function openHourlyDetail(){if(!lastData)return;const p=$('hourlyDetailPage');p?.classList.remove('hidden');document.body.classList.add('trend-open');renderHourlyDetail(0)}
function closeHourlyDetail(){$('hourlyDetailPage')?.classList.add('hidden');document.body.classList.remove('trend-open')}
$('openHourlyTrend')?.addEventListener('click',e=>{if(e.target.closest('a,button'))return;openHourlyDetail()});
$('openHourlyTrend')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openHourlyDetail()}});
$('closeHourlyDetail')?.addEventListener('click',closeHourlyDetail);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('hourlyDetailPage')?.classList.contains('hidden'))closeHourlyDetail()});


/* === RC35.3 · Centro Avvisi Conte ===
   Avvisi locali: funzionano quando la PWA viene aggiornata/aperta.
   Il service worker resta registrato e prepara la base per FCM push reale. */
const CONTE_ALERT_SEEN='meteoConteAlertSeenV1';
function conteAlertCandidate(){
 if(officialAlertState && alertRank(officialAlertState.color)>0){
   return {level:'official',icon:'⚠️',kind:'ALLERTA UFFICIALE',title:`Allerta ${alertColorLabel(officialAlertState.color).toLowerCase()}`,text:(officialAlertState.phenomena||[]).map(x=>x.label).join(', ')||'Apri il bollettino ufficiale.',action:'official',key:'official-'+officialAlertState.color+'-'+(officialAlertState.title||'')};
 }
 if(!lastData?.hourly) return null;
 const s=buildNextSignal(lastData.hourly), a=assessOperationalEvent(lastData.current,lastData.hourly);
 if(a.severity>=2 || s.kind==='storm') return {level:a.severity>=3?'event':'watch',icon:a.severity>=3?'🔴':'⛈️',kind:a.severity>=3?'EVENTO DA CONTROLLARE':'AVVISO CONTE',title:a.stormNow?'Temporale rilevato':s.kind==='storm'?'Possibili temporali nelle prossime ore':a.title,text:s.text||`Pioggia ${a.rainSum.toFixed(1)} mm · raffiche ${Math.round(a.gustMax)} km/h`,action:'radar',key:'local-'+s.kind+'-'+s.text};
 if(s.kind==='rain' || s.kind==='wind' || a.severity===1) return {level:'watch',icon:s.kind==='wind'?'💨':'🌧️',kind:'AVVISO CONTE',title:s.kind==='wind'?'Vento da monitorare':'Precipitazioni da monitorare',text:s.text,action:'radar',key:'local-'+s.kind+'-'+s.text};
 return null;
}
function notifyConte(c){
 if(!c || !('Notification' in window) || Notification.permission!=='granted') return;
 const seen=localStorage.getItem(CONTE_ALERT_SEEN); if(seen===c.key)return;
 try{new Notification(`Meteo Conte · ${c.kind}`,{body:c.title+' — '+c.text,icon:'icon.png',tag:'meteo-conte-avviso',renotify:true});localStorage.setItem(CONTE_ALERT_SEEN,c.key)}catch(_e){}
}
function renderConteAlertCenter(){
 const bar=$('conteAlertBar'); if(!bar)return;
 const c=conteAlertCandidate(); const canNotify='Notification' in window; const permission=canNotify?Notification.permission:'unsupported';
 if(!c && permission==='granted'){bar.classList.add('hidden');return;}
 bar.className='conte-alertbar '+(c?.level==='official'?'alert-official':c?.level==='event'?'alert-event':'');
 $('conteAlertIcon').textContent=c?.icon||'🔔'; $('conteAlertKind').textContent=c?.kind||'AVVISI CONTE'; $('conteAlertTitle').textContent=c?.title||'Attiva gli avvisi Meteo Conte'; $('conteAlertText').textContent=c?.text||'L’app ti segnala quando previsione locale o allerta ufficiale richiedono un controllo.';
 const open=$('conteAlertOpen'); if(open){open.style.display=c?'':'none';open.dataset.action=c?.action||''}
 const nb=$('conteNotifyBtn'); if(nb){nb.style.display=permission==='granted'?'none':'';nb.textContent=permission==='denied'?'🔕 BLOCCATE':'🔔 ATTIVA';nb.disabled=permission==='denied'||permission==='unsupported'}
 notifyConte(c);
}
$('conteNotifyBtn')?.addEventListener('click',async()=>{if(!('Notification' in window))return;try{const p=await Notification.requestPermission();renderConteAlertCenter();if(p==='granted')new Notification('Meteo Conte',{body:'Avvisi attivati su questo dispositivo.',icon:'icon.png',tag:'meteo-conte-test'})}catch(_e){}});
$('conteAlertOpen')?.addEventListener('click',()=>{const a=$('conteAlertOpen')?.dataset.action;if(a==='official')window.open(OFFICIAL_ALERT_PAGE,'_blank','noopener');else window.location.href='radar.html';});
$('conteAlertDismiss')?.addEventListener('click',()=>{$('conteAlertBar')?.classList.add('hidden')});
setTimeout(renderConteAlertCenter,2200);


/* === RC36 · grafico 24/48h usando esclusivamente lastData.hourly === */
let hourlyGraphHorizon=24;
function renderHourlyGraph(hours=hourlyGraphHorizon){
 if(!lastData?.hourly)return;
 hourlyGraphHorizon=hours;
 const h=lastData.hourly,start=nextStart(h.time),count=Math.min(hours,h.time.length-start);
 const ids=Array.from({length:count},(_,i)=>start+i),box=$('hourlyGraph'); if(!box||!ids.length)return;
 const temps=ids.map(i=>Number(h.temperature_2m[i]||0)),rains=ids.map(i=>Number(h.precipitation[i]||0)),gusts=ids.map(i=>Number(h.wind_gusts_10m[i]||0));
 const minT=Math.floor(Math.min(...temps)),maxT=Math.ceil(Math.max(...temps)),maxR=Math.max(1,...rains),maxG=Math.max(20,...gusts);
 const W=680,H=230,L=34,R=12,T=22,B=40,iw=W-L-R,ih=H-T-B,x=i=>L+(ids.length<=1?0:i*iw/(ids.length-1));
 const yT=v=>T+ih-(v-minT)/(Math.max(2,maxT-minT))*ih*.68-ih*.14,yG=v=>T+ih-(v/maxG)*ih*.36;
 const tp=temps.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+yT(v).toFixed(1)).join(' ');
 const gp=gusts.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+yG(v).toFixed(1)).join(' ');
 let bars='',labels='',vals=''; const ls=hours>24?6:3,vs=hours>24?8:4;
 rains.forEach((v,i)=>{if(v<=0)return;const bw=Math.max(4,iw/ids.length*.68),bh=Math.max(3,(v/maxR)*ih*.34);bars+=`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${(T+ih-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="#48b5d7" opacity=".82"/>`;});
 ids.forEach((k,i)=>{const d=new Date(h.time[k]);if(i%ls===0)labels+=`<text x="${x(i)}" y="${H-12}" fill="#91aab4" font-size="10" text-anchor="middle">${d.toLocaleTimeString('it-IT',{hour:'2-digit'})}</text>`;if(i%vs===0)vals+=`<circle cx="${x(i)}" cy="${yT(temps[i])}" r="2.7" fill="#f3c95d"/><text x="${x(i)}" y="${yT(temps[i])-7}" fill="#f3c95d" font-size="9" text-anchor="middle">${Math.round(temps[i])}°</text>`;});
 box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${L}" y1="${T+ih}" x2="${W-R}" y2="${T+ih}" stroke="#ffffff22"/><line x1="${L}" y1="${T+ih*.5}" x2="${W-R}" y2="${T+ih*.5}" stroke="#ffffff12"/>${bars}<path d="${gp}" fill="none" stroke="#b8c6cc" stroke-width="2.2" stroke-dasharray="5 5" opacity=".72"/><path d="${tp}" fill="none" stroke="#f3c95d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${vals}<text x="4" y="${T+6}" fill="#f3c95d" font-size="9">${maxT}°</text><text x="4" y="${T+ih}" fill="#91aab4" font-size="9">${minT}°</text><text x="${W-R}" y="${T+ih-7}" fill="#b8c6cc" font-size="9" text-anchor="end">raffica max ${Math.round(maxG)} km/h</text>${labels}</svg>`;
 document.querySelectorAll('[data-hourly-horizon]').forEach(b=>b.classList.toggle('active',Number(b.dataset.hourlyHorizon)===hours));
}
document.querySelectorAll('[data-hourly-horizon]').forEach(b=>b.addEventListener('click',()=>renderHourlyGraph(Number(b.dataset.hourlyHorizon))));
