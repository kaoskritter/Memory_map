-- Memory Map: schema, access rules and invite-only sign-up.
-- Run once in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

-- People allowed to start their own Memory Map during the beta.
create table public.beta_allowlist (
  email text primary key check (email = lower(email)),
  note text,
  added_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'living' check (mode in ('living','memorial')),
  preferred_name text not null default '' check (char_length(preferred_name) <= 200),
  birth_name text not null default '' check (char_length(birth_name) <= 200),
  pronouns text not null default '' check (char_length(pronouns) <= 60),
  born text not null default '' check (char_length(born) <= 60),
  died text not null default '' check (char_length(died) <= 60),
  for_self boolean not null default true,
  relationship text not null default '' check (char_length(relationship) <= 100),
  builder_name text not null default '' check (char_length(builder_name) <= 200),
  name_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_members (
  map_id uuid not null references public.maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'contributor' check (role = 'contributor'),
  joined_at timestamptz not null default now(),
  primary key (map_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (map_id, email)
);
create index invites_email_idx on public.invites (email);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  category text not null check (category in ('birth','home','school','work','life','travel','fav','landmark','event','end')),
  title text not null check (char_length(title) between 1 and 200),
  precision text not null default 'detailed' check (precision in ('detailed','approx')),
  addr jsonb not null default '{}'::jsonb,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  when_text text not null default '' check (char_length(when_text) <= 200),
  year_from int,
  year_to int,
  extra jsonb not null default '{}'::jsonb,
  people text not null default '' check (char_length(people) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, map_id)
);
create index events_map_idx on public.events (map_id);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null,
  event_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default '' check (char_length(author_name) <= 200),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (event_id, map_id) references public.events(id, map_id) on delete cascade
);
create index memories_map_idx on public.memories (map_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null,
  event_id uuid not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  path text not null unique,
  caption text not null default '' check (char_length(caption) <= 300),
  created_at timestamptz not null default now(),
  foreign key (event_id, map_id) references public.events(id, map_id) on delete cascade
);
create index photos_map_idx on public.photos (map_id);

-- ---------------------------------------------------------------- helpers

create function public.current_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function public.is_map_owner(m uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from maps where id = m and owner_id = auth.uid()) $$;

create function public.is_map_member(m uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from maps where id = m and owner_id = auth.uid())
       or exists (select 1 from map_members where map_id = m and user_id = auth.uid()) $$;

create function public.is_allowlisted() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from beta_allowlist where email = public.current_email()) $$;

-- First folder of a storage path is the map id. Returns null for anything else.
create function public.map_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger maps_touch before update on public.maps for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

-- Owners cannot hand a map to someone else by editing owner_id.
create function public.keep_owner() returns trigger
language plpgsql as $$ begin new.owner_id = old.owner_id; return new; end $$;
create trigger maps_keep_owner before update on public.maps for each row execute function public.keep_owner();

-- ---------------------------------------------------------------- invite-only sign-up

-- A new account is created only for an email on the beta list or one an owner has invited.
create function public.enforce_beta_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null
     or not (exists (select 1 from beta_allowlist where email = lower(new.email))
          or exists (select 1 from invites where email = lower(new.email))) then
    raise exception 'Memory Map is invite-only for now.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger enforce_beta_signup before insert on auth.users
  for each row execute function public.enforce_beta_signup();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, lower(new.email)) on conflict (id) do nothing;
  return new;
end $$;
create trigger handle_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app after sign-in: joins every map this email has been invited to.
create function public.accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  insert into map_members (map_id, user_id)
    select i.map_id, auth.uid() from invites i
    join maps m on m.id = i.map_id
    where i.email = public.current_email() and m.owner_id <> auth.uid()
  on conflict do nothing;
  get diagnostics n = row_count;
  update invites set accepted_at = now() where email = public.current_email() and accepted_at is null;
  return n;
end $$;

-- Removing an invite also removes that person's access.
create function public.revoke_member_on_invite_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from map_members mm using profiles p
   where mm.map_id = old.map_id and p.id = mm.user_id and p.email = old.email;
  return old;
end $$;
create trigger invites_revoke after delete on public.invites
  for each row execute function public.revoke_member_on_invite_delete();

-- ---------------------------------------------------------------- row level security

alter table public.beta_allowlist enable row level security;  -- no policies: managed from the dashboard only
alter table public.profiles enable row level security;
alter table public.maps enable row level security;
alter table public.map_members enable row level security;
alter table public.invites enable row level security;
alter table public.events enable row level security;
alter table public.memories enable row level security;
alter table public.photos enable row level security;

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy maps_read on public.maps for select to authenticated using (owner_id = auth.uid() or public.is_map_member(id));
create policy maps_create on public.maps for insert to authenticated with check (owner_id = auth.uid() and public.is_allowlisted());
create policy maps_update on public.maps for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy maps_delete on public.maps for delete to authenticated using (owner_id = auth.uid());

create policy members_read on public.map_members for select to authenticated using (user_id = auth.uid() or public.is_map_owner(map_id));
create policy members_remove on public.map_members for delete to authenticated using (user_id = auth.uid() or public.is_map_owner(map_id));

create policy invites_read on public.invites for select to authenticated using (public.is_map_owner(map_id));
create policy invites_create on public.invites for insert to authenticated with check (public.is_map_owner(map_id) and invited_by = auth.uid());
create policy invites_delete on public.invites for delete to authenticated using (public.is_map_owner(map_id));

-- The timeline itself: everyone on the map reads, only the owner changes it.
create policy events_read on public.events for select to authenticated using (public.is_map_member(map_id));
create policy events_create on public.events for insert to authenticated with check (public.is_map_owner(map_id));
create policy events_update on public.events for update to authenticated using (public.is_map_owner(map_id)) with check (public.is_map_owner(map_id));
create policy events_delete on public.events for delete to authenticated using (public.is_map_owner(map_id));

-- Memories and photos: anyone on the map can add; you can remove your own, the owner can remove any.
create policy memories_read on public.memories for select to authenticated using (public.is_map_member(map_id));
create policy memories_create on public.memories for insert to authenticated with check (public.is_map_member(map_id) and author_id = auth.uid());
create policy memories_delete on public.memories for delete to authenticated using (author_id = auth.uid() or public.is_map_owner(map_id));

create policy photos_read on public.photos for select to authenticated using (public.is_map_member(map_id));
create policy photos_create on public.photos for insert to authenticated with check (public.is_map_member(map_id) and uploaded_by = auth.uid() and public.map_from_path(path) = map_id);
create policy photos_delete on public.photos for delete to authenticated using (uploaded_by = auth.uid() or public.is_map_owner(map_id));

-- Nothing is readable without signing in.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.maps, public.events, public.memories, public.photos, public.invites, public.map_members to authenticated;
grant select, update on public.profiles to authenticated;
revoke execute on function public.accept_invites() from public, anon;
grant execute on function public.accept_invites() to authenticated;

-- ---------------------------------------------------------------- photo storage (private bucket)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy photos_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_map_member(public.map_from_path(name)));
create policy photos_objects_add on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_map_member(public.map_from_path(name)));
create policy photos_objects_remove on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (public.is_map_owner(public.map_from_path(name))
         or exists (select 1 from public.photos p where p.path = name and p.uploaded_by = auth.uid())));
