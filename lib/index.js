/**
 * `dsh-search-switch` host half.
 *
 * Mounts one dispatching provider per web capability (search and fetch) and pins
 * both seams' runtime selection to them, so the browser half can flip between
 * backends without a reload. Every user-facing value lives in this plugin's
 * Config and is edited live by the browser half through the host's settings
 * forms (`.volatile()` fields), which means the host also persists the choice in
 * the profile's `cordis.patch.yml` — this plugin owns no storage.
 *
 * @module dsh-search-switch
 */

import z from '@deepseek-ai/schemastery'
import { WebError } from '@deepseek-ai/dsh-web'
import { createApiKeyResolver, toCredentialRef } from './credentials.js'
import {
  FETCH_SOURCES,
  SEARCH_SOURCES,
  SWITCH_PROVIDER_ID,
  createFetchDispatcher,
  createSearchDispatcher,
} from './dispatch.js'
import {
  FIRECRAWL_DEFAULT_BASE_URL,
  FIRECRAWL_DEFAULT_MAX_AGE_MS,
  FIRECRAWL_DEFAULT_TIMEOUT_MS,
} from './firecrawl-mapping.js'
import { createFirecrawlProvider } from './firecrawl-provider.js'
import {
  JINA_DEFAULT_READER_URL,
  JINA_DEFAULT_SEARCH_URL,
  JINA_DEFAULT_TIMEOUT_SECONDS,
} from './jina-mapping.js'
import { createJinaProvider } from './jina-provider.js'
import {
  TAVILY_DEFAULT_BASE_URL,
  TAVILY_DEFAULT_CHUNKS_PER_SOURCE,
  TAVILY_DEFAULT_SEARCH_DEPTH,
  TAVILY_DEFAULT_TOPIC,
} from './tavily-mapping.js'
import { createTavilyProvider } from './tavily-provider.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'search-switch'

/** The web seam this plugin dispatches into. */
export const inject = ['web']

/** Native provider id the base composition registers. */
export const DEFAULT_NATIVE_PROVIDER_ID = 'deepseek-official'

/** Local fetch provider id the base composition registers. */
export const DEFAULT_LOCAL_FETCH_PROVIDER_ID = 'http'

/** Official DeepSeek Search API provider id registered by `web-deepseek-api`. */
export const DEFAULT_SEARCH_API_PROVIDER_ID = 'deepseek-search-api'

/** Official DeepSeek Fetch API provider id registered by `web-deepseek-api`. */
export const DEFAULT_FETCH_API_PROVIDER_ID = 'deepseek-fetch-api'

/**
 * Symbol the host uses to write a volatile config reference in place.
 * `Symbol.for` keeps this working across ESM/CJS copies of the library.
 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** Default credential reference for the Tavily key. */
export const DEFAULT_TAVILY_API_KEY_ENV = 'TAVILY_API_KEY'

/** Default credential reference for the Jina key. */
export const DEFAULT_JINA_API_KEY_ENV = 'JINA_API_KEY'

/** Default credential reference for the Firecrawl key. */
export const DEFAULT_FIRECRAWL_API_KEY_ENV = 'FIRECRAWL_API_KEY'

/**
 * Live configuration.
 *
 * Every user-facing switch is volatile, so the browser half can write it through
 * the settings forms and the next operation reads the new value in place — no
 * fiber reload, no provider re-registration, no flicker.
 */
