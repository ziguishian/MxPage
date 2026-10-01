import Link from "next/link";
import { BookOpenText, FolderKanban, History, Languages, Settings2 } from "lucide-react";

import { ApiUsageIndicator } from "@/components/layout/api-usage-indicator";
import { FloatingThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const appName = "MxPage";

const navItems = [
  { href: "/", label: "一键详情页", icon: FolderKanban },
  { href: "/translate", label: "详情页翻译", icon: Languages },
  { href: "/xiaohongshu", label: "小红书图文", icon: BookOpenText },
  { href: "/history", label: "我的作品", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-foreground">
      <div className="fixed bottom-4 left-4 z-[60]">
        <FloatingThemeToggle />
      </div>
      <div className="mx-auto min-h-screen max-w-[1600px] px-4 py-5 md:px-6">
        <aside
          className="scrollbar-hidden fixed top-5 z-40 hidden h-[calc(100vh-2.5rem)] w-72 overflow-y-auto rounded-[2rem] border border-border bg-card p-5 shadow-soft md:flex md:flex-col"
          style={{ left: "max(1.5rem, calc((100vw - 1600px) / 2 + 1.5rem))" }}
        >
          <Link
            href="/"
            className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white">
              <img src="/brand-icon.ico" alt={appName} className="h-full w-full object-cover" suppressHydrationWarning />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{appName}</p>
              <p className="text-xs text-muted-foreground">AI 商品图文工作台</p>
            </div>
          </Link>

          <nav aria-label="主导航" className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200",
                    "text-muted-foreground hover:bg-accent hover:text-foreground",
                    "",
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-[2rem] border border-border bg-background p-5 text-muted-foreground">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">出品方</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">灵矩绘境 · MxPage</p>
                    <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      V2
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-xs leading-6 text-muted-foreground">
                MxPage 由灵矩绘境出品，面向真实商品图文与详情页工作流，支持商品分析、页面规划、图像生成、局部编辑、导出以及 OpenAI 兼容模型接入。
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 rounded-[2rem] border border-border bg-card p-5 shadow-soft md:ml-[19.5rem] md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/monitor/usage"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 gap-2 rounded-xl px-3",
              )}
            >
              <span className="text-sm font-medium">API 监控</span>
              <ApiUsageIndicator />
            </Link>
            <Link href="/settings/providers" className={cn(buttonVariants({ variant: "default" }))}>
              <Settings2 className="mr-2 h-4 w-4" />
              AI 配置
            </Link>
          </div>
          <nav aria-label="移动端主导航" className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4 md:hidden">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
