# Beorimi

사진으로 대형 폐기물 후보를 식별하고, 사용자가 결과를 확인한 뒤 공식 배출 정보로 이어지는 모바일 우선 서비스입니다.

현재 Backend에는 Cognito 인증, S3 직접 업로드, SQS 비동기 분석, DynamoDB 결과 저장 구조가 구현되어 있으며 Worker는 실제 VLM을 호출합니다. 품목·수수료 조회와 RAG는 아직 연결되지 않았습니다. Frontend와 VLM에 필요한 연동 작업은 `docs/cowork_ground.md`에서 각 담당자에게 요청합니다.

## 구성

```text
Browser
  ├─ Cognito (로그인/JWT)
  ├─ S3 (presigned POST 이미지 업로드)
  └─ Frontend (Next.js)
       └─ API Gateway → Backend API (FastAPI Lambda)
                          └─ SQS → Backend Worker → VLM
                                        └─ DynamoDB (결과 저장)
```

분석은 비동기입니다. `POST /api/analyses`는 접수만 하고 즉시 `202`와 `queued` 상태를 돌려주며, Frontend는 `GET /api/analyses/{id}`를 polling해 `completed` 또는 `failed`를 기다립니다.

- Frontend는 Backend API와 Backend가 발급한 S3 URL만 사용합니다.
- VLM은 사진에서 관찰 가능한 후보만 반환합니다.
- Backend가 품목·수수료·규정과 최종 안내를 책임집니다.
- 공통 계약의 기준은 `shared/api/openapi.yaml`, `shared/schemas/**`, `shared/docs/api-contract.md`입니다.

## 역할별 작업

작업자는 시작할 때 주 역할 하나를 정하고 해당 카드만 먼저 읽습니다.

| 역할 | 소유 범위 | 시작 문서 | 상세 문서 |
| --- | --- | --- | --- |
| Frontend | `frontend/**` | `frontend/AGENTS.md` | `docs/frontend.md` |
| Backend | `backend/**`, `infra/**` | `backend/AGENTS.md` | `docs/backend.md` |
| VLM | `vlm/**` | `vlm/AGENTS.md` | `docs/vlm.md` |

토큰을 아끼기 위해 루트 `AGENTS.md`의 최소 조회 절차를 따릅니다. 평소에는 역할 카드 → 자기 역할로 온 활성 요청 → 상세 문서의 필요한 절만 읽습니다. 다른 역할의 작업이 필요할 때만 `docs/cowork_ground.md`에 요청을 남깁니다.

## 로컬 실행

요구 사항: Node.js 20+, Python 3.11/3.12, npm, 실제 분석용 OpenAI API 키.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local

python -m venv backend/.venv
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt

python -m venv vlm/.venv
vlm\.venv\Scripts\python.exe -m pip install -r vlm/requirements-dev.txt

npm --prefix frontend ci
```

Backend와 VLM은 가상환경을 따로 둡니다. 두 서비스는 AWS에서도 각각 독립 환경으로 배포되므로, 로컬에서 섞으면 `requirements.txt`에 빠진 의존성이 배포 시점에야 드러납니다.

세 터미널에서 실행합니다.

```powershell
npm --prefix frontend run dev
backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
vlm\.venv\Scripts\python.exe -m uvicorn vlm.app.main:app --reload --port 8001
```

로컬 주소는 Frontend `http://localhost:3000`, Backend `http://localhost:8000`, VLM `http://localhost:8001`입니다. `.env`와 `.env.local`은 커밋하지 않습니다.

로컬에서는 인증이 필요한 경로(`/api/uploads`, `/api/analyses`)가 항상 `401`을 반환합니다. JWT claims는 API Gateway authorizer가 넣어주는 값이라 uvicorn 단독 실행에는 존재하지 않습니다. 버그가 아니며, 해당 경로 검증은 배포 후 또는 `infra/smoke-backend-secure.ps1`로 수행합니다.

## 검증

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests
vlm\.venv\Scripts\python.exe -m pytest vlm/tests
npm --prefix frontend run lint
npm --prefix frontend run build
```

`pytest`는 저장소 루트에서 실행합니다. 테스트가 `backend.app...` 형태로 import하므로 하위 디렉터리에서 실행하면 `ModuleNotFoundError`가 납니다.

## AWS 배포 기준

Backend 권장 배포는 서울 리전(`ap-northeast-2`)의 API Gateway HTTP API, Cognito, Lambda, S3, SQS, DynamoDB 조합입니다. 기존 Lambda Function URL은 통합 전환 전까지 레거시 경로로 유지합니다.

1. Frontend 담당자가 정확한 운영 origin을 전달하고, VLM 담당자가 배포된 HTTPS 주소를 전달
2. `infra/build-backend-lambda.ps1`로 Backend Linux Lambda ZIP 생성
3. `infra/deploy-backend-secure.ps1`로 패키지 업로드와 `infra/backend-secure.yaml` 스택 배포
4. 출력된 `ApiUrl`, `UserPoolId`, `UserPoolClientId`를 Frontend 담당자에게 전달
5. `infra/smoke-backend-secure.ps1`로 로그인 → S3 업로드 → 분석 생성 → 결과 polling 확인
6. 통합 검증 후에만 기존 Function URL 전환·정리를 별도 결정

배포 스크립트는 Root가 아닌 SSO 프로필을 사용하며 `-VlmBaseUrl`과 `-VlmServiceTokenSecretArn`을 요구합니다. 서비스 토큰은 Secrets Manager에만 두고 명령·소스·로그에 남기지 않습니다.

이미지는 presigned POST로 S3에 직접 업로드하며 기본 상한은 10MiB입니다. 상한은 발급 시 `content-length-range` 조건으로 S3가 강제합니다. Frontend와 VLM의 배포 방식은 각 역할 담당자가 결정하며, Backend 세부 절차는 `infra/README.md`와 `docs/backend.md`에서 관리합니다.

## 문서

- `docs/frontend.md`: 화면, API 사용, Amplify
- `docs/backend.md`: 공개 API, 오류 변환, Lambda
- `docs/vlm.md`: 분석 파이프라인, 내부 인증, Lambda
- `docs/cowork_ground.md`: 역할 간 요청과 완료 증거
- `infra/README.md`: Backend AWS 패키징·배포 절차
- `shared/docs/architecture.md`: 서비스 경계
- `shared/docs/api-contract.md`: API 계약
