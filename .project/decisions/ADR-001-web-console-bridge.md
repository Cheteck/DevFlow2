# ADR-001: Bridge Web et Télémétrie pour le Command Center

## Statut
Accepted

## Contexte
Le `@mosaix/dev-server` expose ses diagnostics via un terminal (TUI). Un besoin d'une interface
Web complémentaire est apparu pour améliorer la visibilité et l'inspection. 
En outre, le besoin de monitorer l'état interne des composants critiques (Rate Limiters, queues) 
est devenu nécessaire pour le diagnostic de performance.

## Décision
Implémenter un **Bridge Web léger** (`Headless-to-Web`) avec support de **Live Telemetry**.

1.  **Architecture** : Le bridge consomme le `CommandCenterSnapshot` + un flux de **Telemetry Events** 
    (état des bacs, latence, métriques).
2.  **Transport** : WebSocket pour le flux bidirectionnel. JSONL (JSON Lines) pour la télémétrie 
    afin de minimiser l'impact CPU sur le serveur de dev.
3.  **Observabilité des Bacs (Telemetry)** : 
    - Exposer l'état des `RateLimiter` (remplissage, éviction).
    - Exposer les métriques des tampons (logs, événements).
    - Ces données seront transmises par différentiel (Delta Updates) pour optimiser la bande passante.
4.  **Sécurité** :
    - Binding strict `127.0.0.1`.
    - Token d'authentification temporaire pour l'accès.

## Conséquences
- **Observabilité** : Visualisation directe de la contention système (Rate Limiting).
- **Maintenance** : Nécessite une gestion rigoureuse du flux de données pour ne pas saturer le navigateur.
