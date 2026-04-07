ALTER TABLE "Assignment"
ADD COLUMN "comparisonInputVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ComparisonRun"
ADD COLUMN "inputVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ComparisonRun_assignmentId_active_unique"
ON "ComparisonRun"("assignmentId")
WHERE "status" IN ('QUEUED', 'RUNNING');
