/**
 * core/store.js — 工作清单的数据层，纯 Node，不认识 DSH。
 *
 * 结构是三级：project → category → task（工作单项），
 * 每个 task 下还可以挂 steps（步骤），用来算加权进度。
 *
 * 存储就是一个 JSON 文件（默认 $DSH_HOME/state/dsh-worklist.json）：
 * 零依赖、能直接手改、DSH 里的面板和独立启动的桌面窗口读的是同一份。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SCHEMA_VERSION = 1

/** 给新项目/新分类轮着用的颜色。 */
export const PALETTE = [
  '#5B8DEF',
  '#2FB68A',
  '#E08A3C',
  '#C85C8E',
  '#8B6FD6',
  '#4EA8C7',
  '#B08A46',
  '#6E7A8A',
]

export const resolveDataFile = (explicit) => {
  if (typeof explicit === 'string' && explicit.trim() !== '') return path.resolve(explicit.trim())
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'state', 'dsh-worklist.json')
}

export const emptyState = () => ({
  version: SCHEMA_VERSION,
  updatedAt: 0,
  seq: 0,
  projects: [],
  categories: [],
  tasks: [],
})

const str = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

const toNumber = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toWeight = (value, fallback = 1) => {
  const n = toNumber(value, fallback)
  return n > 0 ? Math.round(Math.min(100, Math.max(0.1, n)) * 100) / 100 : fallback
}
export { toWeight }

/** 接受 ISO 字符串 / 毫秒时间戳 / 空值，统一成毫秒时间戳或 null。 */
export const toTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const asDate = Date.parse(value)
    if (Number.isFinite(asDate)) return asDate
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return asNumber
  }
  return null
}

