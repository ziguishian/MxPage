"use client";

import { HERO_MIN, HERO_MAX, DETAIL_MIN, DETAIL_MAX } from "@/lib/utils/image-counts";
import { Select } from "@/components/ui/select";


import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Languages, Loader2, MessageCircle, RotateCcw, Save, ShoppingCart, Sparkles, Star } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "@/hooks/use-editor-store";
import { contentLanguageLabels, contentLanguageOptions, normalizeContentLanguage, type ContentLanguage } from "@/lib/utils/content-language";

interface EditorWorkspaceProps {
  project: any;
}

type TaskPayload = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED";
  outputPayload?: {
    totalItems?: number;
    completedItems?: number;
    failedItems?: number;
    currentStep?: string;
    targetLanguage?: ContentLanguage;
  } | null;
  errorMessage?: string | null;
};
type ImageAspectRatio = "3:4" | "9:16";
type SectionKind =
  | "hero"
  | "selling_points"
  | "scenario"
  | "detail_closeup"
  | "specs"
  | "material"
  | "comparison"
  | "gift_scene"
  | "brand_trust"
  | "summary"
  | "custom";

interface PreviewConfig {
  heroImageCount: number;
  detailSectionCount: number;
  imageAspectRatio: ImageAspectRatio;
  contentLanguage: ContentLanguage;
}


const sectionTypeOptions: SectionKind[] = [
  "hero",
  "selling_points",
  "scenario",
  "detail_closeup",
  "specs",
  "material",
  "comparison",
  "gift_scene",
  "brand_trust",
  "summary",
  "custom",
];

const sectionTypeLabels: Record<SectionKind, string> = {
  hero: "头图主视觉",
  selling_points: "卖点模块",
  scenario: "场景展示",
  detail_closeup: "细节特写",
  specs: "规格参数",
  material: "材质工艺",
  comparison: "对比说明",
  gift_scene: "送礼场景",
  brand_trust: "品牌信任",
  summary: "总结收口",
  custom: "自定义模块",
};

const assetTypeLabels: Record<string, string> = {
  MAIN: "主商品图",
  ANGLE: "多角度图",
  DETAIL: "细节图",
  REFERENCE: "参考图",
  GENERATED: "生成图",
  EXPORTED: "导出文件",
};

const previewTexts: Partial<Record<
  ContentLanguage,
  {
    priceTag: string;
    reviewsTitle: string;
    reviewsSubtitle: string;
    detailTitle: string;
    detailSubtitle: (count: number) => string;
    heroPlaceholder: string;
    detailPlaceholder: string;
    customerService: string;
    cart: string;
    addToCart: string;
    buyNow: string;
  }
>> = {
  "zh-CN": {
    priceTag: "限时上新",
    reviewsTitle: "用户评价",
    reviewsSubtitle: "高频反馈帮助判断转化说服力",
    detailTitle: "详情展示",
    detailSubtitle: (count) => `按规划顺序展示 ${count} 个详情模块`,
    heroPlaceholder: "预留头图",
    detailPlaceholder: "该模块尚未生成图像",
    customerService: "客服",
    cart: "购物车",
    addToCart: "加入购物车",
    buyNow: "立即购买",
  },
  "en-US": {
    priceTag: "New Arrival",
    reviewsTitle: "Customer Reviews",
    reviewsSubtitle: "Recurring feedback helps judge conversion appeal",
    detailTitle: "Detail Gallery",
    detailSubtitle: (count) => `${count} detail sections shown in planned order`,
    heroPlaceholder: "Hero Slot",
    detailPlaceholder: "This section has not been generated yet",
    customerService: "Service",
    cart: "Cart",
    addToCart: "Add to Cart",
    buyNow: "Buy Now",
  },
  "ja-JP": {
    priceTag: "新着",
    reviewsTitle: "レビュー",
    reviewsSubtitle: "定番の感想から訴求力を確認できます",
    detailTitle: "詳細表示",
    detailSubtitle: (count) => `計画順に ${count} 個の詳細モジュールを表示`,
    heroPlaceholder: "ヘッド画像",
    detailPlaceholder: "このモジュールはまだ生成されていません",
    customerService: "相談",
    cart: "カート",
    addToCart: "カートに追加",
    buyNow: "今すぐ購入",
  },
  "ko-KR": {
    priceTag: "신상품",
    reviewsTitle: "리뷰",
    reviewsSubtitle: "반복되는 후기가 전환 설득력을 보여줍니다",
    detailTitle: "상세 이미지",
    detailSubtitle: (count) => `기획 순서대로 ${count}개의 상세 모듈을 표시`,
    heroPlaceholder: "헤드 이미지",
    detailPlaceholder: "이 모듈은 아직 생성되지 않았습니다",
    customerService: "상담",
    cart: "장바구니",
    addToCart: "장바구니 담기",
    buyNow: "바로 구매",
  },
};

