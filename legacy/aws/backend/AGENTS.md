# Archived AWS Backend

This directory preserves the retired FastAPI, Lambda, S3, SQS, DynamoDB, and Cognito implementation. It is not part of the Vercel + Supabase production path.

Before changing archived code, search this directory for `AIDEV-` anchors. Run its historical test suite from the archive root:

```powershell
Push-Location legacy/aws
python -m pytest backend/tests
Pop-Location
```

Do not reconnect this code to production without an explicit cross-role architecture decision.
