# Backend 작업 가이드

## 책임 경계

- 소유: `backend/**`, Backend 테스트, `docs/backend.md`, Backend AWS 인프라
- Frontend가 호출하는 공개 API와 사용자별 데이터 경계를 책임집니다.
- VLM의 관찰 결과와 공공 배출 규칙을 결합해 최종 결과를 결정합니다.
- 계약 변경은 먼저 `shared/**`에 반영합니다.
- Frontend/VLM 코드 변경이 필요하면 `docs/cowork_ground.md`에 요청합니다.

## 현재 아키텍처

```text
Frontend
  ├─ Cognito 로그인 → JWT
  ├─ POST /api/uploads → 크기 제한 presigned S3 POST form
  ├─ S3에 이미지 직접 업로드
  └─ POST /api/analyses → SQS → Worker → DynamoDB
                                 ↑             ↓
                         GET /api/analyses/{id}
```

API Gateway가 Cognito JWT를 검증하고, Backend는 전달된 `sub`를 사용자 식별자의 기준으로 사용합니다. Identity Pool의 `identityId`와 혼용하지 않습니다.

실제 VLM 호출은 API Gateway의 최대 통합 시간보다 길 수 있으므로 worker에서 비동기로 실행합니다. Worker는 S3 객체를 재검증한 뒤 서비스 토큰으로 VLM을 호출하고 관찰 결과를 DynamoDB에 저장합니다.

기존 `POST /api/analysis` 동기식 경로는 로컬 호환용입니다. 운영 HTTP API Gateway에는 노출하지 않습니다.

## 계층별 작업 원칙

```text
backend/app/
├─ api/routes/          # HTTP 입력·상태 코드·응답 변환
├─ api/auth.py          # API Gateway JWT claims 추출
├─ api/dependencies.py  # AWS 클라이언트와 서비스 주입
├─ services/            # 업로드·분석 작업 흐름
├─ repositories/        # DynamoDB 접근
├─ workers/             # SQS 비동기 처리
├─ schemas/             # Pydantic 입출력 모델
├─ agents/              # 향후 VLM/RAG 오케스트레이션
└─ core/                # 환경 설정
```

Routes는 HTTP 처리, Services는 업무 흐름, Repositories는 저장소 접근만 담당합니다.

## 공개 API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/health` | 없음 | Backend 상태 확인 |
| POST | `/api/uploads` | Cognito JWT | 크기 제한이 적용된 사용자 전용 S3 POST form 생성 |
| POST | `/api/analyses` | Cognito JWT | 업로드 확인 후 분석 작업 생성(202) |
| GET | `/api/analyses/{id}` | Cognito JWT | 본인 작업 상태와 결과 조회 |
| POST | `/api/analysis` | 로컬 전용 | 동기 VLM 호출, 운영 Gateway 미노출 |

전체 요청·응답은 `shared/api/openapi.yaml`과 `shared/schemas/**`가 원본입니다. 존재하지 않는 작업과 다른 사용자의 작업은 모두 404로 반환해 소유 여부를 노출하지 않습니다.

## 업로드 규칙

- 지원 형식: JPEG, PNG, WebP
- 최대 원본 크기: 기본 10MiB
- 키: `waste-images/{cognito-sub}/{uuid}.{ext}`
- presigned POST 기본 만료: 5분
- 응답의 form 필드와 파일을 multipart/form-data로 S3에 POST
- S3 policy에서 `Content-Type`과 1~10MiB 범위를 강제
- 분석 생성 전에 Backend가 S3 객체의 존재, 크기, 형식을 다시 확인

## 분석 상태

```text
queued → processing → completed
                    ↘ failed
```

DynamoDB 레코드는 기본 30일 후 TTL 정리 대상입니다. 원본 S3 이미지도 같은 기간 후 lifecycle로 만료됩니다. TTL/lifecycle 삭제 시점은 즉시가 아닐 수 있습니다.

