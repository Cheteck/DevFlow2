# Responsabilites — plugin commerce-badge-plugin

| Champ | Valeur |
|---|---|
| Nom | `@mosaix-plugin/commerce-badge` |
| Version | `voir package.json` |
| Couche | Extension (Plan controle & extension) — hote : commerce |

## Raison d'etre

Badges produit (nouveau, promo, top-vente) — contribution UI + capability lue par commerce.

## Responsabilites

- Declarer le manifest plugin (id, hote, capabilities consommees/fournies, slots UI).
- Implementer le cycle du plugin-engine (DISCOVERED>...>ACTIVE) sans effet de bord hors sandbox.
- S'integrer a l'app hote uniquement via capabilities/evenements/slots (aucun import de l'app).
- Tester l'activation/desactivation propres (pas de fuite d'etat).

## Interactions

Charge par `PluginManagementService`, execute en `PluginSandbox`, dialogue avec l'app hote `commerce` via le modele de capabilities.

## Frontieres

- Aucune mutation de la memoire du core.
- Aucune dependance vers un autre plugin.

## Non-responsabilites

- Ne porte pas la logique coeur du domaine (elle reste dans l'app hote).
- Ne gere pas son propre serveur/routage.

## Criteres de sante

- [ ] Cycle de vie complet teste (load>active>disable>unload).
- [ ] Desinstallation sans residu.
