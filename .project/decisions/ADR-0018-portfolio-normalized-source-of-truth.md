# ADR-0018 — Portfolio : tables normalisées comme source de vérité, colonnes JSON supprimées

**Status:** Accepted (appliqué 2026-10-10, migration `portfolio.catalog.v1.005_normalize_pim`)
**Date:** 2026-10-10
**Deciders:** Maintainer (demande explicite : utiliser les tables dédiées, supprimer le JSON)

---

## Context

Le schéma `portfolio.*` compte 14 tables migrées et durcies (v1.001–v1.004 : FK,
CHECK d'exclusion, triggers `updatedAt`, index). Preuves relevées le 2026-10-10
(Base PG locale, après import réel d'une fiche via MCP) :

1. **Écriture : seul `portfolio.vendables` est alimenté** — `PostgresVendableRepository`
   persiste la fiche comme une seule ligne document (7 colonnes JSONB : `content`,
   `characteristics`, `classification`, `media`, `variants`, `relations`, `quality`).
   `InMemoryVendableRepository` fait pareil en mémoire.
2. **Lecture : seule la ligne document est lue** (`findById/findByReference/findAll`).
3. **Les 13 autres tables sont à 0 ligne** (`variants`, `translations`, `media_assets`,
   `categories`, `relations`, `features`, `feature_groups`, `feature_variants`,
   `vendable_features`, `variant_features`, `variation_groups`,
   `variation_group_features`, `proposals`) et n'ont **aucun writer ni reader**
   dans `apps/portfolio/src` (vérifié par recherche exhaustive).
4. **La vue `/portfolio` n'y touche pas** : `portfolio-view.ts` rend des données
   statiques en dur.
5. **Perte silencieuse déjà active** : `seo` (slug, meta) n'est ni persisté ni
   réhydraté sur le chemin Postgres (colonnes absentes, `hydrate()` l'ignore).
6. Origine : import « CS-Cart feature schema » (`ac99009`), antérieur au virage
   PIM-pur/document ; le schéma normalisé n'a jamais été branché.

Deux sources de vérité apparentes, une seule réelle : état intenable (requêtes
facettes impossibles, contraintes FK décoratives, lecteurs futurs trompés).

---

## Decision

> **Les tables normalisées `portfolio.*` sont la source de vérité persistée.
> Les 7 colonnes JSON de `vendables` sont supprimées (v1.005). L'interface
> domaine `VendableRepository` (document `Vendable`) est inchangée :
> `PostgresVendableRepository` devient l'anti-corruption qui projette
> document ↔ tables. `quality` n'est plus stockée, elle est calculée à la
> lecture par `PortfolioService`.**

### Règles de projection (document → tables)

| Document | Tables | Règle |
|---|---|---|
| `identity` | `vendables(id, reference, type, status)` | direct |
| `seo.slug/metaTitle/metaDesc` | `vendables.slug/metaTitle/metaDesc` (colonnes ajoutées v1.005) | corrige la perte silencieuse §5 |
| `content[lang]` | `translations(vendableId, lang, name, shortDescription, description)` | `id` déterministe `tr_{vendable}_{lang}` |
| `content[lang].keywords` | `translation_keywords(vendableId, lang, keyword)` (table ajoutée v1.005) | UNIQUE(vendableId, lang, keyword) |
| `classification.categories` | `categories(slug, name=slug)` get-or-create + `vendable_categories` | slug déterministe |
| `classification.tags` | `tags` + `vendable_tags` (tables ajoutées v1.005, même pattern que categories) | le schéma n'avait aucun home pour les tags |
| `media[]` | `media_assets` (id préservé) | `metadata` reste JSONB (métadonnées provider schemaless — exception documentée) |
| `variants[]` | `variants(id, vendableId, sku=reference, name=content.fr.name)` | ids préservés |
| variant `characteristics.attributes` | `variant_features(valueText)` via catalogue `features` partagé | scalaires → texte ; E frais si enum cataloguée |
| `relations[]` | `relations` | `metadata` abandonné (aucune colonne ; usage nul constaté) |
| `characteristics.attributes` plats | `features` (groupe `attributes`, code = clé, type N/C/T inféré) + `vendable_features(valueText)` | ids déterministes `feat_{code}` |
| `characteristics.attributes` tableaux de primitifs | `features` (type E, purpose **uniforme `multivalue`**) + `feature_variants` (vocabulaire) + **une seule** `vendable_features(valueText)` jointe par `", "` | UNIQUE(vendableId, featureId) interdit une ligne par valeur ; un lien `variantId` isolé serait indiscernable d'un scalaire à la lecture — la jointure + `purpose` garantit le round-trip Rogers (split `", "`) |
| `characteristics.attributes` objets imbriqués | groupe `attr:{clé}`, codes pointés `{clé}.{sous-clé}`, récursif | ex. `options.color.values` |
| `characteristics.specifications[groupe]` | `feature_groups` (code `spec:{groupe}`) + `features` (code `{groupe}.{clé}`) | ex. `body.dimensions_mm` |
| bloc `options` | groupes de variation : `variation_groups(code)` + `variation_group_features` quand l'option porte des SKU ; sinon feature E + valeurs (cas `color`, `weight`) | `weight` : driver des 2 valeurs non précisé par la source → non modélisé en axe, note en `features.description` |
| `quality` | calculée à la lecture | colonne supprimée |

### Pertes assumées (aucune donnée réelle touchée — 1 fiche Draft)
- `relations[].metadata`, `variants[].media`, noms de variantes non-FR,
  `classification.collections` : sans home normalisé, ignorés à l'écriture
  (la fiche Xiaomi n'en contient aucun — round-trip prouvé identique).
- `strip-commercial-fields.ts` (one-shot PIM, lit `variants` JSON) devient
  obsolète : les clés commerciales sont rejetées à l'écriture par le domaine
  (`OperationalKeyForbiddenError`) ; l'outil reste en place en no-op gracieux.
- Down-migration v1.005 best-effort (recréation des colonnes vides) : le sens
  retour exigerait une resérialisation, hors périmètre (backup PG recommandé).

### Ordre de cutover (fenêtre unique, base dev, 1 ligne Draft)
1. Déployer le repository normalisé. 2. Appliquer v1.005 (backfill explicite
   de la fiche Xiaomi + drop des colonnes). 3. Vérifier round-trip identique
   (document relu == document écrit). Aucune double lecture transitoire :
   l'ancienne ligne JSON est migrée avant suppression, pas de fenêtre mixte.

### Correctifs constatés à l'application (v1.006, 2026-10-10)
- Les transactions PG n'étaient pas atomiques (`BEGIN`/`COMMIT` sur des
  connexions différentes) et chaque requête fuyait un pool entier (`too many
  clients` passé ~100 statements) : `checkout()` dédié + singleton partagé
  dans `@mosaix/adapter-database-postgres`. Sans ce correctif, aucune
  migration lourde ni aucun `save()` multi-ordres n'était sûr.
- `purpose='multivalue'` sur les 6 features énumérées ; attributs de variante
  en texte (`storage_gb`/`ram_gb` N→T, contrat d'entrée propose/CSV) ;
  `misc.models` joint (pas de lien isolé) ; 7 mappings de tags manquants
  (garde `NOT EXISTS` incomplète du backfill v1.005).
- Ordre déterministe à la lecture (pas de colonne position) : media par
  `metadata.positionIndex`, variantes par `sku`, tags/categories/keywords par
  ordre alphabétique.

---

## Consequences

- Seule source de vérité persistée : les tables ; toute requête facette/jointure
  devient possible (recherche PRD-0011).
- `VendableRepository`, MCP, wizard, CSV : inchangés (contrat document stable).
  Seul `PortfolioService` calcule désormais `quality` à la lecture
  (`find`/`list`/`search`), puisqu'elle n'est plus stockée.
- Nouvelles écritures proscrivant le JSON : revue de toute future colonne JSON
  en `portfolio.*` (seule exception : `media_assets.metadata`).
- Suivi : traductions EN/AR, ré-hébergement media, workflow de publication —
  inchangés par cette ADR.
