/**
 * index.js — DSH 的 Host 半边。
 *
 * 三件事：
 *   1. 挂一套接口 `/dsh-worklist-api/*`（面板读写同一份数据）
 *   2. 注册 Agent 工具 `worklist`（模型能自己看清单、记账、写步骤）
 *   3. 提供「AI 拆分」：只有面板上按了那个按钮、真正发来请求时，
 *      才起一个子代理去拆步骤 —— 平时绝不烧 token。
 *
 * 数据在 core/store.js，接口在 core/api.js，两边都不认识 DSH。
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { openFolder } from './core/open.js'
import { createApi } from './core/api.js'
import {
  decorate,
  mutate,
  newId,
  read,
  resolveDataFile,
  taskWarnHours,
  toTimestamp,
  toWeight,
} from './core/store.js'

export const name = 'dsh-worklist'

export const inject = ['tools', 'webServer']

const ROUTE_PREFIX = '/dsh-worklist-api' // ui-copy-ignore
const AI_TIMEOUT_MS = 150000 // ui-copy-ignore

const STASH = Symbol.for('dsh-worklist.state') // ui-copy-ignore

const formatPercent = (value) => `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`

const formatDue = (dueAt, daysLeft) => {
  if (!Number.isFinite(dueAt)) return ''
  const date = new Date(dueAt)
  const stamp = `${date.getMonth() + 1}/${date.getDate()}`
  if (!Number.isFinite(daysLeft)) return `${stamp} 到期`
  if (daysLeft < 0) return `${stamp} 已逾期 ${Math.abs(daysLeft)} 天`
  if (daysLeft === 0) return `${stamp} 今天到期`
  if (daysLeft <= 3) return `${stamp} 还剩 ${daysLeft} 天`
  return stamp
}

const formatTree = (state) => {
  const lines = []
  lines.push(`工作清单 · ${state.totals.projects} 个项目 / ${state.totals.categories} 个分类 / ${state.totals.tasks} 项工作`)
  lines.push(`总进度 ${formatPercent(state.totals.progress)}${state.totals.overdue > 0 ? ` · 逾期 ${state.totals.overdue} 项` : ''}`)
  for (const project of state.projects) {
    lines.push('')
    lines.push(`▸ ${project.title}  [${formatPercent(project.progress)}]${project.path !== '' ? `  ${project.path}` : ''}`)
    if (project.categories.length === 0) {
      lines.push('  （还没有分类）')
      continue
    }
    for (const category of project.categories) {
      const due = formatDue(category.dueAt, category.daysLeft)
      lines.push(`  · ${category.title}  [${formatPercent(category.progress)}] ${category.openCount}/${category.taskCount}${due !== '' ? ` · ${due}` : ''}`)
      for (const task of category.tasks) {
        const mark = task.progress >= 1 ? 'x' : ' '
        const due = formatDue(task.dueAt, task.daysLeft)
        lines.push(`      [${mark}] ${task.title}  w=${task.weight}${task.steps.length > 0 ? ` ${formatPercent(task.progress)}` : ''}${due !== '' ? ` · ${due}` : ''}`)
      }
    }
  }
  if (state.totals.tasks === 0) lines.push('\n还没有任何工作：先建项目，再建分类，最后建工作单项。')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* AI 拆分：面板按钮点下来才走这里                                       */
/* ------------------------------------------------------------------ */

const buildPrompt = (request) => {
  const where = [request.projectTitle, request.categoryTitle].filter((item) => typeof item === 'string' && item !== '')
  const existing = Array.isArray(request.steps)
    ? request.steps.filter((step) => typeof step?.title === 'string' && step.title.trim() !== '')
    : []
  return [
    '帮我拆分一项工作，输出可以直接照着做的步骤。',
    '',
    `工作名称：${request.title}`,
    where.length > 0 ? `所属：${where.join(' / ')}` : '',
    request.note !== '' ? `备注：${request.note}` : '',
    existing.length > 0 ? `已有的步骤（可以沿用、合并或细化）：${existing.map((step) => step.title).join('；')}` : '',
    '',
    '要求：',
    '- 4 到 8 步，按执行顺序排列，每步是一个能独立完成、可验证的动作。',
    '- 每步给一个权重（1-5 的整数），越关键/越耗时的越大，权重合计不要超过 20。',
    '- 步骤名用中文，20 字以内，以动词开头。',
    '- 不要编号，不要解释，只给步骤本身。',
  ].filter((line) => line !== '').join('\n')
}

