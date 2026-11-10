#!/usr/bin/env node
/**
 * bin/check.js — 把包里每个 JS 文件都解析一遍。
 *
 *   node bin/check.js        # 全部过 → 退出码 0；有语法错 → 打印位置并退出 1
 *
 * 为什么单独有这一步：`client.js` 是整块交给 DSH 的 ModuleLoader 的，
 * 只要有一个字符不对（例如字符串里混进了真实换行），整块都解析失败，
 * 表现为启动时 "1 entry did not activate"、面板空白，而接口和工具全都正常。
 * 而 `test/smoke.mjs` 只跑 HTTP 接口，碰不到这一层，所以这里单独做一次解析检查。
 *
 * 用子进程 `node --check` 而不是 `vm.Script`：.mjs 里有 import/export，
 * vm.Script 只认脚本语法，会误报。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// bin/electron 是本地下载的 Electron 运行时（不在仓库里），里面成千上万个 .js 不该被扫
const SKIP_DIRS = new Set(['node_modules', '.git', '_downloads', 'test', 'dist', 'electron'])
const WANTED = ['.js', '.mjs', '.cjs']

const walk = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...walk(full))
      continue
    }
    if (WANTED.includes(path.extname(entry.name))) out.push(full)
  }
  return out
}

const files = walk(ROOT).sort()
const failed = []

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    const stderr = String(error?.stderr ?? '').trim()
    failed.push({ file: path.relative(ROOT, file), stderr })
  }
}

if (failed.length === 0) {
  process.stdout.write(`解析检查通过：${files.length} 个文件\n`)
  process.exit(0)
}

for (const item of failed) {
  process.stderr.write(`\n[check] ${item.file}\n`)
  process.stderr.write(item.stderr + '\n')
}
process.stderr.write(`\n${failed.length} 个文件有语法错误\n`)
process.exit(1)