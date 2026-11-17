// Two stores with the same shape: one keeps the made-up example in memory, the other talks to Supabase.
import { createClient } from '@supabase/supabase-js';
import { parseWhen } from './when.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const ok = ({ data, error }) => { if (error) throw error; return data; };

/* ---------------- demo ---------------- */
export function demoStore() {
  return {
    demo: true,
    async saveSubject() {},
    async saveEvent(d) { return d; },
    async deleteEvent() {},
    async addMemory(e, by, text) { return { id: uuid(), by, text, mine: true }; },
    async removeMemory() {},
    async addPhoto(e, blob) { return { id: uuid(), src: URL.createObjectURL(blob), cap: '', mine: true }; },
    async removePhoto() {},
    async listInvites() { return []; },
    async addInvite() { throw new Error('demo'); },
    async removeInvite() {},
    async deleteMap() {},
    async addPerson(p) { return { id: uuid(), subject: false, name: p.name, born: p.born || '', died: p.died || '', note: p.note || '', sex: p.sex || '', kind: p.kind || 'family' }; },
    async updatePerson() {},
    async deletePerson() {},
    async addLinks(list) { return list.map((l) => ({ id: uuid(), ...l })); },
    async removeLink() {},
    async linkEvent() {},
    async unlinkEvent() {},
  };
}

/* ---------------- cloud ---------------- */
const subjectToRow = (s, mode) => ({ mode, preferred_name: s.preferred || '', birth_name: s.birthName || '', pronouns: s.pronouns || '', born: s.born || '', died: s.died || '', for_self: !!s.forSelf, relationship: s.relationship || '', builder_name: s.builder || '', name_changes: s.changes || [] });
const rowToSubject = (r) => ({ preferred: r.preferred_name, birthName: r.birth_name, pronouns: r.pronouns, born: r.born, died: r.died, forSelf: r.for_self, relationship: r.relationship, builder: r.builder_name, changes: Array.isArray(r.name_changes) ? r.name_changes : [] });

export async function listMaps() {
  return ok(await sb.from('maps').select('id, preferred_name, owner_id, mode').order('created_at'));
}
export async function acceptInvites() {
  const { error } = await sb.rpc('accept_invites');
  if (error) console.warn('accept_invites', error.message);
}
export async function createMap(userId, subject) {
  return ok(await sb.from('maps').insert({ owner_id: userId, ...subjectToRow(subject, 'living') }).select('id').single()).id;
}

