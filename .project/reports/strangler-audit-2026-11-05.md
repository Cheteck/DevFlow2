# Strangler Migration Audit – MosaiX (2026‑11‑05)

**Prepared by:** `strangler-migration-architect` skill (auto‑loaded)

---

## 1. Verdict
**GO conditionnel** – The monolith can be migrated using the Strangler pattern, **provided that the current blocking gates (lint → 37 errors, TypeScript type‑check failures, and the failing `bac-access.http.test.ts` timeout) are resolved first**. These defects represent *high‑risk* technical debt that would otherwise undermine confidence in any incremental slice.

> **Condition 1** – All lint, type‑check and test failures must be cleared (or gated behind a temporary `skip‑check` flag) before any production traffic is routed to a new slice.
> **Condition 2** – A single source‑of‑truth for theme data must be established (see § 4).

If these conditions are met, we recommend proceeding with the first slice (Theme Service) as described below.

---

## 2. Hypotheses & Open Questions (≤ 5)
| # | Hypothesis | Confidence | Reason / Evidence |
|---|------------|------------|--------------------|
| H1 | The majority of runtime failures stem from the **theme‑configuration mismatch** (Tailwind `var(--color-*)` vs literal hex values). | High | Documented divergence in `src/shell/ssr-engine.ts` vs `themes/mosaix‑default/theme.json` (lines 142‑176). |
| H2 | **Auth pages** and **BAC pages** share a common rendering pipeline that can be extracted without breaking business logic. | Medium | Both use `renderHeadBlock()` and share `sharedStyles` but diverge on colour source. |
| H3 | Data ownership is primarily in the **PostgreSQL** schema used by the server‑side rendering engine; no other micro‑services write to the same tables. | Low (needs DB schema dump). |
| H4 | The failing test (`bac‑access.http.test.ts`) is a symptom of **port conflict / server start race** rather than underlying business logic. | Medium | Logs show `bootServer(3218, true)` hangs, `server` stays `undefined`.
| H5 | The 42 MB of untracked files in `chatgpt-web-mcp/` are **build artefacts** that can be ignored or added to `.gitignore` without affecting runtime. | High | Directory not referenced in any source import.

**Open Questions**:
1. Do we have access to the live DB schema dump to map data coupling? (Needed for CDC/outbox decisions.)
2. Which deployment environment (Docker/K8s) runs the monolith – does it already expose health‑check endpoints we can proxy?
3. Are there any external consumers (mobile SDKs, third‑party APIs) that directly hit the monolith’s internal routes?

---

## 3. System Mapping (high‑level)
```
+-------------------+   +-------------------+   +-------------------+
|   Auth Pages      |   |   BAC Pages       |   |   Theme Service   |
| (src/auth‑*.tsx) |   | (src/bac‑*.tsx)   |   | (packages/theme)  |
+--------+----------+   +---------+----------+   +--------+----------+
         |                       |                       |
         |   Shared Rendering   |   Shared Rendering   |
         +--------+--------------+----------+------------+
                  |                         |
            src/start.ts (AsyncLocalStorage)   |
                  |                         |
        +---------+----------+   +----------+----------+
        |   SSR Engine       |   |   Data Layer (Postgres) |
        +--------------------+   +--------------------------+
```
*Key observations*
- **Theme data** is duplicated: Tailwind config (`src/shell/ssr-engine.ts`) and JSON (`themes/mosaix-default/theme.json`).
- **Shared rendering** (head block, style injection) lives in `src/start.ts`; recent HEAD `ee98e3e` broke its AsyncLocalStorage closure, causing runtime errors.
- **Lint/type‑check failures** are spread across many modules (37 lint errors, missing import in `packages/theme/src/theme-discovery.ts`).
- **Test suite** is otherwise healthy (1164 passed, 1 failed) – indicates a relatively stable code base.

---

## 4. First Migration Slice – **Theme Service**
### 4.1 Scope
- Extract the entire theme discovery & Tailwind generation logic into an **independent service** (`theme-service`).
- Replace all direct imports of `getTailwindThemeColors()` and `var(--color‑*)` with **runtime API calls** (`/api/theme`) that return a JSON payload derived from a **single source of truth** (`themes/mosaix‑default/theme.json`).
- Provide a thin **adapter** for the SSR engine to fetch the theme at request time (cached per request).
### 4.2 Benefits
- Eliminates the colour‑source mismatch (the root cause of UI inconsistency).
- Reduces the surface area of the monolith – the theme module becomes a **stateless microservice** that can be deployed independently.
- Allows gradual rollout: shadow‑route requests to the new service for a small percentage of traffic.
### 4.3 Estimated Effort
- **Code changes:** 5‑7 files (`src/start.ts`, `src/shell/ssr-engine.ts`, `packages/theme/src/*`, API route, Dockerfile).
- **Testing:** Add integration test for `/api/theme` (≈ 4 h).
- **Deployment:** Add a new Docker compose service (≈ 2 h).
- **Total:** **≈ 2 person‑days** (excluding the prerequisite lint/type‑check fixes).

