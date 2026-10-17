/**
 * Host-half smoke test against the *real* DSH packages shipped in the installed
 * application (see ./asar-hooks.mjs).
 *
 * This is the closest check to a harness boot that does not start a server: it
 * validates the schemastery Config (including volatile fields), the runtime
 * selection pin, native delegation, the Tavily wire request, and the restore
 * path on dispose. Run it with Electron in node mode:
 *
 *   ELECTRON_RUN_AS_NODE=1 "<install>\DeepSeek Harness.exe" scripts/host-smoke.mjs
 */

import './asar-hooks.mjs'
import assert from 'node:assert/strict'
import http from 'node:http'

const { Config, apply } = await import('../lib/index.js')

/**
 * Build one fake host context with a web service and a recording native provider.
 * @param options - credentials stub and extra providers.
 */
function makeHost(options = {}) {
  const nativeCalls = []
  const nativeProvider = {
    id: 'deepseek-official',
    available: () => true,
    search: async (request, signal) => {
      nativeCalls.push({ request, signal })
      return { sources: [{ url: 'https://native.example/r', snippet: 'native' }], truncated: false }
    },
  }
  let registered
  const web = {
    searchProviderId: 'deepseek-official',
    searchProviders: new Map([['deepseek-official', nativeProvider]]),
    registerSearchProvider(provider) {
      registered = provider
      this.searchProviders.set(provider.id, provider)
      return () => {
        this.searchProviders.delete(provider.id)
      }
    },
  }
  const effects = []
  const credentials = options.credentials ?? {
    resolve: async () => ({ value: 'tvly-smoke-key' }),
  }
  const ctx = {
    web,
    get(name) {
      return name === 'credentials' ? credentials : undefined
    },
    effect(callback) {
      const disposer = callback()
      if (typeof disposer === 'function') effects.push(disposer)
      return disposer
    },
  }
  return {
    ctx,
    web,
    nativeCalls,
    effects,
    get registered() { return registered },
    disposeAll() {
      for (const dispose of effects.splice(0)) dispose()
    },
  }
}

/* 1. The Config schema validates and exposes volatile references. */
{
  const defaults = Config({})
  assert.equal(defaults.active.get(), 'deepseek')
  assert.equal(defaults.tavilySearchDepth.get(), 'basic')
  assert.equal(defaults.tavilyTopic.get(), 'general')
  assert.equal(defaults.tavilyAnswer.get(), 'off')
  assert.equal(defaults.tavilyChunksPerSource.get(), 3)
  assert.equal(defaults.tavilyIncludePublishedDate.get(), true)
  assert.equal(defaults.tavilyApiKeyEnv.get(), 'TAVILY_API_KEY')
  assert.equal(defaults.nativeProviderId, 'deepseek-official')

  const custom = Config({ active: 'tavily', tavilySearchDepth: 'advanced', tavilyTopic: 'finance' })
  assert.equal(custom.active.get(), 'tavily')
  assert.equal(custom.tavilySearchDepth.get(), 'advanced')
  assert.equal(custom.tavilyTopic.get(), 'finance')
  assert.throws(() => Config({ active: 'bing' }))
  assert.throws(() => Config({ tavilySearchDepth: 'turbo' }))
  console.log('ok  Config schema + volatile refs')
}

/* 2. apply() pins the seam, delegates to native, and restores on dispose. */
{
  const host = makeHost()
  apply(host.ctx, Config({}))
  assert.equal(host.web.searchProviderId, 'search-switch')
  assert.equal(host.registered.id, 'search-switch')
  assert.equal(host.registered.available(), true)

  const request = { query: 'deepseek harness', maxResults: 3 }
  const controller = new AbortController()
  const result = await host.registered.search(request, controller.signal)
  assert.equal(result.sources[0].url, 'https://native.example/r')
  assert.equal(host.nativeCalls.length, 1)
  assert.equal(host.nativeCalls[0].request, request)
  assert.equal(host.nativeCalls[0].signal, controller.signal)

  host.disposeAll()
  assert.equal(host.web.searchProviderId, 'deepseek-official')
  console.log('ok  pin + native delegation + restore')
}

/* 3. The Tavily path builds the documented request and maps the response. */
{
  let seen
  const server = http.createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      seen = { url: request.url, headers: request.headers, body: JSON.parse(raw) }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        answer: 'synthesised answer',
        results: [
          { title: 'A', url: 'https://example.com/a', content: ' snippet a ', published_date: 'Tue, 11 Mar 2025 17:00:00 GMT' },
          { title: 'B', url: 'https://example.com/b', content: '   ' },
        ],
      }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}`

  try {
    const host = makeHost()
    apply(host.ctx, Config({
      active: 'tavily',
      tavilySearchDepth: 'advanced',
      tavilyBaseURL: baseURL,
      tavilyAnswer: 'basic',
    }))

    const result = await host.registered.search({ query: 'tavily path', maxResults: 2 })
    assert.equal(seen.url, '/search')
    assert.equal(seen.headers.authorization, 'Bearer tvly-smoke-key')
    assert.match(seen.headers['user-agent'], /^dsh-search-switch\//u)
    assert.deepEqual(seen.body, {
      query: 'tavily path',
      search_depth: 'advanced',
      topic: 'general',
      include_answer: 'basic',
      chunks_per_source: 3,
      include_published_date: true,
      max_results: 2,
    })
    assert.equal(result.content, 'synthesised answer')
    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].snippet, 'snippet a')
    assert.equal(result.sources[0].publishedAt, 'Tue, 11 Mar 2025 17:00:00 GMT')
    assert.equal(result.truncated, false)

    // A missing key must fail with the credential code, not a generic error.
    const noKeyHost = makeHost({ credentials: { resolve: async () => undefined } })
    apply(noKeyHost.ctx, Config({ active: 'tavily', tavilyBaseURL: baseURL }))
    await assert.rejects(noKeyHost.registered.search({ query: 'x' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      return true
    })

    // A missing native provider must fail loudly instead of picking Tavily.
    const noNativeHost = makeHost()
    noNativeHost.web.searchProviders.delete('deepseek-official')
    noNativeHost.web.searchProviders = new Map()
    apply(noNativeHost.ctx, Config({}))
    await assert.rejects(noNativeHost.registered.search({ query: 'x' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
      return true
    })
    console.log('ok  Tavily request/mapping + failure taxonomy')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

console.log('host smoke: all checks passed')
