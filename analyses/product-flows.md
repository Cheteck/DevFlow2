# Audit Flux Produit & Parcours Utilisateurs (Product Flows Audit)

- **Auteur :** Product Flow Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Cartographie des Parcours Métier Clés

L'application rassemble 5 flux produit majeurs inter-connectés :

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Parcours Utilisateurs Clés                       │
│                                                                        │
│  1. Authentification & Profil  ──► /identity/login /identity/mfa       │
│  2. Flux Social & Publication   ──► /solara/feed /solara/posts          │
│  3. Tunnel d'Achat & Offres    ──► /commerce/orders /commerce/webhook   │
│  4. Espace Collaboratif & Docs ──► /spaces /spaces/members             │
│  5. Vote & Gouvernance         ──► /imperia/ballots /imperia/context   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Analyse des Ruptures dans les Workflows

### 1. Workflow Authentification → Session → MFA
- **Parcours Attendu :** Connexion JWT → Détection MFA requis → Challenge Code TOTP → Accès Shell.
- **État Constaté :** L'authentification JWT fonctionne et le composant IHM pointe vers les settings, mais le tunnel de login n'interrompt pas encore la session si le MFA est obligatoire sur l'organisation.

### 2. Workflow Commerce → Commande → Webhook
- **Parcours Attendu :** Panier → Création Commande (`PENDING`) → Paiement externe → Webhook (`payment_intent.succeeded`) → Commande `PAID` → Notification Solara/Beam.
- **État Constat :** Le Webhook `/commerce/checkout/webhook` a été implémenté et passe la commande à `PAID`. La notification vers Solara/Beam doit être automatisée via l'Outbox Message Bus.

---

## 3. Actions d'Optimisation des Parcours Produit

1. **Automation du Tunnel MFA Interceptif (`Identity Guard`) :** Forcer la redirection vers le challenge MFA si `user.mfaEnabled == true` avant d'accorder le token d'accès final.
2. **Notification Transversale de Succès de Commande :** Émettre un événement domaine `OrderPaidEvent` capturé par Solara pour publier automatiquement une badge de badge "Acheteur Vérifié" dans le fil d'actualité.
