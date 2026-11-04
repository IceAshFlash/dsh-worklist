/**
 * client.js — 由 bin/build.js 从 ui/app.js 生成，不要手改。
 *
 * 这一份同时是 DSH 的侧栏面板：图标占 sidebar.panellist，面板占 main 的 key
 * 'dsh-worklist'。UI 本身是纯 DOM，和独立模式（bin/worklist.js serve）跑的是同一段代码。
 */

window.__ModuleLoader__.load({
  id: 'dsh-worklist',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-worklist'
    const BASE = '/dsh-worklist-api'
    const ZH = /^zh/i.test(typeof navigator === 'object' ? String(navigator.language || '') : '')
    const LABEL = ZH ? '工作清单' : 'Worklist'
    // apply() 拿到的 ctx；面板里要用它取 uiWorkspace（原生选目录）。
    let CTX = null

    /* ------------------------------------------------------------ 内联的 UI */
/**
 * ui/app.js — 工作清单的全部界面，纯 DOM，零依赖。
 *
 * 一份代码两处跑：
 *   · DSH 面板里（base = /dsh-worklist-api）
 *   · 独立桌宠窗口里（base = /api）
 *
 * 业务计算全在 core 里做好了（进度、DDL 状态、排序），这里只负责画和收输入。
 * 唯一的「宿主能力」是 AI 拆分：它只是往 base + '/ai-split' 发一个请求，
 * 独立窗口那边没有这个接口，按钮会自己说明原因。
 */
;(function () {
  'use strict'

  var STYLE_ID = 'wl-style' // ui-copy-ignore

  var CSS = [
    '.wl-root{--wl-accent:#3f6be6;--wl-accent-hover:#3459c4;--wl-danger:#e5484d;display:flex;height:100%;min-height:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--dsw-alias-label-primary,#1c1f24);background:var(--dsw-alias-bg-base,#fff);font-size:13px;line-height:1.5}',
    '.wl-root *{box-sizing:border-box}',
    '.wl-side{width:232px;flex:0 0 232px;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--dsw-alias-border-l1,#e6e8eb);background:var(--dsw-alias-bg-layer-1,#fafbfc)}',
    '.wl-side-head{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-side-list{flex:1 1 auto;overflow-y:auto;padding:0 8px 12px}',
    '.wl-check-row{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;cursor:pointer}',
    '.wl-arch-btn{margin-left:auto;margin-right:2px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:transparent;color:var(--dsw-alias-label-secondary,#5b6470);border-radius:6px;padding:1px 6px;font-size:11px;line-height:16px;cursor:pointer;font-family:inherit}',
    '.wl-arch-btn:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-arch-btn.is-on{color:var(--wl-accent);border-color:var(--wl-accent)}',
    '.wl-chip.is-arch{background:rgba(120,130,145,.14);color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-task.is-archived,.wl-cat.is-archived,.wl-proj.is-archived{opacity:.55}',
    '.wl-proj{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:8px;padding:8px 10px;margin:2px 0;cursor:pointer;color:inherit;font:inherit}',
    '.wl-proj:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-proj.is-active{background:var(--dsw-alias-bg-layer-2,#eceff3);box-shadow:inset 2px 0 0 var(--wl-accent)}',
    '.wl-proj-top{display:flex;align-items:center;gap:6px;min-width:0}',
    '.wl-dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto}',
    '.wl-proj-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}',
    '.wl-proj-meta{margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-main{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0}',
    '.wl-top{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#e6e8eb)}',
    '.wl-top-wrap{flex:0 0 auto;border-bottom:1px solid var(--dsw-alias-border-l1,#e6e8eb)}',
    '.wl-top-wrap .wl-top{border-bottom:0}',
    '.wl-top-sub{display:flex;align-items:center;gap:8px;padding:0 18px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-top-subbtn{border:0;background:transparent;padding:0;font:inherit;font-size:11px;color:inherit;cursor:pointer;display:flex;align-items:center;gap:6px;border-radius:6px}',
    '.wl-top-subbtn:hover{color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-menu{position:fixed;z-index:1000;min-width:158px;padding:4px;border-radius:9px;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l2,#d3d8df);box-shadow:0 10px 28px rgba(15,23,42,.18)}',
    '.wl-menu-item{display:block;width:100%;text-align:left;border:0;background:transparent;padding:6px 10px;border-radius:6px;font:inherit;font-size:12px;color:inherit;cursor:pointer;white-space:nowrap}',
    '.wl-menu-item:hover{background:var(--dsw-alias-bg-layer-2,#eef1f5)}',
    '.wl-menu-item.is-danger{color:var(--wl-danger,#e5484d)}',
    '.wl-menu-item[disabled]{opacity:.4;cursor:default}',
    '.wl-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1,#e6e9ee)}',
    '.wl-pin{flex:0 0 auto;font-size:10px;line-height:1;color:var(--wl-accent);opacity:.95}',
    '.wl-proj.is-pinned{box-shadow:inset 2px 0 0 var(--wl-accent)}',
    '.wl-title{font-size:15px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c);white-space:nowrap}',
    '.wl-grow{flex:1 1 auto}',
    '.wl-scroll{flex:1 1 auto;overflow-y:auto;padding:14px 18px 32px;min-height:0}',
    '.wl-cat{border:1px solid var(--dsw-alias-border-l1,#e6e8eb);border-radius:10px;margin-bottom:10px;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}',
    '.wl-cat-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--dsw-alias-bg-layer-1,#fafbfc);cursor:pointer;user-select:none}',
    '.wl-cat-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-cat-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c);white-space:nowrap}',
    '.wl-cat-body{padding:4px 6px 8px}',
    '.wl-cat.is-ddl{border-color:rgba(229,72,77,.35);border-color:color-mix(in srgb,var(--wl-danger) 38%,transparent)}',
    '.wl-cat.is-ddl .wl-cat-head{background:rgba(229,72,77,.06);background:color-mix(in srgb,var(--wl-danger) 7%,transparent)}',
    '.wl-cat.is-ddl .wl-cat-name{color:var(--wl-danger)}',
    '.wl-cat.is-ddl .wl-cat-count{color:var(--wl-danger);opacity:.85}',
    '.wl-cat-hint{font-size:11px;color:var(--wl-danger);opacity:.8;white-space:nowrap}',
    '.wl-task.is-clone{cursor:default}',
    '.wl-task.is-clone .wl-task-title{color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-chip.is-warn{color:var(--wl-danger);border-color:rgba(229,72,77,.45);border-color:color-mix(in srgb,var(--wl-danger) 45%,transparent)}',
    '.wl-task{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px}',
    '.wl-task:hover{background:var(--dsw-alias-bg-layer-1,#f7f8fa)}',
    '.wl-check{width:16px;height:16px;flex:0 0 auto;border-radius:4px;border:1.5px solid var(--dsw-alias-border-l2,#c9ced6);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:#fff;font-size:11px;line-height:1}',
    '.wl-check.is-on{background:var(--wl-accent);border-color:var(--wl-accent)}',
    '.wl-task-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}',
    '.wl-task.is-done .wl-task-title{text-decoration:line-through;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-chip{flex:0 0 auto;font-size:11px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#e6e8eb);color:var(--dsw-alias-label-secondary,#5b6470);white-space:nowrap}',
    '.wl-chip.is-overdue{color:#fff;background:var(--dsw-alias-state-error-primary,#e5484d);border-color:transparent}',
    '.wl-chip.is-today{color:#fff;background:var(--dsw-alias-state-warn-primary,#e08a3c);border-color:transparent}',
    '.wl-chip.is-soon{color:var(--dsw-alias-state-warn-primary,#c8752f);border-color:var(--dsw-alias-state-warn-primary,#c8752f)}',
    '.wl-bar{position:relative;height:4px;border-radius:999px;background:var(--dsw-alias-border-l1,#e6e8eb);overflow:hidden;flex:0 0 64px;width:64px}',
    '.wl-bar>i{position:absolute;left:0;top:0;bottom:0;background:var(--wl-accent);border-radius:999px}',
    '.wl-steps{margin:0 0 6px 26px;padding:2px 0 2px 10px;border-left:2px solid var(--dsw-alias-border-l1,#e6e8eb)}',
    '.wl-step{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-step.is-done{color:var(--dsw-alias-label-tertiary,#8b929c);text-decoration:line-through}',
    '.wl-step-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d3d8df);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1c1f24);border-radius:7px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.wl-btn:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-btn:disabled{opacity:.55;cursor:default}',
    '.wl-btn.is-primary{background:var(--wl-accent);border-color:transparent;color:#fff}',
    '.wl-btn.is-primary:hover{filter:brightness(.95)}',
    '.wl-btn.is-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary,#5b6470);padding:4px 6px}',
    '.wl-btn.is-ghost:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-btn.is-danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:var(--dsw-alias-state-error-primary,#e5484d)}',
    '.wl-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#8b929c);cursor:pointer;font-size:13px;line-height:1}',
    '.wl-icon:hover{background:var(--dsw-alias-bg-layer-2,#eef0f3);color:var(--dsw-alias-label-primary,#1c1f24)}',
    '.wl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;min-height:180px;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:12px;text-align:center;padding:24px}',
    '.wl-mask{position:fixed;inset:0;background:rgba(15,18,22,.42);display:flex;align-items:center;justify-content:center;padding:24px;z-index:40}',
    '.wl-mask.is-top{z-index:60;background:rgba(15,18,22,.52)}',
    '.wl-row{display:flex;gap:8px;align-items:center}',
    '.wl-dir-list{max-height:min(38vh,280px);overflow-y:auto;border:1px solid var(--dsw-alias-border-l1,#e6e8eb);border-radius:8px;background:var(--dsw-alias-bg-base,#fff)}',
    '.wl-dir{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:6px 10px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;border-bottom:1px solid var(--dsw-alias-border-l1,#f2f3f5)}',
    '.wl-dir:last-child{border-bottom:0}',
    '.wl-dir:hover{background:var(--dsw-alias-bg-layer-2,#f2f4f7)}',
    '.wl-dir-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-chips{display:flex;gap:6px;flex-wrap:wrap}',
    '.wl-win{width:min(560px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l1,#e6e8eb);border-radius:12px;box-shadow:0 18px 48px rgba(15,18,22,.28);overflow:hidden}',
    '.wl-win-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e6e8eb);font-weight:600}',
    '.wl-win-body{flex:1 1 auto;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '.wl-win-foot{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1,#e6e8eb);background:var(--dsw-alias-bg-layer-1,#fafbfc)}',
    '.wl-field{display:flex;flex-direction:column;gap:4px}',
    '.wl-label{font-size:11px;color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-input,.wl-select,.wl-textarea{width:100%;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2,#d3d8df);border-radius:7px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:12px;outline:none}',
    '.wl-input:focus,.wl-select:focus,.wl-textarea:focus{border-color:var(--wl-accent)}',
    '.wl-textarea{min-height:52px;resize:vertical}',
    '.wl-row{display:flex;gap:8px;align-items:flex-end}',
    '.wl-row>*{min-width:0}',
    '.wl-steps-editor{display:flex;flex-direction:column;gap:6px}',
    '.wl-step-row{display:flex;gap:6px;align-items:center}',
    '.wl-step-row .wl-input{flex:1 1 auto}',
    '.wl-step-row .wl-num{width:64px;flex:0 0 64px}',
    '.wl-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-hint.is-error{color:var(--dsw-alias-state-error-primary,#e5484d)}',
    '.wl-split-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2,#d3d8df);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fafbfc)}',
    '.wl-spin{display:inline-block;width:11px;height:11px;border:2px solid var(--dsw-alias-border-l2,#c9ced6);border-top-color:var(--wl-accent);border-radius:50%;animation:wl-spin .7s linear infinite}',
    '@keyframes wl-spin{to{transform:rotate(360deg)}}',
    '.wl-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
  ].join('\n')

  var ensureStyle = function (doc) {
    if (doc.getElementById(STYLE_ID) !== null) return
    var tag = doc.createElement('style')
    tag.id = STYLE_ID
    tag.textContent = CSS
    doc.head.appendChild(tag)
  }

  var h = function (tag, props) {
    var node = document.createElement(tag)
    if (props !== undefined && props !== null) {
      Object.keys(props).forEach(function (key) {
        var value = props[key]
        if (value === undefined || value === null || value === false) return
        if (key === 'style' && typeof value === 'object') {
          Object.keys(value).forEach(function (name) {
            node.style[name] = value[name]
          })
          return
        }
        if (key === 'text') {
          node.textContent = String(value)
          return
        }
        if (key === 'class') {
          node.className = String(value)
          return
        }
        if (key === 'html') {
          node.innerHTML = value
          return
        }
        if (key.slice(0, 2) === 'on' && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value)
          return
        }
        if (key === 'dataset' && typeof value === 'object') {
          Object.keys(value).forEach(function (name) { node.dataset[name] = String(value[name]) })
          return
        }
        node.setAttribute(key, value === true ? '' : String(value))
      })
    }
    for (var i = 2; i < arguments.length; i += 1) {
      var child = arguments[i]
      if (child === undefined || child === null || child === false) continue
      if (Array.isArray(child)) {
        child.forEach(function (item) {
          if (item === undefined || item === null || item === false) return
          node.appendChild(typeof item === 'string' ? document.createTextNode(item) : item)
        })
        continue
      }
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
    }
    return node
  }

  var pct = function (value) {
    var n = Number.isFinite(value) ? value : 0
    return Math.round(Math.max(0, Math.min(1, n)) * 100) + '%'
  }

  var bar = function (value, width) {
    var fill = h('i', { style: { width: pct(value) } })
    return h('span', { class: 'wl-bar', style: width !== undefined ? { width: width, flex: '0 0 ' + width } : undefined }, fill)
  }

  var dueChip = function (task) {
    if (task.due === 'none' || !Number.isFinite(task.dueAt)) return null
    var date = new Date(task.dueAt)
    var stamp = (date.getMonth() + 1) + '/' + date.getDate()
    var tone = task.due === 'overdue' ? ' is-overdue' : task.due === 'today' ? ' is-today' : task.due === 'soon' ? ' is-soon' : ''
    var text = stamp
    if (task.due === 'overdue') text = stamp + ' 逾期'
    else if (task.due === 'today') text = stamp + ' 今天'
    else if (task.due === 'soon') text = stamp + ' 剩' + task.daysLeft + '天'
    return h('span', { class: 'wl-chip' + tone, title: date.toLocaleString() }, text)
  }

  var parseDateInput = function (value) {
    if (typeof value !== 'string' || value.trim() === '') return null
    var parsed = Date.parse(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  var dateInputValue = function (ms) {
    if (!Number.isFinite(ms)) return ''
    var date = new Date(ms)
    var pad = function (n) { return String(n).padStart(2, '0') }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
  }

  function mount(root, options) {
    var opts = options || {}
    var base = typeof opts.base === 'string' ? opts.base.replace(/\/+$/, '') : ''
    // DSH 里传的是 ctx.uiWorkspace.pickDirectory（系统自带的选目录对话框）；
    // 独立窗口没有它，只有自己写的那套目录浏览器。
    var pickDirectory = typeof opts.pickDirectory === 'function' ? opts.pickDirectory : null
    var doc = root.ownerDocument || document
    ensureStyle(doc)

    var view = {
      data: null,
      error: null,
      loading: true,
      selectedProjectId: null,
      expanded: {},
      aiAvailable: false,
      dataFile: '',
      archiveMode: 'hide',
    }
    var mounted = true
    var mask = null
    var pickerOpen = false

    /*
     * 归档的三种看法：默认不进视线，切到「含归档」能把它们找出来，
     * 「只看归档」用来批量清理。存在 localStorage 里，刷新页面不会忘。
     */
    var ARCHIVE_KEY = 'wl-archive-mode'
    var ARCHIVE_MODES = ['hide', 'all', 'only']
    var ARCHIVE_TEXT = { hide: '归档 关', all: '归档 含', only: '归档 只' }
    try {
      var savedMode = localStorage.getItem(ARCHIVE_KEY)
      if (ARCHIVE_MODES.indexOf(savedMode) >= 0) view.archiveMode = savedMode
    } catch (error) { /* 独立窗口可能没有 localStorage */ }

    var visibleArchived = function (item) {
      if (item.archived !== true && view.archiveMode === 'only') return false
      if (view.archiveMode === 'hide') return item.archived !== true
      if (view.archiveMode === 'only') return item.archived === true
      return true
    }

    var cycleArchiveMode = function () {
      var next = ARCHIVE_MODES[(ARCHIVE_MODES.indexOf(view.archiveMode) + 1) % ARCHIVE_MODES.length]
      view.archiveMode = next
      try { localStorage.setItem(ARCHIVE_KEY, next) } catch (error) { /* 忽略 */ }
      render()
    }

    var setArchived = function (collection, id, archived) {
      return request('PATCH', '/' + collection + '/' + encodeURIComponent(id), { archived: archived })
        .then(function () { return refresh() })
        .catch(function (error) { notifyError(error) })
    }

    var request = function (method, path, body) {
      var init = { method: method, headers: {}, credentials: 'same-origin' }
      if (body !== undefined) {
        init.headers['content-type'] = 'application/json'
        init.body = JSON.stringify(body)
      }
      return fetch(base + path, init).then(function (response) {
        return response.json().catch(function () { return {} }).then(function (payload) {
          if (!response.ok || payload.ok === false) {
            var message = payload && payload.error ? payload.error : ('HTTP ' + response.status)
            throw new Error(message)
          }
          return payload
        })
      })
    }

    var notifyError = function (error) {
      view.error = String(error && error.message ? error.message : error)
      render()
    }

    var applyState = function (state) {
      view.data = state
      view.error = null
      view.loading = false
      var exists = view.data.projects.some(function (p) { return p.id === view.selectedProjectId && visibleArchived(p) })
      if (!exists) {
        var shown = view.data.projects.filter(visibleArchived)
        var withOpen = shown.filter(function (p) { return p.openCount > 0 })
        view.selectedProjectId = (withOpen[0] || shown[0] || {}).id || null
      }
      render()
    }

    var refresh = function () {
      return request('GET', '/state').then(function (payload) {
        if (!mounted) return
        applyState(payload.state)
      }).catch(function (error) {
        if (!mounted) return
        view.loading = false
        view.error = String(error && error.message ? error.message : error)
        render()
      })
    }

    /*
     * 数据是几个窗口共用的一个 JSON 文件（DSH 面板 / 桌面窗口 / Agent 工具），
     * 所以这里每 2 秒比对一次 updatedAt：别人的改动也能立刻反映到进度条上。
     * 二级窗口开着时暂停轮询，否则重绘会把正在输入的内容冲掉。
     */
    var pollTimer = null
    var poll = function () {
      if (!mounted || mask !== null || pickerOpen) return
      if (doc.visibilityState === 'hidden') return
      request('GET', '/state').then(function (payload) {
        if (!mounted || mask !== null || pickerOpen) return
        if (view.data !== null && payload.state.updatedAt === view.data.updatedAt) return
        applyState(payload.state)
      }).catch(function () {})
    }

    var loadMeta = function () {
      return request('GET', '/meta').then(function (payload) {
        if (!mounted) return
        view.aiAvailable = payload.aiAvailable === true
        view.dataFile = typeof payload.dataFile === 'string' ? payload.dataFile : ''
      }).catch(function () {})
    }

    /* ---------------- 渲染 ---------------- */

    var render = function () {
      var scrollTop = 0
      var scroller = root.querySelector('.wl-scroll')
      if (scroller !== null) scrollTop = scroller.scrollTop
      root.textContent = ''
      root.className = 'wl-root'

      var project = null
      if (view.data !== null && view.selectedProjectId !== null) {
        project = view.data.projects.filter(function (p) { return p.id === view.selectedProjectId })[0] || null
      }

      root.appendChild(renderSide())
      var main = h('div', { class: 'wl-main' })
      main.appendChild(renderTop(project))
      main.appendChild(renderScroll(project))
      root.appendChild(main)

      var next = root.querySelector('.wl-scroll')
      if (next !== null && scrollTop > 0) next.scrollTop = scrollTop
    }

    var renderSide = function () {
      var side = h('div', { class: 'wl-side' })
      side.appendChild(h('div', { class: 'wl-side-head' },
        h('span', { text: '项目' }),
        h('button', {
          class: 'wl-arch-btn' + (view.archiveMode === 'hide' ? '' : ' is-on'),
          title: '切换查看方式：不显示归档 → 含归档 → 只看归档',
          onclick: cycleArchiveMode,
          text: ARCHIVE_TEXT[view.archiveMode],
        }),
        h('button', {
          class: 'wl-btn is-ghost',
          title: '新建项目',
          onclick: function () { openProjectModal() },
        }, '＋')
      ))
      var list = h('div', { class: 'wl-side-list' })
      var projects = view.data === null ? [] : view.data.projects.filter(visibleArchived)
      if (projects.length === 0) {
        list.appendChild(h('div', { class: 'wl-hint', style: { padding: '8px 10px' }, text: '还没有项目' }))
      }
      projects.forEach(function (item) {
        var active = item.id === view.selectedProjectId
        var button = h('button', {
          class: 'wl-proj' + (active ? ' is-active' : '') + (item.pinned ? ' is-pinned' : '') +
            (item.archived === true ? ' is-archived' : ''),
          onclick: function () {
            view.selectedProjectId = item.id
            render()
          },
          oncontextmenu: function (event) {
            event.preventDefault()
            event.stopPropagation()
            openProjectMenu(event, item)
          },
        },
        h('div', { class: 'wl-proj-top' },
          h('span', { class: 'wl-dot', style: { background: item.color } }),
          item.pinned ? h('span', { class: 'wl-pin', title: '已置顶', text: '📌' }) : null,
          h('span', { class: 'wl-proj-name', text: item.title, title: item.title }),
          h('span', { class: 'wl-sub', text: pct(item.progress) })
        ),
        h('div', { class: 'wl-proj-meta' },
          bar(item.progress, '56px'),
          h('span', { text: item.openCount + '/' + item.taskCount }),
          item.warningCount > 0 ? h('span', { class: 'wl-chip is-warn', text: 'DDL ' + item.warningCount, title: '进入预警窗口、还没做完的工作数' }) : null,
          item.due === 'overdue' ? h('span', { class: 'wl-chip is-overdue', text: '逾期' }) : null
        ))
        list.appendChild(button)
      })
      side.appendChild(list)
      return side
    }

    var renderTop = function (project) {
      var top = h('div', { class: 'wl-top' })
      var wrap = h('div', { class: 'wl-top-wrap' })
      if (project !== null) {
        top.appendChild(h('span', { class: 'wl-dot', style: { background: project.color, width: '10px', height: '10px' } }))
        if (project.pinned) top.appendChild(h('span', { class: 'wl-pin', title: '已置顶', text: '📌' }))
        top.appendChild(h('span', { class: 'wl-title', text: project.title, title: project.title }))
        top.appendChild(bar(project.progress, '90px'))
        top.appendChild(h('span', { class: 'wl-sub', text: pct(project.progress) + ' · ' + project.openCount + '/' + project.taskCount }))
        if (project.path !== '') {
          top.appendChild(h('button', {
            class: 'wl-btn is-ghost',
            title: project.path,
            onclick: function () {
              request('POST', '/projects/' + encodeURIComponent(project.id) + '/open')
                .catch(function (error) { notifyError(error) })
            },
          }, '打开文件夹'))
        }
        top.appendChild(h('span', { class: 'wl-grow' }))
        top.appendChild(h('button', {
          class: 'wl-btn',
          onclick: function () { openCategoryModal(project) },
        }, '＋ 分类'))
        top.appendChild(h('button', {
          class: 'wl-icon',
          title: '项目设置',
          onclick: function () { openProjectModal(project) },
        }, '⋯'))
      } else {
        top.appendChild(h('span', { class: 'wl-title', text: '工作清单' }))
        top.appendChild(h('span', { class: 'wl-grow' }))
      }
      top.appendChild(h('button', {
        class: 'wl-btn is-ghost',
        title: view.dataFile === '' ? '刷新' : view.dataFile,
        onclick: function () { refresh() },
      }, '刷新'))
      wrap.appendChild(top)
      if (project !== null) {
        // 进度条下面这行就是「DDL 工作数目」：点一下跳到预警分类。
        var ddlId = project.ddlCategoryId
        wrap.appendChild(h('div', { class: 'wl-top-sub' },
          h('button', {
            class: 'wl-top-subbtn',
            title: '进入预警窗口、还没做完的工作；点一下跳到 DDL预警',
            onclick: function () {
              if (ddlId === null) return
              view.expanded[ddlId] = true
              render()
              var node = root.querySelector('[data-cat="' + ddlId + '"]')
              if (node !== null && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' })
            },
          },
            h('span', { class: 'wl-chip is-warn', text: 'DDL 工作 ' + project.warningCount + ' 项' }),
            h('span', { text: project.warningCount > 0 ? '按各自的预警线收进来的' : '暂时没有撞线的' })
          )
        ))
      }
      return wrap
    }

    var renderScroll = function (project) {
      var scroll = h('div', { class: 'wl-scroll' })

      if (view.loading) {
        scroll.appendChild(h('div', { class: 'wl-empty' }, h('span', { class: 'wl-spin' }), h('span', { text: '读取中…' })))
        return scroll
      }
      if (view.error !== null) {
        scroll.appendChild(h('div', { class: 'wl-empty' },
          h('span', { class: 'wl-hint is-error', text: view.error }),
          h('button', { class: 'wl-btn', onclick: function () { refresh() } }, '重试')
        ))
        return scroll
      }
      if (project === null) {
        scroll.appendChild(h('div', { class: 'wl-empty' },
          h('div', { text: '先把事情分成项目、分类，再到具体的工作。' }),
          h('button', { class: 'wl-btn is-primary', onclick: function () { openProjectModal() } }, '＋ 新建项目')
        ))
        return scroll
      }
      if (project.categories.length === 0) {
        scroll.appendChild(h('div', { class: 'wl-empty' },
          h('div', { text: '这个项目还没有分类。' }),
          h('button', { class: 'wl-btn is-primary', onclick: function () { openCategoryModal(project) } }, '＋ 新建分类')
        ))
        return scroll
      }
      project.categories.filter(function (category) {
        // DDL预警 是自动桶，没有归档内容，切到「只看归档」时收起来。
        if (category.kind === 'ddl') return view.archiveMode !== 'only'
        return visibleArchived(category)
      }).forEach(function (category) {
        scroll.appendChild(renderCategory(project, category))
      })
      return scroll
    }

    var hoursLabel = function (hours) {
      var value = Number(hours)
      if (!isFinite(value) || value <= 0) return '1小时'
      if (value % 24 === 0) return (value / 24) + '天'
      return value + '小时'
    }

    /** 克隆行显示"来自哪个分类"，方便一眼知道它原本在哪儿。 */
    var originTitle = function (task) {
      if (!task.cloneOf || view.data === null) return ''
      var real = (view.data.tasks || []).filter(function (item) { return item.id === task.cloneOf })[0]
      if (!real) return ''
      var home = (view.data.categories || []).filter(function (item) { return item.id === real.categoryId })[0]
      return home ? home.title : ''
    }

    var renderCategory = function (project, category) {
      var isDdl = category.kind === 'ddl'
      var open = view.expanded[category.id] !== false
      var box = h('div', {
        class: 'wl-cat' + (isDdl ? ' is-ddl' : '') + (category.archived === true ? ' is-archived' : ''),
        dataset: { cat: category.id },
      })
      var head = h('div', {
        class: 'wl-cat-head',
        oncontextmenu: function (event) {
          event.preventDefault()
          event.stopPropagation()
          openCategoryMenu(event, project, category)
        },
      },
        h('button', {
          class: 'wl-icon',
          title: open ? '收起' : '展开',
          onclick: function (event) {
            event.stopPropagation()
            view.expanded[category.id] = !open
            render()
          },
        }, open ? '▾' : '▸'),
        h('span', { class: 'wl-dot', style: { background: category.color } }),
        !isDdl && category.pinned ? h('span', { class: 'wl-pin', title: '已置顶', text: '📌' }) : null,
        h('span', { class: 'wl-cat-name', text: category.title, title: isDdl ? '自动收录撞上预警线的工作，不能改名或删除' : category.title }),
        isDdl ? h('span', { class: 'wl-cat-hint', text: '自动收录' }) : null,
        !isDdl && category.archived === true ? h('span', { class: 'wl-chip is-arch', text: '已归档' }) : null,
        bar(category.progress, '64px'),
        h('span', { class: 'wl-cat-count', text: pct(category.progress) + ' · ' + category.openCount + '/' + category.taskCount }),
        h('span', { class: 'wl-grow' })
      )
      if (isDdl) {
        head.appendChild(h('button', {
          class: 'wl-btn',
          title: '项目默认提前多久预警；每条工作可以在编辑窗口里单独设（默认 1 天，最小 1 小时）',
          onclick: function (event) {
            event.stopPropagation()
            openWarnModal(project)
          },
        }, '默认预警 · ' + hoursLabel(category.warnHours)))
      } else {
        head.appendChild(h('button', {
          class: 'wl-icon',
          title: '在这个分类下新建工作',
          onclick: function (event) {
            event.stopPropagation()
            openTaskModal(null, category)
          },
        }, '＋'))
        head.appendChild(h('button', {
          class: 'wl-icon',
          title: '重命名分类',
          onclick: function (event) {
            event.stopPropagation()
            openCategoryModal(project, category)
          },
        }, '✎'))
      }
      head.addEventListener('click', function () {
        view.expanded[category.id] = !open
        render()
      })
      box.appendChild(head)
      if (!open) return box

      var body = h('div', { class: 'wl-cat-body' })
      if (category.tasks.length === 0) {
        body.appendChild(h('div', {
          class: 'wl-hint',
          style: { padding: '6px 10px 8px' },
          text: isDdl ? '暂时没有撞上预警线的工作。' : '这个分类下还没有工作。',
        }))
      }
      category.tasks.filter(visibleArchived).forEach(function (task) {
        body.appendChild(renderTask(category, task))
      })
      box.appendChild(body)
      return box
    }

    var renderTask = function (category, task) {
      var done = task.progress >= 1
      // DDL预警里的行是克隆：勾它等于勾原来那条工作，编辑则跳回原来那条。
      var realId = task.cloneOf || task.id
      var isClone = Boolean(task.cloneOf)
      var expanded = view.expanded['t:' + realId] === true
      var wrap = h('div')
      var row = h('div', {
        class: 'wl-task' + (done ? ' is-done' : '') + (isClone ? ' is-clone' : '') +
          (task.archived === true ? ' is-archived' : ''),
        oncontextmenu: function (event) {
          event.preventDefault()
          event.stopPropagation()
          openTaskMenu(event, category, task)
        },
      },
        h('button', {
          class: 'wl-check' + (done ? ' is-on' : ''),
          title: done ? '标记为未完成' : '标记为完成',
          onclick: function (event) {
            event.stopPropagation()
            var nextDone = !done
            var patch = { done: nextDone }
            if (task.steps.length > 0) {
              patch.steps = task.steps.map(function (step) {
                return { id: step.id, title: step.title, weight: step.weight, done: nextDone }
              })
            }
            request('PATCH', '/tasks/' + encodeURIComponent(realId), patch)
              .then(function () { return refresh() })
              .catch(function (error) { notifyError(error) })
          },
        }, done ? '✓' : ''),
        h('span', {
          class: 'wl-task-title',
          text: task.title,
          title: task.title + (task.note !== '' ? '\n' + task.note : ''),
          onclick: function (event) {
            event.stopPropagation()
            view.expanded['t:' + realId] = !expanded
            render()
          },
        }),
        isClone && originTitle(task) !== '' ? h('span', { class: 'wl-chip', text: '来自 ' + originTitle(task) }) : null,
        task.pinned ? h('span', { class: 'wl-pin', title: '已置顶', text: '📌' }) : null,
        task.warnOwn ? h('span', { class: 'wl-chip is-warn', text: '预警 ' + hoursLabel(task.warnHours) }) : null,
        task.steps.length > 0 ? h('span', { class: 'wl-chip', text: task.steps.filter(function (s) { return s.done }).length + '/' + task.steps.length }) : null,
        h('span', { class: 'wl-chip', text: 'w' + task.weight }),
        dueChip(task),
        bar(task.progress, '56px'),
        isClone ? null : h('button', {
          class: 'wl-icon',
          title: '编辑',
          onclick: function (event) {
            event.stopPropagation()
            openTaskModal(task, category)
          },
        }, '✎')
      )
      wrap.appendChild(row)

      if (expanded) {
        var steps = h('div', { class: 'wl-steps' })
        if (task.note !== '') {
          steps.appendChild(h('div', { class: 'wl-hint', style: { padding: '2px 0 4px' }, text: task.note }))
        }
        if (task.steps.length === 0) {
          steps.appendChild(h('div', { class: 'wl-hint', text: isClone ? '这条工作在预警分类里只是副本，去原分类加步骤。' : '还没有拆分步骤：点右侧 ✎ 可以手动写，也可以让 DSH 拆。' }))
        }
        task.steps.forEach(function (step) {
          steps.appendChild(h('div', { class: 'wl-step' + (step.done ? ' is-done' : '') },
            h('button', {
              class: 'wl-check' + (step.done ? ' is-on' : ''),
              style: { width: '14px', height: '14px' },
              onclick: function () {
                request('PATCH', '/tasks/' + encodeURIComponent(realId) + '/steps/' + encodeURIComponent(step.id), { done: !step.done })
                  .then(function () { return refresh() })
                  .catch(function (error) { notifyError(error) })
              },
            }, step.done ? '✓' : ''),
            h('span', { class: 'wl-step-name', text: step.title }),
            h('span', { class: 'wl-chip', text: 'w' + step.weight })
          ))
        })
        wrap.appendChild(steps)
      }
      return wrap
    }

    /* ---------------- 右键菜单 / 确认框 ---------------- */

    var menu = null
    var detachMenu = function () {
      doc.removeEventListener('click', closeMenu, true)
      doc.removeEventListener('contextmenu', closeMenu, true)
      doc.removeEventListener('keydown', menuKey, true)
    }
    var closeMenu = function (event) {
      if (menu === null) return
      // 捕获阶段的全局监听也会收到「菜单自己的」点击；那一下交给菜单项自己处理。
      if (event && event.target && menu.contains(event.target)) return
      if (menu.parentNode !== null) menu.parentNode.removeChild(menu)
      menu = null
      detachMenu()
    }
    var menuKey = function (event) {
      if (event.key === 'Escape') closeMenu()
    }

    var openMenu = function (event, items) {
      closeMenu()
      var box = h('div', { class: 'wl-menu' })
      items.forEach(function (item) {
        if (item === '-') {
          box.appendChild(h('div', { class: 'wl-menu-sep' }))
          return
        }
        box.appendChild(h('button', {
          class: 'wl-menu-item' + (item.danger ? ' is-danger' : ''),
          disabled: item.disabled === true ? true : undefined,
          onclick: function (ev) {
            ev.stopPropagation()
            closeMenu()
            if (item.disabled === true) return
            item.run()
          },
        }, item.label))
      })
      // 先挂上去量一下尺寸，再摆位置，免得贴边溢出。
      box.style.left = '-9999px'
      box.style.top = '0px'
      doc.body.appendChild(box)
      var rect = box.getBoundingClientRect()
      var x = Math.max(4, Math.min(event.clientX, window.innerWidth - rect.width - 8))
      var y = Math.max(4, Math.min(event.clientY, window.innerHeight - rect.height - 8))
      box.style.left = x + 'px'
      box.style.top = y + 'px'
      menu = box
      // 捕获阶段挂监听：点别处、再右键、按 Esc 都关掉。
      setTimeout(function () {
        doc.addEventListener('click', closeMenu, true)
        doc.addEventListener('contextmenu', closeMenu, true)
        doc.addEventListener('keydown', menuKey, true)
      }, 0)
    }

    var openConfirm = function (options) {
      var config = options || {}
      var ok = h('button', {
        class: 'wl-btn is-danger',
        onclick: function () {
          closeModal()
          if (typeof config.onOk === 'function') config.onOk()
        },
      }, config.okLabel || '删除')
      openMask(h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: config.title || '确认' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', title: '关闭', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          // 二次确认里带路径和换行，pre-line 才不会被压成一行
          h('div', { class: 'wl-hint', style: { whiteSpace: 'pre-line', wordBreak: 'break-all' }, text: config.message || '' })
        ),
        h('div', { class: 'wl-win-foot' },
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          ok
        )
      ))
      ok.focus()
    }

    /* ---------------- 右键菜单内容 ---------------- */

    var setPinned = function (collection, id, pinned) {
      return request('PATCH', '/' + collection + '/' + encodeURIComponent(id), { pinned: pinned })
        .then(function () { return refresh() })
        .catch(function (error) { notifyError(error) })
    }

    var toggleDone = function (realId, task, nextDone) {
      var patch = { done: nextDone }
      if (task.steps.length > 0) {
        patch.steps = task.steps.map(function (step) {
          return { id: step.id, title: step.title, weight: step.weight, done: nextDone }
        })
      }
      request('PATCH', '/tasks/' + encodeURIComponent(realId), patch)
        .then(function () { return refresh() })
        .catch(function (error) { notifyError(error) })
    }

    var deleteTask = function (task) {
      openConfirm({
        title: '删除工作',
        message: '「' + task.title + '」会从清单里删掉，连带它的步骤。',
        onOk: function () {
          request('DELETE', '/tasks/' + encodeURIComponent(task.id))
            .then(function () { return refresh() })
            .catch(function (error) { notifyError(error) })
        },
      })
    }

    var deleteCategory = function (category) {
      openConfirm({
        title: '删除分类',
        message: '「' + category.title + '」和它下面的 ' + category.taskCount + ' 条工作会一起删掉。',
        onOk: function () {
          request('DELETE', '/categories/' + encodeURIComponent(category.id))
            .then(function () { return refresh() })
            .catch(function (error) { notifyError(error) })
        },
      })
    }

    /*
     * 删除项目：默认只删清单里的条目。
     * 勾上「同时删除磁盘上的项目文件夹」会再弹一次确认（重复确认），
     * 第二次点下去才真的动磁盘 —— 这个操作不进回收站。
     */
    var deleteProject = function (project) {
      var hasPath = typeof project.path === 'string' && project.path !== ''
      var withFiles = false

      var run = function (purge) {
        request('DELETE', '/projects/' + encodeURIComponent(project.id) + (purge ? '?files=1' : ''))
          .then(function (payload) {
            if (view.selectedProjectId === project.id) view.selectedProjectId = null
            var note = ''
            if (purge && payload && payload.skipped) note = '没有删文件夹：' + payload.skipped
            else if (purge && payload && payload.purgeError) note = '文件夹没删干净：' + payload.purgeError
            else if (purge && payload && payload.purged) note = '项目已删除，文件夹也删了：' + payload.purged
            return refresh().then(function () {
              if (note !== '') notifyError(note)
            })
          })
          .catch(function (error) { notifyError(error) })
      }

      var askAgain = function () {
        openConfirm({
          title: '再确认一次：这会删掉磁盘上的文件',
          message: '整个文件夹会被永久删除，不进回收站，也无法撤销：\n\n' + project.path,
          okLabel: '永久删除',
          onOk: function () { run(true) },
        })
      }

      var warn = h('div', {
        class: 'wl-hint',
        style: { color: 'var(--wl-danger)', marginTop: '8px', display: 'none' },
        text: project.path,
      })
      var toggle = hasPath ? h('label', { class: 'wl-check-row' },
        h('input', {
          type: 'checkbox',
          onchange: function () {
            withFiles = this.checked === true
            warn.style.display = withFiles ? '' : 'none'
          },
        }),
        h('span', { text: '同时删除磁盘上的项目文件夹' })
      ) : null

      var ok = h('button', {
        class: 'wl-btn is-danger',
        onclick: function () {
          closeModal()
          if (withFiles) { askAgain(); return }
          run(false)
        },
      }, '删除项目')
      openMask(h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: '删除项目' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', title: '关闭', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          h('div', { class: 'wl-hint', text: '「' + project.title + '」和它下面的分类、工作会一起删掉。' }),
          toggle,
          warn
        ),
        h('div', { class: 'wl-win-foot' },
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          ok
        )
      ))
      ok.focus()
    }

    var openProjectMenu = function (event, project) {
      var items = [
        { label: project.pinned ? '取消置顶' : '置顶项目', run: function () { setPinned('projects', project.id, !project.pinned) } },
        '-',
        { label: '新建分类…', run: function () { openCategoryModal(project) } },
        { label: '项目设置…', run: function () { openProjectModal(project) } },
      ]
      if (project.path !== '') {
        items.push('-')
        items.push({
          label: '打开文件夹',
          run: function () {
            request('POST', '/projects/' + encodeURIComponent(project.id) + '/open')
              .catch(function (error) { notifyError(error) })
          },
        })
      }
      items.push('-')
      items.push({
        label: project.archived === true ? '取消归档' : '归档项目',
        run: function () { setArchived('projects', project.id, project.archived !== true) },
      })
      items.push('-')
      items.push({ label: '删除项目…', danger: true, run: function () { deleteProject(project) } })
      openMenu(event, items)
    }

    var openCategoryMenu = function (event, project, category) {
      var open = view.expanded[category.id] !== false
      if (category.kind === 'ddl') {
        openMenu(event, [
          { label: open ? '折叠' : '展开', run: function () { view.expanded[category.id] = !open; render() } },
          '-',
          { label: '默认预警时间…', run: function () { openWarnModal(project) } },
        ])
        return
      }
      openMenu(event, [
        { label: category.pinned ? '取消置顶' : '置顶分类', run: function () { setPinned('categories', category.id, !category.pinned) } },
        '-',
        { label: '新建工作…', run: function () { openTaskModal(null, category) } },
        { label: '重命名分类…', run: function () { openCategoryModal(project, category) } },
        project.path === '' ? null : {
          label: '打开分类文件夹',
          run: function () {
            request('POST', '/categories/' + encodeURIComponent(category.id) + '/open')
              .catch(function (error) { notifyError(error) })
          },
        },
        '-',
        {
          label: category.archived === true ? '取消归档' : '归档分类',
          run: function () { setArchived('categories', category.id, category.archived !== true) },
        },
        { label: '删除分类…', danger: true, run: function () { deleteCategory(category) } },
      ].filter(function (item) { return item !== null }))
    }

    var openTaskMenu = function (event, category, task) {
      var realId = task.cloneOf || task.id
      var real = view.data === null ? null : (view.data.tasks || []).filter(function (item) { return item.id === realId })[0]
      var home = category
      if (real !== null && view.data !== null) {
        var found = (view.data.categories || []).filter(function (item) { return item.id === real.categoryId })[0]
        if (found !== undefined) home = found
      }
      var done = task.progress >= 1
      openMenu(event, [
        { label: task.pinned ? '取消置顶' : '置顶工作', run: function () { setPinned('tasks', realId, !task.pinned) } },
        { label: done ? '标记为未完成' : '标记为完成', run: function () { toggleDone(realId, task, !done) } },
        '-',
        { label: '编辑…', disabled: real === null, run: function () { if (real !== null) openTaskModal(real, home) } },
        '-',
        {
          label: task.archived === true ? '取消归档' : '归档工作',
          run: function () { setArchived('tasks', realId, task.archived !== true) },
        },
        '-',
        { label: '删除工作…', danger: true, run: function () { deleteTask(real === null ? task : real) } },
      ])
    }

    /* ---------------- 二级窗口（新建/编辑工作） ---------------- */

    var closeModal = function () {
      if (mask !== null && mask.parentNode !== null) mask.parentNode.removeChild(mask)
      mask = null
    }

    var openMask = function (win) {
      closeModal()
      mask = h('div', { class: 'wl-mask', onclick: function (event) {
        if (event.target === mask) closeModal()
      } }, win)
      root.appendChild(mask)
      return win
    }

    /* ---------------- 选择文件夹（含新建） ---------------- */

    var openPicker = function (options) {
      var config = options || {}
      var suggested = typeof config.suggestedName === 'string' ? config.suggestedName.trim() : ''
      var onPick = typeof config.onPick === 'function' ? config.onPick : function () {}
      var current = { path: '', parent: null, entries: [], roots: [], home: '' }
      var closed = false

      var crumb = h('div', { class: 'wl-hint', style: { wordBreak: 'break-all', userSelect: 'text' }, text: '读取中…' })
      var list = h('div', { class: 'wl-dir-list' })
      var rootsBox = h('div', { class: 'wl-chips' })
      var nameInput = h('input', { class: 'wl-input', placeholder: '新文件夹名', value: suggested })
      var hint = h('div', { class: 'wl-hint', text: '' })

      var close = function () {
        if (closed) return
        closed = true
        pickerOpen = false
        doc.removeEventListener('keydown', onKey, true)
        if (overlay.parentNode !== null) overlay.parentNode.removeChild(overlay)
      }

      var onKey = function (event) {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        close()
      }

      var load = function (target) {
        hint.className = 'wl-hint'
        hint.textContent = '读取中…'
        list.textContent = ''
        var suffix = typeof target === 'string' && target !== '' ? '?path=' + encodeURIComponent(target) : ''
        return request('GET', '/fs/list' + suffix).then(function (payload) {
          if (closed) return
          current = payload.listing
          crumb.textContent = current.path
          list.textContent = ''
          rootsBox.textContent = ''
          if (current.parent !== null) {
            list.appendChild(h('button', {
              class: 'wl-dir',
              onclick: function () { load(current.parent) },
            }, h('span', { text: '⬆' }), h('span', { class: 'wl-dir-name', text: '上一级' })))
          }
          current.entries.forEach(function (entry) {
            list.appendChild(h('button', {
              class: 'wl-dir',
              title: entry.path,
              onclick: function () { load(entry.path) },
            }, h('span', { text: '📁' }), h('span', { class: 'wl-dir-name', text: entry.name })))
          })
          if (current.entries.length === 0) {
            list.appendChild(h('div', { class: 'wl-hint', style: { padding: '10px' }, text: '这个文件夹里没有子文件夹。' }))
          }
          if (current.home !== current.path) {
            rootsBox.appendChild(h('button', { class: 'wl-btn is-ghost', onclick: function () { load(current.home) } }, '主目录'))
          }
          current.roots.forEach(function (root) {
            if (root === current.path) return
            rootsBox.appendChild(h('button', { class: 'wl-btn is-ghost', title: root, onclick: function () { load(root) } }, root.replace(/\\$/, '')))
          })
          hint.textContent = current.entries.length + ' 个子文件夹'
        }).catch(function (error) {
          if (closed) return
          hint.className = 'wl-hint is-error'
          hint.textContent = String(error && error.message ? error.message : error)
        })
      }

      var create = function () {
        var name = nameInput.value.trim()
        if (name === '') {
          hint.className = 'wl-hint is-error'
          hint.textContent = '先写个文件夹名。'
          nameInput.focus()
          return
        }
        hint.className = 'wl-hint'
        hint.textContent = '正在新建…'
        request('POST', '/fs/mkdir', { parent: current.path, name: name }).then(function (payload) {
          if (closed) return
          nameInput.value = ''
          return load(payload.path)
        }).catch(function (error) {
          if (closed) return
          hint.className = 'wl-hint is-error'
          hint.textContent = String(error && error.message ? error.message : error)
        })
      }

      var overlay = h('div', { class: 'wl-mask is-top', onclick: function (event) {
        if (event.target === overlay) close()
      } }, h('div', { class: 'wl-win', style: { width: 'min(520px,100%)' } },
        h('div', { class: 'wl-win-head' },
          h('span', { text: '选择文件夹' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', onclick: close }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          crumb,
          rootsBox,
          list,
          h('div', { class: 'wl-row' }, nameInput,
            h('button', { class: 'wl-btn', onclick: create }, '＋ 新建文件夹')),
          hint
        ),
        h('div', { class: 'wl-win-foot' },
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: close }, '取消'),
          h('button', { class: 'wl-btn is-primary', onclick: function () {
            onPick(current.path)
            close()
          } }, '选择这个文件夹')
        )
      ))

      pickerOpen = true
      root.appendChild(overlay)
      doc.addEventListener('keydown', onKey, true)
      load(typeof config.startPath === 'string' ? config.startPath.trim() : '')
      nameInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          create()
        }
      })
    }

    var openTaskModal = function (task, category) {
      var isEdit = task !== null && task !== undefined
      var projects = view.data === null ? [] : view.data.projects
      var steps = isEdit ? task.steps.map(function (s) { return { id: s.id, title: s.title, weight: s.weight, done: s.done } }) : []
      var categoryId = isEdit ? task.categoryId : category.id

      var titleInput = h('input', { class: 'wl-input', placeholder: '要做的这件事，一句话说清', value: isEdit ? task.title : '' })
      var weightInput = h('input', { class: 'wl-input', type: 'number', min: '0.5', step: '0.5', value: isEdit ? String(task.weight) : '1' })
      var dueInput = h('input', { class: 'wl-input', type: 'date', value: isEdit ? dateInputValue(task.dueAt) : '' })
      var noteInput = h('textarea', { class: 'wl-textarea', placeholder: '备注（可选）' })
      noteInput.value = isEdit ? task.note : ''

      /* 预警时长：默认跟项目走，也可以只给这条工作另设一个。 */
      var projectOfCategory = function (id) {
        var list = view.data === null ? [] : view.data.projects
        for (var i = 0; i < list.length; i += 1) {
          if (list[i].categories.some(function (item) { return item.id === id })) return list[i]
        }
        return null
      }
      var projectDefaultHours = function (id) {
        var owner = projectOfCategory(id)
        var hours = owner === null ? null : Number(owner.warnHours)
        return isFinite(hours) && hours > 0 ? hours : 24
      }
      var categorySelect = h('select', { class: 'wl-select' })
      var warnMode = isEdit && task.warnOwn ? 'custom' : 'inherit'
      var warnInput = h('input', {
        class: 'wl-input',
        type: 'number',
        min: '1',
        max: '720',
        step: '1',
        style: { maxWidth: '96px' },
        value: String(isEdit && task.warnOwn ? task.warnHours : projectDefaultHours(categoryId)),
      })
      var inheritChip = h('button', { class: 'wl-btn', type: 'button' }, '')
      var customChip = h('button', { class: 'wl-btn', type: 'button' }, '单独设置')
      var warnHint = h('div', { class: 'wl-hint', text: '' })
      var syncWarn = function () {
        var custom = warnMode === 'custom'
        inheritChip.className = 'wl-btn' + (custom ? '' : ' is-primary')
        customChip.className = 'wl-btn' + (custom ? ' is-primary' : '')
        inheritChip.textContent = '跟随项目 · ' + hoursLabel(projectDefaultHours(categorySelect.value))
        warnInput.disabled = !custom
        warnHint.className = 'wl-hint'
        warnHint.textContent = custom
          ? '这项工作按自己设的提前量进「DDL预警」；填 0 或留空则回到跟随项目。'
          : '和项目默认一致：提前 ' + hoursLabel(projectDefaultHours(categorySelect.value)) + ' 开始预警。'
      }
      inheritChip.addEventListener('click', function () { warnMode = 'inherit'; syncWarn() })
      customChip.addEventListener('click', function () { warnMode = 'custom'; syncWarn() })
      categorySelect.addEventListener('change', syncWarn)

      projects.forEach(function (project) {
        var group = document.createElement('optgroup')
        group.label = project.title
        project.categories.forEach(function (item) {
          if (item.kind === 'ddl') return // 预警分类只放克隆，不能往里塞真工作
          var option = document.createElement('option')
          option.value = item.id
          option.textContent = item.title
          if (item.id === categoryId) option.selected = true
          group.appendChild(option)
        })
        categorySelect.appendChild(group)
      })
      if (categorySelect.children.length === 0) {
        var only = document.createElement('option')
        only.value = categoryId
        only.textContent = category.title
        only.selected = true
        categorySelect.appendChild(only)
      }

      var stepsBox = h('div', { class: 'wl-steps-editor' })
      var splitHint = h('div', { class: 'wl-hint', text: '' })

      var renderSteps = function () {
        stepsBox.textContent = ''
        if (steps.length === 0) {
          stepsBox.appendChild(h('div', { class: 'wl-hint', text: '可以不拆步骤；只有权重时按"做完/没做完"算进度。' }))
        }
        steps.forEach(function (step, index) {
          var nameInput = h('input', { class: 'wl-input', value: step.title, placeholder: '步骤名' })
          nameInput.addEventListener('input', function () { step.title = nameInput.value })
          var weightField = h('input', { class: 'wl-input wl-num', type: 'number', min: '0.5', step: '0.5', value: String(step.weight) })
          weightField.addEventListener('input', function () {
            var n = Number(weightField.value)
            step.weight = Number.isFinite(n) && n > 0 ? n : 1
          })
          stepsBox.appendChild(h('div', { class: 'wl-step-row' },
            h('span', { class: 'wl-hint', text: String(index + 1) }),
            nameInput,
            weightField,
            h('button', {
              class: 'wl-icon',
              title: '删掉这一步',
              onclick: function () {
                steps.splice(index, 1)
                renderSteps()
              },
            }, '×')
          ))
        })
        stepsBox.appendChild(h('button', {
          class: 'wl-btn is-ghost',
          style: { alignSelf: 'flex-start' },
          onclick: function () {
            steps.push({ title: '', weight: 1, done: false })
            renderSteps()
          },
        }, '＋ 加一步'))
      }
      renderSteps()

      var splitButton = h('button', {
        class: 'wl-btn',
        onclick: function () {
          var payload = {
            title: titleInput.value.trim(),
            note: noteInput.value.trim(),
            categoryTitle: categorySelect.selectedOptions[0] !== undefined ? categorySelect.selectedOptions[0].textContent : '',
            projectTitle: '',
            steps: steps.filter(function (s) { return s.title.trim() !== '' }).map(function (s) { return { title: s.title, weight: s.weight } }),
          }
          if (payload.title === '') {
            splitHint.className = 'wl-hint is-error'
            splitHint.textContent = '先给这项工作起个名字。'
            return
          }
          if (!view.aiAvailable) {
            splitHint.className = 'wl-hint is-error'
            splitHint.textContent = '独立窗口里没有模型：把清单在 DSH 面板里打开，这个按钮才会工作。'
            return
          }
          splitButton.disabled = true
          splitButton.textContent = '拆分中…'
          splitHint.className = 'wl-hint'
          splitHint.textContent = '已交给 DSH 的子代理，正在读这项工作…'
          request('POST', '/ai-split', payload).then(function (payloadResult) {
            var returned = Array.isArray(payloadResult.steps) ? payloadResult.steps : []
            steps = returned.map(function (item) {
              return { title: String(item.title || ''), weight: Number(item.weight) || 1, done: false }
            })
            renderSteps()
            splitHint.className = 'wl-hint'
            splitHint.textContent = '拆出 ' + steps.length + ' 步（权重可以自己再调）。'
          }).catch(function (error) {
            splitHint.className = 'wl-hint is-error'
            splitHint.textContent = String(error && error.message ? error.message : error)
          }).then(function () {
            splitButton.disabled = false
            splitButton.textContent = '✦ 让 DSH 拆分'
          })
        },
      }, '✦ 让 DSH 拆分')

      var save = function () {
        var title = titleInput.value.trim()
        if (title === '') {
          splitHint.className = 'wl-hint is-error'
          splitHint.textContent = '工作名不能为空。'
          titleInput.focus()
          return
        }
        var weight = Number(weightInput.value)
        var body = {
          categoryId: categorySelect.value,
          title: title,
          weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
          dueAt: parseDateInput(dueInput.value),
          note: noteInput.value.trim(),
          warnHours: warnMode === 'custom' ? (Number(warnInput.value) > 0 ? Number(warnInput.value) : null) : null,
          steps: steps
            .filter(function (step) { return step.title.trim() !== '' })
            .map(function (step) { return { id: step.id, title: step.title.trim(), weight: step.weight, done: step.done === true } }),
        }
        var promise
        if (isEdit) {
          body.done = task.done
          promise = request('PATCH', '/tasks/' + encodeURIComponent(task.id), body)
        } else {
          promise = request('POST', '/tasks', body)
        }
        promise.then(function () {
          closeModal()
          return refresh()
        }).catch(function (error) { notifyError(error) })
      }

      var removeButton = null
      if (isEdit) {
        var armed = false
        removeButton = h('button', { class: 'wl-btn is-danger', onclick: function () {
          if (!armed) {
            armed = true
            removeButton.textContent = '再点一次删除'
            setTimeout(function () {
              armed = false
              removeButton.textContent = '删除'
            }, 3000)
            return
          }
          request('DELETE', '/tasks/' + encodeURIComponent(task.id))
            .then(function () { closeModal(); return refresh() })
            .catch(function (error) { notifyError(error) })
        } }, '删除')
      }

      var win = h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: isEdit ? '编辑工作' : '新建工作' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', title: '关闭', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '工作名' }),
            titleInput
          ),
          h('div', { class: 'wl-row' },
            h('div', { class: 'wl-field', style: { flex: '2 1 0' } },
              h('span', { class: 'wl-label', text: '归属分类' }),
              categorySelect
            ),
            h('div', { class: 'wl-field', style: { flex: '0 0 84px' } },
              h('span', { class: 'wl-label', text: '权重' }),
              weightInput
            ),
            h('div', { class: 'wl-field', style: { flex: '0 0 140px' } },
              h('span', { class: 'wl-label', text: 'DDL' }),
              dueInput
            )
          ),
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '预警' }),
            h('div', { class: 'wl-row', style: { alignItems: 'center' } },
              h('div', { class: 'wl-chips', style: { margin: '0' } }, inheritChip, customChip),
              warnInput
            ),
            warnHint
          ),
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '备注' }),
            noteInput
          ),
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '步骤（按权重算这项工作的进度）' }),
            stepsBox
          ),
          h('div', { class: 'wl-split-bar' },
            splitButton,
            splitHint
          )
        ),
        h('div', { class: 'wl-win-foot' },
          removeButton,
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          h('button', { class: 'wl-btn is-primary', onclick: save }, isEdit ? '保存' : '创建')
        )
      )
      openMask(win)
      syncWarn()
      titleInput.focus()
    }

    /* ---------------- 项目 / 分类 ---------------- */

    var openProjectModal = function (project) {
      var isEdit = project !== null && project !== undefined
      var titleInput = h('input', { class: 'wl-input', value: isEdit ? project.title : '', placeholder: '比如：DSH 插件开发' })
      var pathInput = h('input', { class: 'wl-input', value: isEdit ? project.path : '', placeholder: 'C:\\Users\\MX\\Documents\\某个文件夹' })
      var noteInput = h('textarea', { class: 'wl-textarea' })
      noteInput.value = isEdit ? project.note : ''
      var hint = h('div', { class: 'wl-hint', text: '' })

      var save = function () {
        var title = titleInput.value.trim()
        if (title === '') {
          hint.className = 'wl-hint is-error'
          hint.textContent = '项目名不能为空。'
          return
        }
        var body = { title: title, path: pathInput.value.trim(), note: noteInput.value.trim() }
        var promise = isEdit
          ? request('PATCH', '/projects/' + encodeURIComponent(project.id), body)
          : request('POST', '/projects', body)
        promise.then(function (payload) {
          if (!isEdit && payload.project) view.selectedProjectId = payload.project.id
          closeModal()
          return refresh()
        }).catch(function (error) { notifyError(error) })
      }

      var removeButton = null
      if (isEdit) {
        var armed = false
        removeButton = h('button', { class: 'wl-btn is-danger', onclick: function () {
          if (!armed) {
            armed = true
            removeButton.textContent = '会连分类和工作一起删掉，再点一次'
            setTimeout(function () { armed = false; removeButton.textContent = '删除项目' }, 4000)
            return
          }
          request('DELETE', '/projects/' + encodeURIComponent(project.id))
            .then(function () { closeModal(); return refresh() })
            .catch(function (error) { notifyError(error) })
        } }, '删除项目')
      }

      // 「浏览…」：两边都弹系统对话框 —— DSH 里走 uiWorkspace.pickDirectory()，
      // 独立窗口没有那个服务，改让本地服务端起一个 PowerShell 的 FolderBrowserDialog。
      // 只有这条也失败时，才退回自带的目录浏览器。
      var openInAppPicker = function () {
        openPicker({
          startPath: pathInput.value.trim(),
          suggestedName: titleInput.value.trim(),
          onPick: function (picked) { pathInput.value = picked },
        })
      }

      var browseButton = h('button', { class: 'wl-btn', onclick: function () {
        if (pickDirectory === null) {
          hint.className = 'wl-hint'
          hint.textContent = '正在打开系统对话框…'
          request('POST', '/fs/pick', {}).then(function (payload) {
            hint.textContent = ''
            if (typeof payload.path === 'string' && payload.path.length > 0) pathInput.value = payload.path
          }).catch(function (error) {
            hint.className = 'wl-hint is-error'
            hint.textContent = '系统对话框打不开（' + (error && error.message ? error.message : String(error)) + '），改用自带浏览器'
            openInAppPicker()
          })
          return
        }
        var pending
        try {
          pending = pickDirectory()
        } catch (error) {
          pending = Promise.reject(error)
        }
        Promise.resolve(pending).then(function (picked) {
          if (typeof picked !== 'string' || picked.length === 0) return
          pathInput.value = picked
        }).catch(function (error) {
          hint.className = 'wl-hint is-error'
          hint.textContent = '系统对话框打不开：' + (error && error.message ? error.message : String(error))
        })
      } }, '浏览…')

      openMask(h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: isEdit ? '项目设置' : '新建项目' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          h('div', { class: 'wl-field' }, h('span', { class: 'wl-label', text: '项目名' }), titleInput),
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '文件夹（可选，方便一键打开）' }),
            h('div', { class: 'wl-row' },
              pathInput,
              browseButton
            )
          ),
          h('div', { class: 'wl-field' }, h('span', { class: 'wl-label', text: '备注' }), noteInput),
          hint
        ),
        h('div', { class: 'wl-win-foot' },
          removeButton,
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          h('button', { class: 'wl-btn is-primary', onclick: save }, isEdit ? '保存' : '创建')
        )
      ))
      titleInput.focus()
    }

    var openCategoryModal = function (project, category) {
      var isEdit = category !== null && category !== undefined
      var titleInput = h('input', { class: 'wl-input', value: isEdit ? category.title : '', placeholder: '比如：功能开发 / 调研 / 杂事' })
      var hint = h('div', { class: 'wl-hint', text: '' })

      var save = function () {
        var title = titleInput.value.trim()
        if (title === '') {
          hint.className = 'wl-hint is-error'
          hint.textContent = '分类名不能为空。'
          return
        }
        var promise = isEdit
          ? request('PATCH', '/categories/' + encodeURIComponent(category.id), { title: title })
          : request('POST', '/categories', { projectId: project.id, title: title })
        promise.then(function () { closeModal(); return refresh() }).catch(function (error) { notifyError(error) })
      }

      var removeButton = null
      if (isEdit) {
        var armed = false
        removeButton = h('button', { class: 'wl-btn is-danger', onclick: function () {
          if (!armed) {
            armed = true
            removeButton.textContent = '会连工作一起删掉，再点一次'
            setTimeout(function () { armed = false; removeButton.textContent = '删除分类' }, 4000)
            return
          }
          request('DELETE', '/categories/' + encodeURIComponent(category.id))
            .then(function () { closeModal(); return refresh() })
            .catch(function (error) { notifyError(error) })
        } }, '删除分类')
      }

      openMask(h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: isEdit ? '重命名分类' : '新建分类' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          h('div', { class: 'wl-field' }, h('span', { class: 'wl-label', text: '分类名' }), titleInput),
          hint
        ),
        h('div', { class: 'wl-win-foot' },
          removeButton,
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          h('button', { class: 'wl-btn is-primary', onclick: save }, isEdit ? '保存' : '创建')
        )
      ))
      titleInput.focus()
    }

    /* ---------------- 二级窗口（DDL 预警时间） ---------------- */

    var openWarnModal = function (project) {
      var current = Number(project.warnHours)
      if (!isFinite(current) || current <= 0) current = 24
      var input = h('input', { class: 'wl-input', type: 'number', min: '1', max: '720', step: '1', value: String(current) })
      var hint = h('div', { class: 'wl-hint', text: '项目默认提前多少小时预警。每条工作可以在编辑窗口里单独设一个；没单独设的就跟这里走。' })
      var presets = [1, 6, 12, 24, 48, 72, 168]
      var chips = h('div', { class: 'wl-chips' }, presets.map(function (hours) {
        return h('button', {
          class: 'wl-btn',
          type: 'button',
          onclick: function () { input.value = String(hours) },
        }, hoursLabel(hours))
      }))

      var save = function () {
        var hours = Math.round(Number(input.value))
        if (!isFinite(hours) || hours < 1) {
          hint.className = 'wl-hint is-error'
          hint.textContent = '最少 1 小时。'
          return
        }
        request('PATCH', '/projects/' + encodeURIComponent(project.id), { warnHours: hours })
          .then(function () { closeModal(); return refresh() })
          .catch(function (error) { notifyError(error) })
      }

      openMask(h('div', { class: 'wl-win' },
        h('div', { class: 'wl-win-head' },
          h('span', { text: '项目默认预警时间' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', onclick: closeModal }, '×')
        ),
        h('div', { class: 'wl-win-body' },
          h('div', { class: 'wl-field' },
            h('span', { class: 'wl-label', text: '提前量（小时）' }),
            input
          ),
          chips,
          hint,
          h('div', { class: 'wl-hint', text: '当前：' + hoursLabel(current) + '，作为这个项目里没单独设置的工作的默认值。' })
        ),
        h('div', { class: 'wl-win-foot' },
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn', onclick: closeModal }, '取消'),
          h('button', { class: 'wl-btn is-primary', onclick: save }, '保存')
        )
      ))
      input.focus()
      input.select()
    }

    var onKey = function (event) {
      if (event.key === 'Escape' && mask !== null) closeModal()
    }
    doc.addEventListener('keydown', onKey)

    render()
    loadMeta()
    refresh()
    pollTimer = setInterval(poll, 2000)
    doc.addEventListener('visibilitychange', poll)

    return {
      refresh: refresh,
      unmount: function () {
        mounted = false
        if (pollTimer !== null) clearInterval(pollTimer)
        pollTimer = null
        doc.removeEventListener('visibilitychange', poll)
        doc.removeEventListener('keydown', onKey)
        closeModal()
        root.textContent = ''
      },
    }
  }

  window.__WorklistUI__ = { mount: mount }
})()
    /* ---------------------------------------------------------------- 图标 */

    function WorklistIcon(props) {
      const size = Number(props?.size) || 20
      const active = props?.active === true
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: active ? 2.2 : 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { display: 'block', opacity: active ? 1 : 0.82 },
        },
        h('rect', { key: 'r', x: 3.2, y: 4.2, width: 17.6, height: 15.6, rx: 3.2 }),
        h('path', { key: 'a', d: 'M7.4 9.6l1.5 1.5 2.6-2.9' }),
        h('path', { key: 'b', d: 'M7.4 15.2l1.5 1.5 2.6-2.9' }),
        h('path', { key: 'c', d: 'M14.2 10.1h3.1' }),
        h('path', { key: 'd', d: 'M14.2 15.7h3.1' }),
      )
    }

    /* ---------------------------------------------------------------- 面板 */

    function WorklistPanel() {
      const ref = React.useRef(null)

      React.useEffect(() => {
        const host = ref.current
        if (host === null) return undefined
        // 原生选目录：DSH 的 uiWorkspace 背后是系统的文件夹对话框。
        // 取不到（独立窗口、或以后接口变了）就传 null，UI 只留自建浏览器。
        let pickDirectory = null
        try {
          const ws = CTX !== null && typeof CTX.get === 'function' ? CTX.get('uiWorkspace') : undefined
          if (ws !== undefined && ws !== null && typeof ws.pickDirectory === 'function') {
            pickDirectory = () => ws.pickDirectory()
          }
        } catch (error) {
          pickDirectory = null
        }
        const instance = window.__WorklistUI__.mount(host, { base: BASE, pickDirectory })
        return () => instance.unmount()
      }, [])

      return h('div', {
        ref: ref,
        style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' },
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        CTX = ctx
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: NS,
          order: 45,
          label: () => LABEL,
        }, WorklistIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: NS,
        }, WorklistPanel))
      },
    }
  },
})
