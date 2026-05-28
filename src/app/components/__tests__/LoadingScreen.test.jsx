import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LoadingScreen from '../LoadingScreen'

describe('LoadingScreen', () => {
  it('renders the message prop', () => {
    render(<LoadingScreen message="Loading…" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders a custom message', () => {
    render(<LoadingScreen message='Lesson "demo" not found.' />)
    expect(screen.getByText('Lesson "demo" not found.')).toBeInTheDocument()
  })

  it('applies the sv-centre-screen class', () => {
    const { container } = render(<LoadingScreen message="Loading…" />)
    expect(container.firstChild).toHaveClass('sv-centre-screen')
  })
})
