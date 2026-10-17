/**
 * Pure Jina AI request/response mapping.
 *
 * This module imports nothing on purpose: the provider receives `fetch` and
 * `WebError` through its constructor, so the wire contract is testable without
 * any DSH package installed.
 *
 * Endpoints and defaults follow Jina's official documentation (jina.ai/reader
 * and the jina-ai/reader README, consulted 2026-10):
 * - Reader: `https://r.jina.ai/<url>` (GET) or `POST https://r.jina.ai/` with a
 *   form `url=` field. POST is used here because it preserves `#` fragments and
 *   query strings verbatim.
 * - Search: `https://s.jina.ai/<url-encoded query>` with optional repeated
 *   `?site=` filters. Search REQUIRES an API key; anonymous calls return 401
 *   `AuthenticationRequiredError`.
 * - `Accept: application/json` returns `{code, status, data}` where Reader's
 *   `data` is one page object and Search's `data` is a list of results.
 * - Anonymous Reader is available (20 RPM); a free key raises it to 500 RPM and
 *   bills tokens instead of the anonymous pool.
 */

/** Default Reader endpoint. */
export const JINA_DEFAULT_READER_URL = 'https://r.jina.ai'
/** Default Search (SERP) endpoint. */
export const JINA_DEFAULT_SEARCH_URL = 'https://s.jina.ai'
/** Attribution header sent on every request. Bump with the package version. */
export const JINA_USER_AGENT = 'dsh-search-switch/0.2.0'
/** How the Reader request treats the configured API key. */
export const JINA_READER_KEY_MODES = ['anonymous', 'auto', 'api']
/** Engines documented for `x-engine`; `auto` means "send no header". */
export const JINA_ENGINES = ['auto', 'browser', 'curl']
/** `x-retain-images` values. */
export const JINA_RETAIN_IMAGES = ['all', 'none', 'alt']
/** `x-retain-links` values. */
export const JINA_RETAIN_LINKS = ['all', 'none', 'text']
/** Documented `x-timeout` ceiling, in seconds. */
export const JINA_MAX_TIMEOUT_SECONDS = 180
/** Balanced default for an interactive `web_fetch`. */
export const JINA_DEFAULT_TIMEOUT_SECONDS = 20
/** Default snippet bound for search results. */
export const JINA_DEFAULT_SNIPPET_MAX_CHARS = 800

/**
 * Normalise a configured endpoint.
 * @param value - raw configured value.
 * @param fallback - endpoint used when the value is unusable.
 * @returns the endpoint without trailing slashes, or undefined when invalid.
 */
export function normaliseBaseURL(value, fallback) {
  const raw = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
  const trimmed = raw.replace(/\/+$/u, '')
  return URL.canParse(trimmed) ? trimmed : undefined
}

/**
 * Clamp `x-timeout` to the documented range.
 * @param value - raw configured value.
 * @returns whole seconds.
 */
export function normaliseTimeoutSeconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return JINA_DEFAULT_TIMEOUT_SECONDS
  const bounded = Math.trunc(value)
  if (bounded < 1) return 1
  if (bounded > JINA_MAX_TIMEOUT_SECONDS) return JINA_MAX_TIMEOUT_SECONDS
  return bounded
}

/**
 * Normalise the reader key mode.
 * @param value - raw configured value.
 * @returns one of JINA_READER_KEY_MODES.
 */
export function normaliseKeyMode(value) {
  return JINA_READER_KEY_MODES.includes(value) ? value : 'anonymous'
}

/**
 * Normalise `x-engine`; the auto engine sends no header.
 * @param value - raw configured value.
 */
export function normaliseEngine(value) {
  return JINA_ENGINES.includes(value) ? value : 'auto'
}

/**
 * Normalise `x-retain-images`.
 * @param value - raw configured value.
 */
export function normaliseRetainImages(value) {
  return JINA_RETAIN_IMAGES.includes(value) ? value : 'none'
}

/**
 * Normalise `x-retain-links`.
 * @param value - raw configured value.
 */
