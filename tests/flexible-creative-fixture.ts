import { artDirectionFixture } from "./art-direction-fixture";
import { commercePlanFixture } from "./commerce-plan-fixture";
import { flexibleDirectionSchema, intentPlanSchema } from "../lib/detail-runs/flexible-creative";

export function intentFixture(source = "asset-a", heroes = 3, details = 4) {
  const plan = commercePlanFixture(source, heroes, details);
  return intentPlanSchema.parse({ ...plan, version: 3, requirements: [],
    sellingPoints: [{ id: "desk-accent", buyerNeed: "Personalize a daily desk setting", feature: "Visible red finish", benefit: "Add a bright accent to the desk", basis: "inferred", factIds: ["visible-color"], claimBoundary: "The finish does not establish performance, material or durability." }],
    productInformation: { parameters: [{ label: "Color", value: "Red", factIds: ["visible-color"] }], sizeChart: null }, sections: plan.sections.map((s, i) => ({ ...s, role: i === plan.sections.length - 1 ? "specifications" : s.role, contentKind: i === plan.sections.length - 1 ? "specifications" : "general", sellingPointIds: i === plan.sections.length - 1 ? [] : ["desk-accent"] })) });
}
export function flexibleFixture(sections: Array<{ id: string; kind: string; copy?: string }>) {
  const old = artDirectionFixture(sections.map((s, i) => ({ ...s, copy: s.copy || "Useful message " + i })), 2);
  return flexibleDirectionSchema.parse({ ...old, version: 3, recipeId: null, sections: old.sections.map((s, i) => {
    const closing = i === sections.length - 1;
    const photo = !closing && [1, 2, 4].includes(i);
    return { ...s, expression: closing ? "information" : photo ? "photo" : i === 5 ? "annotation" : "statement",
      expressionReason: photo ? "A real scene or closeup already communicates this task." : "This information benefits from concise explicit wording.",
      compositionBrief: ["Large product and offset headline on the left in a deep studio space", "Small product on a distant desk beside a side-lit window", "Tight macro filling the frame with surface and grounded texture"][i % 3],
      subjectPlacement: ["Right foreground over broad negative space", "Small in the bottom left of an environmental scene", "Surface cropped beyond the right edge"][i % 3],
      camera: ["Three-quarter mid shot with deliberate grounded perspective", "Distant elevated camera looking across the desk", "Close macro with shallow depth of field"][i % 3],
      graphicDevice: photo ? null : s.graphicDevice, typography: photo ? null : s.typography, requirementIds: [], referenceUses: [],
      production: {
        buyerTakeaway: "Recognize the real product in a useful composition " + i,
        narrativeLink: "Develop the visible product identity and its context " + i,
        visualProof: "Show the original finish with a physically grounded view " + i,
        layoutBlueprint: "Primary product occupies the right two thirds; a quieter left region guides the eye toward the visible detail " + i,
        materialTreatment: "Soft directional highlight reveals the actual surface without plastic smoothing",
        interaction: "Ground the product on a real surface with a coherent contact shadow",
        copyArchitecture: photo ? "Wordless photograph with a single clear focal point" : "One concise headline integrated in the upper-left negative space",
        differenceFromPrevious: "Change camera distance, occupied area and reading path for image " + i,
        supportingModules: [],
      },
      textBlocks: photo ? [] : s.textBlocks.map(b => ({ ...b, text: closing ? "Product information\nColor: Red" : b.text, origin: "ai" })),
    };
  }) });
}
