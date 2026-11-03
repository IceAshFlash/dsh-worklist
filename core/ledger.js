/**
 * core/ledger.js — 每个分类在磁盘上的那本"流水账"。
 *
 * 建分类时会在这个项目的文件夹里建一个同名文件夹，里面放一个同名 .txt；
 * 之后这个分类下的改动（新建/编辑/完成/删除/改名）都会往这个 txt 里追加一行。
 *
 * 三条规矩：
 *   1. 只追加，不覆盖 —— 手写的备注不会被冲掉。
 *   2. 任何一步失败都吞掉 —— 盘上没权限不该让清单本身用不了。
 *   3. txt 带 BOM + CRLF —— 免得 Windows 记事本把中文读成乱码、换行挤成一行。
 */
import fs from 'node:fs'
import path from 'node:path'

const ILLEGAL = /[\\/:*?"<>|]/g
const CONTROL = /[\u0000-\u001f]/g

/** 分类名 → 能当文件夹名的名字。 */
export const safeName = (title, fallback = '未命名分类') => {
  const cleaned = String(title ?? '')
    .replace(ILLEGAL, '_')
    .replace(CONTROL, '')
    .trim()
    .replace(/[. ]+$/, '')
  if (cleaned === '') return fallback
  return cleaned.length > 60 ? cleaned.slice(0, 60).trim() : cleaned
}

const pad = (value) => String(value).padStart(2, '0')

/** 2026-11-03 12:20 —— 记事本里一眼能看懂的形式。 */
export const stamp = (ms) => {
  const date = new Date(Number.isFinite(ms) ? ms : Date.now())
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 分类对应的目录与 txt 路径；项目没填文件夹就返回 null（不落盘）。 */
export const categoryRecordPaths = (project, category) => {
  const root = String(project?.path ?? '').trim()
  if (root === '') return null
  const name = safeName(category?.title)
  const dir = path.join(root, name)
  return { dir, file: path.join(dir, `${name}.txt`) }
}

const header = (project, category, when) => [
  `分类：${category.title}`,
  `项目：${project.title}`,
  `建立：${stamp(when)}`,
  '说明：这个文件由「工作清单」自动追加，记录本分类下的改动；手写的备注不会被覆盖。',
  '',
  '-'.repeat(56),
  '',
].join('\r\n')

/** 保证文件夹和 txt 都在，返回 txt 路径（失败返回 null）。 */
export const ensureCategoryRecord = (project, category, when = Date.now()) => {
  const target = categoryRecordPaths(project, category)
  if (target === null) return null
  try {
    fs.mkdirSync(target.dir, { recursive: true })
    if (!fs.existsSync(target.file)) {
      fs.writeFileSync(target.file, '\ufeff' + header(project, category, when), 'utf8')
    }
    return target.file
  } catch {
    return null
  }
}

/** 往分类的 txt 里追加一行。 */
export const appendCategoryRecord = (project, category, line, when = Date.now()) => {
  if (typeof line !== 'string' || line.trim() === '') return null
  const target = categoryRecordPaths(project, category)
  if (target === null) return null
  try {
    fs.mkdirSync(target.dir, { recursive: true })
    if (!fs.existsSync(target.file)) {
      fs.writeFileSync(target.file, '\ufeff' + header(project, category, when), 'utf8')
    }
    fs.appendFileSync(target.file, `${stamp(when)}  ${line}\r\n`, 'utf8')
    return target.file
  } catch {
    return null
  }
}

/** 分类改名时把文件夹和 txt 一起改过来（目标已存在就原地追加一条说明）。 */
export const renameCategoryRecord = (project, oldTitle, newTitle, when = Date.now()) => {
  const root = String(project?.path ?? '').trim()
  if (root === '') return null
  const oldName = safeName(oldTitle)
  const newName = safeName(newTitle)
  if (oldName === newName) return ensureCategoryRecord(project, { title: newTitle }, when)
  const oldDir = path.join(root, oldName)
  const newDir = path.join(root, newName)
  try {
    if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
      fs.renameSync(oldDir, newDir)
    }
    // 目录改完之后，里面的 txt 也要换成新名字；两个候选位置都试一下。
    const candidates = [
      [path.join(newDir, `${oldName}.txt`), path.join(newDir, `${newName}.txt`)],
      [path.join(oldDir, `${oldName}.txt`), path.join(newDir, `${newName}.txt`)],
    ]
    for (const [from, to] of candidates) {
      if (fs.existsSync(from) && !fs.existsSync(to)) {
        fs.renameSync(from, to)
        break
      }
    }
  } catch {
    /* 改不动就留在原地，下面照样往新名字的路径追加 */
  }
  return appendCategoryRecord(project, { title: newTitle }, `分类改名为「${newTitle}」（原名「${oldTitle}」）`, when)
}

/**
 * 项目改名时，把项目文件夹也改成新名字。
 *
 * 只在「文件夹名 == 旧项目名」时动手 —— 也就是说，只有这个文件夹本来就是按项目名建的
 * （新建项目时默认就是这样），才会跟着改名；用户自己挑了一个不相干的目录，不去动它。
 * 返回新路径；没动就返回 null。
 */
export const renameProjectFolder = (project, previousTitle) => {
  const root = String(project?.path ?? '').trim()
  if (root === '') return null
  const oldName = safeName(previousTitle)
  const newName = safeName(project?.title)
  if (oldName === newName) return null
  if (path.basename(root).toLowerCase() !== oldName.toLowerCase()) return null
  const target = path.join(path.dirname(root), newName)
  try {
    if (fs.existsSync(target)) return null
    fs.renameSync(root, target)
    return target
  } catch {
    return null
  }
}