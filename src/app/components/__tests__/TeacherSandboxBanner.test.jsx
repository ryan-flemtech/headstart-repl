import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherSandboxBanner from '../TeacherSandboxBanner'

function renderBanner(overrides = {}) {
  const props = {
    staging: true,
    isScratch: false,
    onCancel: vi.fn(),
    onReset: vi.fn(),
    onGoLive: vi.fn(),
    onPushScratch: vi.fn(),
    onDeactivate: vi.fn(),
    ...overrides,
  }
  render(<TeacherSandboxBanner {...props} />)
  return props
}

describe('TeacherSandboxBanner — staging mode', () => {
  it('shows staging message', () => {
    renderBanner({ staging: true })
    expect(screen.getByText(/Sandbox preview — students are still on the lesson/)).toBeInTheDocument()
  })

  it('renders Cancel, Reset and Go Live buttons', () => {
    renderBanner({ staging: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to Sandbox Starter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Go Live/i })).toBeInTheDocument()
  })

  it('does not render Deactivate or Push to All in staging mode', () => {
    renderBanner({ staging: true, isScratch: true })
    expect(screen.queryByRole('button', { name: 'Deactivate Sandbox' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Push to All' })).not.toBeInTheDocument()
  })

  it('calls onCancel, onReset and onGoLive', () => {
    const props = renderBanner({ staging: true })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Sandbox Starter' }))
    fireEvent.click(screen.getByRole('button', { name: /Go Live/i }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onGoLive).toHaveBeenCalledOnce()
  })
})

describe('TeacherSandboxBanner — live mode', () => {
  it('shows live message', () => {
    renderBanner({ staging: false })
    expect(screen.getByText(/Sandbox is LIVE/)).toBeInTheDocument()
  })

  it('renders Reset and Deactivate buttons', () => {
    renderBanner({ staging: false })
    expect(screen.getByRole('button', { name: 'Reset to Sandbox Starter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate Sandbox' })).toBeInTheDocument()
  })

  it('shows Push to All only for Scratch', () => {
    const { rerender } = render(<TeacherSandboxBanner staging={false} isScratch={false} onCancel={vi.fn()} onReset={vi.fn()} onGoLive={vi.fn()} onPushScratch={vi.fn()} onDeactivate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Push to All' })).not.toBeInTheDocument()

    rerender(<TeacherSandboxBanner staging={false} isScratch={true} onCancel={vi.fn()} onReset={vi.fn()} onGoLive={vi.fn()} onPushScratch={vi.fn()} onDeactivate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Push to All' })).toBeInTheDocument()
  })

  it('calls onReset, onPushScratch and onDeactivate', () => {
    const props = renderBanner({ staging: false, isScratch: true })
    fireEvent.click(screen.getByRole('button', { name: 'Push to All' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Sandbox Starter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Sandbox' }))
    expect(props.onPushScratch).toHaveBeenCalledOnce()
    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onDeactivate).toHaveBeenCalledOnce()
  })
})
