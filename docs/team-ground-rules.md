\# Beorimi 프로젝트 기초 협약



\## 1. 프로젝트 구성



프로젝트는 하나의 GitHub 저장소에서 다음 세 영역으로 나누어 개발한다.



```text

beorimi/

├─ frontend/

├─ backend/

├─ vlm/

├─ shared/

└─ docs/

```



담당 영역은 다음과 같다.



\* Frontend 담당: Next.js PWA, 화면, 카메라, 이미지 업로드, 결과 UI

\* Backend 담당: FastAPI, DB, RAG, LangGraph, VLM 연동, 최종 응답 처리

\* VLM 담당: 이미지 전처리, 모델 추론, 분류 결과 및 신뢰도 반환



각 담당자는 자신의 영역을 우선 책임지되, 공통 인터페이스 변경 시 반드시 팀원과 공유한다.



\---



\## 2. 기본 개발 원칙



1\. 각 서비스는 독립적으로 실행 가능해야 한다.

2\. Frontend는 VLM을 직접 호출하지 않는다.

3\. 통신 구조는 다음을 원칙으로 한다.



```text

Frontend → Backend → VLM

```



4\. 서비스 간 통신은 사전에 합의한 API 규격을 따른다.

5\. API 응답 구조를 변경할 경우 관련 담당자의 동의 없이 임의로 변경하지 않는다.

6\. 비밀키, API 키, DB 주소 등 민감한 정보는 Git에 올리지 않는다.

7\. 환경변수 예시는 각 폴더의 `.env.example`에 작성한다.



\---



\## 3. 브랜치 규칙



기본 브랜치는 다음과 같이 사용한다.



```text

main       실제 배포 가능한 안정 버전

develop    통합 개발 브랜치

feature/\*  기능 개발 브랜치

fix/\*      오류 수정 브랜치

```



브랜치 이름 예시:



```text

feature/frontend-camera

feature/backend-analysis-api

feature/vlm-inference

fix/frontend-upload-error

```



직접 `main` 브랜치에 push하지 않는다.



기본 작업 흐름:



```text

develop에서 feature 브랜치 생성

→ 작업

→ commit

→ push

→ Pull Request

→ 코드 확인

→ develop에 merge

```



배포가 가능한 상태가 되면 `develop`을 `main`에 병합한다.



\---



\## 4. 커밋 규칙



커밋 메시지는 다음 형식을 사용한다.



```text

타입: 작업 내용

```



사용 타입:



```text

feat     새로운 기능

fix      오류 수정

refactor 코드 구조 개선

docs     문서 수정

style    UI 또는 코드 형식 수정

test     테스트 추가 및 수정

chore    설정 및 기타 작업

```



예시:



```text

feat: 이미지 업로드 기능 추가

fix: VLM 응답 파싱 오류 수정

docs: API 명세 업데이트

refactor: 폐기물 조회 서비스 분리

```



한 커밋에는 가능한 하나의 작업 목적만 포함한다.



\---



\## 5. Pull Request 규칙



Pull Request에는 다음 내용을 작성한다.



```text

\## 작업 내용

\- 구현하거나 수정한 내용



\## 변경 파일

\- 주요 변경 파일



\## 테스트

\- 실행하거나 확인한 방법



\## 참고사항

\- 다른 담당자가 알아야 할 내용

```



공통 API, 데이터 구조, 환경변수 또는 실행 방식이 변경된 경우 반드시 명시한다.



자신의 Pull Request를 스스로 병합할 수 있으나, 다음 변경은 최소 한 명의 확인을 받은 뒤 병합한다.



\* API 요청 및 응답 구조 변경

\* 폴더 구조 변경

\* DB 구조 변경

\* 공통 설정 변경

\* 배포 방식 변경



\---



\## 6. API 협약



공통 API 명세는 다음 위치에서 관리한다.



```text

shared/api/openapi.yaml

shared/docs/api-contract.md

```



API 변경 순서:



```text

1\. 변경 내용 제안

2\. 관련 담당자와 협의

3\. 공통 문서 수정

4\. Backend 구현

5\. Frontend 또는 VLM 반영

```



Backend API 기본 주소:



```text

http://localhost:8000

```



VLM API 기본 주소:



```text

http://localhost:8001

```



주요 API 예시:



