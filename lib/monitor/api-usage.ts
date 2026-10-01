import fs from "fs/promises";
import path from "path";

import { env } from "@/lib/utils/env";

export type ApiUsageCategory =
  | "models"
  | "chat"
  | "structured"
  | "image_generation"
  | "image_edit"
  | "google_generate_content"
  | "unknown";

export interface ApiUsageEntry {
  id: string;
  timestamp: string;
  providerBaseUrl: string;
  endpoint: string;
  finalEndpoint: string | null;
  method: string;
  model: string | null;
  projectId: string | null;
  sectionId: string | null;
  runId?: string | null;
  operation: string | null;
  category: ApiUsageCategory;
  success: boolean;
  statusCode: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  actualCostUsd: number | null;
  attemptCount: number;
  retrySummary: string | null;
  collapsedAttempts: Array<{
    endpoint: string;
    statusCode: number;
    success: boolean;
    errorMessage: string | null;
  }>;
  quotaState: "ok" | "rate_limited" | "spending_limited" | "auth_error" | "other_error";
  errorMessage: string | null;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractRawMessage(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const parsed = tryParseJson(trimmed);
  if (parsed && typeof parsed === "object") {
    const message =
      (parsed as any)?.error?.message ??
      (parsed as any)?.message ??
      (parsed as any)?.detail ??
      null;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  const embeddedJsonMatch = trimmed.match(/\{[\s\S]*\}$/);
  if (embeddedJsonMatch) {
    const embeddedParsed = tryParseJson(embeddedJsonMatch[0]);
    const embeddedMessage =
      (embeddedParsed as any)?.error?.message ??
      (embeddedParsed as any)?.message ??
      (embeddedParsed as any)?.detail ??
      null;
    if (typeof embeddedMessage === "string" && embeddedMessage.trim()) {
      return embeddedMessage.trim();
    }
  }

  return trimmed;
}

function fallbackMessageByStatus(statusCode: number) {
  if (statusCode === 401 || statusCode === 403) {
    return "当前 API Key 无效、无权限，或已被额度策略拒绝。";
  }
  if (statusCode === 404) {
    return "当前接口或模型在代理商侧不可用。";
  }
  if (statusCode === 408 || statusCode === 504) {
    return "请求超时，请稍后重试。";
  }
  if (statusCode === 429) {
    return "当前请求触发了限流，请稍后再试。";
  }
  if (statusCode >= 500) {
    return "代理商服务暂时不可用，请稍后重试。";
  }
  return "请求失败，请检查配置或稍后重试。";
}

export function humanizeApiMonitorMessage(input: {
  message: string | null | undefined;
  statusCode?: number | null;
}) {
  const statusCode = input.statusCode ?? 0;
  const raw = extractRawMessage(input.message);
  if (!raw) {
    return statusCode >= 400 ? fallbackMessageByStatus(statusCode) : null;
  }

  const normalized = raw.toLowerCase();

  if (/\bEACCES\b|\bEPERM\b/i.test(raw)) {
    return "本地服务的外网访问被运行环境限制，请在允许联网的环境中重新启动服务。";
  }

  if (
    /monthly spending limit|spending limit|insufficient_quota|quota.*exceed|quota exceeded|billing|可用余额不足|余额不足|充值后再使用/i.test(
      raw,
    )
  ) {
    return "当前 API Key 已达到月度额度上限，请前往代理商后台提高或取消月度限额，或更换可用 Key。";
  }

  if (statusCode === 429 || /rate limit|触发限流|too many requests/i.test(raw)) {
    return "当前请求触发了限流，请稍后重试或降低调用频率。";
  }

  if (statusCode === 401 || /invalid token|unauthorized|forbidden|invalid api key|api key/i.test(normalized)) {
    return "当前 API Key 无效或无权限，请检查 API Key、代理地址和账户权限。";
  }

  if (/timed out|timeout|network error|fetch failed|socket hang up|econnreset|enotfound|econnrefused/i.test(normalized)) {
    return "网络请求失败或响应超时，请检查代理地址是否可达，或稍后重试。";
  }

  if (/this operation was aborted|aborterror/i.test(normalized)) {
    return "请求已被中止，通常是超时控制或探测流程主动停止。";
  }

  if (/no available endpoint found|get instance failed|real image generation endpoint/i.test(normalized)) {
    return "当前代理商没有为该模型提供可用端点，请更换模型或 Provider。";
  }

  if (/model .* does not exist|unknown model|invalid.*model|not found for model/i.test(normalized)) {
    return "当前模型在该代理商不可用，请重新发现模型并选择可用模型。";
  }

  if (/page not found|not found|unknown parameter|invalid type for 'images|invalid type for \"images|expected an object/i.test(normalized)) {
    return "当前代理接口或参数格式与该能力不兼容，请检查代理商是否完整支持此图像接口。";
  }

  if (/invalid value/i.test(normalized) && /1024x1024|1024x1536|1536x1024|auto|size/i.test(normalized)) {
    return "当前图像尺寸参数不被该模型或代理商接受，系统需要切换到兼容尺寸。";
  }

  if (/image generation temporarily unavailable|图像生成接口暂时不可用/i.test(raw)) {
    return "图像生成接口暂时不可用，请稍后重试或更换可用模型。";
  }

  if (/malformed|json|schema/i.test(normalized)) {
    return "模型返回的结构化结果不符合预期，系统正在尝试自动修复。";
  }

  if (raw.length > 140) {
    return `${raw.slice(0, 137)}...`;
  }

  return raw;
}

function humanizeRetrySummary(summary: string | null | undefined) {
  if (!summary) {
    return null;
  }

  return summary
    .split(/\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const endpointMatch = item.match(/^(.*?) -> (\d+): (.*)$/);
      if (!endpointMatch) {
        return humanizeApiMonitorMessage({ message: item, statusCode: null }) ?? item;
      }

      const [, endpoint, statusCodeText, message] = endpointMatch;
      const statusCode = Number(statusCodeText);
      const humanized = humanizeApiMonitorMessage({ message, statusCode }) ?? message;
      return `${endpoint} -> ${statusCode}: ${humanized}`;
    })
    .join(" | ");
}

function humanizeEntry(entry: ApiUsageEntry) {
  return {
    ...entry,
    retrySummary: humanizeRetrySummary(entry.retrySummary),
    errorMessage: humanizeApiMonitorMessage({
      message: entry.errorMessage,
      statusCode: entry.statusCode,
    }),
    collapsedAttempts: (entry.collapsedAttempts ?? []).map((attempt) => ({
      ...attempt,
      errorMessage: humanizeApiMonitorMessage({
        message: attempt.errorMessage,
        statusCode: attempt.statusCode,
      }),
    })),
  } satisfies ApiUsageEntry;
}

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

function monitorDir() {
  return path.join(rootDir(), "monitor");
}

function usageLogPath() {
  return path.join(monitorDir(), "api-usage.jsonl");
}

async function ensureMonitorDir() {
  await fs.mkdir(monitorDir(), { recursive: true });
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractUsage(payload: any) {
  if (!payload || typeof payload !== "object") {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      actualCostUsd: null,
    };
  }

  const usage = payload.usage ?? payload.usageMetadata ?? payload.usage_metadata ?? null;
  const promptTokens =
    toNumberOrNull(usage?.prompt_tokens) ??
    toNumberOrNull(usage?.input_tokens) ??
    toNumberOrNull(usage?.promptTokenCount) ??
    toNumberOrNull(usage?.inputTokenCount);
  const completionTokens =
    toNumberOrNull(usage?.completion_tokens) ??
    toNumberOrNull(usage?.output_tokens) ??
    toNumberOrNull(usage?.candidatesTokenCount) ??
    toNumberOrNull(usage?.outputTokenCount);
  const totalTokens =
    toNumberOrNull(usage?.total_tokens) ??
    toNumberOrNull(usage?.totalTokenCount) ??
    (promptTokens !== null || completionTokens !== null
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : null);
  const actualCostUsd =
    toNumberOrNull(payload.cost) ??
    toNumberOrNull(payload.total_cost) ??
    toNumberOrNull(payload.usage?.cost) ??
    toNumberOrNull(payload.usage?.total_cost);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    actualCostUsd,
  };
}

