# PRD-0010 — Portfolio Propositions par les Spaces

**Statut** : Proposition — v1.3 (2026-09-24) — simplification : révision supprimée
**Priorité** : Haute (dépendance DATA-09 CS-Cart Features, THEME propagation, ROLE P4 dynamic)
**Couche** : Bounded Context `portfolio` (admin plateforme) ↔ `spaces` (admin space) ↔ `commerce`
**Package principal** : `@apps/portfolio` (domain `Proposal` → `Vendable` + workflow `Draft→Published`)

**Packages associés**
* `@apps/spaces` — `Space` + `SpaceRolePolicyEngine` (propose), `business-registry`
* `@apps/commerce` — lecture `portfolio_vendables` Published via `CommerceOffer`
* `@mosaix/core` — `EffectivePermissionResolver` (`portfolio:proposal:*:space|platform`)
* `@mosaix/schemas` — Zod `ProposalPayload`

> **Invariant fondateur v1.3** : **Proposal ≠ Vendable**. Une `Proposal` est un **objet de travail mutable** (Draft/Submitted/InReview/ChangesRequested) ; le `Vendable` est l'objet **canonique** du catalogue (Published). **Aucun Vendable n'est matérialisé tant que la proposition n'est pas approuvée atomiquement**. Après approbation `proposal.vendable_id = V987` (avant `NULL`). **Dépendance unidirectionnelle** : `Proposal → Vendable`, jamais `Vendable → Proposal` ni `Vendable → Space`. Une proposition est modifiable jusqu'à `submit`, puis instruite — pas besoin d'historiser chaque contenu en v1.

---

## Révisions

| Version | Contenu |
|---------|---------|
| **v1.0** | Création : flux Space → validation plateforme, modèle `portfolio_proposals` JSONB, UI bi-face. |
| **v1.1** | Séparation nette `Proposal` (temporaire, volumineuse) vs `Vendable` (canonique) ; `proposal.vendable_id NULL` avant `Approved` ; modèle révisé : `portfolio_proposals` + `proposal_revisions` + tables miroir `proposal_*` structurées (pas second modèle métier permanent) ; `portfolio_vendables` sans colonne Proposal/Space. |
| **v1.2** | 7 corrections : approbation **transaction atomique** + `InReview` lock concurrence ; `Approved` vs `Published` ; `suggestedReference` vs canonique ; `current_revision_id` circulaire ; contrat `ProposalRevisionPayload {schemaVersion:1}` ; `proposal_reviews` ; API `Draft` vs `submit` ; `assignableBy` ; rétention `Archived→Deleted`. |
| **v1.3** | **Simplification : suppression `proposal_revisions`, `proposal_reviews`, `schemaVersion`, `current_revision_id`** — une proposition est un brouillon mutable jusqu'à soumission, puis instruite. Contenu courant écrasé (`PATCH`), feedback courant écrasé, audit externe suffit. Modèle à une table `portfolio_proposals` (contenu + feedback + lock). |

---

## 1. Vision

Un vendeur (Space `caj-jijel`, `boutique-amel`) ne crée plus directement dans `portfolio`. Il **propose** un produit depuis son Space (nom, description, catégorie, features CS-Cart, médias, prix souhaité) ; l'équipe plateforme **instruit** (complétude, qualité `DATA-09`, doublon `reference`, conformité), **demande des corrections** ou **publie**.

```
                 SPACE
                   │
                   ▼
          ┌─────────────────┐
          │    Proposal     │  Draft → Submitted → InReview → ChangesRequested/Rejected/Approved
          │  (mutable)      │  100k propositions possibles, contenu écrasé
          └────────┬────────┘
                   │ approve (transaction atomique §4.4)
                   ▼
             TRANSACTION
                   │
                   ▼
          ┌─────────────────┐
          │    Vendable     │  12k vrais Vendables, Published (canonique)
          │  (canonique)    │  propre, purgable sans toucher au catalogue
          └────────┬────────┘
                   │
                   ▼
               Commerce
```

**Proposal = objet de travail mutable, Vendable = registre canonique.** Pas d'historique `v1→v2→v3` en v1 — l'audit suffit.

---

## 2. Acteurs & Rôles

| Acteur | Rôle effectif `authorization.can` | Peut faire |
|--------|-----------------------------------|------------|
| **Platform Admin** (`superadmin`/`admin` global) | `portfolio:vendable:manage:platform` + `portfolio:proposal:review:platform` | tout : créer directement, lister toutes propositions, `approve`/`reject`/`requestChanges`, publier, archiver, gérer catégories/features |
| **Space Admin** (`owner`/`admin` du Space `spaceId`) | `portfolio:proposal:create:space` + `portfolio:proposal:read:space` (scope `spaceId`) | proposer depuis son Space, lister ses propositions, `update` tant que `Draft`/`ChangesRequested`, `withdraw`, voir `Approved` de ses propositions |
| **Space Member** (`editor`/`moderator`) | selon rôle | proposer **si** `space_roles` lui donne `portfolio:proposal:create:space` (owner/admin l'ont par défaut, editor/moderator `DENY` par défaut mais `assignableBy: ["owner","admin"]` permet à owner de l'autoriser) |
| **Acheteur** | aucune | ne voit que `Published` via `portfolio.vendable.search` |

