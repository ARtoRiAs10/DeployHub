ALTER TABLE "Project"    ADD COLUMN IF NOT EXISTS "projectSubDir"   TEXT;
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "detectionMethod" TEXT;
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "projectSubDir"   TEXT;
