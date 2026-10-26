# PLAN GLOBAL DE VERIFICATION, D'AUDIT ET DE VALIDATION - MosaiX

## Phase 0 - Audit initial et etat de reference (J0)

### Objectif
Etablir la baseline de reference pour toutes les mesures ulrieures.

### Actions
- [ ] Executer pnpm check complet (build + lint + typecheck + test + format)
- [ ] Executer pnpm test --coverage pour mesurer la couverture
- [ ] Executer pnpm mosaix doctor pour verifier l'architecture
- [ ] Executer pnpm check:conformance pour valider les contrats
- [ ] Inventaire des migrations applicables
- [ ] Audit des dependances (pnpm audit)
- [ ] Verifier l'etat du git (git status, git log)

### Critères d'acceptation
- [ ] pnpm check -> 0 erreur, 0 warning
- [ ] Couverture des tests > 60% (seuil minimum)
- [ ] Aucune dependance critique non corrigee
- [ ] Toutes les migrations applicables en ordre
- [ ] Aucune modification locale non committee non documentee

### Conditions de blocage
- [ ] pnpm check echoue -> corriger avant de continuer
- [ ] Dependance critique (CVSS > 7) -> patch ou exclusion documentee

## Phase 1 - Audit code et tests unitaires (J1-J14)

### Objectif
Valider la qualite du code source, la coherence des conventions, et la couverture des tests unitaires.

### Actions
- [ ] Analyse statique : eslint, tsc --noEmit, prettier --check
- [ ] Detecter le code mort (TODO, FIXME, throw not implemented)
- [ ] Detecter les dependances circulaires
- [ ] Analyser la complexite cyclomatique
- [ ] Couverture par BAC (cible > 80%)
- [ ] Tests unitaires P0 par domaine

### BACs critiques a tester
- [ ] commerce (workflow checkout complet)
- [ ] portfolio (cycle de vie proposal)
- [ ] citadelle (authentification)
- [ ] spaces (creation + modules)
- [ ] solidarity (allocation idempotente)
- [ ] beam (messaging + encryption E2E)
- [ ] booking (creneaux + reservations)
- [ ] solara (posts + commentaires + reactions)
- [ ] subscription (plans + renouvellement)
- [ ] inventory (minimal - prioritaire)

### Critères d'acceptation
- [ ] Couverture > 80% sur les 10 BACs complets
- [ ] 0 code mort detecte
- [ ] 0 dependance circulaire
- [ ] Tous les P0 testes

### Conditions de blocage
- [ ] Couverture < 60% -> ajouter tests avant continuer
- [ ] Code mort detecte -> supprimer ou documenter

## Phase 2 - Tests d'integration et bout-en-bout (J15-J30)

### Objectif
Valider les interactions entre modules, services, API, bases de donnees et systemes externes.

### Actions
- [ ] Tests d'integration par domaine (auth, commerce, portfolio, spaces, beam, solara, solidarity, booking, subscription)
- [ ] Tests de compatibilite multi-BDD (PostgreSQL + SQLite)
- [ ] Tests de migration (up, down, seed, from scratch)
- [ ] Tests E2E sur les flux critiques

### Scenarios d'integration P0
- [ ] Auth : login -> cookie -> accès protégé -> logout
- [ ] Commerce : creer offre -> publier -> acheter
- [ ] Portfolio : creer vendable -> proposal -> approbation -> publication
- [ ] Spaces : creer espace -> module -> composition
- [ ] Solidarity : incident -> besoin -> don -> allocation (idempotent)

### Critères d'acceptation
- [ ] Tous les scenarios d'integration P0 passent
- [ ] 0 échec sur les 2 configurations BDD
- [ ] Les migrations sont réversibles
- [ ] Les seeders produisent un état cohérent

### Conditions de blocage
- [ ] Échec integration P0 -> corriger avant continuer
- [ ] Migration non réversible -> bloquer

## Phase 3 - Audit sécurité et conformité (J31-J45)

### Objectif
Identifier les vulnérabilités résiduelles, valider les contrôles de sécurité, et vérifier la conformité.

