/**
 * `dsh-search-switch` host half.
 *
 * Mounts one dispatching search provider and pins the web seam's runtime
 * selection to it, so the browser half can flip between the DSH native search
 * backend and Tavily without a reload. Every user-facing value lives in this
 * plugin's Config and is edited live by the browser half through the host's
 * settings forms (`.volatile()` fields), which means the host also persists the
 * choice in the profile's `cordis.patch.yml` — this plugin owns no storage.
 *
 * @module dsh-search-switch
 */

import z from '@deepseek-ai/schemastery'
import { WebError } from '@deepseek-ai/dsh-web'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { SWITCH_PROVIDER_ID, createSwitchProvider } from './dispatch.js'
import { createTavilyProvider } from './tavily-provider.js'
import {
  TAVILY_DEFAULT_BASE_URL,
  TAVILY_DEFAULT_CHUNKS_PER_SOURCE,
  TAVILY_DEFAULT_SEARCH_DEPTH,
  TAVILY_DEFAULT_TOPIC,
} from './tavily-mapping.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'search-switch'

/** The web seam this plugin dispatches into. */
export const inject = ['web']

/** Native provider id the base composition registers. */
export const DEFAULT_NATIVE_PROVIDER_ID = 'deepseek-official'

/** Credential reference the settings page writes when the user supplies a key. */
export const DEFAULT_TAVILY_API_KEY_ENV = 'TAVILY_API_KEY'

/**
 * Live configuration.
 *
 * `active` and every `tavily*` field are volatile, so the browser half can write
 * them through the settings forms and the next search reads the new value in
 * place — no fiber reload, no provider re-registration, no flicker.
 */
export const Config = z.object({
  active: z.union(['deepseek', 'tavily']).default('deepseek').volatile(),
  nativeProviderId: z.string().default(DEFAULT_NATIVE_PROVIDER_ID),
  tavilyApiKeyEnv: z.string().role('credential-ref').default(DEFAULT_TAVILY_API_KEY_ENV).volatile(),
  tavilyBaseURL: z.string().volatile(),
  tavilySearchDepth: z.union(['basic', 'advanced', 'fast', 'ultra-fast']).default(TAVILY_DEFAULT_SEARCH_DEPTH).volatile(),
  tavilyTopic: z.union(['general', 'news', 'finance']).default(TAVILY_DEFAULT_TOPIC).volatile(),
  tavilyAnswer: z.union(['off', 'basic', 'advanced']).default('off').volatile(),
  tavilyChunksPerSource: z.number().step(1).min(1).max(3).default(TAVILY_DEFAULT_CHUNKS_PER_SOURCE).volatile(),
  tavilyIncludePublishedDate: z.boolean().default(true).volatile(),
  tavilyMaxResults: z.number().step(1).min(1).max(20).volatile(),
})

/**
 * Mount the dispatching provider and take over the seam's selection.
 * @param ctx - host context with the `web` service.
 * @param config - the live plugin configuration.
 */
export function apply(ctx, config) {
  const nativeProviderId = () => readValue(config.nativeProviderId) || DEFAULT_NATIVE_PROVIDER_ID

  const tavily = createTavilyProvider({
    WebError,
    fetchImpl: (input, init) => fetch(input, init),
    options: () => resolveTavilyOptions(ctx, config),
  })

  const provider = createSwitchProvider({
    id: SWITCH_PROVIDER_ID,
    getActive: () => readValue(config.active),
    getNative: () => ctx.web.searchProviders.get(nativeProviderId()),
    nativeProviderId,
    listProviderIds: () => [...ctx.web.searchProviders.keys()],
    tavily,
    WebError,
  })

  ctx.web.registerSearchProvider(provider)

  const previous = ctx.web.searchProviderId
  let pinned = false
  try {
    ctx.web.searchProviderId = SWITCH_PROVIDER_ID
    pinned = ctx.web.searchProviderId === SWITCH_PROVIDER_ID
  } catch {
    pinned = false
  }

  if (!pinned) {
    console.warn(
      '[dsh-search-switch] this host does not expose a writable web.searchProviderId, '
      + `so the source switch has no effect. Pin searchProvider: ${SWITCH_PROVIDER_ID} on the web row instead.`,
    )
    return
  }

  ctx.effect(() => () => {
    try {
      // The previous value may itself be this plugin's id after a hot reload;
      // clearing it lets the seam fall back to its own auto-selection rules
      // instead of failing with WEB_PROVIDER_CONFIGURED_MISSING.
      ctx.web.searchProviderId = previous === SWITCH_PROVIDER_ID ? undefined : previous
    } catch {
      // A disposed service is already unreachable; nothing to restore.
    }
  }, 'dsh-search-switch: restore search provider selection')
}

/**
 * Snapshot the Tavily options for the next operation.
 *
 * Every value is read at operation entry, mirroring the in-tree provider, so a
 * settings write between two searches takes effect on the next one.
 * @param ctx - host context.
 * @param config - the live plugin configuration.
 * @returns the options thunk payload.
 */
function resolveTavilyOptions(ctx, config) {
  const apiKeyEnv = readValue(config.tavilyApiKeyEnv) || DEFAULT_TAVILY_API_KEY_ENV
  const reference = toCredentialRef(apiKeyEnv)
  return {
    apiKeyEnv,
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) {
        const resolved = await credentials.resolve(reference)
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) {
          return resolved.value
        }
      }
      const ambient = launchEnvironmentOf(ctx).get(reference)
      return ambient !== undefined && typeof ambient.value === 'string' ? ambient.value : undefined
    },
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
 * Read a config field that is either a volatile reference or a plain value.
 * @param value - the config field.
 * @returns the current value.
 */
function readValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * Parse a credential reference, falling back to the plugin default when the
 * configured name is not a legal reference.
 * @param name - the configured reference name.
 * @returns a reference usable with the credentials service and launch environment.
 */
function toCredentialRef(name) {
  try {
    return credentialRef(name)
  } catch {
    return credentialRef(DEFAULT_TAVILY_API_KEY_ENV)
  }
}
