-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'BUILDING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE "DeploymentSource" AS ENUM ('GITHUB', 'ZIP');
-- CreateTable
CREATE TABLE "Project" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "repoUrl" TEXT, "framework" TEXT, "buildCommand" TEXT, "outputDir" TEXT,
  "nodeVersion" TEXT NOT NULL DEFAULT '20', "envVars" JSONB, "isBackend" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Deployment" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "status" "DeploymentStatus" NOT NULL DEFAULT 'QUEUED',
  "source" "DeploymentSource" NOT NULL,
  "commitHash" TEXT, "commitMsg" TEXT, "branch" TEXT, "buildLog" TEXT,
  "previewUrl" TEXT, "s3Key" TEXT, "ecrImageUri" TEXT, "framework" TEXT,
  "buildCommand" TEXT, "outputDir" TEXT, "errorMsg" TEXT,
  "isBackend" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "finishedAt" TIMESTAMP(3),
  CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");
