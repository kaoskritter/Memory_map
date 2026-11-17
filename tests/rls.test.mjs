// Runs the real migration in an in-process Postgres (PGlite) with a minimal stand-in for
// Supabase's auth and storage schemas, then checks who can see and change what.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.mjs';

let db;
const U = { owner: '00000000-0000-0000-0000-00000000000a', kin: '00000000-0000-0000-0000-00000000000b', stranger: '00000000-0000-0000-0000-00000000000c' };
const MAIL = { owner: 'owner@example.com', kin: 'kin@example.com', stranger: 'stranger@example.com' };
let mapId, eventId;

async function as(who, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: U[who], email: MAIL[who] })}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const denied = (p) => assert.rejects(p);

before(async () => { db = await freshDb(); });

test('sign-up is refused unless the email is on the beta list or invited', async () => {
  await denied(db.query(`insert into auth.users values ($1,$2)`, [U.owner, MAIL.owner]));
  await db.query(`insert into beta_allowlist(email) values ($1)`, [MAIL.owner]);
  await db.query(`insert into auth.users values ($1,$2)`, [U.owner, MAIL.owner]);
  const p = await db.query(`select email from profiles where id=$1`, [U.owner]);
  assert.equal(p.rows[0].email, MAIL.owner);
});

test('an allowlisted owner can create a map and events', async () => {
  const m = await as('owner', `insert into maps(owner_id, preferred_name) values ($1,'Peggy') returning id`, [U.owner]);
  mapId = m.rows[0].id;
  const e = await as('owner', `insert into events(map_id, category, title) values ($1,'home','Electra Street') returning id`, [mapId]);
  eventId = e.rows[0].id;
});

test('an invited relative can sign up, join, read, and add memories and photos only', async () => {
  await denied(db.query(`insert into auth.users values ($1,$2)`, [U.kin, MAIL.kin]));
  await as('owner', `insert into invites(map_id, email, invited_by) values ($1,$2,$3)`, [mapId, MAIL.kin, U.owner]);
  await db.query(`insert into auth.users values ($1,$2)`, [U.kin, MAIL.kin]);
  assert.equal((await as('kin', `select * from maps`)).rows.length, 0, 'no access before accepting');
  await as('kin', `select accept_invites()`);
  assert.equal((await as('kin', `select * from maps`)).rows.length, 1);
  assert.equal((await as('kin', `select * from events`)).rows.length, 1);
  await as('kin', `insert into memories(map_id,event_id,author_id,author_name,body) values ($1,$2,$3,'Kin','I remember the sea')`, [mapId, eventId, U.kin]);
  await as('kin', `insert into photos(map_id,event_id,uploaded_by,path) values ($1,$2,$3,$4)`, [mapId, eventId, U.kin, `${mapId}/${eventId}/a.jpg`]);
  await as('kin', `insert into storage.objects(bucket_id,name) values ('photos',$1)`, [`${mapId}/${eventId}/a.jpg`]);
  // cannot touch the timeline
  await denied(as('kin', `insert into events(map_id, category, title) values ($1,'home','Nope')`, [mapId]));
  assert.equal((await as('kin', `update events set title='Changed' where id=$1`, [eventId])).affectedRows, 0);
  assert.equal((await as('kin', `delete from events where id=$1`, [eventId])).affectedRows, 0);
  assert.equal((await as('kin', `update maps set mode='memorial' where id=$1`, [mapId])).affectedRows, 0);
  // cannot start their own map (not on the beta list) or sign memories as someone else
  await denied(as('kin', `insert into maps(owner_id) values ($1)`, [U.kin]));
  await denied(as('kin', `insert into memories(map_id,event_id,author_id,body) values ($1,$2,$3,'x')`, [mapId, eventId, U.owner]));
  // cannot file a photo under another map's folder
  await denied(as('kin', `insert into photos(map_id,event_id,uploaded_by,path) values ($1,$2,$3,'00000000-0000-0000-0000-0000000000ff/x.jpg')`, [mapId, eventId, U.kin]));
});

test('a stranger with an account sees and changes nothing', async () => {
  await db.query(`insert into beta_allowlist(email) values ($1)`, [MAIL.stranger]);
  await db.query(`insert into auth.users values ($1,$2)`, [U.stranger, MAIL.stranger]);
  for (const t of ['maps', 'events', 'memories', 'photos', 'invites', 'map_members'])
    assert.equal((await as('stranger', `select * from ${t}`)).rows.length, 0, t);
  assert.equal((await as('stranger', `select * from storage.objects`)).rows.length, 0);
  await denied(as('stranger', `insert into memories(map_id,event_id,author_id,body) values ($1,$2,$3,'x')`, [mapId, eventId, U.stranger]));
  await denied(as('stranger', `insert into storage.objects(bucket_id,name) values ('photos',$1)`, [`${mapId}/x.jpg`]));
  await denied(as('stranger', `insert into storage.objects(bucket_id,name) values ('photos','not-a-uuid/x.jpg')`));
  await denied(as('stranger', `insert into invites(map_id,email,invited_by) values ($1,$2,$3)`, [mapId, MAIL.stranger, U.stranger]));
  await denied(as('stranger', `select * from beta_allowlist`));
});

test('signed-out visitors can read nothing', async () => {
  await db.exec(`select set_config('request.jwt.claims','{}',false); set role anon;`);
  try { for (const t of ['maps', 'events', 'memories', 'photos']) await denied(db.query(`select * from ${t}`)); }
  finally { await db.exec('reset role'); }
});

test('the owner cannot give the map away, can remove any memory, and removing an invite ends access', async () => {
  await as('owner', `update maps set owner_id=$1 where id=$2`, [U.stranger, mapId]);
  assert.equal((await db.query(`select owner_id from maps where id=$1`, [mapId])).rows[0].owner_id, U.owner);
  assert.equal((await as('owner', `delete from memories where map_id=$1`, [mapId])).affectedRows, 1);
  await as('owner', `delete from invites where map_id=$1 and email=$2`, [mapId, MAIL.kin]);
  assert.equal((await as('kin', `select * from maps`)).rows.length, 0);
});

test('deleting a map removes its events, memories and photo records', async () => {
  await as('owner', `delete from maps where id=$1`, [mapId]);
  for (const t of ['events', 'memories', 'photos', 'invites', 'map_members'])
    assert.equal((await db.query(`select * from ${t}`)).rows.length, 0, t);
});
