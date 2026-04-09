import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStagedObjectKey,
  readObjectBuffer,
  writeObjectBuffer,
} from "@similarity/shared";
import { SubmissionsService } from "./submissions.service.js";

test("createPublicBulkStudentSubmissionArchive promotes the staged archive and enqueues only after a finalized save", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-service-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const stagedObjectKey = createStagedObjectKey("bulk-current-submissions.zip");
  await writeObjectBuffer(stagedObjectKey, Buffer.from("bulk archive"));

  const state: {
    createdObjectKey?: string;
    queuedJob?: Record<string, unknown>;
  } = {};

  const prisma = {
    assignmentKey: {
      findFirst: async () => ({
        assignment: {
          id: "assignment-1",
          language: "JAVA",
        },
      }),
    },
    uploadBatch: {
      create: async ({ data }: { data: { originalObjectKey: string } }) => {
        state.createdObjectKey = data.originalObjectKey;
        return { id: "batch-1" };
      },
      update: async () => {
        throw new Error("upload batch should not be updated on success");
      },
    },
  };
  const queueService = {
    enqueueUploadPreparation: async (job: Record<string, unknown>) => {
      state.queuedJob = job;
      assert.ok(state.createdObjectKey);
      assert.equal(
        (await readObjectBuffer(state.createdObjectKey)).toString("utf8"),
        "bulk archive",
      );
    },
  };

  try {
    const service = new SubmissionsService(prisma as never, queueService as never);

    const result = await service.createPublicBulkStudentSubmissionArchive({
      assignmentKey: "A1",
      fileName: "bulk-current-submissions.zip",
      stagedObjectKey,
    });

    assert.equal(result.assignmentId, "assignment-1");
    assert.equal(result.assignmentLanguage, "java");
    assert.equal(result.uploadBatchId, "batch-1");
    assert.equal(typeof result.statusToken, "string");
    assert.ok(result.statusToken.length > 0);
    assert.ok(state.createdObjectKey);
    assert.match(state.createdObjectKey, /^raw\/assignment-1\/bulk_student_submission\//);
    assert.deepEqual(state.queuedJob, {
      assignmentId: "assignment-1",
      assignmentLanguage: "java",
      uploadBatchId: "batch-1",
      kind: "bulk_current",
    });
    await assert.rejects(() => readObjectBuffer(stagedObjectKey));
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("createPublicBulkStudentSubmissionArchive cleans up the staged upload when validation fails before finalization", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-service-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const stagedObjectKey = createStagedObjectKey("not-a-zip.txt");
  await writeObjectBuffer(stagedObjectKey, Buffer.from("bad upload"));

  const service = new SubmissionsService({} as never, {} as never);

  try {
    await assert.rejects(
      () => service.createPublicBulkStudentSubmissionArchive({
        assignmentKey: "A1",
        fileName: "not-a-zip.txt",
        stagedObjectKey,
      }),
      (error: unknown) =>
        error instanceof BadRequestException
        && error.message === "uploaded archive must be a zip file",
    );

    await assert.rejects(() => readObjectBuffer(stagedObjectKey));
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("createPublicBulkStudentSubmissionArchive deletes the finalized object when database persistence fails", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-service-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const stagedObjectKey = createStagedObjectKey("bulk-current-submissions.zip");
  await writeObjectBuffer(stagedObjectKey, Buffer.from("bulk archive"));

  let createdObjectKey = "";

  const prisma = {
    assignmentKey: {
      findFirst: async () => ({
        assignment: {
          id: "assignment-1",
          language: "JAVA",
        },
      }),
    },
    uploadBatch: {
      create: async ({ data }: { data: { originalObjectKey: string } }) => {
        createdObjectKey = data.originalObjectKey;
        throw new Error("db create failed");
      },
      update: async () => {
        throw new Error("upload batch should not be updated on db failure");
      },
    },
  };
  const queueService = {
    enqueueUploadPreparation: async () => {
      throw new Error("queue should not be called on db failure");
    },
  };

  try {
    const service = new SubmissionsService(prisma as never, queueService as never);

    await assert.rejects(
      () => service.createPublicBulkStudentSubmissionArchive({
        assignmentKey: "A1",
        fileName: "bulk-current-submissions.zip",
        stagedObjectKey,
      }),
      /db create failed/,
    );

    await assert.rejects(() => readObjectBuffer(stagedObjectKey));
    await assert.rejects(() => readObjectBuffer(createdObjectKey));
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("createPublicBulkStudentSubmissionArchive marks the batch failed and deletes the finalized object when queueing fails", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-service-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const stagedObjectKey = createStagedObjectKey("bulk-current-submissions.zip");
  await writeObjectBuffer(stagedObjectKey, Buffer.from("bulk archive"));

  const state: {
    createdObjectKey?: string;
    updateArgs?: { where: { id: string }; data: { status: string; errorMessage: string } };
  } = {};

  const prisma = {
    assignmentKey: {
      findFirst: async () => ({
        assignment: {
          id: "assignment-1",
          language: "JAVA",
        },
      }),
    },
    uploadBatch: {
      create: async ({ data }: { data: { originalObjectKey: string } }) => {
        state.createdObjectKey = data.originalObjectKey;
        return { id: "batch-2" };
      },
      update: async (args: { where: { id: string }; data: { status: string; errorMessage: string } }) => {
        state.updateArgs = args;
      },
    },
  };
  const queueService = {
    enqueueUploadPreparation: async () => {
      throw new Error("redis unavailable");
    },
  };

  try {
    const service = new SubmissionsService(prisma as never, queueService as never);

    await assert.rejects(
      () => service.createPublicBulkStudentSubmissionArchive({
        assignmentKey: "A1",
        fileName: "bulk-current-submissions.zip",
        stagedObjectKey,
      }),
      /redis unavailable/,
    );

    assert.deepEqual(state.updateArgs, {
      where: { id: "batch-2" },
      data: {
        status: "FAILED",
        errorMessage: "We couldn't start processing that upload. Please try again.",
      },
    });
    assert.ok(state.createdObjectKey);
    await assert.rejects(() => readObjectBuffer(state.createdObjectKey!));
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("createStudentSubmissionFromArchive still supports the normal single-student archive flow with staged uploads", async () => {
  const originalRoot = process.env.OBJECT_STORAGE_ROOT;
  const tempRoot = await mkdtemp(join(tmpdir(), "similarity-api-service-"));
  process.env.OBJECT_STORAGE_ROOT = tempRoot;

  const stagedObjectKey = createStagedObjectKey("submission.zip");
  await writeObjectBuffer(stagedObjectKey, Buffer.from("single submission"));

  const state: {
    createdData?: { assignmentId: string; uploaderId: string | null; originalObjectKey: string };
    queuedJob?: Record<string, unknown>;
  } = {};

  const prisma = {
    assignmentKey: {
      findFirst: async () => ({
        assignment: {
          id: "assignment-2",
          language: "CPP",
        },
      }),
    },
    uploadBatch: {
      create: async ({
        data,
      }: {
        data: { assignmentId: string; uploaderId: string | null; originalObjectKey: string };
      }) => {
        state.createdData = data;
        return { id: "batch-3" };
      },
      update: async () => {
        throw new Error("upload batch should not be updated on success");
      },
    },
  };
  const queueService = {
    enqueueUploadPreparation: async (job: Record<string, unknown>) => {
      state.queuedJob = job;
    },
  };

  try {
    const service = new SubmissionsService(prisma as never, queueService as never);

    const result = await service.createStudentSubmissionFromArchive({
      assignmentKey: "A2",
      fileName: "submission.zip",
      stagedObjectKey,
      user: {
        id: "student-1",
        email: "student@example.com",
        role: "student",
      },
    });

    assert.deepEqual(result, {
      assignmentId: "assignment-2",
      assignmentLanguage: "cpp",
      uploadBatchId: "batch-3",
    });
    assert.deepEqual(state.createdData, {
      assignmentId: "assignment-2",
      uploaderId: "student-1",
      purpose: "STUDENT_SUBMISSION",
      originalObjectKey: state.createdData?.originalObjectKey ?? "",
    });
    assert.ok(state.createdData?.originalObjectKey.startsWith("raw/assignment-2/student_submission/"));
    assert.deepEqual(state.queuedJob, {
      assignmentId: "assignment-2",
      assignmentLanguage: "cpp",
      uploadBatchId: "batch-3",
      kind: "current",
    });
  } finally {
    if (originalRoot === undefined) {
      delete process.env.OBJECT_STORAGE_ROOT;
    } else {
      process.env.OBJECT_STORAGE_ROOT = originalRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
