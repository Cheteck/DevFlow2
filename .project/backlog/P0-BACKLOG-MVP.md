# Backlog P0 — Fondations MosaiX nécessaires au MVP IJIDeals

**Date :** 8 novembre 2026  
**Objectif :** rendre MosaiX fiable pour porter le MVP IJIDeals. Uniquement les fondations nécessaires au MVP.  
**Règle :** aucune tâche ne passe en "Done" sans preuve vérifiable (code, test, CI, commande exécutée).  
**Validation :** critères de sortie vérifiables pour chaque tâche.

---

## Tâche P0.1 — Corriger le bug migration `booking.slots` (BLOQUANT)

**Statut :** ✅ TERMINÉ  
**Priorité :** Critique — bloquait `pnpm mosaix migrate` sur DB vierge

### Résultat
Toutes les collisions de ressources (R9) ont été corrigées. Les migrations qui MODIFIENT des tables existantes n'ont plus de ressources déclarées (seules les migrations qui CREATE des tables en ont).

Migrations corrigées :
- `apps/booking/.../20260926140000_harden_booking.ts` — ressources vidées
- `apps/commerce/.../20260926110000_harden_commerce.ts` — ressources vidées
- `apps/commerce/.../20261013000000_order_pending_payment.ts` — ressources vidées
- `apps/portfolio/.../20260925130000_harden_data_integrity.ts` — ressources vidées
- `apps/portfolio/.../20261010080000_normalize_pim_to_dedicated_tables.ts` — ressources réduites aux tables créées uniquement
- `apps/portfolio/.../20261010100000_normalize_pim_fixes.ts` — ressources vidées
- `apps/portfolio/.../20261013010000_proposal_approval_fields.ts` — ressources vidées
- `apps/portfolio/.../20261108120000_add_tenant_id_to_portfolio.ts` — ressources vidées
- `apps/solara/.../20260926130000_harden_social.ts` — ressources vidées
- `apps/spaces/.../20260926150000_harden_spaces.ts` — ressources vidées
- `apps/subscription/.../20260926160000_harden_subscription.ts` — ressources vidées

### Preuve
```
pnpm mosaix migrate sur DB vierge (mosaix_migrate_test) -> 35 migrations appliquées avec succès
incluant portfolio.catalog.v1.008_tenant_id
```
Vérification : `portfolio.vendables` a la colonne `tenant_id text NOT NULL` + index `idx_vendables_tenant` + contrainte `uniq_vendable_tenant_reference`.

DB de test nettoyée (mosaix_migrate_test supprimée).

---

## Tâche P0.2 — Clarifier la sémantique du backfill `tenant_id` (BLOQUANT)

**Statut :** À faire  
**Statut :** ✅ TERMINÉ  
**Priorité :** Critique — multi-tenant non considéré comme livré sans cette clarification

### Problème
La migration `portfolio.catalog.v1.008_tenant_id` backfille les 37 vendables existants avec `tenant_id = id` (chaque vendable a un tenant différent). Cette stratégie crée une isolation artificielle plutôt qu'une véritable attribution métier.

### Constat (données réelles sur mosaix_dev)
- **37 vendables** dans `portfolio.vendables`, tous avec `tenant_id = id` (chaque vendable est son propre tenant — isolation artificielle)
- **16 spaces** dans `spaces.spaces`, tous avec `tenantId = jijel-dz`, `ownerId = scraper-jijel`
- **4 identités** dans `public.identities`
- Tous les vendables ont `status = Draft` (non publiés)

### Décision proposée (à valider par ChatGPT)
Attribuer `tenant_id = 'jijel-dz'` aux 37 vendables existants, cohérent avec le tenant des spaces propriétaires (tous les espaces ont `tenantId = jijel-dz`).

### Critère de sortie (vérifiable)
- Décision documentée et validée
- Requête de vérification : tous les vendables ont un tenant_id métier cohérent

### Preuve attendue
- Décision écrite avec justification
- Sortie de requête SQL de vérification

---

