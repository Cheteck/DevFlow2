# Audit Architecture Frontend & Rendu UI (Frontend Architecture)

- **Auteur :** Frontend Architecture Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Moteur de Rendu UI & UniTheme Engine

La couche de rendu de la plateforme MosaiX repose sur un moteur SSR/HTML réactif sur-mesure intégré dans `@mosaix/ui-runtime` et `ShellHtmlRenderer` (`src/shell/ui/shell-html-renderer.ts`).

### Caractéristiques Principales
- **Rendu Isomorphe / SSR :** Génération côté serveur du squelette HTML, injectant les variables CSS du thème (`--primary`, `--radius`), la grille réactive (Col-Span 1-12) et les scripts d'interaction côté client.
- **Support des Thèmes Sombre / Clair (`data-theme-mode`) :** Prise en charge native du basculement instantané de thème avec stockage du choix utilisateur via l'API `/api/theme`.
- **Intégration Tailwind CSS v4 :** Utilisation de la directive `@import "tailwindcss";` et de classes utilitaires modernes (`glass-card`, `glass-hover-glow`, `col-span-12`, `sm:col-span-8`).

---

## 2. Évaluation des Composants & Incohérences Structurelles

### Points Forts
- **Absence de Bibliothèques Lourdes Inutiles :** Utilisation judicieuse d'un rendu HTML/JS pur hautement performant, évitant le surpoids de bundles React/Virtual DOM pour la Shell Host.
- **Modulabilité des Modales & Tiroirs :** Le *Live Theme Customizer Drawer* et les menus déroulants de profil sont intégrés avec des transitions CSS fluides (`translate-x-full`, `transition-all`).

### Anti-Patterns et Dette Technique Observés
1. **Logique JavaScript Client Injectée en Inline String (`ShellHtmlRenderer`) :** Les scripts client (`publishPost()`, `updateBlockGridSpan()`, `toggleLiveBlockEditor()`) sont écrits sous forme de chaînes de caractères dans le code TypeScript du serveur.
   - *Impact :* Perte d'autcomplétion, absence de vérification TypeScript au build pour le JS navigateur, risque d'erreurs de syntaxe au runtime.
2. **Couplage du DOM avec les Identifiants Statiques (`id="composer-text"`, `id="feed-stream"`) :** La manipulation directe du DOM par `document.getElementById` rend difficile l'instanciation multiple d'un même widget sur la même page.

---

## 3. Plan de Transformation Frontend

```
  [ Impr. Code Frontend ] ────► [ Bundling Côté Client (Esbuild/Vite) ]
                                          │
                                          ▼
                                [ Tests de Typecheck JS Client ]
                                          │
                                          ▼
                                [ Zero-Inline Script Architecture ]
```

1. **Extraction des Scripts Client (`/src/client/bundle.ts`) :** Extraire les fonctions JS clientes hors des templates strings vers un fichier source TypeScript dédié compilé avec Vite/Esbuild.
2. **Adoption de Web Components ou Custom Elements :** Encapsuler les widgets complexes (ex: `<solara-composer>`, `<imperia-context-switcher>`) sous forme de Custom Elements HTML standard avec Shadow DOM optionnel.
3. **Standardisation des Interfaces de Composants Partagés :** Uniformiser les props et contrats des conteneurs de cartes (`card`, `glass`, `flat`, `bordered`) via des tokens UniTheme.
