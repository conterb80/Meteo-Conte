import datetime as dt
import json
import pathlib
import urllib.request
import urllib.parse

KEYS = "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl".split(",")
params = dict(latitude=44.418, longitude=11.977, hourly=",".join(KEYS), timezone="Europe/Rome", timeformat="unixtime", forecast_days=4)
url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
with urllib.request.urlopen(url, timeout=30) as response:
    data = json.load(response)
now = dt.datetime.now(dt.timezone.utc)
h = data["hourly"]
indices = [i for i,t in enumerate(h["time"]) if t > now.timestamp()][:48]
assert len(indices) == 48, "Incomplete forecast"
rows = [dict(time=h["time"][i], **{k:h[k][i] for k in KEYS}) for i in indices]
assert all(b["time"]-a["time"]==3600 for a,b in zip(rows,rows[1:]))
import math
assert all(type(r[k]) in (int,float) and math.isfinite(r[k]) for r in rows for k in KEYS)
assert all(0<=r["precipitation_probability"]<=100 and r["precipitation"]>=0 and r["wind_gusts_10m"]>=0 for r in rows)
folder = pathlib.Path("laboratorio/storico")
folder.mkdir(parents=True, exist_ok=True)
path = folder / (now.strftime("%Y%m%dT%H%M%S%fZ") + ".json")
with path.open("x") as out:
    json.dump(dict(retrieved_at=now.isoformat(), source=url, model_issue_time=None, units=data.get("hourly_units"), rows=rows),out, separators=(",",":"))
print(path)
