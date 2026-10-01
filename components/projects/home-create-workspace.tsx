"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { QuickStartWorkspace } from "./quick-start-workspace";
import { BatchDetailWorkspace } from "./batch-detail-workspace";

export function HomeCreateWorkspace() {
  const [batch, setBatch] = useState(false);

  return (
    <>
      <div className="mx-auto flex max-w-4xl items-center gap-3 text-sm">
        <span className={cn("transition-colors", batch ? "text-muted-foreground" : "font-medium text-foreground")}>单商品</span>
        <button
          type="button"
          role="switch"
          aria-label="批量生成"
          aria-checked={batch}
          onClick={() => setBatch(value => !value)}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            batch ? "border-primary bg-primary" : "border-input bg-muted",
          )}
        >
          <span aria-hidden="true" className={cn(
            "pointer-events-none h-5 w-5 rounded-full shadow-sm transition-transform motion-reduce:transition-none",
            batch ? "translate-x-[22px] bg-primary-foreground" : "translate-x-1 bg-card",
          )} />
        </button>
        <span className={cn("transition-colors", batch ? "font-medium text-foreground" : "text-muted-foreground")}>批量生成</span>
      </div>
      <div hidden={batch}><QuickStartWorkspace /></div>
      <div hidden={!batch}><BatchDetailWorkspace /></div>
    </>
  );
}
