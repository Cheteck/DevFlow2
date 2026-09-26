# Responsabilites — src/server

| Champ | Valeur |
|---|---|
| Chemin | `src/server/` |
| Couche | Entree serveur historique (src/) |

## Raison d'etre

Dispatcher API + middlewares + routes + utils : point d'entree `start`/`serve` historique avant gateway/kernel. A rationaliser vers apps + gateway.

## Responsabilites

- Ce module regroupe le code indique ci-dessus ; toute evolution doit viser sa migration vers l'architecture cible (apps/*, packages/*, gateway) plutot que son extension.

## Non-responsabilites

- Ne pas y ajouter de nouveau domaine metier.

## Criteres de sante

- [ ] Aucune nouvelle dependance entrante hors shell/serveur.
- [ ] Couverture des resolveurs (`resolve-slot`, `resolve-tokens`) maintenue.
