const $=id=>document.getElementById(id);
const WMO={0:['Sereno','☀️'],1:['Prevalentemente sereno','🌤️'],2:['Parzialmente nuvoloso','⛅'],3:['Nuvoloso','☁️'],45:['Nebbia','🌫️'],48:['Nebbia','🌫️'],51:['Pioviggine','🌦️'],53:['Pioviggine','🌦️'],55:['Pioviggine','🌦️'],61:['Pioggia','🌧️'],63:['Pioggia','🌧️'],65:['Pioggia forte','🌧️'],80:['Rovescio','🌦️'],81:['Rovescio','🌧️'],82:['Rovescio forte','⛈️'],95:['Temporale','⛈️'],96:['Temporale/grandine','⛈️'],99:['Temporale/grandine','⛈️']};
function dewPoint(t,h){const a=17.27,b=237.7;const alpha=((a*t)/(b+t))+Math.log(Math.max(h,1)/100);return (b*alpha)/(a-alpha)}
function calcIndex(now,hourly){const rainMax=Math.max(...hourly.precipitation_probability.slice(0,6));const rainSum=hourly.precipitation.slice(0,6).reduce((a,b)=>a+b,0);let idx=0;idx+=rainMax*0.45;idx+=Math.min(25,rainSum*10);idx+=now.relative_humidity_2m>75?15:now.relative_humidity_2m>60?8:0;idx+=now.wind_gusts_10m>45?15:now.wind_gusts_10m>30?8:0;idx+=now.pressure_msl<1008?10:0;return Math.round(Math.min(100,idx))}
function level(idx){if(idx>=75)return ['Alta attenzione','rosso','red'];if(idx>=50)return ['Da seguire','arancione','yellow'];if(idx>=25)return ['Da monitorare','giallo','yellow'];return ['Tranquilla','tranquillo','green']}
function setDot(el,c){el.className='dot '+c} function setBig(c){$('statusDot').className='bigdot '+c}
async function load(){
 try{
  await navigator.serviceWorker?.getRegistrations?.().then(rs=>rs.forEach(r=>r.unregister()));
  const url='https://api.open-meteo.com/v1/forecast?latitude=44.418&longitude=11.977&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&timezone=Europe%2FRome&forecast_days=1';
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error('api');
  const data=await res.json(); const c=data.current, h=data.hourly;
  const desc=WMO[c.weather_code]||['Meteo','🌤️']; const idx=calcIndex(c,h); const lv=level(idx);
  const rain6=h.precipitation.slice(0,6).reduce((a,b)=>a+b,0); const rainMax=Math.max(...h.precipitation_probability.slice(0,6));
  $('headerIcon').textContent=desc[1]; $('headerTemp').textContent=Math.round(c.temperature_2m*10)/10+'°';
  $('statusTitle').textContent=lv[0]; $('statusText').textContent=idx<25?'Nessun segnale pesante nelle prossime ore.':idx<50?'Qualche segnale da seguire nelle prossime ore.':'Situazione da controllare con radar e bollettini.'; setBig(lv[2]); setDot($('dotMeteo'),lv[2]); setDot($('dotTemporali'),idx>=40?'yellow':'green');
  $('indiceVal').textContent=idx; $('indiceLabel').textContent=lv[1];
  $('decisionTitle').textContent=idx<25?'Per ora abbastanza tranquilla':idx<50?'Da tenere d’occhio':'Controlla subito radar e allerte';
  $('decisionText').textContent=`Pioggia max 6h ${rainMax}%, raffica max ${Math.round(c.wind_gusts_10m)} km/h. ${idx<25?'Giornata gestibile.':'Serve monitoraggio nelle prossime ore.'}`;
  $('tempNow').textContent=(Math.round(c.temperature_2m*10)/10)+'°C'; $('nowDesc').textContent=`${desc[0]} · ${rainMax}% pioggia max 6h`;
  $('feels').textContent=Math.round(c.apparent_temperature*10)/10+'°'; $('hum').textContent=Math.round(c.relative_humidity_2m)+'%'; $('dew').textContent=Math.round(dewPoint(c.temperature_2m,c.relative_humidity_2m)*10)/10+'°'; $('wind').textContent=Math.round(c.wind_speed_10m)+' km/h'; $('gust').textContent=Math.round(c.wind_gusts_10m)+' km/h'; $('press').textContent=Math.round(c.pressure_msl)+' hPa'; $('rain6').textContent=rain6.toFixed(1)+' mm';
  $('analysisBox').innerHTML=`Indice Conte ${idx}/100: ${lv[1]}. Pioggia max prossime 6 ore ${rainMax}%, accumulo previsto ${rain6.toFixed(1)} mm. Umidità ${c.relative_humidity_2m>65?'presente':'contenuta'}, pressione ${c.pressure_msl<1008?'bassa':'buona'}. Se il cielo cambia, apri Radar ER, Fulmini e controlla eventuali allerte.`;
  renderRisk(h,idx); renderHours(h); $('updated').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch(e){ $('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova. Link rapidi e Lamone restano disponibili.'; setBig('yellow'); $('decisionTitle').textContent='Valuto...'; $('decisionText').textContent='Sintesi in arrivo.'; }
}
function renderRisk(h,base){$('riskTimeline').innerHTML=''; for(let i=1;i<=4;i++){const p=h.precipitation_probability[i]||0;const risk=Math.max(base,p);const c=risk>=50?'yellow':'green'; const text=risk>=50?'attenzione':risk>=25?'monitorare':'tranquillo'; $('riskTimeline').insertAdjacentHTML('beforeend',`<div class="riskitem"><span class="rball ${c}"></span><small>+${i}h</small><b>${text}</b></div>`)} }
function renderHours(h){$('hours').innerHTML=''; const now=new Date(); let start=h.time.findIndex(t=>new Date(t)>now); if(start<0) start=0; h.time.slice(start,start+6).forEach((t,i)=>{const d=new Date(t); const code=h.weather_code[start+i]; const icon=(WMO[code]||['','☀️'])[1]; $('hours').insertAdjacentHTML('beforeend',`<div class="hour"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><b>${Math.round(h.temperature_2m[start+i])}°</b><span>${icon}</span><small>${h.precipitation_probability[start+i]}% · ${h.precipitation[start+i].toFixed(1)}mm</small></div>`)});}
$('analyzeBtn').addEventListener('click',()=>{$('analysisBox').classList.toggle('hidden');}); $('refreshBtn').addEventListener('click',load);
load();
