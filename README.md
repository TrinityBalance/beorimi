# Beorimi

사진으로 대형 폐기물을 판별하고 배출 정보를 안내하는 모노레포입니다.

## 구성

- `frontend/`: Next.js 16 App Router 프런트엔드
- `backend/`: FastAPI 공개 API와 분석 오케스트레이션
- `vlm/`: 이미지 전처리와 VLM 판별 서버
- `shared/`: OpenAPI, JSON Schema, 아키텍처 문서
- `docs/`: 조사 및 기획 자료

## 로컬 실행

환경 변수 예제를 복사한 뒤 각 서비스를 실행합니다.

```powershell
Copy-Item .env.example .env

Set-Location frontend
npm run dev
```

별도 터미널에서 백엔드와 VLM을 실행합니다.

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
python -m uvicorn vlm.app.main:app --reload --port 8001
```

사진 폴더를 직접 분석하려면 프로젝트 루트에서 실행합니다.

```powershell
python -m vlm.app.main --verbose --overlay
```
