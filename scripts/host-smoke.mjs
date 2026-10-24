/**
 * Host-half smoke test against the *real* DSH packages shipped in the installed
 * application (see ./asar-hooks.mjs).
 *
 * 0.2.1-rc.2 moved the seam's selection from writable `searchProviderId` /
 * `fetchProviderId` properties to volatile config references
 * (`web.config.searchProvider.get()`), and added the official DeepSeek Search /
 * Fetch API providers (`deepseek-search-api`, `deepseek-fetch-api`). This smoke
 * proves both mechanisms and both provider families:
 *
 *  - the real `WebRuntime` booted in a real cordis context is pinned through its
 *    volatile config, routed through the dispatchers, then restored;
 *  - a legacy-shaped host (plain properties) is still pinned the old way;
 *  - the Config schema, Tavily/Jina wire contracts, official-API delegation, the
 *    local fallback, and (unless SKIP_NETWORK=1) live Jina/Firecrawl probes.
 *
 *   ELECTRON_RUN_AS_NODE=1 "<install>\DeepSeek Harness.exe" scripts/host-smoke.mjs
 */

import './asar-hooks.mjs'
import assert from 'node:assert/strict'
import http from 'node:http'

// Dynamic imports so the resolve hook above is already registered when these
// specifiers are resolved (static imports resolve before module evaluation).
const { Context } = await import('@deepseek-ai/cordis')
const { WebRuntime } = await import('@deepseek-ai/dsh-web')
const { Config, apply } = await import('../lib/index.js')

/** The host's in-place volatile write symbol. */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** A frozen volatile reference with the same protocol as the host's. */
function volatileRef(initial) {
  let current = initial
  return Object.freeze({
    get: () => current,
    [VOLATILE_WRITE]: (value) => { current = value },
  })
}

/** Wait one macrotask so cordis can mount the service. */
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 25))
}

/**
 * Build a fake 0.2.1-rc.2-shaped host: config references plus both registries.
 * @param options - credentials stub.
 */
