const $=id=>document.getElementById(id);
let lastData=null,lastIndex=0,lastLevel=null;
let basinRainData={lamone:null,marzeno:null};
const WMO={0:['Sereno','☀️'],1:['Prevalentemente sereno','🌤️'],2:['Parzialmente nuvoloso','⛅'],3:['Nuvoloso','☁️'],45:['Nebbia','🌫️'],48:['Nebbia','🌫️'],51:['Pioviggine','🌦️'],53:['Pioviggine','🌦️'],55:['Pioviggine','🌦️'],61:['Pioggia','🌧️'],63:['Pioggia','🌧️'],65:['Pioggia forte','🌧️'],80:['Rovescio','🌦️'],81:['Rovescio','🌧️'],82:['Rovescio forte','⛈️'],95:['Temporale','⛈️'],96:['Temporale/grandine','⛈️'],99:['Temporale/grandine','⛈️']};
function dewPoint(t,h){const a=17.27,b=237.7;const alpha=((a*t)/(b+t))+Math.log(Math.max(h,1)/100);return (b*alpha)/(a-alpha)}
function upcomingSlice(hourly,hours=6){const start=nextStart(hourly.time);return {start,end:Math.min(hourly.time.length,start+hours)}}
function calcIndex(now,hourly){const {start,end}=upcomingSlice(hourly,6);const probs=hourly.precipitation_probability.slice(start,end);const rains=hourly.precipitation.slice(start,end);const gusts=hourly.wind_gusts_10m.slice(start,end);const rainMax=probs.length?Math.max(...probs):0;const rainSum=rains.reduce((a,b)=>a+(b||0),0);const gustMax=gusts.length?Math.max(...gusts):now.wind_gusts_10m;let idx=0;idx+=rainMax*0.45;idx+=Math.min(25,rainSum*10);idx+=now.relative_humidity_2m>75?15:now.relative_humidity_2m>60?8:0;idx+=gustMax>45?15:gustMax>30?8:0;idx+=now.pressure_msl<1008?10:0;return Math.round(Math.min(100,idx))}
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
  const heavyRain=rainSum>=8||rainMax>=70;
  const strongWind=gustMax>=60;
  const lowPressure=(c.pressure_msl||1015)<1008;
  const signals=[storm,heavyRain,strongWind].filter(Boolean).length;
  let main='Nessun fenomeno rilevante previsto nelle prossime 6 ore.';
  let detail='Situazione stabile. Non sono necessari controlli aggiuntivi.';
  let color='green';
  if(idx>=25 || rainMax>=35 || rainSum>=1 || gustMax>=35 || showers){
    color='yellow';
    main=showers?'Possibili rovesci nelle prossime ore.':'Evoluzione meteo da seguire nelle prossime ore.';
    detail=`Pioggia massima ${rainMax}%, accumulo ${rainSum.toFixed(1)} mm e raffiche fino a ${Math.round(gustMax)} km/h. Verifica PRETEMP e Radar evoluzione se il cielo cambia.`;
  }
  if(storm || heavyRain || strongWind || idx>=50){
    color=(storm&&strongWind)||(signals>=2)||idx>=75?'red':'yellow';
    const events=[];
    if(storm) events.push('temporali');
    if(heavyRain) events.push('piogge intense');
    if(strongWind) events.push('raffiche forti');
    main=`Attenzione: ${events.length?events.join(', '):'più segnali meteo'} ${events.length>1?'sono possibili':'è possibile'} nelle prossime ore.`;
    const actions=['PRETEMP','Radar evoluzione'];
    if(storm) actions.push('Fulmini live');
    if(heavyRain) actions.push('Lamone');
    detail=`Probabilità pioggia ${rainMax}%, accumulo ${rainSum.toFixed(1)} mm, raffiche fino a ${Math.round(gustMax)} km/h${lowPressure?', pressione in calo':''}. Controlla ${actions.join(', ')}.`;
  }
  return {main,detail,color,signals};
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
   line.querySelector('b').textContent=txt;
 }
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
  await navigator.serviceWorker?.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister()));
  const url='https://api.open-meteo.com/v1/forecast?latitude=44.418&longitude=11.977&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl,is_day&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl&daily=sunrise,sunset&timezone=Europe%2FRome&forecast_days=2';
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error('api');
  const data=await res.json(); lastData=data; const c=data.current, h=data.hourly;
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
$('refreshBtn')?.addEventListener('click',load);
document.querySelectorAll('[data-trend]').forEach(el=>{
  el.addEventListener('click',()=>openTrend(el.dataset.trend));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrend(el.dataset.trend)}});
});
$('openOfficialAlerts')?.addEventListener('click',()=>window.open(OFFICIAL_ALERT_PAGE,'_blank','noopener'));
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>{
 const id=el.dataset.jump;
 if(id==='lamoneDrawer'){document.getElementById('openLamoneDrawer')?.click();return;}
 if(id==='pretempDrawer'){document.getElementById('openPretempDrawer')?.click();return;}
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



// V56 - Cassetto PRETEMP: grafica interna ottimizzata, logica invariata
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

// V62 - PRETEMP stato del giorno + lettura assistita + mappa giornaliera
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
  const summary=document.getElementById('pretempSummary');
  const summaryTitle=document.getElementById('pretempSummaryTitle');
  const summaryText=document.getElementById('pretempSummaryText');
  const summaryState=document.getElementById('pretempSummaryState');
  const summaryAction=document.getElementById('pretempSummaryAction');
  const summaryDot=document.getElementById('pretempSummaryDot');
  const decision=document.getElementById('pretempDecision');
  const decisionTitle=document.getElementById('pretempDecisionTitle');
  const decisionText=document.getElementById('pretempDecisionText');
  const decisionDot=document.getElementById('pretempDecisionDot');
  const decisionAction=document.getElementById('pretempDecisionAction');
  if(!map || !mapButton) return;

  const setDecision=(mode,title,text,actionText)=>{
    if(!decision) return;
    decision.classList.remove('is-ready','is-warning','is-error');
    decision.classList.add(mode==='ready'?'is-ready':mode==='error'?'is-error':'is-warning');
    if(decisionTitle) decisionTitle.textContent=title;
    if(decisionText) decisionText.textContent=text;
    if(decisionAction) decisionAction.textContent=actionText;
    if(decisionDot){
      decisionDot.classList.remove('green','yellow','red');
      decisionDot.classList.add(mode==='ready'?'green':mode==='error'?'red':'yellow');
    }
  };

  const setSummary=(mode,title,text,state,action)=>{
    if(!summary) return;
    summary.classList.remove('is-waiting','is-error');
    if(mode==='waiting') summary.classList.add('is-waiting');
    if(mode==='error') summary.classList.add('is-error');
    if(summaryTitle) summaryTitle.textContent=title;
    if(summaryText) summaryText.textContent=text;
    if(summaryState) summaryState.textContent=state;
    if(summaryAction) summaryAction.textContent=action;
    if(summaryDot){
      summaryDot.classList.remove('green','yellow','red');
      summaryDot.classList.add(mode==='ok'?'green':mode==='error'?'red':'yellow');
    }
  };

  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const pad=n=>String(n).padStart(2,'0');
  const makeUrls=date=>{
    const y=date.getFullYear(), m=date.getMonth(), d=date.getDate();
    const stamp=`${pad(d)}_${pad(m+1)}_${y}`;
    const officialStamp=`${pad(d)}_${pad(m+1)}_${y}`;
    const base=`https://pretemp.altervista.org/archivio/${y}/${months[m]}`;
    const officialBase=`https://www.pretemp.it/archivio/${y}/${months[m]}`;
    return {
      image:`${base}/cartine/${stamp}.png`,
      forecast:`${officialBase}/previsioni/${officialStamp}.html`,
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
    if(forecastLink) forecastLink.href=current.forecast;
    if(modalForecastLink) modalForecastLink.href=current.forecast;
    validity.textContent=(attempt===0?'oggi':'ultima disponibile')+' · 00–24 UTC';
  };
  map.addEventListener('load',()=>{
    fallback?.classList.add('hidden');
    map.classList.remove('hidden');
    const isToday=attempt===0;
    setDecision(
      isToday?'ready':'warning',
      isToday?'Previsione pronta':'Controlla la data',
      isToday
        ?'La mappa di oggi è disponibile. Concentrati sulla Romagna: prima il livello, poi i simboli di grandine, raffiche, piogge forti o tornado.'
        :'È disponibile una previsione precedente. Prima di usarla, verifica attentamente data e validità.',
      isToday?'🗺️ Leggi la mappa':'📅 Verifica validità'
    );
    setSummary(
      isToday?'ok':'waiting',
      isToday?'Previsione del giorno disponibile':'Ultima previsione disponibile',
      isToday
        ?'La mappa ufficiale è caricata. Controlla prima il colore del livello sulla Romagna, poi cerca eventuali simboli di grandine, raffiche, piogge forti o tornado.'
        :'La mappa odierna non risulta ancora disponibile: viene mostrata l’ultima previsione pubblicata. Verifica sempre data e validità.',
      isToday?'LIVE':'precedente',
      'ingrandisci mappa'
    );
  });
  map.addEventListener('error',()=>{
    attempt++;
    if(attempt<candidates.length){applyCandidate();return;}
    map.classList.add('hidden');fallback?.classList.remove('hidden');
    if(forecastLink) forecastLink.href='https://www.pretemp.it/';
    if(modalForecastLink) modalForecastLink.href='https://www.pretemp.it/';
    validity.textContent='in attesa di pubblicazione';
    setDecision('error','Fonte da aprire','La mappa non è disponibile nell’app. Apri PRETEMP completo per controllare la previsione ufficiale.','↗ Apri PRETEMP');
    setSummary('error','Previsione non disponibile','La mappa non è stata trovata. Apri la pagina PRETEMP completa oppure riprova più tardi.','non disponibile','apri fonte');
  });
  setDecision('warning','Verifica in corso','Sto cercando la mappa ufficiale più recente.','⏳ Attendi');
  setSummary('waiting','Carico la previsione…','Sto verificando la disponibilità della mappa ufficiale del giorno.','verifica…','attendi');
  applyCandidate();

  const openModal=()=>{
    if(map.classList.contains('hidden')){window.open(forecastLink?.href||'https://www.pretemp.it/','_blank','noopener');return;}
    if(mapLarge) mapLarge.src=map.src;
    modal?.classList.remove('hidden');
    document.body.classList.add('pretemp-modal-open');
  };
  const closeModal=()=>{modal?.classList.add('hidden');document.body.classList.remove('pretemp-modal-open');};
  mapButton.addEventListener('click',openModal);
  decisionAction?.addEventListener('click',()=>{
    if(map.classList.contains('hidden')) window.open(forecastLink?.href||'https://www.pretemp.it/','_blank','noopener');
    else openModal();
  });
  close?.addEventListener('click',closeModal);
  modal?.addEventListener('click',e=>{if(e.target===modal) closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeModal();});
})();


