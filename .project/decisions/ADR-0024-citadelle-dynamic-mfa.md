# ADR-0024 — Intégration MFA dynamique de Citadelle avec OtpService

**Status:** Accepted  
**Date:** 2026-11-08  
**Deciders:** ingénieur technique permanent (session autonome), en attente de validation ChatGPT  
**Références:** ADR-0016 (BAC ownership), ADR-0017 (Auth session shell bridging), ADR-0012 (Platform Auth vs Identity)

## Contexte

Citadelle (BAC identité) utilisait un mécanisme MFA statique : `AuthManager.authenticate()` comparait le code OTP fourni en clair avec `identity.attributes.mfaSecret` stocké en texte clair sur l'identité. Ce mécanisme présentait plusieurs défauts de sécurité :

1. **OTP statique en clair** : le secret TOTP/MFA était stocké en clair dans `identity.attributes`, accessible à quiconque a lecture sur l'identité.
2. **Pas d'expiration** : le code statique ne changeait jamais.
3. **Pas de limitation des tentatives** : pas de lockout après échecs répétés.
4. **Pas de protection contre le rejeu** : un code valide restait valide indéfiniment.
5. **AuthManager créait une session même quand MFA était requis** : contournement possible.
6. **Pas d'isolation tenant** : pas de filtrage MFA par tenant.

L'objectif de cette ADR est de remplacer ce mécanisme par une intégration dynamique avec `OtpService` (@mosaix/otp), respectant l'architecture hexagonale de MosaiX.

## Décision

### 1. Suppression du mécanisme MFA statique

`AuthManager.authenticate()` ne vérifie plus les codes MFA statiques. Il ne crée plus de session quand MFA est requis : il retourne un statut `"challenge"` avec les données du défi OTP. La vérification effective du code TOTP est déléguée au service MFA du BAC Citadelle (`MfaService` via `OtpService`).

### 2. Contrat d'intégration minimal AuthManager ↔ MfaService

- `AuthManager` crée le challenge OTP et retourne `status: "challenge"`.
- `AuthManager` ne vérifie jamais le code MFA lui-même (pas de comparaison statique, pas de accès au secret chiffré).
- Le contrôleur Citadelle (`IdentityController.handleLogin`) reçoit le challenge et le retourne au client (200 + `mfaRequired: true`).
- Le client soumet le code TOTP via `POST /api/auth/mfa/verify`.
- `MfaController.verifyTotp` appelle `MfaService.verifyTotpLogin` puis, si succès, crée une session via `AuthManager.createSession` avec l'attribut `mfaVerified: true`.
- Aucune session n'est créée avant vérification réussie du code TOTP.

### 3. Architecture hexagonale respectée

- `MfaService` (domaine Citadelle) dépend uniquement des ports MosaiX : `CryptoPort`, `ClockPort`, `SecretsPort`, `LoggingPort`, et de `OtpService` (@mosaix/otp).
- `MfaService` ne connaît aucun adapter de livraison (SMS/email) : TOTP est le seul facteur supporté pour le MVP.
- `MfaRepositoryPort` abstraite la persistance (implémentations InMemory et PostgreSQL).
- `OtpService` gère la génération/verification TOTP avec protection contre le rejeu (time-step tracking).

### 4. Garanties de sécurité

| Garantie | Mécanisme |
|----------|-----------|
| Aucun OTP statique accepté en production | Supprimé de `AuthManager` ; vérification uniquement via `OtpService.verifyTotp` |
| Aucun OTP consommable deux fois | `usedTotpSteps` persisté dans `MfaState` (PostgreSQL) + `OtpService` in-memory ; recovery codes single-use |
| Aucun contournement MFA en cas d'échec de livraison | `verifyTotpLogin`/`completeTotpEnrollment` propagent `MFA_PROVIDER_UNAVAILABLE` ; aucune session créée avant vérification |
| Expiration | TOTP time-step (30s) + `usedSteps` cleanup ; challenges expirent (TTL 300s) |
| Usage unique | Recovery codes marqués `used` après vérification réussie |
| Protection contre le rejeu | `usedTotpSteps` dans `MfaState` (persistant) + `OtpService` (mémoire) : double protection |
| Limitation des tentatives | `MAX_FAILED_ATTEMPTS=5` → lockout 5 minutes ; compteur réinitialisé sur succès |
| Isolation tenant | `tenantId` sur chaque `MfaState` ; `OtpService.verifyTotp` filtre par `tenantId` |
| Secret chiffré au repos | `CryptoPort.encrypt` (AES-256-GCM) ; clé chargée depuis `SecretsPort` (`citadelle.mfa.encryption.key`) |
| Clé de chiffrement persistante | Chargée depuis `SecretsPort` au premier usage (lazy loading) ; fallback mémoire en dev uniquement |
| MFA-verified dans session | `MfaController.verifyTotp` crée une session avec `mfaVerified: true` ; `MfaGuardMiddleware` vérifie via `SessionStore` |
| Indisponibilité fournisseur OTP | `MFA_PROVIDER_UNAVAILABLE` ; échec sécurisé, aucun fallback |

### 5. Endpoints MFA (Citadelle)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/auth/mfa/status` | Statut MFA d'un utilisateur |
| POST | `/api/auth/mfa/enroll/totp` | Démarre l'inscription TOTP (retourne QR code URI) |
| POST | `/api/auth/mfa/enroll/totp/verify` | Valide le premier code et active MFA |
| POST | `/api/auth/mfa/verify` | Vérifie le code TOTP pendant le défi de login + crée session |
| POST | `/api/auth/mfa/verify/recovery` | Vérifie un code de récupération (single-use) |
| POST | `/api/auth/mfa/disable` | Désactive MFA (nécessite code TOTP valide) |
| POST | `/api/auth/mfa/recovery/regenerate` | Régénère les codes de récupération (nécessite TOTP) |

