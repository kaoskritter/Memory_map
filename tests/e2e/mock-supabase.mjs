// A small stand-in for Supabase's HTTP API (auth, data, photo storage) backed by an in-process
// Postgres running the real migration, so the app's requests are checked against the real access rules.
// Test use only. The sign-in code is always 123456.
import http from 'node:http';
import { freshDb } from '../helpers.mjs';

export async function startMock(port) {
  const db = await freshDb();
  const files = new Map();
  let chain = Promise.resolve();
  const lock = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = (u) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
  const claims = (req) => { const t = (req.headers.authorization || '').split(' ')[1] || ''; try { const c = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return c.sub ? c : null; } catch (e) { return null; } };
  const userOut = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return s; };

  // Runs SQL as the signed-in user (or anon), inside a transaction, exactly as PostgREST would.
  const asUser = (c, fn) => lock(async () => {
    await db.exec('begin');
    try {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(c || {})]);
      await db.exec(`set local role ${c ? 'authenticated' : 'anon'}`);
      const out = await fn(); await db.exec('commit'); return out;
    } catch (e) { await db.exec('rollback'); throw e; }
  });

  async function rest(req, url, body, c) {
    const parts = url.pathname.split('/').filter(Boolean); // rest v1 table | rest v1 rpc fn
    if (parts[2] === 'rpc') return asUser(c, async () => (await db.query(`select public.${ident(parts[3])}() as r`)).rows[0].r);
    const table = ident(parts[2]), q = url.searchParams;
    const sel = (q.get('select') || '*').split(',').map((s) => s.trim()).map((s) => (s === '*' ? '*' : ident(s))).join(', ');
    const where = [], params = [];
    for (const [k, v] of q) { if (['select', 'order', 'limit', 'columns'].includes(k)) continue; if (!v.startsWith('eq.')) throw new Error('unsupported filter ' + v); params.push(v.slice(3)); where.push(`${ident(k)}::text = $${params.length}`); }
    const w = where.length ? ' where ' + where.join(' and ') : '';
    const wantsRows = /return=representation/.test(req.headers.prefer || '');
    return asUser(c, async () => {
      if (req.method === 'GET') { const o = q.get('order'); return (await db.query(`select ${sel} from public.${table}${w}${o ? ' order by ' + ident(o.split('.')[0]) : ''}`, params)).rows; }
      if (req.method === 'DELETE') { await db.query(`delete from public.${table}${w}`, params); return []; }
      const cols = Object.keys(body).map(ident).join(', ');
      params.push(JSON.stringify(body)); const j = `$${params.length}::jsonb`;
      if (req.method === 'POST') return (await db.query(`insert into public.${table} (${cols}) select ${cols} from jsonb_populate_record(null::public.${table}, ${j})${wantsRows ? ' returning ' + sel : ''}`, params)).rows;
      if (req.method === 'PATCH') return (await db.query(`update public.${table} set (${cols}) = (select ${cols} from jsonb_populate_record(null::public.${table}, ${j}))${w}${wantsRows ? ' returning ' + sel : ''}`, params)).rows;
      throw new Error('unsupported method');
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`), p = url.pathname;
    const send = (code, obj, type) => { res.writeHead(code, { 'content-type': type || 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }); res.end(type ? obj : JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') return send(200, {});
    const chunks = []; for await (const ch of req) chunks.push(ch); const raw = Buffer.concat(chunks);
    const json = () => (raw.length ? JSON.parse(raw.toString()) : {});
    try {
      if (p === '/auth/v1/otp') {
        const email = json().email.toLowerCase();
        const ex = await lock(() => db.query(`select id from auth.users where email=$1`, [email]));
        if (!ex.rows.length) { try { await lock(() => db.query(`insert into auth.users(email) values ($1)`, [email])); } catch (e) { return send(500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' }); } }
        return send(200, {});
      }
      if (p === '/auth/v1/verify') {
        const b = json(); const u = (await lock(() => db.query(`select id, email from auth.users where email=$1`, [String(b.email).toLowerCase()]))).rows[0];
        if (!u || b.token !== '123456') return send(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
        return send(200, { access_token: token(u), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + u.id, user: userOut(u) });
      }
      if (p === '/auth/v1/user') { const c = claims(req); return c ? send(200, userOut({ id: c.sub, email: c.email })) : send(401, { msg: 'no session' }); }
      if (p === '/auth/v1/logout') return send(204, {});
      if (p === '/auth/v1/token') { const id = String(json().refresh_token || '').slice(2); const u = (await lock(() => db.query(`select id, email from auth.users where id::text=$1`, [id]))).rows[0]; return u ? send(200, { access_token: token(u), token_type: 'bearer', expires_in: 3600, refresh_token: 'r-' + u.id, user: userOut(u) }) : send(400, { msg: 'bad refresh' }); }

      const c = claims(req);
      if (p.startsWith('/rest/v1/')) {
        const rows = await rest(req, url, req.method === 'GET' || req.method === 'DELETE' ? null : json(), c);
        if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) return Array.isArray(rows) && rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        return send(req.method === 'POST' ? 201 : 200, rows);
      }
      if (p.startsWith('/storage/v1/object/sign/photos') && req.method === 'POST') {
        const b = json(); const seen = await asUser(c, async () => (await db.query(`select name from storage.objects where bucket_id='photos' and name = any($1)`, [b.paths])).rows.map((r) => r.name));
        return send(200, b.paths.map((path) => (seen.includes(path) ? { path, signedURL: `/object/sign/photos/${path}?token=t`, error: null } : { path, signedURL: null, error: 'Object not found' })));
      }
      if (p.startsWith('/storage/v1/object/sign/photos/') && req.method === 'GET') { const f = files.get(decodeURIComponent(p.slice('/storage/v1/object/sign/photos/'.length))); return f ? send(200, f, 'image/jpeg') : send(404, {}); }
      if (p.startsWith('/storage/v1/object/photos/') && req.method === 'POST') {
        const name = decodeURIComponent(p.slice('/storage/v1/object/photos/'.length));
        await asUser(c, () => db.query(`insert into storage.objects(bucket_id,name) values ('photos',$1)`, [name]));
        // multipart or raw body: keep the bytes from the first JPEG marker
        const i = raw.indexOf(Buffer.from([0xff, 0xd8])); files.set(name, i >= 0 ? raw.subarray(i) : raw);
        return send(200, { Key: 'photos/' + name, Id: name });
      }
      if (p === '/storage/v1/object/photos' && req.method === 'DELETE') {
        const gone = await asUser(c, async () => (await db.query(`delete from storage.objects where bucket_id='photos' and name = any($1) returning name`, [json().prefixes])).rows);
        gone.forEach((g) => files.delete(g.name)); return send(200, gone);
      }
      send(404, { message: 'mock: no route ' + req.method + ' ' + p });
    } catch (e) {
      const rls = /row-level security|permission denied/.test(e.message);
      send(rls ? 403 : 400, { code: e.code || '400', message: e.message });
    }
  });
  await new Promise((r) => server.listen(port, r));
  return { db, files, close: () => server.close() };
}
