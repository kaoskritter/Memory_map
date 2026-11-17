// "Where our paths crossed": compares the places on two connected Memory Maps. No screen code.
// A place is { id, title, lat, lng, from, to, town }, where from/to are years (to may be null for "since …").
// Two places cross when their years overlap and they are within about 1 km ("same place")
// or about 25 km ("nearby"). Places with no pin count as nearby when the town names match.

export const SAME_KM = 1;
export const NEAR_KM = 25;

export function km(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// The years both places share, or null. An open-ended "since 2015" runs to this year.
export function overlap(a, b, thisYear = new Date().getFullYear()) {
  if (a.from == null || b.from == null) return null;
  const from = Math.max(a.from, b.from), to = Math.min(a.to ?? thisYear, b.to ?? thisYear);
  return from <= to ? { from, to } : null;
}

const pinned = (p) => p.lat != null && p.lng != null;
const sameTown = (a, b) => a.town && b.town && a.town.trim().toLowerCase() === b.town.trim().toLowerCase();

// The crossings, closest and earliest first: [{ kind: 'same' | 'near', mine, theirs, km, years }].
// Each place is used once, paired with its closest match, so a cluster of nearby places doesn't repeat itself.
export function crossings(mine, theirs, thisYear) {
  const out = [];
  for (const a of mine) for (const b of theirs) {
    const years = overlap(a, b, thisYear); if (!years) continue;
    let d = null, kind = null;
    if (pinned(a) && pinned(b)) { d = km(a, b); kind = d <= SAME_KM ? 'same' : d <= NEAR_KM ? 'near' : null; }
    else if (sameTown(a, b)) kind = 'near';
    if (kind) out.push({ kind, mine: a, theirs: b, km: d, years });
  }
  out.sort((x, y) => (x.km ?? NEAR_KM) - (y.km ?? NEAR_KM));
  const usedMine = new Set(), usedTheirs = new Set(), kept = [];
  for (const c of out) { if (usedMine.has(c.mine.id) || usedTheirs.has(c.theirs.id)) continue; usedMine.add(c.mine.id); usedTheirs.add(c.theirs.id); kept.push(c); }
  return kept.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'same' ? -1 : 1) || x.years.from - y.years.from);
}

export const yearsLabel = (y) => (y.from === y.to ? String(y.from) : `${y.from} to ${y.to}`);
export function distanceLabel(d) {
  if (d == null) return 'same town';
  if (d < 0.1) return 'next door';
  if (d < 1) return `${Math.round(d * 10) * 100} m apart`;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} km apart`;
}
