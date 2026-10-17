import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FETCH_SOURCES,
  SEARCH_SOURCES,
  SWITCH_PROVIDER_ID,
  createFetchDispatcher,
  createSearchDispatcher,
  normaliseSource,
} from '../lib/dispatch.js'

/** Minimal stand-in for the seam's WebError. */
class FakeWebError extends Error {
  constructor(message, code, options) {
    super(message, options)
    this.code = code
  }
}

/** Build a recording backend provider. */
function backend(id, answer, options = {}) {
  const calls = []
  return {
    calls,
    id,
    available: () => true,
    search: async (request, signal) => {
      calls.push({ request, signal })
      if (typeof options.fail === 'function') throw options.fail()
      return answer
    },
    fetch: async (request, signal) => {
      calls.push({ request, signal })
      if (typeof options.fail === 'function') throw options.fail()
      return options.fetchAnswer ?? answer
    },
  }
}

/** Build a search dispatcher over fixed inputs. */
function makeSearchDispatcher(overrides = {}) {
  const native = overrides.native ?? backend('deepseek-official', { sources: [{ url: 'https://native.test' }], truncated: false })
  const api = overrides.api ?? backend('deepseek-search-api', { sources: [{ url: 'https://api.test' }], truncated: false })
  const tavily = overrides.tavily ?? backend('tavily', { sources: [{ url: 'https://tavily.test' }], truncated: false })
  const jina = overrides.jina ?? backend('jina', { sources: [{ url: 'https://jina.test' }], truncated: false })
  const firecrawl = overrides.firecrawl ?? backend('firecrawl', { sources: [{ url: 'https://firecrawl.test' }], truncated: false })
  const provider = createSearchDispatcher({
    id: SWITCH_PROVIDER_ID,
    getActive: overrides.getActive ?? (() => 'deepseek'),
    getNative: overrides.getNative ?? (() => native),
    nativeProviderId: () => 'deepseek-official',
    getApiSearch: overrides.getApiSearch ?? (() => api),
    searchApiProviderId: () => 'deepseek-search-api',
    listProviderIds: () => overrides.providerIds ?? ['deepseek-official', 'deepseek-search-api', 'search-switch'],
    tavily,
    jina,
    firecrawl,
    WebError: FakeWebError,
  })
  return { provider, native, api, tavily, jina, firecrawl }
}

/** Build a fetch dispatcher over fixed inputs. */
function makeFetchDispatcher(overrides = {}) {
  const local = overrides.local ?? backend('http', undefined, {
    fetchAnswer: { url: 'https://local.test', statusCode: 200, body: { kind: 'text', content: 'local' }, truncated: false },
  })
  const api = overrides.api ?? backend('deepseek-fetch-api', undefined, {
    fetchAnswer: { url: 'https://api.test', statusCode: 200, body: { kind: 'text', content: 'api' }, truncated: false },
  })
  const jina = overrides.jina ?? backend('jina', undefined, {
    fetchAnswer: { url: 'https://jina.test', statusCode: 200, body: { kind: 'text', content: 'jina' }, truncated: false },
  })
  const firecrawl = overrides.firecrawl ?? backend('firecrawl', undefined, {
    fetchAnswer: { url: 'https://fc.test', statusCode: 200, body: { kind: 'text', content: 'firecrawl' }, truncated: false },
  })
  let fallback = overrides.fallback ?? true
  const provider = createFetchDispatcher({
    id: SWITCH_PROVIDER_ID,
    getActive: overrides.getActive ?? (() => 'jina'),
    getLocal: overrides.getLocal ?? (() => local),
    localFetchProviderId: () => 'http',
    getApiFetch: overrides.getApiFetch ?? (() => api),
    apiFetchProviderId: () => 'deepseek-fetch-api',
    listProviderIds: () => overrides.providerIds ?? ['http', 'deepseek-fetch-api', 'search-switch'],
    jina,
    firecrawl,
    fallbackToLocal: () => fallback,
    WebError: FakeWebError,
  })
  return {
    provider,
    local,
    api,
    jina,
    firecrawl,
    setFallback(value) { fallback = value },
  }
}

