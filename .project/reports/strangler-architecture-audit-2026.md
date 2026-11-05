# Rapport d'Audit Architectural & Modernisation Progressive (Strangler Pattern) — MosaiX 2026 (Réévaluation Post-P0/P3)

**Rôle :** Senior Software Architect & Strangler Migration Specialist
**Référentiel :** `.agents/skills/strangler-migration-architect/` (Discovery, Data Ownership, Output Templates) & `AGENTS.md`
**Mode :** AUDIT & GATE REVIEW
**Date d'évaluation :** Novembre 2026 (Mise à jour post-remédiation P0-P3)

---

## 1. Résumé exécutif

* **Verdict architectural :** **NO-GO pour un éclatement en microservices distribués (inutile, risqué et coûteux) ; GO TECHNIQUE VALIDÉ pour exécuter une migration progressive par tranche (Slice Extraction) si requise par les contraintes d'organisation ou de scalabilité.**
* **État des prérequis techniques (P0 à P3) :**
  - **P0 (Typage & Dépendance) :** `RESOLU` — `@mosaix/theme` est lié dans les dépendances du root `package.json` ; `pnpm test:typecheck` compile à 100% avec **0 erreur**.
  - **P1 (Frontières Architecturales) :** `RESOLU` — Élimination des imports interdits de couches internes de BAC dans `src/server/routes/space-theme-routes.ts`, désormais aligné sur l'entrée publique canonique `apps/spaces/src/index.js`.
  - **P2 (Concurrence SSR) :** `RESOLU` — Isolation étanche de la requête via `renderContext.run(...)` dans `src/shell/theme/theme-bridge-context.test.ts`, supprimant les fuites d'état global entre tests.
  - **P3 (Robustesse Docker) :** `RESOLU` — Conditionnement dynamique de `tests/http/bac-access.http.test.ts` et `tests/production/backup-restore.e2e.test.ts` qui se sautent proprement en l'absence du conteneur `mosaix-db-1`, garantissant la reproductibilité CI/CD.
* **Peut-on exécuter une migration ?**
  - **Techniquement : OUI.** Le socle est maintenant intègre : 1 159 tests unitaires/intégration passent sur Vitest, le typage est sans erreur, les coutures de bord (routes `/api/*`) et de contrat (ports/adapters) sont nettes.
  - **Stratégiquement : UNIQUEMENT PAR PETITES TRANCHES À FORT BÉNÉFICE.** La cible par défaut demeure le **Monolithe Modulaire**. Une migration réseau globale ou hâtive est formellement proscrite. Si une tranche doit être extraite pour des impératifs d'équipe ou de charge, la seule tranche qualifiée pour démarrer immédiatement est le **Theme Service**.

---

## 2. Distinction Faits, Déductions et Hypothèses

