import { useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { getLanguageFromPath } from "@/lib/virtual-fs";

export interface CodeEditorHandle {
  undo: () => void;
  redo: () => void;
  format: () => void;
  getLanguage: () => string;
  insertText: (text: string) => void;
  moveCursor: (dir: "up" | "down" | "left" | "right") => void;
}

interface CodeEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
  language?: string;
  onCursorChange?: (line: number, col: number) => void;
}

const OLIVE_THEME: Parameters<BeforeMount>[0]["editor"]["defineTheme"] extends (...a: infer P) => any ? P[1] : any = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "d4d8c8", background: "161e0f" },
    { token: "comment", foreground: "5a7a45", fontStyle: "italic" },
    { token: "keyword", foreground: "8fc87c" },
    { token: "string", foreground: "c9d982" },
    { token: "number", foreground: "e0c97a" },
    { token: "type", foreground: "7dbda8" },
    { token: "function", foreground: "b8d4a0" },
    { token: "variable", foreground: "cdd6b8" },
    { token: "constant", foreground: "e9b96e" },
    { token: "tag", foreground: "8fc87c" },
    { token: "attribute.name", foreground: "c9d982" },
    { token: "attribute.value", foreground: "d4a56a" },
    { token: "delimiter", foreground: "8aab7a" },
    { token: "operator", foreground: "9dbf82" },
  ],
  colors: {
    "editor.background": "#161e0f",
    "editor.foreground": "#d4d8c8",
    "editor.lineHighlightBackground": "#1e2a14",
    "editor.selectionBackground": "#3a5228",
    "editor.selectionHighlightBackground": "#2a3c1e",
    "editor.findMatchBackground": "#5a7a3080",
    "editor.findMatchHighlightBackground": "#3a5a2040",
    "editorLineNumber.foreground": "#3a5228",
    "editorLineNumber.activeForeground": "#6a9a50",
    "editorCursor.foreground": "#8fc87c",
    "editorWhitespace.foreground": "#2a3a1c",
    "editorIndentGuide.background": "#1e2a14",
    "editorIndentGuide.activeBackground": "#2d3e20",
    "editorBracketMatch.background": "#3a5228",
    "editorBracketMatch.border": "#6a9a50",
    "editorGutter.background": "#0d0d0d",
    "editorWidget.background": "#141414",
    "editorWidget.border": "#2d3e20",
    "editorSuggestWidget.background": "#141414",
    "editorSuggestWidget.border": "#2d3e20",
    "editorSuggestWidget.selectedBackground": "#263618",
    "editorSuggestWidget.highlightForeground": "#8fc87c",
    "scrollbarSlider.background": "#2d3e2060",
    "scrollbarSlider.hoverBackground": "#3a5228a0",
    "scrollbarSlider.activeBackground": "#4a6a38c0",
    "list.hoverBackground": "#1e2a14",
    "list.activeSelectionBackground": "#263618",
  },
};

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ filePath, content, onChange, language: forcedLang, onCursorChange }, ref) => {
    const editorRef = useRef<any>(null);
    const language = forcedLang || getLanguageFromPath(filePath);

    useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger("keyboard", "undo", null),
      redo: () => editorRef.current?.trigger("keyboard", "redo", null),
      format: () => editorRef.current?.getAction("editor.action.formatDocument")?.run(),
      getLanguage: () => language,
      insertText: (text: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        const selection = editor.getSelection();
        if (!selection) return;
        editor.executeEdits("insert", [{ range: selection, text, forceMoveMarkers: true }]);
      },
      moveCursor: (dir: "up" | "down" | "left" | "right") => {
        const editor = editorRef.current;
        if (!editor) return;
        const cmdMap = { up: "cursorUp", down: "cursorDown", left: "cursorLeft", right: "cursorRight" };
        editor.trigger("keyboard", cmdMap[dir], null);
      },
    }));

    const handleBeforeMount: BeforeMount = useCallback((monaco) => {
      monaco.editor.defineTheme("olive-dark", OLIVE_THEME as any);
    }, []);

    const handleMount: OnMount = useCallback((editor) => {
      editorRef.current = editor;
      editor.focus();
      editor.onDidChangeCursorPosition((e: { position: { lineNumber: number; column: number } }) => {
        onCursorChange?.(e.position.lineNumber, e.position.column);
      });
    }, [onCursorChange]);

    return (
      <div className="h-full w-full">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="olive-dark"
          beforeMount={handleBeforeMount}
          onChange={(value) => onChange(value || "")}
          onMount={handleMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
            minimap: { enabled: false },
            wordWrap: "on",
            lineNumbers: "on",
            renderLineHighlight: "all",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
            formatOnType: false,
            folding: true,
            foldingStrategy: "indentation",
            showFoldingControls: "always",
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
          }}
        />
      </div>
    );
  }
);

CodeEditor.displayName = "CodeEditor";
export default CodeEditor;
