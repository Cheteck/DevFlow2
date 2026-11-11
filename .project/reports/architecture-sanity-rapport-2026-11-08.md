# Rapport d'analyse d'architecture — MosaiX / DevFlow2

**Méthode :** skill `architecture-sanity` (Observer → Comprendre → Évaluer → Décider → GO/STOP → Améliorer → Valider → Documenter → Boucle d'apprentissage)  
**Date :** 2026-11-08  
**Branche :** `audit-technique-mosaix-8397822254578305712` (ahead de remote par 5 commits)  
**État de la session de référence :** 1170/1170 tests passants / 203 suites (dashboard 2026-11-01)

---

## Forme actuelle (3–5 puces factuelles, sans jugement)

1. **Architecture hexagonale modulaire en BACs autonomes.** Le monorepo organise le domaine en `apps/` (portfolio, commerce, citadelle, solidarity, spaces, subscription, beam, booking, solara, imperia…) et le framework en `packages/` (core, contracts, schemas, gateway, feed-engine, auth, http…). Chaque app expose 4 strates : `domain/` (logique métier pure + ports), `application/` (CQRS/capabilities/événements), `infrastructure/` (repositories, controllers), `presentation/` (vues) — ex. `apps/portfolio/src/{domain,application,infrastructure,presentation}/`.

2. **RuntimeKernel comme arbitre unique.** `packages/core/src/kernel.ts` (647 L) pilote le cycle de vie des applications (machine 7 états : CREATED→…→FAILED), le routage par capacités (permission → contrat → exécution) et l'observabilité. Le noyau ne possède **aucune logique métier** (Constitution, Loi 6 : "The Runtime Is an Arbiter, Never an Actor").

3. **Séparation couches respectée sur l'accès aux données.** Le `repo_map.sh` détecte **[ok] aucun accès direct aux données dans les dossiers UI** (pas de `supabase.from`, `prisma`, `knex`, `db.*`, `SELECT … FROM`, mongoose dans `components|ui|views|pages|app`). Aucune requête SQL ni appel de data-access dans un composant UI.

4. **Point d'entrée serveur unique.** `src/start.ts` (695 L) boot le serveur HTTP, le SSR, les routes API, la maintenance gate et le shell. C'est le seul point d'entrée HTTP.

5. **Tests nombreux et verts.** 221 fichiers de test ; la suite passe à 100 % (0 flaky).

*Source des mesures :* `scripts/repo_map.sh` (voir `.project/reports/` / sortie ci-après), `.project/architecture/god-objects-remediation-plan.md`, `.project/architecture/kernel-issues.md`, `.project/architecture/constitution.md`.

---

## Données de cadrage (repo_map.sh)

| Indicateur | Valeur |
|---|---|
| Stack détectée | TypeScript 5.7, Zod 3.25, Dockerfile |
| Plus gros dossiers source | packages/core (83), packages/adapters (76), packages/contracts (70), src/shell (55) |
| 15 plus gros fichiers | `src/shell/renderer.ts` 1 684 L ; `packages/feed-engine/src/index.ts` 1 403 L ; `src/shell/pages/auth-pages.ts` 1 105 L ; `apps/spaces/src/presentation/spaces-view.ts` 1 084 L ; `apps/portfolio/src/domain/portfolio-service.ts` 738 L ; `apps/portfolio/src/infrastructure/postgres-vendable-repository.ts` 897 L ; `packages/core/src/kernel.ts` 647 L ; `src/start.ts` 695 L |
| Accès direct DB dans l'UI | 0 (contrôle 1 respecté) |
| Fichiers lisant `process.env` / `import.meta.env` directement | 42 (contrôle 7 non respecté : pas de module central + fail-fast) |
| `console.log` | 126 |
| `any` (TS) | 61 |
| `@ts-ignore` / `@ts-nocheck` / `eslint-disable` | 34 |
| TODO / FIXME / HACK | 14 |
| Appels réseau dispersés (fetch/axios hors couche dédiée) | 8 occurrences |

*Note : le plan de remédiation des god-objects est daté du 2026-09-24. Plusieurs fichiers ont grandi depuis (renderer 1 128 → 1 684 L, portfolio-service 628 → 738 L), ce qui rend le plan partiellement obsolète par rapport à la réalité du code.*

---

## Top 3 risques de maintenance / sécurité

Risques classés par **probabilité × coût** (sécurité et perte de données d'abord, puis fiabilité, puis maintenabilité), avec preuve fichier + symptôme.

### Risque 1 — Sécurité / régression XSS (probabilité élevée × coût élevé)

**Preuve :** `src/shell/renderer.ts` (1 684 L), `src/shell/pages/auth-pages.ts` (1 105 L), `apps/spaces/src/presentation/spaces-view.ts` (1 084 L).  
**Symptôme :** ces fichiers concentrent le rendu HTML avec interpolations manuelles. Le plan de remédiation (2026-09-24) signale déjà "risques accrus de régression XSS lors des interpolations manuelles" et "illisibilité / temps de review de PR prohibitif". Ces fichiers ont encore grossi depuis le plan, ce qui aggrave le risque à chaque modification.

### Risque 2 — Perte de données silencieuse (probabilité moyenne × coût élevé)

**Preuve :** `packages/core/src/event-bus.ts`, lignes 236–242 (bloc `deliver`).  
**Symptôme :** quand un handler échoue après tous les retries (`policy.retries`, défaut `0`), l'événement est poussé dans `deadLetterQueue` **sans aucun log** (ni `console`, ni logger structuré). Documenté comme `KNOWN-03` dans `.project/architecture/kernel-issues.md`, classé **P0** dans le backlog de corrections ("Logger les dead-letters (minimum warn)"). Un événement métier peut disparaître sans trace si `retries: 0`.

### Risque 3 — Configuration éparpillée / pas de fail-fast au démarrage (probabilité élevée × coût moyen-élevé)

**Preuve :** 42 fichiers lisent `process.env` / `import.meta.env` directement (repo_map). Aucun module central ne lit et valide l'environnement au démarrage.  
**Symptôme :** violation du contrôle 7 de la skill ("un module central lit et valide l'environnement au démarrage ; échec rapide si une variable manque"). Risque de démarrage en production avec une variable manquante, erreurs silencieuses difficilement diagnostiquables, déploiement fragile.

---

## Plus petit prochain refactor

**Quoi :** logger les événements qui entrent dans la dead-letter queue de l'event bus (KNOWN-03), avec un log structuré (event ID, subscriber, error, attempts, failedAt).

**Où :** `packages/core/src/event-bus.ts`, bloc `deliver` juste après `this.deadLetterQueue.push({…})` (lignes 236–242).

**Comment on sait que c'est réussi (critère de réussite) :**
- tout événement mis en DLQ génère un log `warn` contenant l'identifiant de l'événement et l'erreur ;
- un test unitaire est ajouté dans `event-bus.test.ts` vérifiant le logging en cas d'échec répété d'un handler ;
- la suite de tests existante reste verte (1170/1170).

**Comment on revient en arrière (rollback) :**
- `git revert <commit de la modification>` — c'est une modification localisée (ajout d'un appel de log), réversible en un commit, sans impact sur les autres couches.

*Pourquoi ce refactor et pas un autre :* il adresse le risque de **perte de données** (priorité haute selon la skill), c'est le plus petit changement structurel possible (quelques lignes), il est réversible, et il est déjà identifié P0 dans le backlog existant. Il ne constitue pas une réécriture.

---

## Ce qu'on ne fait pas (et pourquoi)

| Idée écartée | Raison (garde-fous anti-sur-ingénierie) |
|---|---|
| Réécrire `src/shell/renderer.ts` (1 684 L) ou `src/start.ts` d'un coup | Règle d'or de la skill : **jamais de réécriture**. Le god-object plan prévoit déjà un découpage incrémental par étapes (P0 → P2) ; suivre ce plan plutôt que tout refondre. |
| Passer en microservices / file de messages / CQRS / event sourcing | Aucun problème mesuré (latence, coût, équipe bloquée, limite de scalabilité) que le monolithe modulaire n'adresse pas. Un monolithe modulaire bien découpé bat des microservices prématurés pour une petite équipe. |
| Ajouter une bibliothèque de validation d'env tierce avant d'avoir migré les 42 fichiers | Règle de trois : on abstrait à la 3ᵉ répétition, pas à la 1ʳᵉ. Ajouter une dépendance = accepter sa maintenance et sa surface d'attaque. |
| Cache distribué, GraphQL en plus de REST, monorepo outillé lourd | Coût de complexité (déploiement, monitoring, pannes, onboarding) non justifié par un besoin mesuré. |

---

## Décision structurante

Enregistrée ci-après dans `docs/decisions.md` (contexte · décision · alternatives · conséquences, 5 lignes).

---

## Annexe — preuve des mesures (extrait repo_map.sh)

```
== Stack détectée ==
  package.json :
    "typescript": "^5.7.0",
    "zod": "^3.25.76"

== 15 plus gros fichiers source (lignes) ==
     1684 src/shell/renderer.ts
     1403 packages/feed-engine/src/index.ts
     1105 src/shell/pages/auth-pages.ts
     1084 apps/spaces/src/presentation/spaces-view.ts
      897 apps/portfolio/src/infrastructure/postgres-vendable-repository.ts
      738 apps/portfolio/src/domain/portfolio-service.ts
      695 src/start.ts
      647 packages/core/src/kernel.ts

== process.env / import.meta.env éparpillés ==
  fichiers concernés : 42

== Code à risque de maintenance ==
  TODO/FIXME : 14
  any (TS)    : 61
  ts-ignore   : 34
  console.log : 126

== Tests ==
  fichiers de test : 221

== Accès aux données depuis l'UI ==
  [ok] aucun accès direct détecté dans les dossiers UI
```
