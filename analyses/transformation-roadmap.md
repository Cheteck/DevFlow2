# Feuille de Route de Transformation Platforme (Transformation Roadmap)

- **Auteur :** Transformation Architect & Principal Engineer
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Vision Cible & Objectifs Stratégiques

Passer de l'architecture actuelle (Monorepo avec composition SSR statique) à une **Plateforme Microfrontends Fédérée, Autonome et Hautement Résiliente** capable de supporter des dizaines d'équipes produit indépendantes.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Trajectoire de Transformation                    │
│                                                                        │
│   Phase 1 (0–30j)   : Stabilisation, CI/CD, Corrections P0             │
│   Phase 2 (30–90j)  : Microfrontends Fédérés & Import Maps             │
│   Phase 3 (3–6m)    : Isolation Shadow DOM & Sandboxing                │
│   Phase 4 (6–12m)   : Observabilité Avancée & Multi-Region               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Planning Détaillé par Horizontes Temporels

### Horizon 1 : 0 – 30 Jours (Stabilisation & Sécurité P0)
- [ ] **Correction des TSConfig Plugins & Conformité Vitest :** Réparer les 7 échecs de tests unitaires pour atteindre 100% de tests verts (587/587).
- [ ] **Workflow GitHub Actions CI/CD :** Créer `.github/workflows/ci.yml` pour bloquer les régressions sur Pull Request.
- [ ] **MFA Interceptor Guard (`Identity BAC`) :** Intercepter la délivrance du token JWT final si le challenge MFA à 6 chiffres n'est pas validé.
- [ ] **Verrou Atomique Postgres (`Booking BAC`) :** Prévenir les doubles réservations concurrentes.

### Horizon 2 : 30 – 90 Jours (Fédération & Découplage MFE)
- [ ] **Registre d'Import Maps Centralisé :** Déployer la découverte dynamique des bundles MFE distants sans recompilation du Shell Host.
- [ ] **Isolateurs d'Erreurs par Emplacement (Slot Error Boundaries) :** Entourer le rendu de chaque widget MFE UniTheme d'une gestion d'exception locale avec UI de repli.
- [ ] **Câblage Systématique Postgres/Redis au Boot :** Généraliser le boot d'adaptateurs réels pour l'Outbox et l'Identité en production.

### Horizon 3 : 3 – 6 Mois (Gouvernance & Industrialisation)
- [ ] **Sandboxing CSS / Custom Elements avec Shadow DOM :** Éviter les fuites de styles CSS entre plugins et widgets MFE.
- [ ] **Catalogue de Composants UniTheme Storybook :** Publier la documentation interactive des tokens et widgets du Design System.

### Horizon 4 : 6 – 12 Mois (Échelle & Résilience Globale)
- [ ] **Déploiement Multi-Région Cloud Run & Edge CDN Caching :** Servir les assets UniTheme et les API BACs au plus près des utilisateurs avec temps de réponse < 50ms.