---

## 5. Candidate Slice Scoring (high‑level)
| Slice | Business Impact | Technical Risk | Data Coupling | Migration Cost | Score (0‑10) |
|-------|------------------|----------------|--------------|----------------|-------------|
| Theme Service | High (UI consistency) | Low (pure data) | Low (theme JSON) | Low (few files) | **9** |
| Auth Page Refactor | Medium (login flow) | Medium (session handling) | Medium (cookies) | Medium | 7 |
| BAC Page Refactor | Medium (admin UI) | Medium (render pipeline) | Low | Medium | 6 |
| Full SSR Engine Split | High (performance) | High (AsyncLocalStorage) | High | High | 5 |
| ChatGPT‑Web MCP cleanup | Low | Low | None | Low | 4 |

---

## 6. Service Contract (Theme Service)
- **Endpoint:** `GET /api/theme?mode=dark|light`
- **Response:** `{ colors: { primary: "#…", background: "#…", … }, tailwindConfig: { … } }`
- **Errors:** `404` if mode not found, `500` on JSON parse error.
- **Idempotence:** Fully idempotent, cacheable for the lifetime of the request.
- **Versioning:** Semantic version in header `X‑Theme‑Version` (derived from git commit hash of `theme.json`).
- **Timeout:** ≤ 200 ms (local container).

---

## 7. Data Synchronisation & Ownership
- **Source‑of‑Truth:** `themes/mosaix-default/theme.json` (committed in repo). All other representations (Tailwind config, CSS variables) are **generated** from this file.
- **Initial Migration:** Run a one‑off script to rewrite existing `var(--color-*)` usages to the API‑driven values (no runtime change to DB).
- **CDC vs Outbox:** No database writes are involved – categorised as **static configuration**; thus CDC is unnecessary. Future dynamic theme changes could use an **outbox** pattern if runtime editing is added.

---

## 8. Progressive Routing Strategy
1. **Shadow routing** – Deploy the Theme Service alongside the monolith. 5 % of incoming requests are routed (via Envoy/NGINX) to the new service; all others continue to use the in‑process theme.
2. **Cohort rollout** – Increase shadow traffic to 25 % after monitoring latency and error‑rate.
3. **Full cut‑over** – When latency < 50 ms and error‑rate ≤ 0.1 %, switch 100 % of traffic.
4. **Rollback** – Simple DNS/ingress toggle; the monolith remains fully functional.

---

## 9. Gate Review (Pre‑Slice)
| Gate | Current Status | Target | Action |
|------|----------------|--------|--------|
| Lint | 37 errors (including `space-theme‑routes.ts`) | 0 | Fix lint (auto‑fix + manual review). |
| Type‑check | Failing (missing imports, AsyncLocalStorage misuse) | Pass | Resolve missing imports, correct `src/start.ts` closure. |
| Test suite | 1 failing (timeout) | All pass | Fix server start race, add port selection logic. |
| Theme consistency | Mismatch | Consistent | Implement Theme Service (slice). |
| Untracked artefacts | 42 MB in `chatgpt-web-mcp/` | Ignored/cleaned | Add to `.gitignore` or archive. |

---

## 10. Recommendations & Next Steps
1. **Immediate – unblock gates**: Resolve lint, type‑check, and failing test. This is mandatory before any slice is exposed to production traffic.
2. **Implement Slice 1 – Theme Service** (see § 4).
3. **Add `.gitignore` entry** for `chatgpt-web-mcp/` and optionally archive the directory.
4. **Run migration‑runbook** (see output‑templates reference) after Slice 1 passes all gates.
5. **Re‑evaluate** candidate slices (Auth, BAC) once Slice 1 is in production – repeat the audit cycle.

---

*This audit follows the Strangler‑Migration‑Architect skill template and is tailored to the MosaiX code‑base as of 2026‑11‑05.*
