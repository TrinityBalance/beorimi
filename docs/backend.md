# Backend 작업 가이드

Backend는 Frontend가 호출하는 유일한 공개 API이며, VLM 관찰 결과와 품목·수수료 데이터, 규정 근거를 결합해 최종 배출 정보를 만드는 영역입니다.

## 책임 경계

Backend 담당 범위:

- 공개 FastAPI 엔드포인트와 요청 검증
- Frontend CORS 정책
- VLM 서비스 호출과 오류 변환
- 강남구 품목·수수료 데이터 저장소
- 규정 문서 검색과 RAG
- LangGraph 기반 분석 흐름과 근거 추적
- 최종 응답 조립, DB, 기록 정책

Backend는 이미지 자체를 판독하지 않습니다. VLM의 관찰을 입력으로 사용하되, 수수료·신고 필요 여부·배출 방법의 최종 판단은 Backend가 담당합니다.

## 현재 상태

- FastAPI 앱과 `/api` 라우터 구성
- Backend·VLM 상태 확인과 이미지 분석 프록시 구현
- CORS 허용 출처 환경 변수 지원
- 품목 조회 API는 `501 Not Implemented`
- DB, 폐기물 저장소, RAG 서비스는 골격만 존재
- Agent 상태와 첫 노드만 있으며 LangGraph는 아직 연결되지 않음

## 구조

```text
backend/
├─ app/
│  ├─ api/
│  │  ├─ routes/           # HTTP 엔드포인트
│  │  └─ dependencies.py   # 설정·클라이언트 의존성 제공
│  ├─ agents/              # 분석 상태, 노드, 그래프
│  ├─ core/                # 환경 설정과 DB 기반 구성
│  ├─ models/              # 영속 모델
│  ├─ repositories/        # 품목·규정 데이터 접근
│  ├─ schemas/             # API·서비스 입출력 모델
│  ├─ services/            # VLM, 폐기물 조회, RAG 업무 로직
│  ├─ data/                # 커밋 가능한 데이터 안내만 유지
│  └─ main.py              # 앱, 미들웨어, 라우터 조립
├─ tests/
├─ .env.example
├─ apprunner.yaml
├─ requirements-dev.txt    # 로컬 개발·테스트 의존성
└─ requirements.txt
```

## 계층별 작업 원칙

### Routes

- HTTP 입력 검증, 의존성 주입, 상태 코드와 응답 변환만 담당합니다.
- 데이터 조회나 분석 순서를 라우트 함수에 직접 쌓지 않습니다.

### Services

- 외부 VLM 호출, 품목 매칭, RAG 답변 같은 업무 단위를 담당합니다.
- 외부 서비스 오류는 Frontend가 처리할 수 있는 Backend 오류로 변환합니다.

### Repositories

- DB·파일·외부 데이터 API 접근을 캡슐화합니다.
- 품목 데이터의 출처, 적용 지역, 확인·갱신 시점을 추적할 수 있어야 합니다.

### Agents

- VLM 관찰 → 품목 매칭 → 규정 검색 → 교차 검증 → 최종 응답 순서를 조립합니다.
- `AnalysisState.evidence_path`와 `errors`를 유지해 판단 근거와 실패 지점을 추적합니다.
- LangGraph 의존성과 전체 그래프는 공통 최종 응답 계약을 확정한 뒤 연결합니다.

## 요청 흐름

```text
POST /api/analysis
  → 업로드 파일 검증
  → VlmClient가 VLM POST /analyze 호출
  → 구조화된 관찰 결과 수신
  → 품목 저장소 매칭 (예정)
  → 규정 RAG와 교차 검증 (예정)
  → 최종 배출 정보 응답 (예정)
```

## 현재 API

| Method | Endpoint | 상태 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 동작 | Backend 상태 확인 |
| `POST` | `/api/analysis` | 동작 | 이미지 파일을 VLM에 전달하고 관찰 결과 반환 |
| `GET` | `/api/waste/{item_name}` | 미연결 | 품목별 배출 정보 조회. 현재 `501` 반환 |

