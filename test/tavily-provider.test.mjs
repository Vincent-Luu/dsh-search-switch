import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { createTavilyProvider } from '../lib/tavily-provider.js'

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
  const address = server.address()
  const baseURL = `http://127.0.0.1:${address.port}`
  try {
    await run(baseURL)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/** Read and parse one request body. */
function readJson(request) {
  return new Promise((resolve) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => resolve(JSON.parse(raw)))
  })
}

test('posts the documented body, bearer auth, and user agent', async () => {
  let seen
  await withServer(async (request, response) => {
    seen = {
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      userAgent: request.headers['user-agent'],
      contentType: request.headers['content-type'],
      body: await readJson(request),
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      answer: 'answer text',
      results: [{
        title: 'Result',
        url: 'https://example.com/r',
        content: ' snippet ',
        published_date: 'Tue, 11 Mar 2025 17:00:00 GMT',
      }],
    }))
  }, async (baseURL) => {
    const provider = createTavilyProvider({
      WebError: FakeWebError,
      options: () => ({
        apiKey: 'tvly-test',
        baseURL,
        searchDepth: 'advanced',
        topic: 'news',
        answer: 'basic',
        chunksPerSource: 2,
        includePublishedDate: true,
        maxResults: 5,
      }),
    })
    const result = await provider.search({ query: 'deepseek harness', maxResults: 3 })

    assert.equal(seen.method, 'POST')
    assert.equal(seen.url, '/search')
    assert.equal(seen.authorization, 'Bearer tvly-test')
    assert.match(seen.userAgent, /^dsh-search-switch\//u)
    assert.equal(seen.contentType, 'application/json')
    assert.deepEqual(seen.body, {
      query: 'deepseek harness',
      search_depth: 'advanced',
      topic: 'news',
      include_answer: 'basic',
      chunks_per_source: 2,
      include_published_date: true,
      max_results: 3,
    })
    assert.equal(result.content, 'answer text')
    assert.equal(result.truncated, false)
    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].snippet, 'snippet')
    assert.equal(result.sources[0].publishedAt, 'Tue, 11 Mar 2025 17:00:00 GMT')
  })
})

test('the next search reads the latest depth snapshot', async () => {
  const depths = []
  await withServer(async (request, response) => {
    const body = await readJson(request)
    depths.push(body.search_depth)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ results: [] }))
  }, async (baseURL) => {
    let depth = 'basic'
    const provider = createTavilyProvider({
      WebError: FakeWebError,
      options: () => ({ apiKey: 'tvly-test', baseURL, searchDepth: depth }),
    })
    await provider.search({ query: 'one' })
    depth = 'advanced'
    await provider.search({ query: 'two' })
    assert.deepEqual(depths, ['basic', 'advanced'])
  })
})

test('surfaces 422 validation detail and 429 Retry-After', async () => {
  await withServer(async (request, response) => {
    const body = await readJson(request)
    if (body.query === 'bad') {
      response.writeHead(422, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ detail: [{ loc: ['body', 'query'], msg: 'Input should be a valid string' }] }))
      return
    }
    response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' })
    response.end(JSON.stringify({ detail: { error: 'rate limited' } }))
  }, async (baseURL) => {
    const provider = createTavilyProvider({
      WebError: FakeWebError,
      options: () => ({ apiKey: 'tvly-test', baseURL }),
    })
    await assert.rejects(provider.search({ query: 'bad' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /HTTP 422\): body\.query: Input should be a valid string/u)
      return true
    })
    await assert.rejects(provider.search({ query: 'slow' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /Retry-After: 60s/u)
      return true
    })
  })
})

test('missing key fails with the credential code before dispatching', async () => {
  const provider = createTavilyProvider({
    WebError: FakeWebError,
    options: () => ({ baseURL: 'https://api.tavily.com', resolveApiKey: async () => undefined }),
  })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
    assert.match(error.message, /TAVILY_API_KEY/u)
    return true
  })
})

test('an already-aborted signal never dispatches', async () => {
  let called = false
  const provider = createTavilyProvider({
    WebError: FakeWebError,
    fetchImpl: () => { called = true; throw new Error('must not run') },
    options: () => ({ apiKey: 'tvly-test', baseURL: 'https://api.tavily.com' }),
  })
  const controller = new AbortController()
  controller.abort(new Error('user cancelled'))
  await assert.rejects(provider.search({ query: 'q' }, controller.signal), (error) => {
    assert.equal(error.code, 'WEB_ABORTED')
    return true
  })
  assert.equal(called, false)
})

test('transport and body failures are provider errors naming the endpoint', async () => {
  const transport = createTavilyProvider({
    WebError: FakeWebError,
    fetchImpl: () => Promise.reject(new Error('socket closed')),
    options: () => ({ apiKey: 'tvly-test', baseURL: 'https://api.tavily.test' }),
  })
  await assert.rejects(transport.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR')
    assert.match(error.message, /socket closed/u)
    assert.match(error.message, /https:\/\/api\.tavily\.test\/search/u)
    return true
  })

  await withServer(async (request, response) => {
    await readJson(request)
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('not json')
  }, async (baseURL) => {
    const provider = createTavilyProvider({
      WebError: FakeWebError,
      options: () => ({ apiKey: 'tvly-test', baseURL }),
    })
    await assert.rejects(provider.search({ query: 'q' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /unprocessable response body/u)
      return true
    })
  })
})

test('availability is a cheap local check', () => {
  const provider = createTavilyProvider({
    WebError: FakeWebError,
    options: () => ({ apiKey: 'tvly-test', baseURL: 'not a url' }),
  })
  assert.equal(provider.available(), false)
  const ok = createTavilyProvider({
    WebError: FakeWebError,
    options: () => ({ apiKey: 'tvly-test', baseURL: 'https://api.tavily.com', maxResults: 5 }),
  })
  assert.equal(ok.available(), true)
  assert.equal(ok.id, 'tavily')
})
