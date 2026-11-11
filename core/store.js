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

/**
 * 新项目默认带的三个分类。用户可以改名、删除。
 * `DDL预警` 是特殊分类：用户不能改它的名字、也不能删，
 * 里面放的不是"真的工作"，而是项目里撞上预警线的工作的克隆（见 decorate）。
 */
export const DEFAULT_CATEGORIES = [
  { title: '重要工作', color: PALETTE[0] },
  { title: '一般工作', color: PALETTE[1] },
  { title: '长期工作', color: PALETTE[4] },
]

export const DDL_CATEGORY_TITLE = 'DDL预警'
export const DDL_CATEGORY_COLOR = '#E5484D'

/** DDL 预警提前量：默认一天，最小一小时。 */
export const DEFAULT_WARN_HOURS = 24
export const MIN_WARN_HOURS = 1
export const MAX_WARN_HOURS = 24 * 30

export const clampWarnHours = (value) => {
  const n = toNumber(value, DEFAULT_WARN_HOURS)
  return Math.round(Math.min(MAX_WARN_HOURS, Math.max(MIN_WARN_HOURS, n)))
}

/**
 * 单条工作自己的预警时长。没设（或设成空）就返回 null，意思是"跟随项目默认"。
 * 这是 0.3.0 加的：预警从"整个项目一个刻度"细化成"每条工作可以不一样"。
 */
export const taskWarnHours = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(Math.min(MAX_WARN_HOURS, Math.max(MIN_WARN_HOURS, n)))
}

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
  ui: { ...DEFAULT_UI, labels: { ...DEFAULT_UI.labels } },
  projects: [],
  categories: [],
  tasks: [],
})

const str = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value)

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

/** 这条工作是不是已经进了预警窗口（含已逾期）。 */
export const isWarning = (task, warnHours, now = Date.now()) => {
  if (!Number.isFinite(task?.dueAt)) return false
  return task.dueAt - now <= warnHours * 3600000
}

/**
 * 读一遍数据、补上算出来的字段（进度、DDL 状态、排序）。
 * 面板拿到的东西全在这里成型，前端不再算业务。
 */
