# Frontend agent card

## Scope and invariants

- Own `frontend/**`, Frontend tests, and `docs/frontend.md`.
- Call Backend only; never call VLM directly or decide fees and disposal rules.
- Use `shared/**` as the API contract. Do not guess response fields.
- Read the relevant installed Next.js guide under `frontend/node_modules/next/dist/docs/` before changing framework behavior.

## Minimal context lookup

```powershell
# Active requests addressed to Frontend
rg -n -A 12 "^### [A-Z]+-[0-9]+ \[(OPEN|ACK|BLOCKED|READY)\] → Frontend —" docs/cowork_ground.md

# Detailed guide index; open only relevant sections
rg -n "^##|^###" docs/frontend.md
```

Use `docs/frontend.md` sections only as needed: screens → `현재 구현`, API work → `분석 흐름`, configuration → `환경 변수`, release work → `배포`.

## Verification

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

Create cross-role requests as `FE-NNN` under `Frontend 발신 요청` in `docs/cowork_ground.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
