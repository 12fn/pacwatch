"""Build PACWATCH tide, buoy, and synthetic weather data."""
import json
import math
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

import numpy as np

from geoutil import BBOX, round_coords, write_js_global


TIDE_URL = ("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?"
            "product=predictions&datum=MLLW&station=1612340&time_zone=lst&"
            "units=metric&interval=h&format=json&begin_date=20250801&end_date=20250802")
TIDE_CACHE = Path("tools/.cache/noaa-tides-1612340-20250801-20250802.json")
STEPS = 121
WEATHER_STRIDE = 10   # one weather frame every 20 minutes

BUOYS = [
    ("51201", "Waimea Bay", 21.671, -158.117),
    ("51202", "Mokapu Point", 21.417, -157.678),
    ("51207", "Kaneohe Bay", 21.477, -157.752),
    ("51211", "Barbers Point", 21.281, -158.124),
]


def fetch_tides():
    TIDE_CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not TIDE_CACHE.exists():
        with urlopen(TIDE_URL, timeout=60) as response:
            TIDE_CACHE.write_bytes(response.read())
    payload = json.loads(TIDE_CACHE.read_text())
    predictions = payload["predictions"]
    times = [datetime.strptime(row["t"], "%Y-%m-%d %H:%M") for row in predictions]
    hours = np.array([(time - times[0]).total_seconds() / 3600 for time in times])
    values = np.array([float(row["v"]) for row in predictions])
    targets = np.arange(STEPS) / 30
    return np.interp(targets, hours, values).tolist(), False


def synthetic_tides():
    return [0.35 * math.sin(2 * math.pi * (step / 30) / 12.42) for step in range(STEPS)]


def tide_data():
    try:
        heights, synthetic = fetch_tides()
    except Exception as error:
        print(f"NOAA tide request failed ({error}); using documented M2 sinusoid")
        heights, synthetic = synthetic_tides(), True
    return {
        "station": "1612340",
        "name": "Honolulu",
        "lat": 21.31,
        "lon": -157.87,
        "series": [[step, round(height, 2)] for step, height in enumerate(heights)],
        "synthetic": synthetic,
    }


def buoy_data():
    features = []
    for index, (station, name, lat, lon) in enumerate(BUOYS):
        series = []
        for step in range(STEPS):
            phase = step / 15 + index * 0.8
            wave = round(1.4 + index * 0.12 + 0.25 * math.sin(phase), 2)
            wind = round(15 + index + 2.5 * math.sin(phase * 0.7), 2)
            direction = round((58 + index * 4 + 5 * math.sin(phase * 0.45)) % 360, 2)
            series.append([step, wave, wind, direction])
        features.append({
            "type": "Feature",
            "properties": {
                "station": station,
                "name": name,
                "wave_height_m": series[0][1],
                "wind_kts": series[0][2],
                "wind_dir": series[0][3],
                "series": series,
                "synthetic": True,
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
        })
    return {"type": "FeatureCollection", "features": features}


def weather_data():
    nlat, nlon = 9, 13
    west, south, east, north = BBOX
    dlat = (north - south) / (nlat - 1)
    dlon = (east - west) / (nlon - 1)
    frames = []
    for step in range(0, STEPS, WEATHER_STRIDE):
        wind_rows, visibility_rows, sea_rows = [], [], []
        patch_lon = 2 + step * (nlon - 5) / (STEPS - 1)
        patch_lat = 4 + 1.5 * math.sin(step / 22)
        for row in range(nlat):
            wind_row, visibility_row, sea_row = [], [], []
            for col in range(nlon):
                speed = 17 + 3 * math.sin(step / 24 + row / 3) + 2 * math.cos(col / 3)
                direction = math.radians(60 + 5 * math.sin(step / 31 + col / 4))
                u = round(-speed * math.sin(direction), 2)
                v = round(-speed * math.cos(direction), 2)
                distance = ((col - patch_lon) ** 2 + (row - patch_lat) ** 2) ** 0.5
                visibility = round(5 + min(15, distance * 4), 2)
                sea_state = round(0.6 + speed * 0.07, 2)
                wind_row.append([u, v])
                visibility_row.append(visibility)
                sea_row.append(sea_state)
            wind_rows.append(wind_row)
            visibility_rows.append(visibility_row)
            sea_rows.append(sea_row)
        frames.append({"t": step, "wind": wind_rows,
                       "vis_km": visibility_rows, "sea_state": sea_rows})
    return {
        "grid": {"lat0": round(south, 5), "lon0": round(west, 5),
                 "dlat": round(dlat, 5), "dlon": round(dlon, 5),
                 "nlat": nlat, "nlon": nlon},
        "frames": frames,
        "synthetic": True,
    }


def main():
    outputs = (
        ("data/env-tides.js", "ENV_TIDES", tide_data(),
         "NOAA CO-OPS Honolulu predictions; synthetic fallback is flagged."),
        ("data/env-buoys.js", "ENV_BUOYS", buoy_data(),
         "NDBC station positions with synthetic scenario-date observations."),
        ("data/env-weather.js", "ENV_WEATHER", weather_data(),
         "Synthetic weather for the PACWATCH replay; not observed conditions."),
    )
    total = 0
    for path, name, value, note in outputs:
        size = write_js_global(path, name, round_coords(value, 2), note=note)
        total += size
        print(f"{path}: {size} bytes")
    assert total < 400_000, f"environment output is {total} bytes; must be under 400000"
    print(f"combined: {total} bytes")


if __name__ == "__main__":
    main()