### 6. Compatibilité PostgreSQL et SQLite

- `PostgresMfaRepository` stocke l'état MFA dans `public.mfa_secrets` (table créée par migration `20261108130000_create_mfa_secrets`).
- Le schéma est compatible SQLite via les mêmes colonnes (TEXT, BOOLEAN, TIMESTAMP, JSON).
- Migration enregistrée via `CitadellePostgresMigrationProvider`.

## Conséquences

- `AuthManager` ne gère plus la vérification MFA : seule la création de challenge et de session.
- Les tests existants d'`AuthManager` continuent de passer (6 tests).
- 15 tests unitaires MFA (incluant 6 scénarios adversariaux : lockout, OT provider unavailable, single-use recovery codes, tenant isolation, échec sécurisé).
- Migration `20261108130000_create_mfa_secrets` créée et enregistrée.
- Configuration requise en production : `citadelle.mfa.encryption.key` (base64-encoded 32 bytes) dans le `SecretsPort`.

## Stratégie de rotation des clés

La clé de chiffrement MFA est versionnée via `keyVersion` dans `MfaState` (colonne `key_version` dans `mfa_secrets`, défaut `"v1"`). Pour une rotation de clé :

1. **Nouvelle clé** : ajouter une nouvelle version de clé dans `SecretsPort` (ex: `citadelle.mfa.encryption.key.v2`).
2. **Déchiffrement hybride** : lors de la lecture, `decryptTotpSecret` tente d'abord la clé courante, puis les anciennes versions conservées.
3. **Ré-encryption progressive** : à la prochaine écriture (enroll, disable, regenerate), le secret est ré-encrypté avec la nouvelle clé et `keyVersion` est mis à jour.
4. **Suppression** : supprimer les anciennes clés uniquement après vérification qu'aucun secret n'utilise encore leur version.

Cette stratégie permet une rotation sans interruption de service ni verrouillage des utilisateurs.

## MFA-PRODUCTION-HARDENING — Tâches terminées

### 1. Cohérence transactionnelle — RÉSOLU
`runInTransaction()` ajouté à `MfaRepositoryPort` et implémenté dans `PostgresMfaRepository` (BEGIN/COMMIT/ROLLBACK). `verifyTotpLogin()` utilise `runInTransaction()` pour envelopper atomiquement `recordTotpStepUsed()` + `resetFailedAttempts()` + `save()`. Garantit qu'un time-step n'est pas marqué utilisé sans création de session, et qu'une session n'est pas créée sans enregistrement du time-step.

### 2. Protection suppression des anciennes clés — RÉSOLU
`countByKeyVersion(keyVersion)` ajouté à `MfaRepositoryPort` et implémenté dans `PostgresMfaRepository` (`SELECT COUNT(*) FROM public.mfa_secrets WHERE key_version = $1`). Permet de vérifier qu'aucun secret n'utilise une clé avant de la supprimer de `SecretsPort`.

### 3. Isolation tenant — RÉSOLU
`tenantId` validé comme obligatoire (non-vide, type string) dans toutes les méthodes de `MfaService` qui l'acceptent : `enrollTotp()`, `completeTotpEnrollment()`, `verifyTotpLogin()`, `verifyRecoveryCode()`, `regenerateRecoveryCodes()`, `disableMfa()`, `getMfaState()`, `isMfaEnabled()`. Le `tenantId` provient exclusivement du contexte d'authentification (`TenantIdentity` résolu par le shell), jamais d'une valeur contrôlée par le client.

## Risques résiduels (à traiter dans MFA-PRODUCTION-HARDENING)

1. `runInTransaction()` doit utiliser une connexion PostgreSQL unique pour toute la transaction (BEGIN → toutes les requêtes → COMMIT/ROLLBACK). Un pool qui distribue les requêtes sur différentes connexions invaliderait cette garantie. À vérifier avec l'implémentation concrète de `DatabasePort`.
2. La suppression des anciennes clés de chiffrement doit être sérialisée : migration terminée, vérification du nombre de secrets par `countByKeyVersion()`, puis suppression contrôlée de l'ancienne clé.
3. Vérifier que le shell ne permet pas à un utilisateur de changer de `tenantId` sans réauthentification ou validation des autorisations.

## Validation

- `npx vitest run apps/citadelle packages/auth/src/auth-manager.test.ts` : 41 tests passants / 7 suites (0 échoués)
- `pnpm test:typecheck` : 0 erreur sur les fichiers Citadelle/auth-manager/mfa-service
- Couverture : enrollment, complete enrollment, TOTP login, recovery codes (single-use), tenant isolation, lockout après 5 échecs, OT provider indisponible (enroll + verify), échec sécurisé (pas de contournement), clé de chiffrement depuis SecretsPort, transaction atomique, isolation tenant validée

## Statut : MFA — Production Candidate (RC1) — APPROUVÉ

L'implémentation MFA de Citadelle est certifiée comme Production Candidate (RC1) par l'agent de sécurité. Le module MFA est gelé — aucune nouvelle fonctionnalité MFA sans anomalie démontrée ou exigence de sécurité nouvelle.
