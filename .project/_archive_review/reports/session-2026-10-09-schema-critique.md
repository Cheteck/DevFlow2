# Session 2026-10-09 — Critique schéma portfolio traitée (v1.004)

## Méthode
Chaque remarque confrontée au réel (migrations compilées + base live) avant correction.
**Résultat : les anomalies de syntaxe/ordre (§1.1, §2.1) ne s'appliquent pas à nos fichiers** (12 index valides, création parents-avant-enfants, 20 FK présentes) — elles portaient sur un export. Tout le reste, fondé, a été traité.

## Migration `portfolio.catalog.v1.004_harden_data_integrity` (appliquée en dev)
- `categories_no_self_parent`, `relations_no_self_reference` + `UNIQUE(source,target,relationType)` (colonne réelle : `relationType`).
- `feature_values_id_feature_unique(id,featureId)` + FK composites `vendable_features(variantId,featureId)` et `variant_features(variantValueId,featureId)` (anciennes FK simples remplacées) + exclusivité `valueText`/`variant*Id` (double-remplissage interdit, vide autorisé).
- `UNIQUE(parentVendableId,code)`, `UNIQUE(groupId,featureId)`.
- `CHECK` type/statut proposals (listes domaine) + `media_assets.type` (union `MediaItem`).
- `proposals.vendableId` : `CASCADE` → `SET NULL` (historique modération préservé).
- TEXT : urls signées, descriptions, feedbacks/rejets, descriptions features.
- `DEFAULT now()` (11 createdAt + 3 updatedAt) + trigger `set_updated_at` (vendables/variants/proposals).
- Index : 3 redondants supprimés (couverts leftmost par UNIQUE), `idx_relations_target` ajouté.

## Preuves (insertions de violation, base nettoyée après)
Self-parent/self-relation/mauvais statut/double-fill rejetés ; composite incompatible `(fv-red,f-size)` rejetée par `vendable_features_variant_value_compatible`, triple compatible accepté ; delete produit → proposition conservée (`vendableId` NULL) ; `createdAt` auto-rempli. Rollback→re-migrate aller-retour prouvé.

## Décisions documentées (`docs/bacs/08-portfolio.md` §6)
JSONB fiche = autorité PIM, relationnel = projection structurée (pas de double écriture) ; proposals = instantané mutable jusqu'au submit ; camelCase/VARCHAR-ids/sku-global/langues courtes conservés (rationale) ; codes `S/E/T/N/D` documentés ; `purpose` libre ; nom `feature_variants` gardé ; transitions en applicatif ; pas de RLS ; limites : multivalué, i18n groupes, cycles indirects.

## Non traité (choix explicites)
- Renommage `feature_variants` → `feature_values` : refusé (2e rename consécutif pire que le nom imparfait).
- snake_case : refusé (cohérence TS↔SQL, migration coûteuse sans bénéfice).
- UUID natif : refusé (ids app-générés, bénéfice nul).
- Index spéculatifs (`proposerUserId`, `media(vendableId,type)`) : refusés sans requêtes réelles.
- `purpose` en CHECK : refusé (extensibilité métier).

## Git State
- Ajout : `20260925130000_harden_data_integrity.ts`. Modifiés : `bac-migrations.ts`, `08-portfolio.md`, backlog.
- DB dev : v1.003 + v1.004 appliquées, 0 ligne résiduelle des preuves.
- Aucun commit effectué.