let counter = 0
export const newId = (prefix) => {
  counter = (counter + 1) % 1296
  const stamp = Date.now().toString(36)
  const salt = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${stamp}${counter.toString(36).padStart(2, '0')}${salt}`
}

/* ------------------------------------------------------------------ */
/* 进度：都按权重算，而不是"完成了几条"                                  */
/* ------------------------------------------------------------------ */

export const taskProgress = (task) => {
  const steps = Array.isArray(task?.steps) ? task.steps : []
  if (steps.length === 0) return task?.done === true ? 1 : 0
  let total = 0
  let done = 0
  for (const step of steps) {
    const weight = toWeight(step?.weight, 1)
    total += weight
    if (step?.done === true) done += weight
  }
  return total > 0 ? done / total : 0
}

const weightedAverage = (rows) => {
  let total = 0
  let acc = 0
  for (const row of rows) {
    const weight = toWeight(row.weight, 1)
    total += weight
    acc += weight * row.progress
  }
  return total > 0 ? acc / total : 0
}

const dayStart = (ms) => {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** DDL 状态：overdue / today / soon(<=3d) / later / none */
export const dueState = (dueAt, now = Date.now()) => {
  if (!Number.isFinite(dueAt)) return { kind: 'none', days: null }
  const days = Math.round((dayStart(dueAt) - dayStart(now)) / 86400000)
  if (days < 0) return { kind: 'overdue', days }
  if (days === 0) return { kind: 'today', days }
  if (days <= 3) return { kind: 'soon', days }
  return { kind: 'later', days }
}

/**
 * 读一遍数据、补上算出来的字段（进度、DDL 状态、排序）。
 * 面板拿到的东西全在这里成型，前端不再算业务。
 */
export const decorate = (state, now = Date.now()) => {
  const tasks = (state.tasks ?? []).map((task) => {
    const progress = taskProgress(task)
    const due = dueState(task.dueAt, now)
    return {
      ...task,
      progress,
      due: due.kind,
      daysLeft: due.days,
      completed: progress >= 1,
    }
  })

  const byCategory = new Map()
  for (const task of tasks) {
    const list = byCategory.get(task.categoryId)
    if (list === undefined) byCategory.set(task.categoryId, [task])
    else list.push(task)
  }

  const categories = (state.categories ?? []).map((category) => {
    const own = byCategory.get(category.id) ?? []
    const progress = weightedAverage(own.map((task) => ({ weight: task.weight, progress: task.progress })))
    const dueAt = own.reduce((min, task) => {
      if (!Number.isFinite(task.dueAt)) return min
      return min === null || task.dueAt < min ? task.dueAt : min
    }, null)
    return {
      ...category,
      progress,
      taskCount: own.length,
      openCount: own.filter((task) => task.progress < 1).length,
      dueAt,
      due: dueState(dueAt, now).kind,
      tasks: own.sort(sortTasks),
    }
  })

  const byProject = new Map()
  for (const category of categories) {
    const list = byProject.get(category.projectId)
    if (list === undefined) byProject.set(category.projectId, [category])
    else list.push(category)
  }

  const projects = (state.projects ?? []).map((project) => {
    const own = byProject.get(project.id) ?? []
    const allTasks = own.flatMap((category) => category.tasks)
    const progress = weightedAverage(allTasks.map((task) => ({ weight: task.weight, progress: task.progress })))
    const dueAt = own.reduce((min, category) => {
      if (!Number.isFinite(category.dueAt)) return min
      return min === null || category.dueAt < min ? category.dueAt : min
    }, null)
    return {
      ...project,
      progress,
      categories: own.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt),
      taskCount: allTasks.length,
      openCount: allTasks.filter((task) => task.progress < 1).length,
      dueAt,
      due: dueState(dueAt, now).kind,
    }
  })

  const allTasks = tasks
  return {
    version: state.version ?? SCHEMA_VERSION,
    updatedAt: state.updatedAt ?? 0,
    now,
    projects,
    categories,
    tasks,
    totals: {
      projects: projects.length,
      categories: categories.length,
      tasks: allTasks.length,
      open: allTasks.filter((task) => task.progress < 1).length,
      overdue: allTasks.filter((task) => task.due === 'overdue' && task.progress < 1).length,
      progress: weightedAverage(allTasks.map((task) => ({ weight: task.weight, progress: task.progress }))),
    },
  }
}

/** 排序：DLL 越近越靠前，其次权重大的靠前，完成的沉底。 */
function sortTasks(a, b) {
  if (a.progress >= 1 !== b.progress >= 1) return a.progress >= 1 ? 1 : -1
  const aDue = Number.isFinite(a.dueAt) ? a.dueAt : Number.MAX_SAFE_INTEGER
  const bDue = Number.isFinite(b.dueAt) ? b.dueAt : Number.MAX_SAFE_INTEGER
  if (aDue !== bDue) return aDue - bDue
  const weight = toWeight(b.weight, 1) - toWeight(a.weight, 1)
  if (weight !== 0) return weight
  return (a.createdAt ?? 0) - (b.createdAt ?? 0)
}

/* ------------------------------------------------------------------ */
/* 读写                                                                */
/* ------------------------------------------------------------------ */

const sanitizeStep = (raw) => {
  const step = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    id: str(step.id) || newId('st'),
    title: str(step.title).trim() || '未命名步骤',
    weight: toWeight(step.weight, 1),
    done: step.done === true,
  }
}

const sanitizeTask = (raw) => {
  const task = raw !== null && typeof raw === 'object' ? raw : {}
  const createdAt = toTimestamp(task.createdAt) ?? Date.now()
  return {
    id: str(task.id) || newId('tk'),
    categoryId: str(task.categoryId),
    title: str(task.title).trim() || '未命名工作',
    weight: toWeight(task.weight, 1),
    done: task.done === true,
    dueAt: toTimestamp(task.dueAt),
    note: str(task.note),
    steps: Array.isArray(task.steps) ? task.steps.map(sanitizeStep) : [],
    createdAt,
    updatedAt: toTimestamp(task.updatedAt) ?? createdAt,
  }
}

const sanitizeCategory = (raw) => {
  const category = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    id: str(category.id) || newId('ct'),
    projectId: str(category.projectId),
    title: str(category.title).trim() || '未命名分类',
    color: str(category.color) || PALETTE[0],
    order: toNumber(category.order, 0),
    collapsed: category.collapsed === true,
    createdAt: toTimestamp(category.createdAt) ?? Date.now(),
  }
}

const sanitizeProject = (raw) => {
  const project = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    id: str(project.id) || newId('pj'),
    title: str(project.title).trim() || '未命名项目',
    path: str(project.path),
    color: str(project.color) || PALETTE[0],
    note: str(project.note),
    createdAt: toTimestamp(project.createdAt) ?? Date.now(),
  }
}

export const sanitizeState = (raw) => {
  const state = raw !== null && typeof raw === 'object' ? raw : {}
  const projects = Array.isArray(state.projects) ? state.projects.map(sanitizeProject) : []
  const categories = (Array.isArray(state.categories) ? state.categories.map(sanitizeCategory) : [])
    .filter((category) => projects.some((project) => project.id === category.projectId))
  const tasks = (Array.isArray(state.tasks) ? state.tasks.map(sanitizeTask) : [])
    .filter((task) => categories.some((category) => category.id === task.categoryId))
  return {
    version: SCHEMA_VERSION,
    updatedAt: toNumber(state.updatedAt, 0),
    seq: toNumber(state.seq, 0),
    projects,
    categories,
    tasks,
  }
}

export const loadState = (file) => {
  try {
    const text = fs.readFileSync(file, 'utf8')
    return sanitizeState(JSON.parse(text))
  } catch {
    return emptyState()
  }
}

export const saveState = (file, state) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

/* 同一个进程里串行化写入；跨进程靠"每次写都重读文件"。 */
const queues = new Map()

export const withLock = (file, task) => {
  const previous = queues.get(file) ?? Promise.resolve()
  const run = previous.then(task, task)
  queues.set(file, run.then(() => undefined, () => undefined))
  return run
}

/**
 * 读最新 → 让 fn 改 → 写回。fn 拿到的是磁盘上的最新状态，
 * 所以另一个进程（独立窗口）刚写的东西不会被这次覆盖掉。
 */
export const mutate = (file, fn) => withLock(file, async () => {
  const state = loadState(file)
  const result = await fn(state)
  state.seq = (state.seq ?? 0) + 1
  state.updatedAt = Date.now()
  saveState(file, state)
  return result
})

export const read = (file) => withLock(file, async () => loadState(file))