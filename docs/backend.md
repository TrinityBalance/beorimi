# Backend 작업 가이드

## 운영 구조

공개 API는 `frontend/src/app/api/**`의 Vercel Route Handler가 담당함. Supabase가 Auth, Storage, Postgres와 비동기 worker 실행을 담당함.

이전 FastAPI/AWS 구현은 `legacy/aws/`에 보존되어 있으며 운영 코드나 배포 절차에서 참조하지 않음.

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

### 강남구 수수료 규정 데이터

`202608060002_official_fee_catalog.sql`은 강남구 자원순환 종합포털에서 2026-08-04 확인한 공식 213개 품목·규격 행을 저장함. `waste_fee_catalog_sources`에는 포털 URL, 조례 근거, 확인일, 원본 해시를 기록하고, `waste_disposal_policies`에는 미등재 품목의 유사 품목·기타 품목 처리 근거를 저장함.

공공데이터 CSV와 조례 XLSX의 146행은 금액이 모두 일치했고, 최신 포털 목록에는 무상수거 및 신규 생활용품을 포함한 67행이 추가되어 있음. 운영 worker는 최신 213행을 기준으로 조회함.

같은 품목에 규격별 금액이 여러 개 있을 때 사진 관찰만으로 규격이 하나로 확정되지 않으면 `estimated_fee`를 `null`로 둠. `longest_side_cm`은 공식 규격이 명시적으로 “가장 긴 면”을 기준으로 하는 경우에만 자동 구간 매칭에 사용함.

## 배포

```powershell
supabase link
supabase db push
supabase functions deploy analyze
```

Supabase dashboard/CLI에서 Edge Function secrets를 등록한 뒤 Vault secrets도 등록해야 worker trigger와 재시도 cron이 실행됨.
