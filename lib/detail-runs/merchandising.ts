import { TOTAL_IMAGE_MAX } from "@/lib/utils/image-counts";
import { z } from "zod";
import { planSchema } from "./contracts";
import { productInformationSchema, contentKindSchema, validateCategoryContent } from "./category-content";
import { sellingPointsSchema, sellingPointIdsSchema, validateSellingPoints } from "./selling-points";

export const categoryProfiles = {
  books: { label: "图书 / 文创", story: "主题与气质 → 陈列场景 → 封面设计 → 可见装帧细节 → 阅读/使用关系 → 已知选购信息", art: "编辑式大字、书册与空间的比例变化、方向性光影和有层次的纸面/矿物布景；完整主视觉、场景和封面/页边近景交替。可以重设背景与布景，不复制上传照片的白底。", caution: "不能仅凭封面推断内页内容、页数、纸材或用途；产品类别不清时补问。不要将印字位置和页边颜色拆成重复卖点。" },
  electronics: { label: "数码 / 3C", story: "产品定位 → 使用需求 → 已证实性能 → 接口与细节 → 兼容/规格 → 包装与使用", art: "石墨或冷白基底，少量品牌强调色；轮廓光、精确局部特写、桌面情境、清晰参数分区。不要把原始白底抠图重复居中。", caution: "功率、协议、兼容范围、内部结构、认证必须有依据；外壳印字不等于实测性能。" },
  appliances: { label: "家电", story: "居家主场景与主张 → 核心功能总览 → 逐项功能解释 → 使用步骤 → 尺寸/安放 → 参数与配件", art: "统一的居家材质和自然光；大场景开场、线性图标功能组、局部剖析与明亮参数页交替。空间尺度必须可信。", caution: "除菌率、噪声、能耗、容量和结构剖面不可推测。" },
  food: { label: "食品 / 饮料", story: "食欲主视觉 → 风味与口感 → 原料证据 → 工艺/切面 → 食用场景 → 规格/储存", art: "从食物本身提取主色，食欲微距、切面和食用场景；大字与食物错位编排，奶油/果肉等真实质感贯穿连续页面。", caution: "产地、含量、配方、净重、保质期、营养和功效只能使用已提供信息。" },
  apparel: { label: "服饰 / 鞋包", story: "穿着气质 → 全身/上身效果 → 版型 → 面料与做工 → 搭配 → 尺码/护理", art: "时装编辑式留白，自然人物动作、全身与局部的比例变化，服装色系贯穿；锁定同一款式、颜色和细节。", caution: "不虚构面料成分、尺码、模特身高体重，不混入其他 SKU。" },
  beauty: { label: "美妆 / 个护", story: "品牌产品主张 → 使用需求 → 已证实成分/利益 → 质地 → 使用方法 → 规格", art: "包装色作为强调色，干净的棚拍和质地微距、少量有机曲面、精细字体层级；功效信息与产品视觉分层。", caution: "不制造前后对比、临床数据、功效背书或未确认成分。" },
  home: { label: "家居 / 家具", story: "空间氛围 → 人与产品关系 → 结构/材质 → 日常使用 → 尺寸/搭配 → 安装护理", art: "真实空间、自然侧光、材质纹理和人体尺度；全景、局部、尺寸信息穿插，统一室内色温。", caution: "不推测尺寸、承重、材料和安装条件。" },
  everyday: { label: "日用 / 其他", story: "产品身份 → 使用需求 → 可见优势 → 细节 → 使用方式 → 规格与清单", art: "依据物品用途选择有辨识度的主色和生活场景；主视觉、功能图组、微距与信息页形成节奏。", caution: "不以万能模板或重复商品图凑页数。" },
} as const;
export const categoryKeys = Object.keys(categoryProfiles) as [keyof typeof categoryProfiles, ...(keyof typeof categoryProfiles)[]];
export const categorySchema = z.enum(categoryKeys);
export const sectionRoleLabels = { positioning: "产品主张", benefits: "核心卖点", scenario: "使用场景", detail: "产品细节", evidence: "卖点证据", specifications: "规格选购", usage: "使用方式", contents: "包装清单", selection: "选购对照", faq: "使用答疑", brand_story: "品牌故事" } as const;
const roleKeys = Object.keys(sectionRoleLabels) as [keyof typeof sectionRoleLabels, ...(keyof typeof sectionRoleLabels)[]];

