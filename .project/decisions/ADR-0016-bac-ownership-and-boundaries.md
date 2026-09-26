# ADR-0016 — BAC Ownership & Boundaries (IJIDeals target cartography)

**Status:** Accepted (target — gaps tracked as backlog BOUND-01..08)
**Date:** September 26, 2026
**Deciders:** Platform Architecture Review (domain-model proposal reviewed against codebase evidence)

---

## Context

An expert domain review proposed a target cartography for IJIDeals / MosaiX: every BAC
owns a clear business responsibility, its reference data, and an explicit interaction
contract. The review was confronted with the code before adoption. Verified facts:

1. **Commerce absorbed payments** — `commerce_payment_intents` table (incl. `refund`),
   `satim-payment-port.ts` (SATIM CIB/Edahabia gateway), `DemoPaymentPort`, webhooks
   (`payment_intent.succeeded`). Payments extraction is real debt, not hypothetical.
2. **Portfolio owns commercial attributes** — `vendable.ts` carries `stock`, `inventory`,
   `pricing.basePrice`; `product-wizard` validates price/stock; `shop-inventory-report`
   values stock. A pure-PIM invariant contradicts current code (gap, not fact).
3. **Beam absorbed notifications** — `beam_notifications` + `beam_push_subscriptions`
   tables. Transverse notification extraction is grounded.
4. **Subscription embeds dunning** — `subscription-billing-engine` carries retry schedule
   + `notificationMessage` / `send_reminder_email`. Overlaps future Billing/Notifications.
5. **Spaces matches the target** — `ownerId`, team roles, `enabledCapabilities`,
   `ActingAsSpaceEngine` + audit trail, `business-registry` verification.
6. **Citadelle assigns business roles** — `registration-wizard` grants `merchant`,
   `delivery_partner`, `collective_manager`. Tension with "identity ≠ business actor".

Related: ADR-0012 (Platform Auth vs Identity), ADR-0007 (experience composition).

---

## Decision

### Ownership rule

> **One business datum ⇒ one owner BAC. Others reference it by stable ID. No direct
> access to another BAC's tables. Every exposed operation ⇒ a versioned capability.
> Every cross-BAC fact ⇒ a domain event (events announce, never call).**

Per-BAC ownership, references and invariants are recorded in each
`apps/*/responsibilities.md` (§ Données possédées / Références / Invariants).
Summary:

| BAC | Owns (source of truth) | Must never own |
|---|---|---|
| citadelle | identities, credentials, sessions, tokens | business profiles, team roles, domain policies |
| imperia | BAC registry, topology views, settings catalog, governance policies, plugin catalog, migration previews, admin audit | any business data; never bypasses Citadelle authN or BAC authZ |
| spaces | spaces, teams/local roles, ownership, acting-as context + audit | business resources (orders ∈ commerce, posts ∈ solara) |
| portfolio | PIM sheets, attributes, taxonomy, media, i18n, completeness | (target) sale price, reservable stock, cart, orders |
| commerce | offers, sale prices, promos, cart, checkout orchestration, orders, fulfillment | (target) payment state, invoices, real availability |
| booking | resources calendars, slots, allocations, reservations | payments |
| subscription | recurring commitments, periods, metering | invoicing, collection |
| beam | private conversations, messages, presence | social feed, generic system notifications |
| solara | social content + interactions | referenced products/spaces/orders |
| solidarity | incidents, needs, hubs, missions, distributions | identity, payments |

### The three arbitrations

1. **Commerce must not absorb Payments & Billing.** Commerce owns the order and checkout
   orchestration. Payment state belongs to a future Payments BAC, documents to a future
   Billing BAC. A paid order is not an invoice; an invoice is not a transaction.
   (Gap: BOUND-02/03; freeze: no new financial logic in Commerce behind `PaymentPort`.)
2. **Spaces stays one BAC, never the universal resource owner.** A Space is an
   organizational actor and action context. Ownership of a *Space-owned* page/media is
   fine; business ownership follows the competent BAC. (Verified: no absorption found —
   keep under review, BOUND-01 watch item.)
3. **Imperia governs, never executes business logic.** Register, configure, supervise —
   never mutate another BAC's business data, never become a mandatory façade, never
   bypass Citadelle policies. (Gap: `requireAdmin` role misalignment — tracked in
   Imperia fiche.)

### Transverse BACs (target, to formalize — not all Day-1 apps)

Payments, Billing, Notifications, Media/Assets, Search/Discovery, Reviews/Trust,
Policy evaluation formalization (inside Citadelle or dedicated service). Each gets a
backlog task (BOUND-01..08); each must satisfy the module-vs-capability and
plugin-governance rules before creation.

### Rules (binding on all BACs, incl. future ones and plugins)

1. Unique ownership (above). 2. Explicit capabilities. 3. Module ≠ capability
   (a module exposes N capabilities). 4. Policies ≠ roles. 5. Events ≠ calls.
6. Governed plugins (extension points only, no host data takeover).
7. Identity ≠ business actor. 8. Abstract infrastructure (ports only).

---

## Consequences

- `apps/*/responsibilities.md` carry the enforceable per-BAC contract; any code-vs-fiche
  drift becomes a prioritized backlog task, never silent scope creep.
- Known target-vs-real gaps are explicit in each fiche (portfolio price/stock,
  commerce payments, beam notifications, subscription dunning, citadelle business roles).
- New BACs must fill the ownership/references/capabilities sections from
  `apps/_template/responsibilities.md` before any code.
- Backlog: BOUND-01..08 (see `active-backlog.md` §10).
