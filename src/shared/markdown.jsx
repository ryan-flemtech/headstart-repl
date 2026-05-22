import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'
import hljs from 'highlight.js/lib/core'
import hljsPython from 'highlight.js/lib/languages/python'
import hljsXml from 'highlight.js/lib/languages/xml'
import hljsCss from 'highlight.js/lib/languages/css'
import hljsJs from 'highlight.js/lib/languages/javascript'

hljs.registerLanguage('python', hljsPython)
hljs.registerLanguage('xml', hljsXml)
hljs.registerLanguage('css', hljsCss)
hljs.registerLanguage('javascript', hljsJs)

const INLINE_LANG_MAP = { python: 'python', html: 'xml', css: 'css', js: 'javascript' }
const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

// ── Scratch block renderer ────────────────────────────────────────────────────

function darkenColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 45)
  const g = Math.max(0, ((num >> 8) & 0xff) - 45)
  const b = Math.max(0, (num & 0xff) - 45)
  return `rgb(${r},${g},${b})`
}

function categorize(text) {
  const t = text.trim().toLowerCase()
  const unwrapped = t.replace(/^<+\s*/, '').replace(/\s*>+$/, '').trim()
  if (!t) return null

  // Events – hat blocks
  if (t.startsWith('when ')) return { color: '#FFAB19', hat: true }
  if (t.startsWith('broadcast ')) return { color: '#FFAB19' }

  // Control
  if (t.startsWith('wait ') || t === 'stop all') return { color: '#FFAB19' }
  if (t === 'forever' || t.startsWith('repeat ') || (t.startsWith('if ') && t.includes(' then')) || t === 'else') {
    return { color: '#FFAB19', c: true }
  }
  if (t === 'end') return null

  // Motion (check x/y before the generic variable catch-all below)
  if (
    t.startsWith('move ') || t.startsWith('turn ') || t.startsWith('go to') ||
    t.startsWith('glide ') || t === 'if on edge, bounce' ||
    t.startsWith('point in direction') ||
    t.startsWith('set rotation style') ||
    t.startsWith('set x') || t.startsWith('set y') ||
    t.startsWith('change x by') || t.startsWith('change y by')
  ) return { color: '#4C97FF' }

  // Looks (check size before variable catch-all)
  if (
    t.startsWith('say ') || t.startsWith('think ') ||
    t === 'show' || t === 'hide' ||
    t.startsWith('set size') || t.startsWith('change size')
  ) return { color: '#9966FF' }

  // Sound
  if (t.startsWith('play sound') || t.startsWith('start sound') || t === 'stop all sounds') {
    return { color: '#CF63CF' }
  }

  // Sensing
  if (t.startsWith('ask ') && t.endsWith(' and wait')) return { color: '#5CB1D6' }

  // Variables (generic catch-all — after motion/looks specifics)
  if (t === 'answer' || t === 'mouse down?' || t === 'touching edge?' || /^key\s+.+\s+pressed\?$/.test(t)) {
    return { color: '#5CB1D6' }
  }

  // Operators
  if (
    t === 'join' || t.startsWith('join ') ||
    t.startsWith('not ') ||
    /\s[+\-=<>]\s/.test(t) ||
    /\s(?:and|or)\s/.test(t) ||
    /\s[+\-=<>]\s/.test(unwrapped) ||
    /\s(?:and|or)\s/.test(unwrapped)
  ) return { color: '#59C059' }

  if (/^set\s+(?:\[[^\]]+\]|\S+)\s+to\b/.test(t)) return { color: '#FF8C1A' }
  if (/^change\s+(?:\[[^\]]+\]|\S+)\s+by\b/.test(t)) return { color: '#FF8C1A' }

  return null
}

