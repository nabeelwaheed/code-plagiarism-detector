import test from "node:test";
import assert from "node:assert/strict";
import {
  hasActiveAssignmentJobs,
  selectPromotedTemplateId,
} from "./assignment-maintenance.js";

test("hasActiveAssignmentJobs returns true when uploads are active", () => {
  assert.equal(hasActiveAssignmentJobs(1, 0), true);
});

test("hasActiveAssignmentJobs returns true when comparisons are active", () => {
  assert.equal(hasActiveAssignmentJobs(0, 1), true);
});

test("hasActiveAssignmentJobs returns false when no active work remains", () => {
  assert.equal(hasActiveAssignmentJobs(0, 0), false);
});

test("selectPromotedTemplateId chooses the newest remaining template version", () => {
  const promotedId = selectPromotedTemplateId([
    {
      id: "older",
      versionNumber: 2,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      id: "newest",
      versionNumber: 3,
      createdAt: new Date("2026-04-02T10:00:00.000Z"),
    },
  ]);

  assert.equal(promotedId, "newest");
});

test("selectPromotedTemplateId falls back to createdAt when versions tie", () => {
  const promotedId = selectPromotedTemplateId([
    {
      id: "earlier",
      versionNumber: 4,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      id: "later",
      versionNumber: 4,
      createdAt: new Date("2026-04-02T10:00:00.000Z"),
    },
  ]);

  assert.equal(promotedId, "later");
});
