# MosaiX / IJIDeals Platform — Feuille de Route & Horizons Futurs

- [x] **Phase 1 : Setup & Infrastructure**
    - [x] Initial Audit & Conformance Tests.
    - [x] Project tracking setup & governance.
    - [x] Contract checking (`scripts/check-contracts.ts`).

- [x] **Phase 2 : Écosystème 10 BACs Canoniques**
    - [x] `citadelle` (Identité & IAM, MFA, RGPD).
    - [x] `commerce` (Orders, Checkout, State Machine, Payment Intent, Auctions, Offers).
    - [x] `portfolio` (PIM, Vendables, Variants, Media, Categories, Import CSV).
    - [x] `solara` (Social Engine, Posts, Comments, Moderation, Reactions).
    - [x] `booking` (Appointments, Calendar Sync, Waitlists, Reminders).
    - [x] `solidarity` (Crises, GeoJSON, Merkle Audit, Offline Queue, Hubs).
    - [x] `beam` (Chiffrement E2E ECDH/AES-GCM, Push, Rich Messages).
    - [x] `spaces` (Multi-tenant, Custom Domains, SCIM, Dynamic Roles).
    - [x] `imperia` (Gouvernance Rego/OPA, Audit, Compliance SOC2).
    - [x] `subscription` (Metering, Prorata, Dunning, Invoices, Coupons).

- [x] **Phase 3 : Moteur d'Autorisation Unique v2 & Persistance Relationnelle**
    - [x] Moteur `EffectivePermissionResolver` (règle prioritaire `DENY > ALLOW`).
    - [x] Value Objects universels `Money` & `Timestamp`.
    - [x] Tables RBAC & Audit (`permissions`, `roles`, `role_permissions`, `space_members`, `permission_overrides`, `acting_as_audit_events`, `role_audit_events`).
    - [x] Complete DB schema alignment across all 10 BACs.

- [ ] **Phase 4 (Horizon) : Extension Écosystème Sports & Athlétisme (ex: CAJ Jijel)**
    - [ ] `@apps/olympia` : Passeport Athlète, records personnels (*PB/SB*), suivi VMA/récupération.
    - [ ] `@apps/chronos` : Chronométrage RFID, gestion des dossards, temps de passage & leaderboards live.
    - [ ] `@apps/patronus` : Sponsoring, crowdfunding de déplacement & rapports de subvention DJS.
    - [ ] `@apps/arena` : Gestion des installations (pistes, gymnases) & prêt de matériel.
    - [ ] `@apps/curator` : Musée virtuel du club, Hall of Fame & armoire à trophées.

- [ ] **Phase 5 (Horizon) : Extension Écosystème Études, Campus & Emploi**
    - [ ] `@apps/academy` : LMS (modules, devoirs, relevés de notes ECTS, diplômes numériques certifiés).
    - [ ] `@apps/career` : Job Board & ATS (offres de stages/PFE/emplois, candidatures 1-clic *Easy Apply*, skill-gap analysis).
    - [ ] `@apps/mentor` : Annuaire Alumni certifié, parrainage pro & tutorat étudiants.
    - [ ] *Fonctionnalités sociales Campus (inspirées de FB/LinkedIn)* :
        - Sceau Diplôme Vérifié & validation de compétences (*Endorsements*).
        - Groupes de promo, TD & clubs étudiants sur Spaces/Solara.
        - Marketplace étudiante (livres, manuels, colocations) sur Commerce/Portfolio.
        - Événements campus & billetterie QR Code sur Booking/Solara.
