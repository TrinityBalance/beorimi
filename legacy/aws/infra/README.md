# Retired AWS deployment scripts

이 디렉터리의 CloudFormation/Lambda 스크립트는 이전 AWS 배포 구현임. 현재 운영 경로는 Vercel + Supabase이며 새 배포에 사용하면 안 됨.

`build-backend-lambda.ps1`은 같은 아카이브의 `../backend`를 패키징함. `build-vlm-lambda.ps1`은 현재 루트의 로컬 실험용 `vlm/` 소스를 참조하며, 두 스크립트 모두 결과를 `legacy/aws/.aws-build/`에 생성함.
