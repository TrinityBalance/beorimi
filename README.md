# Beorimi

사진 속 대형폐기물 후보를 관찰하고 결과를 확인하는 Next.js 앱임.

## 저장소 구조

- `frontend/`: Vercel에 배포되는 Next.js 앱과 Route Handler API
- `supabase/`: Postgres migrations와 비동기 Edge Function worker
- `shared/`: 운영 API와 분석 결과 계약
- `vlm/`: 운영과 분리된 로컬 프롬프트·스키마 실험 도구
- `legacy/aws/`: 철회한 AWS 구현의 보존 아카이브이며 운영 빌드에서 사용하지 않음

## 운영 구조

```text
Browser → Vercel (Next.js API) → Supabase Auth / Storage / Postgres
                                      ↓ insert webhook + pg_net
                               Supabase Edge Function → OpenAI Responses API
```

분석 요청은 항상 비동기임. `POST /api/analyses`가 `202 queued`를 반환하고, 클라이언트는 `GET /api/analyses/{id}`를 polling함.

## 배포

1. Supabase 프로젝트 생성 후 CLI에서 `supabase link`, `supabase db push` 실행.
2. Supabase Auth의 Site URL과 Redirect URL에 Vercel 운영 URL을 등록. Edge Function `analyze`를 배포하고 `OPENAI_API_KEY`, `OPENAI_VLM_MODEL`, `ANALYSIS_WORKER_SECRET`를 Supabase secrets에 등록.
3. Supabase Vault에 `beorimi_analysis_worker_url`(Edge Function URL)과 같은 값의 `beorimi_analysis_worker_secret`를 등록.
4. Vercel 프로젝트의 Root Directory를 `frontend`로 설정하고 다음 공개 환경 변수를 등록.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

`OPENAI_API_KEY`, `ANALYSIS_WORKER_SECRET`는 브라우저/Vercel 환경 변수에 넣으면 안 됨. Supabase Edge Function에만 둬야 함.

단, `SUPABASE_SERVICE_ROLE_KEY`는 Vercel API route가 필요하므로 Vercel의 **비공개** 환경 변수로도 등록함. `NEXT_PUBLIC_` 접두사는 절대 쓰면 안 됨.

## 검증

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
python -m pytest vlm/tests
```

로컬 VLM CLI는 관찰 결과 실험용으로 남아 있음. 운영 분석 경로는 Supabase Edge Function임.

이전 FastAPI/Lambda, S3/SQS/DynamoDB, Cognito, CloudFormation, Amplify, App Runner 코드는 `legacy/aws/`에 보존되어 있음.
