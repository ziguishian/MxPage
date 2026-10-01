import type { CommercePlan } from "../lib/detail-runs/merchandising";

export function commercePlanFixture(sourceRef = "asset-a", heroCount = 3, detailCount = 4): CommercePlan {
  const roles = ["positioning", "benefits", "detail", "scenario", "usage", "specifications", "contents", "evidence"] as const;
  const layouts = ["full_bleed", "feature_grid", "macro", "split", "steps", "spec_table", "editorial"] as const;
  return {
    version: 2, category: "electronics", productName: "Fixture product", audience: "Desk users", positioning: "A clear product presentation", facts: ["Red object"],
    evidence: [{ id: "visible-color", claim: "Red body visible in source image", source: "image", sourceRef }],
    style: "Cool white background, red product and dark readable type.",
    visualSystem: { palette: ["white", "red"], typography: "Bold headlines and concise supporting labels", lighting: "Soft directional studio light", composition: "Alternate closeups, scenes and feature grids", continuity: "Shared white background and red accent transitions" },
    sections: ([['HERO', heroCount], ['DETAIL', detailCount]] as const).flatMap(([kind, count]) => Array.from({ length: count }, (_, i) => ({ kind, title: `${kind} image ${i}`, copy: `${kind} exact copy ${i}`, prompt: "Commercial product photograph with exact planned text and varied composition.", role: roles[i % roles.length], buyerQuestion: `${kind} purchase question ${i}`, objective: `Resolve purchase question ${i}`, factIds: ["visible-color"], layout: layouts[i % layouts.length], visualFocus: `Product framing number ${i} with bright side light and useful detail`, transition: "Continue shared palette into next composition" }))),
  };
}
