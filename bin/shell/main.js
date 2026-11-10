// 工作清单的桌面外壳（Electron）。
// 为什么需要它：浏览器窗口（Edge --app）没法做「窗口级透明」，backdrop-filter 只能糊
// 页面自己画的底色；只有自己拥有窗口，才能用 Windows 11 的 acrylic 材质把桌面透上来。
//
// 用法：electron.exe <这个目录> [--url http://127.0.0.1:7419/]

const { app, BrowserWindow, ipcMain, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const argv = process.argv.slice(2)
const argUrl = (() => {
  const index = argv.indexOf('--url')
  return index >= 0 ? argv[index + 1] : ''
})()

const DATA = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'state')
const BOUNDS_FILE = path.join(DATA, 'dsh-worklist-window.json')
const DEFAULT_SIZE = { width: 420, height: 640 }

// 外壳静默退出时最难查，所以把关键节点和异常都落一行日志。
// 注意：日志目录本身也可能不可写（例如被沙箱挡掉 %USERPROFILE%），所以按顺序试，
// 最后一个兜底是外壳自己的目录 —— 这里再写不了就真的什么都记不下了。
const APP_DIR = __dirname
const LOG_CANDIDATES = [path.join(DATA, 'dsh-worklist-shell.log'), path.join(APP_DIR, 'shell.log')]
const writeLog = (message) => {
  const line = new Date().toISOString() + ' ' + message + '\n'
  for (const target of LOG_CANDIDATES) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.appendFileSync(target, line)
      return
    } catch {}
  }
}
const log = writeLog
process.on('uncaughtException', (error) => log('uncaught ' + ((error && error.stack) || error)))
process.on('unhandledRejection', (error) => log('rejection ' + ((error && error.stack) || error)))
log('start argv=' + JSON.stringify(argv) + ' platform=' + process.platform)

const readBounds = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(BOUNDS_FILE, 'utf8'))
    if (typeof raw.width === 'number' && typeof raw.height === 'number') return raw
  } catch {}
  return { ...DEFAULT_SIZE }
}

const saveBounds = (win) => {
  try {
    const bounds = win.getBounds()
    fs.mkdirSync(DATA, { recursive: true })
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds))
  } catch {}
}

const clampToScreen = (bounds) => {
  const area = screen.getDisplayMatching(bounds).workArea
  const width = Math.max(260, Math.min(bounds.width || DEFAULT_SIZE.width, area.width))
  const height = Math.max(260, Math.min(bounds.height || DEFAULT_SIZE.height, area.height))
  const x = typeof bounds.x === 'number' ? Math.min(Math.max(bounds.x, area.x), area.x + area.width - width) : undefined
  const y = typeof bounds.y === 'number' ? Math.min(Math.max(bounds.y, area.y), area.y + area.height - height) : undefined
  return { width, height, x, y }
}

// 没给 --url 时，从正在跑的服务里问一个地址回来
const resolveUrl = async () => {
  if (argUrl !== '') return argUrl
  if (process.env.WL_URL) return process.env.WL_URL
  return 'http://127.0.0.1:7419/'
}

app.whenReady().then(async () => {
  log('ready')
  const url = await resolveUrl()
  const stored = clampToScreen(readBounds())
  log('url=' + url + ' bounds=' + JSON.stringify(stored))
  const win = new BrowserWindow({
    ...stored,
    minWidth: 260,
    minHeight: 260,
    frame: false,
    transparent: false,
    // Windows 11：让系统在窗口后面铺一层亚克力（桌面被真实模糊）
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    show: false,
    title: '工作清单',
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })
  win.setMenuBarVisibility(false)
  const target = new URL(url + (url.includes('?') ? '&' : '?') + 'shell=1')
  log('loading ' + target.toString())
  win.loadURL(target.toString())
  win.webContents.on('did-fail-load', (_event, code, description) => log('did-fail-load ' + code + ' ' + description))
  win.webContents.on('render-process-gone', (_event, details) => log('render-gone ' + JSON.stringify(details)))
  win.once('ready-to-show', () => {
    log('ready-to-show; showing')
    win.show()
  })
  win.on('resize', () => saveBounds(win))
  win.on('move', () => saveBounds(win))

  ipcMain.handle('wl:quit', () => app.quit())
  app.on('window-all-closed', () => app.quit())
})