// V59 - Guida rapida interna PRETEMP
(function(){
  const toggle=document.getElementById('togglePretempGuide');
  const open=document.getElementById('openPretempGuide');
  const panel=document.getElementById('pretempGuidePanel');
  if(!panel) return;
  const setOpen=(value,scroll=false)=>{
    panel.classList.toggle('hidden',!value);
    toggle?.setAttribute('aria-expanded',String(value));
    toggle?.classList.toggle('is-open',value);
    if(value&&scroll) setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),40);
  };
  toggle?.addEventListener('click',()=>setOpen(panel.classList.contains('hidden'),false));
  open?.addEventListener('click',()=>setOpen(true,true));
})();


// V68 - PRETEMP ottimizzato: lettura essenziale

// V84 - Bollettino PRETEMP: URL ufficiale corretto + proxy HTTPS robusto
(function setupPretempBulletin(){
  const toggle=document.getElementById('togglePretempBulletin');
  const panel=document.getElementById('pretempBulletinPanel');
  const load=document.getElementById('loadPretempBulletin');
  const status=document.getElementById('pretempBulletinStatus');
  const text=document.getElementById('pretempBulletinText');
  const official=document.getElementById('pretempOfficialForecastLink');
  const forecast=document.getElementById('pretempForecastLink');
  if(!toggle||!panel) return;
  const syncLink=()=>{if(forecast?.href){official.href=forecast.href;}};
  toggle.addEventListener('click',()=>{const open=panel.classList.toggle('hidden')===false;toggle.setAttribute('aria-expanded',String(open));toggle.classList.toggle('is-open',open);syncLink();});
  load?.addEventListener('click',async()=>{
    syncLink();
    if(!forecast?.href) return;
    load.disabled=true;load.textContent='Carico…';status.textContent='Recupero il testo ufficiale PRETEMP.';
    try{
      const proxy='https://r.jina.ai/https://'+forecast.href.replace(/^https?:\/\//,'')+'?v='+Date.now();
      const res=await fetch(proxy,{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const raw=await res.text();
      const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean)
        .filter(s=>!s.startsWith('![')&&!s.startsWith('Image')&&!s.startsWith('URL Source:')&&!s.startsWith('Markdown Content:'));
      let start=lines.findIndex(s=>/previsione per|previsioni per/i.test(s));
      if(start<0) start=0;
      const useful=[];
      for(const line of lines.slice(start+1)){
        if(/^(home|archivio|contatti|privacy|copyright|pretemp -)/i.test(line)) continue;
        if(line.length<35) continue;
        useful.push(line.replace(/^#+\s*/,''));
        if(useful.join(' ').length>4200) break;
      }
      if(!useful.length) throw new Error('testo non trovato');
      text.innerHTML=useful.map(p=>`<p>${p.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p>`).join('');
      text.classList.remove('hidden');status.textContent='Bollettino ufficiale del giorno, ripulito per la lettura da telefono.';
      load.textContent='Ricarica testo';
    }catch(_e){
      status.textContent='Caricamento automatico non riuscito. La pagina ufficiale resta disponibile qui sotto.';
      load.textContent='Riprova';
    }finally{load.disabled=false;}
  });
})();

(function setupPretempAssistedReading(){
  const reader=document.getElementById('pretempReader');
  const levelButtons=[...document.querySelectorAll('[data-pretemp-level]')];
  const phenomenonButtons=[...document.querySelectorAll('[data-pretemp-phenomenon]')];
  const zoneButtons=[...document.querySelectorAll('[data-pretemp-zone]')];
  const apply=document.getElementById('applyPretempReading');
  const reset=document.getElementById('resetPretempReading');
  const state=document.getElementById('pretempReaderState');
  const decision=document.getElementById('pretempDecision');
  const decisionTitle=document.getElementById('pretempDecisionTitle');
  const decisionText=document.getElementById('pretempDecisionText');
  const decisionDot=document.getElementById('pretempDecisionDot');
  const decisionAction=document.getElementById('pretempDecisionAction');
  const mapButton=document.getElementById('pretempMapButton');
  if(!reader || !apply) return;

  let level=null;
  let zone='bassa';
  let noSymbols=false;
  const phenomena=new Set();
  const labels={rain:'piogge forti',hail:'grandine',wind:'raffiche forti',tornado:'rischio tornadico'};
  const zoneLabels={bassa:'Bassa Romagna',romagna:'Romagna',appennino:'Appennino romagnolo',pianura:'pianura romagnola',costa:'costa romagnola'};
  const storageKey='meteoContePretempReading';
  const legacyStorageKeys=['meteoContePretempReadingV65','meteoContePretempReadingV64','meteoContePretempReadingV63'];
  const drawerState=document.getElementById('pretempDrawerState');
  const drawerFocus=document.getElementById('pretempDrawerFocus');
  const drawerContext=document.getElementById('pretempDrawerContext');
  const pretempDot=document.getElementById('dotTemporali');
  const selectedLevel=document.getElementById('pretempSelectedLevel');
  const selectedPhenomena=document.getElementById('pretempSelectedPhenomena');
  const selectedZone=document.getElementById('pretempSelectedZone');
  const phenomenonCards={rain:document.getElementById('pretempPhenRain'),hail:document.getElementById('pretempPhenHail'),wind:document.getElementById('pretempPhenWind'),tornado:document.getElementById('pretempPhenTornado')};

  const setDecision=(mode,title,text,action)=>{
    decision?.classList.remove('is-ready','is-warning','is-error','is-alert');
    decision?.classList.add(mode==='ready'?'is-ready':mode==='error'?'is-error':mode==='alert'?'is-alert':'is-warning');
    if(decisionTitle) decisionTitle.textContent=title;
    if(decisionText) decisionText.textContent=text;
    if(decisionAction) decisionAction.textContent=action;
    if(decisionDot){decisionDot.classList.remove('green','yellow','red');decisionDot.classList.add(mode==='ready'?'green':mode==='error'||mode==='alert'?'red':'yellow');}
  };
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({level,zone,noSymbols,phenomena:[...phenomena],day:new Date().toDateString()}));}catch(_e){}};
  const buildReading=(persist=false)=>{
    if(level===null){
      setDecision('warning','Da leggere','Seleziona il livello che vedi sulla tua zona. I simboli sono facoltativi; l’orario si ricava dal bollettino testuale.','🗺️ Apri mappa');
      return;
    }
    const listed=[...phenomena].map(k=>labels[k]);
    const symbols=listed.length?` Simboli presenti: ${listed.join(', ')}.`:' Nessun simbolo specifico indicato sulla zona.';
    const area=zoneLabels[zone]||'Bassa Romagna';
    if(level==='none') setDecision('ready','Fuori dalle aree colorate',`${area} non risulta compresa nelle aree evidenziate.${symbols} Verifica comunque il bollettino.`, '📝 Leggi bollettino');
    else if(level==='0') setDecision('ready','Livello 0',`${area}: rischio basso di fenomeni severi.${symbols}`, '📝 Leggi bollettino');
    else if(level==='1') setDecision('warning','Livello 1 · attenzione',`${area}: possibili fenomeni localmente intensi.${symbols} Il bollettino chiarisce zone e orari.`, '📝 Leggi bollettino');
    else if(level==='2') setDecision('alert','Livello 2 · monitorare',`${area}: rischio elevato di fenomeni intensi.${symbols} Leggi il bollettino e affianca radar e allerte.`, '📝 Leggi bollettino');
    else setDecision('alert','Livello 3 · alta attenzione',`${area}: scenario potenzialmente molto severo.${symbols} Consulta subito bollettino e allerte ufficiali.`, '🛡️ Apri Allerte ER');
    if(persist) save();
  };
  const paint=()=>{
    levelButtons.forEach(btn=>btn.classList.toggle('selected',btn.dataset.pretempLevel===String(level)));
    phenomenonButtons.forEach(btn=>{
      const key=btn.dataset.pretempPhenomenon;
      btn.classList.toggle('selected',key==='none'?noSymbols:phenomena.has(key));
    });
    zoneButtons.forEach(btn=>btn.classList.toggle('selected',btn.dataset.pretempZone===zone));
    const levelText=level===null?'da compilare':level==='none'?'fuori area':`livello ${level}`;
    if(state) state.textContent=levelText;
    if(selectedLevel) selectedLevel.textContent=level===null?'—':level==='none'?'Fuori area':`L${level}`;
    if(selectedPhenomena) selectedPhenomena.textContent=noSymbols?'nessuno':String(phenomena.size);
    if(selectedZone) selectedZone.textContent=zoneLabels[zone]||'Bassa Romagna';
    apply.disabled=level===null;
    const count=phenomena.size;
    const chosen=[...phenomena].map(k=>labels[k]);
    const levelClass=level===null?'':level==='none'||level==='0'?'ok':level==='1'?'watch':'alert';
    if(drawerState){drawerState.textContent=level===null?'Da compilare':level==='none'?'Fuori area':level==='0'?'L0 · tranquillo':level==='1'?'L1 · attenzione':level==='2'?'L2 · monitorare':'L3 · alta attenzione';drawerState.className=levelClass;}
    if(drawerFocus){drawerFocus.textContent=level===null?'Apri la mappa':count?chosen.slice(0,2).join(' + '):'Nessun simbolo';drawerFocus.className=levelClass;}
    if(drawerContext) drawerContext.textContent=zoneLabels[zone]||'Bassa Romagna';
    if(pretempDot){pretempDot.classList.remove('green','yellow','red');pretempDot.classList.add(level===null||level==='none'||level==='0'?'green':level==='1'?'yellow':'red');}
    Object.entries(phenomenonCards).forEach(([key,card])=>{if(!card)return;const active=phenomena.has(key);card.classList.toggle('is-active',active);const small=card.querySelector('small');if(small)small.textContent=active?'segnalata sulla zona':'non selezionata';});
    buildReading(false);
  };

  levelButtons.forEach(btn=>btn.addEventListener('click',()=>{level=btn.dataset.pretempLevel;paint();}));
  phenomenonButtons.forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.pretempPhenomenon;
    if(key==='none'){noSymbols=!noSymbols;if(noSymbols)phenomena.clear();}
    else{noSymbols=false;phenomena.has(key)?phenomena.delete(key):phenomena.add(key);}
    paint();
  }));
  zoneButtons.forEach(btn=>btn.addEventListener('click',()=>{zone=btn.dataset.pretempZone||'bassa';paint();}));
  apply.addEventListener('click',()=>{buildReading(true);apply.textContent='✓ Lettura salvata';setTimeout(()=>apply.textContent='💾 Salva lettura del giorno',1400);});
  reset?.addEventListener('click',()=>{level=null;zone='bassa';noSymbols=false;phenomena.clear();try{localStorage.removeItem(storageKey);}catch(_e){}paint();});
  decisionAction?.addEventListener('click',()=>{
    const text=decisionAction.textContent||'';
    if(text.includes('Allerte')) document.querySelector('a[href="https://allertameteo.regione.emilia-romagna.it/"]')?.click();
    else if(text.includes('bollettino')) document.getElementById('togglePretempBulletin')?.click();
    else mapButton?.click();
  });
  try{
    let saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(!saved){for(const key of legacyStorageKeys){saved=JSON.parse(localStorage.getItem(key)||'null');if(saved)break;}}
    if(saved&&saved.day===new Date().toDateString()){
      level=saved.level??null;zone=saved.zone==='romagna'?'bassa':(saved.zone||'bassa');noSymbols=!!saved.noSymbols;(saved.phenomena||[]).forEach(k=>phenomena.add(k));
    }
  }catch(_e){}
  paint();
})();;

