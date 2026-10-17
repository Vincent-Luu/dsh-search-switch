/**
 * Pure Tavily request/response mapping.
 *
 * This module imports nothing on purpose: the provider receives `fetch` and
 * `WebError` through its constructor, so the wire contract can be tested
 * without any DSH package installed.
 *
 * Field names and enums follow Tavily's official Search API reference
 * (`POST /search`, OpenAPI 1.0.0, consulted 2026-08):
 * - `search_depth`: basic | advanced | fast | ultra-fast (default basic;
 *   advanced costs 2 credits, the rest 1)
 * - `topic`: general | news | finance (default general)
 * - `max_results`: 0..20 (default 10)
 * - `chunks_per_source`: 1..3 (default 3; only basic/advanced/fast)
 * - `include_answer`: boolean | basic | advanced (default false)
 * - `published_date` is only returned with `include_published_date: true`
 *   (auto-enabled for topic=news); the field is still marked beta
 */

/** Default Tavily endpoint base; `/search` is the operation. */
export const TAVILY_DEFAULT_BASE_URL = 'https://api.tavily.com'
/** Balanced latency/relevance default. */
export const TAVILY_DEFAULT_SEARCH_DEPTH = 'basic'
/** General-purpose vertical default. */
export const TAVILY_DEFAULT_TOPIC = 'general'
/** Official default for `chunks_per_source`. */
export const TAVILY_DEFAULT_CHUNKS_PER_SOURCE = 3
/** Official upper bound for `max_results`. */
export const TAVILY_MAX_RESULTS_LIMIT = 20
/** Every documented search depth, in no particular order. */
export const TAVILY_SEARCH_DEPTHS = ['basic', 'advanced', 'fast', 'ultra-fast']
/** Every documented topic vertical. */
export const TAVILY_TOPICS = ['general', 'news', 'finance']
/**
 * Answer modes this plugin exposes. `off` is sent as `include_answer: false`,
 * so the plugin never asks Tavily for a generated answer unless configured to.
 */
export const TAVILY_ANSWER_MODES = ['off', 'basic', 'advanced']

/**
 * Clamp a configured result bound to Tavily's accepted range.
 * @param value - raw configured value.
 * @returns the clamped integer, or undefined when no bound is configured.
 */
export function normaliseMaxResults(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const bounded = Math.trunc(value)
  if (bounded < 0) return 0
  if (bounded > TAVILY_MAX_RESULTS_LIMIT) return TAVILY_MAX_RESULTS_LIMIT
  return bounded
}

/**
 * Clamp `chunks_per_source` to the documented 1..3 range.
 * @param value - raw configured value.
 * @returns the clamped integer, defaulting to the official default.
 */
export function normaliseChunksPerSource(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return TAVILY_DEFAULT_CHUNKS_PER_SOURCE
  const bounded = Math.trunc(value)
  if (bounded < 1) return 1
  if (bounded > 3) return 3
  return bounded
}

/**
 * Build one `POST /search` body.
 *
 * `maxResults` is the request-level bound the web seam passes, and it wins over
 * the configured default; the seam still truncates the result afterwards.
 * @param input - query and effective provider options.
 * @returns the JSON body sent to Tavily.
 */
export function buildTavilyRequest(input) {
  const depth = TAVILY_SEARCH_DEPTHS.includes(input.searchDepth)
    ? input.searchDepth
    : TAVILY_DEFAULT_SEARCH_DEPTH
  const body = {
    query: String(input.query),
    search_depth: depth,
    topic: TAVILY_TOPICS.includes(input.topic) ? input.topic : TAVILY_DEFAULT_TOPIC,
  }
  const answer = TAVILY_ANSWER_MODES.includes(input.answer) ? input.answer : 'off'
  body.include_answer = answer === 'off' ? false : answer
  // `chunks_per_source` is documented for basic/advanced/fast only.
  if (depth !== 'ultra-fast') body.chunks_per_source = normaliseChunksPerSource(input.chunksPerSource)
  if (input.includePublishedDate !== false) body.include_published_date = true
  const maxResults = normaliseMaxResults(input.maxResults)
  if (maxResults !== undefined) body.max_results = maxResults
  return body
}

