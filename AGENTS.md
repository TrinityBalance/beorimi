<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Beorimi role rules

## Choose a role before editing

Every task must identify one primary role from **Frontend**, **Backend**, or **VLM** before making changes. Read the matching guide completely and use it as the source of truth for that area.

| Role | Default ownership | Required guide | Required verification |
| --- | --- | --- | --- |
| Frontend | `frontend/**`, `docs/frontend.md` | `docs/frontend.md` | `npm --prefix frontend run lint` and `npm --prefix frontend run build` |
| Backend | `backend/**`, `docs/backend.md` | `docs/backend.md` | `python -m pytest backend/tests` |
| VLM | `vlm/**`, `docs/vlm.md` | `docs/vlm.md` | `python -m pytest vlm/tests` |

## Stay within the role boundary

- Work in the primary role's owned paths by default, including its tests and guide.
- Do not modify another role's directory for convenience. Cross-role edits are allowed only when the requested behavior genuinely requires integration across that boundary.
- When a task crosses roles, read every affected role guide, keep each service's responsibilities separate, and run every affected role's verification.
- Frontend calls Backend only. It must not call VLM directly or decide fees and disposal rules.
- VLM returns image observations only. It must not decide fees, reporting requirements, or final disposal instructions.
- Backend owns the public API, VLM orchestration, waste-data lookup, RAG, and final disposal decisions.

## Contract-first integration

- `shared/api/openapi.yaml`, `shared/schemas/**`, and `shared/docs/api-contract.md` are the service contract source of truth.
- For request or response changes, update the shared contract first, then the providing service, then every consuming service.
- Treat `shared/**`, root deployment configuration, and the root `README.md` as common scope. Change them only when the cross-service contract, deployment flow, or project-wide workflow changes.
- Keep area-specific implementation details in `docs/frontend.md`, `docs/backend.md`, or `docs/vlm.md`; do not expand the root README with duplicated details.
- Preserve unrelated work from other roles and never revert it to make the current role's change easier.

## Cross-role requirement board

- Read `docs/cowork_ground.md` after the primary role guide and before editing. Check every active request addressed to the current role.
- Record a request in the board before depending on another role's unfinished work or asking another role to change an interface, behavior, configuration, or deployment input.
- Do not add role-local TODOs to the board. Use it only for requirements whose completion depends on another role.
- Use the requesting role's queue and next available prefix number. During concurrent work, edit only that queue and request blocks assigned to the current role; preserve every unrelated entry and its ordering.
- The requester owns the requirement and acceptance criteria. The receiver owns acknowledgement, blockers, implementation response, and verification evidence. Only the requester closes a `READY` request as `DONE` after integration verification.
- For contract changes, link the affected `shared/**` files in the request and still follow the contract-first update order.
- Before finishing a task, re-read the board and update every request created or handled during the task to its truthful current status. Do not mark unresolved work `DONE`.
- Never put secrets, credentials, personal data, or sensitive operational values in the board.