/* V82 — Centro Analisi a fisarmonica */
(function(){
  const sections=[...document.querySelectorAll('#operativeLinks .accordion-section')];
  function openSection(section, scroll=false){
    sections.forEach(s=>{
      const open=s===section;
      s.classList.toggle('open',open);
      const btn=s.querySelector('.accordion-toggle');
      if(btn){btn.setAttribute('aria-expanded',String(open)); const icon=btn.querySelector(':scope > i'); if(icon) icon.textContent=open?'⌄':'›';}
    });
    if(scroll) setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),60);
  }
  sections.forEach(section=>section.querySelector('.accordion-toggle')?.addEventListener('click',()=>openSection(section,!section.classList.contains('open'))));
  document.querySelectorAll('[data-analysis-jump]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=document.getElementById(btn.dataset.analysisJump);
      const section=target?.classList.contains('accordion-section')?target:target?.closest('.accordion-section');
      if(section) openSection(section,true);
    });
  });
})();


/* RC2 — Compatibilità: selettore radar rimosso dalla Home */
(function initRadarMode(){
  const zoomBtn=document.getElementById('useZoomRadar');
  const liteBtn=document.getElementById('useLiteRadar');
  const zoomPanel=document.getElementById('zoomRadarPanel');
  const litePanel=document.getElementById('liteRadarPanel');
  if(!zoomBtn||!liteBtn||!zoomPanel||!litePanel) return;
  const apply=(mode)=>{
    const zoom=mode!=='lite';
    zoomPanel.classList.toggle('hidden',!zoom);
    litePanel.classList.toggle('hidden',zoom);
    zoomBtn.classList.toggle('active',zoom);
    liteBtn.classList.toggle('active',!zoom);
    try{localStorage.setItem('meteoConteRadarMode',zoom?'zoom':'lite')}catch(_e){}
    if(!zoom) setTimeout(()=>window.dispatchEvent(new Event('resize')),80);
  };
  let saved='zoom';try{saved=localStorage.getItem('meteoConteRadarMode')||'zoom'}catch(_e){}
  apply(saved);
  zoomBtn.addEventListener('click',()=>apply('zoom'));
  liteBtn.addEventListener('click',()=>apply('lite'));
})();

