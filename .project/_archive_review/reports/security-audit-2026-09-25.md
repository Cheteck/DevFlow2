# Rapport d'Audit de Sécurité & Recherche de Vulnérabilités MosaiX
**Date :** 25 Septembre 2026  
**Auditeur :** Autonomous Engineering Steward  
**Portée :** Runtime Server (`src/start.ts`, `src/server/`), Gateway (`packages/gateway/`), Shell (`src/shell/`), Adaptateurs & BACs  
**Référentiels :** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), CWE/SANS Top 25

---

## Synthèse Exécutive

L'audit de sécurité approfondi du code source de la plateforme MosaiX a identifié **8 vulnérabilités distinctes**, réparties en 3 niveaux de criticité :
- 🔴 **3 Vulnérabilités Critiques (High / Critical)** : Élévation de privilèges sans authentification, IDOR sur la suppression de compte RGPD, et contournement d'autorisation par usurpation d'en-tête HTTP.
- 🟠 **3 Vulnérabilités Majeures (Medium / High)** : Falsification d'événements de paiement PSP, génération de tokens non cryptographique, et contournement d'IP rate-limiting par spoofing d'en-tête.
- 🟡 **2 Vulnérabilités Modérées (Low / Medium)** : Déni de service par saturation mémoire (corps de requêtes non plafonnés) et absence de validation d'entrée sur l'avatar du profil.

---

## 1. Tableau Récapitulatif des Vulnérabilités

| Réf | Intitulé | CWE / OWASP | Gravité | Composant Affecté |
| :--- | :--- | :--- | :---: | :--- |
| **VULN-01** | Profil Admin par Défaut & Élévation de Privilège arbitraire | CWE-287 / OWASP A01:2021 | 🔴 **Critique** | `src/start.ts` & `user-routes.ts` |
| **VULN-02** | BOLA / IDOR sur l'Effacement RGPD (`/api/user/gdpr-anonymize`) | CWE-639 / API1:2023 | 🔴 **Critique** | `src/server/routes/compliance-routes.ts` |
| **VULN-03** | Contournement d'Authentification par En-tête HTTP Spoofé | CWE-290 / OWASP A07:2021 | 🔴 **Critique** | `src/server/routes/maintenance-routes.ts` |
| **VULN-04** | Contournement de Vérification de Signature Webhook PSP | CWE-347 / OWASP A02:2021 | 🟠 **Élevé** | `src/shell/psp-webhook-handler.ts` |
| **VULN-05** | Codes d'Autorisation PKCE Prédictibles & Méthode `plain` | CWE-330 / OAuth 2.1 | 🟠 **Élevé** | `src/server/routes/mobile-routes.ts` |
| **VULN-06** | Contournement de Rate-Limiter via `X-Forwarded-For` | CWE-290 / API4:2023 | 🟠 **Élevé** | `packages/gateway/src/gateway.ts` |
| **VULN-07** | Risque de Déni de Service (DoS) par Corps HTTP Non Plafonné | CWE-400 / API8:2023 | 🟡 **Moyen** | `src/server/routes/*` |
| **VULN-08** | Inactivation du `SecurityGuard` au Démarrage Serveur | CWE-1188 / OWASP A05:2021 | 🟡 **Moyen** | `src/start.ts` & `security-guard.ts` |

---

## 2. Analyse Détaillée des Vulnérabilités

### 🔴 VULN-01 : Profil Admin par Défaut & Élévation de Privilège Arbitraire
* **Fichiers :** `src/start.ts` (l. 110-111), `src/server/routes/user-routes.ts` (l. 17-30)
* **Description :**
  1. Si un utilisateur accède à l'application sans cookie de session, le code applique par défaut le profil `"admin"` :
     ```ts
     const activeRole = cookies["mosaix_role"] || "admin";
     const currentUser: UserProfile = USER_PROFILES[activeRole] || USER_PROFILES["admin"];
     ```
  2. L'endpoint `/api/user/switch?role=admin` ne requiert aucune vérification préalable et positionne un cookie non signé `mosaix_role=admin`.
