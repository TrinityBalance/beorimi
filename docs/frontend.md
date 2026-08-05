# Frontend 작업 가이드

Frontend는 사용자가 사진을 촬영·선택하고, 분석 과정을 확인하며, 최종 품목과 배출 정보를 검토하는 모바일 웹/PWA 영역입니다.

## 책임 경계

Frontend 담당 범위:

- 카메라 촬영과 앨범 업로드
- 이미지 미리보기, 재선택, 전송 전 검증·압축
- 분석 진행·성공·빈 결과·오류 상태 UI
- AI 후보와 신뢰도 표시, 사용자 품목 확인·수정
- 수수료·배출 방법·주의사항과 공식 신고 링크 표시
- 조회 기록, 도움말, PWA 설치 경험

Frontend는 VLM을 직접 호출하거나 수수료·배출 가능 여부를 자체 판단하지 않습니다. 모든 업무 데이터는 Backend API를 통해 받습니다.

## 현재 상태

- Next.js 16.3 App Router, React 19.2, TypeScript
- Tailwind CSS 4
- `src/app/page.tsx`는 Create Next App 기본 화면
- `src/lib/api.ts`에 Backend 기본 주소와 공통 JSON 요청 함수만 존재
- 카메라, 업로드, 화면 흐름, PWA, 기록 기능은 미구현

## 구조

```text
frontend/
├─ public/                 # 정적 이미지와 PWA 자산
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx        # 전역 레이아웃과 메타데이터
│  │  ├─ page.tsx          # 현재 홈 화면
│  │  └─ globals.css       # Tailwind와 전역 디자인 토큰
│  └─ lib/
│     └─ api.ts            # Backend API 공통 요청 함수
├─ .env.example
├─ next.config.ts
├─ package.json
└─ tsconfig.json
```

기능이 늘어나면 다음 방향으로 분리합니다.

```text
src/
├─ app/                    # 라우트, 레이아웃, 페이지 조립
├─ components/             # 재사용 UI와 기능 컴포넌트
├─ features/analysis/      # 사진 선택부터 결과까지의 상태와 UI
├─ lib/                    # API 클라이언트와 공통 유틸리티
└─ types/                  # shared 계약에서 파생한 Frontend 타입
```

단일 화면에서만 쓰는 코드는 해당 라우트 가까이에 두고, 실제 재사용이 생기기 전에는 공통 추상화를 만들지 않습니다.

## MVP 화면 흐름

```text
홈
  → 사진 촬영/선택
  → 사진 확인 및 재선택
  → 분석 진행
  → 후보 확인·수정
  → 수수료·배출 방법 결과
  → 강남구 공식 신고 페이지
```

우선순위:

1. 홈, 사진 확인, 분석 진행, 결과 화면
2. 파일 형식·용량·네트워크·분석 실패 처리
3. 낮은 신뢰도 후보와 사용자 수정 흐름
4. 수수료·배출법과 공식 신고 연결
5. 조회 기록, 도움말, PWA 설치

## Backend API 사용

기본 주소는 `NEXT_PUBLIC_API_BASE_URL`에서 읽으며, 미설정 시 `http://localhost:8000`을 사용합니다.

사진 분석은 Cognito 로그인 이후 다음 순서로 진행합니다.

1. Amplify Auth가 발급·갱신한 access token을 Backend 요청의 `Authorization: Bearer`에 넣습니다.
2. `POST /api/uploads` 응답의 `form_fields`와 `file`을 `FormData`에 넣어 S3 `upload_url`로 직접 POST합니다.
3. `POST /api/analyses`에 `image_key`를 보내 비동기 작업을 생성합니다.
4. `GET /api/analyses/{id}`를 `completed` 또는 `failed`까지 polling합니다.
5. `completed`의 `observation`을 결과 화면에 저장하고, `failed`와 400·401·404·503 응답은 재시도 가능한 사용자 메시지로 표시합니다.

요청·응답 기준은 다음 파일을 따릅니다.

- `shared/api/openapi.yaml`
- `shared/schemas/upload-url-request.json`
- `shared/schemas/upload-url-response.json`
- `shared/schemas/analysis-job.json`
- `shared/schemas/analysis-response.json`

S3 POST에는 `Content-Type`을 직접 고정하지 않고 브라우저가 `FormData` 경계를 설정하게 합니다. VLM을 프런트에서 직접 호출하거나 수수료·배출 규정을 추론하지 않습니다.

## 환경 변수

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://example.execute-api.ap-northeast-2.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-2_example
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=exampleclientid
```

로컬 파일 생성:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

`NEXT_PUBLIC_*` 값은 클라이언트 번들에 포함됩니다. 비밀값을 넣지 말고, 값 변경 후 개발 서버를 다시 시작합니다.

## 실행과 검증

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

UI 기능을 구현할 때 추가로 확인할 항목:

- 모바일 너비와 데스크톱 너비
- 카메라 권한 허용·거부
- 지원·미지원 파일 형식과 큰 이미지
- 로딩 중 중복 제출 방지
- 네트워크 오류와 재시도
- 키보드 포커스, 버튼 이름, 상태 텍스트, 색 대비

## 구현 규칙

- 페이지는 화면 조립을 담당하고, API 호출과 상태 전이는 기능 단위로 분리합니다.
- 서버 응답을 임의로 추측하지 않고 `shared/` 계약을 기준으로 타입을 정의합니다.
- AI 신뢰도가 낮을 때 하나의 정답처럼 표현하지 않습니다.
- 수수료나 규정 정보의 출처·갱신 시점은 Backend 응답을 그대로 표시할 수 있게 설계합니다.
- 카메라를 사용할 수 없는 환경에서도 앨범 업로드로 핵심 흐름을 완료할 수 있어야 합니다.
- 새로운 패키지는 기존 React·Next.js 기능으로 해결하기 어려울 때만 추가합니다.

## 배포

Frontend는 저장소 루트의 `amplify.yml`을 사용해 AWS Amplify에 배포하는 구성이 준비되어 있습니다.

- 모노레포 앱 루트: `frontend`
- 설치: `npm ci`
- 빌드: `npm run build`
- 산출물: `.next`
- Amplify 환경 변수에 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` 등록 필요

세 값은 빌드 시 번들에 들어가므로 Backend API Gateway와 Cognito User Pool 값을 배포 전에 설정하고 다시 빌드해야 합니다. 배포 후 해당 Amplify 도메인을 Backend의 `CORS_ALLOW_ORIGINS`에도 추가합니다.

## 다음 작업

- [ ] 프로젝트 메타데이터와 한국어 문서 언어 설정
- [ ] 모바일 홈과 사진 촬영·앨범 업로드
- [ ] 사진 확인, 압축, 형식·용량 검증
- [x] Cognito 로그인, S3 POST, 비동기 분석 API 연결과 단계별 진행 상태
- [ ] 후보·신뢰도·확인 질문 결과 UI
- [ ] 사용자 품목 수정과 최종 결과 UI
- [ ] 공식 신고 링크와 조회 기록
- [ ] PWA 매니페스트·아이콘·서비스 워커

## 완료 기준

- 실제 모바일 브라우저에서 사진 선택부터 결과 확인까지 동작한다.
- 모든 비동기 상태에 로딩·오류·재시도 UI가 있다.
- 낮은 신뢰도 결과를 사용자가 확인·수정할 수 있다.
- `npm run lint`와 `npm run build`가 통과한다.
- Backend 계약 변경 없이 최신 `shared/` 스키마와 일치한다.