// Kept separate from the legacy/XHS contract: existing saved runs remain resumable.
export const commercePlanSchema = planSchema.extend({
  version: z.union([z.literal(2), z.literal(3)]),
  requirements: z.array(z.object({ id: z.string().min(1), kind: z.enum(["exact_copy", "information"]), text: z.string().min(1).max(500), sourceQuote: z.string().min(1).max(500) })).max(12).optional(),
  category: categorySchema,
  audience: z.string().min(2).max(400),
  positioning: z.string().min(2).max(400),
  productInformation: productInformationSchema.optional(),
  sellingPoints: sellingPointsSchema.optional(),
  evidence: z.array(z.object({ id: z.string().min(1), claim: z.string().min(1).max(500), source: z.enum(["image", "user"]), sourceRef: z.string().min(1) })).min(1).max(30),
  visualSystem: z.object({ palette: z.array(z.string()).min(2).max(5), typography: z.string().min(10).max(600), lighting: z.string().min(10).max(600), composition: z.string().min(10).max(600), continuity: z.string().min(10).max(600) }),
  sections: z.array(planSchema.shape.sections.element.extend({
    role: z.enum(roleKeys),
    contentKind: contentKindSchema.optional(),
    sellingPointIds: sellingPointIdsSchema.optional(),
    buyerQuestion: z.string().min(2).max(300),
    objective: z.string().min(2).max(300),
    factIds: z.array(z.string()).min(1).max(12),
    layout: z.enum(["full_bleed", "split", "feature_grid", "macro", "steps", "spec_table", "editorial"]),
    visualFocus: z.string().min(10).max(1000),
    transition: z.string().min(2).max(400),
  })).min(7).max(TOTAL_IMAGE_MAX),
});
export type CommercePlan = z.infer<typeof commercePlanSchema>;

export function userEvidenceSources(description: string | null, answers: string[]) {
  return [{ source: "user" as const, sourceRef: "user_description", text: description || "" }, ...answers.map((text, index) => ({ source: "user" as const, sourceRef: `user_answer_${index}`, text }))].filter(s => s.text.trim());
}

export function normalizeUserEvidenceSources(plan: CommercePlan, description: string | null, answers: string[]) {
  const sources = userEvidenceSources(description, answers);
  return { ...plan, evidence: plan.evidence.map(e => {
    if (e.source !== "user" || sources.some(s => s.sourceRef === e.sourceRef)) return e;
    const quote = e.sourceRef.trim();
    // Recover only a literal, unambiguous quote. Never guess an index, accept
    // fabricated sources, or reclassify image observations as user evidence.
    if (quote.length < 2 || /^user_(?:answer_|description)/.test(quote)) return e;
    const matches = sources.filter(s => s.text.includes(quote));
    return matches.length === 1 ? { ...e, sourceRef: matches[0].sourceRef } : e;
  }) };
}

// Research sources and decisions: docs/complete-page-workflow.md. These are
// content jobs to select/merge, not compulsory claims or identical page templates.
export const commerceContentModules = [
  { role: "positioning", task: "是什么、适合怎样的生活/使用需求", evidence: "商品身份与已确认用途", fallback: "产品肖像与有辨识度的视觉主题" },
  { role: "benefits", task: "为什么值得选择；一到三个不同利益点", evidence: "已提供的功能、材料或实际特征", fallback: "把可见设计与使用情境结合，不编造性能优势" },
  { role: "evidence", task: "用什么支持前面的主张", evidence: "真实细节、材料/成分记录或用户提供的检测资料", fallback: "外观/做工局部摄影，不能画假报告、假对比" },
  { role: "scenario", task: "在什么场合使用、如何融入生活", evidence: "确认的品类用途", fallback: "陈列情境与人体/空间关系，不暗示配件赠送或性能" },
  { role: "detail", task: "用真实细节解释产品特征如何满足买家需求", evidence: "商品原图、已知用途与结构", fallback: "围绕已有卖点展示相关细节或使用关系，不把新视角当成新卖点" },
  { role: "selection", task: "怎样挑选；不同版本有哪些已知差异", evidence: "真实颜色、型号、尺寸与适用信息", fallback: "可见外观对照或完整产品档案，不暗示在售 SKU/套装数量" },
  { role: "specifications", task: "尺寸、成分、性能和兼容信息", evidence: "用户确认的参数/清晰规格资料", fallback: "合并到选购档案，只写已知字段，不输出空白表格" },
  { role: "usage", task: "使用步骤、护理、安放与收纳", evidence: "已确认用途、可见结构或说明书", fallback: "自然场景示意；不猜电压、档位、剂量、安装要求" },
  { role: "contents", task: "收到什么与包装形态", evidence: "明确的包装/配件清单", fallback: "无清单则换成收尾陈列，不将背景道具当赠品" },
  { role: "faq", task: "解决最后一个真实选购疑问", evidence: "已知信息足以回答的问题", fallback: "已知要点回顾，不编造售后、评价、物流承诺" },
  { role: "brand_story", task: "有依据的品牌理念与背景", evidence: "用户明确提供的品牌资料", fallback: "没有资料则用视觉主题收尾，不伪造品牌历史" },
] as const;

