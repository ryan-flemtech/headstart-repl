/**
 * Shared CodeMirror React wrapper — used by both the classroom app and lesson builder.
 * Accepts the language type, current value, an onChange callback, and a readOnly flag.
 * Creates a single EditorView and updates it imperatively to avoid full re-mounts.
 */
import React, { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  createBaseExtensions,
  readOnlyCompartment,
  languageCompartment,
  tabSizeCompartment,
  getLanguageExtension,
  getTabSize,
} from './codemirror'

export function CodeEditor({ value = '', language = 'python', readOnly = false, onChange, style }) {
  const containerRef = useRef(null)
  const viewRef      = useRef(null)
  const onChangeRef  = useRef(onChange)
  onChangeRef.current = onChange

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...createBaseExtensions(language, readOnly),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString())
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep readOnly compartment in sync
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    })
  }, [readOnly])

  // Keep language in sync
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        languageCompartment.reconfigure(getLanguageExtension(language)),
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(getTabSize(language))),
      ],
    })
  }, [language])

  // Sync external value changes (e.g. task switch, sandbox push)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value ?? '' },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        border: readOnly ? '1px solid rgba(239,68,68,0.3)' : '1px solid #e5e7eb',
        borderRadius: '8px',
        background: readOnly ? 'rgba(239,68,68,0.04)' : '#fafafa',
        ...style,
      }}
    />
  )
}
