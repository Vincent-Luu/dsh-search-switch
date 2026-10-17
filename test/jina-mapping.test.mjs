import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReaderRequest,
  buildSearchRequest,
  classifyJinaFailure,
  clipText,
  jinaErrorDetail,
  mapReaderResponse,
  mapSearchResponse,
  normaliseBaseURL,
  normaliseKeyMode,
  normaliseRespondWith,
  normaliseTargetSelector,
  normaliseTimeoutSeconds,
  splitSites,
} from '../lib/jina-mapping.js'

test('builds a form-encoded Reader POST that preserves fragments', () => {
  const built = buildReaderRequest({
    url: 'https://example.com/a/b?q=1#frag',
    readerURL: 'https://r.jina.ai/',
    engine: 'auto',
    timeoutSeconds: 20,
    retainImages: 'none',
    retainLinks: 'all',
    linksSummary: false,
    bypassCache: false,
  })
  assert.equal(built.endpoint, 'https://r.jina.ai/')
  assert.equal(built.init.method, 'POST')
  assert.equal(built.init.redirect, 'error')
  assert.equal(built.init.headers.accept, 'application/json')
  assert.equal(built.init.headers['content-type'], 'application/x-www-form-urlencoded')
  assert.match(built.init.headers['user-agent'], /^dsh-search-switch\//u)
  assert.equal(built.init.headers['x-timeout'], '20')
  assert.equal(built.init.headers['x-retain-images'], 'none')
  assert.equal(built.init.headers['x-retain-links'], 'all')
  assert.equal(built.init.headers['x-engine'], undefined)
  assert.equal(built.init.headers.authorization, undefined)
  assert.equal(built.init.headers['x-with-links-summary'], undefined)
  assert.equal(built.init.headers['x-no-cache'], undefined)
  const body = new URLSearchParams(built.init.body)
  assert.equal(body.get('url'), 'https://example.com/a/b?q=1#frag')
})

test('applies the optional Reader knobs and the configured key', () => {
  const built = buildReaderRequest({
    url: 'https://example.com',
    readerURL: 'https://reader.test',
    apiKey: 'jina_test',
    engine: 'browser',
    timeoutSeconds: 180,
    retainImages: 'alt',
    retainLinks: 'text',
    linksSummary: true,
    bypassCache: true,
  })
  assert.equal(built.endpoint, 'https://reader.test/')
  assert.equal(built.init.headers.authorization, 'Bearer jina_test')
  assert.equal(built.init.headers['x-engine'], 'browser')
  assert.equal(built.init.headers['x-timeout'], '180')
  assert.equal(built.init.headers['x-retain-images'], 'alt')
  assert.equal(built.init.headers['x-retain-links'], 'text')
  assert.equal(built.init.headers['x-with-links-summary'], 'true')
  assert.equal(built.init.headers['x-no-cache'], 'true')
})

test('rejects unusable Reader inputs', () => {
  assert.throws(() => buildReaderRequest({ url: '   ', readerURL: 'https://r.jina.ai' }), /non-empty URL/u)
  assert.throws(() => buildReaderRequest({ url: 'https://example.com', readerURL: 'not a url' }), /not a valid URL/u)
})

test('sends the readability bypass and target selector only when configured', () => {
  const plain = buildReaderRequest({ url: 'https://example.com', readerURL: 'https://reader.test' })
  assert.equal(plain.init.headers['x-respond-with'], undefined)
  assert.equal(plain.init.headers['x-target-selector'], undefined)

  const structured = buildReaderRequest({
    url: 'https://example.com',
    readerURL: 'https://reader.test',
    respondWith: 'markdown',
    targetSelector: '  #mw-content-text  ',
  })
  assert.equal(structured.init.headers['x-respond-with'], 'markdown')
  assert.equal(structured.init.headers['x-target-selector'], '#mw-content-text')

  // Unknown pipelines fall back to the frugal default, and blank selectors are dropped.
  const unknown = buildReaderRequest({
    url: 'https://example.com',
    readerURL: 'https://reader.test',
    respondWith: 'readerlm-v2',
    targetSelector: '   ',
  })
  assert.equal(unknown.init.headers['x-respond-with'], undefined)
  assert.equal(unknown.init.headers['x-target-selector'], undefined)
  assert.equal(normaliseRespondWith('markdown'), 'markdown')
  assert.equal(normaliseRespondWith(undefined), 'default')
  assert.equal(normaliseTargetSelector(' main '), 'main')
  assert.equal(normaliseTargetSelector(undefined), '')
})

test('builds an encoded Search GET with repeated site filters', () => {
  const built = buildSearchRequest({
    query: 'deepseek harness?',
    searchURL: 'https://s.jina.ai/',
    apiKey: 'jina_test',
    site: 'jina.ai, github.com',
  })
  assert.equal(built.init.method, 'GET')
  assert.equal(built.init.headers.authorization, 'Bearer jina_test')
  assert.equal(built.endpoint.startsWith('https://s.jina.ai/deepseek%20harness%3F?'), true)
  const params = new URLSearchParams(built.endpoint.split('?')[1])
  assert.deepEqual(params.getAll('site'), ['jina.ai', 'github.com'])
})

test('Search requires a key and a query', () => {
  assert.throws(() => buildSearchRequest({ query: 'q', searchURL: 'https://s.jina.ai' }), /API key/u)
  assert.throws(
    () => buildSearchRequest({ query: ' ', searchURL: 'https://s.jina.ai', apiKey: 'k' }),
    /non-empty query/u,
  )
})

test('normalises endpoints, timeouts, and key modes', () => {
  assert.equal(normaliseBaseURL('  https://r.jina.ai///  ', 'https://fallback'), 'https://r.jina.ai')
  assert.equal(normaliseBaseURL('not a url', 'https://fallback'), undefined)
  assert.equal(normaliseTimeoutSeconds(undefined), 20)
  assert.equal(normaliseTimeoutSeconds(0), 1)
  assert.equal(normaliseTimeoutSeconds(999), 180)
  assert.equal(normaliseKeyMode('auto'), 'auto')
  assert.equal(normaliseKeyMode('bogus'), 'anonymous')
  assert.deepEqual(splitSites(['a.com', ' a.com ', ''], undefined), ['a.com'])
  assert.deepEqual(splitSites('a.com,b.com'), ['a.com', 'b.com'])
  assert.equal(clipText('abcdef', 3), 'abc')
  assert.equal(clipText('abcdef', 0), 'abcdef')
})

test('maps the Reader JSON envelope', () => {
  const mapped = mapReaderResponse({
    code: 200,
    status: 20000,
    data: { title: 'Title', url: 'https://example.com/', content: '  body  ' },
  })
  assert.deepEqual(mapped, { content: 'body', url: 'https://example.com/', title: 'Title' })

  assert.equal(mapReaderResponse({ code: 200, data: { content: '   ' } }), undefined)
  assert.equal(mapReaderResponse({ code: 403, data: { content: 'x' } }), undefined)
  assert.equal(mapReaderResponse({ code: 200, data: null }), undefined)
  assert.equal(mapReaderResponse(null), undefined)
})

test('maps Search JSON in both documented shapes and clips snippets', () => {
  const list = mapSearchResponse({
    code: 200,
    data: [
      { title: 'A', url: 'https://a.test', description: ' described ', content: 'full page' },
      { url: 'https://b.test', content: 'only content' },
      { url: 'https://c.test' },
      { title: 'no url' },
    ],
  }, { snippetMaxChars: 10 })
  assert.equal(list.truncated, false)
  assert.equal(list.sources.length, 2)
  assert.deepEqual(list.sources[0], { url: 'https://a.test', snippet: 'described', title: 'A' })
  assert.deepEqual(list.sources[1], { url: 'https://b.test', snippet: 'only conte' })

  const single = mapSearchResponse({ code: 200, data: { url: 'https://d.test', content: 'x' } })
  assert.deepEqual(single.sources, [{ url: 'https://d.test', snippet: 'x' }])

  const published = mapSearchResponse({
    code: 200,
    data: [{ url: 'https://e.test', content: 'x', published_time: '2026-01-01' }],
  })
  assert.equal(published.sources[0].publishedAt, '2026-01-01')

  assert.deepEqual(mapSearchResponse({ code: 401, data: null }).sources, [])
  assert.deepEqual(mapSearchResponse(undefined).sources, [])
})

test('extracts and classifies Jina failures', () => {
  assert.equal(jinaErrorDetail({ message: ' boom ' }), 'boom')
  assert.equal(jinaErrorDetail({ readableMessage: 'readable' }), 'readable')
  assert.equal(jinaErrorDetail({ error: 'err' }), 'err')
  assert.equal(jinaErrorDetail(null), '')

  assert.deepEqual(classifyJinaFailure(401, { name: 'AuthenticationRequiredError' }), {
    code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
    kind: 'auth-missing',
  })
  assert.deepEqual(classifyJinaFailure(401, { name: 'AuthenticationFailedError' }), {
    code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
    kind: 'auth-invalid',
  })
  assert.deepEqual(classifyJinaFailure(401, undefined), {
    code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
    kind: 'auth-invalid',
  })
  assert.equal(classifyJinaFailure(403, { name: 'LocalhostAccessError' }).kind, 'blocked')
  assert.equal(classifyJinaFailure(429, undefined).kind, 'rate-limit')
  assert.deepEqual(classifyJinaFailure(500, undefined), { code: 'WEB_PROVIDER_ERROR', kind: 'provider' })
})