function renderBlockText(text) {
  // Wrap numbers and quoted strings in a value-pill (mimics Scratch input bubbles)
  const parts = text.split(/(<<\s*[^<>]*\s*>>|<\s*[^<>]*\s[=<>]\s[^<>]*>|\([^)]*\)|\[[^\]]*\]|\b\d+(?:\.\d+)?\b|"[^"]*"|'[^']*')/g)
  return parts.map((part, i) => {
    const isNum = /^\d+(?:\.\d+)?$/.test(part)
    const isStr = /^["'].*["']$/.test(part)
    const isInput = /^\([^)]*\)$/.test(part) || /^\[[^\]]*\]$/.test(part)
    const isCondition = /^<<\s*.*\s*>>$/.test(part) || /^<\s*.*\s[=<>]\s.*>$/.test(part)
    if (isNum || isStr || isInput || isCondition) {
      const label = isStr || isInput
        ? part.slice(1, -1)
        : isCondition
          ? part.replace(/^<+\s*/, '').replace(/\s*>+$/, '')
          : part
      const isAnswer = isInput && label.trim().toLowerCase() === 'answer'
      const background = isCondition ? '#59C059' : isAnswer ? '#5CB1D6' : 'rgba(255,255,255,0.28)'
      return (
        <span
          key={i}
          style={{
            background,
            borderRadius: '999px',
            padding: isCondition ? '1px 8px' : '0 5px',
            margin: '0 1px',
            boxShadow: isCondition || isAnswer ? `0 2px 0 ${darkenColor(background)}` : undefined,
          }}
        >
          {isCondition ? renderBlockText(label) : label}
        </span>
      )
    }
    return part
  })
}

function InlineScratchBlock({ text }) {
  const info = categorize(text) ?? { color: '#7c7c7c' }
  const shadow = darkenColor(info.color)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        background: info.color,
        borderRadius: info.hat ? '10px 10px 2px 2px' : '3px',
        padding: '1px 8px',
        color: 'white',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 700,
        fontSize: '0.82em',
        lineHeight: 1.5,
        boxShadow: `0 2px 0 ${shadow}`,
        verticalAlign: 'middle',
        cursor: 'default',
        userSelect: 'none',
        position: 'relative',
        top: '-1px',
      }}
    >
      {renderBlockText(text)}
      {info.c && <span style={{ opacity: 0.65, fontSize: '10px' }}>▾</span>}
    </span>
  )
}

function ScratchBlock({ text, color, hat, c }) {
  const shadow = darkenColor(color)
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: color,
        borderRadius: hat ? '18px 18px 3px 3px' : '3px',
        padding: '5px 12px',
        color: 'white',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 700,
        fontSize: '13px',
        lineHeight: 1.3,
        boxShadow: `0 3px 0 ${shadow}`,
        cursor: 'default',
        userSelect: 'none',
        flexWrap: 'wrap',
      }}
    >
      {/* Small notch tab above stack/c blocks to suggest puzzle connectivity */}
      {!hat && (
        <span
          style={{
            position: 'absolute',
            top: -5,
            left: 10,
            width: 18,
            height: 6,
            background: color,
            borderRadius: '3px 3px 0 0',
          }}
        />
      )}
      {renderBlockText(text)}
      {/* Chevron on c-blocks to hint they wrap other blocks */}
      {c && (
        <span style={{ marginLeft: 4, opacity: 0.65, fontSize: '11px' }}>▾</span>
      )}
    </div>
  )
}

function ScratchBlocks({ code }) {
  const lines = code.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '10px 0' }}>
      {lines.map((line, i) => {
        const text = line.trim()
        if (!text) return null
        const leadingSpaces = line.length - line.trimStart().length
        const indentLevel = Math.floor(leadingSpaces / 2)
        const info = categorize(text) ?? (text.toLowerCase() === 'end' ? null : { color: '#7c7c7c' })
        if (!info) return null
        return (
          <div key={i} style={{ paddingLeft: indentLevel > 0 ? indentLevel * 16 + 8 : 0 }}>
            <ScratchBlock text={text} color={info.color} hat={info.hat} c={info.c} />
          </div>
        )
      })}
    </div>
  )
}

// ── Inline syntax-highlighted code ───────────────────────────────────────────

