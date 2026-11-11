# Responsabilites — port SMS

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/ports-sms` |
| Version | `1.0.0` |
| Couche | Port hexagonal (Layer 2) |

## Raison d'etre

Envoi de messages SMS (OTP, notifications, alertes) de manière agnostique vis-à-vis des fournisseurs (Twilio, MessageBird, etc.).

## Responsabilites

- Definir l'interface TypeScript canonique dans `src/index.ts`.
- Documenter les contrats, erreurs et semantiques.
- Rester sans dependance externe (types TS uniquement).

## Interactions

Importable par fondations (Layer 1), adapters (Layer 3), primitifs (Layer 4) et apps (Layer 7). Implemente par un ou plusieurs adapters.

## Frontieres

- Aucune implementation, aucun import d'adapter.
- Aucune dependance workspace hors fondation.

## Non-responsabilites

- Ne choisit pas de fournisseur SMS.
- N'effectue aucun IO.

## Criteres de sante

- [x] API stable ; tout changement = version majeure + ADR.
- [x] Compilation TypeScript validée.