**Clarification `assignableBy` vs `default roles`** :

```ts
permission: { key:"portfolio:proposal:create:space", assignableBy:["owner","admin"] } // qui peut ASSIGNER
role defaults: owner:ALLOW, admin:ALLOW, editor:DENY, moderator:DENY // qui l'A par défaut
```

---

## 3. États & Transitions

```
                         ┌───────────────┐
                         │     Draft     │  POST /proposals → Draft
                         └───────┬───────┘
                                 │ POST .../submit
                                 ▼
                         ┌───────────────┐
                         │   Submitted   │
                         └───────┬───────┘
                                 │ claim InReview
                                 ▼
                         ┌───────────────┐
                         │   InReview    │  reviewed_by, review_started_at
                         └───────┬───────┘
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     ChangesRequested        Rejected           Approved
              │                                    │ atomic tx (§4.4)
              │ PATCH → Draft (écrase)            ▼
              └──────► Submitted            portfolio_vendables Published
                     (re-submit)               └──archive──→ Archived
```

`Approved` Proposal → création `portfolio_vendables` `Published` (même `reference` canonique, nouveau `id V987`). Avant `Approved` : `proposal.vendable_id = NULL`.

---

## 4. Modèle de données — une table Proposal, pas de révisions

> **Règles v1.3** : `portfolio_vendables` **ne contient aucune colonne Proposal/Space** et reste agnostique. Seule `portfolio_proposals.vendable_id` (NULL → V987 après `Approved`) assure la traçabilité `P123 → V987`. **Pas de `proposal_revisions`, pas de `proposal_reviews`, pas de `schemaVersion`, pas de `current_revision_id`** en v1 — le contenu est le **contenu courant** écrasé, l'audit est externe.

### 4.1 `portfolio_proposals` (objet de travail, volumineux, purgable)

```sql
CREATE TABLE portfolio_proposals (
  id VARCHAR(255) PRIMARY KEY, -- prop_<uuid>

  space_id VARCHAR(255) NOT NULL REFERENCES spaces(id),
  proposer_user_id VARCHAR(255) NOT NULL,

  suggested_reference VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('Product','Service','DigitalProduct','Experience')),

  status VARCHAR(32) NOT NULL
    CHECK (status IN ('Draft','Submitted','InReview','ChangesRequested','Approved','Rejected','Withdrawn','Archived')),

  -- contenu courant de la proposition (écrasé à chaque PATCH tant que Draft/ChangesRequested)
  content JSONB NOT NULL,
  classification JSONB NOT NULL,
  characteristics JSONB NOT NULL,
  features JSONB NOT NULL, -- validé DATA-09 CS-Cart (f-chipset etc.)
  variants JSONB NOT NULL,
  media JSONB NOT NULL,
  translations JSONB NOT NULL,

  -- instruction (courant, écrasé)
  platform_feedback TEXT NULL,
  rejection_reason TEXT NULL,

  -- review lock (InReview)
  reviewed_by VARCHAR(255) NULL,
  review_started_at TIMESTAMPTZ NULL,

  -- résultat (NULL avant Approved)
  vendable_id VARCHAR(255) NULL REFERENCES portfolio_vendables(id),

  submitted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_proposals_space_status ON portfolio_proposals(space_id, status);
CREATE UNIQUE INDEX uniq_proposals_space_suggested_active ON portfolio_proposals(space_id, suggested_reference) WHERE status IN ('Draft','Submitted','InReview','ChangesRequested');
```

**Justification v1.3** : pas besoin de `portfolio_proposal_revisions` si on ne doit ni requêter/indexer les données internes des anciennes révisions, ni reconstruire l'historique du contenu. La liste `proposal list → metadata SQL → payload à l'ouverture` suffit. Si demain on veut facettes sur les propositions, on extraira alors (pas avant).

### 4.2 `portfolio_vendables` — inchangé (canonique)

Aucune colonne `proposed_by_*` ajoutée. `reference UNIQUE` globale reste seule garde-fou (conflit à `approve` si un Vendable même reference a été créé entre-temps → 409).

```sql
-- Aucun ALTER sur portfolio_vendables
-- Traçabilité historique seulement : SELECT * FROM portfolio_proposals WHERE vendable_id='V987'
```

### 4.3 Approbation atomique & concurrence

**Invariance** : impossible d'avoir durablement `Proposal=Approved + vendable_id=NULL` ou `Proposal=Submitted + vendable=V987`.

```sql
BEGIN;
SELECT * FROM portfolio_proposals WHERE id=:id FOR UPDATE;
-- vérifier status='InReview' (claim préalable), permissions, quality>=80, reference canonique unique

