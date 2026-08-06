// ==========================================================================
// GEO — the small amount of spherical trigonometry this app needs.
//
// You will use these when you write your detectors. They are deliberately
// plain: no library, no classes, just functions that take numbers and return
// numbers. Read them. None of it is more complicated than it looks.
// ==========================================================================

const EARTH_NM = 3440.065;   // mean earth radius in nautical miles
const M_PER_NM = 1852;

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

// Great-circle distance between two positions, in nautical miles.
// One nautical mile is one minute of latitude, which is why it is the unit
// every mariner actually uses.
function haversineNm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Same thing in metres, for when you care about hundreds of metres rather
// than miles — for example, how close two vessels actually got.
function haversineM(lat1, lon1, lat2, lon2) {
  return haversineNm(lat1, lon1, lat2, lon2) * M_PER_NM;
}

// Initial bearing from point 1 to point 2, in degrees true (0..359).
function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Smallest angle between two headings, 0..180. Useful for turn rates:
// a 350 -> 10 turn is 20 degrees, not 340.
function headingDelta(a, b) {
  const d = Math.abs(((b - a) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// Is a point inside a polygon ring? Standard ray casting.
// `ring` is a GeoJSON coordinate ring: an array of [lon, lat] pairs.
function pointInPolygon(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const straddles = (yi > lat) !== (yj > lat);
    if (straddles && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Do two line segments cross? Used to tell whether a vessel's track passed
// through a zone even when we never saw a position report inside it.
function segmentsIntersect(p1, p2, p3, p4) {
  function orient(a, b, c) {
    const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    return v === 0 ? 0 : (v > 0 ? 1 : 2);
  }
  function onSeg(a, b, c) {
    return b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0]) &&
           b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
  }
  const o1 = orient(p1, p2, p3), o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1), o4 = orient(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(p1, p3, p2)) return true;
  if (o2 === 0 && onSeg(p1, p4, p2)) return true;
  if (o3 === 0 && onSeg(p3, p1, p4)) return true;
  if (o4 === 0 && onSeg(p3, p2, p4)) return true;
  return false;
}

// Does the straight line from A to B enter a polygon at any point?
// True if either end is inside, or if the line crosses any edge.
// A and B are [lat, lon]; `ring` is GeoJSON [lon, lat].
function segmentIntersectsPolygon(a, b, ring) {
  if (pointInPolygon(a[0], a[1], ring)) return true;
  if (pointInPolygon(b[0], b[1], ring)) return true;
  const p1 = [a[1], a[0]], p2 = [b[1], b[0]];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (segmentsIntersect(p1, p2, ring[j], ring[i])) return true;
  }
  return false;
}

// Every polygon ring in a GeoJSON FeatureCollection, flattened, keeping the
// feature's properties alongside so you know which zone you matched.
function polygonRings(featureCollection) {
  const out = [];
  for (const f of (featureCollection.features || [])) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      out.push({ ring: g.coordinates[0], props: f.properties || {} });
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) out.push({ ring: poly[0], props: f.properties || {} });
    }
  }
  return out;
}

const GEO = {
  haversineNm, haversineM, bearingDeg, headingDelta,
  pointInPolygon, segmentsIntersect, segmentIntersectsPolygon, polygonRings,
  M_PER_NM,
};