* **Impact :** Tout visiteur anonyme dispose des privilèges administrateur complets sur l'ensemble des modules (Imperia, Citadelle, Commerce, etc.).
* **Remédiation recommandée :**
  - Remplacer le rôle par défaut par `guest` ou `member` restreint.
  - Sécuriser l'authentification avec un JWT signé cryptographiquement ou un cookie de session opaque adossé au port `SessionStore`.
  - Restreindre `/api/user/switch` aux seuls environnements de test / prévisualisation de développement (`NODE_ENV !== "production"`).

---

### 🔴 VULN-02 : BOLA / IDOR sur l'Anonymisation RGPD (`/api/user/gdpr-anonymize`)
* **Fichier :** `src/server/routes/compliance-routes.ts` (l. 32-48)
* **Description :**
  L'endpoint HTTP `POST /api/user/gdpr-anonymize` accepte un identifiant arbitraire dans le corps JSON :
  ```ts
  const data = JSON.parse(bodyStr || "{}");
  const targetUserId = data.userId || currentUser.id;
  const result = await anonymizationOrchestrator.anonymizeUser(targetUserId);
  ```
  Aucune vérification n'est effectuée pour s'assurer que `currentUser.id === targetUserId` ou que l'utilisateur dispose du rôle d'administrateur de conformité.
