#!/usr/bin/env node
/**
 * bin/shortcut.js — 在桌面放一个「工作清单」快捷方式。
 *
 *   node bin/shortcut.js
 *
 * 快捷方式 → wscript.exe → bin/worklist-open.vbs → node bin/worklist.js serve --open
 * 结果：双击是个图形窗口，不是黑框；数据仍在同一个 JSON 文件里。
 * （PowerShell 脚本临时生成成带 BOM 的 UTF-8，中文名才不会被读成乱码。）
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const VBS = path.join(ROOT, 'bin', 'worklist-open.vbs')
const ICON = path.join(ROOT, 'bin', 'icon.ico')
const NAME = '工作清单'
const DESCRIPTION = '工作清单：项目 → 分类 → 工作单项，加权进度看板'

if (process.platform !== 'win32') {
  console.error('桌面快捷方式目前只做了 Windows；其它系统可以直接跑 bin/worklist.js serve --open')
  process.exit(1)
}

if (!fs.existsSync(VBS)) {
  console.error(`缺 ${VBS}`)
  process.exit(1)
}

const ps1 = `
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop '${NAME}.lnk'
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\\wscript.exe')
$lnk.Arguments = '"${VBS}"'
$lnk.WorkingDirectory = '${ROOT}'
$lnk.IconLocation = '${ICON}'
$lnk.Description = '${DESCRIPTION}'
$lnk.WindowStyle = 7
$lnk.Save()
Write-Output ("OK " + $lnkPath)
`

const script = path.join(ROOT, `.shortcut-${process.pid}.ps1`)
fs.writeFileSync(script, '\uFEFF' + ps1, 'utf8')

const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
  encoding: 'utf8',
})

fs.rmSync(script, { force: true })

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
if (result.status !== 0) {
  console.error(output || `powershell 退出码 ${result.status}`)
  process.exit(1)
}

process.stdout.write(`${output}\n`)
process.stdout.write('双击它就能打开图形界面；数据在 $DSH_HOME/state/dsh-worklist.json，和 DSH 里那份是同一个文件。\n')