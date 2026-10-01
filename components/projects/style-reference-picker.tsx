"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StyleReferencePicker({ files, onChange, stored = [], onRemoveStored, disabled = false, batch = false }: {
  files: File[]; onChange: (files: File[]) => void;
  stored?: { id: string; url: string; fileName?: string }[];
  onRemoveStored?: (id: string) => void; disabled?: boolean; batch?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { const values = files.map(f => URL.createObjectURL(f)); setUrls(values); return () => values.forEach(URL.revokeObjectURL); }, [files]);
  function choose(incoming: File[]) {
    if (files.length + stored.length + incoming.length > 2) { toast.error("最多两张风格参考。"); return; }
    if (incoming.some(f => !["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 10 * 1024 * 1024)) { toast.error("支持 PNG、JPEG、WebP，每张不超过 10MB。"); return; }
    onChange([...files, ...incoming]);
  }
  return <details className="rounded-2xl border bg-card p-4">
    <summary className="cursor-pointer text-sm font-medium">风格参考 <span className="ml-2 font-normal text-muted-foreground">可选 · {files.length + stored.length}/2</span></summary>
    <p className="mt-3 text-xs leading-6 text-muted-foreground">{batch ? "上传的参考应用于整批商品。" : "上传你喜欢的头图或详情页风格。"}留空时按品类自动选择内置案例。只借鉴摄影、配色和排版，商品外观以商品素材为准。</p>
    <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="上传风格参考" className="hidden" disabled={disabled} onChange={e => { choose(Array.from(e.target.files || [])); e.target.value = ""; }}/>
    <div className="mt-3 flex flex-wrap gap-3">
      {stored.map(a => <div key={a.id} className="relative w-24"><img src={a.url} alt={a.fileName || "已上传风格参考"} className="h-28 w-24 rounded-xl border object-cover"/>{onRemoveStored && <button type="button" aria-label="移除已上传风格参考" disabled={disabled} onClick={() => onRemoveStored(a.id)} className="absolute right-1 top-1 rounded-full bg-background p-1 shadow"><X size={14}/></button>}</div>)}
      {files.map((f, i) => <div key={`${f.name}-${i}`} className="relative w-24"><img src={urls[i]} alt={`风格参考 ${i + 1}`} className="h-28 w-24 rounded-xl border object-cover"/><button type="button" aria-label={`移除风格参考 ${i + 1}`} disabled={disabled} onClick={() => onChange(files.filter((_, n) => n !== i))} className="absolute right-1 top-1 rounded-full bg-background p-1 shadow"><X size={14}/></button></div>)}
      <Button type="button" variant="outline" disabled={disabled || files.length + stored.length >= 2} onClick={() => input.current?.click()}><ImagePlus className="mr-2 h-4 w-4"/>选择风格图</Button>
    </div>
  </details>;
}
