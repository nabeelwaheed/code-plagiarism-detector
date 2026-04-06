import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply } from "fastify";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { AuthController } from "./auth.controller.js";

test("deleteOwnAccount clears the current session cookie after success", async () => {
  let deletedUserId = "";
  let clearedCookieName = "";

  const controller = new AuthController(
    {
      deleteProfessorAccount: async (userId: string) => {
        deletedUserId = userId;
      },
    } as never,
    {} as never,
  );

  const reply = {
    request: {
      cookies: {
        [apiRuntimeConfig.session.cookieName]: "raw-token",
      },
    },
    clearCookie: (name: string) => {
      clearedCookieName = name;
    },
  } as unknown as FastifyReply;

  const result = await controller.deleteOwnAccount(
    {
      id: "user-1",
      email: "professor@example.com",
      role: "professor",
    },
    reply,
  );

  assert.equal(deletedUserId, "user-1");
  assert.equal(clearedCookieName, apiRuntimeConfig.session.cookieName);
  assert.deepEqual(result, { ok: true });
});