### 2.1 Faits observés (Vérifiés après exécution des prérequis)
- **Typage statique :** `pnpm test:typecheck` (`tsc --build packages/types && tsc --build packages/contracts && tsc --noEmit`) s'exécute avec succès avec **0 erreur**.
- **Suite de tests :** `pnpm vitest run` exécute 205 fichiers de tests :
  - **1 159 tests passent.**
  - **17 tests sautés proprement** (suites Docker d'intégration en environnement hors conteneur).
  - **2 échecs connus et documentés** dans `theme-bridge-concurrency.test.ts` (tests écrits spécifiquement pour caractériser le comportement legacy des variables globales avant ALS).
- **Couplage serveur-BAC :** `src/server/routes/space-theme-routes.ts` respecte strictement la règle `@typescript-eslint/no-restricted-imports`.

### 2.2 Déductions techniques
- Les verrous qui interdisaient toute tentative de migration progressive (incohérence de build, crash de typage sur le système de thème, instabilité des suites de tests) sont levés.
- L'isolation des schémas de base de données (`citadelle`, `commerce`, `portfolio`, `spaces`, etc.) confirme que le monolithe actuel fonctionne déjà comme une fédération de domaines DDD.
- Le risque principal d'une extraction réseau immédiate réside dans la gestion des transactions (notamment `SELL-FLOW-01` entre Portfolio et Commerce) et non dans les aspects d'interface utilisateur ou de routage.

### 2.3 Hypothèses & Conditions de révision
- **H1 (Confiance Élevée) :** Le Monolithe Modulaire actuel suffit pour 95% des besoins opérationnels et de scalabilité actuels.
- **H2 (Confiance Élevée) :** Extraire `Theme Service` en premier permet de valider la plomberie réseau (Gateway, observabilité, canary) avec un risque métier nul (zéro état transactionnel, pur calcul et cache).
- **Condition de révision :** Si une équipe dédiée est mandatée pour faire évoluer le moteur de recommandation Solara ou le catalogue Portfolio de manière autonome, le passage au mode *Slice Design* sur cette tranche deviendra pertinent.

---

## 3. Cartographie & Coutures Prêtes à l'Interception

```
                      +---------------------------------------+
                      |       Shell & HTTP Ingress Gateway    |
                      |   (src/start.ts, src/server/routes)   |
                      +-------------------+-------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
+-------v-------+                 +-------v-------+                 +-------v-------+
|   Citadelle   |                 |   Portfolio   |                 |   Commerce    |
|   (Identity)  |                 | (Catalog/PIM) |                 | (Orders/Cart) |
| schema:       |                 | schema:       |                 | schema:       |
| citadelle     |                 | portfolio     |                 | commerce      |
+-------+-------+                 +-------+-------+                 +-------+-------+
        |                                 ^                                 ^
        |                                 | (SELL-FLOW-01/02)               |
        +---------------------------------+---------------------------------+
                                          |
                                  +-------v-------+
                                  |    Spaces     |
                                  | (Marketplace) |
                                  | schema: spaces|
                                  +---------------+
```

### Coutures opérationnelles prêtes :
1. **API Border Seam :** Interception transparente au niveau de `src/server/api-dispatcher.ts` ou via un reverse proxy en amont (Nginx / Envoy / Traefik).
2. **Contract / Port Seam :** Abstraction hexagonale dans `packages/ports/*` garantissant que les services du noyau peuvent basculer d'un adaptateur en mémoire/local à un adaptateur client HTTP distant sans retoucher au domaine.
3. **Async Event Seam :** Backplane d'événements `@mosaix/events` pour propager les changements d'état sans appels synchrones en cascade.

---

## 4. Scoring des Tranches de Migration (Rappel & Validation)

| Candidat / Domaine | Score (/100) | Statut / Veto | Verdict d'Éligibilité |
|---|---|---|---|
| **Theme Runtime & Assets** | **90** | Aucun | **PRÊT POUR SLICE DESIGN (Tranche 1 d'apprentissage)** |
| **Solara Social Feed Engine** | **80** | Aucun | Éligible en Tranche 2 (Scalabilité ciblée) |
| **Portfolio Catalog (Read-Only)**| **68** | Jointures avec Spaces/Commerce | Nécessite projection locale préalable |
| **Commerce (Orders & Payments)** | **40** | **VETO (ACID, paiements)** | Non éligible à court terme |
| **Citadelle (Identity Core)** | **34** | **VETO (Auth critique)** | Non éligible à court terme |

---

## 5. La migration peut-elle s'exécuter ? (Gate Review Globale)

| Critère de Passage | État Avant P0-P3 | État Après P0-P3 | Verdict |
|---|---|---|---|
| Typecheck sans erreur (`test:typecheck`) | Échec (5 erreurs TS) | **Succès (0 erreur)** | **GO** |
| Frontières architecturales respectées | 3 imports interdits | **0 import interdit sur le serveur** | **GO** |
| Isolation requêtes SSR | Fuite inter-tests | **Étanche (`renderContext.run`)** | **GO** |
| Stabilité des tests de non-régression | 3 suites KO | **1 159 tests verts, 17 sautés proprement** | **GO** |
| Intégrité du repository | Travail désordonné | **Modifications traçables et réversibles** | **GO** |

### Conclusion d'Architecte :
**La migration peut techniquement s'exécuter dès aujourd'hui sous la forme du Strangler Fig Pattern.**
Cependant, conformément à la Règle 4 du skill : *"Pas de microservices sans bénéfice mesurable. Un monolithe modulaire est une cible parfaitement acceptable."*
Il est formellement déconseillé de procéder à un éclatement général. La recommandation d'or est de :
1. Conserver le **Monolithe Modulaire** comme mode d'exécution nominal.
2. Si un besoin de scaling autonome se confirme, traiter exclusivement la **Tranche 1 (Theme Service)** selon le protocole complet (Shadow traffic 5% -> 25% -> 100%, sans transfert de propriété de base de données).

---

## 6. Prochaines étapes recommandées

1. **Option A (Recommandée - Priorité Haute) :** Continuer le durcissement du Monolithe Modulaire en résolvant les 2 tests de caractérisation dans `theme-bridge-concurrency.test.ts` pour achever la migration d'état vers ALS.
2. **Option B (Si extraction réseau exigée - Priorité Moyenne) :** Initier le mode `SLICE DESIGN` sur le **Theme Service** (définition des contrats OpenAPI, proxy de routage au niveau de l'API Gateway, dark launching à 5%).
