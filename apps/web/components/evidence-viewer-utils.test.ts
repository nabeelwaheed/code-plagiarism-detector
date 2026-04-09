import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceHighlightContext,
  rawByteSpanToRenderByteSpans,
  type ByteSpan,
} from "./evidence-viewer-utils.js";

test("rawByteSpanToRenderByteSpans trims trailing same-line // comments from code matches", () => {
  const source = "alpha(); // trailing\n";
  const context = createEvidenceHighlightContext(source, "java");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(context, 0, byteLength(source), "code"),
    [{ byteStart: 0, byteEnd: byteOffsetOf(source, "//") }],
  );
});

test("rawByteSpanToRenderByteSpans trims only the trailing block comment portion and resumes after it", () => {
  const source = "alpha(); /* trailing */ beta();";
  const context = createEvidenceHighlightContext(source, "cpp");
  const commentStart = byteOffsetOf(source, "/*");
  const commentEnd = byteOffsetAfter(source, "*/");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(context, 0, byteLength(source), "code"),
    [
      { byteStart: 0, byteEnd: commentStart },
      { byteStart: commentEnd, byteEnd: byteLength(source) },
    ],
  );
});

test("rawByteSpanToRenderByteSpans suppresses a trailing block comment across later lines until it closes", () => {
  const source = "alpha(); /* trailing\nstill comment */\nbeta();";
  const context = createEvidenceHighlightContext(source, "c");
  const commentStart = byteOffsetOf(source, "/*");
  const commentEnd = byteOffsetAfter(source, "*/");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(context, 0, byteLength(source), "code"),
    [
      { byteStart: 0, byteEnd: commentStart },
      { byteStart: commentEnd, byteEnd: byteLength(source) },
    ],
  );
});

test("rawByteSpanToRenderByteSpans leaves own-line comments unchanged", () => {
  const source = "// whole line comment\nnextLine();";
  const context = createEvidenceHighlightContext(source, "java");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(
      context,
      0,
      byteOffsetAfter(source, "\n"),
      "code",
    ),
    [{ byteStart: 0, byteEnd: byteOffsetAfter(source, "\n") }],
  );
});

test("rawByteSpanToRenderByteSpans does not mistake comment markers inside strings or chars as comments", () => {
  const source = "printf(\"http://example.com /* keep */\"); char slash = '/'; // trailing";
  const context = createEvidenceHighlightContext(source, "cpp");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(context, 0, byteLength(source), "code"),
    [{ byteStart: 0, byteEnd: byteOffsetOf(source, "// trailing") }],
  );
});

test("rawByteSpanToRenderByteSpans leaves comment-kind matches unchanged", () => {
  const source = "alpha(); // trailing";
  const context = createEvidenceHighlightContext(source, "java");

  assert.deepEqual(
    rawByteSpanToRenderByteSpans(context, 0, byteLength(source), "comment"),
    [{ byteStart: 0, byteEnd: byteLength(source) }],
  );
});

function byteOffsetOf(source: string, fragment: string) {
  const index = source.indexOf(fragment);
  if (index < 0) {
    throw new Error(`Could not find fragment "${fragment}" in source`);
  }

  return byteLength(source.slice(0, index));
}

function byteOffsetAfter(source: string, fragment: string) {
  const index = source.indexOf(fragment);
  if (index < 0) {
    throw new Error(`Could not find fragment "${fragment}" in source`);
  }

  return byteLength(source.slice(0, index + fragment.length));
}

function byteLength(source: string) {
  return new TextEncoder().encode(source).length;
}
