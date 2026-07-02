const LAT = 44.414;
const LON = 11.978;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,pressure_msl,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl&forecast_days=2&timezone=Europe%2FRome`;
const $ = id => document.getElementById(id);
const weatherMap = {
  0:['☀️','Sereno'],1:['🌤️','Prevalentemente sereno'],2:['⛅','Poco nuvoloso'],3:['☁️','Nuvoloso'],
  45:['🌫️','Nebbia'],48:['🌫️','Nebbia con brina'],51:['🌦️','Pioviggine debole'],53:['🌦️','Pioviggine'],55:['🌧️','Pioviggine forte'],
  61:['🌧️','Pioggia debole'],63:['🌧️','Pioggia'],65:['🌧️','Pioggia forte'],66:['🌧️','Pioggia gelata'],67:['🌧️','Pioggia gelata forte'],
  71:['🌨️','Neve debole'],73:['🌨️','Neve'],75:['🌨️','Neve forte'],80:['🌦️','Rovesci deboli'],81:['🌧️','Rovesci'],82:['⛈️','Rovesci forti'],
  95:['⛈️','Temporale'],96:['⛈️','Temporale con grandine'],99:['⛈️','Temporale forte con grandine']
};
function codeInfo(c){return weatherMap[c] || ['🌡️','Meteo variabile'];}
function n(v,d=0){return Number.isFinite(v)?v.toFixed(d):'--';}
function hourLabel(s){return new Date(s).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});}
function sum(arr){return arr.reduce((a,b)=>a+(Number(b)||0),0);}
function calcConte(cur, next){
  const rain6 = sum(next.precipitation.slice(0,6));
  const probMax = Math.max(...next.precipitation_probability.slice(0,8).map(x=>x||0));
  const gustMax = Math.max(cur.wind_gusts_10m||0,...next.wind_gusts_10m.slice(0,8).map(x=>x||0));
  const stormCode = next.weather_code.slice(0,8).some(c=>[95,96,99,82].includes(c));
  let score = 100;
  score -= Math.min(38, rain6 * 9);
  score -= Math.min(30, probMax * .28);
  score -= Math.max(0, gustMax - 28) * 1.4;
  if (stormCode) score -= 24;
  score = Math.max(0, Math.min(100, Math.round(score)));
  let text='tranquillo', level='good';
  if(score<35){text='occhio forte';level='bad'} else if(score<65){text='da seguire';level='warn'}
  return {score,text,level,rain6,probMax,gustMax,stormCode};
}
function render(data){
  const cur = data.current;
  const h = data.hourly;
  const now = new Date(cur.time).getTime();
  const idx = h.time.findIndex(t=>new Date(t).getTime()>=now);
  const start = idx>=0?idx:0;
  const next = {
    time:h.time.slice(start,start+12), temperature_2m:h.temperature_2m.slice(start,start+12), precipitation_probability:h.precipitation_probability.slice(start,start+12), precipitation:h.precipitation.slice(start,start+12), weather_code:h.weather_code.slice(start,start+12), wind_gusts_10m:h.wind_gusts_10m.slice(start,start+12)
  };
  const [ico, desc] = codeInfo(cur.weather_code);
  const ci = calcConte(cur,next);
  $('statusCard').classList.remove('loading');
  $('weatherIcon').textContent = ico;
  $('temp').textContent = n(cur.temperature_2m,1);
  $('summary').textContent = `${desc} · percepita ${n(cur.apparent_temperature,1)}°C`;
  $('humidity').textContent = `${n(cur.relative_humidity_2m)}%`;
  $('wind').textContent = `${n(cur.wind_speed_10m)} km/h`;
  $('rain6h').textContent = `${n(ci.rain6,1)} mm`;
  $('pressure').textContent = `${n(cur.pressure_msl)} hPa`;
  $('conteIndex').textContent = ci.score;
  $('conteText').textContent = ci.text;
  const alert = $('alert');
  alert.className = 'alert hidden';
  if(ci.level==='bad') {alert.className='alert bad'; alert.textContent=`⚠️ Attenzione: rischio temporali/rovesci nelle prossime ore. Probabilità max ${n(ci.probMax)}%, raffiche fino a ${n(ci.gustMax)} km/h.`;}
  else if(ci.level==='warn') {alert.className='alert'; alert.textContent=`🟡 Situazione da seguire: possibili piogge o vento. Probabilità pioggia max ${n(ci.probMax)}%.`;}
  if(ci.level==='bad'){$('decisionTitle').textContent='Tieni d’occhio radar e cielo'; $('decisionText').textContent='Situazione potenzialmente movimentata: controlla fulmini/radar prima di organizzarti fuori.';}
  else if(ci.level==='warn'){$('decisionTitle').textContent='Non è brutta, ma va seguita'; $('decisionText').textContent='Possibili rovesci sparsi o vento. Meglio ricontrollare tra un po’.';}
  else {$('decisionTitle').textContent='Per ora abbastanza tranquilla'; $('decisionText').textContent='Nessun segnale pesante nelle prossime ore. App comunque da ricontrollare se vedi sviluppo nuvole.';}
  $('hours').innerHTML = next.time.slice(0,8).map((t,i)=>{const [ic]=codeInfo(next.weather_code[i]);return `<div class="hour"><time>${hourLabel(t)}</time><div class="ico">${ic}</div><strong>${n(next.temperature_2m[i])}°</strong><span>${n(next.precipitation_probability[i])}% · ${n(next.precipitation[i],1)}mm</span></div>`}).join('');
  $('updated').textContent = 'Aggiornato ' + new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
}
async function load(){
  $('summary').textContent = 'Aggiorno dati reali…';
  try{const res=await fetch(API,{cache:'no-store'}); if(!res.ok) throw new Error('HTTP '+res.status); render(await res.json());}
  catch(e){$('statusCard').classList.remove('loading'); $('weatherIcon').textContent='⚠️'; $('summary').textContent='Dati non disponibili. Controlla connessione e riprova.'; $('decisionTitle').textContent='Errore caricamento dati'; $('decisionText').textContent=e.message;}
}
async function clearOldCache(){
  try{ if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs) await r.unregister(); } if('caches' in window){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }}catch(e){}
}
$('refreshBtn').addEventListener('click', load);
clearOldCache().finally(load);
setInterval(load, 10*60*1000);
