# Responsabilites — plugin solara-content-moderator

| Champ | Valeur |
|---|---|
| Nom | `@mosaix-plugin/solara-content-moderator` |
| Version | `voir package.json` |
| Couche | Extension (Plan controle & extension) — hote : solara |

## Raison d'etre

Moderation de contenu (hooks pre-publication : spam, toxicite, regles) — ecoute evenements solara.post.create.

## Responsabilites

- Declarer le manifest plugin (id, hote, capabilities consommees/fournies, slots UI).
- Implementer le cycle du plugin-engine (DISCOVERED>...>ACTIVE) sans effet de bord hors sandbox.
- S'integrer a l'app hote uniquement via capabilities/evenements/slots (aucun import de l'app).
- Tester l'activation/desactivation propres (pas de fuite d'etat).

## Interactions

Charge par `PluginManagementService`, execute en `PluginSandbox`, dialogue avec l'app hote `solara` via le modele de capabilities.

## Frontieres

- Aucune mutation de la memoire du core.
- Aucune dependance vers un autre plugin.

## Non-responsabilites

- Ne porte pas la logique coeur du domaine (elle reste dans l'app hote).
- Ne gere pas son propre serveur/routage.

## Criteres de sante

- [ ] Cycle de vie complet teste (load>active>disable>unload).
- [ ] Desinstallation sans residu.
