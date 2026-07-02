const LAT=44.45, LON=11.97;
const els = id => document.getElementById(id);
let lastData=null;
const codeMap={0:'Sereno',1:'Poco nuvoloso',2:'Nuvoloso',3:'Coperto',45:'Nebbia',48:'Nebbia',51:'Pioviggine',53:'Pioviggine',55:'Pioviggine',61:'Pioggia',63:'Pioggia',65:'Pioggia forte',66:'Gelata',67:'Gelata',71:'Neve',73:'Neve',75:'Neve forte',80:'Rovesci',81:'Rovesci',82:'Rovesci forti',95:'Temporale',96:'Temporale con grandine',99:'Temporale forte'};
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function setText(id,v){els(id).textContent=v}
function riskLabel(score){if(score>=78)return ['level-red','🔴 Alta attenzione','Condizioni favorevoli a temporali/rovesci: da seguire.'];if(score>=55)return ['level-orange','🟠 Attenzione','Situazione instabile o in peggioramento.'];if(score>=32)return ['level-yellow','🟡 Da monitorare','Qualche segnale c’è, meglio controllare radar e cielo.'];return ['level-green','🟢 Tranquillo','Situazione al momento abbastanza stabile.']}
function calcScore(c,h,i){let s=0;
  s+=clamp((c.relative_humidity_2m-45)*0.55,0,25);
  s+=clamp((c.wind_gusts_10m||0)*0.7,0,18);
  s+=clamp((1016-(c.surface_pressure||1016))*1.1,0,18);
  s+=clamp((i.precipitation_probability||0)*0.25,0,25);
  s+=clamp((i.rain||0)*10,0,12);
  if([95,96,99].includes(i.weather_code))s+=25; else if([80,81,82,61,63,65].includes(i.weather_code))s+=10;
  return Math.round(clamp(s,0,100));
}
function scorePhrase(score){if(score>=78)return ['Indice alto','Umidità, vento/raffiche, pioggia o segnali temporaleschi danno un quadro da seguire con attenzione.'];if(score>=55)return ['Instabilità possibile','Non è detto che arrivi qualcosa, ma i parametri meritano monitoraggio.'];if(score>=32)return ['Occhio al cielo','Situazione non estrema, però qualche ingrediente può accendersi nelle prossime ore.'];return ['Aria abbastanza stabile','Per ora i parametri non mostrano segnali importanti.']}
function updateUI(data){lastData=data;const c=data.current, h=data.hourly;const nowIndex=0;const i={precipitation_probability:h.precipitation_probability?.[nowIndex]??0,rain:h.rain?.[nowIndex]??0,weather_code:c.weather_code};
  setText('temp',Math.round(c.temperature_2m)+'°');setText('hum',c.relative_humidity_2m+'%');setText('wind',Math.round(c.wind_speed_10m)+' km/h');setText('gust',Math.round(c.wind_gusts_10m||0)+' km/h');setText('press',Math.round(c.surface_pressure||0)+' hPa');setText('rain',(c.rain||0).toFixed(1)+' mm');
  setText('updated','Aggiornato '+new Date(c.time).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' · '+(codeMap[c.weather_code]||'Meteo variabile'));
  const score=calcScore(c,h,i); const [cls,title,text]=riskLabel(score); const alert=els('alertCard'); alert.className='alert '+cls; setText('alertTitle',title); setText('alertText',text);
  const [st,sd]=scorePhrase(score); setText('score',score); setText('scoreTitle',st); setText('scoreText',sd); els('scoreCircle').style.background=`conic-gradient(${score>=78?'var(--red)':score>=55?'var(--orange)':score>=32?'var(--yellow)':'var(--green)'} ${score*3.6}deg,#1d4054 0deg)`;
  buildTimeline(h);
}
function buildTimeline(h){const box=els('timeline');box.innerHTML='';for(let k=0;k<5;k++){const prob=h.precipitation_probability?.[k]??0;const rain=h.rain?.[k]??0;const code=h.weather_code?.[k]??0;let icon='🟢'; if(prob>65||[95,96,99,82].includes(code))icon='🔴';else if(prob>45||rain>1)icon='🟠';else if(prob>25||rain>.1)icon='🟡';const div=document.createElement('div');div.className='timebox';div.innerHTML=`<b>${k===0?'Ora':'+'+k+'h'}</b><span>${icon}</span><small>${prob}%</small>`;box.appendChild(div)}}
function analyze(){if(!lastData)return;const c=lastData.current,h=lastData.hourly;const prob=h.precipitation_probability?.[0]??0;const rain=h.rain?.slice(0,4).reduce((a,b)=>a+(b||0),0);let parts=[];if(c.relative_humidity_2m>=75)parts.push('umidità alta');else parts.push('umidità non estrema');if((c.surface_pressure||1015)<1010)parts.push('pressione bassa');else if((c.surface_pressure||1015)>1018)parts.push('pressione abbastanza alta');if((c.wind_gusts_10m||0)>35)parts.push('raffiche già presenti');if(prob>55)parts.push('probabilità pioggia elevata nelle prossime ore');if([95,96,99].includes(c.weather_code))parts.push('segnale temporalesco già nel dato attuale');let msg='Lettura Conte: '+parts.join(', ')+'. ';if(prob>60||rain>2)msg+='Conviene tenere aperti radar e fulmini: se parte una cella sull’Appennino o entra da ovest, può diventare interessante.';else if(prob>30)msg+='Situazione da monitorare, ma per ora non è un segnale netto di peggioramento immediato.';else msg+='Al momento quadro abbastanza tranquillo; controlla comunque Pretemp/Allerta ER nei giorni instabili.';els('analysisText').textContent=msg}
async function load(){try{setText('alertTitle','Aggiorno i dati...');const url=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,rain,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,rain,weather_code&forecast_days=1&timezone=Europe%2FRome`;const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('meteo non disponibile');updateUI(await res.json())}catch(e){setText('alertTitle','Dati non disponibili');setText('alertText','Controlla connessione o riprova. I link rapidi restano utilizzabili.');}}
els('refreshBtn').addEventListener('click',load);els('analyzeBtn').addEventListener('click',analyze);load();
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js?v=6').catch(()=>{})}
