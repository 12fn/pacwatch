"""Build PACWATCH bathymetric contours from a cached GMRT elevation grid."""
from pathlib import Path
from urllib.request import urlopen

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from shapely.geometry import LineString, mapping

from geoutil import round_coords, write_js_global


URL = ("https://www.gmrt.org/services/GridServer?minlongitude=-160.0&"
       "maxlongitude=-157.0&minlatitude=20.8&maxlatitude=22.4&format=esriascii&"
       "resolution=low&layer=topo")
CACHE = Path("tools/.cache/gmrt.asc")


def download():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE.exists():
        with urlopen(URL, timeout=120) as response:
            CACHE.write_bytes(response.read())


def read_grid():
    with CACHE.open() as source:
        header = {}
        for _ in range(6):
            key, value = source.readline().split()[:2]
            header[key.lower()] = float(value)
    elevation = np.loadtxt(CACHE, skiprows=6)
    elevation = np.ma.masked_equal(elevation, header["nodata_value"])
    elevation = np.flipud(elevation)
    ncols, nrows = int(header["ncols"]), int(header["nrows"])
    cell = header["cellsize"]
    lons = header["xllcorner"] + cell * (np.arange(ncols) + 0.5)
    lats = header["yllcorner"] + cell * (np.arange(nrows) + 0.5)
    return lons, lats, elevation


def main():
    download()
    lons, lats, elevation = read_grid()
    figure, axis = plt.subplots()
    contours = axis.contour(lons, lats, elevation, levels=[-3000, -1000, -200])
    features = []
    for level, segments in zip(contours.levels, contours.allsegs):
        for segment in segments:
            if len(segment) < 4:
                continue
            line = LineString(segment).simplify(0.002, preserve_topology=False)
            if line.length < 0.02 or len(line.coords) < 4:
                continue
            features.append({
                "type": "Feature",
                "properties": {"depth_m": int(abs(level))},
                "geometry": round_coords(mapping(line)),
            })
    plt.close(figure)

    fc = {"type": "FeatureCollection", "features": features}
    output = "data/geo-bathy.js"
    size = write_js_global(
        output,
        "GEO_BATHY",
        fc,
        note="Derived from GMRT (Global Multi-Resolution Topography). Free use.",
    )
    assert size < 140_000, f"{output} is {size} bytes; increase simplify tolerance"
    print(f"{output}: {size} bytes")


if __name__ == "__main__":
    main()
