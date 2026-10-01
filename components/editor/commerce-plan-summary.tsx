"use client";
import { commercePlanSchema, categoryProfiles, sectionRoleLabels } from "@/lib/detail-runs/merchandising";
import { artDirectionSchema, visualRecipes } from "@/lib/detail-runs/art-direction";
import type { StyleReference } from "@/lib/detail-runs/reference-catalog";
import type { RunCheckpoint } from "@/lib/detail-runs/contracts";
import { expressionLabels } from "@/lib/detail-runs/flexible-creative";

export function CommercePlanSummary({ value, artDirection, references = [], adaptations, sectionIds, onSelect }: { value: unknown; artDirection?: unknown; references?: StyleReference[]; adaptations?: RunCheckpoint["adaptations"]; sectionIds: string[]; onSelect: (id: string) => void }) {
  const parsed = commercePlanSchema.safeParse(value);
  if (!parsed.success) return null;
  const plan = parsed.data;
  const parsedArt = artDirectionSchema.safeParse(artDirection);
  const art = parsedArt.success ? parsedArt.data : null;
  return <details className="rounded-2xl border bg-card p-5">
    <summary className="cursor-pointer font-medium">整页设计方案 <span className="ml-2 text-xs font-normal text-muted-foreground">{categoryProfiles[plan.category].label} · {plan.sections.length} 屏</span></summary>
    <div className="mt-5 space-y-5 text-sm">
      <div><p className="text-xs text-muted-foreground">产品主张 · 面向 {plan.audience}</p><p className="mt-2 text-lg font-medium">{plan.positioning}</p></div>
      {art && <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">视觉方向 · {art.recipeId ? visualRecipes[art.recipeId].label : "自由设计"}</p><p className="mt-2 font-medium">{art.concept}</p><p className="mt-2 leading-6 text-muted-foreground">{art.rationale}</p></div>}
      {adaptations && <div className="space-y-2">{Object.entries(adaptations).map(([key, record]) => record && <p key={key} className="text-xs leading-5 text-muted-foreground">{key === "heroes" ? "头图后" : "详情后"}节奏检查 · {({ claimed: "调整中", applied: "已调整", skipped: "沿用方案", failed: "保留原方案" })[record.status]}：{record.reason}</p>)}</div>}
      {!!references.length && <div><p className="mb-3 text-xs text-muted-foreground">实际风格参考 · 仅借鉴摄影、颜色和排版</p><div className="grid gap-3 sm:grid-cols-2">{references.map(r => <div key={r.id} className="flex gap-3 rounded-xl border p-3"><a href={r.url} target="_blank" rel="noreferrer" className="shrink-0"><img src={r.url} alt={r.title} className="h-32 w-24 rounded-lg bg-muted object-contain"/></a><div><p className="font-medium">{r.title}</p><p className="mt-1 text-xs text-muted-foreground">{r.source === "upload" ? "用户上传" : "内置案例"}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{r.reason}</p></div></div>)}</div></div>}
      <div className="grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2"><div><p className="mb-1 text-xs text-muted-foreground">配色与字体</p><p>{(art?.palette || plan.visualSystem.palette).join(" / ")}</p><p className="mt-2 leading-6">{art ? `${art.headlineStyle}；${art.bodyStyle}` : plan.visualSystem.typography}</p></div><div><p className="mb-1 text-xs text-muted-foreground">光线与页面节奏</p><p className="leading-6">{art?.lighting || plan.visualSystem.lighting}</p><p className="mt-2 leading-6">{art?.motif || plan.visualSystem.continuity}</p></div></div>
      <div className="grid gap-2 sm:grid-cols-2">{plan.sections.map((s, i) => {
        const frame = art?.sections.find(a => a.sectionId === sectionIds[i]);
        return <button type="button" key={i} disabled={!sectionIds[i]} onClick={() => onSelect(sectionIds[i])} className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-default">
          <span className="text-xs text-muted-foreground">{s.kind === "HERO" ? "头图" : "详情"} · {frame?.expression ? expressionLabels[frame.expression] : (art?.version || 0) >= 2 ? "画面任务" : sectionRoleLabels[s.role]}</span>
          <p className="mt-1 font-medium">{String(i + 1).padStart(2, "0")} / {s.title}</p>
          {s.buyerQuestion.trim() !== s.objective.trim() && <p className="mt-2 text-xs leading-5 text-muted-foreground">{s.buyerQuestion}</p>}
          <p className="mt-2 text-xs leading-5">{s.objective}</p>
          {frame?.expressionReason && <p className="mt-2 text-xs leading-5 text-muted-foreground">表达选择：{frame.expressionReason}</p>}
          {frame?.compositionBrief && <p className="mt-2 text-xs leading-5 text-muted-foreground">{frame.compositionBrief}</p>}
          {frame?.expression === "photo" && <p className="mt-2 text-xs text-muted-foreground">不新增文案，保留商品自身印字</p>}
        </button>;
      })}</div>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">事实依据（{plan.evidence.length} 项）</summary><ul className="mt-3 list-disc space-y-2 pl-4">{plan.evidence.map(e => <li key={e.id}>{e.claim} <span>· {e.source === "image" ? "图片观察" : "用户提供"}</span></li>)}</ul></details>
      {art?.viewVersion === 1 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">逐图镜头与拍摄角度</summary><ol className="mt-3 space-y-3">{art.sections.map((s, i) => <li key={s.sectionId}><p className="font-medium text-foreground">{i + 1}. {s.title} · {({ front: "正面", three_quarter: "三分之四视角", side: "侧面", top_down: "俯视", rear: "背面", macro: "局部特写" })[s.viewpoint || "front"]}</p><p className="mt-1 leading-5">{s.camera}</p></li>)}</ol></details>}
    </div>
  </details>;
}
