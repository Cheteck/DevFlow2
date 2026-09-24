# MosaiX / IJIDeals — Grandes Lignes de la Plateforme (2026-09-24)

> **MosaiX** = OS modulaire d'écosystèmes applicatifs (`Modular Orchestration for Smart Application Integration eXperience`) — `@apps/*` BACs autonomes qui composent sans couplage. **IJIDeals** = première verticale (marketplace + communauté + campus) qui l'incarne.

---

## 1. Vision en une phrase

Une plateforme où **chaque Space est une entité autonome** (page Facebook : boutique, campus, club sportif `caj-jijel`, solidaire) qui **active** les capacités dont elle a besoin — commerce, social, réservation, messagerie — sur un **catalogue canonique** partagé et une **gouvernance unique**.

> `apps → sdk → core → schemas → contracts → types` (flux unidirectionnel `PROJECT.md:12`), `apps` ne se parlent jamais directement — `Kernel` (`CapabilityRegistry + DomainEventBus + AuthorizationEngine`) est le backbone.

---

## 2. 10 BACs canoniques + 3 en horizon

| BAC | Verbe | Table maîtresse | Ce qu'il possède | Ce qu'il ne possède pas |
|---|---|---|---|---|
| **citadelle** Identité & IAM | authentifie | `citadelle_identities/credentials/sessions` | `User`, MFA, lockout, OAuth, RGPD `IdentityGdprPrivacyPage` | jamais `price/stock` |
| **spaces** Multi-tenant | isole | `spaces/spaces_spaces + space_members` | `Space` `owner/admin/editor`, `team JSONB→FK`, `customDomain`, `actingAs` | jamais `vendable` |
| **portfolio** Catalogue **PIM** | décrit *ce qui est vendable* | `portfolio_vendables(13 cols) + 14 tables CS-Cart` `feature_groups/features/vendable_features/variation_groups` | `Vendable{identity, content, classification, characteristics, media, variants, relations, quality}` — **abstrait** `variants` sans `price/stock` (`FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61`) | jamais `price/stock/offer` |
| **commerce** Offre & vente | vend *comment* | `commerce_offers/payment_intents/auctions/bids/carts` | `CommerceOffer(priceInCents/stockAllocation/commissionRateBps)` + `Money` VO — **seule source vérité prix/stock/offre** | jamais `content/features` |
| **beam** Messagerie | converse | `beam_conversations/messages + notifications/push_subscriptions` | `type direct/group, participants JSON→participants` `encryptedPayload E2E ECDH/AES-GCM` | — |
| **solara** Social | publie | `solara_posts/comments/reactions/followers` | `Post{actorType user|space, publicationType, targetType, metadata}` `PublicationTypeRegistry` | — |
| **booking** Réservation | réserve | `booking_slots/reservations/waitlists/reminders` | `BookingSlot{capacity,reservedCount}` + `iCalendar RFC5545` | — |
| **solidarity** Humanitaire | coordonne | `solidarity_*` 7 tables `incidents/needs/donations/resources/hubs/missions/distributions` + `GeoZone` Haversine + `Merkle` | PostGIS |
| **imperia** Gouvernance | gouverne | `imperia_audit_logs/policies/dlq/circuit_breakers/settings` `governance-slot-resolver` | `PlatformThemeService`, `Maintenance` `allowedRoles` | — |
| **subscription** Abonnement | facture | `user_subscriptions/coupons/invoices/metering_buckets` | `BillingInterval month|year`, `Trial`, `Prorata` | — |
| **delivery** *(horizon 3b)* | livre | `delivery_methods(cod|express/pickup) + delivery_boys + deliveries(orderId, boyId, codAmount, proofUrl)` | `assigned→delivered` `proofUrl`, COD Algérie `cod_pending→delivered` | jamais `price` |
| **wallet** *(moyen terme)* | encaisse | `wallets/wallet_transactions escrow_hold→release` | `hold buyer→platform → release platform→seller net` `Money` | PSP `SATIM/CIB` plus tard |

**Règle d'or** `portfolio → commerce → delivery` : `Vendable Published → CommerceOffer Active → Order Pending(cod_pending) → Delivery assigned→delivered → Paid + wallet release`. `Vendable` ne connaît jamais `Space`, `Commerce` ne connaît jamais `payload` Proposal.

---

