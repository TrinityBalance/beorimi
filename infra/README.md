# Backend AWS 배포

Backend 담당자가 소유하는 AWS 리소스와 배포 절차입니다. Frontend/VLM 변경은 각 담당자에게 `docs/cowork_ground.md`로 요청합니다.

## 권장 스택

`backend-secure.yaml`은 서울 리전에서 다음을 생성합니다.

- Cognito User Pool과 비밀키 없는 Web client
- 비공개 S3 이미지 버킷과 사용자별 key prefix
- DynamoDB 분석 테이블과 TTL
- SQS 작업 queue와 DLQ
- FastAPI API Lambda와 VLM 분석 worker Lambda
- Cognito JWT authorizer가 적용된 API Gateway HTTP API
- 리소스별 최소 권한 IAM role과 14일 로그 보존

공개 진입점은 API Gateway HTTP API만 사용합니다. Lambda Function URL 템플릿은 더 이상 제공하지 않습니다.

## 사전 조건

- AWS CLI 로그인과 기본 리전 `ap-northeast-2`
- CloudFormation/IAM/Lambda/API Gateway/Cognito/S3/DynamoDB/SQS 배포 권한
- artifact bucket
- Frontend의 정확한 운영 origin
- 배포된 VLM HTTPS 주소
- Backend와 VLM이 함께 참조할 Secrets Manager 서비스 토큰 ARN

Root 계정으로 일상 배포하지 않습니다. 비밀값은 명령, 소스, 템플릿, 로그에 기록하지 않습니다.

## 패키징과 검증

```powershell
.\infra\build-backend-lambda.ps1
aws cloudformation validate-template --template-body file://infra/backend-secure.yaml --region ap-northeast-2
python -m pytest backend/tests
```

생성 ZIP은 Git에서 제외된 `.aws-build/backend.zip`입니다.

## 배포

```powershell
.\infra\deploy-backend-secure.ps1 `
  -ArtifactBucket "배포-artifact-bucket" `
  -FrontendOrigin "https://운영-frontend-origin" `
  -VlmBaseUrl "https://VLM-App-Runner-주소" `
  -VlmServiceTokenSecretArn "서비스-토큰-secret-arn" `
  -Profile "beorimi-sso"
```

스크립트는 기본적으로 Root가 아닌 `beorimi-sso` 프로필을 사용합니다. ZIP의 SHA-256을 artifact key로 사용해 업로드하고 `beorimi-backend-secure` 스택을 배포합니다. 출력의 `ApiUrl`, `UserPoolId`, `UserPoolClientId`를 Frontend 담당자에게 전달합니다.

## 검증 순서

1. `GET {ApiUrl}/api/health`가 200인지 확인합니다.
2. 토큰 없이 보호 경로를 호출해 401인지 확인합니다.
3. Cognito 사용자로 SRP 로그인하거나, 배포 운영 자격 증명으로 `ADMIN_USER_PASSWORD_AUTH`를 사용해 access token을 받습니다.
4. `/api/uploads` → 응답 form 필드를 사용한 S3 POST → `/api/analyses` 순서로 호출합니다.
5. `/api/analyses/{id}`를 polling해 VLM `observation` 결과가 `completed`인지 확인합니다.
6. 다른 사용자 토큰으로 같은 id를 조회해 404인지 확인합니다.

Frontend 연결 전에는 API Lambda에 JWT claims 형태의 테스트 이벤트를 직접 넣어 AWS 내부 파이프라인을 확인할 수 있습니다. 스크립트가 만든 S3 객체 버전과 DynamoDB 레코드는 검증 후 삭제합니다.

```powershell
.\infra\smoke-backend-secure.ps1 -Profile beorimi-sso
```

기존 AWS 계정에 공개 Lambda Function URL이 이미 배포되어 있다면 이 저장소 변경만으로 삭제되지는 않습니다. Amplify와 API Gateway 통합 검증 후, 해당 스택의 영향 범위를 확인하고 별도 승인 절차로 폐기합니다.
