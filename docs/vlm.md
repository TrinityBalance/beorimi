# VLM 작업 가이드

## 운영 경로

운영 VLM 호출은 `supabase/functions/analyze/index.ts`에서 OpenAI Responses API로 실행됨. Edge Function은 private Storage signed URL을 짧게 발급하고, 모델에는 이미지 관찰만 요청함.

- Structured Outputs로 공개 `analysis-response` 계약과 guardrail 신호를 함께 검증함.
- prompt injection 신호, 일관성 없는 guardrail, 의심 문자열이 있으면 결과를 저장하지 않고 `failed` 처리함.
- 일시 실패는 queued로 돌리고 최대 3회 시도 후 `failed` 처리함.

## 로컬 VLM

`vlm/`의 Python API/CLI는 프롬프트·스키마 실험용으로 유지함. App Runner 배포 설정은 운영 경로가 아님.

```powershell
python -m pytest vlm/tests
```
