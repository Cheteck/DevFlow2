# Workflow — Security Audit

- **Catégorie :** `audit`
- **Commande :** `/workflow audit security`
- **Niveau de risque par défaut :** `high`
- **Chemin :** `.project/workflows/audit/security.md`

## Purpose

Détecter et classer les vulnérabilités du repository avant qu'elles ne deviennent
des incidents. Produire un rapport exploitable et des tâches correctives priorisées.

## Trigger

- Périodiquement (au moins une fois par milestone).
- Avant toute release.
- Après l'ajout d'une dépendance, d'un endpoint, d'une permission, ou d'un traitement de données.

## Inputs

- code source, notamment entrées utilisateur, API, permissions
- dépendances (`package.json`, lockfile)
- configuration (secrets, variables d'environnement, CI)
- permissions et modèle d'autorisation (Permission Registry / Authorization Engine)

## Process

1. **Secrets** — chercher clés/tokens/mots de passe en clair (code, git history, env committé).
2. **Permissions** — vérifier le modèle `domain:resource:action:scope`, l'isolation tenant, les wildcards abusifs.
3. **Dépendances vulnérables** — audit des dépendances (outil d'audit, versions obsolètes).
4. **Validation des entrées** — inputs non validés, injection, schémas non vérifiés.
5. **Exposition API** — surfaces exposées sans autorisation, endpoints non protégés.
6. **Logs sensibles** — données personnelles/confidentielles loguées en clair.

## Outputs

- `.project/reports/security-audit.md` avec classification :

```
Critical  → action immédiate, arrêt d'exposition si nécessaire
High      → correction prioritaire avant release
Medium    → tâche planifiée
Low       → amélioration continue
```

- Tâches backlog `security:` pour chaque finding.
- Éventuel incident → `/workflow recovery incident-response`.

## Validation

- Chaque finding est vérifiable (fichier, ligne, commande, preuve).
- Une réexécution après correction ne retrouve plus le finding.
- Validation humaine obligatoire pour les actions High/Critical (AGENTS.md).

## Risks

- Faux positifs → vérifier chaque finding avant de l'escalader.
- Faux négatifs (vulnérabilité manquée) → ne jamais affirmer « aucun risque » sans analyse outillée.
- Corrections précipitées qui cassent des fonctionnalités → corriger avec tests et validation.