export function contentPlanningGuide(detailCount: number) {
  return `CONTENT COVERAGE: Preserve the requested image count. Build a purchase path: discover the product → understand its value → inspect credible detail/context → make an informed choice. Cover these four jobs across DETAIL; merge related jobs within a panel when count is small, never delete panels after review. For ${detailCount} DETAIL panels, ${detailCount <= 4 ? "combine identity + supported value in the opening; follow with evidence/details, context/use, then selection or a grounded product archive" : "expand distinct supported benefits and evidence between the opening and practical selection/use ending"}. Select modules below by available evidence; replace unavailable modules with their useful photographic fallback. No made-up data and no repeated appearance narration to pad the count. Each frame retains a concrete buyer question, concise consumer copy and a visual demonstration. Price/cart/reviews/logistics are marketplace interface fields, not permission to paint fake reviews, offers or service promises into the artwork.\n${commerceContentModules.map(m => `${m.role}: ${m.task}. Needs: ${m.evidence}. If missing: ${m.fallback}.`).join("\n")}`;
}

export const merchandisingRules = `Build a commercially complete product page, not a stack of similar product posters. Use save_plan version 2.
1. Determine the category and audience from evidence; obey a user-selected category when appropriate. Separate product identity from art direction. Uploaded product photos are IDENTITY references only: redesign the background, lighting, setting, scale, typography and composition while preserving the exact SKU, silhouette, color, parts and labels. Do not copy a screenshot's interface, annotations, watermarks or collage frame into an output.
2. Build evidence IDs from visible observations and user-supplied facts. sourceRef must be an actual asset ID for image evidence, user_description for the supplied description, or user_answer_N (zero-based) for an answer. A printed number is a visible marking, not independent proof of performance. Never turn uncertainties or internal audit notes into advertising headings. Do not invent prices, reviews, promotions, comparisons or certifications.
3. State one positioning and one visual system: palette, type scale, lighting, composition and continuous-page transitions. Use category-specific art direction below. Reference mechanics: food can use appetizing yellow/cream macro imagery and large editorial type; appliances can use warm domestic hero scenes followed by feature icon groups; portable electronics can use cool-blue scenes, useful closeups and a compact specification ending. These are design mechanics, NEVER permission to copy reference claims or products.
4. HERO images are a purchase gallery: first identify the product and its strongest supported proposition, then complementary use context, benefit evidence and detail/selection. Each must have a different buyer question. DETAIL images form a continuous narrative: positioning, core benefits, evidence, context/detail, practical selection/use. Every screen must resolve a different concrete question with supporting factIds. Choose the order for this category; do not force identical modules onto every product.
5. Alternate large scene/portrait panels with informative feature groups, macro details, editorial splits, steps or confirmed specifications. At least three different layouts across DETAIL images; avoid repeated center-product-plus-title pages. One coherent color/light/type system, varied image scale and density. A hero may use one strong headline; information screens can use 2–4 concise labelled facts in a carefully aligned grid. All text must remain readable at 375px mobile width. Leave generous internal margins but no external rounded-card frames or gutters: these images stack edge-to-edge.
6. For each section specify a role, buyerQuestion, objective, factIds, layout, visualFocus (camera, setting, light, crop, text positions) and transition into the next screen. copy contains ALL exact visible promotional text, in the requested language; prompt describes the art, without introducing additional copy. Do not render the internal title, objective, source references or doubts. Original product labels remain intact. Plan genuinely different camera angles: front, three-quarter, side, overhead and detail when appropriate. Perspective extrapolation of existing exterior is allowed; do not invent unseen functional components or exploded construction. Preserve SKU identity, not a single source pose.
7. Propose concise customer-facing copy, grounded in evidence and each frame's task. The visual director will refine and finalize the wording before rendering, with a separate factual and semantic check. Avoid audit narration such as 封面印有文字 / 浅色边缘清晰可见 / 中文与字母并置 / 可见印字 / 参数未知 and filler like 品质之选. These are observations, not purchase propositions. Do not split the same appearance observation into several supposed benefits. Facts can support expressive, non-factual campaign headlines without inventing performance, materials or use cases. Short headlines or a text-free photographic frame are preferable to padded factual narration. HERO copy uses at most two support lines; DETAIL resolves one useful question. Use the requested language, no decorative English unless requested.
8. When product type, use or positioning is too ambiguous to support a useful narrative, ask at most three concise questions in ONE batch. Allow continuing with current information unless identity itself is unrecognizable. After an answer or skip, use different photographic tasks with minimal or no added text; never repeatedly ask optional questions or fill the requested count with repeated color/lettering descriptions. Keep the requested count. Missing specifications do not prohibit creative backgrounds, art sets, light, abstract shapes or typography. Save only after checking coverage and semantic repetition.
Category playbook:
${Object.entries(categoryProfiles).map(([key, value]) => `${key} (${value.label}): ${value.story}. ${value.art} ${value.caution}`).join("\n")}`;

