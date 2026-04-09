"use client";

import Editor from "@monaco-editor/react";
import type { ViewerMatch } from "@similarity/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import {
  byteSpanToEditorRange,
  createEvidenceHighlightContext,
  editorPositionToByteOffset,
  hexToTransparentFill,
  rawByteSpanToRenderRanges,
  spanContainsByteOffset,
} from "./evidence-viewer-utils";

interface EvidenceViewerProps {
  language?: string;
  leftSource: string;
  rightSource: string;
  matches: ViewerMatch[];
  leftTitle?: string;
  rightTitle?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function EvidenceViewer({
  language = "plaintext",
  leftSource,
  rightSource,
  matches,
  leftTitle = "Left submission",
  rightTitle = "Right submission",
  leftLabel = "Left side",
  rightLabel = "Right side",
}: EvidenceViewerProps) {
  const leftEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const rightEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const leftDecorationIdsRef = useRef<string[]>([]);
  const rightDecorationIdsRef = useRef<string[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  const colors = useMemo(() => {
    const colorMap = new Map<string, string>();
    matches.forEach((match, index) => {
      colorMap.set(match.matchId, createMatchColor(index));
    });
    return colorMap;
  }, [matches]);

  const codeMatches = useMemo(
    () => matches.filter((match) => match.kind === "code"),
    [matches],
  );
  const commentMatches = useMemo(
    () => matches.filter((match) => match.kind === "comment"),
    [matches],
  );
  const leftHighlightContext = useMemo(
    () => createEvidenceHighlightContext(leftSource, language),
    [language, leftSource],
  );
  const rightHighlightContext = useMemo(
    () => createEvidenceHighlightContext(rightSource, language),
    [language, rightSource],
  );
  const leftMatchRenderRanges = useMemo(
    () =>
      new Map(
        matches.map((match) => [
          match.matchId,
          rawByteSpanToRenderRanges(
            leftHighlightContext,
            match.left.byteStart,
            match.left.byteEnd,
            match.kind,
          ),
        ]),
      ),
    [leftHighlightContext, matches],
  );
  const rightMatchRenderRanges = useMemo(
    () =>
      new Map(
        matches.map((match) => [
          match.matchId,
          rawByteSpanToRenderRanges(
            rightHighlightContext,
            match.right.byteStart,
            match.right.byteEnd,
            match.kind,
          ),
        ]),
      ),
    [matches, rightHighlightContext],
  );

  useEffect(() => {
    if (activeMatchId && !matches.some((match) => match.matchId === activeMatchId)) {
      setActiveMatchId(null);
    }
  }, [activeMatchId, matches]);

  const revealMatch = (matchId: string) => {
    const match = matches.find((candidate) => candidate.matchId === matchId);
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;
    if (!match || !leftEditor || !rightEditor) {
      return;
    }

    const leftRange = byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd);
    const rightRange = byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd);

    setActiveMatchId(matchId);
    leftEditor.revealRangeInCenter(leftRange);
    leftEditor.setPosition({
      lineNumber: leftRange.startLineNumber,
      column: leftRange.startColumn,
    });
    rightEditor.revealRangeInCenter(rightRange);
    rightEditor.setPosition({
      lineNumber: rightRange.startLineNumber,
      column: rightRange.startColumn,
    });
    rightEditor.focus();
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
      matches.flatMap((match) => {
        const isActive = activeMatchId === match.matchId;
        return (leftMatchRenderRanges.get(match.matchId) ?? []).map((range) => ({
          range: new monaco.Range(
            range.startLineNumber,
            range.startColumn,
            range.endLineNumber,
            range.endColumn,
          ),
          options: {
            className: isActive
              ? `match-outline-active-${match.matchId}`
              : `match-outline-${match.matchId}`,
            inlineClassName: isActive
              ? `match-inline-active-${match.matchId}`
              : `match-inline-${match.matchId}`,
          },
        }));
      }),
    );

