# Beorimi (버리미)

사진 속 대형 폐기물 후보를 판별하고, 품목별 수수료와 배출 방법을 안내하는 모바일 우선 서비스입니다. 사용자는 사진을 촬영하거나 업로드하고, AI가 제안한 품목을 확인·수정한 뒤 강남구 공식 신고 페이지로 이동할 수 있습니다.

> 현재는 **서비스 골격과 VLM 분석 경로를 구축한 초기 MVP 단계**입니다. 프런트엔드는 기본 화면 상태이며, 강남구 품목 데이터·RAG·최종 결과 화면은 아직 연결되지 않았습니다.

## MVP 사용자 흐름

```text
사진 촬영 또는 업로드
  → VLM이 폐기물 후보·신뢰도·위치·크기를 구조화해 반환
  → 사용자가 품목을 확인하거나 수정
  → Backend가 강남구 품목·수수료·배출 규정을 조회하고 교차 검증
  → 수수료·배출 방법·주의사항 표시
  → 강남구 공식 신고 페이지로 연결
```

AI 결과는 하나의 품목으로 단정하지 않습니다. 신뢰도가 낮거나 비슷한 품목이 있으면 후보와 확인 질문을 함께 제공하는 것을 원칙으로 합니다.

## 서비스 구성

| 영역 | 책임 | 현재 상태 | 작업 문서 |
| --- | --- | --- | --- |
| Frontend | 촬영·업로드, 분석 진행, 결과·신고 UI | Next.js 기본 화면 | [`docs/frontend.md`](docs/frontend.md) |
| Backend | 공개 API, 품목 조회, RAG, 분석 오케스트레이션 | VLM 프록시와 API 골격 | [`docs/backend.md`](docs/backend.md) |
| VLM | 이미지 전처리와 구조화 판독 | API·CLI·캐시 구현 | [`docs/vlm.md`](docs/vlm.md) |
| Shared | 서비스 간 API·데이터 계약 | 초기 분석 계약 구현 | [`shared/`](shared/) |

## 역할별 작업 방식

작업자는 시작할 때 자신의 주 역할을 **Frontend**, **Backend**, **VLM** 중 하나로 정하고 해당 작업 가이드를 먼저 읽습니다.

| 역할 | 기본 소유 범위 | 먼저 읽을 문서 | 기본 검증 |
| --- | --- | --- | --- |
| Frontend | `frontend/`, `docs/frontend.md` | [`docs/frontend.md`](docs/frontend.md) | `npm --prefix frontend run lint`, `npm --prefix frontend run build` |
| Backend | `backend/`, `docs/backend.md` | [`docs/backend.md`](docs/backend.md) | `python -m pytest backend/tests` |
| VLM | `vlm/`, `docs/vlm.md` | [`docs/vlm.md`](docs/vlm.md) | `python -m pytest vlm/tests` |

- 각 작업자는 자기 소유 범위의 구현·테스트·문서를 함께 관리합니다.
- 다른 역할의 폴더는 명확한 연동 필요가 있을 때만 수정하고, 변경 이유와 영향을 관련 작업자에게 공유합니다.
- API나 데이터 구조가 바뀌면 `shared/` 계약을 먼저 수정한 뒤 제공 서비스와 소비 서비스를 순서대로 반영합니다.
- 여러 영역에 걸친 작업은 하나의 역할인 것처럼 처리하지 않고, 영향을 받는 모든 영역의 작업 가이드와 검증 명령을 적용합니다.
- 루트 `README.md`는 전체 구조와 공통 실행 방식이 바뀔 때만 수정하고, 영역별 세부사항은 각 작업 가이드에 기록합니다.

## 아키텍처

```text
Browser
  → frontend:3000 (Next.js)
  → backend:8000 (FastAPI)
      ├─ vlm:8001 → OpenAI Responses API
      ├─ waste repository (예정)
      └─ RAG / LangGraph (예정)
```

- Frontend는 VLM을 직접 호출하지 않고 Backend API만 사용합니다.
- VLM은 이미지 관찰 결과만 반환합니다.
- 수수료, 신고 필요 여부, 배출 방법의 최종 판단은 Backend가 담당합니다.
- API 변경 시 [`shared/api/openapi.yaml`](shared/api/openapi.yaml)과 [`shared/schemas/`](shared/schemas/)를 먼저 갱신합니다.

## 디렉터리 구조

```text
beorimi/
├─ frontend/   # Next.js 모바일 웹/PWA
├─ backend/    # FastAPI 공개 API와 분석 오케스트레이션
├─ vlm/        # 이미지 전처리와 VLM 추론
├─ shared/     # OpenAPI, JSON Schema, 공통 문서
└─ docs/       # 영역별 작업 가이드, 조사·기획·협업 문서
```

## 요구 환경과 공통 설치

- Node.js 20 이상
- Python 3.11 또는 3.12
- npm
- 실제 이미지 분석용 OpenAI API 키

PowerShell에서 프로젝트 루트를 기준으로 실행합니다.

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

비밀키가 들어간 `.env`와 `frontend/.env.local`은 커밋하지 마세요.

## 로컬 실행

세 터미널에서 각각 실행합니다.

```powershell
# Frontend — http://localhost:3000
npm --prefix frontend run dev

# Backend — http://localhost:8000
python -m uvicorn backend.app.main:app --reload --port 8000

# VLM — http://localhost:8001
python -m uvicorn vlm.app.main:app --reload --port 8001
```

각 명령은 별도 터미널에서 유지해야 합니다. 상세 설정과 사용법은 해당 영역의 작업 문서를 참고하세요.

## 공통 검증

```powershell
python -m pytest backend/tests vlm/tests
npm --prefix frontend run lint
npm --prefix frontend run build
```

## 문서 안내

- [`docs/frontend.md`](docs/frontend.md): Frontend 구조, 화면 흐름, API 사용, Amplify 배포
- [`docs/backend.md`](docs/backend.md): Backend 계층, API, 설정, CORS, App Runner 배포
- [`docs/vlm.md`](docs/vlm.md): VLM 처리 과정, 응답 스키마, API·CLI, 캐시, App Runner 배포
- [`docs/cowork_ground.md`](docs/cowork_ground.md): 역할 간 요구사항, 응답, 차단 사유와 완료 근거를 추적하는 협업 보드
- [`shared/docs/architecture.md`](shared/docs/architecture.md): 전체 서비스 연결 구조
- [`shared/docs/api-contract.md`](shared/docs/api-contract.md): 공통 분석 API 계약
- [`docs/team-ground-rules.md`](docs/team-ground-rules.md): 브랜치, 커밋, PR과 협업 규칙

## 공통 협업 원칙

- Frontend → Backend → VLM 호출 경계를 유지합니다.
- 공통 API·스키마·환경 변수·배포 방식 변경은 관련 작업자와 먼저 공유합니다.
- 다른 역할의 작업이 필요한 요구사항은 [`docs/cowork_ground.md`](docs/cowork_ground.md)에 등록하고 상태와 완료 근거를 갱신합니다.
- API 키, 모델 가중치, 대용량 이미지, 로컬 DB와 캐시는 저장소에 커밋하지 않습니다.
- 영역별 구현 상태와 다음 작업은 각 작업 문서에서 관리하고, 프로젝트 전체 흐름이 바뀔 때만 루트 README를 갱신합니다.
