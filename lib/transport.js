/**
 * Small transport helpers shared by the provider implementations.
 *
 * These are deliberately dependency-free so the wire contracts stay testable
 * without any DSH package installed: a provider receives `fetch` and `WebError`
 * and uses these for cancellation, payload reading, and result bounds.
 */

/**
 * Throw the provider's cancellation error when the caller already aborted.
 * @param signal - the caller's abort signal.
 * @param aborted - the error builder.
 */
export function throwIfAborted(signal, aborted) {
  if (signal !== undefined && signal.aborted === true) throw aborted(signal)
}

/**
 * True for a `fetch`/`AbortSignal` abort.
 * @param error - the thrown value.
 * @param signal - the caller's signal, when one was supplied.
 */
export function wasAborted(error, signal) {
  if (signal !== undefined && signal.aborted === true) return true
  if (error === null || typeof error !== 'object') return false
  return error.name === 'AbortError'
}

/**
 * Race an asynchronous preflight against caller cancellation. The settlement
 * handlers stay attached after an abort so a late rejection cannot become an
 * unhandled rejection.
 * @param operation - the preflight.
 * @param signal - the caller's abort signal.
 * @param aborted - the error builder.
 */
export function runAbortable(operation, signal, aborted) {
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
 * Render an unknown thrown value as text for an error message.
 * @param error - the thrown value.
 */
export function describeError(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Read the `Retry-After` header as whole seconds.
 * @param response - the fetch response.
 * @returns the parsed value, or undefined when absent/unparseable.
 */
export function readRetryAfter(response) {
  const raw = typeof response.headers?.get === 'function' ? response.headers.get('retry-after') : null
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : undefined
}

/**
 * Parse a response body as JSON, tolerating an absent or invalid body.
 *
 * A body that is not JSON is NOT an abort, so callers keep the HTTP status as
 * the failure signal; the callback receives `undefined`.
 * @param response - the fetch response.
 * @param signal - the caller's abort signal.
 * @param aborted - the error builder.
 * @returns the parsed payload, or undefined when the body is not JSON.
 */
export async function readJsonPayload(response, signal, aborted) {
  try {
    return await response.json()
  } catch (error) {
    if (wasAborted(error, signal)) throw aborted(signal, error)
    return undefined
  }
}

/**
 * Clamp a configured character bound.
 * @param value - raw configured value.
 * @param fallback - bound used when unset or invalid.
 * @returns a positive integer bound.
 */
export function normaliseMaxChars(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const bounded = Math.trunc(value)
  if (bounded <= 0) return fallback
  return bounded
}

/**
 * Clamp a configured integer to a range.
 * @param value - raw configured value.
 * @param min - lower bound (inclusive).
 * @param max - upper bound (inclusive).
 * @param fallback - value used when unset or invalid.
 */
export function clampInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const bounded = Math.trunc(value)
  if (bounded < min) return min
  if (bounded > max) return max
  return bounded
}

/**
 * Resolve a `fetch`-compatible call with an optional abort signal.
 * @param fetchImpl - the transport.
 * @param endpoint - the URL to request.
 * @param init - the request init.
 * @param signal - the caller's abort signal.
 */
export function request(fetchImpl, endpoint, init, signal) {
  return signal === undefined ? fetchImpl(endpoint, init) : fetchImpl(endpoint, { ...init, signal })
}
