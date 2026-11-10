#!/usr/bin/env python3
"""Read-only exploration of public hydrometric data for Lamone V2. No production writes."""
import urllib.request,urllib.parse,json,datetime,os
BASE="https://allertameteo.regione.emilia-romagna.it/o/api/allerta/"
VARIABLE="254,0,0/1,-,-,-/B13215"
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"MeteoConte-LamoneV2-Research/1.0","Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=30) as r:
  data=r.read(6000000);print("HTTP",r.status,"bytes",len(data),"type",r.headers.get("Content-Type"))
 return json.loads(data)
report={"checked_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source":BASE}
try:
 ts=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000)
 q=urllib.parse.urlencode({"variabile":VARIABLE,"time":ts})
 stations=get(BASE+"get-sensor-values?"+q)
 report["response_type"]=type(stations).__name__
 if isinstance(stations,dict):
  report["response_keys"]=list(stations)[:12]
  for k in ("data","items","results","sensori"):
   if isinstance(stations.get(k),list):stations=stations[k];break
 if not isinstance(stations,list):raise ValueError("Station response is not a list")
 report["station_count"]=len(stations)
 names=("marradi","casale","sarna","faenza","reda","pieve cesato","mezzano","modigliana","marzeno","villanova","bagnacavallo")
 matches=[x for x in stations if any(n in str(x.get("nomestaz","")).lower() for n in names)]
 report["matches"]=[{k:v for k,v in x.items() if k in ("nomestaz","idstazione","value","soglia1","soglia2","soglia3")} for x in matches]
 report["match_count"]=len(matches)
 if matches:
  station=matches[0].get("idstazione")
  q=urllib.parse.urlencode({"stazione":station,"variabile":VARIABLE})
  series=get(BASE+"get-time-series/?"+q)
  report["sample_station"]=matches[0].get("nomestaz")
  report["series_type"]=type(series).__name__
  report["series_count"]=len(series) if isinstance(series,list) else None
  if isinstance(series,list):
   report["series_recent"]=series[-4:]
  else:report["series_keys"]=list(series)[:10] if isinstance(series,dict) else []
 report["result"]="success"
except Exception as e:
 report["result"]="failed";report["error"]=repr(e)
print(json.dumps(report,ensure_ascii=False,indent=2))
with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
 f.write("## Lamone V2 — test idrometri ufficiali\n\n```json\n"+json.dumps(report,ensure_ascii=False,indent=2)+"\n```\n")
if report["result"]!="success":raise SystemExit(1)
