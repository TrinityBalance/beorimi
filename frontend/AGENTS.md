# Frontend agent card

## Scope and invariants

- Own `frontend/**`, Frontend tests, and `docs/frontend.md`.
- Call Backend only; never call VLM directly or decide fees and disposal rules.
- Use `shared/**` as the API contract. Do not guess response fields.
- Read the relevant Next.js 16 guide under `frontend/node_modules/next/dist/docs/` before changing framework behavior.

## Minimal context lookup

```powershell
# Active requests addressed to Frontend
rg -n -A 12 "^### [A-Z]+-[0-9]+ \[(OPEN|ACK|BLOCKED|READY)\] → Frontend —" docs/cowork_ground.md

# Detailed guide index; open only relevant sections
rg -n "^##|^###" docs/frontend.md
```

Use `docs/frontend.md` sections only as needed: screens → `MVP 화면 흐름`, API work → `Backend API 사용`, configuration → `환경 변수`, release work → `배포`.

## Verification

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

Create cross-role requests as `FE-NNN` under `Frontend 발신 요청` in `docs/cowork_ground.md`.
