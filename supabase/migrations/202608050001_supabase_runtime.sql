create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table public.analysis_quotas (
  owner uuid primary key references auth.users(id) on delete cascade,
  analysis_count integer not null default 0 check (analysis_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  image_key text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  item_name text,
  fee integer check (fee >= 0),
  message text,
  error_message text,
  observation jsonb
);

create index analyses_owner_created_at_idx on public.analyses (owner, created_at desc);
create index analyses_queued_created_at_idx on public.analyses (created_at) where status = 'queued';

alter table public.analyses enable row level security;
alter table public.analysis_quotas enable row level security;

create policy "read own analyses" on public.analyses for select to authenticated using ((select auth.uid()) = owner);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waste-images', 'waste-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "upload own waste images" on storage.objects for insert to authenticated with check (
  bucket_id = 'waste-images' and (storage.foldername(name))[1] = 'waste-images' and (storage.foldername(name))[2] = (select auth.uid()::text)
);
create policy "read own waste images" on storage.objects for select to authenticated using (
  bucket_id = 'waste-images' and (storage.foldername(name))[1] = 'waste-images' and (storage.foldername(name))[2] = (select auth.uid()::text)
);

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
    where public.analysis_quotas.analysis_count < 5
  returning * into quota;

  if quota is null then
    raise exception 'Authenticated account has used all five MVP analyses' using errcode = 'P0001';
  end if;

  insert into public.analyses (owner, image_key)
  values (p_owner, p_image_key)
  returning * into job;
  return to_jsonb(job);
end;
$$;

revoke all on function public.create_analysis_job(uuid, text) from public, anon, authenticated;
grant execute on function public.create_analysis_job(uuid, text) to service_role;

create or replace function public.request_analysis_worker(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  worker_url text;
  worker_secret text;
begin
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'beorimi_analysis_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'beorimi_analysis_worker_secret';
  if worker_url is null or worker_secret is null then
    raise warning 'Beorimi worker secrets are not configured';
    return;
  end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-beorimi-worker-secret', worker_secret),
    body := payload
  );
exception when others then
  raise warning 'Beorimi worker enqueue failed: %', sqlerrm;
end;
$$;

create or replace function public.enqueue_analysis_worker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.request_analysis_worker(jsonb_build_object('record', jsonb_build_object('id', new.id)));
  return new;
end;
$$;

create trigger analyses_enqueue_worker
after insert on public.analyses
for each row execute function public.enqueue_analysis_worker();

select cron.schedule(
  'beorimi-analysis-retry',
  '* * * * *',
  $$select public.request_analysis_worker('{"mode":"drain"}'::jsonb);$$
);
select cron.schedule(
  'beorimi-analysis-cleanup',
  '17 3 * * *',
  $$select public.request_analysis_worker('{"mode":"cleanup"}'::jsonb);$$
);
