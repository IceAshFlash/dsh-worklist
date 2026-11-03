/**
 * core/api.js — 一套 HTTP 接口，两处复用：
 *
 *   - DSH 里的 Host 半边（挂在 /dsh-worklist-api 下）
 *   - 独立启动的桌面窗口（挂在 /api 下）
 *
 * 两边吃同一份数据和同一套规则，所以面板里改的和窗口里改的不会打架。
 * 「AI 拆分」是唯一需要宿主的动作：core 只负责把请求转给外面传进来的 aiSplit。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import {
  PALETTE,
  buildProjectCategories,
  clampWarnHours,
  decorate,
  mutate,
  newId,
  read,
  taskWarnHours,
  toTimestamp,
  toWeight,
} from './store.js'

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const bad = (message) => new ApiError(400, message)
const missing = (message) => new ApiError(404, message)

// 版本号进 /meta：换了 bundle 之后能一眼看出宿主加载的是哪一版。
const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return 'unknown'
  }
})()

const text = (value) => (typeof value === 'string' ? value.trim() : '')

const num = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const requireText = (value, label) => {
  const trimmed = text(value)
  if (trimmed === '') throw bad(`${label} 不能为空`)
  return trimmed
}

export const createApi = ({ file, aiSplit = null, openFolder = null, now = () => Date.now() }) => {
  const snapshot = async () => decorate(await read(file), now())

  /* ---------------- projects ---------------- */

  const addProject = (body) => mutate(file, (state) => {
    const createdAt = now()
    const project = {
      id: newId('pj'),
      title: requireText(body.title, '项目名'),
      path: text(body.path),
      color: text(body.color) || PALETTE[state.projects.length % PALETTE.length],
      note: text(body.note),
      warnHours: clampWarnHours(body.warnHours),
      scaffold: 2,
      createdAt,
    }
    state.projects.push(project)
    // 新项目自带：重要工作 / 一般工作 / 长期工作 + 锁定的 DDL预警。
    state.categories.push(...buildProjectCategories(project.id, createdAt))
    return project
  })

  /* ---------------- categories ---------------- */

  const addCategory = (body) => mutate(file, (state) => {
    const projectId = requireText(body.projectId, 'projectId')
    if (!state.projects.some((project) => project.id === projectId)) throw missing('项目不存在')
    const siblings = state.categories.filter((category) => category.projectId === projectId)
    const category = {
      id: newId('ct'),
      projectId,
      title: requireText(body.title, '分类名'),
      color: text(body.color) || PALETTE[siblings.length % PALETTE.length],
      order: num(body.order, siblings.length),
      collapsed: false,
      createdAt: now(),
    }
    state.categories.push(category)
    return category
  })

  /* ---------------- tasks ---------------- */

  const buildSteps = (raw) => {
    if (!Array.isArray(raw)) return []
    return raw.map((item) => ({
      id: newId('st'),
      title: requireText(item?.title, '步骤名'),
      weight: toWeight(item?.weight, 1),
      done: item?.done === true,
    }))
  }

  const addTask = (body) => mutate(file, (state) => {
    const categoryId = requireText(body.categoryId, 'categoryId')
    const parentCategory = state.categories.find((category) => category.id === categoryId)
    if (parentCategory === undefined) throw missing('分类不存在')
    if (parentCategory.kind === 'ddl') throw bad('DDL预警分类只放自动收录的克隆，不能直接往里加工作')
    const task = {
      id: newId('tk'),
      categoryId,
      title: requireText(body.title, '工作名'),
      weight: toWeight(body.weight, 1),
      done: false,
      dueAt: toTimestamp(body.dueAt),
      note: text(body.note),
      warnHours: taskWarnHours(body.warnHours),
      steps: buildSteps(body.steps),
      createdAt: now(),
      updatedAt: now(),
    }
    state.tasks.push(task)
    return task
  })

  const findTask = (state, id) => {
    const task = state.tasks.find((item) => item.id === id)
    if (task === undefined) throw missing('工作不存在')
    return task
  }

  const patchTask = (id, body) => mutate(file, (state) => {
    const task = findTask(state, id)
    if (body.title !== undefined) task.title = requireText(body.title, '工作名')
    if (body.weight !== undefined) task.weight = toWeight(body.weight, task.weight)
    if (body.done !== undefined) {
      // 勾「完成」时把步骤一起勾上，否则带步骤的工作进度不会动。
      task.done = body.done === true
      task.steps = task.steps.map((step) => ({ ...step, done: task.done }))
    }
    if (body.note !== undefined) task.note = text(body.note)
    if (body.dueAt !== undefined) task.dueAt = toTimestamp(body.dueAt)
    // 传 null / 空串 = 回到"跟随项目默认"。
    if (body.warnHours !== undefined) task.warnHours = taskWarnHours(body.warnHours)
    if (body.pinned !== undefined) task.pinned = body.pinned === true
    if (body.categoryId !== undefined) {
      const categoryId = requireText(body.categoryId, 'categoryId')
      const target = state.categories.find((category) => category.id === categoryId)
      if (target === undefined) throw missing('分类不存在')
      if (target.kind === 'ddl') throw bad('DDL预警分类只放自动收录的克隆，工作不能移进去')
      task.categoryId = categoryId
    }
    if (Array.isArray(body.steps)) {
      const previous = new Map(task.steps.map((step) => [step.id, step]))
      task.steps = body.steps.map((item) => {
        const existing = previous.get(text(item?.id))
        return {
          id: existing?.id ?? newId('st'),
          title: requireText(item?.title, '步骤名'),
          weight: toWeight(item?.weight, 1),
          done: item?.done === true || existing?.done === true && item?.done !== false,
        }
      })
    }
    task.updatedAt = now()
    return task
  })

  /* ---------------- steps ---------------- */

  const addStep = (taskId, body) => mutate(file, (state) => {
    const task = findTask(state, taskId)
    const step = {
      id: newId('st'),
      title: requireText(body.title, '步骤名'),
      weight: toWeight(body.weight, 1),
      done: false,
    }
    task.steps.push(step)
    task.updatedAt = now()
    return step
  })

  const patchStep = (taskId, stepId, body) => mutate(file, (state) => {
    const task = findTask(state, taskId)
    const step = task.steps.find((item) => item.id === stepId)
    if (step === undefined) throw missing('步骤不存在')
    if (body.title !== undefined) step.title = requireText(body.title, '步骤名')
    if (body.weight !== undefined) step.weight = toWeight(body.weight, step.weight)
    if (body.done !== undefined) step.done = body.done === true
    task.updatedAt = now()
    return step
  })

  const removeStep = (taskId, stepId) => mutate(file, (state) => {
    const task = findTask(state, taskId)
    const before = task.steps.length
    task.steps = task.steps.filter((item) => item.id !== stepId)
    if (task.steps.length === before) throw missing('步骤不存在')
    task.updatedAt = now()
    return { ok: true }
  })

  /* ---------------- 文件夹浏览（"选择文件夹"弹窗用） ---------------- */

  const driveRoots = () => {
    if (process.platform !== 'win32') return ['/']
    const roots = []
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`
      try {
        if (fs.statSync(drive).isDirectory()) roots.push(drive)
      } catch {
        // 没有这个盘
      }
    }
    return roots
  }

  const listFolders = (rawPath) => {
    const asked = text(rawPath)
    let target = asked === '' ? os.homedir() : path.resolve(asked)
    let stat = null
    try {
      stat = fs.statSync(target)
    } catch {
      stat = null
    }
    if (stat === null || !stat.isDirectory()) {
      target = os.homedir()
      stat = fs.statSync(target)
    }

    const entries = []
    let names = []
    try {
      names = fs.readdirSync(target, { withFileTypes: true })
    } catch (error) {
      throw bad(`读不了这个文件夹：${String(error?.code ?? error)}`)
    }
    for (const entry of names) {
      if (entry.name.startsWith('$')) continue // 系统保留目录（$RECYCLE.BIN 之类）
      let isDirectory = entry.isDirectory()
      if (!isDirectory && entry.isSymbolicLink()) {
        try {
          isDirectory = fs.statSync(path.join(target, entry.name)).isDirectory()
        } catch {
          isDirectory = false
        }
      }
      if (!isDirectory) continue
      entries.push({ name: entry.name, path: path.join(target, entry.name) })
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

    const parent = path.dirname(target)
    return {
      path: target,
      parent: parent === target ? null : parent,
      name: path.basename(target) || target,
      home: os.homedir(),
      roots: driveRoots(),
      entries,
    }
  }

  const makeFolder = (body) => {
    const parent = path.resolve(requireText(body.parent, '所在位置'))
    const name = requireText(body.name, '文件夹名')
    if (/[\\/:*?"<>|]/.test(name)) throw bad('文件夹名里不能有 \\ / : * ? " < > |')
    if (!fs.existsSync(parent)) throw bad('所在位置不存在')
    const target = path.join(parent, name)
    try {
      fs.mkdirSync(target)
    } catch (error) {
      if (error?.code === 'EEXIST') throw bad('这个位置已经有同名文件夹了')
      throw bad(`建不了：${String(error?.code ?? error)}`)
    }
    return target
  }

  /* ---------------- 系统自带的选目录对话框（独立窗口用） ---------------- */

  /**
   * 独立窗口里没有 Electron 的 dialog，只能另起一个进程弹系统的文件夹对话框。
   * 结果写进临时文件再用 UTF-8 读回来 —— 别指望 PowerShell 的 stdout 编码，
   * 中文路径经过控制台会变成问号。
   */
  const PICK_SCRIPT = `param([string]$Out)
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'CenterScreen'
$owner.Show()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择项目文件夹'
$dialog.ShowNewFolderButton = $true
$chosen = ''
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $chosen = $dialog.SelectedPath }
$owner.Close()
[System.IO.File]::WriteAllText($Out, $chosen, (New-Object System.Text.UTF8Encoding($false)))
`

  const writeTempScript = (name, content) => {
    const dirs = [os.tmpdir(), path.dirname(file)]
    let lastError = null
    for (const dir of dirs) {
      try {
        const target = path.join(dir, name)
        fs.writeFileSync(target, content, 'utf8')
        return target
      } catch (error) {
        lastError = error
      }
    }
    throw new ApiError(500, `写不了临时脚本：${String(lastError?.code ?? lastError)}`)
  }

  const pickSystemFolder = () => new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      reject(new ApiError(501, '系统对话框这条路只有 Windows 上有'))
      return
    }
    const stamp = `${process.pid}-${Date.now()}`
    let scriptFile = null
    const outFile = path.join(os.tmpdir(), `wl-pick-${stamp}.txt`)
    const cleanup = () => {
      for (const item of [scriptFile, outFile]) {
        if (item === null) continue
        try { fs.unlinkSync(item) } catch { /* 没写出来就算了 */ }
      }
    }

    try {
      scriptFile = writeTempScript(`wl-pick-${stamp}.ps1`, `\uFEFF${PICK_SCRIPT}`)
    } catch (error) {
      cleanup()
      reject(error)
      return
    }

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile, outFile],
      { windowsHide: true },
    )

    let settled = false
    let timer = null
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      cleanup()
      fn(value)
    }

    // 人可能点了对话框又走开；5 分钟后收摊，别让一个请求挂到天荒地老。
    timer = setTimeout(() => {
      try { child.kill() } catch { /* 已经退了 */ }
      finish(reject, new ApiError(504, '系统对话框等了 5 分钟没人理，先关掉再试'))
    }, 5 * 60 * 1000)

    child.on('error', (error) => {
      finish(reject, new ApiError(500, `起不了 PowerShell：${String(error?.code ?? error)}`))
    })
    child.on('exit', () => {
      let chosen = ''
      try { chosen = fs.readFileSync(outFile, 'utf8') } catch { chosen = '' }
      const trimmed = chosen.trim()
      finish(resolve, trimmed === '' ? null : trimmed)
    })
  })

  /* ---------------- 路由表 ---------------- */

  const routes = [
    ['GET', /^\/fs\/list$/, async ({ query }) => ({
      status: 200,
      body: { ok: true, listing: listFolders(query?.get('path') ?? '') },
    })],
    ['POST', /^\/fs\/mkdir$/, async ({ body }) => ({
      status: 201,
      body: { ok: true, path: makeFolder(body) },
    })],
    ['POST', /^\/fs\/pick$/, async () => ({
      status: 200,
      body: { ok: true, path: await pickSystemFolder() },
    })],
    ['GET', /^\/state$/, async () => ({ status: 200, body: { ok: true, state: await snapshot() } })],
    ['GET', /^\/meta$/, async () => ({
      status: 200,
      body: {
        ok: true,
        version: PACKAGE_VERSION,
        aiAvailable: typeof aiSplit === 'function',
        dataFile: file,
      },
    })],

    ['POST', /^\/projects$/, async ({ body }) => ({ status: 201, body: { ok: true, project: await addProject(body) } })],
    ['POST', /^\/projects\/([^/]+)\/open$/, async ({ params }) => {
      if (typeof openFolder !== 'function') throw new ApiError(409, '这个运行环境不能打开文件夹')
      const state = await read(file)
      const project = state.projects.find((item) => item.id === params[0])
      if (project === undefined) throw missing('项目不存在')
      if (text(project.path) === '') throw bad('这个项目还没填文件夹路径')
      const opened = await openFolder(project.path)
      return { status: 200, body: { ok: true, opened } }
    }],
    ['PATCH', /^\/projects\/([^/]+)$/, async ({ body, params }) => ({
      status: 200,
      body: {
        ok: true,
        project: await mutate(file, (state) => {
          const project = state.projects.find((item) => item.id === params[0])
          if (project === undefined) throw missing('项目不存在')
          if (body.title !== undefined) project.title = requireText(body.title, '项目名')
          if (body.path !== undefined) project.path = text(body.path)
          if (body.color !== undefined) project.color = text(body.color) || project.color
          if (body.note !== undefined) project.note = text(body.note)
          if (body.warnHours !== undefined) project.warnHours = clampWarnHours(body.warnHours)
          if (body.pinned !== undefined) project.pinned = body.pinned === true
          return project
        }),
      },
    })],
    ['DELETE', /^\/projects\/([^/]+)$/, async ({ params }) => ({
      status: 200,
      body: {
        ok: true,
        removed: await mutate(file, (state) => {
          const id = params[0]
          if (!state.projects.some((item) => item.id === id)) throw missing('项目不存在')
          const categories = state.categories.filter((item) => item.projectId === id).map((item) => item.id)
          const tasks = state.tasks.filter((task) => categories.includes(task.categoryId)).length
          state.projects = state.projects.filter((item) => item.id !== id)
          state.categories = state.categories.filter((item) => item.projectId !== id)
          state.tasks = state.tasks.filter((task) => !categories.includes(task.categoryId))
          return { categories: categories.length, tasks }
        }),
      },
    })],

    ['POST', /^\/categories$/, async ({ body }) => ({ status: 201, body: { ok: true, category: await addCategory(body) } })],
    ['PATCH', /^\/categories\/([^/]+)$/, async ({ body, params }) => ({
      status: 200,
      body: {
        ok: true,
        category: await mutate(file, (state) => {
          const category = state.categories.find((item) => item.id === params[0])
          if (category === undefined) throw missing('分类不存在')
          if (category.locked === true) throw new ApiError(409, 'DDL预警分类是自动维护的，不能改名')
          if (body.title !== undefined) category.title = requireText(body.title, '分类名')
          if (body.color !== undefined) category.color = text(body.color) || category.color
          if (body.collapsed !== undefined) category.collapsed = body.collapsed === true
          if (body.pinned !== undefined) category.pinned = body.pinned === true
          if (body.order !== undefined) category.order = num(body.order, category.order)
          return category
        }),
      },
    })],
    ['DELETE', /^\/categories\/([^/]+)$/, async ({ params }) => ({
      status: 200,
      body: {
        ok: true,
        removed: await mutate(file, (state) => {
          const id = params[0]
          const category = state.categories.find((item) => item.id === id)
          if (category === undefined) throw missing('分类不存在')
          if (category.locked === true) throw new ApiError(409, 'DDL预警分类是自动维护的，不能删除')
          const tasks = state.tasks.filter((task) => task.categoryId === id).length
          state.categories = state.categories.filter((item) => item.id !== id)
          state.tasks = state.tasks.filter((task) => task.categoryId !== id)
          return { tasks }
        }),
      },
    })],

    ['POST', /^\/tasks$/, async ({ body }) => ({ status: 201, body: { ok: true, task: await addTask(body) } })],
    ['PATCH', /^\/tasks\/([^/]+)$/, async ({ body, params }) => ({ status: 200, body: { ok: true, task: await patchTask(params[0], body) } })],
    ['DELETE', /^\/tasks\/([^/]+)$/, async ({ params }) => ({
      status: 200,
      body: { ok: true, removed: await mutate(file, (state) => {
        const before = state.tasks.length
        state.tasks = state.tasks.filter((item) => item.id !== params[0])
        if (state.tasks.length === before) throw missing('工作不存在')
        return { tasks: 1 }
      }) },
    })],

    ['POST', /^\/tasks\/([^/]+)\/steps$/, async ({ body, params }) => ({ status: 201, body: { ok: true, step: await addStep(params[0], body) } })],
    ['PATCH', /^\/tasks\/([^/]+)\/steps\/([^/]+)$/, async ({ body, params }) => ({
      status: 200,
      body: { ok: true, step: await patchStep(params[0], params[1], body) },
    })],
    ['DELETE', /^\/tasks\/([^/]+)\/steps\/([^/]+)$/, async ({ params }) => ({
      status: 200,
      body: { ok: true, removed: await removeStep(params[0], params[1]) },
    })],

    ['POST', /^\/ai-split$/, async ({ body }) => {
      if (typeof aiSplit !== 'function') {
        throw new ApiError(501, 'AI 拆分只在 DSH 里可用：独立窗口没有模型。')
      }
      const taskId = text(body.taskId)
      let task = null
      if (taskId !== '') {
        const state = await read(file)
        task = state.tasks.find((item) => item.id === taskId) ?? null
      }
      const request = {
        title: text(body.title) || task?.title || '',
        note: text(body.note) || task?.note || '',
        steps: Array.isArray(body.steps) ? body.steps : (task?.steps ?? []),
        categoryTitle: text(body.categoryTitle) || '',
        projectTitle: text(body.projectTitle) || '',
      }
      if (request.title === '') throw bad('先给这项工作起个名字，再让 AI 拆。')
      const result = await aiSplit(request)
      if (result?.ok !== true) {
        throw new ApiError(502, result?.error ?? 'AI 拆分失败')
      }
      return { status: 200, body: { ok: true, steps: result.steps, engine: result.engine ?? 'dsh' } }
    }],
  ]

  /** 把一次请求交给路由表。返回 { status, body }，绝不 throw 给调用方。 */
  return async ({ method, url, body }) => {
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    try {
      for (const [verb, pattern, handler] of routes) {
        if (verb !== method) continue
        const match = pattern.exec(pathname)
        if (match === null) continue
        const result = await handler({
          body: body !== null && typeof body === 'object' ? body : {},
          params: match.slice(1).map(decodeURIComponent),
          query: url.searchParams,
        })
        return result
      }
      return { status: 404, body: { ok: false, error: `没有这个接口：${method} ${pathname}` } }
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500
      return { status, body: { ok: false, error: String(error?.message ?? error) } }
    }
  }
}

export { ApiError }