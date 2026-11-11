#!/usr/bin/env python3
"""Isolated ICON-2I precipitation animation experiment; no changes to production app."""
import os,re,json,datetime,urllib.request,urllib.parse,pathlib
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
import eccodes
ROOT="https://meteohub.agenziaitaliameteo.it/nwp/ICON-2I_SURFACE_PRESSURE_LEVELS/"
OUT=pathlib.Path("demo-icon2i");OUT.mkdir(exist_ok=True)
def read(url):
 req=urllib.request.Request(url,headers={"User-Agent":"MeteoConte-Technical-Test/1.0"})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
def links(url):
 return re.findall(r'href=["\\\']([^"\\\']+)["\\\']',read(url).decode("utf-8","replace"))
runs=sorted((s.strip("/") for s in links(ROOT) if re.fullmatch(r"20\d{8}/",s)),reverse=True)
if not runs:raise RuntimeError("Nessun run ICON-2I disponibile")
run=runs[0];folder=ROOT+run+"/TOT_PREC/"
names=[x for x in links(folder) if x.endswith((".grib",".grib2",".grb"))]
if not names:raise RuntimeError("File TOT_PREC GRIB non trovato")
url=urllib.parse.urljoin(folder,names[0])
print("Downloading",url,flush=True)
data=read(url)
print("Downloaded bytes:",len(data),flush=True)
if not data.startswith(b"GRIB"):raise RuntimeError("Il file non inizia con GRIB")
path=OUT/"precip.grib";path.write_bytes(data)
frames=[];metadata=[];previous=None;previous_step=None;previous_lats=None;previous_lons=None
# Crop north-central Italy; fit Romagna, Ravenna and surroundings
latmin,latmax,lonmin,lonmax=43.55,45.35,10.75,13.35
# Leaflet imageOverlay uses Web Mercator: use the same vertical projection.
def mercator_y(lat):
 rad=np.deg2rad(lat)
 return np.log(np.tan(np.pi/4+rad/2))
