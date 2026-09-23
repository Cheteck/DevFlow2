# Mémoire : Propositions d'Amélioration du Serveur MCP & Intégration des Applications BAC

Date : 2026-09-20
Statut : Enregistré dans la mémoire technique du projet MosaiX.

---

## 1. Rappel des Propositions de Base (Gateway MCP)
- **Validation Zod** : Validation stricte des arguments d'outils et URIs de ressources.
- **Transport SSE Robuste** : Support complet du protocole Server-Sent Events pour les clients distants (Claude Desktop, etc.).
- **Sécurité RBAC & Rate Limiting** : Contrôle d'accès par rôle et limitation de débit par outil/principal.
- **Observabilité & Télémétrie** : Instrumentation des durées d'exécution et taux de succès par outil.

---

## 2. Analyse : Exposition des Outils MCP par les Applications BAC (`/apps/*`)

L'architecture MosaiX repose sur des **Business Applications & Containers (BAC)** autonomes et modulaires (Imperia, Solara, Beam, Booking, Commerce, Spaces, etc.). Actuellement, la gateway MCP expose des outils génériques ou centraux. 

Pour libérer tout le potentiel de l'IA et de l'interopérabilité, **chaque application BAC devrait s'enregistrer dynamiquement auprès du registre MCP central** en fournissant ses propres **Tools**, **Resources** et **Prompts** spécifiques à son domaine métier.

---

## 3. Propositions d'Amélioration & Architecture MCP par BAC

### A. Pattern d'Enregistrement Dynamique par les BAC
Chaque application BAC (ex: `apps/imperia`, `apps/commerce`, `apps/booking`) doit exporter un fournisseur MCP (`mcp-provider.ts` ou s'enregistrer via le conteneur DI) qui expose ses capacités :
- **Imperia (Gouvernance & Lois)** :
  - Outils : `imperia_create_bill`, `imperia_vote`, `imperia_audit_compliance`.
  - Ressources : `imperia://bills/active`, `imperia://governance/policies`.
- **Commerce (Boutique & Produits)** :
  - Outils : `commerce_create_order`, `commerce_check_stock`, `commerce_update_price`.
  - Ressources : `commerce://catalog/products`, `commerce://orders/recent`.
- **Booking (Réservations & Créneaux)** :
  - Outils : `booking_create_slot`, `booking_reserve`, `booking_cancel`.
  - Ressources : `booking://slots/available`.
- **Beam (Messagerie & Collaboration)** :
  - Outils : `beam_send_message`, `beam_list_channels`.
- **Spaces (Gestion de Fichiers & Stockage)** :
  - Outils : `spaces_upload_file`, `spaces_search_docs`.

### B. Découverte Automatique (Auto-Discovery Plugin Engine)
Le `ControlPlaneSupervisor` ou le `PluginManager` de MosaiX doit scanner au démarrage les applications BAC chargées et agréger leurs registres MCP respectifs dans le serveur MCP central sans couplage fort.

### C. Contextualisation Multi-Tenant & Isolation
Puisque MosaiX gère des identités de tenants et des contextes de sécurité stricts :
- Chaque appel d'outil MCP provenant d'un BAC doit être exécuté dans le contexte d'isolation et les permissions du locataire (`TenantIdentity`) courant.

### D. Prompts Domain-Specific (Workflows IA)
Permettre à chaque BAC d'injecter des templates de prompts pré-configurés pour guider les LLMs (ex: "Analyse cette proposition de loi Imperia et résume les impacts financiers Commerce").