function looksLikeScratchBlocks(code) {
  const lines = code.split('\n').map(line => line.trim()).filter(Boolean)
  return lines.length > 0 && lines.every(line => line.toLowerCase() === 'end' || Boolean(categorize(line)))
}

function InlineHighlightedCode({ lang, code }) {
  const hljsLang = INLINE_LANG_MAP[lang]
  let highlighted
  try {
    highlighted = hljs.highlight(code, { language: hljsLang }).value
  } catch {
    highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return (
    <code
      className={`language-${hljsLang}`}
      style={{
        ...CODE_FONT_STYLE,
        fontSize: '0.88em',
        background: '#fafafa',
        border: '1px solid #e5e7eb',
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'inline',
      }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

// ── Markdown components ───────────────────────────────────────────────────────

const BlockCodeContext = React.createContext(false)

function splitTableRow(line) {
  const trimmed = line.trim()
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutOuterPipes.split('|').map(cell => cell.trim())
}

function isTableSeparator(line) {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function getTableAlignment(separator) {
  return splitTableRow(separator).map(cell => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })
}

function normalizeCells(cells, length) {
  return Array.from({ length }, (_, i) => cells[i] ?? '')
}

function parseMarkdownTables(content) {
  const lines = String(content ?? '').split('\n')
  const blocks = []
  let markdown = []
  let i = 0

  const flushMarkdown = () => {
    if (!markdown.length) return
    blocks.push({ type: 'markdown', content: markdown.join('\n') })
    markdown = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const next = lines[i + 1]
    if (line?.includes('|') && next && isTableSeparator(next)) {
      const headers = splitTableRow(line)
      const align = getTableAlignment(next)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(normalizeCells(splitTableRow(lines[i]), headers.length))
        i += 1
      }
      flushMarkdown()
      blocks.push({
        type: 'table',
        headers: normalizeCells(headers, headers.length),
        align: normalizeCells(align, headers.length),
        rows,
      })
      continue
    }

    markdown.push(line)
    i += 1
  }

  flushMarkdown()
  return blocks
}

function InlineMarkdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={components}
      allowedElements={['strong', 'em', 'code', 'br', 'span']}
      unwrapDisallowed
    >
      {content}
    </ReactMarkdown>
  )
}

function MarkdownTable({ headers, align, rows }) {
  return (
    <div style={tableStyles.scroll}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{ ...tableStyles.th, textAlign: align[i] }}>
                <InlineMarkdown content={header} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, i) => (
                <td key={i} style={{ ...tableStyles.td, textAlign: align[i] }}>
                  <InlineMarkdown content={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const headingBase = {
  fontFamily: 'var(--font-title)',
  fontWeight: 700,
  color: 'var(--colour-primary-dark)',
  lineHeight: 1.25,
}

const tableStyles = {
  scroll: {
    overflowX: 'auto',
    margin: '10px 0',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '320px',
    fontSize: '0.92em',
  },
  th: {
    background: '#f7f2ff',
    color: 'var(--colour-primary-dark)',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    padding: '8px 10px',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
  },
  td: {
    padding: '8px 10px',
    borderTop: '1px solid #f0f0f0',
    verticalAlign: 'top',
  },
}

const components = {
  h1({ children }) {
    return <h1 style={{ ...headingBase, fontSize: '1.45rem', margin: '4px 0 10px' }}>{children}</h1>
  },
  h2({ children }) {
    return <h2 style={{ ...headingBase, fontSize: '1.22rem', margin: '4px 0 8px' }}>{children}</h2>
  },
  h3({ children }) {
    return <h3 style={{ ...headingBase, fontSize: '1.05rem', margin: '8px 0 6px' }}>{children}</h3>
  },
  h4({ children }) {
    return <h4 style={{ ...headingBase, fontSize: '0.95rem', margin: '8px 0 4px' }}>{children}</h4>
  },
  code({ node, className, children, ...props }) {
    const isInBlock = React.useContext(BlockCodeContext)
    const isInline = !isInBlock && !className
    if (isInline) {
      const text = String(children)
      if (text.startsWith('scratch:')) {
        return <InlineScratchBlock text={text.slice('scratch:'.length).trim()} />
      }
      if (categorize(text)) {
        return <InlineScratchBlock text={text.trim()} />
      }
      const langMatch = text.match(/^(python|html|css|js):(.*)$/s)
      if (langMatch) {
        return <InlineHighlightedCode lang={langMatch[1]} code={langMatch[2]} />
      }
      return (
        <code
          style={{
            ...CODE_FONT_STYLE,
            fontSize: '0.88em',
            background: '#f0eafa',
            color: '#4e1aa3',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          {...props}
        >
          {children}
        </code>
      )
    }
    if (className?.includes('language-scratch')) {
      return <ScratchBlocks code={String(children).replace(/\n$/, '')} />
    }
    return (
      <code className={className} style={CODE_FONT_STYLE} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    // Pass through without pre styling when the child is a scratch block
    const child = React.Children.toArray(children)[0]
    if (child?.props?.className?.includes('language-scratch')) {
      return <>{children}</>
    }
    const className = child?.props?.className
    const isPlainCodeBlock = child?.type === 'code' && !className
    const plainCode = isPlainCodeBlock ? String(child.props.children ?? '') : null
    if (plainCode && looksLikeScratchBlocks(plainCode)) {
      return <ScratchBlocks code={plainCode.replace(/\n$/, '')} />
    }
    return (
      <BlockCodeContext.Provider value={true}>
      <pre
        style={{
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 14px',
          overflowX: 'auto',
          ...CODE_FONT_STYLE,
          fontSize: '14px',
          margin: '10px 0',
          lineHeight: 1.6,
        }}
      >
        {isPlainCodeBlock
          ? (
            <code style={CODE_FONT_STYLE}>
              {plainCode}
            </code>
          )
          : children}
      </pre>
      </BlockCodeContext.Provider>
    )
  },
  p({ children }) {
    return <p style={{ margin: '6px 0', lineHeight: 1.65 }}>{children}</p>
  },
  ul({ children }) {
    return <ul style={{ margin: '6px 0 8px 20px', lineHeight: 1.55 }}>{children}</ul>
  },
  ol({ children }) {
    return <ol style={{ margin: '6px 0 8px 22px', lineHeight: 1.55 }}>{children}</ol>
  },
  li({ children }) {
    return <li style={{ margin: '3px 0' }}>{children}</li>
  },
  blockquote({ children }) {
    return (
      <blockquote
        style={{
          margin: '10px 0',
          padding: '8px 12px',
          borderLeft: '4px solid var(--colour-secondary)',
          background: '#fffaf0',
          borderRadius: '0 8px 8px 0',
        }}
      >
        {children}
      </blockquote>
    )
  },
  strong({ children }) {
    return <strong style={{ fontWeight: 700 }}>{children}</strong>
  },
  em({ children }) {
    return <em>{children}</em>
  },
}

export function MarkdownRenderer({ content, title, style }) {
  const blocks = parseMarkdownTables(content)
  const heading = String(title ?? '').trim()

  return (
    <div
      style={{
        fontFamily: "'Quicksand', sans-serif",
        color: 'var(--colour-text)',
        fontSize: '15px',
        lineHeight: 1.65,
        ...style,
      }}
    >
      {heading && (
        <h1 style={{ ...headingBase, fontSize: '1.45rem', margin: '4px 0 10px' }}>
          {heading}
        </h1>
      )}
      {blocks.map((block, i) => block.type === 'table'
        ? <MarkdownTable key={i} headers={block.headers} align={block.align} rows={block.rows} />
        : (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeHighlight]}
            components={components}
            allowedElements={[
              'h1', 'h2', 'h3', 'h4',
              'p', 'strong', 'em', 'code', 'pre', 'br', 'span',
              'ul', 'ol', 'li', 'blockquote',
            ]}
            unwrapDisallowed
          >
            {block.content}
          </ReactMarkdown>
          ))}
    </div>
  )
}
