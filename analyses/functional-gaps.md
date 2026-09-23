# Audit Analyse des Lacunes Fonctionnelles (Functional Gap Analysis)

- **Auteur :** Functional Gap Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé (Basé sur les suites de tests Vitest, la matrice des BACs et l'inspection des flux)

---

## 1. Inventaire & Matrice des Gaps Fonctionnels par Categorie

### 1. Missing Capabilities (Capacités Absentes)
1. **Challenge MFA Interceptif Obligatoire (`Identity BAC`) :**
   - *Description :* Les endpoints `/identity/mfa/setup` et `/identity/mfa/verify` existent, mais le flux de connexion JWT ne bloque pas la session utilisateur lorsque le MFA est activé et non validé.
   - *Impact Business :* Risque de contournement du second facteur de sécurité par compromission de mot de passe.
   - *Effort :* S | *Priorité :* 🔴
2. **Gestionnaire de Webhook de Paiement Asynchrone (`Commerce BAC`) :**
   - *Description :* L'endpoint `/commerce/checkout/webhook` met à jour le statut en `PAID`, mais l'émission de la facture PDF et de la notification Outbox vers les autres BACs reste incomplète.
   - *Impact Business :* Perte de synchronisation comptable et absence de notification d'achat au client.
   - *Effort :* M | *Priorité :* 🟠

### 2. Business Coverage Gaps (Couverture Métier Incomplète)
1. **Système Anti-Double Réservation Atomique (`Booking BAC`) :**
   - *Description :* L'application `booking` effectue la vérification des créneaux en mémoire. En cas de requêtes simultanées, deux utilisateurs peuvent réserver le même créneau (Race Condition).
   - *Impact Business :* Insatisfaction client et litiges opérationnels.
   - *Effort :* M | *Priorité :* 🔴
2. **Filtrage et Recherche Textuelle Avancée (`Portfolio BAC`) :**
   - *Description :* L'endpoint `/portfolio/items` retourne la liste brute des produits sans possibilité de filtrer par sous-catégories ou tags multi-mots.
   - *Impact Business :* Expérience de navigation dégradée sur les catalogues volumineux.
   - *Effort :* S | *Priorité :* 🟡

### 3. User Journey Gaps (Parcours Utilisateur Incomplets)
1. **Saisie & Validation de Sondages Interactifs (`Solara BAC`) :**
   - *Description :* Le widget `solara:rich-post-composer-widget` affiche les champs de sondage, mais la soumission du vote par un abonné n'incrémente pas le compteur de voix en base Postgres.
   - *Impact Utilisateur :* Impression de bug ou de fonction factice pour l'utilisateur final.
   - *Effort :* S | *Priorité :* 🟠

---

## 2. Synthèse des Gaps Transversaux & Recommandations

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Matrice de Priorité des Gaps                       │
│                                                                        │
│   🔴 P0 / P1 (Bloquant / Sécurité)                                     │
│      ├── MFA Interceptif Guard                                         │
│      └── Booking Lock Transactionnel Atomique                          │
│                                                                        │
│   🟠 P2 (Moyenne / Expérience Métier)                                  │
│      ├── Webhook Commerce & Outbox Event                               │
│      └── Soumission de Sondage Solara                                  │
│                                                                        │
│   🟡 P3 (Optimisation)                                                 │
│      └── Recherche & Filtres Portfolio Catalog                             │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Prioriser la Correction des Gaps Sécurité (MFA Interceptor Guard) :** Bloquer la délivrance des tokens JWT finaux tant que le second facteur TOTP n'a pas été validé.
2. **Verrouillage Atomique Postgres (`Booking BAC`) :** Implémenter un verrou transactionnel `SELECT ... FOR UPDATE` sur la table des créneaux de réservation.
