-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROFESSOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "AssignmentLanguage" AS ENUM ('JAVA', 'C', 'CPP');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('STUDENT_SUBMISSION', 'HISTORICAL_SUBMISSION', 'TEMPLATE_UPLOAD');

-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SubmissionKind" AS ENUM ('CURRENT', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "ComparisonRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchKind" AS ENUM ('CODE', 'COMMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "AssignmentLanguage" NOT NULL,
    "professorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentKey" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "status" "UploadBatchStatus" NOT NULL DEFAULT 'RECEIVED',
    "originalObjectKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "ownerId" TEXT,
    "displayName" TEXT NOT NULL,
    "kind" "SubmissionKind" NOT NULL,
    "concatenatedSource" TEXT NOT NULL,
    "sourceMapJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "storageObjectKey" TEXT NOT NULL,
    "canonicalOrder" INTEGER NOT NULL,
    "byteStart" INTEGER NOT NULL,
    "byteEnd" INTEGER NOT NULL,
    "archivePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentTemplate" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "concatenatedSource" TEXT NOT NULL,
    "sourceMapJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateFile" (
    "id" TEXT NOT NULL,
    "assignmentTemplateId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "storageObjectKey" TEXT NOT NULL,
    "canonicalOrder" INTEGER NOT NULL,
    "byteStart" INTEGER NOT NULL,
    "byteEnd" INTEGER NOT NULL,
    "archivePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonRun" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "status" "ComparisonRunStatus" NOT NULL DEFAULT 'QUEUED',
    "engineVersion" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairResult" (
    "id" TEXT NOT NULL,
    "comparisonRunId" TEXT NOT NULL,
    "leftSubmissionId" TEXT NOT NULL,
    "rightSubmissionId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "commentScore" DOUBLE PRECISION,
    "matchedTokenCount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairMatch" (
    "id" TEXT NOT NULL,
    "pairResultId" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "kind" "MatchKind" NOT NULL,
    "leftByteStart" INTEGER NOT NULL,
    "leftByteEnd" INTEGER NOT NULL,
    "rightByteStart" INTEGER NOT NULL,
    "rightByteEnd" INTEGER NOT NULL,
    "leftLineStart" INTEGER,
    "leftLineEnd" INTEGER,
    "rightLineStart" INTEGER,
    "rightLineEnd" INTEGER,
    "leftTokenStart" INTEGER,
    "leftTokenEnd" INTEGER,
    "rightTokenStart" INTEGER,
    "rightTokenEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentKey_publicKey_key" ON "AssignmentKey"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PairMatch_pairResultId_matchKey_key" ON "PairMatch"("pairResultId", "matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentKey" ADD CONSTRAINT "AssignmentKey_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTemplate" ADD CONSTRAINT "AssignmentTemplate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTemplate" ADD CONSTRAINT "AssignmentTemplate_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFile" ADD CONSTRAINT "TemplateFile_assignmentTemplateId_fkey" FOREIGN KEY ("assignmentTemplateId") REFERENCES "AssignmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonRun" ADD CONSTRAINT "ComparisonRun_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonRun" ADD CONSTRAINT "ComparisonRun_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "AssignmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairResult" ADD CONSTRAINT "PairResult_comparisonRunId_fkey" FOREIGN KEY ("comparisonRunId") REFERENCES "ComparisonRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairResult" ADD CONSTRAINT "PairResult_leftSubmissionId_fkey" FOREIGN KEY ("leftSubmissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairResult" ADD CONSTRAINT "PairResult_rightSubmissionId_fkey" FOREIGN KEY ("rightSubmissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairMatch" ADD CONSTRAINT "PairMatch_pairResultId_fkey" FOREIGN KEY ("pairResultId") REFERENCES "PairResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