test('delegates search to the native provider and forwards request and signal', async () => {
  const { provider, native, tavily } = makeSearchDispatcher()
  const request = { query: 'q', maxResults: 4 }
  const controller = new AbortController()
  const result = await provider.search(request, controller.signal)
  assert.deepEqual(result, { sources: [{ url: 'https://native.test' }], truncated: false })
  assert.equal(native.calls.length, 1)
  assert.equal(tavily.calls.length, 0)
  assert.equal(native.calls[0].request, request)
  assert.equal(native.calls[0].signal, controller.signal)
})

test('routes every search source to its own backend', async () => {
  for (const [source, key] of [
    ['tavily', 'tavily'],
    ['jina', 'jina'],
    ['firecrawl', 'firecrawl'],
    ['deepseek-api', 'api'],
  ]) {
    const backends = makeSearchDispatcher({ getActive: () => source })
    await backends.provider.search({ query: 'q' })
    assert.equal(backends[key].calls.length, 1, `${source} was not called`)
    assert.equal(backends.native.calls.length, 0)
  }
})

test('normalises case and whitespace in the stored value', async () => {
  const { provider, tavily } = makeSearchDispatcher({ getActive: () => '  TAVILY  ' })
  await provider.search({ query: 'q' })
  assert.equal(tavily.calls.length, 1)
  assert.equal(normaliseSource('  DeepSeek '), 'deepseek')
  assert.equal(normaliseSource(undefined), undefined)
})

test('native source without a registered native provider fails loudly', async () => {
  const { provider } = makeSearchDispatcher({ getNative: () => undefined, providerIds: ['search-switch'] })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
    assert.match(error.message, /deepseek-official/u)
    assert.match(error.message, /registered: search-switch/u)
    return true
  })
})

test('the official Search API source without its provider fails loudly', async () => {
  const { provider } = makeSearchDispatcher({ getActive: () => 'deepseek-api', getApiSearch: () => undefined })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
    assert.match(error.message, /deepseek-search-api/u)
    assert.match(error.message, /web-deepseek-api/u)
    return true
  })
})

test('an unknown search source fails instead of silently picking one', async () => {
  const { provider, native, api, tavily, jina, firecrawl } = makeSearchDispatcher({ getActive: () => 'bing' })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_UNAVAILABLE')
    assert.match(error.message, /"bing"/u)
    return true
  })
  assert.equal(native.calls.length + api.calls.length + tavily.calls.length + jina.calls.length + firecrawl.calls.length, 0)
})

test('search and fetch dispatchers are always selectable once pinned', () => {
  const search = makeSearchDispatcher()
  const fetch = makeFetchDispatcher()
  assert.equal(search.provider.available(), true)
  assert.equal(fetch.provider.available(), true)
  assert.equal(search.provider.id, SWITCH_PROVIDER_ID)
  assert.equal(fetch.provider.id, SWITCH_PROVIDER_ID)
})

test('delegates local fetch without wrapping it in a fallback', async () => {
  const { provider, local, jina } = makeFetchDispatcher({ getActive: () => 'local' })
  const result = await provider.fetch({ url: 'https://example.com' })
  assert.equal(result.body.content, 'local')
  assert.equal(local.calls.length, 1)
  assert.equal(jina.calls.length, 0)
})

test('delegates third-party fetch and forwards the signal', async () => {
  const controller = new AbortController()
  const { provider, jina, local } = makeFetchDispatcher({ getActive: () => '  JINA ' })
  const result = await provider.fetch({ url: 'https://example.com' }, controller.signal)
  assert.equal(result.body.content, 'jina')
  assert.equal(jina.calls[0].signal, controller.signal)
  assert.equal(local.calls.length, 0)
  assert.equal(FETCH_SOURCES.join(','), 'jina,local,deepseek-api,firecrawl')
  assert.equal(SEARCH_SOURCES.join(','), 'deepseek,deepseek-api,tavily,jina,firecrawl')
})

