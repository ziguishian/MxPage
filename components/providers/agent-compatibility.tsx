"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function AgentCompatibility() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <section className="space-y-3 rounded-2xl border p-5"><h2 className="font-semibold">一键详情页 · Agent 兼容性</h2><p className="text-sm text-muted-foreground">先保存下方配置并选择规划、详情图和改图模型。检测会调用规划模型，验证图片识别和工具调用往返；不生成商品图片。</p><Button variant="outline" disabled={busy} onClick={async () => {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/providers/agent-compatibility", { method: "POST" }); const p = await response.json(); if (!p.success) throw new Error(p.error?.message || "检测失败"); setMessage(`检测通过：${p.data.modelId} · ${p.data.transport}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "检测失败"); }
    finally { setBusy(false); }
  }}>{busy ? "正在检测…" : "检测当前 Agent 配置"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
