import type { ArtDirection } from "../lib/detail-runs/art-direction";

export function artDirectionFixture(sections: Array<{ id: string; kind: string; copy: string }>, version: 1 | 2 = 1): ArtDirection {
  const layouts = ["offset_hero", "editorial_split", "macro_crop", "full_scene", "information_grid", "steps", "specification_sheet"] as const;
  const scales = ["dominant", "environmental", "macro"] as const;
  const details = sections.filter(s => s.kind === "DETAIL");
  const result: ArtDirection = {
    version, recipeId: "monochrome_precision", concept: "Sculptural object in a warm graphic space",
    ...(version === 2 ? { viewVersion: 1 as const, layoutVersion: 1 as const, detailSeams: details.slice(1).map((s, i) => ({ fromSectionId: details[i].id, toSectionId: s.id, color: i % 2 ? "#252525" : "#F3EEE6" })) } : {}),
    rationale: "Contrast dimensional product photography with quieter information panels.",
    palette: ["charcoal", "ivory", "red"], headlineStyle: "Bold Chinese sans serif with compact two-line headlines",
    bodyStyle: "Clean readable sans serif with generous line height", motif: "A broad ivory curved plane connects the frames",
    lighting: "Large directional softbox with a narrow side highlight",
    sections: sections.map((s, i) => ({ sectionId: s.id, ...(version === 2 ? { title: `Final image ${i}`, task: `Final photographic task ${i}: ${layouts[i % layouts.length]}`, typography: { fontCharacter: "Condensed display sans with a restrained editorial supporting face", layout: "Stack the headline on the left, aligned with the product silhouette", emphasis: "Use the exact headline words, with a larger opening word", decoration: "One warm accent rule aligns with the headline baseline" } } : {}), composition: layouts[i % layouts.length], density: i % 2 ? "informative" : "airy", productScale: scales[i % scales.length], subjectPlacement: "Off-axis product occupying the right-hand photographic zone", camera: "Camera from the supplied visible side with a deliberate close perspective", background: "Charcoal photographic field contrasted with an ivory text zone", lighting: "Directional key light and a grounded contact shadow", graphicDevice: "An ivory arc connects the product and headline", textBlocks: s.copy ? [{ text: s.copy, role: "headline", size: "display", color: "white", placement: "Upper left with a generous inset and clear background" }] : [], continuity: "Continue the ivory field into the next edge-to-edge panel" })),
  };
  if (version === 2) result.sections.forEach((s, i) => { s.viewpoint = (["three_quarter", "top_down", "macro", "side"] as const)[i % 4]; });
  return result;
}
