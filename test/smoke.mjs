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

  // 外观配置：默认值 → 局部改 → 非法值被夹住 → 标签深合并 → 恢复默认
  const uiDefault = await call('GET', '/ui')
  check('外观有默认值', uiDefault.status === 200 && uiDefault.payload.ui?.accent === '#3f6be6' && uiDefault.payload.ui?.labels?.projects === '项目')
  const uiPatched = await call('PATCH', '/ui', { theme: 'dark', accent: '#2f9e6f', labels: { appName: '我的板' } })
  check('改主题与强调色', uiPatched.payload.ui?.theme === 'dark' && uiPatched.payload.ui?.accent === '#2f9e6f')
  check('标签深合并', uiPatched.payload.ui?.labels?.appName === '我的板' && uiPatched.payload.ui?.labels?.projects === '项目')
  // 非法色值会被打回默认色（不是保留上一次），数值越界则夹到边界
  const uiClamped = await call('PATCH', '/ui', { fontScale: 9, radius: -5, sidebarWidth: 9999, accent: 'red' })
  check('非法外观值被夹住', uiClamped.payload.ui?.fontScale === 1.3 && uiClamped.payload.ui?.radius === 0 &&
    uiClamped.payload.ui?.sidebarWidth === 380 && uiClamped.payload.ui?.accent === '#3f6be6', JSON.stringify(uiClamped.payload.ui))
  const uiReset = await call('POST', '/ui/reset')
  check('恢复默认外观', uiReset.payload.ui?.theme === 'auto' && uiReset.payload.ui?.labels?.appName === '工作清单')
  // 液态玻璃：默认关；开了之后 alpha / blur 都要被夹到可用区间
  check('玻璃默认关', uiDefault.payload.ui?.glass === false && uiDefault.payload.ui?.glassAlpha > 0 && uiDefault.payload.ui?.glassBlur >= 4)
  const uiGlass = await call('PATCH', '/ui', { glass: true, glassAlpha: 2, glassBlur: 999 })
  check('玻璃参数被夹住', uiGlass.payload.ui?.glass === true &&
    uiGlass.payload.ui?.glassAlpha === 0.85 && uiGlass.payload.ui?.glassBlur === 40, JSON.stringify(uiGlass.payload.ui))

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

  // 移动到别的分类：右键菜单「移动到…」调的就是这条 PATCH，单开一个项目免得干扰别的断言
  const mvProj = await call('POST', '/projects', { title: '搬家项目' })
  const mvId = mvProj.payload.project?.id
  const mvA = await call('POST', '/categories', { projectId: mvId, title: 'A 分类' })
  const mvB = await call('POST', '/categories', { projectId: mvId, title: 'B 分类' })
  const mvAId = mvA.payload.category?.id
  const mvBId = mvB.payload.category?.id
  const mvTask = await call('POST', '/tasks', { categoryId: mvAId, title: '要搬家的一条', weight: 1 })
  const mvTaskId = mvTask.payload.task?.id
  const mvRes = await call('PATCH', `/tasks/${mvTaskId}`, { categoryId: mvBId })
  check('工作可以移动到别的分类', mvRes.status === 200 && mvRes.payload.task?.categoryId === mvBId, `status=${mvRes.status}`)
  const mvState = (await call('GET', '/state')).payload.state
  const inB = (categoryById(mvState, mvBId)?.tasks ?? []).some((item) => item.id === mvTaskId)
  const inA = (categoryById(mvState, mvAId)?.tasks ?? []).some((item) => item.id === mvTaskId)
  check('移动后只出现在新分类里', inB && !inA, `dest=${inB} source=${inA}`)
  const mvProjState = mvState.projects.find((item) => item.id === mvId)
  check('跨分类移动不影响项目任务数', mvProjState?.taskCount === 1, `taskCount=${mvProjState?.taskCount}`)
  await call('DELETE', `/projects/${mvId}`)

  // 已完成的工作不算逾期：项目/分类级的「逾期」只看没做完的
  const odProj = await call('POST', '/projects', { title: '逾期项目' })
  const odId = odProj.payload.project?.id
  const odCat = await call('POST', '/categories', { projectId: odId, title: '逾期分类' })
  const odCatId = odCat.payload.category?.id
  const past = new Date(Date.now() - 3 * 86400000).toISOString()
  const odTask = await call('POST', '/tasks', { categoryId: odCatId, title: '过期的小事', dueAt: past })
  const odTaskId = odTask.payload.task?.id
  let odState = (await call('GET', '/state')).payload.state
  const odBefore = odState.projects.find((item) => item.id === odId)
  check('没做完的过期工作算逾期', odBefore?.due === 'overdue', `due=${odBefore?.due}`)
  await call('PATCH', `/tasks/${odTaskId}`, { done: true })
  odState = (await call('GET', '/state')).payload.state
  const odAfter = odState.projects.find((item) => item.id === odId)
  const odCatAfter = categoryById(odState, odCatId)
  check(
    '做完的工作不再算逾期',
    odAfter?.due !== 'overdue' && odCatAfter?.due !== 'overdue',
    `project=${odAfter?.due} category=${odCatAfter?.due}`,
  )
  await call('DELETE', `/projects/${odId}`)

  // 冒烟不能真去开资源管理器：开一个存在的目录会弹窗口，开一个不存在的会弹系统错误框。
  // 所以这里只验「目录不存在会被拦住」，绝不触发 openFolder。
  const gonePath = path.join(ROOT, `.smoke-gone-${process.pid}`)
  const goneProj = await call('POST', '/projects', { title: '目录已删项目', path: gonePath })
  const goneId = goneProj.payload.project?.id
  fs.rmSync(gonePath, { recursive: true, force: true })
  const openBad = await call('POST', `/projects/${goneId}/open`)
  check('打开不存在的目录被拦住', openBad.status === 400, `status=${openBad.status}`)
  await call('DELETE', `/projects/${goneId}`)

  // 归档：默认不算进度、不算任务数，但数据还在
  const arcTask = await call('POST', '/tasks', { categoryId, title: '这条要归档', weight: 1 })
  const arcId = arcTask.payload.task?.id
  const pBefore = (await call('GET', '/state')).payload.state.projects.find((p) => p.id === projectId)
  const arch = await call('PATCH', `/tasks/${arcId}`, { archived: true })
  check('可以归档工作', arch.status === 200 && arch.payload.task?.archived === true, `status=${arch.status}`)
  const afterArch = (await call('GET', '/state')).payload.state
  const pAfter = afterArch.projects.find((p) => p.id === projectId)
  check('归档的工作还留在数据里', afterArch.tasks.some((t) => t.id === arcId && t.archived === true))
  check('归档后不计入任务数', pAfter.taskCount === pBefore.taskCount - 1, `${pBefore.taskCount} → ${pAfter.taskCount}`)
  check('归档后不在 DDL 预警里', !afterArch.categories.some((c) => c.kind === 'ddl' && c.tasks.some((t) => t.cloneOf === arcId)))
  const unarch = await call('PATCH', `/tasks/${arcId}`, { archived: false })
  const pBack = (await call('GET', '/state')).payload.state.projects.find((p) => p.id === projectId)
  check('取消归档回到统计', unarch.payload.task?.archived === false && pBack.taskCount === pBefore.taskCount, `${pBack.taskCount}`)
  const catArch = await call('PATCH', `/categories/${categoryId}`, { archived: true })
  const pCatArch = (await call('GET', '/state')).payload.state.projects.find((p) => p.id === projectId)
  check('可以归档分类', catArch.payload.category?.archived === true)
  check('归档分类后它的工作不计入项目', pCatArch.taskCount === 0, `taskCount=${pCatArch.taskCount}`)
  await call('PATCH', `/categories/${categoryId}`, { archived: false })
  const projArch = await call('PATCH', `/projects/${projectId}`, { archived: true })
  check('可以归档项目', projArch.payload.project?.archived === true)
  await call('PATCH', `/projects/${projectId}`, { archived: false })

  // 删除项目时连文件夹一起删（?files=1）
  const purgeProj = await call('POST', '/projects', { title: '删除试验', path: path.join(FS_ROOT, 'purge') })
  const purgeId = purgeProj.payload.project?.id
  await call('POST', '/categories', { projectId: purgeId, title: '要删的分类' })
  check('删除前文件夹在', fs.existsSync(path.join(FS_ROOT, 'purge', '要删的分类')), path.join(FS_ROOT, 'purge'))
  const purged = await call('DELETE', `/projects/${purgeId}?files=1`)
  check('可以连文件夹一起删', purged.status === 200 && purged.payload.purged !== null && !fs.existsSync(path.join(FS_ROOT, 'purge')), `purged=${purged.payload.purged}`)
  check('连文件夹删的项目也没了', (await call('GET', '/state')).payload.state.projects.every((p) => p.id !== purgeId))

  // 安全闸：盘符根、不存在、空路径都不许整目录删
  const rootProj = await call('POST', '/projects', { title: '根目录试验', path: path.parse(FS_ROOT).root })
  const rootDel = await call('DELETE', `/projects/${rootProj.payload.project?.id}?files=1`)
  check('盘符根不会被删掉', rootDel.payload.purged === null && typeof rootDel.payload.skipped === 'string', `skipped=${rootDel.payload.skipped}`)
  const ghostPath = path.join(FS_ROOT, 'no-such-dir')
  const ghostProj = await call('POST', '/projects', { title: '不存在试验', path: ghostPath })
  // 建项目时会顺手把默认分类的文件夹建出来，先手动删掉，模拟「目录已经不在了」
  fs.rmSync(ghostPath, { recursive: true, force: true })
  const ghostDel = await call('DELETE', `/projects/${ghostProj.payload.project?.id}?files=1`)
  check('不存在的目录跳过', ghostDel.payload.purged === null, `skipped=${ghostDel.payload.skipped}`)

  const removed = await call('DELETE', `/projects/${projectId}`)
  check('删项目（级联）', removed.status === 200, `status=${removed.status}`)
  await call('DELETE', `/projects/${otherId}`)

  // 项目改名 → 项目文件夹跟着改名（文件夹名正好是旧项目名时）
  const p2 = await call('POST', '/projects', { title: '项目甲', path: path.join(FS_ROOT, '项目甲') })
  const p2Id = p2.payload.project?.id
  await call('POST', '/categories', { projectId: p2Id, title: '分支A' })
  check('项目甲的文件夹建好', fs.existsSync(path.join(FS_ROOT, '项目甲', '分支A')), path.join(FS_ROOT, '项目甲'))
  const p2Renamed = await call('PATCH', `/projects/${p2Id}`, { title: '项目乙' })
  check('改项目名时文件夹跟着改',
    p2Renamed.payload.project?.path === path.join(FS_ROOT, '项目乙') &&
      fs.existsSync(path.join(FS_ROOT, '项目乙', '分支A', '分支A.txt')) &&
      !fs.existsSync(path.join(FS_ROOT, '项目甲')),
    `path=${p2Renamed.payload.project?.path}`)
  const p2Same = await call('PATCH', `/projects/${p2Id}`, { title: '项目乙' })
  check('名字没变就不动文件夹', p2Same.payload.project?.path === path.join(FS_ROOT, '项目乙'), `path=${p2Same.payload.project?.path}`)
  await call('DELETE', `/projects/${p2Id}`)

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