서버 실행 후 <http://localhost:8000/docs>에서 대화형 API 문서를 확인할 수 있습니다.

계약 원본:

- `shared/api/openapi.yaml`
- `shared/schemas/analysis-request.json`
- `shared/schemas/analysis-response.json`
- `shared/docs/api-contract.md`

요청·응답을 바꿀 때는 공통 계약을 먼저 수정하고 Frontend·VLM 담당자에게 공유합니다.

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `APP_NAME` | `Beorimi API` | FastAPI 앱 이름 |
| `VLM_BASE_URL` | `http://localhost:8001` | Backend가 호출할 VLM 주소 |
| `DATABASE_URL` | `sqlite:///./beorimi.db` | Backend 데이터베이스 주소 |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000` | 허용할 Frontend 출처 목록 |

`CORS_ALLOW_ORIGINS`는 콤마로 여러 출처를 구분합니다. 스킴과 포트를 포함하고 끝 슬래시는 제외합니다.

```dotenv
CORS_ALLOW_ORIGINS=http://localhost:3000,https://main.example.amplifyapp.com
```

## 실행과 검증

프로젝트 루트에서 실행합니다.

```powershell
pip install -r backend/requirements-dev.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

```powershell
Invoke-RestMethod http://localhost:8000/api/health
python -m pytest backend/tests
```

VLM 프록시를 검증하려면 VLM 서버도 실행한 뒤 이미지를 전송합니다.

```powershell
curl.exe -X POST -F "file=@C:\path\to\waste.jpg" http://localhost:8000/api/analysis
```

## 구현 규칙

- 요청·응답에는 명시적인 Pydantic 스키마를 사용하고 공통 JSON Schema와 동기화합니다.
- 외부 HTTP 호출에는 제한 시간과 예측 가능한 오류 처리를 둡니다.
- 품목을 찾지 못했을 때 임의 수수료를 만들지 않습니다.
- VLM 원본 관찰, 사용자 확정 품목, 규정 근거를 서로 구분합니다.
- 이미지·조회 기록의 저장 범위와 보관 기간을 명시합니다.
- 라우트, 서비스, 저장소의 단위 테스트를 분리하고 외부 서비스는 테스트 대역으로 교체합니다.

## 배포

`backend/apprunner.yaml`은 AWS App Runner Python 3.11 배포 구성을 정의합니다.

- 빌드: `pip install -r requirements.txt`
- 실행: `uvicorn app.main:app --host 0.0.0.0 --port 8080`
- 서비스 포트: `8080`
- `VLM_BASE_URL`: 먼저 배포한 VLM App Runner HTTPS 주소로 교체
- `CORS_ALLOW_ORIGINS`: Amplify 배포 도메인으로 교체

권장 배포 순서는 `VLM → Backend → Frontend`입니다. 각 서비스 주소가 확정되면 다음 서비스 환경 변수에 전달합니다.

## 다음 작업

- [ ] 품목·수수료 데이터 원천과 갱신 정책 확정
- [ ] Repository와 DB 모델 구현
- [ ] `GET /api/waste/{item_name}` 구현
- [ ] 규정 문서 적재·검색과 RAG 구현
- [ ] 최종 분석 응답 스키마 확정
- [ ] LangGraph 노드와 전체 분석 그래프 연결
- [ ] 외부 호출 오류·재시도·로깅 정책
- [ ] 분석·품목·RAG 단위 및 통합 테스트

## 완료 기준

- Frontend가 VLM을 직접 호출하지 않고 모든 기능을 Backend로 수행한다.
- 공식 근거가 있는 품목·수수료·배출 방법을 반환한다.
- 낮은 신뢰도와 품목 미일치 상태를 명시적으로 응답한다.
- 외부 서비스 실패가 통제된 상태 코드와 메시지로 변환된다.
- 테스트와 OpenAPI·JSON Schema 계약 검증이 통과한다.
