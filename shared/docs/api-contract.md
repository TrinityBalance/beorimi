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

## 비동기 VLM 결과

worker는 VLM 관찰 결과를 `observation`에 저장합니다. 수수료·배출 규정 판단은 Backend 오케스트레이션이 추가될 때 별도 필드로 확장합니다.

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

`observation`은 `shared/schemas/analysis-response.json`을 따릅니다.

## 레거시 동기 API

`POST /api/analysis`는 `multipart/form-data`의 `file`을 VLM에 전달합니다. 기존 Function URL 호환용이며 새 보안 API Gateway에는 노출하지 않습니다. 오류 코드는 400, 413, 415, 502, 503, 504입니다.
