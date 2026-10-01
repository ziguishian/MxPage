import { z } from "zod";
import type { CommercePlan } from "./merchandising";

// Optional in stored plans, required for newly planned V3 campaigns.
export const productInformationSchema = z.object({
  parameters: z.array(z.object({ label: z.string().min(1).max(60), value: z.string().min(1).max(180), factIds: z.array(z.string()).min(1).max(8) })).min(1).max(12),
  sizeChart: z.object({
    columns: z.array(z.string().min(1).max(60)).min(2).max(8),
    rows: z.array(z.object({ cells: z.array(z.string().min(1).max(60)).min(2).max(8), factIds: z.array(z.string()).min(1).max(8) })).min(1).max(12),
  }).nullable(),
});
export const contentKindSchema = z.enum(["general", "on_body", "specifications"]);

export function containsSpecificationValue(copy: string, value: string) {
  const compact = value.replace(/\s/gu, "");
  if (!/\d/.test(compact)) return copy.replace(/\s/gu, "").includes(compact);
  // Allow table spacing/line breaks, but 100 must never match 1100 or 1000.
  const pattern = [...compact].map(char => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  return new RegExp((/^\d/.test(compact) ? "(?<![\\d.])" : "") + pattern + (/\d$/.test(compact) ? "(?![\\d.])" : ""), "u").test(copy);
}

export function specificationPageOmitted(plan: CommercePlan) {
  return (plan.requirements || []).some(r => /(?:不要|不需要|无需|省略).{0,8}(?:规格|参数|尺码表)|(?:全套|全部|只要).{0,6}纯(?:摄影|图)|no (?:specifications|specs|size chart)|only (?:photos|photography)/i.test(r.text));
}

export function validateCategoryContent(plan: CommercePlan) {
  // Historical V1/V2/V3 plans retain their original contract on resume.
  if (plan.version !== 3 || !plan.productInformation) return [];
  const issues: string[] = [];
  const info = plan.productInformation;
  const hasFacts = (ids: string[]) => ids.every(id => plan.evidence.some(e => e.id === id));
  for (const row of [...info.parameters, ...(info.sizeChart?.rows || [])]) {
    if (!hasFacts(row.factIds)) issues.push("Product information must reference existing evidence IDs.");
  }
  if (info.sizeChart?.rows.some(row => row.cells.length !== info.sizeChart!.columns.length)) issues.push("Size chart rows must match column count and preserve supplied units/values.");
  if (!specificationPageOmitted(plan)) {
    const last = plan.sections.filter(s => s.kind === "DETAIL").at(-1);
    if (last?.role !== "specifications" || last.contentKind !== "specifications") issues.push("The final DETAIL must be a specifications information page; retain known parameters and any supplied size chart, not an appearance recap.");
  }
  if (plan.category === "apparel" && !plan.sections.some(s => s.contentKind === "on_body")) issues.push("Apparel needs an on_body image showing the actual garment worn, or the footwear/accessory worn appropriately; keep the same SKU and do not invent model measurements.");
  return issues;
}

export const categoryContentGuide = `CATEGORY CONTENT COVERAGE:
The last DETAIL is normally a useful product specifications/parameters page, role=specifications and contentKind=specifications, with organized label/value rows; never use a vague appearance recap or quiet still life in its place. Respect an explicitly sourced user request to omit specifications or make the entire set photographic. Other sections use contentKind=general or on_body.
Submit productInformation.parameters with exact known label/value pairs and existing factIds. Include product name/type, supported material, size/capacity, color, included components and relevant technical specifications where actually supplied. Visual features can support names/colors/components, but never infer numerical dimensions from hands or perspective. Keep unknown rows OUT of the artwork; no empty table, dashes, "待确认" or invented numbers.
For missing important dimensions/capacity or apparel size data, use the existing one-batch clarification tool (at most three questions) to request the category's missing information together. If the user skips or information is unavailable, continue with a specification page containing ONLY known parameters. A missing measurement must not delete the specification page.
APPAREL: include at least one contentKind=on_body image showing the real garment on a model (footwear/accessories are worn appropriately), preserving cut, length and pattern. The last specification page also carries the supplied size chart: productInformation.sizeChart columns include units, rows preserve exact supplied sizes/measurements with factIds. If no real chart was supplied, set sizeChart=null; never fabricate S/M/L measurements, fit advice or model height/weight. Show known garment information while the missing chart is requested.
CERAMICS / THREE-PIECE GAIWAN: show the lid, bowl and saucer and an appropriate handling/tea scene when supported; finish with supported name, material, capacity, mouth diameter/height, component count and care information. Do not infer capacity or diameter from photographs.
ELECTRONICS/APPLIANCES: use/context, visible controls/interfaces, then supplied model, ratings, dimensions, compatibility and actual package contents. FOOD/BEAUTY: use/serving context plus supplied ingredients, net content, storage/usage and shelf-life information; no invented efficacy. HOME/FURNITURE: placement and human context plus supplied dimensions, materials, contents and care. BOOKS: cover/binding or supplied interior content, then verified edition, format, pages and publisher. Adapt the middle sequence to the category rather than copying these as fixed screen counts.
Keep contentKind and productInformation through the design/review stage. A review may improve presentation but must not remove the specifications table, provided size chart, or on-body task.`;
