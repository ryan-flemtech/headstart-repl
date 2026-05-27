import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherPreviewBanner from '../TeacherPreviewBanner'

function renderBanner(overrides = {}) {
  const props = {
    taskNumber: 3,
    taskTitle: 'Variables',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(<TeacherPreviewBanner {...props} />)
  return props
}

describe('TeacherPreviewBanner', () => {
  it('shows task number and title', () => {
    renderBanner()
    expect(screen.getByText(/Preview — Task 3: Variables/)).toBeInTheDocument()
  })

  it('uses empty string when taskTitle is undefined', () => {
    renderBanner({ taskTitle: undefined })
    expect(screen.getByText(/Preview — Task 3:/)).toBeInTheDocument()
  })

  it('calls onCancel when back button is clicked', () => {
    const props = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Current Task' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when move button is clicked', () => {
    const props = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Move All to This Task' }))
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })
})
