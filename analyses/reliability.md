# Audit Résilience, Fiabilité & Observabilité (Reliability Audit)

- **Auteur :** Reliability Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Tolérance aux Pannes & Degraded Mode Strategy

### Mécanismes de Résilience Implémentés
1. **Fallbacks de Persistance BDD / Caching :** Si Redis n'est pas disponible, le composant `resolveIdentityStores()` bascule automatiquement sur un magasin en mémoire avec un message d'avertissement explicite.
2. **Gestion des Outbox Messages :** Le démon Outbox (`OutboxWorker`) gère les réessais en cas d'échec d'envoi vers Kafka/RabbitMQ.
3. **Resilience Middleware & Rate Limiting :** Le Gateway incorpore `RateLimiter` avec fallback mémoire et `SecurityHeadersMiddleware`.

---

## 2. Observabilité & Télémétrie OTLP / Prometheus

### Capteurs d'Observabilité Présents
- **Route `/metrics` (Prometheus) :** Expose les métriques système dynamiques (temps de réponse HTTP, taux d'erreurs 4xx/5xx, utilisation mémoire process, nombre de requêtes composées UniTheme).
- **Exportateur Traces OTLP (`OTLPTraceExporter`) :** Enregistre la durée de chaque étape de requête HTTP et flushe les traces OpenTelemetry lors du shutdown gracieux (`process.on('SIGTERM')`).

---

## 3. Points Faibles de Résilience & Points Uniques de Défaillance (SPOF)

1. **Pas de Circuit Breakers Isolés sur les Endpoints BAC :** Si le contrôleur de l'application `solidarity` ou `booking` subit une latence élevée ou une boucle infinie, il peut bloquer la boucle d'événements Node.js (Event Loop) pour l'ensemble du serveur Shell.
2. **Absence de Health-Check Liveness/Readiness Séparé :** La route `/health` ou `/ready` n'effectue pas un ping réel vers la base PostgreSQL et Redis avant de retourner `HTTP 200`.

---

## 4. Recommandations de Fiabilité

1. **Mise en Place de Probes K8s / Cloud Run (`/health/live` et `/health/ready`) :**
   - Implémenter une vérification active de la connectivité Postgres, Redis et du bus Outbox dans l'endpoint de readiness.
2. **Circuit Breaker par BAC (`@mosaix/security`) :**
   - Encapsuler chaque appel de contrôleur MFE dans un pattern Circuit Breaker réactif pour basculer en mode dégradé si le taux d'erreur dépasse 50%.
