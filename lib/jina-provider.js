/**
 * Jina AI provider: anonymous Reader fetches plus keyed web search.
 *
 * The provider is deliberately NOT registered into `ctx.web`: it is a private
 * implementation called by the dispatchers (see ./dispatch.js). That keeps this
 * plugin from colliding with a community `jina` provider under
 * `WEB_DUPLICATE_PROVIDER` and keeps the Jina API key under this plugin's own
 * configuration.
 *
 * `fetch` and `WebError` are injected so the wire contract is testable without
 * DSH packages installed.
 */

import {
  JINA_DEFAULT_READER_URL,
  JINA_DEFAULT_SEARCH_URL,
  JINA_MAX_TIMEOUT_SECONDS,
  buildReaderRequest,
  buildSearchRequest,
  classifyJinaFailure,
  jinaErrorDetail,
  mapReaderResponse,
  mapSearchResponse,
  normaliseBaseURL,
  normaliseKeyMode,
  normaliseSnippetMaxChars,
  normaliseTimeoutSeconds,
} from './jina-mapping.js'
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
export const JINA_PROVIDER_ID = 'jina'
/** Default `web_fetch` body bound; mirrors the local HTTP provider. */
export const JINA_DEFAULT_FETCH_MAX_CHARS = 100000

/**
 * Create the Jina provider.
 *
 * @param spec - injected runtime seams.
 * @param spec.WebError - the seam's error class.
 * @param spec.fetchImpl - `fetch`-compatible transport.
 * @param spec.options - thunk returning the options for the NEXT operation,
 *   snapshotted once at each operation's entry so one call never mixes two
 *   configuration revisions.
 * @returns the provider.
 */
