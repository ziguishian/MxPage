CREATE TABLE "DetailRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "stage" TEXT NOT NULL DEFAULT '准备中',
  "input" JSONB NOT NULL,
  "checkpoint" JSONB NOT NULL,
  "leaseToken" TEXT,
  "leaseUntil" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DetailRun_projectId_idempotencyKey_key" ON "DetailRun"("projectId", "idempotencyKey");
CREATE INDEX "DetailRun_projectId_createdAt_idx" ON "DetailRun"("projectId", "createdAt");
CREATE UNIQUE INDEX "DetailRun_one_running_project" ON "DetailRun"("projectId") WHERE "status" IN ('PENDING', 'RUNNING', 'WAITING_INPUT');
