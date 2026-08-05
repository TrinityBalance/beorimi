# Backend 작업 가이드

## 운영 구조

공개 API는 `frontend/src/app/api/**`의 Vercel Route Handler가 담당함. Supabase가 Auth, Storage, Postgres와 비동기 worker 실행을 담당함.

```text
POST /api/uploads → signed upload token → private Storage upload
POST /api/analyses → Postgres queued row → pg_net webhook → Edge Function
GET /api/analyses/{id} → Postgres polling
```

분석 API는 동기 결과를 반환하면 안 됨. 항상 `202 queued` 뒤 polling을 유지함.

## Supabase 구성

- 스키마/RLS/Storage bucket/worker cron: `supabase/migrations/**`
- worker: `supabase/functions/analyze/index.ts`
- 공개 API 서버 helper: `frontend/src/lib/server/supabase.ts`

`ANALYSIS_WORKER_SECRET`은 Edge Function secret과 Supabase Vault의 `beorimi_analysis_worker_secret`가 같아야 함. Vault의 `beorimi_analysis_worker_url`은 해당 Edge Function URL임.

## 배포

```powershell
supabase link
supabase db push
supabase functions deploy analyze
```

Supabase dashboard/CLI에서 Edge Function secrets를 등록한 뒤 Vault secrets도 등록해야 worker trigger와 재시도 cron이 실행됨.
