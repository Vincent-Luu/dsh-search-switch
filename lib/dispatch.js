/**
 * Dispatchers for the two web capability seams.
 *
 * The web service resolves its provider at call time from its own selection
 * config (`web.config.searchProvider` / `web.config.fetchProvider` since DSH
 * 0.2.1-rc.2, plain `searchProviderId` / `fetchProviderId` before that). This
 * plugin pins each selection to the one provider it registers per capability,
 * and those providers pick the real backend per call from the plugin's live
 * config. That keeps the user-visible switch immediate while `web_search` /
 * `web_fetch` keep their schemas and rendering untouched.
 *
 * Search deliberately never re-implements a shipped backend: it delegates to the
 * provider the composition already registered under the configured id, so
 * authentication, endpoint overrides, and result mapping stay owned by
 * `@deepseek-ai/dsh-web-search-deepseek` (native, LLM-backed) or
 * `@deepseek-ai/dsh-web-deepseek-api` (official Search API). The local fetcher is
 * delegated the same way, to whatever provider `localFetchProviderId` names.
 */

/** The one provider id this plugin registers into each seam registry. */
export const SWITCH_PROVIDER_ID = 'search-switch'
/** Search backends this dispatcher understands. */
export const SEARCH_SOURCES = ['deepseek', 'deepseek-api', 'tavily', 'jina', 'firecrawl']
/** Fetch backends this dispatcher understands. */
export const FETCH_SOURCES = ['jina', 'local', 'deepseek-api', 'firecrawl']

/**
 * Create the dispatching search provider.
 *
 * @param spec - injected seams.
 * @param spec.id - provider id to register under.
 * @param spec.getActive - thunk reading the live `active` config value.
 * @param spec.getNative - thunk returning the registered native provider, if any.
 * @param spec.nativeProviderId - thunk returning the configured native provider id.
 * @param spec.getApiSearch - thunk returning the official Search API provider, if any.
 * @param spec.searchApiProviderId - thunk returning the configured Search API id.
 * @param spec.listProviderIds - thunk listing every registered search provider id.
 * @param spec.tavily - the private Tavily provider.
 * @param spec.jina - the private Jina provider.
 * @param spec.firecrawl - the private Firecrawl provider.
 * @param spec.WebError - the seam's error class.
 * @returns the provider registered with `ctx.web`.
 */
export function createSearchDispatcher(spec) {
  const { WebError } = spec
  const id = spec.id ?? SWITCH_PROVIDER_ID

  /** Delegate to one registered provider, or explain exactly what is missing. */
  const delegate = (provider, expected, hint, request, signal) => {
    if (provider === undefined || provider === null || typeof provider.search !== 'function') {
      const known = spec.listProviderIds()
      throw new WebError(
        `The search source resolves to "${expected}", but no provider is registered under that id `
        + `(registered: ${known.length > 0 ? known.join(', ') : 'none'}). ${hint}`,
        'WEB_PROVIDER_CONFIGURED_MISSING',
      )
    }
    return provider.search(request, signal)
  }

  return {
    id,

    /**
     * Always selectable: the seam has already pinned this provider, so reporting
     * unavailable here would only replace our precise error with the seam's
     * generic WEB_PROVIDER_CONFIGURED_UNAVAILABLE.
     * @returns true.
     */
    available() {
      return true
    },

    /**
     * Route one search to the configured backend.
     * @param request - the seam's normalized request.
     * @param signal - optional cancellation forwarded to the backend.
     * @returns the backend's normalized result.
     */
    async search(request, signal) {
      const raw = spec.getActive()
      const source = normaliseSource(raw)

      if (source === 'tavily') return spec.tavily.search(request, signal)
      if (source === 'jina') return spec.jina.search(request, signal)
      if (source === 'firecrawl') return spec.firecrawl.search(request, signal)

      if (source === 'deepseek') {
        return delegate(
          spec.getNative(),
          spec.nativeProviderId(),
          'Mount @deepseek-ai/dsh-web-search-deepseek, or point nativeProviderId at the right id in this plugin\'s config.',
          request,
          signal,
        )
      }
      if (source === 'deepseek-api') {
        return delegate(
          spec.getApiSearch(),
          spec.searchApiProviderId(),
          'Mount @deepseek-ai/dsh-web-deepseek-api (the web-deepseek-api row), point searchApiProviderId at the right id, '
          + 'and make sure DEEPSEEK_API_KEY is configured.',
          request,
          signal,
        )
      }

      throw new WebError(
        `Unknown search source ${JSON.stringify(String(raw))}; dsh-search-switch supports only `
        + `${SEARCH_SOURCES.join(', ')}. Fix the "active" config value or switch the search provider from the composer bar.`,
        'WEB_PROVIDER_UNAVAILABLE',
      )
    },
  }
}

