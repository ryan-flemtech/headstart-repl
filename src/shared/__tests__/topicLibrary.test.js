import { describe, expect, it } from 'vitest'
import {
  expandTopicLinks,
  findTopicSuggestion,
  normalizeTopicLibrary,
  parseTopicHref,
  searchTopics,
  topicHref,
} from '../topicLibrary'

const topics = normalizeTopicLibrary({
  topics: [
    {
      id: 'for-loop',
      title: 'For loops',
      types: ['python'],
      category: 'Loop',
      summary: 'Repeat code.',
      aliases: ['for loop'],
    },
    {
      id: 'selectors',
      title: 'CSS selectors',
      types: ['html'],
      category: 'CSS',
      summary: 'Choose elements.',
      aliases: ['selector'],
    },
  ],
})

describe('topic library utilities', () => {
  it('normalizes valid topic records and ignores invalid entries', () => {
    expect(normalizeTopicLibrary({ topics: [{ id: 'print', title: 'print()' }, { id: '', title: 'Missing' }] }))
      .toEqual([expect.objectContaining({ id: 'print', title: 'print()', aliases: [], related: [] })])
  })

  it('searches titles, aliases and descriptions', () => {
    expect(searchTopics(topics, 'selector').map(topic => topic.id)).toEqual(['selectors'])
    expect(searchTopics(topics, 'repeat').map(topic => topic.id)).toEqual(['for-loop'])
  })

  it('expands wiki topic links while leaving code examples unchanged', () => {
    const content = 'Read [[for-loop]] or `[[for-loop]]`.\n```\n[[selectors]]\n```'
    expect(expandTopicLinks(content, topics))
      .toBe('Read [For loops](#topic/for-loop) or `[[for-loop]]`.\n```\n[[selectors]]\n```')
  })

  it('round trips topic link fragments', () => {
    expect(parseTopicHref(topicHref('for-loop'))).toBe('for-loop')
  })

  it('suggests an unlinked topic mention for builder authors', () => {
    expect(findTopicSuggestion('Use a for loop to repeat this.', topics))
      .toEqual(expect.objectContaining({ label: 'for loop', topic: expect.objectContaining({ id: 'for-loop' }) }))
    expect(findTopicSuggestion('Use [[for-loop|a for loop]] here.', topics)).toBeNull()
  })
})
