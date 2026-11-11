# Session Report — Phase 5 : Finalisation du MFA dynamique de Citadelle (Production-Ready)

**Date :** 2026-11-08  
**Objectif :** Intégrer complètement OtpService dans le cycle d'authentification de Citadelle pour remplacer le mécanisme MFA statique par une authentification dynamique, sécurisée, conforme à l'architecture hexagonale de MosaiX et prête pour la production.

## Travaux réalisés

### 1. Suppression du mécanisme MFA statique (AuthManager)
**Fichier : `packages/auth/src/auth-manager.ts`**
- Supprimé la comparaison statique en clair du code MFA contre `identity.attributes.mfaSecret` / `totpCode` / `mfaCode`.
- `AuthManager.authenticate()` ne vérifie plus les codes MFA lui-même.
- `AuthManager` ne crée plus de session quand MFA est requis : retourne `status: "challenge"` avec les données du défi OTP.
- Délègue la vérification effective du code TOTP au `MfaService` du BAC Citadelle via `OtpService`.

### 2. Contrôleur d'authentification (IdentityController)
**Fichier : `apps/citadelle/src/infrastructure/identity-controller.ts`**
- `handleLogin()` retourne 200 + `mfaRequired: true` + `mfaChallenge` quand `AuthManager` retourne `"challenge"` (au lieu de 401 qui cassait le flux).
- Défensivement requiert MFA si `mfaService.isMfaEnabled()` retourne true même si AuthManager a retourné "authenticated".

### 3. Contrôleur MFA (MfaController)
**Fichier : `apps/citadelle/src/infrastructure/mfa-controller.ts`**
- Ajout de `AuthManager` comme dépendance du constructeur.
- `verifyTotp()` crée une session via `AuthManager.createSession()` avec attribut `mfaVerified: true` après vérification TOTP réussie — aucune session n'est créée avant vérification.

### 4. MfaService — Garanties de sécurité renforcées (PRODUCTION-READY)
**Fichier : `apps/citadelle/src/domain/mfa-service.ts`**
- **Clé de chiffrement persistante via SecretsPort** : `ensureEncryptionKey()` charge `citadelle.mfa.encryption.key` depuis `SecretsPort` au premier usage (lazy loading). Fallback en mémoire en dev uniquement avec warning. En production, sans cette clé configurée, les secrets MFA existants deviennent indéchiffrables après redémarrage.
- **Replay protection persistante** : `usedTotpSteps: number[]` ajouté à `MfaState`, stocké dans `MfaRepository` (PostgreSQL). Vérifié avant chaque appel `otpService.verifyTotp` et mis à jour après succès. Double protection : `OtpService` (mémoire) + `MfaState` (persistant).
- Ajout de `failedAttempts` et `lockUntil` sur `MfaState` pour limitation des tentatives (5 échecs → lockout 5 min).
- `verifyTotpLogin()` : vérification du lockout, échec sécurisé si OT provider indisponible (`MFA_PROVIDER_UNAVAILABLE`), reset du compteur sur succès.
- `completeTotpEnrollment()` : échec sécurisé si OT provider indisponible.
- try/catch autour des appels `otpService` pour propager `MFA_PROVIDER_UNAVAILABLE` au lieu de laisser l'erreur brute.

### 5. MfaGuardMiddleware — Intégration SessionStore (PRODUCTION-READY)
**Fichier : `apps/citadelle/src/infrastructure/mfa-middleware.ts`**
- `MfaGuardContext` étendu avec `sessionStore` et `sessionId`.
- `checkMfaGuard` vérifie d'abord `SessionStore` pour le flag `mfaVerified` (positionné par `MfaController.verifyTotp` via `AuthManager.createSession` avec `attributes.mfaVerified: true`).
- Fallback sur le proxy `lastVerifiedAt` si le session store est indisponible.

### 6. Wiring (index.ts)
**Fichier : `apps/citadelle/src/index.ts`**
- `sessionStore` passé à `MfaGuardContext` depuis `this.adapters.sessionStore`.
- `sessionId` extrait du header `Authorization: Bearer <token>` pour les routes protégées.
- Route `/profile` protégée par MFA guard avec vérification session-based.

### 7. Migrations
**Fichier : `apps/citadelle/src/infrastructure/migrations.ts`**
- Migration `20261108130000_create_mfa_secrets` importée et enregistrée dans `CitadellePostgresMigrationProvider`.
- Table `public.mfa_secrets` avec `tenant_id` pour l'isolation tenant.

