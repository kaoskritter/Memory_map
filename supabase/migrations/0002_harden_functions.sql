-- Tightens who can call helper functions directly, following Supabase's security advisor.

alter function public.current_email() set search_path = public;
alter function public.map_from_path(text) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.keep_owner() set search_path = public;

-- Trigger-only functions: nobody needs to call these through the API.
revoke execute on function public.enforce_beta_signup() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.revoke_member_on_invite_delete() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.keep_owner() from public, anon, authenticated;

-- Used inside the access rules, so signed-in users must be able to run them; signed-out visitors must not.
revoke execute on function public.is_map_owner(uuid) from public, anon;
revoke execute on function public.is_map_member(uuid) from public, anon;
revoke execute on function public.is_allowlisted() from public, anon;
revoke execute on function public.current_email() from public, anon;
revoke execute on function public.map_from_path(text) from public, anon;
grant execute on function public.is_map_owner(uuid), public.is_map_member(uuid), public.is_allowlisted(), public.current_email(), public.map_from_path(text) to authenticated;

-- The beta list is managed from the dashboard only.
revoke all on public.beta_allowlist from anon, authenticated;
