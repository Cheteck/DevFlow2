# Production Audit — MosaiX

**Dernière mise à jour :** 2026-10-31 — Itération 1 (audit initial + consultation architecte)
**Branche d'analyse :** `audit-technique-mosaix-8397822254578305712` @ `457ce11`

---

## 1. État des lieux vérifié

| Domaine | État | Preuve |
|---------|------|--------|
| Tests | ✅ 1143 passants / 195 suites (1 suite inerte : `chatgpt-web-mcp/tests/phase1.test.js` hors périmètre) | `pnpm test` 2026-10-31 |
| TypeScript | À vérifier (`pnpm test:typecheck` non exécuté) | — |
| Lint | À vérifier (`pnpm lint` non exécuté) | — |
| Architecture | Hexagonale 3 plans, 10 BACs, 39 packages, ADRs documentés | `README.md`, `.project/decisions/` |
| Sécurité | 8 vulnérabilités résolues (SEC-01), DENY-first, isolation multi-tenant testée | commit `457ce11` |
| Observabilité | `/metrics` Prometheus livré (OBS-METRICS-01) mais fallbacks in-memory actifs sans config DB/Redis | logs test + BACKLOG |
| CI/CD | Pas de workflow GitHub Actions de release (`.github/` existe — à inspecter) | — |
| Infra | Dockerfile + compose prod/staging, healthcheck `/__mosaix` dans l'image | `Dockerfile`, `compose.prod.yml` |

## 2. Diagnostic initial (vérifié dans le code)

### P0 — Bloquants prod
| ID | Risque | Preuve dans le code |
|----|--------|---------------------|
| R06 | **Fail-open silencieux** : les adapters tombent sur in-memory (Metrics, Tracer, SessionStore, repositories) quand l'infra est absente — y compris potentiellement en prod | Signaux `⚠️ In-memory fallback adapter` massifs dans la sortie de test ; à confirmer dans `bootstrap/` |
| R05 | `/health` ne vérifie probablement pas DB/Redis (à confirmer) | `src/server/` — à inspecter |
| R01 | **Secrets** : `MOSAIX_APP_KEY` one-time ; rotation via `MOSAIX_APP_PREVIOUS_KEYS` existe (README) mais pas de révocation ni de versioning | `packages/config/src/app-key.ts` (tests 8/8) |
| R02 | **Migrations** : incident `commerce.shop.v1.001` déjà documenté (mutation en place) ; garde CI MIG-IMMUT-01 en OPEN P1 | BACKLOG.md |
| R07 | **Backup/Restore** : aucune stratégie RPO/RTO documentée | absence dans `.project/` |

### P0 conditionnels
| ID | Risque |
|----|--------|
| R03 | Transactions distribuées inter-BACs (sagas/compensation partielles : SELL-FLOW-01 DONE mais couverture générale à auditer) |
| R04 | Surface d'attaque MCP (auth Bearer + permission gate existent — audit de permissions à faire) |
| R08 | Isolation multi-tenant : tests P0/P1 ajoutés (`457ce11`) — restant : RLS PG + cache Redis |
| R09 | CI/CD release reproductible |

### P1
- R10 Résilience : circuit breakers, retry bornés, graceful shutdown (à auditer)
- R11 Observabilité : traces inter-BAC, alertes, SLO
- R12 Documentation prod consolidée (ce fichier + ROADMAP)
- R13/R14 Charge & performance (benchmarks absents)

## 3. Consultation architecte (ChatGPT, 2026-10-31)

**Verdict : pas de Go-Live.** Maturité logicielle « encourageante », garanties opérationnelles non démontrées.

### Risques ajoutés par l'architecte (non dans mon diagnostic)
1. **Migrations DB** : versioning, lock de concurrence, rollback, compatibilité schéma — le plus critique.
2. **Transactions distribuées** : saga + outbox transactional + idempotence + compensation sur tous les workflows inter-BACs.
3. **Isolation tenant** : RLS PG, clés Redis tenant-scoped, E2E anti-fuite inter-tenant.
4. **MCP = frontière d'exposition** : le client MCP ne doit jamais dépasser les privilèges du principal ; ops sensibles à protéger explicitement.
5. **Backup/DR** : RPO 15 min / RTO 60 min proposés ; PITR testé ; « une sauvegarde jamais restaurée n'est pas une preuve ».
6. **Anti-patterns à chasser dans le code** : silent fallback, hidden coupling BAC→BAC, unbounded operations.

### Exigences non négociables avant Go-Live (architecte)
1. Data safety : restauration PG réussie + workflows critiques cohérents.
2. Security : secrets versionnés/révocables + audit MCP.
3. Failure handling : **pas de fallback in-memory silencieux en prod**.
4. Deployment safety : artefact testé en staging = artefact prod, rollback, post-deploy verification.
5. Operational visibility : chaque BAC observable (traces, métriques, logs, alertes).

### Checklist 41 points livrée par l'architecte
→ transposée dans `PRODUCTION_READINESS.md` (section checklist).

### Décisions de mon arbitrage (après vérification code)
- Les 5 P0 initiaux sont confirmés et complétés par R02/R03/R07/R08.
- Documentation = P1 (pas P0) : accord avec l'architecte, ce n'est pas une mesure de sécurité.
- **Priorité d'exécution** : R06 (fail-open) → R05 (health probes) → R02 (migrations) → R09 (CI) → R01 (secrets) → R07 (backup) → R03/R04 (audit).

## 4. Risques résiduels connus
- La suite `tests/http/bac-access.http.test.ts` prend 65 s (lent, potentiel flaky sous charge).
- `.tsc-errors*.txt` à la racine : artefacts de build à nettoyer (dette d'hygiène).
- `chatgpt-web-mcp/` untracked + test inerte dans le workspace vitest (à exclure ou isoler).
- Fichiers orphelins racine : `code.html`, `prompt.txt`, `multivendeur_grille_*.html`, logs `dev-*.log`.

## 5. Prochaines itérations
Voir `PRODUCTION_ROADMAP.md`.
