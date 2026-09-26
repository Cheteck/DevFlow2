# Responsabilites — src/assets

| Champ | Valeur |
|---|---|
| Chemin | `src/assets/` |
| Couche | Actifs statiques (src/) |

## Raison d'etre

Images et assets servis par le shell/serveur (public/). Aucun code.

## Responsabilites

- Ce module regroupe le code indique ci-dessus ; toute evolution doit viser sa migration vers l'architecture cible (apps/*, packages/*, gateway) plutot que son extension.

## Non-responsabilites

- Ne pas y ajouter de nouveau domaine metier.

## Criteres de sante

- [ ] Aucune nouvelle dependance entrante hors shell/serveur.
- [ ] Couverture des resolveurs (`resolve-slot`, `resolve-tokens`) maintenue.
