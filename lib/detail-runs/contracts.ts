import { HERO_MIN, HERO_MAX, DETAIL_MIN, DETAIL_MAX, TOTAL_IMAGE_MAX } from "@/lib/utils/image-counts";
import { z } from "zod";
import { contentLanguageOptions } from "@/lib/utils/content-language";
import type { ArtDirection, ArtReview } from "./art-direction";
import type { StyleReference } from "./reference-catalog";

export const detailRunInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  language: z.enum(contentLanguageOptions).default("zh-CN"),
  quality: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  heroCount: z.number().int().min(HERO_MIN).max(HERO_MAX).default(4),
  detailCount: z.number().int().min(DETAIL_MIN).max(DETAIL_MAX).default(6),
  mode: z.enum(["create", "xhs", "edit", "regenerate", "translate"]).default("create"),
  sectionId: z.string().optional(),
  instruction: z.string().trim().max(4000).default(""),
});
export type DetailRunInput = z.infer<typeof detailRunInputSchema>;
export const planSchema = z.object({
  productName: z.string().min(1),
  facts: z.array(z.string()).max(30),
  style: z.string().min(10).max(6000),
  sections: z.array(z.object({
    kind: z.enum(["HERO", "DETAIL"]),
    title: z.string().min(1),
    copy: z.string(),
    prompt: z.string().min(10).max(10000),
  })).min(1).max(TOTAL_IMAGE_MAX),
});
export const socialPostSchema = z.object({ title: z.string().min(1).max(200), caption: z.string().min(1).max(6000), hashtags: z.array(z.string().min(1).max(80)).min(3).max(8), language: z.enum(contentLanguageOptions) });
export const xhsPlanSchema = planSchema.extend({ post: socialPostSchema });
export type DetailPlan = z.infer<typeof planSchema> & { post?: z.infer<typeof socialPostSchema> };
export type ImageProgress = {
  sectionId: string;
  title: string;
  state: "pending" | "generating" | "generated" | "checked" | "uncertain";
  assetId?: string;
  correctionCount: number;
  check?: { passed: boolean; issues: string[]; assetId: string; visualQuality?: ArtReview };
  viewedAssetId?: string;
  error?: string;
  attemptKey?: string;
  retryRequested?: boolean;
};
export type RunCheckpoint = {
  failure?: { code: string; phase: string; message: string; networkCode?: string; fields?: string[]; at: string };
  creativeVersion?: 2 | 3;
  adaptations?: Partial<Record<"heroes" | "details", { status: "claimed" | "applied" | "skipped" | "failed"; reason: string; basis: string[]; sectionIds: string[] }>>;
  flexibleReview?: import("./flexible-creative").FlexibleReview;
  recommendedDirection?: string;
  styleReferences?: StyleReference[];
  designReview?: { passed: boolean; issues: { sectionIds: string[]; message: string; kind?: "fact" | "design" | "copy" | "typography"; resolved?: boolean }[] };
  designDraft?: ArtDirection;
  designPatches?: import("./design-review").CreativeReview["patches"];
  designAttempts?: number;
  firstHeroGate?: { sectionId: string; assetId?: string; passed: boolean; reason?: string };
  imageRequests?: number;
  reviewErrors?: Record<string, string>;
  continuationRunId?: string;
  plan?: DetailPlan;
  planDraft?: DetailPlan;
  planningReview?: { issues: string[] };
  artDirection?: ArtDirection;
  userVisualDirection?: string;
  images: ImageProgress[];
  questions?: { text: string; blocking: boolean; requiresImage: boolean }[];
  answers: string[];
  skippedQuestions?: boolean;
  toolCalls: number;
  events: { at: string; tool: string; sectionId?: string }[];
  agentSummary?: string;
  transport?: "responses" | "chat";
  modelId?: string;
  imageModelId?: string;
  editModelId?: string;
  providerId?: string;
  providerBaseUrl?: string;
  questionAssetCount?: number;
  setReview?: { passed: boolean; issues: { sectionIds: string[]; message: string }[]; assetIds: string[] };
};
export const RUN_ACTIVE = ["PENDING", "RUNNING", "WAITING_INPUT"];
export function outcome(images: ImageProgress[]) {
  return images.length > 0 && images.every(i => i.state === "checked" && i.check?.passed)
    ? "COMPLETED" : "PARTIAL";
}
export function mayGenerate(image: ImageProgress, correction: boolean) {
  if (image.state === "uncertain" || image.state === "generating") return false;
  return correction
    ? Boolean(image.assetId && image.check && !image.check.passed && image.correctionCount < 1)
    : !image.assetId;
}
