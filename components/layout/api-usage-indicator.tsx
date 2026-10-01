"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type UsageSummary = {
  totalRequests: number;
  imageRequests: number;
  spendingLimitedRequests: number;
  failedRequests: number;
  actualCostUsd: number;
  costSamples: number;
};

export function ApiUsageIndicator({ className }: { className?: string }) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/monitor/usage?hours=24&limit=8", { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && payload.success) {
          setSummary(payload.data);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const label = summary
    ? summary.costSamples > 0
      ? `24h $${summary.actualCostUsd.toFixed(4)}`
      : `24h ${summary.totalRequests} 次`
    : "24h --";

  const alerting = Boolean(summary && (summary.spendingLimitedRequests > 0 || summary.failedRequests > 0));
  const Icon = alerting ? AlertTriangle : Activity;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium",
          alerting
            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        <Icon className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </span>
    </span>
  );
}
