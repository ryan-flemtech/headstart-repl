import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownRenderer, InlineMarkdown } from '../markdown'

describe('MarkdownRenderer', () => {
  it('renders without crashing on an empty string', () => {
    render(<MarkdownRenderer content="" />)
  })

  it('renders without crashing when content is undefined', () => {
    render(<MarkdownRenderer />)
  })

  it('renders a heading from markdown text', () => {
    render(<MarkdownRenderer content="# Hello World" />)
    expect(screen.getByRole('heading', { level: 1, name: /Hello World/i })).toBeInTheDocument()
  })

  it('renders an h2 heading', () => {
    render(<MarkdownRenderer content="## Section Title" />)
    expect(screen.getByRole('heading', { level: 2, name: /Section Title/i })).toBeInTheDocument()
  })

  it('renders plain paragraph text', () => {
    render(<MarkdownRenderer content="This is a paragraph." />)
    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument()
  })

  it('renders bold text inside a paragraph', () => {
    render(<MarkdownRenderer content="This is **important**." />)
    const bold = screen.getByText('important')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders italic text', () => {
    render(<MarkdownRenderer content="This is _emphasised_ text." />)
    const em = screen.getByText('emphasised')
    expect(em.tagName).toBe('EM')
  })

  it('renders a code block (fenced triple-backtick)', () => {
    const content = '```\nprint("hello")\n```'
    render(<MarkdownRenderer content={content} />)
    expect(screen.getByText(/print\("hello"\)/)).toBeInTheDocument()
  })

  it('renders an inline code snippet', () => {
    render(<MarkdownRenderer content="Use `my_variable` here." />)
    expect(screen.getByText('my_variable')).toBeInTheDocument()
  })

  it('renders a bulleted list', () => {
    render(<MarkdownRenderer content={'- Alpha\n- Beta\n- Gamma'} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('renders an ordered list', () => {
    render(<MarkdownRenderer content={'1. First\n2. Second\n3. Third'} />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('renders a table', () => {
    const content = [
      '| Name | Age |',
      '| ---- | --- |',
      '| Alice | 10 |',
      '| Bob | 12 |',
    ].join('\n')
    render(<MarkdownRenderer content={content} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders a blockquote', () => {
    render(<MarkdownRenderer content="> A wise saying." />)
    expect(screen.getByText(/A wise saying\./i)).toBeInTheDocument()
  })

  it('uses the optional title prop without crashing', () => {
    render(<MarkdownRenderer content="Some text." title="My Title" />)
    expect(screen.getByText('Some text.')).toBeInTheDocument()
  })

  it('applies the textScale prop without crashing', () => {
    render(<MarkdownRenderer content="Scaled text." textScale={1.5} />)
    expect(screen.getByText('Scaled text.')).toBeInTheDocument()
  })
})

describe('InlineMarkdown', () => {
  it('renders without crashing on an empty string', () => {
    render(<InlineMarkdown content="" />)
  })

  it('renders plain text content', () => {
    render(<InlineMarkdown content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    render(<InlineMarkdown content="This is **bold** text." />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('renders italic text', () => {
    render(<InlineMarkdown content="This is _italic_ text." />)
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('renders inline code', () => {
    render(<InlineMarkdown content="Use `len()` here." />)
    expect(screen.getByText('len()')).toBeInTheDocument()
  })

  it('renders without crashing when content is undefined', () => {
    render(<InlineMarkdown content={undefined} />)
  })
})
