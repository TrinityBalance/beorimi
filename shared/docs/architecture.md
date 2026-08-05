# Architecture

```text
Vercel (Next.js)
  ├─ Supabase Auth ─────────────── access token
  ├─ Supabase Storage ──────────── signed upload token / private image
  └─ Next.js Route Handlers
       └─ Supabase Postgres ────── analysis + account quota
            └─ pg_net webhook / cron
                 └─ Supabase Edge Function
                      ├─ OpenAI Responses API
                      └─ guarded observation → Postgres result
```

## 경계

| 영역 | 책임 |
| --- | --- |
| Frontend | 로그인, 사진 선택/업로드, job polling, 결과 UI |
| Vercel API | Supabase JWT 검증, key 소유권, signed upload token, job 생성/조회 |
| Edge Function | 이미지 관찰, Structured Outputs 검증, guardrail, 재시도/정리 |
| Supabase | Auth, private Storage, RLS, quota, job 상태, pg_net/cron |
| shared | OpenAPI와 JSON Schema 계약 |

- 분석은 `POST /api/analyses` + polling만 사용함.
- 계정 소유권과 누적 5회 한도는 Supabase user id 기준임.
- worker가 받은 VLM 결과 중 guardrail을 통과한 `observation`만 공개 job에 저장함.
- 원본 이미지와 분석 기록은 기본 30일 보관 후 정리함.