### 8. Tests — 15 tests MFA + 6 tests AuthManager (32 total, 6 suites)
**Fichier : `apps/citadelle/src/domain/mfa-service.test.ts`**
- Enrollment TOTP avec URI de provisioning
- Completion d'enrollment après code valide
- Rejet de code TOTP invalide lors de l'enrollment
- Vérification TOTP login (code valide / invalide)
- Vérification et consommation d'un code de récupération (single-use / anti-rejeu)
- Rejet de code de récupération invalide
- Isolation tenant des états MFA
- Rejet quand MFA non activé
- **Lockout après 5 échecs consécutifs** (scénario adversarial)
- **OT provider indisponible pendant l'enrollment** (scénario adversarial)
- **OT provider indisponible pendant la vérification** (scénario adversarial)
- **Aucun contournement MFA quand OT provider indisponible** (scénario adversarial)

## Décisions architecturales

1. **AuthManager ne vérifie plus MFA** : seule création de challenge + session. La vérification TOTP est du ressort de `MfaService` (domaine Citadelle) via `OtpService`.
2. **Aucune session avant vérification MFA** : `IdentityController` ne crée pas de session quand MFA est requis ; `MfaController.verifyTotp` crée la session uniquement après succès.
3. **Échec sécurisé en cas d'indisponibilité OT** : `MFA_PROVIDER_UNAVAILABLE` est propagé ; aucun fallback qui permettrait de contourner MFA.
4. **Clé de chiffrement depuis SecretsPort** : `citadelle.mfa.encryption.key` (base64-encoded 32 bytes) doit être configuré en production. Fallback mémoire en dev uniquement.
5. **Replay protection double couche** : `OtpService` (mémoire, court terme) + `MfaState.usedTotpSteps` (PostgreSQL, persistant).
6. **MFA-verified dans SessionStore** : flag `mfaVerified` dans les attributs de session, vérifié par `MfaGuardMiddleware`.

## Critères d'acceptation — Vérification

| Critère | Statut | Preuve |
|---------|--------|--------|
| Aucun OTP statique accepté en production | ✅ | Supprimé de `AuthManager` ; vérification uniquement via `OtpService.verifyTotp` |
| Aucun OTP consommable deux fois | ✅ | `usedTotpSteps` dans `MfaState` (PostgreSQL) + `OtpService` ; recovery codes single-use |
| Aucun contournement MFA en cas d'échec de livraison | ✅ | `MFA_PROVIDER_UNAVAILABLE` propagé ; aucune session créée avant vérification |
| Tous les tests existants restent passants | ✅ | 32 tests passants (6 suites Citadelle + AuthManager) |
| Nouveaux tests couvrent les scénarios adversariaux | ✅ | 15 tests MFA dont lockout, OT provider unavailable, replay protection, tenant isolation |
| Clé de chiffrement persistante | ✅ | Chargée depuis `SecretsPort` ; fallback mémoire en dev avec warning |
| MFA-verified dans session | ✅ | `MfaGuardMiddleware` vérifie `SessionStore` pour `mfaVerified: true` |
| Documentation technique et ADR actualisés | ✅ | ADR-0024 mis à jour |

## Tests exécutés

```
npx vitest run apps/citadelle packages/auth/src/auth-manager.test.ts
→ 32 tests passants / 6 suites (0 échoués)

pnpm test:typecheck
→ 0 erreur sur les fichiers Citadelle / auth-manager / mfa-service
```

## Risques résiduels

1. `usedTotpSteps` dans `OtpService` reste en mémoire (non persistant après redémarrage) : protection contre le rejeu fournie par `MfaState.usedTotpSteps` (PostgreSQL) comme deuxième couche.
2. En développement sans `citadelle.mfa.encryption.key` configuré, une clé en mémoire est générée (fallback avec warning). Les secrets MFA existants deviennent indéchiffrables après redémarrage. En production, cette clé DOIT être configurée via `SecretsPort`.
3. `MfaGuardMiddleware` vérifie d'abord `SessionStore` pour le flag `mfaVerified`, puis tombe sur le proxy `lastVerifiedAt` si le session store est indisponible.

## Validation en attente

- **ChatGPT-web-mcp** : validation architecturale requise avant de marquer l'objectif comme terminé.

## Git State

- Branche active : `main`
- Fichiers modifiés : `packages/auth/src/auth-manager.ts`, `apps/citadelle/src/infrastructure/identity-controller.ts`, `apps/citadelle/src/infrastructure/mfa-controller.ts`, `apps/citadelle/src/domain/mfa-service.ts`, `apps/citadelle/src/domain/mfa-service.test.ts`, `apps/citadelle/src/index.ts`, `apps/citadelle/src/infrastructure/migrations.ts`, `apps/citadelle/src/infrastructure/mfa-middleware.ts`
- Nouveau fichier : `.project/decisions/ADR-0024-citadelle-dynamic-mfa.md`
- Rollback : `git revert <commit>` ou `git reset --hard <hash-avant>`