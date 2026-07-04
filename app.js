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
  setBig(lv[2]); setDot($('dotMeteo'),lv[2]); setDot($('dotTemporali'),idx>=40?'yellow':'green'); setDot($('dotLamone'),'green'); setDot($('dotAllerte'),'green'); $('lamoneCorner').className='cornerdot green';
  $('indiceVal').textContent=idx; $('indiceLabel').textContent=lv[1];
  $('decisionTitle').textContent=idx<25?'Situazione gestibile':idx<50?'Da tenere d’occhio':'Controlla subito';
  $('decisionText').textContent=`Pioggia ${rainMax}% · raffica ${Math.round(c.wind_gusts_10m)} km/h · ${idx<25?'nessun rischio rilevante':'monitora evoluzione'}.`;
  $('tempNow').textContent=(Math.round(c.temperature_2m*10)/10)+'°C'; $('nowDesc').textContent=`${desc[0]} · ${rainMax}% pioggia max 6h`;
  $('feels').textContent=Math.round(c.apparent_temperature*10)/10+'°'; $('hum').textContent=Math.round(c.relative_humidity_2m)+'%'; $('dew').textContent=Math.round(dewPoint(c.temperature_2m,c.relative_humidity_2m)*10)/10+'°'; $('wind').textContent=Math.round(c.wind_speed_10m)+' km/h'; $('gust').textContent=Math.round(c.wind_gusts_10m)+' km/h'; $('press').textContent=Math.round(c.pressure_msl)+' hPa'; $('rain6').textContent=rain6.toFixed(1)+' mm';
  $('analysisBox').innerHTML=`<b>Perché ${idx}/100?</b><br>Pioggia max 6h ${rainMax}%, accumulo ${rain6.toFixed(1)} mm. Umidità ${Math.round(c.relative_humidity_2m)}%, raffica ${Math.round(c.wind_gusts_10m)} km/h, pressione ${Math.round(c.pressure_msl)} hPa. Se cambia il cielo, apri Radar ER, Fulmini e Lamone.`;
  renderRisk(h,idx); renderHours(h); $('updated').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }catch(e){ $('statusTitle').textContent='Dati non disponibili'; $('statusText').textContent='Controlla connessione o riprova.'; setBig('yellow'); $('decisionTitle').textContent='Valuto...'; $('decisionText').textContent='Sintesi in arrivo.'; setDot($('dotLamone'),'green'); $('lamoneCorner').className='cornerdot green'; }
}
function renderRisk(h,base){$('riskTimeline').innerHTML=''; for(let i=1;i<=4;i++){const p=h.precipitation_probability[i]||0;const risk=Math.max(base,p);const c=risk>=50?'yellow':'green'; const text=risk>=50?'attenzione':risk>=25?'monitorare':'tranquillo'; $('riskTimeline').insertAdjacentHTML('beforeend',`<div class="riskitem"><span class="rball ${c}"></span><small>+${i}h</small><b>${text}</b></div>`)} }
function renderHours(h){$('hours').innerHTML=''; const start=nextStart(h.time); h.time.slice(start,start+6).forEach((t,i)=>{const k=start+i;const d=new Date(t); const code=h.weather_code[k]; const icon=(WMO[code]||['','☀️'])[1]; $('hours').insertAdjacentHTML('beforeend',`<div class="hour"><time>${d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</time><b>${Math.round(h.temperature_2m[k])}°</b><span>${icon}</span><small>${h.precipitation_probability[k]}% · ${h.precipitation[k].toFixed(1)}mm</small></div>`)});}
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
$('analyzeBtn').addEventListener('click',()=>{$('analysisBox').classList.toggle('hidden');}); $('refreshBtn').addEventListener('click',load);
document.querySelectorAll('[data-trend]').forEach(el=>{
  el.addEventListener('click',()=>openTrend(el.dataset.trend));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrend(el.dataset.trend)}});
});
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>$(el.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})));
load();
