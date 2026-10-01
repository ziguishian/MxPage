"use client";
import { heroCountOptions, detailCountOptions } from "@/lib/utils/image-counts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { platformLabels, platformOptions } from "@/types/domain";
import { contentLanguageLabels, contentLanguageOptions } from "@/lib/utils/content-language";
import { categoryProfiles, categoryKeys } from "@/lib/detail-runs/merchandising";
import { creativePreferences, isStyleReference } from "@/lib/utils/asset-purpose";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import { StyleReferencePicker } from "./style-reference-picker";

type Brief = { name: string; description: string; visualDirection: string; recommendedVisualDirection?: string; category?: keyof typeof categoryProfiles; uncertainties: string[]; recognition?: { modelId: string; imageCount: number; detail: "high"; analyzedAt: string; reviewed?: boolean; detailViewCount?: number; corrections?: string[] } };
type Project = { id: string; name: string; description: string | null; platform: string; modelSnapshot: Record<string, any> | null; assets: { id: string; url: string; type: string; metadata?: unknown; fileName?: string }[] };
async function data(response: Response) { const body = await response.json(); if (!body.success) throw new Error(body.error?.message || "请求失败"); return body.data; }
export function ConfigureProject({ project }: { project: Project }) {
  const router = useRouter();
  const snapshot = project.modelSnapshot || {};
  const saved = snapshot.previewConfig || {};
  const confirmed = snapshot.creationConfigured;
  const [brief, setBrief] = useState<Brief | null>(snapshot.creationBrief || null);
  const [name, setName] = useState(confirmed ? project.name : snapshot.creationBrief?.name || project.name);
  const [description, setDescription] = useState(confirmed ? project.description || "" : snapshot.creationBrief?.description || project.description || "");
  const [direction, setDirection] = useState(creativePreferences(snapshot).userDirection);
  const [styleFiles, setStyleFiles] = useState<File[]>([]);
  const [styleAssets, setStyleAssets] = useState(project.assets.filter(isStyleReference));
  const uploadedFiles = useRef(new Set<File>());
  const productAssets = project.assets.filter(a => !isStyleReference(a));
  const [platform, setPlatform] = useState(project.platform);
  const [language, setLanguage] = useState(saved.contentLanguage || "zh-CN");
  const [heroCount, setHeroCount] = useState(saved.heroImageCount || 4);
  const [detailCount, setDetailCount] = useState(saved.detailSectionCount || 6);
  const [quality, setQuality] = useState(saved.quality || "auto");
  const [category, setCategory] = useState<keyof typeof categoryProfiles | "auto">(snapshot.commerceCategory || "auto");
  const [analyzing, setAnalyzing] = useState(!brief);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const analysisPending = useRef(false);
  const locked = useRef(false);
  const key = useRef("");
  const dirty = useRef(new Set<string>());
  async function analyze(force = false, resume = false) {
    if (analysisPending.current) return;
    analysisPending.current = true;
    setAnalyzing(true); setError("");
    try {
      const result: Brief = await data(await fetch(`/api/projects/${project.id}/brief`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force, resume }) }));
      setBrief(result);
      if (!confirmed && !dirty.current.has("name")) setName(result.name);
      if (!confirmed && !dirty.current.has("description")) setDescription(result.description);
    } catch (e) { setError(e instanceof Error ? e.message : "分析失败"); }
    finally { analysisPending.current = false; setAnalyzing(false); }
  }
  useEffect(() => { if (!started.current && !brief) { started.current = true; void analyze(); } }, []);
  async function generate() {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      for (const file of styleFiles) {
        if (uploadedFiles.current.has(file)) continue;
        const asset = await data(await fetch(`/api/projects/${project.id}/assets/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "REFERENCE", purpose: "style_reference", ...await fileToBase64Payload(file) }) }));
        uploadedFiles.current.add(file);
        setStyleAssets(previous => [...previous, asset]);
        setStyleFiles(previous => previous.filter(f => f !== file));
      }
      await data(await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, platform, modelSnapshot: { ...snapshot, creationBrief: brief, creationConfigured: true, commerceCategory: category, creativePreferences: { version: 2, userDirection: direction }, previewConfig: { ...saved, heroImageCount: heroCount, detailSectionCount: detailCount, contentLanguage: language, imageAspectRatio: "3:4", quality } } }) }));
      key.current ||= crypto.randomUUID();
      await data(await fetch(`/api/projects/${project.id}/detail-runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: key.current, language, heroCount, detailCount, quality }) }));
      router.push(`/projects/${project.id}/editor`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "启动失败"); }
    finally { locked.current = false; setBusy(false); }
  }
  async function removeStyle(id: string) {
    setBusy(true);
    try { await data(await fetch(`/api/projects/${project.id}/assets/${id}`, { method: "DELETE" })); setStyleAssets(previous => previous.filter(a => a.id !== id)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "移除失败"); }
    finally { setBusy(false); }
  }
  const recommended = categoryProfiles[category === "auto" ? brief?.category || "everyday" : category]?.art || brief?.recommendedVisualDirection;
  return <div className="mx-auto max-w-5xl space-y-8 py-6">
    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
    <header><p className="text-sm text-muted-foreground">商品已就位</p><h1 className="mt-2 text-3xl font-semibold">确认创作方向</h1><p className="mt-3 text-muted-foreground">Agent 先理解商品，你来决定最终呈现。</p></header>
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <aside className="space-y-4"><div className="aspect-square overflow-hidden rounded-3xl border bg-card"><img src={productAssets.find(a => a.type === "MAIN")?.url || productAssets[0]?.url} alt="商品主图" className="h-full w-full object-contain"/></div><div className="flex flex-wrap gap-2">{productAssets.filter(a => ["MAIN", "ANGLE", "DETAIL", "REFERENCE"].includes(a.type)).map(a => <img key={a.id} src={a.url} alt="商品素材" className="h-16 w-16 rounded-xl border bg-card object-contain"/>)}</div><p className="text-xs leading-6 text-muted-foreground">分析建议来自图片识别。文字、规格和细节仍可能误读，请结合原图核实后生成。</p></aside>
      <div className="space-y-6">
        <div role="status" className="rounded-2xl border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-medium">{analyzing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}{analyzing ? "Agent 正在识别商品和建议视觉方向…" : error ? "暂时无法完成分析" : brief && !brief.recognition ? "历史预填，建议重新识别" : "Agent 已预填，可自由调整"}</div>{brief && !error && <Button variant="outline" size="sm" disabled={analyzing || busy} onClick={() => analyze(true)}><RefreshCw className="mr-2 h-3.5 w-3.5"/>重新识别</Button>}</div>
          {brief?.recognition && <p className="mt-3 break-words text-xs text-muted-foreground">识别模型：{brief.recognition.modelId} · {brief.recognition.imageCount} 张素材 · {brief.recognition.reviewed ? `${brief.recognition.detailViewCount} 个局部视图已复核` : "此结果尚未进行局部复核，建议重新识别"}</p>}
          {!!brief?.recognition?.corrections?.length && <details className="mt-3 text-xs text-muted-foreground"><summary>查看本次复核修正</summary><ul className="mt-2 list-disc space-y-1 pl-4">{brief.recognition.corrections.map((text, i) => <li key={i}>{text}</li>)}</ul></details>}
          {brief && !brief.recognition && <p className="mt-3 text-xs text-muted-foreground">此历史结果未记录识别模型，可点击重新识别。</p>}
          {(confirmed || dirty.current.size > 0) && <p className="mt-2 text-xs text-muted-foreground">重新识别会保留已确认或手动修改的内容。</p>}
          {error && <div className="mt-3 space-y-3"><p className="text-muted-foreground">{error}</p><Button variant="outline" size="sm" disabled={analyzing || busy} onClick={() => analyze(false, true)}>重试分析</Button><Link href="/settings/providers" className="ml-3 underline">检查 AI 配置</Link></div>}
          {!!brief?.uncertainties.length && <ul className="mt-3 list-disc space-y-1 pl-4 text-muted-foreground">{brief.uncertainties.map((text, i) => <li key={i}>{text}</li>)}</ul>}
        </div>
        <fieldset disabled={busy} className="space-y-5">
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4"><label className="block space-y-2 text-sm">商品品类<Select value={category} onValueChange={v => setCategory(v as typeof category)}><option value="auto">由 Agent 识别并推荐</option>{categoryKeys.map(c => <option key={c} value={c}>{categoryProfiles[c].label}</option>)}</Select></label><p className="text-xs leading-6 text-muted-foreground">{category === "auto" ? "根据商品品类规划卖点顺序、场景和版式。上传图用于保持商品一致，成品会重新设计光线、背景与构图。" : categoryProfiles[category].story}</p>{category !== "auto" && <p className="text-xs leading-6 text-muted-foreground">{categoryProfiles[category].art}</p>}</div>
          <label className="block space-y-2 text-sm">商品名称<Input value={name} maxLength={80} onChange={e => { dirty.current.add("name"); setName(e.target.value); }}/></label>
          <label className="block space-y-2 text-sm">商品描述与卖点<Textarea value={description} rows={4} maxLength={4000} placeholder="补充准确规格、卖点或目标人群" onChange={e => { dirty.current.add("description"); setDescription(e.target.value); }}/></label>
          {recommended && <div className="rounded-xl bg-muted/40 p-4 text-sm"><p className="font-medium">AI 推荐方向</p><p className="mt-2 leading-6 text-muted-foreground">{recommended}</p><p className="mt-2 text-xs text-muted-foreground">视觉导演会结合案例调整摄影、布景和排版，这不是你的强制要求。</p></div>}
          <label className="block space-y-2 text-sm">自定义视觉要求（可选）<Textarea value={direction} rows={3} maxLength={1200} placeholder="例如：用深蓝与银色，呈现克制的科技感。留空由视觉导演设计。" onChange={e => { dirty.current.add("direction"); setDirection(e.target.value); }}/></label>
          <StyleReferencePicker files={styleFiles} onChange={setStyleFiles} stored={styleAssets} onRemoveStored={removeStyle} disabled={busy}/>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-sm">发布平台<Select value={platform} onValueChange={setPlatform}>{platformOptions.map(p => <option key={p} value={p}>{platformLabels[p]}</option>)}</Select></label>
            <label className="space-y-2 text-sm">图片语言<Select value={language} onValueChange={setLanguage}>{contentLanguageOptions.map(l => <option key={l} value={l}>{contentLanguageLabels[l]}</option>)}</Select></label>
            <label className="space-y-2 text-sm">头图数量<Select value={heroCount} onValueChange={v => setHeroCount(Number(v))}>{heroCountOptions.map(n => <option key={n}>{n}</option>)}</Select></label>
            <label className="space-y-2 text-sm">详情图数量<Select value={detailCount} onValueChange={v => setDetailCount(Number(v))}>{detailCountOptions.map(n => <option key={n}>{n}</option>)}</Select></label>
          </div>
          <label className="block space-y-2 text-sm">图像画质<Select value={quality} onValueChange={setQuality}><option value="auto">自动 · 由模型决定</option><option value="low">低 · 快速预览</option><option value="medium">中 · 平衡质量与速度</option><option value="high">高 · 优先细节表现</option></Select></label>
          <Button className="h-12 w-full" disabled={analyzing || !brief || name.trim().length < 2 || busy} onClick={generate}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{busy ? "正在启动…" : `确认并生成 ${heroCount + detailCount} 张图片`}</Button>
          <p className="text-xs leading-6 text-muted-foreground">头图 1:1，详情图 3:4。按画面任务设计图文节奏；每张最多自动修正一次，存疑图片保留并标记。画质影响耗时和费用。</p>
        </fieldset>
      </div>
    </div>
  </div>;
}
