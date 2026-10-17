/**
 * Credential-reference plumbing shared by every provider this plugin ships.
 *
 * The plugin owns no storage: the settings page writes keys through the host's
 * credentials domain, and this module only turns a configured reference name
 * into something that domain (and the launch environment) understand.
 */

import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'

/**
 * Parse a configured reference name, falling back to the plugin default when it
 * is missing or not a legal reference.
 * @param name - the configured reference name.
 * @param fallback - the reference to use when `name` is unusable.
 * @returns a reference usable with the credentials service.
 */
export function toCredentialRef(name, fallback) {
  if (typeof name === 'string' && name.trim().length > 0) {
    try {
      return credentialRef(name.trim())
    } catch {
      return credentialRef(fallback)
    }
  }
  return credentialRef(fallback)
}

/**
 * Build a key resolver bound to one host context.
 *
 * Resolution order matches the in-tree providers: the credential store first,
 * then the environment the harness was launched from. The lookup is performed
 * per operation, so a key written in the settings page is picked up by the very
 * next request without a reload.
 * @param ctx - host context that may expose the `credentials` service.
 * @returns an async resolver returning the key or undefined.
 */
export function createApiKeyResolver(ctx) {
  return async function resolveApiKey(reference) {
    const credentials = ctx.get('credentials')
    if (credentials !== undefined && typeof credentials.resolve === 'function') {
      const resolved = await credentials.resolve(reference)
      if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) {
        return resolved.value
      }
    }
    const ambient = launchEnvironmentOf(ctx).get(reference)
    return ambient !== undefined && typeof ambient.value === 'string' ? ambient.value : undefined
  }
}
