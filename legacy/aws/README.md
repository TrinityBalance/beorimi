# Retired AWS implementation

This directory preserves the deployment replaced by Vercel + Supabase. Nothing under `legacy/aws/` is used by the active application build or production deployment.

## Contents

- `backend/`: FastAPI API, Lambda worker, Cognito authentication adapter, S3/SQS/DynamoDB integrations, and tests.
- `infra/`: CloudFormation plus Lambda build, deploy, and smoke-test scripts.
- `amplify.yml`: retired Amplify frontend build configuration.
- `vlm/apprunner.yaml`: retired App Runner VLM configuration.

The source is retained for history and rollback analysis. Do not deploy it as a second runtime alongside Vercel + Supabase.

## Historical verification

```powershell
Push-Location legacy/aws
python -m pytest backend/tests
Pop-Location
```

The deployment scripts require archived AWS resources and credentials and are not part of routine verification.