function classifyQuotaState(statusCode: number, body: string) {
  const text = body.toLowerCase();
  if (/monthly spending limit|spending limit|quota|insufficient_quota|billing|可用余额不足|余额不足|充值后再使用/i.test(body)) {
    return "spending_limited" as const;
  }
  if (statusCode === 429 || /rate limit|限流/i.test(body)) {
    return "rate_limited" as const;
  }
  if (statusCode === 401 || statusCode === 403 || /invalid token|unauthorized|forbidden/i.test(text)) {
    return "auth_error" as const;
  }
  if (statusCode >= 400) {
    return "other_error" as const;
  }
  return "ok" as const;
}

export function inferCategory(endpoint: string, bodyPayload?: Record<string, unknown> | null): ApiUsageCategory {
  const endpointText = endpoint.toLowerCase();

  if (endpointText.endsWith("/models")) {
    return "models";
  }
  if (endpointText.includes(":generatecontent")) {
    return "google_generate_content";
  }
  if (endpointText.includes("/images/edits")) {
    return "image_edit";
  }
  if (endpointText.includes("/images/generations")) {
    return "image_generation";
  }
  if (endpointText.includes("/chat/completions")) {
    return bodyPayload?.response_format ? "structured" : "chat";
  }
  return "unknown";
}

