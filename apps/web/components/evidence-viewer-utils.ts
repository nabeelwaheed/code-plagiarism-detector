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

function clampByteOffset(source: string, byteOffset: number) {
  const encodedLength = new TextEncoder().encode(source).length;
  return Math.max(0, Math.min(byteOffset, encodedLength));
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length;
}