/**
 * Map one Tavily result to a normalized source.
 *
 * Tavily's `content` is the portable snippet source; an entry without a
 * non-blank one is dropped rather than padded with invented text.
 * @param result - one entry of Tavily's `results[]`.
 * @returns the normalized source, or undefined when it carries no snippet.
 */
export function mapTavilyResult(result) {
  if (result === null || typeof result !== 'object') return undefined
  const url = typeof result.url === 'string' ? result.url.trim() : ''
  if (url.length === 0) return undefined
  const snippet = typeof result.content === 'string' ? result.content.trim() : ''
  if (snippet.length === 0) return undefined
  const source = { url, snippet }
  if (typeof result.title === 'string' && result.title.trim().length > 0) source.title = result.title.trim()
  if (typeof result.published_date === 'string' && result.published_date.trim().length > 0) {
    source.publishedAt = result.published_date.trim()
  }
  return source
}

/**
 * Map a Tavily response envelope to the seam's normalized search result.
 *
 * The provider never reports `truncated: true`: the web service owns the final
 * `maxResults` cut, exactly like the in-tree providers.
 * @param response - the parsed `POST /search` response body.
 * @returns the normalized result.
 */
export function mapTavilyResponse(response) {
  const results = response !== null && typeof response === 'object' && Array.isArray(response.results)
    ? response.results
    : []
  const sources = results.map(mapTavilyResult).filter((source) => source !== undefined)
  const answer = response !== null && typeof response === 'object' && typeof response.answer === 'string'
    ? response.answer.trim()
    : ''
  const result = { sources, truncated: false }
  if (answer.length > 0) result.content = answer
  return result
}

/**
 * Pull the richest human-readable detail out of Tavily's error envelopes.
 *
 * Tavily answers with `{detail: {error}}` for its API errors and with
 * `{detail: [{loc, msg, ...}]}` for 422 validation failures; both are supported.
 * @param payload - the parsed error body, or anything the body failed to parse into.
 * @returns the detail text, or undefined when the payload carries none.
 */
export function extractTavilyErrorDetail(payload) {
  if (payload === undefined || payload === null) return undefined
  if (typeof payload === 'string') return payload.trim() || undefined
  if (Array.isArray(payload)) return detailToText(payload)
  const fromDetail = detailToText(payload.detail)
  if (fromDetail !== undefined) return fromDetail
  if (typeof payload.error === 'string' && payload.error.trim().length > 0) return payload.error.trim()
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) return payload.message.trim()
  return undefined
}

/**
 * Render one error response as a model-visible message.
 * @param status - the HTTP status code.
 * @param payload - the parsed error body, if any.
 * @param retryAfter - the `Retry-After` header value, if any.
 * @returns the composed message.
 */
export function tavilyErrorMessage(status, payload, retryAfter) {
  let message = `Tavily API error (HTTP ${status})`
  const detail = extractTavilyErrorDetail(payload)
  if (detail !== undefined) message += `: ${detail}`
  if (status === 429 && typeof retryAfter === 'string' && retryAfter.length > 0) {
    message += ` (Retry-After: ${retryAfter}s)`
  }
  return message
}

/** Flatten a validation-error array or a plain detail value into text. */
function detailToText(detail) {
  if (typeof detail === 'string') return detail.trim() || undefined
  if (Array.isArray(detail)) {
    const parts = []
    for (const item of detail) {
      if (typeof item === 'string') {
        if (item.trim().length > 0) parts.push(item.trim())
        continue
      }
      if (item === null || typeof item !== 'object') continue
      const message = typeof item.msg === 'string'
        ? item.msg
        : typeof item.error === 'string' ? item.error : ''
      if (message.trim().length === 0) continue
      const loc = Array.isArray(item.loc) ? item.loc.join('.') : ''
      parts.push(loc.length > 0 && loc !== 'body' ? `${loc}: ${message.trim()}` : message.trim())
    }
    return parts.length > 0 ? parts.join('; ') : undefined
  }
  if (detail !== null && typeof detail === 'object') {
    if (typeof detail.error === 'string' && detail.error.trim().length > 0) return detail.error.trim()
    if (typeof detail.message === 'string' && detail.message.trim().length > 0) return detail.message.trim()
  }
  return undefined
}
