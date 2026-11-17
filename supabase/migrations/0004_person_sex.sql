-- Lets the family tree say "Sister" or "Brother" rather than "Sister or brother". Optional; blank keeps the neutral word.
alter table public.people add column sex text not null default '' check (sex in ('', 'female', 'male'));
