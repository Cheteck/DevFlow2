# Gestion des Vendables — BAC Portfolio (`@apps/portfolio`)

> Analyse consolidée des gestion (domain services, gestion de X) présents dans le Bounded Application Context Portfolio, à partir de la revue du code source.

---

## 1. Gestion du cycle de vie — **Lifecycle Management**

- **Fichier** : `domain/portfolio-service.ts:278-293`, `domain/portfolio-service.ts:67-76`
- **Responsabilités** : state machine workflow du vendable
- **Transitions autorisées** (`ALLOWED_WORKFLOW_TRANSITIONS`) :
  - `Draft → [Draft, In Review]`
  - `In Review → [In Review, Validated, Draft]`
  - `Validated → [Validated, Published, Draft]`
  - `Published → [Published, Archived, Draft]`
  - `Archived → [Archived, Draft]`
- **Validation** : `validateWorkflowTransition()` (ligne 298-308) rejette les transitions non déclarées → `InvalidWorkflowTransitionError`
- **Idempotence** : transition au même statut = no-op (autorisée)
- **Intégration** : `updateVendable()` (ligne 202-256) déclenche `validateWorkflowTransition` si `identity.status` présent dans `UpdateVendableInput`
- **Workflow Engine** : `vendable-workflow.ts` (`WorkflowEngine`) orchestre `validateCompleteness → publishVendable` avec compensation (`Published → Draft`)

---

## 2. Gestion de création — **Create Management**

- **Fichier** : `domain/portfolio-service.ts:166-191`
- **Responsabilités** : création d'un vendable avec invariants
- **Validations** :
  - ID unique (`findById` → `Error("Vendable with ID already exists")`)
  - Référence unique (`findByReference` → `DuplicateVendableReferenceError`)
  - Invariants métier (`validateDomainInvariants`)
- **Auto-calcul** : `InformationQuality` calculé à la création (`calculateCompleteness`)
- **Persistance** : `repository.save(withQuality)`

---

## 3. Gestion de mise à jour — **Update Management**

- **Fichier** : `domain/portfolio-service.ts:202-256`
- **Responsabilités** : mise à jour partielle d'un vendable
- **Fonctionnalités** :
  - Mise à jour sélective : `content`, `characteristics`, `classification`, `media`, `variants`, `relations`, `identity.status`, `identity.reference`
  - Validation de transition de workflow incluse (`identity.status`)
  - Re-validation des invariants (`validateDomainInvariants`)
  - Re-calcul de la qualité (`calculateCompleteness`)
- **Pattern** : clonage immuable (`{...existing.identity}`, `updated` reconstruction)

---

## 4. Gestion de suppression — **Delete Management**

- **Fichier** : `domain/portfolio-service.ts:260-267`
- **Responsabilités** : suppression par ID
- **Validation** : `VendableNotFoundError` si inexistant (ligne 263)
- **Opération** : `repository.delete(id)`

---

## 5. Gestion de lecture — **Read Management**

- **Fichier** : `domain/portfolio-service.ts:195-197`, `271-273`, `312-372`
- **Responsabilités** : consultation du catalogue
- **Fonctionnalités** :
  - `findVendable(id)` — lookup par ID (`findById`)
  - `listVendables()` — liste complète (`findAll`)
  - `search(criteria)` — recherche multicroité (`SearchCriteria`, ligne 312-372)
- **Dimensions recherche** (`SearchCriteria`) :
  - `id`, `reference`, `type`, `status` (exact)
  - `name`, `description` (case-insensitive substring, multilingue)
  - `category`, `tag`, `collection` (appartenance au tableau)
  - `language` (présence traduction)
  - `attribute` (match `{ key, value? }`)

---

## 6. Gestion des relations sémantiques — **Semantic Relations Management**

- **Fichier** : `domain/portfolio-service.ts:82-89`, `domain/vendable.ts:53-66`
- **Type** : `VendableRelations = RelationItem[]`
- **Types de relations** (`RelationType`) :
  - `compatible_with` — compatible avec
  - `complement_of` — complémentaire de
  - `alternative_to` — alternative à
  - `variant_of` — variante de
  - `replaces` — remplace
- **Structure** : `{ targetId, type, metadata? }`
- **Validation** : `SelfRelationError` pour auto-référence (ligne 85-87)

---

## 7. Gestion des variants — **Variant Management**

- **Fichier** : `domain/portfolio-service.ts:92-100`, `domain/vendable.ts:43-50`
- **Type** : `VendableVariants = VariantItem[]`
- **Structure** : `{ id, reference, content?, characteristics?, media? }`
- **Validation** : `DuplicateVariantReferenceError` — référence de variante unique (ligne 93-99)