export const Config = z.object({
  // --- search axis -----------------------------------------------------
  active: z.union(SEARCH_SOURCES).default('deepseek').volatile(),
  nativeProviderId: z.string().default(DEFAULT_NATIVE_PROVIDER_ID),
  searchApiProviderId: z.string().default(DEFAULT_SEARCH_API_PROVIDER_ID),
  tavilyApiKeyEnv: z.string().role('credential-ref').default(DEFAULT_TAVILY_API_KEY_ENV).volatile(),
  tavilyBaseURL: z.string().volatile(),
  tavilySearchDepth: z.union(['basic', 'advanced', 'fast', 'ultra-fast']).default(TAVILY_DEFAULT_SEARCH_DEPTH).volatile(),
  tavilyTopic: z.union(['general', 'news', 'finance']).default(TAVILY_DEFAULT_TOPIC).volatile(),
  tavilyAnswer: z.union(['off', 'basic', 'advanced']).default('off').volatile(),
  tavilyChunksPerSource: z.number().step(1).min(1).max(3).default(TAVILY_DEFAULT_CHUNKS_PER_SOURCE).volatile(),
  tavilyIncludePublishedDate: z.boolean().default(true).volatile(),
  tavilyMaxResults: z.number().step(1).min(1).max(20).volatile(),

  // --- fetch axis ------------------------------------------------------
  fetchSource: z.union(FETCH_SOURCES).default('jina').volatile(),
  fetchFallbackToLocal: z.boolean().default(true).volatile(),
  localFetchProviderId: z.string().default(DEFAULT_LOCAL_FETCH_PROVIDER_ID),
  fetchApiProviderId: z.string().default(DEFAULT_FETCH_API_PROVIDER_ID),

  // --- Jina AI ---------------------------------------------------------
  jinaApiKeyEnv: z.string().role('credential-ref').default(DEFAULT_JINA_API_KEY_ENV).volatile(),
  jinaReaderURL: z.string().default(JINA_DEFAULT_READER_URL).volatile(),
  jinaSearchURL: z.string().default(JINA_DEFAULT_SEARCH_URL).volatile(),
  jinaReaderKeyMode: z.union(['anonymous', 'auto', 'api']).default('anonymous').volatile(),
  jinaEngine: z.union(['auto', 'browser', 'curl']).default('auto').volatile(),
  jinaTimeoutSeconds: z.number().step(1).min(1).max(180).default(JINA_DEFAULT_TIMEOUT_SECONDS).volatile(),
  jinaRetainImages: z.union(['all', 'none', 'alt']).default('none').volatile(),
  jinaRetainLinks: z.union(['all', 'none', 'text']).default('all').volatile(),
  jinaLinksSummary: z.boolean().default(false).volatile(),
  jinaBypassCache: z.boolean().default(false).volatile(),
  jinaRespondWith: z.union(['default', 'markdown']).default('default').volatile(),
  jinaTargetSelector: z.string().default('').volatile(),
  jinaSite: z.string().default('').volatile(),

  // --- Firecrawl -------------------------------------------------------
  firecrawlApiKeyEnv: z.string().role('credential-ref').default(DEFAULT_FIRECRAWL_API_KEY_ENV).volatile(),
  firecrawlBaseURL: z.string().default(FIRECRAWL_DEFAULT_BASE_URL).volatile(),
  firecrawlProxy: z.union(['auto', 'basic', 'enhanced']).default('auto').volatile(),
  firecrawlOnlyMainContent: z.boolean().default(true).volatile(),
  firecrawlTimeoutMs: z.number().step(1).min(1000).max(25000).default(FIRECRAWL_DEFAULT_TIMEOUT_MS).volatile(),
  firecrawlMaxAgeMs: z.number().step(1).min(0).default(FIRECRAWL_DEFAULT_MAX_AGE_MS).volatile(),
  firecrawlWaitFor: z.number().step(1).min(0).max(20000).default(0).volatile(),
  firecrawlBlockAds: z.boolean().default(true).volatile(),
  firecrawlSearchScrape: z.boolean().default(false).volatile(),

  // --- shared bounds ---------------------------------------------------
  fetchMaxChars: z.number().step(1).min(1000).max(200000).default(100000).volatile(),
  snippetMaxChars: z.number().step(1).min(0).max(5000).default(800).volatile(),
})

/**
 * Mount both dispatching providers and take over each seam's selection.
 * @param ctx - host context with the `web` service.
 * @param config - the live plugin configuration.
 */
