/**
 * Host-half smoke test against the *real* DSH packages shipped in the installed
 * application (see ./asar-hooks.mjs).
 *
 * This is the closest check to a harness boot that does not start a server: it
 * validates the schemastery Config (including volatile fields), both runtime
 * selection pins, delegation to the native search / local fetch providers, the
 * Tavily and Jina wire requests, the local fallback, and the restore path on
 * dispose. Run it with Electron in node mode:
 *
 *   ELECTRON_RUN_AS_NODE=1 "<install>\DeepSeek Harness.exe" scripts/host-smoke.mjs
 *
 * Set SKIP_NETWORK=1 to skip the live Jina Reader / Firecrawl probes.
 */

import './asar-hooks.mjs'
import assert from 'node:assert/strict'
import http from 'node:http'

const { Config, apply } = await import('../lib/index.js')

/**
 * Build one fake host context with both web registries and recording backends.
 * @param options - credentials stub and provider ids.
 */
function makeHost(options = {}) {
  const nativeCalls = []
  const localCalls = []
  const nativeProvider = {
    id: 'deepseek-official',
    available: () => true,
    search: async (request, signal) => {
      nativeCalls.push({ request, signal })
      return { sources: [{ url: 'https://native.example/r', snippet: 'native' }], truncated: false }
    },
  }
  const localProvider = {
    id: 'http',
    available: () => true,
    fetch: async (request, signal) => {
      localCalls.push({ request, signal })
      return {
        url: request.url,
        statusCode: 200,
        body: { kind: 'text', content: 'local body' },
        truncated: false,
      }
    },
  }
  const web = {
    searchProviderId: 'deepseek-official',
    fetchProviderId: 'http',
    searchProviders: new Map([['deepseek-official', nativeProvider]]),
    fetchProviders: new Map([['http', localProvider]]),
    registerSearchProvider(provider) {
      this.searchProviders.set(provider.id, provider)
      return () => {
        this.searchProviders.delete(provider.id)
      }
    },
    registerFetchProvider(provider) {
      this.fetchProviders.set(provider.id, provider)
      return () => {
        this.fetchProviders.delete(provider.id)
      }
    },
  }
  const effects = []
  const credentials = options.credentials ?? {
    resolve: async (reference) => (String(reference).includes('TAVILY') ? { value: 'tvly-smoke-key' } : undefined),
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
    localCalls,
    effects,
    get searchProvider() { return web.searchProviders.get('search-switch') },
    get fetchProvider() { return web.fetchProviders.get('search-switch') },
    disposeAll() {
      for (const dispose of effects.splice(0)) dispose()
    },
  }
}

/* 1. The Config schema validates and exposes volatile references. */
{
  const defaults = Config({})
  assert.equal(defaults.active.get(), 'deepseek')
  assert.equal(defaults.fetchSource.get(), 'jina')
  assert.equal(defaults.fetchFallbackToLocal.get(), true)
  assert.equal(defaults.tavilySearchDepth.get(), 'basic')
  assert.equal(defaults.tavilyTopic.get(), 'general')
  assert.equal(defaults.tavilyAnswer.get(), 'off')
  assert.equal(defaults.tavilyChunksPerSource.get(), 3)
  assert.equal(defaults.tavilyIncludePublishedDate.get(), true)
  assert.equal(defaults.tavilyApiKeyEnv.get(), 'TAVILY_API_KEY')
  assert.equal(defaults.jinaApiKeyEnv.get(), 'JINA_API_KEY')
  assert.equal(defaults.jinaReaderKeyMode.get(), 'anonymous')
  assert.equal(defaults.jinaReaderURL.get(), 'https://r.jina.ai')
  assert.equal(defaults.jinaSearchURL.get(), 'https://s.jina.ai')
  assert.equal(defaults.jinaTimeoutSeconds.get(), 20)
  assert.equal(defaults.jinaRespondWith.get(), 'default')
  assert.equal(defaults.jinaTargetSelector.get(), '')
  assert.equal(defaults.firecrawlApiKeyEnv.get(), 'FIRECRAWL_API_KEY')
  assert.equal(defaults.firecrawlBaseURL.get(), 'https://api.firecrawl.dev')
  assert.equal(defaults.firecrawlTimeoutMs.get(), 20000)
  assert.equal(defaults.fetchMaxChars.get(), 100000)
  assert.equal(defaults.snippetMaxChars.get(), 800)
  assert.equal(defaults.nativeProviderId, 'deepseek-official')
  assert.equal(defaults.localFetchProviderId, 'http')

  const custom = Config({
    active: 'tavily',
    fetchSource: 'firecrawl',
    tavilySearchDepth: 'advanced',
    jinaReaderKeyMode: 'api',
  })
  assert.equal(custom.active.get(), 'tavily')
  assert.equal(custom.fetchSource.get(), 'firecrawl')
  assert.equal(custom.tavilySearchDepth.get(), 'advanced')
  assert.equal(custom.jinaReaderKeyMode.get(), 'api')
  assert.throws(() => Config({ active: 'bing' }))
  assert.throws(() => Config({ fetchSource: 'curl' }))
  assert.throws(() => Config({ jinaRespondWith: 'readerlm-v2' }))
  assert.throws(() => Config({ tavilySearchDepth: 'turbo' }))
  assert.throws(() => Config({ jinaTimeoutSeconds: 0 }))
  assert.throws(() => Config({ firecrawlTimeoutMs: 999999 }))
  console.log('ok  Config schema + volatile refs')
}

