# BAC Citadelle — Identité, Sécurité & RBAC

## 1. Vue d'ensemble
Le BAC **Citadelle** (`@apps/citadelle`) gère l'authentification des utilisateurs, la gestion des identités, le hachage des mots de passe (Bcrypt / Argon2), la politique de verrouillage après échecs répétés, et le respect du RGPD (Droit à l'oubli / Anonymisation).

## 2. Architecture & Services
- **`AuthService`** : Inscription, connexion, validation de session et génération de tokens JWT.
- **`SecurityGuard`** : Vérification des secrets cryptographiques, protection contre les attaques par force brute (Token Bucket Rate Limiter).
- **`AnonymizationOrchestrator`** : Suppression et purge des données personnelles (RGPD).

## 3. Modèle de Données & Tables SQL
- `citadelle_users` : `(id, email, password_hash, role, status, salt, failed_attempts, locked_until, created_at, updated_at)`
- `citadelle_sessions` : `(id, user_id FK, token_hash, expires_at, created_at)`
- `citadelle_audit_logs` : `(id, user_id, action, ip_address, metadata, created_at)`

## 4. Capacités & API Endpoints
- `citadelle.auth.login` — Authentification par email/mot de passe.
- `citadelle.auth.register` — Création de compte utilisateur.
- `GET /citadelle/profile` — Récupération du profil connecté.
- `POST /identity/privacy/anonymize` — Déclenchement du droit à l'oubli RGPD.

## 5. Contributions UI & Slots
- Widget d'authentification et portail de gestion de profil utilisateur.
