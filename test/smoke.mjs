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
const FS_ROOT = path.join(ROOT, `.smoke-fs-${process.pid}`)

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

const projectOf = (state) => state.projects?.[0]
const categoryById = (state, id) => (state.categories ?? []).find((item) => item.id === id)
const ddlOf = (state, projectId) => (state.categories ?? []).find((item) => item.projectId === projectId && item.kind === 'ddl')

try {
  const ready = await waitReady(8000)
  check('server 起来了', ready, ready ? `${BASE}` : serverLog.trim().slice(0, 300))
  if (!ready) throw new Error('server not ready')

  const empty = await call('GET', '/state')
  check('空状态可用', empty.status === 200 && Array.isArray(empty.payload.state.projects), `projects=${empty.payload.state.projects?.length}`)

  fs.mkdirSync(FS_ROOT, { recursive: true })
  const project = await call('POST', '/projects', { title: '冒烟项目', path: FS_ROOT })
  check('建项目', project.status === 201, `id=${project.payload.project?.id}`)
  const projectId = project.payload.project?.id

  let state = (await call('GET', '/state')).payload.state
  let names = (projectOf(state)?.categories ?? []).map((item) => item.title)
  check('新项目自带四个分类', names.length === 4, names.join(' / '))
  check('三个默认分类', names.includes('重要工作') && names.includes('一般工作') && names.includes('长期工作'))
  const ddl = ddlOf(state, projectId)
  check('有锁定的 DDL预警 分类', ddl?.locked === true && ddl?.title === 'DDL预警', `locked=${ddl?.locked}`)
  check('默认预警时长 24 小时', projectOf(state)?.warnHours === 24, `warnHours=${projectOf(state)?.warnHours}`)

  const seededDir = path.join(FS_ROOT, '重要工作')
  const seededFile = path.join(seededDir, '重要工作.txt')
  check('新项目三分类各建了文件夹', fs.existsSync(path.join(FS_ROOT, '长期工作')), FS_ROOT)
  check('文件夹里有同名 txt', fs.existsSync(seededFile), seededFile)

  const category = await call('POST', '/categories', { projectId, title: '开发' })
  check('建分类', category.status === 201, `id=${category.payload.category?.id}`)
  const categoryId = category.payload.category?.id
  const catDir = path.join(FS_ROOT, '开发')
  const catFile = path.join(catDir, '开发.txt')
  check('建分类时自动建了文件夹', fs.existsSync(catDir), catDir)
  check('txt 里记下了建分类', fs.readFileSync(catFile, 'utf8').includes('新建分类「开发」'), catFile)

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
  check('txt 里记下了建工作', fs.readFileSync(catFile, 'utf8').includes('新建工作「写接口」'), catFile)

  state = (await call('GET', '/state')).payload.state
  const found = (categoryById(state, categoryId)?.tasks ?? [])[0]
  check('三级结构挂上了', Boolean(found) && found.steps.length === 3)
  check('权重进度 0%', found?.progress === 0, `progress=${found?.progress}`)

  const stepOne = found.steps[0]
  await call('PATCH', `/tasks/${taskId}/steps/${stepOne.id}`, { done: true })
  state = (await call('GET', '/state')).payload.state
  const afterOne = (categoryById(state, categoryId)?.tasks ?? [])[0]
  check('完成 1/4 权重 → 0.25', afterOne?.progress === 0.25, `progress=${afterOne?.progress}`)

  /* ---- DDL 预警：克隆、提前量 ---- */

  const inTwoHours = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  await call('PATCH', `/tasks/${taskId}`, { dueAt: inTwoHours })
  state = (await call('GET', '/state')).payload.state
  let ddlCategory = ddlOf(state, projectId)
  check('撞线工作被克隆进 DDL预警', ddlCategory?.tasks?.length === 1, `tasks=${ddlCategory?.tasks?.length}`)
  check('克隆指向原工作', ddlCategory?.tasks?.[0]?.cloneOf === taskId, `cloneOf=${ddlCategory?.tasks?.[0]?.cloneOf}`)
  check('克隆不算进项目任务数', projectOf(state)?.taskCount === 1, `taskCount=${projectOf(state)?.taskCount}`)

  const shorten = await call('PATCH', `/projects/${projectId}`, { warnHours: 1 })
  check('调整预警时长 → 1 小时', shorten.status === 200 && shorten.payload.project?.warnHours === 1, `warnHours=${shorten.payload.project?.warnHours}`)
  state = (await call('GET', '/state')).payload.state
  ddlCategory = ddlOf(state, projectId)
  check('2 小时后到期的被移出 1 小时窗口', ddlCategory?.tasks?.length === 0, `tasks=${ddlCategory?.tasks?.length}`)

  const widen = await call('PATCH', `/projects/${projectId}`, { warnHours: 0 })
  check('预警时长最小 1 小时', widen.payload.project?.warnHours === 1, `warnHours=${widen.payload.project?.warnHours}`)

  /* ---- 逐条预警：每条工作可以有自己的提前量 ---- */

  const ownWarn = await call('PATCH', `/tasks/${taskId}`, { warnHours: 6 })
  check('给单条工作单独设 6 小时', ownWarn.status === 200 && ownWarn.payload.task?.warnHours === 6, `warnHours=${ownWarn.payload.task?.warnHours}`)
  state = (await call('GET', '/state')).payload.state
  ddlCategory = ddlOf(state, projectId)
  check('单条预警盖过项目默认（重新进线）', ddlCategory?.tasks?.length === 1, `tasks=${ddlCategory?.tasks?.length}`)
  const cloneOwn = ddlCategory?.tasks?.[0]
  check('克隆带自己的预警时长', cloneOwn?.warnHours === 6 && cloneOwn?.warnOwn === true, `warnHours=${cloneOwn?.warnHours} warnOwn=${cloneOwn?.warnOwn}`)

  const farOut = new Date(Date.now() + 30 * 3600 * 1000).toISOString()
  const secondTask = await call('POST', '/tasks', { categoryId, title: '更远的一件事', dueAt: farOut, weight: 1 })
  const secondId = secondTask.payload.task?.id
  state = (await call('GET', '/state')).payload.state
  check('30 小时后到期的默认不进线（项目默认 1 小时）', (ddlOf(state, projectId)?.tasks ?? []).length === 1, `tasks=${(ddlOf(state, projectId)?.tasks ?? []).length}`)

  await call('PATCH', `/tasks/${secondId}`, { warnHours: 48 })
  state = (await call('GET', '/state')).payload.state
  ddlCategory = ddlOf(state, projectId)
  const cloneIds = (ddlCategory?.tasks ?? []).map((item) => item.cloneOf).sort()
  check('两条工作各按自己的分钟进线', cloneIds.length === 2 && cloneIds.includes(secondId), `cloneOf=${cloneIds.join(',')}`)
  const hoursByTask = new Map((ddlCategory?.tasks ?? []).map((item) => [item.cloneOf, item.warnHours]))
  check('同一条预警分类里两种提前量并存', hoursByTask.get(taskId) === 6 && hoursByTask.get(secondId) === 48, `${hoursByTask.get(taskId)}/${hoursByTask.get(secondId)}`)

  const clearWarn = await call('PATCH', `/tasks/${taskId}`, { warnHours: null })
  check('清空后回到跟随项目', clearWarn.payload.task?.warnHours === null, `warnHours=${String(clearWarn.payload.task?.warnHours)}`)
  state = (await call('GET', '/state')).payload.state
  ddlCategory = ddlOf(state, projectId)
  check('回落后按项目默认移出', (ddlCategory?.tasks ?? []).map((item) => item.cloneOf).join(',') === secondId, `cloneOf=${(ddlCategory?.tasks ?? []).map((item) => item.cloneOf).join(',')}`)
  const backTask = (categoryById(state, categoryId)?.tasks ?? []).find((item) => item.id === taskId)
  check('回落后 warnOwn 变 false', backTask?.warnOwn === false && backTask?.warnHours === 1, `warnOwn=${backTask?.warnOwn} warnHours=${backTask?.warnHours}`)

  await call('DELETE', `/tasks/${secondId}`)
  state = (await call('GET', '/state')).payload.state
  check('删掉第二条后只剩原工作', projectOf(state)?.taskCount === 1, `taskCount=${projectOf(state)?.taskCount}`)
  ddlCategory = ddlOf(state, projectId)

  const renameDdl = await call('PATCH', `/categories/${ddlCategory.id}`, { title: '改个名' })
  check('DDL预警 不能改名', renameDdl.status === 409, `status=${renameDdl.status}`)
  const deleteDdl = await call('DELETE', `/categories/${ddlCategory.id}`)
  check('DDL预警 不能删除', deleteDdl.status === 409, `status=${deleteDdl.status}`)

  const renameNormal = await call('PATCH', `/categories/${categoryId}`, { title: '开发（改名）' })
  check('普通分类可以改名', renameNormal.status === 200, `title=${renameNormal.payload.category?.title}`)
  const movedDir = path.join(FS_ROOT, '开发（改名）')
  const movedFile = path.join(movedDir, '开发（改名）.txt')
  const movedText = fs.existsSync(movedFile) ? fs.readFileSync(movedFile, 'utf8') : ''
  check('改名时文件夹跟着改', fs.existsSync(movedDir) && !fs.existsSync(catDir), movedDir)
  check('改名后旧记录还在', movedText.includes('新建工作「写接口」') && movedText.includes('分类改名为「开发（改名）」'), movedFile.split(path.sep).pop())

  await call('PATCH', `/tasks/${taskId}`, { done: true })
  state = (await call('GET', '/state')).payload.state
  const doneTask = (categoryById(state, categoryId)?.tasks ?? [])[0]
  check('整体勾完成 → 1', doneTask?.progress === 1, `progress=${doneTask?.progress}`)
  check('项目进度跟上', projectOf(state)?.progress === 1, `project=${projectOf(state)?.progress}`)

  const noAi = await call('POST', '/ai-split', { title: '随便', steps: [] })
  check('独立模式没有 AI 拆分（明确拒绝）', noAi.status === 501, `status=${noAi.status} ${noAi.payload.error ?? ''}`)

  const firstCat = projectOf(state)?.categories?.[0]
  check('DDL预警 永远排第一', firstCat?.kind === 'ddl', `first=${firstCat?.title}`)

  await call('PATCH', `/categories/${categoryId}`, { pinned: true })
  state = (await call('GET', '/state')).payload.state
  const order = (projectOf(state)?.categories ?? []).map((item) => (item.kind === 'ddl' ? 'ddl' : item.title))
  check('置顶分类排在 DDL 之后、其它分类之前', order[0] === 'ddl' && order[1] === '开发（改名）', `order=${order.join(' / ')}`)

  const pinnedTask = await call('POST', '/tasks', { categoryId, title: '置顶的那条' })
  const pinnedTaskId = pinnedTask.payload.task?.id
  await call('PATCH', `/tasks/${pinnedTaskId}`, { pinned: true })
  state = (await call('GET', '/state')).payload.state
  const tasksNow = categoryById(state, categoryId)?.tasks ?? []
  check('置顶工作排到本分类第一', tasksNow[0]?.id === pinnedTaskId && tasksNow[0]?.pinned === true, `first=${tasksNow[0]?.title}`)

  const otherProj = await call('POST', '/projects', { title: '另一个项目' })
  const otherId = otherProj.payload.project?.id
  await call('PATCH', `/projects/${otherId}`, { pinned: true })
  state = (await call('GET', '/state')).payload.state
  check('置顶项目排到最前', state.projects?.[0]?.id === otherId && state.projects?.[0]?.pinned === true, `first=${state.projects?.[0]?.title}`)

  const noPin = await call('PATCH', `/tasks/${pinnedTaskId}`, { pinned: false })
  check('可以取消置顶', noPin.payload.task?.pinned === false, `pinned=${String(noPin.payload.task?.pinned)}`)

  const bad = await call('POST', '/projects', { title: '' })
  check('空名字被拒', bad.status === 400, `status=${bad.status}`)

  const openBad = await call('POST', `/projects/${projectId}/open`)
  check('打开不存在的目录有反馈', openBad.status === 400 || openBad.status === 200, `status=${openBad.status}`)

  const removed = await call('DELETE', `/projects/${projectId}`)
  check('删项目（级联）', removed.status === 200, `status=${removed.status}`)
  await call('DELETE', `/projects/${otherId}`)
  state = (await call('GET', '/state')).payload.state
  check('级联删干净', state.projects?.length === 0 && state.categories?.length === 0 && state.tasks?.length === 0)
} catch (error) {
  failures += 1
  console.log(`FAIL 异常：${error.message}`)
} finally {
  stop()
  await new Promise((resolve) => setTimeout(resolve, 250))
  try { fs.rmSync(DATA, { force: true }) } catch { /* 忽略 */ }
  try { fs.rmSync(FS_ROOT, { recursive: true, force: true }) } catch { /* 忽略 */ }
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)