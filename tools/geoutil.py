"""Shared helpers for the PACWATCH data pipeline."""
import json
import os

from shapely.geometry import box, mapping, shape


BBOX = (-160.0, 20.8, -157.0, 22.4)  # west, south, east, north


def write_js_global(path, varname, obj, note=None):
    """Write obj as ``const <varname> = {...};`` plus a Node export shim."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = json.dumps(obj, separators=(",", ":"))
    header = f"// {note}\n" if note else ""
    with open(path, "w") as output:
        output.write(
            f"{header}const {varname} = {body};\n"
            f"if (typeof module !== 'undefined') module.exports = {varname};\n"
        )
    return os.path.getsize(path)


def round_coords(obj, nd=5):
    """Recursively round every float in a GeoJSON coordinate structure."""
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, (list, tuple)):
        return [round_coords(item, nd) for item in obj]
    if isinstance(obj, dict):
        return {key: round_coords(value, nd) for key, value in obj.items()}
    return obj


def clip_to_bbox(geom):
    """Clip a shapely geometry or GeoJSON geometry to the PACWATCH extent."""
    clipped = (shape(geom) if isinstance(geom, dict) else geom).intersection(box(*BBOX))
    return round_coords(mapping(clipped)) if isinstance(geom, dict) else clipped
