# Synthèse — Critique architecturale @mosaix/dev-server

> **Date :** 2026-10-31
> **Auteur :** Technical Steward
> **Source :** Critique ChatGPT + analyse codebase

---

## 1. Contexte

Le package `@mosaix/dev-server` (v0.1.0) a été soumis à une critique architecturale
auprès de ChatGPT. La description complète incluait :
- La classe `DevServer` (HMR legacy)
- Le `DevSupervisor` + Command Center (TUI supervision)
- La CLI `MosaixDevServer` (discovery workspace)

**Demande :** _"Critique l'architecture, identifie les risques, dettes techniques,
incohérences, et propose des améliorations concrètes."_

---

## 2. Verdict ChatGPT

### ✅ Points forts
- Architecture **fonctionnellement cohérente**
- Bonnes **propriétés de sécurité** documentées (restarts sérialisés, shutdown graceful)
- **Honnêteté des états** : RUNNING ≠ READY, FAILED = EADDRINUSE détecté

### ⚠️ Risques prioritaires (7 identifiés)

| # | Risque | Gravité |
|---|--------|---------|
| 1 | **Couplage DevServer / Command Center** | High |
| 2 | **Supervisor fermé** (api+mcp codés en dur) | Medium |
| 3 | **Restart global** (tout restart pour 1 var) | Medium |
| 4 | **Readiness MCP insuffisante** (RUNNING ≠ prêt) | Medium |
| 5 | **Double watch** (tsx + EnvWatcher) | Low |
| 6 | **Absence de tests** (cœur critique non testé) | High |
| 7 | **Mémoire volatile** (perte historique) | Low |

---

## 3. Recommandations ChatGPT

### Évolutions structurelles
1. **Séparer `@mosaix/command-center`** de `@mosaix/dev-server`
2. **Introduire `ManagedService`** avec configuration déclarative
3. **Stratégies de readiness pluggables** (log, HTTP, TCP, stdio)
4. **Mapping env → service** (restart granulaire)
5. **Centraliser la politique de restart** (désactiver double watch)
6. **Tests lifecycle** (concurrence, crash, timeout, shutdown)
7. **Persistence JSONL** (rotation, historique)
8. **Mode `--no-supervisor`** + protection prod explicite

### Priorité
> **Fiabiliser le cycle de vie avant d'étendre les fonctionnalités TUI.**

**Première action :** Découpler `ManagedProcess` de `DevSupervisor` et concevoir
un registre déclaratif de services.

---

## 4. Livrables produits

### 4.1 ADR-0023 — Dev Server Decomposition
**Fichier :** `.project/decisions/ADR-0023-dev-server-decomposition.md`

Décision officielle de découper en 3 packages :
- `@mosaix/dev-session` (existe) — sessions + état
- `@mosaix/dev-server` (réduit) — HMR uniquement
- `@mosaix/command-center` (nouveau) — TUI supervisor
- `@mosaix/cli` (inchangé) — orchestration workspace

### 4.2 Matrice des responsabilités
**Fichier :** `.project/reports/DEV-SERVER-RESPONSIBILITY-MATRIX.md`

Qui fait quoi :
- 16 responsabilités cartographiées
- 4 composants (dev-session, dev-server, CLI, command-center)
- Frontières et règles de non-violation
- Dépendances interdites (boundaries eslint)
- Gaps identifiés (registre, readiness, mapping env, tests)

### 4.3 Diagramme de cycle de vie
**Fichier :** `.project/reports/DEV-SERVER-LIFECYCLE-DIAGRAM.md`

- Cycle de vie **actuel** (DevSupervisor, ManagedProcess)
- Machine à états détaillée (STOPPED → STARTING → READY/RUNNING/FAILED → CRASHED)
- Cycle de restart (EnvWatcher → scheduleRestart → serialized chain)
- Shutdown graceful
- Cycle de vie **cible** (ManagedService, ServiceRegistry, ReadinessStrategy)
- Invariants à préserver

### 4.4 Diagrammes Mermaid
**Fichier :** `.project/reports/DEV-SERVER-LIFECYCLE-MERMAID.md`