export async function logApiUsage(params: {
  providerBaseUrl: string;
  endpoint: string;
  finalEndpoint?: string | null;
  method: string;
  model: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  runId?: string | null;
  operation?: string | null;
  category: ApiUsageCategory;
  statusCode: number;
  durationMs: number;
  success: boolean;
  requestBytes: number;
  responseBytes: number;
  responseBody: string;
  attemptCount?: number;
  retrySummary?: string | null;
  collapsedAttempts?: Array<{
    endpoint: string;
    statusCode: number;
    success: boolean;
    errorMessage: string | null;
  }>;
  errorMessage?: string | null;
}) {
  let parsedPayload: any = null;
  try {
    parsedPayload = params.responseBody ? JSON.parse(params.responseBody) : null;
  } catch {
    parsedPayload = null;
  }

  const usage = extractUsage(parsedPayload);
  const entry: ApiUsageEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    providerBaseUrl: params.providerBaseUrl,
    endpoint: params.endpoint,
    finalEndpoint: params.finalEndpoint ?? params.endpoint,
    method: params.method,
    model: params.model,
    projectId: params.projectId ?? null,
    sectionId: params.sectionId ?? null,
    runId: params.runId ?? null,
    operation: params.operation ?? null,
    category: params.category,
    success: params.success,
    statusCode: params.statusCode,
    durationMs: params.durationMs,
    requestBytes: params.requestBytes,
    responseBytes: params.responseBytes,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    actualCostUsd: usage.actualCostUsd,
    attemptCount: params.attemptCount ?? 1,
    retrySummary: params.retrySummary ?? null,
    collapsedAttempts: params.collapsedAttempts ?? [],
    quotaState: classifyQuotaState(params.statusCode, params.responseBody),
    errorMessage: params.errorMessage ?? null,
  };

  await ensureMonitorDir();
  await fs.appendFile(usageLogPath(), `${JSON.stringify(entry)}\n`, "utf8");

  const tokenText =
    entry.totalTokens !== null
      ? `tokens=${entry.totalTokens}`
      : entry.category === "image_generation" || entry.category === "image_edit" || entry.category === "google_generate_content"
        ? "tokens=n/a"
        : "tokens=unknown";
  const costText = entry.actualCostUsd !== null ? `cost=$${entry.actualCostUsd.toFixed(6)}` : "cost=n/a";
  const modelText = entry.model ?? "unknown-model";
  const statusText = `${entry.success ? "OK" : "FAIL"} ${entry.statusCode}`;

  console.log(
    `[AI Monitor] ${entry.method} ${entry.endpoint} | model=${modelText} | ${statusText} | ${entry.durationMs}ms | ${tokenText} | ${costText}`,
  );

  if (entry.errorMessage) {
    console.log(`[AI Monitor] error=${entry.errorMessage}`);
  }

  return entry;
}

export async function listApiUsageEntries(limit = 100) {
  try {
    const raw = await fs.readFile(usageLogPath(), "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        const entry = JSON.parse(line) as Partial<ApiUsageEntry>;
        const normalizedEntry = {
          finalEndpoint: entry.finalEndpoint ?? entry.endpoint ?? null,
          attemptCount: entry.attemptCount ?? 1,
          retrySummary: entry.retrySummary ?? null,
          collapsedAttempts: entry.collapsedAttempts ?? [],
          ...entry,
        } as ApiUsageEntry;
        return humanizeEntry(normalizedEntry);
      });
  } catch {
    return [];
  }
}

export async function clearApiUsageEntries() {
  try {
    await fs.rm(usageLogPath(), { force: true });
  } catch {
    return { cleared: false };
  }

  return { cleared: true };
}

