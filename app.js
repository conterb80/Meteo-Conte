const VERSION = 'v7-centrale-20260703';
const LAT = 44.456;
const LON = 11.978;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_gusts_10m&forecast_days=1&timezone=Europe%2FRome`;
const $ = (id)=>document.getElementById(id);
const weatherText = {0:'Sereno',1:'Prevalentemente sereno',2:'Poco nuvoloso',3:'Nuvoloso',45:'Nebbia',48:'Nebbia con brina',51:'Pioviggine debole',53:'Pioviggine',55:'Pioviggine forte',61:'Pioggia debole',63:'Pioggia',65:'Pioggia forte',71:'Neve debole',73:'Neve',75:'Neve forte',80:'Rovesci deboli',81:'Rovesci',82:'Rovesci forti',95:'Temporale',96:'Temporale con grandine',99:'Temporale forte con grandine'};
let lastData = null;
function round(v,d=0){return Number.isFinite(v)?Number(v).toFixed(d):'--'}
function scoreRisk(c,hourly,start){
  const hum = c.relative_humidity_2m ?? 0, wind = c.wind_speed_10m ?? 0, gust = c.wind_gusts_10m ?? 0, press = c.surface_pressure ?? 1015;
  const rain6 = hourly.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  const popMax = Math.max(...hourly.precipitation_probability.slice(start,start+6).map(v=>v||0));
  const thunder = hourly.weather_code.slice(start,start+6).some(code=>[95,96,99].includes(code));
  let score = 0;
  score += Math.min(35, popMax*0.35);
  score += Math.min(22, rain6*7);
  score += hum>75?12:hum>60?6:0;
  score += gust>45?14:gust>30?8:gust>20?4:0;
  score += press<1008?10:press<1012?5:0;
  score += thunder?28:0;
  score += wind<8 && hum>70 && popMax>25?8:0;
  return Math.max(0,Math.min(100,Math.round(score)));
}
function level(score){
  if(score>=72) return {name:'attenzione alta',title:'Alta probabilità di fenomeni',color:'red',text:'Controlla radar, fulmini e bollettini. Possibili fenomeni importanti nelle prossime ore.'};
  if(score>=48) return {name:'attenzione',title:'Situazione da seguire',color:'orange',text:'Ci sono segnali meteo da monitorare. Ricontrolla radar e timeline nelle prossime ore.'};
  if(score>=26) return {name:'da monitorare',title:'Da monitorare',color:'yellow',text:'Qualche segnale presente, ma per ora nessun quadro pesante sulla tua zona.'};
  return {name:'tranquillo',title:'Situazione tranquilla',color:'green',text:'Nessun segnale pesante nelle prossime ore.'};
}
function currentIndex(hourly){
  const nowIso = new Date().toISOString().slice(0,13);
  let i = hourly.time.findIndex(t=>t.slice(0,13)>=nowIso);
  return i<0?0:i;
}
function render(data){
  lastData=data;
  const c=data.current, h=data.hourly, start=currentIndex(h);
  const risk=scoreRisk(c,h,start), lv=level(risk);
  $('tempNow').textContent=round(c.temperature_2m,1);
  $('humidity').textContent=round(c.relative_humidity_2m)+'%';
  $('apparent').textContent=round(c.apparent_temperature,1)+'°';
  $('wind').textContent=round(c.wind_speed_10m)+' km/h';
  $('gust').textContent=round(c.wind_gusts_10m)+' km/h';
  $('pressure').textContent=round(c.surface_pressure)+' hPa';
  const rain6=h.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  $('rain6h').textContent=round(rain6,1)+' mm';
  $('weatherDesc').textContent=`${weatherText[c.weather_code]||'Meteo variabile'} · percepita ${round(c.apparent_temperature,1)}°C`;
  $('conteIndex').textContent=risk; $('conteLevel').textContent=lv.name;
  $('statusTitle').textContent=lv.title; $('statusText').textContent=lv.text;
  $('statusDot').className='dot '+lv.color;
  $('decisionTitle').textContent=risk>=48?'Controlla evoluzione e radar':'Per ora abbastanza tranquilla';
  $('decisionText').textContent=risk>=48?'La situazione merita attenzione: usa radar, fulmini e bollettino regionale per capire se i fenomeni puntano verso Villanova.':'Nessun segnale pesante nelle prossime ore. Ricontrolla se vedi sviluppo nuvole verso Appennino o pianura.';
  renderTimeline(h,start,c); renderHours(h,start);
  $('updatedAt').textContent='Aggiornato '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
}
function renderTimeline(h,start,c){
  const box=$('riskTimeline'); box.innerHTML='';
  [1,2,3,4].forEach(n=>{
    const idx=start+n; const pseudo={...c,relative_humidity_2m:h.relative_humidity_2m[idx]??c.relative_humidity_2m,surface_pressure:h.surface_pressure[idx]??c.surface_pressure,wind_speed_10m:h.wind_speed_10m[idx]??c.wind_speed_10m,wind_gusts_10m:h.wind_gusts_10m[idx]??c.wind_gusts_10m};
    const score=scoreRisk(pseudo,h,idx); const lv=level(score);
    box.insertAdjacentHTML('beforeend',`<div class="risk"><span class="dot ${lv.color}"></span><small>+${n}h</small><strong>${lv.name}</strong></div>`);
  });
}
function renderHours(h,start){
  const box=$('hourCards'); box.innerHTML='';
  for(let i=start;i<Math.min(start+8,h.time.length);i++){
    const hour=new Date(h.time[i]).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    box.insertAdjacentHTML('beforeend',`<div class="hour"><time>${hour}</time><strong>${round(h.temperature_2m[i])}°</strong><small>${round(h.precipitation_probability[i])}% · ${round(h.precipitation[i],1)}mm</small></div>`);
  }
}
function analyze(){
  if(!lastData){return}
  const c=lastData.current,h=lastData.hourly,start=currentIndex(h); const risk=scoreRisk(c,h,start),lv=level(risk);
  const popMax=Math.max(...h.precipitation_probability.slice(start,start+6).map(v=>v||0));
  const rain6=h.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  const parts=[];
  parts.push(`Indice Conte ${risk}/100: ${lv.name}.`);
  parts.push(`Probabilità pioggia massima prossime 6 ore: ${round(popMax)}%, accumulo previsto ${round(rain6,1)} mm.`);
  if((c.relative_humidity_2m||0)>70) parts.push('Umidità alta: aria più carica e da seguire se nascono celle.'); else parts.push('Umidità non alta: energia locale più contenuta.');
  if((c.wind_gusts_10m||0)>30) parts.push('Raffiche presenti: attenzione a eventuali rovesci improvvisi.');
  if((c.surface_pressure||1015)<1012) parts.push('Pressione relativamente bassa: quadro più instabile.'); else parts.push('Pressione buona: nessun segnale pesante da questo dato.');
  parts.push('Per una decisione reale: apri Radar, Fulmini e Allerte se il cielo verso Appennino/Ravenna cambia rapidamente.');
  $('analysisBox').classList.add('filled'); $('analysisBox').textContent=parts.join(' ');
}
async function load(){
  try{const res=await fetch(API,{cache:'no-store'}); if(!res.ok) throw new Error('api'); render(await res.json());}
  catch(e){$('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova tra poco. I link rapidi restano disponibili.'; $('statusDot').className='dot yellow';}
}
$('refreshBtn').addEventListener('click',load); $('analyzeBtn').addEventListener('click',analyze);

// V7 NO CACHE: disattiva service worker e svuota tutte le cache PWA.
(async function disableOldPwaCache(){
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    console.log('Meteo Conte V7 NO CACHE: service worker rimosso e cache svuotate');
  } catch (e) {
    console.warn('Cache reset non completato', e);
  }
})();

load();
