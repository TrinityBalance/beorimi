# API contract

## `POST /api/analysis`

`multipart/form-data`의 `file` 필드로 이미지를 전송합니다. 백엔드는 VLM 서비스의 구조화된 관찰 결과를 그대로 반환합니다.

계약 원본은 다음 파일입니다.

- `shared/api/openapi.yaml`
- `shared/schemas/analysis-request.json`
- `shared/schemas/analysis-response.json`

VLM은 관찰만 담당하고, 수수료·배출 가능 여부의 최종 판단은 백엔드가 담당합니다.
