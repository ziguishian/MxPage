import { z } from "zod";
import { artDirectionSchema, type ArtDirection } from "./art-direction";

// Reviews can replace individual values, never remove frames, blocks or tasks.
export const creativeReviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({ sectionIds: z.array(z.string()).min(1), kind: z.enum(["fact", "design"]), message: z.string().min(1).max(500) })).max(8),
  patches: z.array(z.object({
    sectionId: z.string(),
    field: z.enum(["text", "title", "task", "camera", "subjectPlacement", "background", "graphicDevice"]),
    textBlockIndex: z.number().int().min(0).nullable(),
    before: z.string().min(1), after: z.string().trim().min(2).max(500),
    factIds: z.array(z.string()).max(12),
  })).max(30),
});
export type CreativeReview = z.infer<typeof creativeReviewSchema>;

export function applyCreativeReview(direction: ArtDirection, review: CreativeReview, factIds: string[]) {
  const next = structuredClone(direction);
  const errors: string[] = [];
  const affected = new Set(review.issues.flatMap(i => i.sectionIds));
  const touched = new Set<string>();
  for (const issue of review.issues) {
    if (issue.sectionIds.some(id => !direction.sections.some(s => s.sectionId === id))) errors.push("Use only supplied section IDs.");
    if (issue.kind === "fact" && issue.sectionIds.some(id => !review.patches.some(p => p.sectionId === id && p.factIds.length))) errors.push("Every factual issue needs an evidence-backed local replacement for each affected frame; retain its useful information task.");
  }
  if (!review.passed && !review.issues.length) errors.push("Provide a concrete issue or pass the design.");
  for (const patch of review.patches) {
    const section = next.sections.find(s => s.sectionId === patch.sectionId);
    const key = `${patch.sectionId}:${patch.field}:${patch.textBlockIndex}`;
    if (!section || !affected.has(patch.sectionId) || touched.has(key)) { errors.push("Patch only an affected frame and each field once."); continue; }
    touched.add(key);
    if (patch.factIds.some(id => !factIds.includes(id))) errors.push("Use only supplied evidence IDs, never style-reference facts.");
    if (patch.field === "text") {
      const block = patch.textBlockIndex === null ? undefined : section.textBlocks[patch.textBlockIndex];
      if (!block || block.text !== patch.before || patch.before === patch.after) errors.push("Text patch must identify an existing exact block and supply a nonempty replacement, not delete it.");
      else block.text = patch.after;
    } else if (patch.textBlockIndex !== null || section[patch.field] !== patch.before || patch.before === patch.after) errors.push("Patch before must match the exact field; use null textBlockIndex for non-text fields.");
    else section[patch.field] = patch.after;
  }
  if (!artDirectionSchema.safeParse(next).success) errors.push("Replacements must respect the storyboard field lengths and format.");
  return { direction: next, errors, issues: review.issues.map(issue => ({ ...issue, resolved: issue.sectionIds.every(id => review.patches.some(p => p.sectionId === id)) })) };
}
