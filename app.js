const updated = document.getElementById('updated');
function setTime(){
  const d = new Date();
  if(updated){
    updated.textContent = 'agg. ' + d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  }
}
setTime();
const refreshBtn = document.getElementById('refreshBtn');
if(refreshBtn){ refreshBtn.addEventListener('click', setTime); }

// V4.1: disattiva la vecchia cache PWA che poteva bloccare gli aggiornamenti.
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