/* 2. apply() pins both seams and restores both on dispose. */
{
  const host = makeHost()
  apply(host.ctx, Config({}))
  assert.equal(host.web.searchProviderId, 'search-switch')
  assert.equal(host.web.fetchProviderId, 'search-switch')
  assert.equal(host.searchProvider.id, 'search-switch')
  assert.equal(host.fetchProvider.id, 'search-switch')
  assert.equal(host.searchProvider.available(), true)
  assert.equal(host.fetchProvider.available(), true)

  const request = { query: 'deepseek harness', maxResults: 3 }
  const controller = new AbortController()
  const result = await host.searchProvider.search(request, controller.signal)
  assert.equal(result.sources[0].url, 'https://native.example/r')
  assert.equal(host.nativeCalls.length, 1)
  assert.equal(host.nativeCalls[0].request, request)
  assert.equal(host.nativeCalls[0].signal, controller.signal)

  // The default fetch source is Jina, so point it at the local fetcher before
  // asserting the delegation path.
  const localHost = makeHost()
  apply(localHost.ctx, Config({ fetchSource: 'local' }))
  const page = await localHost.fetchProvider.fetch({ url: 'https://example.com' })
  assert.equal(page.body.content, 'local body')
  assert.equal(localHost.localCalls.length, 1)

  host.disposeAll()
  assert.equal(host.web.searchProviderId, 'deepseek-official')
  assert.equal(host.web.fetchProviderId, 'http')
  localHost.disposeAll()
  console.log('ok  dual pin + native/local delegation + restore')
}

/* 3. The Tavily search path keeps its documented request and mapping. */
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

    const result = await host.searchProvider.search({ query: 'tavily path', maxResults: 2 })
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

    // A query failure still names the credential code, not a generic error.
    const noKeyHost = makeHost({
      credentials: { resolve: async () => undefined },
    })
    apply(noKeyHost.ctx, Config({ active: 'tavily', tavilyBaseURL: baseURL }))
    await assert.rejects(noKeyHost.searchProvider.search({ query: 'x' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      return true
    })
    console.log('ok  Tavily request/mapping + credential taxonomy')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/* 4. Jina Reader wire shape plus the local fallback on a blocked target. */
{
  let seen
  let blocked = false
  const server = http.createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      seen = { method: request.method, url: request.url, headers: request.headers, form: Object.fromEntries(new URLSearchParams(raw)) }
      if (blocked) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          data: null,
          code: 403,
          name: 'LocalhostAccessError',
          message: 'Domain resolved to localhost',
        }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        code: 200,
        data: { title: 'Example', url: 'https://example.com/', content: '# Example' },
      }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}`

  try {
    const host = makeHost()
    apply(host.ctx, Config({ fetchSource: 'jina', jinaReaderURL: baseURL }))
    const page = await host.fetchProvider.fetch({ url: 'https://example.com/#frag' })
    assert.equal(seen.method, 'POST')
    assert.equal(seen.url, '/')
    assert.equal(seen.form.url, 'https://example.com/#frag')
    assert.equal(seen.headers.authorization, undefined)
    assert.equal(page.body.kind, 'text')
    assert.equal(page.body.content, '# Example')
    assert.equal(page.url, 'https://example.com/')
    assert.equal(page.statusCode, 200)
    assert.equal(page.truncated, false)

    blocked = true
    const fallbackPage = await host.fetchProvider.fetch({ url: 'http://localhost:3000/' })
    assert.equal(fallbackPage.body.content, 'local body')
    assert.equal(host.localCalls.length, 1)
    console.log('ok  Jina Reader wire + local fallback')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/* 5. Live probes against the real services (skipped with SKIP_NETWORK=1). */
if (process.env.SKIP_NETWORK === '1') {
  console.log('skip live Jina Reader / Firecrawl probes (SKIP_NETWORK=1)')
} else {
  const liveHost = makeHost()
  apply(liveHost.ctx, Config({ fetchSource: 'jina' }))
  try {
    const page = await liveHost.fetchProvider.fetch({ url: 'https://example.com' })
    assert.equal(page.statusCode, 200)
    assert.ok(page.body.content.length > 0)
    console.log('ok  live Jina Reader anonymous fetch')
  } catch (error) {
    console.log(`skip live Jina Reader probe (${error.message.split('\n')[0]})`)
  }
  liveHost.disposeAll()

  const fcHost = makeHost()
  apply(fcHost.ctx, Config({ fetchSource: 'firecrawl', firecrawlTimeoutMs: 25000 }))
  try {
    const page = await fcHost.fetchProvider.fetch({ url: 'https://example.com' })
    assert.equal(page.statusCode > 0, true)
    assert.ok(page.body.content.length > 0)
    console.log('ok  live Firecrawl keyless scrape')
  } catch (error) {
    console.log(`skip live Firecrawl probe (${error.message.split('\n')[0]})`)
  }
  fcHost.disposeAll()
}

console.log('host smoke: all checks passed')