const AI_OUTPUT_SCHEMA = { // ui-copy-ignore
  type: 'object',
  additionalProperties: false,
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '步骤名，动词开头，20 字以内' },
          weight: { type: 'number', description: '权重 1-5' },
        },
        required: ['title'],
      },
    },
  },
  required: ['steps'],
}

const extractJson = (text) => {
  if (typeof text !== 'string') return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

const coerceSteps = (payload) => {
  const list = Array.isArray(payload?.steps) ? payload.steps : Array.isArray(payload) ? payload : null
  if (list === null) return null
  const steps = list
    .map((step) => {
      const title = typeof step === 'string' ? step : step?.title
      if (typeof title !== 'string' || title.trim() === '') return null
      const weight = typeof step === 'object' ? toWeight(step?.weight, 1) : 1
      return { title: title.trim().slice(0, 60), weight: Math.min(20, Math.round(weight * 10) / 10) }
    })
    .filter(Boolean)
  return steps.length > 0 ? steps : null
}

const pickParent = (agents) => {
  try {
    const initiator = agents.currentInitiator?.()
    if (initiator !== undefined && initiator !== null) return initiator
  } catch {}
  const roots = agents.roots?.() ?? []
  if (roots.length > 0) return roots[0]
  const all = agents.list?.() ?? []
  return all.length > 0 ? all[0] : null
}

const makeAiSplit = (ctx) => async (request) => {
  const subagents = ctx.get('subagents')
  const agents = ctx.get('agents')
  if (subagents === undefined || agents === undefined) {
    return { ok: false, error: '这个 DSH 没有子代理服务，AI 拆分不可用。' }
  }
  const parent = pickParent(agents)
  if (parent === null) {
    return { ok: false, error: '现在没有活着的会话：先在 DSH 里开一个对话，再点 AI 拆分。' }
  }
  const providers = subagents.list?.() ?? []
  const provider = providers.includes('local') ? 'local' : providers[0]
  if (provider === undefined) {
    return { ok: false, error: '没有注册任何子代理 provider，AI 拆分不可用。' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const workingDirectory = ctx.get('workingDirectory')
    const cwd = typeof workingDirectory?.defaultDirectory === 'string' ? workingDirectory.defaultDirectory : undefined
    const activation = await subagents.startActivation({
      provider,
      label: 'worklist 拆步骤', // ui-copy-ignore
      delivery: 'caller',
      signal: controller.signal,
      request: {
        parent,
        signal: controller.signal,
        cwd,
        prompt: [{ type: 'text', text: buildPrompt(request) }],
        outputSchema: AI_OUTPUT_SCHEMA,
      },
    })
    try {
      const result = await activation.result
      const fromStructured = coerceSteps(result?.structured)
      if (fromStructured !== null) {
        return { ok: true, steps: fromStructured, engine: `subagent:${provider}` }
      }
      const text = (result?.output ?? [])
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n')
      const fromText = coerceSteps(extractJson(text))
      if (fromText !== null) return { ok: true, steps: fromText, engine: `subagent:${provider}` }
      return { ok: false, error: `子代理没有给出可用的步骤（${result?.stopReason ?? 'unknown'}）。` }
    } finally {
      try { await activation.dispose() } catch {}
    }
  } catch (error) {
    const message = String(error?.message ?? error)
    if (/abort/i.test(message)) return { ok: false, error: `AI 拆分超时（${Math.round(AI_TIMEOUT_MS / 1000)} 秒）。` }
    return { ok: false, error: `AI 拆分失败：${message}` }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* 工具：让模型能读能写这份清单                                          */
/* ------------------------------------------------------------------ */

const findProject = (state, body) => {
  if (typeof body.projectId === 'string' && body.projectId !== '') {
    const byId = state.projects.find((item) => item.id === body.projectId)
    if (byId !== undefined) return byId
  }
  if (typeof body.projectTitle === 'string' && body.projectTitle.trim() !== '') {
    return state.projects.find((item) => item.title === body.projectTitle.trim()) ?? null
  }
  return null
}

const findCategory = (state, body) => {
  if (typeof body.categoryId === 'string' && body.categoryId !== '') {
    const byId = state.categories.find((item) => item.id === body.categoryId)
    if (byId !== undefined) return byId
  }
  if (typeof body.categoryTitle === 'string' && body.categoryTitle.trim() !== '') {
    const title = body.categoryTitle.trim()
    const project = findProject(state, body)
    const pool = project !== null ? state.categories.filter((item) => item.projectId === project.id) : state.categories
    return pool.find((item) => item.title === title) ?? null
  }
  return null
}

const findTask = (state, body) => {
  if (typeof body.taskId === 'string' && body.taskId !== '') {
    const byId = state.tasks.find((item) => item.id === body.taskId)
    if (byId !== undefined) return byId
  }
  if (typeof body.taskTitle === 'string' && body.taskTitle.trim() !== '') {
    return state.tasks.find((item) => item.title === body.taskTitle.trim()) ?? null
  }
  return null
}

/**
 * 在桌面放一个「工作清单」快捷方式（双击出图形窗口，不弹黑框）。
 * 走 host 进程执行 PowerShell，因为面板所在的沙箱不一定能写桌面目录。
 */
const installDesktopShortcut = () => {
  if (process.platform !== 'win32') {
    return { ok: false, error: '桌面快捷方式目前只做了 Windows；直接跑 node bin/worklist.js serve --open 也有同样的窗口。' }
  }
  const packageRoot = path.dirname(fileURLToPath(import.meta.url))
  const vbs = path.join(packageRoot, 'bin', 'worklist-open.vbs') // ui-copy-ignore
  const icon = path.join(packageRoot, 'bin', 'icon.ico') // ui-copy-ignore
  if (!fs.existsSync(vbs)) return { ok: false, error: `缺 ${vbs}` }

  const lines = [
    "$ErrorActionPreference = 'Stop'",
    '$ws = New-Object -ComObject WScript.Shell',
    "$desktop = [Environment]::GetFolderPath('Desktop')",
    "$lnkPath = Join-Path $desktop '工作清单.lnk'",
    '$lnk = $ws.CreateShortcut($lnkPath)',
    "$lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\\wscript.exe')",
    `$lnk.Arguments = '"${vbs}"'`,
    `$lnk.WorkingDirectory = '${packageRoot}'`,
    `$lnk.IconLocation = '${icon}'`,
    "$lnk.Description = '工作清单：项目 → 分类 → 工作单项，加权进度看板'",
    '$lnk.WindowStyle = 7',
    '$lnk.Save()',
    'Write-Output ("OK " + $lnkPath)',
  ]

  const script = path.join(os.tmpdir(), `dsh-worklist-shortcut-${process.pid}.ps1`) // ui-copy-ignore
  try {
    fs.writeFileSync(script, `\uFEFF${lines.join('\n')}`, 'utf8')
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      encoding: 'utf8',
    })
    const text = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    if (result.status !== 0) return { ok: false, error: text || `powershell 退出码 ${result.status}` }
    return { ok: true, path: text.replace(/^OK\s*/, '') }
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) }
  } finally {
    try { fs.rmSync(script, { force: true }) } catch {}
  }
}

