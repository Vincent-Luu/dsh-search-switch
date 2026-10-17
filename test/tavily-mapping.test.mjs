import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TAVILY_MAX_RESULTS_LIMIT,
  buildTavilyRequest,
  extractTavilyErrorDetail,
  mapTavilyResponse,
  normaliseChunksPerSource,
  normaliseMaxResults,
  tavilyErrorMessage,
} from '../lib/tavily-mapping.js'

test('maps results, answer, and published date into the seam shape', () => {
  const result = mapTavilyResponse({
    answer: '  DeepSeek Harness is a plugin host.  ',
    results: [
      {
        title: 'Docs',
        url: 'https://example.com/docs',
        content: '  snippet text  ',
        published_date: 'Tue, 11 Mar 2025 17:00:00 GMT',
      },
      { title: 'No snippet', url: 'https://example.com/blank', content: '   ' },
      { title: 'No url', content: 'orphan' },
      null,
    ],
  })
  assert.deepEqual(result, {
    content: 'DeepSeek Harness is a plugin host.',
    sources: [
      {
        url: 'https://example.com/docs',
        title: 'Docs',
        snippet: 'snippet text',
        publishedAt: 'Tue, 11 Mar 2025 17:00:00 GMT',
      },
    ],
    truncated: false,
  })
})

test('omits the answer when Tavily returns none', () => {
  const result = mapTavilyResponse({ results: [] })
  assert.deepEqual(result, { sources: [], truncated: false })
})

test('builds the documented basic request body', () => {
  const body = buildTavilyRequest({ query: 'deepseek harness' })
  assert.deepEqual(body, {
    query: 'deepseek harness',
    search_depth: 'basic',
    topic: 'general',
    include_answer: false,
    chunks_per_source: 3,
    include_published_date: true,
  })
})

test('advanced keeps chunks_per_source and 2-credit depth', () => {
  const body = buildTavilyRequest({
    query: 'q',
    searchDepth: 'advanced',
    topic: 'news',
    answer: 'advanced',
    chunksPerSource: 2,
    includePublishedDate: false,
    maxResults: 7,
  })
  assert.deepEqual(body, {
    query: 'q',
    search_depth: 'advanced',
    topic: 'news',
    include_answer: 'advanced',
    chunks_per_source: 2,
    max_results: 7,
  })
})

test('ultra-fast omits chunks_per_source and unknown values fall back', () => {
  const body = buildTavilyRequest({
    query: 'q',
    searchDepth: 'ultra-fast',
    topic: 'nonsense',
    answer: 'nonsense',
  })
  assert.equal(body.search_depth, 'ultra-fast')
  assert.equal(body.topic, 'general')
  assert.equal(body.include_answer, false)
  assert.equal('chunks_per_source' in body, false)
})

test('clamps max_results to 0..20 and chunks to 1..3', () => {
  assert.equal(normaliseMaxResults(undefined), undefined)
  assert.equal(normaliseMaxResults('7'), undefined)
  assert.equal(normaliseMaxResults(-3), 0)
  assert.equal(normaliseMaxResults(99), TAVILY_MAX_RESULTS_LIMIT)
  assert.equal(normaliseMaxResults(6.8), 6)
  assert.equal(normaliseChunksPerSource(0), 1)
  assert.equal(normaliseChunksPerSource(9), 3)
  assert.equal(normaliseChunksPerSource(undefined), 3)
})

test('reads the 422 validation-error array', () => {
  const detail = extractTavilyErrorDetail({
    detail: [
      { loc: ['body', 'query'], msg: 'Input should be a valid string' },
      { loc: ['body', 'topic'], msg: "Invalid topic. Must be 'general', 'news' or 'finance'." },
    ],
  })
  assert.equal(
    detail,
    "body.query: Input should be a valid string; body.topic: Invalid topic. Must be 'general', 'news' or 'finance'.",
  )
})

test('reads the plain API error envelope', () => {
  assert.equal(extractTavilyErrorDetail({ detail: { error: 'Unauthorized: missing or invalid API key.' } }),
    'Unauthorized: missing or invalid API key.')
  assert.equal(extractTavilyErrorDetail({ detail: 'busy' }), 'busy')
  assert.equal(extractTavilyErrorDetail({ error: 'nope' }), 'nope')
  assert.equal(extractTavilyErrorDetail('plain text'), 'plain text')
  assert.equal(extractTavilyErrorDetail({}), undefined)
  assert.equal(extractTavilyErrorDetail(null), undefined)
})

test('composes HTTP errors with detail and Retry-After', () => {
  assert.equal(
    tavilyErrorMessage(429, { detail: { error: 'rate limited' } }, '60'),
    'Tavily API error (HTTP 429): rate limited (Retry-After: 60s)',
  )
  assert.equal(tavilyErrorMessage(500, undefined, null), 'Tavily API error (HTTP 500)')
  assert.equal(tavilyErrorMessage(401, {}, '5'), 'Tavily API error (HTTP 401)')
})
