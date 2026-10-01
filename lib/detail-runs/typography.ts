import { z } from "zod";

// Sizes are measured on a 375px-wide preview, then scaled with the image.
// Optional on stored blocks so earlier checkpoints remain resumable.
export const typesettingSchema = z.object({
  lines: z.array(z.string().min(1).max(500)).min(1).max(12),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  fontSize: z.number().min(11).max(72),
  weight: z.enum(["regular", "medium", "semibold", "bold"]),
  lineHeight: z.number().min(1).max(2),
  align: z.enum(["left", "center", "right"]),
});

type TypeBlock = { text: string; role: string; size: string; typesetting?: z.infer<typeof typesettingSchema> | null };
const words = (value: string) => value.replace(/\s/gu, "");

export function validateTypesetting(blocks: TypeBlock[], kind: string, sectionId: string) {
  const issues: string[] = [];
  for (const [index, block] of blocks.entries()) {
    const type = block.typesetting;
    if (!type) continue;
    const prefix = `Typesetting ${sectionId} block ${index}: `;
    if (words(type.lines.join("")) !== words(block.text)) issues.push(prefix + "line breaks must preserve exact text, punctuation, numbers and units; update lines whenever copy changes.");
    if (type.x + type.width > 100.01) issues.push(prefix + "text box extends beyond the right canvas edge.");
    const canvasHeight = kind === "HERO" ? 375 : 500;
    if (type.y + type.lines.length * type.fontSize * type.lineHeight / canvasHeight * 100 > 100.01) issues.push(prefix + "text lines extend beyond the bottom canvas edge; move or reflow, never delete supplied information.");
  }
  return issues;
}

export function typeRenderingInstructions(kind: string, specification: boolean) {
  return `TYPESETTING EXECUTION (instructions, never visible copy): Coordinates x/y/width are percentages of the canvas; x/y anchor the TOP LEFT of each text box. fontSize is in pixels on a 375px-wide ${kind === "HERO" ? "375px-high" : "500px-high"} preview; scale proportionally to output width. Follow each block's typesetting.lines and alignment; these repeat the SAME exact text, not additional copy. Detailed block typesetting wins over vague prose about placement. If legacy blocks omit typesetting, use their placement and the hierarchy below.
Keep one dominant reading entry, with headline normally 28-40px, support 14-17px and local labels 12-14px at 375px preview. Short focal words/numerals may be larger; an entire sentence must not be inflated to fill the width. Honor the specified letterform family: a medium editorial serif must not become a chunky geometric black face. Preserve open counters and the chosen stroke contrast. Prefer medium/semibold Chinese headlines and regular supporting type; bold is selective, not every line. Aim for headline/support contrast around 2:1, clear 1.1-1.2 headline leading and 1.4-1.6 body leading. Respect the designed block scale when it deliberately differs and remains readable. Keep 5-8% comfortable lateral insets and at least one body-line gap between separate groups. Use shared alignment rails and calm contrast behind text; do not place small copy across busy product textures.
Break Chinese headlines by meaning into balanced short lines, usually 4-9 characters per line, without a single-character orphan or a punctuation mark at line start. Never stretch/squeeze glyphs, add tracking between every Chinese character, or separate a number from its unit. Do not add English, fake logos, badges or labels as decoration. One understated accent can emphasize existing words; no giant gold swoosh or repeated ornamental rule across every page.
${specification ? "PARAMETER TABLE: Treat all verified rows as a coherent table, not several competing display headlines. Use a stable label/value column split, regular labels and medium values at comparable 14-17px sizes, aligned baselines and even row spacing. Include every supplied row and size-chart cell. Use subtle rules or alternating space, with a secondary product image. Do not enlarge sparse rows into poster slogans or duplicate the values in a separate callout." : "Vary text composition with the photograph: a cover's compact two-line benefit cluster, local annotation beside its proof, or a compact information rail. DETAIL sections belong to one scrolling story; do not restart each with an identical oversized header. Rich commercial content means a dominant idea and useful supporting groups, not scattered equal-weight text."}`;
}

export const typographyDirectorGuide = `TYPOGRAPHIC ART DIRECTION:
Resolve copy BEFORE laying it out. The sales headline is a compact buyer benefit/occasion; support gives specific proof. Never use a long photo-report sentence as a display headline. Exact user copy and parameter rows retain their meaning and units.
For each visible textBlock supply typesetting={lines,x,y,width,fontSize,weight,lineHeight,align}. x/y/width are canvas percentages; x/y is the text-box top-left, even for center/right alignment. fontSize uses a 375px-wide preview (HERO height 375, DETAIL height 500). lines contains only exact textBlock.text split at intended reading breaks; no new copy. Keep these fields synchronized in every local review/change. Historical blocks may omit this field; new designs should specify it.
Choose a shared family appropriate to the actual category: food can use warm substantial humanist/rounded letterforms, ceramics an editorial Chinese serif headline with clean sans labels, fashion expressive editorial display with practical sans information, appliances precise medium-weight sans. These are choices, not category templates; don't default every product to heavy black type. Specify the family/width/weight relationship concretely in typography.fontCharacter, not a pile of style adjectives.
Normally use 28-40px headlines, 14-17px support, 12-14px local labels; generous short display words may exceed this when the product retains focus. Give the text cluster an intentional width and balanced semantic breaks, not an entire sentence running edge to edge. Use 2-3 levels, one dominant entry and one restrained accent. Regular body against semibold title; never every word bold. CJK headline leading about 1.1-1.2 and body 1.4-1.6, no stretched glyphs or arbitrary Chinese tracking. Keep numbers with units. Preserve a common alignment rail and 5-8% side inset; group related words more closely than separate ideas.
Differentiate cover, annotations, use story and parameter table through actual occupied area and reading path. Annotation labels belong beside the proof; a specification table uses comparable label/value sizes and aligned rows, not giant values competing with each other. No mandatory top title on every detail page. Do not fill sparse factual information with giant type, decorative English or unsupported badges. Prefer fewer carefully designed groups over a large title plus unrelated tiny sentence on every picture.`;

export const typographyReviewGuide = `TYPOGRAPHY REVIEW: Read at a 375px-wide preview and check the visible reading order, not merely spelling. Flag concrete defects: competing display headlines, an oversized full-sentence heading, supporting copy too small to read, arbitrary Chinese line breaks/orphans, inconsistent alignment, tight group spacing, poor text/background contrast, annotations detached from their proof, or parameter rows styled as giant slogans. A matching generic font does not make a composition pass. Name the affected block and a local change in width, lines, weight, size or position; preserve all verified values and user-required wording. Small differences from planned coordinates are acceptable when the hierarchy works; aesthetic preference alone is not a defect.
In storyboard review classify an actual layout/legibility defect as kind=typography and submit the affected full section with revised textBlocks/typesetting or typography/layout fields. A no-op patch cannot resolve it. When copy changes, update typesetting.lines and supporting-module indices together. Avoid curing a weak layout by deleting all text or converting every frame to photography. In image review mark typography=false for actual hierarchy/readability failures, even if every character is correct; pure photography stays not_applicable.`;
