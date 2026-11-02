#!/usr/bin/env node
/**
 * test/smoke.mjs — 独立模式的端到端冒烟：起服务 → 建三级数据 → 校验进度 → 收工。
 *
 *   node test/smoke.mjs
 *
 * 只碰临时数据文件，不动 ~/.dsh/state 里的真数据。
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PORT = 7431
const DATA = path.join(ROOT, `.smoke-data-${process.pid}.json`)

const BASE = `http://127.0.0.1:${PORT}/api`

let failures = 0

function check(label, condition, detail) {
  const mark = condition ? 'ok  ' : 'FAIL'
  if (!condition) failures += 1
  console.log(`${mark} ${label}${detail === undefined ? '' : `  ${detail}`}`)
}

async function call(method, route, body) {
  const response = await fetch(BASE + route, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload }
}

async function waitReady(deadlineMs) {
  const stop = Date.now() + deadlineMs
  while (Date.now() < stop) {
    try {
      const { status } = await call('GET', '/state')
      if (status === 200) return true
    } catch {
      /* 还没起来 */
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return false
}

const child = spawn(process.execPath, [path.join(ROOT, 'bin', 'worklist.js'), 'serve', '--port', String(PORT), '--data', DATA], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
child.stdout.on('data', (chunk) => { serverLog += chunk })
child.stderr.on('data', (chunk) => { serverLog += chunk })

const stop = () => {
  try { child.kill() } catch { /* 已经退出 */ }
}

try {
  const ready = await waitReady(8000)
  check('server 起来了', ready, ready ? `${BASE}` : serverLog.trim().slice(0, 300))
  if (!ready) throw new Error('server not ready')

  const empty = await call('GET', '/state')
  check('空状态可用', empty.status === 200 && Array.isArray(empty.payload.state.projects), `projects=${empty.payload.state.projects?.length}`)

  const project = await call('POST', '/projects', { title: '冒烟项目', path: os.tmpdir() })
  check('建项目', project.status === 201, `id=${project.payload.project?.id}`)
  const projectId = project.payload.project?.id

  const category = await call('POST', '/categories', { projectId, title: '开发' })
  check('建分类', category.status === 201, `id=${category.payload.category?.id}`)
  const categoryId = category.payload.category?.id

  const task = await call('POST', '/tasks', {
    categoryId,
    title: '写接口',
    weight: 3,
    steps: [
      { title: '定 schema', weight: 1 },
      { title: '写 handler', weight: 2 },
      { title: '补测试', weight: 1 },
    ],
  })
  check('建工作 + 三步', task.status === 201 && task.payload.task?.steps?.length === 3, `steps=${task.payload.task?.steps?.length}`)
  const taskId = task.payload.task?.id

  let state = await call('GET', '/state')
  const found = state.payload.state.projects?.[0]?.categories?.[0]?.tasks?.[0]
  check('三级结构挂上了', Boolean(found) && found.steps.length === 3)
  check('权重进度 0%', found?.progress === 0, `progress=${found?.progress}`)

  const stepOne = found.steps[0]
  await call('PATCH', `/tasks/${taskId}/steps/${stepOne.id}`, { done: true })
  state = await call('GET', '/state')
  const afterOne = state.payload.state.projects?.[0]?.categories?.[0]?.tasks?.[0]
  check('完成 1/4 权重 → 0.25', afterOne?.progress === 0.25, `progress=${afterOne?.progress}`)

  await call('PATCH', `/tasks/${taskId}`, { done: true })
  state = await call('GET', '/state')
  const doneTask = state.payload.state.projects?.[0]?.categories?.[0]?.tasks?.[0]
  check('整体勾完成 → 1', doneTask?.progress === 1, `progress=${doneTask?.progress}`)
  check('项目进度跟上', state.payload.state.projects?.[0]?.progress === 1, `project=${state.payload.state.projects?.[0]?.progress}`)

  const noAi = await call('POST', '/ai-split', { title: '随便', steps: [] })
  check('独立模式没有 AI 拆分（明确拒绝）', noAi.status === 501, `status=${noAi.status} ${noAi.payload.error ?? ''}`)

  const bad = await call('POST', '/projects', { title: '' })
  check('空名字被拒', bad.status === 400, `status=${bad.status}`)

  const openBad = await call('POST', `/projects/${projectId}/open`)
  check('打开不存在的目录有反馈', openBad.status === 400 || openBad.status === 200, `status=${openBad.status}`)

  const removed = await call('DELETE', `/projects/${projectId}`)
  check('删项目（级联）', removed.status === 200, `status=${removed.status}`)
  state = await call('GET', '/state')
  check('级联删干净', state.payload.state.projects?.length === 0)
} catch (error) {
  failures += 1
  console.log(`FAIL 异常：${error.message}`)
} finally {
  stop()
  await new Promise((resolve) => setTimeout(resolve, 250))
  try { fs.rmSync(DATA, { force: true }) } catch { /* 忽略 */ }
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)