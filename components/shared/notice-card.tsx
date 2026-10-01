import { AlertTriangle, CheckCircle2, Info, type LucideIcon, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type NoticeVariant = "info" | "success" | "warning" | "error";

const variantStyles: Record<
  NoticeVariant,
  {
    wrapper: string;
    icon: string;
    dot: string;
    title: string;
    description: string;
    Icon: LucideIcon;
  }
> = {
  info: {
    wrapper: "border-sky-200 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-300",
    dot: "bg-sky-500",
    title: "text-sky-900 dark:text-sky-100",
    description: "text-sky-800/80 dark:text-sky-200/80",
    Icon: Info,
  },
  success: {
    wrapper: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-300",
    dot: "bg-emerald-500",
    title: "text-emerald-900 dark:text-emerald-100",
    description: "text-emerald-800/80 dark:text-emerald-200/80",
    Icon: CheckCircle2,
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50/90 dark:border-amber-500/20 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-300",
    dot: "bg-amber-500",
    title: "text-amber-900 dark:text-amber-100",
    description: "text-amber-800/80 dark:text-amber-200/80",
    Icon: AlertTriangle,
  },
  error: {
    wrapper: "border-rose-200 bg-rose-50/90 dark:border-rose-500/20 dark:bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-300",
    dot: "bg-rose-500",
    title: "text-rose-900 dark:text-rose-100",
    description: "text-rose-800/80 dark:text-rose-200/80",
    Icon: XCircle,
  },
};

export function NoticeCard({
  variant = "info",
  title,
  description,
  className,
}: {
  variant?: NoticeVariant;
  title: string;
  description?: string;
  className?: string;
}) {
  const style = variantStyles[variant];
  const Icon = style.Icon;

  return (
    <div className={cn("rounded-2xl border p-4", style.wrapper, className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm dark:bg-white/10">
          <Icon className={cn("h-4 w-4", style.icon)} />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", style.dot)} />
            <p className={cn("text-sm font-medium", style.title)}>{title}</p>
          </div>
          {description ? <p className={cn("text-xs leading-6", style.description)}>{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
