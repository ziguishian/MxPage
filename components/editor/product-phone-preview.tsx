"use client";

import React, { useRef, useState } from "react";
import { BatteryFull, ChevronLeft, ChevronRight, Expand, ImageOff, Signal, Wifi } from "lucide-react";
import type { ImageProgress } from "@/lib/detail-runs/contracts";
import { TaobaoProductPreview, type ListingPreview } from "./taobao-product-preview";

export type PreviewSection = {
  id: string; type: string; title: string; order: number; imageUrl?: string | null;
  currentImageAssetId?: string | null;
  currentImageAsset?: { metadata?: unknown } | null;
};

export function imageReview(section: PreviewSection, progress: ImageProgress[]) {
  const saved = (section.currentImageAsset?.metadata as { visualCheck?: ImageProgress["check"] } | null)?.visualCheck;
  const latest = progress.find(p => p.sectionId === section.id)?.check;
  return [saved, latest].find(check => check?.assetId === section.currentImageAssetId);
}

export function ProductImage({ section, progress, square = false }: { section: PreviewSection; progress: ImageProgress[]; square?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const pending = progress.find(p => p.sectionId === section.id);
  if (!section.imageUrl || failedUrl === section.imageUrl) return <div className={`flex items-center justify-center gap-2 bg-neutral-100 px-4 text-center text-sm text-neutral-600 ${square ? "aspect-square" : "aspect-[3/4]"}`}>
    <ImageOff className="h-4 w-4 shrink-0"/>
    <span>{section.imageUrl ? "图片加载失败，请查看原图或刷新" : pending?.state === "generating" ? "正在生成…" : pending?.state === "uncertain" ? "生成结果待确认" : "等待生成"}</span>
  </div>;
  return <img src={section.imageUrl} alt={section.title} onError={() => setFailedUrl(section.imageUrl!)} className={square ? "block aspect-square w-full bg-white object-contain" : "block h-auto w-full"}/>;
}

export function ProductPhonePreview(props: {
  name: string; platform: string; sections: PreviewSection[]; progress: ImageProgress[];
  selected: string; onSelect: (id: string) => void; onExpand: (id: string) => void;
  skin?: "taobao" | "generic"; listing?: ListingPreview;
}) {
  return props.skin === "generic" ? <GenericProductPhonePreview {...props}/> : <TaobaoProductPreview {...props}/>;
}

function GenericProductPhonePreview({ name, platform, sections, progress, selected, onSelect, onExpand }: {
  name: string; platform: string; sections: PreviewSection[]; progress: ImageProgress[];
  selected: string; onSelect: (id: string) => void; onExpand: (id: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const detailStart = useRef<HTMLDivElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroes = sections.filter(s => s.type === "HERO");
  const details = sections.filter(s => s.type !== "HERO");
  const hero = heroes[heroIndex % (heroes.length || 1)];
  const selectHero = (index: number) => { setHeroIndex(index); onSelect(heroes[index].id); };
  const selectedSection = sections.find(s => s.id === selected);
  function jump(detail: boolean) {
    const el = viewport.current;
    if (!el) return;
    el.scrollTo({ top: detail && detailStart.current ? detailStart.current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : 0, behavior: "auto" });
  }
  return <section aria-label="手机商品页预览" className="rounded-2xl border bg-muted/20 p-3 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">手机商品页预览</h2><span className="text-xs text-muted-foreground">{platform} · 当前生效图片</span></div>
    <div className="relative mx-auto w-full max-w-[390px] rounded-[44px] border border-neutral-600 bg-neutral-900 p-2 shadow-xl">
      <div className="flex h-[min(760px,78svh)] min-h-[480px] flex-col overflow-hidden rounded-[36px] bg-white text-neutral-900 [color-scheme:light]">
        <div aria-hidden="true" className="relative flex h-11 shrink-0 items-center justify-between px-6 text-[11px] font-semibold"><span>9:41</span><span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-neutral-950"/><span className="flex gap-1"><Signal size={13}/><Wifi size={13}/><BatteryFull size={17}/></span></div>
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-2 text-xs"><span className="font-medium">商品预览</span><span className="text-neutral-500">仅预览 · 不含交易功能</span></div>
        <div ref={viewport} role="region" aria-label="手机页面内容，可滚动" tabIndex={0} className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500">
          {hero && <section aria-label="手机头图轮播">
            <button type="button" aria-label={`选择头图：${hero.title}`} aria-pressed={selected === hero.id} className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500" onClick={() => onSelect(hero.id)}><ProductImage key={hero.id} section={hero} progress={progress} square/></button>
            <div className="flex items-center justify-center gap-3 px-3 py-2">
              <button type="button" aria-label="上一张头图" disabled={heroes.length < 2} className="rounded-lg p-2 hover:bg-neutral-100 disabled:opacity-30" onClick={() => selectHero((heroIndex + heroes.length - 1) % heroes.length)}><ChevronLeft size={16}/></button>
              {heroes.map((h, i) => <button key={h.id} type="button" aria-label={`头图 ${i + 1}：${h.title}`} aria-pressed={h.id === hero.id} className="flex h-8 w-6 items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-neutral-500" onClick={() => selectHero(i)}><span className={`h-1.5 rounded-full ${h.id === hero.id ? "w-5 bg-neutral-900" : "w-1.5 bg-neutral-300"}`}/></button>)}
              <span className="sr-only">{heroIndex % heroes.length + 1}/{heroes.length}</span>
              <button type="button" aria-label="下一张头图" disabled={heroes.length < 2} className="rounded-lg p-2 hover:bg-neutral-100 disabled:opacity-30" onClick={() => selectHero((heroIndex + 1) % heroes.length)}><ChevronRight size={16}/></button>
            </div>
          </section>}
          <div className="border-b border-neutral-100 px-4 py-4"><h3 className="break-words text-base font-semibold leading-6">{name}</h3><p className="mt-1 text-xs text-neutral-500">{heroes.length} 张头图 · {details.length} 张详情图</p></div>
          <div ref={detailStart} className="bg-neutral-50 px-4 py-3 text-sm font-medium">商品详情</div>
          <div data-testid="phone-detail-images">{details.map(s => <button type="button" key={s.id} aria-label={`选择详情图：${s.title}`} aria-pressed={selected === s.id} onClick={() => onSelect(s.id)} className="relative block w-full border-0 p-0 text-left leading-none focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500"><ProductImage section={s} progress={progress}/>{selected === s.id && <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-neutral-500/70"/>}</button>)}</div>
          {!sections.length && <div className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-neutral-500">生成的图片会逐张出现在这里</div>}
          <p className="px-4 py-6 text-center text-[11px] text-neutral-400">已到底部 · MxPage 预览</p>
        </div>
        <div className="shrink-0 border-t border-neutral-200 bg-white px-3 pt-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button type="button" disabled={!heroes.length} onClick={() => jump(false)} className="rounded-full py-3 hover:bg-neutral-100 disabled:opacity-30">查看头图</button>
            <button type="button" disabled={!details.length} onClick={() => jump(true)} className="rounded-full py-3 hover:bg-neutral-100 disabled:opacity-30">查看详情</button>
            <button type="button" disabled={!selectedSection?.imageUrl} onClick={() => onExpand(selected)} className="flex items-center justify-center gap-1 rounded-full bg-neutral-900 py-3 text-white disabled:opacity-30"><Expand size={13}/>查看原图</button>
          </div><div aria-hidden="true" className="mx-auto mb-2 mt-3 h-1 w-24 rounded-full bg-neutral-900"/>
        </div>
      </div>
    </div>
    <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">滚动查看整页，点击图片可在编辑区修改。详情图按原比例无缝排列；手机外框和界面不会导出。</p>
    {sections.some(s => s.imageUrl && imageReview(s, progress)?.passed === false) && <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">部分图片被标记为需检查，请在编辑区核对。</p>}
  </section>;
}
