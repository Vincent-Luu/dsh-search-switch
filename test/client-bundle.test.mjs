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
    status: 'ready',
    writable: true,
    revision: 1,
    value: {
      active: options.active ?? 'deepseek',
      tavilySearchDepth: options.depth ?? 'basic',
      tavilyApiKeyEnv: 'TAVILY_API_KEY',
    },
  }
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => true,
  }
  const credentials = {
    describe: async () => ({ ok: true, value: { TAVILY_API_KEY: { configured: true, writable: true } } }),
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
  assert.equal(typeof injected.t('label.source'), 'string')
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
  const { readSource, readDepth, isWritable, showsDepth, apiKeyRef } = module.__internals

  assert.equal(readSource({ value: { active: 'tavily' } }), 'tavily')
  assert.equal(readSource({ value: { active: 'bing' } }), 'deepseek')
  assert.equal(readSource(null), 'deepseek')

  assert.equal(readDepth({ value: { tavilySearchDepth: 'advanced' } }), 'advanced')
  // Config-only depths display as Basic without rewriting the stored value.
  assert.equal(readDepth({ value: { tavilySearchDepth: 'fast' } }), 'basic')
  assert.equal(readDepth(undefined), 'basic')

  assert.equal(isWritable({ status: 'ready', writable: true }), true)
  assert.equal(isWritable({ status: 'loading', writable: true }), false)
  assert.equal(isWritable({ status: 'ready', writable: false }), false)

  assert.equal(showsDepth({ value: { active: 'tavily' } }), true)
  assert.equal(showsDepth({ value: { active: 'deepseek' } }), false)
  assert.equal(showsDepth({ value: {} }), false)

  assert.equal(apiKeyRef({ value: { tavilyApiKeyEnv: 'MY_TAVILY_KEY' } }), 'MY_TAVILY_KEY')
  assert.equal(apiKeyRef({ value: {} }), 'TAVILY_API_KEY')
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

test('hides the depth group while the native source is active', async () => {
  const tree = await renderComposer({ active: 'deepseek' })
  const groups = []
  const values = []
  walkElements(tree, (element) => {
    if (element.props && element.props['data-group']) groups.push(element.props['data-group'])
    if (element.type === 'button' && element.props && element.props['data-value']) {
      values.push(element.props['data-value'])
    }
  })
  assert.deepEqual(groups, ['source'])
  assert.deepEqual(values, ['deepseek', 'tavily'])
})

test('shows the depth group only for Tavily, with both segments', async () => {
  const tree = await renderComposer({ active: 'tavily' })
  const groups = []
  const values = []
  walkElements(tree, (element) => {
    if (element.props && element.props['data-group']) groups.push(element.props['data-group'])
    if (element.type === 'button' && element.props && element.props['data-value']) {
      values.push(element.props['data-value'])
    }
  })
  assert.deepEqual(groups, ['source', 'depth'])
  assert.deepEqual(values, ['deepseek', 'tavily', 'basic', 'advanced'])
})
