"""Generate the fixed PACWATCH zones, assets, representative cables, and lanes."""
from shapely.geometry import LineString, Point, Polygon, mapping

from geoutil import round_coords, write_js_global


ASSETS = [
    ("Pearl Harbor", 21.3600, -157.9600, "installation"),
    ("Joint Base Pearl Harbor-Hickam", 21.3320, -157.9460, "installation"),
    ("MCB Hawaii Kaneohe Bay", 21.4450, -157.7530, "installation"),
    ("Honolulu Harbor", 21.3070, -157.8670, "port"),
    ("Barbers Point / Kalaeloa", 21.2990, -158.1230, "port"),
    ("Nawiliwili Harbor", 21.9540, -159.3560, "port"),
    ("PMRF Barking Sands", 22.0230, -159.7850, "installation"),
    ("Kaena Point", 21.5740, -158.2810, "landmark"),
    ("Diamond Head", 21.2620, -157.8050, "landmark"),
    ("Makapuu Point", 21.3100, -157.6490, "landmark"),
]

ZONES = [
    # Sits entirely offshore, west of Kauai. An earlier version reached east to
    # -159.60, which put a third of the "exercise area" on top of the island.
    # Kauai's west coast is around -159.79, so the box stops short of it.
    ("Exercise Area BRAVO", "exercise", True,
     Polygon([(-159.99, 21.82), (-159.82, 21.82), (-159.82, 22.16),
              (-159.99, 22.16), (-159.99, 21.82)])),
    ("Pearl Harbor Restricted Area", "restricted", True,
     Polygon([(-158.01, 21.28), (-157.93, 21.28), (-157.93, 21.36),
              (-158.01, 21.36), (-158.01, 21.28)])),
    ("US EEZ (partial)", "eez", False,
     Polygon([(-160.0, 20.8), (-160.0, 21.02), (-159.55, 20.98),
              (-159.05, 20.92), (-158.55, 20.84), (-158.30, 20.8),
              (-160.0, 20.8)])),
]

CABLES = [
    ("Trans-Pacific Cable (representative)",
     [(-160.0, 21.25), (-159.35, 21.28), (-158.70, 21.22), (-157.95, 21.18), (-157.0, 21.10)]),
    ("Hawaii Inter-Island Cable (representative)",
     [(-159.55, 21.92), (-159.05, 21.72), (-158.55, 21.53), (-157.95, 21.34), (-157.55, 21.27)]),
]

LANES = [
    ("Honolulu Southeast Approach", [(-157.0, 20.82), (-157.35, 21.02), (-157.62, 21.18), (-157.86, 21.30)]),
    ("Kauai Channel Inter-Island Run", [(-159.36, 21.95), (-158.95, 21.76), (-158.55, 21.57), (-158.10, 21.38)]),
    ("Barbers Point Tanker Approach", [(-159.0, 20.85), (-158.62, 21.02), (-158.32, 21.18), (-158.12, 21.30)]),
]


def feature(geometry, properties):
    return {"type": "Feature", "properties": properties,
            "geometry": round_coords(mapping(geometry))}


def collection(features):
    return {"type": "FeatureCollection", "features": features}


def main():
    assets = collection([
        feature(Point(lon, lat), {"name": name, "kind": kind})
        for name, lat, lon, kind in ASSETS
    ])
    zones = collection([
        feature(geom, {"name": name, "kind": kind, "synthetic": synthetic})
        for name, kind, synthetic, geom in ZONES
    ])
    cables = collection([
        feature(LineString(coords), {"name": name, "synthetic": True})
        for name, coords in CABLES
    ])
    lanes = collection([
        feature(LineString(coords), {"name": name}) for name, coords in LANES
    ])

    outputs = (
        ("data/geo-zones.js", "GEO_ZONES", zones),
        ("data/geo-assets.js", "GEO_ASSETS", assets),
        ("data/geo-cables.js", "GEO_CABLES", cables),
        ("data/geo-lanes.js", "GEO_LANES", lanes),
    )
    for path, name, value in outputs:
        size = write_js_global(path, name, value)
        assert size < 20_000, f"{path} is too large: {size} bytes"
        print(f"{path}: {size} bytes")


if __name__ == "__main__":
    main()
