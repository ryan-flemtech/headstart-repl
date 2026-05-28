import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import JoinChoiceScreen from '../JoinChoiceScreen'

function renderScreen(overrides = {}) {
  const props = {
    lessonTitle: 'My Lesson',
    sessionExists: false,
    sessionEnded: false,
    onWait: vi.fn(),
    onSolo: vi.fn(),
    ...overrides,
  }
  render(<JoinChoiceScreen {...props} />)
  return props
}

describe('JoinChoiceScreen', () => {
  it('renders the lesson title', () => {
    renderScreen({ lessonTitle: 'Intro to Python' })
    expect(screen.getByRole('heading', { name: 'Intro to Python' })).toBeInTheDocument()
  })

  it('shows "No session is active yet" when sessionExists is false and not ended', () => {
    renderScreen({ sessionExists: false, sessionEnded: false })
    expect(screen.getByText('No session is active yet.')).toBeInTheDocument()
  })

  it('shows "teacher is setting up" when sessionExists is true and not ended', () => {
    renderScreen({ sessionExists: true, sessionEnded: false })
    expect(screen.getByText('Your teacher is setting up the session.')).toBeInTheDocument()
  })

  it('shows "session has ended" when sessionEnded is true', () => {
    renderScreen({ sessionEnded: true })
    expect(screen.getByText('The session has ended.')).toBeInTheDocument()
  })

  it('sessionEnded message takes precedence over sessionExists', () => {
    renderScreen({ sessionExists: true, sessionEnded: true })
    expect(screen.getByText('The session has ended.')).toBeInTheDocument()
    expect(screen.queryByText('Your teacher is setting up the session.')).not.toBeInTheDocument()
  })

  it('calls onWait when "Wait for Teacher" is clicked', () => {
    const props = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Wait for Teacher' }))
    expect(props.onWait).toHaveBeenCalledOnce()
  })

  it('calls onSolo when "Work Solo instead" is clicked', () => {
    const props = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Work Solo instead' }))
    expect(props.onSolo).toHaveBeenCalledOnce()
  })

  it('renders the "What would you like to do?" sub-prompt', () => {
    renderScreen()
    expect(screen.getByText('What would you like to do?')).toBeInTheDocument()
  })
})
