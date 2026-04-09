export interface EditorPosition {
  lineNumber: number;
  column: number;
}

export interface EditorRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface ByteSpan {
  byteStart: number;
  byteEnd: number;
}

export interface EvidenceHighlightContext {
  source: string;
  trailingCommentSpans: ByteSpan[];
}

export function byteOffsetToEditorPosition(source: string, targetByteOffset: number): EditorPosition {
  const clamped = clampByteOffset(source, targetByteOffset);
  let byteCount = 0;
  let lineNumber = 1;
  let column = 1;

  for (const character of source) {
    if (byteCount >= clamped) {
      break;
    }

    const characterBytes = utf8Length(character);
    if (byteCount + characterBytes > clamped) {
      break;
    }

    byteCount += characterBytes;
    if (character === "\n") {
      lineNumber += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { lineNumber, column };
}

export function editorPositionToByteOffset(
  source: string,
  position: EditorPosition,
): number {
  let byteCount = 0;
  let lineNumber = 1;
  let column = 1;

  for (const character of source) {
    if (lineNumber === position.lineNumber && column === position.column) {
      return byteCount;
    }

    byteCount += utf8Length(character);
    if (character === "\n") {
      lineNumber += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return byteCount;
}

export function byteSpanToEditorRange(
  source: string,
  byteStart: number,
  byteEnd: number,
): EditorRange {
  const start = byteOffsetToEditorPosition(source, byteStart);
  const end = byteOffsetToEditorPosition(source, byteEnd);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

export function createEvidenceHighlightContext(
  source: string,
  language: string,
): EvidenceHighlightContext {
  if (!supportsCStyleCommentTrimming(language)) {
    return {
      source,
      trailingCommentSpans: [],
    };
  }

  return {
    source,
    trailingCommentSpans: collectTrimmedTrailingCommentSpans(source),
  };
}

export function rawByteSpanToRenderByteSpans(
  context: EvidenceHighlightContext,
  byteStart: number,
  byteEnd: number,
  matchKind: "code" | "comment",
): ByteSpan[] {
  const normalizedStart = clampByteOffset(context.source, byteStart);
  const normalizedEnd = clampByteOffset(context.source, byteEnd);

  if (normalizedEnd <= normalizedStart) {
    return [];
  }

  if (matchKind !== "code" || context.trailingCommentSpans.length === 0) {
    return [{ byteStart: normalizedStart, byteEnd: normalizedEnd }];
  }

  return subtractSpansFromRange(
    { byteStart: normalizedStart, byteEnd: normalizedEnd },
    context.trailingCommentSpans,
  );
}

export function rawByteSpanToRenderRanges(
  context: EvidenceHighlightContext,
  byteStart: number,
  byteEnd: number,
  matchKind: "code" | "comment",
): EditorRange[] {
  return rawByteSpanToRenderByteSpans(context, byteStart, byteEnd, matchKind).map((span) =>
    byteSpanToEditorRange(context.source, span.byteStart, span.byteEnd),
  );
}

export function spanContainsByteOffset(
  byteStart: number,
  byteEnd: number,
  byteOffset: number,
) {
  return byteOffset >= byteStart && byteOffset < byteEnd;
}

export function hexToTransparentFill(hex: string, alpha = 0.25) {
  const sanitized = hex.replace("#", "");
  const red = Number.parseInt(sanitized.slice(0, 2), 16);
  const green = Number.parseInt(sanitized.slice(2, 4), 16);
  const blue = Number.parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function collectTrimmedTrailingCommentSpans(source: string): ByteSpan[] {
  const spans: ByteSpan[] = [];
  const byteOffsets = buildByteOffsetsByCodeUnit(source);
  let index = 0;
  let lineHasCode = false;
  let state: "code" | "string" | "char" | "block_comment" = "code";
  let activeBlockComment:
    | {
      byteStart: number;
      trim: boolean;
      lineHasCodeBeforeCommentOnCurrentLine: boolean;
    }
    | null = null;

  while (index < source.length) {
    if (state === "code") {
      if (source.startsWith("//", index)) {
        const trim = lineHasCode;
        const commentStart = byteOffsets[index] ?? 0;
        index += 2;

        while (index < source.length && source[index] !== "\n") {
          index += getCodeUnitStep(source, index);
        }

        const consumesNewline = source[index] === "\n";
        const commentEndIndex = consumesNewline ? index + 1 : index;

        if (trim) {
          spans.push({
            byteStart: commentStart,
            byteEnd: byteOffsets[commentEndIndex] ?? byteOffsets[source.length] ?? 0,
          });
        }

        lineHasCode = false;
        if (consumesNewline) {
          index = commentEndIndex;
        }
        continue;
      }

      if (source.startsWith("/*", index)) {
        activeBlockComment = {
          byteStart: byteOffsets[index] ?? 0,
          trim: lineHasCode,
          lineHasCodeBeforeCommentOnCurrentLine: lineHasCode,
        };
        state = "block_comment";
        index += 2;
        continue;
      }

      const character = source[index] ?? "";
      if (character === "\"") {
        lineHasCode = true;
        state = "string";
        index += 1;
        continue;
      }

      if (character === "'") {
        lineHasCode = true;
        state = "char";
        index += 1;
        continue;
      }

      if (character === "\n") {
        lineHasCode = false;
        index += 1;
        continue;
      }

      if (!isWhitespace(character)) {
        lineHasCode = true;
      }

      index += getCodeUnitStep(source, index);
      continue;
    }

    if (state === "string" || state === "char") {
      const quote = state === "string" ? "\"" : "'";
      const character = source[index] ?? "";

      if (character === "\\") {
        index += 1;
        if (index < source.length) {
          index += getCodeUnitStep(source, index);
        }
        continue;
      }

      if (character === quote) {
        state = "code";
        index += 1;
        continue;
      }

      if (character === "\n") {
        state = "code";
        lineHasCode = false;
        index += 1;
        continue;
      }

      index += getCodeUnitStep(source, index);
      continue;
    }

    if (source.startsWith("*/", index)) {
      if (activeBlockComment?.trim) {
        spans.push({
          byteStart: activeBlockComment.byteStart,
          byteEnd: byteOffsets[index + 2] ?? byteOffsets[source.length] ?? 0,
        });
      }

      lineHasCode = activeBlockComment?.lineHasCodeBeforeCommentOnCurrentLine ?? false;
      activeBlockComment = null;
      state = "code";
      index += 2;
      continue;
    }

    if (source[index] === "\n") {
      lineHasCode = false;
      if (activeBlockComment) {
        activeBlockComment.lineHasCodeBeforeCommentOnCurrentLine = false;
      }
      index += 1;
      continue;
    }

    index += getCodeUnitStep(source, index);
  }

  if (state === "block_comment" && activeBlockComment?.trim) {
    spans.push({
      byteStart: activeBlockComment.byteStart,
      byteEnd: byteOffsets[source.length] ?? 0,
    });
  }

  return spans;
}

function subtractSpansFromRange(range: ByteSpan, spansToSubtract: ByteSpan[]) {
  const trimmedRanges: ByteSpan[] = [];
  let cursor = range.byteStart;

  for (const span of spansToSubtract) {
    if (span.byteEnd <= cursor) {
      continue;
    }

    if (span.byteStart >= range.byteEnd) {
      break;
    }

    if (span.byteStart > cursor) {
      trimmedRanges.push({
        byteStart: cursor,
        byteEnd: Math.min(span.byteStart, range.byteEnd),
      });
    }

    cursor = Math.max(cursor, Math.min(span.byteEnd, range.byteEnd));
    if (cursor >= range.byteEnd) {
      break;
    }
  }

  if (cursor < range.byteEnd) {
    trimmedRanges.push({
      byteStart: cursor,
      byteEnd: range.byteEnd,
    });
  }

  return trimmedRanges.filter((span) => span.byteEnd > span.byteStart);
}

function supportsCStyleCommentTrimming(language: string) {
  const normalized = language.trim().toLowerCase();
  return normalized === "java" || normalized === "c" || normalized === "cpp";
}

function buildByteOffsetsByCodeUnit(source: string) {
  const offsets = new Array<number>(source.length + 1).fill(0);
  let byteOffset = 0;
  let index = 0;

  while (index < source.length) {
    offsets[index] = byteOffset;
    const step = getCodeUnitStep(source, index);
    const character = source.slice(index, index + step);
    byteOffset += utf8Length(character);

    for (let cursor = index + 1; cursor <= index + step && cursor < offsets.length; cursor += 1) {
      offsets[cursor] = byteOffset;
    }

    index += step;
  }

  offsets[source.length] = byteOffset;
  return offsets;
}

function getCodeUnitStep(source: string, index: number) {
  const codePoint = source.codePointAt(index);
  return codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
}

function isWhitespace(character: string) {
  return /\s/.test(character);
}

function clampByteOffset(source: string, byteOffset: number) {
  const encodedLength = new TextEncoder().encode(source).length;
  return Math.max(0, Math.min(byteOffset, encodedLength));
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length;
}