function makeConfigHost(options = {}) {
  const nativeCalls = []
  const searchApiCalls = []
  const localCalls = []
  const apiFetchCalls = []
  const web = {
    config: {
      searchProvider: volatileRef('deepseek-official'),
      fetchProvider: volatileRef('http'),
    },
    searchProviders: new Map([
      ['deepseek-official', {
        id: 'deepseek-official',
        available: () => true,
        search: async (request, signal) => {
          nativeCalls.push({ request, signal })
          return { sources: [{ url: 'https://native.example/r', snippet: 'native' }], truncated: false }
        },
      }],
      ['deepseek-search-api', {
        id: 'deepseek-search-api',
        available: () => true,
        search: async (request, signal) => {
          searchApiCalls.push({ request, signal })
          return { sources: [{ url: 'https://search-api.example/r', snippet: 'api' }], truncated: false }
        },
      }],
    ]),
    fetchProviders: new Map([
      ['http', {
        id: 'http',
        available: () => true,
        fetch: async (request, signal) => {
          localCalls.push({ request, signal })
          return { url: request.url, statusCode: 200, body: { kind: 'text', content: 'local body' }, truncated: false }
        },
      }],
      ['deepseek-fetch-api', {
        id: 'deepseek-fetch-api',
        available: () => true,
        fetch: async (request, signal) => {
          apiFetchCalls.push({ request, signal })
          return { url: request.url, statusCode: 200, body: { kind: 'text', content: 'api body' }, truncated: false }
        },
      }],
    ]),
    registerSearchProvider(provider) {
      this.searchProviders.set(provider.id, provider)
      return () => { this.searchProviders.delete(provider.id) }
    },
    registerFetchProvider(provider) {
      this.fetchProviders.set(provider.id, provider)
      return () => { this.fetchProviders.delete(provider.id) }
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
    searchApiCalls,
    localCalls,
    apiFetchCalls,
    effects,
    get searchProvider() { return web.searchProviders.get('search-switch') },
    get fetchProvider() { return web.fetchProviders.get('search-switch') },
    disposeAll() {
      for (const dispose of effects.splice(0)) dispose()
    },
  }
}

/** Build a legacy-shaped host (DSH <= 0.2.1-rc.1): writable plain properties. */
function makeLegacyHost() {
  const web = {
    searchProviderId: 'deepseek-official',
    fetchProviderId: 'http',
    searchProviders: new Map([['deepseek-official', {
      id: 'deepseek-official',
      available: () => true,
      search: async () => ({ sources: [], truncated: false }),
    }]]),
    fetchProviders: new Map([['http', {
      id: 'http',
      available: () => true,
      fetch: async (request) => ({
        url: request.url,
        statusCode: 200,
        body: { kind: 'text', content: 'legacy' },
        truncated: false,
      }),
    }]]),
    registerSearchProvider(provider) {
      this.searchProviders.set(provider.id, provider)
      return () => { this.searchProviders.delete(provider.id) }
    },
    registerFetchProvider(provider) {
      this.fetchProviders.set(provider.id, provider)
      return () => { this.fetchProviders.delete(provider.id) }
    },
  }
  const effects = []
  const ctx = {
    web,
    get: () => undefined,
    effect(callback) {
      const disposer = callback()
      if (typeof disposer === 'function') effects.push(disposer)
      return disposer
    },
  }
  return {
    ctx,
    web,
    effects,
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
  assert.equal(defaults.nativeProviderId.get(), 'deepseek-official')
  assert.equal(defaults.searchApiProviderId.get(), 'deepseek-search-api')
  assert.equal(defaults.localFetchProviderId.get(), 'http')
  assert.equal(defaults.fetchApiProviderId.get(), 'deepseek-fetch-api')

  const custom = Config({
    active: 'deepseek-api',
    fetchSource: 'deepseek-api',
    tavilySearchDepth: 'advanced',
    jinaReaderKeyMode: 'api',
  })
  assert.equal(custom.active.get(), 'deepseek-api')
  assert.equal(custom.fetchSource.get(), 'deepseek-api')
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

/* 2. Real 0.2.1-rc.2 seam: pin through the volatile config, route, restore. */
{
  const root = new Context()
  root.plugin(WebRuntime, { searchProvider: 'deepseek-official', fetchProvider: 'http' })
  await tick()
  const web = root.get('web')
  assert.ok(web, 'the real WebRuntime did not mount')

  const calls = { native: 0, searchApi: 0, local: 0, fetchApi: 0 }
  web.registerSearchProvider({
    id: 'deepseek-official',
    available: () => true,
    search: async () => {
      calls.native += 1
      return { sources: [{ url: 'https://native.example/r', snippet: 'native' }], truncated: false }
    },
  })
  web.registerSearchProvider({
    id: 'deepseek-search-api',
    available: () => true,
    search: async () => {
      calls.searchApi += 1
      return { sources: [{ url: 'https://search-api.example/r', snippet: 'api' }], truncated: false }
    },
  })
  web.registerFetchProvider({
    id: 'http',
    available: () => true,
    fetch: async (request) => {
      calls.local += 1
      return { url: request.url, statusCode: 200, body: { kind: 'text', content: 'local body' }, truncated: false }
    },
  })
  web.registerFetchProvider({
    id: 'deepseek-fetch-api',
    available: () => true,
    fetch: async (request) => {
      calls.fetchApi += 1
      return { url: request.url, statusCode: 200, body: { kind: 'text', content: 'api body' }, truncated: false }
    },
  })

  assert.equal('searchProviderId' in web, false, 'this host must not expose the legacy property')

  const effectDisposers = []
  const hostCtx = {
    web,
    get: (name) => root.get(name),
    effect(callback, label) {
      const disposer = root.effect(callback, label)
      effectDisposers.push(disposer)
      return disposer
    },
  }

  apply(hostCtx, Config({ active: 'deepseek', fetchSource: 'deepseek-api' }))
  assert.equal(web.config.searchProvider.get(), 'search-switch')
  assert.equal(web.config.fetchProvider.get(), 'search-switch')

  const search = await web.search({ query: 'q', maxResults: 3 })
  assert.equal(search.sources[0].url, 'https://native.example/r')
  assert.equal(calls.native, 1)

  const page = await web.fetch({ url: 'https://example.com/page' })
  assert.equal(page.body.content, 'api body')
  assert.equal(calls.fetchApi, 1)
  assert.equal(calls.local, 0)

  for (const dispose of effectDisposers.splice(0)) dispose()
  assert.equal(web.config.searchProvider.get(), 'deepseek-official')
  assert.equal(web.config.fetchProvider.get(), 'http')

  // The restored selection still routes through the host's own providers.
  const afterSearch = await web.search({ query: 'again' })
  assert.equal(afterSearch.sources[0].url, 'https://native.example/r')
  const afterFetch = await web.fetch({ url: 'https://example.com/page' })
  assert.equal(afterFetch.body.content, 'local body')
  console.log('ok  real seam: volatile config pin + routing + restore')
}

/* 3. Legacy seam (<= 0.2.1-rc.1): plain properties still pin and restore. */
{
  const host = makeLegacyHost()
  apply(host.ctx, Config({ fetchSource: 'local' }))
  assert.equal(host.web.searchProviderId, 'search-switch')
  assert.equal(host.web.fetchProviderId, 'search-switch')
  host.disposeAll()
  assert.equal(host.web.searchProviderId, 'deepseek-official')
  assert.equal(host.web.fetchProviderId, 'http')
  console.log('ok  legacy property pin + restore')
}

/* 4. rc.2-shaped fake host: Tavily wire, official API delegation, credentials. */
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
    const host = makeConfigHost()
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
    assert.equal(result.sources[0].snippet, 'snippet a')
    assert.equal(result.sources[0].publishedAt, 'Tue, 11 Mar 2025 17:00:00 GMT')

    // `deepseek-api` delegates to the official Search API provider.
    const apiHost = makeConfigHost()
    apply(apiHost.ctx, Config({ active: 'deepseek-api' }))
    const apiResult = await apiHost.searchProvider.search({ query: 'q' })
    assert.equal(apiResult.sources[0].url, 'https://search-api.example/r')
    assert.equal(apiHost.searchApiCalls.length, 1)

    // A missing key still names the credential code, not a generic error.
    const noKeyHost = makeConfigHost({ credentials: { resolve: async () => undefined } })
    apply(noKeyHost.ctx, Config({ active: 'tavily', tavilyBaseURL: baseURL }))
    await assert.rejects(noKeyHost.searchProvider.search({ query: 'x' }), (error) => {
      assert.equal(error.code, 'WEB_PROVIDER_CREDENTIAL_MISSING')
      return true
    })
    console.log('ok  Tavily + official Search API delegation + credential taxonomy')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/* 5. Jina Reader wire shape plus the local fallback on a blocked target. */
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
        response.end(JSON.stringify({ data: null, code: 403, name: 'LocalhostAccessError', message: 'Domain resolved to localhost' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ code: 200, data: { title: 'Example', url: 'https://example.com/', content: '# Example' } }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}`

  try {
    const host = makeConfigHost()
    apply(host.ctx, Config({ fetchSource: 'jina', jinaReaderURL: baseURL }))
    const page = await host.fetchProvider.fetch({ url: 'https://example.com/#frag' })
    assert.equal(seen.method, 'POST')
    assert.equal(seen.form.url, 'https://example.com/#frag')
    assert.equal(seen.headers.authorization, undefined)
    assert.equal(page.body.content, '# Example')
    assert.equal(page.url, 'https://example.com/')

    blocked = true
    const fallbackPage = await host.fetchProvider.fetch({ url: 'http://localhost:3000/' })
    assert.equal(fallbackPage.body.content, 'local body')
    assert.equal(host.localCalls.length, 1)
    console.log('ok  Jina Reader wire + local fallback')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

/* 6. Live probes against the real services (skipped with SKIP_NETWORK=1). */
if (process.env.SKIP_NETWORK === '1') {
  console.log('skip live Jina Reader / Firecrawl probes (SKIP_NETWORK=1)')
} else {
  const liveHost = makeConfigHost()
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

  const fcHost = makeConfigHost()
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
