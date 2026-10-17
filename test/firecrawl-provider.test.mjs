import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { createFirecrawlProvider } from '../lib/firecrawl-provider.js'

/** Minimal stand-in for the seam's WebError. */
class FakeWebError extends Error {
  constructor(message, code, options) {
    super(message, options)
    this.code = code
  }
}

/**
 * Run a provider test against a loopback HTTP double.
 * @param handler - the request handler.
 * @param run - the assertions, receiving the base URL.
 */
async function withServer(handler, run) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}`
  try {
    await run(baseURL)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/** Read and parse one JSON request body, so the socket drains. */
function readJson(request) {
  return new Promise((resolve) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(undefined)
      }
    })
  })
}

/** Build a provider over one loopback base URL. */
function makeProvider(baseURL, overrides = {}) {
  return createFirecrawlProvider({
    WebError: FakeWebError,
    options: () => ({
      apiKey: overrides.apiKey,
      apiKeyEnv: 'FIRECRAWL_API_KEY',
      baseURL,
      proxy: 'auto',
      onlyMainContent: true,
      timeoutMs: 20000,
      maxAgeMs: 172800000,
      waitFor: 0,
      blockAds: true,
      searchScrape: false,
      maxChars: overrides.maxChars,
      snippetMaxChars: overrides.snippetMaxChars,
    }),
  })
}

test('scrapes through the API and returns markdown text', async () => {
  let seen
  await withServer(async (request, response) => {
    seen = { method: request.method, url: request.url, headers: request.headers, body: await readJson(request) }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      success: true,
      data: {
        markdown: '# Page\n\nbody',
        metadata: { title: 'Page', sourceURL: 'https://example.com/final', statusCode: 200 },
      },
    }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    const result = await provider.fetch({ url: 'https://example.com' })

    assert.equal(seen.method, 'POST')
    assert.equal(seen.url, '/v2/scrape')
    assert.equal(seen.headers.authorization, undefined)
    assert.deepEqual(seen.body, {
      url: 'https://example.com',
      formats: ['markdown'],
      onlyMainContent: true,
      proxy: 'auto',
      timeout: 20000,
      maxAge: 172800000,
      blockAds: true,
      removeBase64Images: true,
    })
    assert.equal(result.url, 'https://example.com/final')
    assert.equal(result.statusCode, 200)
    assert.deepEqual(result.body, { kind: 'text', content: '# Page\n\nbody' })
    assert.equal(result.truncated, false)
    assert.equal(provider.id, 'firecrawl')
    assert.equal(provider.available(), true)
  })
})

test('sends the bearer key when one is configured and truncates output', async () => {
  let authorization
  await withServer(async (request, response) => {
    authorization = request.headers.authorization
    await readJson(request)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: true, data: { markdown: '0123456789', metadata: {} } }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL, { apiKey: 'fc-test', maxChars: 5 })
    const result = await provider.fetch({ url: 'https://example.com' })
    assert.equal(authorization, 'Bearer fc-test')
    assert.equal(result.body.content, '01234')
    assert.equal(result.truncated, true)
    assert.equal(result.url, 'https://example.com')
  })
})

test('search maps the web list and forwards the requested bound', async () => {
  let body
  await withServer(async (request, response) => {
    body = await readJson(request)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      success: true,
      data: {
        web: [
          { url: 'https://a.test', title: 'A', description: 'highlight' },
          { url: 'https://b.test', markdown: 'full page' },
        ],
      },
    }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    const result = await provider.search({ query: 'deepseek', maxResults: 2 })
    assert.equal(body.limit, 2)
    assert.deepEqual(result.sources, [
      { url: 'https://a.test', snippet: 'highlight', title: 'A' },
      { url: 'https://b.test', snippet: 'full page' },
    ])
  })
})

test('402 credits and 429 rate limits carry repair guidance', async () => {
  await withServer(async (request, response) => {
    const body = await readJson(request)
    if (body.url === 'https://credits.test') {
      response.writeHead(402, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: false, error: 'Payment required to access this resource.', code: 'insufficient_credits' }))
      return
    }
    response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '30' })
    response.end(JSON.stringify({ error: 'Request rate limit exceeded. Please wait and try again later.' }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    await assert.rejects(provider.fetch({ url: 'https://credits.test' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /HTTP 402/u)
      assert.match(error.message, /insufficient credits/u)
      return true
    })
    await assert.rejects(provider.fetch({ url: 'https://slow.test' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /HTTP 429/u)
      assert.match(error.message, /Retry-After: 30s/u)
      assert.match(error.message, /FIRECRAWL_API_KEY/u)
      return true
    })
  })
})

test('a rejected key surfaces the credential code', async () => {
  await withServer(async (request, response) => {
    await readJson(request)
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL, { apiKey: 'fc-bad' })
    await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      assert.match(error.message, /rejected the configured FIRECRAWL_API_KEY/u)
      return true
    })
  })
})

test('an HTTP 200 with success:false is a failure, not an empty page', async () => {
  await withServer(async (request, response) => {
    await readJson(request)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: false, error: 'Request timed out', code: 'UNKNOWN_ERROR' }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /Request timed out/u)
      return true
    })
  })
})

test('an already-aborted signal never dispatches', async () => {
  let called = false
  const provider = createFirecrawlProvider({
    WebError: FakeWebError,
    fetchImpl: () => { called = true; throw new Error('must not run') },
    options: () => ({ baseURL: 'https://api.firecrawl.dev' }),
  })
  const controller = new AbortController()
  controller.abort(new Error('user cancelled'))
  await assert.rejects(provider.fetch({ url: 'https://example.com' }, controller.signal), (error) => {
    assert.equal(error.code, 'WEB_ABORTED')
    return true
  })
  assert.equal(called, false)
})

test('transport failures name the endpoint', async () => {
  const provider = createFirecrawlProvider({
    WebError: FakeWebError,
    fetchImpl: () => Promise.reject(new Error('socket closed')),
    options: () => ({ baseURL: 'https://api.firecrawl.test' }),
  })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR')
    assert.match(error.message, /socket closed/u)
    assert.match(error.message, /https:\/\/api\.firecrawl\.test\/v2\/scrape/u)
    return true
  })
})
