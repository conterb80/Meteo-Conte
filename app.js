const $=id=>document.getElementById(id);
let lastData=null,lastIndex=0,lastLevel=null;
const WMO={0:['Sereno','☀️'],1:['Prevalentemente sereno','🌤️'],2:['Parzialmente nuvoloso','⛅'],3:['Nuvoloso','☁️'],45:['Nebbia','🌫️'],48:['Nebbia','🌫️'],51:['Pioviggine','🌦️'],53:['Pioviggine','🌦️'],55:['Pioviggine','🌦️'],61:['Pioggia','🌧️'],63:['Pioggia','🌧️'],65:['Pioggia forte','🌧️'],80:['Rovescio','🌦️'],81:['Rovescio','🌧️'],82:['Rovescio forte','⛈️'],95:['Temporale','⛈️'],96:['Temporale/grandine','⛈️'],99:['Temporale/grandine','⛈️']};
function dewPoint(t,h){const a=17.27,b=237.7;const alpha=((a*t)/(b+t))+Math.log(Math.max(h,1)/100);return (b*alpha)/(a-alpha)}
function calcIndex(now,hourly){const rainMax=Math.max(...hourly.precipitation_probability.slice(0,6));const rainSum=hourly.precipitation.slice(0,6).reduce((a,b)=>a+b,0);let idx=0;idx+=rainMax*0.45;idx+=Math.min(25,rainSum*10);idx+=now.relative_humidity_2m>75?15:now.relative_humidity_2m>60?8:0;idx+=now.wind_gusts_10m>45?15:now.wind_gusts_10m>30?8:0;idx+=now.pressure_msl<1008?10:0;return Math.round(Math.min(100,idx))}
function level(idx){if(idx>=75)return ['Alta attenzione','rosso','red'];if(idx>=50)return ['Da seguire','arancione','yellow'];if(idx>=25)return ['Da monitorare','giallo','yellow'];return ['Tranquilla','tranquillo','green']}
function setDot(el,c){el.className='dot '+c} function setBig(c){$('statusDot').className='bigdot '+c}
function nextStart(times){const now=new Date(); let start=times.findIndex(t=>new Date(t)>now); return start<0?0:start;}
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
  setBig(lv[2]); setDot($('dotMeteo'),lv[2]); setDot($('dotTemporali'),idx>=40?'yellow':'green'); setDot($('dotLamone'),'green'); setDot($('dotAllerte'),'green');
  $('indiceVal').textContent=idx; $('indiceLabel').textContent=lv[1];
  $('decisionTitle').textContent=idx<25?'Situazione gestibile':idx<50?'Da tenere d’occhio':'Controlla subito';
  $('decisionText').textContent=`Pioggia ${rainMax}% · raffica ${Math.round(c.wind_gusts_10m)} km/h · ${idx<25?'nessun rischio rilevante':'monitora evoluzione'}.`;
  $('tempNow').textContent=(Math.round(c.temperature_2m*10)/10)+'°C'; $('nowDesc').textContent=`${desc[0]} · ${rainMax}% pioggia max 6h`;
  $('feels').textContent=Math.round(c.apparent_temperature*10)/10+'°'; $('hum').textContent=Math.round(c.relative_humidity_2m)+'%'; $('dew').textContent=Math.round(dewPoint(c.temperature_2m,c.relative_humidity_2m)*10)/10+'°'; $('wind').textContent=Math.round(c.wind_speed_10m)+' km/h'; $('gust').textContent=Math.round(c.wind_gusts_10m)+' km/h'; $('press').textContent=Math.round(c.pressure_msl)+' hPa'; $('rain6').textContent=rain6.toFixed(1)+' mm';
  $('analysisBox').innerHTML=`<b>Perché ${idx}/100?</b><br>Pioggia max 6h ${rainMax}%, accumulo ${rain6.toFixed(1)} mm. Umidità ${Math.round(c.relative_humidity_2m)}%, raffica ${Math.round(c.wind_gusts_10m)} km/h, pressione ${Math.round(c.pressure_msl)} hPa. Se cambia il cielo, apri Radar ER, Fulmini e Lamone.`;
  renderRisk(h,idx); renderHours(h); $('updated').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch(e){ $('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova.'; setBig('yellow'); $('decisionTitle').textContent='Valuto...'; $('decisionText').textContent='Sintesi in arrivo.'; setDot($('dotLamone'),'green'); }
}
function renderRisk(h,base){$('riskTimeline').innerHTML=''; for(let i=1;i<=4;i++){const p=h.precipitation_probability[i]||0;const risk=Math.max(base,p);const c=risk>=50?'yellow':'green'; const text=risk>=50?'attenzione':risk>=25?'monitorare':'tranquillo'; $('riskTimeline').insertAdjacentHTML('beforeend',`<div class="riskitem"><span class="rball ${c}"></span><small>+${i}h</small><b>${text}</b></div>`)} }
function renderHours(h){$('hours').innerHTML=''; const start=nextStart(h.time); h.time.slice(start,start+6).forEach((t,i)=>{const k=start+i;const d=new Date(t); const code=h.weather_code[k]; const icon=(WMO[code]||['','☀️'])[1]; $('hours').insertAdjacentHTML('beforeend',`<div class="hour"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><b>${Math.round(h.temperature_2m[k])}°</b><span>${icon}</span><small>${h.precipitation_probability[k]}% · ${h.precipitation[k].toFixed(1)}mm</small></div>`)});}
function openTrend(type){
 if(!lastData) return; const h=lastData.hourly; const start=nextStart(h.time); const box=$('trendBox');
 const labels={temperatura:'Trend temperature',pioggia:'Trend pioggia',vento:'Trend vento e raffiche',pressione:'Trend pressione',umidita:'Umidità e rugiada',indice:'Indice Conte'};
 let rows='', intro='';
 if(type==='indice'){
  intro=`Indice ${lastIndex}/100: ${lastLevel?.[1]||'--'}. Tocca i dati meteo per vedere i trend collegati.`;
  rows=[['Pioggia 6h',$('rain6').textContent],['Vento',$('wind').textContent],['Raffica',$('gust').textContent],['Pressione',$('press').textContent]].map(x=>`<div class="trend-row"><time>${x[0]}</time><div class="bar"><i style="width:25%"></i></div><b>${x[1]}</b></div>`).join('');
 } else {
  const cfg={
   temperatura:['temperature_2m','°','Temperatura prevista nelle prossime ore.'],
   pioggia:['precipitation_probability','%','Probabilità di pioggia oraria.'],
   vento:['wind_gusts_10m',' km/h','Raffica prevista.'],
   pressione:['pressure_msl',' hPa','Pressione prevista nelle prossime ore.'],
   umidita:['relative_humidity_2m','%','Umidità prevista nelle prossime ore.']
  }[type] || ['temperature_2m','°','Trend rapido.'];
  const vals=h[cfg[0]].slice(start,start+6); const min=Math.min(...vals), max=Math.max(...vals); intro=cfg[2];
  rows=vals.map((v,i)=>{const d=new Date(h.time[start+i]); const pct=max===min?50:((v-min)/(max-min))*90+10; const val=(cfg[0]==='pressure_msl'||cfg[0].includes('wind')||cfg[0].includes('humidity')||cfg[0].includes('probability'))?Math.round(v):Math.round(v*10)/10; return `<div class="trend-row"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><div class="bar"><i style="width:${pct}%"></i></div><b>${val}${cfg[1]}</b></div>`}).join('');
 }
 box.innerHTML=`<h2>${labels[type]||'Trend'}</h2><p>${intro}</p><div class="trend-list">${rows}</div>`;
 box.classList.remove('hidden'); box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('analyzeBtn').addEventListener('click',()=>{$('analysisBox').classList.toggle('hidden');}); $('refreshBtn').addEventListener('click',load);
document.querySelectorAll('[data-trend]').forEach(el=>el.addEventListener('click',()=>openTrend(el.dataset.trend)));
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>$(el.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})));
load();