export function normaliseRetainLinks(value) {
  return JINA_RETAIN_LINKS.includes(value) ? value : 'all'
}

/**
 * Clamp a snippet bound; `0` disables clipping.
 * @param value - raw configured value.
 */
export function normaliseSnippetMaxChars(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return JINA_DEFAULT_SNIPPET_MAX_CHARS
  const bounded = Math.trunc(value)
  return bounded < 0 ? 0 : bounded
}

/**
 * Clip text to a bound; `max <= 0` keeps the text untouched.
 * @param text - the text to clip.
 * @param max - the bound.
 */
export function clipText(text, max) {
  if (typeof text !== 'string') return ''
  if (max <= 0 || text.length <= max) return text
  return text.slice(0, max)
}

/**
 * Split a comma-separated site filter into hostnames.
 * @param value - configured site filter (string or array).
 * @returns distinct, trimmed hostnames.
 */
export function splitSites(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const sites = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const site = entry.trim()
    if (site.length > 0 && !sites.includes(site)) sites.push(site)
  }
  return sites
}

/**
 * Build the Reader request for one URL.
 *
 * POST with an `url=` form field is the documented way to keep `#` fragments;
 * every content knob travels as an `x-` header.
 * @param input - url plus resolved options.
 * @returns the endpoint and fetch init.
 * @throws when the endpoint or URL is unusable.
 */
export function buildReaderRequest(input) {
  const endpoint = normaliseBaseURL(input.readerURL, JINA_DEFAULT_READER_URL)
  if (endpoint === undefined) throw new Error('Jina Reader endpoint is not a valid URL')
  const url = typeof input.url === 'string' ? input.url.trim() : ''
  if (url.length === 0) throw new Error('Jina Reader needs a non-empty URL')

  const headers = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
    'user-agent': JINA_USER_AGENT,
  }
  if (typeof input.apiKey === 'string' && input.apiKey.length > 0) {
    headers.authorization = `Bearer ${input.apiKey}`
  }
  const engine = normaliseEngine(input.engine)
  if (engine !== 'auto') headers['x-engine'] = engine
  headers['x-timeout'] = String(normaliseTimeoutSeconds(input.timeoutSeconds))
  headers['x-retain-images'] = normaliseRetainImages(input.retainImages)
  headers['x-retain-links'] = normaliseRetainLinks(input.retainLinks)
  if (input.linksSummary === true) headers['x-with-links-summary'] = 'true'
  if (input.bypassCache === true) headers['x-no-cache'] = 'true'

  const body = new URLSearchParams({ url })
  return {
    endpoint: `${endpoint}/`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers,
      body: body.toString(),
    },
  }
}

/**
 * Build the Search request for one query.
 * @param input - query plus resolved options and the required API key.
 * @returns the endpoint (with site filters) and fetch init.
 * @throws when the endpoint, query, or key is missing.
 */
export function buildSearchRequest(input) {
  const endpoint = normaliseBaseURL(input.searchURL, JINA_DEFAULT_SEARCH_URL)
  if (endpoint === undefined) throw new Error('Jina Search endpoint is not a valid URL')
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  if (query.length === 0) throw new Error('Jina Search needs a non-empty query')
  if (typeof input.apiKey !== 'string' || input.apiKey.length === 0) {
    throw new Error('Jina Search needs an API key')
  }

  const sites = splitSites(input.site)
  let url = `${endpoint}/${encodeURIComponent(query)}`
  if (sites.length > 0) {
    const params = new URLSearchParams()
    for (const site of sites) params.append('site', site)
    url += `?${params.toString()}`
  }
  const headers = {
    accept: 'application/json',
    'user-agent': JINA_USER_AGENT,
    authorization: `Bearer ${input.apiKey}`,
  }
  return {
    endpoint: url,
    init: { method: 'GET', redirect: 'error', headers },
  }
}

/**
 * Map a Reader JSON payload to the page body.
 * @param payload - parsed `Accept: application/json` body.
 * @returns `{ url, title, content }`, or undefined when no content is usable.
 */
