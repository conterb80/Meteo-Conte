const updated = document.getElementById('updated');
function setTime(){
  const d = new Date();
  updated.textContent = 'agg. ' + d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
}
setTime();
document.getElementById('refreshBtn').addEventListener('click', setTime);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
