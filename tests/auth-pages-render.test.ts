/**
 * tests/auth-pages-render.test.ts — Rendu HTML des pages auth (sécurité, accessibilité, structure).
 *
 * Vérifie :
 * - Absence de XSS (pas d'innerHTML avec données utilisateur)
 * - Formulaire en POST (pas de MDP dans l'URL)
 * - `<noscript>` présent
 * - Pas de `onclick=` inline dans le DOM des pages auth (le shell commun
 *   contient des `onclick` legacy hors périmètre de cette refonte)
 * - Zones tactiles ≥ 44px
 * - Liens conditionnels (recovery, CGU, confidentialité)
 * - Échappement `safeNext` dans les scripts (`</script>` neutralisé)
 * - Absence d'affirmations non vérifiables dans la colonne éditoriale
 */

import { describe, expect, it } from "vitest";
import { renderLoginPage, renderRegisterPage } from "../src/shell/pages/auth-pages.js";

const SHARED_STYLES = "<style>/* test */</style>";

/** Extrait la région <form>…</form> du HTML rendu (le reste est le shell commun). */
function formRegion(html: string): string {
  const start = html.indexOf("<form");
  const end = html.indexOf("</form>");
  return start >= 0 && end >= 0 ? html.slice(start, end + 7) : html;
}

/** Extrait la colonne éditoriale <aside>…</aside> du HTML rendu. */
function editorialRegion(html: string): string {
  const start = html.indexOf("<aside");
  const end = html.indexOf("</aside>");
  return start >= 0 && end >= 0 ? html.slice(start, end + 8) : html;
}

describe("renderLoginPage", () => {
  it("rend un formulaire avec method=\"post\"", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(formRegion(html)).toContain('method="post"');
    expect(formRegion(html)).not.toContain('method="get"');
  });

  it("inclut un bloc <noscript>", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript est requis");
  });

  it("n'a pas de onclick= inline dans le DOM de la page", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    // Le shell commun (mobile drawer, user menu) porte des onclick legacy
    // hors périmètre de cette refonte : on borne la vérification au form
    // et à la colonne éditoriale.
    expect(formRegion(html)).not.toMatch(/onclick\s*=/i);
    expect(editorialRegion(html)).not.toMatch(/onclick\s*=/i);
  });

  it("a un toggle MDP avec aria-label et type=button", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('id="login-toggle-pwd"');
    expect(html).toContain('aria-label="Afficher le mot de passe"');
    expect(html).toMatch(/<button type="button" id="login-toggle-pwd"/);
  });

  it("a des inputs avec autocomplete correct", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('autocomplete="username"');
    expect(html).toContain('autocomplete="current-password"');
  });

  it("n'a pas de lien 'Mot de passe oublié' si recoveryHref absent", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).not.toContain("Mot de passe oublié");
  });

  it("a un lien 'Mot de passe oublié' si recoveryHref fourni", () => {
    const html = renderLoginPage({
      activeMode: "light",
      sharedStyles: SHARED_STYLES,
      safeNext: "/dashboard",
      recoveryHref: "/forgot-password",
    });
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Mot de passe oublié");
  });

  it("échappe safeNext contre l'injection </script> dans le script", () => {
    const malicious = "/dashboard</script><script>alert(1)</script>";
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: malicious });
    // Le littéral JSON ne doit pas contenir de `<` ni de `>` bruts
    // (le couple `</script>` permettrait de sortir du script).
    const idx = html.indexOf('A.safeNext("');
    const litEnd = html.indexOf('");', idx);
    const literal = html.slice(idx, litEnd);
    expect(literal).not.toContain("<");
    expect(literal).not.toContain(">");
    expect(literal).toContain("\\u003c");
  });

  it("a des zones tactiles ≥ 44px sur les liens et le bouton", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).toMatch(/min-h-\[48px\]/);
  });

  it("a un statut aria-live pour les annonces", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("n'a pas d'affirmations non vérifiables dans la colonne éditoriale", () => {
    const html = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    const editorial = editorialRegion(html);
    expect(editorial).not.toContain("Zero-Trust");
    expect(editorial).not.toContain("chiffrement TLS");
    expect(editorial).not.toContain("En ligne");
  });
});

