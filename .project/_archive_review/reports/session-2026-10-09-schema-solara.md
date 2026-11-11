# Session 2026-10-09 — Critique schéma solara traitée (v1.003)

## Méthode
Chaque remarque confrontée au réel (migration compilée + base live + code). Comme portfolio/commerce : **syntaxe/ordre invalides non reproduits** (parents-avant-enfants, index valides, FK présentes). Le reste, fondé, traité.

## Migration `solara.social.v1.003_harden_social` (appliquée en dev)
- Réactions : `UNIQUE(targetType,targetId,actorType,actorId)` + CHECKs type/cible/acteur.
- Follows : `UNIQUE` quad (remplace la paire), anti-auto-suivi, CHECK types, index cible composite.
- Traductions : `UNIQUE(postId,lang)`, index redondant supprimé.
- Posts/commentaires : CHECKs vocabulaires + compteurs `>= 0`, TEXT (contenus), `DEFAULT now()`, index chrono déterministes (`createdAt`, `id`).
- Enregistrée `bac-migrations.ts` (id canonique). Pas de collision R9 (resources en nouveaux noms).

## Code (contreparties applicatives)
- `saveReaction` : upsert sur clé naturelle (changement de type sur place, anti-doublon y compris concurrent).
- `addFollower` : `ON CONFLICT` sur le quad.
- `followActor` : garde anti-auto-suivi (erreur claire avant CHECK DB).
- `getPosts`/`getComments` : tiebreak `id` (ordre stable, prêt curseur).
- Tests : +3 (self-follow, upsert naturel, quad) — 9/9 solara verts.

## Décisions documentées (`docs/bacs/02-solara.md` §6)
Option A polymorphique (pas de table `actors`, pas de FK inter-BAC) ; `publicationType` ouvert ; `mediaUrls` clés stables ; pas de `parentCommentId` (pas de threads) ; catégories non liées (table sans lecteur) ; curseur différé ; modération/visibilité/blocage = passe future.

## Incident rollback (leçon process)
Premier rollback v1.003 partiel : `DROP CONSTRAINT` sur `uniq_solara_followers` qui est un INDEX standalone (même piège que commerce) → down bloqué à 23/28. Récupération : convergence manuelle vers l'état pré-migration (requêtes restantes + suppression ligne ledger justifiée et tracée), fix fichier (`DROP INDEX`), re-migration propre, puis rollback↔re-migration aller-retour prouvé. À l'avenir : vérifier systématiquement contrainte-vs-index (`pg_constraint` vs `pg_indexes`) avant d'écrire les downs.

## Validation
- Violations prouvées par insertion (self-follow, mauvais acteur/type, compteur négatif, traduction dupliquée, upsert collapsant), base nettoyée (0 ligne).
- 116/116 tests verts (21 fichiers), ESLint propre, dev HTTP 200.

## Git State
- Ajout : migration solara v1.003. Modifiés : repo social, social.model (garde), solara.test.ts, bac-migrations.ts, 02-solara.md, backlog.
- Aucun commit effectué.
