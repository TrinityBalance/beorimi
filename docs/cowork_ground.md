# 역할 간 요구사항 보드

다른 역할의 작업 없이는 완료할 수 없는 요청만 기록합니다. 역할 에이전트는 전체 파일 대신 자기 역할로 온 활성 블록을 `rg`로 조회합니다.

## 상태

```text
OPEN → ACK → READY → DONE
         └→ BLOCKED
OPEN/ACK → CANCELLED
```

- 요청자: 요구사항·영향·완료 조건·계약을 작성하고 `READY`를 직접 검증해 `DONE`으로 닫습니다.
- 수신자: `ACK/BLOCKED/READY` 상태, 응답, 구현·검증 증거를 기록합니다.
- ID는 발신 역할 접두사 `FE-`, `BE-`, `VLM-`와 증가 번호를 사용하며 재사용하지 않습니다.
- API 변경 요청에는 관련 `shared/**` 파일을 반드시 적습니다.
- 역할 내부 TODO, 비밀값, 자격 증명, 개인정보는 적지 않습니다.

## 템플릿

```markdown
### ROLE-NNN [OPEN] → TARGET — 요청 제목

- **우선순위:** BLOCKING | HIGH | NORMAL
- **필요 시점:** 통합 전 | 배포 전 | 후속 작업
- **요구사항:** 검증 가능한 결과
- **이유·영향:** 없으면 막히는 작업
- **완료 조건:** 테스트 가능한 조건
- **관련 계약·파일:** `shared/...` 또는 구현 파일
- **수신자 응답:** 미응답
- **구현·검증 증거:** 미완료
```

## Frontend 발신 요청

### FE-001 [READY] → Backend — 분석 결과와 오류 응답 계약

- **우선순위:** BLOCKING
- **필요 시점:** 통합 전
- **요구사항:** Frontend가 분석 성공, 파일 오류, VLM 장애를 구분할 공개 API 계약
- **이유·영향:** 결과 카드와 재시도 UI가 안정적인 상태 코드에 의존
- **완료 조건:** 성공 스키마 일치, 400·413·415·502·503·504 구분, Backend 테스트 통과
- **관련 계약·파일:** `shared/api/openapi.yaml`, `shared/schemas/analysis-response.json`, `backend/app/api/routes/analysis.py`
- **수신자 응답:** 공통 스키마를 VLM 실제 결과에 맞추고 공개 오류 코드를 구분함
- **구현·검증 증거:** Backend 테스트 9개 통과. Frontend 담당자의 직접 통합 검증 대기

## Backend 발신 요청

### BE-001 [OPEN] → VLM — 내부 서비스 인증과 업로드 제한

- **우선순위:** BLOCKING
- **필요 시점:** 배포 전
- **요구사항:** VLM이 공유 서비스 토큰을 검증하고 공통 비동기 계약의 10MiB 초과 이미지를 추론 전에 거절
- **이유·영향:** 공개 URL 무단 호출로 인한 비용·메모리 오용 방지
- **완료 조건:** 토큰 오류 401, 설정 누락 503, 크기 초과 413, VLM 테스트 통과
- **관련 계약·파일:** `shared/docs/api-contract.md`, `vlm/app/main.py`, `vlm/app/config.py`
- **수신자 응답:** 미응답
- **구현·검증 증거:** Backend의 sync/async 서비스 토큰 전달 테스트 통과. VLM 구현·검증 대기

### BE-002 [ACK] → Frontend — Cognito·S3·비동기 분석 API 연결

- **우선순위:** BLOCKING
- **필요 시점:** 통합 전
- **요구사항:** Cognito 로그인 후 access token을 `Authorization: Bearer`로 전송하고, `/api/uploads`에서 받은 form으로 S3 POST한 뒤 `/api/analyses` 생성·조회 polling 흐름을 구현한다. Amplify 앱을 GitHub `main`에 연결하고 자동 빌드를 활성화한다.
- **이유·영향:** 이미지가 API Gateway/Lambda 본문을 통과하지 않아 크기 제한과 timeout 위험이 줄고, 사용자별 `sub` 기준으로 데이터가 격리된다.
- **완료 조건:** VLM 직접 호출 없음, API/User Pool 설정을 빌드 환경에 반영, 응답 `form_fields`를 S3 POST에 적용, `completed/failed`까지 polling, 401/400/404/503 UI, Frontend lint/build와 정확한 운영 origin 전달
- **관련 계약·파일:** `shared/api/openapi.yaml`, `shared/schemas/upload-url-*.json`, `shared/schemas/analysis-job*.json`, `shared/docs/api-contract.md`, `frontend/**`
- **Backend 전달값:** API `https://xzqwr7iz89.execute-api.ap-northeast-2.amazonaws.com`, User Pool `ap-northeast-2_zIW7nLU7s`, Web Client `4mhabc2bgejiderddbgoui3jn5`, 리전 `ap-northeast-2`
- **수신자 응답:** 2026-08-05 Frontend 코드 연결 완료. Cognito SRP 로그인·가입·이메일 확인·임시 비밀번호 변경, access token 전달, presigned S3 POST, 분석 생성·polling, 실패·재로그인 UI를 반영했다. Amplify의 GitHub `main` 연결과 세 환경 변수 등록은 배포 권한이 필요한 외부 작업으로 남아 있다.
- **구현·검증 증거:** `frontend/src/lib/auth.ts`, `frontend/src/lib/api.ts`, `frontend/src/app/login/page.tsx`, `frontend/src/app/analyze/page.tsx`. Frontend lint, Next build, vinext/Cloudflare build, production dependency audit 0건 통과. Backend 25 tests 통과. `beorimi-backend-secure` `CREATE_COMPLETE`; health 200, 무인증 보호 경로 401, 운영 Amplify origin CORS preflight 204, S3→SQS→worker→DynamoDB mock 결과 확인.

### BE-003 [OPEN] → VLM — 비동기 worker용 분석 계약

- **우선순위:** HIGH
- **필요 시점:** AWS mock 경로 검증 후
- **요구사항:** Backend worker가 S3의 이미지를 전달해 호출할 수 있는 VLM 인증·요청·응답 계약과 최대 처리 시간을 확정한다.
- **이유·영향:** 실제 VLM은 API Gateway 30초 안에 완료된다는 보장이 없어 SQS worker에서 실행해야 한다.
- **완료 조건:** S3 객체 또는 byte 입력 방식 합의, 서비스 인증 유지, 재시도 가능한 오류와 영구 오류 구분, `shared/schemas/analysis-response.json` 준수, VLM 테스트 통과
- **관련 계약·파일:** `shared/schemas/analysis-response.json`, `shared/docs/api-contract.md`, `backend/app/workers/analysis.py`, `vlm/**`
- **수신자 응답:** 미응답
- **구현·검증 증거:** Backend worker의 S3 byte 전달, 서비스 토큰, 영구·재시도 오류 분리 구현 완료. VLM 반영 대기

## VLM 발신 요청

현재 활성 요청 없음.
