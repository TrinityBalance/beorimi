# Beorimi

사진으로 대형 폐기물 후보를 찾고, 사용자가 품목을 확인한 뒤 공식 배출 정보로 이어지는 모바일 우선 서비스입니다.

## MVP 상태

- Cognito 이메일 로그인과 계정별 누적 분석 5회 제한
- 브라우저에서 presigned POST로 S3에 직접 이미지 업로드
- SQS worker 기반 비동기 VLM 분석과 DynamoDB 결과 polling
- VLM 구조화 출력과 Backend LangGraph 이미지 프롬프트 인젝션 가드
- 다중 품목 확인 UI, 로컬 최근 기록, PWA 기본 구성
- AWS Amplify, API Gateway, Lambda, App Runner 배포 구성

품목별 수수료·규정 저장소와 최종 안내는 아직 데모 데이터입니다. 운영 판단은 Backend 데이터 계층이 연결된 뒤 제공해야 합니다.

## 기획과 협업 방식

프로젝트 기획 단계부터 작업을 화면, 서버, 모델 단위로 임시 분담하기보다 서로 독립적으로 구현하고 검증할 수 있는 Frontend, Backend, VLM 세 파트로 나눴습니다.

| 파트 | 초기 책임 |
| --- | --- |
| Frontend | 사진 촬영·선택, 업로드 진행 상태, 분석 결과 확인 UI |
| Backend | 공개 API, 사용자와 분석 작업 상태, 서비스 간 계약과 전체 흐름 조율 |
| VLM | 이미지 전처리, 모델 추론, 구조화된 이미지 관찰 결과 생성 |

초기 계획은 각 파트가 먼저 가장 작은 형태의 MVP를 완성하는 방식으로 구성했습니다. Frontend는 사진 선택부터 결과 화면까지, Backend는 요청·응답과 작업 상태 전이까지, VLM은 이미지 한 장을 구조화된 JSON으로 반환하는 지점까지 각각 독립적으로 실행해 봤습니다. 모든 기능을 완성한 뒤 한 번에 연결하기보다, 각 경계에서 실제 데이터가 한 차례 흐르게 만든 다음 그 결과를 기준으로 공통 스키마와 API 계약을 잡았습니다.

이 초기 MVP는 이후 통합에서 중요한 기준점이 됐습니다. 추측으로 필드를 설계하지 않고 Frontend 화면에 실제로 필요한 값, Backend가 저장하고 검증해야 하는 값, VLM이 안정적으로 제공할 수 있는 값을 함께 비교할 수 있었기 때문입니다. 이후 계약 변경도 `shared/**`를 먼저 수정하고, 제공하는 서비스와 사용하는 서비스를 차례로 맞추는 방식으로 진행했습니다.

협업은 역할별 브랜치를 분리하고 각 담당자가 자신의 브랜치에만 커밋하는 방식으로 운영했습니다. Frontend와 VLM 담당자는 각 브랜치에서 구현과 검증을 마친 뒤 변경 사항을 전달했고, Backend 담당자가 통합 책임자로서 서비스 경계와 공통 스키마를 확인한 후 브랜치를 병합했습니다. 통합 중 인터페이스 변경이 필요할 때도 한 파트에서 임의로 흡수하지 않고 공통 계약을 먼저 조정한 뒤 각 파트에 반영했습니다.

```text
파트별 초기 MVP
  → 실제 입출력 확인
  → 공통 스키마·OpenAPI 계약 확정
  → 역할별 브랜치 구현과 검증
  → Backend 담당자 통합 검증
  → main 병합
```

## 아키텍처

```text
Browser / Amplify
  ├─ Cognito 로그인
  ├─ S3 presigned POST
  └─ API Gateway → FastAPI Lambda → SQS → Worker Lambda
                                             ├─ VLM App Runner → OpenAI
                                             ├─ LangGraph guardrail
                                             └─ DynamoDB
```

분석은 항상 비동기입니다. `POST /api/analyses`는 `202 queued`를 반환하고, Frontend는 `GET /api/analyses/{id}`를 `completed` 또는 `failed`까지 polling합니다.

서비스 경계와 계약 원본:

- Frontend는 Backend만 호출합니다.
- VLM은 이미지 관찰과 제한된 보안 신호만 반환합니다.
- Backend가 공개 API, 사용자 소유권, 품목·규정·최종 판단을 책임집니다.
- `shared/api/openapi.yaml`, `shared/schemas/**`, `shared/docs/api-contract.md`가 계약 기준입니다.

## 로컬 준비

요구 사항은 Node.js 22.13 이상, Python 3.11/3.12, npm입니다.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local

python -m venv backend/.venv
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt

python -m venv vlm/.venv
vlm\.venv\Scripts\python.exe -m pip install -r vlm/requirements-dev.txt

npm --prefix frontend ci
```

세 터미널에서 실행합니다.

```powershell
npm --prefix frontend run dev
backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
vlm\.venv\Scripts\python.exe -m uvicorn vlm.app.main:app --reload --port 8001
```

로컬 주소는 Frontend `http://localhost:3000`, Backend `http://localhost:8000`, VLM `http://localhost:8001`입니다. API Gateway JWT claims가 없는 로컬 Backend에서 `/api/uploads`와 `/api/analyses`가 `401`인 것은 정상입니다.

## 검증

저장소 루트에서 실행합니다.

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests
vlm\.venv\Scripts\python.exe -m pytest vlm/tests
npm --prefix frontend run lint
npm --prefix frontend run build
```

## 배포와 비밀값

- Frontend: AWS Amplify
- 공개 API·worker: API Gateway + Lambda
- VLM: AWS App Runner
- `OPENAI_API_KEY`: Secrets Manager 또는 SSM에서 App Runner의 `OPENAI_API_KEY`로만 주입
- `VLM_SERVICE_TOKEN`: 별도 secret을 Backend worker와 VLM 양쪽에 주입
- `NEXT_PUBLIC_*`: 공개 설정만 허용하며 API 키나 서비스 토큰을 넣지 않음

Backend 패키징·배포는 `infra/README.md`, VLM 배포는 `docs/vlm.md`, Frontend 환경 설정은 `docs/frontend.md`를 따릅니다.

## 문서 지도

| 문서 | 내용 |
| --- | --- |
| `docs/frontend.md` | 화면, 인증, 업로드, Amplify |
| `docs/backend.md` | 공개 API, worker, LangGraph, Lambda |
| `docs/vlm.md` | 전처리, 구조화 출력, App Runner |
| `docs/product-backlog.md` | 데이터·품질·운영 후속 작업 |
| `docs/cowork_ground.md` | 역할 간 활성 요청과 완료 증거 |
| `shared/docs/architecture.md` | 서비스 경계와 데이터 흐름 |
| `shared/docs/api-contract.md` | 공개·내부 API 계약 |

에이전트 작업 규칙은 루트 `AGENTS.md`와 각 역할의 `AGENTS.md`가 기준입니다.
