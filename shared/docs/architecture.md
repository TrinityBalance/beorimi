# Architecture

## 운영 흐름

```text
AWS Amplify (Next.js)
  ├─ Cognito User Pool ───────────── access token
  ├─ S3 image bucket ─────────────── presigned POST
  └─ API Gateway HTTP API
       └─ FastAPI API Lambda
            ├─ DynamoDB ─────────── analysis + account quota
            └─ SQS ──────────────── queued analysis
                 └─ Worker Lambda
                      ├─ S3 source image
                      ├─ VLM App Runner
                      │    └─ OpenAI Responses API
                      ├─ LangGraph injection guardrail
                      └─ DynamoDB result
```

## 책임 경계

| 영역 | 책임 | 하지 않는 일 |
| --- | --- | --- |
| Frontend | 로그인, 이미지 선택·업로드, 작업 polling, 결과 확인 UI | VLM 직접 호출, 수수료·규정 추론 |
| Backend API | 공개 계약, JWT 소유권, 업로드 발급, 작업 생성·조회, 계정 한도 | 장시간 VLM 동기 실행 |
| Backend worker | S3 재검증, VLM 호출, LangGraph 가드, 결과 저장 | 공개 HTTP 응답 대기 |
| VLM | 이미지 전처리, 구조화 관찰, 이미지 보안 신호 | 수수료·신고·최종 배출 판단 |
| shared | OpenAPI, JSON Schema, 서비스 간 계약 문서 | 런타임 구현 |

## 핵심 불변식

- 공개 분석은 `POST /api/analyses`와 polling을 사용하는 비동기 흐름만 제공합니다.
- 사용자 소유권과 누적 5회 한도는 Cognito access token의 `sub`를 기준으로 합니다.
- VLM 내부 응답은 `{observation, guardrail}`이며 Backend가 검증·차단한 `observation`만 공개 저장합니다.
- 이미지와 분석 레코드는 기본 30일 보존하지만 quota 레코드는 TTL 대상이 아닙니다.
- 운영 호스팅은 Amplify, API Gateway, Lambda, App Runner로 통일합니다.
