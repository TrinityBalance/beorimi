# Beorimi

사진으로 대형 폐기물 후보를 식별하고, 사용자가 결과를 확인한 뒤 공식 배출 정보로 이어지는 모바일 우선 서비스입니다.

현재 Backend에는 Cognito 인증, S3 직접 업로드, SQS 비동기 분석, DynamoDB 결과 저장 구조가 구현되어 있습니다. Worker는 우선 고정 mock 결과를 저장하며, 실제 VLM 연결은 역할 간 계약 확정 후 교체합니다. Frontend와 VLM에 필요한 연동 작업은 `docs/cowork_ground.md`에서 각 담당자에게 요청합니다.

## 구성

```text
Browser
  ├─ Cognito (로그인/JWT)
  ├─ S3 (presigned URL 이미지 업로드)
  └─ Amplify Hosting (Next.js SSR)
       └─ API Gateway → Backend API (FastAPI Lambda)
                          └─ SQS → Backend Worker → DynamoDB
                                   └─ VLM (후속 연결)
```

- Frontend는 Backend API와 Backend가 발급한 S3 URL만 사용합니다.
- VLM은 사진에서 관찰 가능한 후보만 반환합니다.
- Backend가 품목·수수료·규정과 최종 안내를 책임집니다.
- 공통 계약의 기준은 `shared/api/openapi.yaml`, `shared/schemas/**`, `shared/docs/api-contract.md`입니다.

## 역할별 작업

작업자는 시작할 때 주 역할 하나를 정하고 해당 카드만 먼저 읽습니다.

| 역할 | 소유 범위 | 시작 문서 | 상세 문서 |
| --- | --- | --- | --- |
| Frontend | `frontend/**` | `frontend/AGENTS.md` | `docs/frontend.md` |
| Backend | `backend/**` | `backend/AGENTS.md` | `docs/backend.md` |
| VLM | `vlm/**` | `vlm/AGENTS.md` | `docs/vlm.md` |

토큰을 아끼기 위해 루트 `AGENTS.md`의 최소 조회 절차를 따릅니다. 평소에는 역할 카드 → 자기 역할로 온 활성 요청 → 상세 문서의 필요한 절만 읽습니다. 다른 역할의 작업이 필요할 때만 `docs/cowork_ground.md`에 요청을 남깁니다.

## 로컬 실행

요구 사항: Node.js 22.13+, Python 3.11/3.12, npm, 실제 분석용 OpenAI API 키.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local

python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements-dev.txt
pip install -r vlm/requirements-dev.txt
npm --prefix frontend ci
```

세 터미널에서 실행합니다.

```powershell
npm --prefix frontend run dev
python -m uvicorn backend.app.main:app --reload --port 8000
python -m uvicorn vlm.app.main:app --reload --port 8001
```

로컬 주소는 Frontend `http://localhost:3000`, Backend `http://localhost:8000`, VLM `http://localhost:8001`입니다. `.env`와 `.env.local`은 커밋하지 않습니다.

## 검증

```powershell
python -m pytest backend/tests vlm/tests
npm --prefix frontend run lint
npm --prefix frontend run build
```

## AWS 배포 기준

Frontend는 Amplify Hosting, Backend는 서울 리전(`ap-northeast-2`)의 API Gateway HTTP API, Cognito, Lambda, S3, SQS, DynamoDB 조합으로 배포합니다. 공개 Lambda Function URL은 사용하지 않습니다.

1. Frontend 담당자가 정확한 운영 origin을 전달
2. `infra/build-backend-lambda.ps1`로 Backend Linux Lambda ZIP 생성
3. `infra/backend-secure.yaml`로 API Gateway/Lambda 스택 배포
4. 출력된 API/Cognito 설정을 Frontend 담당자에게 전달
5. Cognito 로그인 → S3 PUT → 분석 생성 → 결과 polling 스모크 테스트
6. 기존 Function URL이 이미 있다면 통합 검증 후 별도 승인으로 정리

이미지는 presigned URL로 S3에 직접 업로드하며 기본 상한은 10MiB입니다. Frontend 빌드는 저장소 루트의 `amplify.yml`, Backend 배포는 `infra/backend-secure.yaml`을 사용합니다. 세부 절차는 `docs/frontend.md`, `infra/README.md`, `docs/backend.md`에서 관리합니다.

## 문서

- `docs/frontend.md`: 화면, API 사용, Amplify
- `docs/backend.md`: 공개 API, 오류 변환, Lambda
- `docs/vlm.md`: 분석 파이프라인, 내부 인증, Lambda
- `docs/cowork_ground.md`: 역할 간 요청과 완료 증거
- `infra/README.md`: Backend AWS 패키징·배포 절차
- `shared/docs/architecture.md`: 서비스 경계
- `shared/docs/api-contract.md`: API 계약
