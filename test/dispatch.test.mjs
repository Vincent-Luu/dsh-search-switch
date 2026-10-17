import test from 'node:test'
import assert from 'node:assert/strict'

import { SWITCH_PROVIDER_ID, createSwitchProvider, normaliseSource } from '../lib/dispatch.js'

/** Minimal stand-in for the seam's WebError. */
class FakeWebError extends Error {
  constructor(message, code, options) {
    super(message, options)
    this.code = code
  }
}

/** Build a recording backend provider. */
function backend(id, answer) {
  const calls = []
  return {
    calls,
    id,
    available: () => true,
    search: async (request, signal) => {
      calls.push({ request, signal })
      return answer
    },
  }
}

/** Build a dispatcher over fixed inputs. */
function makeDispatcher(overrides = {}) {
  const native = overrides.native ?? backend('deepseek-official', { sources: [], truncated: false })
  const tavily = overrides.tavily ?? backend('tavily', { sources: [], truncated: false })
  const provider = createSwitchProvider({
    id: SWITCH_PROVIDER_ID,
    getActive: overrides.getActive ?? (() => 'deepseek'),
    getNative: overrides.getNative ?? (() => native),
    nativeProviderId: () => 'deepseek-official',
    listProviderIds: () => overrides.providerIds ?? ['deepseek-official', 'search-switch'],
    tavily,
    WebError: FakeWebError,
  })
  return { provider, native, tavily }
}

test('delegates to the native provider and forwards request and signal', async () => {
  const { provider, native, tavily } = makeDispatcher()
  const request = { query: 'q', maxResults: 4 }
  const controller = new AbortController()
  const result = await provider.search(request, controller.signal)
  assert.deepEqual(result, { sources: [], truncated: false })
  assert.equal(native.calls.length, 1)
  assert.equal(tavily.calls.length, 0)
  assert.equal(native.calls[0].request, request)
  assert.equal(native.calls[0].signal, controller.signal)
})

test('delegates to Tavily when the source is tavily', async () => {
  const { provider, native, tavily } = makeDispatcher({ getActive: () => 'tavily' })
  await provider.search({ query: 'q' })
  assert.equal(native.calls.length, 0)
  assert.equal(tavily.calls.length, 1)
})

test('normalises case and whitespace in the stored value', async () => {
  const { provider, tavily } = makeDispatcher({ getActive: () => '  TAVILY  ' })
  await provider.search({ query: 'q' })
  assert.equal(tavily.calls.length, 1)
  assert.equal(normaliseSource('  DeepSeek '), 'deepseek')
  assert.equal(normaliseSource(undefined), undefined)
})

test('native source without a registered native provider fails loudly', async () => {
  const { provider } = makeDispatcher({ getNative: () => undefined, providerIds: ['search-switch'] })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_CONFIGURED_MISSING')
    assert.match(error.message, /deepseek-official/u)
    assert.match(error.message, /registered: search-switch/u)
    return true
  })
})

test('an unknown source fails instead of silently picking one', async () => {
  const { provider, native, tavily } = makeDispatcher({ getActive: () => 'bing' })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_UNAVAILABLE')
    assert.match(error.message, /"bing"/u)
    return true
  })
  assert.equal(native.calls.length, 0)
  assert.equal(tavily.calls.length, 0)
})

test('is always selectable once pinned', () => {
  const { provider } = makeDispatcher()
  assert.equal(provider.available(), true)
  assert.equal(provider.id, SWITCH_PROVIDER_ID)
})
