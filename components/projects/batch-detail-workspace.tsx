"use client";
import { heroCountOptions, detailCountOptions } from "@/lib/utils/image-counts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { groupProductFiles } from "@/lib/detail-runs/batch-files";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import { contentLanguageLabels, contentLanguageOptions, type ContentLanguage } from "@/lib/utils/content-language";
import { platformLabels, platformOptions } from "@/types/domain";
import { StyleReferencePicker } from "./style-reference-picker";

type Group = { key: string; name: string; files: File[] };
type Batch = { id: string; status: string; error?: string | null; items: { projectId: string; ready?: boolean; language?: ContentLanguage; runId?: string; name: string; status: string; message: string; images: { id: string; type: string; url: string | null }[] }[] };
const labels: Record<string, string> = { QUEUED: "等待生成", RUNNING: "生成中", PENDING: "准备中", COMPLETED: "已完成", PARTIAL: "部分完成 · 需检查", WAITING_INPUT: "需要补充信息", FAILED: "未完成", INTERRUPTED: "已中断", CANCELED: "已停止" };
async function data(response: Response) { const body = await response.json(); if (!body.success) throw new Error(body.error?.message || "请求失败"); return body.data; }
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(data);

export function BatchDetailWorkspace({ translation = false }: { translation?: boolean }) {
  const storageKey = translation ? "mxpage:last-translation-batch" : "mxpage:last-detail-batch";
  const [uploadMode, setUploadMode] = useState<"single" | "multiple" | "folder">("single");
  const [languages, setLanguages] = useState<ContentLanguage[]>(["en-US"]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ignored, setIgnored] = useState(0);
  const [platform, setPlatform] = useState("general_ecommerce");
  const [language, setLanguage] = useState("zh-CN");
  const [quality, setQuality] = useState("auto");
  const [heroCount, setHeroCount] = useState(4);
  const [detailCount, setDetailCount] = useState(6);
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState("");
  const [styleFiles, setStyleFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchId, setBatchId] = useState<string>();
  const [pollError, setPollError] = useState("");
  const [prepared, setPrepared] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const upload = useRef<{ id: string; projects: { id: string; uploaded: number; styleUploaded: number }[] }>({ id: "", projects: [] });
  const [previews, setPreviews] = useState<string[]>([]);
  const running = !!batch && ["PENDING", "RUNNING"].includes(batch.status);
  useEffect(() => { try { const id = localStorage.getItem(storageKey); if (id) setBatchId(id); } catch {} }, []);
  useEffect(() => { const urls = groups.map(g => URL.createObjectURL(g.files[0])); setPreviews(urls); return () => urls.forEach(URL.revokeObjectURL); }, [groups]);
  useEffect(() => {
    if (!batchId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const value = await data(await fetch(`/api/detail-batches/${batchId}`, { cache: "no-store" })); if (!disposed) { setBatch(value); setPollError(""); } }
      catch (error) { if (!disposed) setPollError(error instanceof Error ? error.message : "读取进度失败"); }
      finally { if (!disposed) timer = setTimeout(poll, 2500); }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [batchId]);
  function choose(files: File[]) {
    try {
      if (translation && uploadMode !== "folder") {
        if (!files.length || files.length > (uploadMode === "single" ? 1 : 30)) throw new Error(uploadMode === "single" ? "单张翻译请选择一张图片。" : "每套最多 30 张图片。");
        if (files.some(f => !/\.(png|jpe?g|webp)$/i.test(f.name) || f.size > 10 * 1024 * 1024)) throw new Error("支持 PNG、JPEG、WebP，每张不超过 10MB。");
        const ordered = [...files].sort((a,b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
        setGroups([{ key: "images", name: ordered[0].name.replace(/\.[^.]+$/, ""), files: ordered }]); setIgnored(0); return;
      }
      const result = groupProductFiles(files, translation ? 30 : 8);
      if (!result.groups.length) throw new Error("文件夹中没有 PNG、JPEG 或 WebP 图片。");
      setGroups(result.groups); setIgnored(result.ignored); upload.current = { id: "", projects: [] }; setPrepared(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "文件夹读取失败"); }
  }
  async function start() {
    if (pending.current || !groups.length || running || (translation && !languages.length)) return;
    pending.current = true; setBusy(true); setPrepared(true);
    upload.current.id ||= crypto.randomUUID();
    try {
      for (const [index, group] of groups.entries()) {
        setStage(`准备商品 ${index + 1}/${groups.length}：${group.name}`);
        let saved = upload.current.projects[index];
        if (!saved) {
          const p = await post("/api/projects", { name: group.name.slice(0, 80).padEnd(2, "商品"), platform, style: "generic_clean", description });
          saved = { id: p.id, uploaded: 0, styleUploaded: 0 }; upload.current.projects[index] = saved;
        }
        for (let i = saved.uploaded; i < group.files.length; i++) {
          await post(`/api/projects/${saved.id}/assets/upload`, { type: i === 0 ? "MAIN" : "ANGLE", ...await fileToBase64Payload(group.files[i]) });
          saved.uploaded = i + 1;
        }
        if (!translation) {
          for (let i = saved.styleUploaded; i < styleFiles.length; i++) {
            await post(`/api/projects/${saved.id}/assets/upload`, { type: "REFERENCE", purpose: "style_reference", ...await fileToBase64Payload(styleFiles[i]) });
            saved.styleUploaded = i + 1;
          }
          await data(await fetch(`/api/projects/${saved.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelSnapshot: { creativePreferences: { version: 2, userDirection: direction } } }) }));
        }
      }
      setStage("检查模型配置并启动批量任务…");
      const result = await post("/api/detail-batches", { id: upload.current.id, projectIds: upload.current.projects.map(p => p.id), options: { language, quality, heroCount, detailCount }, ...(translation ? { translations: languages, translationInstruction: description } : {}) });
      setBatch(result); setBatchId(result.id);
      try { localStorage.setItem(storageKey, result.id); } catch {}
    } catch (error) { toast.error(error instanceof Error ? error.message : "启动失败"); }
    finally { pending.current = false; setBusy(false); setStage(""); }
  }
  async function control(action: "cancel" | "resume") {
    if (!batchId || pending.current) return;
    pending.current = true; setBusy(true);
    try { setBatch(await post(`/api/detail-batches/${batchId}`, { action })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "操作失败"); }
    finally { pending.current = false; setBusy(false); }
  }
  function reset() {
    setBatch(null); setBatchId(undefined); setGroups([]); setStyleFiles([]); setPrepared(false); upload.current = { id: "", projects: [] };
    try { localStorage.removeItem(storageKey); } catch {}
  }
  return <section className="mx-auto max-w-4xl space-y-7 py-6">
    <header><p className="text-sm text-muted-foreground">MxPage · {translation ? "详情页翻译" : "批量详情页"}</p><h1 className="mt-3 text-3xl font-semibold">{translation ? "一套详情页，面向多种语言" : "一整个文件夹，逐套完成"}</h1><p className="mt-4 text-muted-foreground">{translation ? "上传已有详情图，选择多个目标语言。每种语言独立保存，完成即可预览和下载。" : "每张独立商品图，或每个商品子文件夹，生成一套详情页。完成一套，立即展示一套。"}</p></header>
    {!batch && <>
      <fieldset disabled={busy || prepared} className="space-y-6 disabled:opacity-70">
        {translation && <div className="flex flex-wrap gap-2" role="group" aria-label="翻译上传模式">{(["single", "multiple", "folder"] as const).map(mode => <Button key={mode} type="button" variant={uploadMode === mode ? "default" : "outline"} aria-pressed={uploadMode === mode} onClick={() => { setUploadMode(mode); setGroups([]); }}>{mode === "single" ? "单张翻译" : mode === "multiple" ? "多张翻译" : "文件夹批量"}</Button>)}</div>}
        <input key={translation ? uploadMode : "folder"} ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple={!translation || uploadMode !== "single"} {...(!translation || uploadMode === "folder" ? { webkitdirectory: "", directory: "" } : {})} className="hidden" aria-label="选择待处理图片" onChange={e => { choose(Array.from(e.target.files || [])); e.target.value = ""; }}/>
        <div onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = !busy && !prepared && translation && uploadMode !== "folder" ? "copy" : "none"; }} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!busy && !prepared && translation && uploadMode !== "folder") choose(Array.from(e.dataTransfer.files)); }} className="mx-auto flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-input bg-background p-6 text-center"><FolderOpen className="h-9 w-9 text-muted-foreground"/><p className="font-medium">{translation && uploadMode !== "folder" ? "拖入此方框或选择详情图片" : "选择包含图片的文件夹"}</p><p className="text-sm leading-6 text-muted-foreground">{translation && uploadMode !== "folder" ? "保留商品、配色和排版，翻译图中文字" : "平铺图片：每张一套；子文件夹：每个文件夹一套"}</p><Button variant="outline" onClick={() => input.current?.click()}>{translation && uploadMode !== "folder" ? "选择图片" : groups.length ? "重新选择文件夹" : "选择文件夹"}</Button><p className="text-xs text-muted-foreground">{translation ? "每套最多 30 张" : "每商品最多 8 张"} · 单图 10MB · 文件夹最多 50 套</p></div>
        {translation && <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">目标语言（可多选）</legend><div className="flex flex-wrap gap-2">{contentLanguageOptions.map(l => <label key={l} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={languages.includes(l)} onChange={e => setLanguages(e.target.checked ? [...languages,l] : languages.filter(v=>v!==l))}/>{contentLanguageLabels[l]}</label>)}</div></fieldset>}
        {!!groups.length && <div className="space-y-3"><p className="text-sm font-medium">识别到 {groups.length} 套，共 {groups.reduce((n,g)=>n+g.files.length,0)} 张图片{ignored > 0 ? `，已忽略 ${ignored} 个非图片文件` : ""}</p><p className="text-xs text-muted-foreground">{translation ? "图片按文件名自然排序，每个目标语言保留相同顺序。" : "按文件名自然排序，第一张作为主图。"}</p><div className="grid max-h-80 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">{groups.map((group,i) => <div key={group.key} className="relative flex items-center gap-3 rounded-xl border bg-card p-3"><img src={previews[i]} alt="" className="h-12 w-12 rounded-lg object-contain"/><div className="min-w-0"><p className="truncate pr-3 text-sm">{group.name}</p><p className="text-xs text-muted-foreground">{group.files.length} 张素材</p></div><button type="button" aria-label={`移除商品 ${group.name}`} className="absolute right-1 top-1 p-1" onClick={() => setGroups(groups.filter((_,j)=>j!==i))}><X size={12}/></button></div>)}</div></div>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {!translation && <label className="space-y-2 text-sm">发布平台<Select value={platform} onValueChange={setPlatform}>{platformOptions.map(p=><option key={p} value={p}>{platformLabels[p]}</option>)}</Select></label>}
          {!translation && <label className="space-y-2 text-sm">图片语言<Select value={language} onValueChange={setLanguage}>{contentLanguageOptions.map(l=><option key={l} value={l}>{contentLanguageLabels[l]}</option>)}</Select></label>}
          <label className="space-y-2 text-sm">图像画质<Select value={quality} onValueChange={setQuality}><option value="auto">自动</option><option value="low">低 · 快速</option><option value="medium">中 · 平衡</option><option value="high">高 · 精细</option></Select></label>
          {!translation && <label className="space-y-2 text-sm">每商品头图<Select value={heroCount} onValueChange={v=>setHeroCount(Number(v))}>{heroCountOptions.map(n=><option key={n}>{n}</option>)}</Select></label>}
          {!translation && <label className="space-y-2 text-sm">每商品详情图<Select value={detailCount} onValueChange={v=>setDetailCount(Number(v))}>{detailCountOptions.map(n=><option key={n}>{n}</option>)}</Select></label>}
        </div>
        <label className="block space-y-2 text-sm">{translation ? "翻译要求或专有名词（可选）" : "整批商品补充信息（可选）"}<Textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} placeholder={translation ? "例如品牌名称保留原文、特定词语的翻译。" : "例如商品用途、已确认规格或目标人群。"}/></label>
        {!translation && <><label className="block space-y-2 text-sm">整批自定义视觉要求（可选）<Textarea value={direction} onChange={e=>setDirection(e.target.value)} maxLength={1200} placeholder="留空时，按每件商品选择摄影、配色和构图。"/></label><StyleReferencePicker files={styleFiles} onChange={setStyleFiles} disabled={busy || prepared} batch/></>}
      </fieldset>
      <Button className="h-12 w-full" disabled={busy || !groups.length || (translation && !languages.length)} onClick={start}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{busy ? stage : translation ? `开始翻译 · ${languages.length} 种语言 / ${groups.reduce((n,g)=>n+g.files.length,0)*languages.length} 张` : `开始批量生成 · ${groups.length} 套 / ${groups.length*(heroCount+detailCount)} 张`}</Button>
      <p className="text-xs leading-6 text-muted-foreground">{translation ? "每种语言直接从原图翻译，原图保留。完成一套即展示一套；每张最多自动修正一次。模糊文字、翻译和排版仍需人工核对，输出尺寸由图像模型决定。" : "确认分组后开始。逐商品生成，遇到需补问或失败的商品会保留现场并继续下一件；每张最多自动修正一次。任务启动后由服务端执行。"}</p>
    </>}
    {pollError && <p role="alert" className="text-sm text-destructive">{pollError} <Button variant="ghost" size="sm" onClick={reset}>清除本地批次视图</Button></p>}
    {batch && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"><div><p className="font-medium">已完成 {batch.items.filter(i=>i.status==="COMPLETED").length} / {batch.items.length} 套</p><p className="mt-1 text-sm text-muted-foreground">{running ? "正在后台逐套生成，可切换模式或刷新页面。" : batch.error || "全部生成完成"}</p></div><div className="flex gap-2">{running ? <Button disabled={busy} variant="outline" onClick={()=>control("cancel")}>停止批次</Button> : <><Button disabled={busy} variant="outline" onClick={reset}>新建批次</Button>{batch.status !== "SUCCESS" && <Button disabled={busy} onClick={()=>control("resume")}>继续未完成队列</Button>}</>}</div></div>
      {batch.items.map(item=><article key={item.projectId} className="space-y-4 rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{item.name}</h2>{item.language && <p className="mt-1 text-sm">{contentLanguageLabels[item.language]}</p>}<p className="mt-1 text-sm text-muted-foreground">{labels[item.status] || item.status} · {item.message}</p></div>{item.ready !== false && <Link className="shrink-0 text-sm underline" href={`/projects/${item.projectId}/editor`}>{item.status === "WAITING_INPUT" ? "补充信息" : "打开作品"}</Link>}</div>{item.images.length > 0 && <div className="flex gap-3 overflow-x-auto pb-2">{item.images.map(image=><Link key={image.id} href={`/projects/${item.projectId}/editor`} className="shrink-0"><img src={image.url || ""} alt={image.type === "HERO" ? "生成头图" : "生成详情图"} className="h-48 w-36 rounded-xl border object-contain"/></Link>)}</div>}{item.status === "COMPLETED" && <Link className="inline-block text-sm underline" href={`/api/projects/${item.projectId}/export/images`}>下载这一套 ZIP</Link>}</article>)}
    </div>}
  </section>;
}
