/**
 * Tavily-backed search provider.
 *
 * The provider is deliberately NOT registered into `ctx.web`: it is a private
 * implementation called by the switch dispatcher (see ./dispatch.js). That
 * keeps this plugin from colliding with a community `tavily` provider under
 * `WEB_DUPLICATE_PROVIDER` and keeps the Tavily API key fully under this
 * plugin's own configuration.
 *
 * `fetch` and `WebError` are injected so the wire contract is testable without
 * DSH packages installed.
 */

import {
  TAVILY_DEFAULT_BASE_URL,
  buildTavilyRequest,
  mapTavilyResponse,
  tavilyErrorMessage,
} from './tavily-mapping.js'

/** Stable id used in diagnostics; never registered into the web seam. */
export const TAVILY_PROVIDER_ID = 'tavily'
/** Attribution header sent on every request. Bump with the package version. */
export const TAVILY_USER_AGENT = 'dsh-search-switch/0.1.0'

/**
 * Create the Tavily search provider.
 *
 * @param spec - injected runtime seams.
 * @param spec.WebError - the seam's error class.
 * @param spec.fetchImpl - `fetch`-compatible transport.
 * @param spec.options - thunk returning the options for the NEXT operation,
 *   snapshotted once at each operation's entry so one search never mixes two
 *   configuration revisions.
 * @returns the provider.
 */
export function createTavilyProvider(spec) {
  const { WebError } = spec
  const fetchImpl = spec.fetchImpl ?? fetch
  const readOptions = () => spec.options() ?? {}

  /**
   * Throw the seam's cancellation error, retaining the caller's abort reason.
   * @param signal - the caller's abort signal.
   * @param fallback - a non-abort failure observed at the same time.
   */
  const aborted = (signal, fallback) => new WebError('Tavily search aborted', 'WEB_ABORTED', {
    cause: signal !== undefined && signal.aborted === true ? signal.reason : fallback,
  })

  /**
   * Failures after dispatch name the endpoint so the user knows which setting
   * to correct; a wrong Tavily key and a wrong Tavily endpoint are different
   * fixes.
   * @param endpoint - the endpoint the request used.
   * @param message - the failure message.
   * @param cause - the underlying failure, if any.
   */
  const endpointError = (endpoint, message, cause) => new WebError(
    `${message}\n\nThe Tavily search request used endpoint ${JSON.stringify(endpoint)}. `
    + 'Configure the key under Settings > Plugins > dsh-search-switch (or export TAVILY_API_KEY), '
    + 'and change the endpoint through the plugin\'s tavilyBaseURL config only if that endpoint is intended.',
    'WEB_PROVIDER_ERROR',
    cause === undefined ? undefined : { cause },
  )

  /** Resolve the API key for this operation: literal config, then credentials/env. */
  const resolveApiKey = async (options, signal) => {
    if (typeof options.apiKey === 'string' && options.apiKey.trim().length > 0) return options.apiKey.trim()
    if (typeof options.resolveApiKey === 'function') {
      const resolved = await runAbortable(options.resolveApiKey, signal, aborted)
      if (typeof resolved === 'string' && resolved.trim().length > 0) return resolved.trim()
    }
    const reference = typeof options.apiKeyEnv === 'string' && options.apiKeyEnv.length > 0
      ? options.apiKeyEnv
      : 'TAVILY_API_KEY'
    throw new WebError(
      `Tavily search has no API key for "${reference}"; store it under Settings > Plugins > dsh-search-switch, `
      + 'or export TAVILY_API_KEY in the environment DSH was launched from, '
      + 'or switch the search source back to the DSH native provider.',
      'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  }

  return {
    id: TAVILY_PROVIDER_ID,

    /**
     * Cheap local check (never touches the network). The key itself is resolved
     * per search, because creditors may be written while the process runs.
     * @returns whether the configuration can dispatch at all.
     */
    available() {
      const options = readOptions()
      const baseURL = typeof options.baseURL === 'string' && options.baseURL.length > 0
        ? options.baseURL
        : TAVILY_DEFAULT_BASE_URL
      return URL.canParse(baseURL) && isUsableBound(options.maxResults)
    },

    /**
     * Run one search through Tavily.
     * @param request - the seam's normalized request.
     * @param signal - optional cancellation.
     * @returns the normalized result.
     */
    async search(request, signal) {
      throwIfAborted(signal, aborted)
      const options = readOptions()
      const baseURL = (typeof options.baseURL === 'string' && options.baseURL.length > 0
        ? options.baseURL
        : TAVILY_DEFAULT_BASE_URL).replace(/\/+$/u, '')
      const endpoint = `${baseURL}/search`
      const apiKey = await resolveApiKey(options, signal)
      throwIfAborted(signal, aborted)
      const body = buildTavilyRequest({
        query: request.query,
        maxResults: request.maxResults ?? options.maxResults,
        searchDepth: options.searchDepth,
        topic: options.topic,
        answer: options.answer,
        chunksPerSource: options.chunksPerSource,
        includePublishedDate: options.includePublishedDate,
      })

      let response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            accept: 'application/json',
            'user-agent': TAVILY_USER_AGENT,
          },
          body: JSON.stringify(body),
          ...signal === undefined ? {} : { signal },
        })
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw endpointError(endpoint, `Tavily search request failed: ${describeError(error)}`, error)
      }

      if (!response.ok) {
        const retryAfter = typeof response.headers?.get === 'function' ? response.headers.get('retry-after') : null
        let payload
        try {
          payload = await response.json()
        } catch (error) {
          if (wasAborted(error, signal)) throw aborted(signal, error)
        }
        throw endpointError(endpoint, tavilyErrorMessage(response.status, payload, retryAfter))
      }

      let payload
      try {
        payload = await response.json()
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw endpointError(endpoint, `Tavily returned an unprocessable response body: ${describeError(error)}`, error)
      }
      return mapTavilyResponse(payload)
    },
  }
}

/**
 * Throw the provider's cancellation error when the caller already aborted.
 * @param signal - the caller's abort signal.
 * @param aborted - the error builder.
 */
function throwIfAborted(signal, aborted) {
  if (signal !== undefined && signal.aborted === true) throw aborted(signal)
}

/**
 * True for a `fetch`/`AbortSignal` abort.
 * @param error - the thrown value.
 * @param signal - the caller's signal, when one was supplied.
 */
function wasAborted(error, signal) {
  if (signal !== undefined && signal.aborted === true) return true
  if (error === null || typeof error !== 'object') return false
  return error.name === 'AbortError'
}

/**
 * Race an asynchronous credential preflight against caller cancellation. The
 * settlement handlers stay attached after an abort so a late rejection cannot
 * become unhandled.
 * @param operation - the preflight.
 * @param signal - the caller's abort signal.
 * @param aborted - the error builder.
 */
function runAbortable(operation, signal, aborted) {
  if (signal === undefined) return Promise.resolve().then(operation)
  if (signal.aborted === true) return Promise.reject(aborted(signal))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(aborted(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve().then(operation).then((value) => {
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }, (error) => {
      signal.removeEventListener('abort', onAbort)
      reject(error)
    })
  })
}

/**
 * True when the configured result bound can be sent to Tavily.
 * @param value - a raw configured value.
 */
function isUsableBound(value) {
  return value === undefined || value === null
    || (Number.isInteger(value) && value >= 0 && value <= 20)
}

/**
 * Render an unknown thrown value as text for an error message.
 * @param error - the thrown value.
 */
function describeError(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
