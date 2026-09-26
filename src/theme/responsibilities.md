# Responsabilites — src/theme

| Champ | Valeur |
|---|---|
| Chemin | `src/theme/` |
| Couche | Resolution de theme coté shell (src/) |

## Raison d'etre

 resolve-slot + resolve-tokens (+ tests) : compilation tokens>CSS utilises par le shell ; pendant runtime du sous-systeme Theme (contracts/schemas/core).

## Responsabilites

- Ce module regroupe le code indique ci-dessus ; toute evolution doit viser sa migration vers l'architecture cible (apps/*, packages/*, gateway) plutot que son extension.

## Non-responsabilites

- Ne pas y ajouter de nouveau domaine metier.

## Criteres de sante

- [ ] Aucune nouvelle dependance entrante hors shell/serveur.
- [ ] Couverture des resolveurs (`resolve-slot`, `resolve-tokens`) maintenue.
