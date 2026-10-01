import { z } from "zod";
import type { CommercePlan } from "./merchandising";

// Reasoning metadata, never additional text to paint. Old saved plans omit it.
export const sellingPointsSchema = z.array(z.object({
  id: z.string().min(1).max(60),
  buyerNeed: z.string().min(3).max(180),
  feature: z.string().min(3).max(220),
  benefit: z.string().min(3).max(220),
  basis: z.enum(["direct", "inferred"]),
  factIds: z.array(z.string()).min(1).max(8),
  claimBoundary: z.string().min(3).max(220),
})).min(1).max(6);
export const sellingPointIdsSchema = z.array(z.string()).max(3);

export function validateSellingPoints(plan: CommercePlan) {
  if (plan.version !== 3 || !plan.sellingPoints) return [];
  const issues: string[] = [];
  const points = plan.sellingPoints;
  if (new Set(points.map(p => p.id)).size !== points.length) issues.push("Selling-point IDs must be unique.");
  const normalize = (value: string) => value.replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
  for (const point of points) {
    if (point.factIds.some(id => !plan.evidence.some(e => e.id === id))) issues.push(`Selling point ${point.id} needs existing product evidence; inference is not a new fact.`);
    if (normalize(point.feature) === normalize(point.benefit)) issues.push(`Selling point ${point.id} repeats a feature as its benefit. Explain why that feature matters to this buyer in use.`);
  }
  for (const [index, section] of plan.sections.entries()) {
    const ids = section.sellingPointIds || [];
    if (ids.some(id => !points.some(p => p.id === id))) issues.push(`Unknown selling-point reference in section ${index + 1}.`);
    if (section.contentKind !== "specifications" && section.role !== "specifications" && !ids.length) issues.push(`Section ${index + 1} needs a purchase reason from sellingPoints; a new viewing angle is not a new benefit.`);
  }
  return issues;
}

export const productIdentityGuide = `PRODUCT IDENTITY BEFORE PACKAGING: Identify what the customer is buying and its supported intended use, not just the photographed container. A clearly labelled serum is a skincare product, not an empty bottle merely because only its packaging is visible; a book is not just its cover. Preserve the clear product type and labelled positioning in the description while distinguishing them from proven outcomes. Only classify packaging itself as the product when supplied context says empty packaging/container/design service. A label such as "抗皱精华液" can identify the type/intended skincare concern; it cannot establish clinical efficacy, ingredients, age range or a guaranteed wrinkle reduction. If one item in a set is unidentified, do not guess its contents or turn the whole set into empty packaging.`;

