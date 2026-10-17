/**
 * Firecrawl provider: scraping plus optional search, with an optional key.
 *
 * The provider is deliberately NOT registered into `ctx.web`: it is a private
 * implementation called by the dispatchers (see ./dispatch.js). That keeps this
 * plugin from colliding with a community `firecrawl` provider under
 * `WEB_DUPLICATE_PROVIDER` and keeps the Firecrawl API key under this plugin's
 * own configuration.
 *
 * `fetch` and `WebError` are injected so the wire contract is testable without
 * DSH packages installed.
 */

import {
  FIRECRAWL_DEFAULT_BASE_URL,
  FIRECRAWL_MAX_TIMEOUT_MS,
  FIRECRAWL_MIN_TIMEOUT_MS,
  buildScrapeRequest,
  buildSearchRequest,
  classifyFirecrawlFailure,
  firecrawlErrorDetail,
  mapScrapeResponse,
  mapSearchResponse,
  normaliseBaseURL,
  normaliseSnippetMaxChars,
  normaliseTimeoutMs,
} from './firecrawl-mapping.js'
import {
  describeError,
  normaliseMaxChars,
  readJsonPayload,
  readRetryAfter,
  request,
  runAbortable,
  throwIfAborted,
  wasAborted,
} from './transport.js'

/** Stable id used in diagnostics; never registered into the web seam. */
export const FIRECRAWL_PROVIDER_ID = 'firecrawl'
/** Default `web_fetch` body bound; mirrors the local HTTP provider. */
export const FIRECRAWL_DEFAULT_FETCH_MAX_CHARS = 100000

/**
 * Create the Firecrawl provider.
 *
 * @param spec - injected runtime seams.
 * @param spec.WebError - the seam's error class.
 * @param spec.fetchImpl - `fetch`-compatible transport.
 * @param spec.options - thunk returning the options for the NEXT operation.
 * @returns the provider.
 */
