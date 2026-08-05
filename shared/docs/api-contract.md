# API contract

계약 원본은 `shared/api/openapi.yaml`과 `shared/schemas/**`입니다. 공개 필드명은 snake_case를 사용합니다.

## 인증

`/api/health`를 제외한 새 API는 API Gateway Cognito JWT authorizer로 보호합니다. Frontend는 `Authorization: Bearer {access-token}`을 전송합니다. Backend의 사용자 소유권 기준은 JWT의 `sub`입니다.

## 비동기 분석 흐름

1. `POST /api/uploads`로 사용자별 S3 POST form을 받습니다.
2. 응답의 `form_fields`를 `FormData`에 넣고 마지막 `file` 필드에 이미지를 추가해 `upload_url`로 POST합니다.
3. `POST /api/analyses`에 `image_key`를 보내 작업을 생성합니다.
4. 202 응답의 `id`로 `GET /api/analyses/{id}`를 polling합니다.
5. `status`가 `completed` 또는 `failed`이면 polling을 중단합니다.

허용 형식은 JPEG, PNG, WebP이며 기본 최대 크기는 10MiB입니다. S3 POST policy가 업로드 전에 크기와 `Content-Type`을 강제하고, Backend가 분석 생성 전에 객체를 다시 검증합니다. 다른 사용자의 key로 작업을 만들 수 없고, 다른 사용자의 작업 조회는 404입니다.

MVP 분석은 Cognito JWT의 `sub`를 기준으로 계정당 누적 5회까지 접수합니다. 이미지 검증 실패는 횟수에 포함하지 않으며, 분석 레코드를 만들기 전에 DynamoDB 조건부 증가로 횟수를 예약합니다. SQS 전송 결과가 불명확한 장애는 비용 상한을 우회하지 않도록 예약을 유지합니다. 한도를 모두 사용한 뒤의 `POST /api/analyses`는 `429`를 반환하며, 카운터는 분석 결과의 30일 보존 기간과 무관하게 유지됩니다.

## 비동기 VLM 결과

worker는 VLM 관찰 결과를 `observation`에 저장합니다. 수수료·배출 규정 판단은 Backend 오케스트레이션이 추가될 때 별도 필드로 확장합니다.
Backend worker는 S3에서 검증한 이미지 bytes를 `multipart/form-data`의 `file`로 VLM `POST /analyze`에 전달하고, `X-Beorimi-Service-Token` 헤더로 인증합니다. VLM은 토큰 설정 누락을 503, 누락·불일치를 401로 거절하며 10MiB를 초과하는 본문은 추론 전에 413으로 거절합니다.

VLM 내부 응답은 `shared/schemas/vlm-analysis-result.json`의 `{observation, guardrail}` 봉투를 따릅니다. `guardrail`은 이미지에 포함된 프롬프트 인젝션 신호만 열거형으로 전달하며 의심 문구 원문은 전달하지 않습니다. Backend worker는 LangGraph의 `inspect_prompt_injection` 노드에서 이 신호와 관찰 자유 텍스트를 함께 검사합니다. 차단되면 관찰을 저장하지 않고 작업을 `failed`로 종료하며, 통과한 `observation`만 아래 공개 응답에 저장합니다.

```json
{
  "status": "completed",
  "observation": {
    "scene_type": "unclear",
    "items": [],
    "notes": "사용자 확인 필요"
  }
}
```

`observation`은 `shared/schemas/analysis-response.json`을 따릅니다. VLM의 내부 상세 관찰에서 공용 응답으로 나올 때 `estimated_longest_side_cm`는 `longest_side_cm`로 이름을 바꾸고, 내부 품질·대안·시각 근거 필드는 제외합니다. 재촬영이 필요한데 `notes`가 비어 있으면 재촬영 안내 문구를 `notes`로 전달합니다.

## 레거시 동기 API

`POST /api/analysis`는 `multipart/form-data`의 `file`을 VLM에 전달합니다. 기존 Function URL 호환용이며 새 보안 API Gateway에는 노출하지 않습니다. 오류 코드는 400, 413, 415, 502, 503, 504입니다.