---

## 8. Gestion de l'information multilingue — **Localization Management**

- **Fichier** : `domain/vendable.ts:14-21`, `domain/portfolio-service.ts:331-349`
- **Languages ciblés** : `fr`, `en`, `ar` (définis dans `calculateCompleteness` ligne 458)
- **Structure** : `VendableContent = Record<string, LocalizedContent>`
- **Contenu localisé** : `{ name, shortDescription?, description?, keywords? }`
- **Fonctionnalités recherche** :
  - Case-insensitive sur `name`/`description` dans toutes les langues (`Object.values(v.content)`)
  - Filtre par langue (`criteria.language` → vérifie `v.content[lang]`)

---

## 9. Gestion de la qualité informationnelle — **Information Quality Management**

- **Fichier** : `domain/portfolio-service.ts:378-471`
- **Type** : `InformationQuality { completeness: number, missingFields: string[] }`
- **Score** (0-100) :
  - `name` : +20 pts (ligne 383-384)
  - `description` : +20 pts (ligne 392-393)
  - `categories` : +20 pts (ligne 402-403)
  - `media` : +15 pts (ligne 410-411)
  - `attributes` : +15 pts (ligne 420-421)
  - `tags` : +10 pts (ligne 429-430)
- **Pénalités par type** (ligne 436-456) :
  - `Service` : -5 si pas de `duration` (ligne 437-440)
  - `Product` : -5 si pas de `material` **et** pas de `weight` (ligne 441-445)
  - `Experience` : -5 si pas de `requirements` (ligne 446-449)
  - `DigitalProduct` : -5 si pas de `fileSize` **et** pas de `format` (ligne 451-455)
- **Pénalités i18n** (ligne 458-465) : -5 par langue (`fr`, `en`, `ar`) manquante ou incomplète (nom OU description absent)
- **Calcul automatique** : invoqué à la création (`createVendable:185`) et mise à jour (`updateVendable:252`)

---

## 10. Gestion des médias — **Media Management**

- **Fichier** : `domain/vendable.ts:34-41`
- **Type** : `VendableMedia = MediaItem[]`
- **Structure** : `{ id, type, url, metadata? }`
- **Types** : `"image" | "video" | "pdf" | "document" | string`
- **Validation** : contrôle des clés opérationnelles sur `media.metadata` (ligne 130-133)

---

## 11. Gestion des classifications — **Classification Management**

- **Fichier** : `domain/vendable.ts:28-32`
- **Structure** : `VendableClassification { categories?, tags?, collections? }`
- **Utilisation** :
  - Filtrage recherche : `category`, `tag`, `collection` (ligne 351-364)
  - Scoring qualité : pénalité si `categories` vide
- **Validation** : contrôle des clés opérationnelles (pas de `metadata` sur classification directement, mais sur `media`, `variants`, `relations`)

---

## 12. Gestion des données opérationnelles — **Operational Data Guard Management**

- **Fichier** : `domain/portfolio-service.ts:53-161`
- **Responsabilités** : préserver la frontière "décidé" du portefeuille
- **Liste noire inversée** (`FORBIDDEN_OPERATIONAL_KEYS`) (ligne 53-65) :
  - `price`, `pricing`, `stock`, `inventory`, `seller`, `available`, `availability`
  - `booking`, `order`, `transaction`, `pricing_period`
- **Scope de validation** :
  - `characteristics.attributes` (ligne 121-123)
  - `characteristics.specifications` (ligne 124-126)
  - `media[].metadata` (ligne 128-134)
  - `variants[].characteristics.attributes` (ligne 137-140)
  - `variants[].characteristics.specifications` (ligne 141-144)
  - `variants[].media[].metadata` (ligne 144-151)
  - `relations[].metadata` (ligne 154-159)
- **Erreur** : `Error("Conceptual drift: Portfolio cannot store commercial or operational data...")` (ligne 114)

---

## 13. Gestion des imports/exports CSV — **CSV Management**

- **Fichier** : `domain/portfolio-service.ts:476-575`
- **Export** (`exportCsv`, ligne 476-496) :
  - Format : `id,reference,type,status,name,description,categories,attributes`
  - Fallback : `content["fr"]` ou première langue disponible
  - Échappement : `"` → `""`
  - Limitations : perte `media/variants/relations`, échappement incomplet des valeurs (`,`, `\n`, `=`)
