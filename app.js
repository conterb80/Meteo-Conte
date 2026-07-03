const VERSION = 'v9-ultra-compact-test-20260703';
const LAT = 44.456;
const LON = 11.978;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,is_day,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,dew_point_2m,precipitation_probability,precipitation,weather_code,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_gusts_10m&forecast_days=1&timezone=Europe%2FRome`;
const $ = (id)=>document.getElementById(id);
const weatherText = {0:'Sereno',1:'Prevalentemente sereno',2:'Poco nuvoloso',3:'Nuvoloso',45:'Nebbia',48:'Nebbia con brina',51:'Pioviggine debole',53:'Pioviggine',55:'Pioviggine forte',61:'Pioggia debole',63:'Pioggia',65:'Pioggia forte',71:'Neve debole',73:'Neve',75:'Neve forte',80:'Rovesci deboli',81:'Rovesci',82:'Rovesci forti',95:'Temporale',96:'Temporale con grandine',99:'Temporale forte con grandine'};
const weatherIcon = (code)=> code===0?'☀️': code<=2?'🌤️': code===3?'☁️': [45,48].includes(code)?'🌫️': [95,96,99].includes(code)?'⛈️': [80,81,82,61,63,65].includes(code)?'🌧️':'🌦️';
let lastData = null;
function round(v,d=0){return Number.isFinite(v)?Number(v).toFixed(d):'--'}
function currentIndex(hourly){
  const now = new Date();
  let i = hourly.time.findIndex(t => new Date(t) >= now);
  return i < 0 ? 0 : i;
}
function scoreRisk(c,h,start){
  const hum = c.relative_humidity_2m ?? 0;
  const gust = c.wind_gusts_10m ?? 0;
  const wind = c.wind_speed_10m ?? 0;
  const press = c.surface_pressure ?? 1015;
  const rain6 = h.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  const popMax = Math.max(...h.precipitation_probability.slice(start,start+6).map(v=>v||0));
  const codes = h.weather_code.slice(start,start+6);
  const thunder = codes.some(code=>[95,96,99].includes(code));
  let score = 0;
  score += Math.min(34, popMax * 0.34);
  score += Math.min(22, rain6 * 7);
  score += hum > 78 ? 12 : hum > 65 ? 7 : hum > 55 ? 3 : 0;
  score += gust > 50 ? 14 : gust > 35 ? 9 : gust > 25 ? 4 : 0;
  score += press < 1007 ? 10 : press < 1011 ? 6 : press < 1014 ? 2 : 0;
  score += thunder ? 28 : 0;
  score += wind < 8 && hum > 72 && popMax > 30 ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
function level(score){
  if(score>=72) return {name:'alto',title:'Alta probabilità',color:'red',text:'Controlla subito radar, fulmini e bollettini. Possibili fenomeni importanti nelle prossime ore.'};
  if(score>=48) return {name:'attenzione',title:'Da seguire',color:'orange',text:'Ci sono segnali da monitorare. Tieni aperti radar e fulmini se il cielo cambia.'};
  if(score>=26) return {name:'monitorare',title:'Da monitorare',color:'yellow',text:'Qualche segnale presente, ma per ora nessun quadro pesante su Villanova.'};
  return {name:'tranquillo',title:'Tranquilla',color:'green',text:'Nessun segnale pesante nelle prossime ore.'};
}
function colorBar(score){
  if(score>=72) return 'var(--red)';
  if(score>=48) return 'var(--orange)';
  if(score>=26) return 'var(--yellow)';
  return 'var(--green)';
}
function pressureTrend(h,start,current){
  const prev = h.surface_pressure[Math.max(0,start-3)] ?? current;
  const diff = current - prev;
  if(diff > 1.2) return 'Pressione ↑';
  if(diff < -1.2) return 'Pressione ↓';
  return 'Pressione →';
}
function render(data){
  lastData = data;
  const c = data.current, h = data.hourly, start = currentIndex(h);
  const risk = scoreRisk(c,h,start), lv = level(risk);
  const rain6 = h.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  const popMax = Math.max(...h.precipitation_probability.slice(start,start+6).map(v=>v||0));
  $('tempNow').textContent = round(c.temperature_2m,1);
  $('apparent').textContent = round(c.apparent_temperature,1)+'°';
  $('humidity').textContent = round(c.relative_humidity_2m)+'%';
  $('dewpoint').textContent = round(c.dew_point_2m,1)+'°';
  $('wind').textContent = round(c.wind_speed_10m)+' km/h';
  $('gust').textContent = round(c.wind_gusts_10m)+' km/h';
  $('pressure').textContent = round(c.surface_pressure)+' hPa';
  $('pressureTrend').textContent = pressureTrend(h,start,c.surface_pressure);
  $('rain6h').textContent = round(rain6,1)+' mm';
  $('weatherDesc').textContent = `${weatherText[c.weather_code] || 'Meteo variabile'} · ${round(popMax)}% pioggia max 6h`; if($('topTemp')) $('topTemp').textContent = round(c.temperature_2m,1)+'°'; if($('topIcon')) $('topIcon').textContent = weatherIcon(c.weather_code);
  $('conteIndex').textContent = risk;
  $('conteLevel').textContent = lv.name;
  $('conteWhy').textContent = whyShort(c,h,start,rain6,popMax);
  $('riskBar').style.width = risk + '%';
  $('riskBar').style.background = colorBar(risk);
  $('statusDot').className = 'dot '+lv.color;
  $('statusTitle').textContent = lv.title;
  $('statusText').textContent = lv.text;
  $('opsMeteo').className = 'dot '+lv.color;
  $('opsTemporali').className = 'dot '+(popMax>55 || risk>=48 ? 'orange' : popMax>25 ? 'yellow' : 'green');
  $('decisionTitle').textContent = risk>=48 ? 'Tieni d’occhio evoluzione' : 'Per ora abbastanza tranquilla';
  $('decisionText').textContent = risk>=48 ? 'Apri radar e fulmini: se i nuclei si organizzano verso Appennino/Ravenna la situazione può cambiare.' : 'Giornata gestibile. Ricontrolla se vedi sviluppo nuvole verso Appennino o pianura.';
  renderTimeline(h,start,c);
  renderHours(h,start);
  $('updatedAt').textContent = 'Aggiornato '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
}
function whyShort(c,h,start,rain6,popMax){
  const bits=[];
  if(popMax>50) bits.push('pioggia possibile'); else bits.push('pioggia bassa');
  if((c.relative_humidity_2m||0)>70) bits.push('umidità alta'); else bits.push('umidità bassa');
  if((c.surface_pressure||1015)<1012) bits.push('pressione bassa'); else bits.push('pressione ok');
  if(rain6>5) bits.push('accumuli presenti');
  return bits.join(' · ');
}
function renderTimeline(h,start,c){
  const box = $('riskTimeline'); box.innerHTML = '';
  [1,2,3,4].forEach(n=>{
    const idx = Math.min(start+n, h.time.length-1);
    const pseudo = {...c, relative_humidity_2m:h.relative_humidity_2m[idx]??c.relative_humidity_2m, surface_pressure:h.surface_pressure[idx]??c.surface_pressure, wind_speed_10m:h.wind_speed_10m[idx]??c.wind_speed_10m, wind_gusts_10m:h.wind_gusts_10m[idx]??c.wind_gusts_10m};
    const score = scoreRisk(pseudo,h,idx); const lv = level(score);
    box.insertAdjacentHTML('beforeend',`<div class="risk"><span class="dot ${lv.color}"></span><small>+${n}h</small><strong>${lv.name}</strong></div>`);
  });
}
function renderHours(h,start){
  const box = $('hourCards'); box.innerHTML = '';
  for(let i=start;i<Math.min(start+8,h.time.length);i++){
    const hour = new Date(h.time[i]).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    box.insertAdjacentHTML('beforeend',`<div class="hour"><time>${hour}</time><strong>${round(h.temperature_2m[i])}°</strong><i>${weatherIcon(h.weather_code[i])}</i><small>${round(h.precipitation_probability[i])}% · ${round(h.precipitation[i],1)}mm</small></div>`);
  }
}
function analyze(){
  if(!lastData) return;
  const c = lastData.current, h = lastData.hourly, start = currentIndex(h);
  const risk = scoreRisk(c,h,start), lv = level(risk);
  const popMax = Math.max(...h.precipitation_probability.slice(start,start+6).map(v=>v||0));
  const rain6 = h.precipitation.slice(start,start+6).reduce((a,b)=>a+(b||0),0);
  const parts = [];
  parts.push(`Indice Conte ${risk}/100: ${lv.name}.`);
  parts.push(`Pioggia max prossime 6 ore ${round(popMax)}%, accumulo previsto ${round(rain6,1)} mm.`);
  parts.push((c.relative_humidity_2m||0)>70 ? 'Umidità alta: se nascono celle, possono organizzarsi più facilmente.' : 'Umidità contenuta: energia locale più bassa.');
  parts.push((c.surface_pressure||1015)<1012 ? 'Pressione bassa o in calo: quadro da seguire.' : 'Pressione buona: nessun segnale pesante da questo dato.');
  parts.push('Per decisione reale: se il cielo cambia, apri Radar ER, Fulmini e controlla eventuali allerte. Per il Lamone usa il pulsante dedicato ai sensori.');
  const box = $('analysisBox');
  box.hidden = false;
  box.textContent = parts.join(' ');
  box.scrollIntoView({behavior:'smooth', block:'center'});
}
async function load(){
  try{
    const res = await fetch(API,{cache:'no-store'});
    if(!res.ok) throw new Error('api');
    render(await res.json());
  }catch(e){
    $('statusTitle').textContent = 'Dati non disponibili';
    $('statusText').textContent = 'Controlla connessione o riprova. Link rapidi e Lamone restano disponibili.';
    $('statusDot').className = 'dot yellow';
  }
}
$('refreshBtn').addEventListener('click', load);
$('analyzeBtn').addEventListener('click', analyze);
(async function disableOldPwaCache(){
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    console.log('Meteo Conte V9: sviluppo senza cache pesante');
  }catch(e){console.warn('Reset cache non completato', e)}
})();
load();
