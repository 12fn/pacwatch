#!/usr/bin/env python3
"""Build data/geo-coast.js — the land polygons PACWATCH draws the chart from.

Primary source is the OpenStreetMap coastline (ODbL), which is detailed enough
to show Pearl Harbor's lochs and Kaneohe Bay. Those are features the app puts
labels on, so they need to actually exist in the geometry.

Natural Earth 10m (public domain) is the fallback when Overpass is unreachable.
It is far coarser -- the islands come out as recognisable blobs -- but the app
still runs, which matters more than fidelity when a class is about to start.

Usage:  python3 tools/fetch_coastline.py
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

from shapely.geometry import LineString, box, mapping, shape
from shapely.ops import linemerge, polygonize, unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geoutil import BBOX, round_coords, write_js_global  # noqa: E402

CACHE = Path("tools/.cache")
OUT = "data/geo-coast.js"

OVERPASS = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = f"""[out:json][timeout:90];
way["natural"="coastline"]({BBOX[1]},{BBOX[0]},{BBOX[3]},{BBOX[2]});
(._;>;);
out body;
"""

NE_LAND = ("https://raw.githubusercontent.com/martynafford/"
           "natural-earth-geojson/master/10m/physical/ne_10m_land.json")

# Approximate centres, used only to put a name on each polygon.
ISLANDS = [
    ("Oahu", 21.47, -157.98),
    ("Kauai", 22.05, -159.50),
    ("Molokai", 21.13, -157.02),
    ("Lanai", 20.83, -156.92),
    ("Niihau", 21.90, -160.15),
    ("Maui", 20.80, -156.33),
]

SIZE_BUDGET = 80_000
TOLERANCES = [0.00004, 0.00007, 0.0001, 0.00015, 0.00025, 0.0004, 0.0008]
MIN_AREA_DEG2 = 3e-7      # drop specks that are noise at this scale


def cached(name, fetch):
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if not target.exists():
        target.write_bytes(fetch())
    return target.read_bytes()


def fetch_overpass():
    request = urllib.request.Request(
        OVERPASS, data=OVERPASS_QUERY.encode(),
        headers={"User-Agent": "PACWATCH-classroom-build/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def polygons_from_osm():
    """Assemble OSM coastline ways into closed land polygons."""
    doc = json.loads(cached("osm-coastline.json", fetch_overpass))

    nodes = {e["id"]: (e["lon"], e["lat"])
             for e in doc["elements"] if e["type"] == "node"}

    lines = []
    for element in doc["elements"]:
        if element["type"] != "way":
            continue
        coords = [nodes[n] for n in element["nodes"] if n in nodes]
        if len(coords) > 1:
            lines.append(LineString(coords))

    if not lines:
        raise RuntimeError("Overpass returned no coastline ways")

    # Coastline arrives as many partial ways. Merge them end to end, then
    # close the result into polygons.
    merged = linemerge(unary_union(lines))
    polys = list(polygonize(merged if hasattr(merged, "geoms") else [merged]))
    if not polys:
        raise RuntimeError("coastline ways did not close into polygons")
    return polys


def polygons_from_natural_earth():
    raw = cached("ne_10m_land.json",
                 lambda: urllib.request.urlopen(NE_LAND, timeout=180).read())
    clip = box(*BBOX)
    out = []
    for feature in json.loads(raw)["features"]:
        geom = shape(feature["geometry"])
        if not geom.intersects(clip):
            continue
        piece = geom.intersection(clip)
        out.extend(list(piece.geoms) if piece.geom_type == "MultiPolygon" else [piece])
    return out


def name_for(poly):
    point = poly.representative_point()
    best, best_distance = None, 1e9
    for name, lat, lon in ISLANDS:
        distance = (point.y - lat) ** 2 + (point.x - lon) ** 2
        if distance < best_distance:
            best, best_distance = name, distance
    return best if best_distance < 0.35 else None


def build(polys, tolerance):
    clip = box(*BBOX)
    features = []
    for poly in polys:
        if not poly.is_valid:
            poly = poly.buffer(0)
        piece = poly.intersection(clip)
        if piece.is_empty:
            continue
        parts = list(piece.geoms) if piece.geom_type == "MultiPolygon" else [piece]
        for part in parts:
            simple = part.simplify(tolerance, preserve_topology=True)
            if simple.is_empty or simple.area < MIN_AREA_DEG2:
                continue
            features.append({
                "type": "Feature",
                "properties": {},
                "geometry": round_coords(mapping(simple)),
                "_name": name_for(simple),
                "_area": simple.area,
            })

    # Only the largest polygon matching an island keeps that island's name.
    # Otherwise Ford Island, Mokolii and every offshore rock end up labelled
    # "Oahu" and the chart prints the same word six times.
    largest = {}
    for feature in features:
        name = feature["_name"]
        if name and feature["_area"] > largest.get(name, (0, None))[0]:
            largest[name] = (feature["_area"], feature)
    for name, (_, feature) in largest.items():
        feature["properties"]["name"] = name

    for feature in features:
        del feature["_name"], feature["_area"]

    features.sort(key=lambda f: -len(json.dumps(f)))
    return {"type": "FeatureCollection", "features": features}


def main():
    try:
        polys = polygons_from_osm()
        note = ("Coastline from OpenStreetMap contributors (ODbL), "
                "clipped to the PACWATCH extent and simplified.")
        source = "OpenStreetMap"
    except Exception as exc:                                   # noqa: BLE001
        print(f"Overpass unavailable ({exc}); falling back to Natural Earth.")
        polys = polygons_from_natural_earth()
        note = "Coastline from Natural Earth 10m (public domain), simplified."
        source = "Natural Earth 10m"

    # Use the finest simplification that still fits the size budget.
    chosen = fc = None
    for tolerance in TOLERANCES:
        candidate = build(polys, tolerance)
        blob = len(json.dumps(candidate, separators=(",", ":")))
        if blob <= SIZE_BUDGET:
            chosen, fc = tolerance, candidate
            break
    if fc is None:
        raise SystemExit("could not fit the coastline inside the size budget")

    written = write_js_global(OUT, "GEO_COAST", fc, note=note)
    names = [f["properties"].get("name", "?") for f in fc["features"]][:8]
    print(f"source={source} tolerance={chosen} features={len(fc['features'])} "
          f"bytes={written} named={','.join(names)}")
    assert written < SIZE_BUDGET + 4000, f"{OUT} is {written} bytes"


if __name__ == "__main__":
    main()
