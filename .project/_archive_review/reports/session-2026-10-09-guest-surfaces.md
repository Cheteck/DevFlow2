# Session 2026-10-09 — Surfaces guest verrouillées + analyse visibilité sidebar

## Contexte
Politique produit : hors commerce + parties lecture seule de spaces, rien d'accessible aux guests. Le test HTTP strict (`href="/beam"` absent) a révélé des fuites que le guard seul ne couvrait pas — toutes trouvées PAR LE CODE (renderer), pas devinées.

## Fuites trouvées et corrigées (toutes vérifiées dans `renderer.ts`)
1. **Mobile create sheet** (l.893) : 6 actions membres en dur (`/beam`, `/spaces?action=create`, `/portfolio?admin=new`, `/booking`, `/imperia`) rendues sur chaque page → guests : prompt login uniquement.
2. **Mobile notifications sheet** (l.987) : fausses notifs personnelles (`Éléonore…`, liens `/beam`/`/imperia`/`/booking`, badge `2 nouvelles`) → guests : état vide + login.
3. **Bottom nav** : badge `2` fabriqué + bouton `Compte` mort (`toggleUserDropdown` sans dropdown) → guests : pas de badge, bouton `Connexion` (`/login?next=`).
4. **CTA sidebar secondaire** (`getCtaConfig` + bouton) : `Voir mon Panier`, `Nouveau Space`… menaient à des 302 → guests : bouton `Se connecter` (`?next=` page courante).
5. **Avatar sidebar** : lien `/identity` inconditionnel → guests : `/login?next=`.
6. Détection unique : `isGuestProfile()` (id `guest`), jamais rôles/cookies/LS.

## Matrice de visibilité vérifiée (code + tests)
| Surface | Guest | Membre | Admin | Démo |
|---|---|---|---|---|
| Sidebar principale (icônes) | home, 🏪 commerce, spaces (+avatar→login) | tout sauf imperia/subscription/inventory | tout sauf subscription/inventory | comme le rôle persona |
| Tiroir mobile (apps) | commerce + spaces (+Accueil/Espaces génériques) | idem sidebar | idem + imperia | idem rôle |
| Sidebar secondaire (actions) | `Aucune action…` + CTA login | filtrées par permissions | + admin | idem rôle |
| Bottom nav | Accueil/Modules/Créer→login/Alertes sans badge/Connexion | complet | complet | complet |
| Sheets | prompts login | contenu réel | contenu réel | contenu réel |
| Palette ⌘K / inspecteur | **code mort** (jamais rendus par les pages) — à filtrer le jour du câblage | — | — | — |

Règle : visibilité = projection de `resolveBacAccess()` (`visibleBacIds` + `buildNavProfile` + flag manifest `navigable`) ; le guard reste l'unique enforcement. `subscription`/`inventory` : routes joignables, jamais en nav (moteurs).

## Validation
- 7/7 `guest-surfaces.test.ts` (nouveau, pur string, <1s) + 14/14 HTTP (2 boots PG réels).
- ESLint fichiers touchés : propre.
- Non régression : suites policy/ssr/resolver/auth-routes/profiles à relancer au merge (inchangées ici sauf renderer).

## Git State
- Modifiés : `renderer.ts` (6 zones), `guest-surfaces.test.ts` (nouveau), `bac-access.http.test.ts` (+assertions sidebar).
- Rollback : `git checkout -- src/shell/renderer.ts` + supprimer le test (les assertions HTTP strictes redeviennent 13/14).
