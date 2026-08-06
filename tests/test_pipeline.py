import json, os, re, unittest

BBOX = (-160.0, 20.8, -157.0, 22.4)

def load_js_global(path):
    with open(path) as handle:
        src = handle.read()
    m = re.search(r'^const \w+ = (.*);$', src, re.M)
    return json.loads(m.group(1))

class TestCoastline(unittest.TestCase):
    PATH = 'data/geo-coast.js'

    def test_exists_and_small(self):
        self.assertTrue(os.path.exists(self.PATH))
        self.assertLess(os.path.getsize(self.PATH), 80_000)

    def test_is_feature_collection(self):
        fc = load_js_global(self.PATH)
        self.assertEqual(fc['type'], 'FeatureCollection')
        self.assertGreater(len(fc['features']), 0)

    def test_all_coords_within_bbox(self):
        fc = load_js_global(self.PATH)
        def walk(c):
            if isinstance(c[0], (int, float)):
                lon, lat = c[0], c[1]
                self.assertTrue(BBOX[0] - 0.01 <= lon <= BBOX[2] + 0.01, f'lon {lon}')
                self.assertTrue(BBOX[1] - 0.01 <= lat <= BBOX[3] + 0.01, f'lat {lat}')
            else:
                for x in c: walk(x)
        for f in fc['features']:
            walk(f['geometry']['coordinates'])

    def test_oahu_present(self):
        fc = load_js_global(self.PATH)
        names = {f['properties'].get('name') for f in fc['features']}
        self.assertIn('Oahu', names)

class TestBathymetry(unittest.TestCase):
    PATH = 'data/geo-bathy.js'

    def test_exists_and_small(self):
        self.assertLess(os.path.getsize(self.PATH), 140_000)

    def test_three_depth_levels(self):
        fc = load_js_global(self.PATH)
        depths = {f['properties']['depth_m'] for f in fc['features']}
        self.assertEqual(depths, {200, 1000, 3000})

    def test_all_linestrings_have_points(self):
        fc = load_js_global(self.PATH)
        for f in fc['features']:
            self.assertEqual(f['geometry']['type'], 'LineString')
            self.assertGreaterEqual(len(f['geometry']['coordinates']), 4)

class TestStaticGeo(unittest.TestCase):
    def test_assets_include_kaneohe_and_pmrf(self):
        fc = load_js_global('data/geo-assets.js')
        names = {f['properties']['name'] for f in fc['features']}
        self.assertIn('MCB Hawaii Kaneohe Bay', names)
        self.assertIn('PMRF Barking Sands', names)

    def test_bravo_zone_is_labelled_synthetic(self):
        fc = load_js_global('data/geo-zones.js')
        bravo = [f for f in fc['features']
                 if f['properties']['name'] == 'Exercise Area BRAVO']
        self.assertEqual(len(bravo), 1)
        self.assertTrue(bravo[0]['properties']['synthetic'],
                        'synthetic zones must be labelled synthetic')

    def test_cables_are_labelled_synthetic(self):
        fc = load_js_global('data/geo-cables.js')
        for f in fc['features']:
            self.assertTrue(f['properties']['synthetic'])
            self.assertIn('representative', f['properties']['name'].lower())

class TestEnv(unittest.TestCase):
    def test_tides_cover_all_steps(self):
        t = load_js_global('data/env-tides.js')
        self.assertEqual(len(t['series']), 121)
        self.assertEqual(t['station'], '1612340')

    def test_buoy_stations_present(self):
        fc = load_js_global('data/env-buoys.js')
        st = {f['properties']['station'] for f in fc['features']}
        self.assertEqual(st, {'51201', '51202', '51207', '51211'})

    def test_weather_frames_match_grid(self):
        w = load_js_global('data/env-weather.js')
        g = w['grid']
        for frame in w['frames']:
            self.assertEqual(len(frame['wind']), g['nlat'])
            self.assertEqual(len(frame['wind'][0]), g['nlon'])

    def test_weather_frames_span_the_scenario(self):
        """Weather is stored coarsely in time -- it does not change every two
        minutes, and 121 frames cost 348 KB to say almost nothing. What matters
        is that the frames bracket the whole replay so the app never runs off
        the end of the data."""
        w = load_js_global('data/env-weather.js')
        ts = [f['t'] for f in w['frames']]
        self.assertEqual(ts, sorted(ts))
        self.assertEqual(ts[0], 0)
        self.assertGreaterEqual(ts[-1], 110, 'weather must cover the end of the replay')
        self.assertLess(len(ts), 30, 'weather stored too finely; check WEATHER_STRIDE')

    def test_env_files_fit_the_budget(self):
        total = sum(os.path.getsize(p) for p in
                    ['data/env-tides.js', 'data/env-buoys.js', 'data/env-weather.js'])
        self.assertLess(total, 120_000, f'environmental data is {total} bytes')

    def test_synthetic_env_is_flagged(self):
        w = load_js_global('data/env-weather.js')
        self.assertTrue(w.get('synthetic'), 'synthetic weather must say so')

