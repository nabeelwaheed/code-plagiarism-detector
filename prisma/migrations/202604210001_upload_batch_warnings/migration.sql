ALTER TABLE "UploadBatch"
ADD COLUMN "warningMessage" TEXT,
ADD COLUMN "skippedSubmissionCount" INTEGER NOT NULL DEFAULT 0;