export function createJinaProvider(spec) {
  const { WebError } = spec
  const fetchImpl = spec.fetchImpl ?? fetch
  const readOptions = () => spec.options() ?? {}

  /** Throw the seam's cancellation error, retaining the caller's abort reason. */
  const aborted = (signal, fallback) => new WebError('Jina request aborted', 'WEB_ABORTED', {
    cause: signal !== undefined && signal.aborted === true ? signal.reason : fallback,
  })

  /**
   * Resolve the configured key for this operation.
   * @returns the key, or undefined when none is configured.
   */
  const resolveKey = async (options, signal) => {
    if (typeof options.apiKey === 'string' && options.apiKey.trim().length > 0) return options.apiKey.trim()
    if (typeof options.resolveApiKey === 'function') {
      const resolved = await runAbortable(options.resolveApiKey, signal, aborted)
      if (typeof resolved === 'string' && resolved.trim().length > 0) return resolved.trim()
    }
    return undefined
  }

  /** The key the Reader request should send, honouring the configured mode. */
  const readerKey = async (options, signal) => {
    const mode = normaliseKeyMode(options.readerKeyMode)
    if (mode === 'anonymous') return undefined
    const key = await resolveKey(options, signal)
    if (key !== undefined) return key
    if (mode === 'api') {
      throw new WebError(
        `jinaReaderKeyMode is "api" but no key is configured for "${describeKeyRef(options)}". `
        + 'Store it under Settings > Plugins > dsh-search-switch, export JINA_API_KEY, '
        + 'or set jinaReaderKeyMode back to "anonymous".',
        'WEB_PROVIDER_CREDENTIAL_MISSING',
      )
    }
    return undefined
  }

  /** The key a Search request must send. */
  const searchKey = async (options, signal) => {
    const key = await resolveKey(options, signal)
    if (key !== undefined) return key
    throw new WebError(
      `Jina search has no API key for "${describeKeyRef(options)}"; the Jina search endpoint rejects anonymous calls. `
      + 'Store a key under Settings > Plugins > dsh-search-switch (or export JINA_API_KEY), '
      + 'or switch the search source to Tavily or the DSH native provider.',
      'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  }

  /**
   * Build the failure for one non-2xx (or body-level error) response.
   * @returns the WebError to throw.
   */
  const failure = (operation, endpoint, status, payload, retryAfter) => {
    const { code, kind } = classifyJinaFailure(status, payload)
    const detail = jinaErrorDetail(payload)
    const name = payload !== null && typeof payload === 'object' && typeof payload.name === 'string'
      ? payload.name
      : ''
    const label = name.length > 0 ? ` [${name}]` : ''
    const lines = [`Jina ${operation} request failed (HTTP ${status})${label}${detail.length > 0 ? `: ${detail}` : ''}`]
    if (retryAfter !== undefined) lines.push(`Retry-After: ${retryAfter}s.`)
    lines.push(`Endpoint: ${JSON.stringify(endpoint)}.`)
    lines.push(guidance(kind))
    return new WebError(lines.join('\n'), code)
  }

  return {
    id: JINA_PROVIDER_ID,

    /**
     * Cheap local check (never touches the network). Keys are resolved per
     * operation because credentials may be written while the process runs.
     * @returns whether the configuration can dispatch at all.
     */
    available() {
      const options = readOptions()
      const reader = normaliseBaseURL(options.readerURL, JINA_DEFAULT_READER_URL)
      const search = normaliseBaseURL(options.searchURL, JINA_DEFAULT_SEARCH_URL)
      const timeout = normaliseTimeoutSeconds(options.timeoutSeconds)
      return reader !== undefined && search !== undefined && timeout >= 1 && timeout <= JINA_MAX_TIMEOUT_SECONDS
    },

    /**
     * Run one Jina search. The key is mandatory: the endpoint answers 401
     * `AuthenticationRequiredError` without one.
     * @param request_ - the seam's normalized request.
     * @param signal - optional cancellation.
     * @returns the normalized result.
     */
    async search(request_, signal) {
      throwIfAborted(signal, aborted)
      const options = readOptions()
      const endpoint = normaliseBaseURL(options.searchURL, JINA_DEFAULT_SEARCH_URL)
      if (endpoint === undefined) {
        throw new WebError(
          `Jina search endpoint ${JSON.stringify(String(options.searchURL))} is not a valid URL; `
          + 'fix jinaSearchURL in this plugin\'s config.',
          'WEB_PROVIDER_ERROR',
        )
      }
      const apiKey = await searchKey(options, signal)
      throwIfAborted(signal, aborted)

      let built
      try {
        built = buildSearchRequest({
          query: request_.query,
          apiKey,
          searchURL: options.searchURL,
          site: options.site,
        })
      } catch (error) {
        throw new WebError(`Jina search request could not be built: ${describeError(error)}`, 'WEB_PROVIDER_ERROR', {
          cause: error,
        })
      }

      let response
      try {
        response = await request(fetchImpl, built.endpoint, built.init, signal)
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw new WebError(
          `Jina search request failed: ${describeError(error)}\n\nEndpoint: ${JSON.stringify(built.endpoint)}.`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }

      const payload = await readJsonPayload(response, signal, aborted)
      const bodyFailed = payload !== undefined && typeof payload.code === 'number' && payload.code !== 200
      if (!response.ok || bodyFailed) {
        throw failure('search', built.endpoint, bodyFailed ? payload.code : response.status, payload, readRetryAfter(response))
      }
      return mapSearchResponse(payload, { snippetMaxChars: normaliseSnippetMaxChars(options.snippetMaxChars) })
    },

    /**
     * Fetch one URL through Jina Reader and return it as markdown text.
     * @param request_ - the seam's normalized request (`{ url }`).
     * @param signal - optional cancellation.
     * @returns the seam's normalized fetch result.
     */
    async fetch(request_, signal) {
      throwIfAborted(signal, aborted)
      const options = readOptions()
      const target = typeof request_?.url === 'string' ? request_.url.trim() : ''
      if (target.length === 0) {
        throw new WebError('Jina Reader needs a non-empty url', 'WEB_INVALID_URL')
      }
      const reader = normaliseBaseURL(options.readerURL, JINA_DEFAULT_READER_URL)
      if (reader === undefined) {
        throw new WebError(
          `Jina Reader endpoint ${JSON.stringify(String(options.readerURL))} is not a valid URL; `
          + 'fix jinaReaderURL in this plugin\'s config.',
          'WEB_PROVIDER_ERROR',
        )
      }
      const apiKey = await readerKey(options, signal)
      throwIfAborted(signal, aborted)

      let built
      try {
        built = buildReaderRequest({
          url: target,
          apiKey,
          readerURL: options.readerURL,
          engine: options.engine,
          timeoutSeconds: options.timeoutSeconds,
          retainImages: options.retainImages,
          retainLinks: options.retainLinks,
          linksSummary: options.linksSummary,
          bypassCache: options.bypassCache,
        })
      } catch (error) {
        throw new WebError(`Jina Reader request could not be built: ${describeError(error)}`, 'WEB_INVALID_URL', {
          cause: error,
        })
      }

      let response
      try {
        response = await request(fetchImpl, built.endpoint, built.init, signal)
      } catch (error) {
        if (wasAborted(error, signal)) throw aborted(signal, error)
        throw new WebError(
          `Jina Reader request failed: ${describeError(error)}\n\nEndpoint: ${JSON.stringify(built.endpoint)}.`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        )
      }

      const payload = await readJsonPayload(response, signal, aborted)
      const bodyFailed = payload !== undefined && typeof payload.code === 'number' && payload.code !== 200
      if (!response.ok || bodyFailed) {
        throw failure('Reader', built.endpoint, bodyFailed ? payload.code : response.status, payload, readRetryAfter(response))
      }
      const mapped = mapReaderResponse(payload)
      if (mapped === undefined) {
        throw new WebError(
          `Jina Reader returned no readable content for ${JSON.stringify(target)}. `
          + 'The page may be empty, binary, or blocked; try a more specific URL, another fetch source, '
          + 'or enable the local fallback.',
          'WEB_PROVIDER_ERROR',
        )
      }

      const maxChars = normaliseMaxChars(options.maxChars, JINA_DEFAULT_FETCH_MAX_CHARS)
      const truncated = mapped.content.length > maxChars
      return {
        url: mapped.url ?? target,
        statusCode: 200,
        body: {
          kind: 'text',
          content: truncated ? mapped.content.slice(0, maxChars) : mapped.content,
        },
        truncated,
      }
    },
  }
}

/**
 * The repair guidance appended to a Jina failure, keyed by routing kind.
 * @param kind - the classification produced by `classifyJinaFailure`.
 */
function guidance(kind) {
  if (kind === 'auth-missing') {
    return 'Jina search requires an API key: store one under Settings > Plugins > dsh-search-switch '
      + '(JINA_API_KEY), export it in the environment DSH was launched from, or pick Tavily/the native provider.'
  }
  if (kind === 'auth-invalid') {
    return 'Jina rejected the configured JINA_API_KEY; replace it under Settings > Plugins > dsh-search-switch.'
  }
  if (kind === 'rate-limit') {
    return 'Jina rate limit reached (anonymous Reader allows 20 RPM). Add a JINA_API_KEY for the 500 RPM tier, '
      + 'or retry later; a fallback fetch source may also work in the meantime.'
  }
  if (kind === 'blocked') {
    return 'Jina could not read this target (private/local address, robots, or an upstream block). '
      + 'The local fetch provider can read public URLs as a fallback.'
  }
  return 'Jina could not complete the request; retry, or check jinaReaderURL/jinaSearchURL and the configured key.'
}

/**
 * Render the configured key reference for an error message.
 * @param options - the provider options snapshot.
 */
function describeKeyRef(options) {
  const reference = typeof options.apiKeyEnv === 'string' && options.apiKeyEnv.length > 0
    ? options.apiKeyEnv
    : 'JINA_API_KEY'
  return reference
}
