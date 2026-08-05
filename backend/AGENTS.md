# Backend agent card

## Scope and invariants

- Own `backend/**`, Backend tests, and `docs/backend.md`.
- Own the public API, VLM orchestration, waste lookup, RAG, and final disposal decisions.
- Keep production integration on Supabase: Vercel API routes → Supabase Auth/Storage/Postgres → Edge Function worker. Backend must not add another hosting runtime without an architecture decision.
- Keep HTTP concerns in routes, business operations in services, and data access in repositories.
- Update `shared/**` before changing a request or response contract.

## Minimal context lookup

```powershell
# Active requests addressed to Backend
rg -n -A 12 "^### [A-Z]+-[0-9]+ \[(OPEN|ACK|BLOCKED|READY)\] → Backend —" docs/cowork_ground.md

# Detailed guide index; open only relevant sections
rg -n "^##|^###" docs/backend.md
```

Use `docs/backend.md` sections only as needed: layering, endpoints, configuration, and Supabase release work.

## Verification

```powershell
python -m pytest backend/tests
```

Create cross-role requests as `BE-NNN` under `Backend 발신 요청` in `docs/cowork_ground.md`.
