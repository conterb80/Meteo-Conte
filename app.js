const $ = (id) => document.getElementById(id);
const LAT = 44.42;
const LON = 11.97;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,surface_pressure&daily=precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=Europe%2FRome&forecast_days=2`;

const WMO = {
  0:['☀️','Sereno'],1:['🌤️','Prevalentemente sereno'],2:['⛅','Poco nuvoloso'],3:['☁️','Nuvoloso'],
  45:['🌫️','Nebbia'],48:['🌫️','Nebbia con brina'],51:['🌦️','Pioviggine leggera'],53:['🌦️','Pioviggine'],55:['🌧️','Pioviggine intensa'],
  61:['🌧️','Pioggia debole'],63:['🌧️','Pioggia'],65:['🌧️','Pioggia forte'],66:['🌧️','Pioggia gelata'],67:['🌧️','Pioggia gelata forte'],
  71:['🌨️','Neve debole'],73:['🌨️','Neve'],75:['🌨️','Neve forte'],77:['🌨️','Nevischio'],
  80:['🌦️','Rovesci deboli'],81:['🌧️','Rovesci'],82:['⛈️','Rovesci forti'],
  85:['🌨️','Rovesci nevosi'],86:['🌨️','Rovesci nevosi forti'],95:['⛈️','Temporale'],96:['⛈️','Temporale con grandine'],99:['⛈️','Temporale forte con grandine']
};

function fmt(n, d=0){ return Number.isFinite(n) ? n.toLocaleString('it-IT',{maximumFractionDigits:d,minimumFractionDigits:d}) : '--'; }
function windDir(deg){
  if(!Number.isFinite(deg)) return '';
  const dirs=['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg/45)%8];
}
function hourLabel(iso){ return new Date(iso).toLocaleTimeString('it-IT',{hour:'2-digit'}); }
function setText(id, text){ const el=$(id); if(el) el.textContent=text; }
function setBadge(level, text){
  const b=$('riskBadge'); if(!b) return;
  b.className='badge '+level;
  b.textContent=text;
}
function setDot(id, level){ const el=$(id); if(el) el.className = level; }

function calcRisk(current, hourly, startIndex){
  const next6Rain = hourly.precipitation.slice(startIndex, startIndex+6).reduce((a,b)=>a+(b||0),0);
  const next24Rain = hourly.precipitation.slice(startIndex, startIndex+24).reduce((a,b)=>a+(b||0),0);
  const next6Pop = Math.max(...hourly.precipitation_probability.slice(startIndex,startIndex+6).map(v=>v||0));
  const gustMax = Math.max(current.wind_gusts_10m||0, ...hourly.wind_gusts_10m.slice(startIndex,startIndex+12).map(v=>v||0));
  const stormCode = hourly.weather_code.slice(startIndex,startIndex+12).some(c => [95,96,99].includes(c));
  let score = 0;
  if(next6Pop >= 35) score += 1;
  if(next6Pop >= 60) score += 1;
  if(next6Pop >= 80) score += 1;
  if(next6Rain >= 2) score += 1;
  if(next6Rain >= 8) score += 2;
  if(next24Rain >= 25) score += 2;
  if(gustMax >= 45) score += 1;
  if(gustMax >= 65) score += 1;
  if(stormCode) score += 2;
  if([95,96,99].includes(current.weather_code)) score += 2;
  score = Math.min(10, score);
  return {score,next6Rain,next24Rain,next6Pop,gustMax,stormCode};
}

function applyRisk(r){
  const scoreEl=$('score'); if(scoreEl) scoreEl.innerHTML = `${r.score}<span>/10</span>`;
  const banner=$('alertBanner');
  if(r.score <= 2){
    setBadge('green','🟢 Tranquillo');
    setText('conteText','Situazione tranquilla. Tieni solo d’occhio il radar se vedi nuvole grosse verso ovest/sud-ovest.');
    if(banner) banner.classList.add('hidden');
  } else if(r.score <= 5){
    setBadge('yellow','🟡 Da monitorare');
    setText('conteText','Qualcosa può muoversi: controlla radar, fulmini e traiettoria +1/+2/+3h.');
    if(banner){ banner.className='alert-banner yellow'; banner.textContent='🟡 Occhio Conte: situazione da monitorare nelle prossime ore.'; }
  } else if(r.score <= 7){
    setBadge('orange','🟠 Attenzione');
    setText('conteText','Rischio concreto: verifica radar e fulmini prima di lasciare fuori auto, orto o attrezzi.');
    if(banner){ banner.className='alert-banner orange'; banner.textContent='🟠 Attenzione: possibili rovesci/temporali o raffiche importanti.'; }
  } else {
    setBadge('red','🔴 Allerta Conte');
    setText('conteText','Situazione seria: apri subito radar, allerte regionali e idrometri.');
    if(banner){ banner.className='alert-banner red'; banner.textContent='🔴 Allerta Conte: controlla subito fonti ufficiali, radar e fulmini.'; }
  }
  setText('thunderRisk', r.next6Pop + '%');
  setText('rain6h', fmt(r.next6Rain,1)+' mm');
  setText('gustMax', fmt(r.gustMax,0)+' km/h');
  setText('water6h', fmt(r.next6Rain,1)+' mm');
  setText('water24h', fmt(r.next24Rain,1)+' mm');

  setText('autoDecision', r.score >= 6 || r.gustMax >= 60 ? 'meglio riparata' : r.score >= 3 ? 'valuta radar' : 'ok fuori');
  setText('ortoDecision', r.score >= 6 ? 'metti in sicurezza' : r.score >= 3 ? 'controllo serale' : 'controllo normale');
  setText('pondDecision', r.next24Rain >= 25 ? 'occhio troppo pieno' : r.gustMax >= 55 ? 'controlla foglie' : 'tutto ok');
  setText('workDecision', r.score >= 7 ? 'parti prudente' : r.score >= 4 ? 'controlla prima' : 'nessuna urgenza');
  ['auto','orto','pond','work'].forEach(name=>setDot(name+'Dot', r.score>=6?'red':r.score>=3?'yellow':'green'));
}

function renderForecast(hourly, startIndex){
  const box=$('miniForecast'); if(!box) return;
  box.innerHTML='';
  for(let i=startIndex; i<Math.min(startIndex+8, hourly.time.length); i++){
    const code=hourly.weather_code[i];
    const [ico]=WMO[code] || ['⛅',''];
    const div=document.createElement('div');
    div.innerHTML=`<time>${hourLabel(hourly.time[i])}</time><span>${ico}</span><b>${fmt(hourly.temperature_2m[i],0)}°</b><small>${hourly.precipitation_probability[i] ?? 0}%</small>`;
    box.appendChild(div);
  }
}

async function loadWeather(){
  setText('netState', navigator.onLine ? 'online' : 'offline');
  try{
    const res = await fetch(API + '&_=' + Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error('Meteo non disponibile');
    const data = await res.json();
    const c = data.current;
    const h = data.hourly;
    const code = c.weather_code;
    const [ico,desc] = WMO[code] || ['⛅','Meteo variabile'];
    const now = new Date(c.time).getTime();
    let startIndex = h.time.findIndex(t => new Date(t).getTime() >= now);
    if(startIndex < 0) startIndex = 0;

    $('weatherIcon').textContent = ico;
    $('temp').innerHTML = `${fmt(c.temperature_2m,1)}<span>°C</span>`;
    setText('desc', desc);
    setText('feel', `percepita ${fmt(c.apparent_temperature,0)}°`);
    setText('wind', `💨 ${fmt(c.wind_speed_10m,0)}`);
    setText('windSub', `km/h ${windDir(c.wind_direction_10m)}`);
    setText('humidity', `💧 ${fmt(c.relative_humidity_2m,0)}%`);
    setText('pressure', `📈 ${fmt(c.surface_pressure,0)}`);
    const today = new Date().toISOString().slice(0,10);
    const rainToday = h.time.reduce((sum,t,i)=> t.startsWith(today) ? sum + (h.precipitation[i] || 0) : sum, 0);
    setText('rainToday', `🌧 ${fmt(rainToday,1)}`);
    setText('sourceTime', new Date(c.time).toLocaleString('it-IT',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}));
    setText('updated', 'agg. ' + new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));

    renderForecast(h, startIndex);
    applyRisk(calcRisk(c,h,startIndex));
    localStorage.setItem('meteoConteLast', JSON.stringify({data, saved:Date.now()}));
  } catch(e){
    const cached = localStorage.getItem('meteoConteLast');
    if(cached){
      const old = JSON.parse(cached);
      setText('updated','offline, ultimo dato salvato');
      setText('netState','offline/cache');
      const c=old.data.current, h=old.data.hourly;
      const [ico,desc]=WMO[c.weather_code] || ['⛅','Meteo variabile'];
      $('weatherIcon').textContent=ico;
      $('temp').innerHTML=`${fmt(c.temperature_2m,1)}<span>°C</span>`;
      setText('desc',desc);
      setText('feel',`percepita ${fmt(c.apparent_temperature,0)}°`);
      setText('wind',`💨 ${fmt(c.wind_speed_10m,0)}`);
      setText('windSub',`km/h ${windDir(c.wind_direction_10m)}`);
      setText('humidity',`💧 ${fmt(c.relative_humidity_2m,0)}%`);
      setText('pressure',`📈 ${fmt(c.surface_pressure,0)}`);
      renderForecast(h,0);
      applyRisk(calcRisk(c,h,0));
    } else {
      setBadge('red','🔴 Errore dati');
      setText('desc','Dati meteo non disponibili');
      setText('conteText','Controlla connessione o apri direttamente Radar / Pretemp / Windy.');
    }
  }
}

$('refreshBtn')?.addEventListener('click', loadWeather);
window.addEventListener('online', loadWeather);
window.addEventListener('offline', () => setText('netState','offline'));
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);

// V5 Pro: niente service worker aggressivo. Elimina vecchie cache che bloccavano GitHub Pages.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch(e) {}
  });
}
