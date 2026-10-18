/**
 * Wrap `src/client.js` in the client module-system factory contract and write
 * `lib/client.js`. The wrapper is what the web shell's loader expects:
 * `window.__ModuleLoader__.load({ id, factory })`, where the factory returns
 * this package's exports (one client plugin: `{ name, inject, apply }`).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const body = await readFile(join(root, 'src/client.js'), 'utf8')

const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
`
const footer = `
return module.exports; } });
`
await writeFile(join(root, 'lib/client.js'), banner + body + footer)
console.log(`wrote lib/client.js (${manifest.name})`)
