# ADR-0021 — Prix, promotions et coupons Commerce

**Status:** Accepted (principes) · **Gouvernance promos vendeurs : recommandation ci-dessous, seuils à trancher par le propriétaire**
**Date:** 2026-10-12
**Deciders:** Maintainer (+ revue : périmètre validé, hors-goals exclus)

---

## Context (faits vérifiés)

1. L'offre porte `priceInCents` + `commissionRateBps` sans historisation ni surcharge : aucun moteur de promotion, aucun journal de prix dans Commerce.
2. Seules traces existantes : `discountCode?: string` nu sur Order (enregistré, jamais validé/consommé) et coupons **Subscription/billing** (`subscription.coupons`, INSERT + findByCode) — contexte facturation, à ne pas confondre ni dupliquer.
3. `commercialTerms`/`approvedTerms` (SELL-FLOW-01, ADR-0020) fixent le prix de départ ; tout rabais ultérieur doit s'y articuler sans le réécrire.

## Decision

- **Prix de base : propriété de l'offre Commerce** ; aucun prix opérationnel dans Portfolio (rappel ADR-0016).
- **Prix proposé / prix actif / prix payé = trois données distinctes** : journal append-only des changements effectifs (`PRICE-01`), snapshot figé dans la commande (`PRICE-02`).
- **Promotion = avantage commercial à règles + période** (`PROMO-01`, jamais d'écrasement du prix de base ; interface de résolution `resolveEffectivePrice` conçue dans PRICE-01 pour éviter la surcouche improvisée).
- **Coupon = mécanisme d'accès à une remise**, rattaché à une promotion, consommation atomique anti-double-usage (`COUPON-01`).
- **Cumul explicite** : politique automatique-vs-coupon tranchée dans PROMO-01.
- **Gouvernance vendeurs (recommandation)** : création libre + **activation auto sous garde-fous codés** (plafond de remise, durée max, une promo active par offre, audit complet, révocation plateforme), **escalade en modération** au-delà des seuils ou motif suspect — même muscle que SELL-FLOW-01. Les seuils chiffrés sont une décision propriétaire, pas technique (à figer avant PROMO-01).
- **Hors périmètre v1** : tarification concurrentielle, prix dynamiques, fidélité, campagnes complexes.

## Consequences

- Ordre : PRICE-01 → PROMO-01 → COUPON-01 → PRICE-02 (Horizon 3 ; Horizon 1-2 inchangés, aucun P0 touché).
- `discountCode` nu sur Order devient consommé-et-vérifié ou supprimé (PRICE-02).