export const decorate = (state, now = Date.now()) => {
  const projectsRaw = state.projects ?? []
  const categoriesRaw = state.categories ?? []
  const projectById = new Map(projectsRaw.map((item) => [item.id, item]))
  const projectIdByCategory = new Map(categoriesRaw.map((item) => [item.id, item.projectId]))
  const defaultWarnOf = (categoryId) => clampWarnHours(projectById.get(projectIdByCategory.get(categoryId))?.warnHours)

  const tasks = (state.tasks ?? []).map((task) => {
    const progress = taskProgress(task)
    const due = dueState(task.dueAt, now)
    const ownWarn = taskWarnHours(task.warnHours)
    return {
      ...task,
      progress,
      due: due.kind,
      daysLeft: due.days,
      completed: progress >= 1,
      // 这条工作实际按多少小时预警：自己设了就用自己的，否则跟项目默认。
      warnHours: ownWarn ?? defaultWarnOf(task.categoryId),
      warnOwn: ownWarn !== null,
    }
  })

  const byCategory = new Map()
  for (const task of tasks) {
    const list = byCategory.get(task.categoryId)
    if (list === undefined) byCategory.set(task.categoryId, [task])
    else list.push(task)
  }

  /*
   * DDL预警分类里放的是"克隆"：项目里所有撞上预警线（含已逾期）、还没做完的工作，
   * 复制一份塞进这个分类。克隆只用于展示和快速勾选，真实数据仍然是原来那条工作。
   * 所以项目进度、任务数统计都要把 DDL预警 这一层排除掉，否则同一件事会被算两遍。
   * 预警线是逐条算的：每条工作用它自己的 warnHours（没设就回落到项目默认）。
   */
  const sourceCategories = categoriesRaw
  const clonesByCategory = new Map()
  for (const category of sourceCategories) {
    if (category.kind !== 'ddl') continue
    const sources = new Set(
      sourceCategories
        .filter((item) => item.projectId === category.projectId && item.kind !== 'ddl')
        .map((item) => item.id),
    )
    const hits = tasks
      .filter((task) => sources.has(task.categoryId) && task.archived !== true && task.progress < 1 && isWarning(task, task.warnHours, now))
      .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1) || a.dueAt - b.dueAt)
      .map((task) => ({
        ...task,
        id: 'ddl:' + task.id,
        cloneOf: task.id,
        categoryId: category.id,
        warning: true,
      }))
    clonesByCategory.set(category.id, hits)
  }

  const categories = sourceCategories.map((category) => {
    const isDdl = category.kind === 'ddl'
    const own = isDdl ? (clonesByCategory.get(category.id) ?? []) : (byCategory.get(category.id) ?? [])
    // 归档的工作留在列表里（切到"含归档"还能看见），但不参与进度和计数。
    const counted = own.filter((task) => task.archived !== true)
    const progress = weightedAverage(counted.map((task) => ({ weight: task.weight, progress: task.progress })))
    // 已完成的工作（哪怕还没归档）不再参与截止时间：做完了就不该再被报"逾期"。
    const dueAt = counted
      .filter((task) => task.progress < 1)
      .reduce((min, task) => {
        if (!Number.isFinite(task.dueAt)) return min
        return min === null || task.dueAt < min ? task.dueAt : min
      }, null)
    const warnHours = clampWarnHours(projectsRaw.find((item) => item.id === category.projectId)?.warnHours)
    return {
      ...category,
      progress,
      taskCount: counted.length,
      openCount: counted.filter((task) => task.progress < 1).length,
      archivedCount: own.length - counted.length,
      dueAt,
      due: dueState(dueAt, now).kind,
      warnHours: isDdl ? warnHours : null,
      tasks: own.sort(sortTasks),
    }
  })

  const byProject = new Map()
  for (const category of categories) {
    const list = byProject.get(category.projectId)
    if (list === undefined) byProject.set(category.projectId, [category])
    else list.push(category)
  }

  const projects = projectsRaw.map((project) => {
    const own = (byProject.get(project.id) ?? []).filter((category) => category.kind !== 'ddl' && category.archived !== true)
    const allTasks = own.flatMap((category) => category.tasks.filter((task) => task.archived !== true))
    const progress = weightedAverage(allTasks.map((task) => ({ weight: task.weight, progress: task.progress })))
    const dueAt = own.reduce((min, category) => {
      if (!Number.isFinite(category.dueAt)) return min
      return min === null || category.dueAt < min ? category.dueAt : min
    }, null)
    const ddl = (byProject.get(project.id) ?? []).find((category) => category.kind === 'ddl')
    return {
      ...project,
      warnHours: clampWarnHours(project.warnHours),
      progress,
      // DDL预警 永远置顶（它不参与项目进度，但要最先看到）；其余按置顶、order 排。
      categories: (byProject.get(project.id) ?? []).sort(sortCategories),
      ddlCategoryId: ddl?.id ?? null,
      warningCount: ddl?.taskCount ?? 0,
      taskCount: allTasks.length,
      openCount: allTasks.filter((task) => task.progress < 1).length,
      // 归档的总数：归档分类里的全部工作 + 未归档分类里归档的工作。
      archivedCount: (byProject.get(project.id) ?? [])
        .filter((category) => category.kind !== 'ddl')
        .reduce((sum, category) => sum + (category.archived === true ? category.tasks.length : (category.archivedCount ?? 0)), 0),
      dueAt,
      due: dueState(dueAt, now).kind,
    }
  })

  const allTasks = tasks
  // 项目列表：置顶的在前，其余按创建时间。
  projects.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1) || (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return {
    version: state.version ?? SCHEMA_VERSION,
    updatedAt: state.updatedAt ?? 0,
    now,
    // 外观配置跟数据一起下发：面板挂载时只请求 /state，不带这个的话
    // 主题/强调色要等用户点进「外观」才生效（亮色主题下就是"背景仍跟随宿主"）。
    ui: sanitizeUi(state.ui),
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

/** 分类排序：DDL预警 永远第一，然后置顶的、再按 order。 */
function sortCategories(a, b) {
  const rankA = a.kind === 'ddl' ? 0 : 1
  const rankB = b.kind === 'ddl' ? 0 : 1
  if (rankA !== rankB) return rankA - rankB
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0)
}

/** 排序：置顶的在最前，然后 DDL 越近越靠前，其次权重大的靠前，完成的沉底。 */
function sortTasks(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
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
    // null = 跟随项目默认；数字 = 这条工作自己的预警时长。
    warnHours: taskWarnHours(task.warnHours),
    steps: Array.isArray(task.steps) ? task.steps.map(sanitizeStep) : [],
    pinned: task.pinned === true,
    archived: task.archived === true,
    archivedAt: task.archived === true ? toTimestamp(task.archivedAt) : null,
    createdAt,
    updatedAt: toTimestamp(task.updatedAt) ?? createdAt,
  }
}