export async function deleteApiUsageEntry(entryId: string) {
  if (!entryId.trim()) {
    return { deleted: false, reason: "missing_id" as const };
  }

  try {
    const raw = await fs.readFile(usageLogPath(), "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const keptLines = lines.filter((line) => {
      try {
        const parsed = JSON.parse(line) as Partial<ApiUsageEntry>;
        return parsed.id !== entryId;
      } catch {
        return true;
      }
    });

    const deleted = keptLines.length !== lines.length;
    if (!deleted) {
      return { deleted: false, reason: "not_found" as const };
    }

    await ensureMonitorDir();
    const nextContent = keptLines.length > 0 ? `${keptLines.join("\n")}\n` : "";
    await fs.writeFile(usageLogPath(), nextContent, "utf8");
    return { deleted: true };
  } catch {
    return { deleted: false, reason: "io_error" as const };
  }
}

export async function getApiUsageSummary(options?: {
  hours?: number;
  limit?: number;
  page?: number;
  projectId?: string | null;
  category?: ApiUsageCategory | "all";
  quotaState?: ApiUsageEntry["quotaState"] | "all";
  success?: "all" | "success" | "failed";
}) {
  const hours = options?.hours ?? 24;
  const limit = options?.limit ?? 50;
  const page = Math.max(1, options?.page ?? 1);
  const entries = await listApiUsageEntries(Math.max(limit, 500));
  const since = Date.now() - hours * 60 * 60 * 1000;
  const filtered = entries.filter((entry) => {
    if (new Date(entry.timestamp).getTime() < since) {
      return false;
    }
    if (options?.projectId && entry.projectId !== options.projectId) {
      return false;
    }
    if (options?.category && options.category !== "all" && entry.category !== options.category) {
      return false;
    }
    if (options?.quotaState && options.quotaState !== "all" && entry.quotaState !== options.quotaState) {
      return false;
    }
    if (options?.success === "success" && !entry.success) {
      return false;
    }
    if (options?.success === "failed" && entry.success) {
      return false;
    }
    if (
      !entry.projectId &&
      !entry.operation &&
      (entry.category === "google_generate_content" ||
        entry.category === "image_generation" ||
        entry.category === "image_edit")
    ) {
      return false;
    }
    if (
      entry.category === "google_generate_content" &&
      !entry.success &&
      entry.statusCode === 404 &&
      /\/google\/models\//i.test(entry.endpoint)
    ) {
      return false;
    }
    return true;
  });

  const summary = {
    hours,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    totalRequests: filtered.length,
    successRequests: filtered.filter((entry) => entry.success).length,
    failedRequests: filtered.filter((entry) => !entry.success).length,
    chatRequests: filtered.filter((entry) => entry.category === "chat" || entry.category === "structured").length,
    imageRequests: filtered.filter(
      (entry) =>
        entry.category === "image_generation" ||
        entry.category === "image_edit" ||
        entry.category === "google_generate_content",
    ).length,
    spendingLimitedRequests: filtered.filter((entry) => entry.quotaState === "spending_limited").length,
    rateLimitedRequests: filtered.filter((entry) => entry.quotaState === "rate_limited").length,
    totalTokens: filtered.reduce((sum, entry) => sum + (entry.totalTokens ?? 0), 0),
    actualCostUsd: filtered.reduce((sum, entry) => sum + (entry.actualCostUsd ?? 0), 0),
    costSamples: filtered.filter((entry) => entry.actualCostUsd !== null).length,
    averageDurationMs:
      filtered.length > 0 ? Math.round(filtered.reduce((sum, entry) => sum + entry.durationMs, 0) / filtered.length) : 0,
    topModels: Object.entries(
      filtered.reduce<Record<string, number>>((accumulator, entry) => {
        const model = entry.model ?? "unknown-model";
        accumulator[model] = (accumulator[model] ?? 0) + 1;
        return accumulator;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([model, count]) => ({ model, count })),
    topProjects: Object.entries(
      filtered.reduce<Record<string, number>>((accumulator, entry) => {
        const projectId = entry.projectId ?? "unassigned";
        accumulator[projectId] = (accumulator[projectId] ?? 0) + 1;
        return accumulator;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([projectId, count]) => ({ projectId, count })),
    recentEntries: filtered.slice((page - 1) * limit, page * limit),
  };

  return summary;
}
