// Family tree logic with no screen code: who sits on which row, in what order, and how each person is related.
// people: [{ id, subject }]   links: [{ id, from, to, kind }]   kind 'parent' means "from is a parent of to".

export function relations(people, links) {
  const blank = () => ({ parents: new Set(), children: new Set(), partners: new Set(), siblings: new Set() });
  const R = {}; people.forEach((p) => { R[p.id] = blank(); });
  links.forEach((l) => {
    if (!R[l.from] || !R[l.to]) return;
    if (l.kind === 'parent') { R[l.to].parents.add(l.from); R[l.from].children.add(l.to); }
    else if (l.kind === 'partner') { R[l.from].partners.add(l.to); R[l.to].partners.add(l.from); }
    else if (l.kind === 'sibling') { R[l.from].siblings.add(l.to); R[l.to].siblings.add(l.from); }
  });
  // sharing a parent makes you siblings too
  people.forEach((p) => R[p.id].parents.forEach((par) => R[par].children.forEach((c) => { if (c !== p.id) R[p.id].siblings.add(c); })));
  return R;
}

// Row number for everyone joined to the person at the centre: 0 is their own generation, -1 their parents, 1 their children.
export function generations(people, links, R) {
  const s = people.find((p) => p.subject); const gen = {}; if (!s) return gen;
  gen[s.id] = 0; const queue = [s.id];
  while (queue.length) {
    const id = queue.shift(), g = gen[id], r = R[id];
    const visit = (set, d) => set.forEach((o) => { if (gen[o] === undefined) { gen[o] = g + d; queue.push(o); } });
    visit(r.partners, 0); visit(r.siblings, 0); visit(r.parents, -1); visit(r.children, 1);
  }
  return gen;
}

// Positions in whole "slots": { rows: [[id…]…], pos: { id: { row, x } }, loose: [ids not joined to the tree] }.
// x is a slot number; neighbouring cards are one slot apart.
export function layout(people, links) {
  const R = relations(people, links), gen = generations(people, links, R);
  const loose = people.filter((p) => gen[p.id] === undefined).map((p) => p.id);
  const gs = [...new Set(Object.values(gen))].sort((a, b) => a - b);
  const rows = gs.map((g) => people.filter((p) => gen[p.id] === g).map((p) => p.id));
  const x = {};
  const place = () => rows.forEach((row) => row.forEach((id, i) => { x[id] = i - (row.length - 1) / 2; }));
  const mean = (ids) => { const v = [...ids].filter((i) => x[i] !== undefined && gen[i] !== undefined); return v.length ? v.reduce((a, i) => a + x[i], 0) / v.length : null; };
  // Couples sit side by side. A partner who joined the family goes on the far side from the brothers and sisters.
  const huddle = (row, k) => {
    const out = [], seen = new Set();
    const add = (id) => {
      if (seen.has(id) || !row.includes(id)) return; seen.add(id);
      const ps = [...R[id].partners].filter((q) => row.includes(q) && !seen.has(q));
      ps.filter((q) => k(q) < k(id)).forEach((q) => { seen.add(q); out.push(q); });
      out.push(id);
      ps.filter((q) => k(q) >= k(id)).forEach((q) => { seen.delete(q); add(q); });
    };
    row.forEach(add); return out;
  };
  const sortRow = (row, by) => {
    const key = {}; row.forEach((id) => { key[id] = mean(R[id][by]); });
    const k = (id) => { if (key[id] !== null) return key[id]; const v = [...R[id].partners].map((q) => key[q]).find((x) => x !== null && x !== undefined); return v !== undefined ? v + 0.01 : x[id]; };
    // inside a group of brothers and sisters, the one whose partner sits further right goes last
    const lean = (id) => { const ks = [...R[id].partners].filter((q) => row.includes(q)).map(k); return ks.length ? Math.sign(ks.reduce((a, b) => a + b, 0) / ks.length - k(id)) : 0; };
    const sorted = row.map((id, i) => ({ id, i })).sort((a, b) => k(a.id) - k(b.id) || lean(a.id) - lean(b.id) || a.i - b.i).map((o) => o.id);
    return huddle(sorted, k);
  };
  place();
  for (let pass = 0; pass < 6; pass++) {
    for (let r = 1; r < rows.length; r++) { rows[r] = sortRow(rows[r], 'parents'); place(); }
    for (let r = rows.length - 2; r >= 0; r--) { rows[r] = sortRow(rows[r], 'children'); place(); }
  }
  const pos = {}; rows.forEach((row, r) => row.forEach((id) => { pos[id] = { row: r, x: x[id] }; }));
  return { rows, pos, loose, gen, R };
}
// How someone is related to the person at the centre, in plain words. '' when it is not a simple step.
export function relationLabel(id, people, R) {
  const s = people.find((p) => p.subject); if (!s || !R[id]) return '';
  if (id === s.id) return '';
  const me = R[s.id], has = (set) => set.has(id), any = (set, pick) => [...set].some((o) => R[o] && pick(R[o]).has(id));
  if (has(me.partners)) return 'Partner';
  if (has(me.parents)) return 'Parent';
  if (has(me.children)) return 'Child';
  if (has(me.siblings)) return 'Brother or sister';
  if (any(me.parents, (r) => r.parents)) return 'Grandparent';
  if (any(me.children, (r) => r.children)) return 'Grandchild';
  if (any(me.parents, (r) => r.partners)) return 'Step-parent';
  if (any(me.partners, (r) => r.children)) return 'Step-child';
  if (any(me.children, (r) => r.partners)) return 'Child’s partner';
  if (any(me.partners, (r) => r.parents)) return 'Parent-in-law';
  if (any(me.siblings, (r) => r.partners) || any(me.partners, (r) => r.siblings)) return 'Brother- or sister-in-law';
  if (any(me.parents, (r) => r.siblings)) return 'Aunt or uncle';
  if (any(me.siblings, (r) => r.children)) return 'Niece or nephew';
  const grandparents = new Set(); me.parents.forEach((p) => R[p].parents.forEach((g) => grandparents.add(g)));
  if ([...grandparents].some((g) => R[g].parents.has(id))) return 'Great-grandparent';
  const grandchildren = new Set(); me.children.forEach((c) => R[c].children.forEach((g) => grandchildren.add(g)));
  if ([...grandchildren].some((g) => R[g].children.has(id))) return 'Great-grandchild';
  const auntsUncles = new Set(); me.parents.forEach((p) => R[p].siblings.forEach((a) => auntsUncles.add(a)));
  if ([...auntsUncles].some((a) => R[a].children.has(id))) return 'Cousin';
  return 'Family';
}

// The links needed to say "newId is the <rel> of targetId". otherParent applies to a child.
export function linksFor(rel, newId, targetId, R, otherParent) {
  if (rel === 'parent') return [{ from: newId, to: targetId, kind: 'parent' }];
  if (rel === 'partner') return [{ from: newId, to: targetId, kind: 'partner' }];
  if (rel === 'child') return [{ from: targetId, to: newId, kind: 'parent' }, ...(otherParent ? [{ from: otherParent, to: newId, kind: 'parent' }] : [])];
  if (rel === 'sibling') { const ps = [...R[targetId].parents]; return ps.length ? ps.map((p) => ({ from: p, to: newId, kind: 'parent' })) : [{ from: newId, to: targetId, kind: 'sibling' }]; }
  return [];
}
export const sameLink = (a, b) => a.kind === b.kind && ((a.from === b.from && a.to === b.to) || (a.kind !== 'parent' && a.from === b.to && a.to === b.from));
