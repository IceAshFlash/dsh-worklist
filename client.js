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
    // 视图选项：带文字的药丸按钮。DSH 自带的是一枚纯图标按钮，但纯描边图标在
// 深浅两套主题下都容易糊成一条灰线，所以这里保留图标、补上「视图」两字和下拉箭头。
    '.wl-viewbtn{margin-left:auto;margin-right:6px;height:26px;flex:none;display:inline-flex;align-items:center;gap:5px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2,#d3d8df);background:var(--dsw-alias-bg-layer-2,#eef1f5);border-radius:13px;font:inherit;font-size:12px;font-weight:600;line-height:1;color:var(--dsw-alias-label-primary,#1c1f24);cursor:pointer}',
    '.wl-viewbtn:hover{background:var(--dsw-alias-bg-layer-1,#f6f8fa);border-color:var(--dsw-alias-border-l1,#e2e6eb)}',
    '.wl-viewbtn:active{background:var(--dsw-alias-bg-layer-2,#eef1f5)}',
    '.wl-viewbtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--wl-accent,#3f6be6));outline-offset:1px}',
    '.wl-viewbtn-text{letter-spacing:.2px}',
    '.wl-caret{font-size:9px;line-height:1;opacity:.7}',
    '.wl-ver{padding:0 12px 10px;font-size:10px;line-height:1;color:var(--dsw-alias-label-tertiary,#8b929c);user-select:text}',
    // 专注小窗：Document PiP 窗口里是一整页，独立窗口里是一块浮层
    '.wl-mini-doc{margin:0;overflow:hidden;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1c1f24);font-family:var(--dsw-font-family,-apple-system,"Segoe UI",system-ui,sans-serif);font-size:13px}',
    '.wl-icon.is-mini{flex:none}',
    '.wl-side-acts{display:flex;align-items:center;gap:2px;margin-left:auto;flex:none}',
    '.wl-icon.is-mini:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
    '.wl-mini{display:flex;flex-direction:column;height:100vh;width:100%;box-sizing:border-box;padding:6px 10px 10px;overflow:hidden}',
    '.wl-mini.is-single{height:100%;padding:8px 10px 10px}',
    // 256×256 很窄：分类名优先，项目名让位
    '.wl-mini.is-single .wl-mini-head{gap:6px;padding:2px 0 6px}',
    '.wl-mini.is-single .wl-mini-proj{display:none}',
    '.wl-mini.is-single .wl-mini-name{font-size:13px}',
    '.wl-mini-head{display:flex;align-items:center;gap:8px;padding:4px 0 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#e2e6eb);flex:none}',
    '.wl-mini-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-mini-titles{display:flex;flex-direction:column;min-width:0;gap:1px}',
    '.wl-mini-proj{font-size:11px;line-height:1.1;color:var(--dsw-alias-label-tertiary,#8b929c);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-mini-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6470);font-variant-numeric:tabular-nums}',
    '.wl-mini-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding-top:6px}',
    '.wl-mini-meta{display:flex;align-items:center;gap:8px;padding:6px 2px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#e2e6eb);flex:none}',
    '.wl-mini-task{margin-bottom:2px}',
    '.wl-mini-task.is-done .wl-mini-title{color:var(--dsw-alias-label-tertiary,#8b929c);text-decoration:line-through}',
    '.wl-mini-row{display:flex;align-items:center;gap:8px;padding:6px 4px;border-radius:6px}',
    '.wl-mini-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}',
    '.wl-mini-title{flex:1 1 auto;min-width:0;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-mini-pct{font-size:11px;color:var(--dsw-alias-label-secondary,#5b6470);font-variant-numeric:tabular-nums}',
    '.wl-mini-steps{padding:2px 0 6px 26px;display:flex;flex-direction:column;gap:2px}',
    '.wl-mini-step{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:5px;font-size:12px;color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-mini-step-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-mini-step.is-done .wl-mini-step-name{text-decoration:line-through;opacity:.65}',
    '.wl-mini-overlay{position:fixed;z-index:9999;left:calc(50% - 128px);top:72px;width:256px;height:256px;min-width:220px;min-height:180px;display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l2,#d3d8df);border-radius:10px;box-shadow:0 18px 48px rgba(15,23,42,.28);resize:both;overflow:hidden}',
    '.wl-mini-drag{display:flex;align-items:center;gap:7px;padding:0 6px 0 10px;height:30px;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6470);background:var(--dsw-alias-bg-layer-2,#eef1f5);border-bottom:1px solid var(--dsw-alias-border-l1,#e2e6eb);cursor:move;user-select:none;flex:none}',
    '.wl-mini-drag-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-mini-x{width:20px;height:20px;font-size:11px;cursor:pointer}',
    '.wl-mini-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:4px 8px 8px}',
    '.wl-mini-away{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:24px}',
    '.wl-mini-away-card{max-width:380px;padding:20px 22px;border:1px solid var(--dsw-alias-border-l2,#d3d8df);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#f6f8fa);display:flex;flex-direction:column;gap:10px}',
    '.wl-mini-away-title{font-size:14px;font-weight:600}',
    '.wl-menu-label{padding:6px 10px 2px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-menu-icon{width:16px;height:16px;flex:0 0 16px;display:inline-flex;align-items:center;justify-content:center;opacity:.9}',
    '.wl-menu-text{flex:1 1 auto;text-align:left}',
    '.wl-menu-check{margin-left:auto;flex:none;font-size:12px;color:var(--wl-accent,#3f6be6)}',
    '.wl-menu-item.is-checked{color:var(--dsw-alias-label-primary,#1c1f24);font-weight:600}',
    '.wl-chip.is-arch{background:rgba(120,130,145,.14);color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-task.is-archived,.wl-cat.is-archived,.wl-proj.is-archived{opacity:.55}',
    '.wl-proj{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:8px;padding:8px 10px;margin:2px 0;cursor:pointer;color:inherit;font:inherit}',
    '.wl-proj:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-proj.is-active{background:var(--dsw-alias-bg-layer-2,#eceff3);box-shadow:inset 2px 0 0 var(--wl-accent,#3f6be6)}',
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
    '.wl-side-head .wl-btn.is-ghost{color:var(--dsw-alias-label-primary,#1c1f24)}',
    '.wl-side-head .wl-btn.is-ghost:hover{color:var(--dsw-alias-label-primary,#1c1f24);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
    '.wl-menu{position:fixed;z-index:1000;min-width:176px;padding:4px;border-radius:9px;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l2,#d3d8df);box-shadow:0 10px 28px rgba(15,23,42,.18);color:var(--dsw-alias-label-primary,#1c1f24)}',
    '.wl-menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;padding:6px 10px;border-radius:6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#1c1f24);cursor:pointer;white-space:nowrap}',
    '.wl-menu-item:hover{background:var(--dsw-alias-bg-layer-2,#eef1f5)}',
    '.wl-menu-item.is-danger{color:var(--wl-danger,#e5484d)}',
    '.wl-menu-item[disabled]{color:var(--dsw-alias-label-tertiary,#8b929c);opacity:.55;cursor:default}',
    '.wl-dur{display:flex;align-items:center;gap:6px}',
    '.wl-durnum{width:64px;flex:0 0 64px;text-align:right}',
    '.wl-unit{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-imgs{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}',
    '.wl-img{position:relative;width:72px;height:54px;border-radius:6px;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,#d3d8df);background:var(--dsw-alias-bg-layer-2,#eef1f5)}',
    '.wl-img img{width:100%;height:100%;object-fit:cover;display:block}',
    '.wl-img-del{position:absolute;top:2px;right:2px;width:16px;height:16px;line-height:14px;text-align:center;border:0;border-radius:50%;background:rgba(15,23,42,.62);color:#fff;font-size:11px;cursor:pointer;padding:0}',
    '.wl-img-add{width:72px;height:54px;border-radius:6px;border:1px dashed var(--dsw-alias-border-l2,#c9ced6);background:transparent;color:var(--dsw-alias-label-secondary,#5b6470);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}',
    '.wl-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1,#e6e9ee)}',
    '.wl-pin{flex:0 0 auto;font-size:10px;line-height:1;color:var(--wl-accent,#3f6be6);opacity:.95}',
    '.wl-proj.is-pinned{box-shadow:inset 2px 0 0 var(--wl-accent,#3f6be6)}',
    '.wl-title{font-size:15px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c);white-space:nowrap}',
    '.wl-grow{flex:1 1 auto}',
    '.wl-scroll{flex:1 1 auto;overflow-y:auto;padding:14px 18px 32px;min-height:0}',
    '.wl-cat{border:1px solid var(--dsw-alias-border-l1,#e6e8eb);border-radius:10px;margin-bottom:10px;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}',
    '.wl-cat-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--dsw-alias-bg-layer-1,#fafbfc);cursor:pointer;user-select:none}',
    '.wl-cat-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-cat-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c);white-space:nowrap}',
    '.wl-cat-body{padding:4px 6px 8px}',
    '.wl-cat.is-ddl{border-color:rgba(229,72,77,.35);border-color:color-mix(in srgb,var(--wl-danger,#e5484d) 38%,transparent)}',
    '.wl-cat.is-ddl .wl-cat-head{background:rgba(229,72,77,.06);background:color-mix(in srgb,var(--wl-danger,#e5484d) 7%,transparent)}',
    '.wl-cat.is-ddl .wl-cat-name{color:var(--wl-danger,#e5484d)}',
    '.wl-cat.is-ddl .wl-cat-count{color:var(--wl-danger,#e5484d);opacity:.85}',
    '.wl-cat-hint{font-size:11px;color:var(--wl-danger,#e5484d);opacity:.8;white-space:nowrap}',
    '.wl-task.is-clone{cursor:default}',
    '.wl-task.is-clone .wl-task-title{color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-chip.is-warn{color:var(--wl-danger,#e5484d);border-color:rgba(229,72,77,.45);border-color:color-mix(in srgb,var(--wl-danger,#e5484d) 45%,transparent)}',
    '.wl-task{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px}',
    '.wl-task:hover{background:var(--dsw-alias-bg-layer-1,#f7f8fa)}',
    '.wl-check{width:16px;height:16px;flex:0 0 auto;border-radius:4px;border:1.5px solid var(--dsw-alias-border-l2,#c9ced6);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:#fff;font-size:11px;line-height:1}',
    '.wl-check.is-on{background:var(--wl-accent,#3f6be6);border-color:var(--wl-accent,#3f6be6)}',
    '.wl-task-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}',
    '.wl-task.is-done .wl-task-title{text-decoration:line-through;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-chip{flex:0 0 auto;font-size:11px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#e6e8eb);color:var(--dsw-alias-label-secondary,#5b6470);white-space:nowrap}',
    '.wl-chip.is-overdue{color:#fff;background:var(--dsw-alias-state-error-primary,#e5484d);border-color:transparent}',
    '.wl-chip.is-today{color:#fff;background:var(--dsw-alias-state-warn-primary,#e08a3c);border-color:transparent}',
    '.wl-chip.is-soon{color:var(--dsw-alias-state-warn-primary,#c8752f);border-color:var(--dsw-alias-state-warn-primary,#c8752f)}',
    '.wl-bar{position:relative;height:4px;border-radius:999px;background:var(--dsw-alias-border-l1,#e6e8eb);overflow:hidden;flex:0 0 64px;width:64px}',
    '.wl-bar>i{position:absolute;left:0;top:0;bottom:0;background:var(--wl-accent,#3f6be6);border-radius:999px}',
    '.wl-steps{margin:0 0 6px 26px;padding:2px 0 2px 10px;border-left:2px solid var(--dsw-alias-border-l1,#e6e8eb)}',
    '.wl-step{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:var(--dsw-alias-label-secondary,#5b6470)}',
    '.wl-step.is-done{color:var(--dsw-alias-label-tertiary,#8b929c);text-decoration:line-through}',
    '.wl-step-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wl-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d3d8df);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1c1f24);border-radius:7px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.wl-btn:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-btn:disabled{opacity:.55;cursor:default}',
    '.wl-btn.is-primary{background:var(--wl-accent,#3f6be6);border-color:transparent;color:#fff}',
    '.wl-btn.is-primary:hover{filter:brightness(.95)}',
    '.wl-btn.is-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary,#5b6470);padding:4px 6px}',
    '.wl-btn.is-ghost:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5)}',
    '.wl-btn.is-danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:var(--dsw-alias-state-error-primary,#e5484d)}',
    '.wl-icon{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#5b6470);cursor:pointer;font-size:13px;line-height:1}',
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
    '.wl-input:focus,.wl-select:focus,.wl-textarea:focus{border-color:var(--wl-accent,#3f6be6)}',
    '.wl-textarea{min-height:52px;resize:vertical}',
    '.wl-row{display:flex;gap:8px;align-items:flex-end}',
    '.wl-row>*{min-width:0}',
    '.wl-steps-editor{display:flex;flex-direction:column;gap:6px}',
    '.wl-step-row{display:flex;gap:6px;align-items:center}',
    '.wl-step-row .wl-input{flex:1 1 auto}',
    '.wl-step-row .wl-num{width:64px;flex:0 0 64px}',
    '.wl-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b929c)}',
    '.wl-hint.is-error{color:var(--dsw-alias-state-error-primary,#e5484d)}',
    '.wl-split-bar{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2,#d3d8df);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fafbfc)}',
    '.wl-split-bar .wl-textarea{min-height:54px}',
    '.wl-split-row{display:flex;align-items:center;gap:10px}',
    '.wl-spin{display:inline-block;width:11px;height:11px;border:2px solid var(--dsw-alias-border-l2,#c9ced6);border-top-color:var(--wl-accent,#3f6be6);border-radius:50%;animation:wl-spin .7s linear infinite}',
    '@keyframes wl-spin{to{transform:rotate(360deg)}}',
    '.wl-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',

    /* ---- 外观（自定义主题）：所有可调项都落在 CSS 变量上，切主题不重建节点 ---- */
    '.wl-root{--wl-radius:8px;--wl-side-w:232px;--wl-scale:1}',
    '.wl-root{font-family:var(--wl-font,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);font-size:calc(13px * var(--wl-scale,1))}',
    '.wl-side{width:var(--wl-side-w,232px);flex:0 0 var(--wl-side-w,232px)}',
    '.wl-btn,.wl-input,.wl-select,.wl-textarea,.wl-chip,.wl-proj,.wl-cat,.wl-task,.wl-mini{border-radius:var(--wl-radius,8px)}',
    '.wl-win{border-radius:calc(var(--wl-radius,8px) + 4px)}',
    '[data-wl-theme="light"]{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eef1f5;--dsw-alias-bg-overlay:#fff;--dsw-alias-border-l1:#e6e8eb;--dsw-alias-border-l2:#d3d8df;--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#5b6470;--dsw-alias-label-tertiary:#8b929c;--dsw-alias-interactive-bg-hover:#eef1f5;--dsw-alias-interactive-bg-pressed:#e3e7ee;--dsw-alias-specific-sidebar-fill:#f7f8fa;color-scheme:light}',
    '[data-wl-theme="dark"]{--dsw-alias-bg-base:#16181d;--dsw-alias-bg-layer-1:#1b1e24;--dsw-alias-bg-layer-2:#23272f;--dsw-alias-bg-overlay:#1e222a;--dsw-alias-border-l1:#2c313a;--dsw-alias-border-l2:#3a414c;--dsw-alias-label-primary:#e8eaee;--dsw-alias-label-secondary:#a7aeba;--dsw-alias-label-tertiary:#7b8391;--dsw-alias-interactive-bg-hover:#262b34;--dsw-alias-interactive-bg-pressed:#2f353f;--dsw-alias-specific-sidebar-fill:#1b1e24;color-scheme:dark}',
    '.wl-root.is-compact .wl-task,.wl-root.is-compact .wl-mini-row{padding-top:2px;padding-bottom:2px}',
    '.wl-root.is-compact .wl-cat-head,.wl-root.is-compact .wl-side-head{padding-top:5px;padding-bottom:5px}',
    '.wl-root.is-compact .wl-proj{padding-top:5px;padding-bottom:5px}',
    '.wl-root.is-flat .wl-dot{display:none}',
    '.wl-root.no-bar .wl-bar{display:none}',

    /* ---- 液态玻璃：半透明底色 + 背景模糊。灵感来自 dsh-plugin-wallpaper-engine 的
       做法（background 用 color-mix 调 alpha，backdrop-filter 负责糊），要点是
       「从元素到模糊源之间不能有不透明背景」，所以 root 和侧栏要一起放空。 ---- */
    '.wl-root.is-glass{--wl-glass-fill:color-mix(in srgb,var(--dsw-alias-bg-base) calc(var(--wl-glass-alpha,.22) * 100%),transparent);background:var(--wl-glass-fill);-webkit-backdrop-filter:blur(var(--wl-glass-blur,20px)) saturate(1.6) brightness(1.03);backdrop-filter:blur(var(--wl-glass-blur,20px)) saturate(1.6) brightness(1.03)}',
    '.wl-root.is-glass .wl-side{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) calc(var(--wl-glass-alpha,.22) * 70%),transparent);-webkit-backdrop-filter:blur(calc(var(--wl-glass-blur,20px) * .6));backdrop-filter:blur(calc(var(--wl-glass-blur,20px) * .6))}',
    '.wl-root.is-glass .wl-proj,.wl-root.is-glass .wl-cat,.wl-root.is-glass .wl-task{background:color-mix(in srgb,var(--dsw-alias-bg-overlay) calc(var(--wl-glass-alpha,.22) * 55%),transparent)}',
    '.wl-root.is-glass .wl-cat{border-color:color-mix(in srgb,var(--dsw-alias-border-l1) 70%,transparent)}',
    '.wl-root.is-glass .wl-task{border-color:color-mix(in srgb,var(--dsw-alias-border-l1) 55%,transparent)}',
    '.wl-root.is-glass .wl-mini,.wl-root.is-glass .wl-mini-overlay{background:var(--wl-glass-fill);-webkit-backdrop-filter:blur(var(--wl-glass-blur,20px)) saturate(1.7);backdrop-filter:blur(var(--wl-glass-blur,20px)) saturate(1.7);border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);box-shadow:0 18px 48px rgba(15,18,22,.28),inset 0 1px 0 rgba(255,255,255,.18)}',
    '.wl-root.is-glass .wl-win{background:color-mix(in srgb,var(--dsw-alias-bg-overlay) calc(var(--wl-glass-alpha,.22) * 130%),transparent);-webkit-backdrop-filter:blur(calc(var(--wl-glass-blur,20px) * 1.2));backdrop-filter:blur(calc(var(--wl-glass-blur,20px) * 1.2));border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 70%,transparent)}',
    '.wl-root.is-glass .wl-win-foot{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) calc(var(--wl-glass-alpha,.22) * 90%),transparent)}',
    '.wl-root.is-glass .wl-split-bar{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) calc(var(--wl-glass-alpha,.22) * 80%),transparent)}',
    // 模糊不可用（老内核 / 系统关了透明效果）时退回近不透明，别把字压在花背景上
    '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){.wl-root.is-glass .wl-mini,.wl-root.is-glass .wl-win{background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 92%,transparent)}}',

    /* ---- 外壳模式（Electron 亚克力窗口）：页面全透明，桌面就从窗口里透上来 ---- */
    '.wl-root.is-shell{background:color-mix(in srgb,var(--dsw-alias-bg-base) calc(var(--wl-glass-alpha,.35) * 100%),transparent)}',
    '.wl-root.is-shell .wl-side{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) calc(var(--wl-glass-alpha,.35) * 80%),transparent);-webkit-app-region:drag}',
    '.wl-root.is-shell .wl-side button,.wl-root.is-shell .wl-side input,.wl-root.is-shell .wl-side select{-webkit-app-region:no-drag}',
    '.wl-root.is-shell .wl-side-head{-webkit-app-region:drag}',
    '.wl-root.is-shell .wl-cat,.wl-root.is-shell .wl-task,.wl-root.is-shell .wl-proj{background:color-mix(in srgb,var(--dsw-alias-bg-overlay) calc(var(--wl-glass-alpha,.35) * 62%),transparent)}',
    '.wl-root.is-shell .wl-win,.wl-root.is-shell .wl-mini,.wl-root.is-shell .wl-mini-overlay{background:color-mix(in srgb,var(--dsw-alias-bg-overlay) calc(var(--wl-glass-alpha,.35) * 130%),transparent)}',
    '.wl-swatch{width:24px;height:24px;padding:0;border:2px solid transparent;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}',
    '.wl-swatch.is-on{border-color:var(--dsw-alias-label-primary,#1c1f24);box-shadow:inset 0 0 0 2px var(--dsw-alias-bg-overlay,#fff)}',
    '.wl-swatch.is-picker{background:conic-gradient(#f55,#fd5,#5f5,#5ff,#55f,#f5f,#f55);overflow:hidden}',
    '.wl-swatch.is-picker::-webkit-color-swatch-wrapper{padding:0}',
    '.wl-swatch.is-picker::-webkit-color-swatch{border:none;opacity:.55}',
    '.wl-range{width:100%;height:18px;accent-color:var(--wl-accent,#3f6be6);cursor:pointer}',
  ].join('\n')

  var ensureStyle = function (doc) {
    if (doc.getElementById(STYLE_ID) !== null) return
    var tag = doc.createElement('style')
    tag.id = STYLE_ID
    tag.textContent = CSS
    var parent = doc.head || doc.documentElement
    if (parent === null) return
    parent.appendChild(tag)
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
      version: '',
      ui: null,
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

    var setArchiveMode = function (mode) {
      if (ARCHIVE_MODES.indexOf(mode) < 0) return
      view.archiveMode = mode
      try { localStorage.setItem(ARCHIVE_KEY, mode) } catch (error) { /* 忽略 */ }
      render()
    }

    /* ---------------- 外观（自定义主题） ---------------- */

    // 与 core/store.js 的 DEFAULT_UI 同源；独立窗口还没拉到数据时先用它垫底。
    var UI_FALLBACK = {
      theme: 'auto',
      accent: '#3f6be6',
      danger: '#e5484d',
      fontFamily: '',
      fontScale: 1,
      radius: 8,
      sidebarWidth: 232,
      density: 'cozy',
      showDots: true,
      showProgressBar: true,
      glass: false,
      glassAlpha: 0.22,
      glassBlur: 20,
      labels: { appName: '工作清单', projects: '项目', ddl: 'DDL预警', newTask: '新建工作' },
    }

    var FONT_CHOICES = [
      { label: '跟随 DSH', value: '' },
      { label: '系统默认', value: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
      { label: '微软雅黑', value: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif' },
      { label: '等宽', value: '"Cascadia Code", Consolas, monospace' },
      { label: '宋体', value: 'SimSun, "Songti SC", serif' },
    ]

    var ACCENT_CHOICES = ['#3f6be6', '#2f9e6f', '#e08a3c', '#c85c8e', '#8b6fd6', '#e5484d', '#3d9dc4', '#6e7a8a']

    var uiOf = function () {
      var ui = view.ui
      if (ui === null || typeof ui !== 'object') return UI_FALLBACK
      return ui
    }

    var labelOf = function (key) {
      var labels = uiOf().labels || {}
      var value = labels[key]
      if (typeof value === 'string' && value.trim() !== '') return value
      return UI_FALLBACK.labels[key]
    }

    // 强调色的 hover 态：同一个色相压暗一点，省得让用户填两个颜色。
    var darken = function (hex, factor) {
      var digits = String(hex).replace('#', '')
      if (!/^[0-9a-fA-F]{6}$/.test(digits)) return hex
      var parts = [0, 2, 4].map(function (index) {
        var value = Math.round(parseInt(digits.slice(index, index + 2), 16) * factor)
        return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
      })
      return '#' + parts.join('')
    }

    // 外壳模式：跑在自己的 Electron 窗口里（窗口有系统亚克力背板），页面透明才看得见桌面
    var SHELL = typeof window !== 'undefined' && window.__wlShell === true

    var THEME_VARS = ['--wl-accent', '--wl-accent-hover', '--wl-danger', '--wl-radius', '--wl-scale', '--wl-font', '--wl-glass-alpha', '--wl-glass-blur']

    // 挂在 body 上的东西（右键菜单）不继承 root 的变量与主题属性，单独抄一份
    var adoptTheme = function (target) {
      var mode = root.getAttribute('data-wl-theme')
      if (mode !== null) target.setAttribute('data-wl-theme', mode)
      THEME_VARS.forEach(function (name) {
        var value = root.style.getPropertyValue(name)
        if (value !== '') target.style.setProperty(name, value)
      })
      return target
    }

    var applyUi = function () {
      var ui = uiOf()
      var style = root.style
      style.setProperty('--wl-accent', ui.accent)
      style.setProperty('--wl-accent-hover', darken(ui.accent, 0.85))
      style.setProperty('--wl-danger', ui.danger)
      style.setProperty('--wl-radius', ui.radius + 'px')
      style.setProperty('--wl-side-w', ui.sidebarWidth + 'px')
      style.setProperty('--wl-scale', String(ui.fontScale))
      if (ui.fontFamily !== '') style.setProperty('--wl-font', ui.fontFamily)
      else style.removeProperty('--wl-font')
      root.classList.toggle('is-compact', ui.density === 'compact')
      root.classList.toggle('is-flat', ui.showDots === false)
      root.classList.toggle('no-bar', ui.showProgressBar === false)
      // 液态玻璃：底色 alpha 与模糊半径都走变量，CSS 里两处（面板 / 小窗）共用
      root.classList.toggle('is-glass', ui.glass === true)
      // 外壳模式下再怎么关玻璃，窗口本身就透，至少给一层薄纱保证字能读
      root.classList.toggle('is-shell', SHELL)
      style.setProperty('--wl-glass-alpha', String(SHELL ? Math.min(ui.glass === true ? ui.glassAlpha : 0.35, 0.85) : ui.glassAlpha))
      style.setProperty('--wl-glass-blur', ui.glassBlur + 'px')
      // auto 时不挂属性，直接吃宿主当前主题的 token
      if (ui.theme === 'light' || ui.theme === 'dark') root.setAttribute('data-wl-theme', ui.theme)
      else root.removeAttribute('data-wl-theme')
      // 独立窗口只有一个面板，窗口标题跟着应用名走；DSH 里不动宿主页面标题
      if (typeof window !== 'undefined' && window.__wlStandalone === true) {
        if (doc.title !== labelOf('appName')) doc.title = labelOf('appName')
        // 独立窗口的 body 底色也归我们管：不然切亮色时面板白了、四周还留着宿主的深色
        if (ui.theme === 'light' || ui.theme === 'dark') doc.body.setAttribute('data-wl-theme', ui.theme)
        else doc.body.removeAttribute('data-wl-theme')
      }
      // 小窗（PiP 文档 / 浮层 / 单窗口）是另一份文档或另一棵子树，主题变量得单独刷一遍
      if (mini.root !== null) miniRestyle()
    }

    var uiSaveTimer = null
    var uiPending = {}

    /*
     * 外观改动先本地生效（即时预览），350ms 内不再动才落盘 ——
     * 拖滑杆时不会把每个中间值都写一遍 JSON。
     */
    var setUi = function (patch) {
      var next = {}
      Object.keys(uiOf()).forEach(function (key) { next[key] = uiOf()[key] })
      Object.keys(patch).forEach(function (key) {
        if (key === 'labels') next.labels = Object.assign({}, next.labels, patch.labels)
        else next[key] = patch[key]
      })
      view.ui = next
      uiPending = Object.assign({}, uiPending, patch)
      applyUi()
      if (uiSaveTimer !== null) clearTimeout(uiSaveTimer)
      uiSaveTimer = setTimeout(function () {
        var body = uiPending
        uiPending = {}
        uiSaveTimer = null
        request('PATCH', '/ui', body).then(function (payload) {
          if (!mounted) return
          view.ui = payload.ui
          applyUi()
        }).catch(function (error) { notifyError(error) })
      }, 350)
    }

    var openAppearanceModal = function () {
      var body = h('div', { class: 'wl-win-body' })

      var section = function (title, children) {
        return h('div', { class: 'wl-field' }, h('div', { class: 'wl-label', text: title }), h('div', { class: 'wl-chips', style: { gap: '8px' } }, children))
      }

      var chipButton = function (text, active, onclick) {
        return h('button', {
          class: 'wl-btn' + (active ? ' is-primary' : ''),
          onclick: onclick,
        }, text)
      }

      var slider = function (label, options) {
        // toValue：存的值 → 滑杆上的数；fromValue：滑杆上的数 → 存的值。
        // 两者分开，是因为像字号这种「存 1.0、显示 100%」的字段需要反向换算。
        var toValue = typeof options.toValue === 'function' ? options.toValue : function (value) { return value }
        var fromValue = typeof options.fromValue === 'function' ? options.fromValue : toValue
        var format = typeof options.format === 'function' ? options.format : function (value) { return String(value) }
        var current = toValue(uiOf()[options.key])
        var value = h('span', { class: 'wl-hint', style: { minWidth: '46px', textAlign: 'right' }, text: format(current) })
        var input = h('input', {
          class: 'wl-range',
          type: 'range',
          min: String(options.min),
          max: String(options.max),
          step: String(options.step || 1),
          value: String(current),
          oninput: function (event) {
            var shown = Number(event.target.value)
            value.textContent = format(shown)
            var stored = fromValue(shown)
            setUi((function () { var patch = {}; patch[options.key] = stored; return patch })())
          },
        })
        return h('div', { class: 'wl-field', style: { flex: '1 1 0' } },
          h('div', { class: 'wl-row' },
            h('span', { class: 'wl-label', text: label }),
            h('span', { class: 'wl-grow', style: { flex: '1 1 auto' } }),
            value
          ),
          input
        )
      }

      var rebuild = function () {
        body.textContent = ''
        var ui = uiOf()

        // 主题
        body.appendChild(section('主题', ['auto', 'light', 'dark'].map(function (mode) {
          var names = { auto: '跟随宿主', light: '亮色', dark: '暗色' }
          return chipButton(names[mode], ui.theme === mode, function () { setUi({ theme: mode }); rebuild() })
        })))

        // 强调色
        var swatches = ACCENT_CHOICES.map(function (color) {
          return h('button', {
            class: 'wl-swatch' + (String(ui.accent).toLowerCase() === color ? ' is-on' : ''),
            title: color,
            style: { background: color },
            onclick: function () { setUi({ accent: color }); rebuild() },
          })
        })
        swatches.push(h('input', {
          type: 'color',
          class: 'wl-swatch is-picker',
          value: /^#[0-9a-fA-F]{6}$/.test(ui.accent) ? ui.accent : '#3f6be6',
          title: '自定义颜色',
          oninput: function (event) { setUi({ accent: event.target.value }) },
          onchange: function () { rebuild() },
        }))
        body.appendChild(section('强调色', swatches))

        // 字体
        var fontSelect = h('select', {
          class: 'wl-select',
          onchange: function (event) { setUi({ fontFamily: event.target.value }) },
        }, FONT_CHOICES.map(function (choice) {
          return h('option', { value: choice.value, selected: (ui.fontFamily || '') === choice.value }, choice.label)
        }))
        body.appendChild(h('div', { class: 'wl-field' }, h('div', { class: 'wl-label', text: '字体' }), fontSelect))

        // 字号 / 圆角 / 侧栏宽度
        body.appendChild(h('div', { class: 'wl-row', style: { gap: '16px' } },
          slider('字号', {
            key: 'fontScale',
            min: 85,
            max: 130,
            toValue: function (value) { return Math.round(Number(value) * 100) },
            fromValue: function (shown) { return shown / 100 },
            format: function (shown) { return shown + '%' },
          }),
          slider('圆角', { key: 'radius', min: 0, max: 18, format: function (value) { return value + 'px' } })
        ))
        body.appendChild(h('div', { class: 'wl-row', style: { gap: '16px' } },
          slider('侧栏宽度', { key: 'sidebarWidth', min: 180, max: 380, step: 2, format: function (value) { return value + 'px' } })
        ))

        // 开关
        // 开关：density 存的是 cozy/compact，其余存布尔，所以由调用方给出「下一个值」
        var toggle = function (label, key, current, nextValue) {
          return h('button', {
            class: 'wl-btn' + (current ? ' is-primary' : ''),
            onclick: function () { var patch = {}; patch[key] = nextValue; setUi(patch); rebuild() },
          }, (current ? '✓ ' : '') + label)
        }
        body.appendChild(section('显示', [
          toggle('紧凑行距', 'density', ui.density === 'compact', ui.density === 'compact' ? 'cozy' : 'compact'),
          toggle('分类色点', 'showDots', ui.showDots !== false, ui.showDots === false),
          toggle('进度条', 'showProgressBar', ui.showProgressBar !== false, ui.showProgressBar === false),
        ]))

        // 液态玻璃：半透明 + 背景模糊（DSH 面板与专注小窗都吃这一套）
        body.appendChild(section('液态玻璃', [
          toggle('玻璃质感', 'glass', ui.glass === true, ui.glass !== true),
        ]))
        body.appendChild(h('div', { class: 'wl-row', style: { gap: '16px' } },
          slider('不透明度', {
            key: 'glassAlpha',
            min: 4,
            max: 85,
            toValue: function (value) { return Math.round(Number(value) * 100) },
            fromValue: function (shown) { return shown / 100 },
            format: function (shown) { return shown + '%' },
          }),
          slider('模糊', {
            key: 'glassBlur',
            min: 4,
            max: 40,
            format: function (shown) { return shown + 'px' },
          })
        ))
        body.appendChild(h('div', { class: 'wl-hint', text: '玻璃要「背后有东西」才看得出效果：在 DSH 面板里能透出下面的内容；独立窗口只能糊自己的底色，透不到桌面。' }))

        // 标签文案
        var labelRow = function (key, text) {
          return h('div', { class: 'wl-field', style: { flex: '1 1 140px' } },
            h('div', { class: 'wl-label', text: text }),
            h('input', {
              class: 'wl-input',
              value: labelOf(key),
              maxlength: '24',
              oninput: function (event) {
                var labels = {}
                labels[key] = event.target.value
                setUi({ labels: labels })
              },
            })
          )
        }
        body.appendChild(h('div', { class: 'wl-label', text: '标签文案（留空用默认值）' }))
        body.appendChild(h('div', { class: 'wl-row', style: { flexWrap: 'wrap', gap: '8px' } },
          labelRow('appName', '应用名'),
          labelRow('projects', '项目'),
          labelRow('ddl', 'DDL预警'),
          labelRow('newTask', '新建工作')
        ))

        body.appendChild(h('div', { class: 'wl-hint', text: '改动即时生效，并保存在同一份数据文件里（DSH 面板和桌面窗口共用）。' }))
      }

      rebuild()

      var reset = h('button', {
        class: 'wl-btn',
        onclick: function () {
          request('POST', '/ui/reset').then(function (payload) {
            view.ui = payload.ui
            applyUi()
            rebuild()
          }).catch(function (error) { notifyError(error) })
        },
      }, '恢复默认')

      openMask(h('div', { class: 'wl-win', style: { width: 'min(620px,100%)' } },
        h('div', { class: 'wl-win-head' },
          h('span', { text: '外观' }),
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-icon', title: '关闭', onclick: closeModal }, '×')
        ),
        body,
        h('div', { class: 'wl-win-foot' },
          reset,
          h('span', { class: 'wl-grow' }),
          h('button', { class: 'wl-btn is-primary', onclick: closeModal }, '完成')
        )
      ))
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
      // 外观配置跟数据走：同一份 JSON，DSH 面板和桌面窗口看到的是同一个主题
      if (state && state.ui && typeof state.ui === 'object') view.ui = state.ui
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
        var next = typeof payload.version === 'string' ? payload.version : ''
        if (next !== view.version) { view.version = next; render() }
      }).catch(function () {})
    }

    /* ---------------- 渲染 ---------------- */

    var render = function () {
      if (mini.categoryId !== null) {
        root.textContent = ''
        root.className = 'wl-root'
      applyUi()
        if (mini.single === true) {
          // 单窗口模式：整个面板就是专注视图，外面那个窗口本身已经被缩成小窗了
          var only = h('div', { class: 'wl-mini is-single' })
          root.appendChild(only)
          mini.root = only
          renderMiniBody()
          return
        }
        // 小窗开着的时候，主面板让位：只留一张「回到大窗口」的卡片，
        // 免得两处同时改同一批数据看不出效果。
        root.appendChild(renderMiniPlaceholder())
        if (mini.root !== null) renderMiniBody()
        return
      }
      var scrollTop = 0
      var scroller = root.querySelector('.wl-scroll')
      if (scroller !== null) scrollTop = scroller.scrollTop
      root.textContent = ''
      root.className = 'wl-root'
      applyUi()

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

    /* ---------------- 专注小窗 ---------------- */

    /*
     * 一个分类单独拎出来，钉在屏幕最上层。
     *
     * 优先用 Document Picture-in-Picture：Chromium 里它是真正的独立窗口，
     * 系统级置顶、能自由拉大小，切到别的应用上也不会被盖住。
     * 拿不到就退回页面内的浮动小窗（可拖、可拉、层级最高）——
     * 效果差一档，但至少能用。
     */
    var mini = { categoryId: null, root: null, win: null, overlay: null, drag: null, single: false }
    // 小窗默认尺寸：四个角都可拉伸，但初始就这么大
    var MINI_SIZE = 256

    var findCategory = function (categoryId) {
      if (view.data === null) return null
      for (var i = 0; i < view.data.projects.length; i += 1) {
        var project = view.data.projects[i]
        for (var j = 0; j < project.categories.length; j += 1) {
          if (project.categories[j].id === categoryId) {
            return { project: project, category: project.categories[j] }
          }
        }
      }
      return null
    }

    var copyThemeVars = function (doc, from) {
      var names = [
        '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2',
        '--dsw-alias-bg-overlay', '--dsw-alias-border-l1', '--dsw-alias-border-l2',
        '--dsw-alias-label-primary', '--dsw-alias-label-secondary', '--dsw-alias-label-tertiary',
        '--dsw-alias-interactive-bg-hover', '--dsw-alias-interactive-bg-pressed',
        '--wl-accent', '--wl-accent-hover', '--wl-danger', '--dsw-font-family',
      ]
      var computed = window.getComputedStyle(from)
      names.forEach(function (name) {
        var value = computed.getPropertyValue(name)
        if (value !== '') doc.body.style.setProperty(name, value.trim())
      })
      doc.body.style.setProperty('background-color', computed.getPropertyValue('--dsw-alias-bg-base').trim() || '#fff')
    }

    // 外观改动后同步到小窗：PiP 换一份文档、浮层/单窗口换一棵子树，两条路分别处理
    var miniRestyle = function () {
      if (mini.root === null) return
      if (mini.win !== null && mini.win.document !== undefined && mini.win.document.body !== undefined) {
        copyThemeVars(mini.win.document, root)
      }
      var ui = uiOf()
      mini.root.style.setProperty('--wl-accent', ui.accent)
      mini.root.style.setProperty('--wl-danger', ui.danger)
      mini.root.style.setProperty('--wl-radius', ui.radius + 'px')
      mini.root.style.setProperty('--wl-scale', String(ui.fontScale))
      mini.root.classList.toggle('is-compact', ui.density === 'compact')
    }

    var miniStepRow = function (realId, step) {
      return h('div', { class: 'wl-mini-step' + (step.done ? ' is-done' : '') },
        h('button', {
          class: 'wl-check' + (step.done ? ' is-on' : ''),
          style: { width: '13px', height: '13px' },
          title: step.done ? '标记为未完成' : '标记为完成',
          onclick: function () {
            request('PATCH', '/tasks/' + encodeURIComponent(realId) + '/steps/' + encodeURIComponent(step.id), { done: !step.done })
              .then(function () { return refresh() })
              .catch(function (error) { notifyError(error) })
          },
        }, step.done ? '✓' : ''),
        h('span', { class: 'wl-mini-step-name', text: step.title }),
        h('span', { class: 'wl-chip', text: '权重 ' + step.weight })
      )
    }

    var miniTaskBlock = function (task) {
      var realId = task.cloneOf || task.id
      var done = task.progress >= 1
      var expanded = view.expanded['m:' + realId] === true
      var box = h('div', { class: 'wl-mini-task' + (done ? ' is-done' : '') })
      box.appendChild(h('div', { class: 'wl-mini-row' },
        h('button', {
          class: 'wl-check' + (done ? ' is-on' : ''),
          title: done ? '标记为未完成' : '标记为完成',
          onclick: function (event) {
            event.stopPropagation()
            toggleDone(realId, task, !done)
          },
        }, done ? '✓' : ''),
        h('span', {
          class: 'wl-mini-title',
          text: task.title,
          title: task.title,
          onclick: function () {
            view.expanded['m:' + realId] = !expanded
            renderMiniBody()
          },
        }),
        task.steps.length > 0
          ? h('span', { class: 'wl-chip', text: task.steps.filter(function (s) { return s.done }).length + '/' + task.steps.length })
          : null,
        h('span', { class: 'wl-mini-pct', text: pct(task.progress) })
      ))
      if (expanded && task.steps.length > 0) {
        var steps = h('div', { class: 'wl-mini-steps' })
        task.steps.forEach(function (step) { steps.appendChild(miniStepRow(realId, step)) })
        box.appendChild(steps)
      }
      return box
    }

    var renderMiniBody = function () {
      if (mini.root === null) return
      var found = findCategory(mini.categoryId)
      mini.root.textContent = ''
      if (found === null) {
        mini.root.appendChild(h('div', { class: 'wl-hint', text: '这个分类已经不在了。' }))
        return
      }
      var category = found.category
      if (mini.win !== null || mini.single === true) {
        // PiP 小窗、单窗口模式：都要自己画出分类名（单窗口模式下外面没有别的标题条了）
        mini.root.appendChild(h('div', { class: 'wl-mini-head' },
          h('span', { class: 'wl-dot', style: { background: category.color } }),
          h('span', { class: 'wl-mini-titles' },
            h('span', { class: 'wl-mini-name', text: category.title, title: category.title }),
            h('span', { class: 'wl-mini-proj', text: found.project.title })
          ),
          h('span', { class: 'wl-mini-count', text: pct(category.progress) + ' · ' + category.openCount + '/' + category.taskCount }),
          h('button', {
            class: 'wl-icon',
            title: '关掉小窗，回主界面',
            onclick: function () { closeMini() },
          }, '✕')
        ))
      } else {
        // 页面内小窗：标题和关闭按钮在顶部标题条里，这里只补一行统计
        mini.root.appendChild(h('div', { class: 'wl-mini-meta' },
          h('span', { class: 'wl-mini-count', text: pct(category.progress) + ' · ' + category.openCount + '/' + category.taskCount }),
          bar(category.progress, '96px')
        ))
      }
      var list = h('div', { class: 'wl-mini-list' })
      var tasks = category.tasks.filter(visibleArchived)
      if (tasks.length === 0) {
        list.appendChild(h('div', { class: 'wl-hint', style: { padding: '10px 2px' }, text: '这个分类下还没有工作。' }))
      }
      tasks.forEach(function (task) { list.appendChild(miniTaskBlock(task)) })
      mini.root.appendChild(list)
    }

    var renderMiniPlaceholder = function () {
      var found = findCategory(mini.categoryId)
      var name = found === null ? '' : found.category.title
      return h('div', { class: 'wl-mini-away' },
        h('div', { class: 'wl-mini-away-card' },
          h('div', { class: 'wl-mini-away-title', text: '「' + name + '」正在小窗里' }),
          h('div', { class: 'wl-hint', text: '小窗钉在屏幕最上层，勾选会直接写回清单。关掉小窗就回到这里。' }),
          h('div', { class: 'wl-modal-actions' },
            h('button', {
              class: 'wl-btn is-ghost',
              text: '回到主界面',
              onclick: function () { closeMini() },
            })
          )
        )
      )
    }

    var closeMini = function () {
      mini.categoryId = null
      if (mini.single === true) {
        mini.single = false
        request('POST', '/window/frame', { action: 'restore', matches: frameNeedles() }).catch(function () { /* 还不了就算了 */ })
      }
      if (mini.win !== null) {
        var win = mini.win
        mini.win = null
        try { win.close() } catch (error) { /* 窗口已经没了 */ }
      }
      if (mini.overlay !== null) {
        mini.overlay.remove()
        mini.overlay = null
      }
      mini.root = null
      render()
    }

    var startOverlayMini = function (project, category) {
      var box = h('div', { class: 'wl-mini-overlay' })
      var drag = h('div', { class: 'wl-mini-drag' },
        h('span', { class: 'wl-dot', style: { background: category.color } }),
        h('span', { class: 'wl-mini-drag-title', text: project.title + ' · ' + category.title }),
        h('button', {
          class: 'wl-icon wl-mini-x',
          title: '关掉小窗，回主界面',
          onclick: function (event) {
            event.stopPropagation()
            if (mini.overlay !== null) {
              mini.overlay.remove()
              mini.overlay = null
            }
            mini.categoryId = null
            mini.root = null
            render()
          },
        }, '✕')
      )
      mini.root = h('div', { class: 'wl-mini-body' })
      box.appendChild(drag)
      box.appendChild(mini.root)
      doc.body.appendChild(box)
      mini.overlay = box
      // 拖拽：按住标题条把整块挪走（按钮上按下不算）
      drag.addEventListener('mousedown', function (event) {
        if (event.target !== null && event.target.closest !== undefined && event.target.closest('button') !== null) return
        event.preventDefault()
        var start = { x: event.clientX, y: event.clientY, left: box.offsetLeft, top: box.offsetTop }
        var move = function (e) {
          box.style.left = Math.max(0, start.left + e.clientX - start.x) + 'px'
          box.style.top = Math.max(0, start.top + e.clientY - start.y) + 'px'
        }
        var up = function () {
          doc.removeEventListener('mousemove', move)
          doc.removeEventListener('mouseup', up)
        }
        doc.addEventListener('mousemove', move)
        doc.addEventListener('mouseup', up)
      })
      renderMiniBody()
      return category
    }

    // 小窗默认走页面内的独立窗口：标题、大小、层级全由我们说了算。
    // 浏览器 PiP 窗口的标题栏是 Chromium 自己的（Edge 的 app 窗口里会显示成
    // 127.0.0.1:7419），不符合这里的要求，所以只在显式打开开关时才用。
    var openMini = function (project, category) {
      if (mini.categoryId === category.id) { closeMini(); return }
      if (mini.categoryId !== null) closeMini()
      mini.categoryId = category.id
      view.expanded[category.id] = true
      var pip = window.documentPictureInPicture
      var wantsPip = window.__wlMiniPiP === true
      if (wantsPip && pip && typeof pip.requestWindow === 'function') {
        Promise.resolve(pip.requestWindow({
          width: MINI_SIZE,
          height: MINI_SIZE,
          // Chromium 默认会沿用上一次的窗口尺寸；这个开关让它改用这次请求的大小
          preferInitialWindowPlacement: true,
          disallowReturnToOpener: true,
        })).then(function (win) {
          mini.win = win
          var pipDoc = win.document
          setDocTitle(pipDoc, labelOf('appName') + ' · ' + category.title)
          ensureStyle(pipDoc)
          setDocTitle(pipDoc, labelOf('appName') + ' · ' + category.title)
          copyThemeVars(pipDoc, root)
          pipDoc.body.className = 'wl-mini-doc'
          mini.root = pipDoc.createElement('div')
          mini.root.className = 'wl-mini'
          pipDoc.body.appendChild(mini.root)
          win.addEventListener('pagehide', function () {
            if (mini.win === win) { mini.categoryId = null; mini.win = null; mini.root = null; render() }
          })
          renderMiniBody()
          render()
          // 尺寸：requestWindow 的 width/height 只是「期望值」，不同 Chromium 版本行为不一，
          // 有的会沿用上次窗口大小、有的会按内容撑开。多压几次，并把实际尺寸挂到标题上便于排查。
          forceMiniSize(win)
          // 小窗钉在最上层之后，把主窗口收到任务栏（页面自己做不到，交给本地服务调 Win32）
          sendToBackground()
        }).catch(function () {
          startOverlayMini(project, category)
          render()
        })
        return
      }
      if (window.__wlMiniOverlay === true) {
        startOverlayMini(project, category)
        render()
        return
      }
      startSingleMini(project, category)
    }

    // 单窗口模式：面板换成专注视图，同时把外面这个窗口整体缩成小窗、置顶、贴右下角。
    // 关掉小窗时用 POST /window/frame { action: 'restore' } 还原到原来的矩形。
    var startSingleMini = function (project, category) {
      mini.single = true
      render()
      request('POST', '/window/frame', {
        action: 'mini',
        matches: frameNeedles(),
        width: MINI_SIZE,
        height: MINI_SIZE,
      }).catch(function () { /* 缩不了也不影响专注视图 */ })
    }

    // 用来认「承载页面的那个窗口」：DSH 的标题是「<会话> — DeepSeek Harness」，
    // 独立窗口是「工作清单」；都不中的时候退回应用名。
    var frameNeedles = function () {
      var list = []
      var title = String(doc.title || '')
      if (title !== '') list.push(title)
      list.push('工作清单')
      list.push('DeepSeek Harness')
      list.push('DeepSeek')
      return list
    }

    // 把 PiP 窗口压到 MINI_SIZE。resizeTo 在部分内核上对 PiP 窗口无效，
    // 所以隔几个时间点各试一次；实在压不动就记下真实尺寸（标题上有，鼠标悬停能看到）。
    var forceMiniSize = function (win) {
      var tries = [0, 120, 400, 900, 1600]
      tries.forEach(function (delay) {
        setTimeout(function () {
          try { win.resizeTo(MINI_SIZE, MINI_SIZE) } catch (error) { /* 不允许就直接算了 */ }
          try {
            if (mini.root !== null) {
              mini.root.setAttribute('title', '小窗实际尺寸 ' + win.innerWidth + '×' + win.innerHeight)
            }
          } catch (error) { /* 跨文档读不到就算了 */ }
        }, delay)
      })
    }

    // 让承载页面的主窗口最小化到任务栏。页面没这个权限，POST 给本地服务由它调 user32。
    // 独立窗口（127.0.0.1:<port> 标题）与 DSH 窗口都能匹配；失败就当没这回事。
    var MINI_TITLE_PREFIX = '工作清单 · '
    // Windows 上 PiP 小窗是从属窗口，主窗口一最小化它会被一起收走。
    // 所以收完主窗口之后，按标题前缀再把它单独捞回来。
    var rescueMiniWindow = function () {
      var attempts = [120, 420, 900, 1600]
      attempts.forEach(function (delay) {
        setTimeout(function () {
          request('POST', '/window/restore', { prefix: MINI_TITLE_PREFIX }).catch(function () { /* 没有就算了 */ })
        }, delay)
      })
    }
    var sendToBackground = function () {
      if (typeof window === 'undefined' || window.location === undefined) return
      var host = String(window.location.host || '')
      var title = String(doc.title || '')
      // 依次尝试：页面标题完全相同 → 页面标题包含 → 端口/主机名包含 → 应用名
      // 小窗（PiP）自己的标题是「工作清单 · 分类」，所以第一条只认完全相同，不会把它也收起来。
      var tries = []
      if (title !== '') tries.push({ match: title, exact: true })
      if (title !== '') tries.push({ match: title })
      if (host !== '') tries.push({ match: host })
      tries.push({ match: 'DeepSeek' })
      setTimeout(function () {
        var index = 0
        var next = function () {
          if (index >= tries.length) return Promise.resolve()
          var current = tries[index]
          index += 1
          return request('POST', '/window/minimize', current).then(function (reply) {
            if (reply !== null && reply.minimized > 0) return null
            return next()
          }).catch(function () { return next() })
        }
        next().then(function () {
          if (mini.win !== null) rescueMiniWindow()
        })
      }, 350)
    }

    // 给任意文档（宿主文档 / PiP 文档）设标题：
    // 直接写 document.title 在没有 <title> 元素的文档里可能不生效，
    // 浏览器就会退回显示 URL / 主机名（127.0.0.1 那串）。所以显式建一个 <title>。
    var setDocTitle = function (target, value) {
      if (target === null) return
      try {
        var titleEl = target.querySelector('title')
        if (titleEl === null) {
          titleEl = target.createElement('title')
          var head = target.head || target.documentElement
          head.insertBefore(titleEl, head.firstChild)
        }
        titleEl.textContent = value
      } catch (error) { /* 极简文档可能不让改 */ }
      try { target.title = value } catch (error) { /* 同上 */ }
    }

    var renderSide = function () {
      var side = h('div', { class: 'wl-side' })
      side.appendChild(h('div', { class: 'wl-side-head' },
        h('span', { text: '项目' }),
        h('div', { class: 'wl-side-acts' },
          h('button', {
            class: 'wl-icon',
            type: 'button',
            title: '外观：主题、颜色、字体、侧栏宽度、标签文案',
            'aria-label': '外观',
            onclick: function () { openAppearanceModal() },
          }, iconPalette(16)),
          h('button', {
            class: 'wl-icon',
            type: 'button',
            title: '视图选项：归档显示方式',
            'aria-label': '视图选项',
            'aria-haspopup': 'menu',
            onclick: function () { openViewMenu(this) },
          }, iconSliders(16)),
          h('button', {
            class: 'wl-btn is-ghost',
            title: '新建项目',
            onclick: function () { openProjectModal() },
          }, '＋')
        )
      ))
      // 外壳是无边框窗口，得自带一个关闭键（浏览器窗口里不需要，也不该有）
      if (SHELL) {
        side.querySelector('.wl-side-acts').appendChild(h('button', {
          class: 'wl-icon',
          type: 'button',
          title: '关闭窗口',
          'aria-label': '关闭窗口',
          onclick: function () { window.close() },
        }, '✕'))
      }
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
      // 版本标记：用来一眼确认面板跑的是不是刚装上的那一版（排查缓存时特别有用）
      side.appendChild(h('div', { class: 'wl-ver', text: (labelOf('appName') || '工作清单') + (view.version ? ' · v' + view.version : '') }))
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

    /** 预警时长：两个输入框，天 + h，合计 = 天*24 + h（1 天 = 24 小时，上限 30 天 / 720 小时）。 */
    var makeHoursField = function (initialHours) {
      var seed = Math.round(Number(initialHours))
      if (!isFinite(seed) || seed <= 0) seed = 24
      seed = Math.min(seed, 720)
      var daysInput = h('input', {
        class: 'wl-input wl-durnum',
        type: 'number',
        min: '0',
        max: '30',
        step: '1',
        value: String(Math.floor(seed / 24)),
      })
      var hoursInput = h('input', {
        class: 'wl-input wl-durnum',
        type: 'number',
        min: '0',
        max: '23',
        step: '1',
        value: String(seed % 24),
      })
      var el = h('div', { class: 'wl-dur' },
        daysInput,
        h('span', { class: 'wl-unit', text: '天' }),
        hoursInput,
        h('span', { class: 'wl-unit', text: 'h' })
      )
      var get = function () {
        var days = Math.floor(Number(daysInput.value))
        var rest = Math.floor(Number(hoursInput.value))
        if (!isFinite(days) || days < 0) days = 0
        if (!isFinite(rest) || rest < 0) rest = 0
        if (days > 30) days = 30
        if (rest > 23) rest = 23
        var total = days * 24 + rest
        return total > 0 ? Math.min(total, 720) : null
      }
      var set = function (hours) {
        var value = Math.round(Number(hours))
        if (!isFinite(value) || value <= 0) value = 0
        value = Math.min(value, 720)
        daysInput.value = String(Math.floor(value / 24))
        hoursInput.value = String(value % 24)
      }
      return { el: el, get: get, set: set, inputs: [daysInput, hoursInput] }
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
        h('span', { class: 'wl-cat-name', text: isDdl ? labelOf('ddl') : category.title, title: isDdl ? '自动收录撞上预警线的工作，不能改名或删除' : category.title }),
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
      head.appendChild(h('button', {
        class: 'wl-icon is-mini',
        title: '专注小窗：只显示这个分类的工作和步骤，钉在屏幕最上层',
        onclick: function (event) {
          event.stopPropagation()
          openMini(project, category)
        },
      }, iconMiniWindow()))
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
        h('span', { class: 'wl-chip', title: '权重 ' + task.weight + '：数值越大，它在这一级进度里占比越高', text: '权重 ' + task.weight }),
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
            h('span', { class: 'wl-chip', title: '权重 ' + step.weight, text: '权重 ' + step.weight })
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

    /* ---------------- 图标（照 DSH 自带的 16×16 线性图标画） ---------------- */

    var SVG_NS = 'http://www.w3.org/2000/svg'

    // 关键：SVG 必须用 createElementNS 建。用 createElement('path') 得到的是一个
    // HTMLUnknownElement，浏览器根本不画它 —— 之前图标「看不见」就是这个原因。
    var svgEl = function (tag, props) {
      var node = doc.createElementNS(SVG_NS, tag)
      if (props !== undefined && props !== null) {
        Object.keys(props).forEach(function (key) {
          if (key === 'key') return
          node.setAttribute(key, String(props[key]))
        })
      }
      return node
    }

    var svgIcon = function (children, size) {
      var side = size === undefined ? 16 : size
      var node = doc.createElementNS(SVG_NS, 'svg')
      node.setAttribute('width', String(side))
      node.setAttribute('height', String(side))
      node.setAttribute('viewBox', '0 0 16 16')
      node.setAttribute('fill', 'none')
      node.setAttribute('stroke', 'currentColor')
      node.setAttribute('stroke-width', '1.5')
      node.setAttribute('stroke-linecap', 'round')
      node.setAttribute('stroke-linejoin', 'round')
      node.setAttribute('aria-hidden', 'true')
      node.style.flex = 'none'
      node.style.display = 'block'
      children.filter(function (child) { return child !== null }).forEach(function (child) {
        node.appendChild(child)
      })
      return node
    }

    // 专注小窗：一枚「窗口套窗口」的图标，和 ＋/✎ 这些字符按钮并排
    var iconMiniWindow = function () {
      return svgIcon([
        svgEl('rect', { x: 1.6, y: 2.4, width: 12.8, height: 11.2, rx: 1.8 }),
        svgEl('path', { d: 'M1.6 6h12.8' }),
        svgEl('path', { d: 'M9 6v7.6' }),
        svgEl('circle', { cx: 3.6, cy: 4.2, r: 0.55 }),
      ])
    }

    // 调色盘：外观按钮（一个圆盘 + 三个点）
    var iconPalette = function (size) {
      return svgIcon([
        svgEl('path', { d: 'M8 1.9a6.1 6.1 0 1 0 0 12.2c.9 0 1.4-.6 1.4-1.3 0-.5-.2-.8-.5-1.1-.2-.3-.4-.5-.4-.9 0-.6.5-1 1.1-1h1.2A3.3 3.3 0 0 0 14.1 6.5c0-2.6-2.7-4.6-6.1-4.6Z' }),
        svgEl('circle', { cx: 5.2, cy: 6.1, r: 0.85 }),
        svgEl('circle', { cx: 8.1, cy: 4.5, r: 0.85 }),
        svgEl('circle', { cx: 10.9, cy: 6, r: 0.85 }),
      ], size)
    }

    // IconSlidersTwoOutlineRegular —— DSH「视图选项」用的就是它（两条滑杆 + 两个旋钮）
    var iconSliders = function (size) {
      return svgIcon([
        svgEl('path', { d: 'M2.3 5h5.85M12.05 5h1.65' }),
        svgEl('circle', { cx: 9.95, cy: 5, r: 1.45 }),
        svgEl('path', { d: 'M2.3 11h1.65M7.85 11h5.85' }),
        svgEl('circle', { cx: 5.75, cy: 11, r: 1.45 }),
      ], size)
    }

    // IconArchive(Check|Off)OutlineRegular 的同一副骨架，靠多出来的那条线区分
    var iconArchive = function (checked, off) {
      return svgIcon([
        svgEl('rect', { x: 1.9, y: 2.1, width: 12.2, height: 3.4, rx: 1.1 }),
        svgEl('path', { d: 'M2.95 5.7v4.8a2.9 2.9 0 0 0 2.9 2.9h4.3a2.9 2.9 0 0 0 2.9-2.9V5.7' }),
        checked === true ? svgEl('path', { d: 'm6 9.35 1.4 1.4 2.6-2.6' }) : null,
        off === true ? svgEl('path', { d: 'm2.2 1.3 11.6 12.8' }) : null,
      ])
    }

    var menuIcon = function (kind) {
      if (kind === 'archive-off') return iconArchive(false, true)
      if (kind === 'archive-check') return iconArchive(true, false)
      return iconArchive(false, false)
    }

    /*
     * 打开菜单。
     *
     * event 可以是鼠标事件（右键菜单，贴着光标弹），
     * 也可以是一个按钮元素（视图选项这种，贴着按钮下沿、右对齐）。
     */
    var openMenu = function (event, items) {
      closeMenu()
      var box = h('div', { class: 'wl-menu' })
      // 菜单挂在 body 上，拿不到 root 上的主题属性与自定义变量，这里补一份
      adoptTheme(box)
      items.forEach(function (item) {
        if (item === '-') {
          box.appendChild(h('div', { class: 'wl-menu-sep' }))
          return
        }
        if (item.type === 'label') {
          box.appendChild(h('div', { class: 'wl-menu-label', text: item.text }))
          return
        }
        box.appendChild(h('button', {
          class: 'wl-menu-item' + (item.danger ? ' is-danger' : '') + (item.checked === true ? ' is-checked' : ''),
          disabled: item.disabled === true ? true : undefined,
          role: 'menuitem',
          'aria-checked': item.checked === true ? 'true' : undefined,
          onclick: function (ev) {
            ev.stopPropagation()
            closeMenu()
            if (item.disabled === true) return
            item.run(item)
          },
        },
          item.icon ? h('span', { class: 'wl-menu-icon' }, menuIcon(item.icon)) : null,
          h('span', { class: 'wl-menu-text', text: item.label }),
          item.checked === true ? h('span', { class: 'wl-menu-check', text: '✓' }) : null
        ))
      })
      // 先挂上去量一下尺寸，再摆位置，免得贴边溢出。
      box.style.left = '-9999px'
      box.style.top = '0px'
      doc.body.appendChild(box)
      var rect = box.getBoundingClientRect()
      var anchor = event !== null && typeof event === 'object' && event.nodeType === 1 ? event : null
      var x
      var y
      if (anchor !== null) {
        var ar = anchor.getBoundingClientRect()
        // 右对齐按钮（DSH 的视图选项菜单也是 align=end），空间不够再往左推
        x = ar.right - rect.width
        y = ar.bottom + 4
        if (y + rect.height > window.innerHeight - 8) y = Math.max(8, ar.top - rect.height - 4)
      } else {
        x = event.clientX
        y = event.clientY
      }
      x = Math.max(4, Math.min(x, window.innerWidth - rect.width - 8))
      y = Math.max(4, Math.min(y, window.innerHeight - rect.height - 8))
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

    /*
     * 视图选项菜单：和 DSH 侧栏那枚滑杆按钮同一套交互 ——
     * 一枚图标按钮，点开是一列带图标、选中项打勾的筛选项。
     */
    var openViewMenu = function (anchor) {
      openMenu(anchor, [
        { type: 'label', text: '归档' },
        {
          label: '只看未归档',
          icon: 'archive-off',
          checked: view.archiveMode === 'hide',
          run: function () { setArchiveMode('hide') },
        },
        {
          label: '归档一起显示',
          icon: 'archive',
          checked: view.archiveMode === 'all',
          run: function () { setArchiveMode('all') },
        },
        {
          label: '只看归档',
          icon: 'archive-check',
          checked: view.archiveMode === 'only',
          run: function () { setArchiveMode('only') },
        },
      ])
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
        style: { color: 'var(--wl-danger,#e5484d)', marginTop: '8px', display: 'none' },
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
        { label: labelOf('newTask') + '…', run: function () { openTaskModal(null, category) } },
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
      var warnInput = makeHoursField(isEdit && task.warnOwn ? task.warnHours : projectDefaultHours(categoryId))
      var inheritChip = h('button', { class: 'wl-btn', type: 'button' }, '')
      var customChip = h('button', { class: 'wl-btn', type: 'button' }, '单独设置')
      var warnHint = h('div', { class: 'wl-hint', text: '' })
      var syncWarn = function () {
        var custom = warnMode === 'custom'
        inheritChip.className = 'wl-btn' + (custom ? '' : ' is-primary')
        customChip.className = 'wl-btn' + (custom ? ' is-primary' : '')
        inheritChip.textContent = '跟随项目 · ' + hoursLabel(projectDefaultHours(categorySelect.value))
        warnInput.inputs.forEach(function (item) { item.disabled = !custom })
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

      var splitRequest = h('textarea', {
        class: 'wl-textarea',
        rows: 2,
        placeholder: '可留空：比如「按上线顺序拆」「每步半天以内」「先把测试写完再动手」',
      })

      /* 拆分时附截图：只在这一份请求里用，不落进数据文件。 */
      var splitImages = []
      var imageBox = h('div', { class: 'wl-imgs' })
      var fileInput = h('input', {
        type: 'file',
        accept: 'image/png,image/jpeg,image/webp,image/gif',
        multiple: true,
        style: { display: 'none' },
      })
      var MAX_IMAGES = 4

      var renderImages = function () {
        imageBox.textContent = ''
        splitImages.forEach(function (item, index) {
          imageBox.appendChild(h('div', { class: 'wl-img' },
            h('img', { src: item.url, alt: item.name }),
            h('button', {
              class: 'wl-img-del',
              type: 'button',
              title: '移除这张图',
              onclick: function () {
                splitImages.splice(index, 1)
                renderImages()
              },
            }, '×')
          ))
        })
        if (splitImages.length < MAX_IMAGES) {
          imageBox.appendChild(h('button', {
            class: 'wl-img-add',
            type: 'button',
            onclick: function () { fileInput.click() },
          }, '＋ 图片'))
        }
      }

      var shrinkImage = function (file) {
        return new Promise(function (resolve, reject) {
          var reader = new window.FileReader()
          reader.onerror = function () { reject(new Error('读不出这张图')) }
          reader.onload = function () {
            var dataUrl = String(reader.result || '')
            var image = new window.Image()
            image.onerror = function () { reject(new Error('这张图解不开')) }
            image.onload = function () {
              var width = image.naturalWidth || image.width
              var height = image.naturalHeight || image.height
              var limit = 1568
              var scale = Math.min(1, limit / Math.max(width, height))
              var tooBig = file.size > 1200 * 1024
              if (scale >= 1 && !tooBig) {
                resolve({ url: dataUrl, mediaType: file.type })
                return
              }
              try {
                var canvas = document.createElement('canvas')
                canvas.width = Math.max(1, Math.round(width * scale))
                canvas.height = Math.max(1, Math.round(height * scale))
                var context = canvas.getContext('2d')
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                resolve({ url: canvas.toDataURL('image/jpeg', 0.86), mediaType: 'image/jpeg' })
              } catch (error) {
                resolve({ url: dataUrl, mediaType: file.type })
              }
            }
            image.src = dataUrl
          }
          reader.readAsDataURL(file)
        })
      }

      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files || [])
        fileInput.value = ''
        var room = MAX_IMAGES - splitImages.length
        if (room <= 0) {
          splitHint.className = 'wl-hint is-error'
          splitHint.textContent = '最多附 ' + MAX_IMAGES + ' 张图。'
          return
        }
        files.slice(0, room).forEach(function (file) {
          if (!/^image\//.test(file.type)) return
          if (file.size > 8 * 1024 * 1024) {
            splitHint.className = 'wl-hint is-error'
            splitHint.textContent = '「' + file.name + '」超过 8MB，先压小一点。'
            return
          }
          shrinkImage(file).then(function (result) {
            splitImages.push({ name: file.name, mediaType: result.mediaType, url: result.url, data: result.url.split(',')[1] || '' })
            renderImages()
            splitHint.className = 'wl-hint'
            splitHint.textContent = splitImages.length + ' 张图会随这次拆分一起交给 DSH。'
          }).catch(function (error) {
            splitHint.className = 'wl-hint is-error'
            splitHint.textContent = String(error && error.message ? error.message : error)
          })
        })
      })

      renderImages()

      var splitButton = h('button', {
        class: 'wl-btn',
        onclick: function () {
          var payload = {
            title: titleInput.value.trim(),
            note: noteInput.value.trim(),
            hint: splitRequest.value.trim(),
            images: splitImages.map(function (item) { return { name: item.name, mediaType: item.mediaType, data: item.data } }),
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
          warnHours: warnMode === 'custom' ? warnInput.get() : null,
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
          h('span', { text: isEdit ? '编辑工作' : labelOf('newTask') }),
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
              warnInput.el
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
            h('div', { class: 'wl-field', style: { gap: '4px' } },
              h('span', { class: 'wl-label', text: '拆分要求（可选）' }),
              splitRequest,
              imageBox,
              fileInput
            ),
            h('div', { class: 'wl-split-row' },
              splitButton,
              splitHint
            )
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
      var input = makeHoursField(current)
      var hint = h('div', { class: 'wl-hint', text: '项目默认提前多久预警。每条工作可以在编辑窗口里单独设一个；没单独设的就跟这里走。' })
      var presets = [1, 6, 12, 24, 48, 72, 168]
      var chips = h('div', { class: 'wl-chips' }, presets.map(function (hours) {
        return h('button', {
          class: 'wl-btn',
          type: 'button',
          onclick: function () { input.set(hours) },
        }, hoursLabel(hours))
      }))

      var save = function () {
        var hours = input.get()
        if (hours === null || hours < 1) {
          hint.className = 'wl-hint is-error'
          hint.textContent = '最少 1 小时（天数或小时至少填一个）。'
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
            h('span', { class: 'wl-label', text: '提前量' }),
            input.el
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
      input.inputs[0].focus()
      input.inputs[0].select()
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
        if (mini.win !== null) {
          try { mini.win.close() } catch (error) { /* 已经关了 */ }
          mini.win = null
        }
        if (mini.overlay !== null) {
          mini.overlay.remove()
          mini.overlay = null
        }
        // 单窗口模式下这个窗口本身被缩成了小窗，卸载前一定要还原，否则用户会卡在 256×256
        if (mini.single === true) {
          mini.single = false
          request('POST', '/window/frame', { action: 'restore', matches: frameNeedles() }).catch(function () { /* 还不了就算了 */ })
        }
        mini.categoryId = null
        mini.root = null
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
