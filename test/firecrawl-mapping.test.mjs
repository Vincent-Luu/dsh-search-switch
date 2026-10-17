import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildScrapeRequest,
  buildSearchRequest,
  classifyFirecrawlFailure,
  clipText,
  firecrawlErrorDetail,
  mapScrapeResponse,
  mapSearchResponse,
  normaliseBaseURL,
  normaliseSearchLimit,
  normaliseTimeoutMs,
} from '../lib/firecrawl-mapping.js'

test('builds the documented scrape body without a key', () => {
  const built = buildScrapeRequest({
    url: 'https://example.com',
    baseURL: 'https://api.firecrawl.dev/',
    onlyMainContent: true,
    proxy: 'auto',
    timeoutMs: 20000,
    maxAgeMs: 172800000,
    waitFor: 0,
    blockAds: true,
  })
  assert.equal(built.endpoint, 'https://api.firecrawl.dev/v2/scrape')
  assert.equal(built.init.method, 'POST')
  assert.equal(built.init.redirect, 'error')
  assert.equal(built.init.headers.authorization, undefined)
  assert.equal(built.init.headers.accept, 'application/json')
  assert.match(built.init.headers['user-agent'], /^dsh-search-switch\//u)
  assert.deepEqual(JSON.parse(built.init.body), {
    url: 'https://example.com',
    formats: ['markdown'],
    onlyMainContent: true,
    proxy: 'auto',
    timeout: 20000,
    maxAge: 172800000,
    blockAds: true,
    removeBase64Images: true,
  })
})

test('adds the bearer key, waitFor, and clamps the bounds', () => {
  const built = buildScrapeRequest({
    url: 'https://example.com',
    baseURL: 'https://api.firecrawl.dev',
    apiKey: 'fc-test',
    onlyMainContent: false,
    proxy: 'enhanced',
    timeoutMs: 999999,
    maxAgeMs: -5,
    waitFor: 999999,
    blockAds: false,
  })
  const body = JSON.parse(built.init.body)
  assert.equal(built.init.headers.authorization, 'Bearer fc-test')
  assert.equal(body.onlyMainContent, false)
  assert.equal(body.proxy, 'enhanced')
  assert.equal(body.timeout, 25000)
  assert.equal(body.maxAge, 0)
  assert.equal(body.waitFor, 20000)
  assert.equal(body.blockAds, false)
})

test('rejects unusable scrape inputs', () => {
  assert.throws(() => buildScrapeRequest({ url: ' ', baseURL: 'https://api.firecrawl.dev' }), /non-empty URL/u)
  assert.throws(() => buildScrapeRequest({ url: 'https://example.com', baseURL: 'nope' }), /not a valid URL/u)
})

test('maps the scrape envelope to markdown and the effective URL', () => {
  const mapped = mapScrapeResponse({
    success: true,
    data: {
      markdown: '# Title\n\nbody',
      metadata: { title: 'Title', sourceURL: 'https://example.com/final', statusCode: 200 },
    },
  }, 'https://example.com')
  assert.deepEqual(mapped, {
    markdown: '# Title\n\nbody',
    url: 'https://example.com/final',
    statusCode: 200,
    title: 'Title',
  })

  const fallback = mapScrapeResponse({ success: true, data: { markdown: 'x', metadata: {} } }, 'https://example.com/in')
  assert.equal(fallback.url, 'https://example.com/in')
  assert.equal(fallback.statusCode, 200)

  assert.equal(mapScrapeResponse({ success: false, error: 'bad' }, 'https://example.com'), undefined)
  assert.equal(mapScrapeResponse({ success: true, data: { markdown: '  ' } }, 'https://example.com'), undefined)
  assert.equal(mapScrapeResponse(null, 'https://example.com'), undefined)
})

test('builds the search body with the request bound and optional scraping', () => {
  const plain = buildSearchRequest({
    query: 'deepseek harness',
    maxResults: 3,
    baseURL: 'https://api.firecrawl.dev',
    timeoutMs: 20000,
    scrape: false,
    onlyMainContent: true,
  })
  assert.equal(plain.endpoint, 'https://api.firecrawl.dev/v2/search')
  assert.equal(plain.init.headers.authorization, undefined)
  assert.deepEqual(JSON.parse(plain.init.body), {
    query: 'deepseek harness',
    limit: 3,
    sources: ['web'],
    timeout: 20000,
  })

  const scraped = buildSearchRequest({
    query: 'q',
    baseURL: 'https://api.firecrawl.dev',
    apiKey: 'fc-test',
    timeoutMs: 5000,
    scrape: true,
    onlyMainContent: false,
  })
  assert.equal(scraped.init.headers.authorization, 'Bearer fc-test')
  assert.deepEqual(JSON.parse(scraped.init.body).scrapeOptions, {
    formats: ['markdown'],
    onlyMainContent: false,
  })
})

test('normalises the search bound, timeout, and base URL', () => {
  assert.equal(normaliseSearchLimit(undefined), 8)
  assert.equal(normaliseSearchLimit(2), 2)
  assert.equal(normaliseSearchLimit(0), 1)
  assert.equal(normaliseSearchLimit(500), 100)
  assert.equal(normaliseTimeoutMs(undefined), 20000)
  assert.equal(normaliseTimeoutMs(1), 1000)
  assert.equal(normaliseTimeoutMs(999999), 25000)
  assert.equal(normaliseBaseURL(' https://api.firecrawl.dev/// ', 'https://fallback'), 'https://api.firecrawl.dev')
  assert.equal(normaliseBaseURL('nowhere', 'https://fallback'), undefined)
  assert.equal(clipText('abcdef', 2), 'ab')
})

test('maps search results preferring description and clipping', () => {
  const result = mapSearchResponse({
    success: true,
    data: {
      web: [
        { url: 'https://a.test', title: 'A', description: ' highlight ', markdown: 'page' },
        { url: 'https://b.test', markdown: 'page body' },
        { url: 'https://c.test' },
        { title: 'no url' },
      ],
    },
  }, { snippetMaxChars: 6 })
  assert.equal(result.truncated, false)
  assert.deepEqual(result.sources, [
    { url: 'https://a.test', snippet: 'highli', title: 'A' },
    { url: 'https://b.test', snippet: 'page b' },
  ])

  assert.deepEqual(mapSearchResponse({ success: false }).sources, [])
  assert.deepEqual(mapSearchResponse(null).sources, [])
})

test('extracts and classifies Firecrawl failures', () => {
  assert.equal(firecrawlErrorDetail({ error: ' boom ' }), 'boom')
  assert.equal(firecrawlErrorDetail({ message: 'msg' }), 'msg')
  assert.equal(firecrawlErrorDetail('text'), '')

  assert.deepEqual(classifyFirecrawlFailure(401, { error: 'Unauthorized: Invalid token' }), {
    code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
    kind: 'auth-invalid',
  })
  assert.equal(classifyFirecrawlFailure(402, { code: 'insufficient_credits' }).kind, 'credits')
  assert.equal(classifyFirecrawlFailure(429, { error: 'Request rate limit exceeded.' }).kind, 'rate-limit')
  assert.equal(classifyFirecrawlFailure(403, { code: 'THIRD_PARTY_DATA_TERMS_REQUIRED' }).kind, 'terms')
  assert.deepEqual(classifyFirecrawlFailure(500, { error: 'boom' }), {
    code: 'WEB_PROVIDER_ERROR',
    kind: 'provider',
  })
})
