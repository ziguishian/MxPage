import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/utils/api";
import { networkErrorCode } from "./network-error";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(apiSuccess(data), init);
}

export function fail(code: string, message: string, details?: unknown, status = 400) {
  return NextResponse.json(apiError(code, message, details), { status });
}

function mapProviderError(error: Error) {
  const text = error.message.toLowerCase();
  const causeCode = networkErrorCode(error);

  if (causeCode === "EACCES" || causeCode === "EPERM") {
    return {
      code: "PROVIDER_NETWORK_PERMISSION",
      message: "本地服务的外网访问被运行环境限制。请在允许网络访问的环境中重新启动服务后重试。",
      status: 503,
    };
  }

  if (/monthly spending limit|spending limit|insufficient_quota|quota|billing|额度已用尽|月度限额/.test(text)) {
    return {
      code: "SPENDING_LIMIT_REACHED",
      message: "当前 API Key 的额度已用尽。请前往代理商控制台提高或移除月度限额，或更换可用的 API Key。",
      status: 403,
    };
  }

  if (/rate limit|429|限流/.test(text)) {
    return {
      code: "RATE_LIMITED",
      message: "当前请求触发了限流。请稍后重试，或降低调用频率。",
      status: 429,
    };
  }

  if (/invalid token|unauthorized|forbidden|鉴权失败|401|403/.test(text)) {
    return {
      code: "PROVIDER_AUTH_ERROR",
      message: "当前 Provider 鉴权失败。请检查 baseURL、API Key 或代理商权限配置。",
      status: 401,
    };
  }

  if (/timed out|timeout|aborterror|请求超时|\b504\b/.test(text) || causeCode === "ETIMEDOUT" || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "当前 Provider 响应超时，请稍后重试，并检查厂商服务状态。",
      status: 504,
    };
  }

  if (/network error|fetch failed|网络异常/.test(text) || causeCode) {
    return {
      code: "PROVIDER_NETWORK_ERROR",
      message: "本地服务无法连接模型厂商，请检查 baseURL、DNS、代理及防火墙设置。",
      status: 502,
    };
  }

  return null;
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "请求参数校验失败", error.flatten(), 400);
  }

  if (error instanceof Error) {
    const providerError = mapProviderError(error);
    if (providerError) {
      return fail(providerError.code, providerError.message, { rawMessage: error.message }, providerError.status);
    }

    const message = error.message.toLowerCase();
    if (message.includes("not found")) {
      return fail("NOT_FOUND", error.message, null, 404);
    }

    return fail("INTERNAL_ERROR", error.message, null, 500);
  }

  return fail("UNKNOWN_ERROR", "未知错误", null, 500);
}