INSERT INTO portfolio_vendables(id, reference, type, status, content, classification, quality, created_at)
VALUES (:vendableId, :canonicalReference, :type, 'Published', :content, :classification, :quality, now());

UPDATE portfolio_proposals
SET status='Approved', vendable_id=:vendableId, reviewed_at=now(), updated_at=now()
WHERE id=:id;
-- emit portfolio.proposal.approved + portfolio.vendable.published
COMMIT;
```

Lock `InReview` : `Submitted → InReview` via `UPDATE ... SET status='InReview', reviewed_by=:reviewer WHERE status='Submitted'` (rowCount 0 → déjà pris → 409).

### 4.4 Propriété de la `reference`

* Space envoie `suggestedReference` (ex `IPHONE-15`).
* Portfolio **attribue** la vraie `vendable.reference` canonique à l'approbation (conserve `suggestedReference` si libre, sinon normalise).
* Validation **à `submit`** : si `suggestedReference` déjà dans `portfolio_vendables` → `Submitted ⚠ reference déjà utilisée` (warning, pas blocage) — reviewer décide.
* Validation **à `approve`** : si `reference` canonique déjà prise → `409`.

---

## 5. Permissions (ROLE-P4)

| Capability | Permission | Scope | AssignableBy | Default roles |
|---|---|---|---|---|
| `portfolio.proposal.create` | `portfolio:proposal:create:space` | `space` | `owner,admin` | `owner:ALLOW, admin:ALLOW, editor:DENY` |
| `portfolio.proposal.read` | `portfolio:proposal:read:space` | `space` | `owner,admin` | `owner,admin,editor:ALLOW` |
| `portfolio.proposal.withdraw` | `portfolio:proposal:withdraw:space` | `space` | `owner,admin` | `owner,admin:ALLOW` |
| `portfolio.proposal.review` | `portfolio:proposal:review:platform` | `platform` | `superadmin,admin` | `superadmin,admin:ALLOW` |
| `portfolio.vendable.manage` | `portfolio:vendable:manage:platform` | `platform` | `superadmin,admin` | `superadmin,admin:ALLOW` |

Vérifié via `EffectivePermissionResolver.can(userId, perm, {spaceId})` `P1-02` — `DENY > ALLOW`.

---

## 6. Flux & API

### 6.1 Proposer (Space) — Draft mutable jusqu'à submit

```
POST /spaces/:spaceId/portfolio/proposals  {suggestedReference, type, content...} → Draft (proposal.vendable_id=NULL)
  → authorization.can(userId, "portfolio:proposal:create:space", {spaceId})
  → PermissionRegistry valide features (f-chipset etc. DATA-09)
  → INSERT portfolio_proposals (Draft)

PATCH /spaces/:spaceId/portfolio/proposals/:id  {content, ...} → écrase contenu courant tant que Draft/ChangesRequested

POST /spaces/:spaceId/portfolio/proposals/:id/submit → Submitted (commande métier, pas PATCH)
  → submitted_at=now(), event portfolio.proposal.submitted {proposalId, spaceId, proposerUserId, suggestedReference, vendableId:null}
