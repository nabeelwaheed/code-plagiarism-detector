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
}

const PALETTE = ["#d9480f", "#0f766e", "#2563eb", "#c026d3", "#ca8a04", "#4338ca"];

export function EvidenceViewer({
  language = "plaintext",
  leftSource,
  rightSource,
  matches,
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
    <div style={{ display: "grid", gap: 16 }}>
      <style>{dynamicStyles}</style>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Editor
          height="70vh"
          defaultLanguage={language}
          value={leftSource}
          onMount={(editor, monaco) => {
            leftEditorRef.current = editor;
            monacoRef.current = monaco;
          }}
          options={{ readOnly: true, minimap: { enabled: false } }}
        />
        <Editor
          height="70vh"
          defaultLanguage={language}
          value={rightSource}
          onMount={(editor, monaco) => {
            rightEditorRef.current = editor;
            monacoRef.current = monaco;
          }}
          options={{ readOnly: true, minimap: { enabled: false } }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {matches.map((match) => (
          <button
            key={match.matchId}
            type="button"
            onClick={() => revealFromLegend(match.matchId)}
            style={{
              border: "1px solid #d9d2c0",
              background: colors.get(match.matchId),
              color: "#fff",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {match.matchId}
          </button>
        ))}
      </div>
    </div>
  );
}
