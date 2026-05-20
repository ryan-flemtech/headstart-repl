import React, { useState, useRef, useEffect } from 'react'
import { initPyodide, runPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc } from '../../shared/iframe'
import TopBar from '../components/TopBar'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import IframePreview from '../components/IframePreview'
import SplitPane from '../../shared/SplitPane'

const DEFAULT_PYTHON = '# Write your code here\n'
const DEFAULT_HTML_FILES = [
  { name: 'index.html', type: 'html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>' },
  { name: 'style.css', type: 'css', content: '/* styles here */\n' },
]

export default function StandaloneSandbox({ onBack }) {
  const [mode, setMode]               = useState('python') // 'python' | 'html'
  const [code, setCode]               = useState(DEFAULT_PYTHON)
  const [files, setFiles]             = useState(DEFAULT_HTML_FILES)
  const [activeFile, setActiveFile]   = useState('index.html')
  const [output, setOutput]           = useState('')
  const [runStatus, setRunStatus]     = useState(null)
  const [running, setRunning]         = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle')
  const [iframeSrc, setIframeSrc]     = useState(null)
  const [inputPrompt, setInputPrompt] = useState(null)
  const iframeRef = useRef(null)

  // Warm up Pyodide when Python mode is first used
  useEffect(() => {
    if (mode !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [mode])

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    setOutput('')
    setRunStatus(null)
    setIframeSrc(null)
    setInputPrompt(null)
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)

    if (mode === 'python') {
      let accumulated = ''
      const result = await runPython(code, {
        onOutput: text => { accumulated += text; setOutput(accumulated) },
        onInputRequired: p => setInputPrompt(p),
      })
      setInputPrompt(null)
      setRunStatus(result.status)
    } else {
      const src = buildIframeSrc(files, 'index.html')
      setIframeSrc(src)
      setRunStatus('success')
    }

    setRunning(false)
  }

  return (
    <div style={s.page}>
      <TopBar
        lessonTitle="Sandbox"
        isSandbox
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={s.modeToggle}>
              <button
                style={{ ...s.modeBtn, ...(mode === 'python' ? s.modeBtnActive : {}) }}
                onClick={() => switchMode('python')}
              >
                Python
              </button>
              <button
                style={{ ...s.modeBtn, ...(mode === 'html' ? s.modeBtnActive : {}) }}
                onClick={() => switchMode('html')}
              >
                HTML / CSS
              </button>
            </div>
            <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={onBack}>
              ← Back
            </button>
          </div>
        }
      />

      <div style={{ ...s.body, ...(mode === 'html' ? { overflow: 'hidden', gap: 0 } : {}) }}>
        {mode === 'python' ? (
          <>
            <PythonEditor
              code={code}
              onChange={setCode}
              pyodideStatus={pyodideStatus}
            />
            <button
              className="btn-primary"
              style={s.runBtn}
              onClick={handleRun}
              disabled={running || pyodideStatus === 'loading'}
            >
              {running ? 'Running…' : 'Run'}
            </button>
            <OutputPanel
              output={output}
              runStatus={runStatus}
              inputPrompt={inputPrompt}
              onInputSubmit={value => provideInput(value)}
            />
          </>
        ) : (
          <SplitPane
            style={{ flex: 1 }}
            left={
              <div style={s.htmlLeft}>
                <HtmlEditor
                  files={files}
                  activeFile={activeFile}
                  onTabChange={setActiveFile}
                  onFileChange={(name, content) =>
                    setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f))
                  }
                />
                <button
                  className="btn-primary"
                  style={{ ...s.runBtn, flexShrink: 0 }}
                  onClick={handleRun}
                  disabled={running}
                >
                  {running ? 'Running…' : 'Run'}
                </button>
              </div>
            }
            right={<IframePreview src={iframeSrc} iframeRef={iframeRef} fill />}
          />
        )}
      </div>
    </div>
  )
}

const s = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
    overflowY: 'auto',
    minHeight: 0,
  },
  runBtn: {
    alignSelf: 'flex-start',
    padding: '8px 24px',
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 10,
    padding: 16,
    paddingRight: 8,
  },
  modeToggle: {
    display: 'flex',
    border: '1.5px solid rgba(255,255,255,0.35)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  modeBtn: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    padding: '4px 12px',
    border: 'none',
    borderRadius: 0,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  modeBtnActive: {
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
  },
}
