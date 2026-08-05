# VLM 작업 가이드

VLM 서비스는 사진을 관찰해 대형 폐기물 후보와 시각적 근거를 구조화해서 반환합니다. 수수료, 신고 필요 여부, 최종 배출 방법은 판단하지 않습니다.

## 책임 경계

VLM 담당 범위:

- 지원 이미지 탐색·검증과 전처리
- 이미지 크기 축소, JPEG 변환, Base64 인코딩
- 모델 프롬프트와 구조화 출력 스키마
- OpenAI Responses API 추론
- 결과 캐시와 디버그 진행 상태
- 위치 상자 오버레이 이미지 생성
- 독립 FastAPI API와 로컬 CLI

품목·수수료 데이터 조회, 규정 RAG, 최종 사용자 문구는 Backend 담당입니다.

## 현재 상태

- FastAPI `GET /health`, `POST /analyze` 구현
- JPG, JPEG, PNG, WebP, BMP 지원
- 긴 변을 최대 1024px로 축소하고 JPEG 품질 85로 정규화
- 엄격한 JSON Schema 기반 폐기물 관찰 결과
- OpenAI 제공자와 이후 로컬 제공자를 교체할 수 있는 제공자 인터페이스
- 프롬프트·스키마·모델·입력 이미지 해시 기반 JSON 캐시
- 업로드 크기, 이미지 디코딩, 설정, 시간 초과, 일시 장애, 잘못된 응답 오류 처리
- 단일 이미지·복수 이미지·폴더 CLI와 오버레이 출력

## 구조

```text
vlm/
├─ app/
│  ├─ main.py              # FastAPI 엔드포인트와 CLI
│  ├─ preprocessing.py     # 이미지 탐색·축소·인코딩·해시
│  ├─ inference.py         # 프롬프트, 모델 호출, 캐시
│  ├─ schemas.py           # 관찰 스키마 로드·검증
│  ├─ providers/           # OpenAI 및 이후 로컬 VLM 제공자 경계
│  └─ postprocessing.py    # 위치 상자 오버레이 생성
├─ schemas/
│  └─ observation-response.json # VLM 내부 상세 관찰 계약
├─ prompts/
│  └─ waste_classifier.txt # 시스템 프롬프트
├─ data/photos/            # 로컬 테스트 이미지, Git 제외
├─ models/                 # 로컬 모델 자리, 가중치 Git 제외
├─ tests/
├─ .env.example
├─ apprunner.yaml
├─ requirements-dev.txt    # 로컬 개발·테스트 의존성
└─ requirements.txt
```

## 처리 과정

```text
이미지 경로 또는 업로드
  → 확장자·빈 파일 검사
  → RGB 변환과 최대 1024px 축소
  → JPEG 인코딩과 SHA-256 해시
  → 캐시 조회
  → 선택한 제공자에 시스템 프롬프트 + 이미지 전달
  → 엄격한 JSON Schema 결과 파싱
  → 캐시 저장
  → API JSON 또는 CLI 출력
```

API 업로드는 임시 파일에 기록한 뒤 성공·실패와 관계없이 삭제합니다.

## 관찰 결과

최상위 필드:

- `schema_version`, `status`: 스키마 버전과 성공·재촬영·미지원 상태
- `scene_type`: 단일 품목, 복수 품목, 불명확 장면
- `image_quality`: 사진 사용 가능 여부와 재촬영 사유
- `items`: 발견한 폐기물 후보 목록
- `notes`: 장면 전체 참고사항

주요 품목 필드:

- `label`, `alternatives`, `category`, `material`, `quantity`
- `estimated_longest_side_cm`, `size_basis`, `measurement_required`
- `condition`, `contamination`
- `confidence`, `confidence_tier`, `needs_user_confirmation`, `confirm_question`
- `visual_evidence`: 사진에서 직접 확인한 판별 근거
- `bbox`: 0~1000 정규화 좌표의 `[left, top, right, bottom]`

VLM 내부 스키마 원본은 `vlm/schemas/observation-response.json`입니다. 공용 API 계약을 직접 수정하지 않고, Backend 연동 전에 다음 계약과의 필드 매핑을 팀과 합의합니다.

- `shared/schemas/analysis-response.json`
- `shared/api/openapi.yaml`
- `shared/docs/api-contract.md`

VLM 스키마와 공통 응답 스키마가 달라지면 Backend·Frontend 연동 전에 반드시 합의합니다.

## API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/health` | VLM 서비스 상태 확인 |
| `POST` | `/analyze` | `multipart/form-data`의 `file` 이미지를 구조화 판독 |

지원하지 않는 확장자는 `415`, 빈 파일·이미지 디코딩 오류는 `400`, 큰 파일은 `413`을 반환합니다. 제공자 설정·일시 장애는 `503`, 시간 초과는 `504`, 잘못된 제공자 응답은 `502`로 구분합니다. 서버 실행 후 <http://localhost:8001/docs>에서 대화형 API 문서를 확인할 수 있습니다.