9 diagrammes visualisables (GitHub, VSCode, Notion) :
1. Cycle de vie ManagedProcess (state diagram)
2. Séquence de démarrage
3. Restart par .env change
4. Architecture CIBLE (class diagram)
5. Shutdown graceful (flowchart)
6. Calcul état global
7. Restart serialization (mutex + token)
8. Arbre de décision readiness
9. Mapping env → service (futur)

### 4.5 Plan de migration
**Fichier :** `.project/reports/DEV-SERVER-MIGRATION-PLAN.md`

5 phases sur 3-5 jours :
- **Phase 0** : Préparation (audit, branch) — Day 0
- **Phase 1** : Extraction Command Center — Day 1
- **Phase 2** : Dual-write (compatibilité) — Day 2
- **Phase 3** : Migration CLI — Day 3
- **Phase 4** : Nettoyage + docs — Day 4
- **Phase 5** : Améliorations futures (backlog)

**Critères d'acceptation :**
- [ ] Package `@mosaix/command-center` buildable
- [ ] Compatibilité maintenue (dual-write)
- [ ] CLI migré et testé
- [ ] Tests existants passent
- [ ] Documentation mise à jour
- [ ] Boundaries eslint configurées

---

## 5. Prochaines actions recommandées

### Immédiates (cette session)
1. ✅ ADR-0023 créé
2. ✅ Matrice des responsabilités documentée
3. ✅ Diagrammes de cycle de vie produits
4. ✅ Plan de migration détaillé

### Court terme (sessions suivantes)
1. **Exécuter la Phase 1** : Créer `packages/command-center/`
2. **Exécuter la Phase 2** : Dual-write dans `dev-server/src/index.ts`
3. **Exécuter la Phase 3** : Migrer les imports CLI
4. **Exécuter la Phase 4** : Nettoyage + boundaries eslint

### Moyen terme (backlog)
1. **Registre déclaratif** (`ServiceRegistry`)
2. **Stratégies de readiness** (`HttpProbeStrategy`, `StdioHandshakeStrategy`)
3. **Mapping env → service** (`EnvServiceMap`)
4. **Tests du cycle de vie** (vitest)
5. **Persistence JSONL** (`JsonlWriter`)

---

## 6. Impact sur la roadmap

Cette refactorisation **ne bloque aucune feature** :
- Le CLI continue de fonctionner (dual-write)
- Les apps/plugins ne sont pas impactés
- La TUI reste identique fonctionnellement

**Bénéfice :** Rend les futures features **plus faciles** :
- Ajouter un worker = config, pas de code
- Ajouter une readiness HTTP = nouvelle classe
- Restart granulaire = mapping env

---

## 7. Métriques de succès

| Métrique | Avant | Cible |
|----------|-------|-------|
| Packages découplés | 1 (monolithe) | 2 (dev-server + command-center) |
| Tests supervisor | 0 | ≥10 scenarios couverts |
| Types de readiness | 1 (log pattern) | ≥3 (log, HTTP, stdio) |
| Restart granulaire | ❌ (toujours "all") | ✅ (par service) |
| Persistence événements | ❌ (mémoire) | ✅ (JSONL rotatif) |
| Temps ajout worker | 1-2 jours (code) | 1 heure (config) |

---

## 8. Références

- **Critique originale :** Conversation ChatGPT du 2026-10-31
- **Code analysé :**
  - `packages/dev-server/src/dev-server.ts`
  - `packages/dev-server/src/command-center/supervisor.ts`
  - `packages/dev-server/src/command-center/process-manager.ts`
  - `packages/dev-server/src/command-center/env-watcher.ts`
  - `packages/cli/src/dev-server/dev-server.ts`
- **Constitution :** `.project/architecture/constitution.md`
- **Convention Git :** Commits atomiques, ADR liés

---

## 9. Décision requise

**Question au mainteneur :**

> Souhaites-tu que j'exécute **maintenant** la Phase 1 (extraction du
> Command Center) ou préfères-tu d'abord valider l'ADR-0023 et les
> livrables documentaires ?

**Options :**
1. ✅ **Exécuter Phase 1** — Créer le package `@mosaix/command-center`
2. 📋 **Valider docs** — Review ADR + matrices, puis décider
3. 🔍 **Audit préalable** — Vérifier les imports existants avant extraction

---

*Document généré automatiquement suite à la critique ChatGPT.*
