"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";

async function payload(response: Response) {
  const value = await response.json();
  if (!value.success) throw new Error(value.error?.message || "请求失败");
  return value.data;
}

export function QuickStartWorkspace() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [projectId, setProjectId] = useState<string>();
  const pending = useRef(false);
  const uploaded = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const uploadDisabled = busy || Boolean(projectId);
  // Outside the square, reject file drops instead of letting the browser open them.
  useEffect(() => {
    const rejectDrop = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", rejectDrop);
    window.addEventListener("drop", rejectDrop);
    return () => {
      window.removeEventListener("dragover", rejectDrop);
      window.removeEventListener("drop", rejectDrop);
    };
  }, []);
  function addFiles(incoming: File[]) {
    if (uploadDisabled || !incoming.length) return;
    const next = [...files, ...incoming];
    if (next.length > 8 || next.some(f => f.size > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(f.type))) {
      toast.error("支持 PNG、JPEG、WebP，最多 8 张，每张不超过 10MB");
      return;
    }
    setFiles(next);
  }
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (uploadDisabled || (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]'))) return;
      const images = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith("image/"));
      if (images.length) { event.preventDefault(); addFiles(images); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [files, uploadDisabled]);
  const dropHandlers = {
    onDragEnter(event: DragEvent<HTMLDivElement>) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault(); event.stopPropagation();
      if (!uploadDisabled) { dragDepth.current++; setDragging(true); }
    },
    onDragOver(event: DragEvent<HTMLDivElement>) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault(); event.stopPropagation();
      event.dataTransfer.dropEffect = uploadDisabled ? "none" : "copy";
    },
    onDragLeave(event: DragEvent<HTMLDivElement>) {
      event.preventDefault(); event.stopPropagation();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop(event: DragEvent<HTMLDivElement>) {
      event.preventDefault(); event.stopPropagation();
      dragDepth.current = 0; setDragging(false);
      addFiles(Array.from(event.dataTransfer.files));
    },
  };
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);
  async function start() {
    if (pending.current || !files.length) return;
    pending.current = true; setBusy(true);
    try {
      setStage("创建商品项目…");
      const project = projectId ? { id: projectId } : await payload(await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: files[0].name.replace(/\.[^.]+$/, "").slice(0, 80).padEnd(2, "商品"), platform: "general_ecommerce", style: "generic_clean", description: "" }) }));
      setProjectId(project.id);
      for (let index = uploaded.current; index < files.length; index++) {
        const file = files[index];
        setStage(`上传商品素材 ${index + 1}/${files.length}…`);
        await payload(await fetch(`/api/projects/${project.id}/assets/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: index === 0 ? "MAIN" : "ANGLE", ...await fileToBase64Payload(file) }) }));
        uploaded.current = index + 1;
      }

      router.push(`/projects/${project.id}/configure`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "创建失败"); }
    finally { pending.current = false; setBusy(false); setStage(""); }
  }
  return <div className="mx-auto max-w-4xl space-y-8 py-6">
    <div><p className="text-sm text-muted-foreground">MxPage · 一键详情页</p><h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">上传商品，交给 AI 完成整套详情页</h1><p className="mt-4 leading-7 text-muted-foreground">自动理解商品、设计整套风格、生成并检查图片。完成后直接修改和下载。</p></div>
    <fieldset disabled={busy || Boolean(projectId)} className="space-y-6 disabled:opacity-70">

      {!files.length && <div {...dropHandlers} className={`mx-auto flex aspect-square w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-4 text-center transition-colors focus-within:border-foreground/50 sm:p-6 ${dragging ? "border-foreground bg-muted ring-4 ring-foreground/10" : "border-input bg-background"}`}>
        <UploadCloud className="h-8 w-8 text-muted-foreground"/><span className="font-medium" role="status">{dragging ? "松开鼠标，添加商品图片" : "将商品图片拖到此方框，或点击选择"}</span><span className="text-sm text-muted-foreground">最多 8 张，每张不超过 10MB；第一张作为主图</span>
        <Button type="button" variant="outline" className="mt-1 gap-2 px-5" onClick={() => fileInput.current?.click()}><UploadCloud className="h-4 w-4"/>{files.length ? "继续添加图片" : "选择商品图片"}</Button>
        {files.length > 0 && <span className="text-xs text-muted-foreground" role="status">已选择 {files.length} / 8 张图片</span>}

      </div>}
        <input ref={fileInput} aria-label="上传商品图片" type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={e => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}/>
      {files.length > 0 && <div className="mx-auto w-full max-w-md space-y-4">
        <div {...dropHandlers} className="relative isolate aspect-square w-full" aria-label="商品图片堆叠预览，可拖入添加图片">{files.map((file, index) => <div key={file.name + index} className="upload-stack-card pointer-events-none absolute overflow-hidden rounded-3xl border bg-card shadow-sm" style={{inset: files.length > 1 ? "6%" : 0, zIndex: files.length - index, transform: `translateY(${-Math.min(index,4)*3}px) rotate(${index === 0 ? 0 : (index % 2 ? 1 : -1)*Math.min(index*2,7)}deg)`}}>
          <img src={previews[index]} alt={file.name} draggable={false} className="h-full w-full object-contain"/>
          {index === 0 && <span className="absolute left-3 top-3 rounded-full border bg-card px-3 py-1 text-xs">主图</span>}
        </div>)}{dragging && <div role="status" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-foreground bg-background/90 text-center font-medium ring-4 ring-foreground/10">松开鼠标，继续添加图片</div>}</div>
        <div className="flex flex-wrap justify-center gap-3">{files.map((file,index) => <div key={index} className="relative"><button type="button" aria-label={`设素材 ${index+1} 为主图`} onClick={() => setFiles([file, ...files.filter((_,i) => i !== index)])} className={`h-14 w-14 overflow-hidden rounded-xl border-2 bg-card ${index === 0 ? "border-foreground" : "border-border"}`}><img src={previews[index]} alt={file.name} className="h-full w-full object-contain"/></button><button type="button" aria-label={`移除 ${file.name}`} className="absolute -right-1 -top-1 rounded-full border bg-card p-0.5" onClick={() => setFiles(files.filter((_,i)=>i!==index))}><X size={12}/></button></div>)}</div>
        <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">点击缩略图更换主图 · {files.length}/8</span><Button type="button" variant="outline" disabled={files.length >= 8} onClick={() => fileInput.current?.click()}>继续添加</Button></div>
      </div>}

    </fieldset>
    <div className="space-y-3">
      <Button className="h-12 w-full text-base" disabled={!files.length || busy} onClick={start}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{busy ? stage : "下一步 · AI 分析商品"}</Button>
      <p className="text-center text-xs text-muted-foreground">下一页确认平台、画质和创作方向后，再开始出图。</p>
      <p className="text-center text-sm text-muted-foreground">首次使用请先完成 <Link href="/settings/providers" className="underline">AI 配置</Link></p>
    </div>
  </div>;
}
