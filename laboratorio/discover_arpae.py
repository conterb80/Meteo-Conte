"""Read official ARPAE open data once; report candidate stations, not validated observations."""
import json
import math
import urllib.request
from pathlib import Path
from datetime import datetime, timezone
URL = "https://dati-simc.arpae.it/opendata/osservati/meteo/realtime/realtime.jsonl"
LAT, LON = 44.418, 11.977
def distance(lat, lon):
    return 6371 * 2 * math.asin(math.sqrt(math.sin(math.radians(lat-LAT)/2)**2 + math.cos(math.radians(lat))*math.cos(math.radians(LAT))*math.sin(math.radians(lon-LON)/2)**2))
stations = {}
sample = None
count = 0
with urllib.request.urlopen(URL, timeout=60) as response:
    for line in response:
        if not line.strip():
            continue
        row = json.loads(line)
        count += 1
        if sample is None:
            sample = row
        # DB-All.e JSON uses scaled integer coordinates; accept decimal degrees too.
        location = row.get("station", row)
        if not isinstance(location,dict):
            continue
        lat, lon = location.get("lat"), location.get("lon")
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):
            continue
        if abs(lat)>90 or abs(lon)>180:
            lat,lon=lat/100000,lon/100000
        if not (-90<=lat<=90 and -180<=lon<=180):
            continue
        km=distance(lat,lon)
        if km>25:
            continue
        key=str((location.get("ident"),lat,lon,location.get("report")))
        item=stations.setdefault(key,dict(latitude=lat,longitude=lon,distance_km=round(km,2),records=0,example=row))
        item["records"]+=1
report=dict(source="ARPAE Emilia-Romagna – Meteo dati osservati",url=URL,license="Creative Commons Attribution",retrieved_at=datetime.now(timezone.utc).isoformat(),records_scanned=count,first_record=sample,candidates=sorted(stations.values(),key=lambda x:x["distance_km"]),status="schema discovery only; station identity, units and intervals require verification")
Path("laboratorio/arpae_discovery.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print("records",count,"candidates",len(stations))
assert stations, "No candidate stations: inspect schema"