class TestScenario(unittest.TestCase):
    def setUp(self):
        self.s = load_js_global('data/scenario.js')

    def test_meta_shape(self):
        m = self.s['meta']
        self.assertEqual(m['steps'], 121)
        self.assertEqual(m['step_seconds'], 120)
        self.assertEqual(m['bbox'], [-160.0, 20.8, -157.0, 22.4])

    def test_mmsis_unique(self):
        ms = [v['mmsi'] for v in self.s['vessels']]
        self.assertEqual(len(ms), len(set(ms)))

    def test_tracks_valid(self):
        for v in self.s['vessels']:
            self.assertGreater(len(v['track']), 0, v['name'])
            ts = [r[0] for r in v['track']]
            self.assertEqual(ts, sorted(ts), f"{v['name']} track not sorted")
            for t, lat, lon, sog, cog in v['track']:
                self.assertTrue(0 <= t <= 120)
                self.assertTrue(20.8 <= lat <= 22.4, f'{v["name"]} lat {lat}')
                self.assertTrue(-160.0 <= lon <= -157.0, f'{v["name"]} lon {lon}')
                self.assertTrue(0 <= sog <= 40, f'{v["name"]} sog {sog}')
                self.assertTrue(0 <= cog <= 359, f'{v["name"]} cog {cog}')

    def test_reproducible(self):
        """Regenerating must produce byte-identical output."""
        import subprocess, hashlib
        with open('data/scenario.js','rb') as handle:
            before = hashlib.sha256(handle.read()).hexdigest()
        subprocess.run(['python3','tools/gen_scenario.py'], check=True,
                       capture_output=True)
        with open('data/scenario.js','rb') as handle:
            after = hashlib.sha256(handle.read()).hexdigest()
        self.assertEqual(before, after, 'scenario generation is not deterministic')

ANOMALY_MMSIS = {}  # filled from the generator's constants at import time

class TestAnomalies(unittest.TestCase):
    def setUp(self):
        self.s = load_js_global('data/scenario.js')
        self.by_name = {v['name']: v for v in self.s['vessels']}

    def test_forty_vessels(self):
        self.assertEqual(len(self.s['vessels']), 40)

    def test_no_synthetic_flag_leaks_into_data(self):
        with open('data/scenario.js') as handle:
            src = handle.read()
        for word in ['synthetic', 'anomal', 'suspicious', 'ANSWER']:
            self.assertNotIn(word, src.lower(),
                             f'"{word}" in scenario.js gives away the exercise')

    def test_loiterer_holds_low_speed_long_enough(self):
        v = self.by_name['MV KAIMANA HOU']
        slow = [r for r in v['track'] if 34 <= r[0] <= 59]
        self.assertEqual(len(slow), 26)
        self.assertTrue(all(r[3] < 3.0 for r in slow))

    def test_gap_vessel_has_missing_rows(self):
        v = self.by_name['MV KOA SPIRIT']
        ts = {r[0] for r in v['track']}
        for t in range(72, 79):
            self.assertNotIn(t, ts, f'row t={t} should be absent')
        self.assertIn(71, ts)
        self.assertIn(79, ts)

    def test_gap_implies_impossible_speed(self):
        import math
        v = self.by_name['MV KOA SPIRIT']
        a = next(r for r in v['track'] if r[0] == 71)
        b = next(r for r in v['track'] if r[0] == 79)
        dlat = (b[1]-a[1]) * 60.0
        dlon = (b[2]-a[2]) * 60.0 * math.cos(math.radians(a[1]))
        nm = math.hypot(dlat, dlon)
        hours = (79-71) * 120 / 3600.0
        self.assertGreater(nm/hours, 25.0, 'gap transit must be implausibly fast')

    def test_rendezvous_pair_closes(self):
        import math
        a = self.by_name['MV HOLO KAI']; b = self.by_name['FV LEHUA STAR']
        pa = {r[0]: r for r in a['track']}; pb = {r[0]: r for r in b['track']}
        seps = []
        for t in range(58, 70):
            ra, rb = pa[t], pb[t]
            dlat = (rb[1]-ra[1]) * 60 * 1852
            dlon = (rb[2]-ra[2]) * 60 * 1852 * math.cos(math.radians(ra[1]))
            seps.append(math.hypot(dlat, dlon))
            self.assertLess(ra[3], 1.5); self.assertLess(rb[3], 1.5)
        self.assertLess(max(seps), 300.0, 'pair must stay within 300 m')

    def test_identity_vessel_mismatches(self):
        v = self.by_name['MV PACIFIC MERIDIAN']
        self.assertEqual(v['flag'], 'PA')
        self.assertTrue(str(v['mmsi']).startswith('477'))
        self.assertGreater(max(r[3] for r in v['track']), 20.0)
        self.assertTrue(any(a['field'] == 'destination' for a in v['amendments']))


if __name__ == '__main__':
    unittest.main()
