# Plan Général de Remédiation MosaiX & Applications 2026

## 1. Synthèse Exécutive & Stratégie de Livraison

Ce document constitue le **Plan Général de Remédiation** consolidé à la suite des audits techniques approfondis réalisés sur :
1. **Le Framework & Runtime MosaiX** (8 constats : `MOS-001` à `MOS-008`).
2. **L'Écosystème Applicatif & Métier** (8 constats : `APP-001` à `APP-008`).

L'objectif de cette feuille de route est d'apporter les corrections ciblées, mesurables et vérifiables permettant de lever les réserves pour autoriser le déploiement de MosaiX en environnement de production de manière sécurisée et robuste.

### Matrice Récapitulative des Risques & Actions

| Phase | Priorité | Risque Principal | Actions Incluses | Effort Global |
|---|---|---|---|---|
| **Phase 0** | **P0 — Bloquant Prod** | Défaut de build Docker (`dist/`) & Risque de perte de données volatil | `MOS-001`, `MOS-002`, `APP-001`, `APP-002` | **3 H/J** |
| **Phase 1** | **P1 — Priorité Release** | Échec de test CI/CD & Risque de clé JWT courte & UX vendeur | `MOS-003`, `MOS-004`, `APP-003`, `APP-004` | **2 H/J** |
| **Phase 2** | **P2 — Robustesse & Dette** | Incohérences d'exports ESM & Rate Limiting MCP & Cache | `MOS-005`, `MOS-006`, `MOS-007`, `APP-005`, `APP-006` | **3 H/J** |
| **Phase 3** | **P3 — Amélioration Continue** | Alias env hérités & i18n messages de paiement & UX invités | `MOS-008`, `APP-007`, `APP-008` | **1 H/J** |

---

## 2. Feuille de Route Priorisée (P0 - P3)

### Phase 0 : Bloqueurs de Production (P0)

#### 1. Action MOS-001-ACT : Activer l'Émission de Build JavaScript (`dist/`) & Mettre à Jour Docker
- **Identifiants associés** : `MOS-001`
- **Objectif** : Générer de vrais artefacts `.js` compilés pour éliminer le surcoût mémoire/CPU de `tsx` en production.
- **Fichiers cibles** : `tsconfig.build.json`, `scripts/build.ts`, `Dockerfile`, `compose.prod.yml`, `package.json`
- **Correction attendue** :
  - Configurer `tsconfig.build.json` avec `"noEmit": false` et `"outDir": "./dist"`.
  - Modifier `scripts/build.ts` pour qu'il exécute `tsc -p tsconfig.build.json`.
  - Mettre à jour `Dockerfile` et `compose.prod.yml` avec `CMD ["node", "dist/src/start.js"]`.
- **Critères d'acceptation** : `pnpm build` produit un dossier `./dist` contenant l'intégralité du code compilé exécutable via Node.js natif.
- **Méthode de vérification** : `pnpm build && node dist/src/start.js` démarrant le serveur sans erreur.

#### 2. Action MOS-002-ACT : Durcir `InMemoryGuard` pour Bloquer Tout Fallback Volatil en Production
- **Identifiants associés** : `MOS-002`
- **Objectif** : Interdire strictement l'instanciation de tout adaptateur In-Memory si `NODE_ENV === "production"`.
- **Fichiers cibles** : `packages/support/src/in-memory-guard.ts`
- **Correction attendue** :
  - Dans `InMemoryGuard.assertPersistentAllowed()`, lever une exception fatale non rattrapable si `NODE_ENV === "production"` ou `MOSAIX_DEMO_USERS === "false"`.
- **Critères d'acceptation** : Démarrer un composant mémoire en production provoque un arrêt immédiat du processus (`process.exit(1)`).
- **Méthode de vérification** : Test unitaire dédié simulant `NODE_ENV=production`.

#### 3. Action APP-001-ACT : Verrouiller `InMemoryCommerceOfferRepository` sous `NODE_ENV=production`
- **Identifiants associés** : `APP-001`
- **Objectif** : Éviter que la vitrine e-commerce ne devienne silencieusement vide si la base de données est mal connectée.
- **Fichiers cibles** : `apps/commerce/src/infrastructure/postgres-offer-repository.ts`
- **Correction attendue** :
  - Appeler `InMemoryGuard.assertPersistentAllowed("CommerceOfferRepository")` dans le constructeur de fallback.
- **Critères d'acceptation** : Rejet immédiat au boot si `DatabasePort` est absent en production.
- **Méthode de vérification** : Test d'intégration sous `NODE_ENV=production`.

#### 4. Action APP-002-ACT : Sérialiser les Webhooks de Paiement via Verrou SQL Transactionnel
- **Identifiants associés** : `APP-002`
- **Objectif** : Garantir l'idempotence stricte des confirmations de paiement SATIM et Chargily.
- **Fichiers cibles** : `apps/commerce/src/domain/order.service.ts`, `apps/commerce/src/domain/satim-payment-port.ts`
- **Correction attendue** :
  - Exécuter un `SELECT FOR UPDATE` sur la table `orders` au début du traitement de tout webhook de notification de paiement.
- **Critères d'acceptation** : Deux webhooks simultanés sur la même commande sont exécutés séquentiellement sans conflit d'état.
- **Méthode de vérification** : Test de concurrence avec deux appels simultanés simulés via `Promise.all()`.

---

### Phase 1 : Priorités avant Release (P1)

