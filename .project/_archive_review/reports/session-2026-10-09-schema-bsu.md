# Session 2026-10-09 — Critique booking/spaces/subscription traitée (v1.003 ×3)

## Méthode
Chaque remarque confrontée au réel (migrations compilées + base live + code). Comme les 3 précédentes : **PK manquantes, syntaxe/ordre invalides : non reproduits** (PK partout, parents-avant-enfants, FK présentes, idempotence booking déjà UNIQUE). Le reste, fondé, traité.

## Migrations appliquées en dev (un batch)
- `booking.scheduling.v1.003` : colonnes `startAt/endAt/capacity/bookedCount` + backfill JSONB + CHECKs + index ; `reservations.slotId` CASCADE→RESTRICT ; unicité waitlist partielle + `position>0` ; colonnes processing reminders ; `DEFAULT now()`.
- `spaces.membership.v1.003` : cohérence scopes, self-FK héritage, unicités clé-par-portée, 2 uniques partielles overrides (ancienne UNIQUE index droppée en INDEX), `followersCount>=0`, triggers append-only audit, defaults.
- `subscription.billing.v1.003` : CHECKs coupons/metering/factures, UNIQUE bucket, FK invoices →RESTRICT, defaults.

## Code (contreparties applicatives)
- `holdSlot`/`releaseSlot` atomiques + `claimDueReminders` (SKIP LOCKED, tentatives incrémentées) + hydratation colonnes ; tests SQL-shape (8/8 booking verts).
- `saveReaction` upsert naturel, `addFollower` ON CONFLICT quad, garde anti-auto-suivi.
- Preuves par violation : hold saturé bloqué, waitlist dup rejetée, RESTRICT prouvé, overrides NULL-safe (global vs espace cohabitent), audit immuable (UPDATE/DELETE rejetés), scope CHECKs, coupons/metering CHECKs + UNIQUE. Résidu 0 partout.
- Rollback --steps=3 ciblé exact + re-migration : aller-retour prouvé.

## Décisions documentées (docs/bacs 09/05/10 §6)
Temporal JSONB→colonnes avec backfill ; RESTRICT historique ; overrides NULL-safe ; audit append-only (+procédure nettoyage) ; coupons maxRedemptions=0=new (pas de NULL illimité) ; pas d'usage-ledger/tables prospectives sans chemin de code ; Option A polymorphique ; owner auto-adhésion ouvert.

## Découverte process
Le backlog vivant a migré pendant la session (`active-backlog.md` → REDIRECT, pilotage `BACKLOG.md` + archive). Entrée ajoutée au Registre DONE (`BOUND-01e`), pas à l'ancien fichier.

## Validation
- 57/57 tests (6 fichiers), ESLint propre, dev HTTP 200.

## Git State
- Ajouts : 3 migrations. Modifiés : repo booking, social.model (garde), booking.test.ts, solara→(déjà), bac-migrations.ts, docs 09/05/10, BACKLOG.md (registre DONE).
- Aucun commit effectué.
