# BAC Beam — Messagerie Instantanée Sécurisée & E2E Crypto

## 1. Vue d'ensemble
Le BAC **Beam** (`@apps/beam`) fournit une suite de messagerie instantanée en temps réel avec gestion des conversations privées et de groupe, réponses en fil (`threads`), réactions aux messages, pièces jointes et chiffrement de bout en bout (E2E Crypto ECDH/AES-GCM).

## 2. Architecture & Services
- **`BeamMessagingService`** : Gestion des conversations, dispatching des messages instantanés et chiffrement des charges utiles.

## 3. Modèle de Données & Tables SQL
- `beam_conversations` : `(id, title, type, created_at)`
- `beam_conversation_participants` : `(conversation_id FK, user_id FK, joined_at)`
- `beam_messages` : `(id, conversation_id FK, sender_id, content, reply_to_message_id, thread_id, reactions JSONB GIN, attachments JSONB, encrypted_payload JSONB, created_at, deleted_at)`

## 4. Capacités & API Endpoints
- `beam.conversation.create` — Création d'un salon de discussion.
- `POST /beam/messages` — Envoi d'un message instantané.
- `GET /beam/messages` — Récupération de l'historique des messages par conversation.

## 5. Contributions UI & Slots
- Interface de messagerie instantanée temps réel et panneaux de discussion.
