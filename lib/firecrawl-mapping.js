/**
 * Pure Firecrawl request/response mapping.
 *
 * This module imports nothing on purpose: the provider receives `fetch` and
 * `WebError` through its constructor, so the wire contract is testable without
 * any DSH package installed.
 *
 * Contracts follow the official v2 API reference (docs.firecrawl.dev,
 * consulted 2026-10):
 * - `POST /v2/scrape` `{ url, formats: ['markdown'], onlyMainContent, proxy,
 *   timeout, maxAge, waitFor, blockAds, removeBase64Images }` →
 *   `{ success, data: { markdown, metadata: { sourceURL, statusCode, title } } }`
 * - `POST /v2/search` `{ query, limit (1..100), sources: ['web'], scrapeOptions? }` →
 *   `{ success, data: { web: [{ url, title, description, markdown? }] }, creditsUsed }`
 * - Authentication is an optional `Bearer <token>`; requests without a key are
 *   still answered (the free/anonymous pool is rate-limited).
 * - Errors: `{ success: false, error, code }`; 402 is `insufficient_credits`,
 *   429 is `{ error: 'Request rate limit exceeded...' }`.
 */

/** Default API base; every operation is versioned under `/v2`. */
export const FIRECRAWL_DEFAULT_BASE_URL = 'https://api.firecrawl.dev'
/** Attribution header sent on every request. Bump with the package version. */
export const FIRECRAWL_USER_AGENT = 'dsh-search-switch/0.2.0'
/** Proxy tiers documented for scrape options. */
export const FIRECRAWL_PROXIES = ['auto', 'basic', 'enhanced']
/** Documented upper bound for search `limit`. */
export const FIRECRAWL_MAX_SEARCH_LIMIT = 100
/** Balanced default that stays under the 30s tool budget. */
export const FIRECRAWL_DEFAULT_TIMEOUT_MS = 20000
/** Lower bound accepted by the API. */
export const FIRECRAWL_MIN_TIMEOUT_MS = 1000
/** Plugin-side ceiling: the tool budget is 30s unless the deployment raises it. */
export const FIRECRAWL_MAX_TIMEOUT_MS = 25000
/** Server-side cache tolerance default (2 days). */
export const FIRECRAWL_DEFAULT_MAX_AGE_MS = 172800000
/** Default search result bound used when the caller passes none. */
export const FIRECRAWL_DEFAULT_SEARCH_LIMIT = 8
/** Default snippet bound for search results. */
export const FIRECRAWL_DEFAULT_SNIPPET_MAX_CHARS = 800

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
 * Clamp the request timeout to the documented range.
 * @param value - raw configured value.
 * @returns whole milliseconds.
 */
export function normaliseTimeoutMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FIRECRAWL_DEFAULT_TIMEOUT_MS
  const bounded = Math.trunc(value)
  if (bounded < FIRECRAWL_MIN_TIMEOUT_MS) return FIRECRAWL_MIN_TIMEOUT_MS
  if (bounded > FIRECRAWL_MAX_TIMEOUT_MS) return FIRECRAWL_MAX_TIMEOUT_MS
  return bounded
}

/**
 * Normalise the proxy tier.
 * @param value - raw configured value.
 */
export function normaliseProxy(value) {
  return FIRECRAWL_PROXIES.includes(value) ? value : 'auto'
}

/**
 * Clamp a `waitFor` delay.
 * @param value - raw configured value.
 * @returns whole milliseconds in 0..20000.
 */
export function normaliseWaitFor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const bounded = Math.trunc(value)
  if (bounded < 0) return 0
  if (bounded > 20000) return 20000
  return bounded
}

/**
 * Clamp the cache tolerance.
 * @param value - raw configured value.
 * @returns whole milliseconds, never negative.
 */
export function normaliseMaxAgeMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FIRECRAWL_DEFAULT_MAX_AGE_MS
  const bounded = Math.trunc(value)
  return bounded < 0 ? 0 : bounded
}

