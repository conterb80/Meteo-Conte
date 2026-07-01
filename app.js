const fields = ['direzione','radar','fulmini','vento','grandine'];
const note = document.getElementById('note');
const indiceEl = document.getElementById('indice');
const verdettoEl = document.getElementById('verdetto');

function calc(){
  const sum = fields.reduce((t,id)=>t+Number(document.getElementById(id).value),0);
  const score = Math.min(10, Math.round((sum/15)*10));
  indiceEl.textContent = `${score}/10`;
  let text = 'Situazione tranquilla: continua a controllare radar e fulmini ogni tanto.';
  if(score>=3) text = 'Da seguire: possibile peggioramento, controlla movimento del nucleo e fulmini.';
  if(score>=6) text = 'Attenzione: prepara auto/oggetti leggeri, rischio temporale concreto.';
  if(score>=8) text = 'Fase critica: evita esterni se puoi, rischio vento forte/grandine più alto.';
  verdettoEl.textContent = text;
  indiceEl.style.color = score>=8?'var(--bad)':score>=6?'var(--warn)':score>=3?'var(--accent)':'var(--ok)';
}

function save(){
  const data = {};
  fields.forEach(id => data[id] = document.getElementById(id).value);
  data.note = note.value;
  data.updated = new Date().toISOString();
  localStorage.setItem('meteoConteV1', JSON.stringify(data));
  document.getElementById('saveBtn').textContent='Salvato ✓';
  setTimeout(()=>document.getElementById('saveBtn').textContent='Salva',1200);
}

function load(){
  const raw = localStorage.getItem('meteoConteV1');
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    fields.forEach(id => { if(data[id] !== undefined) document.getElementById(id).value = data[id]; });
    note.value = data.note || '';
  }catch(e){}
}

fields.forEach(id => document.getElementById(id).addEventListener('change', calc));
document.getElementById('saveBtn').addEventListener('click', save);
load(); calc();

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
