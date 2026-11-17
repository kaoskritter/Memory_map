-- Friends: people in a life story who aren't family. They sit beside the family tree, not in it,
-- and can be linked to places exactly like relatives. Same access rules as everyone else in the tree.
alter table public.people add column kind text not null default 'family' check (kind in ('family', 'friend'));
alter table public.people add constraint people_subject_is_family check (not is_subject or kind = 'family');

-- A friend never takes part in parent, partner or sister-or-brother links.
create function public.family_links_family_only() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from people where id in (new.from_id, new.to_id) and kind = 'friend') then
    raise exception 'Friends are not part of the family tree' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger family_links_family_only before insert on public.family_links
  for each row execute function public.family_links_family_only();

-- Turning a relative into a friend first needs their family connections taken away.
create function public.friend_has_no_family_links() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'friend' and old.kind <> 'friend'
     and exists (select 1 from family_links where from_id = new.id or to_id = new.id) then
    raise exception 'Take away their family connections before marking them as a friend' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger people_friend_no_links before update of kind on public.people
  for each row execute function public.friend_has_no_family_links();

revoke execute on function public.family_links_family_only() from public, anon, authenticated;
revoke execute on function public.friend_has_no_family_links() from public, anon, authenticated;
