"use client";

import Editor from "@monaco-editor/react";
import type { ViewerMatch } from "@similarity/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { spansOverlap } from "../lib/view-models";
import {
  byteOffsetToEditorPosition,
  byteSpanToEditorRange,
  editorPositionToByteOffset,
  hexToTransparentFill,
  spanContainsByteOffset,
} from "./evidence-viewer-utils";

interface ViewerFile {
  id: string;
  relativePath: string;
  canonicalOrder: number;
  byteStart: number;
  byteEnd: number;
  archivePath?: string;
}

interface EvidenceViewerProps {
  language?: string;
  leftFiles: ViewerFile[];
  leftSource: string;
  rightFiles: ViewerFile[];
  rightSource: string;
  matches: ViewerMatch[];
  leftTitle?: string;
  rightTitle?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function EvidenceViewer({
  language = "plaintext",
  leftFiles,
  leftLabel = "Left side",
  leftSource,
  leftTitle = "Left submission",
  matches,
  rightFiles,
  rightLabel = "Right side",
  rightSource,
  rightTitle = "Right submission",
}: EvidenceViewerProps) {
  const leftEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const rightEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const leftDecorationIdsRef = useRef<string[]>([]);
  const rightDecorationIdsRef = useRef<string[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(matches[0]?.matchId ?? null);
  const [activeLeftFileId, setActiveLeftFileId] = useState(leftFiles[0]?.id ?? "");
  const [activeRightFileId, setActiveRightFileId] = useState(rightFiles[0]?.id ?? "");

  const orderedMatches = useMemo(() => matches, [matches]);
  const activeMatchIndex = orderedMatches.findIndex((match) => match.matchId === activeMatchId);

  const colors = useMemo(() => {
    const colorMap = new Map<string, string>();
    orderedMatches.forEach((match, index) => {
      colorMap.set(match.matchId, createMatchColor(index));
    });
    return colorMap;
  }, [orderedMatches]);

  const leftFilesWithCounts = useMemo(
    () =>
      leftFiles.map((file) => ({
        ...file,
        matchCount: orderedMatches.filter((match) =>
          spansOverlap(
            { byteStart: file.byteStart, byteEnd: file.byteEnd },
            { byteStart: match.left.byteStart, byteEnd: match.left.byteEnd },
          )
        ).length,
      })),
    [leftFiles, orderedMatches],
  );

  const rightFilesWithCounts = useMemo(
    () =>
      rightFiles.map((file) => ({
        ...file,
        matchCount: orderedMatches.filter((match) =>
          spansOverlap(
            { byteStart: file.byteStart, byteEnd: file.byteEnd },
            { byteStart: match.right.byteStart, byteEnd: match.right.byteEnd },
          )
        ).length,
      })),
    [orderedMatches, rightFiles],
  );

  useEffect(() => {
    if (activeMatchId && orderedMatches.some((match) => match.matchId === activeMatchId)) {
      return;
    }

    setActiveMatchId(orderedMatches[0]?.matchId ?? null);
  }, [activeMatchId, orderedMatches]);

  const revealMatch = (matchId: string) => {
    const match = orderedMatches.find((candidate) => candidate.matchId === matchId);
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;
    if (!match || !leftEditor || !rightEditor) {
      return;
    }

    const leftRange = byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd);
    const rightRange = byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd);

    setActiveMatchId(matchId);
    setActiveLeftFileId(findContainingFileId(leftFilesWithCounts, match.left.byteStart));
    setActiveRightFileId(findContainingFileId(rightFilesWithCounts, match.right.byteStart));
    leftEditor.revealRangeInCenter(leftRange);
    leftEditor.setPosition({ lineNumber: leftRange.startLineNumber, column: leftRange.startColumn });
    rightEditor.revealRangeInCenter(rightRange);
    rightEditor.setPosition({ lineNumber: rightRange.startLineNumber, column: rightRange.startColumn });
  };

  const revealFile = (
    side: "left" | "right",
    file: { id: string; byteStart: number },
  ) => {
    const editor = side === "left" ? leftEditorRef.current : rightEditorRef.current;
    const source = side === "left" ? leftSource : rightSource;
    if (!editor) {
      return;
    }

    const position = byteOffsetToEditorPosition(source, file.byteStart);
    editor.revealPositionInCenter(position);
    editor.setPosition(position);

    if (side === "left") {
      setActiveLeftFileId(file.id);
    } else {
      setActiveRightFileId(file.id);
    }
  };