(function updateLiveAge(){
  const el=document.getElementById('radarFrameTime');
  if(!el) return;
  const start=Date.now();
  const paint=()=>{const m=Math.max(0,Math.floor((Date.now()-start)/60000));el.textContent=m<1?'LIVE · aggiornato adesso':`LIVE · aggiornato ${m} min fa`;};
  paint();setInterval(paint,60000);
})();

/* V89 — Mini radar RainViewer nella Home */
(function initHomeRadar(){
  const el=document.getElementById('homeRadarMap');
  if(!el) return;
  const fallback=()=>{
    el.innerHTML='<a class="radar-fallback" href="https://allertameteo.regione.emilia-romagna.it/nowcasting-evoluzione-degli-echi-radar" target="_blank" rel="noopener"><span>📡</span><b>Radar momentaneamente non disponibile</b><small>Apri Radar Evoluzione ER ↗</small></a>';
  };
  if(typeof L==='undefined'){fallback();return;}
  try{
    const map=L.map(el,{center:[44.418,11.977],zoom:7,zoomControl:false,attributionControl:true,dragging:true,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false});
    map.createPane('radarOverlay');map.getPane('radarOverlay').classList.add('radar-overlay-pane');map.getPane('radarOverlay').style.zIndex=420;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,minZoom:5,attribution:'© OpenStreetMap'}).addTo(map);
    L.circleMarker([44.418,11.977],{radius:5,color:'#8af2ff',weight:2,fillColor:'#072b3b',fillOpacity:.9}).bindTooltip('Borgo Viazza',{direction:'top',offset:[0,-5]}).addTo(map);
    fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('radar api');return r.json();})
      .then(data=>{
        const frames=(data.radar&&data.radar.past)||[];
        if(!frames.length) throw new Error('no frames');
        el.querySelector('.radar-loading')?.remove();
        const chosen=frames.slice(-5);let layer=null,index=chosen.length-1;
        const show=(i)=>{
          const frame=chosen[i];
          if(layer) map.removeLayer(layer);
          const host=data.host||'https://tilecache.rainviewer.com';
          layer=L.tileLayer(`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,{pane:'radarOverlay',opacity:.72,maxNativeZoom:7,maxZoom:12,attribution:'Radar © RainViewer'}).addTo(map);
          const stamp=document.getElementById('radarFrameTime');
          if(stamp) stamp.textContent='LIVE · radar '+new Date(frame.time*1000).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
        };
        show(index);
        let timer=setInterval(()=>{index=(index+1)%chosen.length;show(index)},1300);
        document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer)}else{clearInterval(timer);timer=setInterval(()=>{index=(index+1)%chosen.length;show(index)},1300)}});
        setTimeout(()=>map.invalidateSize(),120);
      }).catch(fallback);
  }catch(_e){fallback();}
})();
