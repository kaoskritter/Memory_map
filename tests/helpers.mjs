// A minimal stand-in for the parts of Supabase the migration depends on, for running it in PGlite.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, unique (bucket_id, name));
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant all on storage.objects to authenticated;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8'));
  return db;
}
