import { Prisma, type TaskStatus, type TaskType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { assertNoDetailRun } from "@/lib/detail-runs/lock";

export type MxTaskType = TaskType;

function toJsonValue(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function createTask(input: {
  projectId: string;
  sectionId?: string | null;
  taskType: MxTaskType;
  inputPayload?: unknown;
  outputPayload?: unknown;
  status?: TaskStatus;
}) {
  const status = input.status ?? "RUNNING";
  if (input.taskType !== "EXPORT") await assertNoDetailRun(input.projectId);
  return prisma.generationTask.create({
    data: {
      projectId: input.projectId,
      sectionId: input.sectionId ?? null,
      taskType: input.taskType,
      status,
      startedAt: status === "RUNNING" ? new Date() : null,
      inputPayload: toJsonValue(input.inputPayload),
      outputPayload: toJsonValue(input.outputPayload),
    },
  });
}

export async function findRecentRunningTask(input: {
  projectId: string;
  taskType: MxTaskType;
  sectionId?: string | null;
  maxAgeMinutes?: number;
}) {
  const maxAgeMinutes = input.maxAgeMinutes ?? 10;
  const startedAfter = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  return prisma.generationTask.findFirst({
    where: {
      projectId: input.projectId,
      sectionId: input.sectionId ?? null,
      taskType: input.taskType,
      status: "RUNNING",
      startedAt: {
        gte: startedAfter,
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getTask(taskId: string) {
  return prisma.generationTask.findUnique({
    where: { id: taskId },
  });
}

export async function startTask(taskId: string, patch?: unknown) {
  const current = await getTask(taskId);
  return prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "RUNNING",
      startedAt: current?.startedAt ?? new Date(),
      outputPayload: toJsonValue({
        ...asRecord(current?.outputPayload),
        ...asRecord(patch),
      }),
    },
  });
}

export async function updateTaskProgress(taskId: string, patch: Record<string, unknown>) {
  const current = await getTask(taskId);
  if (!current || current.status === "CANCELED") {
    return current;
  }

  return prisma.generationTask.update({
    where: { id: taskId },
    data: {
      outputPayload: toJsonValue({
        ...asRecord(current.outputPayload),
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    },
  });
}

export async function completeTask(taskId: string, outputPayload?: unknown) {
  const current = await getTask(taskId);
  if (current?.status === "CANCELED") {
    return current;
  }

  return prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "SUCCESS",
      completedAt: new Date(),
      outputPayload: toJsonValue({
        ...asRecord(current?.outputPayload),
        ...asRecord(outputPayload),
        completedAt: new Date().toISOString(),
      }),
    },
  });
}

export async function failTask(taskId: string, errorMessage: string, outputPayload?: unknown) {
  const current = await getTask(taskId);
  if (current?.status === "CANCELED") {
    return current;
  }

  return prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage,
      outputPayload: toJsonValue({
        ...asRecord(current?.outputPayload),
        ...asRecord(outputPayload),
        failedAt: new Date().toISOString(),
      }),
    },
  });
}

export async function cancelTask(taskId: string) {
  return prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "CANCELED",
      completedAt: new Date(),
      errorMessage: "Canceled by user.",
    },
  });
}

export async function assertTaskNotCanceled(taskId: string) {
  const task = await getTask(taskId);
  if (task?.status === "CANCELED") {
    throw new Error("Task canceled.");
  }
  return task;
}

export function runTaskInBackground(handler: () => Promise<void>) {
  void handler().catch((error) => {
    console.error("[Task Runner] Unhandled background task error", error);
  });
}