```

### 6.2 Instruire (Portfolio admin) — avec lock InReview

```
GET /portfolio/proposals?status=Submitted          → list (platform)
GET /portfolio/proposals/:id                      → fiche avec onglets Overview/Content/Features/Variants/Media/Quality (read-only sur contenu courant)
POST /portfolio/proposals/:id/request-changes {feedback} → platform_feedback=feedback, status ChangesRequested
POST /portfolio/proposals/:id/approve             → transaction atomique §4.3 : InReview→Approved + INSERT vendable Published + UPDATE proposal.vendable_id
POST /portfolio/proposals/:id/reject {reason}     → rejection_reason=reason, status Rejected (vendable_id NULL)
```

`ChangesRequested → PATCH content → POST .../submit → Submitted` (feedback précédent écrasé, audit externe conserve l'historique).

### 6.3 Côté Espace : suivi

```
GET /spaces/:spaceId/portfolio/proposals          → mes propositions (Submitted/InReview/ChangesRequested/Approved/Rejected)
POST /spaces/:spaceId/portfolio/proposals/:id/withdraw → Withdrawn (vendable_id NULL)
```

Tous les appels publient `role_audit_events` (proposal.*).

---

## 7. Événements

```ts
"portfolio.proposal.submitted"      {proposalId, spaceId, proposerUserId, suggestedReference} // vendableId=null
"portfolio.proposal.needs_changes"  {proposalId, feedback}
"portfolio.proposal.approved"       {proposalId, vendableId, spaceId, reference} // vendable_id non null seulement ici
"portfolio.proposal.rejected"       {proposalId, reason}
"portfolio.vendable.published"      {vendableId, reference} // canonique portfolio, Commerce ignore Proposal
```

Commerce ne s'abonne **qu'à** `portfolio.vendable.published` (ignorant de Proposal).

---

## 8. UI

### 8.1 Portfolio (admin plateforme)

* `/portfolio/proposals` — file d'attente `Submitted` (tri `submitted_at`, filtres `spaceId`, `category`, `quality`), badge `ChangesRequested`, colonne `InReview by`.
* `/portfolio/proposals/:id` — même fiche `Overview/Content/Features/Variants/Media/Relations/Translations/Quality` mais **mode instruction** : bandeau `Proposé par Space X par user Y`, champ `platform_feedback` courant, actions `Approve (→ crée Vendable atomique) / Request changes / Reject`.

### 8.2 Space (admin space)

* `Space → Proposer un produit` — wizard 8 étapes `vendables/new` réutilisé, `POST Draft` puis `POST .../submit`.
* `Space → Mes propositions` — table `SuggestedRef | CanonicalRef (si Approved) | Status | Feedback | Vendable (si Approved→lien V987) | Updated`.

Aucune route Space n'écrit directement `portfolio_vendables`.

---

## 9. Non-fonctionnel & Migration

* **Migration** : `portfolio_proposals` (1 table) ; seed `permissions` `portfolio:proposal:*` dans `PermissionRegistry` `P1-01` ; **aucun ALTER `portfolio_vendables`** (reste canonique, boundary `proposal.space_id` seul).
* **Idempotence** : `reference` canonique `UNIQUE` sur `vendables` seulement à `approve` ; `uniq_proposals_space_suggested_active` évite les drafts concurrents du même Space.
* **Rétention** : `Rejected/Withdrawn` → `Archived` après 90j, puis `Deleted` après politique de rétention (ex 1 an) **avec audit event conservé** — pas de `DELETE` direct à 90j.
* **Audit** : chaque transition loggée `role_audit_events` (`proposal.submitted/reviewed`) — suffit en v1 (pas besoin de `proposal_reviews`).
* **Performance** : `idx_proposals_space_status` pour file d'attente (100k `proposals` vs 12k `vendables` — séparation volumétrie) ; `payload` JSONB lu seulement à l'ouverture.

---

## 10. Critères d'acceptation

1. Un Space `editor` avec `portfolio:proposal:create:space` peut `POST /spaces/caj-jijel/portfolio/proposals` → `Draft`, `POST .../submit` → `Submitted` (`vendable_id NULL`), visible `GET /portfolio/proposals` admin.
2. Un Space `member` sans permission → `403` sur `propose`.
3. `Approve` par `platform admin` **crée atomiquement** `portfolio_vendables` `Published` (`vendable_id=V987`, `proposal Approved`) — double `Approve` concurrent → second `409` (rowCount 0 sur `Submitted→InReview`).
4. `Approve` par Space admin → `403`.
5. Proposition incomplète (`quality <80`) → `approve` rejeté `400 qualityPassed false`.
6. `ChangesRequested` (`platform_feedback="Description trop courte"`) → Space `PATCH` écrase contenu et `POST .../submit` repasse `Submitted` (feedback précédent écrasé, audit externe garde l'historique).
7. Deux Spaces même `suggestedReference` → `Submitted` OK (warning), second `Approved` → `409 unique` sur `vendables.reference`.
8. `Rejected/Withdrawn` → `GET /portfolio/vendables` ne les contient jamais (seulement 12k vrais Vendables).
9. `DELETE` direct `Rejected` <90j impossible — passe par `Archived`.
10. Commerce ne reçoit que `portfolio.vendable.published` (ignore Proposal).

---

## 11. Roadmap

| Phase | Livrable |
|-------|----------|
| **P1** | Table `portfolio_proposals` (1 table) + `Permissions` `proposal:*` + `POST Draft` + `POST .../submit` (Space) |
| **P2** | Pages `Portfolio /proposals` + `/proposals/:id` instruction + `Space / Mes propositions` |
| **P3** | `approve` transaction atomique `InReview` lock + `quality` gate + `reference` canonique + événements |
| **P4** | `DATA-09 Features` branché dans le wizard (feature values contrôlées) + `assignableBy` |

---

*PRD v1.3 lié à `active-backlog.md` §6 DATA-09 (Features CS-Cart) et §5 ROLE P1-P4 (permissions `space` vs `platform`) — simplification : Proposal mutable (contenu écrasé) + Vendable canonique, pas de révisions en v1.*