- **Import** (`importCsv`, ligne 502-575) :
  - Parsing : regex `(".*?"|[^",\s]+)` (fragile sur `,` dans description)
  - Mapping : type cast sans validation (`statusStr as WorkflowStatus`)
  - Création : appel `createVendable` (validation invariants)
  - Perte : `en/ar` non importés, `media/variants/relations` vides par défaut
  - Tolerance : skip silencieux si `parts.length < 5` (ligne 516)

---

## 14. Gestion de la persistance — **Persistence Management**

- **Fichiers** :
  - Port : `domain/vendable-repository.ts` (`VendableRepository` interface)
  - Adaptateur dev : `infrastructure/in-memory-vendable-repository.ts`
  - Adaptateur prod : `infrastructure/postgres-vendable-repository.ts`
- **Responsabilités** :
  - `save`, `findById`, `findByReference`, `findAll`, `delete`
- **PostgresVendableRepository** (ligne 35-125) :
  - Transaction sur `save` (`ON CONFLICT DO UPDATE`)
  - Hydration JSON pour `content/characteristics/classification/media/variants/relations/quality`
  - Table : `portfolio_vendables`
- **ORM** : `infrastructure/persistence/vendable.model.ts` (`VendableModel`, `VariantModel`) — découpé du domaine

---

## 15. Gestion des événements — **Event Management**

- **Fichier** : `src/index.ts` (MANIFEST)
- **Événements** (3) :
  - `portfolio.vendable.created`
  - `portfolio.vendable.published`
  - `portfolio.workflow.updated`

---

## 16. Gestion des capabilities — **Capability Management**

- **Fichier** : `src/index.ts:86-100`
- **Capabilities exposées** (2) :
  - `portfolio.vendable.publish` → `VendableWorkflow.publish` (ligne 86-94)
  - `portfolio.vendable.search` → `PortfolioService.search` (ligne 96-100)
- **Capabilities du service non exposées** (gap) :
  - `createVendable`, `updateVendable`, `deleteVendable`, `listVendables`, `findVendable`, `updateWorkflowStatus`, `calculateCompleteness`, `exportCsv`, `importCsv`

---

## 17. Gestion de la composition — **Composition Root Management**

- **Fichiers** : `src/composition-root.ts`, `src/index.ts:108-148`
- **Responsabilités** : wiring DI, montage HTTP, injection adaptateurs
- **Factory** : `createPortfolioApp(kernel, tenant, adapters)` → crée container enfant, valide conformance, boot service provider, monte router sur `/tenants/{orgId}/portfolio`
- **Adapters** : `InMemoryVendableRepository` par défaut via DI
- **Legacy** : `createPortfolioComposition` (ligne 135-148) — chemin alternatif sans MosaixApp

---

## 18. Gestion des autorisations — **Permission Management**

- **Fichier** : `src/index.ts` (MANIFEST)
- **Permissions** (3) :
  - `portfolio:vendable:create`
  - `portfolio:vendable:read`
  - `portfolio:vendable:search`

---

## 19. Gestion du frontend — **Experience Management**

- **Fichier** : `frontend/src/index.ts`
- **Contributions** :
  - Navigation (sidebar) : `portfolio:nav`
  - Page : `portfolio:catalog-page`
- **Page** : `PortfolioCatalogPageView` — route `/portfolio/catalog`, rendu HTML statique
- **Styles** : `PortfolioStyles` — CSS inline
- **Admin** : `registerPortfolioAdminPages()` → `vendables-management` avec permission `portfolio:vendable:read`

---

## Points critiques (gaps & anti-patterns)

| Catégorie | Point critique | Localisation |
|---|---|---|
| **Coupling** | Domaine importe l'adaptateur concret | `portfolio-service.ts:8` (`import InMemoryVendableRepository`) |
| **Mutation** | Mutation directe de l'entité | `portfolio-service.ts:289` (`existing.identity.status = targetStatus`) |
| **Gap Capabilities** | 6 méthodes du service non exposées | `src/index.ts:86-100` (seulement 2 capability providers) |
| **Gap Manifest** | mosaix.json (3 caps) ≠ MANIFEST (4 caps) ≠ service (15 méthodes) | `mosaix.json:16-29` vs `src/index.ts:26-30` |
| **Hardcode** | ID fallback `vend-1` | `src/index.ts:90` (`vendableId ?? "vend-1"`) |
| **CSV** | Parsing fragile + perte de données | `portfolio-service.ts:476-575` |
| **Typage** | `VendableType \| string` ouvre le typage | `vendable.ts:2` |
| **Conformance** | Pas de `registerCapabilityContract` zod | `src/index.ts` — validation d'entrée absente |
