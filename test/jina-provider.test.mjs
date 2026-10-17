import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { createJinaProvider } from '../lib/jina-provider.js'

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

/** Read one request body as text. */
function readBody(request) {
  return new Promise((resolve) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => resolve(raw))
  })
}

/** Build a provider over one loopback base URL. */
function makeProvider(baseURL, overrides = {}) {
  return createJinaProvider({
    WebError: FakeWebError,
    options: () => ({
      apiKey: overrides.apiKey,
      apiKeyEnv: 'JINA_API_KEY',
      readerURL: baseURL,
      searchURL: baseURL,
      readerKeyMode: overrides.readerKeyMode ?? 'anonymous',
      timeoutSeconds: 20,
      retainImages: 'none',
      retainLinks: 'all',
      maxChars: overrides.maxChars,
      snippetMaxChars: overrides.snippetMaxChars,
      ...overrides.options,
    }),
  })
}

test('fetches through the Reader and returns markdown text', async () => {
  let seen
  await withServer(async (request, response) => {
    const raw = await readBody(request)
    seen = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      form: Object.fromEntries(new URLSearchParams(raw)),
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      code: 200,
      status: 20000,
      data: { title: 'Example', url: 'https://example.com/', content: '# Example\n\ntext' },
    }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    const result = await provider.fetch({ url: 'https://example.com/#a' })

    assert.equal(seen.method, 'POST')
    assert.equal(seen.url, '/')
    assert.equal(seen.form.url, 'https://example.com/#a')
    assert.equal(seen.headers.authorization, undefined)
    assert.equal(result.url, 'https://example.com/')
    assert.equal(result.statusCode, 200)
    assert.deepEqual(result.body, { kind: 'text', content: '# Example\n\ntext' })
    assert.equal(result.truncated, false)
    assert.equal(provider.id, 'jina')
    assert.equal(provider.available(), true)
  })
})

test('truncates Reader output at the configured bound', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ code: 200, data: { content: '0123456789' } }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL, { maxChars: 4 })
    const result = await provider.fetch({ url: 'https://example.com' })
    assert.equal(result.body.content, '0123')
    assert.equal(result.truncated, true)
  })
})

test('sends the key only when the reader mode asks for it', async () => {
  const seen = []
  await withServer((request, response) => {
    seen.push(request.headers.authorization)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ code: 200, data: { content: 'x' } }))
  }, async (baseURL) => {
    const anonymous = makeProvider(baseURL, { apiKey: 'jina_key', readerKeyMode: 'anonymous' })
    await anonymous.fetch({ url: 'https://example.com' })

    const auto = makeProvider(baseURL, { apiKey: 'jina_key', readerKeyMode: 'auto' })
    await auto.fetch({ url: 'https://example.com' })

    const api = makeProvider(baseURL, { apiKey: 'jina_key', readerKeyMode: 'api' })
    await api.fetch({ url: 'https://example.com' })

    assert.deepEqual(seen, [undefined, 'Bearer jina_key', 'Bearer jina_key'])
  })
})

test('forwards the response pipeline and target selector headers', async () => {
  let headers
  await withServer(async (request, response) => {
    await readBody(request)
    headers = request.headers
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ code: 200, data: { content: '## Heading\ntext' } }))
  }, async (baseURL) => {
    const plain = makeProvider(baseURL)
    await plain.fetch({ url: 'https://example.com' })
    assert.equal(headers['x-respond-with'], undefined)
    assert.equal(headers['x-target-selector'], undefined)

    const structured = makeProvider(baseURL, {
      options: { respondWith: 'markdown', targetSelector: '#mw-content-text' },
    })
    const page = await structured.fetch({ url: 'https://example.com' })
    assert.equal(headers['x-respond-with'], 'markdown')
    assert.equal(headers['x-target-selector'], '#mw-content-text')
    assert.equal(page.body.content, '## Heading\ntext')
  })
})

test('api mode without a key fails before dispatching', async () => {
  let called = false
  const provider = createJinaProvider({
    WebError: FakeWebError,
    fetchImpl: () => { called = true; throw new Error('must not run') },
    options: () => ({ readerURL: 'https://r.jina.ai', readerKeyMode: 'api' }),
  })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
    assert.match(error.message, /jinaReaderKeyMode is "api"/u)
    assert.match(error.message, /JINA_API_KEY/u)
    return true
  })
  assert.equal(called, false)
})

test('Reader failures name the endpoint and classify the cause', async () => {
  await withServer((request, response) => {
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      data: null,
      code: 403,
      name: 'LocalhostAccessError',
      status: 40306,
      message: 'Suspicious action: Domain resolved to localhost: 127.0.0.1',
    }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    await assert.rejects(provider.fetch({ url: 'http://localhost:9/' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /HTTP 403/u)
      assert.match(error.message, /LocalhostAccessError/u)
      assert.match(error.message, /local fetch provider/u)
      assert.match(error.message, new RegExp(baseURL.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'))
      return true
    })
  })
})

test('search needs a key and maps the result list', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      code: 200,
      data: [
        { title: 'One', url: 'https://one.test', description: 'first' },
        { title: 'Two', url: 'https://two.test', content: 'second' },
      ],
    }))
  }, async (baseURL) => {
    const missing = createJinaProvider({
      WebError: FakeWebError,
      fetchImpl: () => { throw new Error('must not run') },
      options: () => ({ searchURL: baseURL }),
    })
    await assert.rejects(missing.search({ query: 'q' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      assert.match(error.message, /JINA_API_KEY/u)
      return true
    })

    const provider = makeProvider(baseURL, { apiKey: 'jina_key' })
    const result = await provider.search({ query: 'deepseek' })
    assert.deepEqual(result, {
      sources: [
        { url: 'https://one.test', snippet: 'first', title: 'One' },
        { url: 'https://two.test', snippet: 'second', title: 'Two' },
      ],
      truncated: false,
    })
  })
})

test('a rejected key surfaces the credential code and repair hint', async () => {
  await withServer((request, response) => {
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      data: null,
      code: 401,
      name: 'AuthenticationFailedError',
      message: 'Invalid API key',
    }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL, { apiKey: 'jina_bad' })
    await assert.rejects(provider.search({ query: 'q' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      assert.match(error.message, /Invalid API key/u)
      assert.match(error.message, /replace it/u)
      return true
    })
  })
})

test('an already-aborted signal never dispatches', async () => {
  let called = false
  const provider = createJinaProvider({
    WebError: FakeWebError,
    fetchImpl: () => { called = true; throw new Error('must not run') },
    options: () => ({ readerURL: 'https://r.jina.ai' }),
  })
  const controller = new AbortController()
  controller.abort(new Error('user cancelled'))
  await assert.rejects(provider.fetch({ url: 'https://example.com' }, controller.signal), (error) => {
    assert.equal(error.code, 'WEB_ABORTED')
    return true
  })
  assert.equal(called, false)
})

test('transport failures and empty bodies are provider errors', async () => {
  const transport = createJinaProvider({
    WebError: FakeWebError,
    fetchImpl: () => Promise.reject(new Error('socket closed')),
    options: () => ({ readerURL: 'https://r.jina.ai' }),
  })
  await assert.rejects(transport.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR')
    assert.match(error.message, /socket closed/u)
    return true
  })

  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ code: 200, data: { content: '   ' } }))
  }, async (baseURL) => {
    const provider = makeProvider(baseURL)
    await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_ERROR')
      assert.match(error.message, /no readable content/u)
      return true
    })
  })
})
