'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { linter, lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

import { schemaCompletions } from '@/features/inbound-webhooks/schema/completion';
import { parseDocument } from '@/features/inbound-webhooks/schema/json-tree';
import { collectProblems } from '@/features/inbound-webhooks/schema/problems';
import type { SchemaProblemDto } from '@/features/inbound-webhooks/types';
import { cn } from '@/shared/lib/utils';

const theme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--color-surface-base)',
      color: 'var(--color-text-normal)',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
    '.cm-gutters': {
      backgroundColor: 'var(--color-surface-base)',
      color: 'var(--color-text-faint)',
      border: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-cursor': { borderLeftColor: 'var(--color-text-primary)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--color-brand-tint)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-surface-elevated)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      color: 'var(--color-text-normal)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--color-brand-tint)',
      color: 'var(--color-text-primary)',
    },
    '.cm-completionDetail': { color: 'var(--color-text-subtle)', fontStyle: 'normal' },
    '.cm-diagnostic-error': { borderLeftColor: 'var(--color-error)' },
    '.cm-diagnostic-warning': { borderLeftColor: 'var(--color-warning)' },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy var(--color-error)',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy var(--color-warning)',
    },
  },
  { dark: true }
);

interface SchemaEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** What the API's preview found, placed in the text by its path. */
  serverProblems?: SchemaProblemDto[];
  /** Fixed when the editor is created: give it a different `key` to switch modes. */
  readOnly?: boolean;
  className?: string;
}

/**
 * The schema as JSON with completion and live checks. Loaded with
 * `next/dynamic` so CodeMirror stays out of every other page's bundle.
 */
export function SchemaEditor({
  value,
  onChange,
  serverProblems = [],
  readOnly = false,
  className,
}: SchemaEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          json(),
          linter(null),
          lintGutter(),
          autocompletion({ override: [schemaCompletions] }),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Schema JSON' }),
          theme,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once; later values arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  const problems = useMemo(
    () => collectProblems(parseDocument(value), serverProblems),
    [value, serverProblems]
  );

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() !== value) return;
    const diagnostics: Diagnostic[] = problems.map((problem) => ({
      from: problem.from,
      to: Math.max(problem.to, problem.from),
      severity: problem.severity,
      message: problem.message,
      source: problem.source,
    }));
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [problems, value]);

  function jumpTo(from: number) {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch({ selection: { anchor: from }, scrollIntoView: true });
    editor.focus();
  }

  const errors = problems.filter((problem) => problem.severity === 'error').length;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        ref={host}
        data-testid="schema-editor"
        className="h-96 overflow-hidden rounded-md border border-border bg-surface-base focus-within:border-border-focus"
      />
      <div aria-live="polite">
        {problems.length === 0 ? (
          <p className="text-body text-text-subtle">No problems found.</p>
        ) : (
          <>
            <p className="text-overline text-text-subtle">
              {errors} {errors === 1 ? 'error' : 'errors'}, {problems.length - errors}{' '}
              {problems.length - errors === 1 ? 'warning' : 'warnings'}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {problems.map((problem, index) => (
                <li key={`${problem.from}-${index}`}>
                  <button
                    type="button"
                    onClick={() => jumpTo(problem.from)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-body text-text-normal hover:bg-surface-hover"
                  >
                    {problem.severity === 'error' ? (
                      <CircleAlert
                        className="mt-0.5 size-4 shrink-0 text-error"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-text-subtle">Line {problem.line}</span>
                    <span>{problem.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
