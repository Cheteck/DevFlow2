# Rapport d'existant et recommandations d'amélioration du serveur MCP ChatGPT Web

## 1. Structure du projet
- **Entrée principale** : `server.js`
- **Outils MCP** : `tools/legacy.tools.js`, `tools/conversation.tools.js`
- **Services** : `services/conversation.service.js`
- **Repositories** : `repositories/conversation.repository.js`
- **Base de données SQLite** : initialisée via `database/migrate.js`
- **Configuration** : `config/index.js`
- **Scripts de démarrage** : `start-chatgpt-web.ps1`, `scripts/start-chatgpt-web.mjs`

## 2. Fonctionnalités actuelles
- Création, sélection, archivage de conversations stockées localement.
- Envoi de prompts et récupération des réponses via Playwright.
- Gestion d'un **unique** état de conversation active (`busy`).
- Vérification du statut du navigateur Chrome.

## 3. Points à améliorer (prioritaires)
1. **Gestion multi‑onglets / multi‑conversation**
   - Actuellement, le serveur ne gère qu'une seule conversation active.
   - Proposer un modèle **Conversation ↔ Onglet** avec persistance des IDs.
   - Ajouter une table `browser_tabs` pour mapper chaque conversation à un onglet Chrome.
2. **Centralisation du navigateur**
   - Créer un *Browser Manager* qui encapsule la connexion CDP, la création/fermeture d’onglets et la santé du navigateur.
3. **Fiabilité de la capture des réponses**
   - Implémenter une logique de stabilisation du texte (ex. délai de stabilité + vérification du bouton d’arrêt).
   - Enrichir les métadonnées de chaque message (timestamps, durée, statut).
4. **Gestion des erreurs & retries**
   - Définir des classes d’erreurs spécifiques et un mécanisme de retry contrôlé.
5. **Verrouillage par conversation**
   - Introduire un lock asynchrone afin d’éviter les accès concurrents à la même page.
6. **Extension du schéma SQLite**
   - Tables supplémentaires : `browser_tabs`, `messages`, `browser_sessions`, `operation_logs`.
   - Indexation sur `conversation_id` et `chrome_tab_id`.
7. **Réorganisation du code**
   - Organiser le projet en sous‑répertoires `services/browser`, `services/chatgpt`, `tools/message`, etc.
   - Ajouter des utilitaires de journalisation et de retry.

## 4. Prochaines étapes suggérées
- Implémenter la table `browser_tabs` et les migrations correspondantes.
- Introduire le **Browser Manager** (`services/browser/browser.manager.js`).
- Refactoriser les outils MCP pour accepter un `conversationId` et/ou `tabId` en entrée.
- Ajouter le verrouillage par conversation.
- Mettre à jour les tests unitaires et d’intégration.
- Déployer les changements sur une branche dédiée et valider avec le pipeline CI.

---
*Ce rapport a été généré automatiquement à la demande du développeur.*