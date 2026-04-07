import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { hashPassword, verifyPassword } from "./password.service.js";

test("signupProfessor persists trimmed profile fields", async () => {
  let createdUserData: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    department: string | null;
    passwordHash: string;
    role: string;
  } | null = null;

  const prisma = {
    user: {
      findUnique: async () => null,
      create: async ({
        data,
      }: {
        data: {
          email: string;
          firstName: string | null;
          lastName: string | null;
          title: string | null;
          department: string | null;
          passwordHash: string;
          role: string;
        };
      }) => {
        createdUserData = data;
        return {
          id: "user-1",
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          title: data.title,
          department: data.department,
          role: "PROFESSOR",
        };
      },
    },
  };

  const authService = new AuthService(prisma as never, {
    createSession: async () => ({
      sessionId: "session-1",
      rawToken: "raw-token",
      expiresAt: new Date("2026-04-07T12:00:00.000Z"),
    }),
  } as never);

  const result = await authService.signupProfessor({
    email: " Professor@Example.com ",
    password: "StrongPass123!",
    firstName: "  Sarah ",
    lastName: " Chen  ",
    title: "  Professor ",
    department: "   ",
  });

  if (!createdUserData) {
    throw new Error("Expected signupProfessor to create a user");
  }

  const persistedUserData: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    department: string | null;
    passwordHash: string;
    role: string;
  } = createdUserData;

  assert.deepEqual(persistedUserData, {
    email: "professor@example.com",
    firstName: "Sarah",
    lastName: "Chen",
    title: "Professor",
    department: null,
    passwordHash: persistedUserData.passwordHash,
    role: "PROFESSOR",
  });
  assert.equal(typeof persistedUserData.passwordHash, "string");
  assert.notEqual(persistedUserData.passwordHash, "StrongPass123!");
  assert.equal(result.firstName, "Sarah");
  assert.equal(result.lastName, "Chen");
  assert.equal(result.title, "Professor");
  assert.equal(result.department, null);
});

test("changePassword rejects an incorrect current password", async () => {
  const storedHash = await hashPassword("professor123");
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        passwordHash: storedHash,
      }),
      update: async () => {
        throw new Error("update should not be called");
      },
    },
  };
  const authService = new AuthService(prisma as never, {} as never);

  await assert.rejects(
    authService.changePassword("user-1", {
      currentPassword: "wrong-password",
      newPassword: "newpassword123",
    }),
    (error: unknown) =>
      error instanceof BadRequestException
      && error.message === "Current password is incorrect",
  );
});

test("changePassword updates the stored hash for a valid password change", async () => {
  const storedHash = await hashPassword("professor123");
  let updatedHash = "";
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        passwordHash: storedHash,
      }),
      update: async ({ data }: { data: { passwordHash: string } }) => {
        updatedHash = data.passwordHash;
        return {
          id: "user-1",
        };
      },
    },
  };
  const authService = new AuthService(prisma as never, {} as never);

  await authService.changePassword("user-1", {
    currentPassword: "professor123",
    newPassword: "newpassword123",
  });

  assert.notEqual(updatedHash, "");
  assert.notEqual(updatedHash, storedHash);
  assert.equal(await verifyPassword("newpassword123", updatedHash), true);
});

test("deleteProfessorAccount blocks when owned assignments have active work", async () => {
  let assignmentLookupCalled = false;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        role: "PROFESSOR",
      }),
    },
    uploadBatch: {
      count: async () => 1,
    },
    comparisonRun: {
      count: async () => 0,
    },
    assignment: {
      findMany: async () => {
        assignmentLookupCalled = true;
        return [];
      },
    },
  };
  const authService = new AuthService(prisma as never, {} as never);

  await assert.rejects(
    authService.deleteProfessorAccount("user-1"),
    (error: unknown) =>
      error instanceof BadRequestException
      && error.message
        === "One or more of your assignments has uploads or comparison runs in progress. Please wait for them to finish before deleting your account.",
  );

  assert.equal(assignmentLookupCalled, false);
});

test("deleteProfessorAccount removes owned assignments before deleting the user", async () => {
  const deletedAssignmentIds: string[] = [];
  let deletedUserId = "";

  const tx = {
    pairMatch: {
      deleteMany: async () => ({ count: 0 }),
    },
    pairResult: {
      deleteMany: async () => ({ count: 0 }),
    },
    comparisonRun: {
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
    submissionFile: {
      deleteMany: async () => ({ count: 0 }),
    },
    templateFile: {
      deleteMany: async () => ({ count: 0 }),
    },
    submission: {
      deleteMany: async () => ({ count: 0 }),
    },
    assignmentTemplate: {
      deleteMany: async () => ({ count: 0 }),
    },
    uploadBatch: {
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
    assignmentKey: {
      deleteMany: async () => ({ count: 0 }),
    },
    assignment: {
      deleteMany: async ({ where }: { where: { id: string } }) => {
        deletedAssignmentIds.push(where.id);
        return { count: 1 };
      },
      findMany: async () => [
        {
          id: "assignment-a",
          uploadBatches: [],
          submissions: [],
          templateVersions: [],
        },
        {
          id: "assignment-b",
          uploadBatches: [],
          submissions: [],
          templateVersions: [],
        },
      ],
    },
    user: {
      findUnique: async () => ({
        id: "user-1",
        role: "PROFESSOR",
      }),
      delete: async ({ where }: { where: { id: string } }) => {
        deletedUserId = where.id;
        return { id: where.id };
      },
    },
  };

  const prisma = {
    ...tx,
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  };

  const authService = new AuthService(prisma as never, {} as never);

  await authService.deleteProfessorAccount("user-1");

  assert.deepEqual(deletedAssignmentIds, ["assignment-a", "assignment-b"]);
  assert.equal(deletedUserId, "user-1");
});