* **Impact :** N'importe quel utilisateur (ou visiteur) peut déclencher la suppression irréversible des identités, identifiants, tokens et sessions de n'importe quel autre utilisateur (y compris l'administrateur).
* **Remédiation recommandée :**
  - Restreindre l'anonymisation à l'utilisateur courant (`targetUserId = currentUser.id`), sauf si `currentUser.role === "admin"` et que la permission `compliance:admin:manage` est explicitement présente.

---

### 🔴 VULN-03 : Contournement d'Autorisation par En-tête HTTP Spoofé (`X-Mosaix-Role`)
* **Fichier :** `src/server/routes/maintenance-routes.ts` (l. 27-31)
* **Description :**
  Le contrôle d'accès sur le basculement du mode maintenance autorise la requête si un en-tête HTTP client correspond à une chaîne statique :
  ```ts
  const isAllowed =
    maintenanceService.isUserBypassed(currentUser?.role, currentUser?.permissions) ||
    req.headers["x-mosaix-role"] === "platform-admin" ||
    currentUser?.role === "admin";
  ```
* **Impact :** Tout attaquant externe peut activer ou désactiver le mode maintenance de la plateforme entière en injectant simplement l'en-tête `X-Mosaix-Role: platform-admin` dans sa requête HTTP.
* **Remédiation recommandée :**
  - Supprimer impérativement la clause `req.headers["x-mosaix-role"] === "platform-admin"` ou vérifier une signature cryptographique / clé d'API inter-services gérée côté infrastructure.

---

### 🟠 VULN-04 : Falsification d'Événements de Paiement PSP (Webhook Signature Bypass)
* **Fichier :** `src/shell/psp-webhook-handler.ts` (l. 61-64)
* **Description :**
  La condition de vérification stricte de la signature du webhook PSP est formulée ainsi :
  ```ts
  const requireStrictSignature = Boolean(process.env.PSP_WEBHOOK_SECRET) || process.env.NODE_ENV === "production" || Boolean(signatureHeader);
  const isValid = this.verifySignature(bodyStr, signatureHeader, webhookSecret);

  if (requireStrictSignature && !isValid) {
    sendProblemResponse(res, 401, "Invalid Signature", ...);
    return;
  }
  ```
  Si `PSP_WEBHOOK_SECRET` n'est pas défini dans l'environnement et que `NODE_ENV !== "production"`, une requête envoyée **sans aucun en-tête de signature** rend `requireStrictSignature = false`. Le bloc de rejet `if` est contourné.
* **Impact :** Injection d'événements factices `payment_intent.succeeded` sans signature valide, validant des commandes d'e-commerce frauduleuses sans paiement réel.
* **Remédiation recommandée :**
  - Exiger systématiquement la présence et la validité de l'en-tête de signature, même en environnement de développement (en utilisant une clé de test documentée).

---

### 🟠 VULN-05 : Entropie Faible sur les Codes PKCE & Méthode `plain` Non Conforme
* **Fichier :** `src/server/routes/mobile-routes.ts` (l. 106, 114)
* **Description :**
  1. Génération du code d'autorisation via le PRNG non cryptographique de V8 :
     ```ts
     const code = `auth_code_${Math.random().toString(36).substring(2, 12)}`;
     ```
  2. Acceptation de la méthode `plain` (`code_challenge_method: "plain"`), explicitement bannie par la spécification OAuth 2.1 (RFC 7636).
* **Impact :** Prédictibilité potentielle des codes d'autorisation temporaires et risque d'interception de tokens d'accès sur les canaux non chiffrés.
* **Remédiation recommandée :**
  - Utiliser `crypto.randomBytes(32).toString("hex")`.
  - Forcer la méthode `S256` (SHA-256) et rejeter les demandes avec `plain`.

---

### 🟠 VULN-06 : Évasion du Rate-Limiter via Spoofing de `X-Forwarded-For`
* **Fichier :** `packages/gateway/src/gateway.ts` (l. 127)
* **Description :**
  ```ts
  const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? ctx.req.socket.remoteAddress ?? "127.0.0.1";
  ```
  Le premier élément de l'en-tête `X-Forwarded-For` est directement contrôlé par le client émetteur.
* **Impact :** Un attaquant peut automatiser des attaques par force brute contre l'API d'authentification en variant l'en-tête `X-Forwarded-For: 10.0.X.X` à chaque requête sans jamais déclencher l'erreur HTTP 429.
* **Remédiation recommandée :**
  - N'accepter `X-Forwarded-For` que si la requête provient d'un proxy inverse de confiance (`trustProxy = true`), ou utiliser l'IP de la socket distante (`socket.remoteAddress`).

---

### 🟡 VULN-07 : Risque de Déni de Service (DoS) par Corps HTTP Non Plafonné
* **Fichiers :** `src/server/routes/auth-routes.ts`, `feed-routes.ts`, `maintenance-routes.ts`, etc.
* **Description :**
  Lecture du flux HTTP asynchrone sans limitation de taille maximale (`maxBodySize`) :
  ```ts
  let bodyStr = "";
  for await (const chunk of req) {
    bodyStr += chunk;
  }
  ```
* **Impact :** Envoi d'un flux HTTP infini ou de plusieurs gigaoctets provoquant un épuisement de la mémoire tampon Node.js (Out Of Memory / Crash du serveur).
* **Remédiation recommandée :**
  - Définir une fonction utilitaire `readLimitedBody(req, maxBytes = 1_048_576)` coupant la connexion avec un code HTTP 413 (Payload Too Large).

---

### 🟡 VULN-08 : Inactivation du `SecurityGuard` au Démarrage
* **Fichier :** `src/start.ts`
* **Description :**
  La classe `SecurityGuard` (présente dans `src/shell/security-guard.ts`), conçue pour vérifier l'entropie des secrets JWT et imposer l'arrêt en cas de configuration dangereuse, n'est jamais importée ni appelée dans le point d'entrée `src/start.ts`.
* **Remédiation :**
  - Appeler `SecurityGuard.enforceProductionConstraints()` immédiatement au début de l'exécution de `src/start.ts`.

---

## 3. Plan d'Action Recommandé

```
PHASE 1 (Correctifs Immédiats - Sécurité Critique)
  ├── 1. Supprimer l'usurpation d'en-tête 'x-mosaix-role' dans maintenance-routes.ts.
  ├── 2. Restreindre l'anonymisation RGPD à l'utilisateur authentifié (ou admin).
  ├── 3. Sécuriser la génération des codes PKCE avec crypto.randomBytes et bannir 'plain'.
  └── 4. Remplacer le rôle par défaut 'admin' dans start.ts par 'member'.

PHASE 2 (Durcissement Infrastructure)
  ├── 1. Plafonner la taille des requêtes HTTP entrantes (limite 1 Mo).
  ├── 2. Valider strictement la présence de signatures sur les webhooks PSP.
  └── 3. Raccorder SecurityGuard.enforceProductionConstraints() dans start.ts.
```
