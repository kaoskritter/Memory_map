import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen } from '../src/when.js';
const cases = {
  '1962': [1962, 1962], 'early 1960s': [1960, 1963], 'mid 60s': [1964, 1966], 'late 1980s onwards': [1987, null],
  '1958 to 1964': [1958, 1964], '1958-64': [1958, 1964], '1963–1978': [1963, 1978], 'about 1970': [1970, 1970],
  'since 2015': [2015, null], '2015 to now': [2015, null], 'early 1940s to 1950': [1940, 1950], 'the 1970s': [1970, 1979],
  '1960s and 70s': [1960, 1979], 'most summers in the 1970s': [1970, 1979], 'from 1956 until 1958': [1956, 1958], 'March 1965': [1965, 1965],
};
for (const [text, [from, to]] of Object.entries(cases)) test(`"${text}"`, () => assert.deepEqual(parseWhen(text), { from, to }));
test('words with no year are kept, never an error', () => { assert.equal(parseWhen('when I was little'), null); assert.equal(parseWhen(''), null); });