function getPreviewConfig(project: any): PreviewConfig {
  const config = project?.modelSnapshot?.previewConfig ?? {};
  return {
    heroImageCount: Math.min(HERO_MAX, Math.max(HERO_MIN, Number(config.heroImageCount ?? 4))),
    detailSectionCount: Math.min(DETAIL_MAX, Math.max(DETAIL_MIN, Number(config.detailSectionCount ?? 6))),
    imageAspectRatio: config.imageAspectRatio === "3:4" ? "3:4" : "9:16",
    contentLanguage: normalizeContentLanguage(config.contentLanguage),
  };
}

function getAspectRatioClass(aspectRatio: ImageAspectRatio) {
  return aspectRatio === "3:4" ? "aspect-[3/4]" : "aspect-[9/16]";
}

function getGenerationLabel(section: any) {
  const mode = section?.currentImageAsset?.metadata?.mode;
  if (mode === "image_api") return "AI 真图";
  if (mode === "svg_fallback") return "SVG 兜底";
  return null;
}

function buildGalleryImages(project: any, heroImageCount: number) {
  const heroSections = project.sections.filter((section: any) => section.type === "HERO");
  const uploaded = project.assets.filter((asset: any) => ["MAIN", "ANGLE"].includes(asset.type));
  const plannedHeroImages = heroSections
    .filter((section: any) => Boolean(section.imageUrl))
    .map((section: any, index: number) => ({
      id: section.id,
      url: section.imageUrl,
      label: section.title || `头图 ${index + 1}`,
      generationLabel: section.currentImageAsset?.metadata?.mode === "svg_fallback" ? "SVG 兜底" : "AI 真图",
    }));

  const merged = [
    ...plannedHeroImages,
    ...uploaded.map((asset: any) => ({
      id: asset.id,
      url: asset.url,
      label: assetTypeLabels[asset.type] ?? asset.fileName,
      generationLabel: null,
    })),
  ];

  return merged
    .filter((item, index, list) => item.url && list.findIndex((entry) => entry.url === item.url) === index)
    .slice(0, Math.max(heroImageCount, heroSections.length));
}

function buildCommentCards(analysis: any) {
  const sellingPoints = analysis?.coreSellingPoints ?? [];
  const concerns = analysis?.userConcerns ?? [];
  const usageScenarios = analysis?.usageScenarios ?? [];

  return [
    {
      user: "晴晴小铺",
      content: sellingPoints[0] ?? "实物完成度很高，视觉表现和细节质感都很在线。",
      tag: usageScenarios[0] ?? "日常搭配",
    },
    {
      user: "晚风买家秀",
      content: sellingPoints[1] ?? "成片效果很稳，用来做商品详情展示很有说服力。",
      tag: usageScenarios[1] ?? "场景展示",
    },
    {
      user: "认真选物的人",
      content: concerns[0]
        ? `原本担心“${concerns[0]}”，到手后发现整体完成度和细节都不错。`
        : "之前顾虑的问题基本都被细节表现打消了，整体体验很满意。",
      tag: "真实反馈",
    },
  ];
}