#### 5. Action MOS-003-ACT : Isoler les Tests d'Intégration HTTP sans Spawner de CLI Docker Directe
- **Identifiants associés** : `MOS-003`
- **Objectif** : Permettre l'exécution fiable des tests d'intégration dans tout environnement CI/CD sans socket Docker hôte.
- **Fichiers cibles** : `tests/http/bac-access.http.test.ts`
- **Correction attendue** :
  - Remplacer l'exécution Shell `docker exec createdb` par des commandes SQL directes via le client `pg`.
- **Critères d'acceptation** : `./node_modules/.bin/vitest run tests/http/bac-access.http.test.ts` s'exécute avec succès hors Docker.
- **Méthode de vérification** : Exécution de la suite de tests en environnement isolé.

#### 6. Action MOS-004-ACT : Valider la Longueur Minimale du Secret JWT (≥ 32 Octets) en Production
- **Identifiants associés** : `MOS-004`
- **Objectif** : Éliminer les risques de signature cryptographique faible sur les jetons de session.
- **Fichiers cibles** : `packages/auth/src/jwt-service.ts`
- **Correction attendue** :
  - Bloquer l'initialisation de `JwtService` si le secret contient moins de 32 caractères sous `NODE_ENV=production`.
- **Critères d'acceptation** : Un secret de moins de 32 caractères lève une erreur explicite au boot.
- **Méthode de vérification** : Test unitaire dans `packages/auth`.

#### 7. Action APP-003-ACT : Ajouter un Feedback Visuel d'Erreur sur la Vue Vendeur Space (`view=sell`)
- **Identifiants associés** : `APP-003`
- **Objectif** : Restituer les erreurs de validation serveur à l'utilisateur lors de la soumission d'une proposition produit.
- **Fichiers cibles** : `apps/spaces/src/presentation/spaces-view.ts`, `src/server/routes/spaces-routes.ts`
- **Correction attendue** :
  - Transmettre les paramètres de requête `?error=...` à la vue SSR et afficher une bannière d'alerte rouge explicite.
- **Critères d'acceptation** : L'échec de soumission réaffiche le formulaire pré-rempli avec le message d'erreur d'origine.
- **Méthode de vérification** : Test de rendu SSR sur la vue `view=sell&error=invalid_reference`.

#### 8. Action APP-004-ACT : Mettre en Place une Tâche Chrono de Purge des Paniers Expirés
- **Identifiants associés** : `APP-004`
- **Objectif** : Libérer automatiquement les stocks réservés temporairement dans les paniers abandonnés.
- **Fichiers cibles** : `apps/commerce/src/domain/order.service.ts`, `src/start.ts`
- **Correction attendue** :
  - Ajouter une méthode `OrderService.purgeExpiredHoldings()` appelée périodiquement (ex: toutes les 15 minutes).
- **Critères d me vérification** : Test unitaire vérifiant la remise en stock des articles expirés.

---

### Phase 2 : Robustesse & Réduction de la Dette (P2)

#### 9. Action MOS-005-ACT & MOS-006-ACT : Harmoniser les Exports ESM et les Fallbacks de Thèmes
- **Identifiants associés** : `MOS-005`, `MOS-006`
- **Objectif** : Aligner les champs `exports` de tous les `package.json` et fiabiliser la résolution de thèmes supprimés.
- **Fichiers cibles** : `packages/*/package.json`, `src/shell/theme/theme-bridge.ts`
- **Correction attendue** :
  - Définir une structure d'exports homogène `"." -> "./src/index.ts"` (dev) et `"./dist/index.js"` (prod).

#### 10. Action MOS-007-ACT & APP-005-ACT & APP-006-ACT : Rate Limiting MCP & Validation Schemas
- **Identifiants associés** : `MOS-007`, `APP-005`, `APP-006`
- **Objectif** : Protéger le Gateway MCP contre les DoS, valider le champ `content` des propositions et optimiser l'invalidation de cache Solara.
- **Fichiers cibles** : `packages/mcp/src/server/gateway.ts`, `src/server/routes/spaces-routes.ts`, `apps/solara/src/domain/solara-social-service.ts`

---

### Phase 3 : Amélioration Continue (P3)

#### 11. Actions MOS-008-ACT & APP-007-ACT & APP-008-ACT : Nettoyage Config & i18n
- **Identifiants associés** : `MOS-008`, `APP-007`, `APP-008`
- **Objectif** : Nettoyer les alias de variables obsolètes (`APP_PORT`, `JWT_SECRET`), persister les recherches invités et ajouter les traductions FR/AR des rejets de paiement.

---

## 3. Stratégie de Validation & Critères de Qualification Production

Pour valider l'exécution complète du plan de remédiation, les contrôles automatisés suivants doivent tous être validés :

1. **Compilation & Packaging** : `pnpm build` exécute la compilation sans erreur et génère les artefacts dans `dist/`.
2. **Suite de Tests Complète** : `./node_modules/.bin/vitest run` passe à 100% (189 fichiers, > 1 050 tests).
3. **Validation de Conformité & Quality Gate** :
   - `pnpm lint` : 0 erreur ESLint.
   - `npx tsx scripts/validate-ui-contracts.ts` : 11 contrats UI BACs valides.
   - `pnpm mosaix check:slop` : 0 TODO/FIXME non traçé.
4. **Validation Docker Prod** :
   - `docker compose -f compose.prod.yml up --build -d` démarre les conteneurs sans avertissement in-memory.
   - `curl http://localhost:3000/__mosaix` retourne `{"status":"ok"}`.
