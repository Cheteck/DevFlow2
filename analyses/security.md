# Audit Sécurité Applicative & Supply Chain (Security Audit)

- **Auteur :** Security Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé (Basé sur l'inspection du middleware Gateway, de l'AuthManager et de la configuration des en-têtes)

---

## 1. Analyse de la Surface d'Attaque & Authentification

### Authentification & JWT Pipeline
- **Validation Strict de la Clé JWT :** Le Gateway valide la présence et la longueur minimale (≥16 chars) de la clé `MOSAIX_AUTH_JWT_SECRET` au démarrage. Si la clé est absente en production, le boot s'interrompt immédiatement (Fail-Fast Security).
- **Gestion des Rôles & RBAC :** Le middleware `PermissionGuard` extrait le rôle du token JWT et interroge `AuthorizationEngine` de `@mosaix/auth`.
- **Nouveaux Endpoints MFA (`Identity BAC`) :** Implémentation des endpoints `/identity/mfa/setup` (génération de secret TOTP) et `/identity/mfa/verify` (validation à 6 chiffres).

---

## 2. En-têtes de Sécurité (HTTP Security Headers) & OWASP

Le middleware `SecurityHeadersMiddleware` (`@mosaix/security`) injecte les en-têtes suivants sur chaque réponse HTTP :

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains (si HTTPS)
```

### Vulnérabilités & Recommandations

1. **Content Security Policy (CSP) Permissive sur les Scripts :**
   - *Observation :* En raison de l'injection de scripts client inline dans `ShellHtmlRenderer`, la directive CSP autorise `'unsafe-inline'`.
   - *Risque :* Exposition accrue aux attaques par XSS Stocqué ou Injecté si du contenu utilisateur non nettoyé est rendu dans le DOM.
   - *Recommandation :* Remplacer les scripts inline par un bundler générant des empreintes cryptographiques (Nonces CSP ou SHA-256 hashes).

2. **Cross-Origin Resource Sharing (CORS) :**
   - *Observation :* Le middleware CORS accepte les origines configurées dans `MOSAIX_ALLOWED_ORIGINS`.
   - *Recommandation :* Rejeter explicitement les origines génériques (`*`) en environnement de production.

3. **Protection de la Supply Chain (Packages npm) :**
   - *Observation :* Les dépendances du monorepo sont verrouillées via `pnpm-lock.yaml`. Aucun secret ou clé API privée n'est commité dans les fichiers de code source.