/**
 * Create the dispatching fetch provider.
 *
 * The selected third-party or official-API fetcher is tried first; when it fails
 * for any reason other than cancellation and the caller enabled the fallback,
 * the local DSH fetcher runs instead. The local provider is never wrapped in a
 * fallback of its own, and a fully failed request preserves the first failure's
 * code so callers keep routing on the original cause.
 *
 * @param spec - injected seams.
 * @param spec.id - provider id to register under.
 * @param spec.getActive - thunk reading the live `fetchSource` config value.
 * @param spec.getLocal - thunk returning the registered local fetch provider.
 * @param spec.localFetchProviderId - thunk returning the configured local id.
 * @param spec.getApiFetch - thunk returning the official Fetch API provider, if any.
 * @param spec.apiFetchProviderId - thunk returning the configured Fetch API id.
 * @param spec.listProviderIds - thunk listing every registered fetch provider id.
 * @param spec.jina - the private Jina provider.
 * @param spec.firecrawl - the private Firecrawl provider.
 * @param spec.fallbackToLocal - thunk returning whether the fallback is enabled.
 * @param spec.WebError - the seam's error class.
 * @returns the provider registered with `ctx.web`.
 */
export function createFetchDispatcher(spec) {
  const { WebError } = spec
  const id = spec.id ?? SWITCH_PROVIDER_ID

  /** Delegate to the registered local fetcher, or explain why it is missing. */
  const delegateLocal = async (request, signal) => {
    const local = spec.getLocal()
    if (local === undefined || local === null || typeof local.fetch !== 'function') {
      const expected = spec.localFetchProviderId()
      const known = spec.listProviderIds()
      throw new WebError(
        `The fetch source is set to the local provider, but no provider is registered under "${expected}" `
        + `(registered: ${known.length > 0 ? known.join(', ') : 'none'}). `
        + 'Mount @deepseek-ai/dsh-web-fetch-http, or point localFetchProviderId at the right id in this plugin\'s config.',
        'WEB_PROVIDER_CONFIGURED_MISSING',
      )
    }
    return local.fetch(request, signal)
  }

  return {
    id,

    /**
     * Always selectable for the same reason as the search dispatcher.
     * @returns true.
     */
    available() {
      return true
    },

    /**
     * Route one fetch to the configured backend, with an optional local fallback.
     * @param request - the seam's normalized request (`{ url }`).
     * @param signal - optional cancellation forwarded to the backend.
     * @returns the backend's normalized result.
     */
    async fetch(request, signal) {
      const raw = spec.getActive()
      const source = normaliseSource(raw)

      if (source === 'local') return delegateLocal(request, signal)

      let provider
      if (source === 'jina') provider = spec.jina
      else if (source === 'firecrawl') provider = spec.firecrawl
      else if (source === 'deepseek-api') provider = spec.getApiFetch()

      if (source === 'deepseek-api' && (provider === undefined || provider === null || typeof provider.fetch !== 'function')) {
        const expected = spec.apiFetchProviderId()
        const known = spec.listProviderIds()
        throw new WebError(
          `The fetch source resolves to "${expected}", but no provider is registered under that id `
          + `(registered: ${known.length > 0 ? known.join(', ') : 'none'}). `
          + 'Mount @deepseek-ai/dsh-web-deepseek-api (the web-deepseek-api row), point fetchApiProviderId at the right id, '
          + 'and make sure DEEPSEEK_API_KEY is configured.',
          'WEB_PROVIDER_CONFIGURED_MISSING',
        )
      }
      if (provider === undefined || typeof provider.fetch !== 'function') {
        throw new WebError(
          `Unknown fetch source ${JSON.stringify(String(raw))}; dsh-search-switch supports only `
          + `${FETCH_SOURCES.join(', ')}. Fix the "fetchSource" config value or switch the fetch provider from the composer bar.`,
          'WEB_PROVIDER_UNAVAILABLE',
        )
      }

      try {
        return await provider.fetch(request, signal)
      } catch (error) {
        if (!isFallbackEligible(error, signal, spec.fallbackToLocal)) throw error
        const local = spec.getLocal()
        if (local === undefined || local === null || typeof local.fetch !== 'function') throw error
        try {
          return await local.fetch(request, signal)
        } catch (localError) {
          const code = error !== null && typeof error === 'object' && typeof error.code === 'string'
            ? error.code
            : 'WEB_PROVIDER_ERROR'
          const original = error instanceof Error ? error.message : String(error)
          const fallback = localError instanceof Error ? localError.message : String(localError)
          throw new WebError(
            `${original}\n\nThe local fallback fetch also failed: ${fallback}`,
            code,
            { cause: localError },
          )
        }
      }
    },
  }
}

/**
 * Normalise a raw source value.
 * @param value - the configured value.
 * @returns the lower-cased trimmed string, unchanged when it is not a string.
 */
export function normaliseSource(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}

/**
 * Whether a failed non-local fetch may be retried through the local fetcher.
 *
 * Cancellation always wins: an aborted call must not start a second request.
 * @param error - the failure thrown by the selected provider.
 * @param signal - the caller's abort signal.
 * @param fallbackToLocal - thunk returning the configured fallback switch.
 */
function isFallbackEligible(error, signal, fallbackToLocal) {
  if (signal !== undefined && signal.aborted === true) return false
  if (error !== null && typeof error === 'object' && error.code === 'WEB_ABORTED') return false
  if (typeof fallbackToLocal !== 'function') return false
  return fallbackToLocal() !== false
}
