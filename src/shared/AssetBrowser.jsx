import React, { useState, useRef } from 'react'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

function isImage(name) {
  return IMAGE_EXTS.has(name.split('.').pop().toLowerCase())
}

function buildTree(assets) {
  const root = {}
  for (const assetPath of assets) {
    const parts = assetPath.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { _dir: true, _ch: {} }
      node = node[parts[i]]._ch
    }
    const name = parts[parts.length - 1]
    node[name] = { _dir: false, _path: assetPath }
  }
  return root
}

function DirNode({ name, children, assetsPath, copyMode, depth }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        style={{ ...s.dirBtn, paddingLeft: 8 + depth * 14 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={s.arrow}>{open ? '▾' : '▸'}</span>
        <span style={s.itemLabel}>📁 {name}</span>
      </button>
      {open && Object.entries(children).map(([n, node]) =>
        node._dir
          ? <DirNode key={n} name={n} children={node._ch} assetsPath={assetsPath} copyMode={copyMode} depth={depth + 1} />
          : <FileNode key={n} name={n} path={node._path} assetsPath={assetsPath} copyMode={copyMode} depth={depth + 1} />
      )}
    </div>
  )
}

function FileNode({ name, path, assetsPath, copyMode, depth }) {
  const [copied, setCopied] = useState(false)
  const [previewPos, setPreviewPos] = useState(null)
  const rowRef = useRef(null)

  const staticUrl = assetsPath + path
  const copyValue = copyMode === 'full' ? staticUrl : path

  function handleCopy() {
    navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleMouseEnter() {
    if (!isImage(name) || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const tipW = 192  // maxWidth 180 + padding 12
    const tipH = 156  // maxHeight 140 + padding 12
    const x = rect.right + 8 + tipW > window.innerWidth
      ? rect.left - tipW - 8
      : rect.right + 8
    const y = Math.min(rect.top, window.innerHeight - tipH - 8)
    setPreviewPos({ x, y })
  }

  return (
    <div
      ref={rowRef}
      style={{ ...s.fileRow, paddingLeft: 8 + depth * 14 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setPreviewPos(null)}
    >
      <span style={s.itemLabel}>{isImage(name) ? '🖼' : '📄'} {name}</span>
      <button style={s.copyBtn} onClick={handleCopy}>
        {copied ? '✓' : 'Copy'}
      </button>
      {previewPos && (
        <div style={{ ...s.tooltip, left: previewPos.x, top: previewPos.y }}>
          <img src={staticUrl} alt={name} style={s.previewImg} />
        </div>
      )}
    </div>
  )
}

/**
 * Renders a read-only tree of lesson assets with click-to-copy and image previews.
 *
 * assetsPath  – fully resolved URL base, e.g. "/headstart-repl/assets/web-intro/"
 * assets      – array of relative paths, e.g. ["images/logo.png", "fonts/x.woff2"]
 * copyMode    – "relative" copies just the path; "full" copies assetsPath + path
 */
export default function AssetBrowser({ assetsPath, assets, copyMode = 'relative' }) {
  if (!assetsPath || !assets?.length) return null

  const tree = buildTree(assets)

  return (
    <div style={s.panel}>
      {Object.entries(tree).map(([name, node]) =>
        node._dir
          ? <DirNode key={name} name={name} children={node._ch} assetsPath={assetsPath} copyMode={copyMode} depth={0} />
          : <FileNode key={name} name={name} path={node._path} assetsPath={assetsPath} copyMode={copyMode} depth={0} />
      )}
    </div>
  )
}

const s = {
  panel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  dirBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    padding: '5px 8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    boxSizing: 'border-box',
  },
  arrow: { fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, width: 10 },
  itemLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: {
    flexShrink: 0,
    padding: '2px 8px',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  tooltip: {
    position: 'fixed',
    zIndex: 9999,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    pointerEvents: 'none',
  },
  previewImg: {
    maxWidth: 180,
    maxHeight: 140,
    display: 'block',
    borderRadius: 4,
  },
}