## 환경 변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 필수 | OpenAI 추론 인증 |
| `VLM_PROVIDER` | `openai` | 사용할 VLM 제공자 |
| `OPENAI_VLM_MODEL` | `gpt-5.6-sol` | OpenAI 제공자 모델 |
| `OPENAI_TIMEOUT_SECONDS` | `60` | OpenAI 요청 제한 시간 |
| `VLM_MAX_UPLOAD_MB` | `10` | API 이미지 최대 크기 |
| `VLM_IMAGE_DIR` | `vlm/data/photos` | CLI 인자가 없을 때 읽을 폴더 |
| `VLM_CACHE_DIR` | `vlm/.vlm_cache` | 판독 결과 JSON 캐시 |

`.env.example`의 상대 경로는 명령을 실행하는 현재 디렉터리를 기준으로 해석됩니다. 프로젝트 루트에서 실행할 때는 필요하면 다음처럼 명시합니다.

```dotenv
VLM_IMAGE_DIR=./vlm/data/photos
VLM_CACHE_DIR=./vlm/.vlm_cache
```

API 키는 `.env`, 로그, 프롬프트, 배포 설정 파일에 직접 남기지 않습니다.

## 서버 실행과 검증

프로젝트 루트에서 실행합니다.

```powershell
pip install -r vlm/requirements-dev.txt
python -m uvicorn vlm.app.main:app --reload --port 8001
```

```powershell
Invoke-RestMethod http://localhost:8001/health
python -m pytest vlm/tests
```

직접 API 호출:

```powershell
curl.exe -X POST -F "file=@C:\path\to\waste.jpg" http://localhost:8001/analyze
```

## CLI

단일 이미지:

```powershell
python -m vlm.app.main C:\path\to\waste.jpg --verbose
```

복수 이미지 또는 폴더:

```powershell
python -m vlm.app.main image1.jpg image2.png
python -m vlm.app.main C:\path\to\photos
```

오버레이와 캐시 제어:

```powershell
python -m vlm.app.main C:\path\to\waste.jpg --overlay --no-cache
```

- `--verbose`: 5단계 진행 상태 표시
- `--overlay`: 위치 상자가 표시된 이미지 저장
- `--output-dir`: 오버레이 출력 폴더 변경
- `--no-cache`: 기존 캐시를 사용하지 않고 다시 추론

## 프롬프트·스키마 변경 절차

1. 수수료 판단이 아니라 이미지에서 관찰 가능한 정보인지 확인합니다.
2. `prompts/waste_classifier.txt`와 `schemas/observation-response.json`의 의미를 함께 맞춥니다.
3. 기존 샘플 이미지로 단일·복수·불명확 장면을 비교합니다.
4. 공용 필드 변경이 필요하면 직접 수정하지 않고 협업 요청으로 합의합니다.
5. 캐시 의미가 달라졌다면 `CACHE_VERSION`을 변경해 이전 결과와 분리합니다.

## 배포

`vlm/apprunner.yaml`은 AWS App Runner Python 3.11 배포 구성을 정의합니다.

- 빌드: `pip install -r requirements.txt`
- 실행: `uvicorn app.main:app --host 0.0.0.0 --port 8080`
- 서비스 포트: `8080`
- `VLM_MODEL`: App Runner 환경 변수
- `OPENAI_API_KEY`: 콘솔에서 Secrets Manager 또는 SSM Parameter Store 참조로 주입

VLM을 먼저 배포하고 발급된 HTTPS 주소를 Backend의 `VLM_BASE_URL`에 설정합니다. API 키를 `apprunner.yaml`에 직접 적지 않습니다.

## 다음 작업

- [x] API 업로드 크기 제한과 이미지 디코딩 오류 처리
- [x] 모델 호출 제한 시간·재시도·오류 응답 정책
- [ ] 대표 실제 사진 평가 세트와 품질 지표
- [ ] 낮은 신뢰도·복수 품목·크기 추정 회귀 테스트
- [ ] 공통 응답 스키마와 VLM 상세 스키마 정합성 확정
- [ ] 캐시 보관·삭제와 개인정보 처리 정책
- [ ] 배포 환경 관측성, 비용과 지연 시간 측정

## 완료 기준

- 지원 이미지에서 유효한 구조화 JSON을 안정적으로 반환한다.
- 불확실한 장면은 낮은 신뢰도와 확인 질문으로 표현한다.
- 같은 이미지의 캐시 사용과 강제 재추론이 구분된다.
- API 임시 파일이 성공·실패 후 모두 삭제된다.
- 테스트가 외부 API 호출 없이 전처리와 API 기본 동작을 검증한다.
