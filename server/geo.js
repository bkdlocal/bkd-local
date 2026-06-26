// Zip-code geocoding + distance for the customer directory radius search.
//
// Converts a US zip to {lat, lng} via api.zippopotam.us (free, no API key),
// with a process-lifetime cache so each unique zip is fetched at most once.
// Successful lookups are cached; failures are not, so a transient API hiccup
// can recover on the next search.

const _cache = new Map(); // zip -> { lat, lng }

async function geocodeZip(zip) {
  const z = String(zip == null ? '' : zip).trim();
  if (!/^\d{5}$/.test(z)) return null;
  if (_cache.has(z)) return _cache.get(z);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.zippopotam.us/us/${z}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null; // 404 = unknown zip; don't cache so it can retry
    const json = await res.json();
    const place = json && Array.isArray(json.places) && json.places[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const point = { lat, lng };
    _cache.set(z, point);
    return point;
  } catch (_) {
    return null; // network error / abort — leave uncached
  }
}

// Great-circle distance between two lat/lng points, in statute miles.
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.7613; // Earth radius, miles
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geocodeZip, haversineMiles };
