# Architecture

```text
Browser → frontend:3000 → backend:8000 → vlm:8001 → OpenAI Responses API
                               ├─ waste repository
                               └─ RAG service
```

- `frontend`: Next.js App Router 기반 사용자 화면과 PWA
- `backend`: 공개 API, 수수료 조회, RAG, 분석 흐름 오케스트레이션
- `vlm`: 이미지 전처리, VLM 추론, 구조화 결과, 오버레이 생성
- `shared`: 서비스 간 API 및 데이터 계약의 기준 문서
