# BAC Booking — Réservations, Ressources & iCal

## 1. Vue d'ensemble
Le BAC **Booking** (`@apps/booking`) gère la réservation de ressources, la planification de rendez-vous, la synchronisation iCalendar (RFC 5545), les listes d'attente (`waitlists`), les rappels automatiques et la gestion des créneaux horaires avec gestion des conflits et clés d'idempotence.

## 2. Architecture & Services
- **`BookingService`** : Planification des réservations, gestion des créneaux et des ressources disponibles.

## 3. Modèle de Données & Tables SQL
- `booking_resources` : `(id, name, type, capacity, schedule JSONB, created_at)`
- `booking_reservations` : `(id, resource_id FK, user_id, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status, created_at)`
- `booking_slots` : `(id, resource_id FK, start_time, end_time, capacity, reserved_count)`
- `booking_waitlists` & `booking_reminders` : Gestion des listes d'attente et notifications.

## 4. Capacités & API Endpoints
- `booking.reservation.create` — Création d'une réservation de ressource.
- `GET /booking/slots` — Consultation des créneaux disponibles.
- `GET /booking/ical` — Export iCalendar (RFC 5545).

## 5. Contributions UI & Slots
- Calendrier de réservation, portail de gestion des ressources et planning.
