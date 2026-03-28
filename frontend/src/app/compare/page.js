"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { fetchAPI } from "../../lib/api";

export default function ComparePage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const pairId = searchParams.get("pairId");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceA, setSourceA] = useState("");
  const [sourceB, setSourceB] = useState("");
  const [matches, setMatches] = useState([]);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  useEffect(() => {
    if (jobId && pairId) {
      loadDiffData();
    } else {
      setError("Missing Job ID or Pair ID in the URL.");
      setIsLoading(false);
    }
  }, [jobId, pairId]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current && matches.length > 0) {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const decorations = matches.map(match => ({
        range: new monaco.Range(match.start_line, 1, match.end_line, 1),
        options: {
          isWholeLine: true,
          className: 'evidence-highlight',
          linesDecorationsClassName: 'evidence-margin'
        }
      }));

      editor.getOriginalEditor().createDecorationsCollection(decorations);
      editor.getModifiedEditor().createDecorationsCollection(decorations);
      editor.getOriginalEditor().revealLineInCenter(matches[0].start_line);
    }
  }, [matches]);

  const loadDiffData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAPI(`/analysis/jobs/${jobId}/pairs/${pairId}`, 'GET');
      setSourceA(data.fileA_text || "// No text found for Source A.");
      setSourceB(data.fileB_text || "// No text found for Source B.");
      
      if (data.matches) {
        setMatches(data.matches);
      }
    } catch (err) {
      setError("Failed to load comparison data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <div className="space-y-4 h-[calc(100vh-4rem)] flex flex-col">
      <style dangerouslySetInnerHTML={{__html: `
        .evidence-highlight { background-color: rgba(239, 68, 68, 0.2) !important; }
        .evidence-margin { background: #ef4444 !important; width: 5px !important; margin-left: 3px; }

        /* Forces Monaco's native background colors to vanish */
        .monaco-diff-editor .line-insert,
        .monaco-diff-editor .line-delete,
        .monaco-diff-editor .char-insert,
        .monaco-diff-editor .char-delete {
            background-color: transparent !important;
        }
      `}} />

      <div className="flex justify-between items-end border-b pb-4 shrink-0">
        <div>
          <Link href={jobId ? `/jobs/${jobId}/results` : "/jobs"} className="text-sm text-blue-500 hover:underline mb-2 inline-block">
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            Difference:
          </h1>
        </div>
      </div>

      <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <p className="text-blue-500 font-semibold animate-pulse">Loading comparison...</p>
          </div>
        ) : (
          <DiffEditor
            height="100%"
            language="cpp"
            original={sourceA}
            modified={sourceB}
            theme="light"
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              renderSideBySide: true, 
              renderMatchesOnLine: false, 
              renderIndicators: false, 
              overviewRulerLanes: 0,   
              hideCursorInOverviewRuler: true,
              diffCodeLens: false,
              minimap: { enabled: false },
              ignoreTrimWhitespace: true,
              fontSize: 14,
              lineNumbers: "on",
            }}
          />
        )}
      </div>
    </div>
  );
}