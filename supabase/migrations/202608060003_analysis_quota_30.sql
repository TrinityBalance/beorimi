create or replace function public.create_analysis_job(p_owner uuid, p_image_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quota analysis_quotas;
  job analyses;
begin
  insert into public.analysis_quotas (owner, analysis_count)
  values (p_owner, 1)
  on conflict (owner) do update
    set analysis_count = public.analysis_quotas.analysis_count + 1, updated_at = now()
    where public.analysis_quotas.analysis_count < 30
  returning * into quota;

  if quota is null then
    raise exception 'Authenticated account has used all thirty MVP analyses' using errcode = 'P0001';
  end if;

  insert into public.analyses (owner, image_key)
  values (p_owner, p_image_key)
  returning * into job;
  return to_jsonb(job);
end;
$$;

revoke all on function public.create_analysis_job(uuid, text) from public, anon, authenticated;
grant execute on function public.create_analysis_job(uuid, text) to service_role;
