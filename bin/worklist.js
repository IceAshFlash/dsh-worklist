#!/usr/bin/env node
/**
 * bin/worklist.js — 独立启动的工作清单（不需要 DSH）。
 *
 *   node bin/worklist.js list             在终端里看清单
 *   node bin/worklist.js serve --open     起本地服务并弹出一个不带浏览器地址栏的窗口
 *   node bin/worklist.js serve --port 7500 --data D:\x.json
 *
 * 桌面快捷方式调的就是 `serve --open`：有图形界面、有数据，
 * 但没有模型 —— AI 拆分那一步只在 DSH 里可用，按钮会自己说明。
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createApi } from '../core/api.js'
import { openFolder } from '../core/open.js'
import { decorate, read, resolveDataFile } from '../core/store.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE = path.resolve(HERE, '..')
const DEFAULT_PORT = 7419 // ui-copy-ignore
const IDLE_EXIT_MS = 180000 // ui-copy-ignore

const argv = process.argv.slice(2)

const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const next = argv[index + 1]
  if (next === undefined || next.startsWith('--')) return true
  return next
}

const has = (name) => argv.includes(`--${name}`)

const argValue = (name) => {
  const raw = argv.find((item) => item.startsWith(`--${name}=`))
  return raw === undefined ? undefined : raw.slice(name.length + 3)
}

const dataFile = resolveDataFile(
  typeof flag('data', undefined) === 'string' ? flag('data', '') : argValue('data'),
)

const pct = (value) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`

const printTree = async () => {
  const state = decorate(await read(dataFile))
  const lines = []
  lines.push(`工作清单 · ${state.totals.projects} 个项目 / ${state.totals.categories} 个分类 / ${state.totals.tasks} 项工作`)
  lines.push(`总进度 ${pct(state.totals.progress)}${state.totals.overdue > 0 ? ` · 逾期 ${state.totals.overdue}` : ''}`)
  lines.push(`数据：${dataFile}`)
  for (const project of state.projects) {
    lines.push('')
    lines.push(`▸ ${project.title}  [${pct(project.progress)}]${project.path !== '' ? `  ${project.path}` : ''}`)
    for (const category of project.categories) {
      lines.push(`  · ${category.title}  [${pct(category.progress)}] ${category.openCount}/${category.taskCount}`)
      for (const task of category.tasks) {
        const due = Number.isFinite(task.dueAt)
          ? `  ${task.due === 'overdue' ? '逾期' : task.due === 'today' ? '今天到期' : ''}`
          : ''
        lines.push(`      [${task.progress >= 1 ? 'x' : ' '}] ${task.title}${task.steps.length > 0 ? `  ${pct(task.progress)}` : ''}${due}`)
      }
    }
  }
  if (state.totals.tasks === 0) lines.push('\n还没有任何工作：打开图形界面（serve --open）或让 DSH 帮你建。')
  process.stdout.write(`${lines.join('\n')}\n`)
}

/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
}

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw === '') return {}
  return JSON.parse(raw)
}

const makeServer = (api) => http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const method = (req.method ?? 'GET').toUpperCase()

  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(PACKAGE, 'ui', 'standalone.html'))
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
      res.end(html)
      return
    }
    if (url.pathname === '/app.js') {
      const js = fs.readFileSync(path.join(PACKAGE, 'ui', 'app.js'))
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' })
      res.end(js)
      return
    }
    if (url.pathname === '/icon.png') {
      const png = path.join(PACKAGE, 'icon', 'icon.png')
      if (fs.existsSync(png)) {
        res.writeHead(200, { 'content-type': MIME['.png'], 'cache-control': 'no-store' })
        res.end(fs.readFileSync(png))
        return
      }
      res.writeHead(204)
      res.end()
      return
    }
    if (url.pathname === '/favicon.ico') {
      const ico = path.join(PACKAGE, 'bin', 'icon.ico')
      if (fs.existsSync(ico)) {
        res.writeHead(200, { 'content-type': MIME['.ico'], 'cache-control': 'no-store' })
        res.end(fs.readFileSync(ico))
        return
      }
      res.writeHead(204)
      res.end()
      return
    }
    if (url.pathname.startsWith('/api')) {
      const inner = new URL(`http://localhost${url.pathname.slice(4) || '/'}${url.search}`)
      const body = method === 'POST' || method === 'PATCH' || method === 'DELETE' ? await readBody(req) : {}
      const result = await api({ method, url: inner, body })
      const text = JSON.stringify(result.body)
      res.writeHead(result.status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(text),
      })
      res.end(text)
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
  }
})

const browserCandidates = () => {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter((item) => fs.existsSync(item))
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ].filter((item) => fs.existsSync(item))
  }
  return ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']
}

/** 优先用自带 Electron 外壳：只有它能做窗口级透明（亚克力），浏览器窗口做不到。 */
const openShell = (url) => {
  const exe = process.platform === 'win32'
    ? path.join(PACKAGE, 'bin', 'electron', 'electron.exe')
    : process.platform === 'darwin'
      ? path.join(PACKAGE, 'bin', 'electron', 'Electron.app', 'Contents', 'MacOS', 'Electron')
      : path.join(PACKAGE, 'bin', 'electron', 'electron')
  if (!fs.existsSync(exe)) return Promise.resolve(null)
  const appDir = path.join(PACKAGE, 'bin', 'shell')
  if (!fs.existsSync(appDir)) return Promise.resolve(null)

  let child = null
  try {
    // 外壳自己会读 --url；这里直接给它，省得它再猜端口。
    // 顺序很重要：app 目录必须排在前面，Electron 把第一个非开关参数当成应用入口；
    // 放后面会被当成"没有应用目录"从而直接退出（实测）。
    // --no-sandbox：从受限父进程拉起来时 Chromium 沙箱会崩，外壳只加载本地页面，关掉安全。
    const profileDir = path.join(path.dirname(dataFile), 'dsh-worklist-shell-profile')
    child = spawn(exe, [
      appDir,
      '--no-sandbox',
      '--user-data-dir=' + profileDir,
      '--url', url,
    ], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    })
  } catch {
    return Promise.resolve(null)
  }

  // 外壳到底有没有起来，看它自己的日志最准：它会在 whenReady 之后写一行 "ready"。
  // 光看进程还活着不够 —— Chromium 崩掉时主进程可能还会挂一会儿。
  const startedAt = Date.now()
  const logFiles = [
    path.join(path.dirname(dataFile), 'dsh-worklist-shell.log'),
    path.join(appDir, 'shell.log'),
  ]
  const shellSaidReady = () => {
    for (const file of logFiles) {
      try {
        const text = fs.readFileSync(file, 'utf8')
        const tail = text.slice(-4000)
        for (const line of tail.split('\n')) {
          if (!/ ready-to-show| did-fail-load| start /.test(' ' + line)) continue
          const stamp = Date.parse(line.slice(0, 24))
          if (Number.isFinite(stamp) && stamp >= startedAt - 2000 && /ready-to-show/.test(line)) return true
        }
      } catch {}
    }
    return false
  }

  return new Promise((resolveShell) => {
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      resolveShell(value)
    }
    let tries = 0
    const tick = () => {
      if (settled) return
      if (child.exitCode !== null || child.signalCode !== null) return settle(null)
      if (shellSaidReady()) return settle(exe)
      tries += 1
      if (tries >= 16) {
        // 4 秒还没 ready：当作起不来，收掉进程退回浏览器窗口
        try { child.kill() } catch {}
        return settle(null)
      }
      setTimeout(tick, 250)
    }
    child.on('error', () => settle(null))
    child.on('exit', () => settle(null))
    child.unref()
    setTimeout(tick, 250)
  })
}

