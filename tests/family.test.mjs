import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relations, layout, relationLabel, linksFor } from '../src/family.js';

const P = (id, subject) => ({ id, subject: !!subject });
const people = ['peggy', 'ted', 'helen', 'tom', 'arthur', 'rose', 'joan', 'mark', 'edith', 'stray'].map((id) => P(id, id === 'peggy'));
let n = 0; const L = (from, to, kind) => ({ id: 'l' + (++n), from, to, kind });
const links = [L('peggy', 'ted', 'partner'), L('peggy', 'helen', 'parent'), L('ted', 'helen', 'parent'), L('helen', 'tom', 'parent'), L('helen', 'mark', 'partner'),
  L('arthur', 'peggy', 'parent'), L('rose', 'peggy', 'parent'), L('arthur', 'rose', 'partner'), L('arthur', 'joan', 'parent'), L('edith', 'ted', 'parent')];

test('rows follow the generations, and people not joined up are set aside', () => {
  const t = layout(people, links);
  assert.deepEqual(t.rows.map((r) => [...r].sort()), [['arthur', 'edith', 'rose'], ['joan', 'peggy', 'ted'], ['helen', 'mark'], ['tom']]);
  assert.deepEqual(t.loose, ['stray']);
});
test('partners sit side by side', () => {
  const t = layout(people, links), gap = (a, b) => Math.abs(t.pos[a].x - t.pos[b].x);
  assert.equal(gap('peggy', 'ted'), 1); assert.equal(gap('arthur', 'rose'), 1); assert.equal(gap('helen', 'mark'), 1);
});
test('relationships are named from the centre person', () => {
  const R = relations(people, links), l = (id) => relationLabel(id, people, R);
  assert.deepEqual(['ted', 'helen', 'tom', 'arthur', 'joan', 'mark', 'edith', 'stray'].map(l),
    ['Partner', 'Child', 'Grandchild', 'Parent', 'Sister or brother', 'Child’s partner', 'Parent-in-law', 'Family']);
});
test('a new brother or sister shares the parents when they are known, otherwise is joined directly', () => {
  const R = relations(people, links);
  assert.deepEqual(linksFor('sibling', 'new', 'peggy', R).map((x) => x.from).sort(), ['arthur', 'rose']);
  assert.deepEqual(linksFor('sibling', 'new', 'ted', R).map((x) => x.from), ['edith']);
  assert.deepEqual(linksFor('sibling', 'new', 'arthur', R), [{ from: 'new', to: 'arthur', kind: 'sibling' }]);
  assert.deepEqual(linksFor('child', 'new', 'peggy', R, 'ted').map((x) => x.from), ['peggy', 'ted']);
});
test('a tree with only the centre person still lays out', () => {
  const t = layout([P('a', true)], []); assert.deepEqual(t.rows, [['a']]); assert.equal(t.pos.a.x, 0);
});
test('brothers and sisters stay together, with a partner who married in on the outside', () => {
  const t = layout(people, links), order = (r) => t.rows[r].filter((id) => ['joan', 'peggy', 'ted'].includes(id));
  const row = order(1); assert.equal(Math.abs(row.indexOf('joan') - row.indexOf('peggy')), 1); assert.equal(Math.abs(row.indexOf('peggy') - row.indexOf('ted')), 1);
  // Edith sits over Ted, not over Joan
  assert.ok(Math.abs(t.pos.edith.x - t.pos.ted.x) < Math.abs(t.pos.edith.x - t.pos.joan.x));
});
test('the word changes when we know someone is a woman or a man, and stays neutral when we do not', () => {
  const sexed = people.map((p) => ({ ...p, sex: { joan: 'female', arthur: 'male', helen: 'female', tom: 'male', mark: 'male', edith: 'female' }[p.id] || '' }));
  const R = relations(sexed, links), l = (id) => relationLabel(id, sexed, R);
  assert.deepEqual(['joan', 'arthur', 'rose', 'helen', 'tom', 'mark', 'edith', 'ted'].map(l), ['Sister', 'Father', 'Parent', 'Daughter', 'Grandson', 'Son-in-law', 'Mother-in-law', 'Partner']);
});
