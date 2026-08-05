# Frontend 작업 가이드

Next.js App Router 기반 모바일 웹/PWA입니다. Frontend는 Backend API만 호출하며 VLM이나 수수료 규칙을 직접 판단하지 않습니다.

## 현재 구현

- Cognito 이메일 가입, 확인 코드, 로그인, 임시 비밀번호 변경
- 카메라·앨범 선택, 이미지 미리보기, 선택 영역 자르기
- presigned S3 POST, 비동기 분석 생성·polling, 5회 한도 안내
- 다중 품목 선택·수정 UI와 확인 질문 표시
- 최근 결과 최대 6개를 `localStorage`에 저장
- 홈, 촬영, 분석, 결과, 신고 확인, 기록, 도움말 화면
- manifest, 동적 아이콘, service worker 등록

수수료 선택지는 현재 `src/lib/demo-waste-catalog.ts`의 데모 값입니다. Backend 규정 데이터가 연결되기 전에는 공식 금액으로 표현하지 않습니다.

## 구조

```text
frontend/
├─ public/                 # PWA·OG 정적 자산
├─ src/app/                # App Router 화면
├─ src/components/         # 재사용 UI
├─ src/lib/
│  ├─ api.ts               # Backend 요청·S3 업로드·polling
│  ├─ analysis-contract.ts # 런타임 응답 검증
│  ├─ auth.ts              # Amplify Cognito 인증
│  ├─ analysis-store.ts    # session/local storage
│  └─ image.ts             # 이미지 변환·자르기
└─ src/types/
   ├─ api.ts               # shared 계약 대응 타입
   └─ analysis.ts          # 화면·데모 결과 타입
```

페이지는 화면 조립을 맡고, 네트워크·인증·저장·이미지 처리는 `src/lib`에 둡니다. 실제 재사용이 없는 코드는 별도 feature 계층을 만들지 않습니다.

## 분석 흐름

1. Amplify가 발급한 access token을 `Authorization: Bearer`로 보냅니다.
2. `POST /api/uploads`에서 받은 `form_fields`와 파일을 S3에 POST합니다.
3. `POST /api/analyses`로 작업을 만들고 `202 queued`를 받습니다.
4. `GET /api/analyses/{id}`를 terminal 상태까지 polling합니다.
5. `completed.observation`을 런타임 검증한 뒤 결과 화면에 저장합니다.
6. `401/403`은 로그인으로, `429`는 계정 한도 안내로, 파일·서비스 오류는 재시도 UI로 전환합니다.

요청·응답은 `shared/api/openapi.yaml`과 `shared/schemas/**`를 따릅니다. S3 요청에는 브라우저가 multipart boundary를 설정하도록 `Content-Type`을 직접 지정하지 않습니다.

## 환경 변수

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://example.execute-api.ap-northeast-2.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-2_example
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=exampleclientid
```

`NEXT_PUBLIC_*`는 브라우저 번들에 포함되므로 비밀값을 넣지 않습니다. 값 변경 후에는 다시 빌드해야 합니다.

## 실행·검증

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
npm --prefix frontend run lint
npm --prefix frontend run build
```

수동 확인 항목:

- 모바일·데스크톱 너비와 키보드 포커스
- 카메라 권한 거부 시 앨범 업로드 대체 경로
- 큰 파일·미지원 형식·네트워크 오류
- 중복 제출 방지와 분석 취소
- 낮은 신뢰도·빈 결과·복수 품목·5회 소진 화면

## 배포

루트 `amplify.yml`을 사용합니다. Amplify 환경 변수에 위 세 값을 등록하고 빌드한 뒤, 운영 도메인을 Backend `CORS_ALLOW_ORIGINS`에 정확한 origin으로 추가합니다.

## 다음 작업

- Backend 수수료·규정 응답으로 데모 카탈로그 교체
- 서버 기반 사용자 분석 기록과 로컬 기록 동기화
- 실제 모바일 브라우저 카메라·PWA 설치 회귀 테스트
- 접근성 자동화와 Frontend 단위 테스트 추가
