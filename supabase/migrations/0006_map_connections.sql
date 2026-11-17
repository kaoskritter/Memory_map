-- Connected Memory Maps: two map owners agree to see each other's places, for "Where our paths crossed".
-- Only the two owners see anything. What is shared: place titles, categories, dates, pins and
-- town/state/country. Never memories, photos, street addresses, people, or anything else.

create table public.map_connections (
  id uuid primary key default gen_random_uuid(),
  from_map uuid not null references public.maps(id) on delete cascade,
  to_email text not null check (to_email = lower(to_email) and to_email like '%_@_%'),
  to_map uuid references public.maps(id) on delete cascade,   -- filled in when the other owner accepts
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (from_map, to_email),
  check (to_map is null or to_map <> from_map),
  check ((to_map is null) = (accepted_at is null))
);
create index map_connections_email_idx on public.map_connections (to_email);
create index map_connections_to_map_idx on public.map_connections (to_map);

alter table public.map_connections enable row level security;

-- Either owner sees the connection; the person asked sees requests sent to their email.
create policy map_connections_read on public.map_connections for select to authenticated
  using (public.is_map_owner(from_map) or (to_map is not null and public.is_map_owner(to_map)) or to_email = public.current_email());
-- Only a map's owner can ask, and only as a fresh, unaccepted request.
create policy map_connections_create on public.map_connections for insert to authenticated
  with check (public.is_map_owner(from_map) and requested_by = auth.uid() and to_map is null and accepted_at is null
              and to_email <> public.current_email());
-- Either side can end it at any time; the person asked can decline.
create policy map_connections_delete on public.map_connections for delete to authenticated
  using (public.is_map_owner(from_map) or (to_map is not null and public.is_map_owner(to_map)) or (to_map is null and to_email = public.current_email()));

revoke all on public.map_connections from anon;
grant select, insert, delete on public.map_connections to authenticated;   -- no direct updates: accepting goes through accept_connection

-- Accept a request sent to my email, connecting it to one of my own maps.
create function public.accept_connection(conn uuid, my_map uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from maps where id = my_map and owner_id = auth.uid()) then
    raise exception 'You can only connect a Memory Map you look after' using errcode = '42501';
  end if;
  update map_connections set to_map = my_map, accepted_at = now()
   where id = conn and to_email = public.current_email() and to_map is null and from_map <> my_map;
  if not found then raise exception 'That request is no longer waiting' using errcode = 'P0002'; end if;
end $$;

-- Everything about my connections that I'm allowed to know, for the Settings screen.
create function public.list_connections(my_map uuid) returns table (
  id uuid, direction text, other_name text, other_email text, accepted boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, 'sent', coalesce(m.preferred_name, ''), c.to_email, c.accepted_at is not null, c.created_at
    from map_connections c left join maps m on m.id = c.to_map
   where c.from_map = my_map and exists (select 1 from maps where id = my_map and owner_id = auth.uid())
  union all
  select c.id, 'received', m.preferred_name, p.email, c.accepted_at is not null, c.created_at
    from map_connections c join maps m on m.id = c.from_map join profiles p on p.id = c.requested_by
   where exists (select 1 from maps where id = my_map and owner_id = auth.uid())
     and (c.to_map = my_map or (c.to_map is null and c.to_email = public.current_email()))
  order by created_at
$$;

-- The places on maps connected to one of mine. Places only: no memories, photos, people or street details.
create function public.connected_places(my_map uuid) returns table (
  map_id uuid, map_name text, id uuid, category text, title text, place_precision text,
  lat double precision, lng double precision, when_text text, year_from int, year_to int,
  town text, state text, country text)
language sql stable security definer set search_path = public as $$
  with mine as (select id from maps where id = my_map and owner_id = auth.uid()),
  others as (
    select distinct case when c.from_map = my_map then c.to_map else c.from_map end as other
      from map_connections c, mine
     where c.accepted_at is not null and (c.from_map = mine.id or c.to_map = mine.id))
  select e.map_id, m.preferred_name, e.id, e.category, e.title, e.precision, e.lat, e.lng, e.when_text, e.year_from, e.year_to,
         coalesce(e.addr ->> 'town', ''), coalesce(e.addr ->> 'state', ''), coalesce(e.addr ->> 'country', '')
    from events e join others o on o.other = e.map_id join maps m on m.id = e.map_id
   where e.category <> 'end' or m.mode = 'memorial'
$$;

revoke execute on function public.accept_connection(uuid, uuid) from public, anon;
revoke execute on function public.list_connections(uuid) from public, anon;
revoke execute on function public.connected_places(uuid) from public, anon;
grant execute on function public.accept_connection(uuid, uuid), public.list_connections(uuid), public.connected_places(uuid) to authenticated;
