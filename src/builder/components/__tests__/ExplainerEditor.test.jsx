import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownFieldEditor } from '../ExplainerEditor'

function ControlledEditor() {
  const [value, setValue] = useState('Use a for loop to repeat the code.')
  return <MarkdownFieldEditor value={value} onChange={setValue} lessonType="python" />
}

describe('MarkdownFieldEditor topic library links', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        topics: [{
          id: 'for-loop',
          title: 'For loops',
          types: ['python'],
          category: 'Loop',
          summary: 'Repeat code.',
          aliases: ['for loop'],
          related: [],
        }],
      }),
    }))
  })

  it('offers to link a detected topic mention in author text', async () => {
    const user = userEvent.setup()
    render(<ControlledEditor />)

    await user.click(await screen.findByRole('button', { name: 'Link to For loops' }))

    expect(screen.getByRole('textbox')).toHaveValue('Use a [[for-loop|for loop]] to repeat the code.')
  })
})
