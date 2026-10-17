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

  const restore = []
  const pin = (field, capability) => {
    let previous
    try {
      previous = ctx.web[field]
    } catch {
      previous = undefined
    }
    let pinned = false
    try {
      ctx.web[field] = SWITCH_PROVIDER_ID
      pinned = ctx.web[field] === SWITCH_PROVIDER_ID
    } catch {
      pinned = false
    }
    if (!pinned) {
      console.warn(
        `[dsh-search-switch] this host does not expose a writable web.${field}, `
        + `so the ${capability} switch has no effect. Pin ${field === 'searchProviderId' ? 'searchProvider' : 'fetchProvider'}: `
        + `${SWITCH_PROVIDER_ID} on the web row instead.`,
      )
      return
    }
    // The previous value may itself be this plugin's id after a hot reload;
    // clearing it lets the seam fall back to its own auto-selection rules
    // instead of failing with WEB_PROVIDER_CONFIGURED_MISSING.
    restore.push([field, previous === SWITCH_PROVIDER_ID ? undefined : previous])
  }
  pin('searchProviderId', 'search')
  if (fetchRegistered) pin('fetchProviderId', 'fetch')

  if (restore.length === 0) return

  ctx.effect(() => () => {
    for (const [field, previous] of restore) {
      try {
        ctx.web[field] = previous
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
