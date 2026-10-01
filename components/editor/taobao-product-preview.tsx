"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BatteryFull, ChevronLeft, ChevronRight, Headphones, MoreHorizontal, Share2, ShoppingCart, Signal, Star, Store, Wifi, X } from "lucide-react";
import { ProductImage, imageReview, type PreviewSection } from "./product-phone-preview";
import type { ImageProgress } from "@/lib/detail-runs/contracts";
const styles = {"device":"mx-taobao-device","screen":"mx-taobao-screen","status":"mx-taobao-status","solid":"mx-taobao-solid","navigation":"mx-taobao-navigation","overlay":"mx-taobao-overlay","tabs":"mx-taobao-tabs","viewport":"mx-taobao-viewport","gallery":"mx-taobao-gallery","emptyHero":"mx-taobao-emptyHero","counter":"mx-taobao-counter","productInfo":"mx-taobao-productInfo","price":"mx-taobao-price","priceMissing":"mx-taobao-priceMissing","titleRow":"mx-taobao-titleRow","meta":"mx-taobao-meta","group":"mx-taobao-group","row":"mx-taobao-row","sectionHeading":"mx-taobao-sectionHeading","empty":"mx-taobao-empty","shop":"mx-taobao-shop","shopLogo":"mx-taobao-shopLogo","shopName":"mx-taobao-shopName","shopScores":"mx-taobao-shopScores","detailSection":"mx-taobao-detailSection","recommendations":"mx-taobao-recommendations","footer":"mx-taobao-footer","purchaseBar":"mx-taobao-purchaseBar","buyButtons":"mx-taobao-buyButtons","homeIndicator":"mx-taobao-homeIndicator","sheetOverlay":"mx-taobao-sheetOverlay","sheet":"mx-taobao-sheet","sheetClose":"mx-taobao-sheetClose","sheetConfirm":"mx-taobao-sheetConfirm"};

export type ListingPreview = Partial<Record<"price" | "shipping" | "sales" | "origin" | "shopName" | "service" | "promotion" | "coupon" | "options" | "parameters", string>>;
export const listingFields: [keyof ListingPreview, string][] = [["price", "售价（元）"], ["shipping", "运费说明"], ["sales", "销量说明"], ["origin", "发货地"], ["shopName", "店铺名称"], ["service", "服务说明"], ["promotion", "促销说明"], ["coupon", "优惠券说明"], ["options", "规格选项"], ["parameters", "商品参数"]];