## 계획된 LangGraph 흐름

```text
START → analyze_image → classify_items → retrieve_regulations → validate_results
                                                        ├─ high confidence → calculate_fee → generate_answer → END
                                                        └─ low confidence  → ask_user(interrupt)
                                                                                  ↓ resume
                                                                            classify_items
```

`analyze_image`는 이미지 관찰만 담당하고 `classify_items`가 공공 폐기물 품목 체계에 매핑합니다. `ask_user`는 worker 안에서 대기하지 않고 durable checkpointer에 상태를 저장한 뒤 API 응답을 `needs_confirmation`으로 전환합니다. 사용자가 답하면 같은 `analysis_id`를 LangGraph `thread_id`로 사용해 재개합니다. 재개 시 interrupt 노드가 처음부터 다시 실행되므로 interrupt 이전 부수 효과는 멱등이어야 합니다.

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `AWS_REGION` | `ap-northeast-2` | Backend AWS 리전 |
| `IMAGE_BUCKET_NAME` | 없음 | 사용자 이미지 S3 버킷 |
| `ANALYSIS_TABLE_NAME` | 없음 | 분석 작업 DynamoDB 테이블 |
| `ANALYSIS_QUEUE_URL` | 없음 | 분석 SQS URL |
| `PRESIGNED_URL_TTL_SECONDS` | `300` | 업로드 URL 유효 시간 |
| `MAX_SOURCE_IMAGE_BYTES` | `10485760` | S3 원본 이미지 상한 |
| `ANALYSIS_RETENTION_DAYS` | `30` | 작업·이미지 보존 기간 |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000` | 콤마 구분 Frontend origin |
| `VLM_BASE_URL` | `http://localhost:8001` | Worker·레거시 VLM 주소 |
| `VLM_SERVICE_TOKEN` | 없음 | Backend→VLM 인증 |
| `VLM_TIMEOUT_SECONDS` | `90` | VLM 호출 제한 시간 |
| `MAX_UPLOAD_BYTES` | `4194304` | 레거시 동기 업로드 상한 |
| `ANALYSIS_MAX_RECEIVE_COUNT` | `3` | Worker가 terminal 실패를 기록할 SQS 시도 횟수 |

운영 CORS는 와일드카드를 사용하지 않고 스킴과 포트까지 정확한 origin을 설정합니다.

## 로컬 실행과 검증

```powershell
pip install -r backend/requirements-dev.txt
python -m uvicorn backend.app.main:app --reload --port 8000
Invoke-RestMethod http://localhost:8000/api/health
python -m pytest backend/tests
```

보안 API의 AWS 의존성은 테스트에서 주입한 fake로 검증합니다. 로컬에서 실제 S3/DynamoDB/SQS를 호출하려면 해당 환경 변수와 최소 권한 AWS 자격 증명이 필요합니다.

## AWS 배포

- 배포 템플릿: `infra/backend-secure.yaml` — Cognito, S3, DynamoDB, SQS, API/worker Lambda, HTTP API
- 패키징: `infra/build-backend-lambda.ps1`
- 배포: `infra/deploy-backend-secure.ps1`

스택은 데이터 리소스에 `Retain`을 설정합니다. 기존 배포가 있으면 별도 이름으로 먼저 배포한 뒤 Frontend 통합 검증 후 트래픽을 전환합니다. Root 계정 대신 배포 전용 IAM 역할을 사용하고 예산 알림을 설정합니다.

## 다음 Backend 작업

- [ ] 공공 배출 수수료 데이터 저장소와 `/api/waste/{item_name}` 연결
- [ ] SQS DLQ·Lambda 오류율·API 5xx CloudWatch 알람 추가
- [ ] 사용자별 분석 목록 API를 구현할 때 GSI와 최소 IAM 조회 권한을 함께 추가
- [ ] LangGraph checkpoint와 `needs_confirmation` 공개 상태 계약 추가