/**
 * Clamp the requested search result count.
 * @param value - the seam's `maxResults` or the configured fallback.
 */
export function normaliseSearchLimit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FIRECRAWL_DEFAULT_SEARCH_LIMIT
  const bounded = Math.trunc(value)
  if (bounded < 1) return 1
  if (bounded > FIRECRAWL_MAX_SEARCH_LIMIT) return FIRECRAWL_MAX_SEARCH_LIMIT
  return bounded
}

/**
 * Clamp a snippet bound; `0` disables clipping.
 * @param value - raw configured value.
 */
export function normaliseSnippetMaxChars(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FIRECRAWL_DEFAULT_SNIPPET_MAX_CHARS
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
 * Build the request headers, adding auth only when a key exists.
 * @param apiKey - the resolved key, if any.
 */
function headersFor(apiKey) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': FIRECRAWL_USER_AGENT,
  }
  if (typeof apiKey === 'string' && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
  return headers
}

/**
 * Build one `POST /v2/scrape` request.
 * @param input - url plus resolved scrape options.
 * @returns the endpoint and fetch init.
 * @throws when the endpoint or URL is unusable.
 */
export function buildScrapeRequest(input) {
  const base = normaliseBaseURL(input.baseURL, FIRECRAWL_DEFAULT_BASE_URL)
  if (base === undefined) throw new Error('Firecrawl endpoint is not a valid URL')
  const url = typeof input.url === 'string' ? input.url.trim() : ''
  if (url.length === 0) throw new Error('Firecrawl scrape needs a non-empty URL')

  const body = {
    url,
    formats: ['markdown'],
    onlyMainContent: input.onlyMainContent !== false,
    proxy: normaliseProxy(input.proxy),
    timeout: normaliseTimeoutMs(input.timeoutMs),
    maxAge: normaliseMaxAgeMs(input.maxAgeMs),
    blockAds: input.blockAds !== false,
    removeBase64Images: true,
  }
  const waitFor = normaliseWaitFor(input.waitFor)
  if (waitFor > 0) body.waitFor = waitFor

  return {
    endpoint: `${base}/v2/scrape`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers: headersFor(input.apiKey),
      body: JSON.stringify(body),
    },
  }
}

/**
 * Map a scrape payload to markdown plus the effective URL/status.
 * @param payload - parsed response body.
 * @param requestedUrl - the URL that was requested (used when metadata is thin).
 * @returns `{ url, statusCode, title, markdown }`, or undefined when unusable.
 */
export function mapScrapeResponse(payload, requestedUrl) {
  if (payload === null || typeof payload !== 'object' || payload.success === false) return undefined
  const data = payload.data
  if (data === null || typeof data !== 'object') return undefined
  const markdown = typeof data.markdown === 'string' ? data.markdown.trim() : ''
  if (markdown.length === 0) return undefined
  const metadata = data.metadata !== null && typeof data.metadata === 'object' ? data.metadata : {}
  const mapped = { markdown }
  if (typeof metadata.sourceURL === 'string' && metadata.sourceURL.trim().length > 0) {
    mapped.url = metadata.sourceURL.trim()
  } else if (typeof metadata.url === 'string' && metadata.url.trim().length > 0) {
    mapped.url = metadata.url.trim()
  } else {
    mapped.url = requestedUrl
  }
  mapped.statusCode = Number.isInteger(metadata.statusCode) && metadata.statusCode > 0
    ? metadata.statusCode
    : 200
  if (typeof metadata.title === 'string' && metadata.title.trim().length > 0) mapped.title = metadata.title.trim()
  return mapped
}

/**
 * Build one `POST /v2/search` request.
 * @param input - query plus resolved options.
 * @returns the endpoint and fetch init.
 * @throws when the endpoint or query is unusable.
 */
