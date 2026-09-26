# Responsabilites — src/shell

| Champ | Valeur |
|---|---|
| Chemin | `src/shell/` |
| Couche | Shell applicatif (src/) |

## Raison d'etre

Composition runtime historique : discovery, registre dynamique de BACs, composition-loader, event-backplane, feature-flags, feed-service, anonymisation, editeur, actions contextuelles, bootstrap DB.

## Responsabilites

- Ce module regroupe le code indique ci-dessus ; toute evolution doit viser sa migration vers l'architecture cible (apps/*, packages/*, gateway) plutot que son extension.

## Non-responsabilites

- Ne pas y ajouter de nouveau domaine metier.

## Criteres de sante

- [ ] Aucune nouvelle dependance entrante hors shell/serveur.
- [ ] Couverture des resolveurs (`resolve-slot`, `resolve-tokens`) maintenue.
