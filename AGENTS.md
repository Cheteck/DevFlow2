# AGENTS.devflow

> **Document vivant.** Ce fichier s'améliore à chaque session.
> Chaque agent qui le lit a le droit — et le devoir — de proposer
> des ajouts, des corrections et des suppressions. Voir §2.
>
> Source unique de vérité, lu par tous les harnais (Claude via
> `@AGENTS.md`, Codex et les autres directement).

## 1. Principes stables (ne pas modifier sans accord explicite)

Ces règles sont le socle. Elles changent rarement, et jamais seules.

1. **Sécurité d'abord** — Save point Git avant toute modification non triviale.
2. **Un changement à la fois** — Une chose, puis vérification, puis la suivante.
3. **Vérification humaine** — L'utilisateur teste manuellement après chaque changement. L'agent attend la confirmation.
4. **Demander avant de détruire** — Suppression, renommage massif, nouvelle dépendance : toujours demander.
5. **Ne pas inventer** — Une information manquante se demande, elle ne se devine pas.

## 2. Protocole d'amélioration de ce fichier

> Cette section est la plus importante. Elle décrit comment le fichier
> grandit sans se dégrader.

### 2.1 Signaux qui déclenchent une proposition

Un agent doit proposer un ajout quand l'un de ces signaux apparaît :

- **Correction répétée** — L'utilisateur corrige la même erreur **deux fois**. (fort)
- **Décision implicite** — L'agent a dû choisir sans indication (nom, emplacement, librairie). (moyen)
- **Erreur de l'agent due au contexte** — L'agent s'est trompé parce qu'il ne savait pas. (fort)
- **Pattern répété côté humain** — La même tâche revient **trois fois**. (fort)
- **Vocabulaire nouveau** — Un terme métier n'est pas au glossaire. (systématique)
- **Règle contrariée** — Une règle existante s'est révélée fausse. (critique)

Signaler le signal au moment où il est détecté, pas le mémoriser.

### 2.2 Trois niveaux d'intervention