function buildProductDescription(analysis: any, sections: any[]) {
  const heroSection = sections.find((section: any) => section.type === "HERO");
  const sellingPoints = (analysis?.coreSellingPoints ?? []).filter(Boolean).slice(0, 2);
  const focusPoints = (analysis?.recommendedFocusPoints ?? []).filter(Boolean).slice(0, 2);
  const styleTags = (analysis?.styleTags ?? []).filter(Boolean).slice(0, 2);

  const candidates = [
    heroSection?.copy,
    ...sellingPoints,
    ...focusPoints,
    styleTags.length > 0 ? `风格关键词：${styleTags.join(" / ")}` : null,
  ]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);

  if (candidates.length === 0) {
    return "商品描述将由 AI 结合主图、卖点和页面规划自动生成，并同步用于头图与详情图的图内表达。";
  }

  return candidates.join(" · ");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getActionText(action: string | null) {
  if (action === "generate") return "正在生成当前模块图，请稍候...";
  if (action === "regenerate") return "正在重新生成当前模块图，请稍候...";
  if (action === "repaint") return "正在基于当前图重绘，请稍候...";
  if (action === "enhance") return "正在基于当前图增强，请稍候...";
  return "";
}

export function EditorWorkspace({ project: initialProject }: EditorWorkspaceProps) {
  const [project, setProject] = useState(initialProject);
  const [checkedReferences, setCheckedReferences] = useState<string[]>([]);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState<ContentLanguage>("en-US");
  const { selectedSectionId, setSelectedSectionId } = useEditorStore();
  useEffect(() => {
    if (!selectedSectionId && initialProject.sections[0]) {
      setSelectedSectionId(initialProject.sections[0].id);
    }
  }, [initialProject.sections, selectedSectionId, setSelectedSectionId]);

  const previewConfig = useMemo(() => getPreviewConfig(project), [project]);
  const previewUi = useMemo(() => previewTexts[previewConfig.contentLanguage] ?? previewTexts["en-US"]!, [previewConfig.contentLanguage]);
  const selectedSection = useMemo(
    () => project.sections.find((section: any) => section.id === selectedSectionId) ?? project.sections[0] ?? null,
    [project.sections, selectedSectionId],
  );
  const referenceAssets = useMemo(
    () => project.assets.filter((asset: any) => ["REFERENCE", "DETAIL", "ANGLE"].includes(asset.type)),
    [project.assets],
  );
  const galleryImages = useMemo(() => buildGalleryImages(project, previewConfig.heroImageCount), [project, previewConfig.heroImageCount]);
  const activeHeroImage = galleryImages[selectedHeroIndex] ?? galleryImages[0] ?? null;
  const comments = useMemo(() => buildCommentCards(project.analysis?.normalizedResult), [project.analysis?.normalizedResult]);
  const productDescription = useMemo(
    () => buildProductDescription(project.analysis?.normalizedResult, project.sections),
    [project.analysis?.normalizedResult, project.sections],
  );
  const detailSections = useMemo(
    () => project.sections.filter((section: any) => section.type !== "HERO"),
    [project.sections],
  );
  const hasGeneratedImage = Boolean(selectedSection?.imageUrl);
  const generatedSections = useMemo(() => project.sections.filter((section: any) => Boolean(section.imageUrl)), [project.sections]);

  useEffect(() => {
    if (selectedHeroIndex >= galleryImages.length) {
      setSelectedHeroIndex(0);
    }
  }, [galleryImages.length, selectedHeroIndex]);

  const refreshProject = async () => {
    const response = await fetch(`/api/projects/${project.id}`);
    const payload = await response.json();
    if (payload.success) {
      setProject(payload.data);
    }
  };

  const saveSection = async () => {
    if (!selectedSection) return;

    const response = await fetch(`/api/projects/${project.id}/sections/${selectedSection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: String(selectedSection.type).toLowerCase(),
        title: selectedSection.title,
        goal: selectedSection.goal,
        copy: selectedSection.copy,
        visualPrompt: selectedSection.visualPrompt,
        editableData: selectedSection.editableData ?? {},
      }),
    });
    const payload = await response.json();
    if (!payload.success) {
      toast.error(payload.error?.message ?? "模块保存失败");
      return;
    }
    toast.success("模块已保存");
    await refreshProject();
  };

  const runGeneration = async (kind: "generate" | "regenerate") => {
    if (!selectedSection) return;
    setRunningAction(kind);

    try {
      const response = await fetch(`/api/projects/${project.id}/sections/${selectedSection.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceAssetIds: checkedReferences }),
      });
      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error?.message ?? "图像生成失败");
        return;
      }
      if (payload.data?.generationMode === "svg_fallback") {
        toast.warning("当前 Provider 没有可用真实图片端点，本次结果为 SVG 兜底预览，不是最终 AI 真图。");
      } else {
        toast.success(kind === "generate" ? "模块图已生成并自动保存到当前项目" : "模块图已重新生成并自动保存到版本历史");
      }
      await refreshProject();
    } finally {
      setRunningAction(null);
    }
  };

  const runImageEdit = async (editMode: "repaint" | "enhance" | "translate", targetLanguage?: ContentLanguage) => {
    if (!selectedSection) return;
    setRunningAction(editMode);

    try {
      const response = await fetch(`/api/projects/${project.id}/sections/${selectedSection.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceAssetIds: checkedReferences, editMode, targetLanguage }),
      });
      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error?.message ?? "基于当前图编辑失败");
        return;
      }
      if (payload.data?.generationMode === "svg_fallback") {
        toast.warning("当前 Provider 没有可用真实图片编辑端点，本次结果为 SVG 兜底预览。");
      } else {
        toast.success(editMode === "translate" ? "已将当前图转为目标语言，并自动保存新版本" : editMode === "repaint" ? "已基于当前图完成重绘，并自动保存新版本" : "已基于当前图完成增强，并自动保存新版本");
      }
      await refreshProject();
    } finally {
      setRunningAction(null);
    }
  };


  const translateGeneratedDetailPage = async () => {
    if (generatedSections.length === 0) {
      toast.error("请先生成至少一张详情页图片");
      return;
    }

    setRunningAction("translate-page");
    try {
      const response = await fetch(`/api/projects/${project.id}/translate-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceAssetIds: checkedReferences,
          targetLanguage: translationTargetLanguage,
        }),
      });
      const created = await response.json();
      if (!created.success || !created.data?.id) {
        throw new Error(created.error?.message ?? "整页语言转换任务启动失败");
      }

      for (;;) {
        const taskResponse = await fetch(`/api/tasks/${created.data.id}`, { cache: "no-store" });
        const taskPayload = await taskResponse.json();
        if (!taskPayload.success || !taskPayload.data) {
          throw new Error(taskPayload.error?.message ?? "读取整页语言转换任务失败");
        }

        const task = taskPayload.data as TaskPayload;
        const output = task.outputPayload ?? {};
        if (task.status === "SUCCESS") {
          const successCount = Number(output.completedItems ?? 0);
          const failedCount = Number(output.failedItems ?? 0);
          if (successCount > 0) {
            toast.success(`已翻译 ${successCount}/${generatedSections.length} 张详情页图片为${contentLanguageLabels[translationTargetLanguage]}`);
            await refreshProject();
          }
          if (failedCount > 0) {
            toast.error(`${failedCount} 张图片翻译失败，可在任务记录中重试。`);
          }
          break;
        }

        if (task.status === "FAILED" || task.status === "CANCELED") {
          throw new Error(task.errorMessage ?? "整页语言转换失败");
        }

        await sleep(1800);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "整页语言转换失败");
    } finally {
      setRunningAction(null);
    }
  };

  const activateVersion = async (versionId: string) => {
    if (!selectedSection) return;
    const response = await fetch(`/api/projects/${project.id}/sections/${selectedSection.id}/versions/${versionId}/activate`, { method: "PATCH" });
    const payload = await response.json();
    if (!payload.success) {
      toast.error(payload.error?.message ?? "版本切换失败");
      return;
    }
    toast.success("已切换到所选版本");
    await refreshProject();
  };

  const updateSelectedSection = (key: string, value: unknown) => {
    setProject((current: any) => ({
      ...current,
      sections: current.sections.map((section: any) => (section.id === selectedSection?.id ? { ...section, [key]: value } : section)),
    }));
  };
  return (
    <div className="grid min-h-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_380px] xl:items-stretch">
      <Card className="flex min-h-0 min-w-0 flex-col xl:h-[920px]">
        <CardHeader>
          <CardTitle>模块结构树</CardTitle>
          <CardDescription>查看模块顺序、生成状态和当前选中的编辑对象。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-3 pr-1">
            {project.sections.map((section: any, index: number) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                  section.id === selectedSection?.id
                    ? "border-primary bg-primary/5 dark:border-white/20 dark:bg-white/10"
                    : "border-border bg-white dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs tracking-[0.18em] text-muted-foreground">#{index + 1}</p>
                      <p className="truncate font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">{sectionTypeLabels[String(section.type).toLowerCase() as SectionKind] ?? section.type}</p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge value={section.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="max-w-full">
                      <span className="truncate">{sectionTypeLabels[String(section.type).toLowerCase() as SectionKind] ?? section.type}</span>
                    </Badge>
                    {getGenerationLabel(section) ? (
                      <Badge variant={getGenerationLabel(section) === "AI 真图" ? "success" : "outline"} className="max-w-full">
                        <span className="truncate">{getGenerationLabel(section)}</span>
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 min-w-0 flex-col xl:h-[920px]">
        <CardHeader>
          <CardTitle>手机商品页预览</CardTitle>
          <CardDescription>头图支持点击切换，详情图无缝衔接，底部栏贴边显示。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 items-stretch justify-center overflow-y-auto overflow-x-hidden">
          <div className="relative flex h-full max-h-full w-[396px] max-w-full flex-col overflow-hidden rounded-[3.2rem] border border-black/70 bg-[radial-gradient(circle_at_top,_#6b7280,_#1f2937_40%,_#030712_100%)] p-[10px] shadow-[0_30px_80px_rgba(15,23,42,0.38)]">
            <div className="pointer-events-none absolute left-1/2 top-[14px] z-20 h-[34px] w-[132px] -translate-x-1/2 rounded-full bg-black shadow-[0_8px_20px_rgba(0,0,0,0.38)]" />
            <div className="absolute left-[6px] top-[160px] h-[96px] w-[4px] rounded-full bg-white/15" />
            <div className="absolute right-[6px] top-[190px] h-[132px] w-[4px] rounded-full bg-white/15" />
            <div className="relative isolate flex h-full flex-col overflow-hidden rounded-[2.55rem] border border-white/10 bg-[#f7f7f7]">
              <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                <section className="bg-white">
                  <div className="overflow-hidden">
                    {galleryImages.length > 0 ? (
                      <div className="space-y-2">
                        <div className="relative aspect-square bg-slate-100">
                          {activeHeroImage ? <img src={activeHeroImage.url} alt={activeHeroImage.label} className="h-full w-full object-cover" /> : null}
                          {activeHeroImage?.generationLabel ? (
                            <div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">{activeHeroImage.generationLabel}</div>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                          {Array.from({ length: previewConfig.heroImageCount }).map((_, index) => {
                            const image = galleryImages[index];
                            const isActive = selectedHeroIndex === index;
                            return (
                              <button
                                key={image?.id ?? `placeholder-${index}`}
                                type="button"
                                onClick={() => image?.url && setSelectedHeroIndex(index)}
                                className={`relative aspect-square overflow-hidden rounded-2xl bg-slate-100 ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-white" : ""}`}
                              >
                                {image?.url ? (
                                  <>
                                    <img src={image.url} alt={image.label} className="h-full w-full object-cover" />
                                    {image.generationLabel ? (
                                      <div className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 px-1 py-0.5 text-center text-[10px] text-white">{image.generationLabel}</div>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">{previewUi.heroPlaceholder}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-slate-100 px-6 text-sm text-muted-foreground">{previewUi.heroPlaceholder}</div>
                    )}
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center gap-2 text-[#ff5a1f]">
                      <span className="text-2xl font-bold">￥39.90</span>
                      <span className="rounded-full bg-[#fff1eb] px-2 py-0.5 text-xs">{previewUi.priceTag}</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[17px] font-semibold text-slate-900">{project.analysis?.normalizedResult?.productName ?? project.name}</h3>
                      <p className="text-sm leading-6 text-slate-600">{productDescription}</p>
                    </div>
                  </div>
                </section>

                <section className="mt-2 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{previewUi.reviewsTitle}</p>
                      <p className="text-xs text-slate-500">{previewUi.reviewsSubtitle}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#ff8a00]">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-semibold">4.9</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {comments.map((comment, index) => (
                      <div key={`${comment.user}-${index}`} className="rounded-2xl bg-[#faf7f2] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">{comment.user}</p>
                          <span className="text-xs text-slate-500">{comment.tag}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border-t border-slate-100 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{previewUi.detailTitle}</p>
                      <p className="text-xs text-slate-500">{previewUi.detailSubtitle(detailSections.length)}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">比例 {previewConfig.imageAspectRatio}</span>
                  </div>
                </section>

                <div className="space-y-0 pb-0">
                  {detailSections.map((section: any) => (
                    <section key={section.id} className="bg-white">
                      {section.imageUrl ? (
                        <div className="relative bg-slate-100">
                          <img src={section.imageUrl} alt={section.title} className="w-full object-cover" />
                          {getGenerationLabel(section) ? (
                            <div className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">{getGenerationLabel(section)}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className={`flex items-center justify-center bg-slate-100 px-6 text-center text-sm text-muted-foreground ${getAspectRatioClass(previewConfig.imageAspectRatio)}`}>
                          {previewUi.detailPlaceholder}
                        </div>
                      )}
                    </section>
                  ))}
                  <div className="bg-white px-4 py-4 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Powered by MxPage
                  </div>
                </div>
              </div>

              <div className="overflow-hidden border-t border-border bg-transparent">
                <div className="grid w-full grid-cols-[0.78fr_0.92fr_1.15fr_1.15fr] gap-2 px-2 pb-1.5 pt-2">
                  <button
                    type="button"
                    className="flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700 active:scale-[0.98]"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{previewUi.customerService}</span>
                  </button>
                  <button
                    type="button"
                    className="flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700 active:scale-[0.98]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{previewUi.cart}</span>
                  </button>
                  <button
                    type="button"
                    className="h-10 min-w-0 overflow-hidden rounded-full bg-[#ffcc55] px-2 text-[11px] font-semibold text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="block truncate">{previewUi.addToCart}</span>
                  </button>
                  <button
                    type="button"
                    className="h-10 min-w-0 overflow-hidden rounded-full bg-[#ff5a1f] px-2 text-[11px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="block truncate">{previewUi.buyNow}</span>
                  </button>
                </div>
                <div className="pb-[max(8px,env(safe-area-inset-bottom))]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 min-w-0 flex-col xl:h-[920px]">
        <CardHeader>
          <CardTitle>模块编辑面板</CardTitle>
          <CardDescription>编辑模块内容、发起生成与重绘，并管理版本历史。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
          {!selectedSection ? (
            <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">请选择一个模块开始编辑。</div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">当前出图结果</span>
                  {getGenerationLabel(selectedSection) ? (
                    <Badge variant={getGenerationLabel(selectedSection) === "AI 真图" ? "success" : "outline"}>{getGenerationLabel(selectedSection)}</Badge>
                  ) : (
                    <Badge variant="outline">尚未生成</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">生成完成后会自动保存到项目资源、版本历史以及当前生效版本。</p>
              </div>

              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={String(selectedSection.type).toLowerCase()}
                  onValueChange={(value) => updateSelectedSection("type", value.toUpperCase())}
                >
                  {sectionTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {sectionTypeLabels[type]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>标题</Label>
                <Input value={selectedSection.title} onChange={(event) => updateSelectedSection("title", event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>模块目标</Label>
                <Input value={selectedSection.goal} onChange={(event) => updateSelectedSection("goal", event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>模块文案</Label>
                <Textarea value={selectedSection.copy} onChange={(event) => updateSelectedSection("copy", event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>双语视觉 Prompt</Label>
                <Textarea value={selectedSection.visualPrompt} onChange={(event) => updateSelectedSection("visualPrompt", event.target.value)} />
                <p className="text-xs text-muted-foreground">系统会要求图像模型把标题、卖点和 CTA 直接生成进图片中，而不是在页面外拼接文字。</p>
              </div>

              <div className="space-y-2">
                <Label>参考图</Label>
                {referenceAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">当前没有可选参考图</p>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-border p-3">
                    {referenceAssets.map((asset: any) => (
                      <label key={asset.id} className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={checkedReferences.includes(asset.id)}
                          onChange={(event) => {
                            setCheckedReferences((current) =>
                              event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                            );
                          }}
                        />
                        <span className="text-sm">{assetTypeLabels[asset.type] ?? asset.fileName}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">系统会自动把主商品图作为产品锚点，这里勾选的是额外参考图，会一起以 base64 方式发送给 AI。</p>
              </div>

              <div className="space-y-3 rounded-2xl border border-border p-3">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={saveSection} className="gap-2">
                    <Save className="h-4 w-4" />
                    保存
                  </Button>
                  <Button onClick={() => runGeneration(hasGeneratedImage ? "regenerate" : "generate")} disabled={Boolean(runningAction)} variant="outline" className="gap-2">
                    {runningAction === "generate" || runningAction === "regenerate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {hasGeneratedImage ? "重新生成当前图" : "生成当前模块图"}
                  </Button>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium">基于当前图优化</p>
                  <p className="mt-1 text-xs text-muted-foreground">已有当前图时，可选择重绘构图，或在保留现有构图基础上做增强。</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button onClick={() => runImageEdit("repaint")} disabled={!hasGeneratedImage || Boolean(runningAction)} variant="outline" className="gap-2">
                      {runningAction === "repaint" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      基于当前图重绘
                    </Button>
                    <Button onClick={() => runImageEdit("enhance")} disabled={!hasGeneratedImage || Boolean(runningAction)} variant="outline" className="gap-2">
                      {runningAction === "enhance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      基于当前图增强
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">详情页语言转换</p>
                      <p className="mt-1 text-xs text-muted-foreground">使用图像编辑能力逐张替换图内文字，尽量保留原构图、产品和视觉风格。</p>
                    </div>
                    <Badge variant="outline">{generatedSections.length} 张</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Select
                      value={translationTargetLanguage}
                      onValueChange={(value) => setTranslationTargetLanguage(normalizeContentLanguage(value))}
                    >
                      {contentLanguageOptions.map((language) => (
                        <option key={language} value={language}>
                          {contentLanguageLabels[language]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      onClick={translateGeneratedDetailPage}
                      disabled={generatedSections.length === 0 || Boolean(runningAction)}
                      variant="outline"
                      className="gap-2"
                    >
                      {runningAction === "translate-page" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                      一键转换整页
                    </Button>
                  </div>
                </div>
                {runningAction ? <p className="text-xs text-muted-foreground">{getActionText(runningAction)}</p> : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">版本历史</h3>
                  <Badge variant="outline">{selectedSection.versions?.length ?? 0} 个版本</Badge>
                </div>
                <div className="space-y-3">
                  {(selectedSection.versions ?? []).map((version: any) => (
                    <div key={version.id} className="rounded-2xl border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">v{version.versionNumber}</p>
                          <p className="text-xs text-muted-foreground">{version.isActive ? "当前生效版本" : "历史版本"}</p>
                        </div>
                        {!version.isActive ? (
                          <Button size="sm" variant="outline" onClick={() => activateVersion(version.id)}>
                            设为当前
                          </Button>
                        ) : (
                          <Badge variant="success">当前</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
