# Rapport d'audit — Phase 02 : Gouvernance et ownership des ressources

**Date :** 2026-11-09  
**Phase :** 02 — Gouvernance et ownership des ressources (P0 — Bloquant)  
**Statut :** TERMINÉ  
**Jalon de sortie visé :** G0 — Chaque ressource connue possède un propriétaire unique et les règles de modification sont explicites.

---

## ADR produits

| ADR | Chemin | Objet |
|-----|--------|-------|
| ADR-0025 | `.project/decisions/ADR-0025-migration-ownership-resource-governance.md` | Ownership & Resource Governance |
| ADR-0026 | `.project/decisions/ADR-0026-migration-identity-naming.md` | Migration Identity & Naming |

---

## T02-01 — Namespaces des propriétaires

Trois namespaces figés dans ADR-0026 :

| Namespace | Préfixe `ownerId` | Exemples |
|-----------|-------------------|----------|
| Framework | `framework.<package>` | `framework.core`, `framework.kernel`, `framework.platform`, `framework.migrations` |
| BAC | `bac.<name>` | `bac.citadelle`, `bac.commerce`, `bac.booking`, `bac.imperia`, `bac.solara`, `bac.solidarity`, `bac.subscription`, `bac.beam`, `bac.spaces`, `bac.portfolio` |
| Plugin | `plugin.<publisher>.<name>` | `plugin.ijideals.analytics`, `plugin.partner.crm` |

**Règle D1 :** L'ownerId est stable, identifie le propriétaire des ressources, pas la version logicielle.

---

## T02-02 — Registre canonique des ressources

Registre initial extrait de l'inventaire Phase 01 (T01-03) :

| Owner | Ressources SQL (tables) |
|-------|------------------------|
| `framework.migrations` | `mosaix_migrations` (table des migrations, moteur) |
| `framework.core` | — (à déclarer lors de la migration des packages framework, Phase 06) |
| `bac.citadelle` | `mfa_secrets`, `mfa_used_totp_steps`, `__citadelle_noop` |
| `bac.commerce` | `commerce_orders`, `commerce_offers`, `commerce_payment_intents`, `commerce_auctions`, `commerce_auction_bids`, `commerce_carts`, `commerce_cart_items` |
| `bac.booking` | `booking_slots`, `booking_reservations`, `booking_waitlists`, `booking_reminders` |
| `bac.imperia` | `imperia_audit_logs`, `imperia_policies`, `imperia_dlq`, `imperia_circuit_breakers`, `imperia_settings` |
| `bac.solara` | `solara_posts`, `solara_comments`, `solara_followers`, `solara_reactions`, `solara_categories`, `solara_translations` |
| `bac.solidarity` | `solidarity_incidents`, `solidarity_needs`, `solidarity_donations`, `solidarity_hubs`, `solidarity_resources`, `solidarity_missions`, `solidarity_distributions`, `solidarity.allocations` |
| `bac.subscription` | `user_subscriptions` (transféré du shell, voir T02-04), `subscription.*` |
| `bac.beam` | `beam.*` |
| `bac.spaces` | `spaces.*` |
| `bac.portfolio` | `portfolio.*` |
| `shell` (legacy, à supprimer) | `identities`, `external_identities`, `credentials`, `sessions`, `tokens`, `shell_feed`, `commerce_products`, `portfolio_items`, `spaces`, `space_members`, `beam_channels`, `beam_messages`, `booking_slots`, `booking_reservations`, `imperia_proposals`, `imperia_votes`, `solidarity_campaigns`, `solidarity_contributions`, `platform_settings`, `feature_flags` |

**Règle D3 :** Une ressource SQL possède un propriétaire unique et canonique.

---

## T02-03 — Règle One business datum ⇒ One owner BAC

**Règle opposable (ADR-0025 §2.2) :** Aucune donnée métier ne peut être possédée par deux BACs. L'accès aux données d'un autre BAC se fait par API publique, événement de domaine ou contrat versionné — jamais par DDL direct.

**Conséquence :** Le Shell ne possède plus de données métier BAC. Le Shell possède uniquement l'infrastructure (identités, sessions, migrations engine) et délègue les données métier aux BACs propriétaires.