export function apply(ctx, config) {
  const nativeProviderId = () => readValue(config.nativeProviderId) || DEFAULT_NATIVE_PROVIDER_ID
  const localFetchProviderId = () => readValue(config.localFetchProviderId) || DEFAULT_LOCAL_FETCH_PROVIDER_ID
  const searchApiProviderId = () => readValue(config.searchApiProviderId) || DEFAULT_SEARCH_API_PROVIDER_ID
  const fetchApiProviderId = () => readValue(config.fetchApiProviderId) || DEFAULT_FETCH_API_PROVIDER_ID
  const resolveApiKey = createApiKeyResolver(ctx)

  const tavily = createTavilyProvider({
    WebError,
    fetchImpl: (input, init) => fetch(input, init),
    options: () => resolveTavilyOptions(config, resolveApiKey),
  })
  const jina = createJinaProvider({
    WebError,
    fetchImpl: (input, init) => fetch(input, init),
    options: () => resolveJinaOptions(config, resolveApiKey),
  })
  const firecrawl = createFirecrawlProvider({
    WebError,
    fetchImpl: (input, init) => fetch(input, init),
    options: () => resolveFirecrawlOptions(config, resolveApiKey),
  })

  const searchDispatcher = createSearchDispatcher({
    id: SWITCH_PROVIDER_ID,
    getActive: () => readValue(config.active),
    getNative: () => ctx.web.searchProviders.get(nativeProviderId()),
    nativeProviderId,
    getApiSearch: () => ctx.web.searchProviders.get(searchApiProviderId()),
    searchApiProviderId,
    listProviderIds: () => [...ctx.web.searchProviders.keys()],
    tavily,
    jina,
    firecrawl,
    WebError,
  })
  const fetchDispatcher = createFetchDispatcher({
    id: SWITCH_PROVIDER_ID,
    getActive: () => readValue(config.fetchSource),
    getLocal: () => ctx.web.fetchProviders.get(localFetchProviderId()),
    localFetchProviderId,
    getApiFetch: () => ctx.web.fetchProviders.get(fetchApiProviderId()),
    apiFetchProviderId: fetchApiProviderId,
    listProviderIds: () => [...ctx.web.fetchProviders.keys()],
    jina,
    firecrawl,
    fallbackToLocal: () => readValue(config.fetchFallbackToLocal),
    WebError,
  })

  ctx.web.registerSearchProvider(searchDispatcher)
  let fetchRegistered = false
  if (typeof ctx.web.registerFetchProvider === 'function') {
    try {
      ctx.web.registerFetchProvider(fetchDispatcher)
      fetchRegistered = true
    } catch (error) {
      console.warn('[dsh-search-switch] registering the fetch dispatcher failed; the fetch switch is disabled.', error)
    }
  } else {
    console.warn(
      '[dsh-search-switch] this host does not expose web.registerFetchProvider, '
      + 'so the fetch switch is disabled and web_fetch keeps using the host-configured provider.',
    )
  }

  /** The seam's own selection config field, when this host exposes one. */
  const selectionRef = (field) => {
    try {
      const selection = ctx.web !== null && typeof ctx.web === 'object' ? ctx.web.config : undefined
      const ref = selection !== null && typeof selection === 'object' ? selection[field] : undefined
      return ref !== null && typeof ref === 'object'
        && typeof ref.get === 'function'
        && typeof ref[VOLATILE_WRITE] === 'function'
        ? ref
        : undefined
    } catch {
      return undefined
    }
  }

  const warnUnpinnable = (field, legacyField, capability) => {
    console.warn(
      `[dsh-search-switch] this host exposes no writable web selection `
      + `(neither web.config.${field} nor web.${legacyField}), so the ${capability} switch has no effect. `
      + `Pin ${field}: ${SWITCH_PROVIDER_ID} on the web row instead.`,
    )
  }

  const restore = []
  const pin = (field, legacyField, capability, defaultId) => {
    const ref = selectionRef(field)
    if (ref !== undefined) {
      let previous
      try {
        previous = ref.get()
      } catch {
        previous = undefined
      }
      const restoreValue = typeof previous === 'string' && previous.length > 0 && previous !== SWITCH_PROVIDER_ID
        ? previous
        : defaultId
      try {
        ref[VOLATILE_WRITE](SWITCH_PROVIDER_ID)
      } catch (error) {
        console.warn(
          `[dsh-search-switch] writing web.config.${field} failed, so the ${capability} switch has no effect.`,
          error,
        )
        return
      }
      if (ref.get() !== SWITCH_PROVIDER_ID) {
        warnUnpinnable(field, legacyField, capability)
        return
      }
      restore.push({ kind: 'config', ref, value: restoreValue })
      return
    }

    // Legacy seam (DSH <= 0.2.1-rc.1): selection is a writable plain property.
    let previous
    try {
      previous = ctx.web[legacyField]
    } catch {
      previous = undefined
    }
    try {
      ctx.web[legacyField] = SWITCH_PROVIDER_ID
    } catch {
      warnUnpinnable(field, legacyField, capability)
      return
    }
    if (ctx.web[legacyField] !== SWITCH_PROVIDER_ID) {
      warnUnpinnable(field, legacyField, capability)
      return
    }
    // The previous value may itself be this plugin's id after a hot reload;
    // clearing it lets the seam fall back to its own auto-selection rules
    // instead of failing with WEB_PROVIDER_CONFIGURED_MISSING.
    restore.push({
      kind: 'property',
      field: legacyField,
      value: previous === SWITCH_PROVIDER_ID ? undefined : previous,
    })
  }
  pin('searchProvider', 'searchProviderId', 'search', nativeProviderId())
  if (fetchRegistered) pin('fetchProvider', 'fetchProviderId', 'fetch', localFetchProviderId())

  if (restore.length === 0) return

  ctx.effect(() => () => {
    for (const entry of restore) {
      try {
        if (entry.kind === 'config') entry.ref[VOLATILE_WRITE](entry.value)
        else ctx.web[entry.field] = entry.value
      } catch {
        // A disposed service is already unreachable; nothing to restore.
      }
    }
  }, 'dsh-search-switch: restore web provider selection')
}