export function buildSearchRequest(input) {
  const base = normaliseBaseURL(input.baseURL, FIRECRAWL_DEFAULT_BASE_URL)
  if (base === undefined) throw new Error('Firecrawl endpoint is not a valid URL')
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  if (query.length === 0) throw new Error('Firecrawl search needs a non-empty query')

  const body = {
    query,
    limit: normaliseSearchLimit(input.maxResults),
    sources: ['web'],
    timeout: normaliseTimeoutMs(input.timeoutMs),
  }
  if (input.scrape === true) {
    body.scrapeOptions = {
      formats: ['markdown'],
      onlyMainContent: input.onlyMainContent !== false,
    }
  }
  return {
    endpoint: `${base}/v2/search`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers: headersFor(input.apiKey),
      body: JSON.stringify(body),
    },
  }
}

/**
 * Map a search payload to normalized sources.
 *
 * `description` is Firecrawl's query-relevant highlight and the cheapest
 * portable snippet; scraped `markdown` is the fallback when it is absent.
 * @param payload - parsed response body.
 * @param options - mapping options.
 * @returns the normalized search result.
 */
export function mapSearchResponse(payload, options = {}) {
  if (payload === null || typeof payload !== 'object' || payload.success === false) {
    return { sources: [], truncated: false }
  }
  const data = payload.data
  const web = data !== null && typeof data === 'object' && Array.isArray(data.web) ? data.web : []
  const maxChars = normaliseSnippetMaxChars(options.snippetMaxChars)
  const sources = []
  for (const entry of web) {
    if (entry === null || typeof entry !== 'object') continue
    const url = typeof entry.url === 'string' ? entry.url.trim() : ''
    if (url.length === 0) continue
    const description = typeof entry.description === 'string' ? entry.description.trim() : ''
    const markdown = typeof entry.markdown === 'string' ? entry.markdown.trim() : ''
    const snippet = clipText(description.length > 0 ? description : markdown, maxChars).trim()
    if (snippet.length === 0) continue
    const source = { url, snippet }
    if (typeof entry.title === 'string' && entry.title.trim().length > 0) source.title = entry.title.trim()
    sources.push(source)
  }
  return { sources, truncated: false }
}

/**
 * Pull the richest human-readable detail out of Firecrawl's error envelopes.
 * @param payload - parsed body, when it was JSON.
 * @returns a trimmed message, or an empty string.
 */
export function firecrawlErrorDetail(payload) {
  if (payload === null || typeof payload !== 'object') return ''
  for (const key of ['error', 'message']) {
    if (typeof payload[key] === 'string' && payload[key].trim().length > 0) return payload[key].trim()
  }
  return ''
}

/**
 * Classify a Firecrawl failure.
 *
 * `402 insufficient_credits` and `429` are account/quota problems the user can
 * fix; `401`/`Unauthorized` is a bad key. Everything else is a provider fault.
 * @param status - HTTP status.
 * @param payload - parsed error body, when JSON.
 * @returns the WebError code plus a routing kind.
 */
export function classifyFirecrawlFailure(status, payload) {
  const code = payload !== null && typeof payload === 'object' && typeof payload.code === 'string' ? payload.code : ''
  const detail = firecrawlErrorDetail(payload)
  if (status === 401 || /unauthorized/iu.test(detail)) return { code: 'WEB_PROVIDER_CREDENTIAL_MISSING', kind: 'auth-invalid' }
  if (status === 402 || code === 'insufficient_credits') return { code: 'WEB_PROVIDER_ERROR', kind: 'credits' }
  if (status === 429) return { code: 'WEB_PROVIDER_ERROR', kind: 'rate-limit' }
  if (status === 403 && /THIRD_PARTY_DATA_TERMS_REQUIRED/u.test(code)) {
    return { code: 'WEB_PROVIDER_ERROR', kind: 'terms' }
  }
  return { code: 'WEB_PROVIDER_ERROR', kind: 'provider' }
}
