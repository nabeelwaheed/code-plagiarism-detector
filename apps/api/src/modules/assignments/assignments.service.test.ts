import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service.js";

test("createAssignment stores a null due date when none is provided", async () => {
  let capturedDueDate: unknown = Symbol("unset");
  const prisma = {
    assignment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        capturedDueDate = data["dueDate"];
        return {
          id: "assignment-1",
          title: "Assignment 1",
          language: "JAVA",
          dueDate: null,
          professorId: "prof-1",
          createdAt: new Date("2026-04-05T12:00:00.000Z"),
          keys: [
            {
              id: "key-1",
              publicKey: "demo-key",
              isActive: true,
              createdAt: new Date("2026-04-05T12:00:00.000Z"),
            },
          ],
        };
      },
    },
  };

  const service = new AssignmentsService(prisma as never);
  const result = await service.createAssignment(
    {
      title: "Assignment 1",
      language: "java",
    },
    {
      id: "prof-1",
      email: "prof@example.com",
      role: "professor",
    },
  );

  assert.equal(capturedDueDate, null);
  assert.equal(result.dueDate, null);
});

test("createAssignment stores a provided due date as a Date", async () => {
  let capturedDueDate: unknown = null;
  const prisma = {
    assignment: {
      create: async ({ data }: { data: { dueDate: unknown } }) => {
        capturedDueDate = data.dueDate;
        return {
          id: "assignment-1",
          title: "Assignment 1",
          language: "JAVA",
          dueDate: data.dueDate,
          professorId: "prof-1",
          createdAt: new Date("2026-04-05T12:00:00.000Z"),
          keys: [
            {
              id: "key-1",
              publicKey: "demo-key",
              isActive: true,
              createdAt: new Date("2026-04-05T12:00:00.000Z"),
            },
          ],
        };
      },
    },
  };

  const service = new AssignmentsService(prisma as never);
  await service.createAssignment(
    {
      title: "Assignment 1",
      language: "java",
      dueDate: "2026-04-20T15:30:00.000Z",
    },
    {
      id: "prof-1",
      email: "prof@example.com",
      role: "professor",
    },
  );

  assert.equal(capturedDueDate instanceof Date, true);
  assert.equal((capturedDueDate as Date).toISOString(), "2026-04-20T15:30:00.000Z");
});

test("updateAssignmentDueDate can extend or shorten an assignment due date", async () => {
  const updatedDueDates: Array<Date | null> = [];
  const prisma = {
    assignment: {
      findUnique: async () => ({
        professorId: "prof-1",
      }),
      update: async ({ data }: { data: { dueDate: Date | null } }) => {
        updatedDueDates.push(data.dueDate);
        return {
          id: "assignment-1",
          dueDate: data.dueDate,
        };
      },
    },
  };

  const service = new AssignmentsService(prisma as never);

  await service.updateAssignmentDueDate(
    "assignment-1",
    { dueDate: "2026-04-25T18:00:00.000Z" },
    {
      id: "prof-1",
      email: "prof@example.com",
      role: "professor",
    },
  );
  await service.updateAssignmentDueDate(
    "assignment-1",
    { dueDate: "2026-04-10T18:00:00.000Z" },
    {
      id: "prof-1",
      email: "prof@example.com",
      role: "professor",
    },
  );

  assert.equal(updatedDueDates.length, 2);
  assert.equal(updatedDueDates[0]?.toISOString(), "2026-04-25T18:00:00.000Z");
  assert.equal(updatedDueDates[1]?.toISOString(), "2026-04-10T18:00:00.000Z");
});

test("updateAssignmentDueDate can clear the due date back to null", async () => {
  const prisma = {
    assignment: {
      findUnique: async () => ({
        professorId: "prof-1",
      }),
      update: async ({ data }: { data: { dueDate: Date | null } }) => ({
        id: "assignment-1",
        dueDate: data.dueDate,
      }),
    },
  };

  const service = new AssignmentsService(prisma as never);
  const result = await service.updateAssignmentDueDate(
    "assignment-1",
    { dueDate: null },
    {
      id: "prof-1",
      email: "prof@example.com",
      role: "professor",
    },
  );

  assert.equal(result.dueDate, null);
});

test("updateAssignmentDueDate enforces professor ownership", async () => {
  const prisma = {
    assignment: {
      findUnique: async () => ({
        professorId: "other-professor",
      }),
      update: async () => {
        throw new Error("update should not be called");
      },
    },
  };

  const service = new AssignmentsService(prisma as never);

  await assert.rejects(
    service.updateAssignmentDueDate(
      "assignment-1",
      { dueDate: "2026-04-25T18:00:00.000Z" },
      {
        id: "prof-1",
        email: "prof@example.com",
        role: "professor",
      },
    ),
    (error: unknown) =>
      error instanceof ForbiddenException
      && error.message === "You do not have access to this assignment",
  );
});