    rightDecorationIdsRef.current = rightEditor.deltaDecorations(
      rightDecorationIdsRef.current,
      matches.flatMap((match) => {
        const isActive = activeMatchId === match.matchId;
        return (rightMatchRenderRanges.get(match.matchId) ?? []).map((range) => ({
          range: new monaco.Range(
            range.startLineNumber,
            range.startColumn,
            range.endLineNumber,
            range.endColumn,
          ),
          options: {
            className: isActive
              ? `match-outline-active-${match.matchId}`
              : `match-outline-${match.matchId}`,
            inlineClassName: isActive
              ? `match-inline-active-${match.matchId}`
              : `match-inline-${match.matchId}`,
          },
        }));
      }),
    );
  }, [activeMatchId, leftMatchRenderRanges, matches, rightMatchRenderRanges]);

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
      const clickedMatch = matches.find((match) =>
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
      const clickedMatch = matches.find((match) =>
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
  }, [leftSource, matches, rightSource]);

  const dynamicStyles = useMemo(
    () =>
      matches
        .map((match) => {
          const color = colors.get(match.matchId) ?? "#2563eb";
          return `
            .match-inline-${match.matchId} {
              background: ${hexToTransparentFill(color, 0.05)};
              border-bottom: 1px solid ${hexToTransparentFill(color, 0.35)};
            }
            .match-inline-active-${match.matchId} {
              background: ${hexToTransparentFill(color, 0.34)};
              border-bottom: 2px solid ${color};
              border-radius: 2px;
            }
            .match-outline-${match.matchId} {
              border: 1px solid ${hexToTransparentFill(color, 0.18)};
            }
            .match-outline-active-${match.matchId} {
              border: 1px solid ${color};
              box-shadow: inset 0 0 0 1px ${color};
              background: ${hexToTransparentFill(color, 0.1)};
            }
          `;
        })
        .join("\n"),
    [colors, matches],
  );

  return (
    <div className="evidence-shell">
      <style>{dynamicStyles}</style>
      <div className="evidence-grid">
        <div className="evidence-pane">
          <div className="evidence-pane-head">
            <strong>{leftTitle}</strong>
            <span>
              {leftLabel} - click a highlighted region to jump to its pair
            </span>
          </div>
          <Editor
            height="68vh"
            defaultLanguage={language}
            value={leftSource}
            onMount={(editor, monaco) => {
              leftEditorRef.current = editor;
              monacoRef.current = monaco;
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 3,
              padding: { top: 14, bottom: 14 },
              fontSize: 13,
            }}
            theme="vs-dark"
          />
        </div>

        <div className="evidence-pane">
          <div className="evidence-pane-head">
            <strong>{rightTitle}</strong>
            <span>
              {rightLabel} - colors stay matched on both sides
            </span>
          </div>
          <Editor
            height="68vh"
            defaultLanguage={language}
            value={rightSource}
            onMount={(editor, monaco) => {
              rightEditorRef.current = editor;
              monacoRef.current = monaco;
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 3,
              padding: { top: 14, bottom: 14 },
              fontSize: 13,
            }}
            theme="vs-dark"
          />
        </div>
      </div>

      <div className="evidence-legend">
        <div className="stack-sm">
          <strong>Matches</strong>
          <span className="pair-note">Select a match to scroll both panes and highlight the paired regions.</span>
        </div>
        <div className="legend-groups-layout">
          {codeMatches.length > 0 ? (
            <LegendGroup
              activeMatchId={activeMatchId}
              colors={colors}
              matches={codeMatches}
              onSelectMatch={revealMatch}
              position="left"
              title="Code matches"
            />
          ) : null}
          {commentMatches.length > 0 ? (
            <LegendGroup
              activeMatchId={activeMatchId}
              colors={colors}
              matches={commentMatches}
              onSelectMatch={revealMatch}
              position="right"
              title="Comment matches"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LegendGroup({
  activeMatchId,
  colors,
  matches,
  onSelectMatch,
  position,
  title,
}: {
  activeMatchId: string | null;
  colors: Map<string, string>;
  matches: ViewerMatch[];
  onSelectMatch: (matchId: string) => void;
  position: "left" | "right";
  title: string;
}) {
  return (
    <section className={`legend-group legend-group-${position}`}>
      <div className="legend-group-head">
        <strong>{title}</strong>
        <span className="pair-note">{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
      </div>
      <div className="legend-grid">
        {matches.map((match, index) => {
          const color = colors.get(match.matchId) ?? "#2563eb";
          const isActive = activeMatchId === match.matchId;
          return (
            <button
              key={match.matchId}
              type="button"
              onClick={() => onSelectMatch(match.matchId)}
              className={`legend-button${isActive ? " is-active" : ""}`}
              style={{
                borderColor: isActive ? color : undefined,
                background: isActive ? hexToTransparentFill(color, 0.18) : undefined,
              }}
            >
              <span
                className="legend-swatch"
                style={{ background: color }}
              />
              {formatMatchLabel(match.kind, index)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatMatchLabel(kind: ViewerMatch["kind"], index: number) {
  return `${kind === "comment" ? "Comment" : "Code"} ${index + 1}`;
}

function createMatchColor(index: number) {
  const hue = Math.round((index * 137.508) % 360);
  return hslToHex(hue, 72, 52);
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