  const stepMatch = (direction: "next" | "previous") => {
    if (orderedMatches.length === 0) {
      return;
    }

    const currentIndex = activeMatchIndex >= 0 ? activeMatchIndex : 0;
    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % orderedMatches.length
        : (currentIndex - 1 + orderedMatches.length) % orderedMatches.length;
    revealMatch(orderedMatches[nextIndex]!.matchId);
  };

  useEffect(() => {
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;
    const monaco = monacoRef.current;

    if (!leftEditor || !rightEditor || !monaco) {
      return;
    }

    leftDecorationIdsRef.current = leftEditor.deltaDecorations(
      leftDecorationIdsRef.current,
      orderedMatches.map((match) => buildDecoration(monaco, leftSource, match.left, match.matchId, match.matchId === activeMatchId)),
    );

    rightDecorationIdsRef.current = rightEditor.deltaDecorations(
      rightDecorationIdsRef.current,
      orderedMatches.map((match) => buildDecoration(monaco, rightSource, match.right, match.matchId, match.matchId === activeMatchId)),
    );
  }, [activeMatchId, leftSource, orderedMatches, rightSource]);

  useEffect(() => {
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;

    if (!leftEditor || !rightEditor) {
      return;
    }

    const leftSubscription = leftEditor.onMouseDown((event) => {
      if (!event.target.position) {
        return;
      }

      const byteOffset = editorPositionToByteOffset(leftSource, event.target.position);
      setActiveLeftFileId(findContainingFileId(leftFilesWithCounts, byteOffset));
      const clickedMatch = orderedMatches.find((match) =>
        spanContainsByteOffset(match.left.byteStart, match.left.byteEnd, byteOffset),
      );
      if (clickedMatch) {
        revealMatch(clickedMatch.matchId);
      }
    });

    const rightSubscription = rightEditor.onMouseDown((event) => {
      if (!event.target.position) {
        return;
      }

      const byteOffset = editorPositionToByteOffset(rightSource, event.target.position);
      setActiveRightFileId(findContainingFileId(rightFilesWithCounts, byteOffset));
      const clickedMatch = orderedMatches.find((match) =>
        spanContainsByteOffset(match.right.byteStart, match.right.byteEnd, byteOffset),
      );
      if (clickedMatch) {
        revealMatch(clickedMatch.matchId);
      }
    });

    return () => {
      leftSubscription.dispose();
      rightSubscription.dispose();
    };
  }, [leftFilesWithCounts, leftSource, orderedMatches, rightFilesWithCounts, rightSource]);

  const dynamicStyles = useMemo(
    () =>
      orderedMatches
        .map((match) => {
          const color = colors.get(match.matchId) ?? "#aa0000";
          return `
            .match-inline-${match.matchId} {
              background: ${hexToTransparentFill(color, 0.08)};
              border-bottom: 1px solid ${hexToTransparentFill(color, 0.28)};
            }
            .match-inline-active-${match.matchId} {
              background: ${hexToTransparentFill(color, 0.28)};
              border-bottom: 2px solid ${color};
              border-radius: 2px;
            }
            .match-outline-${match.matchId} {
              border: 1px solid ${hexToTransparentFill(color, 0.15)};
            }
            .match-outline-active-${match.matchId} {
              border: 1px solid ${color};
              box-shadow: inset 0 0 0 1px ${color};
              background: ${hexToTransparentFill(color, 0.08)};
            }
          `;
        })
        .join("\n"),
    [colors, orderedMatches],
  );

