import type { ModelDetectionResult } from "@/types/domain";

function sortByScore(
  models: ModelDetectionResult[],
  score: (model: ModelDetectionResult) => number,
) {
  return [...models].sort((left, right) => {
    const diff = score(right) - score(left);
    if (diff !== 0) return diff;
    return left.modelId.localeCompare(right.modelId);
  });
}

function isPreviewOrTest(modelId: string) {
  return /(^|[-_])(?:preview|experimental|beta|test|deprecated|legacy)(?:[-_]|$)/i.test(modelId);
}

function isStableImageCandidate(modelId: string) {
  return !/(preview|experimental|beta|test)/i.test(modelId);
}

function hasRealImageGeneration(model: ModelDetectionResult) {
  return model.capabilities.image_gen && model.capabilities.real_image_gen !== false;
}

function hasRealImageEdit(model: ModelDetectionResult) {
  return model.capabilities.image_edit && model.capabilities.real_image_edit !== false;
}

function isImageProductionModel(model: ModelDetectionResult) {
  return Boolean(model.capabilities.image_gen || model.capabilities.image_edit);
}

function isTextGenerationCandidate(model: ModelDetectionResult) {
  return Boolean(model.capabilities.text && !isImageProductionModel(model));
}

function isVisionCandidate(model: ModelDetectionResult) {
  return Boolean(model.capabilities.vision && !isImageProductionModel(model));
}

function normalizeModelId(modelId: string) {
  return modelId.toLowerCase().replace(/[^a-z0-9.]+/g, "");
}

function findPreferredModel(models: ModelDetectionResult[], preferredIds: string[]) {
  const normalizedPreferences = preferredIds.map(normalizeModelId);
  for (const id of normalizedPreferences) {
    const match = models.find(model => normalizeModelId(model.modelId) === id);
    if (match) return match;
  }
  return null;
}

function findGptImage2Model(models: ModelDetectionResult[]) {
  return (
    findPreferredModel(models, ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"]) ??
    findPreferredModel(models, ["gpt-image-2", "gptimage2"]) ??
    sortByScore(
      models.filter((model) => /^gpt[-_\s]?image[-_\s]?2(?:[-_\s]|$)/i.test(model.modelId)),
      (model) => (model.modelId.toLowerCase() === "gpt-image-2" ? 100 : 90),
    )[0] ??
    null
  );
}

const COST_EFFECTIVE_TEXT_MODELS = [
  "gpt-6-luna",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1",
];

function findCostEffectiveTextModel(models: ModelDetectionResult[]) {
  return findPreferredModel(models, COST_EFFECTIVE_TEXT_MODELS);
}

function scoreTextCandidate(model: ModelDetectionResult) {
  const id = model.modelId.toLowerCase();
  let score = 0;

  if (COST_EFFECTIVE_TEXT_MODELS.map(normalizeModelId).includes(normalizeModelId(id))) score += 80;
  if (/(mini|nano|flash|lite|turbo)/i.test(id)) score += 12;
  if (model.capabilities.text) score += 20;
  if (model.capabilities.structured_output) score += 8;
  if (model.capabilities.vision) score += 6;
  if (model.capabilities.high_quality) score += 5;
  if (model.capabilities.fast) score += 2;
  if (model.capabilities.cheap) score += 8;
  if (/(pro|max|opus|sonnet|reasoner|plus|5|4\.1|4-)/i.test(id)) score += 3;
  if (/gpt-5\.5|gpt-5\.4-pro|gpt-5\.5-pro|pro|max/i.test(id)) score -= 18;
  if (isPreviewOrTest(id)) score -= 8;
  if (/(image|imagen|dall|flux|recraft|seedream|jimeng|midjourney|ideogram|cogview|audio|tts|speech|embedding|rerank|moderation)/i.test(id)) {
    score -= 12;
  }

  return score;
}

function scoreImageCandidate(model: ModelDetectionResult) {
  const id = model.modelId.toLowerCase();
  let score = 0;

  if (normalizeModelId(id) === "gptimage2") score += 100;
  if (/^gpt[-_\s]?image[-_\s]?2(?:[-_\s]|$)/i.test(id)) score += 90;
  if (hasRealImageGeneration(model)) score += 30;
  if (hasRealImageEdit(model)) score += 8;
  if (model.capabilities.high_quality) score += 5;
  if (/(gpt[-_\s]?image|chatgpt-image|banana|nano-banana|imagen|dall[-_\s]?e|flux|recraft|seedream|jimeng|midjourney|ideogram|hidream|kolors|wanx|cogview)/i.test(id)) {
    score += 10;
  }
  if (/(pro|max|ultra|quality)/i.test(id)) score += 3;
  if (/(mini|flash|lite)/i.test(id)) score += 1;
  if (isPreviewOrTest(id)) score -= 6;

  return score;
}

export function recommendDefaultModels(models: ModelDetectionResult[]) {
  models = models.filter(model => model.isAvailable !== false);
  const visionModels = models.filter(isVisionCandidate);
  const textModels = models.filter(isTextGenerationCandidate);
  const stableImageGenerationModels = models.filter(
    (item) => hasRealImageGeneration(item) && isStableImageCandidate(item.modelId),
  );
  const imageGenerationModels = models.filter((item) => hasRealImageGeneration(item));
  const stableImageEditModels = models.filter(
    (item) => hasRealImageEdit(item) && isStableImageCandidate(item.modelId),
  );
  const imageEditModels = models.filter((item) => hasRealImageEdit(item));

  const analysisModel =
    findCostEffectiveTextModel(visionModels) ??
    sortByScore(visionModels.filter((item) => !isPreviewOrTest(item.modelId)), scoreTextCandidate)[0] ??
    sortByScore(visionModels, scoreTextCandidate)[0] ??
    null;

  const planningModel =
    findCostEffectiveTextModel(textModels) ??
    sortByScore(textModels.filter((item) => item.capabilities.structured_output && !isPreviewOrTest(item.modelId)), scoreTextCandidate)[0] ??
    sortByScore(textModels.filter((item) => !isPreviewOrTest(item.modelId)), scoreTextCandidate)[0] ??
    sortByScore(textModels, scoreTextCandidate)[0] ??
    null;

  const heroImageModel =
    findGptImage2Model(imageGenerationModels) ??
    sortByScore(stableImageGenerationModels, scoreImageCandidate)[0] ??
    sortByScore(imageGenerationModels, scoreImageCandidate)[0] ??
    null;

  const detailImageModel =
    findGptImage2Model(imageGenerationModels) ??
    sortByScore(
      stableImageGenerationModels.filter((item) => /detail|pro|max|ultra|quality|gpt[-_\s]?image|imagen|flux|dall[-_\s]?e|seedream|jimeng|midjourney|ideogram|cogview/i.test(item.modelId)),
      scoreImageCandidate,
    )[0] ??
    sortByScore(stableImageGenerationModels, scoreImageCandidate)[0] ??
    heroImageModel;

  const imageEditModel =
    findGptImage2Model(imageEditModels) ??
    sortByScore(stableImageEditModels, scoreImageCandidate)[0] ??
    sortByScore(imageEditModels, scoreImageCandidate)[0] ??
    null;

  return {
    analysisModelId: analysisModel?.modelId ?? null,
    planningModelId: planningModel?.modelId ?? null,
    heroImageModelId: heroImageModel?.modelId ?? null,
    detailImageModelId: detailImageModel?.modelId ?? null,
    imageEditModelId: imageEditModel?.modelId ?? null,
  };
}
