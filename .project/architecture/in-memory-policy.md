# Politique d'utilisation du stockage en mémoire (InMemoryGuard Policy)

## Objectif
Garantir qu'aucun stockage volatile (*in-memory*) n'est utilisé par défaut dans les environnements de production pour des données persistantes (utilisateurs, sessions, tokens, credentials, base de données), afin d'éviter la perte de données et d'assurer la haute disponibilité.

## Règles Fondamentales
1. **Interdiction en Production** : En mode production (`NODE_ENV === 'production'` ou `prod`), l'instanciation de répertoires ou stores en mémoire (*in-memory*) déclenche une exception critique bloquante (`[ProductionInvariantViolation]`), sauf si la variable d'environnement `ALLOW_IN_MEMORY_IN_PRODUCTION=true` est explicitement activée.
2. **Tolérance en Développement** : En mode développement ou test, l'utilisation d'adaptateurs en mémoire comme solution de repli (*fallback*) à défaut de configuration ou d'infrastructure persistante est tolérée, mais **doit obligatoirement émettre un signal d'avertissement visible** dans les logs du serveur de développement (`[MOSAIX DEV SERVER SIGNAL]`).

## Implémentation
Le mécanisme est centralisé dans `@mosaix/support` via la classe `InMemoryGuard`:
```ts
import { InMemoryGuard } from "@mosaix/support";
InMemoryGuard.reportFallback("ComponentOrRepositoryName");
```
