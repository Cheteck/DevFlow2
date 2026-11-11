# Solara — Index du backlog d'audit

> **Artefact produit le 2026-11-10** par un audit en lecture seule de `apps/solara/`.
> Ce dossier documente un audit ; il ne contient aucun code.

## 1. Ce que contient ce dossier

| Fichier | Contenu | Pour qui |
|---|---|---|
| `solara-audit-index.md` | Verdict, tableau de bord, méthode, scoring, renvois | décideur |
| `solara-audit-items-2026-11-10.md` | Registre actionnable des 42 items + fiches de remédiation | implémenteur |
| `solara-audit-report-2026-11-10.md` | Rapport d'audit détaillé, preuves et extraits de code | relecteur / contexte |

**Ordre de lecture** : index → registre (items) → rapport (preuves) au besoin.

## 2. Verdict

**Solara est un « BAC fantôme » : la majorité de ses couches ne sont pas branchées sur la plateforme en exécution.**

Le package possède un modèle de domaine complet, un adapter Postgres, 3 migrations, un schéma `solara.*` dédié, 5 capabilities, 4 schémas d'événements, 10 routes REST et un contrôleur autorisé. Mais :

- aucun shell/app n'appelle `createSolaraApp()` ni `createSolaraComposition()` → **`ServiceProvider.boot()` n'est jamais appelé** ;
- le shell ne câble Solara sur l'adaptateur DB (contrairement à Commerce et Spaces) → **le fil rend un service vide** ;
- aucun chemin de création n'exécute les hooks de modération → **la modération est inopérante** ;
- le namespace de permissions de l'app ne correspond à aucun permission granted par le shell → **403 garantis dès que les routes sont montées**.

Les tests passent (10/10) **parce qu'ils n'exercent que le chemin in-memory**, jamais le chemin de production. Les bugs sont **empilés** : chaque correctif démasque le suivant.

## 3. Tableau de bord

| Sévérité | Items | Nature | Délai recommandé |
|---|---|---|---|
| **P0** | 5 | Bloquants production — le BAC ne fonctionne pas | Vague 1, ordre imposé |
| **P1** | 8 | Architecture & cohérence avec le reste du repo | Vague 2 |
| **P2** | 16 | Logique métier, robustesse, sécurité applicative | Vague 3 |
| **P3** | 13 | Hygiène, dette, documentation | Vague 4 |
| **Total** | **42** | | |

### Score de priorisation

`Score = Impact × Urgence` (chaque facteur ∈ {1,2,3}).

- **Impact** — 1 : défaut circonscrit · 2 : fonctionnalité dégradée ou données fausses · 3 : fonctionnalité morte ou fuite de frontière.
- **Urgence** — 1 : peut attendre une vague · 2 : bloque une autre tâche · 3 : bloque la production.

> La formule « Decision Score » d'AGENTS.md Phase 4 n'est plus définie dans AGENTS.md v2 ; le scoring ci-dessus est explicite et reproductible. À réaligner si la formule est rétablie.

## 4. Méthode & vérifications exécutées

Lecture seule, aucune modification de code.

| Vérification | Commande | Résultat |
|---|---|---|
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | ✅ 0 erreur sur `apps/solara` |
| Tests | `npx vitest run apps/solara` | ✅ 10/10 verts (voie in-memory uniquement) |
| Conformité | `pnpm check:conformance` | ✅ Solara conforme (échec global sur `apps/otp`, hors périmètre) |
| Manifestes | `pnpm check:manifests` | ✅ 17 manifestes valides |
| Lint | `npx eslint apps/solara` | ⚠️ 9 erreurs `boundaries/element-types` (baseline repo-wide : 104 sur solidarity) |
| Comparaison | 10 apps frères + `packages/{security,sdk,orm,feed-engine,plugin-engine}` + `src/shell/**` + `src/server/**` | — |
| Spec | `docs/bacs/02-solara.md` vs implémentation | 6 divergences (cf. rapport §5) |

## 5. Renvois —.work en cours ailleurs dans le repo

Ces items du registre central `.project/backlog/BACKLOG.md` **chevauchent** le présent audit et doivent être coordinés :