y_north=mercator_y(latmax);y_south=mercator_y(latmin)
with path.open("rb") as f:
 for idx in range(150):
  gid=eccodes.codes_grib_new_from_file(f)
  if gid is None:break
  try:
   def key(k,default=None):
    try:return eccodes.codes_get(gid,k)
    except Exception:return default
   step=key("endStep",key("step",idx))
   step_type=str(key("stepType","")).lower()
   if step_type and step_type not in ("accum","accumulation"):
    raise RuntimeError(f"TOT_PREC non cumulativo: stepType={step_type}, step={step}")
   vals=np.asarray(eccodes.codes_get_array(gid,"values"),dtype=float)
   lats=np.asarray(eccodes.codes_get_array(gid,"latitudes"),dtype=float)
   lons=np.asarray(eccodes.codes_get_array(gid,"longitudes"),dtype=float)
   mask=(lats>=latmin)&(lats<=latmax)&(lons>=lonmin)&(lons<=lonmax)&np.isfinite(vals)
   if mask.sum()<100:continue
   # Derive hourly precipitation from consecutive cumulative forecast steps.
   try: step_hours=float(step)
   except (ValueError,TypeError): step_hours=None
   if previous is None or previous_step is None or step_hours is None or step_hours-previous_step!=1:
    previous=vals.copy();previous_step=step_hours;previous_lats=lats.copy();previous_lons=lons.copy()
    print("Skipping initial/discontinuous cumulative step",step,flush=True)
    continue
   if vals.shape!=previous.shape or not np.array_equal(lats,previous_lats) or not np.array_equal(lons,previous_lons):
    raise RuntimeError(f"Griglia ICON-2I cambiata tra i passi {previous_step} e {step}")
   delta=vals-previous
   negative=int(np.count_nonzero((delta < -0.01)&mask))
   if negative:
    raise RuntimeError(f"Accumuli TOT_PREC decrescenti in {negative} punti tra {previous_step} e {step}; differenza oraria non affidabile")
   hourly=np.maximum(delta,0)
   previous=vals.copy();previous_step=step_hours;previous_lats=lats.copy();previous_lons=lons.copy()
   # Render hourly precipitation (mm/1h), not cumulative values
   w,h=900,650
   image=Image.new("RGBA",(w,h),(0,0,0,0));px=ImageDraw.Draw(image)
   indexes=np.where(mask)[0]
   # sample at most 70k geographic points per frame for speed
   indexes=indexes[::max(1,len(indexes)//70000)]
   for j in indexes:
    v=max(0,float(hourly[j]))
    if v<0.1:continue
    x=int((lons[j]-lonmin)/(lonmax-lonmin)*(w-1))
    y=int((y_north-mercator_y(lats[j]))/(y_north-y_south)*(h-1))
    color=(52,180,245,135) if v<1 else (44,218,116,175) if v<5 else (246,206,51,190) if v<15 else (236,80,73,210)
    px.ellipse((x-7,y-7,x+7,y+7),fill=color)
   image=image.filter(ImageFilter.GaussianBlur(radius=3))
   filename=f"frame-{len(frames):03}.png";image.save(OUT/filename,optimize=True)
   frames.append(filename);metadata.append({"step":str(step),"validityDate":str(key("validityDate","")),"validityTime":str(key("validityTime","")),"points":int(mask.sum()),"max":round(float(np.nanmax(hourly[mask])),2),"unit":"mm/1h"})
   print("frame",len(frames),metadata[-1],flush=True)
   if len(frames)>=12:break
  finally:eccodes.codes_release(gid)
path.unlink()
if len(frames)<2:raise RuntimeError(f"Fotogrammi insufficienti: {len(frames)}")
(OUT/"data.json").write_text(json.dumps({"run":run,"source":url,"frames":frames,"metadata":metadata},indent=2),encoding="utf8")
html="""<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meteo Conte · ICON-2I · Demo cartografica</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>body{margin:0;background:#0d1828;color:#edf5ff;font:16px system-ui}main{max-width:960px;margin:auto;padding:14px}h1{font-size:22px;margin:8px 0}p{line-height:1.45;color:#c1d4e4}.map{height:min(68vh,600px);min-height:350px;border-radius:14px;border:1px solid #41627c;overflow:hidden;background:#203d4a}.controls{display:flex;gap:10px;align-items:center;margin:16px 0}button{background:#2382bc;color:white;border:0;border-radius:8px;padding:12px 16px;font-size:16px}input{flex:1;min-width:40px}small{color:#b5c7d9}.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#dceaf6}.swatch{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px}.leaflet-container{background:#183449}</style></head>
<body><main><h1>🌧️ Meteo Conte · Evoluzione ICON-2I</h1><p>Precipitazioni previste sulla cartografia. <b>Non è un radar in tempo reale.</b> Demo sperimentale, separata dall'app.</p>
<div id="map" class="map" aria-label="Mappa delle precipitazioni previste"></div>
<div class="controls"><button id="play" type="button">▶ Play</button><input aria-label="Timeline previsione" type="range" id="seek" min="0" value="0"><strong id="time"></strong></div>
<div class="legend"><span><i class="swatch" style="background:#34b4f5"></i>Debole</span><span><i class="swatch" style="background:#2cda74"></i>Moderata</span><span><i class="swatch" style="background:#f6ce33"></i>Forte</span><span><i class="swatch" style="background:#ec5049"></i>Molto forte</span></div>
<p id="info">Caricamento dati...</p><small>Fonte: Agenzia ItaliaMeteo, modello ICON-2I, TOT_PREC (differenze orarie tra cumulati). I colori rappresentano la pioggia prevista nell’ora precedente (mm/1h), calcolata dalle differenze tra cumulati. Sovrapposizione cartografica sperimentale da verificare. Base © OpenStreetMap contributors.</small></main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const info=document.querySelector('#info');
if(typeof L==='undefined'){info.textContent='Cartografia non caricata: controlla la connessione Internet.'}
else {
const map=L.map('map',{zoomControl:true}).setView([44.42,11.98],8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
const bounds=[[43.55,10.75],[45.35,13.35]];
let overlay=null,idx=0,timer=null;
const slider=document.querySelector('#seek'),button=document.querySelector('#play'),time=document.querySelector('#time');
fetch('data.json').then(r=>{if(!r.ok)throw Error('Dati non disponibili');return r.json()}).then(d=>{
slider.max=d.frames.length-1;
d.frames.forEach(f=>{const im=new Image();im.src=f});
function show(){
 const m=d.metadata[idx],src=d.frames[idx];
 if(overlay)map.removeLayer(overlay);
 overlay=L.imageOverlay(src,bounds,{opacity:.78,interactive:false}).addTo(map);
 slider.value=idx;
 const date=String(m.validityDate),clock=String(m.validityTime).padStart(4,'0');
 const utc=new Date(Date.UTC(+date.slice(0,4),+date.slice(4,6)-1,+date.slice(6,8),+clock.slice(0,2),+clock.slice(2,4)));
 const italian=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(utc);
 time.textContent=italian;
 info.textContent='Previsione '+(idx+1)+' di '+d.frames.length+' · +'+m.step+' ore · run '+d.run+' · pioggia prevista nell’ora precedente (mm/1h)';
}
slider.oninput=()=>{idx=+slider.value;show()};
button.onclick=()=>{if(timer){clearInterval(timer);timer=null;button.textContent='▶ Play'}else{timer=setInterval(()=>{idx=(idx+1)%d.frames.length;show()},1100);button.textContent='⏸ Pausa'}};
show();
}).catch(e=>info.textContent='Errore caricamento: '+e.message);
}
</script></body></html>"""
(OUT/"index.html").write_text(html,encoding="utf8")
print("SUCCESS: demo-icon2i/index.html with",len(frames),"frames",flush=True)