### Actions
- [ ] Audit authentification et autorisation (cookies __Host-, sessions, BOLA/IDOR, permissions)
- [ ] Vérifier les 8 vulnérabilités SEC-01 (VULN-01 à VULN-08)
- [ ] Audit nouveau : scan dépendances, headers sécurité, injection SQL, XSS, CSRF, secrets, rate limiting, logging
- [ ] Conformité RGPD (anonymisation, droit à l'oubli, journalisation)
- [ ] Audit des dépendances (OSV)

### Tests de sécurité
- [ ] S-01 : Scan dépendances (pnpm audit)
- [ ] S-02 : Headers de sécurité manquants
- [ ] S-03 : Injection SQL (via QueryBuilder)
- [ ] S-04 : XSS dans les vues BAC (escapeHtml)
- [ ] S-05 : CSRF sur endpoints POST
- [ ] S-06 : Secrets exposés dans le code
- [ ] S-07 : Permissions filesystem (Dockerfile)
- [ ] S-08 : Rate limiting effectif
- [ ] S-09 : Logging événements sécurité
- [ ] S-10 : Chiffrement données sensibles

### Critères d'acceptation
- [ ] 0 vulnérabilité critique (CVSS > 7)
- [ ] 0 dépendance critique non corrigée
- [ ] Tous les contrôles de sécurité listés passent
- [ ] Conformité RGPD documentée

### Conditions de blocage
- [ ] Vulnérabilité critique -> bloquer jusqu'à correction
- [ ] Dépendance critique -> patch ou exclusion documentee

## Phase 4 - Tests performance et capacité (J46-J60)

### Objectif
Évaluer la capacité du système sous charge et identifier les goulots d'étranglement.

### Actions
- [ ] Tests de charge (statiques, API lecture, API écriture, auth, feed, checkout)
- [ ] Tests de stress (pic de charge, duration longue, concurrency)
- [ ] Tests de fuite mémoire (1h en boucle, 10000 requêtes)

### Seuils de performance
- [ ] p95 < 50ms pour les ressources statiques
- [ ] p95 < 200ms pour les APIs de lecture
- [ ] p95 < 500ms pour les APIs d'écriture
- [ ] Aucune dégradation > 10% sur 30 min
- [ ] Aucune fuite mémoire détectée
- [ ] Capacité minimale : 200 utilisateurs actifs simultanés

### Conditions de blocage
- [ ] Performance en dessous des seuils -> optimiser avant continuer
- [ ] Fuite mémoire -> corriger

## Phase 5 - Tests endurance, résilience, préproduction (J61-J90)

### Objectif
Valider la stabilité à long terme, la reprise après incident, et la préparation opérationnelle.

### Actions
- [ ] Tests d'endurance (7 jours service continu)
- [ ] Tests de résilience (coupure DB, Redis, réseau, redémarrage, saturation)
- [ ] Tests de reprise après incident (backup/restore, migration rollback, crash recovery)
- [ ] Préproduction (14 jours avec monitoring Prometheus + Grafana)

### Tests de résilience
- [ ] Coupure PostgreSQL -> mode dégradé (503)
- [ ] Coupure Redis -> fallback memory
- [ ] Coupure réseau -> retry + timeout
- [ ] Redémarrage serveur -> état conservé
- [ ] Saturation CPU -> pas de crash
- [ ] Saturation disque -> gestion propre

### Backup/restore
- [ ] pg_dump -> pg_restore -> données identiques
- [ ] Migration rollback -> schéma antérieur
- [ ] Redémarrage après crash kill -9

### Critères d'acceptation
- [ ] 7 jours sans panne
- [ ] Tous les tests de résilience passent
- [ ] Backup/restore vérifié
- [ ] Monitoring opérationnel avec alertes

### Conditions de blocage
- [ ] Panne durant endurance -> corriger et recommencer
- [ ] Backup/restore échoue -> bloquer

## Phase 6 - Audit final indépendant et décision GO/NO-GO (J91-J120)

### Objectif
Audit indépendant par une équipe externe ou un architecte non impliqué dans le développement.

### Actions
- [ ] Audit architecture (respect des ADR, pas de drift)
- [ ] Audit code (qualité, dettes techniques)
- [ ] Audit tests (couverture, pertinence)
- [ ] Audit sécurité (surface d'attaque, vulnérabilités)
- [ ] Audit ops (runbooks, monitoring, backup)

### Critères GO/NO-GO

| Critère | Seuil | Mesure |
|---------|-------|--------|
| Tests unitaires | > 80% coverage | vitest --coverage |
| Tests intégration | 0 échec | Phase 2 |
| Tests E2E | 0 échec | Phase 2 |
| Tests sécurité | 0 critique | Phase 3 |
| Tests performance | p95 < 500ms | Phase 4 |
| Tests endurance | 0 panne / 7j | Phase 5 |
| Tests résilience | 100% pass | Phase 5 |
| Backup/restore | Vérifié | Phase 5 |
| Documentation | Complète | .project/ |
| Runbooks | Disponibles | .project/knowledge/ |
| Anomalies ouvertes | 0 P0, 0 P1 | Registre |

### Décision
- [ ] GO : Tous les critères GO remplis
- [ ] NO-GO : ≥ 1 critérique non rempli
- [ ] GO conditionnel : Critères non-critiques + plan d'action approuvé

### Conditions de blocage
- [ ] Critère critique non rempli -> NO-GO

## Vérification continue

### Déclencheurs
- Chaque commit : Lint + Typecheck + Tests unitaires
- Chaque PR : pnpm check complet
- Chaque merge sur main : Tests intégration + sécurité
- Chaque release : Tests E2E + performance
- Chaque migration : Tests de migration
- Chaque correction critique : Tests de non-régression

### Gestion des tests instables
- Test faux positif : Marquer @skip + ticket
- Test intermittent : Isoler + ticket P1
- Test lent (> 5s) : Optimiser ou partitionner
- Test dépendant de l'ordre : Isoler avec beforeEach
- Test non automatisable : Documenter + revue manuelle

## Registre des anomalies

| Champ | Description |
|-------|-------------|
| ID | ANOM-YYYYMMDD-NNN |
| Titre | Description concise |
| Composant | Module/chemin |
| Gravité | P0 (bloquant) / P1 (critique) / P2 (majeur) / P3 (mineur) / P4 (info) |
| Probabilité | Faible / Moyenne / Élevée |
| Impact | Conséquences |
| Preuves | Logs, captures, traces |
| Conditions de reproduction | Étapes détaillées |
| Correction | Action proposée |
| Responsable | Assignation |
| Statut | Ouvert / En cours / Résolu / Fermé |
| Validation | Preuve de correction

## Plan d'action priorisé

### Immédiat (avant Phase 1)
- [ ] Exécuter pnpm check -> corriger les échecs
- [ ] Exécuter pnpm test --coverage -> mesurer la couverture
- [ ] Exécuter pnpm mosaix doctor -> corriger les avertissements
- [ ] Identifier les tests manquants par BAC

### Court terme (Phase 1-2)
- [ ] Ajouter les tests unitaires manquants (P0 : commerce, portfolio, citadelle, spaces, solidarity)
- [ ] Ajouter les tests d'intégration pour les 10 BACs
- [ ] Valider les migrations (up/down/seed)
- [ ] Corriger les dettes techniques identifiées (inventory, citadelle InMemory)

### Moyen terme (Phase 3-4)
- [ ] Audit sécurité complet (S-01 à S-10)
- [ ] Tests de charge et performance
- [ ] Tests de résilience

### Long terme (Phase 5-6)
- [ ] Tests d'endurance 7 jours
- [ ] Backup/restore vérifié
- [ ] Audit indépendant
- [ ] Décision GO/NO-GO

## Principales décisions à prendre

| # | Décision | Options | Recommandation |
|---|----------|---------|---------------|
| D1 | Seuil de couverture minimum | 60% / 70% / 80% | 80% pour les BACs critiques |
| D2 | Seuil de performance p95 | 300ms / 500ms / 1s | 500ms |
| D3 | Durée d'endurance | 3j / 7j / 14j | 7j |
| D4 | Audit indépendant | Interne / Externe | Externe pour les phases critiques |
| D5 | Gestion du mode demo en prod | Désactivé / Contrôlé | Désactivé (sécurité) |
| D6 | Priorité inventory BAC | Implémenter / Désactiver / Garder | Implémenter |

## Limites et inconnues

| # | Limitation | Impact | Solution |
|---|-----------|--------|----------|
| L1 | Aucune preuve de backup/restore réelle | Risque de perte de données | Exécuter test backup/restore |
| L2 | Aucune preuve de tests de charge | Performance inconnue | Phase 4 |
| L3 | Inventory BAC non implémenté | Fonctionnalité manquante | Phase 1-2 |
| L4 | Citadelle persistence InMemory | Données perdues au redémarrage | Backlog DB-BAC-OWNERSHIP |
| L5 | Pas de tests d'accessibilité | WCAG non vérifié | Ajouter si requis |
| L6 | Pas de tests de navigateurs multiples | Compatibilité inconnue | Ajouter si requis |

---
*Ce plan est une version initiale. Il doit être réévalué après chaque phase et ajusté en fonction des résultats obtenus et des risques émergents.*