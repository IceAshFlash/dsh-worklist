/**
 * core/open.js — 在系统文件管理器里打开一个目录。
 * 只是「新建项目 / 快速打开项目文件夹」那一下，故意做得没有依赖。
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const openFolder = (target) => {
  const resolved = path.resolve(String(target ?? '').trim())
  if (resolved === '' || !fs.existsSync(resolved)) {
    throw new Error(`文件夹不存在：${resolved}`)
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`不是文件夹：${resolved}`)
  }
  const command = process.platform === 'win32'
    ? 'explorer.exe'
    : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(command, [resolved], { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
  return resolved
}