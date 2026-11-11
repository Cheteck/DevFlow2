import { describe, expect, it } from "vitest";
import {
  normalizeProductOptions,
  validateProductOptions,
  validateConfiguration,
  groupsToOptionsBlock,
  optionsBlockToGroups,
} from "./product-options.js";

describe("product options (gestion des options produit)", () => {
  it("normalise codes et valeurs (premier ecrit gagne)", () => {
    const out = normalizeProductOptions([
      { code: " Color ", values: [{ value: "Black " }, { value: "black" }, { value: "" }] },
      { code: "COLOR", values: [{ value: "Red" }] },
      { code: "!!!", values: [{ value: "x" }] },
    ]);
    expect(out.map((g) => g.code)).toEqual(["color"]);
    expect(out[0]?.values.map((v) => v.value)).toEqual(["Black"]);
    expect(out[0]?.label).toBe("color");
  });

  it("valide structure, doublons, cles commerciales et references", () => {
    expect(validateProductOptions([])).toEqual([]);
    expect(
      validateProductOptions([{ code: "", values: [{ value: "x" }] }])[0],
    ).toMatch(/code manquant/);
    expect(
      validateProductOptions([
        { code: "color", values: [{ value: "Black" }] },
        { code: "COLOR", values: [{ value: "Red" }] },
      ]).join(" "),
    ).toMatch(/duplique/);
    expect(
      validateProductOptions([{ code: "color", values: [] }]).join(" "),
    ).toMatch(/au moins une valeur/);
    expect(
      validateProductOptions([{ code: "price", values: [{ value: "x" }] }]).join(
        " ",
      ),
    ).toMatch(/portee commerciale/);
    expect(
      validateProductOptions([
        {
          code: "color",
          values: [{ value: "Black", incompatibleWith: ["Nope"] }],
        },
      ]).join(" "),
    ).toMatch(/inconnue/);
    expect(
      validateProductOptions([
        {
          code: "color",
          values: [
            { value: "Black", incompatibleWith: ["color:White"] },
            { value: "White" },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("valide une configuration contre groupes requis et incompatibilites", () => {
    const groups = normalizeProductOptions([
      { code: "color", required: true, values: [{ value: "Black" }, { value: "White" }] },
      {
        code: "warranty",
        values: [
          { value: "1 an", incompatibleWith: ["color:White"] },
          { value: "2 ans" },
        ],
      },
    ]);
    expect(validateConfiguration(groups, { color: "Black", warranty: "1 an" })).toEqual([]);
    expect(
      validateConfiguration(groups, { warranty: "1 an" }).join(" "),
    ).toMatch(/requise manquante/);
    expect(
      validateConfiguration(groups, { color: "Red", warranty: "1 an" }).join(" "),
    ).toMatch(/inconnue/);
    expect(
      validateConfiguration(groups, { color: "White", warranty: "1 an" }).join(" "),
    ).toMatch(/incompatible/);
    expect(
      validateConfiguration(groups, { color: "Nope", nope: "x" }).length,
    ).toBeGreaterThan(1);
  });

  it("round-trip bloc de stockage (meta + incompatibilites preservees)", () => {
    const groups = normalizeProductOptions([
      {
        code: "color",
        label: "Coloris",
        source: "gsmarena:Misc/Colors",
        values: [
          { value: "Black", incompatibleWith: ["warranty:1 an"] },
          { value: "White" },
        ],
      },
    ]);
    const block = groupsToOptionsBlock(groups);
    const back = optionsBlockToGroups(block);
    expect(back).toEqual(groups);
  });

  it("ignore les blocs non-objets a la lecture", () => {
    expect(optionsBlockToGroups(null)).toEqual([]);
    expect(optionsBlockToGroups([{ code: "x" }])).toEqual([]);
  });
});