const sanitizeCategory = (raw) => {
  const category = raw !== null && typeof raw === 'object' ? raw : {}
  const kind = category.kind === 'ddl' ? 'ddl' : 'normal'
  return {
    id: str(category.id) || newId('ct'),
    projectId: str(category.projectId),
    title: kind === 'ddl' ? DDL_CATEGORY_TITLE : str(category.title).trim() || '未命名分类',
    color: kind === 'ddl' ? DDL_CATEGORY_COLOR : str(category.color) || PALETTE[0],
    // DDL预警是系统分类：名字和存在都不由用户决定。
    kind,
    locked: kind === 'ddl',
    order: toNumber(category.order, 0),
    collapsed: category.collapsed === true,
    // DDL预警 是系统分类，永远排第一，pinned 对它没有意义但保留字段。
    pinned: kind === 'ddl' ? true : category.pinned === true,
    archived: kind !== 'ddl' && category.archived === true,
    archivedAt: kind !== 'ddl' && category.archived === true ? toTimestamp(category.archivedAt) : null,
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
    pinned: project.pinned === true,
    archived: project.archived === true,
    archivedAt: project.archived === true ? toTimestamp(project.archivedAt) : null,
    warnHours: clampWarnHours(project.warnHours),
    // 脚手架版本：2 = 已经有三个默认分类 + DDL预警。老数据靠它补一次，补完就不再补，
    // 这样用户把默认分类删光也不会每次加载又冒出来。
    scaffold: toNumber(project.scaffold, 0),
    createdAt: toTimestamp(project.createdAt) ?? Date.now(),
  }
}

/**
 * 新项目自带的分类：重要工作 / 一般工作 / 长期工作（都能改名、删除），
 * 外加一个锁定的 DDL预警（不能改名、不能删，内容是撞线工作的克隆）。
 */
export const buildProjectCategories = (projectId, now = Date.now()) => {
  const rows = DEFAULT_CATEGORIES.map((item, index) => ({
    id: newId('ct'),
    projectId,
    title: item.title,
    color: item.color,
    kind: 'normal',
    locked: false,
    order: index,
    collapsed: false,
    createdAt: now,
  }))
  rows.push({
    id: newId('ct'),
    projectId,
    title: DDL_CATEGORY_TITLE,
    color: DDL_CATEGORY_COLOR,
    kind: 'ddl',
    locked: true,
    order: 90,
    collapsed: false,
    createdAt: now,
  })
  return rows
}

