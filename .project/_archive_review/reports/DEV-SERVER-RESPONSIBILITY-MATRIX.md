# Matrice des Responsabilités — Dev Server Ecosystem

> Date : 2026-10-31
> Contexte : Critique architecturale @mosaix/dev-server

---

## 1. Vue d'ensemble des composants

| Composant | Scope | Couche | Environnement |
|-----------|-------|--------|---------------|
| `@mosaix/dev-session` | Sessions de dev, état, transitions | Core | Dev + Test |
| `@mosaix/dev-server` | HMR events, session broadcast | DX | Dev uniquement |
| `@mosaix/cli` (dev) | Discovery workspace, conformance, lanceur | DX | Dev uniquement |
| `@mosaix/command-center` | TUI supervisor, process fleet, diagnostics | DX | Dev uniquement |

---

## 2. Matrice détaillée

### Légende
- ✅ = Responsabilité principale (owner)
- 🔗 = Consomme / dépend de
- ❌ = Ne doit JAMAIS faire cela

| Responsabilité | dev-session | dev-server | CLI dev | command-center |
|----------------|:-----------:|:----------:|:-------:|:--------------:|
| **Gestion sessions dev** | ✅ | 🔗 | ❌ | ❌ |
| **Transitions d'état session** | ✅ | 🔗 | ❌ | ❌ |
| **Broadcast HMR** | ❌ | ✅ | ❌ | ❌ |
| **Gestion abonnés HMR** | ❌ | ✅ | ❌ | ❌ |
| **Discovery workspace apps/plugins** | ❌ | ❌ | ✅ | ❌ |
| **Validation conformance contrats** | ❌ | ❌ | ✅ | ❌ |
| **Launch HTTP server (spawn)** | ❌ | ❌ | ✅ | ❌ |
| **Supervision processus enfants** | ❌ | ❌ | ❌ | ✅ |
| **ManagedProcess (spawn/stop/kill)** | ❌ | ❌ | ❌ | ✅ |
| **TUI render (cockpit)** | ❌ | ❌ | ❌ | ✅ |
| **Watch .env → restart** | ❌ | ❌ | ❌ | ✅ |
| **Diagnostics (incidents, vitals)** | ❌ | ❌ | ❌ | ✅ |
| **EventBus + EventHistory** | ❌ | ❌ | ❌ | ✅ |
| **Secret redaction (logs)** | ❌ | ❌ | ❌ | ✅ |
| **Restart tracker (cycles)** | ❌ | ❌ | ❌ | ✅ |
| **Affichage diagnostic démarrage** | ❌ | ❌ | ✅ | 🔗 |
| **CI mode (JSON output)** | ❌ | ❌ | ✅ | 🔗 |
| **Open browser** | ❌ | ❌ | ✅ | ❌ |

---

## 3. Frontières et règles de non-violation

### Règle 1 : Pas de supervision dans dev-server
> `@mosaix/dev-server` ne contient **aucun** code lié à la supervision de
> processus enfants. Le Command Center est son domaine.

**Violation actuelle :** `index.ts` exporte tous les fichiers `command-center/`

### Règle 2 : Pas de CLI concern dans command-center
> `@mosaix/command-center` ne découvre pas les apps, ne valide pas la
> conformance. C'est le rôle du CLI.

### Règle 3 : Pas de TUI dans la CLI
> Le CLI `mosaix dev` ne contient pas de logique TUI. S'il a besoin du
> cockpit, il importe `@mosaix/command-center`.

### Règle 4 : dev-session = source de vérité
> Seul `@mosaix/dev-session` gère le cycle de vie d'une session (création,
> état, transition). Les autres packages consomment cette API.

---

## 4. Diagramme de dépendances (après découpage)

```
                        @mosaix/dev-session
                               │
                    ┌──────────┴──────────┐
                    │                     │
          @mosaix/dev-server      @mosaix/command-center
          (HMR only)              (TUI + supervision)
                    │                     │
                    │              ┌──────┴──────┐
                    │              │             │
                    │       @mosaix/cli    (apps/plugins)
                    │       (dev command)
                    │              │
                    └──────────────┘
                    import HMR events
                    from dev-server
```

**Direction des dépendances :**
```
command-center → dev-session (sessions)
dev-server     → dev-session (sessions)
CLI dev        → dev-server (HMR)
CLI dev        → command-center (optionnel, TUI mode)
CLI dev        → conformance (validation)
```

---

## 5. Dépendances interdites (boundaries)

| Source | Ne doit pas importer | Raison |
|--------|---------------------|--------|
| `command-center` | `dev-server` | Les deux sont indépendants |
| `dev-server` | `command-center` | HMR ≠ supervision |
| `conformance` | `dev-server` | Validation ≠ runtime |
| Apps/Plugins | `command-center` | Dev-only tooling |
| Apps/Plugins | `dev-server` | Dev-only tooling |

**Mécanisme d'application :**
```json
// eslint-config-mosaix.js
{
  "eslint-plugin-boundaries": [
    "error",
    {
      "rules": [
        {
          "type": "command-center",
          "allow": ["dev-session", "contracts", "core"]
        },
        {
          "type": "dev-server",
          "allow": ["dev-session", "contracts"]
        }
      ]
    }
  ]
}
```

---

## 6. Responsabilités non couvertes (gaps)

| Manquant | Impact | Solution |
|----------|--------|----------|
| **Registre de services déclaratif** | Supervisor fermé (api+mcp) | `ManagedServiceRegistry` dans command-center |
| **Stratégies de readiness extensibles** | MCP = RUNNING ≠ prêt | Interface `ReadinessStrategy` pluggable |
| **Cartographie var env → service** | Restart global inutile | `EnvServiceMap` dans command-center |
| **Protection prod** | Risque de fuite | `"devOnly": true` + eslint boundary |
| **Persistence événements** | Perte au restart | `JsonlWriter` avec rotation |
| **Tests supervisor** | Aucun test cycle de vie | Tests lifecycle + crash + concurrent |

---

## 7. Propriétaire de chaque décision

| Domaine | Décideur |
|---------|----------|
| Nouveau type de service | CLI + Command Center (config) |
| Nouvel événement HMR | Dev Server |
| Nouvelle transition de session | Dev Session |
| Nouveau panneau TUI | Command Center |
| Nouvelle règle de conformance | Conformance package |
| Nouvelle stratégie de readiness | Command Center |
