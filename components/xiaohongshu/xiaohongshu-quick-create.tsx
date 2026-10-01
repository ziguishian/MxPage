"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import type { RunCheckpoint } from "@/lib/detail-runs/contracts";

type Project = { id: string; name: string; description: string; modelSnapshot?: { socialPost?: { title: string; caption: string; hashtags: string[] } }; sections: { id: string; title: string; imageUrl?: string | null }[] };
type Run = { id: string; status: string; stage: string; error?: string; checkpoint: RunCheckpoint };
async function data(response: Response) { const body = await response.json(); if (!body.success) throw new Error(body.error?.message || "请求失败"); return body.data; }
const post = (url: string, body: unknown = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(data);
export function XiaohongshuQuickCreate({ initialProjectId }: { initialProjectId?: string }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [id, setId] = useState(initialProjectId);
  const [project, setProject] = useState<Project | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const locked = useRef(false);
  const uploaded = useRef(0);
  const chooser = useRef<HTMLInputElement>(null);
  const active = run && ["PENDING", "RUNNING", "WAITING_INPUT"].includes(run.status);
  useEffect(() => { if (!initialProjectId) { try { setId(localStorage.getItem("mxpage:last-xhs-project") || undefined); } catch {} } }, [initialProjectId]);
  useEffect(() => { const urls = files.map(f=>URL.createObjectURL(f)); setPreviews(urls); return ()=>urls.forEach(URL.revokeObjectURL); }, [files]);
  useEffect(() => {
    if (!id) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const [p,r] = await Promise.all([fetch(`/api/projects/${id}`).then(data), fetch(`/api/projects/${id}/detail-runs`).then(data)]); if (!stopped) { setProject(p); setRun(r); setError(""); } }
      catch(e) { if (!stopped) setError(e instanceof Error ? e.message : "读取进度失败"); }
      finally { if (!stopped) timer = setTimeout(poll, 2500); }
    }
    void poll(); return ()=>{stopped=true;clearTimeout(timer);};
  }, [id]);
  async function act(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current=true;setBusy(true);
    try { await work(); } catch(e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
    finally { locked.current=false;setBusy(false); }
  }
  async function start() {
    await act(async () => {
      let projectId = id;
      if (!projectId) {
        const p = await post("/api/projects", { name: brief.trim().slice(0,60).padEnd(2,"创作"), platform: "xiaohongshu", style: "generic_clean", description: brief.trim() });
        projectId = p.id; setId(p.id); setProject({ ...p, sections: [] });
        try { localStorage.setItem("mxpage:last-xhs-project",p.id); } catch {}
      }
      for (let i=uploaded.current;i<files.length;i++) { await post(`/api/projects/${projectId}/assets/upload`,{type:i===0?"MAIN":"REFERENCE",...await fileToBase64Payload(files[i])}); uploaded.current=i+1; }
      setRun(await post(`/api/projects/${projectId}/detail-runs`, { idempotencyKey: `xhs:${projectId}`, mode: "xhs" }));
    });
  }
  async function control(action: string, body: unknown = {}) {
    if (!id || !run) return;
    await act(async ()=>{setRun(await post(`/api/projects/${id}/detail-runs/${run.id}/${action}`,body));});
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast.success("已复制"); } catch { toast.error("复制失败，请选择文字手动复制。"); } }
  function reset() { setId(undefined);setProject(null);setRun(null);setFiles([]);setBrief("");setError("");uploaded.current=0;try{localStorage.removeItem("mxpage:last-xhs-project");}catch{} if(initialProjectId) router.replace("/xiaohongshu"); }
  const social = project?.modelSnapshot?.socialPost;
  const tags = social?.hashtags.map(t=>`#${t.replace(/^#+/,"")}`).join(" ") || "";
  return <section className="mx-auto max-w-4xl space-y-7 py-6">
    <header><p className="text-sm text-muted-foreground">小红书创作</p><h1 className="mt-3 text-3xl font-semibold">说出想法，生成一篇完整图文</h1><p className="mt-3 text-muted-foreground">配图、标题、正文、标签，一次完成。</p></header>
    {!id ? <div className="space-y-4">
      <label className="block space-y-2 text-sm font-medium">你想发什么？<Textarea aria-label="创作要求" value={brief} onChange={e=>setBrief(e.target.value)} maxLength={4000} rows={6} placeholder="例如：给租房新手做一篇低成本收纳指南，语气自然，奶油色插画风，5张图。不要编造真实使用经历。"/></label>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={busy} variant="outline" onClick={()=>chooser.current?.click()}><Paperclip className="mr-2 h-4 w-4"/>添加参考图（可选）</Button><span className="text-xs text-muted-foreground">默认 5 张竖版图，可在要求中指定 1–8 张。</span></div>
      <input ref={chooser} className="hidden" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>{const next=[...files,...Array.from(e.target.files||[])];e.target.value="";if(next.length>4||next.some(f=>f.size>10*1024*1024||!["image/png","image/jpeg","image/webp"].includes(f.type))){toast.error("最多 4 张参考图，每张不超过 10MB，支持 PNG、JPEG、WebP。");return;}setFiles(next);}}/>
      {!!files.length && <div className="flex flex-wrap gap-3">{files.map((f,i)=><div key={i} className="relative"><img src={previews[i]} alt={f.name} className="h-20 w-20 rounded-xl border object-contain"/><button disabled={busy} aria-label={`移除参考图 ${i+1}`} className="absolute -right-1 -top-1 rounded-full border bg-card p-1" onClick={()=>setFiles(files.filter((_,j)=>j!==i))}><X size={12}/></button></div>)}</div>}
      <Button className="h-12 w-full" disabled={busy || !brief.trim()} onClick={start}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}一键生成图文</Button>
    </div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5" role="status"><div><p className="font-medium">{busy ? "正在处理…" : run?.stage || "准备创作"}</p><p className="mt-1 text-sm text-muted-foreground">已生成 {run?.checkpoint.images.filter(i=>i.assetId).length || 0} / {run?.checkpoint.images.length || "—"} 张{run?.status === "PARTIAL" ? " · 部分完成，请检查" : ""}</p></div><div className="flex gap-2">{active ? <Button disabled={busy} variant="outline" onClick={()=>control("cancel")}>停止</Button> : <><Button disabled={busy} variant="outline" onClick={reset}>再创作一篇</Button>{!run && <Button disabled={busy} onClick={start}>继续生成</Button>}{run && run.status !== "COMPLETED" && <Button disabled={busy || run.checkpoint.images.some(i=>i.state==="uncertain")} onClick={()=>control("resume")}>继续</Button>}</>}</div></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {run?.error && <p className="text-sm text-muted-foreground">{run.error}</p>}
      {run?.checkpoint.images.some(i=>i.state==="uncertain") && <p className="text-sm text-muted-foreground">部分图片请求结果不确定，自动重试可能重复计费。请<Link className="underline" href={`/projects/${id}/editor`}>打开工作台检查并明确重试</Link>。</p>}
      {run?.status === "WAITING_INPUT" && <div className="space-y-3 rounded-2xl border p-5"><p className="font-medium">还需要一点信息</p>{run.checkpoint.questions?.map((q,i)=><p key={i} className="text-sm">{q.text}</p>)}<Textarea aria-label="补充信息" value={answer} onChange={e=>setAnswer(e.target.value)}/><div className="flex gap-2"><Button disabled={busy||!answer.trim()} onClick={()=>control("answers",{answer})}>回答并继续</Button>{!run.checkpoint.questions?.some(q=>q.blocking)&&<Button disabled={busy} variant="outline" onClick={()=>control("answers",{skip:true})}>按现有信息继续</Button>}<Link className="text-sm underline" href={`/projects/${id}/editor`}>补充图片</Link></div></div>}
      {social && <div className="space-y-5 rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">发布文案</h2><Button size="sm" variant="outline" onClick={()=>copy(`${social.title}\n\n${social.caption}\n\n${tags}`)}>复制全部</Button></div><div><p className="mb-2 text-xs text-muted-foreground">标题</p><p className="text-lg font-semibold">{social.title}</p></div><div><p className="mb-2 text-xs text-muted-foreground">正文</p><p className="whitespace-pre-wrap leading-7">{social.caption}</p></div><p className="text-sm text-muted-foreground">{tags}</p></div>}
      {!!project?.sections.length && <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold">配图</h2><div className="flex gap-4 text-sm"><Link className="underline" href={`/projects/${id}/editor`}>修改图片</Link>{project.sections.some(s=>s.imageUrl)&&<Link className="underline" href={`/api/projects/${id}/export/images`}>下载已有图片 ZIP</Link>}</div></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{project.sections.map((s,i)=><div key={s.id} className="space-y-2"><div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border bg-muted">{s.imageUrl ? <a href={s.imageUrl} target="_blank" rel="noreferrer"><img src={s.imageUrl} alt={s.title} className="h-full w-full object-contain"/></a> : <span className="text-sm text-muted-foreground">第 {i+1} 张 · 等待生成</span>}</div><p className="text-sm">{s.title}</p>{run?.checkpoint.images.find(img=>img.sectionId===s.id)?.check?.passed===false&&<p className="text-xs text-destructive">需检查</p>}</div>)}</div></div>}
      <p className="text-xs text-muted-foreground">文案与图片由模型生成，发布前请核对事实、文字和画面。结果会保留在“我的作品”。</p>
    </>}
  </section>;
}
