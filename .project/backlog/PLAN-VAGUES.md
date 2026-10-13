# Plan en vagues — Restauration post-`a055b8e` + sortie release

- **Créé :** 2026-10-13 · **Base :** HEAD `a055b8e`, audit `AUDIT-RESET` (19 fichiers commentés), analyse backlog-vs-code.
- **Principe :** aucune vague ne commence si la précédente n'a pas son critère de sortie (preuve = test/commit/log). Aucun batch agent « and N more » sans liste explicite des fichiers.
- **Règle transversale :** logique métier inchangée hors vague assignée ; tout écart backlog-vs-code rouvre une tâche avec preuve.

## Vague 0 — Sécurisation (stop the bleeding)

**Objectif :** rendre l'arbre auditable et empêcher un second incident reset.

| # | Tâche | Fichiers | Validation |
|---|---|---|---|
| 0.1 | Commiter **séparément** les 19 commentaires `AUDIT-RESET` (commit `docs(audit)` isolé, zéro logique) | 19 fichiers listés au rapport d'audit | `git show --stat` : que des `+commentaires`, `numstat` 0 suppression |
| 0.2 | Inventorier les ~47 fichiers modifiés non commités + 9 untracked, trier par périmètre (commerce-view, mcp-routes, stdio-server…) | `git status` | Liste publiée dans le rapport de session, chaque lot rattaché à une tâche BACKLOG |
| 0.3 | Commiter par lots atomiques et conventionnels (un périmètre = un commit), untracked rattachés ou supprimés | idem | `git log --oneline` lisible, arbre `M` résiduel expliqué |
| 0.4 | Figer la règle agent : batch explicite + `git status` avant/après tout reset/checkout | `.project/workflows/` si récurrent | Règle écrite, lien depuis ce plan |

**Sortie :** arbre propre, chaque modification rattachée à un commit atomique. **No-go :** commencer V1 sur arbre sale.

## Vague 1 — Restauration des pertes confirmées (P1)

**Objectif :** réintroduire exactement ce que la session annonçait et que `a055b8e` ne contient pas.

| # | Tâche | Fichiers | Validation |
|---|---|---|---|
| 1.1 | `PendingPayment` : union `OrderStatus` + transitions machine (PAY/CANCEL/REFUND selon saga checkout) | `commerce/.../order.model.ts`, `order-state-machine.ts` | Tests `can/allowsTransition/transition` verts, `tsc` 0 erreur |
| 1.2 | Saga SELL-FLOW-01 : `approvedTerms`, `auditTrail`, clé d'idempotence sur `Proposal` + persistance dans `approve()` | `portfolio/.../proposal.ts`, `proposal-service.ts` | `proposal.test.ts` : approbation persistante + échec provisionnement sans double vendable |
| 1.3 | SELL-FLOW-02 backend : recréer `spaces-routes.ts` (POST `/api/spaces/:spaceId/proposals`) + wiring dispatcher + test route | `server/routes/spaces-routes.ts` (new), `server/api-dispatcher.ts`, `tests/spaces-proposals-route.test.ts` (new) | Test E2E soumission vendeur vert (201 + refus non autorisé) |
| 1.4 | Promos : cas non-cumul abusif (refusé) vs légitime (accepté) | `commerce/.../promotion.test.ts` | Suite `PromotionEngine`/`CouponService` verte |

**Sortie :** les 4 pertes ne sont plus des pertes (preuves par tests). **No-go :** passer en V2 avec un `verifyWebhook`-style stub non documenté.

## Vague 2 — Finir SELL-FLOW-02 de bout en bout

**Objectif :** brancher le formulaire existant sur le backend restauré.

| # | Tâche | Fichiers | Validation |
|---|---|---|---|
| 2.1 | `view=sell` poste vers POST route (action explicite, erreurs affichées, succès honnête) | `spaces/.../spaces-view.ts` | Parcours manuel + test : formulaire → 201 → proposition visible |
| 2.2 |Chaîne vendeur complète : proposition → revue (`PORT-UI-04`) → approbation → offre provisionnée | `portfolio-view.ts`, `proposal-service.ts` | E2E SELL-FLOW-01+02 vert, events cohérents |
| 2.3 | Requalifier `SELL-FLOW-02` DONE (preuve jointe) ou scinder `02-A/02-B` | `BACKLOG.md` | Statut adossé à commit/test, pas à affirmation |

**Sortie :** un vendeur peut réellement mettre en vente et voir son offre publiée. **No-go :** formulaire qui poste dans le vide.

## Vague 3 — Preuves paiements / MCP / shell (P0)

**Objectif :** lever les contradictions backlog-vs-gate relevées à l'analyse.

| # | Tâche | Fichiers | Validation |
|---|---|---|---|
| 3.1 | `BOUND-02` : vérification webhook SATIM réelle (HMAC/secret) ou décision ADR + périmètre (sinon : interdire `return true` en prod par garde d'env) | `satim-payment-port.ts`, ADR si exception | Test callbacks valide/invalide ; case gate `RELEASE-READINESS.md:26` cochée avec preuve |
| 3.2 | `MCP-03c` : preuve Bearer crypto E2E (fini `principal-resolver.ts:27` simulé) OU repasser DONE→VERIFY | `principal-resolver.ts`, `gateway.ts`, tests MCP | Anonyme deny `-32001` prouvé, 0 permission fantôme (grep MANIFESTs) |
| 3.3 | `SHELL-SEC-01` : exécuter la suite frontières (handlers `/api/*`, multi-tenant, SSR) et corriger les divergences | `tests/security-shell-boundaries.test.ts` | Suite verte + rapport ; trancher `identity→citadelle` avec les 2 suites et `profiles.ts` ensemble |

**Sortie :** chaque case P0 de la gate est cochée avec preuve ou convertie en tâche datée (jamais de contournement silencieux).

## Vague 4 — Validation release (P1/VERIFY → gate)

**Objectif :** transformer les `VERIFY` en preuves reproductibles.

| # | Tâche | Validation |
|---|---|---|
| 4.1 | `VIEW-E2E-A/B` : E2E `/commerce`, `/portfolio`, `/spaces`, `/citadelle` sur config cible | Parcours verts, logs joints |
| 4.2 | `AUTH-E2E`, `DB-PGSQL-E2E`, `DATA-07c` : restart PG, `db:setup`, concurrence triggers | Preuves E2E PG |
| 4.3 | `VIEW-ADMIN`, `VIEW-E2E` preuves + `BACKLOG.md`/`RELEASE-READINESS.md` mis à jour (dates, commits, statuts) | Registre recompte depuis les statuts, gate signée |
| 4.4 | Décision release : go (gate verte) ou report avec P0/P1 datées | Rapport `session-*.md` + checklist signée |

**Sortie :** gate de sortie signée ou report motivé.

## Mutations backlog à appliquer avec ce plan

- `SELL-FLOW-02` DONE → OPEN (motif : backend absent, voir audit) ; `SELL-FLOW-01` DONE → VERIFY + sous-tâche restauration.
- Ajouter P1 : `RESTORE-PENDINGPAYMENT`, `RESTORE-PROposal-FIELDS`, `RESTORE-SPACES-ROUTE`, `RESTORE-PROMO-NOCUMUL` (preuves = tests verts).
- `MCP-03c`, `BOUND-02` : DONE → VERIFY tant que les cases gate correspondantes sont décochées.
- Dernier rappel : `BACKLOG.md` maj 2026-10-12 < `a055b8e` 2026-10-13 — toute exécution met à jour date + preuve.
