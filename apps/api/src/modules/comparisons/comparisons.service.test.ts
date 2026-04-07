import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ComparisonsService } from "./comparisons.service.js";

test("createComparisonRun rejects while uploads are still preparing", async () => {
  const prisma = {
    assignment: {
      findUnique: async () => ({
        id: "assignment-1",
        professorId: "prof-1",
        comparisonInputVersion: 2,
        language: "JAVA",
        submissions: [
          { id: "s1", kind: "CURRENT", concatenatedSource: "", sourceMapJson: [] },
          { id: "s2", kind: "HISTORICAL", concatenatedSource: "", sourceMapJson: [] },
        ],
        templateVersions: [],
      }),
    },
    uploadBatch: {
      count: async () => 1,
    },
    comparisonRun: {
      count: async () => 0,
      create: async () => {
        throw new Error("comparison run should not be created");
      },
    },
  };

  const service = new ComparisonsService(prisma as never, {} as never);

  await assert.rejects(
    service.createComparisonRun(
      { assignmentId: "assignment-1" },
      { id: "prof-1", email: "prof@example.com", role: "professor" },
    ),
    (error: unknown) =>
      error instanceof BadRequestException
      && error.message
        === "Uploads are still being prepared for this assignment. Please wait for them to finish before running comparisons.",
  );
});

test("createComparisonRun rejects while another comparison run is active", async () => {
  const prisma = {
    assignment: {
      findUnique: async () => ({
        id: "assignment-1",
        professorId: "prof-1",
        comparisonInputVersion: 2,
        language: "JAVA",
        submissions: [
          { id: "s1", kind: "CURRENT", concatenatedSource: "", sourceMapJson: [] },
          { id: "s2", kind: "HISTORICAL", concatenatedSource: "", sourceMapJson: [] },
        ],
        templateVersions: [],
      }),
    },
    uploadBatch: {
      count: async () => 0,
    },
    comparisonRun: {
      count: async () => 1,
      create: async () => {
        throw new Error("comparison run should not be created");
      },
    },
  };

  const service = new ComparisonsService(prisma as never, {} as never);

  await assert.rejects(
    service.createComparisonRun(
      { assignmentId: "assignment-1" },
      { id: "prof-1", email: "prof@example.com", role: "professor" },
    ),
    (error: unknown) =>
      error instanceof BadRequestException
      && error.message === "A comparison run is already queued or running for this assignment.",
  );
});

test("createComparisonRun snapshots the current assignment input version", async () => {
  const state: {
    createdRunData?: { inputVersion?: number };
    queuedJob?: { comparisonRunId?: string };
  } = {};

  const prisma = {
    assignment: {
      findUnique: async () => ({
        id: "assignment-1",
        professorId: "prof-1",
        comparisonInputVersion: 7,
        language: "JAVA",
        submissions: [
          { id: "current-1", kind: "CURRENT", concatenatedSource: "class A {}", sourceMapJson: [] },
          { id: "historical-1", kind: "HISTORICAL", concatenatedSource: "class B {}", sourceMapJson: [] },
        ],
        templateVersions: [],
      }),
    },
    uploadBatch: {
      count: async () => 0,
    },
    comparisonRun: {
      count: async () => 0,
      create: async ({ data }: { data: { inputVersion?: number } }) => {
        state.createdRunData = data;
        return {
          id: "run-1",
          ...data,
        };
      },
    },
  };
  const queueService = {
    enqueueComparisonRun: async (job: { comparisonRunId?: string }) => {
      state.queuedJob = job;
    },
  };

  const service = new ComparisonsService(prisma as never, queueService as never);

  await service.createComparisonRun(
    { assignmentId: "assignment-1" },
    { id: "prof-1", email: "prof@example.com", role: "professor" },
  );

  if (!state.createdRunData || !state.queuedJob) {
    throw new Error("Expected comparison run creation and queueing to occur");
  }

  assert.equal(state.createdRunData.inputVersion, 7);
  assert.equal(state.queuedJob.comparisonRunId, "run-1");
});