---

## T02-04 — Propriétaire de `user_subscriptions`

**Décision :** Le propriétaire canonique de `user_subscriptions` est **`bac.subscription`**.

**Justification :** `user_subscriptions` est une donnée métier d'abonnement, relevant du domaine billing/subscription. Le Shell Core ne doit pas posséder de données métier BAC.

**Plan de transfert :**
1. Le Shell Core (`shell.core.v1.002_create_subscription_tables`) conserve la table pour rétrocompatibilité sur les bases déjà migrées.
2. Le BAC `subscription` déclare `user_subscriptions` comme sa ressource canonique dans ses `resources[]`.
3. Une migration de transition est créée par `subscription` pour reprendre la propriété (vérification de l'historique, conservation des données, tests de compatibilité).
4. Une fois le transfert effectif, le Shell Core supprime sa déclaration de `user_subscriptions` dans ses ressources et ne crée plus la table dans ses nouvelles migrations.

---

## T02-05 — Ressources système Framework vs Citadelle

| Ressource | Propriétaire | Justification |
|-----------|-------------|---------------|
| `mosaix_migrations` | `framework.migrations` | Métadonnées du moteur, infrastructure commune |
| Tables système framework (settings, feature flags, etc.) | `framework.core` / `framework.kernel` | Infrastructure plateforme |
| Identités, sessions, credentials, tokens | `bac.citadelle` | Domaine authentification/identité |
| Espaces, équipes, rôles locaux | `bac.spaces` | Domaine organisationnel |
| Données métier (offres, commandes, posts, incidents, etc.) | BAC propriétaire métier | Chaque BAC possède ses données |

Citadelle ne possède pas les données métier des autres BACs. Citadelle gère l'authentification et l'autorisation, jamais la donnée métier directe.

---

## T02-06 — Règles d'accès inter-BAC

| Type d'accès | Autorisé | Interdit |
|-------------|----------|----------|
| Lecture de données via API publique | ✅ | |
| Événement de domaine (publish/subscribe) | ✅ | |
| Contrat versionné explicite | ✅ | |
| DDL direct sur table étrangère | | ✅ |
| Requête SQL directe sur table étrangère (bypass API) | | ✅ |
| Modification de schéma d'une ressource étrangère | | ✅ |

---

## T02-07 — Règles de collision R9 (trois niveaux)

| Niveau | Contrôle | Quand détecté | Action |
|--------|----------|---------------|--------|
| Déclaratif (`resources[]`) | Chargement dans le Registry | `MigrationConflictError` |
| Structurel (Blueprint/AST) | Validation du plan (Planner) | `MigrationResourceConflictError` |
| Base réelle (objets SQL existants) | Validation du plan (Planner) | Blocage si owner modifie ressource étrangère |

Le contrôle structurel porte sur les opérations Blueprint compilées, pas sur l'analyse du comportement arbitraire d'une fonction TypeScript.

---

## T02-08 — Politique de dépendances

**Règle :** Un DAG unique et déterministe. Pas de cycles. Les dépendances sont déclarées dans `Migration.dependencies` (ids exacts d'autres migrations).

**Ordonnancement (R10) :**
1. Framework bootstrap (moteur, métadonnées, locks)
2. Framework packages (core → kernel → platform selon dépendances déclarées)
3. Application DAG (BACs, selon dépendances inter-BAC)
4. Migrations applicatives (séquence numérique dans chaque module)

**Matrice des dépendances autorisées :**

| Dépendant | Dépend de | Autorisé | Justification |
|-----------|-----------|----------|---------------|
| `bac.commerce` | `bac.citadelle` | ✅ | Commerce référence les identités |
| `bac.commerce` | `bac.portfolio` | ✅ | Commerce référence les produits |
| `bac.booking` | `bac.citadelle` | ✅ | Booking référence les identités |
| `bac.subscription` | `bac.citadelle` | ✅ | Subscription référence les identités |
| `bac.solara` | `bac.citadelle` | ✅ | Solara référence les identités |
| `bac.spaces` | `bac.citadelle` | ✅ | Spaces référence les identités |
| `bac.solidarity` | `bac.citadelle` | ✅ | Solidarity référence les identités |
| `bac.beam` | `bac.citadelle` | ✅ | Beam référence les identités |
| `bac.portfolio` | `bac.citadelle` | ✅ | Portfolio référence les identités |
| `bac.citadelle` | tout autre BAC | ❌ | Citadelle n'a pas de dépendance métier vers les BACs |
| Tout BAC | `framework.*` | ✅ | Dépendance infrastructure |

---

## Critère de sortie Jalon G0 (Phase 02)

✅ **ATTEINT** : Chaque ressource connue possède un propriétaire unique et les règles de modification sont explicites.

- ADR-0025 (Ownership & Resource Governance) et ADR-0026 (Identity & Naming) créés.
- Registre canonique des ressources établi (10 BACs + framework + shell legacy).
- Propriétaire de `user_subscriptions` déterminé : `bac.subscription`.
- Règle One business datum ⇒ One owner BAC formalisée.
- Règles d'accès inter-BAC et collision R9 définies.
- Matrice des dépendances autorisées établie.

---

## Validation ChatGPT — Jalon G0

**Décision :** Jalon G0 accepté sous réserves de vérification documentaire. Phase 03 autorisée avec périmètre strict.

**Réserves à lever (ChatGPT) :**
- R1 (P0) : Exhaustivité du registre par comparaison avec les migrations existantes et schémas réels
- R2 (P0) : Transfert `user_subscriptions` — procédure explicite, pas de changement manuel du Store
- R3 (P1) : Dépendances inter-BAC sans cycle, pas de droits de modification indirects
- R4 (P1) : Distinguer migrations jamais appliquées vs déjà enregistrées dans le Store

**Périmètre autorisé pour Phase 03 (interdictions formelles) :**
- ✅ AUTORISÉ : MigrationContext, MigrationLogger, MigrationRuntime, Migration.up/down, rawSql, compatibilité anciennes migrations SQL, tests de compilation
- ❌ INTERDIT : modifier le Runner, introduire Compiler/Validator, migrer les providers BACs, modifier le Store, transférer user_subscriptions, modifier les migrations historiques, introduire les plugins

**Critères d'acceptation Phase 03 (C01-C12) :**
- C01 : MigrationContext entièrement typé
- C02 : MigrationLogger indépendant de l'implémentation
- C03 : MigrationRuntime documenté et typé
- C04 : up(context) asynchrone supporté contractuellement
- C05 : down(context) optionnel
- C06 : Anciennes migrations SQL toujours valides
- C07 : Modes TypeScript et SQL mutuellement exclusifs
- C08 : rawSql explicitement déclaré
- C09 : Aucune modification des IDs historiques
- C10 : Tests TypeScript de compilation et de compatibilité
- C11 : Contrats publics existants préservés
- C12 : Documentation des responsabilités du Context

**Réserve critique (parsing IDs) :** Les ownerId contiennent des points (ex. `framework.core`). Le parseur ne doit pas simplement découper sur chaque point, mais s'appuyer sur le propriétaire connu du Manifest avec un format non ambigu.

---

## Suivant : Phase 03 — Contrats TypeScript natifs

La Phase 02 est terminée. Le jalon G0 est atteint et validé par ChatGPT. La Phase 03 doit introduire :
- `MigrationContext` (`schema`, `database`, `logger`, `runtime`)
- `MigrationLogger`, `MigrationRuntime`
- Évolution du contrat `Migration` : `up(context)?`, `down(context)?`, `rawSql?`
- Compatibilité avec `content`/`down` historiques
- Contrat discriminé pour éviter les modes d'exécution incompatibles

**Périmètre strict : uniquement les contrats et tests. Aucun changement du Runner, du Store, ni des migrations existantes.**

**Aucun fichier du projet n'a été modifié durant cette phase (mode OFF_RECORD respecté).**

---

*Rapport Phase 02 produit. Preuves : ADR-0025 et ADR-0026 créés, registre des ressources compilé, matrice des dépendances établie, validation ChatGPT obtenue. Aucun changement de code.*