```text

POST /api/v1/analysis

POST /predict

GET  /health

```



모든 서비스는 상태 확인용 `/health` API를 제공하는 것을 권장한다.



\---



\## 7. 데이터 응답 규칙



VLM은 최종 폐기물 배출 정보를 판단하지 않고 이미지 분석 결과만 반환한다.



VLM 응답 예시:



```json

{

&#x20; "predictions": \[

&#x20;   {

&#x20;     "label": "의자",

&#x20;     "confidence": 0.82

&#x20;   }

&#x20; ]

}

```



Backend는 VLM 결과와 폐기물 데이터 및 RAG 결과를 결합해 최종 응답을 만든다.



Frontend는 Backend가 반환한 최종 응답만 사용한다.



신뢰도가 낮은 결과는 하나로 단정하지 않고 여러 후보를 제공한다.



\---



\## 8. 파일 관리 규칙



다음 파일은 Git에 올리지 않는다.



```text

node\_modules/

.next/

\_\_pycache\_\_/

.venv/

venv/

.env

.env.local

모델 가중치 파일

대용량 이미지 데이터

```



다음 파일은 반드시 Git에 포함한다.



```text

package.json

package-lock.json

requirements.txt

.env.example

README.md

API 명세

실행 방법 문서

```



VLM 모델 가중치는 `vlm/models/`에 직접 커밋하지 않고 다운로드 방법을 문서로 제공한다.



\---



\## 9. 실행 환경



Frontend:



```bash

cd frontend

npm install

npm run dev

```



Backend:



```bash

cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000

```



VLM:



```bash

cd vlm

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8001

```



사용하는 Python 및 Node.js 버전은 README에 명시한다.



권장 버전:



```text

Node.js 20 이상

Python 3.11 또는 3.12

```



\---



\## 10. 일정 및 공유 규칙



각 담당자는 작업 시작 전 다음 내용을 공유한다.



```text

오늘 할 작업

예상 결과

다른 담당자에게 필요한 사항

```



작업 종료 시 다음 내용을 공유한다.



```text

완료한 작업

현재 문제

다음 작업

```



진행을 막는 문제가 생기면 혼자 오래 해결하려 하지 않고 팀에 공유한다.



API 연동이나 공통 구조처럼 다른 담당자의 작업을 막는 문제는 우선순위를 높게 둔다.



\---



\## 11. 충돌 방지 규칙



1\. 다른 담당자의 폴더를 수정해야 할 경우 먼저 공유한다.

2\. 공통 파일 수정 전 최신 `develop` 브랜치를 pull한다.

3\. 동일 파일을 여러 명이 동시에 수정하지 않도록 한다.

4\. merge conflict가 발생하면 해당 파일 담당자와 함께 해결한다.

5\. 코드 삭제나 대규모 구조 변경은 사전에 공유한다.



\---



\## 12. 최소 완료 기준



각 기능은 다음 조건을 만족해야 완료로 본다.



\* 로컬에서 정상 실행됨

\* 기본 오류 처리가 있음

\* 다른 서비스와 연동 가능함

\* 실행 방법이 문서화됨

\* 민감한 정보가 포함되지 않음

\* 최소 한 번 직접 테스트함



임시 데이터나 하드코딩을 사용한 경우 코드 또는 문서에 명확히 표시한다.



\---



\## 13. 의사결정 원칙



기술적 의견이 다를 경우 다음 순서로 결정한다.



```text

1\. 프로젝트 기간 내 구현 가능한가

2\. 팀원이 유지보수할 수 있는가

3\. 실제 기능 구현에 필요한가

4\. 테스트와 배포가 쉬운가

5\. 확장성이 있는가

```



완벽한 구조보다 기간 내 작동하는 MVP를 우선한다.



합의되지 않은 기술을 일방적으로 추가하지 않는다.



\---



\## 14. 공통 목표



이번 프로젝트의 우선 목표는 다음 흐름이 실제로 동작하는 MVP를 완성하는 것이다.



```text

사진 업로드

→ VLM 품목 분석

→ Backend 품목 및 규정 검색

→ 수수료와 배출 방법 반환

→ Frontend 결과 출력

```



로그인, 알림, 지도, 결제, 복잡한 관리자 기능은 핵심 흐름이 완성된 뒤 추가한다.



