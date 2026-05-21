import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'

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
  if (t.startsWith('set ') && t.includes(' to ')) return { color: '#FF8C1A' }
  if (t.startsWith('change ') && t.includes(' by ')) return { color: '#FF8C1A' }

  return { color: '#7c7c7c' }
}

function renderBlockText(text) {
  // Matches condition pills wrapped in <<...>> OR numbers/quoted strings
  // Regex Breakdown: (<<[^>]+>>) catches << anything inside double angle brackets >>
  const parts = text.split(/(<<.+?>>|\b\d+(?:\.\d+)?\b|"[^"]*"|'[^']*')/g);
  
  return parts.map((part, i) => {
    // 1. Check if it's a Condition Pill <<...>>
    if (part.startsWith('<<') && part.endsWith('>>')) {
      const innerText = part.slice(2, -2).trim(); // Strip the << and >>
      const t = innerText.toLowerCase();

      // Determine pill color: Sensing Blue vs Operators Green
      const isSensing = t.includes('touching') || t.includes('key') || t.includes('mouse') || t.includes('pressed');
      const pillColor = isSensing ? '#5CB1D6' : '#5CB345'; 

      return (
        <span
          key={i}
          style={{
            background: pillColor,
            borderRadius: '12px',  // Pointed pill shape
            padding: '2px 8px',
            margin: '0 3px',
            fontSize: '12px',
            border: '1px solid rgba(0,0,0,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            color: 'white',
          }}
        >
          {/* Recursively render text inside so numbers like '5' still get white bubbles */}
          {renderBlockText(innerText)}
        </span>
      );
    }

    // 2. Existing logic for Numbers or Strings (White Bubbles)
    const isNum = /^\d+(?:\.\d+)?$/.test(part);
    const isStr = /^["'].*["']$/.test(part);
    if (isNum || isStr) {
      return (
        <span
          key={i}
          style={{
            background: 'rgba(255,255,255,0.28)',
            borderRadius: '8px',
            padding: '0 5px',
            margin: '0 1px',
            color: isStr ? 'white' : 'inherit'
          }}
        >
          {isStr ? part.slice(1, -1) : part}
        </span>
      );
    }

    // 3. Plain text
    return part;
  });
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
        const info = categorize(text)
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

// ── Markdown components ───────────────────────────────────────────────────────

const components = {
  code({ node, inline, className, children, ...props }) {
    if (inline) {
      return (
        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace",
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
      <code className={className} style={{ fontFamily: "'JetBrains Mono', monospace" }} {...props}>
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
    return (
      <pre
        style={{
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 14px',
          overflowX: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '14px',
          margin: '10px 0',
          lineHeight: 1.6,
        }}
      >
        {children}
      </pre>
    )
  },
  p({ children }) {
    return <p style={{ margin: '6px 0', lineHeight: 1.65 }}>{children}</p>
  },
  strong({ children }) {
    return <strong style={{ fontWeight: 700 }}>{children}</strong>
  },
  em({ children }) {
    return <em>{children}</em>
  },
}

export function MarkdownRenderer({ content, style }) {
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
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
        allowedElements={['p', 'strong', 'em', 'code', 'pre', 'br', 'span']}
        unwrapDisallowed
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
