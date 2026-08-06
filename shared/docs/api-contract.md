# API contract

Completed analysis observations may include `estimated_fee`, `estimated_fee_min`, `estimated_fee_max`, and `fee_size_label` on each item. These are backend catalog estimates, never VLM output. When the visible specification does not identify one official fee, `estimated_fee` is null and the min/max fields expose the matching official fee range; final fees remain subject to official reporting confirmation.

계약 원본은 `shared/api/openapi.yaml`, `shared/schemas/**`임.

## 인증

`/api/health` 외 공개 API는 Supabase access token을 `Authorization: Bearer <token>`으로 받음. 서버는 JWT의 user id로 소유권을 확인함.

## 업로드·비동기 분석

1. `POST /api/uploads`가 사용자 전용 `image_key`, 일회용 `upload_token`을 반환함.
2. 브라우저가 Supabase Storage `uploadToSignedUrl`로 이미지를 직접 올림.
3. `POST /api/analyses`가 `202 queued` 분석 job을 생성함.
4. Supabase trigger가 Edge Function worker를 비동기로 호출함.
5. 클라이언트는 `GET /api/analyses/{id}`를 terminal 상태까지 polling함.

지원 형식은 JPEG, PNG, WebP이고 최대 10MiB임. job과 원본 이미지는 30일 뒤 정리됨. 계정당 MVP 분석 횟수는 누적 5회임.
