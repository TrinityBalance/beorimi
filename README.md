# Beorimi

사진 한 장으로 대형폐기물 후보를 찾고, 품목·크기·예상 수수료를 확인한 뒤 공식 배출 신고까지 이어주는 웹 앱입니다.

## 주요 기능

- 사진 속 여러 폐기물 후보 탐지 및 위치 표시
- 분석 품목, 크기·규격, 수량 직접 수정
- 강남구 품목 기준 예상 수수료 안내
- 대형폐기물 대상이 아닌 품목의 분리배출 규정 안내
- 분석 이력 확인과 공식 배출 신고 페이지 연결
- Supabase Auth 기반 회원가입, 로그인, 로그아웃, 회원 탈퇴
- 회원가입 및 사진 업로드 전 개인정보 이용 동의

분석 결과와 예상 수수료는 신고 준비를 위한 참고 정보입니다. 실제 배출 가능 여부와 최종 수수료는 공식 신고 페이지에서 다시 확인해야 합니다.

## 시스템 구조

```text
Browser
  └─ Vercel · Next.js
       ├─ Supabase Auth
       ├─ Supabase Storage
       └─ Route Handlers
            └─ Supabase Postgres
                 └─ pg_net
                      └─ Supabase Edge Function
                           └─ OpenAI Responses API
```

### Vercel과 Supabase의 역할

| 구분 | Vercel | Supabase |
| --- | --- | --- |
| 핵심 역할 | 사용자 화면과 공개 API의 진입점 | 인증, 파일, 데이터와 백그라운드 분석 처리 |
| 실행 대상 | Next.js 페이지, 정적 자산, Route Handler | Auth, Storage, Postgres, Edge Function |
| 인증 | 전달받은 Supabase access token을 API에서 검증 | 회원 계정, 로그인 세션과 access token 발급 |
| 사진 | 업로드 토큰 발급 요청을 중계 | 비공개 Storage에 원본 사진 저장 |
| 분석 요청 | 분석 작업 생성·조회 API 제공, 결과 polling 응답 | 작업 상태 저장 후 `pg_net`으로 분석 worker 호출 |
| AI 분석 | 모델을 직접 호출하지 않음 | Edge Function이 OpenAI를 호출하고 결과를 검증·저장 |
| 운영 데이터 | 영구 데이터를 직접 보관하지 않음 | 분석 기록, 사용량, 수수료 기준, RLS 정책 관리 |
| 비밀 값 | Supabase 서버 접근에 필요한 service role key만 서버 환경 변수로 사용 | OpenAI key와 worker secret을 Edge Function secret/Vault로 관리 |

간단히 말하면 **Vercel은 서비스의 화면과 API 게이트웨이**, **Supabase는 서비스의 백엔드와 데이터 저장소**입니다. OpenAI API는 Supabase Edge Function에서만 호출합니다.

분석은 비동기로 처리합니다.

1. 브라우저가 Vercel API에서 일회용 업로드 토큰을 발급받습니다.
2. 사진을 Supabase의 비공개 Storage에 직접 업로드합니다.
3. `POST /api/analyses`가 분석 작업을 생성하고 `202 queued`를 반환합니다.
4. Supabase가 Edge Function을 호출해 사진을 분석합니다.
5. 브라우저가 `GET /api/analyses/{id}`를 polling하여 결과를 받습니다.

원본 이미지와 분석 기록은 기본 30일 동안 보관한 뒤 정리합니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `frontend/` | Vercel에 배포되는 Next.js 앱과 Route Handler API |
| `supabase/` | Postgres migration과 비동기 분석 Edge Function |
| `shared/` | OpenAPI 및 JSON Schema 공용 계약 |
| `vlm/` | 운영과 분리된 로컬 프롬프트·스키마 실험 도구 |
| `legacy/aws/` | 운영에서 제외된 이전 AWS 구현 아카이브 |

## 로컬 실행

### 준비 사항

- Node.js 22.13 이상
- npm
- 연결할 Supabase 프로젝트
- Supabase CLI — migration 또는 Edge Function을 변경할 때 필요
- Python 3 — 로컬 VLM 실험과 테스트를 실행할 때만 필요

### 프론트엔드

```powershell
Copy-Item frontend/.env.example frontend/.env.local
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

`frontend/.env.local`에 다음 값을 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다. `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 값이므로 `NEXT_PUBLIC_` 접두사를 붙이거나 브라우저 코드에서 참조하면 안 됩니다.

### 로컬 VLM 실험

운영 분석은 Supabase Edge Function에서 실행됩니다. `vlm/`은 프롬프트와 응답 계약을 로컬에서 실험할 때만 사용합니다.

```powershell
Copy-Item vlm/.env.example vlm/.env
python -m pip install -r vlm/requirements.txt -r vlm/requirements-dev.txt
python -m vlm.app.cli <image-path>
```

`vlm/.env`에는 로컬 실험용 `OPENAI_API_KEY`를 설정해야 합니다.

## 검증

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
python -m pytest vlm/tests
node --experimental-strip-types --test supabase/functions/analyze/*.test.ts
```

## 배포

### Supabase

1. 프로젝트를 연결하고 migration을 반영합니다.

   ```powershell
   supabase link --project-ref <project-ref>
   supabase db push
   ```

2. `analyze` Edge Function을 배포합니다.

   ```powershell
   supabase functions deploy analyze
   ```

3. Edge Function secret에 `OPENAI_API_KEY`, `OPENAI_VLM_MODEL`, `ANALYSIS_WORKER_SECRET`를 등록합니다.
4. Supabase Vault에 다음 값을 등록합니다.
   - `beorimi_analysis_worker_url`: 배포한 `analyze` Edge Function URL
   - `beorimi_analysis_worker_secret`: `ANALYSIS_WORKER_SECRET`과 같은 값
5. Supabase Auth의 Site URL과 허용 Redirect URL에 Vercel 운영 URL을 등록합니다.

`OPENAI_API_KEY`와 `ANALYSIS_WORKER_SECRET`는 Vercel 또는 브라우저 환경 변수에 등록하지 않습니다.

### Vercel

1. 프로젝트 Root Directory를 `frontend`로 설정합니다.
2. Build Command는 `npm run build`를 사용합니다.
3. 다음 환경 변수를 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 비공개 변수
4. 배포 후 Vercel 운영 URL을 Supabase Auth 설정에 반영합니다.

## 관련 문서

- [시스템 아키텍처](shared/docs/architecture.md)
- [API 계약 설명](shared/docs/api-contract.md)
- [OpenAPI 명세](shared/api/openapi.yaml)
- [프론트엔드 가이드](docs/frontend.md)
- [백엔드 가이드](docs/backend.md)
- [VLM 가이드](docs/vlm.md)

## Legacy 안내

이전 FastAPI/Lambda, S3/SQS/DynamoDB, Cognito, CloudFormation, Amplify, App Runner 코드는 `legacy/aws/`에 보존되어 있습니다. 현재 운영 빌드와 배포에는 사용하지 않습니다.
