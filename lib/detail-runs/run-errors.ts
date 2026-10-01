import { networkErrorCode } from "@/lib/utils/network-error";

// SDK errors can retain model input, request headers and complete agent state.
// Persist only classified codes and schema field paths, never serialize the error.
function errorChain(error: unknown) {
  const pending = [error], seen = new Set<unknown>(), result: Record<string, any>[] = [];
  while (pending.length && result.length < 12) {
    const item = pending.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item); result.push(item as Record<string, any>);
    const value = item as Record<string, unknown>;
    pending.push(value.cause, value.error, value.originalError);
  }
  return result;
}

export function toolInputFeedback(error: unknown): string[] | undefined {
  const chain = errorChain(error);
  if (!chain.some(e => e.name === "InvalidToolInputError" || e.name === "ZodError")) return undefined;
  const issues = chain.find(e => Array.isArray(e.issues))?.issues as Record<string, any>[] | undefined;
  const codes = new Set(["invalid_type", "invalid_value", "too_small", "too_big", "invalid_union", "unrecognized_keys", "invalid_format"]);
  return issues?.length ? issues.slice(0, 8).map(issue => {
    const field = Array.isArray(issue.path) ? issue.path.map((part: unknown) => typeof part === "number" ? part : typeof part === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(part) ? part : "field").join(".") : "input";
    const limit = Number.isFinite(issue.minimum) ? `; minimum=${issue.minimum}` : Number.isFinite(issue.maximum) ? `; maximum=${issue.maximum}` : "";
    return `${field || "input"}: ${codes.has(issue.code) ? issue.code : "invalid"}${limit}`;
  }) : ["input: invalid JSON or tool argument structure"];
}

export function describeRunFailure(error: unknown, phase: string) {
  const chain = errorChain(error);
  const names = chain.map(e => e.name);
  const messages = chain.map(e => typeof e.message === "string" ? e.message : "");
  const status = chain.find(e => typeof e.status === "number")?.status;
  const fields = toolInputFeedback(error);
  const network = networkErrorCode(error);
  let code = "RUN_INTERNAL_ERROR", message = "运行发生内部错误，检查点已保留，可继续未完成部分。";
  if (messages.includes("PLANNING_REVIEW_FAILED")) {
    code = "PLANNING_REVIEW_FAILED"; message = "商品卖点方案未通过检查，尚未开始出图；草稿与具体问题已保留，继续任务将修正当前草稿。";
  } else if (messages.includes("DESIGN_REVIEW_FAILED")) {
    code = "DESIGN_REVIEW_FAILED"; message = "文案或分镜未通过检查，尚未开始出图；具体原因见设计检查说明。草稿已保留，继续任务将复用草稿并修正未通过项。";
  } else if (fields) {
    code = "INVALID_TOOL_INPUT"; message = `模型返回的数据不符合工具格式，未能完成格式修正。字段：${fields.join("；")}。可从当前检查点继续。`;
  } else if (status === 401 || status === 403) {
    code = "PROVIDER_AUTH_ERROR"; message = `厂商拒绝访问（HTTP ${status}），请核对 Key 和模型权限后继续。`;
  } else if (status === 429) {
    code = "PROVIDER_RATE_LIMIT"; message = "厂商限流或额度不足（HTTP 429），请核对额度或稍后继续。";
  } else if (names.some(n => /Timeout|Abort/.test(n || "")) || messages.some(m => /timed out|timeout/i.test(m)) || network === "ETIMEDOUT" || network === "UND_ERR_CONNECT_TIMEOUT") {
    code = "PROVIDER_TIMEOUT"; message = "模型请求超时，检查点已保留，请稍后继续。";
  } else if (network === "EACCES" || network === "EPERM") {
    code = "PROVIDER_NETWORK_PERMISSION"; message = "服务端外网访问被运行环境限制，请恢复网络权限后继续。";
  } else if (network === "UND_ERR_SOCKET" || network === "ECONNRESET") {
    code = "PROVIDER_CONNECTION_INTERRUPTED"; message = "与模型网关的连接中断，当前检查点已保留，可稍后继续未完成部分。";
  } else if (network || names.includes("APIConnectionError")) {
    code = "PROVIDER_NETWORK_ERROR"; message = "服务端无法连接模型厂商，请检查网络或网关地址后继续。";
  } else if (status) {
    code = "PROVIDER_HTTP_ERROR"; message = `厂商返回 HTTP ${status}，请检查 API 监控后继续。`;
  } else if (names.includes("MaxTurnsExceededError") || messages.includes("TOOL_LIMIT")) {
    code = "AGENT_TURN_LIMIT"; message = "模型在允许的轮次内未提交有效结果，检查点已保留，可继续未完成部分。";
  } else if (names.includes("ModelRefusalError")) {
    code = "MODEL_REFUSAL"; message = "模型拒绝处理本轮请求，请检查素材或创作要求。";
  } else if (messages.some(m => ["PLAN_MISSING", "ART_DIRECTION_MISSING", "CHECK_MISSING", "PAGE_REVIEW_MISSING", "DESIGN_REVIEW_MISSING"].includes(m))) {
    code = "AGENT_RESULT_MISSING"; message = "模型返回了回复，但没有提交本阶段所需的有效工具结果；检查点已保留，可继续。";
  } else if (names.includes("ModelBehaviorError")) {
    code = "MODEL_RESPONSE_INVALID"; message = "模型响应不符合 SDK 协议，未能完成本阶段；请检查厂商模型兼容性后继续。";
  }
  return { code, phase, message, ...(network ? { networkCode: network } : {}), ...(fields ? { fields } : {}), at: new Date().toISOString() };
}