export function validateCommercePlan(plan: CommercePlan, assetIds: string[], description: string | null, answers: string[]) {
  const issues: string[] = [];
  const ids = new Set(plan.evidence.map(e => e.id));
  if (ids.size !== plan.evidence.length) issues.push("Evidence IDs must be unique.");
  for (const e of plan.evidence) {
    const valid = e.source === "image" ? assetIds.includes(e.sourceRef) : e.sourceRef === "user_description" ? Boolean(description?.trim()) : answers.some((a, i) => Boolean(a.trim()) && e.sourceRef === `user_answer_${i}`);
    if (!valid) issues.push(`Unsupported evidence source: ${e.id}. sourceRef must be a source ID, not a quote or fact ID. For source=${e.source}, allowed IDs: ${JSON.stringify(e.source === "image" ? assetIds : userEvidenceSources(description, answers).map(s => s.sourceRef))}. Keep the claim in claim and correct only sourceRef; user_answer_N uses zero-based indexing.`);
  }
  for (const s of plan.sections) if (s.factIds.some(id => !ids.has(id))) issues.push(`Unknown fact reference in ${s.title}.`);
  const details = plan.sections.filter(s => s.kind === "DETAIL");
  const heroes = plan.sections.filter(s => s.kind === "HERO");
  if (plan.version === 2 && (heroes[0]?.role !== "positioning" || details[0]?.role !== "positioning")) issues.push("Both gallery and detail page must start with product positioning.");
  if (plan.version === 2 && new Set(details.map(s => s.layout)).size < 3) issues.push("Use at least three DETAIL layouts to create a varied page rhythm.");
  const supplied = [description || "", ...answers].join("\n");
  for (const r of plan.requirements || []) if (!supplied.includes(r.sourceQuote)) issues.push(`User requirement ${r.id} must quote an actual supplied instruction.` + (/heroCount|detailCount|frame_counts/.test(`${r.id} ${r.sourceQuote}`) ? " Output counts are already enforced by the workflow, not buyer-facing information. Remove this synthetic requirements entry; retain the exact requested HERO/DETAIL slots." : " Do not invent a source quote; remove unsourced requirements while retaining supported content."));
  if (new Set((plan.requirements || []).map(r => r.id)).size !== (plan.requirements || []).length) issues.push("Requirement IDs must be unique.");
  // Sparse-evidence products may legitimately use several photographic detail
  // tasks. Do not require invented benefits/specifications just to fill role enums.
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  for (const group of [heroes, details]) {
    if (new Set(group.map(s => normalize(s.buyerQuestion))).size !== group.length) issues.push("Each image in a group must answer a distinct buyer question.");
    const copies = group.map(s => normalize(s.copy)).filter(Boolean);
    if (new Set(copies).size !== copies.length) issues.push("Do not repeat identical promotional copy across an image group.");
  }
  issues.push(...validateCategoryContent(plan));
  issues.push(...validateSellingPoints(plan));
  return issues;
}

export function compileSectionBrief(plan: CommercePlan, section: CommercePlan["sections"][number]) {
  return [section.prompt, `Creative brief v2: ${JSON.stringify({ category: plan.category, positioning: plan.positioning, audience: plan.audience, visualSystem: plan.visualSystem, role: section.role, buyerQuestion: section.buyerQuestion, layout: section.layout, visualFocus: section.visualFocus, transition: section.transition, evidence: plan.evidence.filter(e => section.factIds.includes(e.id)) })}`, `EXACT FINAL VISIBLE COPY (no other promotional wording): ${JSON.stringify(section.copy)}`, "Design a finished commercial composition, not a reproduction of the uploaded background. Internal brief fields and evidence notes are not visible copy. Detail modules meet edge-to-edge with no outer frame. Keep product identity exact."].join("\n");
}