export function mapReaderResponse(payload) {
  if (payload === null || typeof payload !== 'object') return undefined
  if (typeof payload.code === 'number' && payload.code !== 200) return undefined
  const data = payload.data
  if (data === null || typeof data !== 'object') return undefined
  const content = typeof data.content === 'string' ? data.content.trim() : ''
  if (content.length === 0) return undefined
  const mapped = { content }
  if (typeof data.url === 'string' && data.url.trim().length > 0) mapped.url = data.url.trim()
  if (typeof data.title === 'string' && data.title.trim().length > 0) mapped.title = data.title.trim()
  return mapped
}

/**
 * Map a Search JSON payload to normalized sources.
 *
 * Jina documents `data` as a list for Search and as one page for Reader; both
 * shapes are accepted so an endpoint/version change degrades gracefully.
 * @param payload - parsed `Accept: application/json` body.
 * @param options - mapping options.
 * @returns the normalized search result.
 */
export function mapSearchResponse(payload, options = {}) {
  if (payload === null || typeof payload !== 'object') return { sources: [], truncated: false }
  if (typeof payload.code === 'number' && payload.code !== 200) return { sources: [], truncated: false }
  const data = payload.data
  const entries = Array.isArray(data) ? data : data !== null && typeof data === 'object' ? [data] : []
  const maxChars = normaliseSnippetMaxChars(options.snippetMaxChars)
  const sources = []
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue
    const url = typeof entry.url === 'string' ? entry.url.trim() : ''
    if (url.length === 0) continue
    const description = typeof entry.description === 'string' ? entry.description.trim() : ''
    const content = typeof entry.content === 'string' ? entry.content.trim() : ''
    const snippet = clipText(description.length > 0 ? description : content, maxChars).trim()
    if (snippet.length === 0) continue
    const source = { url, snippet }
    if (typeof entry.title === 'string' && entry.title.trim().length > 0) source.title = entry.title.trim()
    if (typeof entry.published_time === 'string' && entry.published_time.trim().length > 0) {
      source.publishedAt = entry.published_time.trim()
    }
    sources.push(source)
  }
  return { sources, truncated: false }
}

/**
 * Pull the richest human-readable detail out of Jina's error envelopes.
 * @param payload - parsed body, when it was JSON.
 * @returns a trimmed message, or an empty string.
 */
export function jinaErrorDetail(payload) {
  if (payload === null || typeof payload !== 'object') return ''
  for (const key of ['readableMessage', 'message', 'error']) {
    if (typeof payload[key] === 'string' && payload[key].trim().length > 0) return payload[key].trim()
  }
  return ''
}

/**
 * Classify a Jina failure by status and error name.
 *
 * `401`/`AuthenticationRequired` is a key problem; `403` is the target being
 * unreachable from Jina's infrastructure (localhost and private hosts land
 * here), which is exactly the case the local fallback exists for.
 * @param status - HTTP status.
 * @param payload - parsed error body, when JSON.
 * @returns the WebError code plus a routing kind.
 */
export function classifyJinaFailure(status, payload) {
  const name = payload !== null && typeof payload === 'object' && typeof payload.name === 'string'
    ? payload.name
    : ''
  if (/AuthenticationRequired/u.test(name)) return { code: 'WEB_PROVIDER_CREDENTIAL_MISSING', kind: 'auth-missing' }
  if (/AuthenticationFailed/u.test(name)) return { code: 'WEB_PROVIDER_CREDENTIAL_MISSING', kind: 'auth-invalid' }
  if (status === 401) return { code: 'WEB_PROVIDER_CREDENTIAL_MISSING', kind: 'auth-invalid' }
  if (status === 429) return { code: 'WEB_PROVIDER_ERROR', kind: 'rate-limit' }
  if (status === 403) return { code: 'WEB_PROVIDER_ERROR', kind: 'blocked' }
  return { code: 'WEB_PROVIDER_ERROR', kind: 'provider' }
}