export const sellingPointGuide = `BUYER-VALUE REASONING — the commercial spine, before shots or headlines:
${productIdentityGuide}
Infer product-specific purchase reasons from the actual SKU, audience, intended use, visible construction and supplied facts. Do not limit the campaign to describing what the object looks like. Ask internally: What need does this buyer have? Which real feature helps? What practical, expressive or emotional value follows? What can this source actually support?
Save sellingPoints (normally 2-4 distinct reasons; use fewer when justified): id, buyerNeed, feature, benefit, basis, factIds, claimBoundary. basis=direct means the benefit is explicitly supplied; basis=inferred means a modest qualitative interpretation of supported features/use. Keep the inference distinct from evidence; never fabricate an evidence entry to endorse it. claimBoundary records unsupported promises to avoid, not visible disclaimer text. Every non-specification section links 1-3 sellingPointIds and develops one reason through a different question, demonstration or context. A specification page may use [] and contains the real parameter/size data.
Reasoning is encouraged: a confirmed wide opening on a gaiwan can support convenient access for putting in tea; a confirmed folding plug can support easier packing; a visible clothing cut can support styling or layering ideas. These do not require numerical tests. Do not extrapolate from appearance to thermal protection, strength, leakproofing, fabric composition, body correction, waterproofing, charging performance, skin outcomes, food health effects or other unverified properties. A normal intended-use scene or a subjective lifestyle invitation is allowed; do not present an untested outcome as fact.
Plan from the category's buying motivations, selecting only what fits this product:
- BEAUTY: actual product type and supplied positioning -> skincare/makeup concern and daily routine -> supplied ingredient/formula benefits -> supported application/texture -> parameters. A clearly labelled anti-wrinkle serum can introduce "把抗老护理，融入日常" as an intended-care positioning, not "7天淡纹" or "紧致修护" without support. An opaque bottle does not prove texture or rapid absorption. Packaging color is an art-direction cue, rarely the main purchase reason.
- APPAREL: cut/drape and visible construction -> wearing silhouette, outfit coordination, occasions and layering -> detail proof -> on-body looks and real size chart. Do not infer breathability, softness, anti-pilling or slimming results merely from a photo.
- GAIWAN / TEAWARE: supported opening, lid, bowl and saucer -> tea preparation/handling/pouring workflow and tea-table enjoyment -> demonstrate the relevant feature -> parameters. A wide opening may support "投茶更从容"; it does not support "不烫手". Confirmed lid/bowl use can support "一盖一碗，慢享一席茶"; avoid shape-report headlines such as "从上方看圆形盖面".
- ELECTRONICS / APPLIANCES: actual function -> buyer's task, portability, workspace/storage or supported control convenience -> feature demonstration and supplied performance -> compatibility/parameters. A confirmed folding plug: "折起就收好，出门少一份累赘"; a static extended plug alone does not prove folding.
- HOME / EVERYDAY: use task -> organization, placement, handling or room coordination supported by construction -> in-context demonstration -> material/size/care. No guessed load limits, antimicrobial properties or durability guarantees.
- FOOD: supplied flavor/ingredients -> taste occasion, serving or sharing -> real food/appetite imagery -> actual pack/storage data. Even when taste has not been supplied, a normal enjoyment/serving invitation is allowed: for an identified durian, "给爱榴莲的你" or "留一段时间，享用喜欢的水果" expresses audience/occasion, not a measured taste claim. Combine it with real origin/weight when supplied. Do not retreat to "先看果肉形态", "外壳与剖面，都是选购参考" or "明确产地，作为选购参考"; these describe the shopping inspection, not the appeal of eating the product. Do not infer sweetness, creaminess, ripeness, freshness, seed size, yield, variety, cold-chain or health claims from appearance.
- BOOKS / CULTURAL PRODUCTS: supplied topic/content -> reader interest, reading/use occasion or known learning purpose -> real contents/binding evidence -> edition/format. Do not invent interior content or learning outcomes from a cover.
These are reasoning examples, not mandatory slogans or claims for every SKU. Unknown technical details do not force an appearance-only campaign. Use the supported intended use and modest qualitative benefits; batch critical questions once using the existing clarification flow. If skipped, omit unsupported benefits, retain useful category-specific value and preserve the parameter page.
COPY PRIORITY: Each sales frame communicates what the buyer gains, then supports it with a feature or useful explanation. Headlines should express the assigned benefit/context, support copy explains the feature-to-benefit connection, and small labels simply name the relevant feature. "高瓶与矮罐，同框呈现", "轮廓各有不同", "瓶身印字", "两种轮廓，清楚呈现" describe the picture rather than a purchase reason; do not use them as main sales messages. Adding "选购参考" or "帮助了解" does not turn a shape/label observation into a buyer benefit. The sellingPoint itself must be rewritten if it only promises looking at the photograph. A specific design aesthetic can be a genuine expressive benefit, but explain its appeal/use instead of enumerating colors and shapes. Photo-only frames remain allowed when explicitly requested or deliberately useful; they still demonstrate the mapped buyer value. Parameter tables, feature labels and literal user-required copy are not forced into slogans.
REVIEW BEFORE RENDER: Read only final visible copy first. Does each sales headline communicate the assigned buyer value, or merely narrate the photograph? A frame with accurate but purely appearance-report copy needs a local copy rewrite, not a pass and not an automatic conversion to photo. In submit_design_review/adapt_storyboard, classify this as kind=copy, include the affected full section and correct only affected copy/production fields using the mapped selling point and its evidence. Reject invented benefits as fact issues. Preserve supplied specifications, size charts, useful labels and exact user wording. Camera/layout variations do not fix a missing sales proposition.`;