export const sanitizeState = (raw) => {
  const state = raw !== null && typeof raw === 'object' ? raw : {}
  const projects = Array.isArray(state.projects) ? state.projects.map(sanitizeProject) : []
  const categories = (Array.isArray(state.categories) ? state.categories.map(sanitizeCategory) : [])
    .filter((category) => projects.some((project) => project.id === category.projectId))
  const tasks = (Array.isArray(state.tasks) ? state.tasks.map(sanitizeTask) : [])
    .filter((task) => categories.some((category) => category.id === task.categoryId))

  // 老项目补一次脚手架：没有任何分类的补齐三个默认分类，任何项目缺 DDL预警 的补上。
  // 补齐后写进 scaffold=2，用户以后再删就不会反复冒出来。
  for (const project of projects) {
    const own = categories.filter((category) => category.projectId === project.id)
    if (own.length === 0 && project.scaffold < 2) {
      DEFAULT_CATEGORIES.forEach((item, index) => {
        categories.push({
          id: `ct_${project.id}_d${index}`,
          projectId: project.id,
          title: item.title,
          color: item.color,
          kind: 'normal',
          locked: false,
          order: index,
          collapsed: false,
          createdAt: project.createdAt,
        })
      })
    }
    if (!own.some((category) => category.kind === 'ddl')) {
      categories.push({
        id: `ct_${project.id}_ddl`,
        projectId: project.id,
        title: DDL_CATEGORY_TITLE,
        color: DDL_CATEGORY_COLOR,
        kind: 'ddl',
        locked: true,
        order: 90,
        collapsed: false,
        createdAt: project.createdAt,
      })
    }
    project.scaffold = 2
  }

  return {
    version: SCHEMA_VERSION,
    updatedAt: toNumber(state.updatedAt, 0),
    seq: toNumber(state.seq, 0),
    ui: sanitizeUi(state.ui),
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

/**
 * 外观配置的默认值。整份随数据文件一起存，所以 DSH 面板和独立窗口看到的是同一套。
 * 全部可覆盖，界面上的「恢复默认」就是把它原样写回去。
 */
export const DEFAULT_UI = {
  theme: 'auto', // auto=跟随 DSH / light / dark
  accent: '#3f6be6',
  danger: '#e5484d',
  fontFamily: '', // 空 = 用内置字体栈
  fontScale: 1, // 0.85 – 1.3
  radius: 8, // 0 – 18
  sidebarWidth: 232, // 180 – 380
  density: 'cozy', // cozy | compact
  showDots: true, // 分类名前的色点
  showProgressBar: true, // 项目行下的小进度条
  // 液态玻璃：让专注小窗/面板变成半透明 + 背景模糊（需要底下有东西才看得出效果）
  glass: false,
  glassAlpha: 0.22, // 0.04 – 0.85，底色不透明度（越小越透）
  glassBlur: 20, // 4 – 40 px，背景模糊半径
  labels: {
    appName: '工作清单',
    projects: '项目',
    ddl: 'DDL预警',
    newTask: '新建工作',
  },
}

const HEX = /^#[0-9a-fA-F]{6}$/
const LABEL_MAX = 24

const textLabel = (value, fallback) => {
  const clean = str(value).replace(/[\r\n\t]/g, ' ').trim().slice(0, LABEL_MAX)
  return clean || fallback
}

export const sanitizeUi = (raw) => {
  const ui = raw !== null && typeof raw === 'object' ? raw : {}
  const labels = ui.labels !== null && typeof ui.labels === 'object' ? ui.labels : {}
  const theme = ['auto', 'light', 'dark'].includes(str(ui.theme)) ? str(ui.theme) : DEFAULT_UI.theme
  return {
    theme,
    accent: HEX.test(str(ui.accent)) ? str(ui.accent).toLowerCase() : DEFAULT_UI.accent,
    danger: HEX.test(str(ui.danger)) ? str(ui.danger).toLowerCase() : DEFAULT_UI.danger,
    fontFamily: str(ui.fontFamily).replace(/[;{}<>]/g, '').trim().slice(0, 120),
    fontScale: clamp(toNumber(ui.fontScale, DEFAULT_UI.fontScale), 0.85, 1.3),
    radius: Math.round(clamp(toNumber(ui.radius, DEFAULT_UI.radius), 0, 18)),
    sidebarWidth: Math.round(clamp(toNumber(ui.sidebarWidth, DEFAULT_UI.sidebarWidth), 180, 380)),
    density: str(ui.density) === 'compact' ? 'compact' : 'cozy',
    showDots: ui.showDots !== false,
    showProgressBar: ui.showProgressBar !== false,
    glass: ui.glass === true,
    glassAlpha: Math.round(clamp(toNumber(ui.glassAlpha, DEFAULT_UI.glassAlpha), 0.04, 0.85) * 100) / 100,
    glassBlur: Math.round(clamp(toNumber(ui.glassBlur, DEFAULT_UI.glassBlur), 4, 40)),
    labels: {
      appName: textLabel(labels.appName, DEFAULT_UI.labels.appName),
      projects: textLabel(labels.projects, DEFAULT_UI.labels.projects),
      ddl: textLabel(labels.ddl, DEFAULT_UI.labels.ddl),
      newTask: textLabel(labels.newTask, DEFAULT_UI.labels.newTask),
    },
  }
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