describe("renderRegisterPage", () => {
  it("rend un formulaire avec method=\"post\"", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(formRegion(html)).toContain('method="post"');
  });

  it("inclut un bloc <noscript>", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain("<noscript>");
  });

  it("n'a pas de onclick= inline dans le DOM de la page", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(formRegion(html)).not.toMatch(/onclick\s*=/i);
    expect(editorialRegion(html)).not.toMatch(/onclick\s*=/i);
  });

  it("a un générateur de MDP", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain("Générer un mot de passe fort");
    expect(html).toContain('id="reg-gen-pwd"');
  });

  it("a une checklist MDP avec états textuels (aria)", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain("data-state");
    expect(html).toContain("satisfait");
    expect(html).toContain("non satisfait");
  });

  it("n'a pas de liens CGU/privacy si hrefs absents", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).not.toContain('href="#terms"');
    expect(html).not.toContain('href="#privacy"');
  });

  it("a des liens CGU/privacy si hrefs fournis", () => {
    const html = renderRegisterPage({
      activeMode: "light",
      sharedStyles: SHARED_STYLES,
      safeNext: "/dashboard",
      termsHref: "/terms",
      privacyHref: "/privacy",
    });
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it("échappe safeNext contre U+2028/2029 dans le script", () => {
    const malicious = "/dashboard\u2028alert(1)\u2029";
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: malicious });
    // Le littéral JSON ne doit pas contenir de caractères bruts U+2028/2029
    // (ils cassent un script JS en le terminant prématurément).
    expect(html).not.toContain("\u2028");
    expect(html).not.toContain("\u2029");
    // … et doit les contenir sous forme d'échappement.
    expect(html).toContain("\\u2028");
    expect(html).toContain("\\u2029");
  });

  it("a un toggle MDP avec aria-label et type=button", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toMatch(/<button type="button" id="reg-toggle-pwd"/);
    expect(html).toContain('aria-label="Afficher le mot de passe"');
  });

  it("a des labels flottants avec structure DOM correcte", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    // Ordre : input → label (sélecteur ~ exige que le label suive l'input)
    const inputIdx = html.indexOf('id="register-email"');
    const labelIdx = html.indexOf('for="register-email"');
    expect(inputIdx).toBeGreaterThan(0);
    expect(labelIdx).toBeGreaterThan(inputIdx);
  });

  it("n'injecte pas l'email dans le message 409 (XSS)", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).not.toMatch(/innerHTML\s*=.*email/i);
  });

  it("a une jauge de force avec 4 segments", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('id="reg-str-1"');
    expect(html).toContain('id="reg-str-2"');
    expect(html).toContain('id="reg-str-3"');
    expect(html).toContain('id="reg-str-4"');
  });

  it("a un nav avec aria-current pour l'onglet actif", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('<nav aria-label="Mode d\'accès"');
    expect(html).toContain('aria-current="page"');
  });

  it("a un checkbox CGU accessible avec aria-describedby", () => {
    const html = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/dashboard" });
    expect(html).toContain('id="reg-terms"');
    expect(html).toContain('aria-describedby="reg-terms-hint"');
    expect(html).toContain('aria-required="true"');
  });
});

describe("AuthPageOptions — liens conditionnels", () => {
  it("login : recoveryHref optionnel", () => {
    const sans = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/" });
    const avec = renderLoginPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/", recoveryHref: "/recover" });
    expect(sans).not.toContain("Mot de passe oublié");
    expect(avec).toContain("Mot de passe oublié");
  });

  it("register : termsHref/privacyHref optionnels", () => {
    const sans = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/" });
    const avec = renderRegisterPage({ activeMode: "light", sharedStyles: SHARED_STYLES, safeNext: "/", termsHref: "/t", privacyHref: "/p" });
    expect(sans).not.toContain('href="/t"');
    expect(avec).toContain('href="/t"');
  });
});