export function TaobaoProductPreview({ name, sections, progress, listing = {}, onSelect, onExpand }: {
  name: string; sections: PreviewSection[]; progress: ImageProgress[]; listing?: ListingPreview;
  onSelect: (id: string) => void; onExpand: (id: string) => void;
}) {
  const device = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const reviewStart = useRef<HTMLElement>(null);
  const detailStart = useRef<HTMLElement>(null);
  const shopStart = useRef<HTMLElement>(null);
  const recommendationStart = useRef<HTMLElement>(null);
  const touchX = useRef(0);
  const [scale, setScale] = useState(1);
  const [heroIndex, setHeroIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [tab, setTab] = useState("宝贝");
  const [sheet, setSheet] = useState<string | null>(null);
  const sheetTrigger = useRef<HTMLElement | null>(null);
  function openSheet(title: string, trigger: HTMLElement) {
    sheetTrigger.current = trigger;
    setSheet(title);
  }
  const [favorite, setFavorite] = useState(false);
  const [sheetHost, setSheetHost] = useState<HTMLDivElement | null>(null);
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const heroes = ordered.filter(s => s.type === "HERO");
  const details = ordered.filter(s => s.type !== "HERO");
  const index = heroIndex % (heroes.length || 1);
  const hero = heroes[index];
  useEffect(() => {
    if (!device.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 375));
    observer.observe(device.current);
    return () => observer.disconnect();
  }, []);
  function nextHero(offset: number) {
    if (!heroes.length) return;
    const next = (index + offset + heroes.length) % heroes.length;
    setHeroIndex(next); onSelect(heroes[next].id);
  }
  function jump(label: string, target?: HTMLElement | null) {
    const el = viewport.current;
    if (!el) return;
    el.scrollTo({ top: target ? target.offsetTop - 88 : 0, behavior: "auto" });
    setTab(label);
  }
  function trackScroll() {
    const top = viewport.current?.scrollTop || 0;
    setScrollTop(top);
    setTab(recommendationStart.current && top >= recommendationStart.current.offsetTop - 100 ? "推荐" : detailStart.current && top >= detailStart.current.offsetTop - 100 ? "详情" : reviewStart.current && top >= reviewStart.current.offsetTop - 100 ? "评价" : "宝贝");
  }
  const row = (label: string, text: string | undefined, placeholder: string) => <button type="button" className={styles.row} onClick={event => openSheet(label, event.currentTarget)}><span>{label}</span><strong>{text || placeholder}</strong><ChevronRight size={16}/></button>;
  const targets = { 宝贝: null, 评价: reviewStart, 详情: detailStart, 推荐: recommendationStart };
  const sheetText: Record<string, string> = { 领券: listing.coupon || "未提供优惠券信息", 促销: listing.promotion || "未提供促销信息", 服务: listing.service || "未提供服务信息", 选择: listing.options || "未提供规格选项", 参数: listing.parameters || "未提供商品参数", 购物车: "这是页面预览，不会加入真实购物车。", 立即购买: "这是页面预览，不会创建订单或付款。", 客服: "预览模式未接入店铺客服。", 评价: "尚未导入真实买家评价。", 买家相册: "尚未导入买家图片。", 问大家: "尚未导入真实问答。", 店铺: listing.shopName || "尚未填写店铺名称。", 分享: "商品尚未发布，暂无线上商品链接。", 更多: "可以切换头图、滚动查看详情，或点击图片查看原图。" };
  return <section aria-label="手机商品页预览" className="rounded-2xl border bg-muted/20 p-3 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">淘宝移动端预览</h2><span className="text-xs text-muted-foreground">参照所提供的淘宝界面 · 375 × 812</span></div>
    <div className={styles.device} ref={device}>
      <div className={styles.screen} style={{ transform: `scale(${scale})` }} data-testid="taobao-screen">
        <div aria-hidden="true" className={`${styles.status} ${scrollTop > 240 ? styles.solid : ""}`}><span>9:41</span><span><Signal size={17}/><Wifi size={17}/><BatteryFull size={23}/></span></div>
        <nav aria-label="商品页导航" className={`${styles.navigation} ${scrollTop > 240 ? styles.solid : styles.overlay}`}>
          <button type="button" aria-label="返回商品顶部" onClick={() => jump("宝贝")}><ChevronLeft size={24}/></button>
          <div className={styles.tabs} style={{ visibility: scrollTop > 240 ? "visible" : "hidden" }}>{Object.entries(targets).map(([label, ref]) => <button type="button" key={label} aria-current={tab === label ? "location" : undefined} onClick={() => jump(label, ref?.current)}>{label}</button>)}</div>
          <button type="button" aria-label="购物车预览" onClick={event => openSheet("购物车", event.currentTarget)}><ShoppingCart size={23}/></button><button type="button" aria-label="更多商品操作" onClick={event => openSheet("更多", event.currentTarget)}><MoreHorizontal size={23}/></button>
        </nav>
        <div ref={viewport} role="region" aria-label="手机页面内容，可滚动" tabIndex={0} onScroll={trackScroll} className={styles.viewport}>
          <section aria-label="手机头图轮播" className={styles.gallery} onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); nextHero(e.key === "ArrowLeft" ? -1 : 1); } }} onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={e => { const delta = e.changedTouches[0].clientX - touchX.current; if (Math.abs(delta) > 40) nextHero(delta < 0 ? 1 : -1); }}>
            {hero ? <button type="button" aria-label={`查看头图：${hero.title}`} onClick={() => { onSelect(hero.id); onExpand(hero.id); }}><ProductImage key={hero.id} section={hero} progress={progress} square/></button> : <div className={styles.emptyHero}>头图生成后显示在这里</div>}
            {heroes.length > 1 && <>
              <button type="button" className="mx-taobao-galleryArrow mx-taobao-galleryPrevious" aria-label="上一张头图" title="上一张头图" onClick={() => nextHero(-1)}><ChevronLeft size={22} aria-hidden="true"/></button>
              <button type="button" className="mx-taobao-galleryArrow mx-taobao-galleryNext" aria-label="下一张头图" title="下一张头图" onClick={() => nextHero(1)}><ChevronRight size={22} aria-hidden="true"/></button>
            </>}
            {heroes.length > 0 && <span className={styles.counter} aria-live="polite" aria-atomic="true">{index + 1}/{heroes.length}</span>}
          </section>
          <section className={styles.productInfo}>
            <div className={styles.price}>{listing.price ? <><small>¥</small> {listing.price}</> : <span className={styles.priceMissing}>待填写售价</span>}</div>
            <div className={styles.titleRow}><h3>{name}</h3><button type="button" aria-label="分享商品" onClick={event => openSheet("分享", event.currentTarget)}>分享 <Share2 size={14}/></button></div>
            <div className={styles.meta}><span>{listing.shipping || "运费待填写"}</span><span>{listing.sales || "销量未提供"}</span><span>{listing.origin || "发货地待填写"}</span></div>
          </section>
          <section className={styles.group}>{row("领券", listing.coupon, "暂无优惠券信息")}{row("促销", listing.promotion, "暂无促销信息")}</section>
          <section className={styles.group}>{row("服务", listing.service, "服务信息待填写")}{row("选择", listing.options, "请选择 商品规格")}{row("参数", listing.parameters, "商品参数待填写")}</section>
          <section ref={reviewStart} className={styles.group}>
            <button type="button" className={styles.sectionHeading} onClick={event => openSheet("评价", event.currentTarget)}><span>宝贝评价</span><span>查看全部 <ChevronRight size={15}/></span></button>
            <p className={styles.empty}>暂无真实评价数据</p>
            <button type="button" className={styles.sectionHeading} onClick={event => openSheet("买家相册", event.currentTarget)}><span>买家相册</span><span>查看全部 <ChevronRight size={15}/></span></button>
            <p className={styles.empty}>暂无买家图片</p>
            <button type="button" className={styles.sectionHeading} onClick={event => openSheet("问大家", event.currentTarget)}><span>问大家</span><span>查看全部 <ChevronRight size={15}/></span></button>
            <p className={styles.empty}>暂无问答数据</p>
          </section>
          <section ref={shopStart} className={`${styles.group} ${styles.shop}`}>
            <div className={styles.shopLogo}><Store size={24}/></div><div className={styles.shopName}>{listing.shopName || "店铺名称待填写"}</div><button type="button" onClick={event => openSheet("店铺", event.currentTarget)}>进店逛逛</button>
            <div className={styles.shopScores}><span>宝贝描述 —</span><span>卖家服务 —</span><span>物流服务 —</span></div>
          </section>
          <section ref={detailStart} aria-label="商品详情长页" className={styles.detailSection}><h4>— 宝贝详情 —</h4><div data-testid="phone-detail-images">{details.map(s => <button type="button" key={s.id} aria-label={`查看详情图：${s.title}`} onClick={() => { onSelect(s.id); onExpand(s.id); }}><ProductImage section={s} progress={progress}/></button>)}</div>{!details.length && <p className={styles.empty}>详情生成后会按顺序展示</p>}</section>
          <section ref={recommendationStart} className={styles.recommendations}><h4>看了又看</h4><p>暂无关联商品</p></section>
        </div>
        <footer className={styles.footer}>
          <div className={styles.purchaseBar}><button type="button" onClick={() => jump("评价", shopStart.current)}><Store size={21}/><span>店铺</span></button><button type="button" onClick={event => openSheet("客服", event.currentTarget)}><Headphones size={21}/><span>客服</span></button><button type="button" aria-pressed={favorite} onClick={() => setFavorite(!favorite)}><Star size={21} fill={favorite ? "#ff9400" : "none"} color={favorite ? "#ff9400" : undefined}/><span>{favorite ? "已收藏" : "收藏"}</span></button><div className={styles.buyButtons}><button type="button" onClick={event => openSheet("购物车", event.currentTarget)}>加入购物车</button><button type="button" onClick={event => openSheet("立即购买", event.currentTarget)}>立即购买</button></div></div>
          <div aria-hidden="true" className={styles.homeIndicator}/>
        </footer>
        <div ref={setSheetHost}/>
        <Dialog.Root open={Boolean(sheet)} onOpenChange={open => { if (!open) setSheet(null); }}>{sheetHost && <Dialog.Portal container={sheetHost}><Dialog.Overlay className={styles.sheetOverlay}/><Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); sheetTrigger.current?.focus(); }} className={styles.sheet}><Dialog.Title>{sheet}</Dialog.Title><Dialog.Description>{sheet ? sheetText[sheet] : ""}</Dialog.Description><Dialog.Close className={styles.sheetClose} aria-label="关闭预览弹层"><X size={20}/></Dialog.Close>{["购物车", "立即购买", "选择"].includes(sheet || "") && <p>{listing.options || "未设置商品规格"}</p>}<Dialog.Close className={styles.sheetConfirm}>完成</Dialog.Close></Dialog.Content></Dialog.Portal>}</Dialog.Root>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs"><span className="min-w-20 text-center">头图 {heroes.length ? index + 1 : 0} / {heroes.length}</span><button type="button" onClick={() => jump("宝贝")} className="ml-2 rounded-full border px-3 py-2">商品顶部</button><button type="button" onClick={() => jump("详情", detailStart.current)} className="rounded-full border px-3 py-2">查看详情</button></div>
    <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">滚动或滑动查看，点击图片放大。交易操作仅模拟；未提供的商品信息不编造，手机界面不参与导出。</p>
    {sections.some(s => s.imageUrl && imageReview(s, progress)?.passed === false) && <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">部分图片需检查，请在右侧编辑区核对。</p>}
  </section>;
}
