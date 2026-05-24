import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TaskProgressDots from '../TaskProgressDots'

// Force desktop mode so we always render the dot buttons (not the "x/y" counter).
// The setup.js matchMedia mock already returns matches:false, and useIsMobile
// initialises from window.innerWidth, so we set it wide here.
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1280,
  })
})

// Three simple standalone tasks used across most tests
const THREE_TASKS = [
  { id: 1, title: 'Task One',   type: 'task' },
  { id: 2, title: 'Task Two',   type: 'task' },
  { id: 3, title: 'Task Three', type: 'task' },
]

describe('TaskProgressDots', () => {
  describe('dot count', () => {
    it('renders the correct number of dots for standalone tasks', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          onDotClick={vi.fn()}
        />,
      )
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })

    it('renders one dot per group (not per subtask)', () => {
      const tasks = [
        {
          id: 'g1',
          type: 'group',
          title: 'Group A',
          subtasks: [
            { id: 1, title: 'Group A - 1', type: 'task' },
            { id: 2, title: 'Group A - 2', type: 'task' },
          ],
        },
        { id: 3, title: 'Solo Task', type: 'task' },
      ]
      render(
        <TaskProgressDots
          tasks={tasks}
          currentTaskId={1}
          onDotClick={vi.fn()}
        />,
      )
      expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    it('renders nothing (no buttons) when tasks is empty', () => {
      render(
        <TaskProgressDots
          tasks={[]}
          currentTaskId={null}
          onDotClick={vi.fn()}
        />,
      )
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })
  })

  describe('current task highlight', () => {
    it('shows the task number on the current dot (not a checkmark)', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={2}
          onDotClick={vi.fn()}
        />,
      )
      // The current task shows its 1-based index (2), not a checkmark
      const buttons = screen.getAllByRole('button')
      // Button at index 1 (0-based) is task 2
      expect(buttons[1]).toHaveTextContent('2')
    })

    it('shows a checkmark on past task dots', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={3}
          onDotClick={vi.fn()}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // Tasks 1 and 2 are past — both should show ✓
      expect(buttons[0]).toHaveTextContent('✓')
      expect(buttons[1]).toHaveTextContent('✓')
    })

    it('shows the index number on future task dots', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          onDotClick={vi.fn()}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // Task 3 is in the future — shows index 3
      expect(buttons[2]).toHaveTextContent('3')
    })
  })

  describe('past task dots are clickable', () => {
    it('calls onDotClick with the task id when a past dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={3}
          onDotClick={onDotClick}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // First button is task id 1 (past)
      await user.click(buttons[0])
      expect(onDotClick).toHaveBeenCalledWith(1)
    })

    it('calls onDotClick with the correct id when each past dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={3}
          onDotClick={onDotClick}
        />,
      )
      const buttons = screen.getAllByRole('button')
      await user.click(buttons[1])
      expect(onDotClick).toHaveBeenCalledWith(2)
    })
  })

  describe('future/locked task dots are not clickable', () => {
    it('future dots are disabled when isSolo is false', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={false}
          onDotClick={vi.fn()}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // Task 3 is future and should be disabled
      expect(buttons[2]).toBeDisabled()
    })

    it('does not call onDotClick when a disabled future dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={false}
          onDotClick={onDotClick}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // Click the last (future/disabled) button
      await user.click(buttons[2])
      expect(onDotClick).not.toHaveBeenCalled()
    })

    it('future dots are enabled in solo mode by default', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={true}
          onDotClick={vi.fn()}
        />,
      )
      const buttons = screen.getAllByRole('button')
      // In solo mode, future dots are clickable (not disabled)
      expect(buttons[2]).not.toBeDisabled()
    })

    it('uses canSelectTask to determine whether a solo future dot is clickable', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      // canSelectTask returns false for task 3
      const canSelectTask = (taskId) => taskId !== 3
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={true}
          canSelectTask={canSelectTask}
          onDotClick={onDotClick}
        />,
      )
      const buttons = screen.getAllByRole('button')
      expect(buttons[2]).toBeDisabled()
      await user.click(buttons[2])
      expect(onDotClick).not.toHaveBeenCalled()
    })
  })

  describe('title / aria-label', () => {
    it('sets aria-label on each dot to the task title', () => {
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          onDotClick={vi.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Task One' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Task Two' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Task Three' })).toBeInTheDocument()
    })
  })

  describe('mobile counter view', () => {
    it('renders a text counter instead of dots when viewport is narrow', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      render(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={2}
          onDotClick={vi.fn()}
        />,
      )
      // In mobile mode the hook returns true → a "x/y" counter is rendered
      // There should be no individual dot buttons
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTitle('Task progress')).toBeInTheDocument()
    })
  })
})