## 3. Invariants fondateurs

1. **Proposal ≠ Vendable** `PRD-0010` v1.3 : `portfolio_proposals` (1 table mutable `suggestedReference, content..translations JSONB écrasé, platform_feedback, vendable_id NULL→V987`) volumineuse, purgable ; `portfolio_vendables` reste propre (12k vrais Vendables, pas 100k Draft). `Proposal→Vendable` jamais l'inverse ; `Submitted→InReview` lock `FOR UPDATE` `approve` atomique `INSERT vendable Published + UPDATE proposal Approved`.
2. **Rôles = données, permissions = code** `PRD-0010/0011` `active-backlog.md §5` : `EffectivePermissions(user,space)=Global∪Space∪Overrides, effectif=ALLOW-DENY, DENY>ALLOW` absolu `anyMatchingDeny→DENY`, `snapshot{authorizationVersion,generatedAt}` `UserAuthorizationContext.can()` `DENY>ALLOW` `effective-permission-resolver.ts:69`, `PermissionRegistry` garde-fou `assignableBy`.
3. **Money unique** `packages/core/src/value-objects.ts:6` `Money.fromCents(amountInCents, currency EUR)` — jamais `amount:number` float `commerce-payment-intent.ts:13`.
4. **Theme agnostique** `PRD-0008` v2.3 `ThemeTarget {type,id}` générique, `ThemeResolver` 5 étapes `entity>user>application>platform`, `ThemeAssignmentsStore` `InMemory→Postgres` `theme-assignments-migration.ts`, `BAC_THEME_TARGETS` 12 types `bac-theme-targets.ts:7`, `themeContract: mosaix-default@^1.0.0` 10 BACs.
5. **Commerce seule vérité offre/stock/prix** : `portfolio_variants` abstrait sans colonnes `price/stock`, `FORBIDDEN_OPERATIONAL_KEYS` bloque `price` dans `attributes`.

---

## 4. Flux canoniques

**Catalogue** `Space admin --propose--> portfolio_proposals Draft --submit--> Submitted --claim InReview--> {ChangesRequested→Draft (écrase), Rejected, Approved→INSERT vendable Published}` → `portfolio.vendable.published` → `CommerceOffer Active` → `beam/solara` notifications.

**Achat Algérie** `OrderService.createOrder({userId,vendableId, paymentMethod:cod})` `Pending(cod_pending)` → `InventoryPort.reserve` seul (`PaymentPort` no-op) → `Delivery assigned→out_for_delivery→delivered(proofUrl)` → `cod_delivered→succeeded` `amountReceived=totalAmount` → `wallet escrow_release(platform→seller net)` `calculatePayoutMoney` `commission 500bps`.

**Social** `portfolio.vendable.published` → `social-auto-share-plugin` brouillon `solara` → vendeur valide.

---

## 5. Gouvernance & SIS

* **Thèmes** `ThemeRuntime` `resolve→cache→compile→inject→notify` `theme-runtime.ts:191` fail-open, `cache-first`, `ThemeTargetRegistry` 3 types `store|brand|workspace` étendus 12 BACs.
* **Autorisation** `PermissionRegistry + EffectivePermissionResolver` `DENY>ALLOW` + `role_audit_events` + `acting_as_audit_events` `§5` P1-P7 (RLS `ADR-0014` barrière indépendante `PostgresBacSchemaMigrator`).
* **Observabilité** `PostgresPoolManager` `healthCheck`, `DomainEventBus` 16 events `catalog:product:*`, 5 MCP tools `manifest.json:12`.

---

## 6. Horizons

* **3b** COD + wallet escrow + BAC `@apps/delivery` extraction `delivery-partner.service.ts:132` (`verifiedBy`).
* **4** Écosystème Sports `CAJ Jijel` `@apps/olympia/chronos/patronus/arena/curator` + Études `academy/career/mentor` `roadmap.md:26`.
* **UI** `PRD-0011` 19 routes `Dashboard→Proposals` — `AdminCatalogPage 1504L` `AUDIT.md:40` découpé en 5 panels P1.

> Voir `active-backlog.md:232` §7 vérification `ac99009/0ebe478/356422d` (14 tables Portfolio, `ProposalService` 197L) — **12/17 livrées**, restent `DATA-07/08`, `THEME UI`, `PRD-0011` pages.
