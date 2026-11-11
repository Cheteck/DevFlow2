---
name: slop-check
description: Skill Agent de qualification et revue contextuelle du Slop Checker (PRD-0012)
skill_api_version: 1
---

# Skill Agent : `slop-check`

## 1. Description & Objectifs

Le Skill Agent **`slop-check`** agit comme un auditeur de qualité automatisé pour le projet MosaiX. Il interprète les résultats déterministes produits par la commande `pnpm mosaix check:slop --format=json`, qualifie les findings (vrai positif vs faux positif), et guide la remédiation avant tout commit ou Pull Request.

---

## 2. Déclencheurs (Triggers)

- **Avant chaque commit ou PR** : Vérification automatique du périmètre modifié (`--scope=diff`).
- **Post-implémentation agent** : Audit du code produit après une vague de modifications.
- **Requête utilisateur directe** : Demande explicite (« Exécute le slop check »).

---

## 3. Workflow Opérationnel (Protocole à 4 Étapes)

### Étape 1 : Exécution de l'Analyse
Exécuter la commande CLI en format JSON :
```bash
pnpm mosaix check:slop --scope=diff --format=json
```

### Étape 2 : Qualification des Findings
Pour chaque finding rapporté dans le JSON :
1. **Distinguer le vrai du faux positif** :
   - *Vrai Positif* : Violation réelle des règles de qualité MosaiX (ex: `Math.random()` dans du code de production, `TODO` sans numéro de ticket).
   - *Faux Positif / Exception Légitime* : Utilisation justifiée dans un script CLI ou un adapteur spécifique.
2. **Proposer une remédiation minimale** :
   - Proposer la correction exacte du code source (ex: remplacer `Math.random()` par `crypto.randomUUID()`).
   - Si une exception est légitime, proposer une entrée ciblée dans `.slop.json` avec `ruleId`, `path` et `reason`.

### Étape 3 : Règle d'Or (Interdictions Strictes)
- ❌ **Interdiction de blanchiment aveugle** : Ne JAMAIS ajouter une règle complète en `off` ou créer une allowlist globale pour masquer des erreurs.
- ❌ **Interdiction de correction silencieuse** : Ne pas modifier le code sans rapport clair expliquant la correction.

### Étape 4 : Restitution du Verdict
Émettre un verdict explicite :

| Verdict | Condition | Action requise |
|---|---|---|
| **`PASS`** | 0 erreur P0, 0 avertissement P1 non qualifié. | Prêt pour commit / PR. |
| **`WARN`** | 0 erreur P0, mais présence d'avertissements P1 à surveiller. | Passer en revue avant merge. |
| **`FAIL`** | Au moins 1 erreur P0 bloquante ou échec d'exécution Git/config. | **Bloquant**. Corriger avant commit. |

---

## 4. Exemple de Restitution

```markdown
### 🛡️ Rapport de Revue Slop-Check

- **Fichiers analysés** : 8
- **Erreurs P0** : 1 (bloquant)
- **Avertissements P1** : 1

#### 🚨 Findings Qualifiés

1. **`SLOP-P0-02` (no-untracked-todo)** dans `apps/commerce/src/domain/order.service.ts:42`
   - *Message* : TODO orphelin détecté : `// TODO: fix price calculation`.
   - *Remédiation* : Ajouter une référence issue/ticket : `// TODO(#204): fix price calculation`.

2. **`SLOP-P1-03` (no-explicit-any)** dans `packages/core/src/kernel.ts:108`
   - *Message* : Type `any` explicite.
   - *Remédiation* : Remplacer par `unknown` ou déduire le type générique.

**Verdict Final** : ❌ **`FAIL`** — Veuillez corriger le TODO orphelin pour valider le check.
```
