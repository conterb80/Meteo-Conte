const timeEl = document.querySelector('.refresh span');
function updateClock(){
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
}
updateClock();
setInterval(updateClock,60000);
document.getElementById('refreshBtn').addEventListener('click',()=>{
  updateClock();
  document.body.animate([{opacity:.75},{opacity:1}],{duration:260});
});
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
