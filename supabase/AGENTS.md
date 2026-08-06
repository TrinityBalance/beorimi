# Backend agent card

## Scope and invariants

- Own `supabase/**`, `frontend/src/app/api/**`, `frontend/src/lib/server/**`, Backend contracts, and `docs/backend.md`.
- Keep production on Vercel Route Handlers → Supabase Auth/Storage/Postgres → Edge Function worker.
- Keep analysis asynchronous: enqueue with `POST /api/analyses`, then poll `GET /api/analyses/{id}`.
- Update `shared/**` before changing request or response contracts.
- Treat `legacy/aws/**` as archived reference code, not a production dependency.

## Minimal context lookup

```powershell
rg -n -A 12 "^### [A-Z]+-[0-9]+ \[(OPEN|ACK|BLOCKED|READY)\] → Backend —" docs/cowork_ground.md
rg -n "^##|^###" docs/backend.md
```

Read only the relevant `docs/backend.md` sections unless the task is a broad Backend refactor.

## Verification

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
python -m pytest vlm/tests
```

When Supabase CLI and a local stack are available, also run `supabase db lint`.

Create cross-role requests as `BE-NNN` under `Backend 발신 요청` in `docs/cowork_ground.md`.
