const els = {
  score: document.getElementById('score'), status: document.getElementById('statusBadge'), verdict: document.getElementById('verdict'), hero: document.getElementById('heroCard'),
  auto: document.getElementById('autoAdvice'), garden: document.getElementById('gardenAdvice'), pond: document.getElementById('pondAdvice'), work: document.getElementById('workAdvice'),
  direction: document.getElementById('direction'), radar: document.getElementById('radar'), lightning: document.getElementById('lightning'), wind: document.getElementById('wind'), water: document.getElementById('water'), save: document.getElementById('saveBtn')
};
const inputs = ['direction','radar','lightning','wind','water'];
function calc(){
  const raw = inputs.reduce((s,k)=>s+Number(els[k].value||0),0);
  const score = Math.min(10, Math.round(raw/2.4));
  els.score.textContent = score;
  els.hero.classList.remove('risk-low','risk-med','risk-high','risk-severe');
  let level='risk-low', badge='🟢 Tranquillo', text='Situazione tranquilla: controlla radar, fulmini e fiumi ogni tanto.';
  if(score>=3){level='risk-med'; badge='🟡 Da seguire'; text='Qualcosa si muove: apri radar/evoluzione e guarda se il nucleo punta davvero verso Ravenna-Lugo.'}
  if(score>=6){level='risk-high'; badge='🟠 Attenzione'; text='Possibile fase temporalesca o pioggia intensa: controlla auto, oggetti leggeri, fiumi e uscite all’aperto.'}
  if(score>=8){level='risk-severe'; badge='🔴 Serio'; text='Situazione da non sottovalutare: rischio vento/grandine/pioggia forte. Meglio evitare esterni e seguire dati ufficiali.'}
  els.hero.classList.add(level); els.status.textContent=badge; els.verdict.textContent=text;
  const water = Number(els.water.value), wind = Number(els.wind.value), radar = Number(els.radar.value), lightning = Number(els.lightning.value);
  els.auto.textContent = (radar>=5 || wind>=4) ? 'meglio ripararla' : score>=6 ? 'valuta riparo' : 'ok fuori';
  els.garden.textContent = (wind>=4 || radar>=5) ? 'metti via leggero' : water>=4 ? 'non irrigare' : 'controllo normale';
  els.pond.textContent = (water>=4) ? 'controlla livello' : (wind>=4 ? 'occhio detriti' : 'tutto ok');
  els.work.textContent = (lightning>=5 || wind>=4) ? 'evita esterni' : score>=6 ? 'prudenza fuori' : 'nessuna urgenza';
  localStorage.setItem('meteoConteV3', JSON.stringify(Object.fromEntries(inputs.map(k=>[k,els[k].value]))));
}
function load(){try{const s=JSON.parse(localStorage.getItem('meteoConteV3')||'{}'); inputs.forEach(k=>{if(s[k]!==undefined) els[k].value=s[k]});}catch(e){} calc();}
inputs.forEach(k=>els[k].addEventListener('change',calc));
els.save.addEventListener('click',()=>{calc(); els.save.textContent='Salvato'; setTimeout(()=>els.save.textContent='Salva',1200)});
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});} load();
