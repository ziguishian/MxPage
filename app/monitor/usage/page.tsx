import { Select } from "@/components/ui/select";
import { Activity, AlertTriangle, Clock3, Coins, Filter, ImageIcon, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";

import { ClearUsageButton } from "@/components/monitor/clear-usage-button";
import { DeleteUsageEntryButton } from "@/components/monitor/delete-usage-entry-button";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { getApiUsageSummary, humanizeApiMonitorMessage, type ApiUsageEntry } from "@/lib/monitor/api-usage";

export const dynamic = "force-dynamic";

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function projectLabel(projectId: string, projectNames: Map<string, string>) {
  if (projectId === "unassigned") {
    return "未归属项目";
  }
  return projectNames.get(projectId) ?? projectId;
}

function displayMonitorError(message: string | null | undefined, statusCode?: number | null) {
  return humanizeApiMonitorMessage({
    message,
    statusCode: statusCode ?? null,
  });
}

function buildMonitorPageHref(params: {
  hours: number;
  projectId: string;
  category: string;
  quotaState: string;
  success: string;
  page: number;
}) {
  const search = new URLSearchParams();
  search.set("hours", String(params.hours));
  search.set("projectId", params.projectId);
  search.set("category", params.category);
  search.set("quotaState", params.quotaState);
  search.set("success", params.success);
  search.set("page", String(params.page));
  return `/monitor/usage?${search.toString()}`;
}

export default async function ApiUsageMonitorPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const hours = Number(readSingle(searchParams?.hours) ?? "24");
  const projectId = readSingle(searchParams?.projectId) ?? "all";
  const category = readSingle(searchParams?.category) ?? "all";
  const quotaState = readSingle(searchParams?.quotaState) ?? "all";
  const success = readSingle(searchParams?.success) ?? "all";
  const page = Number(readSingle(searchParams?.page) ?? "1");
  const currentPage = Number.isFinite(page) ? Math.max(1, page) : 1;

  const summary = await getApiUsageSummary({
    hours: Number.isFinite(hours) ? Math.max(1, Math.min(24 * 30, hours)) : 24,
    limit: 12,
    page: currentPage,
    projectId: projectId === "all" ? null : projectId,
    category: category as never,
    quotaState: quotaState as never,
    success: success as never,
  });

  const allProjectIds = [
    ...summary.topProjects.map((item) => item.projectId),
    ...summary.recentEntries.map((entry) => entry.projectId).filter(Boolean),
  ].filter((value): value is string => Boolean(value) && value !== "unassigned");

  const projects = allProjectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: [...new Set(allProjectIds)] } },
        select: { id: true, name: true },
      })
    : [];
  const projectNames = new Map(projects.map((item) => [item.id, item.name]));

  const filterProjectOptions = summary.topProjects.filter((item) => item.projectId !== "unassigned");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="API 监控"
        title="调用、额度与重试监控"
        description="这里展示最近窗口内的 AI / 图像请求、成功失败、额度状态，以及同一次逻辑调用下的内部重试聚合结果。"
      />

      <div className="flex justify-end">
        <ClearUsageButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选器</CardTitle>
          <CardDescription>按时间、项目、调用类型和状态快速定位高花费或高失败链路。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" method="GET">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">时间范围</span>
              <Select name="hours" defaultValue={String(hours)}>
                <option value="1">最近 1 小时</option>
                <option value="6">最近 6 小时</option>
                <option value="24">最近 24 小时</option>
                <option value="72">最近 3 天</option>
                <option value="168">最近 7 天</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">项目</span>
              <Select name="projectId" defaultValue={projectId}>
                <option value="all">全部项目</option>
                {filterProjectOptions.map((item) => (
                  <option key={item.projectId} value={item.projectId}>
                    {projectLabel(item.projectId, projectNames)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">调用类型</span>
              <Select name="category" defaultValue={category}>
                <option value="all">全部类型</option>
                <option value="models">模型列表</option>
                <option value="chat">文本生成</option>
                <option value="structured">结构化输出</option>
                <option value="image_generation">图像生成</option>
                <option value="image_edit">图像编辑</option>
                <option value="google_generate_content">Google 图像协议</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">状态</span>
              <Select name="success" defaultValue={success}>
                <option value="all">全部状态</option>
                <option value="success">仅成功</option>
                <option value="failed">仅失败</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">额度 / 限流</span>
              <Select name="quotaState" defaultValue={quotaState}>
                <option value="all">全部</option>
                <option value="spending_limited">额度已满</option>
                <option value="rate_limited">限流</option>
                <option value="auth_error">鉴权异常</option>
                <option value="other_error">其他错误</option>
                <option value="ok">正常</option>
              </Select>
            </label>
            <div className="md:col-span-2 xl:col-span-5 flex justify-end">
              <input type="hidden" name="page" value="1" />
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
              >
                <Filter className="mr-2 h-4 w-4" />
                应用筛选
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">总调用</p>
              <p className="mt-2 text-3xl font-semibold">{summary.totalRequests}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/8">
              <Activity className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">图像调用</p>
              <p className="mt-2 text-3xl font-semibold">{summary.imageRequests}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
              <ImageIcon className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">失败次数</p>
              <p className="mt-2 text-3xl font-semibold">{summary.failedRequests}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">额度 / 限流告警</p>
              <p className="mt-2 text-3xl font-semibold">
                {summary.spendingLimitedRequests + summary.rateLimitedRequests}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/10">
              <Sparkles className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">已记录费用</p>
              <p className="mt-2 text-3xl font-semibold">
                {summary.costSamples > 0 ? `$${summary.actualCostUsd.toFixed(4)}` : "--"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.costSamples > 0 ? `来自 ${summary.costSamples} 条 cost 样本` : "代理商未返回账单字段"}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <Coins className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>项目分布</CardTitle>
            <CardDescription>帮助你快速看出最近是哪些项目最热、最频繁。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.topProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂时还没有项目级调用记录。</p>
            ) : (
              summary.topProjects.map((item) => (
                <div key={item.projectId} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{projectLabel(item.projectId, projectNames)}</p>
                    <p className="text-xs text-muted-foreground">{item.projectId}</p>
                  </div>
                  <Badge variant="outline">{item.count} 次</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>高频模型</CardTitle>
            <CardDescription>最近窗口内调用最频繁的模型。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.topModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂时还没有调用记录。</p>
            ) : (
              summary.topModels.map((item) => (
                <div key={item.model} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.model}</p>
                  </div>
                  <Badge variant="outline">{item.count} 次</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近请求明细</CardTitle>
          <CardDescription>
            同一次逻辑调用的内部重试会折叠展示，只保留最终结果作为主记录。当前第 {summary.page} / {summary.totalPages} 页，共 {summary.totalRequests} 条记录。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有 API 调用记录。</p>
          ) : (
            summary.recentEntries.map((entry: ApiUsageEntry) => (
              <div key={entry.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.success ? "success" : "destructive"}>{entry.success ? "成功" : "失败"}</Badge>
                    <Badge variant="outline">{entry.category}</Badge>
                    {entry.quotaState === "spending_limited" ? <Badge variant="warning">额度已满</Badge> : null}
                    {entry.quotaState === "rate_limited" ? <Badge variant="warning">限流</Badge> : null}
                    {entry.attemptCount > 1 ? (
                      <Badge variant="outline">
                        <RefreshCcw className="mr-1 h-3 w-3" />
                        重试 {entry.attemptCount} 次
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{formatTime(entry.timestamp)}</span>
                  </div>
                  <DeleteUsageEntryButton entryId={entry.id} />
                </div>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-[1fr_1.45fr_1fr_0.85fr_1fr]">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">项目</p>
                    <p className="break-words font-medium">{entry.projectId ? projectLabel(entry.projectId, projectNames) : "未归属"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">操作</p>
                    <p className="break-all font-mono text-[13px] font-semibold leading-5">{entry.operation ?? "未标记"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">模型</p>
                    <p className="break-all font-mono text-[13px] font-semibold leading-5">{entry.model ?? "未知模型"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">耗时</p>
                    <p className="flex items-center gap-1 font-medium">
                      <Clock3 className="h-3.5 w-3.5" />
                      {entry.durationMs} ms
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">用量</p>
                    <p className="break-words font-medium">
                      {entry.totalTokens !== null ? `${entry.totalTokens} tokens` : "无 tokens"}
                      {entry.actualCostUsd !== null ? ` / $${entry.actualCostUsd.toFixed(6)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-start gap-2 break-all">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    <span>最终命中端点：{entry.finalEndpoint ?? entry.endpoint}</span>
                  </p>
                  {entry.retrySummary ? (
                    <p className="flex items-start gap-2">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${entry.success ? "bg-amber-500" : "bg-rose-500"}`} />
                      <span>
                        {entry.success ? "内部重试摘要：" : "中间失败摘要："}
                        {displayMonitorError(entry.retrySummary, entry.statusCode)}
                      </span>
                    </p>
                  ) : null}
                </div>

                {entry.collapsedAttempts.length > 1 ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                    <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {entry.success ? "内部重试明细（最终已成功）" : "内部重试明细"}
                    </p>
                    <div className="space-y-2">
                      {entry.collapsedAttempts.map((attempt, index) => (
                        <div key={`${entry.id}-${attempt.endpoint}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                          <p>{attempt.success ? "成功" : "失败"} · {attempt.statusCode}</p>
                          <p className="mt-1 break-all">{attempt.endpoint}</p>
                          {attempt.errorMessage ? (
                            <p className="mt-1 text-rose-600 dark:text-rose-300">{displayMonitorError(attempt.errorMessage, attempt.statusCode)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!entry.success && entry.errorMessage ? (
                  <>
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <p className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                        <span>{displayMonitorError(entry.errorMessage, entry.statusCode)}</span>
                      </p>
                    </div>
                    <p className="hidden">{displayMonitorError(entry.errorMessage, entry.statusCode)}</p>
                  </>
                ) : null}
              </div>
            ))
          )}

          {summary.totalPages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                第 {summary.page} / {summary.totalPages} 页，每页 {summary.pageSize} 条
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={buildMonitorPageHref({
                    hours,
                    projectId,
                    category,
                    quotaState,
                    success,
                    page: Math.max(1, summary.page - 1),
                  })}
                  aria-disabled={summary.page <= 1}
                  className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm transition ${
                    summary.page <= 1
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60 pointer-events-none dark:bg-white/[0.04]"
                      : "border-border bg-white hover:bg-muted dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  上一页
                </Link>

                {Array.from({ length: summary.totalPages }, (_, index) => index + 1)
                  .filter((value) => {
                    if (summary.totalPages <= 7) return true;
                    return (
                      value === 1 ||
                      value === summary.totalPages ||
                      Math.abs(value - summary.page) <= 1
                    );
                  })
                  .map((value, index, list) => {
                    const previous = list[index - 1];
                    const showGap = previous && value - previous > 1;
                    return (
                      <div key={value} className="flex items-center gap-2">
                        {showGap ? <span className="text-sm text-muted-foreground">…</span> : null}
                        <Link
                          href={buildMonitorPageHref({
                            hours,
                            projectId,
                            category,
                            quotaState,
                            success,
                            page: value,
                          })}
                          className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm transition ${
                            value === summary.page
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-white hover:bg-muted dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                          }`}
                        >
                          {value}
                        </Link>
                      </div>
                    );
                  })}

                <Link
                  href={buildMonitorPageHref({
                    hours,
                    projectId,
                    category,
                    quotaState,
                    success,
                    page: Math.min(summary.totalPages, summary.page + 1),
                  })}
                  aria-disabled={summary.page >= summary.totalPages}
                  className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm transition ${
                    summary.page >= summary.totalPages
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60 pointer-events-none dark:bg-white/[0.04]"
                      : "border-border bg-white hover:bg-muted dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  下一页
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
