/**
 * Source dispatcher for the web search seam.
 *
 * The web service resolves its provider at call time from `ctx.web.searchProviderId`.
 * This plugin pins that selection to the one provider it registers here, and this
 * provider picks the real backend per call from the plugin's live `active` config.
 * That keeps the user-visible switch immediate while `web_search` keeps its
 * schema and rendering untouched.
 *
 * The dispatcher never re-implements the DSH native backend: it delegates to the
 * provider the composition already registered under `nativeProviderId`, so
 * account-token authentication, endpoint overrides, and result mapping stay
 * owned by `@deepseek-ai/dsh-web-search-deepseek`.
 */

/** The one provider id this plugin registers into the seam. */
export const SWITCH_PROVIDER_ID = 'search-switch'
/** Sources this dispatcher understands. */
export const SOURCE_IDS = ['deepseek', 'tavily']

/**
 * Create the dispatching provider.
 *
 * @param spec - injected seams.
 * @param spec.id - provider id to register under.
 * @param spec.getActive - thunk reading the live `active` config value.
 * @param spec.getNative - thunk returning the registered native provider, if any.
 * @param spec.nativeProviderId - thunk returning the configured native provider id.
 * @param spec.listProviderIds - thunk listing every registered search provider id.
 * @param spec.tavily - the private Tavily provider.
 * @param spec.WebError - the seam's error class.
 * @returns the provider registered with `ctx.web`.
 */
export function createSwitchProvider(spec) {
  const { WebError } = spec
  const id = spec.id ?? SWITCH_PROVIDER_ID

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

      if (source === 'deepseek') {
        const native = spec.getNative()
        if (native === undefined || native === null || typeof native.search !== 'function') {
          const expected = spec.nativeProviderId()
          const known = spec.listProviderIds()
          throw new WebError(
            `The search source is set to the DSH native provider, but no provider is registered under "${expected}" `
            + `(registered: ${known.length > 0 ? known.join(', ') : 'none'}). `
            + 'Mount @deepseek-ai/dsh-web-search-deepseek, or point nativeProviderId at the right id in this plugin\'s config.',
            'WEB_PROVIDER_CONFIGURED_MISSING',
          )
        }
        return native.search(request, signal)
      }

      throw new WebError(
        `Unknown search source ${JSON.stringify(String(raw))}; dsh-search-switch supports only `
        + `${SOURCE_IDS.join(' and ')}. Fix the "active" config value or switch the source from the composer bar.`,
        'WEB_PROVIDER_UNAVAILABLE',
      )
    },
  }
}

/**
 * Normalise a raw `active` value.
 * @param value - the configured value.
 * @returns the lower-cased trimmed string, unchanged when it is not a string.
 */
export function normaliseSource(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}
