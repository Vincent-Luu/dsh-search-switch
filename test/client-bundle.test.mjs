import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

/**
 * Load `lib/client.js` the way the browser module table does: publish it through
 * a fake `window.__ModuleLoader__`, then hand the factory a fake `require`.
 */
async function loadBundle() {
  const source = await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let entry
  const window = {
    __ModuleLoader__: {
      load(candidate) {
        entry = candidate
      },
    },
  }
  new Function('window', source)(window)
  assert.ok(entry, 'bundle did not call window.__ModuleLoader__.load')
  assert.equal(entry.id, 'dsh-search-switch')

  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useCallback: (callback) => callback,
    useRef: (initial) => ({ current: initial }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  const module = entry.factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected platform module: ${id}`)
  })
  return { entry, module }
}

/** Build a fake browser plugin context that records slot work. */
function makeContext(options = {}) {
  const registrations = []
  const injections = []
  const effects = []
  const snapshot = {
    status: options.status ?? 'ready',
    writable: options.writable ?? true,
    revision: 1,
    value: {
      active: options.active ?? 'deepseek',
      fetchSource: options.fetchSource ?? 'jina',
      fetchFallbackToLocal: options.fallback ?? true,
      tavilySearchDepth: options.depth ?? 'basic',
      jinaReaderKeyMode: options.jinaMode ?? 'anonymous',
      tavilyApiKeyEnv: 'TAVILY_API_KEY',
      jinaApiKeyEnv: 'JINA_API_KEY',
      firecrawlApiKeyEnv: 'FIRECRAWL_API_KEY',
    },
  }
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => true,
  }
  const credentials = {
    describe: async () => ({
      ok: true,
      value: {
        TAVILY_API_KEY: { configured: options.tavilyKey !== false, writable: true },
        JINA_API_KEY: { configured: options.jinaKey !== false, writable: true },
        FIRECRAWL_API_KEY: { configured: options.firecrawlKey !== false, writable: true },
      },
    }),
    set: async () => ({ ok: true }),
  }
  const slots = {
    inject(name, callback) {
      injections.push(name)
      return callback()
    },
    register(registration, component) {
      const record = { registration, component }
      registrations.push(record)
      return () => {
        const index = registrations.indexOf(record)
        if (index >= 0) registrations.splice(index, 1)
      }
    },
  }
  const configForms = {
    get(namespace) {
      assert.equal(namespace, 'search-switch')
      return form
    },
    whileServed(namespaces, register) {
      assert.deepEqual(namespaces, ['search-switch'])
      return options.served === false ? () => {} : register(new Set(namespaces))
    },
  }
  const context = {
    effect(callback) {
      const disposer = callback()
      if (typeof disposer === 'function') effects.push(disposer)
      return disposer
    },
    slots,
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    configForms,
    remote: { credentials },
  }
  return { context, registrations, injections, effects, form, credentials }
}

test('publishes the plugin shape the loader expects', async () => {
  const { module } = await loadBundle()
  assert.equal(module.name, 'search-switch')
  assert.ok(Array.isArray(module.inject))
  for (const service of ['slots', 'locale', 'configForms', 'remote.credentials']) {
    assert.ok(module.inject.includes(service), `missing inject: ${service}`)
  }
  assert.equal(typeof module.apply, 'function')
})

test('registers the composer control and the bundle config card', async () => {
  const { module } = await loadBundle()
  const { context, registrations, injections } = makeContext()
  module.apply(context)

  const composer = registrations.find((row) => row.registration.name === 'conversation.input.left')
  assert.ok(composer, 'composer control was not registered')
  assert.equal(composer.registration.id, 'search-provider')
  assert.equal(composer.registration.order, 10)
  assert.equal(typeof composer.component, 'function')

  const card = registrations.find((row) => row.registration.name === 'plugins.bundle.config')
  assert.ok(card, 'bundle config card was not registered')
  assert.equal(card.registration.key, 'dsh-search-switch')

  assert.ok(injections.includes('conversation.input.left'))
  assert.ok(injections.includes('plugins.bundle.config'))

  const injected = composer.registration.inject()
  assert.equal(typeof injected.t('label.search'), 'string')
  assert.equal(injected.form.getSnapshot().value.active, 'deepseek')
  assert.equal(injected.credentials, context.remote.credentials)
})

test('stays absent while the host does not serve the namespace', async () => {
  const { module } = await loadBundle()
  const { context, registrations } = makeContext({ served: false })
  module.apply(context)
  assert.equal(registrations.some((row) => row.registration.name === 'conversation.input.left'), false)
  // The configuration card is still registered: the plugin page shows it as
  // unavailable instead of the row silently losing its page.
  assert.equal(registrations.some((row) => row.registration.name === 'plugins.bundle.config'), true)
})

test('every registration is retractable', async () => {
  const { module } = await loadBundle()
  const { context, registrations, effects } = makeContext()
  module.apply(context)
  const before = registrations.length
  for (const dispose of effects) dispose()
  assert.ok(registrations.length < before, 'disposers did not retract registrations')
})

test('pure readers keep the UI honest', async () => {
  const { module } = await loadBundle()
  const internals = module.__internals

  assert.equal(internals.readSearchSource({ value: { active: 'jina' } }), 'jina')
  assert.equal(internals.readSearchSource({ value: { active: 'firecrawl' } }), 'firecrawl')
  assert.equal(internals.readSearchSource({ value: { active: 'bing' } }), 'deepseek')
  assert.equal(internals.readSearchSource(null), 'deepseek')

  assert.equal(internals.readFetchSource({ value: { fetchSource: 'local' } }), 'local')
  assert.equal(internals.readFetchSource({ value: { fetchSource: 'firecrawl' } }), 'firecrawl')
  assert.equal(internals.readFetchSource({ value: { fetchSource: 'curl' } }), 'jina')
  assert.equal(internals.readFetchSource({ value: {} }), 'jina')

  assert.equal(internals.readDepth({ value: { tavilySearchDepth: 'advanced' } }), 'advanced')
  // Latency tiers live in the same popover but must still round-trip.
  assert.equal(internals.readDepth({ value: { tavilySearchDepth: 'fast' } }), 'fast')
  assert.equal(internals.readDepth({ value: { tavilySearchDepth: 'ultra-fast' } }), 'ultra-fast')
  assert.equal(internals.readDepth({ value: { tavilySearchDepth: 'turbo' } }), 'basic')
  assert.equal(internals.readDepth(undefined), 'basic')
  assert.deepEqual(internals.DEPTH_OPTIONS, ['basic', 'advanced'])
  assert.deepEqual(internals.EXTRA_DEPTH_OPTIONS, ['fast', 'ultra-fast'])
  assert.deepEqual(internals.SEARCH_OPTIONS, ['deepseek', 'tavily', 'jina', 'firecrawl'])
  assert.deepEqual(internals.FETCH_OPTIONS, ['jina', 'local', 'firecrawl'])

  assert.equal(internals.readJinaReaderKeyMode({ value: { jinaReaderKeyMode: 'api' } }), 'api')
  assert.equal(internals.readJinaReaderKeyMode({ value: { jinaReaderKeyMode: 'nope' } }), 'anonymous')
  assert.equal(internals.readJinaReaderKeyMode({ value: {} }), 'anonymous')

  assert.equal(internals.readFallback({ value: { fetchFallbackToLocal: false } }), false)
  assert.equal(internals.readFallback({ value: {} }), true)

  assert.equal(internals.isWritable({ status: 'ready', writable: true }), true)
  assert.equal(internals.isWritable({ status: 'loading', writable: true }), false)
  assert.equal(internals.isWritable({ status: 'ready', writable: false }), false)

  assert.deepEqual(internals.keyRefs({ value: {} }), {
    tavily: 'TAVILY_API_KEY',
    jina: 'JINA_API_KEY',
    firecrawl: 'FIRECRAWL_API_KEY',
  })
  assert.equal(internals.keyRefs({ value: { jinaApiKeyEnv: 'MY_JINA' } }).jina, 'MY_JINA')
})

test('warning dots follow the keys that actually block a provider', async () => {
  const { module } = await loadBundle()
  const { missingKeyProvider } = module.__internals
  const base = {
    searchSource: 'deepseek',
    fetchSource: 'jina',
    jinaMode: 'anonymous',
    keyStates: { tavily: 'unset', jina: 'unset', firecrawl: 'unset' },
  }
  assert.equal(missingKeyProvider(base), null)
  assert.equal(missingKeyProvider({ ...base, searchSource: 'tavily' }), 'tavily')
  assert.equal(missingKeyProvider({ ...base, searchSource: 'jina' }), 'jina')
  // Jina Reader stays free: only `api` mode needs the key.
  assert.equal(missingKeyProvider({ ...base, fetchSource: 'jina', jinaMode: 'api' }), 'jinaApi')
  assert.equal(missingKeyProvider({ ...base, fetchSource: 'jina', jinaMode: 'auto' }), null)
  // Firecrawl works anonymously, so it never raises the dot.
  assert.equal(missingKeyProvider({ ...base, searchSource: 'firecrawl', fetchSource: 'firecrawl' }), null)
  assert.equal(missingKeyProvider({ ...base, keyStates: { tavily: 'set', jina: 'set', firecrawl: 'set' } }), null)
})

test('the search popover model carries providers and Tavily depth only', async () => {
  const { module } = await loadBundle()
  const { searchMenuModel } = module.__internals
  const state = {
    searchSource: 'tavily',
    fetchSource: 'jina',
    depth: 'advanced',
    jinaMode: 'anonymous',
    fallback: true,
    keyStates: { tavily: 'unset', jina: 'unset', firecrawl: 'set' },
  }
  const model = searchMenuModel(state)
  assert.deepEqual(model.providers.map((row) => row.id), ['deepseek', 'tavily', 'jina', 'firecrawl'])
  assert.deepEqual(model.providers.map((row) => row.selected), [false, true, false, false])
  assert.deepEqual(model.providers.map((row) => row.keyMissing), [false, true, true, false])
  assert.deepEqual(model.depths.map((row) => row.id), ['basic', 'advanced', 'fast', 'ultra-fast'])
  assert.deepEqual(model.depths.map((row) => row.selected), [false, true, false, false])

  for (const source of ['deepseek', 'jina', 'firecrawl']) {
    assert.deepEqual(searchMenuModel({ ...state, searchSource: source }).depths, [])
  }
})

test('the fetch popover model carries providers, Jina mode, and the fallback', async () => {
  const { module } = await loadBundle()
  const { fetchMenuModel } = module.__internals
  const jina = fetchMenuModel({
    searchSource: 'deepseek',
    fetchSource: 'jina',
    depth: 'basic',
    jinaMode: 'auto',
    fallback: false,
    keyStates: { tavily: 'set', jina: 'unset', firecrawl: 'unset' },
  })
  assert.deepEqual(jina.providers.map((row) => row.id), ['jina', 'local', 'firecrawl'])
  assert.deepEqual(jina.providers.map((row) => row.selected), [true, false, false])
  assert.deepEqual(jina.jinaModes.map((row) => row.id), ['anonymous', 'auto', 'api'])
  assert.deepEqual(jina.jinaModes.map((row) => row.selected), [false, true, false])
  assert.equal(jina.fallback, false)
  assert.equal(jina.fallbackApplies, true)

  const local = fetchMenuModel({
    searchSource: 'deepseek',
    fetchSource: 'local',
    depth: 'basic',
    jinaMode: 'anonymous',
    fallback: true,
    keyStates: { tavily: 'set', jina: 'set', firecrawl: 'unset' },
  })
  assert.deepEqual(local.jinaModes, [])
  assert.equal(local.fallbackApplies, false)
  assert.equal(local.providers.find((row) => row.id === 'firecrawl').keyMissing, true)
})

/** Visit every element of the fake element tree the bundle builds. */
function walkElements(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, visit)
    return
  }
  if (typeof node !== 'object') return
  visit(node)
  walkElements(node.children, visit)
}

/** Render the composer control once against the given snapshot. */
async function renderComposer(options) {
  const { module } = await loadBundle()
  const { context, registrations } = makeContext(options)
  module.apply(context)
  const entry = registrations.find((row) => row.registration.name === 'conversation.input.left')
  assert.ok(entry, 'composer control was not registered')
  return entry.component(entry.registration.inject())
}

test('the composer shows one pill per capability, naming the current provider', async () => {
  const tree = await renderComposer({ active: 'tavily', fetchSource: 'firecrawl' })
  const triggers = []
  const values = []
  let menu = null
  walkElements(tree, (element) => {
    if (element.props && element.props['data-trigger']) {
      triggers.push(element.props['data-trigger'])
      values.push(element.props['data-value'])
    }
    if (element.props && element.props.role === 'menu') menu = element
  })
  assert.deepEqual(triggers, ['search', 'fetch'])
  assert.deepEqual(values, ['tavily', 'firecrawl'])
  assert.equal(menu, null, 'popovers must stay closed until clicked')
})

test('the pills reflect the defaults and disable themselves when read-only', async () => {
  const defaults = await renderComposer({})
  const values = []
  walkElements(defaults, (element) => {
    if (element.props && element.props['data-trigger']) values.push(element.props['data-value'])
  })
  assert.deepEqual(values, ['deepseek', 'jina'])

  const readonly = await renderComposer({ writable: false })
  const disabled = []
  walkElements(readonly, (element) => {
    if (element.props && element.props['data-trigger']) disabled.push(element.props.disabled)
  })
  assert.deepEqual(disabled, [true, true])
})

test('flips the popover above when the composer sits at the bottom', async () => {
  const { module } = await loadBundle()
  const { menuPlacementFor } = module.__internals
  const viewport = { width: 1200, height: 800 }

  // 700..730 leaves only 56px below after the gap and margin: not enough for 84.
  const flipped = menuPlacementFor({ top: 700, bottom: 730, right: 900 }, viewport, 84)
  assert.equal(flipped.above, true)
  assert.ok(flipped.top < 700)
  assert.ok(flipped.top >= 8)

  // Room below: opens downward, directly under the trigger plus the gap.
  const below = menuPlacementFor({ top: 300, bottom: 330, right: 900 }, viewport, 84)
  assert.equal(below.above, false)
  assert.equal(below.top, 336)

  // Clamped inside the right edge.
  const right = menuPlacementFor({ top: 100, bottom: 130, right: 1199 }, viewport, 84)
  assert.equal(right.left, viewport.width - 320 - 8)
  assert.equal(right.width, 320)

  // Neither side fits: clamped to the top margin so the rows stay reachable
  // through the menu's own scrolling.
  const short = menuPlacementFor({ top: 10, bottom: 40, right: 900 }, { width: 1200, height: 60 }, 84)
  assert.equal(short.top, 8)

  // The size object carries both dimensions for the two wide popovers.
  const sized = menuPlacementFor({ top: 600, bottom: 630, right: 900 }, viewport, { width: 320, height: 360 })
  assert.equal(sized.above, true)
  assert.equal(sized.width, 320)
  assert.equal(sized.left, 900 - 320)
})