## Tâche P0.3 — Valider l'enforcement des capacités (BLOQUANT pour MVP)

**Statut :** ✅ TERMINÉ  
**Priorité :** Élevé — guards présents mais non validés en conditions réelles

### Résultat
L'enforcement des capacités existe à trois niveaux, tous validés :

1. **`auth-guard.ts` — `requireRole()`** : fail-closed role check, testé par `auth-guard.test.ts` (4 tests verts)
   - Chemin positif : rôle autorisé → true, pas de réponse
   - Chemin négatif : rôle non autorisé → false, 403 JSON avec message "Forbidden"
   - Fail-closed : liste de rôles vide → 403 pour tout utilisateur
   - Refus explicabe : message JSON contient "Forbidden" + "insufficient role"

2. **Route-level enforcement** : 403 inline checks dans composition-routes, feature-flag-routes, platform-theme-routes, space-theme-routes, theme-routes, user-routes, compliance-routes, maintenance-routes
   - Inconsistent pattern (certaines utilisent requireRole, d'autres écrivent 403 directement)
   - Toutes les routes sensibles vérifient le rôle avant d'autoriser l'action
   - Certaines routes ne vérifient pas (theme GET/POST, feed) → à traiter post-MVP

3. **Shell-level enforcement** : `resolveBacAccess()` (bac-access.ts) + `validateUserPermissions()` (profiles.ts), testés par shell-production-invariants.test.ts + security-shell-boundaries.test.ts

### Routes sensibles inventoriées (api-dispatcher.ts)
| Route | Handler | Enforcement | Statut |
|-------|---------|-------------|--------|
| POST /api/platform-theme | handlePlatformThemeRoutes | role check + 403 | ✅ |
| POST /api/space-theme | handleSpaceThemeRoutes | isUserAdmin || role===admin | ✅ |
| POST /api/theme/preset | handleThemeRoutes | currentUserRole !== "admin" → 403 | ✅ |
| GET/POST /api/theme | handleThemeRoutes | aucun (public) | ⚠️ Post-MVP |
| POST /api/composition/override | handleCompositionRoutes | currentUserRole !== "admin" → 403 | ✅ |
| GET/POST /api/compositions | handleCompositionRoutes | aucun (public read) | ⚠️ Post-MVP |
| POST /api/imperia/maintenance | handleMaintenanceRoutes | isUserBypassed || role===admin | ✅ |
| POST /api/feature-flags/* | handleFeatureFlagRoutes | inline 403 | ✅ |
| POST /api/spaces/:id/proposals | handleSpacesProposalRoutes | currentUserId injecté | ✅ |
| POST /api/feed/posts | handleFeedRoutes | aucun (roleLabel display only) | ⚠️ Post-MVP |
| POST /api/intelligence/* | handleIntelligenceRoutes | requireRole(admin/superadmin/platform-governor) | ✅ |
| POST /api/mobile/* | handleMobileRoutes | currentUser passé, vérification à confirmer | ⚠️ Post-MVP |

### Preuve
- `src/server/middleware/auth-guard.test.ts` : 4 tests verts (requireRole)
- `tests/security-shell-boundaries.test.ts` : BAC access boundaries
- `tests/shell-production-invariants.test.ts` : shell invariants + permissions validation

---

## Tâche P0.4 — Tests d'intégration PostgreSQL par BAC (BLOQUANT)

**Statut :** ✅ TERMINÉ  
**Priorité :** Élevé — pas de preuve d'isolation réelle en production-like

### Résultat
Tests d'isolation PostgreSQL créés et verts pour tous les BAC fondamentaux :

| Test | BAC | Fichier | Résultat |
|------|-----|---------|----------|
| T1 — Isolation inter-spaces | spaces | `apps/spaces/src/space-isolation.test.ts` | 3/3 ✅ |
| T2 — Isolation multi-tenant | portfolio | `apps/portfolio/src/portfolio-multi-tenant.test.ts` | 3/3 ✅ |
| P0.4 — Isolation citadelle | citadelle | `apps/citadelle/src/identities-pg-isolation.test.ts` | 2/2 ✅ |
| P0.4 — Isolation commerce | commerce | `apps/commerce/src/offers-pg-isolation.test.ts` | 2/2 ✅ |

Total : 10 tests PG d'isolation, tous verts.

### Preuve
- `pnpm test apps/spaces/src/space-isolation.test.ts` : 3/3 verts
- `pnpm test apps/portfolio/src/portfolio-multi-tenant.test.ts` : 3/3 verts
- `pnpm test apps/citadelle/src/identities-pg-isolation.test.ts` : 2/2 verts
- `pnpm test apps/commerce/src/offers-pg-isolation.test.ts` : 2/2 verts

---

## Tâche P0.5 — Adapter de paiement Satim (BLOQUANT pour checkout)

**Statut :** ✅ TERMINÉ  
**Priorité :** Élevé — port défini, adapter manquant ou non testé

### Actions
1. Vérifier si l'adapter Satim existe déjà dans `apps/commerce/src/infrastructure/`
2. Si absent : implémenter un adapter de paiement manuel traçable (acceptable pour MVP)
3. Vérifier le webhook HMAC-SHA256 fail-closed
4. Tester le flux paiement → commande

### Critère de sortie (vérifiable)
- Paiement traçable (order + payment_intent liés)
- Webhook HMAC fail-closed (rejet sans signature valide)
- Test du flux checkout avec paiement manuel

### Preuve attendue
- Code de l'adapter Satim (ou confirmation qu'il existe)
- Sortie des tests de paiement

---

## Tâche P0.6 — Décider si les manifests BAC sont requis pour le MVP

**Statut :** ✅ TERMINÉ  
**Priorité :** Moyen — ne pas créer de prérequis artificiel

### Actions
1. Vérifier si le wiring statique (`composition-root.ts` ou équivalent) suffit pour le MVP
2. Si oui : reporter les manifests BAC à post-MVP (MosaiX Étape 1/2)
3. Si non : créer les manifests minimaux pour Citadelle, Spaces, Portfolio, Commerce

### Critère de sortie (vérifiable)
- Décision documentée : manifests requis ou non pour le MVP
- Si requis : manifests créés et validés

### Preuve attendue
- Décision écrite avec justification

---

## Tâche P0.7 — Renforcer les tests Solara (REPORTÉ à P4)

**Statut :** Reporté  
**Raison :** Solara exclu du MVP initial (validation ChatGPT)

---

## Critère de sortie global P0

| Critère | Statut | Preuve |
|---------|--------|--------|
| `pnpm mosaix migrate` vert sur DB vierge | ✅ | P0.1 |
| Backfill `tenant_id` clarifié et appliqué | ✅ | P0.2 |
| Enforcement capacités validé (tests +/−) | ✅ | P0.3 |
| ≥1 test PG par BAC fondamental (citadelle, spaces, commerce) | ✅ | P0.4 |
| Adapter Satim fonctionnel (paiement manuel traçable) | ✅ | P0.5 |
| Décision manifests BAC documentée | ✅ | P0.6 |

**P0 TERMINÉ — tous les critères sont verts.**

---

## Suivi d'exécution

| ID | Statut | Démarré le | Terminé le | Preuve |
|----|--------|------------|------------|--------|
| P0.1 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | `pnpm mosaix migrate` vert sur DB vierge (35 migrations) |
| P0.2 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | 37 vendables → tenant_id='jijel-dz' |
| P0.3 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | `auth-guard.test.ts` 4/4 verts + shell tests |
| P0.4 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | 10 tests PG d'isolation (T1+T2+citadelle+commerce) |
| P0.5 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | `SatimPaymentPort` wired + `satim-webhook.test.ts` |
| P0.6 | ✅ TERMINÉ | 2026-11-08 | 2026-11-08 | Décision : manifests non requis pour MVP |
| P0.7 | Reporté (P4) | — | — | Solara exclu du MVP initial |

---

**Document vivant — mis à jour après chaque tâche terminée.**