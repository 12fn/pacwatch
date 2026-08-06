"""Generate the deterministic PACWATCH four-hour vessel replay."""
import json
import math
import random
import re

from shapely.geometry import LineString, Point, shape
from shapely.ops import unary_union

from geoutil import BBOX, write_js_global
from vessel_names import NAMES


random.seed(20260805)

STEP_SECONDS = 120
STEPS = 121
INTEREST_MMSIS = {
    "MV KAIMANA HOU": 366880101,
    "MV HOLO KAI": 367880102,
    "MV KOA SPIRIT": 366880103,
    "MV PACIFIC MERIDIAN": 477880104,
}


def load_js_global(path):
    source = open(path).read()
    return json.loads(re.search(r"^const \w+ = (.*);$", source, re.M).group(1))


LAND = unary_union([
    shape(feature["geometry"])
    for feature in load_js_global("data/geo-coast.js")["features"]
])


def haversine_nm(a, b):
    """Distance between (lat, lon) pairs in nautical miles."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 3440.065 * 2 * math.asin(math.sqrt(h))


def bearing(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    y = math.sin(lon2 - lon1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return int(round(math.degrees(math.atan2(y, x)))) % 360


def destination_point(point, course, distance_nm):
    lat, lon = map(math.radians, point)
    brg = math.radians(course)
    angular = distance_nm / 3440.065
    lat2 = math.asin(math.sin(lat) * math.cos(angular) +
                     math.cos(lat) * math.sin(angular) * math.cos(brg))
    lon2 = lon + math.atan2(math.sin(brg) * math.sin(angular) * math.cos(lat),
                            math.cos(angular) - math.sin(lat) * math.sin(lat2))
    return math.degrees(lat2), math.degrees(lon2)


def speed_at(profile, index):
    if callable(profile):
        return float(profile(index))
    if isinstance(profile, (list, tuple)):
        return float(profile[min(index, len(profile) - 1)])
    return float(profile)


def make_track(waypoints, sog_kts, start_t=0, steps=STEPS, jitter=True, lead_nm=0.0):
    """Follow waypoints at speed using great-circle steps and return AIS rows.

    `lead_nm` advances the vessel along its route before recording begins.
    Without it every vessel on a given lane sits on the same start line at
    t=0 and the whole group sweeps across together, which reads as a screen
    full of formation-keeping robots rather than as traffic.
    """
    points = [(float(lat), float(lon)) for lat, lon in waypoints]
    assert len(points) >= 2
    current = points[0]
    target_index = 1
    track = []

    remaining_lead = float(lead_nm)
    while remaining_lead > 0:
        target = points[target_index]
        distance = haversine_nm(current, target)
        if distance > remaining_lead:
            current = destination_point(current, bearing(current, target), remaining_lead)
            remaining_lead = 0
        else:
            current = target
            remaining_lead -= distance
            target_index += 1
            if target_index == len(points):
                points.reverse()
                target_index = 1

    for index in range(steps):
        t = start_t + index
        speed = max(0.0, speed_at(sog_kts, index))
        course = bearing(current, points[target_index])
        out_lat, out_lon = current
        out_speed = speed
        if jitter:
            candidate = (out_lat + random.gauss(0, 0.0002),
                         out_lon + random.gauss(0, 0.0002))
            if not LAND.covers(Point(candidate[1], candidate[0])):
                out_lat, out_lon = candidate
            out_speed = max(0.0, speed + random.uniform(-0.3, 0.3))
        track.append([t, round(out_lat, 5), round(out_lon, 5),
                      round(out_speed, 1), course])

        remaining = speed * STEP_SECONDS / 3600.0
        while remaining > 0:
            target = points[target_index]
            distance = haversine_nm(current, target)
            if distance > remaining:
                current = destination_point(current, bearing(current, target), remaining)
                remaining = 0
            else:
                current = target
                remaining -= distance
                target_index += 1
                if target_index == len(points):
                    points.reverse()
                    target_index = 1
    return track


def vessel(mmsi, name, kind, track, flag="US", length=80, beam=14,
           draft=5.0, destination="HONOLULU", nav="under way using engine", **extra):
    value = {
        "mmsi": mmsi, "name": name, "callsign": f"W{mmsi % 100000:05d}",
        "type": kind, "flag": flag, "length_m": int(length),
        "beam_m": int(beam), "draft_m": round(float(draft), 1),
        "destination": destination, "nav_status": nav, "track": track,
    }
    value.update(extra)
    return value


def generic_route(index, kind):
    """Long offshore routes with type-appropriate variation."""
    if kind in ("cargo", "tanker", "tug"):
        band = 20.86 + (index % 7) * 0.035
        route = [(band, -159.92), (band + 0.05, -158.65), (band + 0.10, -157.35)]
        return route if index % 2 == 0 else list(reversed(route))
    if kind == "passenger":
        base = 21.10 + (index % 4) * 0.025
        return [(base, -158.30), (base - 0.08, -157.80), (base - 0.02, -157.38)]
    if kind == "sailing":
        base = 21.28 + (index % 4) * 0.055
        return [(base, -159.92), (base + 0.08, -159.55), (base - 0.04, -159.12),
                (base + 0.06, -158.72)]
    if kind == "research":
        base = 20.88 + (index % 4) * 0.045
        return [(base, -159.70), (base, -159.15), (base + 0.08, -159.15),
                (base + 0.08, -159.70), (base + 0.16, -159.70),
                (base + 0.16, -159.15)]
    if kind == "fishing":
        base = 21.34 + (index % 6) * 0.055
        return [(base, -159.92), (base + 0.10, -159.68), (base - 0.04, -159.42),
                (base + 0.08, -159.16), (base, -158.88)]
    base = 20.89 + (index % 3) * 0.04
    return [(base, -158.60), (base + 0.08, -158.25), (base, -157.90)]


SPEEDS = {"cargo": 18.0, "tanker": 12.5, "fishing": 5.5, "tug": 9.0,
          "passenger": 15.0, "sailing": 5.5, "research": 6.0, "other": 8.0}
DIMENSIONS = {
    "cargo": (176, 27, 9.2), "tanker": (164, 28, 9.8), "fishing": (25, 7, 3.1),
    "tug": (38, 11, 4.2), "passenger": (48, 12, 2.6), "sailing": (16, 5, 2.2),
    "research": (62, 13, 4.5), "other": (24, 7, 2.5),
}


def rendezvous_track(side):
    center = (21.20, -157.55)
    start = (20.94, -157.20 if side > 0 else -157.90)
    approach = (21.195, center[1] + side * 0.00175)
    track = []
    for t in range(STEPS):
        if t <= 47:
            frac = t / 47
            lat = start[0] + (approach[0] - start[0]) * frac
            lon = start[1] + (approach[1] - start[1]) * frac
            sog = 11.0
            cog = bearing(start, approach)
        elif t <= 58:
            frac = (t - 48) / 10
            lat = approach[0] + (center[0] - approach[0]) * frac
            lon = center[1] + side * (0.00175 - 0.00088 * frac)
            sog = 11.0 - 10.2 * frac
            cog = 0
        elif t <= 69:
            angle = (t - 59) * math.pi / 5
            lat = center[0] + math.sin(angle) * 0.00012
            lon = center[1] + side * 0.00087 + math.cos(angle) * 0.00004
            sog = 0.7 + (t % 3) * 0.1
            cog = (t * 47 + (90 if side > 0 else 270)) % 360
        else:
            frac = (t - 70) / 50
            end = (20.90, -157.18) if side > 0 else (21.06, -158.18)
            origin = (center[0], center[1] + side * 0.00087)
            lat = origin[0] + (end[0] - origin[0]) * frac
            lon = origin[1] + (end[1] - origin[1]) * frac
            sog = 11.0
            cog = bearing(origin, end)
        track.append([t, round(lat, 5), round(lon, 5), round(sog, 1), cog])
    return track


def ordinary_vessels():
    output = []
    serial = 0
    foreign = [(351, "PA"), (538, "MH"), (563, "SG"), (431, "JP"), (440, "KR")]
    for kind in ("cargo", "tanker", "fishing", "tug", "passenger", "sailing", "research", "other"):
        for local_index, name in enumerate(NAMES[kind]):
            serial += 1
            if serial <= len(foreign):
                mid, flag = foreign[serial - 1]
            else:
                mid, flag = (366 if serial % 2 else 367), "US"
            mmsi = mid * 1_000_000 + 410_000 + serial
            if name == "FV LEHUA STAR":
                track = rendezvous_track(-1)
            else:
                profile = SPEEDS[kind]
                if name == "FV MOANA BELLE":
                    profile = lambda t: 2.0 if 34 <= t <= 43 else 5.5
                # Golden-ratio spacing spreads vessels along their lane without
                # any two landing on the same spot. Deterministic, so the
                # scenario stays byte-reproducible.
                lead = ((serial * 0.6180339887) % 1.0) * 95.0
                track = make_track(generic_route(serial, kind), profile,
                                   lead_nm=lead)
            length, beam, draft = DIMENSIONS[kind]
            output.append(vessel(mmsi, name, kind, track, flag=flag,
                                 length=length + local_index, beam=beam, draft=draft,
                                 destination="HONOLULU" if kind not in ("fishing", "research") else "OFFSHORE"))

    # Two fast ordinary contacts pass close at t=40 without slowing. They are
    # here to prove the rendezvous detector discriminates: proximity alone is
    # not a meeting.
    #
    # They pass about 500 m apart, not 30 m. Two ships doing 18 and 12 knots
    # thirty metres apart is not a near-miss, it is a collision, and putting
    # one on the display teaches people to ignore the display.
    crossing = (20.88, -158.45)
    offsets = {"MV ISLAND TRADER": 0.0, "MT BLUE PETREL": 0.0045}   # ~500 m
    for name, course, speed in (("MV ISLAND TRADER", 90, 18.0),
                                ("MT BLUE PETREL", 270, 12.5)):
        origin = (crossing[0] + offsets[name], crossing[1])
        position = destination_point(origin, (course + 180) % 360,
                                     speed * STEP_SECONDS / 3600 * 40)
        track = []
        for t in range(STEPS):
            track.append([t, round(position[0], 5), round(position[1], 5), speed, course])
            position = destination_point(position, course, speed * STEP_SECONDS / 3600)
        next(v for v in output if v["name"] == name)["track"] = track
    return output


def kaimana_hou():
    center = (21.62, -158.30)
    track = []
    for t in range(60):
        if t <= 33:
            start = (21.82, -158.80)
            frac = t / 34
            lat = start[0] + (center[0] - start[0]) * frac
            lon = start[1] + (center[1] - start[1]) * frac
            sog, cog = 14.0, bearing(start, center)
        elif t <= 59:
            angle = (t - 34) * 2 * math.pi / 9
            radius = 0.016 + 0.003 * math.sin((t - 34) * 1.7)
            lat = center[0] + radius * math.sin(angle)
            lon = center[1] + radius * math.cos(angle) / math.cos(math.radians(center[0]))
            sog, cog = 1.2 + ((t - 34) % 8) * 0.2, int(math.degrees(angle)) % 360
        track.append([t, round(lat, 5), round(lon, 5), round(sog, 1), cog])
    track.extend(make_track([(21.62, -158.30), (21.55, -158.38),
                             (21.30, -158.38), (21.12, -158.02)],
                            14.0, start_t=60, steps=61, jitter=False))
    return vessel(INTEREST_MMSIS["MV KAIMANA HOU"], "MV KAIMANA HOU", "cargo", track,
                  length=142, beam=23, draft=8.1)


def holo_kai():
    return vessel(INTEREST_MMSIS["MV HOLO KAI"], "MV HOLO KAI", "cargo",
                  rendezvous_track(1), length=89, beam=15, draft=5.3,
                  destination="KAHULUI")


def koa_spirit():
    # The gap has to imply a speed this hull cannot make -- but only just.
    # An earlier version put the endpoints 25 nm apart, which implied 94 kt.
    # That is not a suspicious vessel, that is an obviously fabricated one, and
    # the first student to do the arithmetic stops believing the scenario.
    # About 31 kt against a declared 13 kt cargo maximum is the right kind of
    # wrong: plainly impossible, entirely plausible as real bad AIS.
    first = make_track([(21.45, -159.96), (21.88, -159.95)], 13.0, steps=72, jitter=False)
    a = [71, 21.88, -159.95, 13.0, 0]
    b = [79, 21.995, -159.868, 13.0, 34]
    first[-1] = a
    tail = make_track([(21.995, -159.868), (22.30, -159.92)], 13.0,
                      start_t=79, steps=42, jitter=False)
    tail[0] = b
    track = first + tail
    hours = (b[0] - a[0]) * STEP_SECONDS / 3600
    required_kts = haversine_nm((a[1], a[2]), (b[1], b[2])) / hours
    bravo = next(f for f in load_js_global("data/geo-zones.js")["features"]
                 if f["properties"]["name"] == "Exercise Area BRAVO")
    segment = LineString([(a[2], a[1]), (b[2], b[1])])
    assert 25.0 < required_kts < 45.0, required_kts
    assert segment.intersects(shape(bravo["geometry"]))
    assert not segment.intersects(LAND)
    return vessel(INTEREST_MMSIS["MV KOA SPIRIT"], "MV KOA SPIRIT", "cargo", track,
                  length=96, beam=17, draft=5.8, destination="NAWILIWILI")


def pacific_meridian():
    position = (20.88, -159.10)
    track = []
    for t in range(STEPS):
        speed = 24.0 if 30 <= t <= 46 else 18.0
        if t <= 41:
            course = 80
        else:
            course = 172 if t == 42 else 100
        track.append([t, round(position[0], 5), round(position[1], 5), speed, course])
        position = destination_point(position, course, speed * STEP_SECONDS / 3600)
    return vessel(INTEREST_MMSIS["MV PACIFIC MERIDIAN"], "MV PACIFIC MERIDIAN", "cargo", track,
                  flag="PA", length=180, beam=28, draft=10.4,
                  amendments=[
                      {"t": 62, "field": "destination", "from": "HONOLULU", "to": "LAHAINA"},
                      {"t": 62, "field": "length_m", "from": 180, "to": 138},
                  ])


def validate(scenario):
    vessels = scenario["vessels"]
    assert len(vessels) == 40
    assert len({v["mmsi"] for v in vessels}) == 40
    ordinary = vessels[:36]
    expected = {"cargo": 7, "tanker": 3, "fishing": 6, "tug": 5,
                "passenger": 4, "sailing": 4, "research": 4, "other": 3}
    assert {kind: sum(v["type"] == kind for v in ordinary) for kind in expected} == expected
    for contact in vessels:
        assert contact["track"]
        assert [r[0] for r in contact["track"]] == sorted(r[0] for r in contact["track"])
        for row in contact["track"]:
            t, lat, lon, sog, cog = row
            assert 0 <= t <= 120 and 20.8 <= lat <= 22.4 and -160 <= lon <= -157
            assert 0 <= sog <= 40 and 0 <= cog <= 359
            assert not LAND.covers(Point(lon, lat)), (contact["name"], row)

    # The hold is spatially compact and wanders through every course quadrant.
    hold = [r for r in next(v for v in vessels if v["name"] == "MV KAIMANA HOU")["track"] if 34 <= r[0] <= 59]
    assert len(hold) == 26 and all(1.1 <= r[3] <= 2.8 for r in hold)
    assert max(haversine_nm((21.62, -158.30), (r[1], r[2])) for r in hold) < 1.4
    assert {r[4] // 90 for r in hold} == {0, 1, 2, 3}

    # The pair remains 150--200 m apart while both are nearly stopped.
    pair = [next(v for v in vessels if v["name"] == name)["track"]
            for name in ("MV HOLO KAI", "FV LEHUA STAR")]
    for t in range(58, 70):
        left, right = pair[0][t], pair[1][t]
        separation_m = haversine_nm((left[1], left[2]), (right[1], right[2])) * 1852
        assert separation_m < 300 and left[3] < 1.5 and right[3] < 1.5


def main():
    scenario = {
        "meta": {
            "name": "PACWATCH Replay — Oahu / Kauai",
            "bbox": list(BBOX), "start_epoch": 1754402400,
            "step_seconds": STEP_SECONDS, "steps": STEPS,
            "tz_offset_hours": -10,
            "provenance": "Traffic patterns derived from public-domain Marine Cadastre AIS.",
        },
        "vessels": ordinary_vessels() + [kaimana_hou(), holo_kai(), koa_spirit(), pacific_meridian()],
    }
    validate(scenario)
    size = write_js_global("data/scenario.js", "SCENARIO", scenario)
    assert size < 250_000, f"data/scenario.js is too large: {size} bytes"
    print(f"data/scenario.js: {size} bytes, {len(scenario['vessels'])} vessels")


if __name__ == "__main__":
    main()
