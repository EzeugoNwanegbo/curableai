create or replace function curable_private.advocates() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform curable_private.require_admin();
 return coalesce((select jsonb_agg(jsonb_build_object('institution', raw_user_meta_data->>'advocacy_institution', 'name', coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Curable user'), 'supported_at', raw_user_meta_data->>'advocacy_supported_at') order by raw_user_meta_data->>'advocacy_supported_at' desc) from auth.users where nullif(trim(raw_user_meta_data->>'advocacy_institution'),'') is not null and raw_user_meta_data ? 'advocacy_supported_at'), '[]'::jsonb);
end $$;
create or replace function public.curable_admin_advocates() returns jsonb language sql security invoker set search_path = '' as $$ select curable_private.advocates() $$;
revoke all on function curable_private.advocates(), public.curable_admin_advocates() from public, anon;
grant execute on function curable_private.advocates(), public.curable_admin_advocates() to authenticated;