| ID central | Titre | Recoupement |
|---|---|---|
| `PLG-04` | Migration Solara Moderator vers HookEngine | = **SOL-P0-04** (modération inopérante) + **SOL-P1-04** (import `src/shell/`) |
| `SHELL-BAC-01` | Shell : statut explicite par BAC + wiring ciblé | = **SOL-P0-02** / **SOL-P0-03** (wiring + matrice persistance/API par BAC) |
| `SHELL-PERM-01` | Shell : source canonique des permissions — *DONE* | ⚠️ **DONE mais insuffisant** : `validateUserPermissions` ne valide que le préfixe BAC (`src/shell/profiles.ts:324-345`), pas la forme action/ressource → **SOL-P0-01** n'est pas couvert |
| `SHELL-TRUTH-01` | Shell : supprimer les comportements trompeurs | couvre les compteurs fictifs shell ; **SOL-P2-11** (pub sponsorisée codée en dur) est cousin mais côté BAC |
| `HYGIENE-DB` | Ownership BAC + FK + seeds CLI | couvre la property `solara.*` ; **SOL-P3-10** (3 sources de migration) s'y rattache |
| `MIG-IMMUT-01` | Garde CI : migrations appliquées immuables | prérequis pour **SOL-P3-10** |

Autres documents :
- `.project/reports/audit-bacs-synthese-2026-11-09.md` §2.5 — Solara : « 1 fichier de test, couverture mince », verdict *P2 — à compléter*. **Le présent audit complète et corrige ce verdict** (le problème n'est pas la quantité de tests, c'est le chemin non testé).
- `.project/architecture/in-memory-policy.md` — **SOL-P0-02** et **SOL-P2-04** violent cette politique (stockage mémoire en fallback silencieux).
- `docs/bacs/02-solara.md` — spec du BAC ; 6 divergences avec l'implémentation (rapport §5).
- `.project/workflows/audit/technical-debt.md` — workflow dont ce dossier est le livrable pour Solara.

## 6. Statuts & workflow

Statuts alignés sur `.project/backlog/BACKLOG.md` : `OPEN` · `VERIFY` · `DONE` · `BLOCKED` · `LATER`.

Règles :

1. Un item est `OPEN` tant qu'aucune preuve n'est jointe ; `VERIFY` quand le correctif est écrit mais non prouvé ; `DONE` quand **la preuve est jointe** (test, sortie de commande, capture).
2. La vague 1 a un **ordre imposé** : `SOL-P0-01` → `SOL-P0-02` → `SOL-P0-03` → `SOL-P0-04` → `SOL-P0-05`. Chaque étape révèle la suivante.
3. Toute action doit respecter AGENTS.md §6 (save point Git, plan annoncé, un changement à la fois).
4. Un item `DONE` qui concernait la production doit redémarrer le serveur et prouver le comportement réel — pas seulement le test unitaire.
5. **Critère de sortie de vague 1** : `GET /api/solara/feed` renvoie les publications présentes en base, et `POST /api/solara/posts` crée une publication **persistée, modérée et visible**.

## 7. Ce qui est sain — à préserver

À lire avant de refactorer : ces éléments sont corrects et ne doivent pas être cassés par les remédiations.

- Les **3 migrations** sont remarquablement documentées (`20260926130000_harden_solara.ts` explique chaque décision, y compris les non-décisions) et le durcissement SQL est correct : unicité sur le quad des followers, CHECK anti-auto-suivi, CHECK des vocabulaires fermés, compteurs `>= 0`, index de déterminisme `(createdAt DESC, id DESC)`. Elles sont **effectivement branchées** (`src/shell/bac-migrations.ts:357-369`).
- Le `PostgresSocialRepository` est un **adapter propre** : SQL paramétré partout, `ON CONFLICT` sur les clés naturelles, coercitions défensives (`asString`/`asNumber`/`asRecord`), borne de `LIMIT`.
- Le `PublicationTypeRegistry` est une **bonne extension du vocabulaire** : type ouvert par design, métadonnées requises déclaratives, `validateMetadata` couverte par test.
- Les schémas d'événements sont **versionnés et JSON Schema**, sans dépendance supplémentaire — cohérent avec Citadelle.
- L'intention de `Guard.authorize` sur chaque route est la bonne (à corriger sur le namespace et l'injection, pas à supprimer).
- `check:conformance` et `check:manifests` passent ; `tsc --noEmit` est propre sur Solara.

## 8. Signal AGENTS.md à remonter

> **Règle contrariée (niveau 2).** AGENTS.md §4 impose « Aucun fichier > 300 lignes », mais `src/presentation/solara-view.ts` (539 l.) et `src/domain/social.model.ts` (442 l.) la violent, et **aucun lint ni script ne l'applique** — c'est une règle *aspirationnelle*, ce qu'AGENTS.md §2.4 interdit explicitement.
>
> **Proposition :** soit installer un `max-lines` dans `eslint.config.mjs`, soit reformuler la règle en `max-lines` warn + seuil progressif. Voir §2.2 d'AGENTS.md pour le format de proposition.
