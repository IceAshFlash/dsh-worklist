import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..')
const DATA = path.join(ROOT, '.probe-data.json')
const PORT = 7433

const child = spawn(process.execPath, [path.join(ROOT, 'bin/worklist.js'), 'serve', '--port', String(PORT), '--data', DATA], { stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
child.stdout.on('data', (c) => { log += c })
child.stderr.on('data', (c) => { log += c })

await new Promise((r) => setTimeout(r, 1500))
const show = async (label, res) => {
  const text = await res.text()
  console.log(`--- ${label} [${res.status}]\n${text.slice(0, 600)}`)
}
await show('GET /state', await fetch(`http://127.0.0.1:${PORT}/api/state`))
await show('POST /projects', await fetch(`http://127.0.0.1:${PORT}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 't' }) }))
await show('GET /state again', await fetch(`http://127.0.0.1:${PORT}/api/state`))
console.log('--- server log\n' + log.slice(0, 800))
child.kill()
fs.rmSync(DATA, { force: true })