import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { readStorageFile, saveUploadAsset } from "@/lib/storage/asset-manager";
import { contentLanguageLabels, type ContentLanguage } from "@/lib/utils/content-language";
import { isStyleReference } from "@/lib/utils/asset-purpose";

export const translationRules = "Translate all readable marketing text in the FIRST reference image into the requested target language. Preserve product appearance, logos and brand names, factual numbers, units, layout, colors, visual hierarchy and all non-text elements. Do not add marketing claims, remove content, summarize or redesign. Adapt line breaks and font size only as needed for legibility, including right-to-left typesetting for Arabic. If text is unreadable, do not invent its meaning. Return the complete translated image, not a textual explanation.";
export const translationProjectId = (batchId: string, sourceId: string, language: string) => `translation-${createHash("sha256").update(`${batchId}:${sourceId}:${language}`).digest("hex").slice(0, 32)}`;

// Each language owns its asset files, so deleting one result cannot delete originals.
export async function prepareTranslationProject(id: string, sourceId: string, language: ContentLanguage, quality: string) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if ((existing?.modelSnapshot as any)?.translationReady) return;
  const source = await prisma.project.findUniqueOrThrow({ where: { id: sourceId }, include: { assets: { where: { type: { in: ["MAIN", "ANGLE", "DETAIL", "REFERENCE"] } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } });
  source.assets = source.assets.filter(a => !isStyleReference(a));
  if (!source.assets.length || source.assets.length > 30) throw new Error("每套翻译需要 1–30 张原图。");
  await prisma.project.upsert({ where: { id }, create: { id, name: `${source.name} · ${contentLanguageLabels[language]}`, platform: source.platform, style: source.style, description: source.description }, update: {} });
  for (const [order, original] of source.assets.entries()) {
    let asset = await prisma.productAsset.findFirst({ where: { projectId: id, sortOrder: order, type: "DETAIL" } });
    if (!asset) asset = await saveUploadAsset({ projectId: id, type: "DETAIL", fileName: original.fileName, mimeType: original.mimeType, fileBuffer: await readStorageFile(original.filePath), sortOrder: order });
    await prisma.pageSection.upsert({ where: { projectId_sectionKey: { projectId: id, sectionKey: `translation-${order}` } }, create: { projectId: id, sectionKey: `translation-${order}`, type: "CUSTOM", title: original.fileName, goal: "翻译原图文字", copy: "", visualPrompt: translationRules, order, editableData: { translationSourceAssetId: asset.id } }, update: {} });
  }
  await prisma.project.update({ where: { id }, data: { modelSnapshot: { translationReady: true, translationSourceProjectId: sourceId, previewConfig: { contentLanguage: language, quality, heroImageCount: 0, detailSectionCount: source.assets.length } } } });
}