export async function loadMap(mapId, userId) {
  const [m, ev, mem, ph, pp, fl, ep] = await Promise.all([
    sb.from('maps').select('*').eq('id', mapId).single(),
    sb.from('events').select('*').eq('map_id', mapId),
    sb.from('memories').select('*').eq('map_id', mapId).order('created_at'),
    sb.from('photos').select('*').eq('map_id', mapId).order('created_at'),
    sb.from('people').select('*').eq('map_id', mapId).order('created_at'),
    sb.from('family_links').select('*').eq('map_id', mapId),
    sb.from('event_people').select('*').eq('map_id', mapId).order('created_at'),
  ]);
  const map = ok(m), events = ok(ev), memories = ok(mem), photos = ok(ph), people = ok(pp), links = ok(fl), eventPeople = ok(ep);
  let urls = {};
  if (photos.length) {
    const signed = ok(await sb.storage.from('photos').createSignedUrls(photos.map((p) => p.path), 60 * 60 * 6));
    signed.forEach((s) => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  const byEvent = (rows) => rows.reduce((acc, r) => ((acc[r.event_id] = acc[r.event_id] || []).push(r), acc), {});
  const mems = byEvent(memories), phs = byEvent(photos), who = byEvent(eventPeople);
  return {
    demo: false, mapId, role: map.owner_id === userId ? 'owner' : 'contributor', mode: map.mode, subject: rowToSubject(map),
    people: people.map((r) => ({ id: r.id, subject: r.is_subject, name: r.name, born: r.born, died: r.died, note: r.note, sex: r.sex || '', kind: r.kind || 'family' })),
    links: links.map((r) => ({ id: r.id, from: r.from_id, to: r.to_id, kind: r.kind })),
    events: events.map((r) => ({
      id: r.id, cat: r.category, title: r.title, precision: r.precision, addr: r.addr || {}, lat: r.lat, lng: r.lng, when: r.when_text, extra: r.extra || {}, people: r.people,
      who: (who[r.id] || []).map((x) => x.person_id),
      memories: (mems[r.id] || []).map((x) => ({ id: x.id, by: x.author_name, text: x.body, mine: x.author_id === userId })),
      photos: (phs[r.id] || []).filter((x) => urls[x.path]).map((x) => ({ id: x.id, path: x.path, src: urls[x.path], cap: x.caption, mine: x.uploaded_by === userId })),
    })),
  };
}

export function cloudStore(mapId, userId) {
  const store = {
    demo: false,
    async saveSubject(S) { ok(await sb.from('maps').update(subjectToRow(S.subject, S.mode)).eq('id', mapId)); },
    async saveEvent(d, isNew) {
      const r = parseWhen(d.when);
      const row = { map_id: mapId, category: d.cat, title: d.title, precision: d.precision, addr: d.addr || {}, lat: d.lat, lng: d.lng, when_text: d.when || '', year_from: r ? r.from : null, year_to: r ? r.to : null, extra: d.extra || {}, people: d.people || '' };
      if (isNew) { d.id = ok(await sb.from('events').insert({ ...row, created_by: userId }).select('id').single()).id; }
      else ok(await sb.from('events').update(row).eq('id', d.id));
      return d;
    },
    async deleteEvent(e) {
      const paths = e.photos.map((p) => p.path).filter(Boolean);
      if (paths.length) await sb.storage.from('photos').remove(paths);
      ok(await sb.from('events').delete().eq('id', e.id));
    },
    async addMemory(e, by, text) {
      const r = ok(await sb.from('memories').insert({ map_id: mapId, event_id: e.id, author_id: userId, author_name: by, body: text }).select('id').single());
      return { id: r.id, by, text, mine: true };
    },
    async removeMemory(m) { ok(await sb.from('memories').delete().eq('id', m.id)); },
    async addPhoto(e, blob) {
      const path = `${mapId}/${e.id}/${uuid()}.jpg`;
      ok(await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      let r;
      try { r = ok(await sb.from('photos').insert({ map_id: mapId, event_id: e.id, uploaded_by: userId, path }).select('id').single()); }
      catch (err) { await sb.storage.from('photos').remove([path]); throw err; }
      return { id: r.id, path, src: URL.createObjectURL(blob), cap: '', mine: true };
    },
    async removePhoto(p) {
      // file first: the storage rule checks the photo record to confirm it is yours
      if (p.path) ok(await sb.storage.from('photos').remove([p.path]));
      ok(await sb.from('photos').delete().eq('id', p.id));
    },
    async listInvites() { return ok(await sb.from('invites').select('id, email, accepted_at').eq('map_id', mapId).order('created_at')); },
    async addInvite(email) { return ok(await sb.from('invites').insert({ map_id: mapId, email: email.toLowerCase(), invited_by: userId }).select('id, email, accepted_at').single()); },
    async removeInvite(id) { ok(await sb.from('invites').delete().eq('id', id)); },
    async addPerson(p) {
      const kind = p.kind === 'friend' ? 'friend' : 'family';
      const r = ok(await sb.from('people').insert({ map_id: mapId, name: p.name, born: p.born || '', died: p.died || '', note: p.note || '', sex: p.sex || '', kind, created_by: userId }).select('id').single());
      return { id: r.id, subject: false, name: p.name, born: p.born || '', died: p.died || '', note: p.note || '', sex: p.sex || '', kind };
    },
    async updatePerson(p) { ok(await sb.from('people').update({ name: p.subject ? '' : p.name, born: p.born || '', died: p.died || '', note: p.note || '', sex: p.subject ? '' : (p.sex || '') }).eq('id', p.id)); },
    async deletePerson(p) { ok(await sb.from('people').delete().eq('id', p.id)); },
    async addLinks(list) {
      const rows = ok(await sb.from('family_links').insert(list.map((l) => ({ map_id: mapId, from_id: l.from, to_id: l.to, kind: l.kind, created_by: userId }))).select('id, from_id, to_id, kind'));
      return rows.map((r) => ({ id: r.id, from: r.from_id, to: r.to_id, kind: r.kind }));
    },
    async removeLink(l) { ok(await sb.from('family_links').delete().eq('id', l.id)); },
    async linkEvent(e, personId) { ok(await sb.from('event_people').insert({ map_id: mapId, event_id: e.id, person_id: personId, added_by: userId })); },
    async unlinkEvent(e, personId) { ok(await sb.from('event_people').delete().eq('event_id', e.id).eq('person_id', personId)); },
    async deleteMap(S) {
      const paths = S.events.flatMap((e) => e.photos.map((p) => p.path)).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) await sb.storage.from('photos').remove(paths.slice(i, i + 100));
      ok(await sb.from('maps').delete().eq('id', mapId));
    },
  };
  return store;
}
