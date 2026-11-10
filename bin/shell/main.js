// 极简 Electron 外壳：只有它能让窗口真的「透」出桌面。
// DSH 自带 DeepSeek Harness.exe 就是 Electron 本体，把它当解释器用，不用额外带 runtime。
const { app, BrowserWindow, ipcMain } = require('electron')

const target = process.env.WL_URL || 'http://127.0.0.1:7419/'
const alpha = Number(process.env.WL_ALPHA || '0.35')

app.commandLine.appendSwitch('enable-features', 'WindowControlsOverlay')
app.disableHardwareAcceleration === undefined ? null : null

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 420,
    height: 620,
    minWidth: 260,
    minHeight: 260,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    show: false,
    webPreferences: { contextIsolation: true },
  })
  win.setOpacity(1)
  win.loadURL(target)
  win.once('ready-to-show', () => win.show())
  ipcMain.handle('wl:quit', () => app.quit())
})