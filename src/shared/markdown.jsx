import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'

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
    return (
      <code className={className} style={{ fontFamily: "'JetBrains Mono', monospace" }} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
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
