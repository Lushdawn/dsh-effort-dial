/**
 * Watch the two account-side actions the user is performing, then finish the
 * publish: when the npm package is live and the GitHub repository exists, push
 * the local `master` branch to origin over SSH.
 *
 * usage: node monitor-publish.mjs   (run from the package directory)
 */
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const pkg = 'dsh-effort-dial'
const repo = 'Lushdawn/dsh-effort-dial'
const cwd = process.cwd()

async function npmLive() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}`, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body = await res.json()
    return body['dist-tags']?.latest ?? null
  } catch {
    return null
  }
}

async function repoLive() {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: { 'user-agent': 'dsh-effort-dial-publisher' } })
    return res.ok
  } catch {
    return false
  }
}

let pushed = false
for (let i = 0; i < 240; i += 1) {
  const version = await npmLive()
  const exists = await repoLive()
  console.log(`[${new Date().toISOString().slice(11, 19)}] npm=${version ?? '-'} repo=${exists ? 'yes' : 'no'}`)
  if (exists && !pushed) {
    try {
      execFileSync('git', ['push', '-u', 'origin', 'master'], { cwd, stdio: 'inherit' })
      pushed = true
      console.log('PUSHED')
    } catch (error) {
      console.log('push failed:', String(error.message).slice(0, 200))
    }
  }
  if (version !== null && pushed) {
    console.log(`DONE npm=${version}`)
    process.exit(0)
  }
  await sleep(5000)
}
console.log('monitor timed out')
