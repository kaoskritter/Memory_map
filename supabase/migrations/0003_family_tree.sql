-- Family tree: the people in a life story, how they are related, and which places they were part of.
-- Everyone on a map (the owner and invited family) can add and change people and connections.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  is_subject boolean not null default false,            -- the person the map is about; their name lives on the map itself
  name text not null default '' check (char_length(name) <= 200),
  born text not null default '' check (char_length(born) <= 60),
  died text not null default '' check (char_length(died) <= 60),
  note text not null default '' check (char_length(note) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (is_subject or char_length(name) >= 1),
  unique (id, map_id)
);
create unique index people_one_subject on public.people (map_id) where is_subject;
create index people_map_idx on public.people (map_id);

-- kind 'parent': from_id is a parent of to_id. 'partner' and 'sibling' read the same either way round.
create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null,
  from_id uuid not null,
  to_id uuid not null,
  kind text not null check (kind in ('parent','partner','sibling')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  unique (from_id, to_id, kind),
  foreign key (from_id, map_id) references public.people(id, map_id) on delete cascade,
  foreign key (to_id, map_id) references public.people(id, map_id) on delete cascade
);
create index family_links_map_idx on public.family_links (map_id);

create table public.event_people (
  map_id uuid not null,
  event_id uuid not null,
  person_id uuid not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id),
  foreign key (event_id, map_id) references public.events(id, map_id) on delete cascade,
  foreign key (person_id, map_id) references public.people(id, map_id) on delete cascade
);
create index event_people_map_idx on public.event_people (map_id);

-- Every map has exactly one person at the centre of its tree, created with the map.
create function public.add_subject_person() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into people (map_id, is_subject, created_by) values (new.id, true, new.owner_id);
  return new;
end $$;
create trigger maps_add_subject after insert on public.maps
  for each row execute function public.add_subject_person();
insert into public.people (map_id, is_subject, created_by)
  select m.id, true, m.owner_id from public.maps m
  where not exists (select 1 from public.people p where p.map_id = m.id and p.is_subject);

-- A person cannot be moved to another map or swapped in as the centre of the tree.
create function public.keep_person_place() returns trigger
language plpgsql set search_path = public as $$
begin new.map_id = old.map_id; new.is_subject = old.is_subject; return new; end $$;
create trigger people_keep_place before update on public.people
  for each row execute function public.keep_person_place();

revoke execute on function public.add_subject_person() from public, anon, authenticated;
revoke execute on function public.keep_person_place() from public, anon, authenticated;

alter table public.people enable row level security;
alter table public.family_links enable row level security;
alter table public.event_people enable row level security;

create policy people_read on public.people for select to authenticated using (public.is_map_member(map_id));
create policy people_create on public.people for insert to authenticated with check (public.is_map_member(map_id) and created_by = auth.uid() and not is_subject);
create policy people_update on public.people for update to authenticated using (public.is_map_member(map_id)) with check (public.is_map_member(map_id));
create policy people_delete on public.people for delete to authenticated using (public.is_map_member(map_id) and not is_subject);

create policy family_links_read on public.family_links for select to authenticated using (public.is_map_member(map_id));
create policy family_links_create on public.family_links for insert to authenticated with check (public.is_map_member(map_id) and created_by = auth.uid());
create policy family_links_delete on public.family_links for delete to authenticated using (public.is_map_member(map_id));

create policy event_people_read on public.event_people for select to authenticated using (public.is_map_member(map_id));
create policy event_people_create on public.event_people for insert to authenticated with check (public.is_map_member(map_id) and added_by = auth.uid());
create policy event_people_delete on public.event_people for delete to authenticated using (public.is_map_member(map_id));

revoke all on public.people, public.family_links, public.event_people from anon;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, delete on public.family_links, public.event_people to authenticated;