test('delegates the official Fetch API and falls back to local when it fails', async () => {
  const ok = makeFetchDispatcher({ getActive: () => 'deepseek-api' })
  const page = await ok.provider.fetch({ url: 'https://example.com' })
  assert.equal(page.body.content, 'api')
  assert.equal(ok.api.calls.length, 1)
  assert.equal(ok.local.calls.length, 0)

  const failing = makeFetchDispatcher({
    getActive: () => 'deepseek-api',
    api: backend('deepseek-fetch-api', undefined, { fail: () => new FakeWebError('api down', 'WEB_PROVIDER_ERROR') }),
  })
  const fallbackPage = await failing.provider.fetch({ url: 'https://example.com' })
  assert.equal(fallbackPage.body.content, 'local')
  assert.equal(failing.local.calls.length, 1)
})

test('the official Fetch API source without its provider fails loudly', async () => {
  const { provider } = makeFetchDispatcher({ getActive: () => 'deepseek-api', getApiFetch: () => undefined })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
    assert.match(error.message, /deepseek-fetch-api/u)
    assert.match(error.message, /web-deepseek-api/u)
    return true
  })
})

test('falls back to the local fetcher when the third party fails', async () => {
  const { provider, local, jina } = makeFetchDispatcher({
    getActive: () => 'jina',
    jina: backend('jina', undefined, { fail: () => new FakeWebError('jina blocked', 'WEB_PROVIDER_ERROR') }),
  })
  const result = await provider.fetch({ url: 'https://example.com' })
  assert.equal(jina.calls.length, 1)
  assert.equal(local.calls.length, 1)
  assert.equal(result.body.content, 'local')
})

test('the fallback switch turns the retry off', async () => {
  const { provider, local, setFallback } = makeFetchDispatcher({
    getActive: () => 'firecrawl',
    firecrawl: backend('firecrawl', undefined, { fail: () => new FakeWebError('fc failed', 'WEB_PROVIDER_ERROR') }),
  })
  setFallback(false)
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.message, 'fc failed')
    return true
  })
  assert.equal(local.calls.length, 0)
})

test('cancellation never triggers the fallback', async () => {
  const { provider, local } = makeFetchDispatcher({
    getActive: () => 'jina',
    jina: backend('jina', undefined, { fail: () => new FakeWebError('aborted', 'WEB_ABORTED') }),
  })
  const controller = new AbortController()
  controller.abort(new Error('user cancelled'))
  await assert.rejects(provider.fetch({ url: 'https://example.com' }, controller.signal), (error) => {
    assert.equal(error.code, 'WEB_ABORTED')
    return true
  })
  assert.equal(local.calls.length, 0)
})

test('a double failure keeps the first code and names the fallback failure', async () => {
  const { provider } = makeFetchDispatcher({
    getActive: () => 'jina',
    jina: backend('jina', undefined, { fail: () => new FakeWebError('jina blocked', 'WEB_PROVIDER_ERROR') }),
    local: backend('http', undefined, { fail: () => new FakeWebError('local exploded', 'WEB_FETCH_TIMEOUT') }),
  })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR')
    assert.match(error.message, /jina blocked/u)
    assert.match(error.message, /local fallback fetch also failed: local exploded/u)
    assert.equal(error.cause.code, 'WEB_FETCH_TIMEOUT')
    return true
  })
})

test('local source without a registered local provider fails loudly', async () => {
  const { provider } = makeFetchDispatcher({ getActive: () => 'local', getLocal: () => undefined, providerIds: ['search-switch'] })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
    assert.match(error.message, /"http"/u)
    assert.match(error.message, /registered: search-switch/u)
    return true
  })
})

test('an unknown fetch source fails instead of silently picking one', async () => {
  const { provider, jina, local } = makeFetchDispatcher({ getActive: () => 'reader' })
  await assert.rejects(provider.fetch({ url: 'https://example.com' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_UNAVAILABLE')
    assert.match(error.message, /"reader"/u)
    return true
  })
  assert.equal(jina.calls.length + local.calls.length, 0)
})
