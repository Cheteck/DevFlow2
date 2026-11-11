# BAC Booking — Réservations, Ressources & iCal

## 1. Vue d'ensemble
Le BAC **Booking** (`@apps/booking`) est la source de vérité de la disponibilité temporelle : ressources réservables, calendriers, slots, allocations, réservations, waitlists FIFO et **planification** des rappels (T-24/T-1 — l'envoi relève de Notifications, cf. `apps/booking/responsibilities.md`). Synchronisation iCalendar (RFC 5545) via `CalendarSyncPort`. Aucun prix, stock, commande, paiement ou envoi de notification dans Booking.

## 2. Architecture & Services
- **`BookingService`** : Planification des réservations, gestion des créneaux et des ressources disponibles.

## 3. Modèle de Données & Tables SQL (schéma isolé `booking.*` depuis v1.002, préfixes débruités)
- `booking_resources` : `(id, name, type, capacity, schedule JSONB, created_at)`
- `booking_reservations` : `(id, resource_id FK, user_id, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status, created_at)`
- `booking_slots` : `(id, resource_id FK, start_time, end_time, capacity, reserved_count)`
- `booking_waitlists` & `booking_reminders` : listes d'attente et planification des rappels (envoi via Notifications).

## 4. Capacités & API Endpoints
- `booking.reservation.create` — Création d'une réservation de ressource.
- `GET /booking/slots` — Consultation des créneaux disponibles.
- `GET /booking/ical` — Export iCalendar (RFC 5545).

## 5. Contributions UI & Slots
- Calendrier de réservation, portail de gestion des ressources et planning.

## 6. Décisions de modélisation vérifiées (v1.003, base live)
- **Syntaxe/ordre valides** : PK présentes partout, parents-avant-enfants, FK présentes — les remarques d'exécutabilité portaient sur un export.
- **Anti-double-réservation** : colonnes `startAt/endAt/capacity/bookedCount` extraites du JSONB (requêtables, contraignables) ; hold atomique `UPDATE … WHERE bookedCount + qty <= capacity` (aucun verrou explicite nécessaire au cas unitaire) ; réservations en `RESTRICT` sur suppression de créneau (historique préservé, on annule au lieu de supprimer).
- **Idempotence** : clé globale UNIQUE déjà en place (vérifiée) ; transitions via `BookingStateMachine` (vocabulaires en CHECK).
- **Waitlists** : unicité active `(slotId,customerId)` partielle + `position > 0` (réattribution concurrente = chantier service, pas schéma).
- **Rappels** : colonnes `sentAt/attempts/lastError/updatedAt/provider` + `claimDueReminders` (`FOR UPDATE SKIP LOCKED`, tentatives incrémentées dans la même transaction — pas de double envoi inter-workers).
- **Non fait sciemment** : extraction `price` des slots (commercial, hors Booking), curseur de pagination, verrou multi-ressources (saga future).
