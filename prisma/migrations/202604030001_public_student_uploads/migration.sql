ALTER TABLE "UploadBatch"
ALTER COLUMN "uploaderId" DROP NOT NULL;

ALTER TABLE "UploadBatch"
ADD COLUMN "encryptedIdentity" TEXT;
