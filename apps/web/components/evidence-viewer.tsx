"use client";

import Editor from "@monaco-editor/react";
import type { ViewerMatch } from "@similarity/shared";
import { useEffect, useMemo, useRef } from "react";
import type * as Monaco from "monaco-editor";
import {
  byteSpanToEditorRange,
  editorPositionToByteOffset,
  hexToTransparentFill,
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

const PALETTE = ["#d9480f", "#0f766e", "#2563eb", "#c026d3", "#ca8a04", "#4338ca"];

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

  const colors = useMemo(() => {
    const colorMap = new Map<string, string>();
    matches.forEach((match, index) => {
      colorMap.set(match.matchId, PALETTE[index % PALETTE.length]!);
    });
    return colorMap;
  }, [matches]);

  useEffect(() => {
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;
    const monaco = monacoRef.current;

    if (!leftEditor || !rightEditor || !monaco) {
      return;
    }

    leftDecorationIdsRef.current = leftEditor.deltaDecorations(
      leftDecorationIdsRef.current,
      matches.map((match) => ({
        range: new monaco.Range(
          byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd)
            .startLineNumber,
          byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd)
            .startColumn,
          byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd)
            .endLineNumber,
          byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd).endColumn,
        ),
        options: {
          className: `match-outline-${match.matchId}`,
          inlineClassName: `match-inline-${match.matchId}`,
        },
      })),
    );

    rightDecorationIdsRef.current = rightEditor.deltaDecorations(
      rightDecorationIdsRef.current,
      matches.map((match) => ({
        range: new monaco.Range(
          byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd)
            .startLineNumber,
          byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd)
            .startColumn,
          byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd)
            .endLineNumber,
          byteSpanToEditorRange(rightSource, match.right.byteStart, match.right.byteEnd).endColumn,
        ),
        options: {
          className: `match-outline-${match.matchId}`,
          inlineClassName: `match-inline-${match.matchId}`,
        },
      })),
    );
  }, [leftSource, matches, rightSource]);

  useEffect(() => {
    const leftEditor = leftEditorRef.current;
    const rightEditor = rightEditorRef.current;

    if (!leftEditor || !rightEditor) {
      return;
    }

    const revealMatch = (matchId: string) => {
      const match = matches.find((candidate) => candidate.matchId === matchId);
      if (!match) {
        return;
      }

      const leftRange = byteSpanToEditorRange(
        leftSource,
        match.left.byteStart,
        match.left.byteEnd,
      );
      const rightRange = byteSpanToEditorRange(
        rightSource,
        match.right.byteStart,
        match.right.byteEnd,
      );

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
              background: ${hexToTransparentFill(color)};
              border-bottom: 2px solid ${color};
            }
            .match-outline-${match.matchId} {
              border: 1px solid ${color};
            }
          `;
        })
        .join("\n"),
    [colors, matches],
  );

  const revealFromLegend = (matchId: string) => {
    const match = matches.find((candidate) => candidate.matchId === matchId);
    if (!match || !leftEditorRef.current || !rightEditorRef.current) {
      return;
    }

    const leftRange = byteSpanToEditorRange(leftSource, match.left.byteStart, match.left.byteEnd);
    const rightRange = byteSpanToEditorRange(
      rightSource,
      match.right.byteStart,
      match.right.byteEnd,
    );

    leftEditorRef.current.revealRangeInCenter(leftRange);
    rightEditorRef.current.revealRangeInCenter(rightRange);
    rightEditorRef.current.focus();
  };

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
          <span className="pair-note">Select a match chip to jump to the same region on both sides.</span>
        </div>
        <div className="legend-grid">
        {matches.map((match) => (
          <button
            key={match.matchId}
            type="button"
            onClick={() => revealFromLegend(match.matchId)}
            className="legend-button"
          >
            <span
              className="legend-swatch"
              style={{ background: colors.get(match.matchId) }}
            />
            {match.matchId}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
