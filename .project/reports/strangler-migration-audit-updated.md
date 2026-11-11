## 2. Hypotheses & Open Questions (≤5)

| # | Hypothesis | Confidence | Reason / Evidence |
|---|------------|------------|--------------------|
| H1 | The majority of runtime failures stem from the theme‑configuration mismatch (Tailwind `var(--color-*)` vs literal hex values). | High | Documented divergence in `src/shell/ssr-engine.ts` vs `themes/mosaix-default/theme.json` (lines 142‑176). Partially resolved: commit `4eb75a0` moved theme mode variables outside the AsyncLocalStorage closure, reducing the failure surface. |
| H2 | Auth pages and BAC pages share a common rendering pipeline that can be extracted without breaking business logic. | Medium | Both use `renderHeadBlock()` and share `sharedStyles` but diverge on colour source. The recent `fix(ui): align auth pages and glass-card` commit suggests progress toward convergence. |
| H3 | Data ownership is primarily in the PostgreSQL schema used by the server‑side rendering engine; no other micro‑services write to the same tables. | Low (needs DB schema dump) | The codebase shows hexagonal architecture with ports/adapters, but without a live schema dump we cannot confirm cross‑domain SQL coupling. |
| H4 | The failing test (`bac-access.http.test.ts`) is a symptom of port conflict / server start race rather than underlying business logic. | Medium | Logs show `bootServer(3218, true)` hangs, `server` stays `undefined`. The theme closure fix may have indirect benefit here. |
| H5 | The 42 MB of untracked files in `chatgpt-web-mcp/` are build artefacts that can be ignored or added to `.gitignore` without affecting runtime. | High | Directory not referenced in any source import. Already flagged in the quality analysis.

**Open Questions:**
1. Do we have access to the live DB schema dump to map data coupling? (Needed for CDC/outbox decisions.)
2. Which deployment environment (Docker/K8s) runs the monolith – does it already expose health‑check endpoints we can proxy?
3. Are there any external consumers (mobile SDKs, third‑party APIs) that directly hit the monolith’s internal routes?

---
# Strangler Migration Audit – MosaiX (Updated)

**Date:** 2026-11-05  
**Prepared by:** `strangler-migration-architect` skill  
**Current HEAD:** `57a82fa` — `audit-technique-mosaix-8397822254578305712`  
**Status:** Production blockers active — 6/9 P0 done, 3 OPEN (R03, R04, R08)

## 1. Verdict

**GO conditionnel** – The monolith can be migrated using the Strangler Fig pattern, provided that the current blocking gates are resolved. The good news: critical fixes have been applied since the last audit (theme closure scope, typecheck errors). However, three production remain OPEN per the roadmap, representing technical debt that must be addressed before any incremental slice is exposed to production traffic.

> **Condition 1** – Lint, type‑check and test failures must be cleared (or gated) before routing production traffic to a new slice.
>
> **Condition 2** – A single source‑of‑truth for theme data must be verified (theme.json vs Tailwind config divergence).
>
> **Condition 3** – Saga/compensation coverage, MCP permission audit, and tenant isolation (RLS PG + Redis) must be test‑validated per the production roadmap P0‑7, P0‑8, P0‑9.

If these conditions are met, we recommend proceeding with the first slice as described below.