import { setTimeout as delay } from "node:timers/promises";
import { networkErrorCode } from "@/lib/utils/network-error";
import { describeRunFailure } from "./run-errors";

export class BriefPreparationError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "BriefPreparationError";
  }
}

// Only for read-only recognition/review. Never wrap image generation or an
// Agent that can mutate project data. The SDK itself has maxRetries: 0.
export async function runBriefStep<T>(phase: "识别" | "复核", work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const failure = describeRunFailure(error, phase);
      // Keep actionable local validation (for example, a missing model choice).
      if (failure.code === "RUN_INTERNAL_ERROR") throw error;
      const network = networkErrorCode(error);
      const retryable = ["ECONNRESET", "UND_ERR_SOCKET", "EAI_AGAIN", "ECONNREFUSED"].includes(network || "") ||
        failure.code === "PROVIDER_HTTP_ERROR" && /HTTP (500|502|503|504)\b/.test(failure.message);
      if (attempt === 0 && retryable) { await delay(750 + Math.random() * 250); continue; }
      const status = failure.code === "PROVIDER_AUTH_ERROR" ? 401 : failure.code === "PROVIDER_RATE_LIMIT" ? 429 : failure.code === "PROVIDER_TIMEOUT" ? 504 : failure.code === "PROVIDER_NETWORK_PERMISSION" ? 503 : 502;
      const reason = network === "ECONNRESET" || network === "UND_ERR_SOCKET" ? "与模型厂商的连接中断。" : failure.code === "PROVIDER_TIMEOUT" ? "模型厂商响应超时，请稍后重试。" : failure.message;
      const progress = phase === "复核" ? "商品识别结果已保存，图像复核暂未完成。点击“重试分析”将继续复核。" : "商品识别暂未完成，请重试分析。";
      throw new BriefPreparationError(failure.code, status, `${progress}${reason}`);
    }
  }
}