export function apply(ctx) {
  const stash = globalThis[STASH] ?? (globalThis[STASH] = { dispose: null })
  if (typeof stash.dispose === 'function') {
    try { stash.dispose() } catch {}
    stash.dispose = null
  }

  const file = resolveDataFile()
  const api = createApi({
    file,
    aiSplit: makeAiSplit(ctx),
    openFolder: (target) => openFolder(target),
  })

  const disposers = []

  disposers.push(ctx.tools.register({
    name: 'worklist',
    description: [
      'Read and edit the user\'s work list: a three-level board of project → category → task,',
      'where each task has a weight, an optional due date, and optional steps (each with its',
      'own weight). Progress is weighted, not "how many rows are checked".',
      '',
      'Use `overview` before answering anything about what the user is working on. Use the',
      'write actions only when the user asks you to record or restructure work. The user also',
      'edits the same data from the web panel, so always re-read before reporting.',
      '',
      'There is NO model call inside this tool: splitting a task into steps is a button in the',
      'panel, and the tool only stores what it is given.',
    ].join('\n'),
    parameters: {
      action: {
        type: 'string',
        enum: ['overview', 'add_project', 'add_category', 'add_task', 'set_steps', 'update_task'],
        description: 'overview = read the whole board; the rest are writes.',
      },
      projectTitle: { type: 'string', description: 'Project name (also used to disambiguate a category).' },
      projectId: { type: 'string', description: 'Project id, when you already have it from an overview.' },
      projectPath: { type: 'string', description: 'Folder path to attach to a new project.' },
      categoryTitle: { type: 'string', description: 'Category name inside a project.' },
      categoryId: { type: 'string', description: 'Category id.' },
      taskTitle: { type: 'string', description: 'Task name.' },
      taskId: { type: 'string', description: 'Task id.' },
      weight: { type: 'number', description: 'Task weight (relative importance, default 1).' },
      dueAt: { type: 'string', description: 'Due date, ISO-8601 (e.g. 2026-11-08) or empty to clear.' },
      warnHours: {
        type: 'number',
        description: 'Per-task warning lead time in hours (default: inherit the project default, usually 24).',
      },
      note: { type: 'string', description: 'Free-form note on the task.' },
      done: { type: 'boolean', description: 'Mark the task (or the whole step list) done.' },
      steps: {
        type: 'array',
        items: { type: 'object' },
        description: 'Steps as [{ title, weight }]; replaces the whole step list for set_steps.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', description: 'Human-readable result.' },
        },
        required: ['text'],
      },
      render(_args, value) {
        return [{ type: 'text', text: value.text }]
      },
    },
    async execute(args) {
      const body = args !== null && typeof args === 'object' ? args : {}
      const action = typeof body.action === 'string' ? body.action : 'overview'

      if (action === 'overview') {
        const state = decorate(await read(file))
        return { text: formatTree(state) }
      }

      if (action === 'add_project') {
        const title = String(body.projectTitle ?? '').trim()
        if (title === '') return { text: 'add_project 需要 projectTitle。' }
        const project = await mutate(file, (state) => {
          const created = {
            id: newId('pj'),
            title,
            path: String(body.projectPath ?? '').trim(),
            color: '#5B8DEF',
            note: '',
            createdAt: Date.now(),
          }
          state.projects.push(created)
          return created
        })
        return { text: `已新建项目「${project.title}」（id ${project.id}）。下一步：add_category 往里面放分类。` }
      }

      if (action === 'add_category') {
        const title = String(body.categoryTitle ?? '').trim()
        if (title === '') return { text: 'add_category 需要 categoryTitle。' }
        try {
          const category = await mutate(file, (state) => {
            const project = findProject(state, body)
            if (project === null) throw new Error('找不到这个项目，先 add_project 或用 overview 看看有哪些。')
            const created = {
              id: newId('ct'),
              projectId: project.id,
              title,
              color: '#2FB68A',
              order: state.categories.filter((item) => item.projectId === project.id).length,
              collapsed: false,
              createdAt: Date.now(),
            }
            state.categories.push(created)
            return created
          })
          return { text: `已在项目里新建分类「${category.title}」（id ${category.id}）。` }
        } catch (error) {
          return { text: String(error.message ?? error) }
        }
      }

      if (action === 'add_task') {
        const title = String(body.taskTitle ?? '').trim()
        if (title === '') return { text: 'add_task 需要 taskTitle。' }
        try {
          const task = await mutate(file, (state) => {
            const category = findCategory(state, body)
            if (category === null) throw new Error('找不到这个分类，先 add_category。')
            const steps = Array.isArray(body.steps)
              ? body.steps.map((step) => ({
                id: newId('st'),
                title: String(step?.title ?? '').trim() || '未命名步骤',
                weight: toWeight(step?.weight, 1),
                done: step?.done === true,
              }))
              : []
            const created = {
              id: newId('tk'),
              categoryId: category.id,
              title,
              weight: toWeight(body.weight, 1),
              done: body.done === true,
              dueAt: toTimestamp(body.dueAt),
              note: String(body.note ?? ''),
              warnHours: taskWarnHours(body.warnHours),
              steps,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            state.tasks.push(created)
            return created
          })
          return { text: `已新建工作「${task.title}」（id ${task.id}，权重 ${task.weight}${task.steps.length > 0 ? `，${task.steps.length} 步` : ''}）。` }
        } catch (error) {
          return { text: String(error.message ?? error) }
        }
      }

      if (action === 'set_steps') {
        try {
          const result = await mutate(file, (state) => {
            const task = findTask(state, body)
            if (task === null) throw new Error('找不到这项工作，先用 overview 看看。')
            if (!Array.isArray(body.steps)) throw new Error('set_steps 需要 steps 数组。')
            task.steps = body.steps.map((step) => ({
              id: newId('st'),
              title: String(step?.title ?? '').trim() || '未命名步骤',
              weight: toWeight(step?.weight, 1),
              done: step?.done === true,
            }))
            task.updatedAt = Date.now()
            return task
          })
          return { text: `「${result.title}」的步骤已更新为 ${result.steps.length} 步。` }
        } catch (error) {
          return { text: String(error.message ?? error) }
        }
      }

      if (action === 'update_task') {
        try {
          const result = await mutate(file, (state) => {
            const task = findTask(state, body)
            if (task === null) throw new Error('找不到这项工作，先用 overview 看看。')
            if (typeof body.taskTitle === 'string' && body.taskTitle.trim() !== '') task.title = body.taskTitle.trim()
            if (body.weight !== undefined) task.weight = toWeight(body.weight, task.weight)
            if (body.done !== undefined) task.done = body.done === true
            if (body.note !== undefined) task.note = String(body.note ?? '')
            if (body.dueAt !== undefined) task.dueAt = toTimestamp(body.dueAt)
            if (body.warnHours !== undefined) task.warnHours = taskWarnHours(body.warnHours)
            task.updatedAt = Date.now()
            return task
          })
          return { text: `已更新「${result.title}」。` }
        } catch (error) {
          return { text: String(error.message ?? error) }
        }
      }

      return { text: `未知 action：${action}` }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://worklist.local')
      const pathname = url.pathname.startsWith(ROUTE_PREFIX)
        ? url.pathname.slice(ROUTE_PREFIX.length) || '/'
        : url.pathname

      const method = (req.method ?? 'GET').toUpperCase()
      let body = {}
      if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
        const chunks = []
        let bytes = 0
        for await (const chunk of req) {
          bytes += chunk.length
          if (bytes > 1024 * 512) {
            res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: '请求体太大' }))
            return
          }
          chunks.push(chunk)
        }
        const raw = Buffer.concat(chunks).toString('utf8').trim()
        if (raw !== '') {
          try {
            body = JSON.parse(raw)
          } catch {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: '请求体不是合法 JSON' }))
            return
          }
        }
      }

      if (pathname === '/desktop-shortcut' && method === 'POST') {
        const result = installDesktopShortcut()
        const text = JSON.stringify(result)
        res.writeHead(result.ok ? 200 : 500, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(text),
        })
        res.end(text)
        return
      }

      const result = await api({ method, url: new URL(`${pathname}${url.search}`, 'http://worklist.local'), body })
      const text = JSON.stringify(result.body)
      res.writeHead(result.status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(text),
      })
      res.end(text)
    },
  }))

  const dispose = () => {
    for (const item of disposers.reverse()) {
      try { item?.() } catch {}
    }
  }
  stash.dispose = dispose
  return dispose
}