/** 用一个独立的浏览器配置目录起「应用窗口」：没有地址栏，看起来就是个桌面程序。 */
const openWindow = async (url) => {
  const shell = await openShell(url)
  if (shell !== null) return shell
  const candidates = browserCandidates()
  const profileDir = path.join(path.dirname(dataFile), 'worklist-window')
  try { fs.mkdirSync(profileDir, { recursive: true }) } catch {}

  for (const browser of candidates) {
    try {
      const child = spawn(browser, [
        `--app=${url}`,
        `--user-data-dir=${profileDir}`,
        '--window-size=1120,780',
        '--no-first-run',
        '--no-default-browser-check',
      ], { detached: true, stdio: 'ignore' })
      child.on('error', () => {})
      child.unref()
      return browser
    } catch {}
  }
  // 没有 Chromium 系浏览器就退回默认浏览器（会有地址栏，但也能用）。
  const fallback = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]]
  try {
    const child = spawn(fallback[0], fallback[1], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    return fallback[0]
  } catch {
    return null
  }
}

const probe = (port) => new Promise((resolve) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/api/meta', timeout: 800 }, (res) => {
    const chunks = []
    res.on('data', (chunk) => chunks.push(chunk))
    res.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(payload && payload.ok === true ? payload : null)
      } catch {
        resolve(null)
      }
    })
  })
  req.on('error', () => resolve(null))
  req.on('timeout', () => { req.destroy(); resolve(null) })
})

const serve = async () => {
  const requested = Number(flag('port', argValue('port') ?? DEFAULT_PORT))
  const port0 = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_PORT

  const existing = await probe(port0)
  if (existing !== null) {
    const url = `http://127.0.0.1:${port0}/`
    if (has('open')) await openWindow(url)
    process.stdout.write(`工作清单已经在跑：${url}\n数据：${existing.dataFile}\n`)
    return
  }

  const api = createApi({
    file: dataFile,
    aiSplit: null,
    openFolder: (target) => openFolder(target),
  })
  const server = makeServer(api)

  let lastSeen = Date.now()
  server.on('request', () => { lastSeen = Date.now() })

  const listen = (port) => new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(port))
  })

  let port = port0
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await listen(port)
      break
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error
      port += 1
    }
  }

  const url = `http://127.0.0.1:${port}/`
  process.stdout.write(`工作清单：${url}\n数据：${dataFile}\n`)

  if (has('open')) {
    const browser = await openWindow(url)
    process.stdout.write(`窗口：${browser === null ? '没找到浏览器，手动打开上面的地址' : browser}\n`)
  }

  const timer = setInterval(() => {
    if (Date.now() - lastSeen > IDLE_EXIT_MS) {
      clearInterval(timer)
      process.stdout.write('窗口已经关了一会儿，退出。\n')
      server.close(() => process.exit(0))
      setTimeout(() => process.exit(0), 1500).unref()
    }
  }, 15000)
  timer.unref()
}

const main = async () => {
  const command = argv[0] ?? 'serve'
  if (command === 'list' || command === 'ls') {
    await printTree()
    return
  }
  if (command === 'path') {
    process.stdout.write(`${dataFile}\n`)
    return
  }
  if (command === 'serve' || command === 'open') {
    await serve()
    return
  }
  process.stdout.write([
    '用法：',
    '  worklist list                 在终端里看清单',
    '  worklist serve [--open]       起本地窗口（--open 直接弹出图形界面）',
    '  worklist path                 打印数据文件路径',
    '  --port <n>  --data <file>',
  ].join('\n') + '\n')
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`)
  process.exit(1)
})