import { test } from 'node:test';
import assert from 'node:assert/strict';
import { km, overlap, crossings, yearsLabel, distanceLabel } from '../src/paths.js';

const P = (id, lat, lng, from, to, town = '') => ({ id, title: id, lat, lng, from, to, town });

test('distance is roughly right', () => {
  const d = km({ lat: -37.7975, lng: 144.962 }, { lat: -37.799, lng: 144.969 });
  assert.ok(d > 0.5 && d < 0.8, String(d));
});

test('years must overlap; "since" runs to this year; undated places never cross', () => {
  assert.deepEqual(overlap({ from: 1956, to: 1958 }, { from: 1957, to: 1962 }), { from: 1957, to: 1958 });
  assert.equal(overlap({ from: 1956, to: 1958 }, { from: 1959, to: 1962 }), null);
  assert.deepEqual(overlap({ from: 2015, to: null }, { from: 2020, to: null }, 2026), { from: 2020, to: 2026 });
  assert.equal(overlap({ from: null, to: null }, { from: 1960, to: 1960 }), null);
});

test('same place within about 1 km, nearby within about 25 km, nothing further', () => {
  const mine = [P('college', -37.7975, 144.962, 1956, 1958), P('lorne', -38.541, 143.975, 1970, 1979), P('uluru', -25.34, 131.03, 1996, 1996)];
  const theirs = [P('dorm', -37.798, 144.963, 1957, 1957), P('anglesea', -38.405, 144.186, 1975, 1975), P('melb', -37.81, 144.96, 1990, 1991)];
  const c = crossings(mine, theirs, 2026);
  assert.deepEqual(c.map((x) => [x.kind, x.mine.id, x.theirs.id]), [['same', 'college', 'dorm'], ['near', 'lorne', 'anglesea']]);
  assert.deepEqual(c[0].years, { from: 1957, to: 1957 });
});

test('a cluster of nearby places pairs each place once, with its closest match', () => {
  const mine = [P('college', -37.7975, 144.962, 1956, 1958), P('boarding', -37.799, 144.969, 1956, 1958)];
  const theirs = [P('college2', -37.7978, 144.9615, 1956, 1958), P('flat', -37.799, 144.978, 1957, 1960)];
  assert.deepEqual(crossings(mine, theirs).map((x) => [x.mine.id, x.theirs.id]), [['college', 'college2'], ['boarding', 'flat']]);
});

test('places without a pin cross only when the town names match', () => {
  const c = crossings([P('a', null, null, 1960, 1965, 'Williamstown')], [P('b', null, null, 1962, 1962, ' williamstown'), P('c', null, null, 1962, 1962, 'Geelong')]);
  assert.deepEqual(c.map((x) => [x.kind, x.theirs.id, x.km]), [['near', 'b', null]]);
});

test('labels read plainly', () => {
  assert.equal(yearsLabel({ from: 1957, to: 1957 }), '1957');
  assert.equal(yearsLabel({ from: 1961, to: 1963 }), '1961 to 1963');
  assert.equal(distanceLabel(0.05), 'next door');
  assert.equal(distanceLabel(0.42), '400 m apart');
  assert.equal(distanceLabel(3.26), '3.3 km apart');
  assert.equal(distanceLabel(18.7), '19 km apart');
  assert.equal(distanceLabel(null), 'same town');
});
