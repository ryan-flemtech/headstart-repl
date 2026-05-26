import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherSessionControls from '../TeacherSessionControls'

function renderControls(overrides = {}) {
  const props = {
    session: { state: 'active', isPaused: false },
    isInSandbox: false,
    displayIndex: 1,
    taskCount: 3,
    links: {
      live: 'https://example.test/#/lesson/demo?live=true',
      solo: 'https://example.test/#/lesson/demo',
    },
    copiedLink: null,
    showSharePanel: false,
    onPreviousTask: vi.fn(),
    onNextTask: vi.fn(),
    onOpenPresentationWindow: vi.fn(),
    onToggleSharePanel: vi.fn(),
    onCloseSharePanel: vi.fn(),
    onCopyLink: vi.fn(),
    onStartSession: vi.fn(),
    onTogglePaused: vi.fn(),
    onEndSession: vi.fn(),
    onRestartSession: vi.fn(),
    ...overrides,
  }
  render(<TeacherSessionControls {...props} />)
  return props
}

describe('TeacherSessionControls', () => {
  it('renders task navigation and delegates navigation actions', () => {
    const props = renderControls()

    expect(screen.getByText('Task 2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Prev/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    expect(props.onPreviousTask).toHaveBeenCalledOnce()
    expect(props.onNextTask).toHaveBeenCalledOnce()
  })

  it('shows lesson links and delegates copy and dismissal actions', () => {
    const props = renderControls({ showSharePanel: true, copiedLink: 'live' })

    expect(screen.getByText(props.links.live)).toBeInTheDocument()
    expect(screen.getByText(props.links.solo)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copied!' }))
    fireEvent.click(document.querySelector('.teacher-share__overlay'))

    expect(props.onCopyLink).toHaveBeenCalledWith('live')
    expect(props.onCloseSharePanel).toHaveBeenCalledOnce()
  })

  it('shows and delegates the waiting-session action', () => {
    const props = renderControls({ session: { state: 'waiting' } })

    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(props.onStartSession).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument()
  })

  it('shows and delegates active-session actions', () => {
    const active = renderControls({ session: { state: 'active', isPaused: true } })

    fireEvent.click(screen.getByRole('button', { name: 'Resume Coding' }))
    fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

    expect(active.onTogglePaused).toHaveBeenCalledOnce()
    expect(active.onEndSession).toHaveBeenCalledOnce()
  })

  it('shows and delegates the ended-session action without task navigation in sandbox', () => {
    const props = renderControls({ session: { state: 'ended' }, isInSandbox: true })

    fireEvent.click(screen.getByRole('button', { name: 'Restart Session' }))

    expect(props.onRestartSession).toHaveBeenCalledOnce()
    expect(screen.queryByText('Task 2 / 3')).not.toBeInTheDocument()
  })
})