/**
 * Snapshot the Tavily options for the next operation.
 * @param config - the live plugin configuration.
 * @param resolveApiKey - the shared key resolver.
 * @returns the options thunk payload.
 */
function resolveTavilyOptions(config, resolveApiKey) {
  const apiKeyEnv = readValue(config.tavilyApiKeyEnv) || DEFAULT_TAVILY_API_KEY_ENV
  return {
    apiKeyEnv,
    resolveApiKey: (reference) => resolveApiKey(toCredentialRef(reference, DEFAULT_TAVILY_API_KEY_ENV)),
    baseURL: readValue(config.tavilyBaseURL) || TAVILY_DEFAULT_BASE_URL,
    searchDepth: readValue(config.tavilySearchDepth),
    topic: readValue(config.tavilyTopic),
    answer: readValue(config.tavilyAnswer),
    chunksPerSource: readValue(config.tavilyChunksPerSource),
    includePublishedDate: readValue(config.tavilyIncludePublishedDate),
    maxResults: readValue(config.tavilyMaxResults),
  }
}

/**
 * Snapshot the Jina options for the next operation.
 * @param config - the live plugin configuration.
 * @param resolveApiKey - the shared key resolver.
 * @returns the options thunk payload.
 */
function resolveJinaOptions(config, resolveApiKey) {
  return {
    apiKeyEnv: readValue(config.jinaApiKeyEnv) || DEFAULT_JINA_API_KEY_ENV,
    resolveApiKey: (reference) => resolveApiKey(toCredentialRef(reference, DEFAULT_JINA_API_KEY_ENV)),
    readerURL: readValue(config.jinaReaderURL),
    searchURL: readValue(config.jinaSearchURL),
    readerKeyMode: readValue(config.jinaReaderKeyMode),
    engine: readValue(config.jinaEngine),
    timeoutSeconds: readValue(config.jinaTimeoutSeconds),
    retainImages: readValue(config.jinaRetainImages),
    retainLinks: readValue(config.jinaRetainLinks),
    linksSummary: readValue(config.jinaLinksSummary),
    bypassCache: readValue(config.jinaBypassCache),
    respondWith: readValue(config.jinaRespondWith),
    targetSelector: readValue(config.jinaTargetSelector),
    site: readValue(config.jinaSite),
    snippetMaxChars: readValue(config.snippetMaxChars),
    maxChars: readValue(config.fetchMaxChars),
  }
}

/**
 * Snapshot the Firecrawl options for the next operation.
 * @param config - the live plugin configuration.
 * @param resolveApiKey - the shared key resolver.
 * @returns the options thunk payload.
 */
function resolveFirecrawlOptions(config, resolveApiKey) {
  return {
    apiKeyEnv: readValue(config.firecrawlApiKeyEnv) || DEFAULT_FIRECRAWL_API_KEY_ENV,
    resolveApiKey: (reference) => resolveApiKey(toCredentialRef(reference, DEFAULT_FIRECRAWL_API_KEY_ENV)),
    baseURL: readValue(config.firecrawlBaseURL),
    proxy: readValue(config.firecrawlProxy),
    onlyMainContent: readValue(config.firecrawlOnlyMainContent),
    timeoutMs: readValue(config.firecrawlTimeoutMs),
    maxAgeMs: readValue(config.firecrawlMaxAgeMs),
    waitFor: readValue(config.firecrawlWaitFor),
    blockAds: readValue(config.firecrawlBlockAds),
    searchScrape: readValue(config.firecrawlSearchScrape),
    snippetMaxChars: readValue(config.snippetMaxChars),
    maxChars: readValue(config.fetchMaxChars),
  }
}

/**
 * Read a config field that is either a volatile reference or a plain value.
 * @param value - the config field.
 * @returns the current value.
 */
function readValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}
