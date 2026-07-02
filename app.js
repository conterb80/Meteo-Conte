const ids = ['direzione','radar','fulmini','vento','grandine','note'];
const $ = id => document.getElementById(id);
let deferredPrompt = null;

function val(id){ return Number($(id)?.value || 0); }
function livello(score){
  if(score >= 8) return ['red','Rischio alto','Alto'];
  if(score >= 6) return ['orange','Situazione da seguire','Medio-alto'];
  if(score >= 3) return ['yellow','Attenzione moderata','Medio'];
  return ['green','Situazione tranquilla','Basso'];
}
function aggiorna(){
  const d=val('direzione'), r=val('radar'), f=val('fulmini'), v=val('vento'), g=val('grandine');
  let score = Math.min(10, Math.round((d*1.5 + r*1.4 + f*1.2 + v*1.2 + g*1.7)));
  const [cls, stato, rischio] = livello(score);
  $('indice').textContent = `${score}/10`;
  const badge = $('statoBadge'); badge.className = `badge ${cls}`; badge.textContent = stato;
  $('lastUpdate').textContent = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  $('temporaleTxt').textContent = d>=2 || f>=2 || r>=2 ? (score>=7?'Alto':'Medio') : 'Basso';
  $('grandineTxt').textContent = g>=2 ? (g===3?'Alta':'Media') : 'Bassa';
  $('ventoTxt').textContent = v>=2 ? (v===3?'Alto':'Medio') : 'Basso';
  $('affidabilitaTxt').textContent = d===0 ? 'Bassa' : (d>=2 && r>=1 ? 'Buona' : 'Media');
  let verdict = 'Nessun segnale importante: tieni solo d\'occhio radar e fulmini se la situazione cambia.';
  let advice = 'Controllo leggero ogni tanto.';
  let auto='Auto ok', orto='Orto ok', laghetto='Laghetto ok', lavoro='Lavoro ok';
  if(score>=3){ verdict='Qualcosa si muove: controlla la traiettoria del nucleo e se i fulmini aumentano.'; advice='Ricontrolla tra 20-30 min.'; lavoro='Occhio se esci fuori'; }
  if(score>=6){ verdict='Temporale possibile sulla zona: prepara oggetti leggeri, auto e controlli esterni.'; advice='Segui live radar e fulmini.'; auto='Meglio lontano da alberi'; orto='Metti via vasi leggeri'; laghetto='Controlla detriti/filtro'; lavoro='Raffiche possibili'; }
  if(score>=8){ verdict='Situazione seria: se la traiettoria è corretta, possibili raffiche forti e grandine. Evita uscite inutili all\'esterno.'; advice='Massima attenzione ora.'; auto='Spostala se puoi'; orto='Ripara il possibile'; laghetto='Controllo dopo evento'; lavoro='Evita esterno se possibile'; }
  if(g>=2 && score>=5){ verdict += ' Segnale grandine da seguire con attenzione.'; auto='Ripara auto se puoi'; }
  if(v>=3){ verdict += ' Aria fresca e raffiche improvvise indicano outflow in arrivo.'; lavoro='Raffiche improvvise'; }
  $('verdetto').textContent=verdict; $('miniAdvice').textContent=advice;
  $('autoTxt').textContent=auto; $('ortoTxt').textContent=orto; $('laghettoTxt').textContent=laghetto; $('lavoroTxt').textContent=lavoro;
  localStorage.setItem('conteMeteoV2', JSON.stringify(Object.fromEntries(ids.map(id=>[id,$(id)?.value||'']))));
}
function carica(){
  try{ const data=JSON.parse(localStorage.getItem('conteMeteoV2')||'{}'); ids.forEach(id=>{ if($(id) && data[id]!==undefined) $(id).value=data[id]; }); }catch(e){}
  aggiorna();
}
ids.forEach(id=>$(id)?.addEventListener('input', aggiorna));
$('saveBtn')?.addEventListener('click',()=>{ aggiorna(); alert('Valutazione salvata'); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt=e; });
$('installBtn')?.addEventListener('click', async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; } else alert('Da Chrome: menu ⋮ → Aggiungi a schermata Home'); });
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }
carica();
