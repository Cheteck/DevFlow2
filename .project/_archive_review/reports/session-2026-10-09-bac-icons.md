# Session 2026-10-09 — Icônes BAC manifest-driven (fin du hardcode)

## Objectif
Chaque BAC possède son icône, gérée optimalement et compatible MosaiX : source unique, contrat typé, validation, fallback tracé. Les audits exigeaient la suppression d'`APP_ICONS` depuis septembre.

## Changements
- `packages/contracts/.../application-experience.ts` : `appCard?: {title, icon, description?, showInNavigation?}` contracté. Syntaxe documentée : emoji brut | `material:<nom>` | fichier (`./`, `/`, `https://` + extension ico/png/jpg/svg/webp/gif). `javascript:`/`data:` rejetés.
- `src/shell/discovery.ts` : `parseBacIcon()` (validé/testé, préfixe insensible à la casse), `renderBacIcon()` (HTML échappé par kind : texte / span material / img em-sized lazy), `resolveManifestIcon()` (canonique + warn nommant le fautif), `FALLBACK_BAC_ICON`. Nav seedée depuis les manifests ; `showInNavigation !== false` remplace les exclusions en dur.
- `renderer.ts` (5 sites) + `bac-orchestrator.ts` (fallback) : interpolations via `renderBacIcon()`. `APP_ICONS` supprimé.
- Manifests : `subscription` + `inventory` déclarent `showInNavigation: false` (même comportement qu'avant, mécanisme déclaratif).
- Tests `discovery-icons.test.ts` (8) : matrice parsing/sécurité, HTML sûr, tous manifests valides, engine cachés, spot-checks, fallback.

## Changements visuels à valider (produit)
Manifests = vérité : spaces 📁→🪐, imperia →⚡ (l'ancien hardcode divergeait). Tout le reste identique.

## Validation
- 8/8 icons + 50/50 suites voisines (orchestrator, bac-access, ssr-auth, profiles, invariants) ; ESLint propre.

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`, aucun commit.
- Modifiés : `application-experience.ts`, `discovery.ts`, `renderer.ts`, `bac-orchestrator.ts`, 2 manifests. Nouveau : `discovery-icons.test.ts`, ce rapport.
- Rollback : `git checkout -- <modifiés>` + supprimer le test.
