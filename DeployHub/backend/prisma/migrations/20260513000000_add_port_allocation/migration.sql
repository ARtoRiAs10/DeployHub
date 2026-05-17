-- Add hostPort to Deployment table
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "hostPort" INTEGER;

-- Create PortAllocation table to track EC2 host ports
CREATE TABLE IF NOT EXISTS "PortAllocation" (
  "id"           TEXT NOT NULL,
  "projectId"    TEXT NOT NULL,
  "deploymentId" TEXT NOT NULL,
  "hostPort"     INTEGER NOT NULL,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PortAllocation_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "PortAllocation" ADD CONSTRAINT "PortAllocation_deploymentId_key" UNIQUE ("deploymentId");
ALTER TABLE "PortAllocation" ADD CONSTRAINT "PortAllocation_hostPort_key" UNIQUE ("hostPort");

-- Indexes
CREATE INDEX IF NOT EXISTS "PortAllocation_hostPort_idx" ON "PortAllocation"("hostPort");
CREATE INDEX IF NOT EXISTS "PortAllocation_projectId_idx" ON "PortAllocation"("projectId");

-- Foreign keys
ALTER TABLE "PortAllocation" ADD CONSTRAINT "PortAllocation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortAllocation" ADD CONSTRAINT "PortAllocation_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