  return (
    <div className="comparison-workspace">
      <style>{dynamicStyles}</style>
      <div className="comparison-toolbar">
        <div className="stack-xs">
          <strong>Match Navigation</strong>
          <span className="helper-text">
            Move through each flagged overlap in sequence, or click any highlighted region directly inside the code panes.
          </span>
        </div>
        <div className="match-browser">
          <div className="match-navigator">
            <button className="secondary-button button-compact" type="button" onClick={() => stepMatch("previous")}>
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="match-current">
              <span className="match-current-label">Active Match</span>
              <strong>{orderedMatches.length === 0 ? "No matches" : `Match ${activeMatchIndex + 1}`}</strong>
              <span className="helper-text">
                {orderedMatches.length === 0
                  ? "No overlapping evidence"
                  : `${orderedMatches[activeMatchIndex]?.matchedTokenCount ?? 0} tokens`}
              </span>
            </div>
            <button className="secondary-button button-compact" type="button" onClick={() => stepMatch("next")}>
              Next <ChevronRight size={14} />
            </button>
          </div>

          <div className="match-rail" role="tablist" aria-label="Match navigation">
            {orderedMatches.map((match, index) => {
              const active = activeMatchId === match.matchId;
              const color = colors.get(match.matchId) ?? "#aa0000";
              return (
                <button
                  aria-selected={active}
                  className={`match-nav-pill ${active ? "is-active" : ""}`}
                  key={match.matchId}
                  onClick={() => revealMatch(match.matchId)}
                  role="tab"
                  style={{
                    borderColor: active ? color : undefined,
                    boxShadow: active ? `inset 0 0 0 1px ${color}` : undefined,
                  }}
                  type="button"
                >
                  <span className="legend-swatch" style={{ background: color }} />
                  <span>Match {index + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="comparison-grid">
        <div className="code-pane">
          <div className="code-pane-header">
            <strong>{leftTitle}</strong>
            <span className="helper-text">
              {leftLabel} · matched regions are highlighted
            </span>
          </div>
          <div className="file-tabs">
            {leftFilesWithCounts.map((file) => (
              <button
                className={`file-tab ${activeLeftFileId === file.id ? "is-active" : ""}`}
                key={file.id}
                type="button"
                onClick={() => revealFile("left", file)}
              >
                {file.relativePath} ({file.matchCount})
              </button>
            ))}
          </div>
          <Editor
            height="72vh"
            defaultLanguage={language}
            value={leftSource}
            onMount={(editor, monaco) => {
              leftEditorRef.current = editor;
              monacoRef.current = monaco;
              ensureReviewerTheme(monaco);
            }}
            options={editorOptions}
            theme="anti-vibe-review-light"
          />
        </div>

        <div className="code-pane">
          <div className="code-pane-header">
            <strong>{rightTitle}</strong>
            <span className="helper-text">
              {rightLabel} · colors match across both sides
            </span>
          </div>
          <div className="file-tabs">
            {rightFilesWithCounts.map((file) => (
              <button
                className={`file-tab ${activeRightFileId === file.id ? "is-active" : ""}`}
                key={file.id}
                type="button"
                onClick={() => revealFile("right", file)}
              >
                {file.relativePath} ({file.matchCount})
              </button>
            ))}
          </div>
          <Editor
            height="72vh"
            defaultLanguage={language}
            value={rightSource}
            onMount={(editor, monaco) => {
              rightEditorRef.current = editor;
              monacoRef.current = monaco;
              ensureReviewerTheme(monaco);
            }}
            options={editorOptions}
            theme="anti-vibe-review-light"
          />
        </div>
      </div>
    </div>
  );
}

const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbersMinChars: 3,
  padding: { top: 16, bottom: 16 },
  fontSize: 13,
  fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  wordWrap: "off",
};

function buildDecoration(
  monaco: typeof Monaco,
  source: string,
  span: { byteStart: number; byteEnd: number },
  matchId: string,
  isActive: boolean,
) {
  const range = byteSpanToEditorRange(source, span.byteStart, span.byteEnd);
  return {
    range: new monaco.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn),
    options: {
      className: isActive ? `match-outline-active-${matchId}` : `match-outline-${matchId}`,
      inlineClassName: isActive ? `match-inline-active-${matchId}` : `match-inline-${matchId}`,
    },
  };
}

function ensureReviewerTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme("anti-vibe-review-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#fffdf8",
      "editor.lineHighlightBackground": "#f7f1e7",
      "editorGutter.background": "#f7f1e7",
      "editorLineNumber.foreground": "#8b8174",
      "editorLineNumber.activeForeground": "#59606b",
      "editor.selectionBackground": "rgba(47,107,96,0.12)",
      "editor.inactiveSelectionBackground": "rgba(47,107,96,0.08)",
    },
  });
}

function createMatchColor(index: number) {
  const hue = Math.round((index * 137.508) % 360);
  return hslToHex(hue, 68, 48);
}

function findContainingFileId(files: Array<{ id: string; byteStart: number; byteEnd: number }>, byteOffset: number) {
  return files.find((file) => byteOffset >= file.byteStart && byteOffset < file.byteEnd)?.id ?? files[0]?.id ?? "";
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs((2 * l) - 1)) * s;
  const scaledHue = hue / 60;
  const x = chroma * (1 - Math.abs((scaledHue % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (scaledHue >= 0 && scaledHue < 1) {
    red = chroma;
    green = x;
  } else if (scaledHue < 2) {
    red = x;
    green = chroma;
  } else if (scaledHue < 3) {
    green = chroma;
    blue = x;
  } else if (scaledHue < 4) {
    green = x;
    blue = chroma;
  } else if (scaledHue < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - (chroma / 2);
  return `#${toHex(red + match)}${toHex(green + match)}${toHex(blue + match)}`;
}

function toHex(value: number) {
  return Math.round(value * 255).toString(16).padStart(2, "0");
}
