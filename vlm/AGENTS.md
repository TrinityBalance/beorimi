# VLM agent card

## Scope and invariants

- Own `vlm/**`, VLM tests, and `docs/vlm.md`.
- Return image observations only; never decide fees, reporting requirements, or final disposal instructions.
- Keep prompt, strict output schema, shared contract, and Backend consumption compatible.
- Never put `OPENAI_API_KEY` in source, logs, prompts, or deployment files.

## Minimal context lookup

```powershell
# Active requests addressed to VLM
rg -n -A 12 "^### [A-Z]+-[0-9]+ \[(OPEN|ACK|BLOCKED|READY)\] → VLM —" docs/cowork_ground.md

# Detailed guide index; open only relevant sections
rg -n "^##|^###" docs/vlm.md
```

Use `docs/vlm.md` sections only as needed: pipeline → `처리 과정`, schema → `관찰 결과`, local inference → `CLI`, prompt changes → `프롬프트·스키마 변경 절차`, release work → `배포`.

## Verification

```powershell
python -m pytest vlm/tests
```

Create cross-role requests as `VLM-NNN` under `VLM 발신 요청` in `docs/cowork_ground.md`.
