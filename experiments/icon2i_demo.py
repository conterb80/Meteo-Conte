#!/usr/bin/env python3
"""Isolated ICON-2I precipitation animation experiment; no changes to production app."""
import os,re,json,datetime,urllib.request,urllib.parse,pathlib
from PIL import Image,ImageDraw
import numpy as np
import eccodes
ROOT="https://meteohub.agenziaitaliameteo.it/nwp/ICON-2I_SURFACE_PRESSURE_LEVELS/"
OUT=pathlib.Path("demo-icon2i");OUT.mkdir(exist_ok=True)
def read(url):
 req=urllib.request.Request(url,headers={"User-Agent":"MeteoConte-Technical-Test/1.0"})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
def links(url):
 return re.findall(r'href=["\\\']([^"\\\']+)["\\\']',read(url).decode("utf-8","replace"))
runs=sorted((s.strip("/") for s in links(ROOT) if re.fullmatch(r"20\\d{8}/",s)),reverse=True)
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
frames=[];metadata=[]
# Crop north-central Italy; fit Romagna, Ravenna and surroundings
latmin,latmax,lonmin,lonmax=43.55,45.35,10.75,13.35
with path.open("rb") as f:
 for idx in range(150):
  gid=eccodes.codes_grib_new_from_file(f)
  if gid is None:break
  try:
   def key(k,default=None):
    try:return eccodes.codes_get(gid,k)
    except Exception:return default
   step=key("endStep",key("step",idx))
   vals=np.asarray(eccodes.codes_get_array(gid,"values"),dtype=float)
   lats=np.asarray(eccodes.codes_get_array(gid,"latitudes"),dtype=float)
   lons=np.asarray(eccodes.codes_get_array(gid,"longitudes"),dtype=float)
   mask=(lats>=latmin)&(lats<=latmax)&(lons>=lonmin)&(lons<=lonmax)&np.isfinite(vals)
   if mask.sum()<100:continue
   # render precipitation values as coloured transparent dots on geographic coordinates
   w,h=900,650
   image=Image.new("RGBA",(w,h),(0,0,0,0));px=ImageDraw.Draw(image)
   indexes=np.where(mask)[0]
   # sample at most 70k geographic points per frame for speed
   indexes=indexes[::max(1,len(indexes)//70000)]
   for j in indexes:
    v=max(0,float(vals[j]))
    if v<0.1:continue
    x=int((lons[j]-lonmin)/(lonmax-lonmin)*(w-1))
    y=int((latmax-lats[j])/(latmax-latmin)*(h-1))
    color=(52,180,245,135) if v<1 else (44,218,116,175) if v<5 else (246,206,51,190) if v<15 else (236,80,73,210)
    px.ellipse((x-2,y-2,x+2,y+2),fill=color)
   filename=f"frame-{len(frames):03}.png";image.save(OUT/filename,optimize=True)
   frames.append(filename);metadata.append({"step":str(step),"validityDate":str(key("validityDate","")),"validityTime":str(key("validityTime","")),"points":int(mask.sum()),"max":round(float(np.nanmax(vals[mask])),2)})
   print("frame",len(frames),metadata[-1],flush=True)
   if len(frames)>=12:break
  finally:eccodes.codes_release(gid)
path.unlink()
if len(frames)<2:raise RuntimeError(f"Fotogrammi insufficienti: {len(frames)}")
(OUT/"data.json").write_text(json.dumps({"run":run,"source":url,"frames":frames,"metadata":metadata},indent=2),encoding="utf8")
html="""<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prova Evoluzione ICON-2I</title>
<style>body{margin:0;background:#0d1828;color:#edf5ff;font:16px system-ui}main{max-width:960px;margin:auto;padding:16px}h1{font-size:23px}.map{position:relative;aspect-ratio:900/650;overflow:hidden;background:linear-gradient(135deg,#183449,#153044);border-radius:14px;border:1px solid #41627c}.map img{position:absolute;inset:0;width:100%;height:100%}.label{position:absolute;color:white;text-shadow:0 1px 4px black;font-weight:bold;font-size:13px}.controls{display:flex;gap:10px;align-items:center;margin:16px 0}button{background:#2382bc;color:white;border:0;border-radius:8px;padding:12px 20px}input{flex:1}small{color:#b5c7d9}p{line-height:1.5}</style>
<main><h1>Prova tecnica · Evoluzione ICON-2I</h1><p>Precipitazioni previste dal modello, non radar osservato. Visualizzazione sperimentale: la griglia è georeferenziata, lo sfondo non è una cartografia stradale.</p><div class="map"><img id="layer" alt="Precipitazioni previste"><span class="label" style="left:42%;top:43%">Ravenna</span><span class="label" style="left:21%;top:62%">Bologna</span><span class="label" style="left:54%;top:72%">Rimini</span></div><div class="controls"><button id="play">▶ Play</button><input type="range" id="seek" min="0" value="0"><strong id="time"></strong></div><p id="info"></p><small>Fonte: Agenzia ItaliaMeteo · ICON-2I · TOT_PREC. Dimostrazione isolata, non integrata in Meteo Conte.</small></main>
<script>fetch('data.json').then(r=>r.json()).then(d=>{let i=0,t=null;const im=document.querySelector('#layer'),s=document.querySelector('#seek'),b=document.querySelector('#play');s.max=d.frames.length-1;function show(){im.src=d.frames[i];s.value=i;document.querySelector('#time').textContent='+'+d.metadata[i].step+' h';document.querySelector('#info').textContent='Run '+d.run+' · Fotogramma '+(i+1)+'/'+d.frames.length+' · '+d.metadata[i].validityDate+' '+d.metadata[i].validityTime;}s.oninput=()=>{i=+s.value;show()};b.onclick=()=>{if(t){clearInterval(t);t=null;b.textContent='▶ Play'}else{t=setInterval(()=>{i=(i+1)%d.frames.length;show()},950);b.textContent='⏸ Pausa'}};show()}).catch(e=>document.querySelector('#info').textContent='Errore: '+e);</script></html>"""
(OUT/"index.html").write_text(html,encoding="utf8")
print("SUCCESS: demo-icon2i/index.html with",len(frames),"frames",flush=True)