**Niveau 1 — Silencieux** (l'agent fait, mentionne en fin de message)
- terme au glossaire §9, faute, lien mort, chemin obsolète, workflow au catalogue §8, entrée changelog §11.

**Niveau 2 — Proposé** (l'agent propose, l'utilisateur valide)
- nouvelle règle d'organisation/nommage/style, nouveau workflow, modification d'une règle, activation/désactivation de section.

Format obligatoire :

```
📝 Proposition AGENTS.md — niveau 2

Ajout : [titre court]
Section : [numéro et nom]
Règle proposée : [1 à 3 phrases impératives]
Pourquoi : [signal déclencheur factuel — "corrigé 2 fois", ...]
Portée : [fichiers / modules / situations]
Coût si absent : [ce qui se reproduira]

Appliquer ? (oui / non / reformuler)
```

**Niveau 3 — Approbation renforcée** (jamais automatique)
- modification des principes stables §1, suppression d'une règle, changement de structure du fichier, bascule `stable` ↔ `deprecated`.
- Toucher une règle `stable` depuis plus de 30 jours nécessite **deux confirmations**.

### 2.3 Anatomie d'une règle

Chaque règle porte des métadonnées en commentaire :

```markdown
- **Aucun fichier > 300 lignes.**
  <!-- ajouté: 2026-01-15 · statut: stable · dernier-signal: 2026-03-02 -->
```

- `ajouté` — date d'ajout (maturité).
- `statut` — `experimental` (≤ 3 sessions d'usage), `stable`, ou `deprecated` (à retirer bientôt).
- `dernier-signal` — dernière fois où la règle a servi ou a été confirmée (nettoyage §2.5).
- Règle sans métadonnées = `experimental` par défaut.

### 2.4 Anti-obésité

Le fichier ne doit **jamais** dépasser **250 lignes** hors §9 (glossaire) et §11 (changelog).

Si le seuil est atteint :
1. Signaler l'atteinte.
2. Proposer **une** fusion, reformulation ou suppression.
3. Ne pas ajouter de nouvelle règle tant que le seuil n'est pas redescendu.

Règles anti-bloat :
- **Pas de règle redondante.** Avant d'ajouter, chercher si une règle existante couvre le cas. Si oui, la préciser plutôt que d'en créer une seconde.
- **Pas de règle sans signal.** Non déclenchée en 10 sessions → proposer suppression.
- **Pas de règle contradictoire.** Résolution explicite : l'ancienne passe `deprecated` ou est réécrite. Jamais les deux côte à côte.
- **Pas de règle aspirationnelle.** "Le code doit être propre" ne passe pas. Seules les règles **vérifiables** entrent.

### 2.5 Nettoyage périodique

Si le fichier n'a pas été relu depuis plus de **30 jours** (`dernier-signal` le plus récent), proposer un mini-audit de 3 lignes :

- règles jamais déclenchées → proposer suppression,
- règles `deprecated` depuis > 15 jours → proposer suppression,
- règles `experimental` depuis > 10 sessions → proposer passage en `stable` ou suppression.

L'utilisateur peut ignorer ; la proposition est faite une fois.

### 2.6 Comment éditer

Quand une modification est validée :
1. **Éditer chirurgicalement.** Jamais réécrire le fichier entier.
2. Ajouter une **entrée de changelog** (§11) : date, type, résumé une ligne.
3. Mettre à jour les **métadonnées** de la règle touchée.
4. Mentionner en une ligne à l'utilisateur : `AGENTS.md : +[règle] (§X)`.

## 3. Contexte du projet

MosaiX / IJIDeals : plateforme d'ingénierie autonome (framework + packages internes `@mosaix/*`). Constitution AGENTS.md en place ; procédures détaillées dans `.project/`. À mettre à jour quand l'état change (signal niveau 2).

## 4. Organisation du code

### Rangement par défaut
- `pages/` — un fichier par écran.
- `components/` — composants utilisés sur plus d'un écran.
- `data/` — accès aux données.
- `lib/` — fonctions pures sans dépendance UI.
- `types/` — types partagés.

### Règles structurelles
- Un fichier = un job.
- **Aucun fichier > 300 lignes.**  <!-- ajouté: 2026-11-10 · statut: stable · dernier-signal: 2026-11-10 -->
- Aucune logique métier dans les composants UI.
- Aucun accès direct aux données depuis un écran.
- Réutiliser avant de créer : chercher dans `components/`, `lib/`, `data/` avant toute création.

### Nommage
- Fichiers logique : `kebab-case.ts`. Composants : `PascalCase.tsx`.
- Variables/fonctions : `camelCase` en anglais, sauf termes du glossaire.

## 5. Frontières entre modules métier — OPTIONNEL

> Activer quand l'app compte ≥ 2 domaines métier. Sinon, supprimer.

Le code est découpé par **domaine métier**, pas par type technique.
Chaque domaine vit dans son dossier racine (`booking/`, `profile/`, `payments/`, …).

- Une API publique par module (`module/index.ts`). Le reste est privé.
- Aucun import croisé hors API publique.
- Chaque module possède ses données.
- `shared/` reste petit ; un fichier utilisé par un seul module retourne dans ce module.
- La duplication entre modules est autorisée pour éviter un couplage.
- Enforcement : les violations échouent au lint.

## 6. Avant d'écrire du code

1. Lire les fichiers pertinents uniquement. Ne pas charger tout le projet.
2. Vérifier que la fonctionnalité n'existe pas déjà.
3. Créer un save point si la modification dépasse ~20 lignes.
4. Énoncer le plan en 3-5 lignes : fichiers touchés, pourquoi, critère de succès.
5. Attendre l'accord si le plan touche plus d'un module ou plus de deux fichiers.

## 7. Après avoir écrit du code

1. Ne pas enchaîner sur une autre tâche. Rendre la main.
2. Lister ce qui a changé (fichiers + résumé une ligne chacun).
3. Indiquer quoi tester manuellement.
4. Proposer un save point si le test est concluant.
5. Détecter un signal (§2.1) et, s'il y en a un, formuler la proposition avant de clore.

## 8. Workflows disponibles

Chargés à la demande, jamais en permanence. Les procédures vivent dans
`.project/workflows/<categorie>/<nom>.md` ; le catalogue complet (commandes,
sorties, enchaînements) est dans `.project/workflows/README.md`.

| Commande | Fichier | Usage |
|---|---|---|
| `agent session-start` | `.project/workflows/agent/session-start.md` | Sélectionner l'objectif de la session |
| `agent session-end` | `.project/workflows/agent/session-end.md` | Dashboard + état à jour |
| `audit repository-health` | `.project/workflows/audit/repository-health.md` | Diagnostic de l'état global |
| `audit architecture` | `.project/workflows/audit/architecture.md` | Cartographier l'architecture |
| `audit security` | `.project/workflows/audit/security.md` | Audit de sécurité |
| `audit technical-debt` | `.project/workflows/audit/technical-debt.md` | Identifier la dette |
| `analysis functional-gap` | `.project/workflows/analysis/functional-gap.md` | écart roadmap/contrat ↔ livré |
| `analysis structural-gap` | `.project/workflows/analysis/structural-gap.md` | écart plan ↔ structure réelle |
| `analysis architectural-gap` | `.project/workflows/analysis/architectural-gap.md` | écart ADR ↔ implémentation |
| `maintenance fix` | `.project/workflows/maintenance/fix.md` | Corriger un défaut |
| `maintenance refactor` | `.project/workflows/maintenance/refactor.md` | Nettoyer sans changer le comportement |
| `migration-conversion` | `.project/workflows/maintenance/migration-conversion.md` | Convertir une migration SQL historique vers le DSL, avec preuve d'équivalence |
| `improvement code-quality` | `.project/workflows/improvement/code-quality.md` | Élever la qualité du code |
| `improvement performance` | `.project/workflows/improvement/performance.md` | Mesurer avant d'optimiser |
| `testing test-gap-analysis` | `.project/workflows/testing/test-gap-analysis.md` | Identifier les tests manquants |
| `documentation sync` | `.project/workflows/documentation/sync.md` | Aligner la documentation |
| `architecture rfc-process` | `.project/workflows/architecture/rfc-process.md` | RFC → ADR |
| `architecture adr-create` | `.project/workflows/architecture/adr-create.md` | Décision d'architecture |
| `planning backlog-review` | `.project/workflows/planning/backlog-review.md` | Prioriser le backlog |
| `release release-readiness` | `.project/workflows/release/release-readiness.md` | Checklist de release |
| `recovery incident-response` | `.project/workflows/recovery/incident-response.md` | Traiter un incident |
| `recovery disaster-recovery-runbook` | `.project/workflows/recovery/disaster-recovery-runbook.md` | Reconstruire après un sinistre |
| `project memory-cleanup` | `.project/workflows/project/memory-cleanup.md` | Compacter la mémoire projet |

**Création d'un workflow** : quand la même tâche revient **trois fois** avec une procédure similaire, l'agent propose de l'extraire en workflow. Format minimal :

```markdown
# <nom>
## Quand l'utiliser
## Prérequis
## Étapes
## Critère de succès
## Rollback
```

Un workflow sans critère de succès ou sans rollback est refusé.

## 9. Glossaire métier

| Terme | Définition | Ne pas confondre avec |
|---|---|---|

Règle : tout nouveau terme métier rencontré doit être ajouté ici avant d'être utilisé ailleurs. Signal de **niveau 1** — l'agent ajoute directement et le mentionne.

## 10. Ce qu'il ne faut jamais faire

- Ajouter une dépendance sans accord.
- Installer un package sans vérifier qu'il existe (typosquatting / package halluciné).
- Supprimer un fichier sans save point et confirmation.
- Modifier un fichier hors du périmètre annoncé.
- **Aucune commande Git qui écrit dans l'arbre de travail ou dans l'historique sans accord explicite, imminent et spécifique** — `git add`, `git commit`, `git push`, `git checkout -- <fichier>`, `git restore`, `git reset --hard`, `git clean -fd`, `git stash drop`, `git rm`, le changement de branche, la suppression ou le déplacement d'un fichier modifié. Motif : l'agent ne peut pas supposer qu'un diff est le sien (l'utilisateur, un autre agent ou une session concurrente ont pu modifier le même fichier). Procédure : annoncer la commande, les fichiers concernés et l'intention, puis **attendre l'accord** — un accord antérieur, implicite ou hors sujet ne vaut pas autorisation. Après une restauration, ne plus jamais reformater le fichier : c'est la trace de l'écart annulé, la reformater l'effacerait.
  <!-- ajouté: 2026-11-11 · statut: stable · dernier-signal: 2026-11-11 -->
- **Un reformatage hors périmètre reste une modification hors périmètre.** Un outil de formatage (`prettier --write`, `eslint --fix`) appliqué à un ensemble large touche des fichiers que la mission ne couvre pas : l'agent **liste les fichiers concernés** avant de l'appliquer et ne formate que son périmètre. Un fichier mêlant une modification fonctionnelle et du formatage ne doit **jamais** être « restauré pour ne garder que le formatage » — cela effacerait la modification fonctionnelle.
  <!-- ajouté: 2026-11-11 · statut: stable · dernier-signal: 2026-11-11 -->
- Factoriser entre deux modules métier sans demande explicite.
- Réécrire un fichier entier quand une modification localisée suffit.
- Exposer un secret, une clé, un token.
- **Réécrire ce fichier en entier** — toujours éditer chirurgicalement (§2.6).
- **Dupliquer un nom de fichier** : chaque fichier doit avoir un basename unique dans le repository (pas de `domain/user-repository.ts` ET `infrastructure/user-repository.ts`). Un port et son adaptateur portent des noms distincts.
- **Imports** : privilégier les aliases de module (`@mosaix/core`, `@mosaix/ports-database`, …) définis dans `tsconfig.json` plutôt que les chemins relatifs en dur (`../../...`).
- **Dogfooding Mosaix** : avant toute dépendance externe ou nouvelle abstraction, vérifier qu'une capacité équivalente n'existe pas déjà dans le monorepo et la réutiliser/étendre plutôt que de réimplémenter.

## 11. Changelog de ce fichier

> Une ligne par modification. Jamais réécrit, jamais purgé. Mémoire du fichier et garde-fou contre la dérive.

| Date | Niveau | Modification | Signal |
|---|---|---|---|
| 2026-11-10 | v2 | Réécriture selon le modèle auto-améliorant : protocole d'amélioration (§2), anti-obésité 250 lignes (§2.4), nettoyage périodique (§2.5) | demande utilisateur |
| 2026-11-11 | v2 | Ajout du workflow `migration-conversion` au catalogue (§8) | pattern répété côté humain |
| 2026-11-11 | v2 | Catalogue §8 corrigé : chemins workflows réels (`.project/workflows/`) au lieu de `.rescue/workflows/` inexistant | chemin obsolète |
| 2026-11-11 | v2 | §10 : aucune commande Git écrivant dans l'arbre ou l'historique sans accord explicite ; reformatage soumis au périmètre annoncé | règle contrariée (restauration unilatérale) |

## 12. Règles locales — OPTIONNEL

> Activer quand un module dépasse ~10 fichiers ou a des conventions propres.

Chaque module peut avoir son `AGENTS.md` local, chargé uniquement quand l'agent travaille dedans. Une règle locale **précise** une règle racine, elle ne la **contredit** jamais. En cas de conflit, c'est la racine qui gagne et le conflit est signalé.
