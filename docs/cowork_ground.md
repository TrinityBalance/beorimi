# 역할 간 요구사항 보드

다른 역할의 작업 없이는 완료할 수 없는 활성 요청만 상세히 기록합니다. 역할 내부 TODO는 각 역할 문서나 이슈에서 관리합니다.

## 상태와 작성 규칙

```text
OPEN → ACK → READY → DONE
         └→ BLOCKED
OPEN/ACK → CANCELLED
```

- 요청자는 요구사항·영향·완료 조건·계약 파일을 작성하고 `READY`를 검증해 `DONE`으로 닫습니다.
- 수신자는 상태, 응답, 구현·검증 증거를 갱신합니다.
- ID는 발신 역할 접두사 `FE-`, `BE-`, `VLM-`와 증가 번호를 사용하고 재사용하지 않습니다.
- 비밀값, 실제 자격 증명, 개인정보는 기록하지 않습니다.

요청 형식:

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

현재 활성 요청 없음.

## Backend 발신 요청

현재 활성 요청 없음.

## VLM 발신 요청

현재 활성 요청 없음.

## 완료 기록

| ID | 결과 | 주요 증거 |
| --- | --- | --- |
| FE-001 | 분석 결과·오류 계약 연결 | 공용 스키마, Backend 오류 변환, Frontend 런타임 검증 |
| BE-001 | VLM 서비스 인증·10MiB 제한 | `vlm/app/api.py`, VLM 전체 테스트 |
| BE-002 | 취소 — AWS/Amplify 배포 철회 | Vercel + Supabase 운영 전환, AWS 코드는 `legacy/aws/`에 보존 |
| BE-003 | 비동기 worker VLM 계약 | `shared/schemas/vlm-analysis-result.json`, Backend·VLM 전체 테스트 |