export function createFirecrawlProvider(spec) {
  const { WebError } = spec
  const fetchImpl = spec.fetchImpl ?? fetch
  const readOptions = () => spec.options() ?? {}

  /** Throw the seam's cancellation error, retaining the caller's abort reason. */
  const aborted = (signal, fallback) => new WebError('Firecrawl request aborted', 'WEB_ABORTED', {
    cause: signal !== undefined && signal.aborted === true ? signal.reason : fallback,
  })

  /**
   * Resolve the configured key. The key is optional: Firecrawl answers
   * anonymous requests from its free pool, so a missing key is not an error.
   */
  const resolveKey = async (options, signal) => {
    if (typeof options.apiKey === 'string' && options.apiKey.trim().length > 0) return options.apiKey.trim()
    if (typeof options.resolveApiKey === 'function') {
      const resolved = await runAbortable(options.resolveApiKey, signal, aborted)
      if (typeof resolved === 'string' && resolved.trim().length > 0) return resolved.trim()
    }
    return undefined
  }

  /** Build the failure for one non-2xx (or body-level error) response. */
  const failure = (operation, endpoint, status, payload, retryAfter) => {
    const { code, kind } = classifyFirecrawlFailure(status, payload)
    const detail = firecrawlErrorDetail(payload)
    const lines = [`Firecrawl ${operation} request failed (HTTP ${status})${detail.length > 0 ? `: ${detail}` : ''}`]
    if (retryAfter !== undefined) lines.push(`Retry-After: ${retryAfter}s.`)
    lines.push(`Endpoint: ${JSON.stringify(endpoint)}.`)
    lines.push(guidance(kind))
    return new WebError(lines.join('\n'), code)
  }

  return {
    id: FIRECRAWL_PROVIDER_ID,

    /**
     * Cheap local check (never touches the network).
     * @returns whether the configuration can dispatch at all.
     */
    available() {
      const options = readOptions()
      const base = normaliseBaseURL(options.baseURL, FIRECRAWL_DEFAULT_BASE_URL)
      const timeout = normaliseTimeoutMs(options.timeoutMs)
      return base !== undefined && timeout >= FIRECRAWL_MIN_TIMEOUT_MS && timeout <= FIRECRAWL_MAX_TIMEOUT_MS
    },

    /**
     * Run one Firecrawl search. No key is required; a configured key is sent
     * when present.
     * @param request_ - the seam's normalized request.
     * @param signal - optional cancellation.
     * @returns the normalized result.
     */
    async search(request_, signal) {
      throwIfAborted(signal, aborted)
      const options = readOptions()
      const endpoint = normaliseBaseURL(options.baseURL, FIRECRAWL_DEFAULT_BASE_URL)
      if (endpoint === undefined) {
        throw new WebError(
          `Firecrawl endpoint ${JSON.stringify(String(options.baseURL))} is not a valid URL; `
          + 'fix firecrawlBaseURL in this plugin\'s config.',
          'WEB_PROVIDER_ERROR',
        )
      }
      const apiKey = await resolveKey(options, signal)
      throwIfAborted(signal, aborted)

      let built
      try {
        built = buildSearchRequest({
          query: request_.query,
          maxResults: request_.maxResults ?? options.maxResults,
          apiKey,
          baseURL: options.baseURL,
          timeoutMs: options.timeoutMs,
          scrape: options.searchScrape === true,
          onlyMainContent: options.onlyMainContent,
        })
      } catch (error) {
        throw new WebError(`Firecrawl search request could not be built: ${describeError(error)}`, 'WEB_PROVIDER_ERROR', {
          cause: error,
        })
      }

      let response
      try {
        response = await request(fetchImpl, built.endpoint, built.init, signal)
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw new WebError(
          `Firecrawl search request failed: ${describeError(error)}\n\nEndpoint: ${JSON.stringify(built.endpoint)}.`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }

      const payload = await readJsonPayload(response, signal, aborted)
      if (!response.ok) {
        throw failure('search', built.endpoint, response.status, payload, readRetryAfter(response))
      }
      if (payload !== undefined && typeof payload === 'object' && payload.success === false) {
        throw failure('search', built.endpoint, response.status, payload, readRetryAfter(response))
      }
      return mapSearchResponse(payload, { snippetMaxChars: normaliseSnippetMaxChars(options.snippetMaxChars) })
    },

    /**
     * Scrape one URL with Firecrawl and return it as markdown text.
     * @param request_ - the seam's normalized request (`{ url }`).
     * @param signal - optional cancellation.
     * @returns the seam's normalized fetch result.
     */
    async fetch(request_, signal) {
      throwIfAborted(signal, aborted)
      const options = readOptions()
      const target = typeof request_?.url === 'string' ? request_.url.trim() : ''
      if (target.length === 0) {
        throw new WebError('Firecrawl scrape needs a non-empty url', 'WEB_INVALID_URL')
      }
      const endpoint = normaliseBaseURL(options.baseURL, FIRECRAWL_DEFAULT_BASE_URL)
      if (endpoint === undefined) {
        throw new WebError(
          `Firecrawl endpoint ${JSON.stringify(String(options.baseURL))} is not a valid URL; `
          + 'fix firecrawlBaseURL in this plugin\'s config.',
          'WEB_PROVIDER_ERROR',
        )
      }
      const apiKey = await resolveKey(options, signal)
      throwIfAborted(signal, aborted)

      let built
      try {
        built = buildScrapeRequest({
          url: target,
          apiKey,
          baseURL: options.baseURL,
          onlyMainContent: options.onlyMainContent,
          proxy: options.proxy,
          timeoutMs: options.timeoutMs,
          maxAgeMs: options.maxAgeMs,
          waitFor: options.waitFor,
          blockAds: options.blockAds,
        })
      } catch (error) {
        throw new WebError(`Firecrawl scrape request could not be built: ${describeError(error)}`, 'WEB_INVALID_URL', {
          cause: error,
        })
      }

      let response
      try {
        response = await request(fetchImpl, built.endpoint, built.init, signal)
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw new WebError(
          `Firecrawl scrape request failed: ${describeError(error)}\n\nEndpoint: ${JSON.stringify(built.endpoint)}.`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }

      const payload = await readJsonPayload(response, signal, aborted)
      if (!response.ok) {
        throw failure('scrape', built.endpoint, response.status, payload, readRetryAfter(response))
      }
      if (payload !== undefined && typeof payload === 'object' && payload.success === false) {
        throw failure('scrape', built.endpoint, response.status, payload, readRetryAfter(response))
      }
      const mapped = mapScrapeResponse(payload, target)
      if (mapped === undefined) {
        throw new WebError(
          `Firecrawl returned no markdown for ${JSON.stringify(target)}. `
          + 'The page may be empty or unsupported; try another fetch source, or enable the local fallback.',
          'WEB_PROVIDER_ERROR',
        )
      }

      const maxChars = normaliseMaxChars(options.maxChars, FIRECRAWL_DEFAULT_FETCH_MAX_CHARS)
      const truncated = mapped.markdown.length > maxChars
      return {
        url: mapped.url,
        statusCode: mapped.statusCode,
        body: {
          kind: 'text',
          content: truncated ? mapped.markdown.slice(0, maxChars) : mapped.markdown,
        },
        truncated,
      }
    },
  }
}

/**
 * The repair guidance appended to a Firecrawl failure, keyed by routing kind.
 * @param kind - the classification produced by `classifyFirecrawlFailure`.
 */
function guidance(kind) {
  if (kind === 'auth-invalid') {
    return 'Firecrawl rejected the configured FIRECRAWL_API_KEY; replace it under Settings > Plugins > dsh-search-switch, '
      + 'or clear it to use the anonymous pool.'
  }
  if (kind === 'credits') {
    return 'Firecrawl reports insufficient credits for this account. Top up the key, clear the key to fall back to the '
      + 'anonymous pool, or switch the source.'
  }
  if (kind === 'rate-limit') {
    return 'Firecrawl rate limit reached (anonymous requests share a small pool). Add a FIRECRAWL_API_KEY, retry later, '
      + 'or use another fetch source.'
  }
  if (kind === 'terms') {
    return 'This Firecrawl team must accept third-party data terms before scraping; accept them in the Firecrawl dashboard.'
  }
  return 'Firecrawl could not complete the request; retry, or check firecrawlBaseURL and the configured key.'
}
