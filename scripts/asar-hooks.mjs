/**
 * Development-only ESM resolve hook that maps `@deepseek-ai/*` to the packages
 * shipped inside the installed DSH application, so the host half can be loaded
 * and smoke-tested outside a real harness boot.
 *
 * Run the consumer with Electron in node mode (`ELECTRON_RUN_AS_NODE=1`), whose
 * patched `fs` can read the `app.asar` archive. `DSH_ASAR_ROOT` overrides the
 * default install location.
 */

import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Where the installed application ships its dependencies.
 *
 * Derived from the running executable so no user-specific path is committed:
 * under Electron in node mode `process.execPath` is the application binary, and
 * `resources/app.asar/dsh/node_modules` sits beside it. `DSH_ASAR_ROOT`
 * overrides the derivation when the harness is installed somewhere unusual.
 */
const ROOT = process.env.DSH_ASAR_ROOT
  ?? join(dirname(process.execPath), 'resources', 'app.asar', 'dsh', 'node_modules')

if (!existsSync(ROOT)) {
  throw new Error(
    `cannot find the DSH installation at ${ROOT}; run this through the DeepSeek Harness `
    + 'binary with ELECTRON_RUN_AS_NODE=1, or set DSH_ASAR_ROOT to '
    + '<install>/resources/app.asar/dsh/node_modules',
  )
}

const PREFIX = '@deepseek-ai/'

/**
 * Resolve a package's ESM entry inside the installation.
 * @param name - the package name after the scope.
 * @returns a file URL, or undefined when the package is not shipped there.
 */
function packageEntry(name) {
  const dir = `${ROOT}/${PREFIX}${name}`
  for (const candidate of ['/lib/index.mjs', '/lib/index.js', '/lib/index.cjs']) {
    if (existsSync(dir + candidate)) return pathToFileURL(dir + candidate).href
  }
  return undefined
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith(PREFIX)) return nextResolve(specifier, context)
    const rest = specifier.slice(PREFIX.length)
    const slash = rest.indexOf('/')
    const name = slash === -1 ? rest : rest.slice(0, slash)
    const subpath = slash === -1 ? '' : rest.slice(slash)
    if (subpath.length > 0) {
      const file = `${ROOT}/${PREFIX}${name}${subpath}.js`
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true }
    }
    const entry = packageEntry(name)
    if (entry !== undefined) return { url: entry, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
